
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, Trash, Upload } from "lucide-react";
import { uploadImage } from "@/lib/api";

const tourSchema = z.object({
    title: z.string().min(3, "Title is required"),
    price: z.string().min(1, "Price is required"),
    childPrice: z.string().optional(),
    duration: z.string().min(1, "Duration is required"),
    minPax: z.string().optional(),
    category: z.string(),
    defaultCapacity: z.number().min(1, "Capacity must be at least 1").max(10000, "Capacity cannot exceed 10000"),
    description: z.string().min(10, "Description is required"),
    image: z.string().min(1, "Image is required"),
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

export function TourDialog({ tour, open, onOpenChange, onSave }: TourDialogProps) {
    const { t } = useTranslation();
    const [isUploading, setIsUploading] = useState(false);

    const form = useForm<TourFormValues>({
        resolver: zodResolver(tourSchema),
        defaultValues: {
            title: "",
            price: "",
            childPrice: "",
            duration: "",
            minPax: "",
            category: "tour",
            defaultCapacity: 20,
            description: "",
            image: "",
            vehicleDetails: null,
        },
    });

    useEffect(() => {
        if (tour) {
            form.reset({
                title: tour.title,
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
                title: "",
                price: "",
                childPrice: "",
                duration: "",
                minPax: "",
                category: "tour",
                defaultCapacity: 20,
                description: "",
                image: "",
                vehicleDetails: null,
            });
        }
    }, [tour, form]);

    const onSubmit = (values: TourFormValues) => {
        onSave({
            ...values,
            description: values.description.split("\n").filter(line => line.trim() !== ""),
            id: tour?.id,
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
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{tour ? t("admin.editTour") : t("admin.addTour")}</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t("admin.tourTitle")}</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Efate Scenic Tour" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t("admin.category")}</FormLabel>
                                        <Select
                                            onValueChange={(v) => {
                                                field.onChange(v);
                                                if (v === 'vehicle' && !form.getValues('vehicleDetails')) {
                                                    form.setValue('vehicleDetails', {
                                                        make: "",
                                                        model: "",
                                                        seats: 5,
                                                        transmission: "Automatic",
                                                        features: []
                                                    });
                                                } else if (v !== 'vehicle') {
                                                    form.setValue('vehicleDetails', null);
                                                }
                                            }}
                                            value={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select category" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="tour">Tour</SelectItem>
                                                <SelectItem value="transfer">Transfer</SelectItem>
                                                <SelectItem value="vehicle">Vehicle Hire</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {category === 'vehicle' && (
                            <div className="p-4 bg-muted/50 rounded-lg space-y-4 border border-border">
                                <h4 className="font-semibold text-sm">Vehicle Specifications</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="vehicleDetails.make"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Make</FormLabel>
                                                <FormControl><Input placeholder="Toyota" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="vehicleDetails.model"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Model</FormLabel>
                                                <FormControl><Input placeholder="Hilux" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="vehicleDetails.seats"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Seats</FormLabel>
                                                <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="vehicleDetails.transmission"
                                        render={({ field }) => (
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
                                        )}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t("admin.price")}</FormLabel>
                                        <FormControl>
                                            <Input placeholder="$120 / adult" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="childPrice"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t("admin.childPrice")}</FormLabel>
                                        <FormControl>
                                            <Input placeholder="$60 / child" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="duration"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t("admin.duration")}</FormLabel>
                                        <FormControl>
                                            <Input placeholder="8am to 3pm" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="minPax"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t("admin.minPax")}</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Min 2 pax" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="defaultCapacity"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Default Capacity *</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min="1"
                                            max="10000"
                                            placeholder="20"
                                            {...field}
                                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                        />
                                    </FormControl>
                                    <p className="text-xs text-muted-foreground">
                                        Maximum {category === 'vehicle' ? 'vehicles' : 'guests'} available per day. Can be overridden for specific dates.
                                    </p>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("admin.description")}</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Tour details (one per line)..."
                                            className="min-h-[100px]"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="image"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("admin.image")}</FormLabel>
                                    <div className="space-y-3">
                                        {field.value && (
                                            <img
                                                src={field.value}
                                                alt="Preview"
                                                className="w-full h-32 object-cover rounded-md border border-border"
                                            />
                                        )}
                                        <div className="space-y-2">
                                            <FormControl>
                                                <Input
                                                    placeholder="Paste Cloudinary or image URL..."
                                                    value={field.value || ""}
                                                    onChange={(e) => field.onChange(e.target.value)}
                                                />
                                            </FormControl>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span className="flex-1 border-t border-border"></span>
                                                <span>or upload</span>
                                                <span className="flex-1 border-t border-border"></span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleImageUpload}
                                                    disabled={isUploading}
                                                    className="cursor-pointer"
                                                />
                                                {isUploading && <Loader2 className="animate-spin h-4 w-4" />}
                                            </div>
                                        </div>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                {t("common.cancel")}
                            </Button>
                            <Button type="submit">
                                {tour ? t("common.saveChanges") : t("common.create")}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
