import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Mail, MapPin, Clock, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function Contact() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      toast({
        title: t("contact.messageSent"),
        description: t("contact.messageSuccess"),
      });
      setIsLoading(false);
    }, 1500);
  };

  return (
    <Layout>
      <div className="pt-40 pb-10 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4">{t("contact.title")}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("contact.subtitle")}
          </p>
        </div>
      </div>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div className="space-y-8">
              <h2 className="text-3xl font-bold font-serif mb-6">{t("contact.getInTouch")}</h2>
              <p className="text-lg text-muted-foreground mb-8">
                {t("contact.getInTouchDesc")}
              </p>

              <div className="grid gap-6">
                <Card className="border-none shadow-sm">
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className="bg-primary/10 p-3 rounded-full text-primary">
                      <Phone className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">{t("contact.phone")}</h3>
                      <p className="text-muted-foreground">7114045 / 7342389</p>
                      <p className="text-sm text-muted-foreground mt-1">{t("contact.phoneAvailable")}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className="bg-primary/10 p-3 rounded-full text-primary">
                      <Mail className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">{t("contact.email")}</h3>
                      <a href="mailto:acetoursvanuatu@outlook.com" className="text-primary hover:underline">
                        acetoursvanuatu@outlook.com
                      </a>
                      <p className="text-sm text-muted-foreground mt-1">{t("contact.emailReply")}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className="bg-primary/10 p-3 rounded-full text-primary">
                      <MapPin className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">{t("contact.location")}</h3>
                      <p className="text-muted-foreground">Port Vila, Vanuatu</p>
                      <p className="text-sm text-muted-foreground mt-1">{t("contact.officeHours")}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Contact Form */}
            <Card className="shadow-lg border-none">
              <CardHeader>
                <CardTitle className="text-2xl font-serif">{t("contact.sendMessage")}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="name" className="text-sm font-medium">{t("contact.name")}</label>
                      <Input id="name" placeholder={t("contact.namePlaceholder")} required />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-medium">{t("auth.email")}</label>
                      <Input id="email" type="email" placeholder={t("contact.emailPlaceholder")} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="subject" className="text-sm font-medium">{t("contact.subject")}</label>
                    <Input id="subject" placeholder={t("contact.subjectPlaceholder")} required />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="message" className="text-sm font-medium">{t("contact.message")}</label>
                    <Textarea id="message" placeholder={t("contact.messagePlaceholder")} className="min-h-[150px]" required />
                  </div>
                  <Button type="submit" className="w-full text-lg" disabled={isLoading}>
                    {isLoading ? t("contact.sending") : (
                      <>
                        {t("contact.send")} <Send className="ml-2 h-4 w-4" />
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
