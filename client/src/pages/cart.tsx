import { Layout } from "@/components/layout";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trash2, ArrowRight, ShoppingBag, Clock, AlertTriangle, CheckCircle2, Loader2, Users, MapPin, Car, Calendar, Shield } from "lucide-react";
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

const CATEGORY_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  tour: { label: "Tour", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: <MapPin className="h-3 w-3" /> },
  transfer: { label: "Transfer", color: "bg-green-500/15 text-green-400 border-green-500/30", icon: <Car className="h-3 w-3" /> },
};

export default function Cart() {
  const { t } = useTranslation();
  const { items, removeFromCart, total, clearCart, isExpiringSoon, expiresAt, pricingSnapshot, isLoadingPricing } = useCart();

  // Client-side fallback total when pricing service is unavailable
  const clientSideTotal = items.reduce((sum, item) => {
    let subtotal = (item.price * item.adultPax) + (item.childPrice * item.childPax) + (item.addonTotal || 0);
    if (item.adultPax >= 7) subtotal = Math.round(subtotal * 0.9);
    if (item.date) {
      const m = (item.date instanceof Date ? item.date : new Date(item.date)).getMonth();
      if (m === 11 || m === 0) subtotal = Math.round(subtotal * 1.2);
    }
    return sum + subtotal * item.quantity;
  }, 0);
  const displayTotal = pricingSnapshot ? total : clientSideTotal;
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
    // Navigate to the new checkout step to capture guest details
    setLocation("/checkout");
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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-serif font-bold">{t("cart.title")}</h1>
              <p className="text-muted-foreground text-sm mt-1">{items.length} item{items.length !== 1 ? "s" : ""} in your cart</p>
            </div>
            <Button variant="outline" onClick={clearCart} size="sm" className="text-muted-foreground">
              Clear Cart
            </Button>
          </div>

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
                  // Use backend pricing if available, fallback to client estimation
                  let finalItemSubtotal = 0;
                  let appliedRules: string[] = [];

                  if (pricingSnapshot && pricingSnapshot.items[index]) {
                    const pricedItem = pricingSnapshot.items[index];
                    finalItemSubtotal = pricedItem.breakdown?.finalTotalCents ?? ((item.price * item.adultPax) + (item.childPrice * item.childPax) + (item.addonTotal || 0));
                    appliedRules = pricedItem.breakdown?.appliedRules ?? [];
                  } else {
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
                  const cat = CATEGORY_LABELS[item.type] || CATEGORY_LABELS.tour;

                  return (
                    <Card key={`${item.id}-${index}-${dateKey}`} className="overflow-hidden border-none shadow-sm">
                      <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row">
                          <div className="w-full sm:w-48 h-40 sm:h-auto relative">
                            <img
                              src={item.image}
                              alt={item.title}
                              className="w-full h-full object-cover absolute inset-0"
                            />
                            {/* Category badge overlay */}
                            <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full border text-[0.7rem] font-bold flex items-center gap-1.5 backdrop-blur-sm ${cat.color}`}>
                              {cat.icon} {cat.label}
                            </span>
                          </div>
                          <div className="p-5 flex-grow flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1 mr-4">
                                <h3 className="font-bold text-lg leading-tight mb-2">{item.title}</h3>

                                {/* Date & Time */}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                  {item.date && (
                                    <span className="flex items-center gap-1.5">
                                      <Calendar className="h-3.5 w-3.5 text-primary/60" />
                                      {format(new Date(item.date), "EEE, d MMM yyyy")}
                                    </span>
                                  )}
                                  {item.startTime && (
                                    <span className="flex items-center gap-1.5">
                                      <Clock className="h-3.5 w-3.5 text-primary/60" />
                                      {item.startTime}{item.endTime ? ` – ${item.endTime}` : ""}
                                    </span>
                                  )}
                                </div>

                                {/* Pax Breakdown */}
                                <div className="flex flex-wrap gap-3 mt-2">
                                  <span className="flex items-center gap-1.5 text-sm">
                                    <Users className="h-3.5 w-3.5 text-primary/60" />
                                    {item.adultPax} adult{item.adultPax !== 1 ? "s" : ""}
                                    {item.childPax > 0 && `, ${item.childPax} child${item.childPax !== 1 ? "ren" : ""}`}
                                    {item.infantPax > 0 && `, ${item.infantPax} infant${item.infantPax !== 1 ? "s" : ""}`}
                                    {item.petPax > 0 && `, ${item.petPax} pet${item.petPax !== 1 ? "s" : ""}`}
                                  </span>
                                </div>

                                {/* Per-tier pricing */}
                                <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                                  <span>{item.adultPax} × {formatPriceDisplay(item.price, currency)}/adult</span>
                                  {item.childPax > 0 && item.childPrice > 0 && (
                                    <span>{item.childPax} × {formatPriceDisplay(item.childPrice, currency)}/child</span>
                                  )}
                                  {item.childPax > 0 && item.childPrice === 0 && (
                                    <span className="text-green-500">Children: Free</span>
                                  )}
                                </div>

                                {/* Add-ons */}
                                {item.addonIds && item.addonIds.length > 0 && (
                                  <div className="pt-2">
                                    <div className="flex flex-wrap gap-1">
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

                              {/* Price column */}
                              <div className="text-right shrink-0">
                                <p className="font-bold text-lg">{formatPriceDisplay(finalItemSubtotal * item.quantity, currency)}</p>
                                <p className="text-[0.65rem] text-muted-foreground uppercase tracking-tight">Incl. 15% VAT</p>
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

                            {/* Bottom row */}
                            <div className="flex justify-between items-end mt-3 pt-3 border-t border-border/40">
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Shield className="h-3 w-3" />
                                  Free cancellation
                                </span>
                                <span className="flex items-center gap-1">🔒 Instant confirm</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => removeFromCart(item.cartItemId)}
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
            </div>

            {/* Order Summary */}
            <div className="lg:w-1/3">
              <Card className="sticky top-24 shadow-lg border-none overflow-hidden">
                {/* Accent bar */}
                <div className="h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/40" />
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Order Summary</span>
                    <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {items.length} item{items.length !== 1 ? "s" : ""}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0 pb-4">

                  {/* Per-item summary rows */}
                  {isLoadingPricing ? (
                    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      <span>{t("cart.calculatingFinalPrice", "Calculating final price…")}</span>
                    </div>
                  ) : (
                    <div className="space-y-3 mb-4">
                      {items.map((item, index) => {
                        let lineTotal = 0;
                        if (pricingSnapshot && pricingSnapshot.items[index]) {
                          lineTotal = pricingSnapshot.items[index].breakdown?.finalTotalCents ?? ((item.price * item.adultPax) + (item.childPrice * item.childPax) + (item.addonTotal || 0));
                        } else {
                          lineTotal = (item.price * item.adultPax) + (item.childPrice * item.childPax) + (item.addonTotal || 0);
                        }
                        const cat = CATEGORY_LABELS[item.type] || CATEGORY_LABELS.tour;
                        return (
                          <div key={item.cartItemId} className="text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium leading-tight truncate">{item.title}</p>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[0.65rem] font-semibold ${cat.color}`}>
                                    {cat.icon} {cat.label}
                                  </span>
                                  {item.date && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {format(new Date(item.date), "d MMM")}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {item.adultPax}A{item.childPax > 0 ? `, ${item.childPax}C` : ""}
                                  </span>
                                </div>
                              </div>
                              <span className="font-semibold whitespace-nowrap shrink-0">
                                {formatPriceDisplay(lineTotal * item.quantity, currency)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Applied pricing rules / discounts */}
                  {!isLoadingPricing && pricingSnapshot && (() => {
                    const allRules = Array.from(new Set(
                      pricingSnapshot.items.flatMap((i: any) => i.breakdown?.appliedRules ?? [])
                    ));
                    if (allRules.length === 0) return null;
                    return (
                      <div className="mb-3 space-y-1">
                        {allRules.map((rule: any, i: number) => (
                          <p key={i} className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 shrink-0" /> {rule}
                          </p>
                        ))}
                      </div>
                    );
                  })()}

                  <Separator className="my-3" />

                  {/* Total */}
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold text-sm">{t("cart.total", "Total")}</span>
                    <div className="text-right">
                      <p className="text-xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                        {formatPriceDisplay(displayTotal, currency)}
                      </p>
                      <p className="text-[0.6rem] text-muted-foreground">Incl. 15% VAT</p>
                    </div>
                  </div>

                  {!pricingSnapshot && !isLoadingPricing && (
                    <p className="text-[0.65rem] text-muted-foreground text-center mt-1">Estimated — confirmed at payment</p>
                  )}

                  <Separator className="my-3" />

                  {/* What happens next — clear flow indicator */}
                  <div className="rounded-lg bg-muted/40 border border-border/40 p-3 mb-3">
                    <p className="text-[0.7rem] font-semibold text-muted-foreground uppercase tracking-wider mb-2">What happens next</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center shrink-0">1</span>
                        <span>Enter your contact details</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="h-5 w-5 rounded-full bg-primary/30 text-foreground text-[10px] font-black flex items-center justify-center shrink-0">2</span>
                        <span>Choose your payment method</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="h-5 w-5 rounded-full bg-muted text-muted-foreground text-[10px] font-black flex items-center justify-center shrink-0">3</span>
                        <span>Receive instant confirmation by email</span>
                      </div>
                    </div>
                  </div>

                  {/* Trust signals */}
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      <span>Free cancellation up to 24h before</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>Instant confirmation by email</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <span>No account required — guest checkout</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-0 flex-col gap-2">
                  <Button
                    className="w-full py-6 text-base font-bold"
                    size="lg"
                    onClick={handleCheckout}
                    disabled={isProcessing || isLoadingPricing}
                  >
                    {isProcessing ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…</>
                    ) : (
                      <>Proceed to Checkout <ArrowRight className="ml-2 h-4 w-4" /></>
                    )}
                  </Button>
                  <p className="text-[0.65rem] text-muted-foreground text-center">
                    🔒 Secure checkout — 256-bit encryption
                  </p>
                </CardFooter>
              </Card>

              {/* Add more products link */}
              <div className="mt-4 text-center space-y-2">
                <p className="text-xs text-muted-foreground">Want to add more to your order?</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <Link href="/tours">
                    <Button variant="outline" size="sm" className="text-xs h-8">+ Browse Tours</Button>
                  </Link>
                  <Link href="/transfers">
                    <Button variant="outline" size="sm" className="text-xs h-8">+ Transfers</Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
