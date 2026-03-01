import { lazy, Suspense, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { CartProvider } from "@/lib/cart-context";
import { BookingStateProvider } from "@/lib/booking-state-context";
import { CurrencyProvider } from "@/lib/currency-context";
import { AuthProvider, ProtectedRoute } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { CMSProvider } from "@/lib/cms-context";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { NProgressRouter } from "@/components/nprogress-router";

// Lazy-loaded pages
const Home = lazy(() => import("@/pages/home"));
const Tours = lazy(() => import("@/pages/tours"));
const Transfers = lazy(() => import("@/pages/transfers"));
const Payment = lazy(() => import("@/pages/payment"));
const PaymentSuccess = lazy(() => import("@/pages/payment-success"));
const PaymentCancel = lazy(() => import("@/pages/payment-cancel"));
const About = lazy(() => import("@/pages/about"));
const Contact = lazy(() => import("@/pages/contact"));
const Cart = lazy(() => import("@/pages/cart"));
const Reservations = lazy(() => import("@/pages/reservations"));
const ManageBooking = lazy(() => import("@/pages/manage-booking"));
const Login = lazy(() => import("@/pages/login"));
const Register = lazy(() => import("@/pages/register"));
const NotFound = lazy(() => import("@/pages/not-found"));
const PrivacyPolicy = lazy(() => import("@/pages/privacy-policy"));
const TourDetail = lazy(() => import("@/pages/tour-detail"));
const TransferDetail = lazy(() => import("@/pages/transfer-detail"));
const Vehicles = lazy(() => import("@/pages/vehicles"));
const VehicleDetail = lazy(() => import("@/pages/vehicle-detail"));
const Confirmation = lazy(() => import("@/pages/confirmation"));
const FAQ = lazy(() => import("@/pages/faq"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));

// Admin pages
const AdminDashboard = lazy(() => import("@/pages/admin/dashboard"));
const AdminBookings = lazy(() => import("@/pages/admin/bookings"));
const AdminProducts = lazy(() => import("@/pages/admin/products"));
const AdminUsers = lazy(() => import("@/pages/admin/users"));
const AdminSettings = lazy(() => import("@/pages/admin/settings"));
const AdminAnalytics = lazy(() => import("@/pages/admin/analytics"));
const AdminReports = lazy(() => import("@/pages/admin/reports"));
const AdminPromotions = lazy(() => import("@/pages/admin/promotions"));
const AdminCalendar = lazy(() => import("@/pages/admin/calendar"));
const AdminRecovery = lazy(() => import("@/pages/admin/recovery"));
const AdminStaff = lazy(() => import("@/pages/admin/staff"));
const AdminCMS = lazy(() => import("@/pages/admin/cms"));
const AdminReconciliation = lazy(() => import("@/pages/admin/reconciliation"));
const AdminPayments = lazy(() => import("@/pages/admin/payments"));
// Previously missing admin pages — now routed
const AdminPricing = lazy(() => import("@/pages/admin/pricing"));
const AdminBlackouts = lazy(() => import("@/pages/admin/blackouts"));
const AdminCapacity = lazy(() => import("@/pages/admin/capacity-dashboard"));
const AdminAuditLogs = lazy(() => import("@/pages/admin/audit-logs"));
const AdminReviews = lazy(() => import("@/pages/admin/reviews"));
const AdminFraud = lazy(() => import("@/pages/admin/fraud"));
const AdminNewsletter = lazy(() => import("@/pages/admin/newsletter"));
const AdminNotifications = lazy(() => import("@/pages/admin/notifications"));

// Customer pages
const CustomerDashboard = lazy(() => import("@/pages/customer/dashboard"));
const CustomerBookings = lazy(() => import("@/pages/customer/bookings"));
const CustomerSaved = lazy(() => import("@/pages/customer/saved"));
const CustomerProfile = lazy(() => import("@/pages/customer/profile"));


function isScriptSourceAllowedByCsp(url: string) {
  const cspTag = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  const cspContent = cspTag?.getAttribute("content");
  if (!cspContent) {
    return true;
  }

  const directives = cspContent
    .split(";")
    .map((directive) => directive.trim())
    .filter(Boolean);

  const scriptDirective = directives.find((directive) => directive.startsWith("script-src"));
  if (!scriptDirective) {
    return true;
  }

  const [, ...sources] = scriptDirective.split(/\s+/);
  if (sources.includes("*")) {
    return true;
  }

  if (sources.includes("'self'")) {
    if (url.startsWith(window.location.origin) || url.startsWith("/")) {
      return true;
    }
  }

  try {
    const target = new URL(url, window.location.origin);
    return sources.some((source) => {
      const cleaned = source.replace(/^'+|'+$/g, "");
      if (cleaned === target.origin || cleaned === target.host) {
        return true;
      }
      if (cleaned.startsWith("https://") || cleaned.startsWith("http://")) {
        return target.href.startsWith(cleaned);
      }
      return false;
    });
  } catch {
    return false;
  }
}

// I: Dynamically inject GA4 / GTM scripts from CMS settings (both are 100% free)
function AnalyticsInjector() {
  useEffect(() => {
    fetch("/api/public/analytics-config")
      .then(r => r.json())
      .then(({ ga4MeasurementId, gtmContainerId }) => {
        const normalizedGtmContainerId = typeof gtmContainerId === "string" ? gtmContainerId.trim() : "";
        const normalizedGa4MeasurementId = typeof ga4MeasurementId === "string" ? ga4MeasurementId.trim() : "";

        const gtmScriptUrl = `https://www.googletagmanager.com/gtm.js?id=${normalizedGtmContainerId}`;
        const ga4ScriptUrl = `https://www.googletagmanager.com/gtag/js?id=${normalizedGa4MeasurementId}`;

        // Google Tag Manager
        if (normalizedGtmContainerId && !document.getElementById("gtm-script") && isScriptSourceAllowedByCsp(gtmScriptUrl)) {
          (window as Window & { dataLayer?: unknown[] }).dataLayer = (window as Window & { dataLayer?: unknown[] }).dataLayer || [];
          (window as Window & { dataLayer?: unknown[] }).dataLayer?.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });

          const gtmScript = document.createElement("script");
          gtmScript.id = "gtm-script";
          gtmScript.async = true;
          gtmScript.src = gtmScriptUrl;
          document.head.appendChild(gtmScript);
        }

        // GA4 (only if GTM not set — avoid double-counting)
        if (normalizedGa4MeasurementId && !normalizedGtmContainerId && !document.getElementById("ga4-script") && isScriptSourceAllowedByCsp(ga4ScriptUrl)) {
          const ga4Script = document.createElement("script");
          ga4Script.id = "ga4-script";
          ga4Script.async = true;
          ga4Script.src = ga4ScriptUrl;
          document.head.appendChild(ga4Script);

          const dataLayerWindow = window as Window & {
            dataLayer?: unknown[];
            gtag?: (...args: unknown[]) => void;
          };
          dataLayerWindow.dataLayer = dataLayerWindow.dataLayer || [];
          dataLayerWindow.gtag = (...args: unknown[]) => {
            dataLayerWindow.dataLayer?.push(args);
          };
          dataLayerWindow.gtag("js", new Date());
          dataLayerWindow.gtag("config", normalizedGa4MeasurementId);
        }
      })
      .catch(() => { }); // fail silently — analytics is non-critical
  }, []);
  return null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event.error && !(event.error instanceof Error)) {
      event.preventDefault();
      console.warn('Non-Error exception caught:', event.error);
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && !(event.reason instanceof Error)) {
      event.preventDefault();
      console.warn('Non-Error rejection caught:', event.reason);
    }
  });
}

