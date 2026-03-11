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
import { format, parseISO } from "date-fns";

// Fix #2, #3, #4, #6: Expanded Booking interface — no more hardcoded placeholders.
// All previously static fields (email, phone, startTime, pickupLocation, createdAt,
// confirmedAt) are now proper typed fields populated from real API data.
interface Booking {
  id: string;
  customer: string;
  email?: string;          // Fix #2: was hardcoded "customer@example.com"
  phone?: string;          // Fix #2: was hardcoded "+678 123 4567"
  tour: string;
  date: string;
  startTime?: string;      // Fix #3: was hardcoded "08:00 AM"
  endTime?: string;
  pickupLocation?: string; // Fix #4: was hardcoded "Grand Hotel"
  guests: number;
  amount: string;
  status: string;
  createdAt?: string;      // Fix #6: was hardcoded "Today, 10:23 AM"
  confirmedAt?: string;    // Fix #6: was hardcoded "Today, 10:25 AM"
}

interface BookingDetailsDialogProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatTimestamp(isoString?: string): string {
  if (!isoString) return "—";
  try {
    return format(parseISO(isoString), "MMM d, yyyy 'at' h:mm a");
  } catch {
    return isoString;
  }
}

function formatTime(timeString?: string): string {
  if (!timeString) return "—";
  // Handle both "HH:mm" 24-hour strings and already-formatted strings
  const match = timeString.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const hours = parseInt(match[1]);
    const minutes = match[2];
    const period = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes} ${period}`;
  }
  return timeString;
}

export function BookingDetailsDialog({ booking, open, onOpenChange }: BookingDetailsDialogProps) {
  if (!booking) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-green-100 text-green-800 hover:bg-green-100";
      case "pending": return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "completed": return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case "cancelled": return "bg-red-100 text-red-800 hover:bg-red-100";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const timeDisplay = booking.startTime
    ? booking.endTime
      ? `${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`
      : formatTime(booking.startTime)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] overflow-hidden p-0">
        <div className="h-1.5 bg-gradient-to-r from-[#f4a830] via-[#e6c97a] to-[#f4a830]" />
        <div className="px-6 pt-5 pb-0">
          <DialogHeader>
            <div className="flex items-center justify-between mr-6">
              <div className="flex items-center gap-3">
                <img src="/assets/logo.png" alt="Ace Tours & Transfers" className="h-8 w-8 rounded-full border border-[#f4a830]/30" />
                <DialogTitle className="text-xl font-serif font-bold text-[#004165]">Booking Details</DialogTitle>
              </div>
              <Badge className={getStatusColor(booking.status)} variant="outline">
                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
              </Badge>
            </div>
            <DialogDescription>
              Booking Reference: <span className="font-mono font-medium text-foreground">{booking.id}</span>
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid gap-6 py-4 px-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              {/* Fix #2: Show real email and phone from booking data */}
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Customer</p>
                  <p className="font-medium">{booking.customer}</p>
                  {booking.email && (
                    <p className="text-sm text-muted-foreground">{booking.email}</p>
                  )}
                  {booking.phone && (
                    <p className="text-sm text-muted-foreground">{booking.phone}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Guests</p>
                  <p className="font-medium">{booking.guests} {booking.guests === 1 ? "Person" : "People"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Fix #4: Show real pickup location from booking, or omit if not set */}
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tour / Service</p>
                  <p className="font-medium">{booking.tour}</p>
                  {booking.pickupLocation && (
                    <p className="text-sm text-muted-foreground">Pickup: {booking.pickupLocation}</p>
                  )}
                </div>
              </div>

              {/* Fix #3: Show real time from booking, or omit the time line if not set */}
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date & Time</p>
                  <p className="font-medium">{booking.date}</p>
                  {timeDisplay && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeDisplay}
                    </p>
                  )}
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

          {/* Fix #6: Real timestamps from booking data, not hardcoded strings */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Booking History</p>
            <div className="text-sm text-muted-foreground border-l-2 border-slate-200 pl-4 space-y-3">
              <div className="relative">
                <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-slate-300" />
                <p>
                  <span className="font-medium text-foreground">Booking Created</span>
                  {" — "}
                  {booking.createdAt ? formatTimestamp(booking.createdAt) : "Date unavailable"}
                </p>
              </div>
              {(booking.status === "confirmed" || booking.status === "completed") && (
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-green-500" />
                  <p>
                    <span className="font-medium text-foreground">Payment Confirmed</span>
                    {" — "}
                    {booking.confirmedAt ? formatTimestamp(booking.confirmedAt) : "Date unavailable"}
                  </p>
                </div>
              )}
              {booking.status === "cancelled" && (
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-red-400" />
                  <p>
                    <span className="font-medium text-foreground">Booking Cancelled</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
