const { decryptRows, decryptRow } = require('../helpers/decrypt');
const router = require('express').Router();
const auth = require('../middleware/auth');
const { callProc } = require('../db/pool');

router.get('/getCategories', async (req, res) => {
  try {
    const rows = await callProc('call getCategories()');
    res.json({ categories: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/getTags', auth, async (req, res) => {
  const { categoryId, companyId } = req.body;
  try {
    const rows = await callProc('call getTags(?,?)', [categoryId || null, companyId || null]);
    res.json({ tags: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/goals', auth, async (req, res) => {
  try {
    const rows = await callProc('call goals(null,null,null,null)');
    res.json({ goals: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/updateCustomizedTag', auth, async (req, res) => {
  const t = req.body;
  try {
    const rows = await callProc('call updateCustomizedTag(?,?,?,?,?,?,?,?,?,?,?)', [
      t.action, t.companyId || null, t.entityId || null, t.growthPlanId || null,
      t.categoryId || null, t.scope || null, t.name || null, t.goalTagId || null,
      t.experienceId || null, t.feedbackId || null, t.teamId || null
    ]);
    res.json({ result: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/goalActionCreate', auth, async (req, res) => {
  const g = req.body;
  try {
    // Vembu uses updateCustomizedTag with scope='G' to add a goal
    // teamId should be the childPlanId (= growthPlanId as string for owned plans)
    const teamId = g.teamId || String(g.growthPlanId || '');
    const rows = await callProc(
      'call updateCustomizedTag(?,?,?,?,?,?,?,?,?,?)',
      [
        'UPDATE',                    // _action
        g.entityId,                  // _entityId
        g.growthPlanId || null,      // _growthPlanId
        g.categoryId   || null,      // _categoryId
        'G',                         // _scope
        g.goalName || g.name || null,// _name
        null,                        // _goalTagId
        null,                        // _experienceId
        null,                        // _feedbackId
        teamId,                      // _teamId
      ]
    );
    res.json({ header: { errorCode: 0 }, result: rows });
  } catch (e) {
    console.error('goalActionCreate error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/getPicklist', async (req, res) => {
  const { picklistType, companyId, entityId } = req.body;
  try {
    // Try with entityId first (vembu uses SEARCH_USER with entityId), fallback to companyId
    const rows = await callProc('call getPicklist(?,?)', [picklistType, entityId || companyId || null]);
    res.json({ picklist: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
