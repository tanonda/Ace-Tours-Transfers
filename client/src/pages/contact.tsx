import { useState } from "react";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, MapPin, MessageCircle, ExternalLink, Send, CheckCircle } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { PaperEdge, SectionLabel } from "@/components/postcard";
import { WhatsAppGlyph } from "@/components/brand-icons";
import { IMAGE_CREDITS } from "@/lib/image-credits";
import { useTranslation } from "react-i18next";
import { useCMS } from "@/lib/cms-context";
import { useCmsText } from "@/hooks/use-cms-text";
import { useToast } from "@/hooks/use-toast";
import { vanuatuPhone } from "@/lib/phone";

const WHATSAPP_NUMBER = "6787114045";

export default function Contact() {
  const { t } = useTranslation();
  const { getSetting } = useCMS();
  const cms = useCmsText("contact");
  const { toast } = useToast();

  const contactEmail = getSetting("contact_email") || "acetoursvanuatu@outlook.com";
  const contactPhones = [getSetting("contact_phone") || "7114045", getSetting("contact_phone_2") || "7342389"]
    .map((v) => vanuatuPhone(String(v)))
    .filter((p): p is NonNullable<typeof p> => p !== null);
  const whatsappSettings = getSetting("whatsapp") as any;
  const whatsappNumber = (whatsappSettings?.phoneNumber || getSetting("whatsapp_number") || WHATSAPP_NUMBER).replace(/[^0-9]/g, '');

  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const openWhatsApp = (msg?: string) => {
    const message = encodeURIComponent(msg || "Hi! I'd like to ask about your tours and transfers.");
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast({ title: "Missing fields", description: "Please fill in your name, email, and message.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const csrfToken = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)?.[1] || "";
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <SEO
        title="Contact Us - Ace Tours & Transfers Vanuatu"
        description="Get in touch with Ace Tours & Transfers in Port Vila, Vanuatu. Call, email, or send us a message — our team is available 24/7 for bookings and inquiries."
        keywords={["contact Ace Tours", "Vanuatu tour contact", "Port Vila tour booking", "Vanuatu transfer inquiry"]}
      />
      <PageHero
        priority
        photo="/assets/home/port-vila-harbour-day.webp"
        photoPosition="50% 60%"
        kicker={t("contact.kicker", "Ace Tours & Transfers")}
        title={cms.text("page_title", t("contact.title"))}
        subtitle={cms.text("page_subtitle", t("contact.subtitle"))}
        credit={IMAGE_CREDITS.vilaHarbourDay}
      />

      {/* 01 · Reach us: three pinned paper cards */}
      <section className="bg-background pt-10 pb-24 md:pt-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <SectionLabel index={1} centered className="mb-4">{t("contact.reachLabel", "Reach us directly")}</SectionLabel>
            <h2 className="text-4xl text-navy md:text-5xl">{t("contact.reachTitle", "We're here to help")}</h2>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                icon: Phone, title: t("contact.phone"), rotate: -1.5,
                body: (
                  <>
                    {contactPhones.map((phone) => (
                      <a key={phone.tel} href={phone.tel} className="block text-lg font-semibold text-primary hover:underline">{phone.display}</a>
                    ))}
                    <p className="mt-1 text-sm text-muted-foreground">{cms.text("phone_availability", t("contact.phoneAvailable"))}</p>
                  </>
                ),
              },
              {
                icon: Mail, title: t("contact.email"), rotate: 1,
                body: (
                  <>
                    <a href={`mailto:${contactEmail}`} className="break-all text-lg font-semibold text-primary hover:underline">
                      {typeof contactEmail === "string" ? contactEmail : "acetoursvanuatu@outlook.com"}
                    </a>
                    <p className="mt-1 text-sm text-muted-foreground">{cms.text("email_reply_time", t("contact.emailReply"))}</p>
                  </>
                ),
              },
              {
                icon: MapPin, title: t("contact.location"), rotate: -1,
                body: (
                  <>
                    <p className="font-medium text-navy">Port Vila, Efate, Vanuatu</p>
                    <div className="prose prose-sm prose-p:m-0 mx-auto mt-1 text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: cms.html("office_hours", t("contact.officeHours")) }} />
                  </>
                ),
              },
            ].map(({ icon: Icon, title, body, rotate }) => (
              <article
                key={title}
                className="relative bg-paper p-7 pt-9 text-center shadow-[0_18px_40px_-20px_rgba(18,50,74,0.35)] transition-transform duration-500 rotate-(--tilt) hover:rotate-0"
                style={{ "--tilt": `${rotate}deg` } as React.CSSProperties}
              >
                <span aria-hidden className="absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 -rotate-2 bg-primary/40" />
                <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mb-2 text-2xl text-navy">{title}</h3>
                {body}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 02 · Write to us: WhatsApp card + the form as a postcard, on the lagoon-teal band */}
      <section className="relative bg-reef-light pt-20 pb-28 md:pt-24 md:pb-36">
        <PaperEdge position="top" seed={71} />
        <div className="container mx-auto grid grid-cols-1 gap-10 px-4 lg:grid-cols-5">
          {/* WhatsApp: brand green kept so it is recognisable */}
          <div className="lg:col-span-2">
            <SectionLabel index={2} tone="reef" className="mb-4">{t("contact.writeLabel", "Write to us")}</SectionLabel>
            <h2 className="mb-6 text-4xl text-navy md:text-5xl">{t("contact.writeTitle", "Drop us a line")}</h2>
            <div className="bg-paper p-7 shadow-[0_18px_40px_-20px_rgba(18,50,74,0.35)] border-t-4 border-[#25D366]">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-full bg-[#25D366] text-white">
                  <WhatsAppGlyph className="h-6 w-6" />
                </span>
                <h3 className="font-sans text-xl font-semibold text-navy">{t("contact.whatsappTitle", "Chat with us on WhatsApp")}</h3>
              </div>
              <p className="mb-6 text-muted-foreground">
                {cms.text("whatsapp_desc", "The fastest way to get answers, ask questions, or plan your tour. We typically reply within minutes.")}
              </p>
              <div className="flex flex-col gap-3">
                <Button size="lg" className="bg-[#25D366] font-bold text-white hover:bg-[#1da851]" onClick={() => openWhatsApp()}>
                  <MessageCircle className="mr-2 h-5 w-5" />
                  {t("contact.whatsappStart", "Start a Conversation")}
                  <ExternalLink className="ml-2 h-4 w-4 opacity-70" />
                </Button>
                <Button size="lg" variant="outline" className="border-[#25D366] text-[#128C4B] hover:bg-[#25D366]/10 dark:text-[#25D366]" onClick={() => openWhatsApp("Hi! I'd like to get a quote for a group booking.")}>
                  <Send className="mr-2 h-4 w-4" />
                  {t("contact.whatsappQuote", "Request a Quote")}
                </Button>
              </div>
            </div>
          </div>

          {/* The form as the back of a postcard, with a Port Vila postmark */}
          <div className="relative bg-paper p-7 shadow-[0_24px_60px_-24px_rgba(18,50,74,0.45)] md:p-10 lg:col-span-3">
            <div
              aria-hidden
              className="absolute right-6 top-6 hidden size-20 rotate-12 place-content-center rounded-full border-2 border-dashed border-primary/60 text-center text-primary/80 sm:grid"
            >
              <span className="text-[0.55rem] font-bold uppercase tracking-[0.15em]">Port Vila</span>
              <span className="font-serif text-lg leading-none">VU</span>
              <span className="text-[0.55rem] font-bold uppercase tracking-[0.15em]">Efate</span>
            </div>
            {submitted ? (
              <div className="py-8 text-center">
                <CheckCircle className="mx-auto mb-4 h-14 w-14 text-reef" />
                <h3 className="mb-2 text-2xl text-navy">{t("contact.sentTitle", "Message sent!")}</h3>
                <p className="mb-6 text-muted-foreground">{t("contact.sentBody", "Thanks for reaching out. We'll get back to you as soon as possible, usually within a few hours.")}</p>
                <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ name: "", email: "", phone: "", subject: "", message: "" }); }}>
                  <Send className="mr-2 h-4 w-4" />
                  {t("contact.sendAnother", "Send another message")}
                </Button>
              </div>
            ) : (
              <>
                <h3 className="mb-1 pr-24 text-3xl text-navy">{t("contact.formTitle", "Send us a message")}</h3>
                <p className="mb-6 pr-24 font-script text-xl text-muted-foreground">{t("contact.formNote", "Prefer email? We'll reply to your inbox.")}</p>
                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
                      <Input id="name" placeholder="Your full name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                      <Input id="email" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Phone <span className="text-xs text-muted-foreground">(optional)</span></Label>
                      <Input id="phone" placeholder="+678 xxxxxxx" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="subject">Subject <span className="text-xs text-muted-foreground">(optional)</span></Label>
                      <Input id="subject" placeholder="e.g. Group booking enquiry" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="message">Message <span className="text-red-500">*</span></Label>
                    <Textarea id="message" placeholder="Tell us how we can help..." rows={5} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
                    <p className="text-right text-xs text-muted-foreground">{form.message.length}/3000</p>
                  </div>
                  <Button size="lg" className="w-full rounded-full sm:w-auto sm:justify-self-start sm:px-8" onClick={handleSubmit} disabled={submitting}>
                    <Send className="mr-2 h-4 w-4" />
                    {submitting ? "Sending…" : t("contact.send", "Send Message")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
        <PaperEdge position="bottom" seed={79} />
      </section>
    </Layout>
  );
}
