import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { csrfProtection } from './csrf.js';

// Mounted exactly as in server/index.ts: app.use("/api", csrfProtection)
function makeApp() {
  const app = express();
  app.use(cookieParser());
  app.use('/api', csrfProtection);
  app.post('/api/payments/webhook/bred-bank', (_req, res) => res.send('reached'));
  app.post('/api/payments/callback/bsp-bank', (_req, res) => res.send('reached'));
  app.post('/api/bookings', (_req, res) => res.send('reached'));
  return app;
}

describe('csrfProtection mounted at /api', () => {
  it('lets a bank notification through without a CSRF token', async () => {
    const res = await request(makeApp()).post('/api/payments/webhook/bred-bank').type('form').send({ vads_site_id: '1' });
    expect(res.status).toBe(200);
  });

  it('lets a bank return callback through without a CSRF token', async () => {
    const res = await request(makeApp()).post('/api/payments/callback/bsp-bank').send({});
    expect(res.status).toBe(200);
  });

  it('still blocks other POSTs without a CSRF token', async () => {
    const res = await request(makeApp()).post('/api/bookings').send({});
    expect(res.status).toBe(403);
  });
});

describe('csrfProtection token checks', () => {
  function appWith(...paths: string[]) {
    const app = express();
    app.use(cookieParser());
    app.use('/api', csrfProtection);
    for (const p of paths) app.all(p, (_req, res) => res.send('reached'));
    return app;
  }
  const TOKEN = 'a'.repeat(64);

  it('accepts a header that matches the cookie', async () => {
    const res = await request(appWith('/api/bookings'))
      .post('/api/bookings').set('Cookie', `csrf_token=${TOKEN}`).set('X-CSRF-Token', TOKEN).send({});
    expect(res.status).toBe(200);
  });

  it('rejects a header that does not match the cookie', async () => {
    const res = await request(appWith('/api/bookings'))
      .post('/api/bookings').set('Cookie', `csrf_token=${TOKEN}`).set('X-CSRF-Token', 'b'.repeat(64)).send({});
    expect(res.status).toBe(403);
  });

  it('rejects a cookie with no header (what a cross-site form sends)', async () => {
    const res = await request(appWith('/api/bookings')).post('/api/bookings').set('Cookie', `csrf_token=${TOKEN}`).send({});
    expect(res.status).toBe(403);
  });

  it.each(['put', 'patch', 'delete'] as const)('guards %s as well as post', async (method) => {
    const res = await (request(appWith('/api/bookings/1')) as any)[method]('/api/bookings/1');
    expect(res.status).toBe(403);
  });

  // Exemptions are for the named endpoints only, not anything that shares their prefix.
  it.each(['/api/healthcheck-admin', '/api/stripe/webhook-config', '/api/stripe/webhooks'])(
    'does not exempt the lookalike path %s',
    async (path) => {
      const res = await request(appWith(path)).post(path).send({});
      expect(res.status).toBe(403);
    },
  );

  it('still exempts the Stripe webhook itself', async () => {
    const res = await request(appWith('/api/stripe/webhook')).post('/api/stripe/webhook').send({});
    expect(res.status).toBe(200);
  });
});
