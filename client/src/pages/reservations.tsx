
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCart } from "@/lib/cart-context";
import {
  Calendar as CalendarIcon, Loader2, ClipboardList,
  Trash2, Search, PlusCircle, History, ShoppingBag,
  CheckCircle, XCircle, AlertCircle
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { verifyBooking, cancelBooking, fetchTours } from "@/lib/api";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/theme-toggle";
import { BookingForm, bookingFormSchema } from "@/components/booking-form";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";

const lookupFormSchema = z.object({
  confirmationNumber: z.string().min(1, "Confirmation number is required"),
  verificationType: z.string().min(1, "Select verification type"),
  verificationValue: z.string().min(1, "Verification value is required"),
});

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
  }, [user?.name, user?.email]); // Re-compute if user changes or on first mount. URL params are usually static for this page's lifecycle.

  const initialTab = useMemo(() => {
    const searchParams = new URL(window.location.href).searchParams;
    return searchParams.get("tab") || (isAuthenticated ? "my-reservations" : "lookup");
  }, [isAuthenticated]);

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [lookupResult, setLookupResult] = useState<any>(null);

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
    return allServices.map(s => ({
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

  const lookupForm = useForm<z.infer<typeof lookupFormSchema>>({
    resolver: zodResolver(lookupFormSchema),
    defaultValues: {
      confirmationNumber: "",
      verificationType: "",
      verificationValue: "",
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelBooking(id, {
      type: lookupForm.getValues("verificationType"),
      value: lookupForm.getValues("verificationValue")
    }),
    onSuccess: () => {
      toast({ title: t("common.success"), description: t("reservations.bookingCancelled", "Booking cancelled successfully") });
      setCancelDialogOpen(false);
      if (lookupResult) {
        handleLookup(lookupForm.getValues());
      }
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("reservations.cancelFailed", "Failed to cancel booking"), variant: "destructive" });
    }
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
        userId: user?.id || null,
        tourId: selectedTour?.id || "",
        customerName: values.name,
        customerEmail: values.email,
        tourName: values.service,
        date: format(values.date, "yyyy-MM-dd"),
        guests: parseInt(values.adultPax) + parseInt(values.childPax),
        amount: selectedTour ? selectedTour.price : "0",
        status: "pending",
        holdId: holdId,
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
        toast({ title: t("common.success"), description: t("reservations.bookingCreated", "Booking created successfully!") });
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

  const [isLookupLoading, setIsLookupLoading] = useState(false);

  const handleLookup = async (values: z.infer<typeof lookupFormSchema>) => {
    setIsLookupLoading(true);
    setLookupResult(null);
    try {
      const res = await fetch("/api/bookings/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: values.confirmationNumber,
          type: values.verificationType,
          value: values.verificationValue,
        }),
      });

      if (res.ok) {
        const booking = await res.json();
        setLookupResult(booking);
        toast({ title: t("common.success"), description: t("reservations.bookingFound") });
      } else {
        const error = await res.json();
        toast({
          title: t("common.error"),
          description: error.error === "Booking not found"
            ? t("reservations.notFound")
            : t("reservations.verificationFailed"),
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({ title: t("common.error"), description: t("reservations.lookupFailed"), variant: "destructive" });
    } finally {
      setIsLookupLoading(false);
    }
  };

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
      <div className="bg-muted/30 min-h-screen pt-40 md:pt-44 pb-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-serif font-bold mb-3">
              {t("reservations.title", "Reservation Portal")}
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {isAdmin
                ? t("reservations.adminDesc", "Manage all bookings and reservations")
                : t("reservations.guestDesc", "View your history or look up a reservation")}
            </p>
          </div>

          <div className="max-w-6xl mx-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-8 h-auto p-1">
                {isAuthenticated && (
                  <TabsTrigger value="my-reservations" className="gap-2 py-3">
                    <History className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("reservations.myReservations")}</span>
                  </TabsTrigger>
                )}
                <TabsTrigger value="lookup" className="gap-2 py-3">
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("reservations.lookupBooking")}</span>
                </TabsTrigger>
                <TabsTrigger value="book-new" className="gap-2 py-3">
                  <PlusCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("reservations.newBooking")}</span>
                </TabsTrigger>
                <TabsTrigger value="cart" className="gap-2 py-3 relative">
                  <ShoppingBag className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("cart.title")}</span>
                  {itemCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {itemCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {isAuthenticated && (
                <TabsContent value="my-reservations">
                  <Card>
                    <CardHeader>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <CardTitle className="flex items-center gap-2">
                          <ClipboardList className="h-5 w-5" />
                          {isAdmin ? t("reservations.allReservations") : t("reservations.myBookings")}
                        </CardTitle>
                        <div className="flex flex-wrap gap-2">
                          <Input
                            placeholder={t("common.searchPlaceholder")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full md:w-64"
                          />
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[140px]">
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

              <TabsContent value="lookup">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("reservations.lookupTitle", "Find Reservation")}</CardTitle>
                    <CardDescription>{t("reservations.lookupDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...lookupForm}>
                      <form onSubmit={lookupForm.handleSubmit(handleLookup)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={lookupForm.control}
                            name="confirmationNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("reservations.confirmationNumber")}</FormLabel>
                                <FormControl><Input {...field} placeholder="ACE-XXXXX" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={lookupForm.control}
                            name="verificationType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("reservations.verificationType")}</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="email">{t("auth.email")}</SelectItem>
                                    <SelectItem value="phone">{t("auth.phone")}</SelectItem>
                                    <SelectItem value="lastname">{t("reservations.lastName")}</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={lookupForm.control}
                            name="verificationValue"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("reservations.verificationValue")}</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button type="submit" disabled={isLookupLoading}>
                          {isLookupLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {t("reservations.findBooking")}
                        </Button>
                      </form>
                    </Form>

                    {lookupResult && (
                      <div className="mt-8 p-6 bg-muted/50 rounded-xl border">
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            {t("reservations.bookingFound")}
                          </h3>
                          {lookupResult.status !== 'cancelled' && (
                            <Button variant="destructive" size="sm" onClick={() => setCancelDialogOpen(true)}>Cancel Booking</Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div><p className="text-muted-foreground">{t("booking.id")}</p><p className="font-medium">#{lookupResult.id.slice(0, 8)}</p></div>
                          <div><p className="text-muted-foreground">{t("booking.tour")}</p><p className="font-medium">{lookupResult.tourName}</p></div>
                          <div><p className="text-muted-foreground">{t("booking.date")}</p><p className="font-medium">{format(new Date(lookupResult.date), "MMM d, yyyy")}</p></div>
                          <div><p className="text-muted-foreground">{t("booking.status")}</p>{getStatusBadge(lookupResult.status)}</div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="book-new">
                <Card>
                  <CardHeader><CardTitle>{t("reservations.newBooking")}</CardTitle></CardHeader>
                  <CardContent>
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
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cart">
                <Card>
                  <CardHeader><CardTitle>{t("cart.title")} ({itemCount})</CardTitle></CardHeader>
                  <CardContent>
                    {items.length === 0 ? (
                      <div className="text-center py-12"><p>{t("cart.empty")}</p></div>
                    ) : (
                      <div className="space-y-4">
                        {items.map((item) => (
                          <div key={item.cartItemId} className="flex justify-between items-center border-b pb-4">
                            <div><p className="font-bold">{item.title}</p><p className="text-sm text-muted-foreground">{item.adultPax + item.childPax} guests</p></div>
                            <div className="flex items-center gap-4">
                              <p className="font-bold">{item.price.toLocaleString()} VT</p>
                              <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.cartItemId)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        ))}
                        <div className="pt-4 flex justify-between items-center font-bold text-lg">
                          <span>{t("cart.total")}</span><span>{total.toLocaleString()} VT</span>
                        </div>
                        <Button className="w-full" onClick={handleCheckout}>{t("cart.checkout")}</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Reservation?</DialogTitle>
            <DialogDescription>Are you sure you want to cancel your reservation? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Keep</Button>
            <Button variant="destructive" onClick={() => lookupResult && cancelMutation.mutate(lookupResult.id)} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
