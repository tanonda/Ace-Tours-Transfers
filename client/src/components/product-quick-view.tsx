import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star, Clock, Users, Check, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ProductQuickViewProps {
  isOpen: boolean;
  onClose: () => void;
  product: any; // Using any for flexibility with tours/transfers structure
}

export function ProductQuickView({ isOpen, onClose, product }: ProductQuickViewProps) {
  const { addToCart } = useCart();
  const [guests, setGuests] = useState("2");
  const [date, setDate] = useState<string>("");

  if (!product) return null;

  const handleAddToCart = () => {
    // Extract numeric price
    const priceMatch = product.price.match(/(\d+)/);
    const numericPrice = priceMatch ? parseInt(priceMatch[0]) : 100; // Default fallback
    // Adjust if price is in VUV (usually larger numbers) vs AUD
    const finalPrice = product.price.includes("VT") ? numericPrice : numericPrice * 80; // Rough conversion if needed, or just keep as is

    addToCart({
      id: product.id,
      title: product.title,
      price: finalPrice,
      image: product.image,
      type: product.id.includes("transfer") ? "transfer" : "tour",
      guests: parseInt(guests),
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
            <img 
              src={product.image} 
              alt={product.title} 
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4">
              <Badge className="bg-background/90 text-foreground hover:bg-background font-bold shadow-sm backdrop-blur-sm border border-border/50">
                {product.price}
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
                  <span className="text-sm text-muted-foreground">(12 reviews)</span>
                </div>
                <DialogTitle className="text-3xl font-serif font-bold mb-2">{product.title}</DialogTitle>
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
                  <h4 className="font-semibold mb-3">Overview</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    {typeof product.description === 'string' 
                      ? product.description 
                      : "Experience the best of Vanuatu with this curated package. Perfect for those looking to explore the culture and beauty of the islands."}
                  </p>
                </div>

                {Array.isArray(product.description) && (
                  <div>
                    <h4 className="font-semibold mb-3">What's Included</h4>
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
                  <h4 className="font-semibold mb-2">Rates & Options</h4>
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span>Adult</span>
                    <span className="font-medium">{product.price}</span>
                  </div>
                  {product.childPrice && (
                    <div className="flex justify-between items-center text-sm">
                      <span>Child</span>
                      <span className="font-medium">{product.childPrice}</span>
                    </div>
                  )}
                </div>
                
                {/* Mock Reviews */}
                <div>
                  <h4 className="font-semibold mb-3">Recent Reviews</h4>
                  <div className="space-y-4">
                    <div className="border-b pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">Sarah M.</span>
                        <span className="text-xs text-muted-foreground">2 days ago</span>
                      </div>
                      <p className="text-xs text-muted-foreground">"Absolutely amazing experience! The guides were so friendly and the sights were breathtaking."</p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="p-6 border-t bg-background">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1">
                  <Label htmlFor="guests" className="text-xs">Guests</Label>
                  <Input 
                    id="guests" 
                    type="number" 
                    min="1" 
                    value={guests} 
                    onChange={(e) => setGuests(e.target.value)} 
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="date" className="text-xs">Date</Label>
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
                Add to Cart
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
