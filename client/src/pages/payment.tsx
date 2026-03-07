
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ShieldCheck, Lock, CreditCard, Loader2, ArrowLeft,
  Building, Banknote, Wallet, Globe, Smartphone,
  Store, Landmark, DollarSign, ExternalLink,
  CalendarIcon, Users, MapPin, MessageSquare, Package, Clock, Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { Layout } from "@/components/layout";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelector } from "@/components/language-selector";
import { useTranslation } from "react-i18next";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPaymentMethods, type PaymentMethodOption } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { formatPriceDisplay } from "@/lib/product.types";
import { useCurrency } from "@/lib/currency-context";
import { Badge } from "@/components/ui/badge";

const methodIcons: Record<string, React.ElementType> = {
  'card': CreditCard,
  'paypal': Globe,
  'mobile-money': Smartphone,
  'digital-wallet': Wallet,
  'bank-transfer': Building,
  'cash': DollarSign,
};

const methodThemeColors: Record<string, string> = {
  'card': 'peer-data-[state=checked]:border-[#004165] peer-data-[state=checked]:text-[#004165]',
  'paypal': 'peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:text-blue-500',
  'mobile-money': 'peer-data-[state=checked]:border-purple-600 peer-data-[state=checked]:text-purple-600',
  'digital-wallet': 'peer-data-[state=checked]:border-black peer-data-[state=checked]:text-black dark:peer-data-[state=checked]:border-white dark:peer-data-[state=checked]:text-white',
  'bank-transfer': 'peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary',
  'cash': 'peer-data-[state=checked]:border-green-600 peer-data-[state=checked]:text-green-600',
};

type BookingItem = {
  id: string;
  productId: string;
  productName?: string;
  adultPax?: number;
  childPax?: number;
  infantPax?: number;
  petPax?: number;
  date?: string;
  startTime?: string;
  endTime?: string;
  unitPriceCents?: number;
  subtotalCents?: number;    // authoritative line-item total from DB
  /** @deprecated use subtotalCents — kept for any legacy cached sessionStorage data */
  totalCents?: number;
};

type BookingDetails = {
  id: string;
  customerName?: string;
  customerEmail?: string;
  tourName?: string;
  date?: string;
  status?: string;
  totalAmountCents?: number;
  notes?: string;
  pickupLocation?: string;
  adultPaxTotal?: number;
  childPaxTotal?: number;
  infantPaxTotal?: number;
  petPaxTotal?: number;
  guests?: number;
  currency?: string;
};

