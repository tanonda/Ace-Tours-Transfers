import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star, Clock, Users, Check, ShoppingCart } from "lucide-react";
import { useState, useEffect } from "react";
import { useCart } from "@/lib/cart-context";
import { usePrefillFromCart } from "@/lib/booking-state-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { formatPriceDisplay, type ProductCategory } from "@/lib/product.types";

// Fix #14: Typed product interface replacing the previous `any` prop.
// Covers the shared fields across Tour, Transfer, and Vehicle types.
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
import { useCurrency } from "@/lib/currency-context";

interface ProductQuickViewProps {
  isOpen: boolean;
  onClose: () => void;
  // Fix #14: Use BookableProduct instead of `any` so type errors are caught at compile time
  product: BookableProduct | null;
}

export function ProductQuickView({ isOpen, onClose, product }: ProductQuickViewProps) {
  const { addToCart } = useCart();
  const { t } = useTranslation();
  const { currency } = useCurrency();

  // Get prefilled values from cart if this product is already in cart
  const prefill = usePrefillFromCart(product?.id || "");
  const [adultPax, setAdultPax] = useState(String(prefill.adultPax));
  const [childPax, setChildPax] = useState(String(prefill.childPax));
  const [date, setDate] = useState(prefill.date);

  // Reset form when product changes or dialog opens
  useEffect(() => {
    if (isOpen && product) {
      setAdultPax(String(prefill.adultPax));
      setChildPax(String(prefill.childPax));
      setDate(prefill.date);
    }
  }, [isOpen, product?.id, prefill.adultPax, prefill.childPax, prefill.date]);

  if (!product) return null;

  const handleAddToCart = () => {
    addToCart({
      id: product.id,
      title: product.title,
      price: product.adultPriceCents,
      childPrice: product.childPriceCents || 0,
      image: product.image,
      type: (product.category || "tour") as ProductCategory,
      adultPax: parseInt(adultPax),
      childPax: parseInt(childPax),
      date: date ? new Date(date) : new Date(),
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[90vw] p-0 overflow-hidden gap-0 h-[80vh] md:h-auto">
        <div className="flex flex-col md:flex-row h-full">
          {/* Image Side */}
          <div className="w-full md:w-1/2 relative h-48 md:h-auto">
            {product.image && (
              <img
                src={product.image}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute top-4 left-4">
              <Badge className="bg-background/90 text-foreground hover:bg-background font-bold shadow-sm backdrop-blur-sm border border-border/50">
                {formatPriceDisplay(product.adultPriceCents, currency)}
              </Badge>
            </div>
          </div>

          {/* Content Side */}
          <div className="w-full md:w-1/2 flex flex-col h-full max-h-[calc(80vh-12rem)] md:max-h-[600px]">
            <ScrollArea className="flex-grow p-6">
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex text-yellow-400">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">({t("quickView.reviews", "12 reviews")})</span>
                </div>
                <DialogTitle className="text-3xl font-serif font-bold mb-2">{product.title}</DialogTitle>
                <DialogDescription>{t("quickView.description", "A quick look at the tour details and options.")}</DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-4 text-muted-foreground text-sm mb-6">
                {product.duration && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{product.duration}</span>
                  </div>
                )}
                {product.minPax && (
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{product.minPax}</span>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-3">{t("quickView.overview", "Overview")}</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    {typeof product.description === 'string'
                      ? product.description
                      : t("quickView.defaultDesc", "Experience the best of Vanuatu with this curated package. Perfect for those looking to explore the culture and beauty of the islands.")}
                  </p>
                </div>

                {Array.isArray(product.description) && (
                  <div>
                    <h4 className="font-semibold mb-3">{t("quickView.whatsIncluded", "What's Included")}</h4>
                    <ul className="space-y-2">
                      {product.description.map((item: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Price Options / Rates Mock */}
                <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                  <h4 className="font-semibold mb-2">{t("quickView.ratesOptions", "Rates & Options")}</h4>
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span>{t("quickView.adult", "Adult")}</span>
                    <span className="font-medium">{formatPriceDisplay(product.adultPriceCents, currency)}</span>
                  </div>
                  {product.childPriceCents > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span>{t("quickView.child", "Child")}</span>
                      <span className="font-medium">{formatPriceDisplay(product.childPriceCents, currency)}</span>
                    </div>
                  )}
                </div>

                {/* Fix #15: Fake "Sarah M." review removed — this section will be wired to
                    real review data when available. Do not ship placeholder testimonials. */}
              </div>
            </ScrollArea>

            <div className="p-6 border-t bg-background">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-1">
                  <Label htmlFor="adults" className="text-xs">{t("booking.adults", "Adults")}</Label>
                  <Input
                    id="adults"
                    type="number"
                    min="1"
                    value={adultPax}
                    onChange={(e) => setAdultPax(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="children" className="text-xs">{t("booking.children", "Children")}</Label>
                  <Input
                    id="children"
                    type="number"
                    min="0"
                    value={childPax}
                    onChange={(e) => setChildPax(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="date" className="text-xs">{t("cart.date", "Date")}</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>
              <Button className="w-full" size="lg" onClick={handleAddToCart}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                {t("cart.addToCart", "Add to Cart")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
