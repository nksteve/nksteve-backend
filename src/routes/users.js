const { decryptRows, decryptRow } = require('../helpers/decrypt');
const router = require('express').Router();
const auth = require('../middleware/auth');
const { callProc, query } = require('../db/pool');

/**
 * getEntitySetup — the frontend calls this for dashboard VMV cards.
 * The v_entitysetup view does NOT have vision/mission/values — those come from
 * v_entityheader (via getEntityHeader SP). We call getEntityHeader here so the
 * frontend receives vission/mission/value/companyVision/companyMission/companyValues.
 */
router.get('/getEntitySetup/:id', auth, async (req, res) => {
  try {
    const rows = await callProc('call getEntityHeader(?,null,null)', [req.params.id]);
    // getEntityHeader returns a single result set; first row is our entity
    const raw = Array.isArray(rows[0]) ? rows[0][0] : (rows[0] || null);
    const entity = raw ? decryptRow(raw) : null;
    res.json({ entity });
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
    const raw = Array.isArray(rows[0]) ? rows[0][0] : (rows[0] || null);
    res.json({ personal: raw ? decryptRow(raw) : null });
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
    // SP signature: (action, entityId, categoryId, tagId, summary, whatIWant,
    //   mission, vission, value,
    //   missionBgImg, vissionBgImag, valueBgImg,
    //   missionBodyColor, vissionBodyColor, valueBodyColor,
    //   missionHeadingColor, vissionHeadingColor, valueHeadingColor,
    //   missionOpacity, vissionOpacity, valueOpacity)
    const rows = await callProc('call updateEntityInterestsTag(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      i.action || 'ADD',
      i.entityId,
      i.categoryId || null,
      i.tagId || null,
      i.summary || null,
      i.whatIWant || null,
      i.mission || null,
      i.vission || null,
      i.value || null,
      i.missionBgImg || null,
      i.vissionBgImag || null,
      i.valueBgImg || null,
      i.missionBodyColor || null,
      i.vissionBodyColor || null,
      i.valueBodyColor || null,
      i.missionHeadingColor || null,
      i.vissionHeadingColor || null,
      i.valueHeadingColor || null,
      i.missionOpacity || null,
      i.vissionOpacity || null,
      i.valueOpacity || null,
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
    const users = decryptRows(rows[0] || []);
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

// SP: cgp_getAllContributors(_companyId, _action, _goalTagId, _communityGrowthPlanId, _teamId)
router.post('/cgp_getAllContributors', auth, async (req, res) => {
  const { entityId, companyId, teamId, growthPlanId, action, goalTagId } = req.body;
  try {
    const rows = await callProc('call cgp_getAllContributors(?,?,?,?,?)', [
      companyId || null,
      action || 'GET',
      goalTagId || null,
      growthPlanId || null,
      teamId || null
    ]);
    const result = Array.isArray(rows[0]) ? rows[0] : (Array.isArray(rows) ? rows : []);
    res.json({ contributors: result });
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

// ─── Cron Settings ──────────────────────────────────────────────────────────
router.post('/cronsettings', auth, async (req, res) => {
  const { action, type, cronDay, cronTime, cronDate, companyId, status } = req.body;
  try {
    const rows = await callProc('call cron_settings(?,?,?,?,?,?,?)', [
      action || 'GETAll',
      type || 'GOALWEEKLYREPORT',
      cronDay !== undefined ? cronDay : null,
      cronTime !== undefined ? cronTime : null,
      cronDate || null,
      companyId || null,
      status !== undefined ? status : null,
    ]);
    const result = Array.isArray(rows[0]) ? rows[0] : (Array.isArray(rows) ? rows : []);
    res.json({ header: { errorCode: 0 }, result });
  } catch (e) { res.status(500).json({ header: { errorCode: 1 }, error: e.message }); }
});

// ─── SFTP Management (direct DB — SP has no GET action) ─────────────────────
router.post('/sftpAdmin', auth, async (req, res) => {
  const { action, companyId, location, username, password, fileName } = req.body;
  try {
    if (action === 'GET_COMPANIES') {
      const rows = await query('SELECT id, name FROM company WHERE statusId=1 ORDER BY name', []);
      res.json({ header: { errorCode: 0 }, results: { result: Array.isArray(rows) ? rows : [] } });
    } else if (action === 'GET') {
      const rows = await query('SELECT * FROM sftp_data WHERE companyId=? LIMIT 1', [companyId]);
      const config = Array.isArray(rows) ? rows[0] : null;
      res.json({ header: { errorCode: 0 }, results: { result: { config, data: [] } } });
    } else if (action === 'INSERT') {
      await callProc('call SFTP_update(?,?,?,?,?,?)', ['INSERT', companyId, location || null, username || null, password || null, fileName || null]);
      res.json({ header: { errorCode: 0 } });
    } else if (action === 'UPDATE') {
      await query('UPDATE sftp_data SET fileName=? WHERE companyId=?', [fileName, companyId]);
      res.json({ header: { errorCode: 0 } });
    } else {
      res.json({ header: { errorCode: 0 }, results: {} });
    }
  } catch (e) { res.status(500).json({ header: { errorCode: 1 }, error: e.message }); }
});

router.post('/sftpUser', auth, async (req, res) => {
  const { action, companyId, fileName } = req.body;
  try {
    if (action === 'UPDATE') {
      await query('UPDATE sftp_data SET fileName=? WHERE companyId=?', [fileName, companyId]);
    }
    res.json({ header: { errorCode: 0 } });
  } catch (e) { res.status(500).json({ header: { errorCode: 1 }, error: e.message }); }
});

router.post('/createSftpUser', auth, async (req, res) => {
  const { companyId, location, username, password } = req.body;
  try {
    await callProc('call SFTP_update(?,?,?,?,?,null)', ['INSERT', companyId || null, location || null, username || null, password || null]);
    res.json({ header: { errorCode: 0 } });
  } catch (e) { res.status(500).json({ header: { errorCode: 1 }, error: e.message }); }
});

// ─── Company Management ──────────────────────────────────────────────────────
// GET list: use getPicklist(COMPANY) — already exists at /getPicklist
// INSERT/UPDATE/DELETE: updateCompany(_action, _name, _url, _id, _logoUrl,
//   _vision, _mission, _values, _missionBgImg, _vissionBgImag, _valueBgImg,
//   _missionBodyColor, _vissionBodyColor, _valueBodyColor,
//   _missionHeadingColor, _vissionHeadingColor, _valueHeadingColor,
//   _missionOpacity, _vissionOpacity, _valueOpacity) — 20 params
router.post('/company', auth, async (req, res) => {
  const d = req.body;
  try {
    if (d.action === 'DELETE') {
      const rows = await callProc('call updateCompany(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
        'DELETE', null, null, d.id || null, null,
        null, null, null, null, null, null,
        null, null, null, null, null, null,
        null, null, null,
      ]);
      const ok = Array.isArray(rows[0]) ? rows[0][0] : (rows[0] || {});
      res.json({ header: { errorCode: ok ? 0 : 1 } });
    } else {
      const rows = await callProc('call updateCompany(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
        d.action || 'INSERT',
        d.name || null,
        d.url || null,
        d.id || null,
        d.logoUrl || null,
        d.vision || null,
        d.mission || null,
        d.values || null,
        d.missionBgImg || null,
        d.vissionBgImag || null,
        d.valueBgImg || null,
        d.missionBodyColor || null,
        d.vissionBodyColor || null,
        d.valueBodyColor || null,
        d.missionHeadingColor || null,
        d.vissionHeadingColor || null,
        d.valueHeadingColor || null,
        d.missionOpacity || null,
        d.vissionOpacity || null,
        d.valueOpacity || null,
      ]);
      const ok = Array.isArray(rows[0]) ? rows[0][0] : (rows[0] || {});
      res.json({ header: { errorCode: ok ? 0 : 1 } });
    }
  } catch (e) { res.status(500).json({ header: { errorCode: 1 }, error: e.message }); }
});

// ─── Company file upload ─────────────────────────────────────────────────────
const multer = require('multer');
const AWS = require('aws-sdk');
const companyUpload = multer({ storage: multer.memoryStorage() });

router.post('/company/upload', auth, companyUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const s3 = new AWS.S3({
    accessKeyId: process.env.S3_API_KEY,
    secretAccessKey: process.env.S3_API_SECRET,
    region: 'us-east-1',
  });
  s3.upload({
    Bucket: process.env.S3_BUCKET,
    Key: `dsdar-userbio/${Date.now()}_${req.file.originalname}`,
    Body: req.file.buffer,
    ContentType: req.file.mimetype,
    ACL: 'public-read',
  }, (err, data) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ Location: data.Location });
  });
});

module.exports = router;
