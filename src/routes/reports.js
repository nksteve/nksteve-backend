const router = require('express').Router();
const auth = require('../middleware/auth');
const { callProc } = require('../db/pool');

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

module.exports = router;
