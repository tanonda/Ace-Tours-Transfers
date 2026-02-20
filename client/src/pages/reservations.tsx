
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCart } from "@/lib/cart-context";
import {
  Calendar as CalendarIcon, Loader2, ClipboardList,
  Trash2, Search, PlusCircle, History, ShoppingBag,
  CheckCircle, XCircle, AlertCircle, Sparkles, ArrowRight,
  Package, MapPin, Users, CreditCard
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/theme-toggle";
import { BookingForm, bookingFormSchema } from "@/components/booking-form";
import { z } from "zod";
import { fetchTours } from "@/lib/api";

type Booking = {
  id: string;
  customerName: string;
  customerEmail: string;
  tourName: string;
  date: string;
  guests: number;
  amount: number | string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  createdAt: string;
};


export default function Reservations() {
  const { t } = useTranslation();
  const { itemCount, items, removeFromCart, total, clearCart } = useCart();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [location] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [isBookingLoading, setIsBookingLoading] = useState(false);

  // Memoized initial values from URL parameters
  const initialValues = useMemo(() => {
    const searchParams = new URL(window.location.href).searchParams;
    const preselectedService = searchParams.get("service") || "";
    const preselectedAdults = searchParams.get("adults") || "2";
    const preselectedChildren = searchParams.get("children") || "0";
    const preselectedDate = searchParams.get("date");

    return {
      name: user?.name || "",
      email: user?.email || "",
      service: preselectedService,
      adultPax: preselectedAdults,
      childPax: preselectedChildren,
      date: preselectedDate ? new Date(preselectedDate) : undefined,
    };
  }, [user?.name, user?.email]);

  const initialTab = useMemo(() => {
    const searchParams = new URL(window.location.href).searchParams;
    return searchParams.get("tab") || (isAdmin ? "my-reservations" : "book-new");
  }, [isAuthenticated]);

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: allServices = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["tours"],
    queryFn: fetchTours,
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ["bookings", user?.id, isAdmin],
    queryFn: async () => {
      const url = isAdmin ? "/api/bookings" : `/api/bookings/user/${user?.id}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthenticated && !!user?.id,
  });

  const bookingServices = useMemo(() => {
    return allServices
      .filter(s => {
        const titleLower = (s.title || "").toLowerCase();
        const isTest = titleLower.includes("verification") ||
          titleLower.includes("concurrent") ||
          titleLower.includes("test_tour") ||
          titleLower.includes("test") ||
          titleLower.includes("phase4") ||
          s.image === "test.jpg" ||
          s.image === "/test.jpg";
        return !isTest;
      })
      .map(s => ({
        id: s.id,
        title: s.title,
        category: s.category
      }));
  }, [allServices]);


  const getServiceIdFromTitle = useCallback((title: string) => {
    const service = allServices.find(s => s.title === title);
    return service?.id;
  }, [allServices]);

  const updateBookingMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({ title: t("dashboard.bookingUpdated"), description: t("dashboard.bookingUpdatedDesc") });
    },
    onError: () => {
      toast({ title: t("dashboard.updateFailed"), variant: "destructive" });
    },
  });

  const handleAvailabilityCheck = useCallback(async (
    serviceTitle: string,
    date: Date,
    adultPax: number,
    childPax: number,
    startTime?: string,
    endTime?: string
  ) => {
    setIsCheckingAvailability(true);
    setIsAvailable(null);
    setAvailabilityMessage("");

    const serviceId = getServiceIdFromTitle(serviceTitle);
    if (!serviceId) {
      setAvailabilityMessage("Selected service not found.");
      setIsAvailable(false);
      setIsCheckingAvailability(false);
      return;
    }

    try {
      const response = await fetch('/api/availability/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          date: format(date, "yyyy-MM-dd"),
          adultPax,
          childPax,
          startTime,
          endTime,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to check availability.");
      }

      const result = await response.json();
      setIsAvailable(result.isAvailable);
      setAvailabilityMessage(result.message);
    } catch (error) {
      setIsAvailable(false);
      setAvailabilityMessage(error instanceof Error ? error.message : "Error checking availability.");
    } finally {
      setIsCheckingAvailability(false);
    }
  }, [getServiceIdFromTitle]);


  async function onBookingSubmit(values: z.infer<typeof bookingFormSchema>) {
    if (isAvailable === null || isAvailable === false) {
      toast({
        title: "Booking Not Possible",
        description: availabilityMessage || "Please check availability before booking.",
        variant: "destructive"
      });
      return;
    }

    setIsBookingLoading(true);
    try {
      const selectedTour = allServices.find(t => t.title === values.service);

      let holdId = null;
      if (selectedTour) {
        try {
          const holdRes = await fetch("/api/holds", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tourId: selectedTour.id,
              date: format(values.date, "yyyy-MM-dd"),
              quantity: parseInt(values.adultPax)
            }),
          });
          if (holdRes.ok) {
            const hold = await holdRes.json();
            holdId = hold.id;
          }
        } catch (holdError) {
          console.warn("Failed to create hold, proceeding without one:", holdError);
        }
      }

      const bookingData = {
        customerName: values.name,
        customerEmail: values.email,
        items: [{
          productId: selectedTour?.id || "",
          adultPax: parseInt(values.adultPax),
          childPax: parseInt(values.childPax),
          date: format(values.date, "yyyy-MM-dd"),
          startTime: undefined,
          endTime: undefined,
        }],
        pickupLocation: values.pickupLocation || null,
      };

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(bookingData),
      });

      if (res.ok) {
        const booking = await res.json();
        queryClient.invalidateQueries({ queryKey: ["bookings"] });
        // NOTE: No toast here — the booking is only "pending" at this point.
        // Confirmation only happens after payment is received and processed.
        // The success page (payment/success) is the right place for a confirmation message.
        // Store booking data for payment page handoff (avoids re-fetch auth issues)
        try {
          sessionStorage.setItem('checkout_booking', JSON.stringify({
            ...booking,
            // Include the form data that may not be in the API response
            tourName: values.service,
            notes: values.notes || null,
            pickupLocation: values.pickupLocation || null,
            adultPaxTotal: parseInt(values.adultPax),
            childPaxTotal: parseInt(values.childPax),
          }));
        } catch (e) { /* sessionStorage unavailable — payment page will fetch from API */ }
        window.location.href = `/payment?bookingId=${booking.id}`;
      } else {
        const error = await res.json();
        throw new Error(error.error || "Failed to create booking");
      }
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message || t("reservations.bookingFailed"), variant: "destructive" });
    } finally {
      setIsBookingLoading(false);
    }
  }

  const filteredBookings = bookings.filter(b => {
    const matchesStatus = statusFilter === "all" || b.status === statusFilter;
    const matchesSearch = searchQuery === "" ||
      b.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.tourName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      pending: { variant: "secondary", icon: <AlertCircle className="h-3 w-3" /> },
      confirmed: { variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
      completed: { variant: "outline", icon: <CheckCircle className="h-3 w-3" /> },
      cancelled: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
    };
    const config = variants[status] || variants.pending;
    return (
      <Badge variant={config.variant} className="gap-1 capitalize">
        {config.icon} {t(`booking.${status}`)}
      </Badge>
    );
  };

  const handleCheckout = () => { window.location.href = "/payment"; };

  return (
    <Layout>
      <div className="min-h-screen pt-40 md:pt-44 pb-20 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/3 pointer-events-none" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/3 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          {/* Hero Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              {t("reservations.tagline", "Your adventure starts here")}
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold mb-4 bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text">
              {t("reservations.title", "Book Your Experience")}
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto text-base md:text-lg">
              {isAdmin
                ? t("reservations.adminDesc", "Manage all bookings and reservations")
                : t("reservations.guestDesc", "Choose from our curated island tours and premium transfers. Secure your spot today.")}
            </p>
          </div>

          <div className="max-w-7xl mx-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex justify-center mb-10">
                <TabsList className="inline-flex h-12 p-1.5 bg-background/80 backdrop-blur-sm border border-border/50 shadow-lg rounded-2xl">
                  {isAdmin && (
                    <TabsTrigger
                      value="my-reservations"
                      className="gap-2 px-5 py-2.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200"
                    >
                      <History className="h-4 w-4" />
                      <span className="hidden sm:inline font-medium">{t("reservations.myReservations")}</span>
                    </TabsTrigger>
                  )}
                  <TabsTrigger
                    value="book-new"
                    className="gap-2 px-5 py-2.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200"
                  >
                    <PlusCircle className="h-4 w-4" />
                    <span className="hidden sm:inline font-medium">{t("reservations.newBooking")}</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="cart"
                    className="gap-2 px-5 py-2.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200 relative"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    <span className="hidden sm:inline font-medium">{t("cart.title")}</span>
                    {itemCount > 0 && (
                      <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs animate-in zoom-in-50 duration-200">
                        {itemCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* ──── Admin Reservations Tab ──── */}
              {isAdmin && (
                <TabsContent value="my-reservations" className="animate-in fade-in-50 duration-300">
                  <Card className="border-border/50 shadow-xl bg-card/80 backdrop-blur-sm">
                    <CardHeader className="pb-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <CardTitle className="flex items-center gap-2 text-xl">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <ClipboardList className="h-5 w-5 text-primary" />
                          </div>
                          {t("reservations.allReservations")}
                        </CardTitle>
                        <div className="flex flex-wrap gap-2">
                          <Input
                            placeholder={t("common.searchPlaceholder")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full md:w-64 bg-background/50"
                          />
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[140px] bg-background/50">
                              <SelectValue placeholder={t("dashboard.allStatuses")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">{t("dashboard.allStatuses")}</SelectItem>
                              <SelectItem value="pending">{t("booking.pending")}</SelectItem>
                              <SelectItem value="confirmed">{t("booking.confirmed")}</SelectItem>
                              <SelectItem value="completed">{t("booking.completed")}</SelectItem>
                              <SelectItem value="cancelled">{t("booking.cancelled")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {bookingsLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("booking.id")}</TableHead>
                              <TableHead>{t("booking.customer")}</TableHead>
                              <TableHead>{t("booking.tour")}</TableHead>
                              <TableHead>{t("booking.date")}</TableHead>
                              <TableHead>{t("booking.status")}</TableHead>
                              {isAdmin && <TableHead className="text-right">{t("common.actions")}</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredBookings.map((booking) => (
                              <TableRow key={booking.id}>
                                <TableCell className="font-mono text-sm">#{booking.id.slice(0, 8)}</TableCell>
                                <TableCell>{booking.customerName}</TableCell>
                                <TableCell>{booking.tourName}</TableCell>
                                <TableCell>{format(new Date(booking.date), "MMM d, yyyy")}</TableCell>
                                <TableCell>{getStatusBadge(booking.status)}</TableCell>
                                {isAdmin && (
                                  <TableCell className="text-right">
                                    {booking.status === "pending" && (
                                      <div className="flex justify-end gap-2">
                                        <Button size="sm" onClick={() => updateBookingMutation.mutate({ id: booking.id, status: "confirmed" })}>Confirm</Button>
                                        <Button size="sm" variant="destructive" onClick={() => updateBookingMutation.mutate({ id: booking.id, status: "cancelled" })}>Cancel</Button>
                                      </div>
                                    )}
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* ──── New Booking Tab ──── */}
              <TabsContent value="book-new" className="animate-in fade-in-50 duration-300">
                {/* Features Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-card/80 backdrop-blur-sm border border-border/30 shadow-sm">
                    <div className="p-2 rounded-lg bg-green-500/10 shrink-0">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{t("reservations.instantConfirmation", "Instant Confirmation")}</p>
                      <p className="text-xs text-muted-foreground">{t("reservations.instantConfirmationDesc", "Booking confirmation sent via email")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-card/80 backdrop-blur-sm border border-border/30 shadow-sm">
                    <div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{t("reservations.flexibleParty", "Flexible Party Size")}</p>
                      <p className="text-xs text-muted-foreground">{t("reservations.flexiblePartyDesc", "Individuals, couples, and groups")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-card/80 backdrop-blur-sm border border-border/30 shadow-sm">
                    <div className="p-2 rounded-lg bg-amber-500/10 shrink-0">
                      <MapPin className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{t("reservations.hotelPickup", "Hotel Pickup Included")}</p>
                      <p className="text-xs text-muted-foreground">{t("reservations.hotelPickupDesc", "Complimentary pickup in Port Vila")}</p>
                    </div>
                  </div>
                </div>

                {/* Full-width Booking Form — form has its own sidebar summary */}
                <BookingForm
                  onSubmit={onBookingSubmit}
                  isLoading={isBookingLoading}
                  submitButtonText={t("reservations.proceedToPayment")}
                  onAvailabilityCheck={handleAvailabilityCheck}
                  isAvailable={isAvailable}
                  availabilityMessage={availabilityMessage}
                  isCheckingAvailability={isCheckingAvailability}
                  services={bookingServices}
                  initialValues={initialValues}
                />

                {/* Manage existing booking CTA */}
                <div className="mt-8 text-center">
                  <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/30 shadow-sm">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {t("reservations.existingBooking", "Have an existing booking?")}
                    </span>
                    <Link href="/manage-booking">
                      <Button variant="outline" size="sm" className="group">
                        {t("reservations.manageBooking", "Manage Booking")}
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </TabsContent>

              {/* ──── Cart Tab ──── */}
              <TabsContent value="cart" className="animate-in fade-in-50 duration-300">
                <div className="max-w-3xl mx-auto">
                  {items.length === 0 ? (
                    /* Empty Cart State */
                    <Card className="border-border/50 shadow-xl bg-card/80 backdrop-blur-sm">
                      <CardContent className="py-16">
                        <div className="text-center space-y-5">
                          <div className="mx-auto w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center">
                            <ShoppingBag className="h-10 w-10 text-muted-foreground/50" />
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold">{t("cart.emptyTitle", "Your cart is empty")}</h3>
                            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                              {t("cart.emptyDesc", "Browse our tours and transfers to find the perfect experience for your Vanuatu adventure.")}
                            </p>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                            <Link href="/tours">
                              <Button variant="outline" className="gap-2">
                                <Package className="h-4 w-4" />
                                {t("nav.tours", "Browse Tours")}
                              </Button>
                            </Link>
                            <Button onClick={() => setActiveTab("book-new")} className="gap-2">
                              <PlusCircle className="h-4 w-4" />
                              {t("reservations.newBooking")}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    /* Cart with items */
                    <div className="space-y-5">
                      <Card className="border-border/50 shadow-xl bg-card/80 backdrop-blur-sm overflow-hidden">
                        <div className="h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/50" />
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-3 text-xl">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <ShoppingBag className="h-5 w-5 text-primary" />
                              </div>
                              {t("cart.title")}
                              <Badge variant="secondary" className="text-xs font-medium">
                                {itemCount} {itemCount === 1 ? t("cart.item", "item") : t("cart.items", "items")}
                              </Badge>
                            </CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={clearCart}
                              className="text-muted-foreground hover:text-destructive text-xs"
                            >
                              {t("cart.clearAll", "Clear all")}
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-0">
                          {items.map((item, index) => (
                            <div key={item.cartItemId}>
                              <div className="group flex items-center gap-4 py-4 px-2 -mx-2 rounded-xl hover:bg-muted/30 transition-colors duration-200">
                                {/* Item icon */}
                                <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                  <Package className="h-5 w-5 text-primary" />
                                </div>

                                {/* Item details */}
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm truncate">{item.title}</p>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {item.adultPax + item.childPax} {t("cart.guests", "guests")}
                                    </span>
                                    {item.adultPax > 0 && (
                                      <span>{item.adultPax} {t("cart.adults", "adults")}</span>
                                    )}
                                    {item.childPax > 0 && (
                                      <span>{item.childPax} {t("cart.children", "children")}</span>
                                    )}
                                  </div>
                                </div>

                                {/* Price & Remove */}
                                <div className="flex items-center gap-3 shrink-0">
                                  <p className="font-bold text-base whitespace-nowrap">{item.price.toLocaleString()} <span className="text-xs font-medium text-muted-foreground">VT</span></p>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all duration-200"
                                    onClick={() => removeFromCart(item.cartItemId)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              {index < items.length - 1 && <Separator className="opacity-50" />}
                            </div>
                          ))}
                        </CardContent>
                      </Card>

                      {/* Order Summary */}
                      <Card className="border-primary/20 shadow-xl bg-gradient-to-br from-card to-primary/5 backdrop-blur-sm overflow-hidden">
                        <CardContent className="pt-6 pb-6">
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground text-sm">{t("cart.subtotal", "Subtotal")}</span>
                              <span className="font-medium">{total.toLocaleString()} VT</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center">
                              <span className="text-lg font-bold">{t("cart.total")}</span>
                              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                                {total.toLocaleString()} VT
                              </span>
                            </div>
                            <Button
                              className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200 group"
                              onClick={handleCheckout}
                            >
                              <CreditCard className="mr-2 h-5 w-5" />
                              {t("cart.checkout")}
                              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </Button>
                            <p className="text-center text-xs text-muted-foreground">
                              {t("cart.secureCheckout", "Secure checkout • Bank transfer & cash accepted")}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </Layout>
  );
}
