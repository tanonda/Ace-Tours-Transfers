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
import type { Booking } from "@shared/schema";

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
    // Only send mutable fields back to prevent 400 Bad Request
    const safeUpdates = {
      id: formData.id,
      customerName: formData.customerName,
      customerPhone: formData.customerPhone,
      pickupLocation: formData.pickupLocation,
      notes: formData.notes,
      status: formData.status,
    };
    onSave(safeUpdates as any);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif font-bold text-[#004165]">Edit Booking</DialogTitle>
          <DialogDescription>
            Update booking details for <span className="font-medium text-foreground">{booking.id}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Customer Name</Label>
              <Input
                id="customer"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerPhone">Phone Number</Label>
              <Input
                id="customerPhone"
                value={formData.customerPhone || ""}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pickupLocation">Pickup Location</Label>
              <Input
                id="pickupLocation"
                value={formData.pickupLocation || ""}
                onChange={(e) => setFormData({ ...formData, pickupLocation: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-[#004165]" onClick={handleSave}>Save Changes</Button>
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
