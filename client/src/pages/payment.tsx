
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
import { fetchPaymentGateways } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { PaymentGateway } from "@shared/schema";
import { format } from "date-fns";
import { formatPriceDisplay } from "@/lib/product.types";
import { useCurrency } from "@/lib/currency-context";
import { Badge } from "@/components/ui/badge";

const gatewayIcons: Record<string, React.ElementType> = {
  'anz-egate': Landmark,
  'bred-bank': Landmark,
  'bsp-bank': Store,
  'generic-local-bank': Banknote,
  'stripe': CreditCard,
  'google-pay': Smartphone,
  'apple-pay': Smartphone,
  'paypal': Globe,
  'e-wallet': Wallet,
  'cash': DollarSign,
  'manual_transfer': Building,
};

const gatewayThemeColors: Record<string, string> = {
  'anz-egate': 'peer-data-[state=checked]:border-[#004165] peer-data-[state=checked]:text-[#004165]',
  'bred-bank': 'peer-data-[state=checked]:border-blue-700 peer-data-[state=checked]:text-blue-700',
  'bsp-bank': 'peer-data-[state=checked]:border-red-700 peer-data-[state=checked]:text-red-700',
  'generic-local-bank': 'peer-data-[state=checked]:border-gray-700 peer-data-[state=checked]:text-gray-700',
  'stripe': 'peer-data-[state=checked]:border-purple-600 peer-data-[state=checked]:text-purple-600',
  'google-pay': 'peer-data-[state=checked]:border-black peer-data-[state=checked]:text-black dark:peer-data-[state=checked]:border-white dark:peer-data-[state=checked]:text-white',
  'apple-pay': 'peer-data-[state=checked]:border-black peer-data-[state=checked]:text-black dark:peer-data-[state=checked]:border-white dark:peer-data-[state=checked]:text-white',
  'paypal': 'peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:text-blue-500',
  'e-wallet': 'peer-data-[state=checked]:border-purple-600 peer-data-[state=checked]:text-purple-600',
  'cash': 'peer-data-[state=checked]:border-green-600 peer-data-[state=checked]:text-green-600',
  'manual_transfer': 'peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary',
};

