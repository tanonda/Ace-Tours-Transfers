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
import { 
  Plus, 
  Percent, 
  Tag, 
  Copy, 
  Edit, 
  Trash2,
  Calendar,
  Users,
  DollarSign
} from "lucide-react";

interface Promotion {
  id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minPurchase: number;
  maxUses: number;
  usedCount: number;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  applicableTo: 'all' | 'tours' | 'transfers';
}

const samplePromotions: Promotion[] = [
  {
    id: '1',
    code: 'WELCOME20',
    description: 'Welcome discount for new customers',
    discountType: 'percentage',
    discountValue: 20,
    minPurchase: 100,
    maxUses: 100,
    usedCount: 45,
    validFrom: '2024-01-01',
    validTo: '2024-12-31',
    isActive: true,
    applicableTo: 'all'
  },
  {
    id: '2',
    code: 'SUMMER50',
    description: 'Summer special - $50 off tours',
    discountType: 'fixed',
    discountValue: 50,
    minPurchase: 200,
    maxUses: 50,
    usedCount: 32,
    validFrom: '2024-06-01',
    validTo: '2024-08-31',
    isActive: true,
    applicableTo: 'tours'
  },
  {
    id: '3',
    code: 'TRANSFER10',
    description: '10% off all transfer services',
    discountType: 'percentage',
    discountValue: 10,
    minPurchase: 0,
    maxUses: 200,
    usedCount: 78,
    validFrom: '2024-01-01',
    validTo: '2024-06-30',
    isActive: false,
    applicableTo: 'transfers'
  },
];

export default function AdminPromotions() {
  const { toast } = useToast();
  const [promotions, setPromotions] = useState<Promotion[]>(samplePromotions);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 0,
    minPurchase: 0,
    maxUses: 100,
    validFrom: '',
    validTo: '',
    applicableTo: 'all' as 'all' | 'tours' | 'transfers'
  });

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: `Promo code ${code} copied to clipboard` });
  };

  const handleToggleActive = (id: string) => {
    setPromotions(promos => 
      promos.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p)
    );
    toast({ title: "Status Updated", description: "Promotion status has been changed" });
  };

  const handleDelete = (id: string) => {
    setPromotions(promos => promos.filter(p => p.id !== id));
    toast({ title: "Deleted", description: "Promotion has been removed", variant: "destructive" });
  };

  const handleCreatePromo = () => {
    const newPromo: Promotion = {
      id: Date.now().toString(),
      ...formData,
      usedCount: 0,
      isActive: true
    };
    setPromotions([...promotions, newPromo]);
    setIsCreateOpen(false);
    setFormData({
      code: '',
      description: '',
      discountType: 'percentage',
      discountValue: 0,
      minPurchase: 0,
      maxUses: 100,
      validFrom: '',
      validTo: '',
      applicableTo: 'all'
    });
    toast({ title: "Created!", description: `Promo code ${formData.code} has been created` });
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, code });
  };

  const activePromos = promotions.filter(p => p.isActive).length;
  const totalRedemptions = promotions.reduce((sum, p) => sum + p.usedCount, 0);
  const avgDiscount = promotions.length > 0 
    ? promotions.reduce((sum, p) => sum + p.discountValue, 0) / promotions.length 
    : 0;

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#004165]">Promotions & Discounts</h1>
            <p className="text-muted-foreground">
              Create and manage promotional codes for your customers.
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#004165]" data-testid="button-create-promo">
                <Plus className="h-4 w-4 mr-2" /> Create Promotion
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create New Promotion</DialogTitle>
                <DialogDescription>
                  Set up a new promotional code for your customers.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Promo Code</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="SUMMER2024"
                      className="uppercase"
                      data-testid="input-promo-code"
                    />
                    <Button variant="outline" onClick={generateRandomCode} type="button">
                      Generate
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input 
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Summer special discount"
                    data-testid="input-promo-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Discount Type</Label>
                    <Select 
                      value={formData.discountType} 
                      onValueChange={(v: 'percentage' | 'fixed') => setFormData({ ...formData, discountType: v })}
                    >
                      <SelectTrigger data-testid="select-discount-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Discount Value</Label>
                    <Input 
                      type="number"
                      value={formData.discountValue}
                      onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                      data-testid="input-discount-value"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Min. Purchase ($)</Label>
                    <Input 
                      type="number"
                      value={formData.minPurchase}
                      onChange={(e) => setFormData({ ...formData, minPurchase: Number(e.target.value) })}
                      data-testid="input-min-purchase"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Uses</Label>
                    <Input 
                      type="number"
                      value={formData.maxUses}
                      onChange={(e) => setFormData({ ...formData, maxUses: Number(e.target.value) })}
                      data-testid="input-max-uses"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valid From</Label>
                    <Input 
                      type="date"
                      value={formData.validFrom}
                      onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                      data-testid="input-valid-from"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valid To</Label>
                    <Input 
                      type="date"
                      value={formData.validTo}
                      onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
                      data-testid="input-valid-to"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Applicable To</Label>
                  <Select 
                    value={formData.applicableTo} 
                    onValueChange={(v: 'all' | 'tours' | 'transfers') => setFormData({ ...formData, applicableTo: v })}
                  >
                    <SelectTrigger data-testid="select-applicable-to">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
                      <SelectItem value="tours">Tours Only</SelectItem>
                      <SelectItem value="transfers">Transfers Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreatePromo} className="bg-[#004165]" data-testid="button-save-promo">
                  Create Promotion
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-100">
                  <Tag className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Promos</p>
                  <p className="text-2xl font-bold">{activePromos}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-100">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Redemptions</p>
                  <p className="text-2xl font-bold">{totalRedemptions}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-purple-100">
                  <Percent className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg. Discount</p>
                  <p className="text-2xl font-bold">{avgDiscount.toFixed(0)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-yellow-100">
                  <DollarSign className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Promos</p>
                  <p className="text-2xl font-bold">{promotions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Promotions</CardTitle>
            <CardDescription>Manage your promotional codes and discounts</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Valid Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotions.map((promo) => (
                  <TableRow key={promo.id} data-testid={`row-promo-${promo.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                          {promo.code}
                        </code>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={() => handleCopyCode(promo.code)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{promo.description}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {promo.applicableTo === 'all' ? 'All services' : promo.applicableTo}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {promo.discountType === 'percentage' 
                          ? `${promo.discountValue}%` 
                          : `$${promo.discountValue}`
                        }
                      </span>
                      {promo.minPurchase > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Min: ${promo.minPurchase}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-[#004165] h-2 rounded-full" 
                            style={{ width: `${(promo.usedCount / promo.maxUses) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm">{promo.usedCount}/{promo.maxUses}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {new Date(promo.validFrom).toLocaleDateString()} - {new Date(promo.validTo).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={promo.isActive}
                          onCheckedChange={() => handleToggleActive(promo.id)}
                        />
                        <Badge className={promo.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                        }>
                          {promo.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            setEditingPromo(promo);
                            toast({ title: "Edit Mode", description: "Editing promotion..." });
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => handleDelete(promo.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
