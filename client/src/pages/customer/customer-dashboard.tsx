import { useQuery } from "@tanstack/react-query";
import { fetchUserBookings, fetchBookingPayments } from "@/lib/api";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useState, lazy, Suspense } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Loader2, Calendar, Wallet, Heart, HelpCircle, Ticket, Download, X, Printer, FileText } from "lucide-react";

const PrintItinerary = lazy(() => import("@/components/print-itinerary").then(m => ({ default: m.PrintItinerary })));

function TicketModal({ booking, onClose, t }: { booking: any; onClose: () => void; t: any }) {
  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">{t("dashboard.eTicket")}</DialogTitle>
        </DialogHeader>
        <div className="bg-white text-gray-800 p-5 rounded-lg border">
          <div className="text-center mb-4">
            <div className="text-xl font-bold text-primary">{t("app.title")}</div>
            <div className="text-xs text-muted-foreground">{t("dashboard.vanuatu")}</div>
          </div>
          <hr className="border-dashed border-gray-300 my-4" />
          <div className="space-y-2 text-sm">
            <div><strong>{t("booking.id")}:</strong> {}</div>
            <div><strong>{t("booking.tour")}:</strong> {booking.tourName}</div>
            <div><strong>{t("booking.customer")}:</strong> {booking.customerName}</div>
            <div><strong>{t("booking.date")}:</strong> {booking.date}</div>
            <div><strong>{t("booking.guests")}:</strong> {booking.guests}</div>
            <div><strong>{t("booking.amount")}:</strong> {booking.amount}</div>
          </div>
          <hr className="border-dashed border-gray-300 my-4" />
          <div className="text-center text-xs text-muted-foreground">
            {t("dashboard.presentTicket")}
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <Button data-testid="button-print-ticket" onClick={() => window.print()} className="flex-1">
            <Printer className="h-4 w-4 mr-2" /> {t("dashboard.print")}
          </Button>
          <Button data-testid="button-close-ticket" variant="outline" onClick={onClose} className="flex-1">
            {t("dashboard.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReviewModal({ booking, onClose, t, toast }: { booking: any; onClose: () => void; t: any; toast: any }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          tourId: booking.tourId,
          rating,
          comment
        })
      });
      if (!res.ok) throw new Error("Failed to submit review");
      toast({ title: t("common.success"), description: "Review submitted successfully!" });
      onClose();
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("dashboard.rateYourExperience", "Rate your experience")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex flex-col items-center gap-2">
            <div className="text-sm font-medium mb-2">{t("dashboard.howWasYourTour", "How was your tour?")}</div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${rating >= star ? 'bg-yellow-400 text-white' : 'bg-muted text-muted-foreground'}`}
                >
                  <Star className="h-6 w-6 fill-current" />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="review-comment">{t("dashboard.comment", "Comment")}</Label>
            <Textarea
              id="review-comment"
              placeholder={t("dashboard.reviewPlaceholder", "Tell us more about your trip...")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="resize-none h-32"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t("common.submit", "Submit")}
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">
            {t("common.cancel", "Cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BookingsTable({ rows, onViewTicket, onLeaveReview, t }: { rows: any[]; onViewTicket: (booking: any) => void; onLeaveReview: (booking: any) => void; t: any }) {
  const getTranslatedStatus = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'paid' || statusLower === 'confirmed') return t("booking.confirmed");
    if (statusLower === 'pending') return t("booking.pending");
    if (statusLower === 'completed') return t("booking.completed");
    if (statusLower === 'cancelled') return t("booking.cancelled");
    return status;
  };

  const getStatusBadge = (status: string) => {
    const translatedStatus = getTranslatedStatus(status);
    if (status === 'Paid' || status === 'confirmed') {
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30">{translatedStatus}</Badge>;
    }
    if (status === 'Pending' || status === 'pending') {
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30">{translatedStatus}</Badge>;
    }
    return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30">{translatedStatus}</Badge>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground border-b">
          <tr>
            <th className="p-3 font-medium">{t("booking.id")}</th>
            <th className="p-3 font-medium">{t("booking.tour")}</th>
            <th className="p-3 font-medium">{t("booking.date")}</th>
            <th className="p-3 font-medium">{t("booking.amount")}</th>
            <th className="p-3 font-medium">{t("booking.status")}</th>
            <th className="p-3 font-medium">{t("common.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i} data-testid={`row-booking-${r.id || i}`} className="border-b border-border/50 hover:bg-muted/30">
              <td className="p-3 text-foreground/90">#{(r.id || '').slice(0, 6) || i}</td>
              <td className="p-3 text-foreground/90">{r.tourName || r.route || r.tour}</td>
              <td className="p-3 text-foreground/90">{r.date}</td>
              <td className="p-3 text-foreground/90">{r.amount}</td>
              <td className="p-3">{getStatusBadge(r.status)}</td>
              <td className="p-3">
                <div className="flex gap-2">
                  <Button
                    data-testid={`button-view-ticket-${r.id || i}`}
                    onClick={() => onViewTicket(r)}
                    size="sm"
                    className="text-xs"
                  >
                    <Ticket className="h-3 w-3 mr-1" /> {t("dashboard.viewTicket")}
                  </Button>
                  {r.status === 'completed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs border-primary text-primary hover:bg-primary/10"
                      onClick={() => onLeaveReview(r)}
                    >
                      <Star className="h-3 w-3 mr-1" /> {t("dashboard.leaveReview", "Review")}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [reviewBooking, setReviewBooking] = useState<any>(null);
  const [itineraryBooking, setItineraryBooking] = useState<any>(null);
  const { t, i18n } = useTranslation();

  const fmtVT = (n?: number) => {
    if (n == null) return '-';
    const formattedNumber = n.toLocaleString(i18n.language === 'zh' ? 'zh-CN' : i18n.language === 'fr' ? 'fr-FR' : i18n.language === 'es' ? 'es-ES' : 'en-US');
    return `${formattedNumber} ${t("dashboard.currencySuffix")}`;
  };

  const { data: bookings = [] } = useQuery({
    queryKey: ["user-bookings", user?.id],
    queryFn: () => user?.id ? fetchUserBookings(user.id) : Promise.resolve([]),
    enabled: !!user?.id,
  });

  const { data: bookingPayments = [], isLoading: isLoadingPayments } = useQuery({
    queryKey: ["booking-payments", itineraryBooking?.id],
    queryFn: () => itineraryBooking?.id ? fetchBookingPayments(itineraryBooking.id) : Promise.resolve([]),
    enabled: !!itineraryBooking?.id,
  });

  const upcomingTrips = bookings.filter(b => b.status === 'confirmed' || b.status === 'pending');
  const walletBalance = 52300;

  return (
    <DashboardLayout type="customer">
      {selectedBooking && (
        <TicketModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} t={t} />
      )}

      {reviewBooking && (
        <ReviewModal booking={reviewBooking} onClose={() => setReviewBooking(null)} t={t} toast={toast} />
      )}

      {itineraryBooking && (
        <Suspense fallback={<div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
          <PrintItinerary booking={itineraryBooking} payments={bookingPayments} onClose={() => setItineraryBooking(null)} />
        </Suspense>
      )}

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("dashboard.welcome")}, {user?.name || t("dashboard.guest")}!</h1>
          <p className="text-muted-foreground">{t("dashboard.welcomeDesc")}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {t("dashboard.upcomingTrips")}
              </CardTitle>
              <Link href="/tours">
                <Button data-testid="button-new-booking" size="sm">{t("dashboard.bookNewTrip")}</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {upcomingTrips.length ? (
                <div className="space-y-3">
                  {upcomingTrips.map(b => (
                    <div
                      key={b.id}
                      data-testid={`upcoming-trip-${b.id}`}
                      className="flex justify-between items-center p-3 bg-muted/30 rounded-lg border border-border/50"
                    >
                      <div>
                        <div className="font-semibold text-foreground">{b.tourName}</div>
                        <div className="text-sm text-muted-foreground">{b.date} • {b.guests} {t("booking.guests")}</div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="font-bold text-foreground">{b.amount}</span>
                        <Button
                          data-testid={`button-download-ticket-${b.id}`}
                          onClick={() => setSelectedBooking(b)}
                          size="sm"
                          variant="outline"
                        >
                          <Ticket className="h-4 w-4 mr-1" /> {t("dashboard.ticket")}
                        </Button>
                        <Button
                          data-testid={`button-print-itinerary-${b.id}`}
                          onClick={() => setItineraryBooking(b)}
                          size="sm"
                          variant="outline"
                        >
                          <FileText className="h-4 w-4 mr-1" /> {t("itinerary.print", "Itinerary")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {t("dashboard.noUpcomingTrips")} <Link href="/tours" className="text-primary hover:underline">{t("dashboard.bookSomethingFun")}</Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                {t("dashboard.wallet")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary mb-1">{fmtVT(walletBalance)}</div>
              <p className="text-sm text-muted-foreground mb-4">{t("dashboard.availableBalance")}</p>
              <div className="flex gap-2">
                <Button
                  data-testid="button-topup"
                  onClick={() => toast({ title: t("dashboard.topUp"), description: t("dashboard.topUpComingSoon") })}
                  size="sm"
                  className="flex-1"
                >
                  {t("dashboard.topUp")}
                </Button>
                <Button
                  data-testid="button-withdraw"
                  onClick={() => toast({ title: t("dashboard.withdraw"), description: t("dashboard.withdrawComingSoon") })}
                  size="sm"
                  variant="outline"
                  className="flex-1"
                >
                  {t("dashboard.withdraw")}
                </Button>
              </div>
              <div className="mt-4 p-3 bg-background/50 rounded-lg border border-border/50">
                <div className="text-xs text-muted-foreground mb-1">{t("dashboard.loyaltyPoints")}</div>
                <div className="font-bold text-lg text-foreground">2,450 pts</div>
                <div className="text-xs text-muted-foreground">{t("dashboard.bronzeMember")}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">{t("dashboard.recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            {bookings.length > 0 ? (
              <BookingsTable rows={bookings} onViewTicket={setSelectedBooking} onLeaveReview={setReviewBooking} t={t} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {t("dashboard.noBookingHistory")} <Link href="/tours" className="text-primary hover:underline">{t("dashboard.startExploringTours")}</Link>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-blue-500/10 to-green-500/10 border-blue-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Heart className="h-5 w-5 text-pink-500" />
                {t("dashboard.savedTours")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                {t("dashboard.savedInWishlist", { count: 5 })}
              </p>
              <Button
                data-testid="button-view-wishlist"
                onClick={() => setLocation('/dashboard/saved')}
                variant="secondary"
                size="sm"
              >
                {t("dashboard.viewWishlist")}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border-orange-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-orange-500" />
                {t("dashboard.needHelp")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                {t("dashboard.needHelpDesc")}
              </p>
              <Link href="/contact">
                <Button
                  data-testid="button-contact-support"
                  variant="secondary"
                  size="sm"
                >
                  {t("dashboard.contactSupport")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
