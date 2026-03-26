/**
 * client/src/components/admin/ProductTranslationEditor.tsx   ← NEW FILE
 *
 * Admin panel for managing product translations.
 * Appears as a "Translations" tab inside the existing ProductDialog,
 * or can be rendered standalone on the product edit page.
 *
 * Features:
 *  - "Auto-translate" button: calls POST /api/admin/products/:id/auto-translate
 *    to populate fr, es, zh via Google Translate.
 *  - Per-locale manual editor tabs: lets admins type/paste Bislama (bi) or
 *    override any auto-generated translation.
 *  - Saves with PUT /api/admin/products/:id/translations/:locale.
 */

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Languages, Sparkles, Save, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchProductTranslations,
  saveProductTranslation,
  autoTranslateProduct,
} from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TranslationFields {
  title?: string;
  description?: string[];  // stored as array; we edit as newline-separated text
  itineraryIntro?: string;
  pickupInstructions?: string;
  meetingPoint?: string;
  operatingHours?: string;
  cancellationPolicy?: string;
  includedItems?: string[];
  excludedItems?: string[];
  additionalInfo?: string[];
}

interface ProductTranslationEditorProps {
  productId: string;
  productTitle: string; // English title — shown as reference
}

// Locales that can be auto-translated (Google Translate supported).
const AUTO_LOCALES = [
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "zh", label: "中文" },
];

// Bislama must be entered manually.
const ALL_LOCALES = [
  ...AUTO_LOCALES,
  { code: "bi", label: "Bislama" },
];

// ─── Helper: convert array ↔ textarea text ────────────────────────────────────

function arrayToText(arr?: string[] | null): string {
  return arr?.join("\n") ?? "";
}

function textToArray(text: string): string[] {
  return text.split("\n").map((s) => s.trim()).filter(Boolean);
}

// ─── Per-locale editor ────────────────────────────────────────────────────────

