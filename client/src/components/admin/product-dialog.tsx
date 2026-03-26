/**
 * ProductDialog — Wide, single-page admin form for creating/editing products.
 *
 * Layout: full-width sheet with a two-column grid (content left, pricing+media right).
 * Rich text via TipTap for all descriptive fields.
 *
 * Content ↔ detail-page mapping:
 *
 * TOUR:
 *   tourOverview (HTML) → description[0] → "Overview" card
 *   inclusions   (HTML) → description[1] → "What's Included" card
 *
 * TRANSFER:
 *   transferDetail (HTML) → description[0] → "Transfer Details" card
 *   inclusions     (HTML) → description[1] → "What's Included" card
 *
 * VEHICLE:
 *   vehicleAbout (HTML) → description[0] → "About This Vehicle" card
 *   vehicleDetails.features[] → "What's Included" card (checkboxes)
 *   vehicleDetails.{make,model,seats,transmission} → "Vehicle Specs" card
 */

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useTranslation } from 'react-i18next';
import {
  Loader2, Upload, Baby, PawPrint, Users, Package, DollarSign,
  Info, User, ImageIcon, Settings, Car, MapPin, List, Bold, Italic,
  Heading1, Heading2, Link as LinkIcon, Undo, Redo, AlignLeft,
  AlignCenter, Code, Quote, Minus, ListOrdered, Search, Tag,
  Plus, Trash2, GripVertical, Clock, Shield, Phone, Mail, CheckCircle, XCircle, Navigation,
} from 'lucide-react';
import { uploadImage } from '@/lib/api';
import { CURRENCIES, formatInCurrency } from '@/lib/currency-context';
import type { CurrencyCode } from '@/lib/currency-context';
import type { PricingType } from '@/lib/product.types';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { useState, useEffect, useRef } from 'react';
import { ProductTranslationEditor } from '@/components/admin/ProductTranslationEditor';
import { ChevronDown, Languages } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const VEHICLE_FEATURES = [
  'Air Conditioning', 'Bluetooth', 'USB Charging', 'Leather Seats',
  '4WD/AWD', 'Child Seat Available', 'Rear View Camera', 'GPS Navigation',
  'Free Wi-Fi', 'Wheelchair Accessible', 'Professional Driver', 'Fuel Included',
  'Complimentary Water', 'Airport Pickup',
];

// ─── TipTap Rich Editor ───────────────────────────────────────────────────────

