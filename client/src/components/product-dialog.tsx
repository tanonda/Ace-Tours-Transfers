
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Loader2, Info } from "lucide-react";
import { uploadImage } from "@/lib/api";

const VEHICLE_FEATURES = [
    "Air Conditioning", "Bluetooth", "USB Charging", "Leather Seats",
    "4WD/AWD", "Child Seat Available", "Rear View Camera", "GPS Navigation",
    "Free Wi-Fi", "Wheelchair Accessible"
];

const CURRENCIES = [
    { code: "VUV", label: "VUV – Vanuatu Vatu", symbol: "VT", hint: "Enter whole vatu (e.g. 15000)" },
    { code: "USD", label: "USD – US Dollar", symbol: "$", hint: "Enter dollars (e.g. 120.00)" },
    { code: "AUD", label: "AUD – Australian Dollar", symbol: "A$", hint: "Enter dollars (e.g. 150.00)" },
    { code: "NZD", label: "NZD – New Zealand Dollar", symbol: "NZ$", hint: "Enter dollars (e.g. 175.00)" },
    { code: "EUR", label: "EUR – Euro", symbol: "€", hint: "Enter euros (e.g. 100.00)" },
];

// Approximate VUV equivalents per 1 unit of foreign currency
const RATE_TO_VUV: Record<string, number> = {
    VUV: 1,
    USD: 1 / 0.0084,
    AUD: 1 / 0.013,
    NZD: 1 / 0.011,
    EUR: 1 / 0.0078,
};

function parseToCents(raw: string | undefined, currency: string): number {
    if (!raw) return 0;
    const match = raw.replace(/,/g, "").match(/[\d]+(\.\d+)?/);
    if (!match) return 0;
    const num = parseFloat(match[0]);
    if (currency === "VUV") return Math.round(num * 100);
    return Math.round(num * RATE_TO_VUV[currency] * 100);
}

function centsToDisplay(cents: number, currency: string): string {
    if (!cents) return "";
    if (currency === "VUV") return String(Math.round(cents / 100));
    const foreignAmount = (cents / 100) / RATE_TO_VUV[currency];
    return foreignAmount.toFixed(2);
}

