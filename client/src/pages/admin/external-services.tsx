import { DashboardLayout } from "@/components/dashboard-layout";
import { useState } from "react";
import {
  Database, CreditCard, Mail, MessageSquare, AlertTriangle, Image,
  Star, Map, Globe, Server, ChevronDown, ChevronRight, ExternalLink,
  CheckCircle2, Info, Shield, Zap
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

interface ServiceEntry {
  name: string;
  endpoint: string;
  envVars: string[];
  why: string;
  howToConnect: string[];
  required: boolean;
  docsUrl?: string;
}

interface ServiceCategory {
  title: string;
  icon: React.ReactNode;
  color: string;
  services: ServiceEntry[];
}

const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    title: "Database",
    icon: <Database className="w-5 h-5" />,
    color: "text-blue-400",
    services: [
      {
        name: "Neon PostgreSQL",
        endpoint: "postgresql://<host>/<db>?sslmode=require",
        envVars: ["DATABASE_URL"],
        why: "Primary application database storing all bookings, products, users, payments, and system configuration. The entire application depends on this connection.",
        howToConnect: [
          "Create a free project at https://console.neon.tech",
          "Navigate to your project → Connection Details",
          "Copy the connection string (PostgreSQL format)",
          "Set DATABASE_URL in your .env file",
        ],
        required: true,
        docsUrl: "https://neon.tech/docs/get-started-with-neon/signing-up",
      },
    ],
  },
  {
    title: "Payment Gateways",
    icon: <CreditCard className="w-5 h-5" />,
    color: "text-emerald-400",
    services: [
      {
        name: "Stripe",
        endpoint: "https://api.stripe.com",
        envVars: ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "PAYMENTS_STRIPE_ENABLED"],
        why: "International card payment processing. Currently deprecated for Vanuatu merchants but retained for backward compatibility and potential future use.",
        howToConnect: [
          "Register at https://dashboard.stripe.com/register",
          "Obtain API keys from Developers → API keys",
          "Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY in .env",
          "Set PAYMENTS_STRIPE_ENABLED=true and PAYMENTS_STRIPE_VISIBLE=true",
        ],
        required: false,
        docsUrl: "https://docs.stripe.com/keys",
      },
      {
        name: "ANZ eGate (Mastercard Gateway)",
        endpoint: "Bank-provided MIGS/VPC endpoint",
        envVars: ["ANZ_MERCHANT_ID", "ANZ_API_KEY", "ANZ_API_SECRET", "PAYMENTS_ANZ_ENABLED"],
        why: "Local Vanuatu bank card payments via ANZ's Mastercard Payment Gateway Service (MCPGS). Supports Visa/Mastercard for domestic transactions.",
        howToConnect: [
          "Contact ANZ Bank Vanuatu for a merchant account",
          "Obtain your Merchant ID, API Key, and API Secret",
          "Configure credentials via Admin → Settings → Payment Gateways",
          "Set PAYMENTS_ANZ_ENABLED=true in .env",
        ],
        required: false,
      },
      {
        name: "BSP Bank (Mastercard Gateway)",
        endpoint: "Bank-provided MIGS/VPC endpoint",
        envVars: ["BSP_MERCHANT_ID", "BSP_API_KEY", "BSP_API_SECRET", "PAYMENTS_BSP_ENABLED"],
        why: "Local Vanuatu card payments via BSP's Mastercard Payment Gateway. Alternative bank option for customers who bank with BSP.",
        howToConnect: [
          "Contact BSP Bank Vanuatu for a merchant account",
          "Obtain your Merchant ID, API Key, and API Secret",
          "Configure credentials via Admin → Settings → Payment Gateways",
          "Set PAYMENTS_BSP_ENABLED=true in .env",
        ],
        required: false,
      },
      {
        name: "BRED Bank (Mastercard Gateway)",
        endpoint: "Bank-provided MIGS/VPC endpoint",
        envVars: ["BRED_MERCHANT_ID", "BRED_API_KEY", "BRED_API_SECRET", "PAYMENTS_BRED_ENABLED"],
        why: "Local Vanuatu card payments via BRED Bank's Mastercard Payment Gateway. Third local banking option for broader card acceptance.",
        howToConnect: [
          "Contact BRED Bank Vanuatu for a merchant account",
          "Obtain your Merchant ID, API Key, and API Secret",
          "Configure credentials via Admin → Settings → Payment Gateways",
          "Set PAYMENTS_BRED_ENABLED=true in .env",
        ],
        required: false,
      },
      {
        name: "PayPal",
        endpoint: "https://api-m.paypal.com (live) / https://api-m.sandbox.paypal.com (sandbox)",
        envVars: ["Admin-configured clientId & clientSecret"],
        why: "International payment option for tourists who prefer PayPal. Supports PayPal balance, linked cards, and Pay Later options.",
        howToConnect: [
          "Create a PayPal Business account at https://www.paypal.com/business",
          "Navigate to Developer Dashboard → Apps & Credentials",
          "Create a REST API app and obtain Client ID and Secret",
          "Configure credentials via Admin → Settings → Payment Gateways",
        ],
        required: false,
        docsUrl: "https://developer.paypal.com/api/rest/",
      },
      {
        name: "Digicel MyCash",
        endpoint: "https://api.mycash.digi.vu/v1 (configurable)",
        envVars: ["Admin-configured apiKey, apiSecret, merchantId"],
        why: "Local Vanuatu mobile money payments. Allows customers to pay via Digicel's MyCash mobile wallet using USSD, QR code, or direct API.",
        howToConnect: [
          "Contact Digicel Vanuatu for a MyCash merchant account",
          "Obtain API credentials (apiKey, apiSecret, merchantId)",
          "Configure via Admin → Settings → Payment Gateways → Digicel MyCash",
        ],
        required: false,
      },
      {
        name: "KwikPay",
        endpoint: "https://api.kwikpay.vu/v1 (configurable)",
        envVars: ["Admin-configured apiKey, apiSecret, merchantId"],
        why: "Local e-wallet payment option. KwikPay is popular in Vanuatu for mobile payments via USSD and QR codes.",
        howToConnect: [
          "Contact KwikPay for a merchant integration account",
          "Obtain API credentials",
          "Configure via Admin → Settings → Payment Gateways → KwikPay",
        ],
        required: false,
      },
      {
        name: "WanTok Money",
        endpoint: "https://api.wantokmoney.vu/v1 (configurable)",
        envVars: ["Admin-configured apiKey, apiSecret, merchantId"],
        why: "Local mobile money payments via WanTok Money. Provides another mobile payment channel for domestic customers.",
        howToConnect: [
          "Contact WanTok Money for merchant access",
          "Obtain API credentials",
          "Configure via Admin → Settings → Payment Gateways → WanTok Money",
        ],
        required: false,
      },
    ],
  },
  {
    title: "Email (SMTP)",
    icon: <Mail className="w-5 h-5" />,
    color: "text-orange-400",
    services: [
      {
        name: "Gmail SMTP",
        endpoint: "smtp.gmail.com:587",
        envVars: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"],
        why: "Sends all transactional emails: booking confirmations, payment receipts, cancellation notices, admin alerts, and password reset links. Essential for customer communication.",
        howToConnect: [
          "Enable 2-Factor Authentication on your Google Account",
          "Generate an App Password at https://myaccount.google.com/apppasswords",
          "Set SMTP_HOST=smtp.gmail.com, SMTP_PORT=587",
          "Set SMTP_USER=your-email@gmail.com, SMTP_PASS=your-app-password",
          "Set SMTP_FROM=no-reply@yourdomain.com",
        ],
        required: true,
        docsUrl: "https://support.google.com/accounts/answer/185833",
      },
      {
        name: "Mailtrap (dev/staging)",
        endpoint: "smtp.mailtrap.io:2525",
        envVars: ["MAILTRAP_USER", "MAILTRAP_PASS", "MAILTRAP_HOST", "MAILTRAP_PORT"],
        why: "Safe email testing in development/staging environments. Catches all outgoing emails in a virtual inbox so no real emails are sent during testing.",
        howToConnect: [
          "Sign up at https://mailtrap.io",
          "Create an inbox in Email Testing",
          "Copy SMTP credentials from the inbox settings",
          "Set MAILTRAP_* variables in your .env",
        ],
        required: false,
        docsUrl: "https://mailtrap.io/email-sandbox/",
      },
    ],
  },
  {
    title: "SMS",
    icon: <MessageSquare className="w-5 h-5" />,
    color: "text-purple-400",
    services: [
      {
        name: "CapCom6 Android SMS Gateway (Cloud)",
        endpoint: "https://api.sms-gate.app (default)",
        envVars: ["SMS_PROVIDER=android_gateway", "SMS_CLOUD_URL", "SMS_CLOUD_LOGIN", "SMS_CLOUD_PASSWORD"],
        why: "Sends SMS notifications for booking confirmations, reminders, and admin alerts via a cloud-connected Android phone. Cost-effective for Vanuatu local numbers.",
        howToConnect: [
          "Install the SMS Gateway app from Google Play on an Android phone",
          "Enable Cloud Server mode in the app settings",
          "Note the login credentials shown in the app",
          "Set SMS_PROVIDER=android_gateway and the SMS_CLOUD_* variables",
        ],
        required: false,
      },
      {
        name: "Twilio",
        endpoint: "https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json",
        envVars: ["SMS_PROVIDER=twilio", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"],
        why: "Enterprise-grade SMS delivery service. Use as a fallback or alternative to the Android Gateway for more reliable international SMS delivery.",
        howToConnect: [
          "Create an account at https://www.twilio.com",
          "Obtain Account SID and Auth Token from the dashboard",
          "Purchase a phone number (or use a trial number)",
          "Set SMS_PROVIDER=twilio and TWILIO_* variables",
        ],
        required: false,
        docsUrl: "https://www.twilio.com/docs/sms",
      },
    ],
  },
  {
    title: "Monitoring & Error Tracking",
    icon: <AlertTriangle className="w-5 h-5" />,
    color: "text-red-400",
    services: [
      {
        name: "Sentry",
        endpoint: "https://*.ingest.de.sentry.io",
        envVars: ["SENTRY_DSN"],
        why: "Captures and reports runtime errors, unhandled exceptions, and performance issues in both server and client. Critical for diagnosing production bugs.",
        howToConnect: [
          "Create a project at https://sentry.io",
          "Navigate to Settings → Projects → [Your Project] → Client Keys (DSN)",
          "Copy the DSN string",
          "Set SENTRY_DSN in your .env file",
        ],
        required: false,
        docsUrl: "https://docs.sentry.io/platforms/node/",
      },
      {
        name: "BetterStack Uptime",
        endpoint: "https://uptime.betterstack.com/api/v2/monitors/{id}",
        envVars: ["BETTERSTACK_API_KEY", "BETTERSTACK_MONITOR_ID"],
        why: "Monitors website uptime and alerts you when the site goes down. Status is displayed on the admin dashboard for quick visibility.",
        howToConnect: [
          "Sign up at https://betterstack.com",
          "Create a monitor pointing to your /api/health endpoint",
          "Generate an API token in Settings → API tokens",
          "Set BETTERSTACK_API_KEY and BETTERSTACK_MONITOR_ID",
        ],
        required: false,
        docsUrl: "https://betterstack.com/docs/uptime/api/getting-started/",
      },
    ],
  },
  {
    title: "Image Storage",
    icon: <Image className="w-5 h-5" />,
    color: "text-cyan-400",
    services: [
      {
        name: "Cloudinary",
        endpoint: "https://res.cloudinary.com (CDN) + Upload API",
        envVars: ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_URL", "VITE_CLOUDINARY_CLOUD_NAME"],
        why: "Stores and serves all product images, tour photos, and assets. Provides automatic image optimization, resizing, and CDN delivery for fast page loads.",
        howToConnect: [
          "Sign up at https://cloudinary.com",
          "Navigate to Settings → Access Keys",
          "Copy Cloud Name, API Key, and API Secret",
          "Set all CLOUDINARY_* variables in .env",
          "Set VITE_CLOUDINARY_CLOUD_NAME to the same cloud name (client-side access)",
        ],
        required: true,
        docsUrl: "https://cloudinary.com/documentation/node_quickstart",
      },
    ],
  },
  {
    title: "Reviews & Social Proof",
    icon: <Star className="w-5 h-5" />,
    color: "text-yellow-400",
    services: [
      {
        name: "Trustpilot TrustBox Widget",
        endpoint: "https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js",
        envVars: ["VITE_TRUSTPILOT_BU_ID", "VITE_TRUSTPILOT_URL"],
        why: "Displays verified Trustpilot reviews on product pages as social proof. Builds customer trust and can improve conversion rates.",
        howToConnect: [
          "Claim your business at https://business.trustpilot.com",
          "Find your Business Unit ID in the URL of your Trustpilot page",
          "Set VITE_TRUSTPILOT_BU_ID and VITE_TRUSTPILOT_URL in .env",
        ],
        required: false,
        docsUrl: "https://support.trustpilot.com/hc/en-us/articles/115011421468",
      },
      {
        name: "Google Places API",
        endpoint: "https://maps.googleapis.com/maps/api/place/details/json",
        envVars: ["GOOGLE_PLACES_API_KEY", "GOOGLE_PLACE_ID"],
        why: "Fetches your business's Google reviews and displays them on the website. Provides additional social proof alongside internal and Trustpilot reviews.",
        howToConnect: [
          "Go to https://console.cloud.google.com → APIs & Services → Credentials",
          "Create an API key and enable the Places API",
          "Find your Place ID using Google's Place ID Finder",
          "Set GOOGLE_PLACES_API_KEY and GOOGLE_PLACE_ID in .env",
        ],
        required: false,
        docsUrl: "https://developers.google.com/maps/documentation/places/web-service/overview",
      },
    ],
  },
  {
    title: "Maps",
    icon: <Map className="w-5 h-5" />,
    color: "text-green-400",
    services: [
      {
        name: "Google Maps Embed API",
        endpoint: "https://www.google.com/maps/embed/v1/place",
        envVars: ["VITE_GOOGLE_MAPS_EMBED_KEY"],
        why: "Embeds interactive Google Maps on tour and transfer detail pages showing the meeting/pickup point. Helps customers find the departure location.",
        howToConnect: [
          "Go to https://console.cloud.google.com → APIs & Services",
          "Enable the Maps Embed API",
          "Create or reuse an API key (restrict to Maps Embed API + your domain)",
          "Set VITE_GOOGLE_MAPS_EMBED_KEY in .env",
        ],
        required: false,
        docsUrl: "https://developers.google.com/maps/documentation/embed/get-started",
      },
    ],
  },
  {
    title: "CDN & External Data",
    icon: <Globe className="w-5 h-5" />,
    color: "text-indigo-400",
    services: [
      {
        name: "jsDelivr (Currency Exchange Rates)",
        endpoint: "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/vuv.json",
        envVars: ["(none — public API)"],
        why: "Fetches live VUV exchange rates at startup for multi-currency pricing display. Allows tourists to see prices in USD, AUD, NZD, EUR, etc.",
        howToConnect: [
          "No configuration needed — this is a free, public API",
          "Rates are fetched automatically on server startup",
        ],
        required: false,
      },
      {
        name: "Google Fonts",
        endpoint: "https://fonts.googleapis.com / https://fonts.gstatic.com",
        envVars: ["(none — public CDN)"],
        why: "Serves web fonts (Inter, etc.) for consistent, professional typography across all browsers and devices.",
        howToConnect: ["No configuration needed — loaded automatically via CSS"],
        required: false,
      },
      {
        name: "Google Tag Manager",
        endpoint: "https://www.googletagmanager.com",
        envVars: ["Configured via Admin → Settings → Analytics"],
        why: "Enables analytics tracking (Google Analytics 4, conversion tracking) without code changes. Managed entirely through the admin dashboard.",
        howToConnect: [
          "Create a GTM container at https://tagmanager.google.com",
          "Copy the Container ID (GTM-XXXXXX)",
          "Enter it in Admin → Settings → Analytics → GTM Container ID",
        ],
        required: false,
        docsUrl: "https://tagmanager.google.com",
      },
    ],
  },
  {
    title: "Deployment Platforms",
    icon: <Server className="w-5 h-5" />,
    color: "text-slate-400",
    services: [
      {
        name: "Fly.io",
        endpoint: "Configured via fly.toml",
        envVars: ["fly.toml — app = ace-tours-vanuatu, region = syd"],
        why: "Container hosting platform. Deploys the app to Sydney (closest region to Vanuatu) with always-on containers for background workers.",
        howToConnect: [
          "Install flyctl: curl -L https://fly.io/install.sh | sh",
          "Run: fly auth login && fly deploy",
          "Set secrets: fly secrets set DATABASE_URL=... SMTP_PASS=...",
        ],
        required: false,
        docsUrl: "https://fly.io/docs/",
      },
      {
        name: "Render",
        endpoint: "Configured via render.yaml",
        envVars: ["render.yaml — web service configuration"],
        why: "Alternative PaaS deployment. Auto-builds from Git, includes health checks, and supports environment variable management through its dashboard.",
        howToConnect: [
          "Connect your GitHub repo at https://dashboard.render.com",
          "Render auto-detects render.yaml for configuration",
          "Fill in environment variables in the Render dashboard",
        ],
        required: false,
        docsUrl: "https://docs.render.com/",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Components                                                         */
/* ------------------------------------------------------------------ */

function ServiceCard({ service }: { service: ServiceEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden transition-all hover:border-primary/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-center gap-3 cursor-pointer"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground">{service.name}</span>
            {service.required ? (
              <span className="px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-red-500/15 text-red-400 border border-red-500/25 uppercase tracking-wider">Required</span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-muted text-muted-foreground border border-border uppercase tracking-wider">Optional</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 truncate">{service.endpoint}</p>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-border pt-4 animate-in fade-in duration-200">
          {/* Why */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              <Info className="w-3.5 h-3.5" /> Why This Service Is Needed
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">{service.why}</p>
          </div>

          {/* Env vars */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              <Shield className="w-3.5 h-3.5" /> Environment Variables
            </div>
            <div className="flex flex-wrap gap-1.5">
              {service.envVars.map((v) => (
                <code key={v} className="px-2 py-1 bg-muted rounded text-xs font-mono text-foreground/70">{v}</code>
              ))}
            </div>
          </div>

          {/* How to connect */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              <Zap className="w-3.5 h-3.5" /> How To Connect
            </div>
            <ol className="space-y-1.5">
              {service.howToConnect.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Docs link */}
          {service.docsUrl && (
            <a
              href={service.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Official Documentation →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function CategorySection({ category }: { category: ServiceCategory }) {
  return (
    <section>
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`${category.color}`}>{category.icon}</div>
        <h2 className="text-base font-bold text-foreground">{category.title}</h2>
        <span className="text-xs text-muted-foreground">({category.services.length})</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {category.services.map((s) => (
          <ServiceCard key={s.name} service={s} />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ExternalServicesPage() {
  const totalServices = SERVICE_CATEGORIES.reduce((sum, c) => sum + c.services.length, 0);
  const requiredServices = SERVICE_CATEGORIES.reduce(
    (sum, c) => sum + c.services.filter((s) => s.required).length, 0
  );

  return (
    <DashboardLayout type="admin">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">External Services Audit</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All third-party APIs, services, and endpoints integrated into this application.
            Click any service to see connection instructions.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{totalServices}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Total Services</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{requiredServices}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Required</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">{totalServices - requiredServices}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Optional</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{SERVICE_CATEGORIES.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Categories</div>
          </div>
        </div>

        {/* Required notice */}
        <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-foreground">Required Services</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              <strong>Neon PostgreSQL</strong>, <strong>SMTP (Gmail)</strong>, and <strong>Cloudinary</strong> are
              required for the application to function. All other services are optional and can be enabled as needed.
            </p>
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-8">
          {SERVICE_CATEGORIES.map((cat) => (
            <CategorySection key={cat.title} category={cat} />
          ))}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-4 border-t border-border">
          Last audited: April 2026 · All environment variables are configured in <code className="bg-muted px-1.5 py-0.5 rounded">.env</code>
        </div>
      </div>
    </DashboardLayout>
  );
}
