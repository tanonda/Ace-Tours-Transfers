
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { z } from "zod";
import { CalendarIcon, Loader2, User, Mail, MapPin, Users, Shield, Star, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { fetchTours } from "@/lib/api";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { createBooking } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { BookingForm, bookingFormSchema } from "./booking-form";

const logo = "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765063924/ace-tours-assets/ace_tours_logo_official.jpg";

export function BookingModal({ trigger, preselectedService }: { trigger: React.ReactNode; preselectedService?: string }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null); // null: not checked, true: available, false: unavailable
  const [availabilityMessage, setAvailabilityMessage] = useState<string>("");
  const [isCheckingAvailability, setIsCheckingAvailability] = useState<boolean>(false);
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: allTours = [] } = useQuery({
    queryKey: ["tours"], 
    queryFn: fetchTours,
  });

  const getServiceIdFromTitle = (title: string) => {
    const service = allTours.find(s => s.title === title);
    return service?.id;
  };

  const initialFormValues = {
    name: user?.name || "",
    email: user?.email || "",
    service: preselectedService || "",
    adultPax: "2",
    childPax: "0",
    notes: "",
  };

  const handleAvailabilityCheck = async (serviceTitle: string, date: Date, guests: number) => {
    setIsCheckingAvailability(true);
    setIsAvailable(null); // Reset availability status
    setAvailabilityMessage("");

    const serviceId = getServiceIdFromTitle(serviceTitle);
    if (!serviceId) {
      setAvailabilityMessage("Selected service not found.");
      setIsAvailable(false);
      setIsCheckingAvailability(false);
      return;
    }

    try {
      const response = await fetch('/api/availability/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceId,
          date: format(date, "yyyy-MM-dd"),
          guests,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to check availability.");
      }

      const result = await response.json();
      setIsAvailable(result.isAvailable);
      setAvailabilityMessage(result.message);

    } catch (error) {
      console.error("Availability check failed:", error);
      setIsAvailable(false);
      setAvailabilityMessage(error instanceof Error ? error.message : "Error checking availability.");
      toast({
        title: "Availability Check Failed",
        description: error instanceof Error ? error.message : "An error occurred during availability check.",
        variant: "destructive"
      });
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  async function handleBookingSubmit(values: z.infer<typeof bookingFormSchema>) {
    // Prevent booking if not available or not checked yet
    if (isAvailable === null || isAvailable === false) {
      toast({
        title: "Booking Not Possible",
        description: availabilityMessage || "Please check availability before booking.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const selectedService = allTours.find(s => s.title === values.service);

      if (!selectedService) {
        throw new Error("Invalid service selected");
      }

      // Capacity reservation logic remains using total pax
      const totalPax = parseInt(values.adultPax) + parseInt(values.childPax);
      
      // Step 1: Create a hold to reserve capacity
      let holdId = null;
      try {
        const holdRes = await fetch("/api/holds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tourId: selectedService.id,
            date: format(values.date, "yyyy-MM-dd"),
            quantity: totalPax
          }),
        });
        if (holdRes.ok) {
          const hold = await holdRes.json();
          holdId = hold.id;
        }
      } catch (holdError) {
        console.warn("Failed to create hold, proceeding without one:", holdError);
      }

      const bookingData: any = {
        customerName: values.name,
        customerEmail: values.email,
        items: [
          {
            productId: selectedService.id,
            adultPax: parseInt(values.adultPax),
            childPax: parseInt(values.childPax),
            date: format(values.date, "yyyy-MM-dd"),
          }
        ],
        holdId: holdId
      };

      if (user) {
        bookingData.userId = user.id;
      }

      const booking = await createBooking(bookingData);

      toast({
        title: "Booking Request Sent",
        description: "We have received your booking request. We will contact you shortly to confirm."
      });

      setOpen(false);
      setLocation(`/payment?bookingId=${booking.id}`);

    } catch (error: any) {
      toast({
        title: "Booking Failed",
        description: error.message || "An error occurred",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden border-0 shadow-2xl">
        <div className="relative bg-gradient-to-br from-primary via-primary to-orange-600 px-6 pt-6 pb-8 text-white overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <Sparkles className="absolute top-4 right-4 h-5 w-5 text-white/40 animate-pulse" />

          <div className="relative flex items-center gap-4">
            <img
              src={logo}
              alt="Ace Tours"
              className="h-14 w-14 rounded-full border-2 border-white/30 shadow-lg"
            />
            <div>
              <DialogTitle className="font-serif text-2xl font-bold text-white mb-1">
                {t("booking.title", "Plan Your Adventure")}
              </DialogTitle>
              <DialogDescription className="text-white/80 text-sm">
                {t("app.tagline", "Experience Vanuatu Like Never Before")}
              </DialogDescription>
            </div>
          </div>

          <div className="relative flex items-center gap-4 mt-4 text-xs text-white/70">
            <div className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" />
              <span>{t("booking.secure", "Secure Booking")}</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5" />
              <span>{t("booking.rated", "5-Star Service")}</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 bg-gradient-to-b from-background to-muted/30">
          <BookingForm
            initialValues={initialFormValues}
            onSubmit={handleBookingSubmit}
            isLoading={isLoading}
            submitButtonText={t("booking.submit", "Submit Request")}
            showPrice={true}
            onAvailabilityCheck={handleAvailabilityCheck}
            isAvailable={isAvailable}
            availabilityMessage={availabilityMessage}
            isCheckingAvailability={isCheckingAvailability}
            services={allTours}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