const tourSchema = z.object({
    title: z.string().min(3, "Title is required"),
    isActive: z.boolean().default(true),
    displayCurrency: z.string().default("VUV"),
    price: z.string().min(1, "Adult price is required"),
    childPrice: z.string().optional(),
    duration: z.string().min(1, "Duration is required"),
    minPax: z.string().optional(),
    category: z.string(),
    defaultCapacity: z.number().min(1).max(10000),
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
            title: "", isActive: true, displayCurrency: "VUV",
            price: "", childPrice: "", duration: "", minPax: "",
            category: "tour", defaultCapacity: 20, description: "", image: "",
            vehicleDetails: null,
        },
    });

    useEffect(() => {
        if (open) {
            if (tour) {
                const currency = tour.displayCurrency || "VUV";
                form.reset({
                    title: tour.title,
                    isActive: tour.isActive ?? true,
                    displayCurrency: currency,
                    price: tour.adultPriceCents ? centsToDisplay(tour.adultPriceCents, currency) : (tour.price || ""),
                    childPrice: tour.childPriceCents ? centsToDisplay(tour.childPriceCents, currency) : (tour.childPrice || ""),
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
                    title: "", isActive: true, displayCurrency: "VUV",
                    price: "", childPrice: "", duration: "", minPax: "",
                    category: "tour", defaultCapacity: 20, description: "", image: "",
                    vehicleDetails: null,
                });
            }
        }
    }, [tour, open]);

    const displayCurrency = form.watch("displayCurrency");
    const category = form.watch("category");
    const currencyMeta = CURRENCIES.find(c => c.code === displayCurrency) || CURRENCIES[0];

    const onSubmit = (values: TourFormValues) => {
        const currency = values.displayCurrency || "VUV";
        const adultPriceCents = parseToCents(values.price, currency);
        const childPriceCents = parseToCents(values.childPrice, currency);
        onSave({
            ...values,
            description: values.description.split("\n").filter(line => line.trim() !== ""),
            image: values.image || "",
            id: tour?.id,
            adultPriceCents,
            childPriceCents,
            price: `${currencyMeta.symbol}${values.price}`,
            childPrice: values.childPrice ? `${currencyMeta.symbol}${values.childPrice}` : "",
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{tour ? t("admin.editTour") : t("admin.addTour")}</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="title" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("admin.tourTitle")}</FormLabel>
                                    <FormControl><Input placeholder="Efate Scenic Tour" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="isActive" render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Visibility</FormLabel>
                                        <div className="text-sm text-muted-foreground">Display on Storefront</div>
                                    </div>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )} />
                        </div>

                        <FormField control={form.control} name="category" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t("admin.category")}</FormLabel>
                                <Select
                                    onValueChange={(v) => {
                                        field.onChange(v);
                                        if ((v === "vehicle" || v === "transfer") && !form.getValues("vehicleDetails")) {
                                            form.setValue("vehicleDetails", { make: "", model: "", seats: 5, transmission: "Automatic", features: [] });
                                        } else if (v !== "vehicle" && v !== "transfer") {
                                            form.setValue("vehicleDetails", null);
                                        }
                                    }}
                                    value={field.value}
                                >
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="tour">Tour</SelectItem>
                                        <SelectItem value="transfer">Transfer</SelectItem>
                                        <SelectItem value="vehicle">Vehicle Hire</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />

                        {(category === "vehicle" || category === "transfer") && (
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
                                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                                {VEHICLE_FEATURES.map((item) => (
                                                    <FormField key={item} control={form.control} name="vehicleDetails.features" render={({ field }) => (
                                                        <FormItem key={item} className="flex flex-row items-center space-x-2 space-y-0">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value?.includes(item)}
                                                                    onCheckedChange={(checked) => {
                                                                        const cur = field.value || [];
                                                                        field.onChange(checked ? [...cur, item] : cur.filter(v => v !== item));
                                                                    }}
                                                                />
                                                            </FormControl>
                                                            <FormLabel className="font-normal text-sm cursor-pointer">{item}</FormLabel>
                                                        </FormItem>
                                                    )} />
                                                ))}
                                            </div>
                                        </FormItem>
                                    )} />
                                </div>
                            </div>
                        )}

                        {/* ── PRICING ── */}
                        <div className="rounded-lg border border-border p-4 space-y-4 bg-muted/20">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-sm">Pricing</h4>
                                <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                    Always stored in VUV
                                </Badge>
                            </div>

                            <FormField control={form.control} name="displayCurrency" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Enter prices in</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {CURRENCIES.map(c => (
                                                <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {displayCurrency !== "VUV" && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                                            <Info className="h-3 w-3 shrink-0" />
                                            {displayCurrency} amounts will be converted to VUV (~{Math.round(RATE_TO_VUV[displayCurrency])} VUV per {displayCurrency === "EUR" ? "€1" : "$1"}) and stored in VUV.
                                        </p>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="price" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Adult Price ({currencyMeta.symbol})</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencyMeta.symbol}</span>
                                                <Input className="pl-8" placeholder={displayCurrency === "VUV" ? "15000" : "120"} {...field} />
                                            </div>
                                        </FormControl>
                                        <p className="text-xs text-muted-foreground">{currencyMeta.hint}</p>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="childPrice" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Child Price ({currencyMeta.symbol}) <span className="text-muted-foreground font-normal">— optional</span></FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencyMeta.symbol}</span>
                                                <Input className="pl-8" placeholder={displayCurrency === "VUV" ? "7500" : "60"} {...field} />
                                            </div>
                                        </FormControl>
                                        <p className="text-xs text-muted-foreground">Leave blank if no child rate</p>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="duration" render={({ field }) => (
                                <FormItem><FormLabel>{t("admin.duration")}</FormLabel><FormControl><Input placeholder="8am to 3pm" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="minPax" render={({ field }) => (
                                <FormItem><FormLabel>{t("admin.minPax")}</FormLabel><FormControl><Input placeholder="Min 2 pax" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>

                        <FormField control={form.control} name="defaultCapacity" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Default Capacity *</FormLabel>
                                <FormControl>
                                    <Input type="number" min="1" max="10000" placeholder="20" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                                </FormControl>
                                <p className="text-xs text-muted-foreground">
                                    Maximum {category === "vehicle" ? "vehicles" : "guests"} per day. Can be overridden for specific dates.
                                </p>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t("admin.description")}</FormLabel>
                                <FormControl><Textarea placeholder="Tour highlights, one per line..." className="min-h-[100px]" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="image" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t("admin.image")}</FormLabel>
                                <div className="space-y-3">
                                    {field.value && (
                                        <img src={field.value} alt="Preview" className="w-full h-32 object-cover rounded-md border border-border" />
                                    )}
                                    <div className="space-y-2">
                                        <FormControl>
                                            <Input placeholder="Paste Cloudinary or image URL..." value={field.value || ""} onChange={(e) => field.onChange(e.target.value)} />
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
