import { describe, it, expect } from 'vitest';
import { redact } from './admin-audit-log.service.js';

describe('admin audit redact', () => {
  it('masks a payment gateway\'s whole credentials object, whatever its field names', () => {
    const gateway = {
      slug: 'bred-bank',
      active: true,
      credentials: { shopId: '12345678', testKey: 'abc', productionKey: 'def', secureHashSecret: 'ghi' },
    };
    expect(redact(gateway)).toEqual({ slug: 'bred-bank', active: true, credentials: '[REDACTED]' });
  });

  it('still masks known secret keys elsewhere', () => {
    expect(redact({ config: { webhookSecret: 'x', mode: 'TEST' } })).toEqual({
      config: { webhookSecret: '[REDACTED]', mode: 'TEST' },
    });
  });
});
