# Ace Tours & Transfers Vanuatu

A production-grade booking and management platform for [Ace Tours Vanuatu](https://acetoursvanuatu.com). This system provides a comprehensive solution for managing tours, airport transfers, and vehicle rentals with a focus on reliability, guest accessibility, and administrative control.

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

- **Vehicle Hire Module**: Fully integrated management of rental assets, pricing, and availability.
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
- **Infrastructure**: Deployment-ready for **Fly.io** or **Render**.

## 💻 Local Development

1. **Clone & Install**:
   ```bash
   git clone <repo-url>
   cd Ace-Tours-Transfers
   npm install
   ```
2. **Environment Setup**: Create a `.env` file based on the template in `deployment_guide.md`.
3. **Database Migration**: `npm run db:push`
4. **Development Server**: `npm run dev`

---

## 🚢 Deployment & QA

Refer to the following documents for production protocols:
- **[Deployment Guide](./deployment_guide.md)**: Infrastructure and environment configuration.
- **[Fixes Changelog](./FIXES_CHANGELOG.md)**: Audit record and reliability improvements.

### Verification Suite
- **Architecture Audit**: `npm run check-architecture`
- **Go-Live Verification**: `npm run go-live-verify`
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