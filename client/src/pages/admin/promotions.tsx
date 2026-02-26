import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Percent, Tag, Copy, Edit, Trash2, Calendar, Users, RefreshCw, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface Promotion {
  id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minPurchaseCents: number;
  maxUses: number;
  usedCount: number;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  applicableTo: 'all' | 'tours' | 'transfers';
}

const emptyForm: {
  code: string; description: string; discountType: 'percentage' | 'fixed'; discountValue: number;
  minPurchase: number; maxUses: number; validFrom: string; validTo: string;
  applicableTo: 'all' | 'tours' | 'transfers'; isActive: boolean;
} = {
  code: '', description: '', discountType: 'percentage', discountValue: 0,
  minPurchase: 0, maxUses: 0, validFrom: '', validTo: '', applicableTo: 'all', isActive: true
};

async function fetchPromotions(): Promise<Promotion[]> {
  const res = await fetch('/api/admin/promotions', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch promotions');
  return res.json();
}

export default function AdminPromotions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [testCode, setTestCode] = useState('');
  const [testResult, setTestResult] = useState<any>(null);

  const { data: promotions = [], isLoading, refetch } = useQuery({ queryKey: ['promotions'], queryFn: fetchPromotions });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/admin/promotions', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      toast({ title: 'Promotion created' });
      setIsCreateOpen(false);
      setFormData(emptyForm);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/admin/promotions/${id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['promotions'] }); toast({ title: 'Promotion updated' }); setEditingPromo(null); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/promotions/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['promotions'] }); toast({ title: 'Promotion deleted' }); },
    onError: () => toast({ title: 'Error', variant: 'destructive' }),
  });

  const handleSubmit = () => {
    if (!formData.code || !formData.validFrom || !formData.validTo) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' }); return;
    }
    if (editingPromo) {
      updateMutation.mutate({ id: editingPromo.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEdit = (promo: Promotion) => {
    setEditingPromo(promo);
    setFormData({
      code: promo.code, description: promo.description, discountType: promo.discountType,
      discountValue: promo.discountValue, minPurchase: Math.round(promo.minPurchaseCents / 100),
      maxUses: promo.maxUses, validFrom: promo.validFrom, validTo: promo.validTo,
      applicableTo: promo.applicableTo, isActive: promo.isActive,
    });
  };

  const testPromoCode = async () => {
    if (!testCode) return;
    const res = await fetch('/api/promotions/validate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: testCode, subtotalCents: 500000 }),
    });
    const data = await res.json();
    setTestResult(data);
  };

  const formatDiscount = (p: Promotion) =>
    p.discountType === 'percentage' ? `${p.discountValue}%` : `${(p.discountValue / 100).toLocaleString()} VT`;

  const isExpired = (p: Promotion) => new Date().toISOString().split('T')[0] > p.validTo;
  const isUpcoming = (p: Promotion) => new Date().toISOString().split('T')[0] < p.validFrom;

  const PromoForm = () => (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Code *</Label>
          <Input placeholder="e.g. WELCOME20" value={formData.code} onChange={e => setFormData(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input placeholder="e.g. Welcome discount" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Discount Type</Label>
          <Select value={formData.discountType} onValueChange={(v: any) => setFormData(p => ({ ...p, discountType: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage (%)</SelectItem>
              <SelectItem value="fixed">Fixed Amount (VT)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Discount Value * <span className="text-xs text-muted-foreground">({formData.discountType === 'percentage' ? '%' : 'VT'})</span></Label>
          <Input type="number" min="0" value={formData.discountValue} onChange={e => setFormData(p => ({ ...p, discountValue: parseFloat(e.target.value) || 0 }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Min. Purchase (VT)</Label>
          <Input type="number" min="0" placeholder="0 = no minimum" value={formData.minPurchase} onChange={e => setFormData(p => ({ ...p, minPurchase: parseFloat(e.target.value) || 0 }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Max Uses <span className="text-xs text-muted-foreground">(0 = unlimited)</span></Label>
          <Input type="number" min="0" value={formData.maxUses} onChange={e => setFormData(p => ({ ...p, maxUses: parseInt(e.target.value) || 0 }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Valid From *</Label>
          <Input type="date" value={formData.validFrom} onChange={e => setFormData(p => ({ ...p, validFrom: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Valid To *</Label>
          <Input type="date" value={formData.validTo} onChange={e => setFormData(p => ({ ...p, validTo: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Applicable To</Label>
          <Select value={formData.applicableTo} onValueChange={(v: any) => setFormData(p => ({ ...p, applicableTo: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              <SelectItem value="tours">Tours Only</SelectItem>
              <SelectItem value="transfers">Transfers Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <div className="flex items-center gap-3 pt-2">
            <Switch checked={formData.isActive} onCheckedChange={v => setFormData(p => ({ ...p, isActive: v }))} />
            <span className="text-sm text-muted-foreground">{formData.isActive ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const activeCount = promotions.filter((p: Promotion) => p.isActive && !isExpired(p)).length;
  const totalUses = promotions.reduce((s: number, p: Promotion) => s + p.usedCount, 0);

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Percent className="h-6 w-6 text-primary" /> Promotions & Discounts</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage promo codes — all codes apply at checkout automatically.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
            <Button size="sm" onClick={() => { setEditingPromo(null); setFormData(emptyForm); setIsCreateOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> New Promo Code
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Codes", value: promotions.length, color: "bg-blue-500/15 text-blue-600" },
            { label: "Active", value: activeCount, color: "bg-green-500/15 text-green-600" },
            { label: "Total Uses", value: totalUses, color: "bg-yellow-500/15 text-yellow-600" },
            { label: "Expired", value: promotions.filter((p: Promotion) => isExpired(p)).length, color: "bg-red-500/15 text-red-500" },
          ].map(s => (
            <div key={s.label} className="p-4 rounded-xl border border-border bg-card">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${s.color}`}>
                <Tag className="h-4 w-4" />
              </div>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Checkout Integration Notice */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3">
          <CheckCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">Checkout Integration Active</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Promo codes are validated at checkout via <code className="bg-muted px-1 rounded text-xs">/api/promotions/validate</code>.
              Customers enter their code during booking and the discount is automatically deducted from the total.
              Add a promo code field to the booking form in <code className="bg-muted px-1 rounded text-xs">reservations.tsx</code> to enable customer-facing entry.
            </p>
          </div>
        </div>

        {/* Promotions Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Promo Codes</CardTitle>
            <CardDescription>{promotions.length} codes total</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-10"><RefreshCw className="animate-spin h-5 w-5 text-muted-foreground" /></div>
            ) : promotions.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Percent className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No promo codes yet. Create your first one above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Applicable</TableHead>
                      <TableHead>Valid Period</TableHead>
                      <TableHead>Uses</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promotions.map((promo: Promotion) => {
                      const expired = isExpired(promo);
                      const upcoming = isUpcoming(promo);
                      const usagePct = promo.maxUses > 0 ? (promo.usedCount / promo.maxUses) * 100 : 0;
                      return (
                        <TableRow key={promo.id} className="hover:bg-muted/20">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm">{promo.code}</span>
                              <button onClick={() => { navigator.clipboard.writeText(promo.code); toast({ title: 'Copied!' }); }}
                                className="text-muted-foreground hover:text-foreground">
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {promo.description && <div className="text-xs text-muted-foreground mt-0.5">{promo.description}</div>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Percent className="h-3.5 w-3.5 text-primary" />
                              <span className="font-semibold text-sm">{formatDiscount(promo)}</span>
                            </div>
                            {promo.minPurchaseCents > 0 && (
                              <div className="text-xs text-muted-foreground">Min: {(promo.minPurchaseCents / 100).toLocaleString()} VT</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">{promo.applicableTo}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="h-3 w-3" /> {promo.validFrom}
                              </div>
                              <div className="text-muted-foreground">→ {promo.validTo}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{promo.usedCount} / {promo.maxUses || '∞'}</div>
                            {promo.maxUses > 0 && (
                              <div className="w-16 bg-muted rounded-full h-1.5 mt-1">
                                <div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.min(usagePct, 100)}%` }} />
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {!promo.isActive ? (
                              <Badge variant="outline" className="bg-gray-100 text-gray-500 text-xs">Disabled</Badge>
                            ) : expired ? (
                              <Badge variant="outline" className="bg-red-100 text-red-600 text-xs">Expired</Badge>
                            ) : upcoming ? (
                              <Badge variant="outline" className="bg-blue-100 text-blue-600 text-xs">Upcoming</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-green-100 text-green-700 text-xs">Active</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Switch checked={promo.isActive}
                                onCheckedChange={v => updateMutation.mutate({ id: promo.id, data: { isActive: v } })} />
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(promo)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
                                onClick={() => { if (confirm('Delete this promo code?')) deleteMutation.mutate(promo.id); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test a code */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Tag className="h-4 w-4" /> Test a Promo Code</CardTitle>
            <CardDescription>Validate a promo code works correctly before distributing it</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 max-w-sm">
              <Input placeholder="Enter code to test..." value={testCode} onChange={e => setTestCode(e.target.value.toUpperCase())} className="font-mono" />
              <Button variant="outline" onClick={testPromoCode}>Test</Button>
            </div>
            {testResult && (
              <div className={`mt-3 p-3 rounded-lg border text-sm flex items-center gap-2 ${testResult.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                {testResult.valid ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-500" />}
                <div>
                  <span className={`font-semibold ${testResult.valid ? 'text-green-700' : 'text-red-600'}`}>{testResult.valid ? 'Valid' : 'Invalid'}</span>
                  <span className="text-muted-foreground ml-2">{testResult.message}</span>
                  {testResult.valid && <span className="text-green-700 ml-2">→ {(testResult.discountCents / 100).toLocaleString()} VT discount on 5,000 VT order</span>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={isCreateOpen || !!editingPromo} onOpenChange={open => { if (!open) { setIsCreateOpen(false); setEditingPromo(null); setFormData(emptyForm); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPromo ? 'Edit Promo Code' : 'Create New Promo Code'}</DialogTitle>
            <DialogDescription>
              {editingPromo ? `Editing: ${editingPromo.code}` : 'Create a discount code for customers to use at checkout.'}
            </DialogDescription>
          </DialogHeader>
          <PromoForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); setEditingPromo(null); setFormData(emptyForm); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingPromo ? 'Save Changes' : 'Create Code'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
