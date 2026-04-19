const { decryptRows, decryptRow } = require('../helpers/decrypt');
const router = require('express').Router();
const auth = require('../middleware/auth');
const { callProc, query } = require('../db/pool');

// Notifications list — direct query with proper joins for plan/goal names
router.post('/getNotifications', auth, async (req, res) => {
  const entityId  = req.body.entityId  || req.user?.entityId;
  const companyId = req.body.companyId || req.user?.companyId;
  const gpId        = req.body.gpId      || req.body.growthPlanId || null;
  const goalTagId   = req.body.goalTagId   || null;
  const actionTagId = req.body.actionTagId || null;

  const endDate   = req.body.endDate   || req.body.dateEnd   || new Date().toISOString().split('T')[0];
  const startDate = req.body.startDate || req.body.dateStart || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    const clauses = ['eu.companyId = ?', 'DATE(ea.createdUTC) >= ?', 'DATE(ea.createdUTC) <= ?'];
    const params  = [companyId, startDate, endDate];
    if (gpId)        { clauses.push('ea.growthPlanId = ?'); params.push(gpId); }
    if (goalTagId)   { clauses.push('ea.goalTagId = ?');    params.push(goalTagId); }
    if (actionTagId) { clauses.push('ea.actionTagId = ?');  params.push(actionTagId); }

    const rows = await query(
      `SELECT DISTINCT
          ea.entityActivityId, ea.entityId, ea.growthPlanId, ea.goalTagId, ea.actionTagId,
          ea.activity, ea.auditMessage, ea.auditLink, ea.createdUTC AS createdOn,
          eu.firstName, eu.lastName, eu.imageUri,
          gp.name,
          gt.alias AS goalName
       FROM entity_activity ea
       LEFT JOIN entity_user eu ON eu.entityId = ea.entityId
       LEFT JOIN gp_growthplan gp ON gp.growthPlanId = ea.growthPlanId
       LEFT JOIN gp_goaltag   gt ON gt.goalTagId   = ea.goalTagId
       WHERE ${clauses.join(' AND ')}
         AND ea.auditMessage IS NOT NULL
       ORDER BY ea.createdUTC DESC
       LIMIT 200`,
      params
    );
    const notifFields = ['firstName', 'lastName', 'imageUri'];
    const decrypted = decryptRows(rows || [], notifFields);
    res.json({ notifications: decrypted });
  } catch (e) {
    console.error('/getNotifications error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/getEntityDisplayActivity', auth, async (req, res) => {
  const { entityId, companyId, startDate, endDate, filter1 } = req.body;
  const eid = entityId || req.user?.entityId;
  try {
    const rows = await callProc('call getEntityDisplayActivity(?,?,?,?,?,null)', [
      eid, companyId || null, startDate || null, endDate || null, filter1 || null
    ]);
    res.json({ activities: rows[0] || [] });
  } catch (e) {
    console.error('getEntityDisplayActivity error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Log entity activity (used by print, etc.)
router.post('/updateEntityActivity', auth, async (req, res) => {
  const b = req.body;
  const entityId = b.entityId || req.user?.entityId;
  try {
    // SP: updateEntityActivity(_auditActivityType, _logType, _activity, _entityId, _growthPlanId, _goalTagId, _actionTagId, _meetingId, _page, _auditText, _auditValue, _auditMessage, _auditLink)
    const rows = await callProc('call updateEntityActivity(?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      b.auditActivityType || 'UIH',
      b.logType || 'I',
      b.activity || null,
      entityId,
      b.growthPlanId || null,
      b.goalTagId || null,
      b.actionTagId || null,
      b.meetingId || null,
      b.page || null,
      b.auditText || null,
      b.auditValue || null,
      b.auditMessage || null,
      b.auditLink || null,
    ]);
    res.json({ result: rows });
  } catch (e) {
    // Non-critical — log but don't fail
    console.warn('updateEntityActivity error:', e.message);
    res.json({ result: 'ok' });
  }
});

// Alias: singular /getNotification matches Vembu's API call naming
// Uses direct query since GET_Notification SP doesn't exist in this DB
router.post('/getNotification', auth, async (req, res) => {
  const entityId = req.body.entityId || req.user?.entityId;
  const companyId = req.body.companyId || req.user?.companyId;
  const gpId = req.body.growthPlanId || req.body.gpId || null;
  const goalTagId = req.body.goalTagId || null;
  const actionTagId = req.body.actionTagId || null;

  // Default to last 90 days for overview; honour dateStart/dateEnd filters
  const endDate   = req.body.dateEnd   || req.body.endDate   || new Date().toISOString().split('T')[0];
  const startDate = req.body.dateStart || req.body.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    // Build clauses
    const clauses = ['eu.companyId = ?', 'DATE(ea.createdUTC) >= ?', 'DATE(ea.createdUTC) <= ?'];
    const params  = [companyId, startDate, endDate];
    if (gpId)      { clauses.push('ea.growthPlanId = ?'); params.push(gpId); }
    if (goalTagId) { clauses.push('ea.goalTagId = ?');    params.push(goalTagId); }
    if (actionTagId) { clauses.push('ea.actionTagId = ?'); params.push(actionTagId); }

    const rows = await query(
      `SELECT DISTINCT
          ea.entityActivityId, ea.entityId, ea.growthPlanId, ea.goalTagId, ea.actionTagId,
          ea.activity, ea.auditMessage, ea.auditLink, ea.createdUTC AS createdOn,
          eu.firstName, eu.lastName, eu.imageUri,
          gp.name,
          gt.alias AS goalName
       FROM entity_activity ea
       LEFT JOIN entity_user eu ON eu.entityId = ea.entityId
       LEFT JOIN gp_growthplan gp ON gp.growthPlanId = ea.growthPlanId
       LEFT JOIN gp_goaltag   gt ON gt.goalTagId   = ea.goalTagId
       WHERE ${clauses.join(' AND ')}
         AND ea.auditMessage IS NOT NULL
       ORDER BY ea.createdUTC DESC
       LIMIT 200`,
      params
    );
    const notifFields = ['firstName', 'lastName', 'imageUri'];
    const decrypted = decryptRows(rows || [], notifFields);
    res.json({ results: decrypted, notifications: decrypted });
  } catch (e) {
    console.error('/getNotification error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
