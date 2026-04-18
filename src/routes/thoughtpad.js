const router    = require('express').Router();
const auth      = require('../middleware/auth');
const { callProc } = require('../db/pool');
const { decryptRow } = require('../helpers/decrypt');
const Cryptr    = require('cryptr');
const cryptr    = new Cryptr(process.env.ENCRYPTION_KEY || '74r2rh53bhq835h3bqlqfjfv25');

// Decrypt a list of thoughtpad rows
function decryptThoughts(rows) {
  return rows.map(r => {
    let title = r.title || '';
    try { title = cryptr.decrypt(r.title); } catch { /* plain or corrupt */ }
    return { ...r, title };
  });
}

// POST /getThoughtpads  (Vembu plural)  +  /getThoughtpad (our alias)
const _getHandler = async (req, res) => {
  const { entityId } = req.body;
  try {
    const results = await callProc('CALL getEntityThoughtpad(?)', [entityId]);
    const rows    = Array.isArray(results[0]) ? results[0] : results;
    const decrypted = decryptThoughts(rows);
    res.json({ thoughtPad: decrypted });          // Vembu key is "thoughtPad"
  } catch (e) { res.status(500).json({ error: e.message }); }
};
router.post('/getThoughtpads', auth, _getHandler);
router.post('/getThoughtpad',  auth, _getHandler);

// POST /insertThoughtpad  — ADD a new thought (action=UPDATE, thoughtId=null)
router.post('/insertThoughtpad', auth, async (req, res) => {
  const { entityId, title, thought } = req.body;
  try {
    const encTitle = cryptr.encrypt(title || '');
    await callProc('CALL updateEntityThoughtpad(?,?,?,?,?)',
      ['UPDATE', null, entityId, encTitle, thought || '']);
    // Fetch updated list
    const results   = await callProc('CALL getEntityThoughtpad(?)', [entityId]);
    const rows      = Array.isArray(results[0]) ? results[0] : results;
    const decrypted = decryptThoughts(rows);
    res.json({ thoughtPad: decrypted });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /updateThoughtpad  — UPDATE existing thought (thoughtId required)
router.post('/updateThoughtpad', auth, async (req, res) => {
  const { entityId, thoughtId, title, thought, action } = req.body;
  try {
    if ((action || 'UPDATE') === 'DELETE') {
      // Delete path
      await callProc('CALL updateEntityThoughtpad(?,?,?,?,?)',
        ['DELETE', thoughtId, entityId, null, null]);
    } else {
      // Update or add (thoughtId=null → insert)
      const encTitle = title ? cryptr.encrypt(title) : null;
      await callProc('CALL updateEntityThoughtpad(?,?,?,?,?)',
        ['UPDATE', thoughtId || null, entityId, encTitle, thought || '']);
    }
    // Return refreshed list
    const results   = await callProc('CALL getEntityThoughtpad(?)', [entityId]);
    const rows      = Array.isArray(results[0]) ? results[0] : results;
    const decrypted = decryptThoughts(rows);
    res.json({ thoughtPad: decrypted });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /deleteThoughtpad  — DELETE a thought
router.post('/deleteThoughtpad', auth, async (req, res) => {
  const { thoughtId, entityId } = req.body;
  try {
    await callProc('CALL updateEntityThoughtpad(?,?,?,?,?)',
      ['DELETE', thoughtId, entityId || null, null, null]);
    // Return refreshed list
    const results   = await callProc('CALL getEntityThoughtpad(?)', [entityId]);
    const rows      = Array.isArray(results[0]) ? results[0] : results;
    const decrypted = decryptThoughts(rows);
    res.json({ thoughtPad: decrypted });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
