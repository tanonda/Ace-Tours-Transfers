import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, Mail, MapPin, Clock, MessageCircle, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCMS } from "@/lib/cms-context";
import { Button } from "@/components/ui/button";

const WHATSAPP_NUMBER = "6787114045"; // Vanuatu country code 678 + number

export default function Contact() {
  const { t } = useTranslation();
  const { getSetting } = useCMS();

  const contactEmail = getSetting("contact_email") || "acetoursvanuatu@outlook.com";
  const contactPhone = getSetting("contact_phone") || "7114045 / 7342389";
  const whatsappSettings = getSetting("whatsapp");
  const whatsappNumber = whatsappSettings?.phoneNumber?.replace(/[^0-9]/g, '') || WHATSAPP_NUMBER;

  const openWhatsApp = (msg?: string) => {
    const message = encodeURIComponent(msg || "Hi! I'd like to ask about your tours and transfers.");
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
  };

  return (
    <Layout>
      <div className="pt-40 pb-10 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4">{t("contact.title", "Get in Touch")}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("contact.subtitle", "We're here to help you plan the perfect Vanuatu experience.")}
          </p>
        </div>
      </div>

      <section className="py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="grid gap-6 mb-10">

            {/* Phone */}
            <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="flex items-start gap-4 p-6">
                <div className="bg-primary/10 p-3 rounded-full text-primary shrink-0">
                  <Phone className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">{t("contact.phone", "Phone")}</h3>
                  <div className="space-y-1">
                    <a href={`tel:+6787114045`} className="block text-lg font-semibold text-primary hover:underline">
                      +678 7114045
                    </a>
                    <a href={`tel:+6787342389`} className="block text-lg font-semibold text-primary hover:underline">
                      +678 7342389
                    </a>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{t("contact.phoneAvailable", "Available daily, 7am – 7pm Vanuatu time")}</p>
                </div>
              </CardContent>
            </Card>

            {/* Email */}
            <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="flex items-start gap-4 p-6">
                <div className="bg-primary/10 p-3 rounded-full text-primary shrink-0">
                  <Mail className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">{t("contact.email", "Email")}</h3>
                  <a href={`mailto:${contactEmail}`} className="text-primary hover:underline text-lg font-semibold">
                    {contactEmail}
                  </a>
                  <p className="text-sm text-muted-foreground mt-1">{t("contact.emailReply", "We reply within a few hours")}</p>
                </div>
              </CardContent>
            </Card>

            {/* Location */}
            <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="flex items-start gap-4 p-6">
                <div className="bg-primary/10 p-3 rounded-full text-primary shrink-0">
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-1">{t("contact.location", "Location")}</h3>
                  <p className="text-foreground font-medium">Port Vila, Vanuatu</p>
                  <p className="text-sm text-muted-foreground mt-1">{t("contact.officeHours", "Tours depart from central Port Vila")}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* WhatsApp CTA — primary contact method */}
          <div className="bg-[#25D366]/5 border-2 border-[#25D366]/30 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-[#25D366] rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Chat with Us on WhatsApp</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              The fastest way to get answers, ask questions, or plan your tour. We typically reply within minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="bg-[#25D366] hover:bg-[#1da851] text-white font-bold px-8"
                onClick={() => openWhatsApp()}
              >
                <MessageCircle className="h-5 w-5 mr-2" />
                Start a Conversation
                <ExternalLink className="h-4 w-4 ml-2 opacity-70" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10"
                onClick={() => openWhatsApp("Hi! I'd like to get a quote for a group booking.")}
              >
                Request a Quote
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
