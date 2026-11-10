# Ace Tours & Transfers Vanuatu

A production-grade booking and management platform for [Ace Tours Vanuatu](https://acetoursvanuatu.com). This system provides a comprehensive solution for managing tours and airport transfers with a focus on reliability, guest accessibility, and administrative control.

> **Note:** Self-drive vehicle hire was retired from the platform per Vanuatu Financial Intelligence Unit (FIU) compliance requirements.

---

## 🚀 Key Features & Project Scope

### 📋 Original Quoted Scope
*Context: These features represent the baseline project requirements from the initial engagement.*

- **Unified Booking Engine**: Real-time availability tracking for:
  - **Island Tours**: Customizable guest counts and scheduling.
  - **Airport Transfers**: Dedicated flow for point-to-point transportation.
- **Guest-First Management**: Secure, account-less booking management using unique references and email verification.
- **Admin Command Center**:
  - **Dashboard**: Real-time overview of bookings and revenue.
  - **Audit Logs**: Comprehensive tracking of all system and capacity changes.
  - **CMS & Settings**: Toggle site sections, manage WhatsApp widgets, and update pricing.
- **Resilient Payments**: Supporting:
  - **Manual Bank Transfers**: Secure handoff for direct deposits.
  - **Cash on Delivery**: Flexible options for on-ground arrival.
- **Performance & SEO**: Fully responsive design and Cloudinary-optimized assets.

### ✨ Additions & Enhancements (Current)
*Context: These modules were added beyond the original quote to accommodate evolving business needs.*

- **Guest Dashboard Enhancements**: Improved usability and feature set for temporary, account-less management.
- **Extended Payment Flows**: Support for offline and bank transfer flows beyond the initial baseline.
- **UX Redesign**: Modernized home hero section with an enhanced availability checker.
- **Notifications System**: Integrated Email and SMS (via Twilio) for automated confirmations and reminders.

---

## 🛠️ Technical Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Lucide Icons.
- **Backend**: Node.js, Express, TypeScript, Drizzle ORM.
- **Database**: [Neon](https://neon.tech) (Serverless PostgreSQL).
- **Services**: 
  - **Cloudinary**: Cloud-based image management.
  - **Sentry**: Error monitoring and reporting.
  - **Twilio & Email**: Automated guest notifications.
  - **BRED PayZen**: Card payments via the bank's hosted page + IPN (code ready;
    go-live pending the bank setup — see the [BRED go-live runbook](./docs/BRED_PAYZEN_GO_LIVE.md)).
- **Infrastructure**: **Render** (Docker runtime + Playwright prerender) with Neon PostgreSQL.

## 💻 Local Development

1. **Clone & Install**:
   ```bash
   git clone <private-repo-url>
   cd Ace-Tours-Transfers
   npm install
   ```
2. **Environment Setup**: Copy `.env.active.example` to `.env` and fill it in
   (full reference: [`.env.example`](./.env.example)).
3. **Database Migration**: `npm run db:migrate` (never `db:push` against a shared DB)
4. **Development Server**: `npm run dev`

See [`docs/QUICK_START.md`](./docs/QUICK_START.md) for requirements, seeding,
tests and the architecture map.

---

## 🚢 Deployment & QA

Refer to the following documents for production protocols:
- **[Security & Handover](./docs/SECURITY_HANDOVER.md)** — required reading before
  any access/handover (the repo must be private; secrets must be rotated).
- **[Deployment Guide](./docs/deployment_guide.md)**: Render + Neon setup and the
  full environment list.
- **[BRED Bank Setup Sheet](./docs/BRED_PAYZEN_BANK_SETUP_SHEET.md)**: plain-language,
  owner-facing — the settings to send BRED, what to ask BRED for, and where to enter
  the details in Admin → Payments.
- **[BRED TEST Evidence & Endpoint Checks](./docs/BRED_TEST_EVIDENCE.md)**: endpoint
  checker, Back Office round-trip and the printable TEST evidence log.
- **[BRED PayZen Go-Live](./docs/BRED_PAYZEN_GO_LIVE.md)**: card-payment runbook,
  BRED checklist and reply-e-mail draft.
- **[Fixes Changelog](./docs/FIXES_CHANGELOG.md)**: Audit record and reliability improvements.

### Verification Suite
- **Architecture Audit**: `npm run check-architecture`
- **Go-Live Verification**: `npm run go-live-verify`
- **BRED endpoint check**: `npm run check:bred-endpoint -- --base-url https://<host>`
  (needs `BRED_SHOP_ID` and `BRED_TEST_KEY`; see the [TEST evidence sheet](./docs/BRED_TEST_EVIDENCE.md))
- **Database Connectivity**: `npm run db:test`

## 🛡️ Governance
- Implements Domain-Driven Design (DDD) principles.
- Strict invariant checks for inventory integrity.
- Technical documentation available in `docs/`.

---

## 📌 Developer Notes: Scope & Financials
*History Reference: Tracking the evolution of project costs and timelines.*

- **Original Quote (Tours & Transfers)**: 241,000 VT (~$2,010 USD)
- **New Features Added**: 120,000 VT (~$1,000 USD)
- **Adjusted Phase 1 Total**: 361,000 VT (~$3,010 USD)
- **Timeline**: Extended from 10 to 11 weeks total.
- **Maintenance**: Plans include an additional 1–2 hours/month for new functionality support.

---
*Built for Ace Tours Vanuatu — 2026 Production Release*