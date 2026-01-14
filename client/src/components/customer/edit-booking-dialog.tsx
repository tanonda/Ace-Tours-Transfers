import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VerificationDialog } from "@/components/ui/verification-dialog";
import { useState, useEffect } from "react";

interface Booking {
  id: string;
  customer: string;
  tour: string;
  date: string;
  guests: number;
  amount: string;
  status: string;
}

interface EditBookingDialogProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (booking: Booking) => void;
}

export function EditBookingDialog({ booking, open, onOpenChange, onSave }: EditBookingDialogProps) {
  const [formData, setFormData] = useState<Booking | null>(null);
  const [showVerification, setShowVerification] = useState(false);

  useEffect(() => {
    if (booking) {
      setFormData({ ...booking });
    }
  }, [booking]);

  if (!booking || !formData) return null;

  const handleSave = () => {
    setShowVerification(true);
  };

  const handleVerified = () => {
    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif font-bold text-[#004165]">Modify Booking</DialogTitle>
          <DialogDescription>
            Request changes for booking <span className="font-medium text-foreground">{booking.id}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* Read-only fields for customer context */}
          <div className="space-y-2">
            <Label htmlFor="customer">Customer Name</Label>
            <Input 
              id="customer" 
              value={formData.customer} 
              disabled
              className="bg-slate-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input 
                id="date" 
                type="date"
                value={formData.date} 
                onChange={(e) => setFormData({...formData, date: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guests">Guests</Label>
              <Input 
                id="guests" 
                type="number" 
                min="1"
                value={formData.guests} 
                onChange={(e) => setFormData({...formData, guests: parseInt(e.target.value) || 0})}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="tour">Tour / Service</Label>
            <Select 
              value={formData.tour} 
              onValueChange={(value) => setFormData({...formData, tour: value})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select tour" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Efate Scenic Tour">Efate Scenic Tour</SelectItem>
                <SelectItem value="Airport Transfer">Airport Transfer</SelectItem>
                <SelectItem value="Roots & Routes">Roots & Routes</SelectItem>
                <SelectItem value="Bus Hire">Bus Hire</SelectItem>
                <SelectItem value="Event Transfer">Event Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (Estimated)</Label>
              <Input 
                id="amount" 
                value={formData.amount} 
                disabled
                className="bg-slate-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <div className="flex h-10 w-full items-center rounded-md border border-input bg-slate-50 px-3 py-2 text-sm ring-offset-background text-muted-foreground">
                 {formData.status.charAt(0).toUpperCase() + formData.status.slice(1)}
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 p-3 rounded-md text-xs text-yellow-800 border border-yellow-100">
            Note: Changing dates or guests may affect the total price. Our team will review your request and confirm via email.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-[#004165]" onClick={handleSave}>Request Changes</Button>
        </DialogFooter>
      </DialogContent>

      <VerificationDialog
        bookingId={booking.id}
        open={showVerification}
        onOpenChange={setShowVerification}
        onVerified={handleVerified}
      />
    </Dialog>
  );
}
