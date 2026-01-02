
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { fetchTours } from "@/lib/api";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  service: z.string().min(1, "Please select a service"),
  date: z.date({ required_error: "Date is required" }),
  guests: z.string().min(1, "Number of guests is required"),
  notes: z.string().optional(),
});

export function BookingModal({ trigger, preselectedService }: { trigger: React.ReactNode; preselectedService?: string }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      service: preselectedService || "",
      guests: "2",
      notes: "",
    },
  });

  const { data: allTours = [] } = useQuery({
    queryKey: ["tours"], 
    queryFn: fetchTours,
  });

  // Deduplicate tours by normalized title
  const uniqueTours = allTours.reduce<typeof allTours>((acc, current) => {
    // Skip test data
    if (current.title.toLowerCase().includes("verification")) return acc;
    
    const normalize = (t: string) => t.replace(/\s+Package$/i, "").trim();
    const normalizedTitle = normalize(current.title);
    
    const existingIndex = acc.findIndex(item => normalize(item.title) === normalizedTitle);
    
    if (existingIndex === -1) {
      acc.push(current);
    }
    return acc;
  }, []);

  const tours = uniqueTours.filter(t => t.category === "tour");
  const transfers = uniqueTours.filter(t => t.category === "transfer");
  const vehicles = uniqueTours.filter(t => t.category === "vehicle");

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const selectedTour = [...tours, ...transfers, ...vehicles].find(t => t.title === values.service);
      
      // Step 1: Create a hold to reserve capacity
      let holdId = null;
      if (selectedTour) {
        try {
          const holdRes = await fetch("/api/holds", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tourId: selectedTour.id,
              date: format(values.date, "yyyy-MM-dd"),
              quantity: parseInt(values.guests)
            }),
          });
          if (holdRes.ok) {
            const hold = await holdRes.json();
            holdId = hold.id;
          }
        } catch (holdError) {
          console.warn("Failed to create hold, proceeding without one:", holdError);
        }
      }

      // Step 2: Create the booking
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tourId: selectedTour?.id || "",
          tourName: values.service,
          customerName: values.name,
          customerEmail: values.email,
          date: format(values.date, "yyyy-MM-dd"),
          guests: parseInt(values.guests),
          amount: selectedTour ? selectedTour.price : "0",
          status: "pending",
          holdId: holdId
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create booking");
      }

      const booking = await res.json();
      setIsLoading(false);
      setOpen(false);
      form.reset();
      
      toast({
        title: t("common.success"),
        description: t("reservations.bookingCreated", "Booking created successfully!"),
      });

      setLocation("/payment");
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || "Failed to create booking",
        variant: "destructive",
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-center mb-2">{t("booking.title", "Plan Your Adventure")}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("booking.fullName", "Full Name")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("booking.namePlaceholder", "John Doe")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("booking.email", "Email")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("booking.emailPlaceholder", "john@example.com")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="service"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("booking.service", "Service")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("booking.selectService", "Select tour/transfer")} />
                        </SelectTrigger>
                      </FormControl>
                        <SelectContent>
                        <SelectItem value="select" disabled>{t("booking.selectOption", "Select an option")}</SelectItem>
                        {tours.map((tour: any) => (
                          <SelectItem key={tour.id} value={tour.title}>{tour.title}</SelectItem>
                        ))}
                        {transfers.map((transfer: any) => (
                          <SelectItem key={transfer.id} value={transfer.title}>{transfer.title}</SelectItem>
                        ))}
                        {vehicles.map((vehicle: any) => (
                          <SelectItem key={vehicle.id} value={vehicle.title}>{vehicle.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="guests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("booking.guests", "Guests")}</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t("booking.preferredDate", "Preferred Date")}</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>{t("booking.pickDate", "Pick a date")}</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full text-lg py-6" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t("booking.submit", "Submit Request")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
