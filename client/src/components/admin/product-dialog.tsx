/**
 * ProductDialog — Admin dialog for creating/editing products (tours, transfers, vehicles).
 *
 * Content fields are dynamically shown per category to match what displays on each detail page:
 *
 * TOUR detail page:
 *   ├── "Overview" card  →  description[0]  (tourOverview)
 *   └── "What's Included" card  →  description[1..n]  (inclusions, one per line)
 *
 * TRANSFER detail page:
 *   ├── "Transfer Details" card  →  description[0]  (transferDetail)
 *   └── "What's Included" card  →  description[1..n]  (inclusions, one per line)
 *
 * VEHICLE detail page:
 *   ├── "About This Vehicle" card  →  description[0..n]  (vehicleAbout, one paragraph per line)
 *   ├── "Vehicle Specs" card  →  vehicleDetails.{make,model,seats,transmission}
 *   └── "What's Included" card  →  vehicleDetails.features[]
 */

import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useTranslation } from 'react-i18next';
import {
  Loader2, Upload, Baby, PawPrint, Users, Package,
  DollarSign, Info, User, ImageIcon, Settings, Car, MapPin, List,
} from 'lucide-react';
import { uploadImage } from '@/lib/api';
import { CURRENCIES, formatInCurrency } from '@/lib/currency-context';
import type { CurrencyCode } from '@/lib/currency-context';
import type { PricingType } from '@/lib/product.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const VEHICLE_FEATURES = [
  'Air Conditioning', 'Bluetooth', 'USB Charging', 'Leather Seats',
  '4WD/AWD', 'Child Seat Available', 'Rear View Camera', 'GPS Navigation',
  'Free Wi-Fi', 'Wheelchair Accessible', 'Professional Driver', 'Fuel Included',
  'Complimentary Water', 'Airport Pickup',
];

// ─── Schema ───────────────────────────────────────────────────────────────────

