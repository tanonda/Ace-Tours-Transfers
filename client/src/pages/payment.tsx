import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, Lock, CreditCard, Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/lib/cart-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelector } from "@/components/language-selector";
import { useTranslation } from "react-i18next";

export default function Payment() {
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { total, clearCart } = useCart();
  const { t } = useTranslation();

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate payment processing delay
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Payment Successful",
        description: "Your booking has been confirmed via ANZ eGate.",
      });
      clearCart();
      setLocation("/");
    }, 2000);
  };

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
        {/* ANZ Branding Header */}
        <div className="bg-[#004165] text-white p-4 rounded-t-lg flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <div className="bg-white text-[#004165] font-bold p-1 rounded text-xs">ANZ</div>
            <h1 className="font-semibold text-lg">eGate</h1>
          </div>
          <div className="flex items-center gap-1 text-xs opacity-90">
            <Lock className="h-3 w-3" />
            <span>Secure Payment</span>
          </div>
        </div>

        <Card className="rounded-t-none border-t-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl text-[#004165]">{t("payment.title")}</CardTitle>
            <CardDescription>
              {t("payment.paymentDetails")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 p-4 rounded-md mb-6 border border-border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Merchant</span>
                <span className="font-medium text-foreground">Vanuatu Tours & Transfers</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Order ID</span>
                <span className="font-medium font-mono text-foreground">ORD-{Math.floor(Math.random() * 10000)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[#004165]">Total Amount</span>
                <span className="font-bold text-lg text-[#004165]">${total > 0 ? total.toLocaleString() : "15,000 VUV"}</span>
              </div>
            </div>

            <form onSubmit={handlePayment} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cardName">{t("payment.nameOnCard")}</Label>
                <Input id="cardName" placeholder="As shown on card" required />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cardNumber">{t("payment.cardNumber")}</Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input id="cardNumber" className="pl-9" placeholder="0000 0000 0000 0000" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiry">{t("payment.expiryDate")}</Label>
                  <Input id="expiry" placeholder="MM/YY" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvv">{t("payment.cvv")}</Label>
                  <Input id="cvv" placeholder="123" maxLength={4} required />
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  type="submit" 
                  className="w-full bg-[#004165] hover:bg-[#00304d] text-white py-6 text-lg"
                  disabled={isLoading}
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
              </div>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 bg-slate-50 border-t">
            <div className="flex items-center justify-center gap-4 w-full opacity-60 grayscale">
               {/* Payment Icons placeholders */}
               <div className="h-8 w-12 bg-slate-200 rounded flex items-center justify-center text-[10px] font-bold">VISA</div>
               <div className="h-8 w-12 bg-slate-200 rounded flex items-center justify-center text-[10px] font-bold">MC</div>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-3 w-3" />
              <span>Payments processed securely by ANZ eGate</span>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