type BookingItem = {
  id: string;
  productId: string;
  productName?: string;
  adultPax?: number;
  childPax?: number;
  date?: string;
  startTime?: string;
  endTime?: string;
  adultPriceCents?: number;
  childPriceCents?: number;
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

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [dddConfig, setDddConfig] = useState<any>(null);
  const [cachedBooking, setCachedBooking] = useState<BookingDetails | null>(null);
  // FIX (audit section 3.5): Generate a stable idempotency key once per page load.
  const idempotencyKey = useRef(crypto.randomUUID());

  useEffect(() => {
    fetch("/api/config")
      .then(res => res.json())
      .then(data => setDddConfig(data.ddd));
  }, []);

  const { data: gateways = [], isLoading: isLoadingGateways } = useQuery<PaymentGateway[]>({
    queryKey: ["payment-gateways"],
    queryFn: fetchPaymentGateways,
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
    if (!isLoadingGateways && gateways.length > 0 && !paymentMethod) {
      const defaultGateway = gateways.find(g => g.isDefault && g.active) || gateways.find(g => g.active);
      if (defaultGateway) setPaymentMethod(defaultGateway.slug);
    }
  }, [isLoadingGateways, gateways, paymentMethod]);

  const createBookingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customerName: user?.name || guestName,
          customerEmail: user?.email || guestEmail,
          idempotencyKey: idempotencyKey.current,
          items: items.map(i => ({
            productId: i.id,
            adultPax: i.adultPax,
            childPax: i.childPax,
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

  const MANUAL_PAYMENT_SLUGS = ['manual_transfer', 'cash', 'manual', 'bank-transfer', 'bank'];
  const isManualPaymentMethod = (slug: string) =>
    MANUAL_PAYMENT_SLUGS.some(s => slug.toLowerCase().includes(s));

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
      clearCart();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        // Manual payment (bank transfer / cash) - redirect to success page with manual params
        const bId = data.bookingId || bookingId;
        const provider = data.provider || paymentMethod;
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

    // Only require guest details if no booking exists AND user isn't authenticated
    if (!bookingId && !isAuthenticated && (!guestName || !guestEmail)) {
      toast({ title: "Details Required", description: "Please provide your name and email.", variant: "destructive" });
      return;
    }

    if (!paymentMethod) {
      toast({ title: t("common.error"), description: t("payment.noMethodSelected"), variant: "destructive" });
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

          if (Math.abs(serverTotal - clientTotal) > 100) {
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

      const successUrl = `${window.location.origin}/payment/success`;
      const cancelUrl = `${window.location.origin}/payment/cancel`;

      initiatePaymentMutation.mutate({
        bookingId: currentBookingId!,
        provider: paymentMethod,
        successUrl,
        cancelUrl,
      });
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    }
  };

  const selectedGateway = gateways.find(g => g.slug === paymentMethod);
  const CurrentIcon = selectedGateway ? (gatewayIcons[selectedGateway.slug] || CreditCard) : CreditCard;
  const currentThemeColor = selectedGateway ? (gatewayThemeColors[selectedGateway.slug] || 'bg-[#004165]') : 'bg-[#004165]';

  // Determine the display total: use booking total if available, otherwise cart total
  const displayTotal = bookingDetails?.totalAmountCents ?? total;
  const displayCurrency = bookingDetails?.currency || currency;

  // Has a pre-created booking (from booking form flow)
  const hasBooking = !!bookingId && !!bookingDetails;

  if (isLoadingGateways || (bookingId && isLoadingBooking)) {
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
            <Button variant="ghost" onClick={() => setLocation(bookingId ? "/reservations" : "/reservations?tab=cart")} className="mb-4 -ml-2">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
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
                      Ref #{bookingDetails.id?.slice(0, 8).toUpperCase()}
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
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {item.adultPax || bookingDetails.adultPaxTotal || 1} adult{(item.adultPax || bookingDetails.adultPaxTotal || 1) > 1 ? 's' : ''}
                                  {(item.childPax || bookingDetails.childPaxTotal || 0) > 0 && (
                                    <>, {item.childPax || bookingDetails.childPaxTotal} child{(item.childPax || bookingDetails.childPaxTotal || 0) > 1 ? 'ren' : ''}</>
                                  )}
                                </span>
                              </div>
                            </div>
                            {item.totalCents && (
                              <span className="font-bold text-sm whitespace-nowrap">
                                {formatPriceDisplay(item.totalCents, displayCurrency)}
                              </span>
                            )}
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
                  {items.map((item) => (
                    <div key={item.cartItemId} className="flex items-center justify-between py-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.adultPax} adult{item.adultPax > 1 ? 's' : ''}
                          {item.childPax > 0 && `, ${item.childPax} child${item.childPax > 1 ? 'ren' : ''}`}
                        </p>
                      </div>
                      <span className="font-bold text-sm">{item.price.toLocaleString()} VT</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold">{formatPriceDisplay(total, currency)}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ──── Guest Details (only when no pre-created booking) ──── */}
            {!hasBooking && !isAuthenticated && (
              <Card className="border-border/50 shadow-lg bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ExternalLink className="h-5 w-5 text-primary" />
                    Your Details
                  </CardTitle>
                  <CardDescription>We'll send your booking confirmation to this email</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="guestName">Full Name</Label>
                    <Input id="guestName" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="John Doe" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guestEmail">Email Address</Label>
                    <Input id="guestEmail" type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="john@example.com" required />
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
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid grid-cols-2 gap-4">
                    {gateways.filter(g => g.active).map(gateway => {
                      const Icon = gatewayIcons[gateway.slug] || CreditCard;
                      const theme = gatewayThemeColors[gateway.slug] || 'peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary';
                      const isDisabled = dddConfig?.cardPaymentsDisabled && (gateway.slug === 'stripe' || gateway.slug.includes('pay'));

                      return (
                        <div key={gateway.slug} className={isDisabled ? "opacity-50 grayscale cursor-not-allowed" : ""}>
                          <RadioGroupItem value={gateway.slug} id={gateway.slug} className="peer sr-only" disabled={isDisabled} />
                          <Label htmlFor={gateway.slug} className={`flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent ${theme} cursor-pointer transition-all duration-200`}>
                            <Icon className="mb-1 h-6 w-6" />
                            <span className="font-bold text-sm mb-1">{gateway.displayName}</span>
                            {isDisabled && <span className="text-[10px] text-red-500 font-bold uppercase">Disabled</span>}
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>

                  {selectedGateway?.slug === 'manual_transfer' && (
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-800 flex flex-col items-center">
                      <Landmark className="h-8 w-8 text-blue-600 mb-2" />
                      <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Bank Transfer</h3>
                      <p className="text-sm text-blue-800 dark:text-blue-300 text-center">
                        Complete your bank transfer after placing the order. Details will be shown on the confirmation page.
                      </p>
                    </div>
                  )}

                  {selectedGateway?.slug === 'cash' && (
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
                        {isManualPaymentMethod(paymentMethod) ? "Confirming…" : "Processing…"}
                      </>
                    ) : isManualPaymentMethod(paymentMethod) ? (
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
