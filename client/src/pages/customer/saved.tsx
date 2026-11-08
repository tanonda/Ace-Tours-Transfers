import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, HeartOff } from "lucide-react";
import { fetchProducts, fetchWishlist, removeFromWishlist } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { htmlToText } from "@/lib/html-text";
import { productPath } from "@shared/product-path";

export default function CustomerSaved() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();

  const { data: products = [] } = useQuery({
    queryKey: ["allProducts", i18n.language],
    queryFn: fetchProducts,
  });
  const { data: wishlist = [], isLoading } = useQuery({
    queryKey: ["wishlist"],
    queryFn: fetchWishlist,
  });

  const savedIds = new Set(wishlist.map((item) => item.tourId));
  const savedProducts = (products as any[]).filter((product) => savedIds.has(product.id));

  const handleRemove = async (tourId: string, title: string) => {
    try {
      await removeFromWishlist(tourId);
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      toast({ title: "Removed from Saved", description: `${title} has been removed from your wishlist.` });
    } catch (error: any) {
      toast({
        title: "Could not remove",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout type="customer">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Saved Tours</h1>
          <p className="text-muted-foreground">Your wishlist for future adventures.</p>
        </div>

        {!isLoading && savedProducts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <HeartOff className="mx-auto mb-4 h-10 w-10 opacity-50" />
              <p>You haven't saved any tours yet.</p>
              <Link href="/tours">
                <Button className="mt-4">Browse tours</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedProducts.map((tour: any) => (
              <Card key={tour.id} className="overflow-hidden flex flex-col">
                <div className="h-48 relative">
                  <img src={tour.image} alt={tour.title} className="w-full h-full object-cover absolute inset-0" />
                  <Button
                    variant="destructive"
                    size="icon"
                    aria-label={`Remove ${tour.title} from saved tours`}
                    className="absolute top-3 right-3 h-8 w-8 rounded-full opacity-90 hover:opacity-100"
                    onClick={() => handleRemove(tour.id, tour.title)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardContent className="p-5 flex-1 flex flex-col">
                  <h3 className="font-bold text-lg text-foreground line-clamp-1">{tour.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-1 mt-2">
                    {htmlToText(Array.isArray(tour.description) ? tour.description[0] : tour.description)}
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
                    <span className="font-bold text-foreground">{tour.price}</span>
                    <Link href={productPath(tour)}>
                      <Button size="sm">Book Now</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
