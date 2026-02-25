import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const key = process.env.GITHUB_PAT_ENCRYPTION_KEY;
  if (!key) throw new Error('GITHUB_PAT_ENCRYPTION_KEY is not set');
  return Buffer.from(key, 'hex');
}

export function encryptPAT(pat: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(pat, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${encrypted}:${iv.toString('hex')}:${authTag}`;
}

export function decryptPAT(stored: string): string {
  const [encrypted, ivHex, authTagHex] = stored.split(':');
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