export default function Payment() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { total, clearCart, items } = useCart();
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { currency } = useCurrency();
  const queryClient = useQueryClient();

  const [guestName, setGuestName] = useState(user?.name || "");
  const [guestEmail, setGuestEmail] = useState(user?.email || "");
  const [guestPhone, setGuestPhone] = useState(user?.phone || "");
  const [pickupLocation, setPickupLocation] = useState("");
  const [notes, setNotes] = useState("");

  const [bookingId, setBookingId] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [selectedSubOption, setSelectedSubOption] = useState<string>("");
  const [dddConfig, setDddConfig] = useState<any>(null);
  const [cachedBooking, setCachedBooking] = useState<BookingDetails | null>(null);
  // FIX (audit section 3.5): Generate a stable idempotency key once per page load.
  const idempotencyKey = useRef(crypto.randomUUID());

  // Load checkout details from session storage
  useEffect(() => {
    const savedDetails = sessionStorage.getItem("checkout_details");
    if (savedDetails) {
      try {
        const parsed = JSON.parse(savedDetails);
        setGuestName(parsed.name || user?.name || "");
        setGuestEmail(parsed.email || user?.email || "");
        setGuestPhone(parsed.phone || user?.phone || "");
        setPickupLocation(parsed.pickupLocation || "");
        setNotes(parsed.notes || "");
      } catch (e) {
        console.error("Failed to parse checkout details", e);
      }
    } else if (!isAuthenticated && items.length > 0) {
      // If we're a guest and have items but no details, we should probably be on the checkout step
      // unless we came from somewhere else. We'll let the user decide with a warning or auto-redirect 
      // if it becomes a common issue.
    }
  }, [isAuthenticated, user, items.length]);

  useEffect(() => {
    fetch("/api/config")
      .then(res => res.json())
      .then(data => setDddConfig(data.ddd));
  }, []);

  const { data: methods = [], isLoading: isLoadingMethods } = useQuery<PaymentMethodOption[]>({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("bookingId");
    if (id) {
      setBookingId(id);
      // Try sessionStorage first (set during booking creation in reservations.tsx)
      try {
        const cached = sessionStorage.getItem('checkout_booking');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.id === id) {
            setCachedBooking(parsed);
          }
        }
      } catch (e) { /* ignore */ }
    }
  }, []);

  // Fetch booking details as fallback when sessionStorage data is unavailable
  const { data: fetchedBooking, isLoading: isLoadingBooking } = useQuery<BookingDetails>({
    queryKey: ["booking-details", bookingId],
    queryFn: async () => {
      if (!bookingId) return null;
      const res = await fetch(`/api/bookings/${bookingId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    // Only fetch if we don't already have cached data
    enabled: !!bookingId && !cachedBooking,
  });

  // Use cached data (sessionStorage) preferentially, fall back to API
  const bookingDetails = cachedBooking || fetchedBooking || null;

  // Pre-fill guest details from booking if available and fields are still empty
  useEffect(() => {
    if (bookingDetails) {
      if (!guestName && bookingDetails.customerName) setGuestName(bookingDetails.customerName);
      if (!guestEmail && bookingDetails.customerEmail) setGuestEmail(bookingDetails.customerEmail);
    }
  }, [bookingDetails]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch booking items for detailed line items
  const { data: bookingItems = [] } = useQuery<BookingItem[]>({
    queryKey: ["booking-items", bookingId],
    queryFn: async () => {
      if (!bookingId) return [];
      const res = await fetch(`/api/bookings/${bookingId}/items`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!bookingId,
  });

  useEffect(() => {
    if (!isLoadingMethods && methods.length > 0 && !selectedMethod) {
      // Auto-select card if available, otherwise first method
      const cardMethod = methods.find(m => m.method === 'card');
      const firstMethod = cardMethod || methods[0];
      if (firstMethod) {
        setSelectedMethod(firstMethod.method);
        // Auto-select first sub-option if it's a multi-provider method
        if (firstMethod.subOptions?.length) {
          setSelectedSubOption(firstMethod.subOptions[0].slug);
        }
      }
    }
  }, [isLoadingMethods, methods, selectedMethod]);

  // Resolve the actual gateway slug to send to the checkout API
  const resolveGatewaySlug = (): string => {
    const method = methods.find(m => m.method === selectedMethod);
    if (!method) return '';
    if (method.subOptions?.length) {
      return selectedSubOption || method.subOptions[0]?.slug || '';
    }
    return method.gatewaySlug || '';
  };

  const createBookingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customerName: guestName || user?.name || "Guest User",
          customerEmail: guestEmail || user?.email || "guest@example.com",
          customerPhone: guestPhone || user?.phone || undefined,
          pickupLocation: pickupLocation || undefined,
          notes: notes || undefined,
          idempotencyKey: idempotencyKey.current,
          items: items.map(i => ({
            productId: i.id,
            adultPax: i.adultPax ?? 1,   // FIX: guard against undefined from stale cart entries
            childPax: i.childPax ?? 0,   // FIX: guard against undefined from stale cart entries
            infantPax: i.infantPax ?? 0,
            petPax: i.petPax ?? 0,
            date: i.date ? (typeof i.date === 'string' ? i.date : format(new Date(i.date), "yyyy-MM-dd")) : format(new Date(), "yyyy-MM-dd"),
            slot: i.slot,
            quantity: i.quantity,
            addonIds: i.addonIds || []
          }))
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create booking");
      }
      return res.json();
    },
  });

  const MANUAL_METHODS = ['bank-transfer', 'cash'];
  const isManualMethod = (method: string) => MANUAL_METHODS.includes(method);
  const initiatePaymentMutation = useMutation({
    mutationFn: async (data: { bookingId: string; provider: string; successUrl: string; cancelUrl: string; }) => {
      const res = await apiRequest("POST", "/api/payments/checkout", data);
      const json = await res.json();
      // Surface server-side errors (e.g. ownership check failures) as thrown errors
      if (!res.ok || json.error) {
        throw new Error(json.error || "Payment initiation failed");
      }
      return json;
    },
    onSuccess: (data) => {
      // Clear cart only after a successful payment initiation (booking created + payment started)
      clearCart();
      sessionStorage.removeItem('checkout_booking');
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        // Manual payment (bank transfer / cash) - redirect to success page
        const bId = data.bookingId || bookingId;
        const provider = data.provider || selectedMethod;
        setLocation(`/payment/success?booking=${bId}&manual=true&method=${provider}`);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Payment Error",
        description: error.message || "Failed to process your payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    // Since we now have a checkout step, we just show a generic error if they somehow bypassed it
    if (!bookingId && !guestName && !guestEmail) {
      toast({ title: "Details Required", description: "Please complete the checkout details step first.", variant: "destructive" });
      setLocation("/checkout");
      return;
    }

    if (!selectedMethod) {
      toast({ title: t("common.error"), description: t("payment.noMethodSelected"), variant: "destructive" });
      return;
    }

    const gatewaySlug = resolveGatewaySlug();
    if (!gatewaySlug) {
      toast({ title: t("common.error"), description: "No payment provider available for this method.", variant: "destructive" });
      return;
    }

    try {
      let currentBookingId = bookingId;

      // If no bookingId in URL, we need to create one from cart items
      if (!currentBookingId) {
        if (items.length === 0) {
          toast({ title: "Cart is empty", description: "Add items to your cart first.", variant: "destructive" });
          return;
        }

        // SERVER-SIDE PRICE VALIDATION
        const priceCheckRes = await fetch("/api/cart/price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            items: items.map(i => ({
              productId: i.id,
              adultPax: i.adultPax,
              childPax: i.childPax,
              quantity: i.quantity || 1
            }))
          }),
        });

        if (priceCheckRes.ok) {
          const priceSnapshot = await priceCheckRes.json();
          const serverTotal = priceSnapshot.totalCents;
          const clientTotal = total;

          // Only flag mismatch if we have a valid client total (pricing service was available)
          if (clientTotal > 0 && Math.abs(serverTotal - clientTotal) > 100) {
            toast({
              title: "Price has changed",
              description: `Your cart total has been updated to ${formatPriceDisplay(serverTotal, currency)}. Please review the new total and click Pay again to continue.`,
              variant: "default"
            });
            console.warn(`[PRICE MISMATCH] Client: ${clientTotal}, Server: ${serverTotal}`);
            return;
          }
        }

        const booking = await createBookingMutation.mutateAsync();
        currentBookingId = booking.id;
      }

      const successUrl = `${window.location.origin}/payment/success?booking=${currentBookingId}`;
      const cancelUrl = `${window.location.origin}/payment/cancel?booking=${currentBookingId}`;

      initiatePaymentMutation.mutate({
        bookingId: currentBookingId!,
        provider: gatewaySlug,
        successUrl,
        cancelUrl,
      });
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    }
  };

  const activeMethod = methods.find(m => m.method === selectedMethod);
  const CurrentIcon = activeMethod ? (methodIcons[activeMethod.method] || CreditCard) : CreditCard;

  // Determine the display total: use booking total if available, otherwise cart total
  const displayTotal = bookingDetails?.totalAmountCents ?? total;
  const displayCurrency = bookingDetails?.currency || currency;

  // Has a pre-created booking (from booking form flow)
  const hasBooking = !!bookingId && !!bookingDetails;

  if (isLoadingMethods || (bookingId && isLoadingBooking)) {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center p-4 pt-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">Loading checkout…</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen pt-36 md:pt-40 pb-16 relative overflow-hidden">
        {/* Subtle background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-background to-primary/5 pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          {/* Header */}
          <div className="max-w-2xl mx-auto mb-6">
            <Button variant="ghost" onClick={() => setLocation("/cart")} className="mb-4 -ml-2">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Cart
            </Button>

            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-primary/10">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Secure Checkout</h1>
                <p className="text-sm text-muted-foreground">Review your order and select a payment method</p>
              </div>
            </div>
          </div>

          <div className="max-w-2xl mx-auto space-y-5">

            {/* ──── Order Summary ──── */}
            {hasBooking && (
              <Card className="border-border/50 shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/50" />
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Package className="h-5 w-5 text-primary" />
                    Order Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Customer Info */}
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                    <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{bookingDetails.customerName}</p>
                      <p className="text-xs text-muted-foreground truncate">{bookingDetails.customerEmail}</p>
                    </div>
                    <Badge variant="secondary" className="ml-auto text-[10px] shrink-0">
                      Ref ACT-{(bookingDetails.id || '').replace(/^book_/i, '').replace(/-/g, '').slice(0, 8).toUpperCase()}
                    </Badge>
                  </div>

                  {/* Booking Items */}
                  {bookingItems.length > 0 ? (
                    <div className="space-y-3">
                      {bookingItems.map((item, index) => (
                        <div key={item.id || index} className="p-3 rounded-xl border border-border/30 bg-background/50">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm">{item.productName || bookingDetails.tourName || "Tour/Transfer"}</p>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                                {(item.date || bookingDetails.date) && (
                                  <span className="flex items-center gap-1">
                                    <CalendarIcon className="h-3 w-3" />
                                    {format(new Date(item.date || bookingDetails.date!), "EEE, MMM d, yyyy")}
                                  </span>
                                )}
                                {item.startTime && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {item.startTime}
                                    {item.endTime && ` - ${item.endTime}`}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  <span className="flex flex-wrap items-center gap-1">
                                    {item.adultPax || bookingDetails.adultPaxTotal || 1} adult{((item.adultPax || bookingDetails.adultPaxTotal || 1) > 1) ? 's' : ''}
                                    {(item.childPax || bookingDetails.childPaxTotal || 0) > 0 && (
                                      <>, {item.childPax || bookingDetails.childPaxTotal} child{((item.childPax || bookingDetails.childPaxTotal || 0) > 1) ? 'ren' : ''}</>
                                    )}
                                    {!!item.infantPax && item.infantPax > 0 && (
                                      <>, {item.infantPax} infant{item.infantPax > 1 ? 's' : ''}</>
                                    )}
                                    {!!item.petPax && item.petPax > 0 && (
                                      <>, {item.petPax} pet{item.petPax > 1 ? 's' : ''}</>
                                    )}
                                  </span>
                                </span>
                              </div>
                            </div>
                            {(item.subtotalCents ?? item.totalCents) ? (
                              <span className="font-bold text-sm whitespace-nowrap">
                                {formatPriceDisplay((item.subtotalCents ?? item.totalCents)!, displayCurrency)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : bookingDetails.tourName ? (
                    /* Fallback: show booking-level details if no items returned */
                    <div className="p-3 rounded-xl border border-border/30 bg-background/50">
                      <p className="font-semibold text-sm">{bookingDetails.tourName}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                        {bookingDetails.date && (
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            {format(new Date(bookingDetails.date), "EEE, MMM d, yyyy")}
                          </span>
                        )}
                        {bookingDetails.guests && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {bookingDetails.guests} guest{bookingDetails.guests > 1 ? 's' : ''}
                            {!!bookingDetails.infantPaxTotal && bookingDetails.infantPaxTotal > 0 && (
                              <>, {bookingDetails.infantPaxTotal} infant{bookingDetails.infantPaxTotal > 1 ? 's' : ''}</>
                            )}
                            {!!bookingDetails.petPaxTotal && bookingDetails.petPaxTotal > 0 && (
                              <>, {bookingDetails.petPaxTotal} pet{bookingDetails.petPaxTotal > 1 ? 's' : ''}</>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* Pickup Location */}
                  {bookingDetails.pickupLocation && (
                    <div className="flex items-start gap-2 text-sm px-1">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pickup Location</span>
                        <p className="text-sm">{bookingDetails.pickupLocation}</p>
                      </div>
                    </div>
                  )}

                  {/* Special Requests */}
                  {bookingDetails.notes && (
                    <div className="flex items-start gap-2 text-sm px-1">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Special Requests</span>
                        <p className="text-sm">{bookingDetails.notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Total */}
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total Amount</span>
                    <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                      {formatPriceDisplay(displayTotal, displayCurrency)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ──── Cart Summary (no pre-created booking) ──── */}
            {!hasBooking && items.length > 0 && (
              <Card className="border-border/50 shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/50" />
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Package className="h-5 w-5 text-primary" />
                    Order Summary
                    <Badge variant="secondary" className="text-xs">{items.length} item{items.length > 1 ? 's' : ''}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map((item) => {
                    const isVehicle = item.type === "vehicle";
                    const anyItem = item as any;
                    return (
                      <div key={item.cartItemId} className="p-3 rounded-xl border border-border/30 bg-background/50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm">{item.title}</p>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                              {item.date && (
                                <span className="flex items-center gap-1">
                                  <CalendarIcon className="h-3 w-3" />
                                  {format(new Date(item.date), "EEE, d MMM yyyy")}
                                </span>
                              )}
                              {item.startTime && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {item.startTime}{item.endTime ? ` – ${item.endTime}` : ""}
                                </span>
                              )}
                              {isVehicle && anyItem.hireDays > 0 && (
                                <span className="font-medium text-foreground">{anyItem.hireDays} day{anyItem.hireDays !== 1 ? "s" : ""} hire</span>
                              )}
                            </div>
                            {!isVehicle && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <Users className="h-3 w-3" />
                                {item.adultPax} adult{item.adultPax > 1 ? 's' : ''}
                                {item.childPax > 0 && `, ${item.childPax} child${item.childPax > 1 ? 'ren' : ''}`}
                                {item.infantPax > 0 && `, ${item.infantPax} infant${item.infantPax > 1 ? 's' : ''}`}
                                {item.petPax > 0 && `, ${item.petPax} pet${item.petPax > 1 ? 's' : ''}`}
                              </div>
                            )}
                          </div>
                          <span className="font-bold text-sm whitespace-nowrap">{formatPriceDisplay(item.price * item.adultPax + item.childPrice * item.childPax + (item.addonTotal || 0), currency)}</span>
                        </div>
                      </div>
                    );
                  })}
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">{formatPriceDisplay(total, currency)}</span>
                  </div>
                  <p className="text-[0.65rem] text-muted-foreground text-center">All prices include 15% VAT</p>
                </CardContent>
              </Card>
            )}

            {/* ──── Guest Details (only when no pre-created booking) ──── */}
            {!hasBooking && guestName && guestEmail && (
              <Card className="border-border/50 shadow-lg bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="h-5 w-5 text-primary" />
                      Contact Details
                    </CardTitle>
                    <CardDescription>We'll send your booking confirmation to this email</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setLocation("/checkout")} className="text-xs">
                    Edit
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Name</span>
                      <p className="font-medium">{guestName}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Email</span>
                      <p className="font-medium">{guestEmail}</p>
                    </div>
                    {guestPhone && (
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Phone</span>
                        <p className="font-medium">{guestPhone}</p>
                      </div>
                    )}
                    {pickupLocation && (
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Pickup</span>
                        <p className="font-medium truncate">{pickupLocation}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ──── Payment Method ──── */}
            <Card className="border-border/50 shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Payment Method
                </CardTitle>
                <CardDescription>Select how you'd like to pay</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePayment} className="space-y-5">
                  <RadioGroup value={selectedMethod} onValueChange={(val) => {
                    setSelectedMethod(val);
                    // Reset sub-option when switching methods
                    const method = methods.find(m => m.method === val);
                    if (method?.subOptions?.length) {
                      setSelectedSubOption(method.subOptions[0].slug);
                    } else {
                      setSelectedSubOption('');
                    }
                  }} className="grid grid-cols-2 gap-4">
                    {methods.map(method => {
                      const Icon = methodIcons[method.method] || CreditCard;
                      const theme = methodThemeColors[method.method] || 'peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary';
                      const isDisabled = dddConfig?.cardPaymentsDisabled && method.method === 'card';

                      return (
                        <div key={method.method} className={isDisabled ? "opacity-50 grayscale cursor-not-allowed" : ""}>
                          <RadioGroupItem value={method.method} id={`method-${method.method}`} className="peer sr-only" disabled={isDisabled} />
                          <Label htmlFor={`method-${method.method}`} className={`flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent ${theme} cursor-pointer transition-all duration-200`}>
                            <Icon className="mb-1 h-6 w-6" />
                            <span className="font-bold text-sm mb-0.5">{method.label}</span>
                            <span className="text-[10px] text-muted-foreground text-center leading-tight">{method.description}</span>
                            {isDisabled && <span className="text-[10px] text-red-500 font-bold uppercase mt-1">Disabled</span>}
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>

                  {/* Sub-options for multi-provider methods (Mobile Money, Digital Wallet) */}
                  {activeMethod?.subOptions && activeMethod.subOptions.length > 0 && (
                    <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3">
                      <p className="text-sm font-medium text-muted-foreground">Select your provider:</p>
                      <RadioGroup
                        value={selectedSubOption}
                        onValueChange={setSelectedSubOption}
                        className="grid gap-2"
                      >
                        {activeMethod.subOptions.map(sub => (
                          <div key={sub.slug} className="flex items-center">
                            <RadioGroupItem value={sub.slug} id={`sub-${sub.slug}`} className="peer" />
                            <Label
                              htmlFor={`sub-${sub.slug}`}
                              className="flex-1 ml-3 py-2 px-3 rounded-lg cursor-pointer transition-colors peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:font-semibold hover:bg-accent text-sm"
                            >
                              {sub.label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  )}

                  {selectedMethod === 'bank-transfer' && (
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-5 border border-blue-200 dark:border-blue-800 space-y-4">
                      <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200">
                        <Landmark className="h-5 w-5 text-blue-600" />
                        <h3 className="font-semibold text-base">Bank Transfer Instructions</h3>
                      </div>
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        After confirming your booking, you'll receive full bank details by email. Use your booking reference as the payment description.
                      </p>
                      <div className="space-y-3">
                        <div className="bg-white dark:bg-blue-900/30 rounded-lg p-3 border border-blue-100 dark:border-blue-700">
                          <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-2">🏦 Local Transfer (Vanuatu banks)</p>
                          <p className="text-sm text-blue-800 dark:text-blue-200">Bank-to-bank transfer within Vanuatu. Funds clear same day with most local banks.</p>
                        </div>
                        <div className="bg-white dark:bg-blue-900/30 rounded-lg p-3 border border-blue-100 dark:border-blue-700">
                          <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-2">💸 Direct Transfer (Online banking)</p>
                          <p className="text-sm text-blue-800 dark:text-blue-200">Transfer directly from your online banking portal to our nominated account.</p>
                        </div>
                        <div className="bg-white dark:bg-blue-900/30 rounded-lg p-3 border border-blue-100 dark:border-blue-700">
                          <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-2">🌏 International Wire (SWIFT)</p>
                          <p className="text-sm text-blue-800 dark:text-blue-200">For overseas customers — use our SWIFT/BIC code. Allow 2–3 business days for clearance.</p>
                        </div>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300">
                        ⏳ Your booking is held for <strong>72 hours</strong>. Please transfer within this time to secure your spot.
                      </div>
                    </div>
                  )}

                  {selectedMethod === 'cash' && (
                    <div className="rounded-xl bg-green-50 dark:bg-green-950/30 p-4 border border-green-200 dark:border-green-800 flex flex-col items-center">
                      <Banknote className="h-8 w-8 text-green-600 mb-2" />
                      <h3 className="font-semibold text-green-900 dark:text-green-200 mb-2">Cash on Delivery</h3>
                      <p className="text-sm text-green-800 dark:text-green-300 text-center">
                        Please pay at the start of your tour or vehicle pickup.
                      </p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-14 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200 group"
                    disabled={initiatePaymentMutation.isPending || createBookingMutation.isPending}
                  >
                    {(initiatePaymentMutation.isPending || createBookingMutation.isPending) ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        {isManualMethod(selectedMethod) ? "Confirming…" : "Processing…"}
                      </>
                    ) : isManualMethod(selectedMethod) ? (
                      <>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Confirm Booking
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        {hasBooking
                          ? `Pay ${formatPriceDisplay(displayTotal, displayCurrency)}`
                          : `Pay ${formatPriceDisplay(total, currency)}`
                        }
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Payments processed securely • 256-bit encryption</span>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Info note */}
            <div className="flex items-start gap-2.5 px-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <p>Free cancellation up to 24 hours before your tour. By proceeding, you agree to our terms of service.</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
