const router = require('express').Router();
const auth = require('../middleware/auth');
const { callProc } = require('../db/pool');
const multer = require('multer');
const AWS = require('aws-sdk');

const storage = multer.memoryStorage();
const upload = multer({ storage });

// ─── S3 helper ───────────────────────────────────────────────────────────────
const s3 = new AWS.S3({
  accessKeyId: process.env.S3_API_KEY,
  secretAccessKey: process.env.S3_API_SECRET,
  region: 'us-east-1',
});

const uploadToS3 = (buffer, filename, mimeType) => {
  return new Promise((resolve, reject) => {
    s3.upload({
      Bucket: process.env.S3_BUCKET,
      Key: `training/${Date.now()}_${filename}`,
      Body: buffer,
      ContentType: mimeType,
      ACL: 'public-read',
    }, (err, data) => {
      if (err) reject(err);
      else resolve(data.Location);
    });
  });
};

// ─── SP: traning_GetUpdate ────────────────────────────────────────────────────
// Params: _action, _tab, _VideoLink, _name, _thumbnail, _traningId,
//         _entityId, _companyId, _categoryId, _growthPlanId, _doc1, _doc2, _doc3

// ─── GET tabs ─────────────────────────────────────────────────────────────────
router.post('/training/tabs', auth, async (req, res) => {
  const { entityId, companyId } = req.body;
  try {
    const rows = await callProc('call traning_GetUpdate(?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      'GETTABS', null, null, null, null, null,
      entityId || null, companyId || null,
      null, null, null, null, null,
    ]);
    const result = Array.isArray(rows[0]) ? rows[0] : (Array.isArray(rows) ? rows : []);
    res.json({ header: { errorCode: 0 }, result });
  } catch (e) { res.status(500).json({ header: { errorCode: 1 }, error: e.message }); }
});

// ─── GET list for a tab ───────────────────────────────────────────────────────
router.post('/training/list', auth, async (req, res) => {
  const { tab, entityId, companyId } = req.body;
  try {
    const rows = await callProc('call traning_GetUpdate(?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      'GET', tab || null, null, null, null, null,
      entityId || null, companyId || null,
      null, null, null, null, null,
    ]);
    const result = Array.isArray(rows[0]) ? rows[0] : (Array.isArray(rows) ? rows : []);
    res.json({ header: { errorCode: 0 }, result });
  } catch (e) { res.status(500).json({ header: { errorCode: 1 }, error: e.message }); }
});

// ─── GET growth plans for a company ──────────────────────────────────────────
router.post('/training/plans', auth, async (req, res) => {
  const { companyId, entityId } = req.body;
  try {
    const rows = await callProc('call traning_GetUpdate(?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      'GETPLANS', null, null, null, null, null,
      entityId || null, companyId || null,
      null, null, null, null, null,
    ]);
    const result = Array.isArray(rows[0]) ? rows[0] : (Array.isArray(rows) ? rows : []);
    res.json({ header: { errorCode: 0 }, result });
  } catch (e) { res.status(500).json({ header: { errorCode: 1 }, error: e.message }); }
});

// ─── INSERT / UPDATE training item (with optional thumbnail upload) ───────────
router.post('/training/save', auth, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'doc1', maxCount: 1 }, { name: 'doc2', maxCount: 1 }, { name: 'doc3', maxCount: 1 }]), async (req, res) => {
  const {
    action, tab, categoryId, videoLink, name, companyId, entityId,
    trainingId, thumbnailUrl, growthPlanId,
    doc1Id, doc2Id, doc3Id,
  } = req.body;

  try {
    let thumbUrl = thumbnailUrl || null;

    // Upload thumbnail if new file provided
    if (req.files && req.files.image && req.files.image[0]) {
      const f = req.files.image[0];
      thumbUrl = await uploadToS3(f.buffer, f.originalname, f.mimetype);
    }

    // Upload attachment docs
    let docIds = [doc1Id || null, doc2Id || null, doc3Id || null];
    const docFiles = ['doc1', 'doc2', 'doc3'];
    for (let i = 0; i < 3; i++) {
      if (req.files && req.files[docFiles[i]] && req.files[docFiles[i]][0]) {
        const f = req.files[docFiles[i]][0];
        const url = await uploadToS3(f.buffer, f.originalname, f.mimetype);
        // Store doc as URL — SP takes _doc1/_doc2/_doc3 as int IDs
        // We'll pass null for doc IDs when uploading new; for updates pass existing IDs
        docIds[i] = null; // new upload handled separately
      }
    }

    const rows = await callProc('call traning_GetUpdate(?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      action || 'INSERT',
      tab || null,
      videoLink || null,
      name || null,
      thumbUrl,
      trainingId ? parseInt(trainingId) : null,
      entityId ? parseInt(entityId) : null,
      companyId ? parseInt(companyId) : null,
      categoryId ? parseInt(categoryId) : null,
      growthPlanId ? parseInt(growthPlanId) : null,
      docIds[0] ? parseInt(docIds[0]) : null,
      docIds[1] ? parseInt(docIds[1]) : null,
      docIds[2] ? parseInt(docIds[2]) : null,
    ]);
    const result = Array.isArray(rows[0]) ? rows[0] : (Array.isArray(rows) ? rows : [rows]);
    res.json({ header: { errorCode: 0 }, result });
  } catch (e) { res.status(500).json({ header: { errorCode: 1 }, error: e.message }); }
});

