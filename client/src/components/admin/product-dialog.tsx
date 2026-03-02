/**
 * ProductDialog — Admin dialog for creating/editing products (tours, transfers, vehicles).
 *
 * CHANGES vs. original:
 *  - Added Tabs layout: "Details" | "Pricing" | "Media"
 *  - Pricing tab supports pricingType toggle: per_person vs. group
 *  - Per-person mode: adult + child prices with currency helper hint
 *  - Group/package mode: flat group price + optional max-pax
 *  - Currency selector on the pricing tab so admin can enter prices in their preferred unit
 *    (amounts are always saved in VUV; the currency selector is for display/entry convenience)
 *  - All price fields show a live VUV equivalent when editing in another currency
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
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useTranslation } from 'react-i18next';
import {
  Loader2, Upload, Baby, PawPrint, Users, Package,
  DollarSign, Info, User, ImageIcon, Settings,
} from 'lucide-react';
import { uploadImage } from '@/lib/api';
import { CURRENCIES, formatInCurrency, convertFromVUV } from '@/lib/currency-context';
import type { CurrencyCode } from '@/lib/currency-context';
import type { PricingType } from '@/lib/product.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const VEHICLE_FEATURES = [
  'Air Conditioning', 'Bluetooth', 'USB Charging', 'Leather Seats',
  '4WD/AWD', 'Child Seat Available', 'Rear View Camera', 'GPS Navigation',
  'Free Wi-Fi', 'Wheelchair Accessible',
];

// ─── Schema ───────────────────────────────────────────────────────────────────

const tourSchema = z.object({
  title: z.string().min(3, 'Title is required'),
  isActive: z.boolean().default(true),
  category: z.string(),
  duration: z.string().min(1, 'Duration is required'),
  minPax: z.string().optional(),
  defaultCapacity: z.number().min(1).max(10000),
  description: z.string().min(10, 'Description is required'),
  image: z.string().optional(),

  // Pricing
  pricingType: z.enum(['per_person', 'group']).default('per_person'),
  /** Raw string input — converted to VUV cents on submit */
  adultPriceInput: z.string().min(1, 'Adult price is required'),
  childPriceInput: z.string().optional(),
  groupPriceInput: z.string().optional(),
  groupMaxPax: z.string().optional(),

  vehicleDetails: z.object({
    make: z.string().min(1, 'Make is required'),
    model: z.string().min(1, 'Model is required'),
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

// ─── Price Entry Currency Helper ─────────────────────────────────────────────

/**
 * AdminCurrencyPicker — lets the admin enter prices in a familiar currency.
 * The value is stored internally as VUV; this component just changes the display unit.
 */
function AdminCurrencyPicker({
  value,
  onChange,
}: {
  value: CurrencyCode;
  onChange: (c: CurrencyCode) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as CurrencyCode)}>
      <SelectTrigger className="h-8 w-28 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.values(CURRENCIES).map((c) => (
          <SelectItem key={c.code} value={c.code} className="text-xs">
            {c.symbol} {c.code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Parse an amount string (user typed in `inputCurrency`) → VUV integer units.
 */
function parseInputToVUV(raw: string, inputCurrency: CurrencyCode): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d.]/g, '');
  const amount = parseFloat(cleaned);
  if (isNaN(amount)) return 0;
  const def = CURRENCIES[inputCurrency];
  // amount is in inputCurrency — convert to VUV by dividing by rate
  return Math.round(amount / def.rateFromVUV);
}

/**
 * Format VUV integer units as a user-editable string in `outputCurrency`.
 */
function vuvToInputString(vuvAmount: number, outputCurrency: CurrencyCode): string {
  if (!vuvAmount) return '';
  const def = CURRENCIES[outputCurrency];
  const amount = vuvAmount * def.rateFromVUV;
  return def.isWholeUnit ? Math.round(amount).toString() : amount.toFixed(2);
}

// ─── Price Input Row ─────────────────────────────────────────────────────────

