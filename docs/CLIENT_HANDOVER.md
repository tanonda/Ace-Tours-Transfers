# Client Handover Guide — Ace Tours & Transfers

This document covers everything needed to take ownership of the Ace Tours & Transfers website.

---

## 1. What You're Receiving

| Component | Details |
|-----------|---------|
| **Website** | Full-stack booking platform (tours, transfers, vehicle hire) |
| **Source code** | GitHub repository at `github.com/tanonda/Ace-Tours-Transfers` |
| **Database** | Neon PostgreSQL (serverless, managed) |
| **Image storage** | Cloudinary |
| **Error monitoring** | Sentry |
| **Uptime monitoring** | BetterStack |
| **Domain** | `acetoursvanuatu.com` (Hostinger) |

---

## 2. Accounts to Transfer

The following accounts need to be transferred to the client's email or the client needs their own accounts created.

| Service | What to do | URL |
|---------|------------|-----|
| **GitHub** | Transfer repository or add client as collaborator | github.com |
| **Neon** | Transfer project or create new project + migrate data | console.neon.tech |
| **Cloudinary** | Transfer account or create new (re-upload images) | console.cloudinary.com |
| **Sentry** | Transfer project or create new + update DSN | sentry.io |
| **BetterStack** | Transfer monitor or create new + update API key | betterstack.com |
| **Hostinger** | Transfer domain ownership to client | hostinger.com |
| **Gmail SMTP** | Client creates their own Gmail + App Password | myaccount.google.com/apppasswords |
| **Hosting** (Fly.io/Render) | Create account under client's email | fly.io or render.com |

### After transfer, rotate all secrets:
1. Neon database password
2. Session secret and JWT secret (`openssl rand -base64 32`)
3. Cloudinary API secret
4. Gmail App Password (new one for client's Gmail)
5. Update all in hosting provider's environment variables

---

## 3. Hosting & Deployment

### Option A: Fly.io (Recommended)
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login and deploy
fly auth login
fly launch              # Detects fly.toml and Dockerfile
fly secrets set DATABASE_URL="..." SESSION_SECRET="..." # Set all env vars
fly deploy              # Build + deploy
```

### Option B: Render
1. Create a **Web Service** pointing to the GitHub repo
2. Build command: `npm install && npm run build`
3. Start command: `npm start`
4. Add all environment variables from `.env.example`

### Automatic on deploy
- Database migrations run automatically on container startup
- No manual migration steps needed

---

## 4. Domain & DNS Setup

Domain `acetoursvanuatu.com` is on Hostinger. After deploying to a host:

1. Get the host's IP or CNAME from Fly.io/Render dashboard
2. In Hostinger DNS zone editor, update:
   - **A record** → host IP, or
   - **CNAME** for `www` → host's provided domain
3. Enable SSL/TLS on the hosting provider (automatic on Fly.io and Render)

### Email DNS Records (add in Hostinger DNS)
These improve email deliverability:

| Type | Host | Value |
|------|------|-------|
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:your-email@gmail.com` |

---

## 5. Admin Dashboard

Access at: `https://acetoursvanuatu.com/admin`

### Default admin login
- Email: `admin@aceproducts.vu`
- Password: `adminpassword`
- **Change this immediately after first login**

### What the admin can do
- **Tours/Transfers/Vehicles**: Create, edit, pricing, availability, images
- **Bookings**: View, confirm, cancel, refund
- **Payments**: View transactions, reconciliation
- **CMS**: Edit page content, FAQ, site settings
- **Settings**: Business phone, WhatsApp, email, GTM, coming soon mode
- **Analytics**: Revenue, booking trends, capacity utilisation

---

## 6. Daily Operations

### Checking bookings
1. Login to admin dashboard → **Bookings**
2. New bookings arrive as "pending" (manual transfer) or "confirmed" (auto)
3. For bank transfers: verify payment received → click **Confirm**

### Managing tours & availability
- **Add blackout dates**: Admin → Products → select tour → Blackout Dates
- **Change pricing**: Admin → Products → select tour → Pricing
- **Adjust capacity**: Admin → Products → select tour → Capacity

### Monitoring
- **Errors**: Check Sentry dashboard for any application errors
- **Uptime**: BetterStack sends alerts if the site goes down
- **Health check**: `https://acetoursvanuatu.com/api/health`

---

## 7. Ongoing Costs

| Service | Cost | Notes |
|---------|------|-------|
| **Neon** (database) | Free tier available (0.5 GB) | Paid from ~$19/mo for more storage |
| **Cloudinary** (images) | Free tier (25 GB bandwidth) | Sufficient for most use |
| **Fly.io** | ~$5-10/mo | Shared CPU, 512MB RAM |
| **Render** | Free tier available | Cold starts on free; $7/mo for always-on |
| **Sentry** | Free tier (5K errors/mo) | Sufficient for this scale |
| **BetterStack** | Free tier available | Basic uptime monitoring |
| **Hostinger** (domain) | ~$10-15/year | Domain renewal |
| **Gmail SMTP** | Free | Limited to ~500 emails/day |

**Estimated monthly cost: $5–30/mo** depending on hosting choice.

---

## 8. Common Tasks

### Update site content
Admin dashboard → **CMS** → edit content blocks. Changes are live immediately.

### Enable/disable coming soon page
Admin dashboard → **Settings** → toggle "Coming Soon"

### Add a new payment method
See `docs/HOW_TO_ADD_PAYMENT_METHOD.md` — requires developer assistance.

### Backup the database
Neon provides automatic daily backups. For manual backup:
```bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

### Update the website code
```bash
git pull origin main
npm install
npm run build
# Then redeploy via fly deploy or push to trigger Render auto-deploy
```

---

## 9. Emergency Contacts & Procedures

### Site is down
1. Check BetterStack for alert details
2. Check hosting provider status page (Fly.io/Render)
3. Check Neon status page (database)
4. Restart the service: `fly apps restart` (Fly.io) or redeploy on Render

### Database issue
1. Login to Neon console
2. Check connection count and storage usage
3. Neon has automatic recovery — most issues self-resolve

### Need a developer
The codebase includes comprehensive documentation in the `docs/` folder:
- `QUICK_START.md` — Developer onboarding
- `BOOKING_ENGINE_ARCHITECTURE.md` — System design
- `OPERATIONAL_RUNBOOK.md` — Troubleshooting guide
- `deployment_guide.md` — Deployment instructions
- `.env.example` — All environment variables documented

---

## 10. Handover Checklist

- [ ] GitHub repository access transferred
- [ ] Neon database ownership transferred
- [ ] Cloudinary account transferred
- [ ] Sentry project transferred
- [ ] BetterStack monitor transferred
- [ ] Hostinger domain transferred
- [ ] All secrets rotated with new values
- [ ] Hosting account created under client email
- [ ] Site deployed and accessible
- [ ] Admin password changed from default
- [ ] SPF and DMARC DNS records added
- [ ] Client trained on admin dashboard
- [ ] GTM container ID set (if using Google Analytics)
- [ ] Stripe configured (when ready for card payments)
- [ ] Email SMTP switched to client's Gmail account
