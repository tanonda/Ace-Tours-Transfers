import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Trash2 } from "lucide-react";
import { tours } from "@/lib/data";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function CustomerSaved() {
  const { toast } = useToast();
  return (
    <DashboardLayout type="customer">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#004165]">Saved Tours</h1>
          <p className="text-muted-foreground">Your wishlist for future adventures.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tours.map((tour, index) => (
            <Card key={index} className="overflow-hidden flex flex-col">
              <div className="h-48 relative">
                <img src={tour.image} alt={tour.title} className="w-full h-full object-cover absolute inset-0" />
                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="absolute top-3 right-3 h-8 w-8 rounded-full opacity-90 hover:opacity-100"
                  onClick={() => toast({ title: "Removed from Saved", description: `${tour.title} has been removed from your wishlist.` })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <CardContent className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-[#004165] line-clamp-1">{tour.title}</h3>
                  <div className="flex items-center text-xs font-medium bg-slate-100 px-2 py-1 rounded">
                    <Star className="h-3 w-3 text-yellow-500 mr-1 fill-current" /> 4.9
                  </div>
                </div>
                <p className="text-sm text-slate-600 mb-4 line-clamp-2 flex-1">
                  {tour.description[0]}
                </p>
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                  <span className="font-bold text-[#004165]">{tour.price}</span>
                  <Link href="/tours">
                    <Button size="sm" className="bg-[#004165]">Book Now</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
