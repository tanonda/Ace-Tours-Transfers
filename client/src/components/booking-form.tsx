"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CounterInput } from "@/components/ui/counter-input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, User, Mail, MapPin, Users, Sparkles, Clock, CreditCard, Info, CheckCircle, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { formatPrice, formatPriceDisplay, Addon } from "@/lib/product.types";
import { useCurrency } from "@/lib/currency-context";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";

export const bookingFormBaseSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  service: z.string().min(1, "Please select a service"),
  date: z.date({ required_error: "Date is required" }),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  adultPax: z.string().min(1, "Number of adults is required"),
  childPax: z.string().min(1, "Number of children is required"),
  notes: z.string().optional(),
  addonIds: z.array(z.string()).default([]),
});

export const bookingFormSchema = bookingFormBaseSchema.refine((data) => {
  if (data.startTime && data.endTime) {
    const start = data.startTime.split(':').map(Number);
    const end = data.endTime.split(':').map(Number);
    const startMin = start[0] * 60 + start[1];
    const endMin = end[0] * 60 + end[1];
    return endMin > startMin;
  }
  return true;
}, {
  message: "End time must be after start time",
  path: ["endTime"],
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
  adultPriceCents?: number;  // Price per adult in cents (base rate for initial display)
  childPriceCents?: number;  // Price per child in cents (base rate for initial display)
  // Fix #8: Server-confirmed pricing total in cents. When provided (after a successful
  // availability check), this overrides the client-side estimate so the displayed total
  // always matches what the server will actually charge.
  serverPricingCents?: number | null;
  onAvailabilityCheck?: (serviceTitle: string, date: Date, adultPax: number, childPax: number, startTime?: string, endTime?: string) => void;
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
  serverPricingCents = null,
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
      startTime: initialValues?.startTime || "",
      endTime: initialValues?.endTime || "",
    },
  });

  // Track if initial values have been applied to prevent resetting on re-renders
  const hasAppliedInitialValues = useRef(false);

  // Watch for changes - moved up to avoid Temporal Dead Zone (ER-2026-01)
  const watchedService = form.watch("service");
  const watchedAdultPax = form.watch("adultPax");
  const watchedChildPax = form.watch("childPax");
  const watchedDate = form.watch("date"); // Watch date field
  const watchedAddonIds = form.watch("addonIds");
  const watchedStartTime = form.watch("startTime");
  const watchedEndTime = form.watch("endTime");

  // Fix #9: Improved localStorage persistence with:
  //   - Service ID (not title) as key so renames don't leave orphaned drafts
  //   - 7-day expiry so stale drafts don't silently pre-fill the form
  //   - Zod validation on load so schema changes don't cause unexpected form state

  const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  const selectedServiceId = useMemo(
    () => services.find(s => s.title === watchedService)?.id || null,
    [services, watchedService]
  );

  // Save to localStorage
  useEffect(() => {
    const subscription = form.watch((value) => {
      if (selectedServiceId) {
        const draft = { ...value, savedAt: Date.now() };
        localStorage.setItem(`booking_draft_${selectedServiceId}`, JSON.stringify(draft));
      }
    });
    return () => subscription.unsubscribe();
  }, [form, selectedServiceId]);

  // Load from localStorage
  useEffect(() => {
    if (selectedServiceId && !hasAppliedInitialValues.current) {
      const saved = localStorage.getItem(`booking_draft_${selectedServiceId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);

          // Reject stale drafts
          if (parsed.savedAt && Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
            localStorage.removeItem(`booking_draft_${selectedServiceId}`);
            return;
          }

          // Validate the draft against the schema before applying (partial is fine)
          const { savedAt, date: _date, ...rest } = parsed;
          const result = bookingFormBaseSchema.partial().safeParse(rest as any);
          if (result.success) {
            Object.entries(result.data).forEach(([key, value]) => {
              if (value !== undefined && value !== "") {
                form.setValue(key as keyof z.infer<typeof bookingFormSchema>, value as any);
              }
            });
          }
        } catch (e) {
          console.error("Failed to load saved form draft", e);
        }
      }
    }
  }, [selectedServiceId, form]);

  // Update form defaults when initialValues prop changes
  useEffect(() => {
    if (user && !form.getValues("name")) {
      form.setValue("name", user.name);
      form.setValue("email", user.email);
    }
  }, [user, form]);

  useEffect(() => {
    if (initialValues) {
      Object.entries(initialValues).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
          form.setValue(key as keyof z.infer<typeof bookingFormSchema>, value as any);
        }
      });
      // We don't use hasAppliedInitialValues.current here to allow external updates
    }
  }, [initialValues, form]);


  const selectedServiceObj = useMemo(() =>
    services.find(s => s.title === watchedService),
    [services, watchedService]);

  const isVehicle = selectedServiceObj?.category === 'vehicle';
  const isTransfer = selectedServiceObj?.category === 'transfer';
  const isTour = selectedServiceObj?.category === 'tour';

  // Fix #8: Use server-returned pricing when available (after availability check) so the
  // receipt always matches what the server will charge. Fall back to a client-side estimate
  // only when the server hasn't yet confirmed pricing (i.e. before the first check).
  const estimatedTotal = useMemo(() => {
    // Prefer the authoritative server price
    if (serverPricingCents !== null && serverPricingCents !== undefined) {
      return formatPriceDisplay(serverPricingCents, currency);
    }

    // Client-side estimate — used only before the first availability check.
    // NOTE: This is a rough estimate for display only. The server is the source of truth
    // for actual pricing rules. Do not sync these manually when rules change server-side.
    const adults = parseInt(watchedAdultPax || "0");
    const children = parseInt(watchedChildPax || "0");

    let totalCents = (adults * adultPriceCents) + (children * childPriceCents);

    // Add-ons only (group/seasonal rules deliberately omitted — server handles these)
    const selectedAddonsPrice = watchedAddonIds.reduce((sum, id) => {
      const addon = availableAddons.find(a => a.id === id);
      return sum + (addon?.priceCents || 0);
    }, 0);

    totalCents += selectedAddonsPrice;

    return formatPriceDisplay(totalCents, currency);
  }, [serverPricingCents, watchedAdultPax, watchedChildPax, adultPriceCents, childPriceCents, watchedAddonIds, availableAddons, currency]);

  // Debounced availability check
  useEffect(() => {
    const adultPax = parseInt(watchedAdultPax || "0");
    const childPax = parseInt(watchedChildPax || "0");
    const totalPax = adultPax + childPax;

    if (onAvailabilityCheck && watchedService && watchedDate && totalPax > 0) {
      const timer = setTimeout(() => {
        onAvailabilityCheck(
          watchedService,
          watchedDate,
          adultPax,
          childPax,
          watchedStartTime || undefined,
          watchedEndTime || undefined
        );
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [watchedService, watchedDate, watchedAdultPax, watchedChildPax, watchedStartTime, watchedEndTime, onAvailabilityCheck]);

  // Determine if the submit button should be disabled
  const isSubmitDisabled = isLoading || isCheckingAvailability || !isAvailable;

  return (
    <div className="flex flex-col lg:flex-row gap-8 xl:gap-12 items-start">
      <div className="flex-1 w-full space-y-6 order-2 lg:order-1">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* Section 1: Personal Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-5"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Personal Information</h3>
                  <p className="text-sm text-slate-500">Contact details for your reservation</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">{t("booking.fullName", "Full Name")}</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                          <Input
                            placeholder={t("booking.namePlaceholder", "John Doe")}
                            className="pl-10 h-12 border-slate-200 bg-slate-50/50 rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all font-medium"
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
                      <FormLabel className="text-sm font-semibold text-slate-700">{t("booking.email", "Email Address")}</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                          <Input
                            placeholder={t("booking.emailPlaceholder", "john@example.com")}
                            className="pl-10 h-12 border-slate-200 bg-slate-50/50 rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </motion.div>

            {/* Section 2: Journey Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-5"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Journey Details</h3>
                  <p className="text-sm text-slate-500">Select your preferred service and schedule</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="service"
                  render={({ field }) => (
                    <FormItem className="col-span-full">
                      <FormLabel className="text-sm font-semibold text-slate-700">{t("booking.service", "Service")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 border-slate-200 bg-slate-50/50 rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all font-medium">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-slate-400" />
                              <SelectValue placeholder={t("booking.selectService", "Select tour/transfer")} />
                            </div>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl shadow-xl border-slate-100">
                          <SelectItem value="select" disabled>{t("booking.selectOption", "Select an option")}</SelectItem>
                          {services.filter(s => s.category === 'tour').length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="px-2 py-2 text-[10px] uppercase tracking-wider font-black text-slate-400">Tours</SelectLabel>
                              {services.filter(s => s.category === 'tour').map((service) => (
                                <SelectItem key={service.id} value={service.title} className="rounded-md focus:bg-primary/10">{service.title}</SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                          {services.filter(s => s.category === 'transfer').length > 0 && (
                            <SelectGroup>
                              <SelectSeparator className="my-2" />
                              <SelectLabel className="px-2 py-2 text-[10px] uppercase tracking-wider font-black text-slate-400 pt-2">Transfers</SelectLabel>
                              {services.filter(s => s.category === 'transfer').map((service) => (
                                <SelectItem key={service.id} value={service.title} className="rounded-md focus:bg-primary/10">{service.title}</SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                          {services.filter(s => s.category === 'vehicle').length > 0 && (
                            <SelectGroup>
                              <SelectSeparator className="my-2" />
                              <SelectLabel className="px-2 py-2 text-[10px] uppercase tracking-wider font-black text-slate-400 pt-2">Vehicles</SelectLabel>
                              {services.filter(s => s.category === 'vehicle').map((service) => (
                                <SelectItem key={service.id} value={service.title} className="rounded-md focus:bg-primary/10">{service.title}</SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-sm font-semibold text-slate-700">{t("booking.preferredDate", "Preferred Date")}</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full h-12 pl-10 text-left border-slate-200 bg-slate-50/50 rounded-xl focus:ring-4 focus:ring-primary/10 relative",
                                !field.value ? "text-slate-400 font-normal" : "text-slate-900 font-medium"
                              )}
                            >
                              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>{t("booking.pickDate", "Pick a date")}</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-2xl border-slate-100 shadow-2xl" align="start">
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

                {(isVehicle || isTransfer || isTour) && (
                  <>
                    <FormField
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-slate-700">
                            {isTour ? "Session / Time" : "Pickup Time"}
                          </FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="h-12 border-slate-200 bg-slate-50/50 rounded-xl focus:ring-4 focus:ring-primary/10 text-slate-900 font-medium">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-slate-400" />
                                  <SelectValue placeholder="00:00" />
                                </div>
                              </SelectTrigger>
                              <SelectContent className="rounded-xl shadow-xl border-slate-100 max-h-[300px]">
                                {Array.from({ length: 24 * 2 }).map((_, i) => {
                                  const hour = Math.floor(i / 2);
                                  const min = (i % 2) * 30;
                                  const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
                                  return (
                                    <SelectItem key={time} value={time} className="rounded-md focus:bg-primary/10">
                                      {format(new Date(2024, 0, 1, hour, min), "hh:mm a")}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {(isVehicle || isTransfer) && (
                      <FormField
                        control={form.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-slate-700">Drop-off Time</FormLabel>
                            <FormControl>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="h-12 border-slate-200 bg-slate-50/50 rounded-xl focus:ring-4 focus:ring-primary/10 text-slate-900 font-medium">
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-slate-400" />
                                    <SelectValue placeholder="00:00" />
                                  </div>
                                </SelectTrigger>
                                <SelectContent className="rounded-xl shadow-xl border-slate-100 max-h-[300px]">
                                  {Array.from({ length: 24 * 2 }).map((_, i) => {
                                    const hour = Math.floor(i / 2);
                                    const min = (i % 2) * 30;
                                    const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
                                    return (
                                      <SelectItem key={time} value={time} className="rounded-md focus:bg-primary/10">
                                        {format(new Date(2024, 0, 1, hour, min), "hh:mm a")}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </>
                )}
              </div>
            </motion.div>

            {/* Section 3: Travelers & Extras */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-5"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Travelers & Extras</h3>
                  <p className="text-sm text-slate-500">Number of guests and additional options</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-2">
                <FormField
                  control={form.control}
                  name="adultPax"
                  render={({ field }) => (
                    <FormItem className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <FormLabel className="text-sm font-bold text-slate-700">{t("booking.adults", "Adults")}</FormLabel>
                        <span className="text-xs text-slate-400">Ages 13+</span>
                      </div>
                      <FormControl>
                        <CounterInput
                          id="booking-adult-pax"
                          name="adultPax"
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
                    <FormItem className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <FormLabel className="text-sm font-bold text-slate-700">{t("booking.children", "Children")}</FormLabel>
                        <span className="text-xs text-slate-400">Ages 2-12</span>
                      </div>
                      <FormControl>
                        <CounterInput
                          id="booking-child-pax"
                          name="childPax"
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

              <AnimatePresence>
                {availableAddons.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 pt-4 border-t border-slate-100 overflow-hidden"
                  >
                    <FormLabel className="text-sm font-bold text-slate-700 block mb-2">{t("booking.addons", "Special Add-ons")}</FormLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {availableAddons.map((addon) => (
                        <FormField
                          key={addon.id}
                          control={form.control}
                          name="addonIds"
                          render={({ field }) => (
                            <FormItem
                              key={addon.id}
                              className={cn(
                                "flex flex-row items-center space-x-3 space-y-0 rounded-xl border p-4 transition-all duration-300 cursor-pointer",
                                field.value?.includes(addon.id)
                                  ? "bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20"
                                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                              )}
                              onClick={() => {
                                const current = field.value || [];
                                const next = current.includes(addon.id)
                                  ? current.filter(id => id !== addon.id)
                                  : [...current, addon.id];
                                field.onChange(next);
                              }}
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(addon.id)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...(field.value || []), addon.id])
                                      : field.onChange(
                                        field.value?.filter(
                                          (value) => value !== addon.id
                                        )
                                      )
                                  }}
                                  className="h-5 w-5 rounded-md"
                                />
                              </FormControl>
                              <div className="flex-1 space-y-1 leading-none">
                                <FormLabel className="text-sm font-bold text-slate-800 cursor-pointer">
                                  {addon.name}
                                </FormLabel>
                                <p className="text-xs font-medium text-primary">
                                  +{formatPriceDisplay(addon.priceCents, currency)}
                                </p>
                              </div>
                              {field.value?.includes(addon.id) && (
                                <CheckCircle className="h-4 w-4 text-primary animate-in zoom-in duration-300" />
                              )}
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Section 4: Notes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4"
            >
              <div className="flex items-center gap-3 mb-1">
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Special Requests</h3>
                  <p className="text-sm text-slate-500">Dietary needs, accessibility, pickup details</p>
                </div>
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="E.g. vegetarian meal, wheelchair accessibility, hotel pickup from Grand Hotel..."
                        className="min-h-[90px] border-slate-200 bg-slate-50/50 rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all resize-none font-medium text-sm"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-slate-400 mt-1">Optional — we'll do our best to accommodate</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col gap-3 pt-2"
            >
              <Button
                type="submit"
                className="w-full h-14 text-lg font-bold rounded-2xl bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 shadow-xl shadow-primary/20 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:translate-y-0"
                disabled={isSubmitDisabled}
              >
                {isLoading ? (
                  <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="mr-3 h-6 w-6" />
                    {submitButtonText}
                    <ArrowRight className="ml-3 h-5 w-5 opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0" />
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-2 text-slate-400">
                <Info className="h-4 w-4" />
                <p className="text-[10px] font-medium italic">
                  {t("booking.guarantee", "Free cancellation up to 24 hours before your tour")}
                </p>
              </div>
            </motion.div>
          </form>
        </Form>
      </div>

      {/* Mobile Summary Fixed Bottom - only visible on small screens */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 p-4 bg-white/90 backdrop-blur-xl border-t border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex items-center justify-between gap-4 animate-in slide-in-from-bottom duration-500">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1 leading-none">Total Amount</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900 tracking-tight">{estimatedTotal}</span>
            <span className="text-xs font-bold text-slate-400 uppercase">{currency}</span>
          </div>
        </div>
        <Button
          onClick={async () => {
            const isValid = await form.trigger();
            if (isValid) form.handleSubmit(onSubmit)();
          }}
          className="flex-1 h-12 rounded-xl bg-gradient-to-r from-primary to-orange-500 font-bold text-base shadow-lg shadow-primary/20 hover:shadow-xl transition-all active:scale-95"
          disabled={isSubmitDisabled || isLoading}
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (submitButtonText || t("reservations.continue", "Book Now"))}
        </Button>
      </div>

      {/* Desktop Summary Panel */}
      <aside className="hidden lg:block w-[380px] shrink-0">
        <div className="sticky top-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="relative bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100"
          >
            {/* Receipt Header */}
            <div className="bg-slate-950 px-6 py-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
              <div className="relative flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-black tracking-tight uppercase">Booking Summary</h3>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-[0.2em] font-black">Official Reservation Receipt</p>
            </div>

            {/* Perforated edge */}
            <div className="flex justify-between px-2 bg-slate-950 pb-2">
              {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} className="h-2.5 w-2.5 bg-white rounded-full" />
              ))}
            </div>

            <div className="p-6 space-y-5 relative">
              {/* Service */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Service Selected</span>
                <p className="font-bold text-slate-900 leading-tight text-base">
                  {watchedService || <span className="text-slate-200 italic font-normal">No service selected</span>}
                </p>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4 border-t border-dashed border-slate-100 pt-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Date</span>
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <CalendarIcon className="h-3.5 w-3.5 text-primary/60" />
                    {watchedDate ? format(watchedDate, "EEE, MMM d") : "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Time</span>
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-primary/60" />
                    {watchedStartTime ? format(new Date(2024, 0, 1, ...watchedStartTime.split(':').map(Number)), "hh:mm a") : "—"}
                  </p>
                </div>
              </div>

              {/* Traveller count */}
              <div className="grid grid-cols-2 gap-4 border-t border-dashed border-slate-100 pt-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Adults</span>
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-primary/60" />
                    {watchedAdultPax || 0} pax
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Children</span>
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-primary/60" />
                    {watchedChildPax || 0} pax
                  </p>
                </div>
              </div>

              {/* Live Availability Status */}
              <div className="border-t border-dashed border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Live Availability</span>
                  <AnimatePresence mode="wait">
                    {isCheckingAvailability ? (
                      <motion.div key="checking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-1.5 text-slate-400">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="text-[10px] font-bold">Verifying…</span>
                      </motion.div>
                    ) : availabilityMessage ? (
                      <motion.div key="status" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black",
                          isAvailable ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
                        <div className={cn("h-1.5 w-1.5 rounded-full", isAvailable ? "bg-green-500 animate-pulse" : "bg-red-500")} />
                        {isAvailable ? "BOOKABLE" : "UNAVAILABLE"}
                      </motion.div>
                    ) : <span className="text-[10px] text-slate-200 uppercase font-black tracking-widest">—</span>}
                  </AnimatePresence>
                </div>
                {availabilityMessage && !isCheckingAvailability && (
                  <p className={cn("text-[10px] font-medium leading-[1.3] px-2 py-1 rounded-md",
                    isAvailable ? "text-green-600 bg-green-50/50" : "text-red-500 bg-red-50/50")}>
                    {availabilityMessage}
                  </p>
                )}
              </div>

              {/* Price Breakdown */}
              {(showPrice || serverPricingCents) && (
                <div className="border-t-2 border-dashed border-slate-100 pt-5 space-y-3">
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Price Breakdown</span>

                  {/* Adults line */}
                  {parseInt(watchedAdultPax) > 0 && adultPriceCents > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">
                        {watchedAdultPax} × Adult
                        <span className="text-[10px] text-slate-300 ml-1.5">
                          ({formatPriceDisplay(adultPriceCents, currency)})
                        </span>
                      </span>
                      <span className="font-bold text-slate-900 font-mono">
                        {formatPriceDisplay(parseInt(watchedAdultPax) * adultPriceCents, currency)}
                      </span>
                    </div>
                  )}

                  {/* Children line */}
                  {parseInt(watchedChildPax) > 0 && childPriceCents > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">
                        {watchedChildPax} × Child
                        <span className="text-[10px] text-slate-300 ml-1.5">
                          ({formatPriceDisplay(childPriceCents, currency)})
                        </span>
                      </span>
                      <span className="font-bold text-slate-900 font-mono">
                        {formatPriceDisplay(parseInt(watchedChildPax) * childPriceCents, currency)}
                      </span>
                    </div>
                  )}

                  {/* Add-ons lines */}
                  {watchedAddonIds?.length > 0 && availableAddons
                    .filter(a => watchedAddonIds.includes(a.id))
                    .map(addon => (
                      <div key={addon.id} className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium truncate max-w-[180px]">+ {addon.name}</span>
                        <span className="font-bold text-slate-900 font-mono">{formatPriceDisplay(addon.priceCents, currency)}</span>
                      </div>
                    ))
                  }

                  {/* Total */}
                  <div className="flex justify-between items-center pt-4 border-t-2 border-slate-900 border-dashed mt-2">
                    <div>
                      <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest block">Grand Total</span>
                      <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">All taxes included</span>
                    </div>
                    <div className="flex flex-col items-end leading-none">
                      <span className="text-3xl font-black text-slate-900 tracking-tighter">{estimatedTotal}</span>
                      <span className="text-[10px] font-black text-slate-400 mt-1 uppercase leading-none">{currency}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 pt-2 grayscale opacity-30">
                    <CreditCard className="h-4 w-4" />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em]">Secure Checkout</span>
                  </div>
                </div>
              )}

              {/* No price state — show cost per person */}
              {!(showPrice || serverPricingCents) && (
                <div className="border-t border-dashed border-slate-100 pt-4">
                  <p className="text-[10px] text-slate-300 text-center font-bold uppercase tracking-widest">
                    Select a service to see pricing
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Receipt Edge */}
            <div className="bg-slate-50 h-5 w-full flex justify-between items-end overflow-hidden">
              {Array.from({ length: 22 }).map((_, i) => (
                <div key={i} className="h-3.5 w-3.5 bg-white rounded-full translate-y-2.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]" />
              ))}
            </div>
          </motion.div>
        </div>
      </aside>
    </div>
  );
}
