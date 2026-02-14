import { useState, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchBooking, fetchBookingItems, fetchBookingPayments, fetchQrCode, initiatePayment } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Payment } from "@shared/schema";
import { QRCodeGenerator } from "@/components/QRCodeGenerator";

const PrintItinerary = lazy(() => import("@/components/print-itinerary").then(m => ({ default: m.PrintItinerary })));

export default function ConfirmationPage() {
  const [location] = useLocation();
  const bookingId = new URLSearchParams(window.location.search).get("bookingId");
  const [showPrintItinerary, setShowPrintItinerary] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const { data: booking, isLoading, error } = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => fetchBooking(bookingId!),
    enabled: !!bookingId,
  });

  const { data: payments, isLoading: isLoadingPayments, error: paymentsError } = useQuery({
    queryKey: ["bookingPayments", bookingId],
    queryFn: () => fetchBookingPayments(bookingId!),
    enabled: !!bookingId && !!booking, // Only fetch payments if booking exists
  });

  const { data: bookingItems, isLoading: isLoadingItems } = useQuery({
    queryKey: ["bookingItems", bookingId],
    queryFn: () => fetchBookingItems(bookingId!),
    enabled: !!bookingId && !!booking,
  });

  const { data: qrCode, isLoading: isLoadingQrCode, error: qrCodeError } = useQuery({
    queryKey: ["qrCode", bookingId],
    queryFn: () => fetchQrCode(bookingId!),
    enabled: !!bookingId && !!booking,
  });

  const handlePayNow = async () => {
    if (!bookingId) return;
    setIsProcessingPayment(true);
    try {
      // In a real scenario, you might prompt user for gateway selection or card details
      const { redirectUrl } = await initiatePayment(bookingId);
      window.location.href = redirectUrl; // Redirect to payment gateway or internal payment page
    } catch (err) {
      console.error("Failed to initiate payment", err);
      // TODO: Show a toast notification for error
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (isLoading || isLoadingPayments || isLoadingQrCode || isLoadingItems) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || paymentsError || qrCodeError || !booking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h2 className="text-2xl font-bold text-destructive mb-2">Booking Not Found</h2>
        <p className="text-muted-foreground mb-4">We couldn't find the booking you're looking for.</p>
        <Link href="/">
          <Button>Go to Homepage</Button>
        </Link>
      </div>
    );
  }

  const isPendingPayment = booking.status === "pending" || booking.status === "pending_payment";
  const latestPayment = payments?.[0]; // Assuming latest payment is the most relevant for display

  return (
    <div className="container py-12">
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <h1 className="text-3xl font-bold text-primary">Booking Confirmation</h1>
          <CardDescription>
            Thank you for your booking! Your adventure awaits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="font-semibold">Booking Details</h3>
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Booking ID</span>
                <span>{booking.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tour</span>
                <span>{booking.tourName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span>{booking.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Guests</span>
                <span>{booking.guests}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold">{booking.totalAmountCents ? `${(booking.totalAmountCents / 100).toLocaleString()} VUV` : booking.amount}</span>
              </div>
              
              {bookingItems && bookingItems.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Itemized Breakdown</h4>
                  <div className="space-y-4">
                    {bookingItems.map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-start">
                          <span className="font-medium">{item.productName}</span>
                          <span className="font-medium">{(item.subtotalCents / 100).toLocaleString()} VUV</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {item.adultPax > 0 && `${item.adultPax} Adults`}
                            {item.adultPax > 0 && item.childPax > 0 && " + "}
                            {item.childPax > 0 && `${item.childPax} Children`}
                            {item.productType === 'vehicle' && `${item.quantity} Days`}
                          </span>
                          <span>{(item.unitPriceCents / 100).toLocaleString()} / unit</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="capitalize">{booking.status}</span>
              </div>
              {latestPayment && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Status</span>
                    <span className="capitalize">{latestPayment.status}</span>
                  </div>
                  {latestPayment.gatewayReference && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transaction ID</span>
                      <span>{latestPayment.gatewayReference}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {isPendingPayment && (
            <div className="text-center space-y-4">
              <p className="text-lg font-medium text-destructive">Your booking requires payment.</p>
              <Button
                onClick={handlePayNow}
                className="w-full"
                size="lg"
                disabled={isProcessingPayment}
              >
                {isProcessingPayment ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  "Pay Now"
                )}
              </Button>
            </div>
          )}

          {qrCode && qrCode.qrData && (
            <div className="text-center space-y-4">
              <h3 className="font-semibold">Your Booking QR Code</h3>
              <p className="text-muted-foreground text-sm">Present this QR code for check-in.</p>
              <div className="flex justify-center">
                <QRCodeGenerator data={qrCode.qrData} size={200} />
              </div>
            </div>
          )}

          <div className="text-center">
            <p className="text-muted-foreground text-sm">
              You will receive an email confirmation shortly with all the details.
            </p>
          </div>

          <div className="border-t pt-6 space-y-4 text-center">
            <h3 className="font-semibold">Create an account to manage your bookings</h3>
            <p className="text-muted-foreground text-sm">
              With an account, you can view your booking history, manage your details, and enjoy a faster checkout next time.
            </p>
            <Link href={`/register?email=${booking.customerEmail}&name=${booking.customerName}`}>
              <Button size="lg" className="w-full">Create Account</Button>
            </Link>
          </div>
          <div className="flex justify-center mt-6">
            <Button onClick={() => setShowPrintItinerary(true)} variant="outline">
              View / Print Itinerary
            </Button>
          </div>
        </CardContent>
      </Card>
      {showPrintItinerary && booking && (
        <Suspense fallback={<div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
          <PrintItinerary
            booking={booking}
            items={bookingItems}
            payments={payments || []}
            qrCodeData={qrCode?.qrData}
            onClose={() => setShowPrintItinerary(false)}
          />
        </Suspense>
      )}
    </div>
  );
}