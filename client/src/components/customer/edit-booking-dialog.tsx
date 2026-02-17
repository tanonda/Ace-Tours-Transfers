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
import { useQuery } from "@tanstack/react-query";
import { fetchTours } from "@/lib/api";
import { Loader2 } from "lucide-react";

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

  // Fix #5: Fetch the real services list from the API instead of using a
  // hardcoded list of tour names that goes stale whenever the lineup changes.
  const { data: allTours = [], isLoading: isLoadingTours } = useQuery({
    queryKey: ["tours"],
    queryFn: fetchTours,
    enabled: open, // Only fetch when dialog is open
  });

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
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guests">Guests</Label>
              <Input
                id="guests"
                type="number"
                min="1"
                value={formData.guests}
                onChange={(e) => setFormData({ ...formData, guests: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* Fix #5: Dynamic tour list from API */}
          <div className="space-y-2">
            <Label htmlFor="tour">Tour / Service</Label>
            {isLoadingTours ? (
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-slate-50 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading services…</span>
              </div>
            ) : (
              <Select
                value={formData.tour}
                onValueChange={(value) => setFormData({ ...formData, tour: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tour or transfer" />
                </SelectTrigger>
                <SelectContent>
                  {allTours.map((service) => (
                    <SelectItem key={service.id} value={service.title}>
                      {service.title}
                    </SelectItem>
                  ))}
                  {allTours.length === 0 && (
                    <SelectItem value="" disabled>No services available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
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
