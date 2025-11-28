import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Clock, ArrowRight, Heart } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const upcomingTrip = {
  id: "BK-7821",
  tour: "Efate Scenic Tour",
  date: "June 15, 2024",
  time: "08:00 AM",
  guests: 2,
  image: "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
  status: "Confirmed"
};

export default function CustomerDashboard() {
  const { toast } = useToast();
  return (
    <DashboardLayout type="customer">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">Hello, James!</h1>
          <p className="text-muted-foreground">Here's an overview of your upcoming adventures.</p>
        </div>

        {/* Upcoming Trip Hero Card */}
        <Card className="overflow-hidden border-none shadow-lg bg-[hsl(var(--foreground))] text-white">
          <div className="flex flex-col md:flex-row">
            <div className="w-full md:w-1/3 h-48 md:h-auto relative">
               <img 
                 src={upcomingTrip.image} 
                 alt={upcomingTrip.tour} 
                 className="w-full h-full object-cover absolute inset-0" 
               />
            </div>
            <div className="p-6 md:p-8 flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-[hsl(var(--primary))] mb-2 text-sm font-medium uppercase tracking-wide">
                <Calendar className="h-4 w-4" /> Upcoming Trip
              </div>
              <h2 className="text-2xl md:text-3xl font-serif font-bold mb-4">{upcomingTrip.tour}</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[hsl(var(--primary))]" />
                  <span>{upcomingTrip.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[hsl(var(--primary))]" />
                  <span>{upcomingTrip.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[hsl(var(--primary))]" />
                  <span>Hotel Pickup</span>
                </div>
              </div>
              
              <div className="flex gap-3 mt-auto">
                <Button className="bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))/90] font-semibold" onClick={() => toast({ title: "Downloading Ticket", description: "Your ticket for Efate Scenic Tour is downloading." })}>
                  View Ticket
                </Button>
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 hover:text-white" onClick={() => toast({ title: "Manage Booking", description: "Redirecting to booking management..." })}>
                  Manage Booking
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-[hsl(var(--background))] border-[hsl(var(--border))]">
            <CardHeader>
              <CardTitle className="text-[hsl(var(--foreground))]">My Bookings</CardTitle>
              <CardDescription>View your history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">3</div>
              <p className="text-sm text-muted-foreground mb-4">1 Upcoming, 2 Completed</p>
              <Link href="/dashboard/bookings">
                <Button variant="outline" className="w-full justify-between group">
                  View All <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--background))] border-[hsl(var(--border))]">
            <CardHeader>
              <CardTitle className="text-[hsl(var(--foreground))]">Saved Tours</CardTitle>
              <CardDescription>Your wishlist</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">5</div>
              <p className="text-sm text-muted-foreground mb-4">Items in your wishlist</p>
              <Link href="/dashboard/saved">
                <Button variant="outline" className="w-full justify-between group">
                  View Wishlist <Heart className="h-4 w-4 group-hover:text-red-500 transition-colors" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
            <CardHeader>
              <CardTitle className="text-[hsl(var(--foreground))]">Need Help?</CardTitle>
              <CardDescription>We're here for you</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Have questions about your booking or need to make changes?
              </p>
              <Link href="/contact">
                <Button className="w-full bg-[hsl(var(--foreground))] hover:bg-[hsl(var(--foreground))/90]">
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
