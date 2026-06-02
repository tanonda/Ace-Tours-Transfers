import { lazy, Suspense, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Switch, Route } from "wouter";
import { queryClient, ensureCsrfToken } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { CartProvider } from "@/lib/cart-context";
import { BookingStateProvider } from "@/lib/booking-state-context";
import { CurrencyProvider } from "@/lib/currency-context";
import { AuthProvider, ProtectedRoute, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { CMSProvider } from "@/lib/cms-context";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { NProgressRouter } from "@/components/nprogress-router";

// Coming soon gate — controlled via Admin Dashboard > Settings > Feature Flags
// Falls back to VITE_COMING_SOON env var if the DB flag hasn't been seeded yet.
const ENV_COMING_SOON = import.meta.env.VITE_COMING_SOON === "true";
const ComingSoon = lazy(() => import("@/pages/coming-soon"));

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
const Checkout = lazy(() => import("@/pages/checkout"));
const ManageBooking = lazy(() => import("@/pages/manage-booking"));
const Login = lazy(() => import("@/pages/login"));
const Register = lazy(() => import("@/pages/register"));
const NotFound = lazy(() => import("@/pages/not-found"));
const PrivacyPolicy = lazy(() => import("@/pages/privacy-policy"));
const TermsOfService = lazy(() => import("@/pages/terms-of-service"));
const TourDetail = lazy(() => import("@/pages/tour-detail"));
const TransferDetail = lazy(() => import("@/pages/transfer-detail"));
const Confirmation = lazy(() => import("@/pages/confirmation"));
const FAQ = lazy(() => import("@/pages/faq"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const LandingPage = lazy(() => import("@/pages/landing-page"));
const Blog = lazy(() => import("@/pages/blog"));
const BlogArticle = lazy(() => import("@/pages/blog-article"));

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
const AdminProfile = lazy(() => import("@/pages/admin/admin-profile"));
const AdminExternalServices = lazy(() => import("@/pages/admin/external-services"));

// Customer pages
const CustomerDashboard = lazy(() => import("@/pages/customer/dashboard"));
const CustomerBookings = lazy(() => import("@/pages/customer/bookings"));
const CustomerSaved = lazy(() => import("@/pages/customer/saved"));
const CustomerProfile = lazy(() => import("@/pages/customer/profile"));

// Field Service pages
const FieldServiceDashboard = lazy(() => import("@/pages/field-service/field-service-dashboard"));

// I: Dynamically inject GA4 / GTM scripts from CMS settings (both are 100% free)
function AnalyticsInjector() {
  useEffect(() => {
    fetch("/api/public/analytics-config")
      .then(r => r.json())
      .then(({ ga4MeasurementId, gtmContainerId }) => {
        const normalizedGtmContainerId = typeof gtmContainerId === "string" ? gtmContainerId.trim() : "";
        const normalizedGa4MeasurementId = typeof ga4MeasurementId === "string" ? ga4MeasurementId.trim() : "";

        // Validate ID formats to prevent XSS via malicious analytics config
        const gtmPattern = /^GTM-[A-Z0-9]{1,10}$/;
        const ga4Pattern = /^G-[A-Z0-9]{1,15}$/;

        // Google Tag Manager
        if (normalizedGtmContainerId && gtmPattern.test(normalizedGtmContainerId) && !document.getElementById("gtm-script")) {
          const s = document.createElement("script");
          s.id = "gtm-script";
          s.textContent = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${normalizedGtmContainerId}');`;
          document.head.appendChild(s);
        }
        // GA4 (only if GTM not set — avoid double-counting)
        if (normalizedGa4MeasurementId && ga4Pattern.test(normalizedGa4MeasurementId) && !normalizedGtmContainerId && !document.getElementById("ga4-script")) {
          const s = document.createElement("script");
          s.id = "ga4-script";
          s.async = true;
          s.src = `https://www.googletagmanager.com/gtag/js?id=${normalizedGa4MeasurementId}`;
          document.head.appendChild(s);
          const s2 = document.createElement("script");
          s2.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${normalizedGa4MeasurementId}');`;
          document.head.appendChild(s2);
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
  const { isStaff, isLoading } = useAuth();

  // Fetch the coming-soon feature flag from the DB (no auth required).
  // Falls back gracefully to the env var if the flag isn't seeded yet.
  const { data: flags = [], isLoading: isFlagsLoading } = useQuery<{ slug: string; enabled: boolean }[]>({
    queryKey: ["feature-flags"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/feature-flags");
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch (e) {
        return [];
      }
    },
    staleTime: 30_000,
  });

  // Also fetch the launch date from settings to support auto-off
  const { data: settings = [], isLoading: isSettingsLoading } = useQuery<{ key: string; value: string }[]>({
    queryKey: ["site-settings-public"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch (e) {
        return [];
      }
    },
    staleTime: 60_000,
  });

  const launchDateVal = settings.find(s => s.key === 'launch_date')?.value;
  const isPastLaunchDate = launchDateVal ? new Date() >= new Date(`${launchDateVal}T00:00:00`) : false;

  const dbComingSoon = flags.find((f) => f.slug === "coming-soon")?.enabled;
  // If the DB flag exists use it; otherwise fall back to env var.
  // AUTO-OFF: If we're past the launch date, Coming Soon is always FALSE.
  const flagEnabled = dbComingSoon !== undefined ? dbComingSoon : ENV_COMING_SOON;
  const COMING_SOON = flagEnabled && !isPastLaunchDate;

  // While auth, flags or settings are loading, show nothing — avoids a flash of
  // the coming soon page for staff who are already logged in.
  if (isFlagsLoading || isSettingsLoading || (COMING_SOON && isLoading)) {
    return <Loader />;
  }

  // Coming soon is active AND the visitor is not staff/admin:
  // Show the coming soon page for all public routes, but still expose
  // /staff-access so they can log in.
  if (COMING_SOON && !isStaff) {
    return (
      <Suspense fallback={<Loader />}>
        <Switch>
          <Route path="/staff-access" component={Login} />
          <Route component={ComingSoon} />
        </Switch>
      </Suspense>
    );
  }

  // Staff/admin (or coming soon is off): render the full site.
  return (
    <Suspense fallback={<Loader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/tours" component={Tours} />
        <Route path="/tours/:id" component={TourDetail} />
        <Route path="/transfers" component={Transfers} />
        <Route path="/transfers/:id" component={TransferDetail} />
        <Route path="/about" component={About} />
        <Route path="/contact" component={Contact} />
        <Route path="/cart" component={Cart} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/payment" component={Payment} />
        <Route path="/payment/success" component={PaymentSuccess} />
        <Route path="/payment/cancel" component={PaymentCancel} />
        <Route path="/manage-booking" component={ManageBooking} />
        <Route path="/confirmation" component={Confirmation} />
        <Route path="/staff-access" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/terms-of-service" component={TermsOfService} />
        <Route path="/faq" component={FAQ} />
        <Route path="/blog" component={Blog} />
        <Route path="/blog/:slug" component={BlogArticle} />
        <Route path="/reset-password" component={ResetPassword} />

        {/* SEO category landing pages */}
        <Route path="/port-vila-airport-transfers" component={LandingPage} />
        <Route path="/efate-island-day-tours" component={LandingPage} />
        <Route path="/blue-lagoon-vanuatu-tour" component={LandingPage} />
        <Route path="/mele-cascades-tour" component={LandingPage} />
        <Route path="/vanuatu-cultural-tours" component={LandingPage} />
        <Route path="/port-vila-private-transfers" component={LandingPage} />

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
        <Route path="/admin/profile">
          <ProtectedRoute requireStaff><AdminProfile /></ProtectedRoute>
        </Route>
        <Route path="/admin/external-services">
          <ProtectedRoute requireAdmin><AdminExternalServices /></ProtectedRoute>
        </Route>

        {/* Field Service Routes */}
        <Route path="/field-service/dashboard">
          <ProtectedRoute requireStaff><FieldServiceDashboard /></ProtectedRoute>
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
  // Eagerly fetch CSRF token so it's ready for the first POST request
  useEffect(() => { ensureCsrfToken(); }, []);

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
