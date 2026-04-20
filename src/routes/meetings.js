const { decryptRows, decryptRow } = require('../helpers/decrypt');
const router = require('express').Router();
const auth = require('../middleware/auth');
const { callProc } = require('../db/pool');

// SP: getMeetings(_type, _entityId, _weeksOutVal)
router.post('/getMeetings', auth, async (req, res) => {
  const { action, entityId, weeksOut } = req.body;
  const eid = entityId || req.user?.entityId;
  try {
    const rows = await callProc('call getMeetings(?,?,?)', [action || 'PENDING', eid, weeksOut || null]);
    const result = Array.isArray(rows[0]) ? rows[0] : (Array.isArray(rows) ? rows : []);
    const decrypted = decryptRows(result);
    res.json({ meetings: decrypted });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// SP: getMeetingsCalendar(_entityId, _startDate, _bucketScope)
router.post('/getMeetingsCalendar', auth, async (req, res) => {
  const { entityId, startDate, bucketScope } = req.body;
  const eid = entityId || req.user?.entityId;
  try {
    const rows = await callProc('call getMeetingsCalendar(?,?,?)', [eid, startDate || null, bucketScope || null]);
    const result = Array.isArray(rows[0]) ? rows[0] : (Array.isArray(rows) ? rows : []);
    res.json({ meetings: result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// SP: getMeetingsDetail(_type, _entityId)
router.post('/getMeetingsDetail', auth, async (req, res) => {
  const { entityId, meetingId, type } = req.body;
  const eid = entityId || req.user?.entityId;
  try {
    const rows = await callProc('call getMeetingsDetail(?,?)', [type || 'PENDING', eid]);
    const result = Array.isArray(rows[0]) ? rows[0] : (Array.isArray(rows) ? rows : []);
    const decrypted = decryptRows(result);
    res.json({ meetings: decrypted, meeting: decrypted[0] || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// SP: getMeetingsDetailByMeetingId(_action, _entityId, _meetingId)
router.post('/getMeetingsDetailByMeetingId', auth, async (req, res) => {
  const { meetingId, entityId, action } = req.body;
  const eid = entityId || req.user?.entityId;
  try {
    const rows = await callProc('call getMeetingsDetailByMeetingId(?,?,?)', [action || 'DETAIL', eid, meetingId]);
    const result = Array.isArray(rows[0]) ? rows[0] : (Array.isArray(rows) ? rows : []);
    const decrypted = decryptRows(result);
    res.json({ meeting: decrypted[0] || null, meetings: decrypted });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/getMeetingsDetailByGrowthPlanId', auth, async (req, res) => {
  const { growthPlanId, entityId, companyId } = req.body;
  const eid = entityId || req.user?.entityId;
  try {
    // SP: getMeetingsDetailByGrowthPlanId(_scope, _entityId, _growthPlanId)
    // _scope = growthPlanId (used as identifier), _entityId = entityId, _growthPlanId = growthPlanId
    const rows = await callProc('call getMeetingsDetailByGrowthPlanId(?,?,?)', [growthPlanId, eid, growthPlanId]);
    const result = Array.isArray(rows[0]) ? rows[0] : (Array.isArray(rows) ? rows : []);
    res.json({ meetings: result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// SP: updateMeeting(_action, _meetingId, _sessionId, _sessionToken, _archiveUrl, _statusId, _topic, _title, _durationMinutes, _scheduledMinutes, _scheduledUTC, _joinGC, _joinMM, _rescheduledEntityId, _growthPlanId)
router.post('/updateMeeting', auth, async (req, res) => {
  // Support both flat body and { action, meeting: {...} } nested form
  const body = req.body;
  const nested = body.meeting || {};
  const m = { ...nested, ...body };
  delete m.meeting; // avoid confusion
  try {
    const rows = await callProc('call updateMeeting(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
      m.action || 'UPDATE',
      m.meetingId || null,
      m.sessionId || null,
      m.sessionToken || null,
      m.archiveUrl || null,
      m.statusId || null,
      m.topic || null,
      m.title || null,
      m.durationMinutes || null,
      m.scheduledMinutes || null,
      m.scheduledUTC || m.meetingDate || null,
      m.joinGC || null,
      m.joinMM || null,
      m.rescheduledEntityId || null,
      m.growthPlanId || null
    ]);
    res.json({ result: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// SP: getTeamPlanMeetings(_growthplanId, _entityId, _managerEntityId)
router.post('/getTeamPlanMeetings', auth, async (req, res) => {
  const { growthPlanId, entityId, managerEntityId } = req.body;
  const eid = entityId || req.user?.entityId;
  try {
    const rows = await callProc('call getTeamPlanMeetings(?,?,?)', [growthPlanId, eid, managerEntityId || null]);
    const result = Array.isArray(rows[0]) ? rows[0] : (Array.isArray(rows) ? rows : []);
    res.json({ meetings: result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/updateFeedback', auth, async (req, res) => {
  const f = req.body;
  try {
    // SP: updateSessionFeedback(_blockreturn, _action, _feedbackId, _actorId, _entityId, _meetingId,
    //   _tagId, _howDidItGo, _improvementComment, _privateNotes, _publicNotes, _ratings)
    const rows = await callProc('call updateSessionFeedback(?,?,?,?,?,?,?,?,?,?,?,?)', [
      0,                                // _blockreturn (always 0)
      f.action || 'INSERT',             // _action
      f.feedbackId || null,             // _feedbackId
      f.actorId || f.entityId || null,  // _actorId
      f.entityId || null,               // _entityId
      f.meetingId || null,              // _meetingId
      f.tagId || null,                  // _tagId
      f.howDidItGo || f.rating || null, // _howDidItGo
      f.improvementComment || f.comments || null, // _improvementComment
      f.privateNotes || null,           // _privateNotes
      f.publicNotes || null,            // _publicNotes
      f.ratings || f.rating || null,    // _ratings
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
