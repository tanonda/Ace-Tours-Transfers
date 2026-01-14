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
import { useState } from "react";
import { verifyBooking } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface VerificationDialogProps {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
}

export function VerificationDialog({ bookingId, open, onOpenChange, onVerified }: VerificationDialogProps) {
  const [type, setType] = useState<string>("");
  const [value, setValue] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleVerify = async () => {
    if (!type || !value.trim()) {
      toast({
        title: "Error",
        description: "Please select a verification type and enter a value.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await verifyBooking({ bookingId, type, value });
      toast({
        title: "Verification Successful",
        description: "Your identity has been verified.",
      });
      onVerified();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Verification Failed",
        description: "The provided information does not match our records. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setType("");
    setValue("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif font-bold text-[#004165]">Verify Identity</DialogTitle>
          <DialogDescription>
            To proceed with this sensitive operation, please verify your identity using one of the following methods.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="type">Verification Method</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email Address</SelectItem>
                <SelectItem value="phone">Phone Number</SelectItem>
                <SelectItem value="lastname">Last Name</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">
              {type === "email" ? "Email Address" : type === "phone" ? "Phone Number" : "Last Name"}
            </Label>
            <Input
              id="value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === "email" ? "Enter your email" : type === "phone" ? "Enter your phone" : "Enter your last name"}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button className="bg-[#004165]" onClick={handleVerify} disabled={loading}>
            {loading ? "Verifying..." : "Verify"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}