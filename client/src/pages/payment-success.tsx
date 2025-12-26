import { useEffect } from "react";
import { useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Home, Loader2, Clock } from "lucide-react";
import { Layout } from "@/components/layout";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

export default function PaymentSuccess() {
  const { t } = useTranslation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const bookingId = params.get("booking");

  useEffect(() => {
    localStorage.removeItem('pendingCart');
  }, []);

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: async () => {
      if (!bookingId) return null;
      const res = await fetch(`/api/bookings/${bookingId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!bookingId && bookingId !== "demo",
    refetchInterval: 3000,
  });

  const isConfirmed = booking?.status === "confirmed" || booking?.status === "completed";
  const isPending = !booking || booking?.status === "pending";

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
      <div className="min-h-[60vh] flex items-center justify-center p-4 pt-40">
        <Card className="w-full max-w-md text-center shadow-lg">
          <CardHeader>
            {isConfirmed ? (
              <>
                <div className="mx-auto bg-green-100 dark:bg-green-900/30 p-4 rounded-full w-fit mb-4">
                  <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle className="text-2xl text-green-600 dark:text-green-400">
                  {t("payment.success") || "Booking Confirmed!"}
                </CardTitle>
                <CardDescription className="text-base">
                  {t("payment.successDesc") || "Your booking has been confirmed. Thank you for choosing Ace Tours & Transfers!"}
                </CardDescription>
              </>
            ) : (
              <>
                <div className="mx-auto bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full w-fit mb-4">
                  <Clock className="h-12 w-12 text-amber-600 dark:text-amber-400" />
                </div>
                <CardTitle className="text-2xl text-amber-600 dark:text-amber-400">
                  {t("payment.pending") || "Payment Received"}
                </CardTitle>
                <CardDescription className="text-base">
                  {t("payment.pendingDesc") || "We're confirming your payment. This usually takes a moment."}
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {bookingId && bookingId !== "demo" && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Booking Reference</p>
                <p className="font-mono font-bold text-lg" data-testid="text-booking-id">{bookingId.slice(0, 8).toUpperCase()}</p>
              </div>
            )}
            {booking && (
              <div className="bg-muted/50 p-4 rounded-lg text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Tour</span>
                  <span className="font-medium">{booking.tourName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Date</span>
                  <span className="font-medium">{booking.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Guests</span>
                  <span className="font-medium">{booking.guests}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="font-bold">{booking.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className={`font-medium capitalize ${isConfirmed ? "text-green-600" : "text-amber-600"}`}>
                    {booking.status}
                  </span>
                </div>
              </div>
            )}
            {isPending && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Checking payment status...</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {isConfirmed 
                ? (t("payment.confirmationEmail") || "A confirmation email has been sent to your registered email address.")
                : "You'll receive a confirmation email once the payment is verified."
              }
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Link href="/customer/bookings" className="w-full">
              <Button className="w-full" size="lg" data-testid="button-view-bookings">
                {t("dashboard.viewBookings") || "View My Bookings"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/" className="w-full">
              <Button variant="outline" className="w-full" data-testid="button-go-home">
                <Home className="mr-2 h-4 w-4" />
                {t("nav.home") || "Return Home"}
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </Layout>
  );
}
