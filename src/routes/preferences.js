const { decryptRows, decryptRow } = require('../helpers/decrypt');
const router = require('express').Router();
const auth = require('../middleware/auth');
const { callProc } = require('../db/pool');

router.post('/preferences', auth, async (req, res) => {
  const { action, entityId, gpId, access, tabnumber, companyId } = req.body;
  try {
    // SP: preferences(_action, _companyId, _entityId, _gpId, _access, _tabnumber)
    const rows = await callProc('call preferences(?,?,?,?,?,?)', [
      action, companyId || null, entityId, gpId || null, access || 0, tabnumber || 0
    ]);
    res.json({ result: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
