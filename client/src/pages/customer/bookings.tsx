import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Download, Eye, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { lazy, Suspense, useState } from "react";
import { BookingDetailsDialog } from "@/components/customer/booking-details-dialog";
import { EditBookingDialog } from "@/components/customer/edit-booking-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchUserBookings, fetchBookingItems, fetchBookingPayments, fetchQrCode } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";

const PrintItinerary = lazy(() => import("@/components/print-itinerary").then(m => ({ default: m.PrintItinerary })));


export default function CustomerBookings() {
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["user-bookings", user?.id],
    queryFn: () => user ? fetchUserBookings(user.id) : Promise.resolve([]),
    enabled: !!user,
  });

  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [ticket, setTicket] = useState<{ booking: any; items: any[]; payments: any[]; qrCodeData?: string } | null>(null);

  const handleDownloadTicket = async (booking: any) => {
    try {
      const [items, payments, qr] = await Promise.all([
        fetchBookingItems(booking.id),
        fetchBookingPayments(booking.id),
        fetchQrCode(booking.id).catch(() => ({ qrData: "" })),
      ]);
      setTicket({ booking, items, payments, qrCodeData: qr?.qrData });
    } catch (error: any) {
      toast({ title: "Could not load ticket", description: error.message || "Please try again.", variant: "destructive" });
    }
  };

  const queryClient = useQueryClient();

  const handleViewBooking = (booking: any) => {
    setSelectedBooking(booking);
    setIsViewOpen(true);
  };

  const handleEditBooking = (booking: any) => {
    setSelectedBooking(booking);
    setIsEditOpen(true);
  };

  const handleSaveBooking = async (updatedBooking: any) => {
    const original = selectedBooking;
    if (!original?.customerEmail) {
      toast({ title: "Cannot modify", description: "The booking has no email address to verify.", variant: "destructive" });
      return;
    }
    try {
      // Open a short-lived guest session for this booking, then use the same
      // modify endpoint the manage-booking page uses (re-checks availability and
      // records any price difference).
      await apiRequest("POST", "/api/bookings/session", {
        bookingId: original.id,
        email: original.customerEmail,
      });
      const res = await apiRequest("POST", "/api/bookings/session/modify", {
        date: updatedBooking.date,
        adultPax: Number(updatedBooking.guests) || 1,
        childPax: 0,
      });
      const result = await res.json();
      if (result.changed === false) {
        toast({ title: "No changes", description: result.message || "Nothing to update." });
      } else {
        toast({
          title: "Booking updated",
          description: result.message || "Your booking has been updated.",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["user-bookings", user?.id] });
    } catch (error: any) {
      toast({
        title: "Could not modify booking",
        description: error.message || "Please try again or contact us.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout type="customer">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout type="customer">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Bookings</h1>
          <p className="text-muted-foreground">Manage your upcoming trips and view history.</p>
        </div>

        <div className="space-y-4">
          {bookings.length === 0 ? (
            <Card className="p-8 text-center bg-muted/20">
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-primary/10 rounded-full">
                  <Calendar className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold">No bookings yet</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">You haven't made any bookings yet. Browse our tours to find your next adventure!</p>
                <Button onClick={() => window.location.href = '/tours'}>Browse Tours</Button>
              </div>
            </Card>
          ) : (
            bookings.map((booking) => (
              <Card key={booking.id} className="overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                  <div className="w-full sm:w-48 h-48 sm:h-auto relative">
                    {/* Placeholder image logic - ideally fetch from tour data or use a generic one */}
                    <img
                      src={booking.tourName.toLowerCase().includes("transfer")
                        ? "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765064625/ace-tours-assets/transfer_airport_van.jpg"
                        : "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765064618/ace-tours-assets/tour_scenic_efate.jpg"}
                      alt={booking.tourName}
                      className="w-full h-full object-cover absolute inset-0"
                    />
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-bold text-xl text-foreground">{booking.tourName}</h3>
                          <p className="text-sm text-muted-foreground">Ref: ACT-{booking.id.replace(/^book_/i, "").replace(/-/g, "").slice(0, 8).toUpperCase()}</p>
                        </div>
                        <Badge
                          variant={booking.status === "confirmed" ? "default" : "secondary"}
                          className={booking.status === "confirmed" ? "bg-green-500 hover:bg-green-600" : ""}
                        >
                          {booking.status.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {new Date(booking.date).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          Hotel Pickup
                        </div>
                        <div className="text-foreground">
                          <span className="font-medium">Guests:</span> {booking.guests}
                        </div>
                        <div className="text-foreground">
                          <span className="font-medium">Total:</span> {booking.amount}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => handleDownloadTicket(booking)}>
                        <Download className="h-4 w-4 mr-2" /> Download Ticket
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEditBooking(booking)}>
                        <Pencil className="h-4 w-4 mr-2" /> Modify
                      </Button>
                      <Button size="sm" onClick={() => handleViewBooking(booking)}>
                        <Eye className="h-4 w-4 mr-2" /> View Details
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )))}
        </div>

        <BookingDetailsDialog
          booking={selectedBooking}
          open={isViewOpen}
          onOpenChange={setIsViewOpen}
        />

        <EditBookingDialog
          booking={selectedBooking}
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          onSave={handleSaveBooking}
        />
      </div>

      {ticket && (
        <Suspense fallback={null}>
          <PrintItinerary
            booking={ticket.booking}
            items={ticket.items}
            payments={ticket.payments}
            qrCodeData={ticket.qrCodeData}
            onClose={() => setTicket(null)}
          />
        </Suspense>
      )}
    </DashboardLayout>
  );
}
