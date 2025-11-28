
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Tours from "@/pages/tours";
import Transfers from "@/pages/transfers";
import Payment from "@/pages/payment";
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
import CustomerDashboard from "@/pages/customer/dashboard";
import CustomerBookings from "@/pages/customer/bookings";
import CustomerSaved from "@/pages/customer/saved";
import CustomerProfile from "@/pages/customer/profile";
import { CartProvider } from "@/lib/cart-context";

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
      <Route path="/reservations" component={Reservations} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* Admin Routes */}
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/bookings" component={AdminBookings} />
      <Route path="/admin/tours" component={AdminTours} />
      <Route path="/admin/customers" component={AdminCustomers} />
      <Route path="/admin/settings" component={AdminSettings} />

      {/* Customer Routes */}
      <Route path="/dashboard" component={CustomerDashboard} />
      <Route path="/dashboard/bookings" component={CustomerBookings} />
      <Route path="/dashboard/saved" component={CustomerSaved} />
      <Route path="/dashboard/profile" component={CustomerProfile} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CartProvider>
          <Toaster />
          <Router />
        </CartProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
