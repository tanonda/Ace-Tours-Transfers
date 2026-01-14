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
import { useState, useEffect } from "react";
import type { Booking, InsertBooking, Tour } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { createBooking, fetchTours } from "@/lib/api"; // Import fetchTours
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

interface CreateBookingFormData extends Partial<InsertBooking> {
  customerEmail: string; // Add customerEmail to form data
  tourName: string; // Add tourName for easy handling in form
}

interface CreateBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void; // Callback for successful creation
}

// Helper function to calculate amount
const calculateAmount = (basePriceString: string, guests: number): string => {
  const basePrice = parseFloat(basePriceString);
  if (isNaN(basePrice) || guests < 0) {
    return "0.00";
  }
  const totalAmount = basePrice * guests;
  return totalAmount.toFixed(2);
};

export function CreateBookingDialog({ open, onOpenChange, onSuccess }: CreateBookingDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allPackages, isLoading: isLoadingPackages } = useQuery<Tour[]>({
    queryKey: ["allPackages"],
    queryFn: fetchTours,
  });

  const toursData = allPackages?.filter(p => p.category === "tour") || [];
  const transfersData = allPackages?.filter(p => p.category === "transfer") || [];


    const [formData, setFormData] = useState<CreateBookingFormData>({

      customerName: "",

      tourId: "",

      date: format(new Date(), "yyyy-MM-dd"),

      guests: 1,

      amount: "0.00",

      status: "pending",

      customerEmail: "",

      tourName: "", // Now part of formData

    });

    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

    // Removed selectedTourName as it's now part of formData

  

    // Reset form data when dialog opens

    useEffect(() => {

      if (open) {

        setFormData({

          customerName: "",

          tourId: "",

          date: format(new Date(), "yyyy-MM-dd"),

          guests: 1,

          amount: "0.00",

          status: "pending",

          customerEmail: "",

          tourName: "",

        });

        setSelectedDate(new Date());

      }

    }, [open]);

  const createBookingMutation = useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({ title: "Booking Created", description: "New booking has been created successfully." });
      onOpenChange(false); // Close dialog
      onSuccess(); // Trigger any parent component success actions
    },
    onError: (error) => {
      console.error("Failed to create booking:", error);
      toast({ title: "Error", description: "Failed to create booking.", variant: "destructive" });
    },
  });

  const handleSave = () => {
    const selectedTour = allPackages?.find(
      (item) => item.title === formData.tourName
    );

    if (!selectedTour) {
      toast({ title: "Error", description: "Please select a valid tour or service.", variant: "destructive" });
      return;
    }

    const payloadForBackend = {
      userId: formData.userId, // Can be undefined/null if user is not logged in or admin creating for guest
      tourId: selectedTour.id,
      date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      guests: formData.guests || 1,
      amount: formData.amount || "0.00",
      status: formData.status as Booking["status"] || "pending",
      // These are extracted from req.body by the backend, and also part of InsertBooking
      name: formData.customerName, // Maps to `name` in req.body on server
      email: formData.customerEmail, // Maps to `email` in req.body on server
      customerName: formData.customerName, // This is explicitly part of InsertBooking
      tourName: formData.tourName, // This is explicitly part of InsertBooking
    };

    createBookingMutation.mutate(payloadForBackend as InsertBooking);
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setFormData((prev) => ({ ...prev, date: date ? format(date, "yyyy-MM-dd") : "" }));
  };

  const handleTourNameChange = (value: string) => {
    const selectedPackage = allPackages?.find(
      (item) => item.title === value
    );

    setFormData(prev => {
      const guestsCount = selectedPackage?.minPax ? parseInt(selectedPackage.minPax) : 1;
      const basePrice = selectedPackage?.price || "0.00";
      return {
          ...prev,
          tourName: value,
          tourId: selectedPackage?.id || "",
          amount: calculateAmount(basePrice, guestsCount), // Calculate initial amount
          guests: guestsCount, // Populate guests from minPax
        };
    });
  };

  const handleGuestsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newGuests = parseInt(e.target.value) || 0;
    
    // Find the currently selected package to get its base price
    const selectedPackage = allPackages?.find(
      (item) => item.title === formData.tourName
    );
    const basePrice = selectedPackage?.price || "0.00";

    setFormData(prev => ({
      ...prev,
      guests: newGuests,
      amount: calculateAmount(basePrice, newGuests), // Recalculate amount based on new guests
    }));
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif font-bold text-[#004165]">Create New Booking</DialogTitle>
          <DialogDescription>
            Enter details for the new booking.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Customer Name</Label>
              <Input 
                id="customerName" 
                value={formData.customerName} 
                onChange={(e) => setFormData({...formData, customerName: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerEmail">Customer Email</Label>
              <Input 
                id="customerEmail" 
                type="email"
                value={formData.customerEmail} 
                onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="tourName">Tour / Service</Label>
            <Select 
              value={formData.tourName}
              onValueChange={handleTourNameChange}
              disabled={isLoadingPackages}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingPackages ? "Loading packages..." : "Select tour"} />
              </SelectTrigger>
              <SelectContent>
                {isLoadingPackages ? (
                  <SelectItem value="loading" disabled>Loading packages...</SelectItem>
                ) : (
                  <>
                    {toursData.map((tour) => (
                      <SelectItem key={tour.id} value={tour.title}>{tour.title}</SelectItem>
                    ))}
                    {transfersData.map((transfer) => (
                      <SelectItem key={transfer.id} value={transfer.title}>{transfer.title}</SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="guests">Guests</Label>
              <Input 
                id="guests" 
                type="number" 
                min="1"
                value={formData.guests} 
                onChange={handleGuestsChange}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input 
                id="amount" 
                type="number" // Changed to number for amount
                step="0.01" // Allow decimal for currency
                value={formData.amount} 
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData({...formData, status: value as Booking["status"]})}
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            className="bg-[#004165]" 
            onClick={handleSave} 
            disabled={createBookingMutation.isPending}
          >
            {createBookingMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
