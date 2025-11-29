import { useQuery } from "@tanstack/react-query";
import { fetchUserBookings } from "@/lib/api";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Wallet, Heart, HelpCircle, Ticket, Download, X, Printer } from "lucide-react";

const fmtVT = (n?: number) => (n == null ? '-' : n.toLocaleString('en-US') + ' VT');

function TicketModal({ booking, onClose }: { booking: any; onClose: () => void }) {
  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">E-Ticket</DialogTitle>
        </DialogHeader>
        <div className="bg-white text-gray-800 p-5 rounded-lg border">
          <div className="text-center mb-4">
            <div className="text-xl font-bold text-primary">Ace Tours & Transfers</div>
            <div className="text-xs text-muted-foreground">Vanuatu</div>
          </div>
          <hr className="border-dashed border-gray-300 my-4" />
          <div className="space-y-2 text-sm">
            <div><strong>Booking ID:</strong> {booking.id?.slice(0, 8)}</div>
            <div><strong>Tour:</strong> {booking.tourName}</div>
            <div><strong>Customer:</strong> {booking.customerName}</div>
            <div><strong>Date:</strong> {booking.date}</div>
            <div><strong>Guests:</strong> {booking.guests}</div>
            <div><strong>Amount:</strong> {booking.amount}</div>
          </div>
          <hr className="border-dashed border-gray-300 my-4" />
          <div className="text-center text-xs text-muted-foreground">
            Present this ticket at check-in
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <Button data-testid="button-print-ticket" onClick={() => window.print()} className="flex-1">
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
          <Button data-testid="button-close-ticket" variant="outline" onClick={onClose} className="flex-1">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BookingsTable({ rows, onViewTicket }: { rows: any[]; onViewTicket: (booking: any) => void }) {
  const getStatusBadge = (status: string) => {
    if (status === 'Paid' || status === 'confirmed') {
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30">{status}</Badge>;
    }
    if (status === 'Pending' || status === 'pending') {
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30">{status}</Badge>;
    }
    return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30">{status}</Badge>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground border-b">
          <tr>
            <th className="p-3 font-medium">ID</th>
            <th className="p-3 font-medium">Tour</th>
            <th className="p-3 font-medium">Date</th>
            <th className="p-3 font-medium">Amount</th>
            <th className="p-3 font-medium">Status</th>
            <th className="p-3 font-medium">Action</th>
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
                <Button 
                  data-testid={`button-view-ticket-${r.id || i}`}
                  onClick={() => onViewTicket(r)}
                  size="sm"
                  className="text-xs"
                >
                  <Ticket className="h-3 w-3 mr-1" /> View Ticket
                </Button>
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

  const { data: bookings = [] } = useQuery({
    queryKey: ["user-bookings", user?.id],
    queryFn: () => user?.id ? fetchUserBookings(user.id) : Promise.resolve([]),
    enabled: !!user?.id,
  });

  const upcomingTrips = bookings.filter(b => b.status === 'confirmed' || b.status === 'pending');
  const walletBalance = 52300;

  return (
    <DashboardLayout type="customer">
      {selectedBooking && (
        <TicketModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
      )}

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Welcome back, {user?.name || 'Guest'}!</h1>
          <p className="text-muted-foreground">Here's an overview of your travel activities.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Upcoming Trips
              </CardTitle>
              <Link href="/tours">
                <Button data-testid="button-new-booking" size="sm">Book New Trip</Button>
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
                        <div className="text-sm text-muted-foreground">{b.date} • {b.guests} guests</div>
                      </div>
                      <div className="flex gap-3 items-center">
                        <span className="font-bold text-foreground">{b.amount}</span>
                        <Button 
                          data-testid={`button-download-ticket-${b.id}`}
                          onClick={() => setSelectedBooking(b)}
                          size="sm"
                          variant="outline"
                        >
                          <Download className="h-4 w-4 mr-1" /> Ticket
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No upcoming trips. <Link href="/tours" className="text-primary hover:underline">Book something fun!</Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Wallet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary mb-1">{fmtVT(walletBalance)}</div>
              <p className="text-sm text-muted-foreground mb-4">Available balance</p>
              <div className="flex gap-2">
                <Button 
                  data-testid="button-topup"
                  onClick={() => toast({ title: "Top-up", description: "Wallet top-up feature coming soon!" })}
                  size="sm"
                  className="flex-1"
                >
                  Top-up
                </Button>
                <Button 
                  data-testid="button-withdraw"
                  onClick={() => toast({ title: "Withdraw", description: "Withdrawal feature coming soon!" })}
                  size="sm"
                  variant="outline"
                  className="flex-1"
                >
                  Withdraw
                </Button>
              </div>
              <div className="mt-4 p-3 bg-background/50 rounded-lg border border-border/50">
                <div className="text-xs text-muted-foreground mb-1">Loyalty Points</div>
                <div className="font-bold text-lg text-foreground">2,450 pts</div>
                <div className="text-xs text-muted-foreground">Bronze Member</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {bookings.length > 0 ? (
              <BookingsTable rows={bookings} onViewTicket={setSelectedBooking} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No booking history yet. <Link href="/tours" className="text-primary hover:underline">Start exploring tours!</Link>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-blue-500/10 to-green-500/10 border-blue-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Heart className="h-5 w-5 text-pink-500" />
                Saved Tours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                You have <strong className="text-primary">5 tours</strong> saved in your wishlist
              </p>
              <Button 
                data-testid="button-view-wishlist"
                onClick={() => setLocation('/dashboard/saved')}
                variant="secondary"
                size="sm"
              >
                View Wishlist
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border-orange-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-orange-500" />
                Need Help?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Have questions about your booking or need to make changes?
              </p>
              <Link href="/contact">
                <Button 
                  data-testid="button-contact-support"
                  variant="secondary"
                  size="sm"
                >
                  Contact Support
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
