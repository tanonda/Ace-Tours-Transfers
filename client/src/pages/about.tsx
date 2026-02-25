import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, MapPin, Phone, Mail, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function About() {
  const { t } = useTranslation();
  return (
    <Layout>
      <div className="pt-40 pb-10 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4">{t("about.title")}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("about.subtitle")}
          </p>
        </div>
      </div>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="relative rounded-lg shadow-xl overflow-hidden aspect-[4/3] w-full">
                <img 
                  src="https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?q=80&w=2070&auto=format&fit=crop" 
                  alt="Vanuatu Landscape" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-6 font-serif">{t("about.storyTitle")}</h2>
              <p className="text-lg text-muted-foreground mb-4">
                {t("about.storyDesc1")}
              </p>
              <p className="text-lg text-muted-foreground mb-6">
                {t("about.storyDesc2")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  t("about.locallyOwned"),
                  t("about.fullyLicensed"),
                  t("about.expertGuides"),
                  t("about.modernFleet"),
                  t("about.customItineraries"),
                  t("about.support247")
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
          <h2 className="text-3xl font-bold mb-12 font-serif">{t("about.whyChooseUs")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-none shadow-md bg-card">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                  <MapPin className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">{t("about.localExpertise")}</h3>
                <p className="text-muted-foreground">
                  {t("about.localExpertiseDesc")}
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-md bg-card">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                  <Clock className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">{t("about.reliableService")}</h3>
                <p className="text-muted-foreground">
                  {t("about.reliableServiceDesc")}
                </p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-md bg-card">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">{t("about.safetyFirst")}</h3>
                <p className="text-muted-foreground">
                  {t("about.safetyFirstDesc")}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      <section className="py-12 bg-primary/5 border-t border-border/30">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground text-sm mb-3">
            Proud member of the Vanuatu tourism community. For destination information, visit the official tourism authority.
          </p>
          <a
            href="https://vanuatu.travel"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary font-semibold hover:underline"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            Vanuatu Tourism Office — vanuatu.travel
          </a>
        </div>
      </section>
    </Layout>
  );
}
