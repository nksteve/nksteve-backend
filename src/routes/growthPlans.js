const router = require('express').Router();
const auth = require('../middleware/auth');
const { callProc, query } = require('../db/pool');
const { decryptRows, decryptRow } = require('../helpers/decrypt');
const multer = require('multer');
const AWS    = require('aws-sdk');
const path   = require('path');

// ─── AWS S3 config — loaded from .env ───────────────────────────────────────
const S3_API_KEY     = process.env.S3_API_KEY;
const S3_API_SECRET  = process.env.S3_API_SECRET;
const S3_BUCKET      = process.env.S3_BUCKET      || 'dsdar-missionboss';
const S3_GOAL_FOLDER = process.env.S3_GOAL_FOLDER || 'dsdar-goal-documents';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── getCommunityGrowthPlanDetail SP signature ───────────────────────────────
// call getCommunityGrowthPlanDetail(_action, _entityId, _gpId, _statusId, _search, _teamId, _companyId)

// Get growth plan summary / details
router.post('/growth-plan-details', auth, async (req, res) => {
  const { action, growthPlanId, statusId, childPlanId } = req.body;
  // Fall back to JWT claims if not provided in body
  const entityId  = req.body.entityId  || req.user?.entityId;
  const companyId = req.body.companyId || req.user?.companyId;
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
      // Detail for a specific plan — query view directly (SP filters by ownership and misses shared plans)
      const statusMap = { 1: 'Open', 2: 'Complete', 3: 'Active', 4: 'Closed', 5: 'Deleted' };
      const { decryptRow } = require('../helpers/decrypt');

      // 1. Get plan header from gp_growthplan + color
      // Note: gp_growthplan has no entityId — ownership is tracked via cgp_contributors
      const planRows = await query(
        `SELECT g.*, CONCAT('#', c.hex) AS colorCodeHex FROM gp_growthplan g
         LEFT JOIN att_colorcodes c ON g.colorCode = c.colorCodeId
         WHERE g.growthPlanId = ?`,
        [growthPlanId]
      );
      const gp = planRows[0];
      if (!gp) return res.json({ growthPlan: {}, goals: [], actions: [] });

      // 2. Get plan owner from cgp_contributors
      // The owner is the row where entityId = ownerId (self-referencing)
      const ownerContribRows = await query(
        `SELECT entityId FROM cgp_contributors WHERE cgpId = ? AND entityId = ownerId LIMIT 1`,
        [growthPlanId]
      );
      const ownerEntityId = ownerContribRows[0]?.entityId || entityId;

      const ownerRows = await query(
        `SELECT entityId, firstName, lastName FROM entity_user WHERE entityId = ?`,
        [ownerEntityId]
      );
      const ownerRaw = ownerRows[0] || {};
      const ownerDec = decryptRow(ownerRaw);

      // Also get the requesting user's name as fallback
      const meRows = await query(
        `SELECT entityId, firstName, lastName FROM entity_user WHERE entityId = ?`,
        [entityId]
      );
      const meDec = decryptRow(meRows[0] || {});

      const ownerFirst = ownerDec.firstName || meDec.firstName || '';
      const ownerLast  = ownerDec.lastName  || meDec.lastName  || '';

      // 2b. Get computed percentAchieved from SP (it aggregates from goals/actions)
      // The SP returns the real computed % — gp_growthplan.percentAchieved may be stale/0
      let computedPercent = gp.percentAchieved || 0;
      try {
        const spRows = await callProc(
          'call getCommunityGrowthPlanDetail(?,?,?,?,?,?,?)',
          ['AllPlans', entityId, null, 1, null, null, companyId]
        );
        const spPlan = (spRows[0] || []).find(r => r.growthPlanId == growthPlanId);
        if (spPlan && spPlan.growthPlanPercentAchieved != null) {
          computedPercent = spPlan.growthPlanPercentAchieved;
        }
      } catch (e) {
        // SP might not include this plan if entity isn't owner — use raw value
      }

      const planHeader = {
        growthPlanId:              gp.growthPlanId,
        growthPlanName:            gp.name,
        name:                      gp.name,
        growthPlanComments:        gp.comments,
        growthPlanMilestoneDate:   gp.milestoneDate,
        milestoneDate:             gp.milestoneDate,
        growthPlanPercentAchieved: computedPercent,
        growthPlanStatus:          statusMap[gp.statusId] || 'Open',
        statusId:                  gp.statusId,
        wizzardStage:              gp.wizzardStage,
        sessionTimeBank:           gp.sessionTimeBank,
        sessionScope:              gp.sessionScope,
        sessionDurationMin:        gp.sessionDurationMin,
        CGP_status:                gp.CGP_status,
        videoYN:                   gp.videoYN,
        videoLink:                 gp.videoLink,
        colorCodeHex:              gp.colorCodeHex || null,
        entityId:                  ownerEntityId,
        ownerEntityId:             ownerEntityId,
        firstName:                 ownerFirst,
        lastName:                  ownerLast,
        ownerName:                 `${ownerFirst} ${ownerLast}`.trim(),
        createdDate:               gp.created,
        completedOn:               gp.completed,
        allowAccess:               (entityId === ownerEntityId) ? 'EDIT' : 'VIEW',
      };

      // 3. Get goals from cgp_view — has live percentAchieved (0-1 decimal, multiply *100 for display)
      const goalRows = await query(
        `SELECT DISTINCT goalTagId, goalName, goalPercentAchieved, milestoneDate AS goalMilestoneDate, goalFeedbackStatus
         FROM cgp_view
         WHERE growthPlanId = ? AND goalTagId IS NOT NULL AND actionTagId IS NULL
         ORDER BY goalTagId`,
        [growthPlanId]
      );

      const goals = goalRows.map(r => ({
        goalId:              r.goalTagId,
        goalTagId:           r.goalTagId,
        goalName:            r.goalName || '(unnamed)',
        goalObjectives:      null,
        // cgp_view stores 0-1 decimal → multiply by 100 for display
        goalPercentAchieved: (r.goalPercentAchieved || 0) * 100,
        goalMilestoneDate:     r.goalMilestoneDate,
        goalFeedbackStatus:    r.goalFeedbackStatus,
        goalStatus:            'Open',
      }));

      // 4. Get actions from cgp_view — has live actionGoalPercentAchieve (0-1 decimal)
      const goalIds = goalRows.map(r => r.goalTagId);
      let actions = [];
      if (goalIds.length > 0) {
        const placeholders = goalIds.map(() => '?').join(',');
        const actionRows = await query(
          `SELECT actionTagId, goalTagId, milestoneDate AS endDate,
                  actionGoalMilestoneDate, actionFeedbackStatus,
                  actionGoalPercentAchieve, actionName
           FROM cgp_view
           WHERE growthPlanId = ? AND actionTagId IS NOT NULL AND goalTagId IN (${placeholders})
           ORDER BY actionTagId`,
          [growthPlanId, ...goalIds]
        );
        // Fetch notes + docs counts for actions
        const actionTagIds = actionRows.map(r => r.actionTagId);
        let notesCountMap = {}, docsCountMap = {};
        if (actionTagIds.length > 0) {
          const ph2 = actionTagIds.map(() => '?').join(',');
          const [nc] = await query(
            `SELECT actionTagId, COUNT(*) AS cnt FROM gp_notes WHERE growthPlanId=? AND actionTagId IN (${ph2}) GROUP BY actionTagId`,
            [growthPlanId, ...actionTagIds]
          );
          (Array.isArray(nc) ? nc : [nc]).forEach(r => { if (r && r.actionTagId) notesCountMap[r.actionTagId] = r.cnt; });
          const [dc] = await query(
            `SELECT actionTagId, COUNT(*) AS cnt FROM documents WHERE growthPlanId=? AND actionTagId IN (${ph2}) GROUP BY actionTagId`,
            [growthPlanId, ...actionTagIds]
          );
          (Array.isArray(dc) ? dc : [dc]).forEach(r => { if (r && r.actionTagId) docsCountMap[r.actionTagId] = r.cnt; });
        }
        actions = actionRows.map(r => ({
          actionId:                r.actionTagId,
          actionTagId:             r.actionTagId,
          goalId:                  r.goalTagId,
          actionName:              r.actionName || '(unnamed)',
          actionStatus:            'Open',
          // cgp_view stores 0-1 decimal → multiply by 100 for display
          actionGoalPercentAchieve: (r.actionGoalPercentAchieve || 0) * 100,
          endDate:                 r.actionGoalMilestoneDate || null,
          actionFeedbackStatus:    r.actionFeedbackStatus,
          notesCount:              notesCountMap[r.actionTagId] || 0,
          docsCount:               docsCountMap[r.actionTagId] || 0,
        }));
      }

      // Fetch notes + docs counts for goals
      const goalTagIds = goalRows.map(r => r.goalTagId);
      let goalNotesMap = {}, goalDocsMap = {};
      if (goalTagIds.length > 0) {
        const ph3 = goalTagIds.map(() => '?').join(',');
        const gnc = await query(
          `SELECT goalTagId, COUNT(*) AS cnt FROM gp_notes WHERE growthPlanId=? AND goalTagId IN (${ph3}) AND actionTagId IS NULL GROUP BY goalTagId`,
          [growthPlanId, ...goalTagIds]
        );
        (Array.isArray(gnc) ? gnc : [gnc]).forEach(r => { if (r && r.goalTagId) goalNotesMap[r.goalTagId] = r.cnt; });
        const gdc = await query(
          `SELECT goalTagId, COUNT(*) AS cnt FROM documents WHERE growthPlanId=? AND goalTagId IN (${ph3}) AND actionTagId IS NULL GROUP BY goalTagId`,
          [growthPlanId, ...goalTagIds]
        );
        (Array.isArray(gdc) ? gdc : [gdc]).forEach(r => { if (r && r.goalTagId) goalDocsMap[r.goalTagId] = r.cnt; });
      }
      const goalsWithCounts = goals.map(g => ({
        ...g,
        notesCount: goalNotesMap[g.goalTagId] || 0,
        docsCount:  goalDocsMap[g.goalTagId]  || 0,
      }));

      return res.json({ growthPlan: planHeader, goals: goalsWithCounts, actions });
    }
  } catch (e) {
    console.error('growth-plan-details error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Dashboard plans endpoint — mirrors vembu exactly:
// calls getCommunityGrowthPlanDetail('AllPlans', entityId, null, 1, null, null, companyId)
// which returns only open/active plans owned by or shared with the entity
router.post('/getMyPlans', auth, async (req, res) => {
  const { entityId, companyId, action } = req.body;
  const eid     = entityId  || req.user?.entityId;
  const cid     = companyId || req.user?.companyId;
  const _action = action    || 'AllPlans';
  // statusId mapping for tab actions
  const statusIdMap = {
    'AllPlans':              1,
    'MyGrowthPlans':         1,
    'MyCompletedGoalPlans':  2,
    'DeleteGoalPlan':        5,
    'InvitedGoalPlans':      1,
    'MyAssignedGoals':       1,  // Nested Plans tab — assigned/nested plans
  };
  const _statusId = statusIdMap[_action] || 1;
  try {
    // SP: getCommunityGrowthPlanDetail(_action, _entityId, _gpId, _statusId, _search, _teamId, _companyId)
    const rows = await callProc(
      'call getCommunityGrowthPlanDetail(?,?,?,?,?,?,?)',
      [_action, eid, null, _statusId, null, null, cid]
    );
    const flat = rows[0] || [];
    const raw  = decryptRows(flat);

    // De-duplicate by growthPlanId — SP returns one row per goal/action
    const seen  = new Set();
    const statusMap = { 1: 'Open', 2: 'Complete', 3: 'Active', 4: 'Closed', 5: 'Deleted' };
    const plans = [];
    raw.forEach(r => {
      if (!r.growthPlanId || seen.has(r.growthPlanId)) return;
      seen.add(r.growthPlanId);
      const planStatusId = r.statusId || 1;
      plans.push({
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
      });
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

// Update action progress (slider drag — matches vembu updateAction proc)
// Body: { updateDelete, goalTagId, action: { actionTagId, growthPlanId, tagId, progress(0-1), ownerId, teamId } }
router.post('/updateActionProgress', auth, async (req, res) => {
  try {
    const { updateDelete, goalTagId, action: a } = req.body;
    // progress comes in as 0-1 decimal from frontend (matching vembu)
    const rows = await callProc('call updateAction(?,?,?,?,?,?,?,?,?,?)', [
      updateDelete || 'PROGRESS',
      a.growthPlanId  || null,
      a.actionTagId   || null,
      goalTagId       || null,
      a.tagId         || null,
      a.ownerId       || null,
      a.actionMilestoneDate || null,
      a.progress      != null ? a.progress : null,
      a.orderBy       || null,
      a.teamId        || String(a.growthPlanId), // vembu: teamId defaults to planId string
    ]);
    res.json({ result: rows });
  } catch (e) {
    console.error('updateActionProgress error:', e.message);
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

/* ─── Notes: GET / ADD / DELETE ─────────────────────────────────────────────── */
router.post('/updateGoalActionNotes', auth, async (req, res) => {
  const { action, growthPlanId, goalTagId, actionTagId, notesType, notes, notesId } = req.body;
  const entityId = req.user.entityId;
  try {
    if (action === 'GET') {
      const filter = actionTagId
        ? 'n.growthPlanId=? AND n.goalTagId=? AND n.actionTagId=?'
        : goalTagId
          ? 'n.growthPlanId=? AND n.goalTagId=? AND n.actionTagId IS NULL'
          : 'n.growthPlanId=?';
      const params = actionTagId
        ? [growthPlanId, goalTagId, actionTagId]
        : goalTagId
          ? [growthPlanId, goalTagId]
          : [growthPlanId];
      const rows = await query(
        `SELECT n.*, e.firstName, e.lastName FROM gp_notes n
         LEFT JOIN entity e ON e.entityId = n.entityId
         WHERE ${filter} ORDER BY n.created DESC`,
        params
      );
      const decrypted = decryptRows(rows);
      return res.json({ result: decrypted });
    }
    if (action === 'ADD' || action === 'SAVE') {
      await query(
        `INSERT INTO gp_notes (communityGrowthPlanId, growthPlanId, goalTagId, actionTagId, teamId, entityId, notesType, notes, gp_type, created, lastUpdated)
         VALUES (?,?,?,?,?,?,?,?,1,NOW(),NOW())`,
        [growthPlanId, growthPlanId, goalTagId || null, actionTagId || null, String(growthPlanId), entityId, notesType || 'public', notes]
      );
      const rows = await query(
        'SELECT * FROM gp_notes WHERE growthPlanId=? AND goalTagId<=>? AND actionTagId<=>? ORDER BY created DESC',
        [growthPlanId, goalTagId || null, actionTagId || null]
      );
      return res.json({ result: rows });
    }
    if (action === 'UPDATE') {
      await query('UPDATE gp_notes SET notes=?, lastUpdated=NOW() WHERE notesId=? AND entityId=?', [notes, notesId, entityId]);
      const rows = await query(
        'SELECT * FROM gp_notes WHERE growthPlanId=? AND goalTagId<=>? AND actionTagId<=>? ORDER BY created DESC',
        [growthPlanId, goalTagId || null, actionTagId || null]
      );
      return res.json({ result: rows });
    }
    if (action === 'DELETE') {
      await query('DELETE FROM gp_notes WHERE notesId=? AND entityId=?', [notesId, entityId]);
      return res.json({ result: { deleted: true } });
    }
    res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── Documents: GET / ADD / DELETE ─────────────────────────────────────────── */
router.post('/updateGoalfile', auth, async (req, res) => {
  const { action, growthPlanId, goalTagId, actionTagId, fileName, fileUrl, documentId } = req.body;
  try {
    if (action === 'GET') {
      const filter = actionTagId
        ? 'WHERE growthPlanId=? AND goalTagId=? AND actionTagId=?'
        : goalTagId
          ? 'WHERE growthPlanId=? AND goalTagId=? AND actionTagId IS NULL'
          : 'WHERE growthPlanId=?';
      const params = actionTagId
        ? [growthPlanId, goalTagId, actionTagId]
        : goalTagId
          ? [growthPlanId, goalTagId]
          : [growthPlanId];
      const rows = await query(`SELECT * FROM documents ${filter} ORDER BY created DESC`, params);
      return res.json({ result: rows });
    }
    if (action === 'ADD') {
      await query(
        `INSERT INTO documents (growthPlanId, teamId, goalTagId, actionTagId, fileName, fileUrl, created)
         VALUES (?,?,?,?,?,?,NOW())`,
        [growthPlanId, String(growthPlanId), goalTagId || null, actionTagId || null, fileName, fileUrl]
      );
      const rows = await query(
        'SELECT * FROM documents WHERE growthPlanId=? AND goalTagId<=>? AND actionTagId<=>? ORDER BY created DESC',
        [growthPlanId, goalTagId || null, actionTagId || null]
      );
      return res.json({ result: rows });
    }
    if (action === 'DELETE') {
      await query('DELETE FROM documents WHERE documentId=?', [documentId]);
      return res.json({ result: { deleted: true } });
    }
    res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── File Upload — multer + S3 ─────────────────────────────────────────────
router.post('/fileUpload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const allowed = ['jpeg','jpg','gif','png','pdf','mp4','mkv','3gp','doc','docx','docm','pptx','xls','xlsx','xlsm'];
    const ext = path.extname(req.file.originalname).replace('.','').toLowerCase();
    if (!allowed.includes(ext)) return res.status(400).json({ error: 'File format not supported' });

    const entityId  = req.body.entityId || req.user?.entityId || 'unknown';
    const timestamp = Date.now();
    const key       = `${S3_GOAL_FOLDER}/${timestamp}-${entityId}.${ext}`;

    AWS.config.update({ accessKeyId: S3_API_KEY, secretAccessKey: S3_API_SECRET, region: 'us-east-1' });
    const s3 = new AWS.S3();

    const result = await s3.upload({
      ACL:         'public-read',
      Bucket:      S3_BUCKET,
      Key:         key,
      Body:        req.file.buffer,
      ContentType: req.file.mimetype,
    }).promise();

    return res.json({ Location: result.Location, Key: result.Key });
  } catch (e) {
    console.error('fileUpload error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