function LocaleEditor({
  locale,
  localeLabel,
  productId,
  savedData,
  isAutoLocale,
}: {
  locale: string;
  localeLabel: string;
  productId: string;
  savedData?: TranslationFields;
  isAutoLocale: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [fields, setFields] = useState<TranslationFields>({});
  const [dirty, setDirty] = useState(false);

  // Populate from saved data when it loads.
  useEffect(() => {
    if (savedData) {
      setFields({
        ...savedData,
        // Keep arrays as-is; textarea conversion happens at render time.
      });
      setDirty(false);
    }
  }, [savedData]);

  const set = (key: keyof TranslationFields, value: any) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => saveProductTranslation(productId, locale, fields),
    onSuccess: () => {
      toast({ title: `${localeLabel} translation saved` });
      queryClient.invalidateQueries({ queryKey: ["product-translations", productId] });
      setDirty(false);
    },
    onError: () =>
      toast({ title: "Save failed", variant: "destructive" }),
  });

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input
          value={fields.title ?? ""}
          onChange={(e) => set("title", e.target.value)}
          placeholder={`Product title in ${localeLabel}`}
        />
      </div>

      {/* Description paragraphs */}
      <div className="space-y-1.5">
        <Label>
          Description{" "}
          <span className="text-xs text-muted-foreground">(one paragraph per line)</span>
        </Label>
        <Textarea
          rows={5}
          value={arrayToText(fields.description)}
          onChange={(e) => set("description", textToArray(e.target.value))}
          placeholder="Paragraph 1&#10;Paragraph 2&#10;..."
        />
      </div>

      {/* Included items */}
      <div className="space-y-1.5">
        <Label>
          What's Included{" "}
          <span className="text-xs text-muted-foreground">(one item per line)</span>
        </Label>
        <Textarea
          rows={4}
          value={arrayToText(fields.includedItems)}
          onChange={(e) => set("includedItems", textToArray(e.target.value))}
          placeholder="Item 1&#10;Item 2&#10;..."
        />
      </div>

      {/* Excluded items */}
      <div className="space-y-1.5">
        <Label>
          What's Excluded{" "}
          <span className="text-xs text-muted-foreground">(one item per line)</span>
        </Label>
        <Textarea
          rows={3}
          value={arrayToText(fields.excludedItems)}
          onChange={(e) => set("excludedItems", textToArray(e.target.value))}
          placeholder="Item 1&#10;Item 2&#10;..."
        />
      </div>

      {/* Meeting point */}
      <div className="space-y-1.5">
        <Label>Meeting Point</Label>
        <Input
          value={fields.meetingPoint ?? ""}
          onChange={(e) => set("meetingPoint", e.target.value)}
          placeholder={`Meeting point in ${localeLabel}`}
        />
      </div>

      {/* Pickup instructions */}
      <div className="space-y-1.5">
        <Label>Pickup Instructions</Label>
        <Textarea
          rows={3}
          value={fields.pickupInstructions ?? ""}
          onChange={(e) => set("pickupInstructions", e.target.value)}
          placeholder={`Pickup instructions in ${localeLabel}`}
        />
      </div>

      {/* Cancellation policy */}
      <div className="space-y-1.5">
        <Label>Cancellation Policy</Label>
        <Textarea
          rows={3}
          value={fields.cancellationPolicy ?? ""}
          onChange={(e) => set("cancellationPolicy", e.target.value)}
          placeholder={`Cancellation policy in ${localeLabel}`}
        />
      </div>

      {/* Additional info */}
      <div className="space-y-1.5">
        <Label>
          Additional Info{" "}
          <span className="text-xs text-muted-foreground">(one item per line)</span>
        </Label>
        <Textarea
          rows={3}
          value={arrayToText(fields.additionalInfo)}
          onChange={(e) => set("additionalInfo", textToArray(e.target.value))}
          placeholder="Info 1&#10;Info 2&#10;..."
        />
      </div>

      {/* Bislama notice */}
      {!isAutoLocale && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Bislama is not supported by auto-translate. Please enter translations manually.
        </div>
      )}

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={!dirty || saveMutation.isPending}
        className="w-full"
      >
        {saveMutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Save {localeLabel} Translation
      </Button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProductTranslationEditor({
  productId,
  productTitle,
}: ProductTranslationEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all saved translations for this product.
  const { data: savedTranslations = [], isLoading } = useQuery({
    queryKey: ["product-translations", productId],
    queryFn:  () => fetchProductTranslations(productId),
  });

  // Build a locale → fields map for easy lookup.
  const byLocale: Record<string, TranslationFields> = {};
  for (const row of savedTranslations) {
    byLocale[row.locale] = row;
  }

  // Auto-translate mutation.
  const autoTranslateMutation = useMutation({
    mutationFn: () => autoTranslateProduct(productId),
    onSuccess: (result) => {
      toast({ title: "Auto-translation complete", description: result.message });
      queryClient.invalidateQueries({ queryKey: ["product-translations", productId] });
      // Also invalidate the product cache so the listing pages see new data.
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
    },
    onError: () =>
      toast({ title: "Auto-translation failed", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            English source: <span className="font-medium text-foreground">{productTitle}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Translations for fr, es, zh can be auto-generated. Bislama must be entered manually.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => autoTranslateMutation.mutate()}
          disabled={autoTranslateMutation.isPending}
          className="shrink-0"
        >
          {autoTranslateMutation.isPending ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-3.5 w-3.5" />
          )}
          Auto-translate (fr / es / zh)
        </Button>
      </div>

      {/* Per-locale tabs */}
      <Tabs defaultValue="fr">
        <TabsList className="w-full">
          {ALL_LOCALES.map(({ code, label }) => {
            const hasSaved = !!byLocale[code]?.title;
            return (
              <TabsTrigger key={code} value={code} className="flex items-center gap-1.5">
                <Languages className="h-3.5 w-3.5" />
                {label}
                {hasSaved && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                    ✓
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {ALL_LOCALES.map(({ code, label }) => (
          <TabsContent key={code} value={code} className="mt-6">
            <LocaleEditor
              locale={code}
              localeLabel={label}
              productId={productId}
              savedData={byLocale[code]}
              isAutoLocale={code !== "bi"}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
