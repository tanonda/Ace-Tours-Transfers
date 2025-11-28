import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, User, MapPin, CreditCard, Users, Clock } from "lucide-react";

interface Booking {
  id: string;
  customer: string;
  tour: string;
  date: string;
  guests: number;
  amount: string;
  status: string;
}

interface BookingDetailsDialogProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BookingDetailsDialog({ booking, open, onOpenChange }: BookingDetailsDialogProps) {
  if (!booking) return null;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center justify-between mr-6">
            <DialogTitle className="text-xl font-serif font-bold text-[#004165]">Booking Details</DialogTitle>
            <Badge className={getStatusColor(booking.status)} variant="outline">
              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
            </Badge>
          </div>
          <DialogDescription>
            Booking Reference: <span className="font-mono font-medium text-foreground">{booking.id}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Customer</p>
                  <p className="font-medium">{booking.customer}</p>
                  <p className="text-sm text-muted-foreground">customer@example.com</p>
                  <p className="text-sm text-muted-foreground">+678 123 4567</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Guests</p>
                  <p className="font-medium">{booking.guests} People</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tour / Service</p>
                  <p className="font-medium">{booking.tour}</p>
                  <p className="text-sm text-muted-foreground">Pickup: Grand Hotel</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date & Time</p>
                  <p className="font-medium">{booking.date}</p>
                  <p className="text-sm text-muted-foreground">08:00 AM</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#004165]" />
              <span className="font-medium text-[#004165]">Total Amount</span>
            </div>
            <span className="text-2xl font-bold text-[#004165]">{booking.amount}</span>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Booking History</p>
            <div className="text-sm text-muted-foreground border-l-2 border-slate-200 pl-4 space-y-3">
              <div className="relative">
                <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-slate-300" />
                <p><span className="font-medium text-foreground">Booking Created</span> - Today, 10:23 AM</p>
              </div>
              {booking.status === 'confirmed' && (
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-green-500" />
                  <p><span className="font-medium text-foreground">Payment Confirmed</span> - Today, 10:25 AM</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
