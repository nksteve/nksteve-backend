const router = require('express').Router();
const auth = require('../middleware/auth');
const { callProc } = require('../db/pool');

router.post('/getThoughtpad', auth, async (req, res) => {
  const { entityId } = req.body;
  try {
    const rows = await callProc('call getEntityThoughtpad(?)', [entityId]);
    res.json({ thoughtpads: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/updateThoughtpad', auth, async (req, res) => {
  const { action, entityId, thoughtpadId, content, title } = req.body;
  try {
    const rows = await callProc('call updateEntityThoughtpad(?,?,?,?,?)', [
      action || 'UPDATE', entityId, thoughtpadId || null, title || null, content || null
    ]);
    res.json({ result: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
