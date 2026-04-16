const router = require('express').Router();
const auth = require('../middleware/auth');
const { callProc, query } = require('../db/pool');

router.get('/getEntitySetup/:id', auth, async (req, res) => {
  try {
    const rows = await callProc('call getEntitySetup(?)', [req.params.id]);
    res.json({ entity: rows[0]?.[0] || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/getEntityBio/:id', auth, async (req, res) => {
  try {
    const rows = await callProc('call getEntityBioSummary(?)', [req.params.id]);
    res.json({ bio: rows[0]?.[0] || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/getEntityExperience/:id', auth, async (req, res) => {
  try {
    const rows = await callProc('call getEntityExperience(?)', [req.params.id]);
    res.json({ experience: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/getEntityInterests/:id', auth, async (req, res) => {
  try {
    const rows = await callProc('call getEntityInterestsTag(?)', [req.params.id]);
    res.json({ interests: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/getEntityPersonal/:id', auth, async (req, res) => {
  try {
    const rows = await callProc('call getEntityHeader(?,null,null)', [req.params.id]);
    res.json({ personal: rows[0]?.[0] || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/updateEntityBio', auth, async (req, res) => {
  const { entityId, bio } = req.body;
  try {
    const rows = await callProc('call updateEntityBioSummary(?,?)', [entityId, bio]);
    res.json({ result: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/updateEntityInterestsTag', auth, async (req, res) => {
  const i = req.body;
  try {
    const rows = await callProc('call updateEntityInterestsTag(?,?,null,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      i.action, i.entityId, i.interestsId || null, i.categoryId || null,
      i.tagId || null, i.summary || null, i.whatIWant || null,
      i.tag1 || null, i.tag2 || null, i.tag3 || null, i.tag4 || null,
      i.tag5 || null, i.tag6 || null, i.tag7 || null, i.tag8 || null,
      i.tag9 || null, i.tag10 || null, i.companyId || null, i.teamId || null
    ]);
    res.json({ result: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/updateEntityExperience', auth, async (req, res) => {
  const e2 = req.body;
  try {
    const rows = await callProc('call updateEntityExperience(?,?,?,?,?,?,?,?)', [
      e2.action, e2.entityId, e2.experienceId || null, e2.companyName || null,
      e2.title || null, e2.startDate || null, e2.endDate || null, e2.description || null
    ]);
    res.json({ result: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/updateEntityPersonal', auth, async (req, res) => {
  const p = req.body;
  try {
    const rows = await callProc('call updateEntityPersonal(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,null)', [
      p.entityId, p.companyId || null, p.firstName || null, p.lastName || null,
      p.title || null, p.department || null, p.phone || null, p.location || null,
      p.linkedIn || null, p.twitter || null, p.facebook || null, p.instagram || null,
      p.website || null, p.bio || null, p.imageUri || null, p.timezone || null,
      p.language || null, p.currency || null, p.dateFormat || null, p.timeFormat || null,
      p.emailNotifications || null, p.smsNotifications || null, p.email || null,
      p.statusId || null, p.roleId || null, p.teamId || null
    ]);
    res.json({ result: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/getAdminUsers', auth, async (req, res) => {
  const { companyId } = req.body;
  try {
    const rows = await callProc('call getAdminUsers(?)', [companyId]);
    const users = rows[0] || [];
    // Enrich with plain-text email from entity_user
    const enriched = await Promise.all(users.map(async u => {
      try {
        const eu = await query('SELECT email, statusId FROM entity_user WHERE entityId = ? LIMIT 1', [u.entityId]);
        return { ...u, email: eu[0]?.email || null, statusId: eu[0]?.statusId ?? u.statusId, displayName: eu[0]?.email || null };
      } catch { return u; }
    }));
    res.json({ users: enriched });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/getEntityUser', auth, async (req, res) => {
  const { entityId } = req.body;
  try {
    const rows = await callProc('call getEntityUser(?)', [entityId]);
    res.json({ user: rows[0]?.[0] || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/deleteUserByEntityId', auth, async (req, res) => {
  const { entityId } = req.body;
  try {
    const rows = await callProc('call deleteUserByEntityId(?)', [entityId]);
    res.json({ result: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/cgp_getAllContributors', auth, async (req, res) => {
  const { entityId, companyId, teamId, growthPlanId, action } = req.body;
  try {
    const rows = await callProc('call cgp_getAllContributors(?,?,?,?,?)', [entityId, companyId || null, teamId || null, growthPlanId || null, action || null]);
    res.json({ contributors: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/getEntityOrgReporting', auth, async (req, res) => {
  const { entityId, companyId, action } = req.body;
  try {
    const rows = await callProc('call getEntityOrgReporting(?,?,?)', [entityId, companyId || null, action || 'GET']);
    res.json({ data: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/updateEntityOrgReporting', auth, async (req, res) => {
  const r = req.body;
  try {
    const rows = await callProc('call updateEntityOrgReporting(?,?,?,?,?,?,?)', [
      r.action, r.entityId, r.companyId || null, r.reportingEntityId || null,
      r.roleId || null, r.teamId || null, r.statusId || null
    ]);
    res.json({ result: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/updateEntityTabOrder', auth, async (req, res) => {
  const { entityId, tabOrder } = req.body;
  try {
    const rows = await callProc('call updateEntityTabOrder(?,?)', [entityId, JSON.stringify(tabOrder)]);
    res.json({ result: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/getEntityActivityLog', auth, async (req, res) => {
  const { entityId, companyId } = req.body;
  try {
    const rows = await callProc('call getEntityActivityLog(?,?)', [entityId, companyId || null]);
    res.json({ activities: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/updateCompany', auth, async (req, res) => {
  const c = req.body;
  try {
    const rows = await callProc('call updateCompany(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      c.action, c.companyId || null, c.companyName || null, c.address1 || null,
      c.address2 || null, c.city || null, c.state || null, c.zip || null,
      c.country || null, c.phone || null, c.website || null, c.logoUri || null,
      c.primaryColor || null, c.secondaryColor || null, c.adminEmail || null,
      c.licenseCount || null, c.licenseStartDate || null, c.licenseEndDate || null,
      c.statusId || null, c.teamId || null
    ]);
    res.json({ result: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
