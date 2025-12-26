import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Tours from "@/pages/tours";
import Transfers from "@/pages/transfers";
import Payment from "@/pages/payment";
import PaymentSuccess from "@/pages/payment-success";
import PaymentCancel from "@/pages/payment-cancel";
import About from "@/pages/about";
import Contact from "@/pages/contact";
import Cart from "@/pages/cart";
import Reservations from "@/pages/reservations";
import Login from "@/pages/login";
import Register from "@/pages/register";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminBookings from "@/pages/admin/bookings";
import AdminTours from "@/pages/admin/tours";
import AdminCustomers from "@/pages/admin/customers";
import AdminSettings from "@/pages/admin/settings";
import AdminAnalytics from "@/pages/admin/analytics";
import AdminReports from "@/pages/admin/reports";
import AdminPromotions from "@/pages/admin/promotions";
import AdminCalendar from "@/pages/admin/calendar";
import CustomerDashboard from "@/pages/customer/dashboard";
import CustomerBookings from "@/pages/customer/bookings";
import CustomerSaved from "@/pages/customer/saved";
import CustomerProfile from "@/pages/customer/profile";
import { CartProvider } from "@/lib/cart-context";
import { AuthProvider, ProtectedRoute } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { CMSProvider } from "@/lib/cms-context";
import { WhatsAppWidget } from "@/components/whatsapp-widget";

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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/tours" component={Tours} />
      <Route path="/transfers" component={Transfers} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route path="/cart" component={Cart} />
      <Route path="/payment" component={Payment} />
      <Route path="/payment/success" component={PaymentSuccess} />
      <Route path="/payment/cancel" component={PaymentCancel} />
      <Route path="/reservations" component={Reservations} />
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
          <AdminCustomers />
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
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <AuthProvider>
              <CMSProvider>
                <CartProvider>
                  <Toaster />
                  <Router />
                  <WhatsAppWidget />
                </CartProvider>
              </CMSProvider>
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
