import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTours, fetchPricingVersions, createPricingVersion } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Plus, TrendingUp, Info, Star } from "lucide-react";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
}

export default function AdminPricing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState<string>("");
  const [viewProductId, setViewProductId] = useState<string>("");
  const [effectiveFrom, setEffectiveFrom] = useState<string>(new Date().toISOString().split('T')[0]);
  const [adultPrice, setAdultPrice] = useState<string>("");
  const [childPrice, setChildPrice] = useState<string>("");
  const [infantPrice, setInfantPrice] = useState<string>("");
  const [petPrice, setPetPrice] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);

  const { data: tours = [] } = useQuery({ queryKey: ["/api/tours"], queryFn: fetchTours });

  const { data: versions = [] } = useQuery({
    queryKey: ["pricingVersions", viewProductId],
    queryFn: () => fetchPricingVersions(viewProductId),
    enabled: Boolean(viewProductId),
  });

  const handleCreate = async () => {
    if (!productId || !effectiveFrom || !adultPrice) {
      return toast({ title: "Missing fields", description: "Product, effective date and adult price are required.", variant: "destructive" });
    }

    const adultPriceCents = Math.round(parseFloat(adultPrice) * 100);
    if (isNaN(adultPriceCents) || adultPriceCents <= 0) {
      return toast({ title: "Invalid price", description: "Adult price must be a positive number.", variant: "destructive" });
    }

    // Check for duplicate effectiveFrom on same product
    if (productId === viewProductId && versions.some((v: any) => v.effectiveFrom === effectiveFrom)) {
      return toast({ title: "Date conflict", description: "A pricing version already exists for this date.", variant: "destructive" });
    }

    setIsCreating(true);
    try {
      const childPriceCents = childPrice ? Math.round(parseFloat(childPrice) * 100) : 0;
      await createPricingVersion({ productId, effectiveFrom, adultPriceCents, childPriceCents });
      queryClient.invalidateQueries({ queryKey: ["pricingVersions"] });
      toast({ title: "Pricing version created", description: `Effective from ${effectiveFrom}.` });
      setAdultPrice("");
      setChildPrice("");
      setInfantPrice("");
      setPetPrice("");
      // Auto-show the product we just added
      setViewProductId(productId);
    } catch (err) {
      toast({ title: "Error", description: "Failed to create pricing version.", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  // Find the active (latest past) pricing version
  const today = new Date().toISOString().split('T')[0];
  const activeVersion = versions
    .filter((v: any) => v.effectiveFrom <= today)
    .sort((a: any, b: any) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];

  const futureVersions = versions.filter((v: any) => v.effectiveFrom > today);

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
          <span>Pricing versions let you schedule price changes in advance. The system automatically applies the latest version effective on or before the booking date. Changes do not affect existing confirmed bookings.</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> New Pricing Version
              </CardTitle>
              <CardDescription>Create a scheduled price change for a product</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pricing-product">Product *</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger id="pricing-product">
                    <SelectValue placeholder="Select a product…" />
                  </SelectTrigger>
                  <SelectContent>
                    {tours.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.title || t.name || t.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="adult-price">Adult Price (AUD) *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                    <Input id="adult-price" className="pl-7" placeholder="120.00" value={adultPrice} onChange={e => setAdultPrice(e.target.value)} type="number" min="0" step="0.01" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="child-price">Child Price (AUD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                    <Input id="child-price" className="pl-7" placeholder="60.00" value={childPrice} onChange={e => setChildPrice(e.target.value)} type="number" min="0" step="0.01" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="infant-price">Infant Price (AUD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                    <Input id="infant-price" className="pl-7" placeholder="0.00" value={infantPrice} onChange={e => setInfantPrice(e.target.value)} type="number" min="0" step="0.01" />
                  </div>
                  <p className="text-xs text-muted-foreground">Under 2 yrs — often free</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pet-price">Pet Price (AUD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                    <Input id="pet-price" className="pl-7" placeholder="0.00" value={petPrice} onChange={e => setPetPrice(e.target.value)} type="number" min="0" step="0.01" />
                  </div>
                  <p className="text-xs text-muted-foreground">Leave blank if not applicable</p>
                </div>
              </div>

              {adultPrice && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-1">
                  <div className="text-xs font-semibold text-green-700 uppercase tracking-wide">Preview</div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="text-green-800">Adult: <strong>{formatCurrency(Math.round(parseFloat(adultPrice || "0") * 100))}</strong></span>
                    {childPrice && <span className="text-green-800">Child: <strong>{formatCurrency(Math.round(parseFloat(childPrice) * 100))}</strong></span>}
                    {infantPrice && <span className="text-green-800">Infant: <strong>{formatCurrency(Math.round(parseFloat(infantPrice) * 100))}</strong></span>}
                    {petPrice && <span className="text-green-800">Pet: <strong>{formatCurrency(Math.round(parseFloat(petPrice) * 100))}</strong></span>}
                  </div>
                </div>
              )}

              <Button
                onClick={handleCreate}
                disabled={isCreating || !productId || !effectiveFrom || !adultPrice}
                className="w-full bg-[#004165] hover:bg-[#005580]"
              >
                {isCreating ? "Creating…" : (
                  <><TrendingUp className="h-4 w-4 mr-2" /> Create Pricing Version</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* View pricing versions */}
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
                    <SelectItem key={t.id} value={t.id}>{t.title || t.name || t.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {viewProductId && activeVersion && (
                <div className="p-3 bg-[#004165]/5 border border-[#004165]/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="h-4 w-4 text-[#004165]" />
                    <span className="text-xs font-bold text-[#004165] uppercase tracking-wide">Current Active Price</span>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="font-bold text-[#004165]">Adult: {formatCurrency(activeVersion.adultPriceCents)}</span>
                    {activeVersion.childPriceCents > 0 && (
                      <span className="font-bold text-[#004165]">Child: {formatCurrency(activeVersion.childPriceCents)}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Effective from {activeVersion.effectiveFrom}</div>
                </div>
              )}

              {futureVersions.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Upcoming</div>
                  {futureVersions.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between p-2.5 bg-amber-50 border border-amber-100 rounded-lg text-sm">
                      <div>
                        <div className="font-medium">{formatCurrency(v.adultPriceCents)} adult</div>
                        <div className="text-xs text-muted-foreground">from {v.effectiveFrom}</div>
                      </div>
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">Scheduled</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Full table */}
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
                  <TableHead>Adult</TableHead>
                  <TableHead>Child</TableHead>
                  <TableHead>Infant</TableHead>
                  <TableHead>Pet</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!viewProductId ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                      Select a product above to view pricing versions
                    </TableCell>
                  </TableRow>
                ) : versions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                      No pricing versions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  [...versions]
                    .sort((a: any, b: any) => b.effectiveFrom.localeCompare(a.effectiveFrom))
                    .map((v: any) => {
                      const isActive = v.id === activeVersion?.id;
                      const isFuture = v.effectiveFrom > today;
                      return (
                        <TableRow key={v.id} className={isActive ? "bg-green-50/50" : ""}>
                          <TableCell className="font-medium text-sm">
                            {tours.find((t: any) => t.id === v.productId)?.title || v.productId}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{v.effectiveFrom}</TableCell>
                          <TableCell className="font-bold text-sm">{formatCurrency(v.adultPriceCents)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {v.childPriceCents > 0 ? formatCurrency(v.childPriceCents) : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {v.infantPriceCents > 0 ? formatCurrency(v.infantPriceCents) : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {v.petPriceCents > 0 ? formatCurrency(v.petPriceCents) : "—"}
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
