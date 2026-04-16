const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { query, callProc } = require('../db/pool');

router.post('/login', async (req, res) => {
  const { email, password, companyId } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const rows = await query('SELECT password, companyId FROM entity_user WHERE email = ?', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const row = rows[0];
    const bcrypt = require('bcryptjs');
    const valid = await bcrypt.compare(password, row.password).catch(() => password === row.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const cid = companyId || row.companyId;
    const entityRows = await callProc('call getEntityHeader(?,null,null)', [email]);
    const entity = entityRows[0]?.[0] || {};
    const token = jwt.sign(
      { entityId: entity.entityId, companyId: cid, email },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, user: { entityId: entity.entityId, companyId: cid, email, firstName: entity.firstName, lastName: entity.lastName, securityToken: entity.securityToken } });
  } catch (e) {
    console.error(e);
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
  const bcrypt = require('bcryptjs');
  try {
    const hash = await bcrypt.hash(newPassword, 10);
    await callProc('call UpdateUserTemporaryPassword(?,?)', [entityId, hash]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
