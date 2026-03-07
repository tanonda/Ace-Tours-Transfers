import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, MapPin, MessageCircle, ExternalLink, Send, CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCMS } from "@/lib/cms-context";
import { useCmsText } from "@/hooks/use-cms-text";
import { useToast } from "@/hooks/use-toast";

const WHATSAPP_NUMBER = "6787114045";

export default function Contact() {
  const { t } = useTranslation();
  const { getSetting } = useCMS();
  const cms = useCmsText("contact");
  const { toast } = useToast();

  const contactEmail = getSetting("contact_email") || "acetoursvanuatu@outlook.com";
  const whatsappSettings = getSetting("whatsapp");
  const whatsappNumber = whatsappSettings?.phoneNumber?.replace(/[^0-9]/g, '') || WHATSAPP_NUMBER;

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
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      <div className="pt-40 pb-10 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4">{cms.text("page_title", t("contact.title"))}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {cms.text("page_subtitle", t("contact.subtitle"))}
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
                  <h3 className="font-bold text-lg mb-1">{t("contact.phone")}</h3>
                  <div className="space-y-1">
                    <a href="tel:+6787114045" className="block text-lg font-semibold text-primary hover:underline">+678 7114045</a>
                    <a href="tel:+6787342389" className="block text-lg font-semibold text-primary hover:underline">+678 7342389</a>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{cms.text("phone_availability", t("contact.phoneAvailable"))}</p>
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
                  <h3 className="font-bold text-lg mb-1">{t("contact.email")}</h3>
                  <a href={`mailto:${contactEmail}`} className="text-primary hover:underline text-lg font-semibold">
                    {typeof contactEmail === 'string' ? contactEmail : "acetoursvanuatu@outlook.com"}
                  </a>
                  <p className="text-sm text-muted-foreground mt-1">{cms.text("email_reply_time", t("contact.emailReply"))}</p>
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
                  <h3 className="font-bold text-lg mb-1">{t("contact.location")}</h3>
                  <p className="text-foreground font-medium">Port Vila, Vanuatu</p>
                  <div className="text-sm text-muted-foreground mt-1 prose prose-sm prose-p:m-0" dangerouslySetInnerHTML={{ __html: cms.html("office_hours", t("contact.officeHours")) }} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* WhatsApp CTA */}
          <div className="bg-[#25D366]/5 border-2 border-[#25D366]/30 rounded-2xl p-8 text-center mb-10">
            <div className="w-16 h-16 bg-[#25D366] rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Chat with Us on WhatsApp</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {cms.text("whatsapp_desc", "The fastest way to get answers, ask questions, or plan your tour. We typically reply within minutes.")}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" className="bg-[#25D366] hover:bg-[#1da851] text-white font-bold px-8" onClick={() => openWhatsApp()}>
                <MessageCircle className="h-5 w-5 mr-2" />
                Start a Conversation
                <ExternalLink className="h-4 w-4 ml-2 opacity-70" />
              </Button>
              <Button size="lg" variant="outline" className="border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10" onClick={() => openWhatsApp("Hi! I'd like to get a quote for a group booking.")}>
                Request a Quote
              </Button>
            </div>
          </div>

          {/* Contact Form */}
          <Card className="border shadow-sm">
            <CardContent className="p-8">
              {submitted ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">Message sent!</h3>
                  <p className="text-muted-foreground mb-6">Thanks for reaching out. We'll get back to you as soon as possible — usually within a few hours.</p>
                  <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ name: "", email: "", phone: "", subject: "", message: "" }); }}>
                    Send another message
                  </Button>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold mb-1">Send us a message</h2>
                  <p className="text-muted-foreground text-sm mb-6">Prefer email? Fill in the form below and we'll reply to your inbox.</p>
                  <div className="grid gap-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
                        <Input id="name" placeholder="Your full name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                        <Input id="email" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="phone">Phone <span className="text-muted-foreground text-xs">(optional)</span></Label>
                        <Input id="phone" placeholder="+678 xxxxxxx" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="subject">Subject <span className="text-muted-foreground text-xs">(optional)</span></Label>
                        <Input id="subject" placeholder="e.g. Group booking enquiry" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="message">Message <span className="text-red-500">*</span></Label>
                      <Textarea id="message" placeholder="Tell us how we can help..." rows={5} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
                      <p className="text-xs text-muted-foreground text-right">{form.message.length}/3000</p>
                    </div>
                    <Button size="lg" className="w-full sm:w-auto" onClick={handleSubmit} disabled={submitting}>
                      <Send className="h-4 w-4 mr-2" />
                      {submitting ? "Sending…" : "Send Message"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

        </div>
      </section>
    </Layout>
  );
}
