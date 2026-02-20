import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, MoreHorizontal, Eye } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BookingDetailsDialog } from "@/components/admin/booking-details-dialog";
import { EditBookingDialog } from "@/components/admin/edit-booking-dialog";
import { CreateBookingDialog } from "@/components/admin/create-booking-dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchBookings, updateBooking, deleteBooking, exportBookingsCSV } from "@/lib/api";
import type { Booking } from "@shared/schema";
import { Download } from "lucide-react";

export default function AdminBookings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: fetchBookings,
  });
  
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false); // New state for create dialog

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Booking> }) =>
      updateBooking(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({ title: "Booking Updated", description: "Booking has been updated successfully." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({ title: "Booking Deleted", description: "Booking has been deleted successfully." });
    },
  });
  
  const getStatusColor = (status: string) => {
    switch(status) {
      case "confirmed": return "bg-green-100 text-green-800 hover:bg-green-100";
      case "pending": return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "completed": return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case "cancelled": return "bg-red-100 text-red-800 hover:bg-red-100";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const handleViewBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsViewOpen(true);
  };

  const handleEditBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsEditOpen(true);
  };

  const handleSaveBooking = (updatedBooking: Booking) => {
    updateMutation.mutate({ id: updatedBooking.id, updates: updatedBooking });
  };

  const handleDeleteBooking = (id: string) => {
    if (confirm("Are you sure you want to delete this booking?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleExportCSV = async () => {
    try {
      await exportBookingsCSV();
      toast({ title: "Export Complete", description: "Bookings CSV has been downloaded." });
    } catch (error) {
      toast({ title: "Export Failed", description: "Failed to export bookings.", variant: "destructive" });
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
            <Button variant="outline" onClick={handleExportCSV} data-testid="button-export-csv">
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <Button className="bg-[#004165]" onClick={() => setIsCreateOpen(true)}>Create Booking</Button>
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
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading bookings...
                    </TableCell>
                  </TableRow>
                ) : bookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No bookings found.
                    </TableCell>
                  </TableRow>
                ) : (
                  bookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">{}</TableCell>
                      <TableCell>{booking.customerName}</TableCell>
                      <TableCell>{booking.tourName}</TableCell>
                      <TableCell>{new Date(booking.date).toLocaleDateString()}</TableCell>
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
                            <DropdownMenuItem onClick={() => handleViewBooking(booking)}>View Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditBooking(booking)}>Edit Booking</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteBooking(booking.id)}>Delete Booking</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

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
        
                <CreateBookingDialog
                  open={isCreateOpen}
                  onOpenChange={setIsCreateOpen}
                  onSuccess={() => queryClient.invalidateQueries({ queryKey: ["bookings"] })}
                />
              </div>
    </DashboardLayout>
  );
}
