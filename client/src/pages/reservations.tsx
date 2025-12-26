import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { 
  Car, PlusCircle, Search, Calendar as CalendarIcon, Loader2, 
  ShoppingBag, Trash2, ArrowRight, ClipboardList, History, 
  MapPin, Clock, Users, CheckCircle, XCircle, AlertCircle,
  Filter, Download, Eye, Printer
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { tours, transfers } from "@/lib/data";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

const bookingFormSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  service: z.string().min(1, "Please select a service"),
  date: z.date({ required_error: "Date is required" }),
  guests: z.string().min(1, "Number of guests is required"),
  notes: z.string().optional(),
});

const lookupFormSchema = z.object({
  confirmationNumber: z.string().min(1, "Confirmation number is required"),
  verificationType: z.string().min(1, "Select verification type"),
  verificationValue: z.string().min(1, "Verification value is required"),
});

type Booking = {
  id: string;
  customerName: string;
  tourName: string;
  date: string;
  guests: number;
  amount: number;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  createdAt: string;
};

export default function Reservations() {
  const { t } = useTranslation();
  const { itemCount, items, removeFromCart, total, clearCart } = useCart();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<string>(isAuthenticated ? "my-reservations" : "lookup");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<Booking | null>(null);

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

  const bookingForm = useForm<z.infer<typeof bookingFormSchema>>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      service: "",
      guests: "2",
      notes: "",
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

  const [isLookupLoading, setIsLookupLoading] = useState(false);

  async function onBookingSubmit(values: z.infer<typeof bookingFormSchema>) {
    setIsBookingLoading(true);
    try {
      if (isAuthenticated && user) {
        const selectedTour = [...tours, ...transfers].find(t => t.title === values.service);
        const bookingData = {
          userId: user.id,
          tourId: selectedTour?.id || "",
          customerName: values.name,
          tourName: values.service,
          date: values.date.toISOString(),
          guests: parseInt(values.guests),
          amount: selectedTour ? parseInt(selectedTour.price.replace(/[^0-9]/g, '')) : 0,
          status: "pending",
        };
        
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(bookingData),
        });
        
        if (res.ok) {
          queryClient.invalidateQueries({ queryKey: ["bookings"] });
          toast({ title: t("common.success"), description: t("reservations.bookingCreated", "Booking created successfully!") });
          bookingForm.reset();
          setLocation("/payment");
        } else {
          throw new Error("Failed to create booking");
        }
      } else {
        setLocation("/payment");
      }
    } catch (error) {
      toast({ title: t("common.error"), description: t("reservations.bookingFailed", "Failed to create booking"), variant: "destructive" });
    } finally {
      setIsBookingLoading(false);
    }
  }

  const handleLookup = async (values: z.infer<typeof lookupFormSchema>) => {
    setIsLookupLoading(true);
    setLookupResult(null);
    
    try {
      const res = await fetch("/api/bookings/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationNumber: values.confirmationNumber,
          verificationType: values.verificationType,
          verificationValue: values.verificationValue,
        }),
      });
      
      if (res.ok) {
        const booking = await res.json();
        setLookupResult({
          ...booking,
          createdAt: booking.date,
        });
        toast({ title: t("common.success"), description: t("reservations.bookingFound") });
      } else {
        const error = await res.json();
        toast({ 
          title: t("common.error"), 
          description: error.error === "Booking not found" 
            ? t("reservations.notFound", "No booking found with that confirmation number")
            : t("reservations.verificationFailed", "Verification failed. Please check your details."),
          variant: "destructive" 
        });
      }
    } catch (error) {
      toast({ title: t("common.error"), description: t("reservations.lookupFailed", "Failed to lookup booking"), variant: "destructive" });
    } finally {
      setIsLookupLoading(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Customer", "Tour", "Date", "Guests", "Amount", "Status"];
    const csvContent = [
      headers.join(","),
      ...filteredBookings.map(b => 
        [b.id.slice(0, 8), b.customerName, b.tourName, format(new Date(b.date), "yyyy-MM-dd"), b.guests, b.amount, b.status].join(",")
      )
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reservations-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    toast({ title: t("dashboard.exportComplete"), description: t("dashboard.exportCompleteDesc") });
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

  const handleCheckout = () => setLocation("/payment");

  return (
    <Layout>
      <div className="bg-muted/30 min-h-screen pt-28 md:pt-36 pb-20">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-serif font-bold mb-3">
              {t("reservations.title", "Reservation Portal")}
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {isAdmin 
                ? t("reservations.adminDesc", "Manage all bookings and reservations for tours and transfers")
                : t("reservations.guestDesc", "View your booking history, look up reservations, or start a new booking")}
            </p>
            {isAuthenticated && user && (
              <div className="mt-4 inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full">
                <Users className="h-4 w-4" />
                <span className="font-medium">{t("reservations.loggedInAs", "Logged in as")} {user.name}</span>
                {isAdmin && <Badge variant="default" className="ml-2">{t("reservations.admin", "Admin")}</Badge>}
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="max-w-6xl mx-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-8 h-auto p-1">
                {isAuthenticated && (
                  <TabsTrigger value="my-reservations" className="gap-2 py-3" data-testid="tab-my-reservations">
                    <History className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("reservations.myReservations", "My Reservations")}</span>
                    <span className="sm:hidden">{t("reservations.history", "History")}</span>
                  </TabsTrigger>
                )}
                <TabsTrigger value="lookup" className="gap-2 py-3" data-testid="tab-lookup">
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("reservations.lookupBooking", "Look Up Booking")}</span>
                  <span className="sm:hidden">{t("reservations.lookup", "Lookup")}</span>
                </TabsTrigger>
                <TabsTrigger value="book-new" className="gap-2 py-3" data-testid="tab-book-new">
                  <PlusCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("reservations.newBooking", "New Booking")}</span>
                  <span className="sm:hidden">{t("reservations.new", "New")}</span>
                </TabsTrigger>
                <TabsTrigger value="cart" className="gap-2 py-3 relative" data-testid="tab-cart">
                  <ShoppingBag className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("cart.title")}</span>
                  <span className="sm:hidden">{t("reservations.cart", "Cart")}</span>
                  {itemCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {itemCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* My Reservations Tab (Authenticated Users) */}
              {isAuthenticated && (
                <TabsContent value="my-reservations">
                  <Card>
                    <CardHeader>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <ClipboardList className="h-5 w-5" />
                            {isAdmin ? t("reservations.allReservations", "All Reservations") : t("reservations.myBookings", "My Bookings")}
                          </CardTitle>
                          <CardDescription>
                            {isAdmin 
                              ? t("reservations.manageAllBookings", "View and manage all customer bookings")
                              : t("reservations.viewHistory", "View your booking history and upcoming trips")}
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder={t("common.searchPlaceholder")}
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-9 w-full md:w-64"
                              data-testid="input-search-reservations"
                            />
                          </div>
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                              <Filter className="h-4 w-4 mr-2" />
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
                          {isAdmin && (
                            <Button variant="outline" onClick={handleExportCSV} data-testid="button-export-csv">
                              <Download className="h-4 w-4 mr-2" />
                              {t("common.export")}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {bookingsLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      ) : filteredBookings.length === 0 ? (
                        <div className="text-center py-12">
                          <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <h3 className="font-semibold text-lg mb-2">{t("dashboard.noBookingsYet")}</h3>
                          <p className="text-muted-foreground mb-6">{t("dashboard.startExploringTours")}</p>
                          <Link href="/tours">
                            <Button>{t("cart.browseTours")}</Button>
                          </Link>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t("booking.id")}</TableHead>
                                <TableHead>{t("booking.customer")}</TableHead>
                                <TableHead>{t("booking.tour")}</TableHead>
                                <TableHead>{t("booking.date")}</TableHead>
                                <TableHead>{t("booking.guests")}</TableHead>
                                <TableHead>{t("booking.amount")}</TableHead>
                                <TableHead>{t("booking.status")}</TableHead>
                                <TableHead className="text-right">{t("common.actions")}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredBookings.map((booking) => (
                                <TableRow key={booking.id} data-testid={`row-booking-${booking.id}`}>
                                  <TableCell className="font-mono text-sm">
                                    #{booking.id.slice(0, 8)}
                                  </TableCell>
                                  <TableCell className="font-medium">{booking.customerName}</TableCell>
                                  <TableCell>{booking.tourName}</TableCell>
                                  <TableCell>{format(new Date(booking.date), "MMM d, yyyy")}</TableCell>
                                  <TableCell>{booking.guests}</TableCell>
                                  <TableCell className="font-semibold">
                                    {booking.amount.toLocaleString()} VT
                                  </TableCell>
                                  <TableCell>{getStatusBadge(booking.status)}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button variant="ghost" size="icon" title={t("common.view")}>
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" title={t("dashboard.print")}>
                                        <Printer className="h-4 w-4" />
                                      </Button>
                                      {isAdmin && booking.status === "pending" && (
                                        <>
                                          <Button 
                                            variant="ghost" 
                                            size="sm"
                                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                            onClick={() => updateBookingMutation.mutate({ id: booking.id, status: "confirmed" })}
                                            data-testid={`button-confirm-${booking.id}`}
                                          >
                                            {t("booking.confirm")}
                                          </Button>
                                          <Button 
                                            variant="ghost" 
                                            size="sm"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => updateBookingMutation.mutate({ id: booking.id, status: "cancelled" })}
                                            data-testid={`button-cancel-${booking.id}`}
                                          >
                                            {t("booking.cancel")}
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* Lookup Booking Tab (for guests without account) */}
              <TabsContent value="lookup">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Search className="h-5 w-5" />
                      {t("reservations.lookupTitle", "Find Your Reservation")}
                    </CardTitle>
                    <CardDescription>
                      {t("reservations.lookupDesc", "Enter your confirmation number and verification details to view your booking")}
                    </CardDescription>
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
                                <FormLabel>{t("reservations.confirmationNumber", "Confirmation Number")}</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., ACE-12345678" {...field} data-testid="input-confirmation" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={lookupForm.control}
                            name="verificationType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("reservations.verificationType", "Verify With")}</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-verification-type">
                                      <SelectValue placeholder={t("reservations.selectVerification", "Select...")} />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="email">{t("auth.email")}</SelectItem>
                                    <SelectItem value="phone">{t("auth.phone")}</SelectItem>
                                    <SelectItem value="lastname">{t("reservations.lastName", "Last Name")}</SelectItem>
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
                                <FormLabel>{t("reservations.verificationValue", "Verification Value")}</FormLabel>
                                <FormControl>
                                  <Input placeholder={t("reservations.enterValue", "Enter value...")} {...field} data-testid="input-verification" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button type="submit" size="lg" disabled={isLookupLoading} data-testid="button-lookup">
                          {isLookupLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="mr-2 h-4 w-4" />
                          )}
                          {t("reservations.findBooking", "Find Booking")}
                        </Button>
                      </form>
                    </Form>

                    {lookupResult && (
                      <div className="mt-8 p-6 bg-muted/50 rounded-xl border">
                        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          {t("reservations.bookingFound", "Booking Found")}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">{t("booking.id")}</p>
                            <p className="font-medium">#{lookupResult.id.slice(0, 8)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">{t("booking.tour")}</p>
                            <p className="font-medium">{lookupResult.tourName}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">{t("booking.date")}</p>
                            <p className="font-medium">{format(new Date(lookupResult.date), "MMM d, yyyy")}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">{t("booking.status")}</p>
                            {getStatusBadge(lookupResult.status)}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                          <Button variant="outline">
                            <Printer className="mr-2 h-4 w-4" />
                            {t("dashboard.print")}
                          </Button>
                          <Button variant="outline">
                            <Eye className="mr-2 h-4 w-4" />
                            {t("reservations.viewDetails", "View Details")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* New Booking Tab */}
              <TabsContent value="book-new">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PlusCircle className="h-5 w-5" />
                      {t("booking.title")}
                    </CardTitle>
                    <CardDescription>
                      {t("reservations.bookingDesc", "Fill in the details below to request a new tour or transfer booking")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...bookingForm}>
                      <form onSubmit={bookingForm.handleSubmit(onBookingSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={bookingForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("booking.fullName")}</FormLabel>
                                <FormControl>
                                  <Input placeholder={t("booking.namePlaceholder")} {...field} data-testid="input-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={bookingForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("booking.email")}</FormLabel>
                                <FormControl>
                                  <Input placeholder={t("booking.emailPlaceholder")} {...field} data-testid="input-email" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={bookingForm.control}
                            name="service"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("booking.service")}</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-service">
                                      <SelectValue placeholder={t("booking.selectService")} />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="select" disabled>{t("booking.selectOption")}</SelectItem>
                                    {tours.map((tour) => (
                                      <SelectItem key={tour.id} value={tour.title}>{tour.title}</SelectItem>
                                    ))}
                                    {transfers.map((transfer) => (
                                      <SelectItem key={transfer.id} value={transfer.title}>{transfer.title}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={bookingForm.control}
                            name="date"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel>{t("booking.preferredDate")}</FormLabel>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        className={cn(
                                          "w-full pl-3 text-left font-normal",
                                          !field.value && "text-muted-foreground"
                                        )}
                                        data-testid="button-date"
                                      >
                                        {field.value ? format(field.value, "PPP") : t("booking.pickDate")}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={field.value}
                                      onSelect={field.onChange}
                                      disabled={(date) => date < new Date()}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={bookingForm.control}
                            name="guests"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("booking.guests")}</FormLabel>
                                <FormControl>
                                  <Input type="number" min="1" {...field} data-testid="input-guests" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <Button type="submit" size="lg" className="w-full md:w-auto" disabled={isBookingLoading} data-testid="button-submit-booking">
                          {isBookingLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowRight className="mr-2 h-4 w-4" />
                          )}
                          {t("reservations.proceedToPayment", "Proceed to Payment")}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Cart Tab */}
              <TabsContent value="cart">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingBag className="h-5 w-5" />
                      {t("cart.title")} ({itemCount} {itemCount === 1 ? "item" : "items"})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {items.length === 0 ? (
                      <div className="text-center py-12">
                        <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="font-semibold text-lg mb-2">{t("cart.empty")}</h3>
                        <p className="text-muted-foreground mb-6">{t("cart.emptyDesc")}</p>
                        <div className="flex justify-center gap-4">
                          <Link href="/tours">
                            <Button>{t("cart.browseTours")}</Button>
                          </Link>
                          <Link href="/transfers">
                            <Button variant="outline">{t("nav.transfers")}</Button>
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col lg:flex-row gap-8">
                        <div className="lg:w-2/3 space-y-4">
                          {items.map((item, index) => (
                            <Card key={`${item.id}-${index}`} className="overflow-hidden" data-testid={`cart-item-${item.id}`}>
                              <CardContent className="p-0">
                                <div className="flex flex-col sm:flex-row">
                                  <div className="w-full sm:w-40 h-32 sm:h-auto relative">
                                    <img src={item.image} alt={item.title} className="w-full h-full object-cover absolute inset-0" />
                                  </div>
                                  <div className="p-4 flex-grow flex flex-col justify-between">
                                    <div className="flex justify-between items-start mb-2">
                                      <div>
                                        <h3 className="font-bold">{item.title}</h3>
                                        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                                          {item.date && (
                                            <p className="flex items-center gap-1">
                                              <CalendarIcon className="h-3 w-3" />
                                              {format(new Date(item.date), "PPP")}
                                            </p>
                                          )}
                                          {item.guests && (
                                            <p className="flex items-center gap-1">
                                              <Users className="h-3 w-3" />
                                              {item.guests} {t("booking.guests")}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      <p className="font-bold text-lg">{item.price.toLocaleString()} VT</p>
                                    </div>
                                    <div className="flex justify-end">
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => removeFromCart(item.id)}
                                        data-testid={`button-remove-${item.id}`}
                                      >
                                        <Trash2 className="h-4 w-4 mr-1" />
                                        {t("cart.remove")}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                          <div className="text-right">
                            <Button variant="link" onClick={clearCart} className="text-muted-foreground">
                              {t("reservations.clearCart", "Clear Cart")}
                            </Button>
                          </div>
                        </div>

                        <div className="lg:w-1/3">
                          <Card className="sticky top-24">
                            <CardHeader>
                              <CardTitle>{t("payment.orderSummary")}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t("reservations.subtotal", "Subtotal")}</span>
                                <span>{total.toLocaleString()} VT</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t("reservations.taxesFees", "Taxes & Fees")}</span>
                                <span>0 VT</span>
                              </div>
                              <Separator />
                              <div className="flex justify-between font-bold text-lg">
                                <span>{t("cart.total")}</span>
                                <span>{total.toLocaleString()} VT</span>
                              </div>
                            </CardContent>
                            <CardFooter>
                              <Button className="w-full" size="lg" onClick={handleCheckout} data-testid="button-checkout">
                                {t("cart.checkout")}
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Button>
                            </CardFooter>
                          </Card>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </Layout>
  );
}
