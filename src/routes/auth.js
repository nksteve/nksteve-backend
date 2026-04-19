const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { query, callProc } = require('../db/pool');
const { decryptRow } = require('../helpers/decrypt');

router.post('/login', async (req, res) => {
  const { email, password, companyId } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    // Direct SQL login — bypasses SP collation mismatch on workspace MariaDB
    // SP ENTITY_login was compiled with utf8mb4_unicode_ci but tables are now utf8mb4_uca1400_ai_ci
    const userRows = await query(
      'SELECT entityId, email, `password`, tokenId, companyId, isAccountSetupComplete FROM entity_user WHERE email = ? LIMIT 1',
      [email]
    );
    const dbUser = userRows[0];
    if (!dbUser) return res.status(401).json({ error: 'Invalid credentials' });
    if (dbUser.password && dbUser.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Auto-set password if not yet set (matching SP behaviour)
    if (!dbUser.password) {
      await query('UPDATE entity_user SET `password`=? WHERE email=?', [password, email]);
    }
    const loginResult = { entityId: dbUser.entityId, tokenId: dbUser.tokenId };

    // Get entity header details (use entityId, not email — SP expects integer)
    let entity = {};
    try {
      const entityRows = await callProc('call getEntityHeader(?,null,null)', [loginResult.entityId]);
      entity = decryptRow(Array.isArray(entityRows[0]) ? entityRows[0][0] : entityRows[0] || {});
    } catch (e) {
      entity = loginResult;
    }

    // Get companyId — already in dbUser from our direct query
    let cid = parseInt(companyId, 10) || dbUser.companyId || 1;

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
