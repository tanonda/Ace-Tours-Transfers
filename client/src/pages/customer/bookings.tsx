import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Download, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const myBookings = [
  { 
    id: "BK-7821", 
    tour: "Efate Scenic Tour", 
    date: "June 15, 2024", 
    guests: 2, 
    total: "$240", 
    status: "confirmed",
    image: "https://images.unsplash.com/photo-1589308078059-be1415eab4c3?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
  },
  { 
    id: "BK-6502", 
    tour: "Airport Transfer", 
    date: "March 10, 2024", 
    guests: 2, 
    total: "$30", 
    status: "completed",
    image: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
  },
  { 
    id: "BK-5901", 
    tour: "Roots & Routes", 
    date: "January 22, 2024", 
    guests: 4, 
    total: "$400", 
    status: "completed",
    image: "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
  },
];

export default function CustomerBookings() {
  const { toast } = useToast();
  return (
    <DashboardLayout type="customer">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#004165]">My Bookings</h1>
          <p className="text-muted-foreground">Manage your upcoming trips and view history.</p>
        </div>

        <div className="space-y-4">
          {myBookings.map((booking) => (
            <Card key={booking.id} className="overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                <div className="w-full sm:w-48 h-48 sm:h-auto relative">
                  <img 
                    src={booking.image} 
                    alt={booking.tour} 
                    className="w-full h-full object-cover absolute inset-0" 
                  />
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-xl text-[#004165]">{booking.tour}</h3>
                        <p className="text-sm text-muted-foreground">Ref: {booking.id}</p>
                      </div>
                      <Badge variant={booking.status === "confirmed" ? "default" : "secondary"} className={booking.status === "confirmed" ? "bg-green-500 hover:bg-green-600" : ""}>
                        {booking.status.toUpperCase()}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="h-4 w-4" />
                        {booking.date}
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <MapPin className="h-4 w-4" />
                        Hotel Pickup
                      </div>
                      <div>
                        <span className="font-medium">Guests:</span> {booking.guests}
                      </div>
                      <div>
                        <span className="font-medium">Total:</span> {booking.total}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                    <Button variant="outline" size="sm" onClick={() => toast({ title: "Download Ticket", description: `Downloading ticket for ${booking.tour}` })}>
                      <Download className="h-4 w-4 mr-2" /> Download Ticket
                    </Button>
                    <Button size="sm" className="bg-[#004165]" onClick={() => toast({ title: "View Details", description: `Viewing details for ${booking.id}` })}>
                      <Eye className="h-4 w-4 mr-2" /> View Details
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
