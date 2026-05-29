---
title: "Reference — External Services"
roles: [admin]
last_updated: 2026-05-29
screen: external-services
order: 117
---

# Reference — External Services

> caution
> Changes on this screen affect revenue or paid-out money. Confirm with the
> business owner or finance before applying anything.

**Path:** Admin → Settings → Integrations → External Services (or Admin → External Services Audit)

The External Services screen provides an administrative audit view of all third-party APIs, CDNs, hosting platforms, and database servers connected to the application.

---

## Critical Core Services

These three services are **mandatory**; the application cannot start or process bookings without them:
1. **Neon PostgreSQL:** Primary application database. Configured using `DATABASE_URL` in environment variables.
2. **Gmail SMTP (Google SMTP):** Handles all transactional emails (booking confirmations, resets). Requires Google 2-Factor Authentication and a 16-character App Password.
3. **Cloudinary:** Stores and serves optimized product photos and tour assets. Requires Cloud Name, API Key, and API Secret.

---

## Optional Third-Party Services

These integrations add premium features but can be safely toggled off:
- **Stripe Payments:** International card processing (currently bypassed for local Vanuatu bank gateways).
- **Local Vanuatu Bank Gateways:** Includes ANZ eGate, BSP Bank, and BRED Bank integrations for domestic Visa/Mastercard processing.
- **Mobile Wallets & E-Wallets:** Digicel MyCash, KwikPay, and WanTok Money integrations.
- **Twilio SMS / CapCom6 Android SMS Gateway:** Automates mobile SMS alerts and booking confirmations.
- **Sentry / BetterStack Uptime:** Production error tracking and site status/uptime monitoring.
- **Trustpilot TrustBox Widget / Google Places API:** Displays social proof reviews on tour pages.
- **Google Maps Embed API:** Injects meeting point maps on checkout and detail screens.
- **jsDelivr Currency Rates API:** Automatically pulls daily VUV exchange rates.

---

## Inspecting & Connecting Services

Each listed service in the audit panel can be expanded to view:
- **Why This Service Is Needed:** Purpose of the integration.
- **Environment Variables:** Specific key names required in the `.env` configuration file or hosting platform dashboard (e.g., `SENTRY_DSN`, `BETTERSTACK_API_KEY`).
- **Connection Workflow:** Standard step-by-step instructions to create developer credentials and link them to the application.
