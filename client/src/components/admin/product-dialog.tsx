import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, Trash, Upload, Baby, PawPrint, Users, DollarSign } from "lucide-react";
import { uploadImage } from "@/lib/api";

const VEHICLE_FEATURES = [
  "Air Conditioning", "Bluetooth", "USB Charging", "Leather Seats",
  "4WD/AWD", "Child Seat Available", "Rear View Camera", "GPS Navigation",
  "Free Wi-Fi", "Wheelchair Accessible"
];

const tourSchema = z.object({
  title: z.string().min(3, "Title is required"),
  isActive: z.boolean().default(true),
  price: z.string().min(1, "Price is required"),
  childPrice: z.string().optional(),
  duration: z.string().min(1, "Duration is required"),
  minPax: z.string().optional(),
  category: z.string(),
  defaultCapacity: z.number().min(1, "Capacity must be at least 1").max(10000),
  description: z.string().min(10, "Description is required"),
  image: z.string().optional(),
  vehicleDetails: z.object({
    make: z.string().min(1, "Make is required"),
    model: z.string().min(1, "Model is required"),
    seats: z.number().min(1),
    transmission: z.string(),
    features: z.array(z.string()).optional(),
  }).nullable().optional(),
});

type TourFormValues = z.infer<typeof tourSchema>;

interface TourDialogProps {
  tour: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (tour: any) => void;
}

