/**
 * Decryption helper — matches Cryptr v4 (aes-256-ctr) used by vembu backend.
 * The DB fields were encrypted with Cryptr@4.0.2 which uses:
 *   - key derivation: SHA-256 hash of the secret string
 *   - algorithm: aes-256-ctr
 *   - format: first 32 hex chars = 16-byte IV, remainder = encrypted hex
 *
 * Our backend must use Cryptr@4.0.2 to decrypt correctly — see package.json.
 */
const Cryptr = require('cryptr');

const cryptr = new Cryptr(process.env.ENCRYPTION_KEY || 'This-is-a-security-key-for-onup-notes');

const ENCRYPTED_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'alias', 'title', 'imageUri', 'myMotivation', 'whatIWant', 'securityToken'];

function decryptField(value) {
  if (!value || typeof value !== 'string' || value.trim().length === 0) return value;
  try {
    const decrypted = cryptr.decrypt(value);
    // If decrypted result is empty string, return original value
    if (!decrypted || decrypted.trim().length === 0) return value;
    return decrypted;
  } catch (e) {
    // Return original value if decryption fails (not encrypted or wrong key)
    return value;
  }
}

function decryptRow(row, fields = ENCRYPTED_FIELDS) {
  if (!row) return row;
  const result = { ...row };
  for (const field of fields) {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = decryptField(result[field]);
    }
  }
  return result;
}

function decryptRows(rows, fields = ENCRYPTED_FIELDS) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(r => decryptRow(r, fields));
}

/**
 * Decrypt comma-separated teamMembers field (each segment is individually encrypted)
 */
function decryptTeamMembers(value) {
  if (!value || typeof value !== 'string') return value;
  const members = value.split(',');
  return members.map(m => {
    try { return cryptr.decrypt(m.trim()); } catch { return m; }
  }).join(',');
}

module.exports = { decryptField, decryptRow, decryptRows, decryptTeamMembers, ENCRYPTED_FIELDS };
