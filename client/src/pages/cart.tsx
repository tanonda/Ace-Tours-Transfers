import { Layout } from "@/components/layout";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trash2, ArrowRight, ShoppingBag } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { createBooking } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Cart() {
  const { t } = useTranslation();
  const { items, removeFromCart, total, clearCart } = useCart();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCheckout = async () => {
    if (!user) {
      toast({
        title: t("common.error"),
        description: "Please log in to proceed with checkout.",
        variant: "destructive"
      });
      setLocation("/login");
      return;
    }

    setIsProcessing(true);
    try {
      // Create bookings for each cart item
      const bookingPromises = items.map(async (item) => {
        const bookingData = {
          tourId: item.id,
          date: item.date ? format(item.date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
          guests: item.guests || 1,
          amount: `$${item.price * item.quantity}`,
          status: "pending",
          customerName: user.name,
          tourName: item.title,
          userId: user.id,
        };
        return createBooking(bookingData);
      });

      const bookings = await Promise.all(bookingPromises);

      // Clear cart after successful booking creation
      clearCart();

      // Redirect to payment with the first booking ID (or handle multiple if needed)
      if (bookings.length > 0) {
        setLocation(`/payment?id=${bookings[0].id}`);
      } else {
        toast({
          title: t("common.error"),
          description: "No bookings were created.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : "Failed to create bookings",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (items.length === 0) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-4 pt-40">
          <div className="bg-muted/30 p-8 rounded-full mb-6">
            <ShoppingBag className="h-12 w-12 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-serif font-bold mb-4">{t("cart.empty")}</h1>
          <p className="text-muted-foreground mb-8 text-center max-w-md">
            {t("cart.emptyDesc")}
          </p>
          <div className="flex gap-4">
            <Link href="/tours">
              <Button size="lg">{t("cart.browseTours")}</Button>
            </Link>
            <Link href="/transfers">
              <Button variant="outline" size="lg">{t("nav.viewAllTransfers")}</Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="pt-40 pb-12 bg-muted/30 min-h-screen">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-serif font-bold mb-8">{t("cart.title")}</h1>
          
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Cart Items */}
            <div className="lg:w-2/3">
              <div className="space-y-4">
                {items.map((item, index) => (
                  <Card key={`${item.id}-${index}`} className="overflow-hidden border-none shadow-sm">
                    <CardContent className="p-0">
                      <div className="flex flex-col sm:flex-row">
                        <div className="w-full sm:w-40 h-40 sm:h-auto relative">
                          <img 
                            src={item.image} 
                            alt={item.title} 
                            className="w-full h-full object-cover absolute inset-0" 
                          />
                        </div>
                        <div className="p-6 flex-grow flex flex-col justify-between">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-bold text-lg">{item.title}</h3>
                              <div className="text-sm text-muted-foreground mt-1 space-y-1">
                                {item.date && <p>{t("cart.date")}: {format(new Date(item.date), "PPP")}</p>}
                                {item.guests && <p>{t("cart.guests")}: {item.guests}</p>}
                              </div>
                            </div>
                            <p className="font-bold text-lg">${item.price}</p>
                          </div>
                          
                          <div className="flex justify-between items-end mt-4">
                            <div className="text-sm text-muted-foreground">
                              Quantity: {item.quantity}
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => removeFromCart(item.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t("cart.remove")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="mt-6 text-right">
                <Button variant="outline" onClick={clearCart} size="sm" className="text-muted-foreground">
                  Clear Cart
                </Button>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:w-1/3">
              <Card className="sticky top-24 shadow-lg border-none">
                <CardHeader>
                  <CardTitle>{t("payment.orderSummary")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${total.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Taxes & Fees</span>
                      <span>$0.00</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>{t("cart.total")}</span>
                      <span>${total.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full py-6 text-lg" size="lg" onClick={handleCheckout} disabled={isProcessing}>
                    {isProcessing ? "Processing..." : t("cart.checkout")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
