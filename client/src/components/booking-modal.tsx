import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useCallback } from "react";
import { z } from "zod";
import { CalendarIcon, Loader2, User, Mail, MapPin, Users, Shield, Star, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { fetchTours, fetchAddons } from "@/lib/api";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { BookingForm, bookingFormSchema } from "./booking-form";
import type { Addon } from "@shared/schema";

const logo = "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765063924/ace-tours-assets/ace_tours_logo_official.jpg";

interface BookingModalProps {
  trigger: React.ReactNode;
  preselectedService?: string;
  initialAdultPax?: string;
  initialChildPax?: string;
  initialDate?: Date;
}

export function BookingModal({
  trigger,
  preselectedService,
  initialAdultPax,
  initialChildPax,
  initialDate
}: BookingModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-6xl p-0 overflow-hidden border-0 shadow-2xl flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
        {open && (
          <BookingModalContent
            preselectedService={preselectedService}
            initialAdultPax={initialAdultPax}
            initialChildPax={initialChildPax}
            initialDate={initialDate}
            setOpen={setOpen}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BookingModalContent({
  preselectedService,
  initialAdultPax,
  initialChildPax,
  initialDate,
  setOpen
}: BookingModalProps & { setOpen: (open: boolean) => void }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null); // null: not checked, true: available, false: unavailable
  const [availabilityMessage, setAvailabilityMessage] = useState<string>("");
  const [isCheckingAvailability, setIsCheckingAvailability] = useState<boolean>(false);
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { addToCart } = useCart();

  const { data: rawTours = [] } = useQuery({
    queryKey: ["tours"],
    queryFn: fetchTours,
  });

  // Filter out test data
  const allTours = useMemo(() => {
    return rawTours.filter(current => {
      const titleLower = current.title.toLowerCase();
      return !(titleLower.includes("verification") ||
        titleLower.includes("concurrent") ||
        titleLower.includes("test_tour") ||
        titleLower.includes("phase4"));
    });
  }, [rawTours]);

  const { data: availableAddons = [] } = useQuery<Addon[]>({
    queryKey: ["/api/addons"],
    queryFn: fetchAddons,
  });

  // Track selected service for dynamic pricing
  const [selectedServiceTitle, setSelectedServiceTitle] = useState<string>(preselectedService || "");

  // Get pricing from selected service
  const selectedService = allTours.find(s => s.title === selectedServiceTitle);
  const adultPriceCents = selectedService?.adultPriceCents ?? 0;
  const childPriceCents = selectedService?.childPriceCents ?? 0;

  const initialFormValues = useMemo(() => ({
    name: user?.name || "",
    email: user?.email || "",
    service: preselectedService || "",
    adultPax: initialAdultPax || "2",
    childPax: initialChildPax || "0",
    date: initialDate,
    notes: "",
  }), [user?.name, user?.email, preselectedService, initialAdultPax, initialChildPax, initialDate]);

  const handleAvailabilityCheck = useCallback(async (serviceTitle: string, date: Date, adultPax: number, childPax: number, startTime?: string, endTime?: string) => {
    // Update selected service for pricing
    setSelectedServiceTitle(serviceTitle);
    setIsCheckingAvailability(true);
    setIsAvailable(null); // Reset availability status
    setAvailabilityMessage("");

    const serviceId = allTours.find(s => s.title === serviceTitle)?.id;
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
          adultPax,
          childPax,
          startTime,
          endTime,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to check availability.");
      }

      const result = await response.json();
      setIsAvailable(result.isAvailable);

      // Enhanced message with pricing and discounts
      let message = result.message;
      if (result.pricing) {
        const formattedPrice = `VUV ${(result.pricing.subtotalCents / 100).toLocaleString()}`;
        message += ` Subtotal: ${formattedPrice}`;

        if (result.pricing.appliedDiscounts && result.pricing.appliedDiscounts.length > 0) {
          message += ` (${result.pricing.appliedDiscounts.join(', ')})`;
        }
      }
      setAvailabilityMessage(message);

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
  }, [allTours, toast]);

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

      // Add item to cart instead of creating booking directly
      // This unifies the modal booking path with the cart flow
      const addonTotal = (values.addonIds || []).reduce((sum, id) => {
        const addon = availableAddons?.find((a: any) => a.id === id);
        return sum + (addon?.priceCents || 0);
      }, 0);

      addToCart({
        id: String(selectedService.id),
        title: selectedService.title,
        price: selectedService.adultPriceCents ?? 0,
        childPrice: selectedService.childPriceCents ?? 0,
        image: selectedService.image || "",
        date: values.date,
        adultPax: parseInt(values.adultPax),
        childPax: parseInt(values.childPax),
        type: selectedService.category as "tour" | "transfer" | "vehicle",
        addonIds: values.addonIds,
        addonTotal: addonTotal,
        startTime: values.startTime,
        endTime: values.endTime,
      });

      toast({
        title: t("cart.itemAdded", "Item Added to Cart"),
        description: t("booking.redirectToPayment", "Redirecting you to complete your booking..."),
      });

      setOpen(false);

      // Navigate to payment page - booking will be created from cart items
      setLocation("/payment");

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
    <>
      <div className="relative bg-gradient-to-br from-primary via-primary to-orange-600 px-6 pt-6 pb-8 text-white overflow-hidden shrink-0">
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

      <div className="px-4 sm:px-8 xl:px-12 py-8 bg-gradient-to-b from-background to-muted/30 overflow-y-auto flex-1">
        <BookingForm
          initialValues={initialFormValues}
          onSubmit={handleBookingSubmit}
          isLoading={isLoading}
          submitButtonText={t("booking.submit", "Submit Request")}
          showPrice={true}
          adultPriceCents={adultPriceCents}
          childPriceCents={childPriceCents}
          onAvailabilityCheck={handleAvailabilityCheck}
          isAvailable={isAvailable}
          availabilityMessage={availabilityMessage}
          isCheckingAvailability={isCheckingAvailability}
          services={allTours}
        />
      </div>
    </>
  );
}