function PriceInputRow({
  label,
  icon,
  fieldName,
  placeholder,
  hint,
  control,
  inputCurrency,
}: {
  label: React.ReactNode;
  icon: React.ReactNode;
  fieldName: keyof TourFormValues;
  placeholder?: string;
  hint?: string;
  control: any;
  inputCurrency: CurrencyCode;
}) {
  const def = CURRENCIES[inputCurrency];
  return (
    <FormField
      control={control}
      name={fieldName}
      render={({ field }) => {
        const vuvEquiv = parseInputToVUV(field.value as string, inputCurrency);
        const showVUVHint = inputCurrency !== 'VUV' && vuvEquiv > 0;
        return (
          <FormItem>
            <FormLabel className="flex items-center gap-1.5">
              {icon}
              {label}
            </FormLabel>
            <FormControl>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium select-none">
                  {def.symbol}
                </span>
                <Input
                  className="pl-8"
                  placeholder={placeholder}
                  {...field}
                  value={field.value as string}
                />
              </div>
            </FormControl>
            {showVUVHint && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                ≈ {formatInCurrency(vuvEquiv, 'VUV')} stored
              </p>
            )}
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export function ProductDialog({ tour, open, onOpenChange, onSave }: TourDialogProps) {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  /** Currency used when entering prices in admin — does NOT affect stored VUV values */
  const [adminInputCurrency, setAdminInputCurrency] = useState<CurrencyCode>('VUV');

  const form = useForm<TourFormValues>({
    resolver: zodResolver(tourSchema),
    defaultValues: {
      title: '', isActive: true, category: 'tour', duration: '', minPax: '',
      defaultCapacity: 20, description: '', image: '',
      pricingType: 'per_person',
      adultPriceInput: '', childPriceInput: '', groupPriceInput: '', groupMaxPax: '',
      vehicleDetails: null,
    },
  });

  // Reset form when tour changes
  useEffect(() => {
    if (tour) {
      const adultVUV = tour.adultPriceCents ?? 0;
      const childVUV = tour.childPriceCents ?? 0;
      const groupVUV = tour.groupPriceCents ?? 0;
      form.reset({
        title: tour.title,
        isActive: tour.isActive ?? true,
        category: tour.category || 'tour',
        duration: tour.duration,
        minPax: tour.minPax || '',
        defaultCapacity: tour.defaultCapacity || 20,
        description: Array.isArray(tour.description)
          ? tour.description.join('\n')
          : tour.description,
        image: tour.image || '',
        pricingType: (tour.pricingType as PricingType) || 'per_person',
        adultPriceInput: vuvToInputString(adultVUV, adminInputCurrency),
        childPriceInput: vuvToInputString(childVUV, adminInputCurrency),
        groupPriceInput: vuvToInputString(groupVUV, adminInputCurrency),
        groupMaxPax: tour.groupMaxPax?.toString() || '',
        vehicleDetails: tour.vehicleDetails || null,
      });
    } else {
      form.reset({
        title: '', isActive: true, category: 'tour', duration: '', minPax: '',
        defaultCapacity: 20, description: '', image: '',
        pricingType: 'per_person',
        adultPriceInput: '', childPriceInput: '', groupPriceInput: '', groupMaxPax: '',
        vehicleDetails: null,
      });
    }
    setActiveTab('details');
  }, [tour, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // When admin changes input currency, convert existing field values
  const handleInputCurrencyChange = (newCurrency: CurrencyCode) => {
    const fields: Array<keyof TourFormValues> = ['adultPriceInput', 'childPriceInput', 'groupPriceInput'];
    fields.forEach((f) => {
      const raw = form.getValues(f) as string;
      if (!raw) return;
      const vuvAmount = parseInputToVUV(raw, adminInputCurrency);
      form.setValue(f, vuvToInputString(vuvAmount, newCurrency));
    });
    setAdminInputCurrency(newCurrency);
  };

  const onSubmit = (values: TourFormValues) => {
    const adultPriceCents = parseInputToVUV(values.adultPriceInput, adminInputCurrency);
    const childPriceCents = parseInputToVUV(values.childPriceInput || '0', adminInputCurrency);
    const groupPriceCents = parseInputToVUV(values.groupPriceInput || '0', adminInputCurrency);

    onSave({
      ...values,
      description: values.description.split('\n').filter((l) => l.trim() !== ''),
      image: values.image || '',
      id: tour?.id,
      pricingType: values.pricingType,
      adultPriceCents,
      childPriceCents,
      groupPriceCents,
      groupMaxPax: values.groupMaxPax ? parseInt(values.groupMaxPax) : null,
      infantPriceCents: 0,
      petPriceCents: 0,
      // Maintain legacy string fields for backward compat
      price: `${adultPriceCents} VUV`,
      childPrice: `${childPriceCents} VUV`,
    });
    onOpenChange(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await uploadImage(file);
      form.setValue('image', result.url);
    } catch {
      // toast handled by parent
    } finally {
      setIsUploading(false);
    }
  };

  const category = form.watch('category');
  const pricingType = form.watch('pricingType');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {tour ? t('admin.editTour') : t('admin.addTour')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-5">
                <TabsTrigger value="details" className="flex items-center gap-1.5">
                  <Settings className="h-3.5 w-3.5" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="pricing" className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  Pricing
                </TabsTrigger>
                <TabsTrigger value="media" className="flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Media
                </TabsTrigger>
              </TabsList>

              {/* ── DETAILS TAB ─────────────────────────────────────────── */}
              <TabsContent value="details" className="space-y-5 mt-0">

                {/* Title + Visibility */}
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
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>

                {/* Category */}
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.category')}</FormLabel>
                    <Select
                      onValueChange={(v) => {
                        field.onChange(v);
                        if ((v === 'vehicle' || v === 'transfer') && !form.getValues('vehicleDetails')) {
                          form.setValue('vehicleDetails', { make: '', model: '', seats: 5, transmission: 'Automatic', features: [] });
                          // Default to group pricing for vehicles
                          if (v === 'vehicle') form.setValue('pricingType', 'group');
                        } else if (v !== 'vehicle' && v !== 'transfer') {
                          form.setValue('vehicleDetails', null);
                          form.setValue('pricingType', 'per_person');
                        }
                      }}
                      value={field.value}
                    >
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

                {/* Vehicle specs */}
                {(category === 'vehicle' || category === 'transfer') && (
                  <div className="p-4 bg-muted/50 rounded-lg space-y-4 border border-border">
                    <h4 className="font-semibold text-sm">Vehicle Specifications</h4>
                    <div className="grid grid-cols-2 gap-4">
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
                      <FormField control={form.control} name="vehicleDetails.features" render={() => (
                        <FormItem className="col-span-2">
                          <div className="mb-2"><FormLabel className="text-sm font-medium">Features</FormLabel></div>
                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
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

                {/* Duration + Min Pax + Capacity */}
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
                      <Input type="number" min="1" max="10000" placeholder="20" {...field}
                        onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Maximum {category === 'vehicle' ? 'vehicles' : 'guests'} per day. Override per date in Calendar.
                    </p>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Description */}
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.description')}</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Tour details (one per line)..." className="min-h-[100px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </TabsContent>

              {/* ── PRICING TAB ─────────────────────────────────────────── */}
              <TabsContent value="pricing" className="space-y-6 mt-0">

                {/* Currency selector for admin price entry */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Price Entry Currency</p>
                    <p className="text-xs text-muted-foreground">
                      All amounts are stored in VUV. Changing this converts displayed values.
                    </p>
                  </div>
                  <AdminCurrencyPicker
                    value={adminInputCurrency}
                    onChange={handleInputCurrencyChange}
                  />
                </div>

                {/* Pricing Type Toggle */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Pricing Model</Label>
                  <FormField
                    control={form.control}
                    name="pricingType"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RadioGroup
                            value={field.value}
                            onValueChange={field.onChange}
                            className="grid grid-cols-2 gap-3"
                          >
                            <label
                              htmlFor="pricing-per-person"
                              className={`flex flex-col gap-1 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                                field.value === 'per_person'
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border bg-background hover:bg-muted/50'
                              }`}
                            >
                              <RadioGroupItem value="per_person" id="pricing-per-person" className="sr-only" />
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-blue-500" />
                                <span className="font-semibold text-sm">Per Person</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Adult + child rates × number of guests. Standard for tours &amp; transfers.
                              </p>
                            </label>

                            <label
                              htmlFor="pricing-group"
                              className={`flex flex-col gap-1 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                                field.value === 'group'
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border bg-background hover:bg-muted/50'
                              }`}
                            >
                              <RadioGroupItem value="group" id="pricing-group" className="sr-only" />
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-amber-500" />
                                <span className="font-semibold text-sm">Group / Package</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Flat rate for the whole booking. Ideal for vehicle hire &amp; private charters.
                              </p>
                            </label>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Per-person pricing fields */}
                {pricingType === 'per_person' && (
                  <div className="rounded-lg border border-border p-4 space-y-4 bg-blue-500/5">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-500" />
                      Per-Person Rates
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <PriceInputRow
                        label={<>{t('admin.price')} <span className="text-xs text-muted-foreground font-normal">(adult)</span></>}
                        icon={<User className="h-3.5 w-3.5 text-blue-500" />}
                        fieldName="adultPriceInput"
                        placeholder={adminInputCurrency === 'VUV' ? '3500' : '30.00'}
                        control={form.control}
                        inputCurrency={adminInputCurrency}
                      />
                      <PriceInputRow
                        label={<>{t('admin.childPrice')} <span className="text-xs text-muted-foreground font-normal">(2–12 yrs)</span></>}
                        icon={<Users className="h-3.5 w-3.5 text-green-500" />}
                        fieldName="childPriceInput"
                        placeholder={adminInputCurrency === 'VUV' ? '1750' : '15.00'}
                        control={form.control}
                        inputCurrency={adminInputCurrency}
                      />
                    </div>

                    {/* Infant + Pet — always free */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5 text-sm font-medium">
                          <Baby className="h-3.5 w-3.5 text-pink-500" />
                          Infant <span className="text-xs text-muted-foreground font-normal">(under 2)</span>
                        </Label>
                        <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-muted/50">
                          <span className="text-sm text-muted-foreground">Always free</span>
                          <Badge variant="outline" className="ml-auto text-xs bg-green-500/10 text-green-600 border-green-500/20">FREE</Badge>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5 text-sm font-medium">
                          <PawPrint className="h-3.5 w-3.5 text-amber-500" />
                          Pet
                        </Label>
                        <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-muted/50">
                          <span className="text-sm text-muted-foreground">Always free</span>
                          <Badge variant="outline" className="ml-auto text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">FREE</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 px-3 py-2 text-xs text-blue-700 dark:text-blue-400 flex items-start gap-2">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      Group discounts (7+ adults, 10% off) and peak season surcharges are applied automatically by the pricing engine at checkout.
                    </div>
                  </div>
                )}

                {/* Group / package pricing fields */}
                {pricingType === 'group' && (
                  <div className="rounded-lg border border-border p-4 space-y-4 bg-amber-500/5">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Package className="h-4 w-4 text-amber-500" />
                      Group / Package Rate
                    </h4>

                    <PriceInputRow
                      label="Package Price (flat rate)"
                      icon={<Package className="h-3.5 w-3.5 text-amber-500" />}
                      fieldName="groupPriceInput"
                      placeholder={adminInputCurrency === 'VUV' ? '25000' : '210.00'}
                      hint="This flat rate covers the entire booking regardless of pax count."
                      control={form.control}
                      inputCurrency={adminInputCurrency}
                    />

                    <FormField control={form.control} name="groupMaxPax" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          Included Pax <span className="text-xs text-muted-foreground font-normal">(display hint, optional)</span>
                        </FormLabel>
                        <FormControl>
                          <Input type="number" min="1" placeholder="e.g. 4 (up to 4 people)" {...field} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Shown to customers as "up to N people included". Does not enforce a hard limit — use Capacity for enforcement.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      Group/package pricing skips per-person calculations. The group discount and seasonal surcharge rules still apply to the package price.
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
                        <img
                          src={field.value}
                          alt="Preview"
                          className="w-full h-48 object-cover rounded-md border border-border"
                        />
                      )}
                      <div className="space-y-2">
                        <FormControl>
                          <Input
                            placeholder="Paste Cloudinary or image URL..."
                            value={field.value || ''}
                            onChange={e => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex-1 border-t border-border" />
                          <span>or upload</span>
                          <span className="flex-1 border-t border-border" />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 cursor-pointer px-4 py-2 rounded-md border border-dashed border-border hover:bg-muted/50 transition-colors text-sm text-muted-foreground w-full justify-center">
                            <Upload className="h-4 w-4" />
                            {isUploading ? 'Uploading…' : 'Choose file'}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              disabled={isUploading}
                              className="hidden"
                            />
                          </label>
                          {isUploading && <Loader2 className="animate-spin h-4 w-4 shrink-0" />}
                        </div>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
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
