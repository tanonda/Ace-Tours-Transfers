# 🚀 Go-Live Checklist: Ace Tours & Transfers

Follow these steps before making the site public.

## 1. Environment & Infrastructure
- [ ] **Neon Connection**: Run `npm run db:test` from a production-like environment.
- [ ] **Schema Migration**: Ensure `npm run db:migrate` has been run successfully.
- [ ] **SSL/HTTPS**: Verify that HTTPS is enforced (configured in `fly.toml` / `render.yaml`).
- [ ] **Secrets Check**: Ensure no API keys are missing (Stripe, Cloudinary, Session).

## 2. Payments (Stripe)
- [ ] **Mode Check**: Set `PAYMENTS_STRIPE_MODE` to `live` for production.
- [ ] **Webhook Configuration**: (Optional) If using webhooks, ensure Render/Fly URL is registered in Stripe Dashboard.
- [ ] **Test Transaction**: Perform one successful transaction in test mode before switching.

## 3. Media & Content (Cloudinary)
- [ ] **Upload Test**: Upload a sample tour image via Admin UI.
- [ ] **Media Optimization**: Verify images are loading without significant lag.

## 4. Domain Logic & Invariants
- [ ] **Automated Suite**: Run `npm run go-live-verify` and ensure all tests pass.
- [ ] **DDD Invariants**: Run `npm run verify-ddd`.
- [ ] **Manual Booking**: Perform a full end-to-end booking (Guest & User).

## 5. Security
- [ ] **Admin Access**: Verify that only authorized users can access `/admin`.
- [ ] **CORS**: Check CORS policy in `server/index.ts` matches the production domain.

---
**Status**: 🔴 PRE-FLIGHT  
**Last Verified**: N/A
