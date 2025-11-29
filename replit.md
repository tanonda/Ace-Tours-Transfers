# Ace Tours & Transfers Vanuatu

## Overview

Ace Tours & Transfers is a full-stack web application for a tourism company operating in Port Vila, Vanuatu. The platform enables customers to browse and book tour packages and transfer services, while providing administrators with comprehensive booking management and analytics capabilities. Built with a modern React frontend and Express backend, the application features a dual-interface system with separate dashboards for customers and administrators.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Tooling**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server, configured for hot module replacement
- Wouter for lightweight client-side routing instead of React Router
- TanStack Query (React Query) for server state management with automatic caching and refetching

**UI Component System**
- Shadcn/ui component library built on Radix UI primitives for accessible, customizable components
- Tailwind CSS v4 for utility-first styling with custom design tokens
- Custom theming with warm, earthy colors (cream backgrounds, brown text, primary accent colors)
- Framer Motion for smooth animations and transitions
- Chart.js with react-chartjs-2 for data visualization in admin dashboards

**State Management**
- Context API for global state (Authentication, Shopping Cart)
- React Query for server state with configurable refetch policies
- Session-based authentication state synchronized with backend

**Key Design Patterns**
- Component composition with shared Layout wrapper
- Protected routes using custom ProtectedRoute component with role-based access control
- Form validation using React Hook Form with Zod schema validation
- Reusable dialog/modal components for booking flows and quick views

### Backend Architecture

**Server Framework**
- Express.js with TypeScript running on Node.js
- HTTP server using native Node.js createServer for potential WebSocket upgrades
- Session-based authentication using express-session middleware
- No external authentication providers - custom email/password implementation

**Database Layer**
- Drizzle ORM for type-safe database operations
- PostgreSQL as the primary database (via Neon serverless)
- Schema-first design with TypeScript types generated from Drizzle schemas
- Migration support through Drizzle Kit

**API Design**
- RESTful API structure with standard CRUD operations
- Session-based authentication with httpOnly cookies
- Role-based access control (admin vs. customer roles)
- Endpoints grouped by resource: `/api/auth`, `/api/tours`, `/api/bookings`, `/api/customers`

**Authentication & Authorization**
- Session management with express-session (24-hour session timeout)
- Password hashing using bcryptjs (supports legacy plain-text for backward compatibility)
- Role-based middleware: `requireAuth()` and `requireAdmin()`
- Session data includes userId and userRole for request context

**Storage Abstraction**
- IStorage interface defining all data operations
- DatabaseStorage implementation using Drizzle ORM
- Centralized database connection through `db.ts` using connection pooling
- Seeding scripts for initial data population (tours, users, bookings)

### Database Schema

**Core Tables**
1. **users** - Customer and admin accounts
   - id (UUID primary key)
   - username, password, email (unique constraints)
   - role (admin/customer)
   - name, phone
   - createdAt timestamp

2. **tours** - Tour and transfer packages
   - id (UUID primary key)
   - title, price, childPrice, duration, minPax
   - image (URL/path)
   - description (text array)
   - category (tour/transfer)

3. **bookings** - Customer reservations
   - id (UUID primary key)
   - userId, tourId (foreign keys)
   - date, guests, amount
   - status (pending/confirmed/completed/cancelled)
   - customerName, tourName (denormalized for performance)
   - createdAt timestamp

**Relationships**
- Users have many bookings (one-to-many)
- Tours have many bookings (one-to-many)
- Drizzle relations defined for type-safe joins

### Build & Deployment

**Development Mode**
- Vite dev server on port 5000 for frontend
- tsx watch mode for backend hot reload
- Separate dev scripts: `dev:client` and `dev`

**Production Build**
- Custom build script using esbuild for backend bundling
- Vite build for optimized frontend assets
- Server bundled as single CJS file with allowlisted dependencies
- Static files served from Express in production

**Environment Configuration**
- DATABASE_URL for PostgreSQL connection
- SESSION_SECRET for session encryption
- NODE_ENV for environment detection
- Replit-specific environment variables (REPL_ID) for platform features

## External Dependencies

### Third-Party Services
- **Neon Database** - Serverless PostgreSQL hosting with WebSocket support
- **Replit Platform** - Deployment platform with development tools (cartographer, dev banner)

### Key NPM Packages

**Frontend**
- @tanstack/react-query - Server state management
- wouter - Client-side routing
- react-hook-form - Form state management
- zod - Schema validation
- @hookform/resolvers - Form validation integration
- chart.js & react-chartjs-2 - Data visualization
- date-fns - Date formatting and manipulation
- framer-motion - Animation library
- lucide-react - Icon system

**Backend**
- express - Web server framework
- drizzle-orm - Type-safe ORM
- @neondatabase/serverless - PostgreSQL client
- express-session - Session middleware
- bcryptjs - Password hashing
- ws - WebSocket library (for Neon)

**UI Components**
- @radix-ui/* - 30+ accessible component primitives
- class-variance-authority - Variant-based component styling
- tailwindcss - Utility-first CSS framework
- clsx & tailwind-merge - Class name utilities

**Development**
- typescript - Type system
- vite - Build tool
- tsx - TypeScript executor
- drizzle-kit - Database migrations
- esbuild - Production bundler

### Custom Integrations
- Custom Vite plugin (vite-plugin-meta-images) for OpenGraph meta tag updates
- Replit-specific Vite plugins for development experience (cartographer, dev banner, runtime error modal)