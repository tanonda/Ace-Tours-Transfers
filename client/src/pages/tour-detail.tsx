
import { useRoute, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchTour } from "@/lib/api";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Check, Star, ShoppingCart, ArrowLeft, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { BookingModal } from "@/components/booking-modal";

export default function TourDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const [adultPax, setAdultPax] = useState("2");
  const [childPax, setChildPax] = useState("0");
  const [date, setDate] = useState<string>("");

  const { data: tour, isLoading, error } = useQuery({
    queryKey: ["tour", id],
    queryFn: () => fetchTour(id!),
    enabled: !!id,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["tour-reviews", id],
    queryFn: () => fetch(`/api/tours/${id}/reviews`).then(res => res.json()),
    enabled: !!id,
  });

  const averageRating = reviews.length > 0 
    ? reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / reviews.length 
    : 5;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh] pt-32">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  if (error || !tour) {
    return (
      <Layout>
        <div className="container mx-auto px-4 pt-40 pb-20 text-center">
          <h1 className="text-4xl font-bold mb-4">{t("common.error", "Error")}</h1>
          <p className="text-muted-foreground mb-8">{t("common.productNotFound", "Product not found")}</p>
          <Button onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> {t("common.goBack", "Go Back")}
          </Button>
        </div>
      </Layout>
    );
  }

  const handleAddToCart = () => {
    // Extract numeric price
    const priceMatch = tour.price.match(/(\d+)/);
    const numericPrice = priceMatch ? parseInt(priceMatch[0]) : 100;
    const finalPrice = tour.price.includes("VT") ? numericPrice : numericPrice * 80;

    addToCart({
      id: tour.id,
      title: tour.title,
      price: finalPrice,
      image: tour.image,
      type: "tour",
      adultPax: parseInt(adultPax),
      childPax: parseInt(childPax),
      date: date ? new Date(date) : new Date(),
    });
  };

  return (
    <Layout>
      <div className="pt-40 pb-20 bg-background">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Button 
              variant="ghost" 
              className="mb-8 hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> {t("common.back", "Back")}
            </Button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Image Section */}
              <div className="relative rounded-2xl overflow-hidden shadow-2xl h-[400px] md:h-[600px]">
                <img 
                  src={tour.image} 
                  alt={tour.title} 
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-6 left-6 flex gap-3">
                  <Badge className="bg-primary text-white text-lg px-4 py-2 shadow-xl">
                    {tour.price}
                  </Badge>
                </div>
              </div>

              {/* Info Section */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex text-yellow-400">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className={`h-5 w-5 ${i <= averageRating ? 'fill-current' : 'text-muted'}`} />
                    ))}
                  </div>
                  <span className="text-muted-foreground font-medium">({reviews.length} {t("quickView.reviews", "reviews")})</span>
                  <Badge variant="outline" className="ml-2 uppercase tracking-wider">{tour.category}</Badge>
                </div>

                <h1 className="text-4xl md:text-5xl font-serif font-bold mb-6 text-foreground">{tour.title}</h1>

                <div className="flex flex-wrap items-center gap-6 mb-8 text-muted-foreground">
                  <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-full border border-border/50">
                    <Clock className="h-5 w-5 text-primary" />
                    <span className="font-semibold">{tour.duration}</span>
                  </div>
                  {tour.minPax && (
                    <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-full border border-border/50">
                      <Users className="h-5 w-5 text-primary" />
                      <span className="font-semibold">{tour.minPax}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-8 mb-10">
                  <div className="bg-card p-6 rounded-2xl border border-border/50 shadow-sm transition-all hover:shadow-md">
                    <h3 className="text-xl font-bold mb-4 font-serif text-primary">{t("quickView.overview", "Overview")}</h3>
                    <p className="text-muted-foreground leading-relaxed text-lg italic">
                      {typeof tour.description === 'string' 
                        ? tour.description 
                        : t("quickView.defaultDesc", "Experience the best of Vanuatu with this curated package. Perfect for those looking to explore the culture and beauty of the islands.")}
                    </p>
                  </div>

                  {Array.isArray(tour.description) && (
                    <div className="bg-card p-6 rounded-2xl border border-border/50 shadow-sm transition-all hover:shadow-md">
                      <h3 className="text-xl font-bold mb-4 font-serif text-primary">{t("quickView.whatsIncluded", "What's Included")}</h3>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {tour.description.map((item, i) => (
                          <li key={i} className="flex items-start gap-3 text-muted-foreground">
                            <div className="mt-1 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                               <Check className="h-3 w-3 text-primary" />
                            </div>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Rates Section */}
                  <div className="bg-muted/30 p-6 rounded-2xl border border-border/50">
                    <h3 className="text-xl font-bold mb-4 font-serif text-primary">{t("quickView.ratesOptions", "Rates & Options")}</h3>
                    <div className="flex justify-between items-center text-lg mb-2">
                       <span>{t("quickView.adult", "Adult")}</span>
                       <span className="font-bold text-foreground">{tour.price}</span>
                    </div>
                    {tour.childPrice && (
                      <div className="flex justify-between items-center text-lg">
                         <span>{t("quickView.child", "Child")}</span>
                         <span className="font-bold text-foreground">{tour.childPrice}</span>
                      </div>
                    )}
                  </div>

                  {/* Reviews Section */}
                  <div className="bg-card p-6 rounded-2xl border border-border/50 shadow-sm">
                    <h3 className="text-xl font-bold mb-4 font-serif text-primary">{t("quickView.recentReviews", "Recent Reviews")}</h3>
                    <div className="space-y-4">
                      {reviews.length > 0 ? (
                        reviews.map((r: any) => (
                          <div key={r.id} className="border-b pb-4 border-border/50 last:border-0 last:pb-0">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold">{r.userName || t("common.guest", "Guest")}</span>
                              <span className="text-sm text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex text-yellow-400 mb-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star key={star} className={`h-3 w-3 ${star <= r.rating ? 'fill-current' : 'text-muted'}`} />
                              ))}
                            </div>
                            <p className="text-muted-foreground italic">"{r.comment}"</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground italic">{t("quickView.noReviews", "No reviews yet. Be the first to leave one!")}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Booking Card */}
                <div className="mt-auto bg-primary/5 p-8 rounded-3xl border-2 border-primary/20 shadow-inner">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="space-y-2">
                      <Label htmlFor="detail-adults" className="text-sm font-bold ml-1">{t("booking.adults", "Adults")}</Label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          id="detail-adults" 
                          type="number" 
                          min="1" 
                          value={adultPax} 
                          onChange={(e) => setAdultPax(e.target.value)} 
                          className="pl-10 h-12 bg-background border-primary/20 focus:border-primary"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="detail-children" className="text-sm font-bold ml-1">{t("booking.children", "Children")}</Label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          id="detail-children" 
                          type="number" 
                          min="0" 
                          value={childPax} 
                          onChange={(e) => setChildPax(e.target.value)} 
                          className="pl-10 h-12 bg-background border-primary/20 focus:border-primary"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="detail-date" className="text-sm font-bold ml-1">{t("cart.date", "Date")}</Label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            id="detail-date" 
                            type="date" 
                            value={date} 
                            onChange={(e) => setDate(e.target.value)} 
                            className="pl-10 h-12 bg-background border-primary/20 focus:border-primary"
                          />
                        </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button 
                      className="flex-1 h-16 text-xl font-bold shadow-lg shadow-primary/20" 
                      onClick={handleAddToCart}
                    >
                      <ShoppingCart className="mr-2 h-6 w-6" />
                      {t("cart.addToCart", "Add to Cart")}
                    </Button>
                    <BookingModal 
                      preselectedService={tour.title}
                      trigger={
                        <Button variant="secondary" className="flex-1 h-16 text-xl font-bold bg-white border-2 border-primary text-primary hover:bg-primary/5 transition-all">
                          {t("tour.bookNow", "Book Now")}
                        </Button>
                      } 
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
