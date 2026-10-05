import { describe, it, expect } from 'vitest';
import { randomBytes } from 'crypto';
import { sealCredentials, openCredentials, sealGatewayWrite, openGatewayRow } from './credential-crypto.js';

const KEY = randomBytes(32).toString('base64');
const CREDS = { shopId: '12345678', mode: 'TEST', testKey: 'TestKeyAbc123' };

describe('sealCredentials', () => {
  it('stores no plaintext secret', () => {
    const sealed = sealCredentials(CREDS, KEY);
    expect(JSON.stringify(sealed)).not.toContain('TestKeyAbc123');
    expect(JSON.stringify(sealed)).not.toContain('12345678');
  });

  it('round-trips through openCredentials', () => {
    expect(openCredentials(sealCredentials(CREDS, KEY), KEY)).toEqual(CREDS);
  });

  it('produces a different ciphertext each time', () => {
    expect(sealCredentials(CREDS, KEY)).not.toEqual(sealCredentials(CREDS, KEY));
  });

  it('leaves empty credentials as they are, so it works before a key is set', () => {
    expect(sealCredentials({}, undefined)).toEqual({});
    expect(sealCredentials(null, undefined)).toBeNull();
  });

  it('refuses to store real credentials without a key', () => {
    expect(() => sealCredentials(CREDS, undefined)).toThrow(/PAYMENT_CREDENTIALS_KEY/);
  });

  it('refuses a key that is not 32 bytes', () => {
    expect(() => sealCredentials(CREDS, Buffer.from('short').toString('base64'))).toThrow(/32 bytes/);
  });
});

describe('openCredentials', () => {
  it('passes through legacy plaintext credentials unchanged', () => {
    expect(openCredentials({}, undefined)).toEqual({});
    expect(openCredentials(CREDS, KEY)).toEqual(CREDS);
  });

  it('cannot read sealed credentials without the key', () => {
    expect(() => openCredentials(sealCredentials(CREDS, KEY), undefined)).toThrow(/PAYMENT_CREDENTIALS_KEY/);
  });

  it('rejects sealed credentials that were tampered with', () => {
    const sealed = sealCredentials(CREDS, KEY) as { sealed: string };
    const parts = sealed.sealed.split('.');
    const ct = Buffer.from(parts[3], 'base64');
    ct[0] ^= 1;
    parts[3] = ct.toString('base64');
    expect(() => openCredentials({ sealed: parts.join('.') }, KEY)).toThrow();
  });

  it('rejects sealed credentials opened with a different key', () => {
    const other = randomBytes(32).toString('base64');
    expect(() => openCredentials(sealCredentials(CREDS, KEY), other)).toThrow();
  });
});

describe('gateway row helpers', () => {
  const row = { id: 'gw-1', slug: 'bred-bank', active: true, credentials: CREDS };

  it('seals the credentials of a gateway being saved and leaves other fields alone', () => {
    const write = sealGatewayWrite({ active: true, credentials: CREDS }, KEY);
    expect(write.active).toBe(true);
    expect(openCredentials(write.credentials as any, KEY)).toEqual(CREDS);
  });

  it('does not add credentials to an update that has none', () => {
    expect(sealGatewayWrite({ active: false }, KEY)).toEqual({ active: false });
  });

  it('opens the credentials of a gateway read from the database', () => {
    const stored = { ...row, credentials: sealCredentials(CREDS, KEY) };
    expect(openGatewayRow(stored, KEY)).toEqual(row);
  });

  it('returns null credentials rather than throwing when they cannot be opened', () => {
    const stored = { ...row, credentials: sealCredentials(CREDS, KEY) };
    expect(openGatewayRow(stored, undefined)).toEqual({ ...row, credentials: null });
  });
});
