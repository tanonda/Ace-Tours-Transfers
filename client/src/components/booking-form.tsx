
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, User, Mail, MapPin, Users, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { tours, transfers } from "@/lib/data";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";

export const bookingFormSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  service: z.string().min(1, "Please select a service"),
  date: z.date({ required_error: "Date is required" }),
  guests: z.string().min(1, "Number of guests is required"),
  notes: z.string().optional(),
});

interface BookingFormProps {
  initialValues?: Partial<z.infer<typeof bookingFormSchema>>;
  onSubmit: (values: z.infer<typeof bookingFormSchema>) => Promise<void>;
  isLoading: boolean;
  submitButtonText?: string;
  showPrice?: boolean;
  onAvailabilityCheck?: (serviceTitle: string, date: Date, guests: number) => void;
  isAvailable?: boolean | null; // null for not yet checked, true/false for result
  availabilityMessage?: string;
  isCheckingAvailability?: boolean;
}

export function BookingForm({
  initialValues,
  onSubmit,
  isLoading,
  submitButtonText = "Submit Request",
  showPrice = false,
  onAvailabilityCheck,
  isAvailable = null,
  availabilityMessage,
  isCheckingAvailability = false,
}: BookingFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const form = useForm<z.infer<typeof bookingFormSchema>>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      name: user?.name || initialValues?.name || "",
      email: user?.email || initialValues?.email || "",
      service: initialValues?.service || "",
      guests: initialValues?.guests || "2",
      notes: initialValues?.notes || "",
    },
  });

  // Update form defaults when user loads or initialValues change
  useEffect(() => {
    if (user && !form.getValues("name")) {
      form.setValue("name", user.name);
      form.setValue("email", user.email);
    }
    if (initialValues) {
        Object.entries(initialValues).forEach(([key, value]) => {
            form.setValue(key as keyof z.infer<typeof bookingFormSchema>, value as any);
        });
    }
  }, [user, initialValues, form]);


  const watchedService = form.watch("service");
  const watchedGuests = form.watch("guests");
  const watchedDate = form.watch("date"); // Watch date field
  const [estimatedTotal, setEstimatedTotal] = useState("$0.00");

  useEffect(() => {
    if (onAvailabilityCheck && watchedService && watchedDate && watchedGuests && parseInt(watchedGuests) > 0) {
      onAvailabilityCheck(watchedService, watchedDate, parseInt(watchedGuests));
    }
  }, [watchedService, watchedDate, watchedGuests, onAvailabilityCheck]);

  // Determine if the submit button should be disabled
  const isSubmitDisabled = isLoading || isCheckingAvailability || !isAvailable;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">{t("booking.fullName", "Full Name")}</FormLabel>
              <FormControl>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("booking.namePlaceholder", "John Doe")}
                    className="pl-10 h-11 border-border/50 bg-background/80 backdrop-blur-sm focus:border-primary focus:ring-primary/20"
                    {...field}
                  />
                </div>
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
              <FormLabel className="text-sm font-medium">{t("booking.email", "Email")}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("booking.emailPlaceholder", "john@example.com")}
                    className="pl-10 h-11 border-border/50 bg-background/80 backdrop-blur-sm focus:border-primary focus:ring-primary/20"
                    {...field}
                  />
                </div>
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
                <FormLabel className="text-sm font-medium">{t("booking.service", "Service")}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-11 border-border/50 bg-background/80 backdrop-blur-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder={t("booking.selectService", "Select tour/transfer")} />
                      </div>
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
                <FormLabel className="text-sm font-medium">{t("booking.guests", "Guests")}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min="1"
                      className="pl-10 h-11 border-border/50 bg-background/80 backdrop-blur-sm focus:border-primary focus:ring-primary/20"
                      {...field}
                    />
                  </div>
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
              <FormLabel className="text-sm font-medium">{t("booking.preferredDate", "Preferred Date")}</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full h-11 pl-10 text-left font-normal border-border/50 bg-background/80 backdrop-blur-sm relative",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>{t("booking.pickDate", "Pick a date")}</span>
                      )}
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

        {onAvailabilityCheck && (watchedService && watchedDate && watchedGuests && parseInt(watchedGuests) > 0) && (
            <div className="mt-4 text-sm">
                {isCheckingAvailability ? (
                    <p className="text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Checking availability...
                    </p>
                ) : (
                    availabilityMessage && (
                        <p className={cn(
                            "font-medium",
                            isAvailable ? "text-green-600" : "text-red-600"
                        )}>
                            {availabilityMessage}
                        </p>
                    )
                )}
            </div>
        )}

        {showPrice && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
            <span className="text-lg font-semibold">{t("booking.estimatedTotal", "Estimated Total")}</span>
            <span className="text-2xl font-bold text-primary">{estimatedTotal}</span>
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 shadow-lg hover:shadow-xl transition-all duration-300 mt-2"
          disabled={isSubmitDisabled}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              {submitButtonText}
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground mt-3">
          {t("booking.guarantee", "Free cancellation up to 24 hours before your tour")}
        </p>
      </form>
    </Form>
  );
}
