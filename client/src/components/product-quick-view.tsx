import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Check, ShoppingCart, X, Star, MapPin } from "lucide-react";
import { useState, useEffect } from "react";
import { useCart } from "@/lib/cart-context";
import { usePrefillFromCart } from "@/lib/booking-state-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import { formatPriceDisplay, type ProductCategory } from "@/lib/product.types";
import { useCurrency } from "@/lib/currency-context";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

interface BookableProduct {
  id: string;
  title: string;
  category?: ProductCategory;
  description?: string | string[];
  adultPriceCents: number;
  childPriceCents?: number;
  image?: string;
  duration?: string;
  minPax?: number | string;
}

interface ProductQuickViewProps {
  isOpen: boolean;
  onClose: () => void;
  product: BookableProduct | null;
}

export function ProductQuickView({ isOpen, onClose, product }: ProductQuickViewProps) {
  const { addToCart } = useCart();
  const { t } = useTranslation();
  const { currency } = useCurrency();

  const prefill = usePrefillFromCart(product?.id || "");
  const [adultPax, setAdultPax] = useState(String(prefill.adultPax));
  const [childPax, setChildPax] = useState(String(prefill.childPax));
  const [date, setDate] = useState(prefill.date);

  useEffect(() => {
    if (isOpen && product) {
      setAdultPax(String(prefill.adultPax));
      setChildPax(String(prefill.childPax));
      setDate(prefill.date);
    }
  }, [isOpen, product?.id, prefill.adultPax, prefill.childPax, prefill.date]);

  if (!product) return null;

  const descArray = Array.isArray(product.description) ? product.description : [];
  const descText = typeof product.description === "string" ? product.description : descArray[0] || "";
  const included = descArray.length > 1 ? descArray.slice(1) : descArray;

  const detailHref = product.category === "transfer"
    ? `/transfers/${product.id}`
    : `/tours/${product.id}`;

  const handleAddToCart = () => {
    addToCart({
      id: product.id,
      title: product.title,
      price: product.adultPriceCents,
      childPrice: product.childPriceCents || 0,
      image: product.image || "",
      type: (product.category || "tour") as ProductCategory,
      adultPax: parseInt(adultPax) || 1,
      childPax: parseInt(childPax) || 0,
      infantPax: 0,
      petPax: 0,
      date: date ? new Date(date) : new Date(),
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
          <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden gap-0 bg-[#141210] border-[rgba(244,168,48,0.15)] rounded-2xl shadow-2xl">
            <div className="flex flex-col lg:flex-row h-full max-h-[90vh]">

              {/* ── Image panel ── */}
              <div className="relative w-full lg:w-[45%] h-56 lg:h-auto shrink-0 bg-[#211e18]">
                {product.image ? (
                  <img src={product.image} alt={(product as any).imageAlt || product.title} className="w-full h-full object-cover object-center" />
                ) : (
                  <div className="w-full h-full bg-[#211e18]" />
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#141210] via-transparent to-transparent lg:bg-gradient-to-r" />

                {/* Price badge */}
                <div className="absolute top-4 left-4">
                  <div className="bg-[#f2800d] text-white font-black text-base px-4 py-1.5 rounded-full shadow-lg">
                    {formatPriceDisplay(product.adultPriceCents, currency)}
                    <span className="text-white/70 font-normal text-xs ml-1">/ adult</span>
                  </div>
                </div>

                {/* Close button */}
                <button onClick={onClose}
                  className="absolute top-4 right-4 h-9 w-9 rounded-full bg-black/40 hover:bg-black/70 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all backdrop-blur-sm">
                  <X className="h-4 w-4" />
                </button>

                {/* Category tag */}
                <div className="absolute bottom-4 left-4">
                  <Badge className="bg-white/10 text-white border border-white/20 backdrop-blur-sm capitalize text-xs font-semibold">
                    {product.category || "tour"}
                  </Badge>
                </div>
              </div>

              {/* ── Content panel ── */}
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                  {/* Stars + title */}
                  <div>
                    <div className="flex text-[#f2800d] mb-2 gap-0.5">
                      {[1, 2, 3, 4, 5].map(i => <Star key={i} className="h-4 w-4 fill-current" />)}
                    </div>
                    <h2 className="font-serif text-2xl lg:text-3xl font-bold text-white leading-tight">{product.title}</h2>
                  </div>

                  {/* Meta row */}
                  <div className="flex flex-wrap gap-4 text-sm text-[#8a826e]">
                    {product.duration && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-[#f2800d]" />
                        <span>{product.duration}</span>
                      </div>
                    )}
                    {product.minPax && (
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-[#f2800d]" />
                        <span>{product.minPax}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-[#f2800d]" />
                      <span>Port Vila, Vanuatu</span>
                    </div>
                  </div>

                  {/* Description */}
                  {descText && (
                    <p className="text-[#ccc6b8] text-sm leading-relaxed">{descText}</p>
                  )}

                  {/* What's included */}
                  {included.length > 0 && (
                    <div className="bg-[#1a1710] border border-[rgba(244,168,48,0.12)] rounded-xl p-4">
                      <div className="text-xs font-black uppercase tracking-widest text-[#f2800d] mb-3">
                        {t("quickView.whatsIncluded", "What's Included")}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {included.map((item: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-[#8a826e]">
                            <div className="w-4 h-4 rounded-full bg-[#4caf7d]/15 border border-[#4caf7d] flex items-center justify-center shrink-0 mt-0.5">
                              <Check className="h-2.5 w-2.5 text-[#4caf7d]" />
                            </div>
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pricing */}
                  <div className="bg-[#1a1710] border border-[rgba(244,168,48,0.12)] rounded-xl p-4">
                    <div className="text-xs font-black uppercase tracking-widest text-[#f2800d] mb-3">
                      {t("quickView.ratesOptions", "Rates")}
                    </div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-[#8a826e]">{t("quickView.adult", "Adult")}</span>
                      <span className="text-white font-bold">{formatPriceDisplay(product.adultPriceCents, currency)}</span>
                    </div>
                    {(product.childPriceCents || 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-[#8a826e]">{t("quickView.child", "Child (under 12)")}</span>
                        <span className="text-white font-bold">{formatPriceDisplay(product.childPriceCents || 0, currency as any)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Booking footer ── */}
                <div className="border-t border-[rgba(244,168,48,0.12)] bg-[#1a1710] p-5">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-[#8a826e] uppercase tracking-wider">{t("booking.adults", "Adults")}</Label>
                      <Input type="number" min="1" value={adultPax} onChange={(e) => setAdultPax(e.target.value)}
                        className="bg-[#141210] border-[rgba(244,168,48,0.2)] text-white h-9 focus:border-[#f2800d]" />
                    </div>
                    {(product.childPriceCents || 0) > 0 && (
                      <div className="space-y-1">
                        <Label className="text-xs text-[#8a826e] uppercase tracking-wider">{t("booking.children", "Children")}</Label>
                        <Input type="number" min="0" value={childPax} onChange={(e) => setChildPax(e.target.value)}
                          className="bg-[#141210] border-[rgba(244,168,48,0.2)] text-white h-9 focus:border-[#f2800d]" />
                      </div>
                    )}
                    <div className={(product.childPriceCents || 0) > 0 ? "" : "col-span-2"}>
                      <Label className="text-xs text-[#8a826e] uppercase tracking-wider mb-1 block">{t("cart.date", "Date")}</Label>
                      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                        className="bg-[#141210] border-[rgba(244,168,48,0.2)] text-white h-9 focus:border-[#f2800d]" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={handleAddToCart} className="flex-1 bg-[#f2800d] hover:bg-[#ff8c1a] text-white font-bold h-11 rounded-xl shadow-[0_4px_16px_rgba(242,128,13,0.35)]">
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      {t("cart.addToCart", "Add to Cart")}
                    </Button>
                    <Link href={detailHref}>
                      <Button variant="outline" onClick={onClose}
                        className="border-[rgba(244,168,48,0.3)] text-[#f2800d] hover:bg-[rgba(244,168,48,0.08)] h-11 rounded-xl whitespace-nowrap">
                        Full Details
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
