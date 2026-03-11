import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft, ShoppingCart } from "lucide-react";
import { Layout } from "@/components/layout";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useCart } from "@/lib/cart-context";

export default function PaymentCancel() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { addToCart } = useCart();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const bookingId = params.get("booking");

  useEffect(() => {
    const pendingCart = localStorage.getItem('pendingCart');
    if (pendingCart) {
      try {
        const items = JSON.parse(pendingCart);
        items.forEach((item: any) => {
          addToCart({
            id: item.id,
            title: item.title,
            price: item.price,
            childPrice: item.childPrice || 0,
            image: item.image,
            date: item.date,
            adultPax: item.adultPax || item.guests || 1,
            childPax: item.childPax || 0,
            infantPax: item.infantPax || 0,
            petPax: item.petPax || 0,
            type: item.type || "tour",
          });
        });
        localStorage.removeItem('pendingCart');
      } catch (e) {
        console.error("Failed to restore cart:", e);
      }
    }
  }, [addToCart]);

  return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center p-4 pt-40">
        <div className="w-full max-w-md space-y-4">
          {/* Ace Tours Brand Identity */}
          <div className="flex items-center justify-center gap-3 mb-2">
            <img src="/assets/logo.png" alt="Ace Tours & Transfers" className="h-10 w-10 rounded-full border border-[#f4a830]/30" />
            <div className="text-center">
              <p className="text-sm font-semibold text-[#f4a830] tracking-wide">Ace Tours & Transfers</p>
              <p className="text-[10px] text-muted-foreground">Vanuatu</p>
            </div>
          </div>

          <Card className="w-full text-center shadow-lg overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400" />
            <CardHeader>
              <div className="mx-auto bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full w-fit mb-4">
                <XCircle className="h-12 w-12 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle className="text-2xl text-amber-600 dark:text-amber-400">
                {t("payment.cancelled") || "Payment Cancelled"}
              </CardTitle>
              <CardDescription className="text-base">
                {t("payment.cancelledDesc") || "Your payment was not completed. No charges have been made to your account."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t("payment.tryAgain") || "You can try again or choose a different payment method. Your cart has been restored."}
              </p>
              <p className="text-xs text-muted-foreground mt-3 italic">
                Need help? We're just a message away — our team is happy to assist you.
              </p>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button className="w-full" size="lg" onClick={() => setLocation("/payment")} data-testid="button-try-again">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("payment.retryPayment") || "Try Payment Again"}
              </Button>
              <Link href="/cart" className="w-full">
                <Button variant="outline" className="w-full" data-testid="button-back-to-cart">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {t("cart.title") || "Back to Cart"}
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
