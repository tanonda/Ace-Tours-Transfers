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
import type { Booking, InsertBooking, Product } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { createBooking, fetchProducts } from "@/lib/api"; // Import fetchProducts
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

interface CreateBookingFormData extends Partial<InsertBooking> {
  customerEmail: string;
  tourName: string;
  adultPax: number;
  childPax: number;
  infantPax: number;
  petPax: number;
  pickupTime: string;
}

interface CreateBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void; // Callback for successful creation
}

const calculateAmount = (basePriceString: string, adultPax: number, childPax: number): string => {
  const basePrice = parseFloat(basePriceString);
  if (isNaN(basePrice) || adultPax < 0 || childPax < 0) {
    return "0.00";
  }
  const totalAmount = basePrice * adultPax; // Default simple calc. (real pricing might differ by child)
  return totalAmount.toFixed(2);
};

export function CreateBookingDialog({ open, onOpenChange, onSuccess }: CreateBookingDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allPackages, isLoading: isLoadingPackages } = useQuery<Product[]>({
    queryKey: ["allPackages"],
    queryFn: fetchProducts,
  });

  const toursData = allPackages?.filter((p: Product) => p.category === "tour") || [];
  const transfersData = allPackages?.filter((p: Product) => p.category === "transfer") || [];

  const [formData, setFormData] = useState<CreateBookingFormData>({
    customerName: "",
    tourId: "",
    date: format(new Date(), "yyyy-MM-dd"),
    adultPax: 1,
    childPax: 0,
    infantPax: 0,
    petPax: 0,
    pickupTime: "",
    amount: "0.00",
    status: "pending",
    customerEmail: "",
    tourName: "",
  });

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (open) {
      setFormData({
        customerName: "",
        tourId: "",
        date: format(new Date(), "yyyy-MM-dd"),
        adultPax: 1,
        childPax: 0,
        infantPax: 0,
        petPax: 0,
        pickupTime: "",
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
      (item: Product) => item.title === formData.tourName
    );

    if (!selectedTour) {
      toast({ title: "Error", description: "Please select a valid tour or service.", variant: "destructive" });
      return;
    }

    const payloadForBackend = {
      customerName: formData.customerName,
      customerEmail: formData.customerEmail,
      pickupLocation: "",
      status: formData.status,
      items: [{
        productId: selectedTour.id,
        quantity: formData.adultPax + formData.childPax || 1,
        price: parseFloat(formData.amount || "0") * 100 || 0,
        adultPax: formData.adultPax,
        childPax: formData.childPax,
        infantPax: formData.infantPax,
        petPax: formData.petPax,
        startTime: formData.pickupTime || undefined,
        type: selectedTour.category === "vehicle" ? "vehicle" : selectedTour.category === "transfer" ? "transfer" : "tour",
        date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      }]
    };

    createBookingMutation.mutate(payloadForBackend as any);
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setFormData((prev) => ({ ...prev, date: date ? format(date, "yyyy-MM-dd") : "" }));
  };

  const handleTourNameChange = (value: string) => {
    const selectedPackage = allPackages?.find(
      (item: Product) => item.title === value
    );

    setFormData(prev => {
      const adultCount = selectedPackage?.minPax ? parseInt(selectedPackage.minPax) : 1;
      const basePrice = selectedPackage?.price || "0.00";
      return {
        ...prev,
        tourName: value,
        tourId: selectedPackage?.id || "",
        amount: calculateAmount(basePrice, adultCount, prev.childPax),
        adultPax: adultCount,
      };
    });
  };

  const handlePaxChange = (field: 'adultPax' | 'childPax' | 'infantPax' | 'petPax', value: number) => {
    const selectedPackage = allPackages?.find((item: Product) => item.title === formData.tourName);
    const basePrice = selectedPackage?.price || "0.00";

    setFormData(prev => {
      const next = { ...prev, [field]: value };
      return {
        ...next,
        amount: calculateAmount(basePrice, next.adultPax, next.childPax),
      };
    });
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
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerEmail">Customer Email</Label>
              <Input
                id="customerEmail"
                type="email"
                value={formData.customerEmail}
                onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
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
                    {toursData.map((tour: Product) => (
                      <SelectItem key={tour.id} value={tour.title}>{tour.title}</SelectItem>
                    ))}
                    {transfersData.map((transfer: Product) => (
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
              <Label htmlFor="pickupTime">Time</Label>
              <Input
                id="pickupTime"
                type="time"
                value={formData.pickupTime}
                onChange={(e) => setFormData(p => ({ ...p, pickupTime: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="adultPax">Adults</Label>
              <Input
                id="adultPax"
                type="number" min="1"
                value={formData.adultPax}
                onChange={(e) => handlePaxChange('adultPax', parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="childPax">Children</Label>
              <Input
                id="childPax"
                type="number" min="0"
                value={formData.childPax}
                onChange={(e) => handlePaxChange('childPax', parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="infantPax">Infants</Label>
              <Input
                id="infantPax"
                type="number" min="0"
                value={formData.infantPax}
                onChange={(e) => handlePaxChange('infantPax', parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="petPax">Pets</Label>
              <Input
                id="petPax"
                type="number" min="0"
                value={formData.petPax}
                onChange={(e) => handlePaxChange('petPax', parseInt(e.target.value) || 0)}
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
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as Booking["status"] })}
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
