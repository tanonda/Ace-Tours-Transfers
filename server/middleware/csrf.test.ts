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
