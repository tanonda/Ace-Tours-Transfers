
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ShieldCheck, Lock, CreditCard, Loader2, ArrowLeft,
  Building, Banknote, Wallet, Globe, Smartphone,
  Store, Landmark, DollarSign, ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
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
    if (id) setBookingId(id);
  }, []);

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

  const initiatePaymentMutation = useMutation({
    mutationFn: async (data: { bookingId: string; provider: string; successUrl: string; cancelUrl: string; }) => {
      const res = await apiRequest("POST", "/api/payments/checkout", data);
      return res.json();
    },
    onSuccess: (data) => {
      clearCart();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        // Manual payment (bank transfer / cash) - redirect to success page
        const bId = data.bookingId || bookingId;
        setLocation(`/payment/success?booking=${bId}&manual=true&method=${data.provider || paymentMethod}`);
      }
    },
  });

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated && (!guestName || !guestEmail)) {
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

        // SERVER-SIDE PRICE VALIDATION: Verify cart total matches server calculation
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

          // Allow small rounding differences (< 1 unit)
          if (Math.abs(serverTotal - clientTotal) > 100) {
            toast({
              title: "Price Updated",
              description: `The total has been updated to ${formatPriceDisplay(serverTotal, currency)}. Please review before continuing.`,
              variant: "default"
            });
            // Could trigger a cart refresh here if needed
            console.warn(`[PRICE MISMATCH] Client: ${clientTotal}, Server: ${serverTotal}`);
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

  if (isLoadingGateways) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 safe-bottom">
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setLocation("/cart")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {t("cart.title")}
        </Button>
        <div className="flex items-center gap-2">
          <LanguageSelector />
          <ThemeToggle size="sm" />
        </div>
      </div>

      <div className="w-full max-w-md">
        <div className={`text-white p-4 rounded-t-lg flex items-center justify-between shadow-md transition-colors duration-300 ${currentThemeColor.replace('peer-data-[state=checked]:border', 'bg').replace('peer-data-[state=checked]:text', '')}`}>
          <div className="flex items-center gap-2">
            <CurrentIcon className="h-5 w-5" />
            <h1 className="font-semibold text-lg">{selectedGateway?.displayName || t("payment.securePayment")}</h1>
          </div>
          <div className="flex items-center gap-1 text-xs opacity-90"><Lock className="h-3 w-3" /><span>Encrypted</span></div>
        </div>

        <Card className="rounded-t-none border-t-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">{t("payment.title")}</CardTitle>
            <CardDescription>Select your preferred payment method</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 p-4 rounded-md mb-6 border border-border">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total Amount</span>
                <span className="font-bold text-lg">{formatPriceDisplay(total, currency)}</span>
              </div>
            </div>

            {!isAuthenticated && !bookingId && (
              <div className="space-y-4 mb-6 p-4 border rounded-lg bg-primary/5">
                <h3 className="font-semibold text-sm flex items-center gap-2"><ExternalLink className="h-4 w-4" />Continue as Guest</h3>
                <div className="space-y-2">
                  <Label htmlFor="guestName">Full Name</Label>
                  <Input id="guestName" value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guestEmail">Email Address</Label>
                  <Input id="guestEmail" type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} required />
                </div>
              </div>
            )}

            <form onSubmit={handlePayment} className="space-y-4">
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid grid-cols-2 gap-4 mb-6">
                {gateways.filter(g => g.active).map(gateway => {
                  const Icon = gatewayIcons[gateway.slug] || CreditCard;
                  const theme = gatewayThemeColors[gateway.slug] || 'peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary';
                  const isDisabled = dddConfig?.cardPaymentsDisabled && (gateway.slug === 'stripe' || gateway.slug.includes('pay'));

                  return (
                    <div key={gateway.slug} className={isDisabled ? "opacity-50 grayscale cursor-not-allowed" : ""}>
                      <RadioGroupItem value={gateway.slug} id={gateway.slug} className="peer sr-only" disabled={isDisabled} />
                      <Label htmlFor={gateway.slug} className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent ${theme} cursor-pointer`}>
                        <Icon className="mb-1 h-6 w-6" />
                        <span className="font-bold text-sm mb-1">{gateway.displayName}</span>
                        {isDisabled && <span className="text-[10px] text-red-500 font-bold uppercase">Disabled</span>}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>

              {selectedGateway?.slug === 'manual_transfer' && (
                <div className="rounded-md bg-blue-50 p-4 border border-blue-100 mb-4 flex flex-col items-center">
                  <Landmark className="h-8 w-8 text-blue-600 mb-2" />
                  <h3 className="font-semibold text-blue-900 mb-2">Bank Transfer Details</h3>
                  <p className="text-sm text-blue-800 text-center">Refer to confirmation email for bank account details.</p>
                </div>
              )}

              {selectedGateway?.slug === 'cash' && (
                <div className="rounded-md bg-green-50 p-4 border border-green-100 mb-4 flex flex-col items-center">
                  <Banknote className="h-8 w-8 text-green-600 mb-2" />
                  <h3 className="font-semibold text-green-900 mb-2">Cash on Delivery</h3>
                  <p className="text-sm text-green-800 text-center">Please pay at the start of your tour or vehicle pickup.</p>
                </div>
              )}

              <Button type="submit" className={`w-full py-6 text-lg text-white ${currentThemeColor.replace('peer-data-[state=checked]:border', 'bg').replace('peer-data-[state=checked]:text', 'hover:bg')}`} disabled={initiatePaymentMutation.isPending || createBookingMutation.isPending}>
                {(initiatePaymentMutation.isPending || createBookingMutation.isPending) ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <><CreditCard className="mr-2 h-5 w-5" /> {t("payment.pay")}</>}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 bg-slate-50 border-t">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-3 w-3" />
              <span>Payments processed securely</span>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
