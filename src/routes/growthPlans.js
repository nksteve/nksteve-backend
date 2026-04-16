const router = require('express').Router();
const auth = require('../middleware/auth');
const { callProc } = require('../db/pool');

// Get growth plan summary / details
router.post('/growth-plan-details', auth, async (req, res) => {
  const { action, entityId, growthPlanId, statusId, childPlanId, companyId } = req.body;
  try {
    let rows;
    if (action === 'MyGrowthPlans' || action === 'CompletedPlans') {
      rows = await callProc('call getGrowthPlanSummary(?)', [entityId]);
      const plans = rows[0] || [];
      return res.json({ plans, myPlans: plans });
    } else if (action === 'TeamGrowthPlans') {
      rows = await callProc('call getGrowthPlanSummary(?)', [entityId]);
      return res.json({ plans: rows[0] || [] });
    } else {
      // Detail for a specific plan
      rows = await callProc('call getCommunityGrowthPlanDetail(?,?,?,?,?,?,?)', [
        growthPlanId || null, entityId, statusId || null, childPlanId || null,
        companyId || null, null, null
      ]);
      return res.json({ growthPlan: rows[0] || [], goals: rows[1] || [], actions: rows[2] || [] });
    }
  } catch (e) {
    console.error(e);
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

// Notes
router.post('/cgp-notes', auth, async (req, res) => {
  const { action, growthPlanId, entityId, notes, notesId } = req.body;
  try {
    const rows = await callProc('call CGP_getNotes(?,?)', [growthPlanId, entityId]);
    res.json({ notes: rows[0] || [] });
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
