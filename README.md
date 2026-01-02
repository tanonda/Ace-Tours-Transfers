# Ace Tours & Transfers Vanuatu

A production-grade booking and management platform for Ace Tours Vanuatu. Built with Node.js, TypeScript, Express, Drizzle ORM, and React.

## 🚀 Key Features
- **Booking Engine**: Sophisticated availability tracking and reservation management.
- **DDD Architecture**: Strict adherence to Domain-Driven Design principles.
- **Admin Dashboard**: Comprehensive management of tours, vehicles, and bookings.
- **Multi-Cloud Integration**: 
  - **Neon**: Serverless PostgreSQL for data persistence.
  - **Cloudinary**: Cloud-based image management.
  - **Stripe**: Secure payment processing.
- **Infrastructure**: Ready for deployment on **Fly.io** or **Render**.

## 🛠️ Local Development

1. **Clone & Install**:
   ```bash
   git clone <repo-url>
   cd AceToursVanuatu
   npm install
   ```
2. **Setup Env**: Create a `.env` file based on the table in `deployment_guide.md`.
3. **Database**: Use Docker or a local Postgres instance, then push schema:
   ```bash
   npm run db:push
   ```
4. **Run**:
   ```bash
   npm run dev
   ```

## 🚢 Deployment

Detailed instructions can be found in [deployment_guide.md](./deployment_guide.md) and [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md).

### Quick Fly.io Deploy:
```bash
fly secrets set DATABASE_URL="..." CLOUDINARY_URL="..." STRIPE_SECRET_KEY="..." SESSION_SECRET="..."
fly deploy
```

## 🧪 Verification & QA

- **Architecture Audit**: `npm run check-architecture`
- **Go-Live Suite**: `npm run go-live-verify`
- **Database Test**: `npm run db:test`

## 🛡️ Governance & Integrity

The system implements strict invariant checks and production kill switches. Refer to the ADR documents and `server/infrastructure/recovery` for integrity protocols.
