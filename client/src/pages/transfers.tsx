
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { BookingModal } from "@/components/booking-modal";
import { Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchTours } from "@/lib/api";

export default function Transfers() {
  const { data: tours = [], isLoading } = useQuery({
    queryKey: ["tours"],
    queryFn: fetchTours,
  });

  const transfers = tours.filter(t => t.category === "transfer");

  return (
    <Layout>
      <div className="bg-muted/30 pt-40 pb-20">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-serif font-bold text-center mb-6">Transfers & Packages</h1>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-16 text-lg">
            Reliable, comfortable, and professional transport services for every need.
          </p>
          
          {isLoading ? (
            <div className="text-center py-12">Loading transfers...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {transfers.map((transfer, index) => (
                <div key={transfer.id} className="bg-card rounded-xl shadow-sm overflow-hidden border border-border flex flex-col">
                  <div className="h-48 overflow-hidden">
                    <img src={transfer.image} alt={transfer.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="p-8 flex-grow flex flex-col">
                    <h3 className="text-2xl font-bold font-serif mb-2">{transfer.title}</h3>
                    <div className="text-primary font-bold text-xl mb-4">{transfer.price}</div>
                    <p className="text-muted-foreground mb-6">{transfer.description.join(", ")}</p>
                    
                    <div className="mt-auto pt-6 border-t border-border">
                      <p className="text-sm font-medium mb-4 flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        {transfer.minPax || transfer.duration}
                      </p>
                      <BookingModal 
                        preselectedService={transfer.title}
                        trigger={<Button className="w-full">Request Quote</Button>}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
