import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTours, fetchPricingVersions, createPricingVersion } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function AdminPricing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState<string>("");
  const [effectiveFrom, setEffectiveFrom] = useState<string>(new Date().toISOString().split('T')[0]);
  const [adultPrice, setAdultPrice] = useState<string>("");
  const [childPrice, setChildPrice] = useState<string>("");

  const { data: tours = [] } = useQuery({ queryKey: ["/api/tours"], queryFn: fetchTours });

  const { data: versions = [], refetch } = useQuery({
    queryKey: ["pricingVersions", productId],
    queryFn: () => fetchPricingVersions(productId),
    enabled: Boolean(productId),
  });

  const handleCreate = async () => {
    if (!productId || !effectiveFrom || !adultPrice) return toast({ title: 'Missing', description: 'Product, date and adult price required' });

    // client-side simple conflict check: don't allow duplicate effectiveFrom
    if (versions.some((v: any) => v.effectiveFrom === effectiveFrom)) {
      return toast({ title: 'Conflict', description: 'A pricing version with this effective date already exists' });
    }

    try {
      const adultPriceCents = Math.round(parseFloat(adultPrice) * 100);
      const childPriceCents = childPrice ? Math.round(parseFloat(childPrice) * 100) : 0;

      await createPricingVersion({ productId, effectiveFrom, adultPriceCents, childPriceCents });
      queryClient.invalidateQueries({ queryKey: ["pricingVersions", productId] });
      toast({ title: 'Created', description: 'Pricing version created' });
      setAdultPrice(''); setChildPrice('');
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to create pricing version' });
      console.error(err);
    }
  };

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Pricing Versions</h1>
          <p className="text-muted-foreground">Manage pricing versions and effective dates for products</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Pricing Version</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 items-end">
              <div className="w-64">
                <label className="block text-sm mb-1">Product</label>
                <select className="w-full p-2 border rounded" value={productId} onChange={e => setProductId(e.target.value)}>
                  <option value="">-- Select Product --</option>
                  {tours.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.title || t.name || t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Effective From</label>
                <Input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-1">Adult Price</label>
                <Input placeholder="e.g. 120.00" value={adultPrice} onChange={e => setAdultPrice(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-1">Child Price (optional)</label>
                <Input placeholder="e.g. 60.00" value={childPrice} onChange={e => setChildPrice(e.target.value)} />
              </div>
              <Button onClick={handleCreate}>Create</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Existing Pricing Versions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Effective From</TableHead>
                    <TableHead>Adult Price</TableHead>
                    <TableHead>Child Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!versions || versions.length === 0) ? (
                    <TableRow><TableCell colSpan={4}>No pricing versions</TableCell></TableRow>
                  ) : (
                    versions.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell>{tours.find((t: any) => t.id === v.productId)?.title || v.productId}</TableCell>
                        <TableCell>{new Date(v.effectiveFrom).toLocaleDateString()}</TableCell>
                        <TableCell>{(v.adultPriceCents / 100).toFixed(2)}</TableCell>
                        <TableCell>{(v.childPriceCents / 100).toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
