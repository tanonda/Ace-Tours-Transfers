import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { useCmsText } from "@/hooks/use-cms-text";
import { Clock, CreditCard, RotateCcw, CloudRain, CalendarClock, Phone } from "lucide-react";

export default function RefundPolicy() {
  const cms = useCmsText("refund");

  return (
    <Layout>
      <SEO
        title="Cancellation & Refund Policy — Ace Tours & Transfers Vanuatu"
        description="Cancellation and refund policy for tours and transfers booked with Ace Tours & Transfers in Vanuatu. Refund tiers, card refunds through BRED Bank, and weather cancellations."
      />

      {/* Page Header */}
      <div className="bg-primary/5 border-b border-primary/10 pt-header-page pb-12">
        <div className="container mx-auto px-4">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="h-px w-12 bg-primary"></span>
              <span className="text-primary font-semibold uppercase tracking-wider text-sm">Legal</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Cancellation &amp; Refund Policy</h1>
            <p className="text-muted-foreground">Last updated: November 2026</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="prose prose-slate dark:prose-invert max-w-none space-y-10">

          {/* Intro */}
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-muted-foreground leading-relaxed">
              {cms.text("intro", "This policy explains how cancellations and refunds work for tours and transfers booked with Ace Tours & Transfers Vanuatu. It is part of, and should be read together with, our Terms of Service. By completing a booking you agree to this policy.")}
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Questions before you book? Contact us on WhatsApp at{" "}
              <a href="https://wa.me/6787114045" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                +678 7114045
              </a>{" "}
              or email{" "}
              <a href="mailto:acetoursvanuatu@outlook.com" className="text-primary hover:underline">
                acetoursvanuatu@outlook.com
              </a>.
            </p>
          </div>

          {/* Cancellation windows */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <h2 className="text-xl font-bold text-foreground">1. Cancellation Windows &amp; Refunds</h2>
            </div>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-3 font-semibold text-foreground">Notice Period</th>
                      <th className="text-left p-3 font-semibold text-foreground">Refund</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border">
                      <td className="p-3">More than 48 hours before service</td>
                      <td className="p-3 font-semibold text-green-600">100% full refund</td>
                    </tr>
                    <tr className="border-t border-border bg-muted/20">
                      <td className="p-3">24–48 hours before service</td>
                      <td className="p-3 font-semibold text-yellow-600">50% refund</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="p-3">Less than 24 hours before service</td>
                      <td className="p-3 font-semibold text-red-500">No refund</td>
                    </tr>
                    <tr className="border-t border-border bg-muted/20">
                      <td className="p-3">No-show</td>
                      <td className="p-3 font-semibold text-red-500">No refund</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                {cms.text("cancellation_note", "The notice period is calculated from the scheduled start time of your tour or transfer. A cancellation is only effective once we have acknowledged it — please keep our reply as confirmation.")}
              </p>
            </div>
          </section>

          {/* How to cancel */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Phone className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-foreground">2. How to Cancel</h2>
            </div>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>
                {cms.text("how_to_cancel", "To cancel a booking, contact us via WhatsApp at +678 7114045 or email acetoursvanuatu@outlook.com and quote your booking reference number (for example, ACT-XXXXXXXX). Cancellations are not accepted via social media messages.")}
              </p>
              <p>
                {cms.text("how_to_cancel_2", "If your booking was paid by card, please tell us when you cancel so we can start the refund against the same payment. We may ask you to confirm a few details to protect you against unauthorised refund requests.")}
              </p>
            </div>
          </section>

          {/* Refunds */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-foreground">3. How Refunds Are Paid</h2>
            </div>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>
                {cms.text("refund_method", "Refunds are paid to the original payment method used for the booking. We do not issue refunds in cash or to a different card or account unless the original method is unavailable.")}
              </p>
              <p>
                {cms.text("refund_card", "Card payments are processed by BRED Bank Vanuatu through the PayZen hosted payment page. Card refunds are made through the bank's PayZen merchant portal and are credited back to the card used for the original payment. BRED Bank and your card issuer then need time to process the refund, so please allow up to 10 business days for the credit to appear on your statement.")}
              </p>
              <p>
                {cms.text("refund_other", "Refunds for bank transfers or cash payments are paid in Vanuatu Vatu (VUV) by bank transfer to an account in your name. We will contact you to confirm the account details and any banking costs charged by your bank.")}
              </p>
              <p>
                {cms.text("refund_currency", "Refunds are calculated on the VUV amount actually received for the booking. If you paid in another currency, the amount refunded may differ from your original card charge because of exchange-rate movements and bank fees set by your card issuer.")}
              </p>
            </div>
          </section>

          {/* Cancelled by us */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <CloudRain className="h-5 w-5 text-orange-600" />
              </div>
              <h2 className="text-xl font-bold text-foreground">4. If We Cancel (Weather or Operational Reasons)</h2>
            </div>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>
                {cms.text("operator_cancel", "If Ace Tours & Transfers cancels a tour or transfer because of weather, road or sea conditions, vehicle breakdowns, unsafe conditions, or other operational reasons, you can choose either a full refund or a free rebooking for another date, subject to availability. No cancellation fee applies.")}
              </p>
              <p>
                {cms.text("operator_cancel_2", "We will contact you using the phone number or email address on your booking as early as possible if a service cannot go ahead.")}
              </p>
            </div>
          </section>

          {/* Changes */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <CalendarClock className="h-5 w-5 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-foreground">5. Changes &amp; Reschedules</h2>
            </div>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>
                {cms.text("changes", "If you need to change the date or time of your booking, contact us as early as possible. Changes are subject to availability and any price difference. If a change is not possible and you choose to cancel instead, the cancellation windows in section 1 apply.")}
              </p>
            </div>
          </section>

          {/* Chargebacks */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center">
                <RotateCcw className="h-5 w-5 text-slate-600" />
              </div>
              <h2 className="text-xl font-bold text-foreground">6. Billing Questions &amp; Chargebacks</h2>
            </div>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>
                {cms.text("chargeback", "If you do not recognise a charge or believe a refund is missing, please contact us first so we can check the payment and help put it right. If we cannot resolve the matter, you can ask your card issuer about a chargeback; chargebacks are handled by the card issuer and BRED Bank under the card scheme rules.")}
              </p>
            </div>
          </section>

          {/* Related policies */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <RotateCcw className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">7. Related Policies</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Read our{" "}
              <Link href="/terms-of-service" className="text-primary hover:underline">
                Terms of Service
              </Link>{" "}
              for the full booking conditions and our{" "}
              <Link href="/privacy-policy" className="text-primary hover:underline">
                Privacy Policy
              </Link>{" "}
              to learn how we handle your personal information.
            </p>
          </section>

          {/* Contact */}
          <section className="bg-primary/5 rounded-xl p-6 border border-primary/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Questions?</h2>
            </div>
            <p className="text-muted-foreground mb-4">
              If you have a question about a cancellation or refund, please contact us with your booking reference.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="https://wa.me/6787114045"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
              >
                WhatsApp Us
              </a>
              <a
                href="mailto:acetoursvanuatu@outlook.com"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Email Us
              </a>
            </div>
          </section>

        </div>
      </div>
    </Layout>
  );
}
