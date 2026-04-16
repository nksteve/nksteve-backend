const router = require('express').Router();
const auth = require('../middleware/auth');
const { callProc } = require('../db/pool');

router.post('/getMeetings', auth, async (req, res) => {
  const { entityId, companyId, statusId } = req.body;
  try {
    const rows = await callProc('call getMeetings(?,?,?)', [entityId, companyId || null, statusId || null]);
    res.json({ meetings: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/getMeetingsCalendar', auth, async (req, res) => {
  const { entityId, companyId, statusId } = req.body;
  try {
    const rows = await callProc('call getMeetingsCalendar(?,?,?)', [entityId, companyId || null, statusId || null]);
    res.json({ meetings: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/getMeetingsDetail', auth, async (req, res) => {
  const { entityId, meetingId } = req.body;
  try {
    const rows = await callProc('call getMeetingsDetail(?,?)', [entityId, meetingId]);
    res.json({ meeting: rows[0]?.[0] || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/getMeetingsDetailByMeetingId', auth, async (req, res) => {
  const { meetingId, entityId, companyId } = req.body;
  try {
    const rows = await callProc('call getMeetingsDetailByMeetingId(?,?,?)', [meetingId, entityId, companyId || null]);
    res.json({ meeting: rows[0]?.[0] || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/getMeetingsDetailByGrowthPlanId', auth, async (req, res) => {
  const { growthPlanId, entityId, companyId } = req.body;
  try {
    const rows = await callProc('call getMeetingsDetailByGrowthPlanId(?,?,?)', [growthPlanId, entityId, companyId || null]);
    res.json({ meetings: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/updateMeeting', auth, async (req, res) => {
  const m = req.body;
  try {
    const rows = await callProc('call updateMeeting(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      m.action, m.meetingId || null, m.growthPlanId || null, m.entityId,
      m.title || null, m.meetingDate || null, m.startTime || null, m.endTime || null,
      m.description || null, m.statusId || null, m.companyId || null, m.teamId || null,
      m.meetingType || null, m.location || null, m.isCGP || null
    ]);
    res.json({ result: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/getTeamPlanMeetings', auth, async (req, res) => {
  const { growthPlanId, entityId, companyId } = req.body;
  try {
    const rows = await callProc('call getTeamPlanMeetings(?,?,?)', [growthPlanId, entityId, companyId || null]);
    res.json({ meetings: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/updateFeedback', auth, async (req, res) => {
  const f = req.body;
  try {
    const rows = await callProc('call updateSessionFeedback(?,?,?,?,?,?,?,?,?,?,?,?)', [
      f.action, f.meetingId, f.entityId, f.rating || null, f.comments || null,
      f.q1 || null, f.q2 || null, f.q3 || null, f.q4 || null, f.q5 || null, f.companyId || null, f.teamId || null
    ]);
    res.json({ result: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/getFeedback', auth, async (req, res) => {
  const { meetingId, entityId } = req.body;
  try {
    const rows = await callProc('call getSessionFeedback(?,?)', [meetingId, entityId]);
    res.json({ feedback: rows[0] || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
