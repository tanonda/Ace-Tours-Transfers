import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { useCmsText } from "@/hooks/use-cms-text";
import { FileText, Shield, Clock, CreditCard, AlertTriangle, Phone } from "lucide-react";

export default function TermsOfService() {
  const cms = useCmsText("terms");

  return (
    <Layout>
      <SEO
        title="Terms of Service — Ace Tours & Transfers Vanuatu"
        description="Terms and conditions for booking tours, transfers and vehicle hire with Ace Tours & Transfers in Vanuatu."
      />

      {/* Page Header */}
      <div className="bg-primary/5 border-b border-primary/10 pt-36 md:pt-40 pb-12">
        <div className="container mx-auto px-4">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="h-px w-12 bg-primary"></span>
              <span className="text-primary font-semibold uppercase tracking-wider text-sm">Legal</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Terms of Service</h1>
            <p className="text-muted-foreground">Last updated: April 2026</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="prose prose-slate dark:prose-invert max-w-none space-y-10">

          {/* Intro */}
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-muted-foreground leading-relaxed">
              {cms.text("intro", "By booking a tour, transfer, or vehicle hire service with Ace Tours & Transfers, you agree to the following terms and conditions. Please read them carefully before completing your booking.")}
            </p>
          </div>

          {/* Bookings */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-foreground">1. Bookings & Confirmation</h2>
            </div>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>{cms.text("booking_1", "A booking is confirmed once you receive a confirmation email or booking reference number from Ace Tours & Transfers.")}</p>
              <p>{cms.text("booking_2", "All bookings are subject to availability. We reserve the right to cancel or modify bookings in the event of unforeseen circumstances including but not limited to extreme weather, vehicle breakdowns, or insufficient passenger numbers.")}</p>
              <p>{cms.text("booking_3", "Prices shown are per person unless otherwise stated and are in Vanuatu Vatu (VUV) unless you select a different display currency. The currency selector is for reference only — charges are processed in VUV.")}</p>
            </div>
          </section>

          {/* Cancellation */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <h2 className="text-xl font-bold text-foreground">2. Cancellation Policy</h2>
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
              <p>{cms.text("cancellation_note", "To cancel a booking, please contact us via WhatsApp at +678 7114045 or email acetoursvanuatu@outlook.com with your booking reference number. Cancellations are not accepted via social media messages.")}</p>
              <p>{cms.text("cancellation_weather", "In the event that Ace Tours & Transfers cancels a service due to weather or operational reasons, a full refund will be issued or an alternative date offered at no extra charge.")}</p>
            </div>
          </section>

          {/* Payments */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-foreground">3. Payments</h2>
            </div>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>{cms.text("payment_1", "We accept payment via bank transfer (ANZ, BRED, BSP), cash on the day of service, and local e-wallets including WanTok Money, Digicel Mobile Money, and KwikPay.")}</p>
              <p>{cms.text("payment_2", "For bank transfers, please use your booking reference number as the payment reference. Your booking will be confirmed once payment is received and verified by our team.")}</p>
              <p>{cms.text("payment_3", "Cash payments are accepted in Vanuatu Vatu (VUV). Please ensure you have the correct amount as our drivers may not carry change.")}</p>
            </div>
          </section>

          {/* Liability */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-orange-600" />
              </div>
              <h2 className="text-xl font-bold text-foreground">4. Liability & Responsibility</h2>
            </div>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>{cms.text("liability_1", "All vehicles operated by Ace Tours & Transfers are fully insured and regularly maintained. Our drivers hold valid Vanuatu driving licences.")}</p>
              <p>{cms.text("liability_2", "Ace Tours & Transfers accepts no responsibility for loss or theft of personal belongings during tours or transfers. We recommend leaving valuables at your accommodation.")}</p>
              <p>{cms.text("liability_3", "Participation in tours and activities is at your own risk. Guests with medical conditions should consult a physician before participating in physical activities.")}</p>
              <p>{cms.text("liability_4", "Ace Tours & Transfers is not liable for delays caused by traffic, road conditions, cruise ship schedules, or other factors beyond our control.")}</p>
            </div>
          </section>

          {/* Conduct */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-foreground">5. Guest Conduct</h2>
            </div>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>{cms.text("conduct_1", "We ask all guests to treat our drivers and guides with respect. Ace Tours & Transfers reserves the right to remove guests from a tour or vehicle if their behaviour endangers others or is deemed inappropriate.")}</p>
              <p>{cms.text("conduct_2", "Smoking is not permitted in any of our vehicles. Consumption of alcohol is not permitted on transfers. Any damage to our vehicles caused by guests will be charged at the cost of repair.")}</p>
            </div>
          </section>

          {/* Contact */}
          <section className="bg-primary/5 rounded-xl p-6 border border-primary/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Questions?</h2>
            </div>
            <p className="text-muted-foreground mb-4">If you have any questions about these terms, please contact us before making a booking.</p>
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
