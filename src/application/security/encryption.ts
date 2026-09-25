import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard IV length for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a consistent 32-byte key from a secret string.
 */
function deriveKey(secret: string): Buffer {
  if (!secret) {
    throw new Error('ENCRYPTION_KEY is required to encrypt/decrypt sensitive data');
  }
  // Use SHA-256 to ensure exact 32 bytes from any length key
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Output format: <iv-base64>:<authTag-base64>:<encrypted-base64>
 */
export function encrypt(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypts a ciphertext string produced by encrypt().
 */
export function decrypt(cipherString: string, secret: string): string {
  const parts = cipherString.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format. Expected iv:authTag:ciphertext');
  }

  const [ivB64, authTagB64, encryptedB64] = parts;
  const key = deriveKey(secret);
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
