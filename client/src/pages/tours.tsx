
import { Layout } from "@/components/layout";
import { TourCard } from "@/components/tour-card";
import { tours } from "@/lib/data";

export default function Tours() {
  return (
    <Layout>
      <div className="bg-muted/30 py-20">
        <div className="container mx-auto px-4 pt-10">
          <h1 className="text-5xl font-serif font-bold text-center mb-6">Our Tours</h1>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-12 text-lg">
            Explore our range of carefully crafted tours designed to show you the very best of Vanuatu.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tours.map((tour, index) => (
              <TourCard key={tour.id} tour={tour} index={index} />
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
