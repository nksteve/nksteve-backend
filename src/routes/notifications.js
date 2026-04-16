const { decryptRows, decryptRow } = require('../helpers/decrypt');
const router = require('express').Router();
const auth = require('../middleware/auth');
const { callProc, query } = require('../db/pool');

// Notifications — uses GET_Notification SP
// SP: (_entityId, _companyId, _gpId, _goalTagId, _actionTagId, _dateStart, _dateEnd)
// The SP has a bug when called from Node because JS null gets sent as literal NULL to DATE params
// Workaround: always pass actual date strings
router.post('/getNotifications', auth, async (req, res) => {
  const entityId = req.body.entityId || req.user?.entityId;
  const companyId = req.body.companyId || req.user?.companyId;
  const gpId = req.body.gpId || null;
  const goalTagId = req.body.goalTagId || null;
  const actionTagId = req.body.actionTagId || null;

  // Default to last 30 days if no dates provided
  const endDate = req.body.endDate || new Date().toISOString().split('T')[0];
  const startDate = req.body.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    const rows = await callProc('call GET_Notification(?,?,?,?,?,?,?)', [
      entityId, companyId || null, gpId, goalTagId, actionTagId, startDate, endDate
    ]);
    res.json({ notifications: rows[0] || [] });
  } catch (e) {
    // Fallback: query entity activity directly if SP fails
    console.warn('GET_Notification SP failed, using fallback:', e.message);
    try {
      const fallback = await query(
        `SELECT DISTINCT h.entityActivityId, h.entityId, h.growthPlanId, h.goalTagId, h.actionTagId,
         h.logType, h.activity, h.auditText, h.auditValue, h.auditMessage,
         h.auditLink, h.auditActivityType, h.createdUTC,
         eu.firstName, eu.lastName
         FROM v_entity_history_display h
         LEFT JOIN entity_user eu ON eu.entityId = h.entityId
         WHERE h.entityId = ? AND h.auditMessage IS NOT NULL
         AND h.createdUTC >= DATE_SUB(NOW(), INTERVAL 90 DAY)
         ORDER BY h.createdUTC DESC
         LIMIT 50`,
        [entityId]
      );
      res.json({ notifications: fallback });
    } catch (fallbackErr) {
      res.status(500).json({ error: e.message });
    }
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

module.exports = router;
