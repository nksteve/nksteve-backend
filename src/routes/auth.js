const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { query, callProc } = require('../db/pool');

router.post('/login', async (req, res) => {
  const { email, password, companyId } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    // Use ENTITY_login stored procedure (matches vembu implementation)
    const loginRows = await callProc('call ENTITY_login(?,?,?,?,?)', ['Login', null, email, password, null]);
    const loginResult = Array.isArray(loginRows[0]) ? loginRows[0][0] : loginRows[0];
    if (!loginResult || !loginResult.entityId) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get entity header details
    let entity = {};
    try {
      const entityRows = await callProc('call getEntityHeader(?,null,null)', [email]);
      entity = Array.isArray(entityRows[0]) ? entityRows[0][0] : entityRows[0] || {};
    } catch (e) {
      entity = loginResult;
    }

    // Get companyId from entity_user if not provided
    let cid = parseInt(companyId, 10) || null;
    if (!cid) {
      const userRows = await query('SELECT companyId FROM entity_user WHERE email = ? LIMIT 1', [email]);
      cid = userRows[0]?.companyId || 1;
    }

    const token = jwt.sign(
      { entityId: loginResult.entityId, companyId: cid, email },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({
      token,
      user: {
        entityId: loginResult.entityId,
        companyId: cid,
        email,
        firstName: entity.firstName,
        lastName: entity.lastName,
        securityToken: entity.securityToken || loginResult.tokenId
      }
    });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    await callProc('call UpdateContactUs(?,?,?)', [email, 'FORGOTPASSWORD', null]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/change-password', async (req, res) => {
  const { entityId, tempPassword, newPassword } = req.body;
  try {
    // Use stored procedure with plain text as vembu does (CHANGEPASSWORD action)
    await callProc('call ENTITY_login(?,?,?,?,?)', ['CHANGEPASSWORD', entityId, null, newPassword, tempPassword]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