export function ProductDialog({ tour, open, onOpenChange, onSave }: TourDialogProps) {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<TourFormValues>({
    resolver: zodResolver(tourSchema),
    defaultValues: {
      title: "", isActive: true, price: "", childPrice: "", duration: "",
      minPax: "", category: "tour", defaultCapacity: 20, description: "", image: "", vehicleDetails: null,
    },
  });

  useEffect(() => {
    if (tour) {
      form.reset({
        title: tour.title,
        isActive: tour.isActive ?? true,
        price: tour.price,
        childPrice: tour.childPrice || "",
        duration: tour.duration,
        minPax: tour.minPax || "",
        category: tour.category || "tour",
        defaultCapacity: tour.defaultCapacity || 20,
        description: Array.isArray(tour.description) ? tour.description.join("\n") : tour.description,
        image: tour.image,
        vehicleDetails: tour.vehicleDetails || null,
      });
    } else {
      form.reset({
        title: "", isActive: true, price: "", childPrice: "", duration: "",
        minPax: "", category: "tour", defaultCapacity: 20, description: "", image: "", vehicleDetails: null,
      });
    }
  }, [tour, form]);

  const onSubmit = (values: TourFormValues) => {
    const parsePriceCents = (priceStr: string | undefined): number => {
      if (!priceStr) return 0;
      const match = priceStr.match(/[\d,]+(\.\d+)?/);
      if (!match) return 0;
      return Math.round(parseFloat(match[0].replace(/,/g, "")) * 100);
    };
    onSave({
      ...values,
      description: values.description.split("\n").filter(line => line.trim() !== ""),
      image: values.image || "",
      id: tour?.id,
      adultPriceCents: parsePriceCents(values.price),
      childPriceCents: parsePriceCents(values.childPrice),
      infantPriceCents: 0,   // Infants always free
      petPriceCents: 0,      // Pets always free
    });
    onOpenChange(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await uploadImage(file);
      form.setValue("image", result.url);
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const category = form.watch("category");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tour ? t("admin.editTour") : t("admin.addTour")}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.tourTitle")}</FormLabel>
                  <FormControl><Input placeholder="Efate Scenic Tour" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="isActive" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm">Visibility</FormLabel>
                    <div className="text-xs text-muted-foreground">Show on storefront</div>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )} />
            </div>

            {/* Category */}
            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.category")}</FormLabel>
                <Select onValueChange={(v) => {
                  field.onChange(v);
                  if ((v === 'vehicle' || v === 'transfer') && !form.getValues('vehicleDetails')) {
                    form.setValue('vehicleDetails', { make: "", model: "", seats: 5, transmission: "Automatic", features: [] });
                  } else if (v !== 'vehicle' && v !== 'transfer') {
                    form.setValue('vehicleDetails', null);
                  }
                }} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="tour">Tour</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="vehicle">Vehicle Hire</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Vehicle specs for vehicle/transfer */}
            {(category === 'vehicle' || category === 'transfer') && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-4 border border-border">
                <h4 className="font-semibold text-sm">Vehicle Specifications</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="vehicleDetails.make" render={({ field }) => (
                    <FormItem><FormLabel>Make</FormLabel><FormControl><Input placeholder="Toyota" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="vehicleDetails.model" render={({ field }) => (
                    <FormItem><FormLabel>Model</FormLabel><FormControl><Input placeholder="Hilux" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="vehicleDetails.seats" render={({ field }) => (
                    <FormItem><FormLabel>Seats</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="vehicleDetails.transmission" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transmission</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="Automatic">Automatic</SelectItem>
                          <SelectItem value="Manual">Manual</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="vehicleDetails.features" render={() => (
                    <FormItem className="col-span-2">
                      <div className="mb-2"><FormLabel className="text-sm font-medium">Features</FormLabel></div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                        {VEHICLE_FEATURES.map((item) => (
                          <FormField key={item} control={form.control} name="vehicleDetails.features" render={({ field }) => (
                            <FormItem key={item} className="flex flex-row items-center space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox checked={field.value?.includes(item)}
                                  onCheckedChange={(checked) => {
                                    const current = field.value || [];
                                    return checked ? field.onChange([...current, item]) : field.onChange(current.filter(v => v !== item));
                                  }} />
                              </FormControl>
                              <FormLabel className="font-normal text-sm cursor-pointer">{item}</FormLabel>
                            </FormItem>
                          )} />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
            )}

            {/* PRICING SECTION — all 4 tiers */}
            <div className="rounded-lg border border-border p-4 space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-sm">Pricing</h4>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Adult price */}
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-blue-500" />
                      {t("admin.price")} <span className="text-xs text-muted-foreground">(adult)</span>
                    </FormLabel>
                    <FormControl><Input placeholder="e.g. 3500 VUV" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Child price */}
                <FormField control={form.control} name="childPrice" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-green-500" />
                      {t("admin.childPrice")} <span className="text-xs text-muted-foreground">(2–12 yrs)</span>
                    </FormLabel>
                    <FormControl><Input placeholder="e.g. 1750 VUV" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Infant price — always free */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-sm font-medium">
                    <Baby className="h-3.5 w-3.5 text-pink-500" />
                    Infant Price <span className="text-xs text-muted-foreground">(under 2)</span>
                  </Label>
                  <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-muted/50">
                    <span className="text-sm text-muted-foreground">Always free</span>
                    <Badge variant="outline" className="ml-auto text-xs bg-green-500/10 text-green-600 border-green-500/20">FREE</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Infants under 2 travel free — no charge applied to booking total.</p>
                </div>

                {/* Pet price — always free */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-sm font-medium">
                    <PawPrint className="h-3.5 w-3.5 text-amber-500" />
                    Pet Price
                  </Label>
                  <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-muted/50">
                    <span className="text-sm text-muted-foreground">Always free</span>
                    <Badge variant="outline" className="ml-auto text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">FREE</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Pets are complimentary and do not affect booking total or capacity count.</p>
                </div>
              </div>
            </div>

            {/* Duration + Min Pax */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="duration" render={({ field }) => (
                <FormItem><FormLabel>{t("admin.duration")}</FormLabel><FormControl><Input placeholder="8am to 3pm" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="minPax" render={({ field }) => (
                <FormItem><FormLabel>{t("admin.minPax")}</FormLabel><FormControl><Input placeholder="Min 2 pax" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            {/* Default Capacity */}
            <FormField control={form.control} name="defaultCapacity" render={({ field }) => (
              <FormItem>
                <FormLabel>Default Capacity *</FormLabel>
                <FormControl>
                  <Input type="number" min="1" max="10000" placeholder="20" {...field}
                    onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Maximum {category === 'vehicle' ? 'vehicles' : 'guests'} available per day. Can be overridden per date in Calendar.
                </p>
                <FormMessage />
              </FormItem>
            )} />

            {/* Description */}
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.description")}</FormLabel>
                <FormControl><Textarea placeholder="Tour details (one per line)..." className="min-h-[100px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Image */}
            <FormField control={form.control} name="image" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.image")}</FormLabel>
                <div className="space-y-3">
                  {field.value && <img src={field.value} alt="Preview" className="w-full h-32 object-cover rounded-md border border-border" />}
                  <div className="space-y-2">
                    <FormControl>
                      <Input placeholder="Paste Cloudinary or image URL..." value={field.value || ""} onChange={e => field.onChange(e.target.value)} />
                    </FormControl>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex-1 border-t border-border" /><span>or upload</span><span className="flex-1 border-t border-border" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="cursor-pointer" />
                      {isUploading && <Loader2 className="animate-spin h-4 w-4" />}
                    </div>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={isUploading}>
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {tour ? t("common.saveChanges") : t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
