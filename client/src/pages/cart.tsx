import { Layout } from "@/components/layout";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trash2, ArrowRight, ShoppingBag, Clock, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useCurrency } from "@/lib/currency-context";
import { formatPriceDisplay } from "@/lib/product.types";
import type { Addon } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { fetchAddons } from "@/lib/api";
import { PricingBreakdown } from "@/components";

export default function Cart() {
  const { t } = useTranslation();
  const { items, removeFromCart, total, clearCart, isExpiringSoon, expiresAt, pricingSnapshot, isLoadingPricing } = useCart();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { currency } = useCurrency();
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: addons = [] } = useQuery<Addon[]>({
    queryKey: ["/api/addons"],
    queryFn: fetchAddons,
  });

  const getAddonName = (id: string) => {
    return addons.find((a: any) => a.id === id)?.name || id;
  };

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

    // Redirect to the unified payment page which now handles multi-item bookings
    setLocation("/payment");
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
          <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4">{t("cart.title")}</h1>

          {/* Cart Expiry Warning Banner */}
          {isExpiringSoon && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="text-amber-800 dark:text-amber-200 font-medium">
                  {t("cart.expiringWarning", "Your cart will expire soon")}
                </p>
                <p className="text-amber-600 dark:text-amber-400 text-sm">
                  {t("cart.expiringDesc", "Complete your booking within the next hour to secure your items.")}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Cart Items */}
            <div className="lg:w-2/3">
              {isLoadingPricing && items.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 flex items-center gap-3">
                  <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 animate-spin" />
                  <p className="text-blue-800 dark:text-blue-200 text-sm">Calculating prices from PricingEngine...</p>
                </div>
              )}
              <div className="space-y-4">
                {items.map((item, index) => {
                  // Phase 2C: Use backend pricing if available, fallback to deprecated client estimation
                  let finalItemSubtotal = 0;
                  let appliedRules: string[] = [];

                  if (pricingSnapshot && pricingSnapshot.items[index]) {
                    const pricedItem = pricingSnapshot.items[index];
                    finalItemSubtotal = pricedItem.breakdown.finalTotalCents;
                    appliedRules = pricedItem.breakdown.appliedRules;
                  } else {
                    // Client-side estimation (deprecated - for fallback only)
                    // Manual calculation to avoid [DEPRECATED] calculateLineTotal warning
                    finalItemSubtotal = (item.price * item.adultPax) + (item.childPrice * item.childPax) + (item.addonTotal || 0);
                    if (item.adultPax >= 7) {
                      appliedRules.push('10% group discount (7+ adults)');
                      finalItemSubtotal = Math.round(finalItemSubtotal * 0.9);
                    }
                    if (item.date) {
                      const dateObj = item.date instanceof Date ? item.date : new Date(item.date);
                      if (dateObj.getMonth() === 11 || dateObj.getMonth() === 0) {
                        appliedRules.push('20% peak season surcharge (Dec/Jan)');
                        finalItemSubtotal = Math.round(finalItemSubtotal * 1.2);
                      }
                    }
                  }

                  const dateKey = item.date ? (item.date instanceof Date ? item.date.getTime() : new Date(item.date).getTime()) : 'no-date';
                  return (
                    <Card key={`${item.id}-${index}-${dateKey}`} className="overflow-hidden border-none shadow-sm">
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
                                  <div className="flex gap-4">
                                    <p>{t("booking.adults")}: {item.adultPax}</p>
                                    <p>{t("booking.children")}: {item.childPax}</p>
                                  </div>
                                  {item.slot && <p>Slot: {item.slot}</p>}
                                  {item.addonIds && item.addonIds.length > 0 && (
                                    <div className="pt-1">
                                      <p className="font-medium text-foreground text-xs uppercase tracking-wider">{t("booking.addons", "Add-ons")}:</p>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {item.addonIds.map(id => (
                                          <span key={id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                            {getAddonName(id)}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-lg">{formatPriceDisplay(finalItemSubtotal * item.quantity, currency)}</p>
                                {appliedRules.length > 0 && (
                                  <div className="text-xs space-y-0.5 mt-1">
                                    {appliedRules.map((rule, i) => (
                                      <p key={i} className="text-green-600 dark:text-green-400 font-medium">
                                        {rule}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex justify-between items-end mt-4">
                              <div className="text-sm text-muted-foreground">
                                {item.type === 'vehicle' ? `Days: ${item.quantity}` : `Total PAX: ${item.adultPax + item.childPax}`}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => removeFromCart(item.id, item.date, item.slot)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t("cart.remove")}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
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
                  {/* Phase 3: Show detailed pricing breakdown from PricingEngine */}
                  {pricingSnapshot && (
                    <div className="mb-6">
                      <PricingBreakdown
                        pricing={pricingSnapshot}
                        currency={currency}
                        expanded={false}
                      />
                    </div>
                  )}

                  {/* Fallback to simple total if no pricing snapshot */}
                  {!pricingSnapshot && (
                    <div className="space-y-4">
                      <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2">
                        <span>{t("cart.total")}</span>
                        <span>{formatPriceDisplay(total, currency)}</span>
                      </div>
                    </div>
                  )}
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
