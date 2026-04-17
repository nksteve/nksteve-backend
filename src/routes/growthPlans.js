const router = require('express').Router();
const auth = require('../middleware/auth');
const { callProc, query } = require('../db/pool');
const { decryptRows, decryptRow } = require('../helpers/decrypt');

// ─── getCommunityGrowthPlanDetail SP signature ───────────────────────────────
// call getCommunityGrowthPlanDetail(_action, _entityId, _gpId, _statusId, _search, _teamId, _companyId)

// Get growth plan summary / details
router.post('/growth-plan-details', auth, async (req, res) => {
  const { action, entityId, growthPlanId, statusId, childPlanId, companyId } = req.body;
  try {
    let rows;
    if (action === 'MyGrowthPlans' || action === 'CompletedPlans' || action === 'MyCompletedGoalPlans') {
      rows = await callProc('call getGrowthPlanSummary(?)', [entityId]);
      const plans = rows[0] || [];
      return res.json({ plans, myPlans: plans });
    } else if (action === 'TeamGrowthPlans') {
      rows = await callProc('call getGrowthPlanSummary(?)', [entityId]);
      return res.json({ plans: rows[0] || [] });
    } else {
      // Detail for a specific plan
      // SP: getCommunityGrowthPlanDetail(_action, _entityId, _gpId, _statusId, _search, _teamId, _companyId)
      // Always use 'MyGrowthPlans' — SP only recognises a fixed set of actions
      const _action = 'MyGrowthPlans';
      const _statusId = statusId || 2;
      rows = await callProc('call getCommunityGrowthPlanDetail(?,?,?,?,?,?,?)', [
        _action, entityId, growthPlanId || null, _statusId, null, null, companyId || null
      ]);
      const flatRows = rows[0] || [];

      // Map statusId to label
      const statusMap = { 1: 'Open', 2: 'Complete', 3: 'Active', 4: 'Closed' };

      // Extract plan header from first row
      const planHeader = flatRows.length > 0 ? {
        growthPlanId: flatRows[0].growthPlanId,
        growthPlanName: flatRows[0].growthPlanName,
        growthPlanComments: flatRows[0].growthPlanComments,
        growthPlanMilestoneDate: flatRows[0].growthPlanMilestoneDate,
        growthPlanPercentAchieved: flatRows[0].growthPlanPercentAchieved,
        growthPlanStatus: statusMap[flatRows[0].statusId] || 'Open',
        statusId: flatRows[0].statusId,
        wizzardStage: flatRows[0].wizzardStage,
        sessionTimeBank: flatRows[0].sessionTimeBank,
        sessionScope: flatRows[0].sessionScope,
        sessionDurationMin: flatRows[0].sessionDurationMin,
        CGP_status: flatRows[0].CGP_status,
        videoYN: flatRows[0].videoYN,
        videoLink: flatRows[0].videoLink,
        colorCodeHex: flatRows[0].colorCodeHex,
        pendingMeetings: flatRows[0].pendingMeetings,
        entityId: flatRows[0].entityId,
        firstName: flatRows[0].firstName,
        lastName: flatRows[0].lastName,
        createdDate: flatRows[0].createdDate,
        completedOn: flatRows[0].completedOn,
      } : {};

      // Extract unique goals
      const goalsMap = new Map();
      flatRows.forEach(row => {
        if (row.goalTagId && !goalsMap.has(row.goalTagId)) {
          goalsMap.set(row.goalTagId, {
            goalId: row.goalTagId,
            goalTagId: row.goalTagId,
            goalName: row.goalName,
            goalObjectives: row.goalObjectives,
            goalPercentAchieved: row.goalPercentAchieved,
            goalMilestoneDate: row.goalMilestoneDate,
            goalStatus: statusMap[row.goalStatusId] || 'Open',
            category: row.categoryName || null,
          });
        }
      });

      // Extract unique actions per goal
      const actionsMap = new Map();
      flatRows.forEach(row => {
        if (row.actionTagId && !actionsMap.has(row.actionTagId)) {
          actionsMap.set(row.actionTagId, {
            actionId: row.actionTagId,
            actionTagId: row.actionTagId,
            goalId: row.goalTagId,
            actionName: row.actionName,
            actionStatus: statusMap[row.actionStatusId] || 'Open',
            actionGoalPercentAchieve: row.actionGoalPercentAchieve,
          });
        }
      });

      return res.json({
        growthPlan: planHeader,
        goals: Array.from(goalsMap.values()),
        actions: Array.from(actionsMap.values()),
        rawRows: flatRows.length, // for debug
      });
    }
  } catch (e) {
    console.error('growth-plan-details error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Dashboard plans endpoint
router.post('/getMyPlans', auth, async (req, res) => {
  const { entityId } = req.body;
  const eid = entityId || req.user?.entityId;
  try {
    const rows = await callProc('call getGrowthPlanSummary(?)', [eid]);
    const raw = decryptRows(rows[0] || []);
    // Map SP field names to match vembu model (gp.name = resultSet.growthPlanName etc.)
    const statusMap = { 1: 'Open', 2: 'Complete', 3: 'Active', 4: 'Closed', 5: 'Deleted' };
    const plans = raw.map(r => {
      // v_growthPlanSummary returns growthPlanStatusId for plan status
      // and statusId for the user's account status — use growthPlanStatusId
      const planStatusId = r.growthPlanStatusId || r.statusId || 1;
      return {
        ...r,
        name:                      r.growthPlanName || r.name || '',
        milestoneDate:             r.growthPlanMilestoneDate || r.milestoneDate || '',
        growthPlanPercentAchieved: r.growthPlanPercentAchieved || 0,
        colorCodeHex:              r.colorCodeHex || r.colorCode || null,
        statusId:                  planStatusId,
        status:                    statusMap[planStatusId] || 'Open',
        statusLabel:               statusMap[planStatusId] || 'Open',
        firstName:                 r.firstName || '',
        lastName:                  r.lastName  || '',
        growthPlanId:              r.growthPlanId,
        isDeleted:                 planStatusId === 5,
      };
    });
    res.json({ plans, myPlans: plans });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create new growth plan
router.post('/newGrowthPlan', auth, async (req, res) => {
  const { action, entityId, companyId, name, milestoneDate, statusId, colorCode, wizzardStage, sessionTimeBank, sessionScope, sessionDurationMin } = req.body;
  try {
    const rows = await callProc('call updateGrowthPlanSummary(?,?,?,?,?,?,?,?,?,?,?,?,?,null,?,?,?)', [
      action || 'INSERT', null, companyId || null, entityId, name || null,
      null, milestoneDate || null, wizzardStage || null, sessionTimeBank || null,
      sessionScope || null, sessionDurationMin || null, statusId || null,
      colorCode || null, null, null, null
    ]);
    res.json({ result: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update growth plan
router.post('/updateGrowthplanSummary', auth, async (req, res) => {
  const { action, entityId, companyId, growthPlanId, name, comments, milestoneDate, wizzardStage, sessionTimeBank, sessionScope, sessionDurationMin, statusId, colorCode, videoYN, videoLink, childPlanId } = req.body;
  try {
    const rows = await callProc('call updateGrowthPlanSummary(?,?,?,?,?,?,?,?,?,?,?,?,?,null,?,?,?)', [
      action || 'UPDATE', growthPlanId || null, companyId || null, entityId,
      name || null, comments || null, milestoneDate || null, wizzardStage || null,
      sessionTimeBank || null, sessionScope || null, sessionDurationMin || null,
      statusId || null, colorCode || null, videoYN || null, videoLink || null, childPlanId || null
    ]);
    res.json({ result: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update goal
router.post('/updateGoal', auth, async (req, res) => {
  const g = req.body;
  try {
    const rows = await callProc('call updateGoal(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      g.action || 'UPDATE', g.goalId || null, g.growthPlanId || null, g.entityId,
      g.name || null, g.categoryId || null, g.statusId || null, g.measureTypeId || null,
      g.startValue || null, g.targetValue || null, g.actualValue || null,
      g.minValue || null, g.maxValue || null, g.stretchValue || null,
      g.startDate || null, g.endDate || null, g.comments || null,
      g.goalOrder || null, g.companyId || null, g.goalTagId || null,
      g.teamId || null, g.isCGP || null, g.minName || null, g.maxName || null, g.stretchName || null
    ]);
    res.json({ result: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update action
router.post('/updateAction', auth, async (req, res) => {
  const a = req.body;
  try {
    const rows = await callProc('call updateGoalAction(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      a.action || 'UPDATE', a.actionId || null, a.goalId || null, a.entityId,
      a.name || null, a.statusId || null, a.actionOrder || null,
      a.startDate || null, a.endDate || null, a.comments || null,
      a.companyId || null, a.teamId || null, a.isCGP || null,
      a.measureId || null, a.actualValue || null
    ]);
    res.json({ result: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update plans order
router.post('/updatePlansOrder', auth, async (req, res) => {
  const { entityId, planOrderList } = req.body;
  try {
    const rows = await callProc('call updateGrowthPlanOrder(?,?)', [entityId, JSON.stringify(planOrderList)]);
    res.json({ result: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update goals order
router.post('/updateGoalsOrder', auth, async (req, res) => {
  const { growthPlanId, goalOrderList } = req.body;
  try {
    const rows = await callProc('call updateGoalOrder(?,?)', [growthPlanId, JSON.stringify(goalOrderList)]);
    res.json({ result: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update actions order
router.post('/updateActionsOrder', auth, async (req, res) => {
  const { goalId, actionOrderList } = req.body;
  try {
    const rows = await callProc('call updateActionOrder(?,?)', [goalId, JSON.stringify(actionOrderList)]);
    res.json({ result: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Notes (GET and UPDATE)
router.post('/cgp-notes', auth, async (req, res) => {
  const { action, growthPlanId, entityId, notes, notesId } = req.body;
  try {
    if (action === 'UPDATE' || action === 'INSERT') {
      await callProc('call CGP_updateNotes(?,?,?,?)', [growthPlanId, entityId, notes || null, notesId || null]);
    }
    const rows = await callProc('call CGP_getNotes(?,?)', [growthPlanId, entityId]);
    res.json({ notes: rows[0] || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get contributors
router.post('/cgp_getAllContributors', auth, async (req, res) => {
  const { action, entityId, companyId, growthPlanId } = req.body;
  try {
    const rows = await callProc('call cgp_getAllContributors(?,?,?)', [entityId, companyId, growthPlanId || null]);
    res.json({ contributors: rows[0] || [], result: rows[0] || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get CGP plan by contributor
router.post('/getCGPGrowthPlanByContributor', auth, async (req, res) => {
  const { entityId } = req.body;
  try {
    const rows = await callProc('call CGP_getGrowthPlanByContributor(?)', [entityId]);
    res.json({ result: rows[0] || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add CGP contributor
router.post('/addCGPContributor', auth, async (req, res) => {
  const { action, entityId, communityGrowthPlanId, ownerId, teamId } = req.body;
  try {
    const rows = await callProc('call CGP_addContributor(?,?,?,?,?)', [action, entityId, communityGrowthPlanId, ownerId, teamId]);
    res.json({ result: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update CGP flag
router.post('/updateCGPflag', auth, async (req, res) => {
  const { growthPlanId, cgpStatus, startDate, sessionFrequency, entityId, teamId } = req.body;
  try {
    const rows = await callProc('call CGP_updateCGPStatus(?,?,?,?,?,?)', [growthPlanId, cgpStatus, startDate, sessionFrequency, entityId, teamId]);
    res.json({ result: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get templates
router.post('/getTemplates', auth, async (req, res) => {
  const { action, companyId, teamId } = req.body;
  try {
    const rows = await callProc('call getGrowthPlanTemplate(?,?,?)', [action, companyId, teamId || null]);
    res.json({ result: rows[0] || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Move templates
router.post('/moveTemplates', auth, async (req, res) => {
  const { action, growthPlanId, entityId, companyId } = req.body;
  try {
    const rows = await callProc('call moveGrowthPlanTemplate(?,?,?,?)', [action, growthPlanId, entityId, companyId]);
    res.json({ result: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Timebank template
router.post('/getTimebankTemplate', auth, async (req, res) => {
  const { growthPlanId, entityId } = req.body;
  try {
    const rows = await callProc('call getTimebankTemplate(?,?)', [growthPlanId, entityId]);
    res.json({ result: rows[0] || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/updateTimebankTemplate', auth, async (req, res) => {
  const t = req.body;
  try {
    const rows = await callProc('call updateTimebankTemplate(?,?,?,?,?,?,?,?)', [
      t.action, t.growthPlanId, t.entityId, t.weekNumber, t.sessionDuration, t.sessionType, t.sessionDate, t.notes
    ]);
    res.json({ result: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
