const { decryptRows, decryptRow } = require('../helpers/decrypt');
const router = require('express').Router();
const auth = require('../middleware/auth');
const { callProc } = require('../db/pool');

router.post('/training', auth, async (req, res) => {
  const { action, tab, name, trainingId, entityId, companyId, categoryId, growthPlanId, videoLink, thumbnailUrl } = req.body;
  try {
    const rows = await callProc('call traning_GetUpdate(?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      action || 'GET', tab || null, name || null, trainingId || null,
      entityId || null, companyId || null, categoryId || null,
      growthPlanId || null, videoLink || null, thumbnailUrl || null,
      null, null, null
    ]);
    res.json({ result: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/gettrainingimage', auth, async (req, res) => {
  const { action, trainingId, entityId, companyId } = req.body;
  try {
    const rows = await callProc('call traning_GetUpdate(?,null,null,?,?,?,null,null,null,null,null,null,null)', [
      action || 'GETIMAGE', trainingId || null, entityId || null, companyId || null
    ]);
    res.json({ result: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/trainingCategory', auth, async (req, res) => {
  const { action, categoryId, name, companyId, entityId } = req.body;
  try {
    const rows = await callProc('call updateTrainingCategory(?,?,?,?,?,null)', [
      action, categoryId || null, name || null, companyId || null, entityId || null
    ]);
    res.json({ result: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/deleteTrainingdoc', auth, async (req, res) => {
  const { trainingId, entityId } = req.body;
  try {
    const rows = await callProc('call traning_GetUpdate(?,null,null,?,?,null,null,null,null,null,null,null,null)', [
      'DELETE', trainingId, entityId
    ]);
    res.json({ result: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
