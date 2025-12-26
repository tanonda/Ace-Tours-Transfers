import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ShieldCheck, Lock, CreditCard, Loader2, ArrowLeft, ExternalLink, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelector } from "@/components/language-selector";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";

type PaymentMethod = "card" | "local_bank";

const resolveGateway = (method: PaymentMethod): string => {
  switch (method) {
    case "card":
      return "stripe";
    case "local_bank":
      return "anz-egate";
    default:
      return "stripe";
  }
};

export default function Payment() {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("card");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { items, total, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { t } = useTranslation();

  const createBookingMutation = useMutation({
    mutationFn: async (item: typeof items[0]) => {
      const priceNum = typeof item.price === 'number' ? item.price : parseFloat(String(item.price).replace(/[^0-9.]/g, '')) || 0;
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId: user?.id,
          tourId: item.id,
          tourName: item.title,
          customerName: user?.name || "Guest",
          date: item.date || new Date().toISOString().split("T")[0],
          guests: item.guests || 1,
          amount: `$${priceNum}`,
          status: "pending",
        }),
      });
      if (!res.ok) throw new Error("Failed to create booking");
      return res.json();
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const gateway = resolveGateway(selectedMethod);
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bookingId,
          provider: gateway,
        }),
      });
      if (!res.ok) throw new Error("Failed to create checkout session");
      return res.json();
    },
  });

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      toast({
        title: t("auth.loginRequired"),
        description: "Please log in to complete your purchase.",
        variant: "destructive",
      });
      setLocation("/login");
      return;
    }

    if (items.length === 0) {
      toast({
        title: "Cart is empty",
        description: "Please add items to your cart before checkout.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const bookingPromises = items.map(item => createBookingMutation.mutateAsync(item));
      const bookings = await Promise.all(bookingPromises);
      
      const primaryBooking = bookings[0];
      const paymentIntent = await checkoutMutation.mutateAsync(primaryBooking.id);
      
      if (paymentIntent.checkoutUrl) {
        localStorage.setItem('pendingCart', JSON.stringify(items));
        clearCart();
        window.location.href = paymentIntent.checkoutUrl;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast({
        title: "Checkout Failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleBankPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Payment Submitted",
        description: "Your payment is being processed.",
      });
      clearCart();
      setLocation("/payment/success?booking=demo");
    }, 2000);
  };

  const isCardMethod = selectedMethod === "card";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => setLocation("/cart")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {t("cart.title")}
        </Button>
        <div className="flex items-center gap-2">
          <LanguageSelector />
          <ThemeToggle size="sm" />
        </div>
      </div>
      <div className="w-full max-w-md">
        <div className="bg-primary text-primary-foreground p-4 rounded-t-lg flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-lg">{t("payment.title")}</h1>
          </div>
          <div className="flex items-center gap-1 text-xs opacity-90">
            <Lock className="h-3 w-3" />
            <span>Secure Payment</span>
          </div>
        </div>

        <Card className="rounded-t-none border-t-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">{t("payment.selectMethod") || "Choose Payment Method"}</CardTitle>
            <CardDescription>
              {t("payment.paymentDetails")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 p-4 rounded-md mb-6 border border-border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Merchant</span>
                <span className="font-medium text-foreground">Ace Tours & Transfers</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Items</span>
                <span className="font-medium text-foreground">{items.length} item(s)</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total Amount</span>
                <span className="font-bold text-lg">${total > 0 ? total.toLocaleString() : "0"}</span>
              </div>
            </div>

            <div className="mb-6">
              <RadioGroup value={selectedMethod} onValueChange={(v) => setSelectedMethod(v as PaymentMethod)} className="space-y-3">
                <div 
                  className={`flex items-center space-x-3 border-2 rounded-lg p-4 cursor-pointer transition-all ${selectedMethod === "card" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"}`}
                  onClick={() => setSelectedMethod("card")}
                >
                  <RadioGroupItem value="card" id="card" data-testid="radio-method-card" />
                  <div className="flex-grow">
                    <Label htmlFor="card" className="cursor-pointer flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <span className="font-medium block">{t("payment.payByCard") || "Pay by Card"}</span>
                        <span className="text-xs text-muted-foreground">Credit or Debit Card</span>
                      </div>
                    </Label>
                  </div>
                  <div className="flex gap-1">
                    <div className="h-6 w-9 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center text-[8px] font-bold border">VISA</div>
                    <div className="h-6 w-9 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center text-[8px] font-bold border">MC</div>
                  </div>
                </div>

                <div 
                  className={`flex items-center space-x-3 border-2 rounded-lg p-4 cursor-pointer transition-all ${selectedMethod === "local_bank" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"}`}
                  onClick={() => setSelectedMethod("local_bank")}
                >
                  <RadioGroupItem value="local_bank" id="local_bank" data-testid="radio-method-bank" />
                  <div className="flex-grow">
                    <Label htmlFor="local_bank" className="cursor-pointer flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <span className="font-medium block">{t("payment.payByBank") || "Pay by Local Bank"}</span>
                        <span className="text-xs text-muted-foreground">Vanuatu Bank Transfer</span>
                      </div>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {isCardMethod ? (
              <div className="pt-4">
                <Button 
                  className="w-full py-6 text-lg"
                  disabled={isLoading || items.length === 0}
                  onClick={handleCheckout}
                  data-testid="button-checkout"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {t("payment.processing")}
                    </>
                  ) : (
                    <>
                      {t("payment.pay")}
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Secure card payment - you'll be redirected to complete
                </p>
              </div>
            ) : (
              <form onSubmit={handleBankPayment} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cardName">{t("payment.nameOnCard")}</Label>
                  <Input id="cardName" placeholder="As shown on card" required data-testid="input-card-name" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cardNumber">{t("payment.cardNumber")}</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input id="cardNumber" className="pl-9" placeholder="0000 0000 0000 0000" required data-testid="input-card-number" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiry">{t("payment.expiryDate")}</Label>
                    <Input id="expiry" placeholder="MM/YY" required data-testid="input-expiry" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cvv">{t("payment.cvv")}</Label>
                    <Input id="cvv" placeholder="123" maxLength={4} required data-testid="input-cvv" />
                  </div>
                </div>

                <div className="pt-4">
                  <Button 
                    type="submit" 
                    className="w-full py-6 text-lg"
                    disabled={isLoading || items.length === 0}
                    data-testid="button-bank-pay"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        {t("payment.processing")}
                      </>
                    ) : (
                      t("payment.pay")
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-3">
                    You'll be redirected to complete payment
                  </p>
                </div>
              </form>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4 bg-muted/30 border-t">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              <span>Your payment information is encrypted and secure</span>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
