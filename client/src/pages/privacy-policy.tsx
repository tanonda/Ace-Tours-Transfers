import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { motion } from "framer-motion";

export default function PrivacyPolicy() {
  return (
    <Layout>
      <SEO
        title="Privacy Policy — Ace Tours & Transfers Vanuatu"
        description="Privacy Policy for Ace Tours & Transfers Vanuatu. Learn how we collect, use, and protect your personal information."
      />

      {/* Page Header */}
      <div className="bg-primary/5 border-b border-primary/10 pt-32 pb-12">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="h-px w-12 bg-primary"></span>
              <span className="text-primary font-semibold uppercase tracking-wider text-sm">Legal</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: January 2026</p>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="prose prose-lg max-w-none dark:prose-invert"
          >
            <h2>1. Introduction</h2>
            <p>
              Ace Tours &amp; Transfers Vanuatu ("we", "our", or "us") is committed to protecting your personal information.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our
              website or book our services.
            </p>

            <h2>2. Information We Collect</h2>
            <h3>Personal Information</h3>
            <p>We may collect the following personal information from you:</p>
            <ul>
              <li>Name, email address, and phone number when you make a booking or enquiry</li>
              <li>Billing and payment information (processed securely — we do not store full card details)</li>
              <li>Passenger details including the number of adults, children, and infants for each booking</li>
              <li>Pickup and drop-off locations and preferred times</li>
              <li>Communication history (e.g. messages sent via our contact form or WhatsApp)</li>
            </ul>

            <h3>Automatically Collected Information</h3>
            <p>
              When you visit our website we may automatically collect device and browser information,
              IP addresses, and usage data (pages viewed, time on site) via cookies and analytics tools
              such as Google Analytics.
            </p>

            <h2>3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Process and manage your bookings and payments</li>
              <li>Send booking confirmations, itinerary details, and receipts</li>
              <li>Communicate with you about your enquiries or upcoming tours</li>
              <li>Improve our website and service offerings</li>
              <li>Send occasional promotional emails (you may unsubscribe at any time)</li>
              <li>Comply with legal obligations applicable in Vanuatu</li>
            </ul>

            <h2>4. Sharing Your Information</h2>
            <p>
              We do not sell or rent your personal information to third parties. We may share information with:
            </p>
            <ul>
              <li>Payment processors to complete transactions securely</li>
              <li>Email service providers used to deliver booking confirmations</li>
              <li>Analytics providers (data is anonymised where possible)</li>
              <li>Authorities where required by law</li>
            </ul>

            <h2>5. Data Retention</h2>
            <p>
              We retain your booking records for a minimum of seven (7) years to comply with Vanuatu financial
              and tax regulations. Marketing preferences and general enquiry data are retained for no longer than
              three (3) years unless you request deletion.
            </p>

            <h2>6. Cookies</h2>
            <p>
              Our website uses essential cookies required for core functionality (e.g. shopping cart, session management)
              and optional analytics cookies. You can control cookie preferences through your browser settings.
            </p>

            <h2>7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Request access to the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data (subject to our legal retention obligations)</li>
              <li>Opt out of marketing communications at any time</li>
            </ul>
            <p>
              To exercise any of these rights, please contact us at{" "}
              <a href="mailto:acetoursvanuatu@outlook.com" className="text-primary hover:underline">
                acetoursvanuatu@outlook.com
              </a>.
            </p>

            <h2>8. Security</h2>
            <p>
              We implement appropriate technical and organisational measures to protect your personal information
              against unauthorised access, alteration, disclosure, or destruction. All payment data is handled
              through PCI-compliant payment processors.
            </p>

            <h2>9. External Links</h2>
            <p>
              Our website may contain links to external sites (including the{" "}
              <a href="https://vanuatu.travel" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Vanuatu Tourism Office
              </a>
              ). We are not responsible for the privacy practices of those sites and encourage you to review their policies.
            </p>

            <h2>10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be posted on this page with an
              updated revision date. Continued use of our services after changes constitutes your acceptance.
            </p>

            <h2>11. Contact Us</h2>
            <p>
              For questions or concerns about this Privacy Policy, please contact:
            </p>
            <address className="not-italic">
              <strong>Ace Tours &amp; Transfers Vanuatu</strong><br />
              Port Vila, Vanuatu<br />
              Phone: <a href="tel:+6787114045" className="text-primary hover:underline">7114045</a><br />
              Email: <a href="mailto:acetoursvanuatu@outlook.com" className="text-primary hover:underline">acetoursvanuatu@outlook.com</a>
            </address>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
