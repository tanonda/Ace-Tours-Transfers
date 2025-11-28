import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, MoreHorizontal, Eye } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const bookings = [
  { id: "BK-7821", customer: "James Wilson", tour: "Efate Scenic Tour", date: "2024-06-15", guests: 2, amount: "$240", status: "confirmed" },
  { id: "BK-7822", customer: "Sarah Connor", tour: "Airport Transfer", date: "2024-06-16", guests: 4, amount: "$60", status: "pending" },
  { id: "BK-7823", customer: "Michael Chen", tour: "Roots & Routes", date: "2024-06-18", guests: 1, amount: "$100", status: "confirmed" },
  { id: "BK-7824", customer: "Emma Watson", tour: "Bus Hire", date: "2024-06-20", guests: 12, amount: "$400", status: "completed" },
  { id: "BK-7825", customer: "David Miller", tour: "Efate Scenic Tour", date: "2024-06-22", guests: 3, amount: "$360", status: "cancelled" },
  { id: "BK-7826", customer: "Sophie Turner", tour: "Event Transfer", date: "2024-06-25", guests: 8, amount: "$250", status: "confirmed" },
];

export default function AdminBookings() {
  const getStatusColor = (status: string) => {
    switch(status) {
      case "confirmed": return "bg-green-100 text-green-800 hover:bg-green-100";
      case "pending": return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "completed": return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case "cancelled": return "bg-red-100 text-red-800 hover:bg-red-100";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#004165]">Bookings</h1>
            <p className="text-muted-foreground">Manage and track all tour reservations.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">Export CSV</Button>
            <Button className="bg-[#004165]">Create Booking</Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search bookings..." className="pl-8" />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                 <Select defaultValue="all">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Tour / Service</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">{booking.id}</TableCell>
                    <TableCell>{booking.customer}</TableCell>
                    <TableCell>{booking.tour}</TableCell>
                    <TableCell>{booking.date}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(booking.status)} variant="outline">
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{booking.amount}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Edit Booking</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">Cancel Booking</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