const Loader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

function Router() {
  return (
    <Suspense fallback={<Loader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/tours" component={Tours} />
        <Route path="/tours/:id" component={TourDetail} />
        <Route path="/transfers" component={Transfers} />
        <Route path="/transfers/:id" component={TransferDetail} />
        <Route path="/vehicles" component={Vehicles} />
        <Route path="/vehicles/:id" component={VehicleDetail} />
        <Route path="/about" component={About} />
        <Route path="/contact" component={Contact} />
        <Route path="/cart" component={Cart} />
        <Route path="/payment" component={Payment} />
        <Route path="/payment/success" component={PaymentSuccess} />
        <Route path="/payment/cancel" component={PaymentCancel} />
        <Route path="/reservations" component={Reservations} />
        <Route path="/manage-booking" component={ManageBooking} />
        <Route path="/confirmation" component={Confirmation} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/faq" component={FAQ} />
        <Route path="/reset-password" component={ResetPassword} />

        {/* Admin Routes - Protected */}
        <Route path="/admin/dashboard">
          <ProtectedRoute requireStaff><AdminDashboard /></ProtectedRoute>
        </Route>
        <Route path="/admin/bookings">
          <ProtectedRoute requireStaff><AdminBookings /></ProtectedRoute>
        </Route>
        <Route path="/admin/products">
          <ProtectedRoute requireAdmin><AdminProducts /></ProtectedRoute>
        </Route>
        <Route path="/admin/customers">
          <ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>
        </Route>
        <Route path="/admin/settings">
          <ProtectedRoute requireAdmin><AdminSettings /></ProtectedRoute>
        </Route>
        <Route path="/admin/analytics">
          <ProtectedRoute requireAdmin><AdminAnalytics /></ProtectedRoute>
        </Route>
        <Route path="/admin/reports">
          <ProtectedRoute requireAdmin><AdminReports /></ProtectedRoute>
        </Route>
        <Route path="/admin/promotions">
          <ProtectedRoute requireAdmin><AdminPromotions /></ProtectedRoute>
        </Route>
        <Route path="/admin/calendar">
          <ProtectedRoute requireStaff><AdminCalendar /></ProtectedRoute>
        </Route>
        <Route path="/admin/recovery">
          <ProtectedRoute requireAdmin><AdminRecovery /></ProtectedRoute>
        </Route>
        <Route path="/admin/staff">
          <ProtectedRoute requireAdmin><AdminStaff /></ProtectedRoute>
        </Route>
        <Route path="/admin/cms">
          <ProtectedRoute requireAdmin><AdminCMS /></ProtectedRoute>
        </Route>
        <Route path="/admin/reconciliation">
          <ProtectedRoute requireAdmin><AdminReconciliation /></ProtectedRoute>
        </Route>
        <Route path="/admin/payments">
          <ProtectedRoute requireAdmin><AdminPayments /></ProtectedRoute>
        </Route>
        {/* Availability management routes */}
        <Route path="/admin/pricing">
          <ProtectedRoute requireAdmin><AdminPricing /></ProtectedRoute>
        </Route>
        <Route path="/admin/blackouts">
          <ProtectedRoute requireAdmin><AdminBlackouts /></ProtectedRoute>
        </Route>
        <Route path="/admin/capacity">
          <ProtectedRoute requireAdmin><AdminCapacity /></ProtectedRoute>
        </Route>
        <Route path="/admin/audit-logs">
          <ProtectedRoute requireAdmin><AdminAuditLogs /></ProtectedRoute>
        </Route>
        <Route path="/admin/reviews">
          <ProtectedRoute requireAdmin><AdminReviews /></ProtectedRoute>
        </Route>
        <Route path="/admin/fraud">
          <ProtectedRoute requireAdmin><AdminFraud /></ProtectedRoute>
        </Route>
        <Route path="/admin/newsletter">
          <ProtectedRoute requireAdmin><AdminNewsletter /></ProtectedRoute>
        </Route>
        <Route path="/admin/notifications">
          <ProtectedRoute requireAdmin><AdminNotifications /></ProtectedRoute>
        </Route>

        {/* Customer Routes - Protected */}
        <Route path="/dashboard">
          <ProtectedRoute><CustomerDashboard /></ProtectedRoute>
        </Route>
        <Route path="/customer/dashboard">
          <ProtectedRoute><CustomerDashboard /></ProtectedRoute>
        </Route>
        <Route path="/dashboard/bookings">
          <ProtectedRoute><CustomerBookings /></ProtectedRoute>
        </Route>
        <Route path="/customer/bookings">
          <ProtectedRoute><CustomerBookings /></ProtectedRoute>
        </Route>
        <Route path="/dashboard/saved">
          <ProtectedRoute><CustomerSaved /></ProtectedRoute>
        </Route>
        <Route path="/dashboard/profile">
          <ProtectedRoute><CustomerProfile /></ProtectedRoute>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <TooltipProvider>
              <AuthProvider>
                <CMSProvider>
                  <CurrencyProvider>
                    <CartProvider>
                      <BookingStateProvider>
                        <Toaster />
                        <AnalyticsInjector />
                        <NProgressRouter />
                        <Router />
                        <WhatsAppWidget />
                      </BookingStateProvider>
                    </CartProvider>
                  </CurrencyProvider>
                </CMSProvider>
              </AuthProvider>
            </TooltipProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;
