import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Mail, MapPin, Clock, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Contact() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      toast({
        title: "Message Sent!",
        description: "We'll get back to you as soon as possible.",
      });
      setIsLoading(false);
      // Reset form here if needed
    }, 1500);
  };

  return (
    <Layout>
      <div className="pt-40 pb-10 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4">Contact Us</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Have questions? We'd love to hear from you.
          </p>
        </div>
      </div>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div className="space-y-8">
              <h2 className="text-3xl font-bold font-serif mb-6">Get in Touch</h2>
              <p className="text-lg text-muted-foreground mb-8">
                Whether you want to book a tour, arrange a transfer, or just have a question about Vanuatu, our friendly team is here to help.
              </p>

              <div className="grid gap-6">
                <Card className="border-none shadow-sm">
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className="bg-primary/10 p-3 rounded-full text-primary">
                      <Phone className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">Phone</h3>
                      <p className="text-muted-foreground">7114045 / 7342389</p>
                      <p className="text-sm text-muted-foreground mt-1">Available 24/7 for emergencies</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className="bg-primary/10 p-3 rounded-full text-primary">
                      <Mail className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">Email</h3>
                      <a href="mailto:acetoursvanuatu@outlook.com" className="text-primary hover:underline">
                        acetoursvanuatu@outlook.com
                      </a>
                      <p className="text-sm text-muted-foreground mt-1">We usually reply within 24 hours</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className="bg-primary/10 p-3 rounded-full text-primary">
                      <MapPin className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">Location</h3>
                      <p className="text-muted-foreground">Port Vila, Vanuatu</p>
                      <p className="text-sm text-muted-foreground mt-1">Office open Mon-Fri, 8am - 5pm</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Contact Form */}
            <Card className="shadow-lg border-none">
              <CardHeader>
                <CardTitle className="text-2xl font-serif">Send us a Message</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="name" className="text-sm font-medium">Name</label>
                      <Input id="name" placeholder="Your name" required />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-medium">Email</label>
                      <Input id="email" type="email" placeholder="Your email" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="subject" className="text-sm font-medium">Subject</label>
                    <Input id="subject" placeholder="How can we help?" required />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="message" className="text-sm font-medium">Message</label>
                    <Textarea id="message" placeholder="Tell us more about your inquiry..." className="min-h-[150px]" required />
                  </div>
                  <Button type="submit" className="w-full text-lg" disabled={isLoading}>
                    {isLoading ? "Sending..." : (
                      <>
                        Send Message <Send className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </Layout>
  );
}
