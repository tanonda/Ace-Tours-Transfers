import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { useTranslation } from "react-i18next";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Info, HelpCircle } from "lucide-react";
import { useCmsText } from "@/hooks/use-cms-text";

export default function FAQ() {
    const { t } = useTranslation();
    const cms = useCmsText("faq");

    const defaultFaqs = [
        {
            question: "Do I need to pay in advance?",
            answer: "No, we offer flexible payment options. You can pay securely online via credit card (Stripe, pending merchant availability), or choose local payment methods like Cash on Delivery, Bank Transfer, BRED Bank, BSP, and various local e-wallets like WanTok Money, Digicel Mobile Money, and KwikPay."
        },
        {
            question: "What is your cancellation policy?",
            answer: "We offer a flexible cancellation policy. Cancellations made more than 48 hours before the scheduled tour or transfer are fully refundable. Cancellations within 48 hours may incur a fee. Please reach out to our team if you need to make changes to your booking."
        },
        {
            question: "Where do you pick up from?",
            answer: "We pick up from all major hotels, resorts, and the cruise ship terminal in Port Vila. During the booking process, you can specify your exact pickup location. We also provide dedicated airport transfers to and from Bauerfield International Airport."
        },
        {
            question: "Are your vehicles air-conditioned?",
            answer: "Yes! Your comfort is our priority. All our vans, buses, and private transfer vehicles are fully air-conditioned and regularly maintained to ensure a pleasant journey around Vanuatu."
        },
        {
            question: "Do you offer private or group tours?",
            answer: "We offer both! You can join one of our scheduled group tours to see the highlights of Efate, or you can book a private vehicle and driver for a customized itinerary tailored exactly to your preferences."
        },
        {
            question: "How can I contact from overseas?",
            answer: "You can reach us easily via WhatsApp at +678 7114045, or via email at acetoursvanuatu@outlook.com. We are available 24/7 to assist with your travel inquiries."
        },
        {
            question: "What currencies do you accept?",
            answer: "We accept Vanuatu Vatu (VUV), Australian Dollars (AUD), and New Zealand Dollars (NZD). On our website, you can use the currency selector at the top to view prices in your preferred currency."
        }
    ];

    const faqs = [];
    for (let i = 1; i <= 20; i++) {
        // Find default or fallback to empty
        const defaultQ = i <= defaultFaqs.length ? defaultFaqs[i - 1].question : "";
        const defaultA = i <= defaultFaqs.length ? defaultFaqs[i - 1].answer : "";

        const q = cms.text(`faq${i}_q`, defaultQ);
        const a = cms.html(`faq${i}_a`, defaultA);
        if (q && a) {
            faqs.push({ question: q, answer: a });
        }
    }

    return (
        <Layout>
            <SEO
                title="Frequently Asked Questions - Ace Tours & Transfers"
                description="Find answers to common questions about our Vanuatu tours, airport transfers, vehicle hire, payments, cancellations, and pickup locations in Port Vila."
                keywords={["Vanuatu tour FAQ", "Port Vila transfer questions", "vehicle hire Vanuatu FAQ", "Ace Tours help"]}
                faqs={faqs}
            />
            <div className="bg-muted/30 pt-32 md:pt-40 pb-16 md:pb-24">
                <div className="container mx-auto px-4 max-w-4xl">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl font-serif font-bold text-primary mb-4">Frequently Asked Questions</h1>
                        <p className="text-lg text-muted-foreground flex items-center justify-center gap-2">
                            <HelpCircle className="h-5 w-5 text-primary" />
                            Everything you need to know about Ace Tours & Transfers
                        </p>
                    </div>

                    <div className="bg-card rounded-2xl shadow-xl border border-border/50 p-6 md:p-10">
                        <Accordion type="single" collapsible className="w-full">
                            {faqs.map((faq, index) => (
                                <AccordionItem key={index} value={`item-${index}`} className="border-border/40 py-1">
                                    <AccordionTrigger className="text-left text-base font-semibold hover:text-primary transition-colors data-[state=open]:text-primary">
                                        {faq.question}
                                    </AccordionTrigger>
                                    <AccordionContent className="text-muted-foreground leading-relaxed pt-2 pb-4">
                                        <div dangerouslySetInnerHTML={{ __html: faq.answer }} className="prose prose-sm max-w-none dark:prose-invert" />
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>

                    <div className="mt-12 bg-primary/5 rounded-2xl p-8 border border-primary/20 text-center">
                        <Info className="h-8 w-8 text-primary mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Still have questions?</h3>
                        <p className="text-muted-foreground mb-6">
                            Our local experts are available 24/7 to help you plan your perfect Vanuatu experience.
                        </p>
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <a
                                href="mailto:acetoursvanuatu@outlook.com"
                                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                            >
                                Email Us
                            </a>
                            <a
                                href="https://wa.me/6787114045"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                            >
                                WhatsApp Us
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
