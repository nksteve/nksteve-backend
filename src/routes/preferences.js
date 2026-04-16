const router = require('express').Router();
const auth = require('../middleware/auth');
const { callProc } = require('../db/pool');

router.post('/preferences', auth, async (req, res) => {
  const { action, entityId, gpId, access, tabnumber } = req.body;
  try {
    const rows = await callProc('call updatePreferences(?,?,?,?,?)', [
      action, entityId, gpId || null, access || 0, tabnumber || 0
    ]);
    res.json({ result: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
