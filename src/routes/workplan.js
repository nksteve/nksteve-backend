const express = require('express');
const router  = express.Router();
const { callProc } = require('../db/pool');
const { decryptRows } = require('../helpers/decrypt');

// ─── Decision Making ──────────────────────────────────────────────────────────
router.post('/decisionMaking', async (req, res) => {
  try {
    const { action, decisionId, growthPlanId, teamId, goalTagId, actionTagId, endPointId, entityId, decision, decisionDate } = req.body;
    const rows = await callProc(
      'call CGP_decisionMaking(?,?,?,?,?,?,?,?,?,?,?)',
      [
        action || 'GET',
        decisionId || null,
        growthPlanId || null,
        teamId || null,
        goalTagId || null,
        actionTagId || null,
        endPointId || null,
        entityId || null,
        decision || null,
        decisionDate || null,
        0
      ]
    );
    let result = Array.isArray(rows[0]) ? rows[0] : (Array.isArray(rows) ? rows : []);
    // Decrypt firstName/lastName if present
    if (result.length > 0 && result[0].firstName) {
      result = decryptRows(result);
    }
    res.json({ results: { result } });
  } catch (e) {
    console.error('decisionMaking error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
