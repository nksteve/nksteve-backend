const Cryptr = require('cryptr');

const cryptr = new Cryptr(process.env.ENCRYPTION_KEY || 'This-is-a-security-key-for-onup-notes');

const ENCRYPTED_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'address'];

function decryptField(value) {
  if (!value || typeof value !== 'string' || value.trim().length === 0) return value;
  try {
    return cryptr.decrypt(value);
  } catch (e) {
    return value; // return as-is if decryption fails
  }
}

function decryptRow(row, fields = ENCRYPTED_FIELDS) {
  if (!row) return row;
  const result = { ...row };
  for (const field of fields) {
    if (result[field]) {
      result[field] = decryptField(result[field]);
    }
  }
  return result;
}

function decryptRows(rows, fields = ENCRYPTED_FIELDS) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(r => decryptRow(r, fields));
}

module.exports = { decryptField, decryptRow, decryptRows, ENCRYPTED_FIELDS };
