
import { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CounterInput } from "@/components/ui/counter-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, User, Mail, MapPin, Users, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { formatPrice, formatPriceDisplay, Addon } from "@/lib/product.types";
import { useCurrency } from "@/lib/currency-context";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";

export const bookingFormSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  service: z.string().min(1, "Please select a service"),
  date: z.date({ required_error: "Date is required" }),
  adultPax: z.string().min(1, "Number of adults is required"),
  childPax: z.string().min(1, "Number of children is required"),
  notes: z.string().optional(),
  addonIds: z.array(z.string()).default([]),
});

// Service type for the dropdown
export interface BookingService {
  id: string;
  title: string;
  category?: string;
}

interface BookingFormProps {
  initialValues?: Partial<z.infer<typeof bookingFormSchema>>;
  onSubmit: (values: z.infer<typeof bookingFormSchema>) => Promise<void>;
  isLoading: boolean;
  submitButtonText?: string;
  showPrice?: boolean;
  adultPriceCents?: number;  // Price per adult in cents
  childPriceCents?: number;  // Price per child in cents
  onAvailabilityCheck?: (serviceTitle: string, date: Date, adultPax: number, childPax: number) => void;
  isAvailable?: boolean | null; // null for not yet checked, true/false for result
  availabilityMessage?: string;
  isCheckingAvailability?: boolean;
  services?: BookingService[]; // API-driven services list
}

export function BookingForm({
  initialValues,
  onSubmit,
  isLoading,
  submitButtonText = "Submit Request",
  showPrice = false,
  adultPriceCents = 0,
  childPriceCents = 0,
  onAvailabilityCheck,
  isAvailable = null,
  availabilityMessage,
  isCheckingAvailability = false,
  services = [],
}: BookingFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currency } = useCurrency();

  const { data: availableAddons = [] } = useQuery<Addon[]>({
    queryKey: ["/api/addons"],
  });

  const form = useForm<z.infer<typeof bookingFormSchema>>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      name: user?.name || initialValues?.name || "",
      email: user?.email || initialValues?.email || "",
      service: initialValues?.service || "",
      adultPax: initialValues?.adultPax || "2",
      childPax: initialValues?.childPax || "0",
      notes: initialValues?.notes || "",
      addonIds: initialValues?.addonIds || [],
    },
  });

  // Track if initial values have been applied to prevent resetting on re-renders
  const hasAppliedInitialValues = useRef(false);

  // Update form defaults when user loads - only apply initialValues once on mount
  useEffect(() => {
    if (user && !form.getValues("name")) {
      form.setValue("name", user.name);
      form.setValue("email", user.email);
    }
    // Only apply initialValues once to prevent resetting user-entered values
    if (initialValues && !hasAppliedInitialValues.current) {
      hasAppliedInitialValues.current = true;
      Object.entries(initialValues).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
          form.setValue(key as keyof z.infer<typeof bookingFormSchema>, value as any);
        }
      });
    }
  }, [user, initialValues, form]);


  const watchedService = form.watch("service");
  const watchedAdultPax = form.watch("adultPax");
  const watchedChildPax = form.watch("childPax");
  const watchedDate = form.watch("date"); // Watch date field
  const watchedAddonIds = form.watch("addonIds");

  // Calculate estimated total from props and form values
  const estimatedTotal = useMemo(() => {
    const adults = parseInt(watchedAdultPax || "0");
    const children = parseInt(watchedChildPax || "0");

    // 1. Base price
    let totalCents = (adults * adultPriceCents) + (children * childPriceCents);

    // 2. Applying Rules: Group Discount (10% off for 7+ adults)
    if (adults >= 7) {
      totalCents = Math.round(totalCents * 0.9);
    }

    // 3. Applying Rules: Seasonal Pricing (20% surcharge in Dec/Jan)
    if (watchedDate) {
      const month = watchedDate.getMonth();
      if (month === 11 || month === 0) {
        totalCents = Math.round(totalCents * 1.2);
      }
    }

    // 4. Add-ons
    const selectedAddonsPrice = watchedAddonIds.reduce((sum, id) => {
      const addon = availableAddons.find(a => a.id === id);
      return sum + (addon?.priceCents || 0);
    }, 0);

    totalCents += selectedAddonsPrice;

    return formatPriceDisplay(totalCents, currency);
  }, [watchedAdultPax, watchedChildPax, adultPriceCents, childPriceCents, watchedDate, watchedAddonIds, availableAddons, currency]);

  useEffect(() => {
    const adultPax = parseInt(watchedAdultPax || "0");
    const childPax = parseInt(watchedChildPax || "0");
    const totalPax = adultPax + childPax;

    if (onAvailabilityCheck && watchedService && watchedDate && totalPax > 0) {
      onAvailabilityCheck(watchedService, watchedDate, adultPax, childPax);
    }
  }, [watchedService, watchedDate, watchedAdultPax, watchedChildPax, onAvailabilityCheck]);

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
                    {services.filter(s => s.category === 'tour').map((service) => (
                      <SelectItem key={service.id} value={service.title}>{service.title}</SelectItem>
                    ))}
                    {services.filter(s => s.category === 'transfer').map((service) => (
                      <SelectItem key={service.id} value={service.title}>{service.title}</SelectItem>
                    ))}
                    {services.filter(s => s.category === 'vehicle').map((service) => (
                      <SelectItem key={service.id} value={service.title}>{service.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="adultPax"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">{t("booking.adults", "Adults")}</FormLabel>
                <FormControl>
                  <CounterInput
                    value={parseInt(field.value) || 2}
                    onValueChange={(val) => field.onChange(val.toString())}
                    min={1}
                    max={50}
                    label="Adults"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="childPax"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">{t("booking.children", "Children")}</FormLabel>
                <FormControl>
                  <CounterInput
                    value={parseInt(field.value) || 0}
                    onValueChange={(val) => field.onChange(val.toString())}
                    min={0}
                    max={50}
                    label="Children"
                  />
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

        {availableAddons.length > 0 && (
          <div className="space-y-3 pt-2">
            <FormLabel className="text-sm font-medium">{t("booking.addons", "Special Add-ons")}</FormLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableAddons.map((addon) => (
                <FormField
                  key={addon.id}
                  control={form.control}
                  name="addonIds"
                  render={({ field }) => (
                    <FormItem
                      key={addon.id}
                      className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 shadow-sm bg-background/50"
                    >
                      <FormControl>
                        <Checkbox
                          checked={field.value?.includes(addon.id)}
                          onCheckedChange={(checked) => {
                            return checked
                              ? field.onChange([...field.value, addon.id])
                              : field.onChange(
                                field.value?.filter(
                                  (value) => value !== addon.id
                                )
                              )
                          }}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-medium cursor-pointer">
                          {addon.name}
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          +{formatPriceDisplay(addon.priceCents, currency)}
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </div>
        )}

        {onAvailabilityCheck && (watchedService && watchedDate && (parseInt(watchedAdultPax || "0") + parseInt(watchedChildPax || "0")) > 0) && (
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