// ─── DELETE training item ─────────────────────────────────────────────────────
router.post('/training/delete', auth, async (req, res) => {
  const { trainingId, entityId } = req.body;
  try {
    await callProc('call traning_GetUpdate(?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      'DELETE', null, null, null, null,
      trainingId ? parseInt(trainingId) : null,
      entityId ? parseInt(entityId) : null,
      null, null, null, null, null, null,
    ]);
    res.json({ header: { errorCode: 0 } });
  } catch (e) { res.status(500).json({ header: { errorCode: 1 }, error: e.message }); }
});

// ─── Category CRUD ────────────────────────────────────────────────────────────
// SP: updateTrainingCategory(_action, _id, _name, _entityId, _orderBy, DEBUG)
router.post('/training/category', auth, async (req, res) => {
  const { action, id, name, entityId, orderBy } = req.body;
  try {
    const rows = await callProc('call updateTrainingCategory(?,?,?,?,?,?)', [
      action || 'GET',
      id ? parseInt(id) : null,
      name || null,
      entityId ? parseInt(entityId) : null,
      orderBy ? parseInt(orderBy) : null,
      0,
    ]);
    const result = Array.isArray(rows[0]) ? rows[0] : (Array.isArray(rows) ? rows : []);
    res.json({ header: { errorCode: 0 }, result });
  } catch (e) { res.status(500).json({ header: { errorCode: 1 }, error: e.message }); }
});

// ─── Legacy routes (keep for backward compat) ─────────────────────────────────
router.post('/training', auth, async (req, res) => {
  const { action, tab, name, trainingId, entityId, companyId, categoryId, growthPlanId, videoLink, thumbnailUrl } = req.body;
  try {
    const rows = await callProc('call traning_GetUpdate(?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      action || 'GET',
      tab || null,
      videoLink || null,
      name || null,
      thumbnailUrl || null,
      trainingId ? parseInt(trainingId) : null,
      entityId ? parseInt(entityId) : null,
      companyId ? parseInt(companyId) : null,
      categoryId ? parseInt(categoryId) : null,
      growthPlanId ? parseInt(growthPlanId) : null,
      null, null, null,
    ]);
    const result = Array.isArray(rows[0]) ? rows[0] : (Array.isArray(rows) ? rows : []);
    res.json({ results: { result } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/trainingCategory', auth, async (req, res) => {
  const { action, id, name, entityId, orderBy } = req.body;
  try {
    const rows = await callProc('call updateTrainingCategory(?,?,?,?,?,?)', [
      action || 'GET',
      id ? parseInt(id) : null,
      name || null,
      entityId ? parseInt(entityId) : null,
      orderBy ? parseInt(orderBy) : null,
      0,
    ]);
    const result = Array.isArray(rows[0]) ? rows[0] : (Array.isArray(rows) ? rows : []);
    res.json({ result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/deleteTrainingdoc', auth, async (req, res) => {
  const { trainingId, entityId } = req.body;
  try {
    await callProc('call traning_GetUpdate(?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      'DELETE', null, null, null, null,
      trainingId ? parseInt(trainingId) : null,
      entityId ? parseInt(entityId) : null,
      null, null, null, null, null, null,
    ]);
    res.json({ result: [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
