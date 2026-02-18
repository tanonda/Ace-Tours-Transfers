import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle, ArrowRight, Home, Loader2, Clock, Building2,
  Copy, MessageCircle, Phone, Mail, Banknote, DollarSign, ExternalLink
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useCMS } from "@/lib/cms-context";

const WHATSAPP_NUMBER = "6787114045";

export default function PaymentSuccess() {
  const { toast } = useToast();
  const { getSetting } = useCMS();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const bookingId = params.get("booking") || params.get("id");
  const isManual = params.get("manual") === "true";
  const paymentMethod = params.get("method") || "manual_transfer";
  const isCash = paymentMethod === "cash";

  const [copiedRef, setCopiedRef] = useState(false);

  // Get bank details from individual site settings
  const bankName = (getSetting("bank_name") as any) || "ANZ Bank (Vanuatu) Ltd";
  const accountName = (getSetting("bank_account_name") as any) || "Ace Tours & Transfers";
  const accountNumber = (getSetting("bank_account_number") as any) || "Contact us for account details";
  const swiftCode = (getSetting("bank_swift_code") as any) || "";
  const branchCode = (getSetting("bank_branch_code") as any) || "";

  useEffect(() => {
    localStorage.removeItem('pendingCart');
    localStorage.removeItem('ace-tours-booking-draft');
  }, []);

  const { data: booking, isLoading } = useQuery<{ status: string; customerName?: string; totalAmountCents?: number }>({
    queryKey: ["booking", bookingId],
    queryFn: async () => {
      if (!bookingId) return null;
      const res = await fetch(`/api/bookings/${bookingId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!bookingId && bookingId !== "demo",
    refetchInterval: (query) => {
      // Stop polling once confirmed
      const data = query.state.data;
      if (data?.status === "confirmed" || data?.status === "completed") return false;
      return 5000;
    },
  });

  const isConfirmed = booking?.status === "confirmed" || booking?.status === "completed";
  const shortRef = bookingId ? bookingId.slice(0, 8).toUpperCase() : "PENDING";

  const copyRef = () => {
    navigator.clipboard.writeText(shortRef);
    setCopiedRef(true);
    toast({ title: "Copied!", description: "Booking reference copied to clipboard." });
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const openWhatsApp = () => {
    const msg = encodeURIComponent(`Hi! I've made a booking (Ref: #${shortRef}) and would like to confirm my payment details.`);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center p-4 pt-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center p-4 pt-40 pb-16">
        <div className="w-full max-w-lg space-y-4">

          {/* Status Card */}
          <Card className="shadow-lg border-none overflow-hidden">
            <div className={`h-2 w-full ${isConfirmed ? 'bg-green-500' : 'bg-amber-400'}`} />
            <CardHeader className="text-center pb-4">
              <div className={`mx-auto p-4 rounded-full w-fit mb-3 ${isConfirmed ? 'bg-green-100' : 'bg-amber-100'}`}>
                {isConfirmed
                  ? <CheckCircle className="h-12 w-12 text-green-600" />
                  : isCash
                    ? <DollarSign className="h-12 w-12 text-amber-600" />
                    : <Clock className="h-12 w-12 text-amber-600" />
                }
              </div>
              <CardTitle className={`text-2xl ${isConfirmed ? 'text-green-600' : 'text-amber-600'}`}>
                {isConfirmed ? "Booking Confirmed! 🎉" : isCash ? "You're All Set! 💚" : "Booking Received"}
              </CardTitle>
              <p className="text-muted-foreground text-sm mt-1">
                {isConfirmed
                  ? "Your adventure is secured. See you soon!"
                  : isCash
                    ? "Please pay at the start of your tour or vehicle pickup."
                    : "Please complete your bank transfer to secure your booking."
                }
              </p>
            </CardHeader>

            <CardContent className="space-y-4 px-6 pb-6">

              {/* Booking Reference */}
              <div className="bg-muted/50 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Booking Reference</p>
                  <p className="font-mono font-bold text-2xl tracking-widest text-foreground">#{shortRef}</p>
                </div>
                <Button variant="outline" size="sm" onClick={copyRef} className="gap-2">
                  <Copy className="h-4 w-4" />
                  {copiedRef ? "Copied!" : "Copy"}
                </Button>
              </div>

              {/* Booking details */}
              {booking && (
                <div className="space-y-2 text-sm">
                  {booking.customerName && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Customer</span>
                      <span className="font-medium">{booking.customerName}</span>
                    </div>
                  )}
                  {booking.totalAmountCents && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Amount</span>
                      <span className="font-bold text-base">VT {(booking.totalAmountCents / 100).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={isConfirmed ? "default" : "secondary"} className={isConfirmed ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                      {booking.status?.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Manual Payment Instructions */}
              {isManual && !isCash && !isConfirmed && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-2 text-blue-800 font-bold">
                    <Building2 className="h-5 w-5" />
                    <h3>Bank Transfer Details</h3>
                  </div>
                  <p className="text-sm text-blue-700">
                    Transfer the exact amount below and use your <strong>Booking Reference #{shortRef}</strong> as the payment description/reference.
                  </p>
                  <div className="bg-white rounded-lg border border-blue-100 divide-y divide-blue-50 text-sm overflow-hidden">
                    {[
                      ["Bank Name", bankName],
                      ["Account Name", accountName],
                      ["Account Number", accountNumber],
                      ...(swiftCode ? [["SWIFT / BIC", swiftCode]] : []),
                      ...(branchCode ? [["Branch Code", branchCode]] : []),
                      ["Reference", `#${shortRef}`],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between px-4 py-3">
                        <span className="text-muted-foreground font-medium">{label}</span>
                        <span className="font-bold text-right">{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                    ⚠️ Your booking is held for <strong>24 hours</strong>. If payment is not received within this time, it may be released.
                  </div>
                </div>
              )}

              {/* Cash instructions */}
              {isCash && (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 text-green-800 font-bold mb-2">
                    <Banknote className="h-5 w-5" />
                    <h3>Cash Payment</h3>
                  </div>
                  <p className="text-sm text-green-700">
                    Please have the exact amount ready at the start of your tour or vehicle pickup. Our guide/driver will collect payment.
                  </p>
                </div>
              )}

              <p className="text-xs text-center text-muted-foreground">
                A confirmation has been sent to your email address.
              </p>
            </CardContent>
          </Card>

          {/* WhatsApp Contact CTA */}
          <Card className="shadow-sm border-none bg-[#25D366]/5 border-2 border-[#25D366]/30">
            <CardContent className="p-4">
              <p className="text-sm text-center font-medium mb-3">Have a question about your booking?</p>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-[#25D366] hover:bg-[#1da851] text-white gap-2"
                  onClick={openWhatsApp}
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp Us
                </Button>
                <Button variant="outline" className="flex-1 gap-2" asChild>
                  <a href="mailto:acetoursvanuatu@outlook.com">
                    <Mail className="h-4 w-4" />
                    Email Us
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <Link href="/customer/bookings" className="w-full">
              <Button className="w-full" size="lg">
                View My Bookings
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/" className="w-full">
              <Button variant="outline" className="w-full">
                <Home className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
