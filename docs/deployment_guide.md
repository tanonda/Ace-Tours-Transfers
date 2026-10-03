# Deployment & Integration Guide: Ace Tours & Transfers

This guide outlines the steps to finalize your deployment to Fly.io or Render and integrate with Neon, Cloudinary, and Stripe.

## 1. Environment Variables & Secrets

You will need to set the following environment variables in your hosting provider's dashboard (e.g., Fly.io Secrets or Render Environment).

| Variable | Description | Source |
|----------|-------------|--------|
| `DATABASE_URL` | Neon PostgreSQL Connection String | Neon Console |
| `CLOUDINARY_URL` | Cloudinary API Environment Variable | Cloudinary Dashboard |
| `SESSION_SECRET` | A long random string for session signing | Generated (e.g., `openssl rand -hex 32`) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe Public Key | Stripe Dashboard (Developers > API keys) |
| `STRIPE_SECRET_KEY` | Stripe Secret Key | Stripe Dashboard (Developers > API keys) |
| `PAYMENTS_STRIPE_MODE` | `sandbox` or `live` | Configuration |

### Setting Secrets on Fly.io
```bash
fly secrets set DATABASE_URL="..." CLOUDINARY_URL="..." SESSION_SECRET="..." STRIPE_PUBLISHABLE_KEY="..." STRIPE_SECRET_KEY="..."
```

### Setting Secrets on Render
Go to **Dashboard > [Your Service] > Environment** and add the variables listed above.

---

## 2. Neon Database Setup

1. **Connect to Neon**: Use the `scripts/test-neon-connection.ts` to verify your local environment can talk to Neon.
   ```bash
   npm run db:test
   ```
2. **Push Schema**: Once connected, push your schema to Neon.
   ```bash
   npm run db:push
   ```
   *Note: This will synchronize your `shared/schema.ts` with the Neon database.*

---

## 3. Cloudinary Verification

The Admin UI has been updated to use Cloudinary.
1. Log into the Admin Dashboard (`/login` then navigate to `/admin/tours`).
2. Try uploading an image for a tour or service.
3. Verify the image appears in your Cloudinary Media Library under the `ace-tours` folder.

---

## 4. Final Go-Live Verification

Before launching to the public, run the automated verification suite:
```bash
npm run go-live-verify
```
This script (already in your codebase) checks core domain invariants and ensures the system is stable.

---

## 5. Hosting Recommendations

> [!TIP]
> **Fly.io** is recommended for this monolithic architecture because it handles persistent background workers better than Render's free tier (which has "cold starts").

### Fly.io Deployment
1. Install Fly CLI.
2. Run `fly launch` (it will detect the `fly.toml` and `Dockerfile`).
3. Set your secrets (see Section 1).
4. Run `fly deploy`.

### Render Deployment
1. Create a "Web Service" pointing to your GitHub Repo.
2. Select "Node" runtime.
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`
5. Add environment variables (see Section 1).