const tourSchema = z.object({
  title: z.string().min(3, 'Title is required'),
  isActive: z.boolean().default(true),
  category: z.string(),
  duration: z.string().min(1, 'Duration is required'),
  minPax: z.string().optional(),
  defaultCapacity: z.number().min(1).max(10000),

  // Tour content fields
  tourOverview: z.string().optional(),
  inclusions: z.string().optional(),

  // Transfer content fields
  transferDetail: z.string().optional(),

  // Vehicle content fields
  vehicleAbout: z.string().optional(),

  image: z.string().optional(),

  pricingType: z.enum(['per_person', 'group']).default('per_person'),
  adultPriceInput: z.string().min(1, 'Adult price is required'),
  childPriceInput: z.string().optional(),
  groupPriceInput: z.string().optional(),
  groupMaxPax: z.string().optional(),

  vehicleDetails: z.object({
    make: z.string().optional(),
    model: z.string().optional(),
    seats: z.number().min(1).optional(),
    transmission: z.string().optional(),
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseInputToVUV(raw: string, inputCurrency: CurrencyCode): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d.]/g, '');
  const amount = parseFloat(cleaned);
  if (isNaN(amount)) return 0;
  const def = CURRENCIES[inputCurrency];
  return Math.round(amount / def.rateFromVUV);
}

function vuvToInputString(vuvAmount: number, outputCurrency: CurrencyCode): string {
  if (!vuvAmount) return '';
  const def = CURRENCIES[outputCurrency];
  const amount = vuvAmount * def.rateFromVUV;
  return def.isWholeUnit ? Math.round(amount).toString() : amount.toFixed(2);
}

function AdminCurrencyPicker({ value, onChange }: { value: CurrencyCode; onChange: (c: CurrencyCode) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as CurrencyCode)}>
      <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        {Object.values(CURRENCIES).map((c) => (
          <SelectItem key={c.code} value={c.code} className="text-xs">{c.symbol} {c.code}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PriceInputRow({ label, icon, fieldName, placeholder, hint, control, inputCurrency }: {
  label: React.ReactNode; icon: React.ReactNode; fieldName: keyof TourFormValues;
  placeholder?: string; hint?: string; control: any; inputCurrency: CurrencyCode;
}) {
  const def = CURRENCIES[inputCurrency];
  return (
    <FormField control={control} name={fieldName} render={({ field }) => {
      const vuvEquiv = parseInputToVUV(field.value as string, inputCurrency);
      const showVUVHint = inputCurrency !== 'VUV' && vuvEquiv > 0;
      return (
        <FormItem>
          <FormLabel className="flex items-center gap-1.5">{icon}{label}</FormLabel>
          <FormControl>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium select-none">{def.symbol}</span>
              <Input className="pl-8" placeholder={placeholder} {...field} value={field.value as string} />
            </div>
          </FormControl>
          {showVUVHint && <p className="text-xs text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" />≈ {formatInCurrency(vuvEquiv, 'VUV')} stored</p>}
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          <FormMessage />
        </FormItem>
      );
    }} />
  );
}

function ContentBadge({ label }: { label: string }) {
  return <Badge variant="outline" className="ml-1 text-[0.62rem] py-0 px-1.5 font-normal">{label}</Badge>;
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export function ProductDialog({ tour, open, onOpenChange, onSave }: TourDialogProps) {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('details');
  const [adminInputCurrency, setAdminInputCurrency] = useState<CurrencyCode>('VUV');

  const form = useForm<TourFormValues>({
    resolver: zodResolver(tourSchema),
    defaultValues: {
      title: '', isActive: true, category: 'tour', duration: '', minPax: '',
      defaultCapacity: 20,
      tourOverview: '', inclusions: '', transferDetail: '', vehicleAbout: '',
      image: '', pricingType: 'per_person',
      adultPriceInput: '', childPriceInput: '', groupPriceInput: '', groupMaxPax: '',
      vehicleDetails: null,
    },
  });

  function descriptionToFields(desc: string | string[] | null | undefined, cat: string) {
    if (!desc) return { tourOverview: '', transferDetail: '', vehicleAbout: '', inclusions: '' };
    const lines = Array.isArray(desc) ? desc : [desc];
    if (cat === 'vehicle') return { tourOverview: '', transferDetail: '', vehicleAbout: lines.join('\n'), inclusions: '' };
    if (cat === 'transfer') return { tourOverview: '', transferDetail: lines[0] || '', vehicleAbout: '', inclusions: lines.slice(1).join('\n') };
    return { tourOverview: lines[0] || '', transferDetail: '', vehicleAbout: '', inclusions: lines.slice(1).join('\n') };
  }

  useEffect(() => {
    if (tour) {
      const cat = tour.category || 'tour';
      const fields = descriptionToFields(tour.description, cat);
      form.reset({
        title: tour.title,
        isActive: tour.isActive ?? true,
        category: cat,
        duration: tour.duration,
        minPax: tour.minPax || '',
        defaultCapacity: tour.defaultCapacity || 20,
        ...fields,
        image: tour.image || '',
        pricingType: (tour.pricingType as PricingType) || 'per_person',
        adultPriceInput: vuvToInputString(tour.adultPriceCents ?? 0, adminInputCurrency),
        childPriceInput: vuvToInputString(tour.childPriceCents ?? 0, adminInputCurrency),
        groupPriceInput: vuvToInputString(tour.groupPriceCents ?? 0, adminInputCurrency),
        groupMaxPax: tour.groupMaxPax?.toString() || '',
        vehicleDetails: tour.vehicleDetails || null,
      });
    } else {
      form.reset({
        title: '', isActive: true, category: 'tour', duration: '', minPax: '',
        defaultCapacity: 20,
        tourOverview: '', inclusions: '', transferDetail: '', vehicleAbout: '',
        image: '', pricingType: 'per_person',
        adultPriceInput: '', childPriceInput: '', groupPriceInput: '', groupMaxPax: '',
        vehicleDetails: null,
      });
    }
    setActiveTab('details');
    setUploadError(null);
  }, [tour, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInputCurrencyChange = (newCurrency: CurrencyCode) => {
    (['adultPriceInput', 'childPriceInput', 'groupPriceInput'] as const).forEach((f) => {
      const raw = form.getValues(f) as string;
      if (!raw) return;
      form.setValue(f, vuvToInputString(parseInputToVUV(raw, adminInputCurrency), newCurrency));
    });
    setAdminInputCurrency(newCurrency);
  };

  function buildDescription(values: TourFormValues): string[] {
    const cat = values.category;
    if (cat === 'vehicle') {
      return (values.vehicleAbout || '').split('\n').map(l => l.trim()).filter(Boolean);
    }
    if (cat === 'transfer') {
      const detail = values.transferDetail?.trim() || '';
      const items = (values.inclusions || '').split('\n').map(l => l.trim()).filter(Boolean);
      return detail ? [detail, ...items] : items;
    }
    const overview = values.tourOverview?.trim() || '';
    const items = (values.inclusions || '').split('\n').map(l => l.trim()).filter(Boolean);
    return overview ? [overview, ...items] : items;
  }

  const onSubmit = (values: TourFormValues) => {
    const adultPriceCents = parseInputToVUV(values.adultPriceInput, adminInputCurrency);
    const childPriceCents = parseInputToVUV(values.childPriceInput || '0', adminInputCurrency);
    const groupPriceCents = parseInputToVUV(values.groupPriceInput || '0', adminInputCurrency);
    onSave({
      ...values,
      description: buildDescription(values),
      image: values.image || '',
      id: tour?.id,
      pricingType: values.pricingType,
      adultPriceCents, childPriceCents, groupPriceCents,
      groupMaxPax: values.groupMaxPax ? parseInt(values.groupMaxPax) : null,
      infantPriceCents: 0, petPriceCents: 0,
      price: `${adultPriceCents} VUV`,
      childPrice: `${childPriceCents} VUV`,
    });
    onOpenChange(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const result = await uploadImage(file);
      form.setValue('image', result.url);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed. Please check Cloudinary credentials.');
    } finally {
      setIsUploading(false);
    }
  };

  const category = form.watch('category');
  const pricingType = form.watch('pricingType');
  const categoryLabel = category === 'vehicle' ? 'Vehicle Hire' : category === 'transfer' ? 'Transfer' : 'Tour';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tour ? `Edit ${categoryLabel}` : `New ${categoryLabel}`}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-5">
                <TabsTrigger value="details" className="flex items-center gap-1.5">
                  <Settings className="h-3.5 w-3.5" />Details
                </TabsTrigger>
                <TabsTrigger value="pricing" className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />Pricing
                </TabsTrigger>
                <TabsTrigger value="media" className="flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" />Media
                </TabsTrigger>
              </TabsList>

              {/* ── DETAILS TAB ─────────────────────────────────────────── */}
              <TabsContent value="details" className="space-y-5 mt-0">

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.tourTitle')}</FormLabel>
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
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.category')}</FormLabel>
                    <Select
                      onValueChange={(v) => {
                        field.onChange(v);
                        if (v === 'vehicle') {
                          if (!form.getValues('vehicleDetails')) form.setValue('vehicleDetails', { make: '', model: '', seats: 5, transmission: 'Automatic', features: [] });
                          form.setValue('pricingType', 'group');
                        } else if (v === 'transfer') {
                          if (!form.getValues('vehicleDetails')) form.setValue('vehicleDetails', { make: '', model: '', seats: 5, transmission: 'Automatic', features: [] });
                          form.setValue('pricingType', 'per_person');
                        } else {
                          form.setValue('vehicleDetails', null);
                          form.setValue('pricingType', 'per_person');
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="duration" render={({ field }) => (
                    <FormItem><FormLabel>{t('admin.duration')}</FormLabel><FormControl><Input placeholder="8am to 3pm" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="minPax" render={({ field }) => (
                    <FormItem><FormLabel>{t('admin.minPax')}</FormLabel><FormControl><Input placeholder="Min 2 pax" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="defaultCapacity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Capacity</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" max="10000" placeholder="20" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Maximum {category === 'vehicle' ? 'vehicles' : 'guests'} per day. Override per date in Calendar.</p>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* ─── TOUR CONTENT ─── */}
                {category === 'tour' && (
                  <div className="space-y-4 rounded-lg border border-border bg-blue-500/5 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="h-4 w-4 text-blue-500" />
                      <p className="text-sm font-semibold">Tour Page Content</p>
                    </div>
                    <p className="text-xs text-muted-foreground -mt-3">These fields populate the cards on the Tour detail page.</p>

                    <FormField control={form.control} name="tourOverview" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          Overview text
                          <ContentBadge label='"Overview" card' />
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the tour experience, highlights, and what guests can expect..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Displayed in the "Overview" card on the tour detail page.</p>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="inclusions" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <List className="h-3.5 w-3.5" /> What's Included items
                          <ContentBadge label="Whats Included card" />
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={"Hotel pickup & drop-off\nLunch included\nLocal guide\nSnorkelling equipment"}
                            className="min-h-[100px] font-mono text-sm"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">One item per line → each becomes a ✓ checkmark in the "What's Included" card.</p>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}

                {/* ─── TRANSFER CONTENT ─── */}
                {category === 'transfer' && (
                  <div className="space-y-4 rounded-lg border border-border bg-green-500/5 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Car className="h-4 w-4 text-green-600" />
                      <p className="text-sm font-semibold">Transfer Page Content</p>
                    </div>
                    <p className="text-xs text-muted-foreground -mt-3">These fields populate the cards on the Transfer detail page.</p>

                    <FormField control={form.control} name="transferDetail" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          Transfer Details text
                          <ContentBadge label='"Transfer Details" card' />
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the transfer route, pickup/drop-off points, vehicle type, and service details..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Displayed in the "Transfer Details" card on the transfer detail page.</p>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="inclusions" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <List className="h-3.5 w-3.5" /> What's Included items
                          <ContentBadge label="Whats Included card" />
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={"Air-conditioned vehicle\nProfessional driver\nDoor-to-door service\nChild seats available"}
                            className="min-h-[100px] font-mono text-sm"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">One item per line → each becomes a ✓ checkmark in the "What's Included" card.</p>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="pt-3 border-t border-border space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vehicle Info (optional)</p>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={form.control} name="vehicleDetails.make" render={({ field }) => (
                          <FormItem><FormLabel>Make</FormLabel><FormControl><Input placeholder="Toyota" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="vehicleDetails.model" render={({ field }) => (
                          <FormItem><FormLabel>Model</FormLabel><FormControl><Input placeholder="Hiace" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="vehicleDetails.seats" render={({ field }) => (
                          <FormItem><FormLabel>Seats</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="vehicleDetails.transmission" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Transmission</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? 'Automatic'}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="Automatic">Automatic</SelectItem>
                                <SelectItem value="Manual">Manual</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── VEHICLE CONTENT ─── */}
                {category === 'vehicle' && (
                  <div className="space-y-4 rounded-lg border border-border bg-amber-500/5 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Car className="h-4 w-4 text-amber-600" />
                      <p className="text-sm font-semibold">Vehicle Hire Page Content</p>
                    </div>
                    <p className="text-xs text-muted-foreground -mt-3">These fields populate the cards on the Vehicle Hire detail page.</p>

                    {/* Specs */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        🔧 Vehicle Specs
                        <ContentBadge label='"Vehicle Specs" card' />
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={form.control} name="vehicleDetails.make" render={({ field }) => (
                          <FormItem><FormLabel>Make</FormLabel><FormControl><Input placeholder="Toyota" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="vehicleDetails.model" render={({ field }) => (
                          <FormItem><FormLabel>Model</FormLabel><FormControl><Input placeholder="Hilux" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="vehicleDetails.seats" render={({ field }) => (
                          <FormItem><FormLabel>Seats</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="vehicleDetails.transmission" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Transmission</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? 'Automatic'}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="Automatic">Automatic</SelectItem>
                                <SelectItem value="Manual">Manual</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </div>

                    {/* About */}
                    <div className="border-t border-border pt-3">
                      <FormField control={form.control} name="vehicleAbout" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            About this vehicle
                            <ContentBadge label='"About This Vehicle" card' />
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={"The Toyota Hilux is Vanuatu's most popular 4WD hire vehicle.\nPerfect for exploring Efate Island's rugged terrain.\nFull tank of fuel included with every hire."}
                              className="min-h-[110px]"
                              {...field}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">One paragraph per line. Each line becomes a paragraph in the "About This Vehicle" card.</p>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {/* Features / Included */}
                    <div className="border-t border-border pt-3 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <List className="h-3.5 w-3.5" />
                        What's Included
                        <ContentBadge label="Whats Included card" />
                      </p>
                      <FormField control={form.control} name="vehicleDetails.features" render={() => (
                        <FormItem>
                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mt-1">
                            {VEHICLE_FEATURES.map((item) => (
                              <FormField key={item} control={form.control} name="vehicleDetails.features" render={({ field }) => (
                                <FormItem key={item} className="flex flex-row items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(item)}
                                      onCheckedChange={(checked) => {
                                        const current = field.value || [];
                                        field.onChange(checked ? [...current, item] : current.filter(v => v !== item));
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

              </TabsContent>

              {/* ── PRICING TAB ─────────────────────────────────────────── */}
              <TabsContent value="pricing" className="space-y-6 mt-0">

                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Price Entry Currency</p>
                    <p className="text-xs text-muted-foreground">All amounts stored in VUV. Changing this converts displayed values.</p>
                  </div>
                  <AdminCurrencyPicker value={adminInputCurrency} onChange={handleInputCurrencyChange} />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Pricing Model</Label>
                  <FormField control={form.control} name="pricingType" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-2 gap-3">
                          <label htmlFor="pricing-per-person" className={`flex flex-col gap-1 rounded-lg border-2 p-4 cursor-pointer transition-colors ${field.value === 'per_person' ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-muted/50'}`}>
                            <RadioGroupItem value="per_person" id="pricing-per-person" className="sr-only" />
                            <div className="flex items-center gap-2"><User className="h-4 w-4 text-blue-500" /><span className="font-semibold text-sm">Per Person</span></div>
                            <p className="text-xs text-muted-foreground">Adult + child rates × number of guests. Standard for tours &amp; transfers.</p>
                          </label>
                          <label htmlFor="pricing-group" className={`flex flex-col gap-1 rounded-lg border-2 p-4 cursor-pointer transition-colors ${field.value === 'group' ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-muted/50'}`}>
                            <RadioGroupItem value="group" id="pricing-group" className="sr-only" />
                            <div className="flex items-center gap-2"><Package className="h-4 w-4 text-amber-500" /><span className="font-semibold text-sm">Group / Package</span></div>
                            <p className="text-xs text-muted-foreground">Flat rate for the whole booking. Ideal for vehicle hire &amp; private charters.</p>
                          </label>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {pricingType === 'per_person' && (
                  <div className="rounded-lg border border-border p-4 space-y-4 bg-blue-500/5">
                    <h4 className="font-semibold text-sm flex items-center gap-2"><User className="h-4 w-4 text-blue-500" />Per-Person Rates</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <PriceInputRow label={<>{t('admin.price')} <span className="text-xs text-muted-foreground font-normal">(adult)</span></>} icon={<User className="h-3.5 w-3.5 text-blue-500" />} fieldName="adultPriceInput" placeholder={adminInputCurrency === 'VUV' ? '3500' : '30.00'} control={form.control} inputCurrency={adminInputCurrency} />
                      <PriceInputRow label={<>{t('admin.childPrice')} <span className="text-xs text-muted-foreground font-normal">(2–12 yrs)</span></>} icon={<Users className="h-3.5 w-3.5 text-green-500" />} fieldName="childPriceInput" placeholder={adminInputCurrency === 'VUV' ? '1750' : '15.00'} control={form.control} inputCurrency={adminInputCurrency} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5 text-sm font-medium"><Baby className="h-3.5 w-3.5 text-pink-500" />Infant <span className="text-xs text-muted-foreground font-normal">(under 2)</span></Label>
                        <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-muted/50"><span className="text-sm text-muted-foreground">Always free</span><Badge variant="outline" className="ml-auto text-xs bg-green-500/10 text-green-600 border-green-500/20">FREE</Badge></div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5 text-sm font-medium"><PawPrint className="h-3.5 w-3.5 text-amber-500" />Pet</Label>
                        <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-muted/50"><span className="text-sm text-muted-foreground">Always free</span><Badge variant="outline" className="ml-auto text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">FREE</Badge></div>
                      </div>
                    </div>
                    <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 px-3 py-2 text-xs text-blue-700 dark:text-blue-400 flex items-start gap-2">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      Group discounts (7+ adults, 10% off) and peak season surcharges are applied automatically by the pricing engine at checkout.
                    </div>
                  </div>
                )}

                {pricingType === 'group' && (
                  <div className="rounded-lg border border-border p-4 space-y-4 bg-amber-500/5">
                    <h4 className="font-semibold text-sm flex items-center gap-2"><Package className="h-4 w-4 text-amber-500" />Group / Package Rate</h4>
                    <PriceInputRow label="Package Price (flat rate)" icon={<Package className="h-3.5 w-3.5 text-amber-500" />} fieldName="groupPriceInput" placeholder={adminInputCurrency === 'VUV' ? '25000' : '210.00'} hint="This flat rate covers the entire booking regardless of pax count." control={form.control} inputCurrency={adminInputCurrency} />
                    <FormField control={form.control} name="groupMaxPax" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-muted-foreground" />Included Pax <span className="text-xs text-muted-foreground font-normal">(display hint, optional)</span></FormLabel>
                        <FormControl><Input type="number" min="1" placeholder="e.g. 4 (up to 4 people)" {...field} /></FormControl>
                        <p className="text-xs text-muted-foreground">Shown to customers as "up to N people included". Does not enforce a hard limit — use Capacity for enforcement.</p>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      Group/package pricing skips per-person calculations. Group discount and seasonal surcharge rules still apply.
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── MEDIA TAB ───────────────────────────────────────────── */}
              <TabsContent value="media" className="space-y-5 mt-0">
                <FormField control={form.control} name="image" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.image')}</FormLabel>
                    <div className="space-y-3">
                      {field.value && (
                        <div className="relative">
                          <img src={field.value} alt="Preview" className="w-full h-48 object-cover rounded-md border border-border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          <div className="absolute top-2 right-2"><Badge className="bg-green-500/90 text-white text-xs">✓ Image set</Badge></div>
                        </div>
                      )}
                      <div className="space-y-2">
                        <FormControl>
                          <Input placeholder="Paste Cloudinary or image URL..." value={field.value || ''} onChange={e => field.onChange(e.target.value)} />
                        </FormControl>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex-1 border-t border-border" /><span>or upload a file</span><span className="flex-1 border-t border-border" />
                        </div>
                        <label className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-md border border-dashed transition-colors text-sm w-full justify-center ${isUploading ? 'border-border text-muted-foreground cursor-not-allowed' : 'border-border hover:bg-muted/50 hover:border-primary/50 text-muted-foreground'}`}>
                          {isUploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading to Cloudinary…</> : <><Upload className="h-4 w-4" /> Choose file to upload</>}
                          <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="hidden" />
                        </label>
                        {uploadError && (
                          <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2 text-xs text-red-700 dark:text-red-400 flex items-start gap-2">
                            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span>{uploadError}</span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">JPEG, PNG, WebP or GIF · Max 5MB · Uploaded to Cloudinary CDN</p>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={isUploading}>
                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tour ? t('common.saveChanges') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
