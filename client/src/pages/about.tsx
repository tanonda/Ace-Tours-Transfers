import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, MapPin, Phone, Mail, Clock } from "lucide-react";

export default function About() {
  return (
    <Layout>
      <div className="pt-32 pb-10 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4">About Ace Tours</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your trusted partner for exploring the beautiful islands of Vanuatu.
          </p>
        </div>
      </div>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <img 
                src="https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?q=80&w=2070&auto=format&fit=crop" 
                alt="Vanuatu Landscape" 
                className="rounded-lg shadow-xl w-full h-[400px] object-cover"
              />
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-6 font-serif">Our Story</h2>
              <p className="text-lg text-muted-foreground mb-4">
                Ace Tours & Transfers was founded with a simple mission: to share the incredible beauty and culture of Vanuatu with the world. What started as a small family-owned business has grown into one of Port Vila's most trusted tour operators.
              </p>
              <p className="text-lg text-muted-foreground mb-6">
                We pride ourselves on our deep local knowledge, professional service, and commitment to safety. Our team of experienced drivers and guides are passionate about making your visit unforgettable.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  "Locally Owned & Operated",
                  "Fully Insured & Licensed",
                  "Expert Local Guides",
                  "Modern, Comfortable Fleet",
                  "Customized Itineraries",
                  "24/7 Customer Support"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle className="text-primary h-5 w-5 shrink-0" />
                    <span className="font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-12 font-serif">Why Choose Us?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-none shadow-md bg-card">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                  <MapPin className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">Local Expertise</h3>
                <p className="text-muted-foreground">
                  We know every hidden gem, best photo spot, and authentic local experience on the island.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-md bg-card">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                  <Clock className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">Reliable Service</h3>
                <p className="text-muted-foreground">
                  Punctuality and reliability are our hallmarks. You can count on us to be there when you need us.
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-md bg-card">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">Safety First</h3>
                <p className="text-muted-foreground">
                  Your safety is our priority. Our vehicles are regularly maintained and our drivers are professionally trained.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </Layout>
  );
}
