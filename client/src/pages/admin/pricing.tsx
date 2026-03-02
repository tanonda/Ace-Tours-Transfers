import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTours, fetchPricingVersions, createPricingVersion } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Plus, TrendingUp, Info, Star, Package, User } from "lucide-react";
import { useCurrency, CURRENCIES, formatInCurrency } from "@/lib/currency-context";
import type { CurrencyCode } from "@/lib/currency-context";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Display a VUV integer-unit amount in a given currency.
 * Replaces the old local `formatCurrency()` which incorrectly divided by 100.
 */
function displayAmount(vuvAmount: number, currency: CurrencyCode): string {
  if (!vuvAmount || vuvAmount === 0) return "—";
  return formatInCurrency(vuvAmount, currency);
}

/**
 * Parse a price input string (entered in `inputCurrency`) → VUV integer units.
 */
function parseToVUV(raw: string, inputCurrency: CurrencyCode): number {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const amount = parseFloat(cleaned);
  if (!amount || isNaN(amount)) return 0;
  const def = CURRENCIES[inputCurrency];
  // Divide by the rate to convert back to VUV
  return Math.round(amount / def.rateFromVUV);
}

type PricingType = "per_person" | "group";

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminPricing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currency: displayCurrency } = useCurrency();

  // Entry currency — admin can type in USD/AUD etc; stored as VUV
  const [entryCurrency, setEntryCurrency] = useState<CurrencyCode>("VUV");

  // Form state
  const [productId, setProductId] = useState<string>("");
  const [viewProductId, setViewProductId] = useState<string>("");
  const [effectiveFrom, setEffectiveFrom] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [pricingType, setPricingType] = useState<PricingType>("per_person");
  const [adultPrice, setAdultPrice] = useState<string>("");
  const [childPrice, setChildPrice] = useState<string>("");
  const [groupPrice, setGroupPrice] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);

  const { data: tours = [] } = useQuery({ queryKey: ["/api/tours"], queryFn: fetchTours });

  const { data: versions = [] } = useQuery({
    queryKey: ["pricingVersions", viewProductId],
    queryFn: () => fetchPricingVersions(viewProductId),
    enabled: Boolean(viewProductId),
  });

  // Auto-detect pricing type for selected product
  const selectedTour = tours.find((t: any) => t.id === productId) as any;
  const autoDetectedType: PricingType = selectedTour?.pricingType ?? "per_person";

  const handleProductChange = (id: string) => {
    setProductId(id);
    const tour = tours.find((t: any) => t.id === id) as any;
    if (tour?.pricingType) setPricingType(tour.pricingType);
  };

  const handleCreate = async () => {
    const isGroup = pricingType === "group";

    if (!productId || !effectiveFrom) {
      return toast({ title: "Missing fields", description: "Product and effective date are required.", variant: "destructive" });
    }
    if (isGroup && !groupPrice) {
      return toast({ title: "Missing group price", description: "Enter a group/package rate.", variant: "destructive" });
    }
    if (!isGroup && !adultPrice) {
      return toast({ title: "Missing adult price", description: "Adult price is required.", variant: "destructive" });
    }

    const adultPriceCents = isGroup ? 0 : parseToVUV(adultPrice, entryCurrency);
    const childPriceCents = isGroup ? 0 : parseToVUV(childPrice || "0", entryCurrency);
    const groupPriceCents = isGroup ? parseToVUV(groupPrice, entryCurrency) : 0;

    if (!isGroup && adultPriceCents <= 0) {
      return toast({ title: "Invalid price", description: "Adult price must be greater than zero.", variant: "destructive" });
    }
    if (isGroup && groupPriceCents <= 0) {
      return toast({ title: "Invalid price", description: "Group price must be greater than zero.", variant: "destructive" });
    }

    // Duplicate date check
    if (productId === viewProductId && versions.some((v: any) => v.effectiveFrom === effectiveFrom)) {
      return toast({ title: "Date conflict", description: "A pricing version already exists for this date.", variant: "destructive" });
    }

    setIsCreating(true);
    try {
      await createPricingVersion({
        productId,
        effectiveFrom,
        adultPriceCents,
        childPriceCents,
        // Pass group pricing fields — the API will store them if the column exists
        ...(isGroup && { groupPriceCents, pricingType: "group" }),
        ...(!isGroup && { pricingType: "per_person" }),
      });
      queryClient.invalidateQueries({ queryKey: ["pricingVersions"] });
      toast({ title: "Pricing version created", description: `Effective from ${effectiveFrom}.` });
      setAdultPrice("");
      setChildPrice("");
      setGroupPrice("");
      setViewProductId(productId);
    } catch {
      toast({ title: "Error", description: "Failed to create pricing version.", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];
  const activeVersion = versions
    .filter((v: any) => v.effectiveFrom <= today)
    .sort((a: any, b: any) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];

  const futureVersions = versions.filter((v: any) => v.effectiveFrom > today);

  const entryCurrencySymbol = CURRENCIES[entryCurrency]?.symbol ?? "VT";

  // Preview amounts
  const previewAdult = pricingType === "per_person" && adultPrice ? parseToVUV(adultPrice, entryCurrency) : 0;
  const previewChild = pricingType === "per_person" && childPrice ? parseToVUV(childPrice, entryCurrency) : 0;
  const previewGroup = pricingType === "group" && groupPrice ? parseToVUV(groupPrice, entryCurrency) : 0;
  const hasPreview = previewAdult > 0 || previewGroup > 0;

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#004165]">Pricing Versions</h1>
              <p className="text-muted-foreground text-sm">Schedule price changes for future dates</p>
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
          <span>
            Pricing versions let you schedule price changes in advance. The system automatically
            applies the latest version effective on or before the booking date. Changes do not
            affect existing confirmed bookings. Amounts are stored in VUV — use the entry currency
            selector to type in a more familiar currency.
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Create form ─────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> New Pricing Version
              </CardTitle>
              <CardDescription>Create a scheduled price change for a product</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Product */}
              <div className="space-y-1.5">
                <Label htmlFor="pricing-product">Product *</Label>
                <Select value={productId} onValueChange={handleProductChange}>
                  <SelectTrigger id="pricing-product">
                    <SelectValue placeholder="Select a product…" />
                  </SelectTrigger>
                  <SelectContent>
                    {tours.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title || t.id}
                        {t.pricingType === "group" && (
                          <span className="ml-2 text-xs text-muted-foreground">(group)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Effective from */}
              <div className="space-y-1.5">
                <Label htmlFor="effective-from">Effective From *</Label>
                <Input
                  id="effective-from"
                  type="date"
                  value={effectiveFrom}
                  onChange={e => setEffectiveFrom(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Price applies to bookings on or after this date</p>
              </div>

              {/* Entry currency selector */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <div>
                  <p className="text-xs font-medium">Enter prices in</p>
                  <p className="text-xs text-muted-foreground">Stored as VUV regardless</p>
                </div>
                <Select value={entryCurrency} onValueChange={v => setEntryCurrency(v as CurrencyCode)}>
                  <SelectTrigger className="h-8 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(CURRENCIES).map(c => (
                      <SelectItem key={c.code} value={c.code} className="text-xs">
                        {c.symbol} {c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Pricing type */}
              <div className="space-y-2">
                <Label>Pricing Model</Label>
                {selectedTour?.pricingType && selectedTour.pricingType !== pricingType && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    This product uses <strong>{selectedTour.pricingType === "group" ? "group/package" : "per-person"}</strong> pricing.
                    Switching here creates a version with a different model.
                  </p>
                )}
                <RadioGroup
                  value={pricingType}
                  onValueChange={v => setPricingType(v as PricingType)}
                  className="grid grid-cols-2 gap-2"
                >
                  <label
                    htmlFor="type-per-person"
                    className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                      pricingType === "per_person"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <RadioGroupItem value="per_person" id="type-per-person" className="sr-only" />
                    <User className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <span className="font-medium">Per Person</span>
                  </label>
                  <label
                    htmlFor="type-group"
                    className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                      pricingType === "group"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <RadioGroupItem value="group" id="type-group" className="sr-only" />
                    <Package className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="font-medium">Group / Package</span>
                  </label>
                </RadioGroup>
              </div>

              {/* Per-person price fields */}
              {pricingType === "per_person" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="adult-price">Adult Price *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground text-sm select-none">
                        {entryCurrencySymbol}
                      </span>
                      <Input
                        id="adult-price"
                        className="pl-8"
                        placeholder="3500"
                        value={adultPrice}
                        onChange={e => setAdultPrice(e.target.value)}
                        type="number"
                        min="0"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="child-price">Child Price</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground text-sm select-none">
                        {entryCurrencySymbol}
                      </span>
                      <Input
                        id="child-price"
                        className="pl-8"
                        placeholder="1750"
                        value={childPrice}
                        onChange={e => setChildPrice(e.target.value)}
                        type="number"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Group price field */}
              {pricingType === "group" && (
                <div className="space-y-1.5">
                  <Label htmlFor="group-price">Package / Group Rate *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground text-sm select-none">
                      {entryCurrencySymbol}
                    </span>
                    <Input
                      id="group-price"
                      className="pl-8"
                      placeholder="25000"
                      value={groupPrice}
                      onChange={e => setGroupPrice(e.target.value)}
                      type="number"
                      min="0"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Flat rate for the entire booking regardless of guest count
                  </p>
                </div>
              )}

              {/* Preview */}
              {hasPreview && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-1">
                  <div className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                    Preview (stored in VUV)
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {pricingType === "per_person" && previewAdult > 0 && (
                      <span className="text-green-800">
                        Adult: <strong>{displayAmount(previewAdult, "VUV")}</strong>
                        {entryCurrency !== "VUV" && (
                          <span className="text-green-600 ml-1 text-xs">
                            ({displayAmount(previewAdult, displayCurrency)})
                          </span>
                        )}
                      </span>
                    )}
                    {pricingType === "per_person" && previewChild > 0 && (
                      <span className="text-green-800">
                        Child: <strong>{displayAmount(previewChild, "VUV")}</strong>
                      </span>
                    )}
                    {pricingType === "group" && previewGroup > 0 && (
                      <span className="text-green-800">
                        Package: <strong>{displayAmount(previewGroup, "VUV")}</strong>
                        {entryCurrency !== "VUV" && (
                          <span className="text-green-600 ml-1 text-xs">
                            ({displayAmount(previewGroup, displayCurrency)})
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <Button
                onClick={handleCreate}
                disabled={isCreating || !productId || !effectiveFrom}
                className="w-full bg-[#004165] hover:bg-[#005580]"
              >
                {isCreating ? "Creating…" : (
                  <><TrendingUp className="h-4 w-4 mr-2" /> Create Pricing Version</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* ── View pricing versions ───────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> View Pricing History
              </CardTitle>
              <CardDescription>See all scheduled price versions for a product</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={viewProductId} onValueChange={setViewProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product to view…" />
                </SelectTrigger>
                <SelectContent>
                  {tours.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.title || t.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {viewProductId && activeVersion && (() => {
                const isGroupVersion = activeVersion.pricingType === "group" || activeVersion.groupPriceCents > 0;
                return (
                  <div className="p-3 bg-[#004165]/5 border border-[#004165]/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-4 w-4 text-[#004165]" />
                      <span className="text-xs font-bold text-[#004165] uppercase tracking-wide">
                        Current Active Price
                      </span>
                      <Badge variant="outline" className="text-xs ml-auto">
                        {isGroupVersion ? "Group" : "Per Person"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      {isGroupVersion ? (
                        <span className="font-bold text-[#004165]">
                          Package: {displayAmount(activeVersion.groupPriceCents, displayCurrency)}
                        </span>
                      ) : (
                        <>
                          <span className="font-bold text-[#004165]">
                            Adult: {displayAmount(activeVersion.adultPriceCents, displayCurrency)}
                          </span>
                          {activeVersion.childPriceCents > 0 && (
                            <span className="font-bold text-[#004165]">
                              Child: {displayAmount(activeVersion.childPriceCents, displayCurrency)}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Effective from {activeVersion.effectiveFrom}
                    </div>
                  </div>
                );
              })()}

              {futureVersions.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Upcoming</div>
                  {futureVersions.map((v: any) => {
                    const isGroupVersion = v.pricingType === "group" || v.groupPriceCents > 0;
                    return (
                      <div key={v.id} className="flex items-center justify-between p-2.5 bg-amber-50 border border-amber-100 rounded-lg text-sm">
                        <div>
                          <div className="font-medium">
                            {isGroupVersion
                              ? `${displayAmount(v.groupPriceCents, displayCurrency)} package`
                              : `${displayAmount(v.adultPriceCents, displayCurrency)} adult`}
                          </div>
                          <div className="text-xs text-muted-foreground">from {v.effectiveFrom}</div>
                        </div>
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">Scheduled</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Full version table ──────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>All Pricing Versions</CardTitle>
            {viewProductId && (
              <CardDescription>
                Showing versions for: <strong>{tours.find((t: any) => t.id === viewProductId)?.title || viewProductId}</strong>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Effective From</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Adult / Package</TableHead>
                  <TableHead>Child</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!viewProductId ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                      Select a product above to view pricing versions
                    </TableCell>
                  </TableRow>
                ) : versions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                      No pricing versions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  [...versions]
                    .sort((a: any, b: any) => b.effectiveFrom.localeCompare(a.effectiveFrom))
                    .map((v: any) => {
                      const isActive = v.id === activeVersion?.id;
                      const isFuture = v.effectiveFrom > today;
                      const isGroupVersion = v.pricingType === "group" || v.groupPriceCents > 0;
                      return (
                        <TableRow key={v.id} className={isActive ? "bg-green-50/50" : ""}>
                          <TableCell className="font-medium text-sm">
                            {tours.find((t: any) => t.id === v.productId)?.title || v.productId}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{v.effectiveFrom}</TableCell>
                          <TableCell>
                            {isGroupVersion ? (
                              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Group</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Per Person</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-bold text-sm">
                            {isGroupVersion
                              ? displayAmount(v.groupPriceCents, displayCurrency)
                              : displayAmount(v.adultPriceCents, displayCurrency)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {!isGroupVersion && v.childPriceCents > 0
                              ? displayAmount(v.childPriceCents, displayCurrency)
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {isActive ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200 text-xs font-medium">Active</Badge>
                            ) : isFuture ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">Scheduled</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">Past</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
