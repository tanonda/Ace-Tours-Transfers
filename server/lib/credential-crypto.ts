// server/lib/credential-crypto.ts

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Encrypts payment gateway credentials at rest (AES-256-GCM).
 * Stored shape: { sealed: "v1.<iv>.<auth tag>.<ciphertext>" } (Base64 parts).
 * The key is PAYMENT_CREDENTIALS_KEY: 32 random bytes, Base64-encoded.
 * Rows saved before encryption hold plain objects; openCredentials passes those through.
 */
type Credentials = Record<string, unknown> | null | undefined;

function keyBytes(key: string | undefined): Buffer {
  if (!key) throw new Error('PAYMENT_CREDENTIALS_KEY is not set; gateway credentials cannot be stored or read.');
  const bytes = Buffer.from(key, 'base64');
  if (bytes.length !== 32) throw new Error('PAYMENT_CREDENTIALS_KEY must be 32 bytes, Base64-encoded.');
  return bytes;
}

function isEmpty(creds: Credentials): boolean {
  return !creds || Object.keys(creds).length === 0;
}

export function sealCredentials(creds: Credentials, key: string | undefined): Credentials {
  if (isEmpty(creds)) return creds;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBytes(key), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(creds), 'utf8'), cipher.final()]);
  const parts = [iv, cipher.getAuthTag(), ciphertext].map((b) => b.toString('base64'));
  return { sealed: ['v1', ...parts].join('.') };
}

export function openCredentials(stored: Credentials, key: string | undefined): Credentials {
  if (!stored || typeof stored.sealed !== 'string') return stored;
  const [version, iv, tag, ciphertext] = stored.sealed.split('.');
  if (version !== 'v1') throw new Error(`Unknown sealed credentials version ${version}`);
  const decipher = createDecipheriv('aes-256-gcm', keyBytes(key), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const plain = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}

/** Seals `credentials` on a payment_gateways insert/update, if the write includes them. */
export function sealGatewayWrite<T extends object>(data: T, key: string | undefined): T {
  if (!('credentials' in data)) return data;
  return { ...data, credentials: sealCredentials(data.credentials as Credentials, key) };
}

/**
 * Opens `credentials` on a payment_gateways row. If they can't be opened (key
 * missing or wrong) the row comes back with null credentials, so that gateway's
 * adapter refuses to run while public gateway listings keep working.
 */
export function openGatewayRow<T extends { slug?: string; credentials?: unknown }>(row: T, key: string | undefined): T {
  try {
    return { ...row, credentials: openCredentials(row.credentials as Credentials, key) };
  } catch (err: any) {
    console.error(`[CREDENTIALS] Cannot open credentials for gateway ${row.slug}: ${err.message}`);
    return { ...row, credentials: null };
  }
}
