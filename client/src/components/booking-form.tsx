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

export const bookingFormSchema = z.object({
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
}).refine((data) => {
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
  adultPriceCents?: number;  // Price per adult in cents
  childPriceCents?: number;  // Price per child in cents
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

  // Persistence: Save to localStorage
  useEffect(() => {
    const subscription = form.watch((value) => {
      if (value.service) {
        localStorage.setItem(`booking_draft_${value.service}`, JSON.stringify(value));
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Persistence: Load from localStorage
  useEffect(() => {
    if (watchedService && !hasAppliedInitialValues.current) {
      const saved = localStorage.getItem(`booking_draft_${watchedService}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          Object.entries(parsed).forEach(([key, value]) => {
            if (value && key !== 'date') { // date needs special handling
              form.setValue(key as any, value as any);
            }
          });
        } catch (e) {
          console.error("Failed to load saved form", e);
        }
      }
    }
  }, [watchedService, form]);

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


  const selectedServiceObj = useMemo(() =>
    services.find(s => s.title === watchedService),
    [services, watchedService]);

  const isVehicle = selectedServiceObj?.category === 'vehicle';
  const isTransfer = selectedServiceObj?.category === 'transfer';
  const isTour = selectedServiceObj?.category === 'tour';

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
                <p className="text-xs font-medium italic">
                  {t("booking.guarantee", "Free cancellation up to 24 hours before your tour")}
                </p>
              </div>
            </motion.div>
          </form>
        </Form>
      </div>

      <aside className="w-full lg:w-[380px] order-1 lg:order-2 sticky top-24">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="relative bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100"
        >
          {/* Receipt Header */}
          <div className="bg-slate-900 px-6 py-5 text-white relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-black tracking-tight uppercase">Booking Summary</h3>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest font-bold">Ace Tours & Transfers</p>
          </div>

          {/* Perforated edge */}
          <div className="flex justify-between px-2 bg-slate-900 pb-1">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="h-2 w-2 bg-white rounded-full" />
            ))}
          </div>

          <div className="p-5 space-y-4 relative">

            {/* Service */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Service</span>
              <p className="font-bold text-slate-900 leading-[1.3] text-sm">
                {watchedService || <span className="text-slate-300 italic font-normal">Select a service</span>}
              </p>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3 border-t border-dashed border-slate-100 pt-3">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Date</span>
                <p className="text-xs font-bold text-slate-800">
                  {watchedDate ? format(watchedDate, "EEE, MMM d, yyyy") : <span className="text-slate-300">—</span>}
                </p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Time</span>
                <p className="text-xs font-bold text-slate-800">
                  {watchedStartTime ? format(new Date(2024, 0, 1, ...watchedStartTime.split(':').map(Number)), "hh:mm a") : <span className="text-slate-300">—</span>}
                </p>
              </div>
            </div>

            {/* Traveller count */}
            <div className="grid grid-cols-2 gap-3 border-t border-dashed border-slate-100 pt-3">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Adults</span>
                <p className="text-sm font-bold text-slate-800">{watchedAdultPax || 0} pax</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Children</span>
                <p className="text-sm font-bold text-slate-800">{watchedChildPax || 0} pax</p>
              </div>
            </div>

            {/* Live Availability */}
            <div className="border-t border-dashed border-slate-100 pt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Availability</span>
                <AnimatePresence mode="wait">
                  {isCheckingAvailability ? (
                    <motion.div key="checking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-1.5 text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-[10px] font-bold">Checking…</span>
                    </motion.div>
                  ) : availabilityMessage ? (
                    <motion.div key="status" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold",
                        isAvailable ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
                      <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", isAvailable ? "bg-green-500" : "bg-red-500")} />
                      {isAvailable ? "Available" : "Unavailable"}
                    </motion.div>
                  ) : <span className="text-[10px] text-slate-300">—</span>}
                </AnimatePresence>
              </div>
              {availabilityMessage && !isCheckingAvailability && (
                <p className={cn("text-[10px] font-medium leading-[1.4]",
                  isAvailable ? "text-green-600" : "text-red-500")}>
                  {availabilityMessage}
                </p>
              )}
            </div>

            {/* Price Breakdown */}
            {showPrice && (
              <div className="border-t-2 border-dashed border-slate-200 pt-4 space-y-2">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Price Breakdown</span>

                {/* Adults line */}
                {parseInt(watchedAdultPax) > 0 && adultPriceCents > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">
                      {watchedAdultPax} × Adult
                      <span className="text-[10px] text-slate-400 ml-1">
                        ({formatPriceDisplay(adultPriceCents, currency)} ea)
                      </span>
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatPriceDisplay(parseInt(watchedAdultPax) * adultPriceCents, currency)}
                    </span>
                  </div>
                )}

                {/* Children line */}
                {parseInt(watchedChildPax) > 0 && childPriceCents > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">
                      {watchedChildPax} × Child
                      <span className="text-[10px] text-slate-400 ml-1">
                        ({formatPriceDisplay(childPriceCents, currency)} ea)
                      </span>
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatPriceDisplay(parseInt(watchedChildPax) * childPriceCents, currency)}
                    </span>
                  </div>
                )}

                {/* Add-ons lines */}
                {watchedAddonIds?.length > 0 && availableAddons
                  .filter(a => watchedAddonIds.includes(a.id))
                  .map(addon => (
                    <div key={addon.id} className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 truncate max-w-[180px]">+ {addon.name}</span>
                      <span className="font-bold text-slate-900">{formatPriceDisplay(addon.priceCents, currency)}</span>
                    </div>
                  ))
                }

                {/* Group discount notice */}
                {parseInt(watchedAdultPax) >= 7 && (
                  <div className="flex justify-between items-center text-sm text-green-600">
                    <span>Group discount (10%)</span>
                    <span className="font-bold">−applied</span>
                  </div>
                )}

                {/* Seasonal surcharge notice */}
                {watchedDate && (watchedDate.getMonth() === 11 || watchedDate.getMonth() === 0) && (
                  <div className="flex justify-between items-center text-sm text-amber-600">
                    <span>Peak season (+20%)</span>
                    <span className="font-bold">applied</span>
                  </div>
                )}

                {/* Total */}
                <div className="flex justify-between items-center pt-3 border-t-2 border-slate-900 border-dashed">
                  <div>
                    <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">Estimated Total</span>
                    <span className="text-[9px] text-slate-400">*Final price confirmed at checkout</span>
                  </div>
                  <span className="text-2xl font-black text-slate-900 tracking-tighter">{estimatedTotal}</span>
                </div>

                <div className="flex items-center justify-center gap-2 pt-1">
                  <CreditCard className="h-3.5 w-3.5 text-slate-300" />
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-wider">Secure Booking</span>
                </div>
              </div>
            )}

            {/* No price state — show cost per person */}
            {!showPrice && (
              <div className="border-t border-dashed border-slate-100 pt-3">
                <p className="text-[10px] text-slate-300 text-center italic">
                  Select a service & date to see pricing
                </p>
              </div>
            )}
          </div>

          {/* Bottom Receipt Edge */}
          <div className="bg-slate-50 h-4 w-full flex justify-between items-end overflow-hidden">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="h-3 w-3 bg-white rounded-full translate-y-2" />
            ))}
          </div>
        </motion.div>
      </aside>
    </div>
  );
}
