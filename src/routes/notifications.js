const router = require('express').Router();
const auth = require('../middleware/auth');
const { callProc } = require('../db/pool');

router.post('/getNotifications', auth, async (req, res) => {
  const { entityId, companyId, startDate, endDate, filter1, statusId, action } = req.body;
  try {
    const rows = await callProc('call GET_Notification(?,?,?,?,?,?,?)', [
      entityId, companyId || null, startDate || null, endDate || null,
      filter1 || null, statusId || null, action || 'GET'
    ]);
    res.json({ notifications: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/getEntityDisplayActivity', auth, async (req, res) => {
  const { entityId, companyId, startDate, endDate, filter1 } = req.body;
  try {
    const rows = await callProc('call getEntityDisplayActivity(?,?,?,?,?,null)', [
      entityId, companyId || null, startDate || null, endDate || null, filter1 || null
    ]);
    res.json({ activities: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
