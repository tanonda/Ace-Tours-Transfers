import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { CartProvider } from "@/lib/cart-context";
import { BookingStateProvider } from "@/lib/booking-state-context";
import { AuthProvider, ProtectedRoute } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { CMSProvider } from "@/lib/cms-context";
import { WhatsAppWidget } from "@/components/whatsapp-widget";

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
const Login = lazy(() => import("@/pages/login"));
const Register = lazy(() => import("@/pages/register"));
const NotFound = lazy(() => import("@/pages/not-found"));
const TourDetail = lazy(() => import("@/pages/tour-detail"));
const TransferDetail = lazy(() => import("@/pages/transfer-detail"));
const Vehicles = lazy(() => import("@/pages/vehicles"));
const VehicleDetail = lazy(() => import("@/pages/vehicle-detail"));
const Confirmation = lazy(() => import("@/pages/confirmation"));

// Admin pages
const AdminDashboard = lazy(() => import("@/pages/admin/dashboard"));
const AdminBookings = lazy(() => import("@/pages/admin/bookings"));
const AdminTours = lazy(() => import("@/pages/admin/tours"));
const AdminUsers = lazy(() => import("@/pages/admin/users"));
const AdminSettings = lazy(() => import("@/pages/admin/settings"));
const AdminAnalytics = lazy(() => import("@/pages/admin/analytics"));
const AdminReports = lazy(() => import("@/pages/admin/reports"));
const AdminPromotions = lazy(() => import("@/pages/admin/promotions"));
const AdminCalendar = lazy(() => import("@/pages/admin/calendar"));
const AdminRecovery = lazy(() => import("@/pages/admin/recovery"));
const AdminStaff = lazy(() => import("@/pages/admin/staff"));
const AdminCMS = lazy(() => import("@/pages/admin/cms"));
const AdminPayments = lazy(() => import("@/pages/admin/payments"));

// Customer pages
const CustomerDashboard = lazy(() => import("@/pages/customer/dashboard"));
const CustomerBookings = lazy(() => import("@/pages/customer/bookings"));
const CustomerSaved = lazy(() => import("@/pages/customer/saved"));
const CustomerProfile = lazy(() => import("@/pages/customer/profile"));

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
        <Route path="/confirmation" component={Confirmation} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />

        {/* Admin Routes - Protected */}
        <Route path="/admin/dashboard">
          <ProtectedRoute requireAdmin>
            <AdminDashboard />
          </ProtectedRoute>
        </Route>
        <Route path="/admin/bookings">
          <ProtectedRoute requireAdmin>
            <AdminBookings />
          </ProtectedRoute>
        </Route>
        <Route path="/admin/tours">
          <ProtectedRoute requireAdmin>
            <AdminTours />
          </ProtectedRoute>
        </Route>
        <Route path="/admin/customers">
          <ProtectedRoute requireAdmin>
            <AdminUsers />
          </ProtectedRoute>
        </Route>
        <Route path="/admin/settings">
          <ProtectedRoute requireAdmin>
            <AdminSettings />
          </ProtectedRoute>
        </Route>
        <Route path="/admin/analytics">
          <ProtectedRoute requireAdmin>
            <AdminAnalytics />
          </ProtectedRoute>
        </Route>
        <Route path="/admin/reports">
          <ProtectedRoute requireAdmin>
            <AdminReports />
          </ProtectedRoute>
        </Route>
        <Route path="/admin/promotions">
          <ProtectedRoute requireAdmin>
            <AdminPromotions />
          </ProtectedRoute>
        </Route>
        <Route path="/admin/calendar">
          <ProtectedRoute requireAdmin>
            <AdminCalendar />
          </ProtectedRoute>
        </Route>
        <Route path="/admin/recovery">
          <ProtectedRoute requireAdmin>
            <AdminRecovery />
          </ProtectedRoute>
        </Route>
        <Route path="/admin/staff">
          <ProtectedRoute requireAdmin>
            <AdminStaff />
          </ProtectedRoute>
        </Route>
        <Route path="/admin/cms">
          <ProtectedRoute requireAdmin>
            <AdminCMS />
          </ProtectedRoute>
        </Route>
        <Route path="/admin/payments">
          <ProtectedRoute requireAdmin>
            <AdminPayments />
          </ProtectedRoute>
        </Route>

        {/* Customer Routes - Protected */}
        <Route path="/dashboard">
          <ProtectedRoute>
            <CustomerDashboard />
          </ProtectedRoute>
        </Route>
        <Route path="/customer/dashboard">
          <ProtectedRoute>
            <CustomerDashboard />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/bookings">
          <ProtectedRoute>
            <CustomerBookings />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/saved">
          <ProtectedRoute>
            <CustomerSaved />
          </ProtectedRoute>
        </Route>
        <Route path="/dashboard/profile">
          <ProtectedRoute>
            <CustomerProfile />
          </ProtectedRoute>
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
                  <CartProvider>
                    <BookingStateProvider>
                      <Toaster />
                      <Router />
                      <WhatsAppWidget />
                    </BookingStateProvider>
                  </CartProvider>
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