function ToolbarBtn({
  onClick, title, active, children,
}: { onClick: () => void; title: string; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded text-xs hover:bg-muted transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
        }`}
    >
      {children}
    </button>
  );
}

function RichEditor({
  value,
  onChange,
  placeholder = 'Start typing…',
  minHeight = '120px',
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}) {
  // Track whether the last content change came from the editor itself (user typing)
  // vs from an external value update (e.g. dialog opening with saved data).
  // This prevents the sync useEffect from overwriting what the user just typed.
  const internalChange = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline cursor-pointer' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      internalChange.current = true;
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'p-3 text-sm focus:outline-none prose prose-sm max-w-none',
        style: `min-height:${minHeight}; line-height:1.65`,
      },
    },
  });

  // Only push value into editor when the change came from outside
  // (e.g. form reset when dialog opens), never when the user is typing.
  useEffect(() => {
    if (!editor) return;
    if (internalChange.current) {
      internalChange.current = false;
      return;
    }
    // External value change — sync into editor only if content actually differs
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || '');
    }
  }, [value, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null;

  const addLink = () => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('URL', prev);
    if (url === null) return;
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/40">
        <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo className="h-3 w-3" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo className="h-3 w-3" /></ToolbarBtn>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1" active={editor.isActive('heading', { level: 1 })}><Heading1 className="h-3 w-3" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2" active={editor.isActive('heading', { level: 2 })}><Heading2 className="h-3 w-3" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setParagraph().run()} title="Paragraph" active={editor.isActive('paragraph') && !editor.isActive('heading')}><AlignLeft className="h-3 w-3" /></ToolbarBtn>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} title="Bold" active={editor.isActive('bold')}><Bold className="h-3 w-3" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic" active={editor.isActive('italic')}><Italic className="h-3 w-3" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centre" active={editor.isActive({ textAlign: 'center' })}><AlignCenter className="h-3 w-3" /></ToolbarBtn>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List" active={editor.isActive('bulletList')}><List className="h-3 w-3" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List" active={editor.isActive('orderedList')}><ListOrdered className="h-3 w-3" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote" active={editor.isActive('blockquote')}><Quote className="h-3 w-3" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider"><Minus className="h-3 w-3" /></ToolbarBtn>
        <ToolbarBtn onClick={addLink} title="Insert Link" active={editor.isActive('link')}><LinkIcon className="h-3 w-3" /></ToolbarBtn>
      </div>
      <EditorContent editor={editor} />
      <style>{`
        .ProseMirror { outline: none; }
        .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; color: hsl(var(--muted-foreground)); pointer-events: none; height: 0; }
        .ProseMirror h1 { font-size: 1.3rem; font-weight: 700; margin: 0.4rem 0; }
        .ProseMirror h2 { font-size: 1.1rem; font-weight: 600; margin: 0.3rem 0; }
        .ProseMirror blockquote { border-left: 3px solid hsl(var(--primary)); padding-left: 1rem; color: hsl(var(--muted-foreground)); margin: 0.4rem 0; font-style: italic; }
        .ProseMirror pre { background: hsl(var(--muted)); padding: 0.6rem; border-radius: 5px; font-family: monospace; font-size: 0.78rem; }
        .ProseMirror ul { list-style: disc; padding-left: 1.4rem; }
        .ProseMirror ol { list-style: decimal; padding-left: 1.4rem; }
        .ProseMirror a { color: hsl(var(--primary)); text-decoration: underline; }
        .ProseMirror hr { border: none; border-top: 1px solid hsl(var(--border)); margin: 0.6rem 0; }
      `}</style>
    </div>
  );
}

// ─── Field Label with page-badge ─────────────────────────────────────────────

function FieldLabel({ children, badge }: { children: React.ReactNode; badge: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-sm font-medium">{children}</span>
      <Badge variant="outline" className="text-[0.6rem] py-0 px-1.5 font-normal text-muted-foreground">{badge}</Badge>
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ icon, title, color = 'text-foreground' }: { icon: React.ReactNode; title: string; color?: string }) {
  return (
    <div className={`flex items-center gap-2 mb-3 ${color}`}>
      {icon}
      <span className="text-sm font-semibold">{title}</span>
    </div>
  );
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const itineraryStopSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Stop name is required'),
  duration: z.string().optional(),
  description: z.string().optional(),
  admissionIncluded: z.boolean().optional(),
});

const schema = z.object({
  title: z.string().min(3, 'Title is required'),
  isActive: z.boolean().default(true),
  category: z.string(),
  duration: z.string().min(1, 'Duration is required'),
  minPax: z.string().optional(),
  defaultCapacity: z.number().min(1).max(10000),

  // Rich-text content (HTML strings from TipTap)
  tourOverview: z.string().optional(),
  inclusions: z.string().optional(),
  transferDetail: z.string().optional(),
  vehicleAbout: z.string().optional(),

  // SEO fields
  seoTitle: z.string().optional(),
  seoDescription: z.string().max(160, 'Keep under 160 chars for best results').optional(),
  seoKeywords: z.string().optional(),
  geoTargeting: z.string().optional(),
  listingOrder: z.coerce.number().default(0),

  image: z.string().optional(),
  imageAlt: z.string().optional(),

  pricingType: z.enum(['per_person', 'group']).default('per_person'),
  adultPriceInput: z.string().min(1, 'Adult price is required'),
  childPriceInput: z.string().optional(),
  infantPriceInput: z.string().optional(),
  petPriceInput: z.string().optional(),
  groupPriceInput: z.string().optional(),
  groupMaxPax: z.string().optional(),

  vehicleDetails: z.object({
    make: z.string().optional(),
    model: z.string().optional(),
    seats: z.number().min(1).optional(),
    transmission: z.string().optional(),
    features: z.array(z.string()).optional(),
  }).nullable().optional(),

  // ── New tour detail fields ──────────────────────────────────────────────
  contactForPrice: z.boolean().default(false),
  // Itinerary stops
  itineraryStops: z.array(itineraryStopSchema).optional(),
  itineraryIntro: z.string().optional(),

  // Structured inclusions / exclusions
  includedItems: z.array(z.string()).optional(),
  excludedItems: z.array(z.string()).optional(),

  // Meeting point / pickup
  meetingPoint: z.string().optional(),
  meetingPointMapUrl: z.string().optional(),
  pickupInstructions: z.string().optional(),
  operatingHours: z.string().optional(),

  // Cancellation policy
  cancellationPolicy: z.string().optional(),
  bookingCutoffHours: z.number().optional(),

  // Additional info items
  additionalInfo: z.array(z.string()).optional(),

  // Support / contact
  supportEmail: z.string().optional(),
  supportPhone: z.string().optional(),
  productCode: z.string().optional(),
  travelerPhotos: z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseInputToVUV(raw: string, currency: CurrencyCode): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/[^\d.]/g, ''));
  if (isNaN(n)) return 0;
  return Math.round(n / CURRENCIES[currency].rateFromVUV);
}

function vuvToStr(cents: number, currency: CurrencyCode): string {
  if (!cents) return '';
  const def = CURRENCIES[currency];
  const n = cents * def.rateFromVUV;
  return def.isWholeUnit ? Math.round(n).toString() : n.toFixed(2);
}

function descToFields(desc: string | string[] | null | undefined, cat: string) {
  if (!desc) return { tourOverview: '', transferDetail: '', vehicleAbout: '', inclusions: '' };
  const lines = Array.isArray(desc) ? desc : [desc];
  if (cat === 'vehicle') return { tourOverview: '', transferDetail: '', vehicleAbout: lines[0] || '', inclusions: '' };
  if (cat === 'transfer') return { tourOverview: '', transferDetail: lines[0] || '', vehicleAbout: '', inclusions: lines[1] || '' };
  return { tourOverview: lines[0] || '', transferDetail: '', vehicleAbout: '', inclusions: lines[1] || '' };
}

function buildDescription(values: FormValues): string[] {
  const cat = values.category;
  if (cat === 'vehicle') return [values.vehicleAbout || ''].filter(Boolean);
  if (cat === 'transfer') {
    return [values.transferDetail || '', values.inclusions || ''].filter(Boolean);
  }
  return [values.tourOverview || '', values.inclusions || ''].filter(Boolean);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProductDialogProps {
  tour: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProductDialog({ tour, open, onOpenChange, onSave }: ProductDialogProps) {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [adminCurrency, setAdminCurrency] = useState<CurrencyCode>('VUV');

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '', isActive: true, category: 'tour', duration: '', minPax: '',
      defaultCapacity: 20,
      tourOverview: '', inclusions: '', transferDetail: '', vehicleAbout: '',
      seoTitle: '', seoDescription: '', seoKeywords: '', geoTargeting: '', listingOrder: 0,
      image: '', imageAlt: '', pricingType: 'per_person',
      adultPriceInput: '', childPriceInput: '', infantPriceInput: '', petPriceInput: '', groupPriceInput: '', groupMaxPax: '',
      vehicleDetails: null,
      // New fields
      itineraryStops: [], itineraryIntro: '',
      includedItems: [], excludedItems: [],
      meetingPoint: '', meetingPointMapUrl: '', pickupInstructions: '', operatingHours: '',
      cancellationPolicy: '', bookingCutoffHours: 24,
      additionalInfo: [],
      supportEmail: '', supportPhone: '', productCode: '',
      travelerPhotos: [],
      contactForPrice: false,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (tour) {
      const cat = tour.category || 'tour';
      const fields = descToFields(tour.description, cat);
      form.reset({
        title: tour.title,
        isActive: tour.isActive ?? true,
        category: cat,
        duration: tour.duration,
        minPax: tour.minPax || '',
        defaultCapacity: tour.defaultCapacity || 20,
        ...fields,
        seoTitle: tour.seoTitle || '',
        seoDescription: tour.seoDescription || '',
        seoKeywords: tour.seoKeywords || '',
        geoTargeting: tour.geoTargeting || '',
        listingOrder: tour.listingOrder || 0,
        image: tour.image || '',
        imageAlt: tour.imageAlt || '',
        pricingType: (tour.pricingType as PricingType) || 'per_person',
        adultPriceInput: vuvToStr(tour.adultPriceCents ?? 0, adminCurrency),
        childPriceInput: vuvToStr(tour.childPriceCents ?? 0, adminCurrency),
        groupPriceInput: vuvToStr(tour.groupPriceCents ?? 0, adminCurrency),
        groupMaxPax: tour.groupMaxPax?.toString() || '',
        vehicleDetails: tour.vehicleDetails || null,
        // New fields
        itineraryStops: tour.itineraryStops || [],
        itineraryIntro: tour.itineraryIntro || '',
        includedItems: tour.includedItems || [],
        excludedItems: tour.excludedItems || [],
        meetingPoint: tour.meetingPoint || '',
        meetingPointMapUrl: tour.meetingPointMapUrl || '',
        pickupInstructions: tour.pickupInstructions || '',
        operatingHours: tour.operatingHours || '',
        cancellationPolicy: tour.cancellationPolicy || '',
        bookingCutoffHours: tour.bookingCutoffHours ?? 24,
        additionalInfo: tour.additionalInfo || [],
        supportEmail: tour.supportEmail || '',
        supportPhone: tour.supportPhone || '',
        productCode: tour.productCode || '',
        travelerPhotos: tour.travelerPhotos || [],
        contactForPrice: tour.contactForPrice || false,
      });
    } else {
      form.reset({
        title: '', isActive: true, category: 'tour', duration: '', minPax: '',
        defaultCapacity: 20,
        tourOverview: '', inclusions: '', transferDetail: '', vehicleAbout: '',
        image: '', pricingType: 'per_person',
        adultPriceInput: '', childPriceInput: '', infantPriceInput: '', petPriceInput: '', groupPriceInput: '', groupMaxPax: '',
        vehicleDetails: null,
        itineraryStops: [], itineraryIntro: '',
        includedItems: [], excludedItems: [],
        meetingPoint: '', meetingPointMapUrl: '', pickupInstructions: '', operatingHours: '',
        cancellationPolicy: '', bookingCutoffHours: 24,
        additionalInfo: [],
        supportEmail: '', supportPhone: '', productCode: '',
        travelerPhotos: [],
        contactForPrice: false,
      });
    }
  }, [tour, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCurrencyChange = (c: CurrencyCode) => {
    (['adultPriceInput', 'childPriceInput', 'infantPriceInput', 'petPriceInput', 'groupPriceInput'] as const).forEach((f) => {
      const raw = form.getValues(f) as string;
      if (!raw) return;
      form.setValue(f, vuvToStr(parseInputToVUV(raw, adminCurrency), c));
    });
    setAdminCurrency(c);
  };

  const onSubmit = (values: FormValues) => {
    const adultPriceCents = parseInputToVUV(values.adultPriceInput, adminCurrency);
    const childPriceCents = parseInputToVUV(values.childPriceInput || '0', adminCurrency);
    const infantPriceCents = parseInputToVUV(values.infantPriceInput || '0', adminCurrency);
    const petPriceCents = parseInputToVUV(values.petPriceInput || '0', adminCurrency);
    const groupPriceCents = parseInputToVUV(values.groupPriceInput || '0', adminCurrency);
    onSave({
      ...values,
      description: buildDescription(values),
      image: values.image || '',
      seoTitle: values.seoTitle || null,
      seoDescription: values.seoDescription || null,
      seoKeywords: values.seoKeywords || null,
      geoTargeting: values.geoTargeting || null,
      listingOrder: values.listingOrder || 0,
      imageAlt: values.imageAlt || null,
      id: tour?.id,
      pricingType: values.pricingType,
      adultPriceCents, childPriceCents, infantPriceCents, petPriceCents, groupPriceCents,
      groupMaxPax: values.groupMaxPax ? parseInt(values.groupMaxPax) : null,
      price: `${adultPriceCents} VUV`,
      childPrice: `${childPriceCents} VUV`,
      // New fields
      itineraryStops: values.itineraryStops || [],
      itineraryIntro: values.itineraryIntro || null,
      includedItems: values.includedItems || [],
      excludedItems: values.excludedItems || [],
      meetingPoint: values.meetingPoint || null,
      meetingPointMapUrl: values.meetingPointMapUrl || null,
      pickupInstructions: values.pickupInstructions || null,
      operatingHours: values.operatingHours || null,
      cancellationPolicy: values.cancellationPolicy || null,
      bookingCutoffHours: values.bookingCutoffHours ?? 24,
      additionalInfo: values.additionalInfo || [],
      supportEmail: values.supportEmail || null,
      supportPhone: values.supportPhone || null,
      productCode: values.productCode || null,
      travelerPhotos: values.travelerPhotos || [],
      contactForPrice: values.contactForPrice || false,
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
  const imageValue = form.watch('image');

  const catLabel = category === 'vehicle' ? 'Vehicle Hire'
    : category === 'transfer' ? 'Transfer' : 'Tour';

  const currDef = CURRENCIES[adminCurrency];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Extra-wide dialog — full viewport on small screens, capped at 1100px */}
      <DialogContent className="w-[95vw] max-w-[1100px] max-h-[94vh] overflow-y-auto p-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">

            {/* ── STICKY HEADER ───────────────────────────── */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-background">
              <div>
                <DialogTitle className="text-base font-semibold">
                  {tour ? `Edit ${catLabel}` : `New ${catLabel}`}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Fill in the details below — content maps directly to the public detail page.</p>
              </div>
              <div className="flex items-center gap-2">
                <FormField control={form.control} name="isActive" render={({ field }) => (
                  <div className="flex items-center gap-2 mr-2">
                    <Switch checked={field.value} onCheckedChange={field.onChange} id="isActive" />
                    <Label htmlFor="isActive" className="text-xs cursor-pointer">
                      {field.value ? 'Live' : 'Hidden'}
                    </Label>
                  </div>
                )} />
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isUploading}>
                  {isUploading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  {tour ? 'Save Changes' : 'Create'}
                </Button>
              </div>
            </div>

            {/* ── MAIN BODY: two-column grid ───────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-0 flex-1">

              {/* ══ LEFT: Content ══════════════════════════════ */}
              <div className="p-6 border-r border-border space-y-6">

                {/* Basics row */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <FormField control={form.control} name="title" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('admin.tourTitle')}</FormLabel>
                        <FormControl><Input placeholder="Efate Scenic Tour" className="text-base" {...field} /></FormControl>
                        <FormMessage />
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
                          } else {
                            form.setValue('vehicleDetails', null);
                            form.setValue('pricingType', 'per_person');
                          }
                        }}
                        value={field.value}
                      >
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="tour">Tour</SelectItem>
                          <SelectItem value="transfer">Transfer</SelectItem>
                          <SelectItem value="vehicle">Vehicle Hire</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="duration" render={({ field }) => (
                    <FormItem><FormLabel>{t('admin.duration')}</FormLabel><FormControl><Input placeholder="8am – 3pm" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="minPax" render={({ field }) => (
                    <FormItem><FormLabel>{t('admin.minPax')}</FormLabel><FormControl><Input placeholder="Min 2 pax" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="defaultCapacity" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="10000" placeholder="20" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <Separator />

                {/* ── TOUR CONTENT ── */}
                {category === 'tour' && (
                  <div className="space-y-5">
                    <SectionHeading icon={<MapPin className="h-4 w-4 text-blue-500" />} title="Tour Page Content" color="text-blue-600 dark:text-blue-400" />

                    <div>
                      <FieldLabel badge='"Overview" card on tour page'>Overview</FieldLabel>
                      <FormField control={form.control} name="tourOverview" render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RichEditor
                              value={field.value || ''}
                              onChange={field.onChange}
                              placeholder="Describe the tour experience, highlights, and what guests can expect…"
                              minHeight="130px"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div>
                      <FieldLabel badge="Inclusions card on tour page">What's Included</FieldLabel>
                      <FormField control={form.control} name="inclusions" render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RichEditor
                              value={field.value || ''}
                              onChange={field.onChange}
                              placeholder="Use the bullet list button to add inclusions, e.g. Hotel pickup, Lunch, Local guide…"
                              minHeight="120px"
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">Tip: use the bullet list (•) button for the best display on the tour page.</p>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {/* ── Structured Inclusions / Exclusions ── */}
                    <div className="bg-muted/30 rounded-lg p-4 border border-border space-y-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                        Structured Inclusions / Exclusions
                        <Badge variant="outline" className="text-[0.6rem] py-0">What's Included card</Badge>
                      </p>
                      <FormField control={form.control} name="includedItems" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-green-500" /> Included Items</FormLabel>
                          <div className="space-y-2">
                            {(field.value || []).map((item: string, i: number) => (
                              <div key={i} className="flex gap-2">
                                <Input
                                  value={item}
                                  placeholder={`e.g. Buffet lunch`}
                                  className="text-xs flex-1"
                                  onChange={e => {
                                    const arr = [...(field.value || [])];
                                    arr[i] = e.target.value;
                                    field.onChange(arr);
                                  }}
                                />
                                <button type="button" onClick={() => field.onChange((field.value || []).filter((_: string, idx: number) => idx !== i))} className="text-muted-foreground hover:text-destructive transition-colors">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            <button type="button" onClick={() => field.onChange([...(field.value || []), ''])} className="text-xs text-primary hover:underline flex items-center gap-1">
                              <Plus className="h-3 w-3" /> Add included item
                            </button>
                          </div>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="excludedItems" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs flex items-center gap-1.5"><XCircle className="h-3 w-3 text-red-400" /> Excluded Items</FormLabel>
                          <div className="space-y-2">
                            {(field.value || []).map((item: string, i: number) => (
                              <div key={i} className="flex gap-2">
                                <Input
                                  value={item}
                                  placeholder={`e.g. Alcoholic beverages`}
                                  className="text-xs flex-1"
                                  onChange={e => {
                                    const arr = [...(field.value || [])];
                                    arr[i] = e.target.value;
                                    field.onChange(arr);
                                  }}
                                />
                                <button type="button" onClick={() => field.onChange((field.value || []).filter((_: string, idx: number) => idx !== i))} className="text-muted-foreground hover:text-destructive transition-colors">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            <button type="button" onClick={() => field.onChange([...(field.value || []), ''])} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                              <Plus className="h-3 w-3" /> Add excluded item
                            </button>
                          </div>
                        </FormItem>
                      )} />
                    </div>

                    {/* ── Meeting & Pickup ── */}
                    <div className="bg-muted/30 rounded-lg p-4 border border-border space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-amber-500" />
                        Meeting & Pickup
                        <Badge variant="outline" className="text-[0.6rem] py-0">Meeting & Pickup section</Badge>
                      </p>
                      <FormField control={form.control} name="meetingPoint" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Pickup / Meeting Point</FormLabel>
                          <FormControl><Input placeholder="e.g. Lapetasi International Wharf, Port Vila" className="text-xs" {...field} value={field.value || ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="meetingPointMapUrl" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs flex items-center gap-1"><Navigation className="h-3 w-3" /> Google Maps Link <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                          <FormControl><Input placeholder="https://maps.google.com/?q=..." className="text-xs" {...field} value={field.value || ''} /></FormControl>
                          <p className="text-[0.65rem] text-muted-foreground">Paste a Google Maps share link to enable the "Open in Maps" button on the product page.</p>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="pickupInstructions" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Pickup Instructions</FormLabel>
                          <FormControl>
                            <textarea rows={3} placeholder="e.g. Departure from your accommodation in Port Vila. Return to the Wharf Road Pier if arriving by cruise ship." className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" {...field} value={field.value || ''} />
                          </FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="operatingHours" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Operating Hours</FormLabel>
                          <FormControl><Input placeholder="e.g. 8:30 AM – 5:00 PM daily" className="text-xs" {...field} value={field.value || ''} /></FormControl>
                        </FormItem>
                      )} />
                    </div>

                    {/* ── Itinerary Stops ── */}
                    <div className="bg-muted/30 rounded-lg p-4 border border-border space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <List className="h-3.5 w-3.5 text-blue-500" />
                        Itinerary Stop Points
                        <Badge variant="outline" className="text-[0.6rem] py-0">Itinerary timeline on tour page</Badge>
                      </p>
                      <FormField control={form.control} name="itineraryIntro" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Itinerary Introduction <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                          <FormControl>
                            <textarea
                              rows={3}
                              placeholder="e.g. Start your day with pickup from your accommodation, then head out for a full day of adventure…"
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                              {...field}
                              value={field.value || ''}
                            />
                          </FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="itineraryStops" render={({ field }) => {
                        const stops = field.value || [];
                        const addStop = () => {
                          field.onChange([...stops, { id: `stop_${Date.now()}`, name: '', duration: '', description: '', admissionIncluded: false }]);
                        };
                        const removeStop = (idx: number) => field.onChange(stops.filter((_: any, i: number) => i !== idx));
                        const updateStop = (idx: number, key: string, val: any) => {
                          const next = [...stops];
                          next[idx] = { ...next[idx], [key]: val };
                          field.onChange(next);
                        };
                        return (
                          <FormItem>
                            <div className="space-y-3">
                              {stops.map((stop: any, idx: number) => (
                                <div key={stop.id || idx} className="border border-border rounded-lg overflow-hidden bg-background">
                                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
                                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab shrink-0" />
                                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[0.65rem] font-bold shrink-0">
                                      {idx + 1}
                                    </div>
                                    <Input
                                      value={stop.name}
                                      placeholder="Stop name (e.g. Blue Lagoon)"
                                      className="text-xs border-0 bg-transparent focus-visible:ring-0 px-0 flex-1"
                                      onChange={e => updateStop(idx, 'name', e.target.value)}
                                    />
                                    <button type="button" onClick={() => removeStop(idx)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                  <div className="p-3 space-y-2.5">
                                    <div className="flex gap-2">
                                      <div className="flex-1">
                                        <label className="text-[0.65rem] text-muted-foreground uppercase tracking-wide font-semibold">Duration</label>
                                        <Input
                                          value={stop.duration || ''}
                                          placeholder="e.g. 45 minutes"
                                          className="text-xs mt-0.5"
                                          onChange={e => updateStop(idx, 'duration', e.target.value)}
                                        />
                                      </div>
                                      <div className="flex items-end pb-1">
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={!!stop.admissionIncluded}
                                            onChange={e => updateStop(idx, 'admissionIncluded', e.target.checked)}
                                            className="rounded"
                                          />
                                          <span className="text-xs text-muted-foreground whitespace-nowrap">Admission included</span>
                                        </label>
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-[0.65rem] text-muted-foreground uppercase tracking-wide font-semibold">Activity Description</label>
                                      <div className="mt-0.5">
                                        <RichEditor
                                          value={stop.description || ''}
                                          onChange={val => updateStop(idx, 'description', val)}
                                          placeholder="Describe this stop — what guests will see, do, or experience…"
                                          minHeight="80px"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={addStop}
                                className="w-full py-2.5 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/30 transition-all flex items-center justify-center gap-2"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Add Stop Point
                              </button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        );
                      }} />
                    </div>

                  </div>
                )}

                {/* ── TRANSFER CONTENT ── */}
                {category === 'transfer' && (
                  <div className="space-y-5">
                    <SectionHeading icon={<Car className="h-4 w-4 text-green-600" />} title="Transfer Page Content" color="text-green-700 dark:text-green-400" />

                    <div>
                      <FieldLabel badge='"Transfer Details" card on transfer page'>Transfer Details</FieldLabel>
                      <FormField control={form.control} name="transferDetail" render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RichEditor
                              value={field.value || ''}
                              onChange={field.onChange}
                              placeholder="Describe the transfer route, pickup/drop-off points, vehicle type, and service details…"
                              minHeight="130px"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div>
                      <FieldLabel badge="Inclusions card on transfer page">What's Included</FieldLabel>
                      <FormField control={form.control} name="inclusions" render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RichEditor
                              value={field.value || ''}
                              onChange={field.onChange}
                              placeholder="Air-conditioned vehicle, Professional driver, Door-to-door service…"
                              minHeight="120px"
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">Tip: use the bullet list (•) button for the best display on the transfer page.</p>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {/* ── Structured Inclusions / Exclusions ── */}
                    <div className="bg-muted/30 rounded-lg p-4 border border-border space-y-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                        Structured Inclusions / Exclusions
                        <Badge variant="outline" className="text-[0.6rem] py-0">What's Included card</Badge>
                      </p>
                      <FormField control={form.control} name="includedItems" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-green-500" /> Included Items</FormLabel>
                          <div className="space-y-2">
                            {(field.value || []).map((item: string, i: number) => (
                              <div key={i} className="flex gap-2">
                                <Input
                                  value={item}
                                  placeholder={`e.g. Airport pickup`}
                                  className="text-xs flex-1"
                                  onChange={e => {
                                    const arr = [...(field.value || [])];
                                    arr[i] = e.target.value;
                                    field.onChange(arr);
                                  }}
                                />
                                <button type="button" onClick={() => field.onChange((field.value || []).filter((_: string, idx: number) => idx !== i))} className="text-muted-foreground hover:text-destructive transition-colors">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            <button type="button" onClick={() => field.onChange([...(field.value || []), ''])} className="text-xs text-primary hover:underline flex items-center gap-1">
                              <Plus className="h-3 w-3" /> Add included item
                            </button>
                          </div>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="excludedItems" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs flex items-center gap-1.5"><XCircle className="h-3 w-3 text-red-400" /> Excluded Items</FormLabel>
                          <div className="space-y-2">
                            {(field.value || []).map((item: string, i: number) => (
                              <div key={i} className="flex gap-2">
                                <Input
                                  value={item}
                                  placeholder={`e.g. Airport departure taxes`}
                                  className="text-xs flex-1"
                                  onChange={e => {
                                    const arr = [...(field.value || [])];
                                    arr[i] = e.target.value;
                                    field.onChange(arr);
                                  }}
                                />
                                <button type="button" onClick={() => field.onChange((field.value || []).filter((_: string, idx: number) => idx !== i))} className="text-muted-foreground hover:text-destructive transition-colors">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            <button type="button" onClick={() => field.onChange([...(field.value || []), ''])} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                              <Plus className="h-3 w-3" /> Add excluded item
                            </button>
                          </div>
                        </FormItem>
                      )} />
                    </div>

                    {/* Transfer vehicle specs */}
                    <div className="bg-muted/30 rounded-lg p-4 space-y-3 border border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vehicle Info (optional)</p>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={form.control} name="vehicleDetails.make" render={({ field }) => (
                          <FormItem><FormLabel>Make</FormLabel><FormControl><Input placeholder="Toyota" {...field} value={field.value ?? ''} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="vehicleDetails.model" render={({ field }) => (
                          <FormItem><FormLabel>Model</FormLabel><FormControl><Input placeholder="Hiace" {...field} value={field.value ?? ''} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="vehicleDetails.seats" render={({ field }) => (
                          <FormItem><FormLabel>Seats</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl></FormItem>
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
                          </FormItem>
                        )} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── VEHICLE CONTENT ── */}
                {category === 'vehicle' && (
                  <div className="space-y-5">
                    <SectionHeading icon={<Car className="h-4 w-4 text-amber-600" />} title="Vehicle Hire Page Content" color="text-amber-700 dark:text-amber-400" />

                    {/* Specs */}
                    <div className="bg-muted/30 rounded-lg p-4 space-y-3 border border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        🔧 Vehicle Specs
                        <Badge variant="outline" className="text-[0.6rem] py-0">Vehicle Specs card</Badge>
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
                        {/* Contact for Price Toggle */}
                        <FormField control={form.control} name="contactForPrice" render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 shadow-sm col-span-2 mt-2">
                            <div className="space-y-1">
                              <FormLabel className="text-amber-700 dark:text-amber-400 font-bold">Contact for Price Mode</FormLabel>
                              <p className="text-[0.7rem] text-muted-foreground">
                                Disable automated pricing & online booking. Guests will be prompted to contact you directly.
                              </p>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )} />
                      </div>
                    </div>

                    {/* About */}
                    <div>
                      <FieldLabel badge='"About This Vehicle" card on vehicle page'>About This Vehicle</FieldLabel>
                      <FormField control={form.control} name="vehicleAbout" render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RichEditor
                              value={field.value || ''}
                              onChange={field.onChange}
                              placeholder="Describe the vehicle, its features, ideal use cases, coverage area…"
                              minHeight="120px"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {/* Features */}
                    <div className="bg-muted/30 rounded-lg p-4 border border-border space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-3">
                        <List className="h-3.5 w-3.5" />
                        What's Included
                        <Badge variant="outline" className="text-[0.6rem] py-0">Inclusions card on vehicle page</Badge>
                      </p>
                      <FormField control={form.control} name="vehicleDetails.features" render={() => (
                        <FormItem>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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

                {/* ── Cancellation Policy ── */}
                <div className="bg-muted/30 rounded-lg p-4 border border-border space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-amber-500" />
                    Cancellation Policy
                    <Badge variant="outline" className="text-[0.6rem] py-0">Policy card + modal</Badge>
                  </p>
                  <FormField control={form.control} name="bookingCutoffHours" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Booking closes N hours before tour start</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input type="number" min="1" max="168" className="text-xs w-24" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 24)} value={field.value ?? 24} />
                          <span className="text-xs text-muted-foreground">hours before departure</span>
                        </div>
                      </FormControl>
                      <p className="text-[0.65rem] text-muted-foreground">This also drives the booking countdown timer on the product page.</p>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="cancellationPolicy" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Full Cancellation Policy <span className="font-normal text-muted-foreground">(HTML — shown in modal)</span></FormLabel>
                      <FormControl>
                        <RichEditor
                          value={field.value || ''}
                          onChange={field.onChange}
                          placeholder="Full cancellation policy details shown when guests click 'Show full policy'…"
                          minHeight="120px"
                        />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>

                {/* ── Additional Information ── */}
                <div className="bg-muted/30 rounded-lg p-4 border border-border space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-blue-400" />
                    Additional Information
                    <Badge variant="outline" className="text-[0.6rem] py-0">Additional Info section</Badge>
                  </p>
                  <p className="text-[0.7rem] text-muted-foreground">Guest requirements and notes not covered in Overview (e.g. accessibility, confirmation details, group size).</p>
                  <FormField control={form.control} name="additionalInfo" render={({ field }) => (
                    <FormItem>
                      <div className="space-y-2">
                        {(field.value || []).map((item: string, i: number) => (
                          <div key={i} className="flex gap-2">
                            <Input
                              value={item}
                              placeholder={`e.g. Not wheelchair accessible`}
                              className="text-xs flex-1"
                              onChange={e => {
                                const arr = [...(field.value || [])];
                                arr[i] = e.target.value;
                                field.onChange(arr);
                              }}
                            />
                            <button type="button" onClick={() => field.onChange((field.value || []).filter((_: string, idx: number) => idx !== i))} className="text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        <button type="button" onClick={() => field.onChange([...(field.value || []), ''])} className="text-xs text-primary hover:underline flex items-center gap-1">
                          <Plus className="h-3 w-3" /> Add info item
                        </button>
                      </div>
                    </FormItem>
                  )} />
                </div>

                {/* ── Support / Contact Details ── */}
                <div className="bg-muted/30 rounded-lg p-4 border border-border space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-blue-400" />
                    Support & Contact
                    <Badge variant="outline" className="text-[0.6rem] py-0">Questions card</Badge>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="supportEmail" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Support Email</FormLabel>
                        <FormControl><Input placeholder="info@acetours.vu" className="text-xs" {...field} value={field.value || ''} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="supportPhone" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> Support Phone</FormLabel>
                        <FormControl><Input placeholder="+678 711 4045" className="text-xs" {...field} value={field.value || ''} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="productCode" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Product Code <span className="font-normal text-muted-foreground">(e.g. Viator product code)</span></FormLabel>
                      <FormControl><Input placeholder="e.g. 38727P1" className="text-xs" {...field} value={field.value || ''} /></FormControl>
                    </FormItem>
                  )} />
                </div>

                {/* ── Traveler Photos ── */}
                <div className="bg-muted/30 rounded-lg p-4 border border-border space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-purple-400" />
                    Traveler Photos
                    <Badge variant="outline" className="text-[0.6rem] py-0">Gallery on detail page</Badge>
                  </p>
                  <p className="text-[0.7rem] text-muted-foreground">
                    Upload photos taken during the tour. These appear in the Traveler Photos gallery below the reviews section.
                  </p>
                  <FormField control={form.control} name="travelerPhotos" render={({ field }) => {
                    const photos: string[] = field.value || [];
                    const [uploading, setUploading] = useState(false);
                    const [photoError, setPhotoError] = useState<string | null>(null);

                    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      setUploading(true);
                      setPhotoError(null);
                      try {
                        const urls = await Promise.all(files.map(f => uploadImage(f).then(r => r.url)));
                        field.onChange([...photos, ...urls]);
                      } catch (err: any) {
                        setPhotoError(err.message || 'Upload failed');
                      } finally {
                        setUploading(false);
                        e.target.value = '';
                      }
                    };

                    return (
                      <FormItem>
                        {photos.length > 0 && (
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            {photos.map((url, i) => (
                              <div key={i} className="relative group rounded-md overflow-hidden border border-border aspect-[4/3]">
                                <img
                                  src={url}
                                  alt={`Traveler photo ${i + 1}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23333" width="100" height="100"/><text fill="%23888" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12">Error</text></svg>'; }}
                                />
                                <button
                                  type="button"
                                  onClick={() => field.onChange(photos.filter((_, j) => j !== i))}
                                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold hover:bg-red-700"
                                  title="Remove photo"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <label className={`flex items-center justify-center gap-2 cursor-pointer px-3 py-2 rounded-md border border-dashed transition-colors text-xs w-full ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/60 hover:border-primary/50 text-muted-foreground'
                          }`}>
                          {uploading
                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                            : <><Upload className="h-3.5 w-3.5" /> Upload photos (select multiple)</>
                          }
                          <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} disabled={uploading} className="hidden" />
                        </label>
                        {photoError && (
                          <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-2.5 py-2 text-xs text-red-700 dark:text-red-400 flex gap-1.5">
                            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />{photoError}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }} />
                </div>

                <FormField control={form.control} name="seoKeywords" render={({ field }) => (
                  <FormItem>
                    <FormLabel>SEO Keywords</FormLabel>
                    <FormControl>
                      <Input placeholder="vanuatu tours, efate island, port vila" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="geoTargeting" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Geo Targeting</FormLabel>
                    <FormControl>
                      <Input placeholder="Port Vila, Efate, Vanuatu" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* ══ RIGHT: Pricing + Media ══════════════════════ */}
              <div className="p-6 space-y-6 bg-muted/10">

                {/* ── IMAGE ── */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-semibold">Image</span>
                  </div>
                  <FormField control={form.control} name="image" render={({ field }) => (
                    <FormItem>
                      <div className="space-y-2">
                        {field.value && (
                          <div className="relative rounded-lg overflow-hidden border border-border">
                            <img
                              src={field.value}
                              alt="Preview"
                              className="w-full h-36 object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                            <Badge className="absolute top-2 right-2 bg-green-600/90 text-white text-[0.65rem]">✓ Set</Badge>
                          </div>
                        )}
                        <Input
                          placeholder="Paste image URL…"
                          value={field.value || ''}
                          onChange={e => field.onChange(e.target.value)}
                          className="text-xs"
                        />
                        <label className={`flex items-center justify-center gap-2 cursor-pointer px-3 py-2 rounded-md border border-dashed transition-colors text-xs w-full ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/60 hover:border-primary/50 text-muted-foreground'
                          }`}>
                          {isUploading
                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                            : <><Upload className="h-3.5 w-3.5" /> Upload image</>
                          }
                          <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="hidden" />
                        </label>
                        {uploadError && (
                          <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-2.5 py-2 text-xs text-red-700 dark:text-red-400 flex gap-1.5">
                            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />{uploadError}
                          </div>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Alt text */}
                  <FormField control={form.control} name="imageAlt" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs flex items-center gap-1.5">
                        Image Alt Text
                        <Badge variant="outline" className="text-[0.6rem] py-0 px-1.5 font-normal">accessibility + SEO</Badge>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={`e.g. "Snorkelling at Blue Lagoon, Efate Island Vanuatu"`}
                          className="text-xs"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <p className="text-[0.65rem] text-muted-foreground">
                        Describes the image for screen readers and search engines. Defaults to the product title if left blank.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* ── ADDITIONAL IMAGES (Traveler Photos) ── */}
                <div className="pt-2">
                  <div className="flex items-center gap-1.5 mb-2">
                    <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-semibold">Additional Images / Gallery</span>
                  </div>
                  <FormField control={form.control} name="travelerPhotos" render={({ field }) => {
                    const photos = field.value || [];
                    const addPhoto = () => field.onChange([...photos, '']);
                    const removePhoto = (idx: number) => field.onChange(photos.filter((_: any, i: number) => i !== idx));
                    const updatePhoto = (idx: number, val: string) => {
                      const next = [...photos];
                      next[idx] = val;
                      field.onChange(next);
                    };
                    return (
                      <FormItem>
                        <div className="space-y-3">
                          {photos.map((photo: string, idx: number) => (
                            <div key={idx} className="relative rounded-lg overflow-hidden border border-border p-3 space-y-2 bg-background">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-semibold">Gallery Image {idx + 1}</span>
                                <button type="button" onClick={() => removePhoto(idx)} className="text-muted-foreground hover:text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              {photo && (
                                <img src={photo} alt={`Gallery ${idx + 1}`} className="w-full h-24 object-cover rounded-md border border-border" />
                              )}
                              <Input
                                placeholder="Paste image URL…"
                                value={photo}
                                onChange={e => updatePhoto(idx, e.target.value)}
                                className="text-xs"
                              />
                              <label className={`flex items-center justify-center gap-2 cursor-pointer px-3 py-1.5 rounded-md border border-dashed transition-colors text-xs w-full ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/60 hover:border-primary/50 text-muted-foreground'}`}>
                                {isUploading
                                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                                  : <><Upload className="h-3.5 w-3.5" /> Upload image</>
                                }
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setIsUploading(true);
                                    setUploadError(null);
                                    try {
                                      const result = await uploadImage(file);
                                      updatePhoto(idx, result.url);
                                    } catch (err: any) {
                                      setUploadError(err.message || 'Upload failed.');
                                    } finally {
                                      setIsUploading(false);
                                    }
                                  }}
                                  disabled={isUploading}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          ))}
                          <Button type="button" variant="outline" size="sm" className="w-full text-xs border-dashed" onClick={addPhoto}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Add Gallery Image
                          </Button>
                        </div>
                      </FormItem>
                    );
                  }} />
                </div>

                <Separator />

                {/* ── SEO ── */}
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Search className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-semibold">SEO / Search Rankings</span>
                  </div>
                  <div className="space-y-3">
                    <FormField control={form.control} name="seoTitle" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Page title <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                        <FormControl>
                          <Input
                            placeholder={`e.g. ${form.watch('title') || 'Airport Transfer Vanuatu'} | Ace Tours`}
                            className="text-xs"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <p className="text-[0.65rem] text-muted-foreground">Overrides the default title tag. Leave blank to use the product title.</p>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="seoDescription" render={({ field }) => {
                      const len = (field.value || '').length;
                      const color = len === 0 ? 'text-muted-foreground' : len <= 160 ? 'text-green-600' : 'text-red-500';
                      return (
                        <FormItem>
                          <FormLabel className="flex items-center justify-between text-xs">
                            <span>Meta description <span className="font-normal text-muted-foreground">(optional)</span></span>
                            <span className={`text-[0.6rem] font-mono ${color}`}>{len}/160</span>
                          </FormLabel>
                          <FormControl>
                            <textarea
                              rows={3}
                              placeholder="A compelling 1–2 sentence summary shown in Google search results…"
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <p className="text-[0.65rem] text-muted-foreground">Aim for 120–155 characters. This appears directly under your title in Google.</p>
                          <FormMessage />
                        </FormItem>
                      );
                    }} />

                    <FormField control={form.control} name="seoKeywords" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5 text-xs">
                          <Tag className="h-3 w-3" />
                          Keywords <span className="font-normal text-muted-foreground">(optional)</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="airport transfer, Port Vila, Vanuatu taxi…"
                            className="text-xs"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <p className="text-[0.65rem] text-muted-foreground">Comma-separated. Added to the auto-generated keyword list for this page.</p>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                <Separator />

                {/* ── PRICING ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-semibold">Pricing</span>
                    </div>
                    {/* Currency picker */}
                    <Select value={adminCurrency} onValueChange={(v) => handleCurrencyChange(v as CurrencyCode)}>
                      <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.values(CURRENCIES).map(c => (
                          <SelectItem key={c.code} value={c.code} className="text-xs">{c.symbol} {c.code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Pricing model toggle */}
                  <FormField control={form.control} name="pricingType" render={({ field }) => (
                    <FormItem className="mb-4">
                      <FormControl>
                        <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-2 gap-2">
                          <label htmlFor="pp" className={`flex flex-col gap-0.5 rounded-lg border-2 p-3 cursor-pointer transition-colors ${field.value === 'per_person' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                            <RadioGroupItem value="per_person" id="pp" className="sr-only" />
                            <div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-blue-500" /><span className="text-xs font-semibold">Per Person</span></div>
                            <p className="text-[0.65rem] text-muted-foreground">Adult/child rates</p>
                          </label>
                          <label htmlFor="grp" className={`flex flex-col gap-0.5 rounded-lg border-2 p-3 cursor-pointer transition-colors ${field.value === 'group' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                            <RadioGroupItem value="group" id="grp" className="sr-only" />
                            <div className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-amber-500" /><span className="text-xs font-semibold">Group / Flat</span></div>
                            <p className="text-[0.65rem] text-muted-foreground">One price for booking</p>
                          </label>
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )} />

                  {pricingType === 'per_person' && (
                    <div className="space-y-3">
                      {/* Adult price */}
                      <FormField control={form.control} name="adultPriceInput" render={({ field }) => {
                        const vuv = parseInputToVUV(field.value as string, adminCurrency);
                        return (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5 text-xs"><User className="h-3 w-3 text-blue-500" />Adult price</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currDef.symbol}</span>
                                <Input className="pl-7 text-sm" placeholder="3500" {...field} value={field.value as string} />
                              </div>
                            </FormControl>
                            {adminCurrency !== 'VUV' && vuv > 0 && <p className="text-[0.65rem] text-muted-foreground">≈ {formatInCurrency(vuv, 'VUV')} stored</p>}
                            <FormMessage />
                          </FormItem>
                        );
                      }} />
                      {/* Child price */}
                      <FormField control={form.control} name="childPriceInput" render={({ field }) => {
                        const vuv = parseInputToVUV(field.value as string, adminCurrency);
                        return (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5 text-xs"><Users className="h-3 w-3 text-green-500" />Child price <span className="font-normal text-muted-foreground">(2–12 yrs)</span></FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currDef.symbol}</span>
                                <Input className="pl-7 text-sm" placeholder="1750" {...field} value={field.value as string} />
                              </div>
                            </FormControl>
                            {adminCurrency !== 'VUV' && vuv > 0 && <p className="text-[0.65rem] text-muted-foreground">≈ {formatInCurrency(vuv, 'VUV')} stored</p>}
                            <FormMessage />
                          </FormItem>
                        );
                      }} />
                      {/* Infant price */}
                      <FormField control={form.control} name="infantPriceInput" render={({ field }) => {
                        const vuv = parseInputToVUV(field.value as string, adminCurrency);
                        return (
                          <FormItem>
                            <FormLabel className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5"><Baby className="h-3 w-3 text-pink-400" />Infant price <span className="font-normal text-muted-foreground">(0–2 yrs)</span></span>
                              <Badge variant="outline" className="text-[0.6rem] bg-green-500/10 text-green-600 border-green-500/20">Usually FREE</Badge>
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currDef.symbol}</span>
                                <Input className="pl-7 text-sm" placeholder="0" {...field} value={field.value as string} />
                              </div>
                            </FormControl>
                            {adminCurrency !== 'VUV' && vuv > 0 && <p className="text-[0.65rem] text-muted-foreground">≈ {formatInCurrency(vuv, 'VUV')} stored</p>}
                            <FormMessage />
                          </FormItem>
                        );
                      }} />
                      {/* Pet price */}
                      <FormField control={form.control} name="petPriceInput" render={({ field }) => {
                        const vuv = parseInputToVUV(field.value as string, adminCurrency);
                        return (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5 text-xs"><PawPrint className="h-3 w-3 text-amber-500" />Pet price</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currDef.symbol}</span>
                                <Input className="pl-7 text-sm" placeholder="0" {...field} value={field.value as string} />
                              </div>
                            </FormControl>
                            {adminCurrency !== 'VUV' && vuv > 0 && <p className="text-[0.65rem] text-muted-foreground">≈ {formatInCurrency(vuv, 'VUV')} stored</p>}
                            <FormMessage />
                          </FormItem>
                        );
                      }} />
                      <p className="text-[0.65rem] text-muted-foreground flex gap-1">
                        <Info className="h-3 w-3 shrink-0 mt-0.5" />
                        7+ adults get 10% group discount automatically at checkout.
                      </p>
                    </div>
                  )}

                  {pricingType === 'group' && (
                    <div className="space-y-3">
                      <FormField control={form.control} name="groupPriceInput" render={({ field }) => {
                        const vuv = parseInputToVUV(field.value as string, adminCurrency);
                        return (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5 text-xs"><Package className="h-3 w-3 text-amber-500" />Package price (flat rate)</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currDef.symbol}</span>
                                <Input className="pl-7 text-sm" placeholder="25000" {...field} value={field.value as string} />
                              </div>
                            </FormControl>
                            {adminCurrency !== 'VUV' && vuv > 0 && <p className="text-[0.65rem] text-muted-foreground">≈ {formatInCurrency(vuv, 'VUV')} stored</p>}
                            <p className="text-[0.65rem] text-muted-foreground">Flat rate regardless of pax count.</p>
                            <FormMessage />
                          </FormItem>
                        );
                      }} />
                      <FormField control={form.control} name="groupMaxPax" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Included pax <span className="font-normal text-muted-foreground">(display hint)</span></FormLabel>
                          <FormControl><Input type="number" min="1" placeholder="4" {...field} className="text-sm" /></FormControl>
                          <p className="text-[0.65rem] text-muted-foreground">Shown as "up to N people". Soft limit only.</p>
                        </FormItem>
                      )} />
                    </div>
                  )}
                </div>


              {/* ── TRANSLATIONS ──────────────────────────────────────────── */}
              {tour?.id && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowTranslations((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Languages className="h-4 w-4 text-muted-foreground" />
                      <span>Translations</span>
                      <span className="text-xs font-normal text-muted-foreground">(fr, es, zh, bi)</span>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${showTranslations ? "rotate-180" : ""}`}
                    />
                  </button>
                  {showTranslations && (
                    <div className="border-t border-border p-5">
                      <ProductTranslationEditor
                        productId={tour.id}
                        productTitle={tour.title}
                      />
                    </div>
                  )}
                </div>
              )}

              </div>
            </div>

          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
