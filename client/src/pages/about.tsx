import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, Clock, Facebook, Mail, MapPin, MessageSquare, Phone, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCmsText } from "@/hooks/use-cms-text";
import { PageHero } from "@/components/page-hero";
import { PaperEdge, Polaroid, SectionLabel } from "@/components/postcard";
import { PhotoCredits } from "@/components/section-backdrop";
import { IMAGE_CREDITS } from "@/lib/image-credits";
import { useSiteSettings } from "@/lib/site-settings";
import { vanuatuPhone } from "@/lib/phone";

function settingText(rows: { key: string; value: unknown }[] | undefined, key: string, fallback: string): string {
  const v = rows?.find((r) => r.key === key)?.value;
  return typeof v === "string" && v.trim() ? v : fallback;
}

export default function About() {
  const { t } = useTranslation();
  const cms = useCmsText("about");
  const { data: settings } = useSiteSettings();

  // Brochure "Let's plan your next holiday" panel, from the same settings as the footer.
  const phones = [settingText(settings, "contact_phone", "7114045"), settingText(settings, "contact_phone_2", "7342389")]
    .map(vanuatuPhone)
    .filter((p): p is NonNullable<typeof p> => p !== null);
  const email = settingText(settings, "contact_email", "acetoursvanuatu@outlook.com");
  const facebook = settingText(settings, "social_facebook", "https://www.facebook.com/share/16xVyw7m7m/");

  const features = [
    { icon: MapPin, title: cms.text("feature1_title", t("about.localExpertise")), desc: cms.html("feature1_desc", t("about.localExpertiseDesc")), rotate: -1.5 },
    { icon: Clock, title: cms.text("feature2_title", t("about.reliableService")), desc: cms.html("feature2_desc", t("about.reliableServiceDesc")), rotate: 1 },
    { icon: ShieldCheck, title: cms.text("feature3_title", t("about.safetyFirst")), desc: cms.html("feature3_desc", t("about.safetyFirstDesc")), rotate: -1 },
  ];

  return (
    <Layout>
      <SEO
        title="About Us - Ace Tours & Transfers Vanuatu"
        description="Learn about Ace Tours & Transfers — locally owned and operated in Port Vila, Vanuatu. Expert local guides, modern fleet, and custom-designed tour packages."
        keywords={["about Ace Tours", "Vanuatu tour company", "Port Vila tour operator", "locally owned Vanuatu"]}
      />

      <PageHero
        priority
        photo="/assets/home/erakor-sunset.webp"
        photoPosition="50% 60%"
        kicker={cms.text("page_title", t("about.title"))}
        title={t("about.heroTitle", "Travel made easy")}
        subtitle={cms.text("page_subtitle", t("about.subtitle"))}
        credit={IMAGE_CREDITS.erakorSunset}
      />

      {/* 01 · Our story: polaroids beside the story, badges as pills */}
      <section className="bg-background overflow-x-clip">
        <div className="container mx-auto grid grid-cols-1 items-center gap-14 px-4 pt-10 pb-24 md:pt-14 lg:grid-cols-2 lg:gap-20">
          <div className="relative mx-auto h-[420px] w-full max-w-md sm:h-[480px] lg:max-w-none">
            <Polaroid
              src={cms.text("story_image", "/assets/home/mele-cascades.webp")}
              alt={t("about.storyPhotoAlt", "Ace Tours on Efate")}
              caption={t("about.storyCaption1", "Our island")}
              rotate={-4}
              tape
              aspect="aspect-[4/5]"
              className="absolute left-0 top-0 w-[60%]"
            />
            <Polaroid
              src="/assets/home/toniliu-village.webp"
              alt={t("about.storyPhoto2Alt", "Toniliu village road, Efate")}
              caption={t("about.storyCaption2", "Village roads of Efate")}
              rotate={3.5}
              className="absolute bottom-0 right-0 w-[62%]"
            />
          </div>

          <div>
            <SectionLabel index={1} className="mb-4">{cms.text("story_title", t("about.storyTitle"))}</SectionLabel>
            <h2 className="mb-6 text-4xl text-navy md:text-5xl">{cms.text("title", t("about.tagline", "Vanuatu's Premier Transport & Tour Operator"))}</h2>
            <div
              className="prose prose-lg prose-p:my-2 mb-4 max-w-none text-lg leading-relaxed text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: cms.html("story_desc1", t("about.storyDesc1")) }}
            />
            <div
              className="prose prose-lg prose-p:my-2 mb-6 max-w-none text-lg leading-relaxed text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: cms.html("story_desc2", t("about.storyDesc2")) }}
            />
            <ul className="flex flex-wrap gap-2">
              {[
                cms.text("badge1", t("about.locallyOwned")),
                cms.text("badge2", t("about.fullyLicensed")),
                cms.text("badge3", t("about.expertGuides")),
                cms.text("badge4", t("about.modernFleet")),
                cms.text("badge5", t("about.customItineraries")),
                cms.text("badge6", t("about.support247")),
              ].map((item) => (
                <li key={item} className="flex items-center gap-1.5 rounded-full border border-border bg-paper/70 px-3.5 py-1.5 text-sm text-navy">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <PhotoCredits credits={[IMAGE_CREDITS.toniliu]} tone="wash" />
          </div>
        </div>
      </section>

      {/* 02 · Why choose us: paper cards pinned on the lagoon-teal band */}
      <section className="relative bg-reef-light pt-20 pb-28 md:pt-24 md:pb-36">
        <PaperEdge position="top" seed={61} />
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <SectionLabel index={2} tone="reef" centered className="mb-4">{t("about.whyLabel", "Why travel with us")}</SectionLabel>
            <h2 className="text-4xl text-navy md:text-5xl">{cms.text("why_choose_us", t("about.whyChooseUs"))}</h2>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {features.map(({ icon: Icon, title, desc, rotate }) => (
              <article
                key={title}
                className="relative bg-paper p-7 pt-9 text-center shadow-[0_18px_40px_-20px_rgba(18,50,74,0.35)] transition-transform duration-500 rotate-(--tilt) hover:rotate-0"
                style={{ "--tilt": `${rotate}deg` } as React.CSSProperties}
              >
                <span aria-hidden className="absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 rotate-2 bg-reef/35" />
                <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full border-2 border-reef text-reef">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mb-2 text-2xl text-navy">{title}</h3>
                <div className="prose prose-sm prose-p:my-1 mx-auto text-muted-foreground" dangerouslySetInnerHTML={{ __html: desc }} />
              </article>
            ))}
          </div>
        </div>
        <PaperEdge position="bottom" seed={67} />
      </section>

      {/* 03 · Postcard back: the brochure's "Let's plan your next holiday" panel */}
      <section className="bg-background pt-12 pb-8 md:pt-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 bg-paper p-8 shadow-[0_24px_60px_-24px_rgba(18,50,74,0.45)] md:grid-cols-2 md:gap-0 md:p-12">
            <div className="md:border-r md:border-dashed md:border-border md:pr-10">
              <SectionLabel index={3} className="mb-4">{t("about.planLabel", "Let's plan your next holiday")}</SectionLabel>
              <p className="font-script text-3xl leading-snug text-navy md:text-4xl">
                {t("about.planNote", "Time for your next adventure. Let us help you with your travel plans!")}
              </p>
              <Link href="/contact">
                <Button className="mt-8 rounded-full px-6">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {t("about.planCta", "Plan my trip")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="relative md:pl-10">
              {/* Stamp: the VTO-approved claim the user confirmed is true */}
              <a
                href="https://vanuatu.travel"
                target="_blank"
                rel="noopener noreferrer"
                className="float-right ml-4 mb-4 grid size-24 rotate-6 place-content-center bg-paper text-center text-primary outline-2 outline-dashed outline-primary -outline-offset-[5px] shadow-md"
                aria-label="Vanuatu Tourism Office — vanuatu.travel"
              >
                <span className="text-[0.55rem] font-bold uppercase tracking-[0.15em]">{t("about.stampTop", "Approved")}</span>
                <span className="font-serif text-2xl leading-none">VTO</span>
                <span className="text-[0.55rem] font-bold uppercase tracking-[0.15em]">{t("about.stampBottom", "Operator")}</span>
              </a>
              <ul className="space-y-0 text-navy">
                <li className="flex items-center gap-3 border-b border-border py-3">
                  <MapPin className="h-4 w-4 shrink-0 text-primary" /> Port Vila, Efate, Vanuatu
                </li>
                {phones.map((phone) => (
                  <li key={phone.tel} className="border-b border-border py-3">
                    <a href={phone.tel} className="flex items-center gap-3 hover:text-primary">
                      <Phone className="h-4 w-4 shrink-0 text-primary" /> {phone.display}
                    </a>
                  </li>
                ))}
                <li className="border-b border-border py-3">
                  <a href={`mailto:${email}`} className="flex items-center gap-3 break-all hover:text-primary">
                    <Mail className="h-4 w-4 shrink-0 text-primary" /> {email}
                  </a>
                </li>
                <li className="border-b border-border py-3">
                  <a href={facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-primary">
                    <Facebook className="h-4 w-4 shrink-0 text-primary" /> Ace Tours & Transfers
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
