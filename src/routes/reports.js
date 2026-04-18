const { decryptRows, decryptRow } = require('../helpers/decrypt');
const router = require('express').Router();
const auth = require('../middleware/auth');
const { callProc, query } = require('../db/pool');

router.post('/reports', auth, async (req, res) => {
  const { _reportType, _companyId, _entityId, _startDate, _endDate, _filter1, _filter2, _filter3 } = req.body;
  try {
    const rows = await callProc('call getReport(?,?,?,?,?,?,?,?)', [
      _reportType, _companyId || null, _entityId || null,
      _startDate || null, _endDate || null, _filter1 || null,
      _filter2 || null, _filter3 || null
    ]);
    const details = rows[0] || [];
    res.json({ reports: [{ reportType: _reportType, details }], data: details });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/analyticsCompany', auth, async (req, res) => {
  const { entityId, companyId, filter1, filter2, filter3, startDate, endDate, action } = req.body;
  try {
    const rows = await callProc('call REPORT_company(?,?,?,?,?,?,?,null,null,?,null)', [
      action || 'GET', entityId || null, companyId || null,
      filter1 || null, filter2 || null, filter3 || null,
      startDate || null, endDate || null
    ]);
    res.json({ data: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/analyticsData', auth, async (req, res) => {
  const { companyId, entityId, startDate, endDate, filter1, filter2 } = req.body;
  try {
    const rows = await callProc('call REPORT_data(?,?,?,?,?,null,null,null,null,?,null,null)', [
      companyId || null, entityId || null, startDate || null, endDate || null,
      filter1 || null, filter2 || null
    ]);
    res.json({ data: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/analyticsConfig', auth, async (req, res) => {
  const { action, companyId, entityId, configId, startYear, endYear, enabled, charterId } = req.body;
  try {
    const rows = await callProc('call REPORT_config(?,?,?,?,?,?,NULL,NULL)', [
      action, companyId || null, entityId || null, configId || null,
      startYear || null, endYear || null
    ]);
    res.json({ data: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/analyticsLogs', auth, async (req, res) => {
  const { companyId, entityId, startDate, endDate } = req.body;
  try {
    const rows = await callProc('call REPORT_logs(?,?,?,?)', [companyId || null, entityId || null, startDate || null, endDate || null]);
    res.json({ data: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/companyMapping', auth, async (req, res) => {
  const { action, companyId, rcCompanyId, entityId } = req.body;
  try {
    const rows = await callProc('call REPORT_company_mapping(?,?,?,?)', [action, companyId || null, rcCompanyId || null, entityId || null]);
    res.json({ data: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/checkCU', auth, async (req, res) => {
  res.json({ result: 'ok' });
});

// POST /getReport — alias matching Vembu's direct SP call naming
// SP param order: _reportType, _companyId, _entityId, _dateStart, _dateEnd, _filter1, _filter2, _filter3
router.post('/getReport', auth, async (req, res) => {
  const { _reportType, _entityId, _companyId, _startDate, _endDate, _filter1, _filter2, _filter3 } = req.body;
  try {
    const results = await callProc('CALL getReport(?,?,?,?,?,?,?,?)',
      [_reportType, _companyId || null, _entityId || null, _startDate || null, _endDate || null, _filter1 || 'DAY', _filter2 || null, _filter3 || null]);
    const rows = Array.isArray(results[0]) ? results[0] : results;
    res.json({ reports: [{ details: rows }] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /goalPlanReport — calls SP goalPlanReport(?,?,?,?,?,null) — 6 params, last always null
router.post('/goalPlanReport', auth, async (req, res) => {
  const { action, teamId, goalTagId, actionTagId, dateFrom } = req.body;
  try {
    const results = await callProc('CALL goalPlanReport(?,?,?,?,?,null)',
      [action, String(teamId), goalTagId || null, actionTagId || null, dateFrom || null]);
    const rows = Array.isArray(results[0]) ? results[0] : results;
    res.json({ results: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /getEntityUsers — calls getEntityUser SP (companyId only)
router.post('/getEntityUsers', auth, async (req, res) => {
  const { companyId } = req.body;
  try {
    const results = await callProc('CALL getEntityUser(?)', [companyId]);
    const rows = Array.isArray(results[0]) ? results[0] : results;
    const decrypted = decryptRows(rows, ['firstName','lastName','imageUri']);
    res.json({ EntityUser: decrypted });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /overallReport — calls REPORT_overall(action, entityId, week, year)
router.post('/overallReport', auth, async (req, res) => {
  const { action, entityId, week, year } = req.body;
  try {
    const results = await callProc('CALL REPORT_overall(?,?,?,?)',
      [action || 'GETALLUSER', entityId || null, week || null, year || null]);
    const rows = Array.isArray(results[0]) ? results[0] : results;
    res.json({ results: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /getGrowthPlansByEntity — returns growth plans for entity using getGrowthPlanSummary
router.post('/getGrowthPlansByEntity', auth, async (req, res) => {
  const { entityId } = req.body;
  try {
    const results = await callProc('CALL getGrowthPlanSummary(?)', [entityId]);
    const rows = Array.isArray(results[0]) ? results[0] : results;
    // Decrypt name fields, deduplicate by growthPlanId
    const decrypted = decryptRows(rows, ['firstName','lastName','imageUri']);
    const seen = new Set();
    const unique = decrypted.filter(r => {
      if (seen.has(r.growthPlanId)) return false;
      seen.add(r.growthPlanId);
      return true;
    });
    // Build colorCode → hex map
    const colorIds = [...new Set(unique.map(r => r.colorCode).filter(Boolean))];
    const colorMap = {};
    if (colorIds.length > 0) {
      const ph = colorIds.map(() => '?').join(',');
      const colorRows = await query(`SELECT colorCodeId, hex FROM att_colorcodes WHERE colorCodeId IN (${ph})`, colorIds);
      const cArr = Array.isArray(colorRows) ? colorRows : [];
      cArr.forEach(c => { colorMap[c.colorCodeId] = c.hex; });
    }
    // Normalize to expected shape
    const plans = unique.map(r => ({
      growthPlanId:           r.growthPlanId,
      name:                   r.growthPlanName || r.title || '',
      milestoneDate:          r.growthPlanMilestoneDate,
      percentAchieved:        r.growthPlanPercentAchieved,
      colorCodeHex:           colorMap[r.colorCode] ? `#${colorMap[r.colorCode]}` : null,
      growthPlanPercentAchieved: r.growthPlanPercentAchieved,
      firstName:              r.firstName,
      lastName:               r.lastName,
      statusId:               r.growthPlanStatusId,
      status:                 r.growthPlanStatus,
      goalList:               [],
      childPlanId:            String(r.growthPlanId), // teamId = growthPlanId as string
    }));
    res.json({ growthPlans: plans });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /goaltreeStructure — SP: goalTreeStruture(_teamId VARCHAR, _actionTagId INT, _goalTagId INT, _growthPlanId INT)
// _teamId = String(growthPlanId), _growthPlanId = Number(growthPlanId), middle two = null (no filter)
const _treeHandler = async (req, res) => {
  const { growthPlanId, actionTagId, goalTagId } = req.body;
  try {
    const results = await callProc('CALL goalTreeStruture(?,?,?,?)', [
      String(growthPlanId),
      actionTagId || null,
      goalTagId   || null,
      Number(growthPlanId)
    ]);
    const rows = Array.isArray(results[0]) ? results[0] : results;
    // Decrypt name fields on tree nodes
    const decrypted = decryptRows(rows, ['firstName','lastName','imageUri','ownerFirstName','ownerLastName']);
    res.json({ results: decrypted });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
router.post('/goaltreeStructure', auth, _treeHandler);
router.post('/goaltreeStruture',  auth, _treeHandler); // Vembu typo alias

module.exports = router;
