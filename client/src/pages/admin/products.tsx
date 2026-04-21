import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchProducts, createProduct, updateProduct, fetchBookings } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash, Search, Map, Car, LayoutGrid, DollarSign, Users, Image as ImageIcon, Loader2, Package, EyeOff, AlertTriangle, User } from "lucide-react";
import { ProductDialog } from "@/components/admin/product-dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/product.types";
import { apiRequest } from "@/lib/queryClient";

async function deleteProductAdvanced(id: string, force = false): Promise<{
  deleted?: boolean;
  softDeleted?: boolean;
  dependents?: { tourInstances: number; bookings: number };
  message: string;
}> {
  const url = force ? `/api/products/${id}?force=true` : `/api/products/${id}`;
  const res = await apiRequest("DELETE", url);
  return res.json();
}

export default function AdminProducts() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTour, setSelectedTour] = useState<any>(null);
  const [deleteState, setDeleteState] = useState<{
    open: boolean;
    id: string | null;
    title: string;
    result?: { softDeleted?: boolean; dependents?: { tourInstances: number; bookings: number } };
  }>({ open: false, id: null, title: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "tour" | "transfer" | "vehicle">("all");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>('table');
  const [showInactive, setShowInactive] = useState(true);

  const { data: products = [], isLoading } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const { data: bookings = [] } = useQuery({ queryKey: ["admin", "bookings"], queryFn: () => fetchBookings() });

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: t("admin.tourCreated"), description: t("admin.tourCreatedDesc") });
      setIsDialogOpen(false);
    },
    onError: () => toast({ title: t("common.error"), description: t("admin.createFailed"), variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: t("admin.tourUpdated"), description: t("admin.tourUpdatedDesc") });
      setIsDialogOpen(false);
      setSelectedTour(null);
    },
    onError: () => toast({ title: t("common.error"), description: t("admin.updateFailed"), variant: "destructive" }),
  });

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (force = false) => {
    if (!deleteState.id) return;
    setIsDeleting(true);
    try {
      const result = await deleteProductAdvanced(deleteState.id, force);
      queryClient.invalidateQueries({ queryKey: ["products"] });

      if (result.softDeleted) {
        setDeleteState(prev => ({ ...prev, result }));
        toast({
          title: "Product hidden from storefront",
          description: `It has ${result.dependents?.bookings ?? 0} booking(s) and ${result.dependents?.tourInstances ?? 0} schedule entries. Use Force Delete to permanently remove.`,
          variant: "default",
        });
      } else {
        toast({ title: force ? "Product permanently deleted" : "Product deleted" });
        setDeleteState({ open: false, id: null, title: "" });
      }
    } catch (err: any) {
      toast({ title: t("common.error"), description: "Delete failed — check server logs.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const handleBulkStatusUpdate = async (isActive: boolean) => {
    if (selectedItems.length === 0) return;
    setIsBulkDeleting(true);
    try {
      for (const id of selectedItems) {
        await updateMutation.mutateAsync({ id, data: { isActive } });
      }
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSelectedItems([]);
      toast({ title: `Successfully ${isActive ? 'activated' : 'deactivated'} ${selectedItems.length} products.` });
    } catch (err: any) {
      toast({ title: t("common.error"), description: "Bulk status update failed.", variant: "destructive" });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    setIsBulkDeleting(true);

    let successCount = 0;
    let softDeletedCount = 0;

    try {
      for (const id of selectedItems) {
        const result = await deleteProductAdvanced(id, false);
        if (result.softDeleted) {
          softDeletedCount++;
        } else {
          successCount++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSelectedItems([]);

      if (softDeletedCount > 0) {
        toast({
          title: "Bulk Delete Completed",
          description: `Deleted ${successCount} products. ${softDeletedCount} products had linked data and were hidden from the storefront instead.`,
          variant: "default",
        });
      } else {
        toast({ title: "Bulk Delete Completed", description: `Successfully deleted ${successCount} products.` });
      }
    } catch (err: any) {
      toast({ title: t("common.error"), description: "Bulk delete failed — check server logs.", variant: "destructive" });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const confirmDelete = (id: string, title: string) => {
    setDeleteState({ open: true, id, title, result: undefined });
  };

  const handleSave = (data: any) => {
    if (selectedTour) {
      updateMutation.mutate({ id: selectedTour.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredTours = products.filter((tour: any) => {
    const matchesSearch = tour.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tour.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeTab === "all" || tour.category === activeTab;
    const matchesVisibility = showInactive || tour.isActive !== false;
    return matchesSearch && matchesCategory && matchesVisibility;
  });

  const tourStats = {
    totalTours: products.filter((t: any) => t.category === "tour").length,
    totalTransfers: products.filter((t: any) => t.category === "transfer").length,
    totalVehicles: products.filter((t: any) => t.category === "vehicle").length,
    totalBookings: bookings.length,
    totalRevenueCents: bookings.reduce((sum: number, b: any) => sum + (b.totalAmountCents || 0), 0),
  };

  return (
    <DashboardLayout type="admin">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Products Management</h1>
            <p className="text-sm text-muted-foreground">Manage tours, transfers, and vehicle hire listings</p>
          </div>
          <Button onClick={() => { setSelectedTour(null); setIsDialogOpen(true); }} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setSelectedItems([]); }} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all"><Package className="h-4 w-4 mr-1.5" /> All ({products.length})</TabsTrigger>
            <TabsTrigger value="tour"><Map className="h-4 w-4 mr-1.5" /> Tours ({tourStats.totalTours})</TabsTrigger>
            <TabsTrigger value="transfer"><Car className="h-4 w-4 mr-1.5" /> Transfers ({tourStats.totalTransfers})</TabsTrigger>
            <TabsTrigger value="vehicle"><LayoutGrid className="h-4 w-4 mr-1.5" /> Vehicles ({tourStats.totalVehicles})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card><CardContent className="p-4 flex items-center gap-3"><ImageIcon className="h-5 w-5 text-blue-500" /><div><p className="text-xs text-muted-foreground">Tours</p><p className="text-xl font-bold">{tourStats.totalTours}</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><Car className="h-5 w-5 text-green-500" /><div><p className="text-xs text-muted-foreground">Transfers</p><p className="text-xl font-bold">{tourStats.totalTransfers}</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><LayoutGrid className="h-5 w-5 text-orange-500" /><div><p className="text-xs text-muted-foreground">Vehicles</p><p className="text-xl font-bold">{tourStats.totalVehicles}</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><Users className="h-5 w-5 text-purple-500" /><div><p className="text-xs text-muted-foreground">Bookings</p><p className="text-xl font-bold">{tourStats.totalBookings}</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><DollarSign className="h-5 w-5 text-yellow-500" /><div><p className="text-xs text-muted-foreground">Revenue</p><p className="text-xl font-bold">{formatPrice(tourStats.totalRevenueCents)}</p></div></CardContent></Card>
        </div>

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t("common.searchPlaceholder")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-full" />
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto bg-muted/30 px-3 py-1.5 rounded-md border border-border">
              <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Show Hidden</label>
              <button
                onClick={() => setShowInactive(!showInactive)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${showInactive ? 'bg-primary' : 'bg-input'}`}
              >
                <span className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${showInactive ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            {selectedItems.length > 0 && (
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 bg-primary/5 px-2 py-1.5 rounded-lg border border-primary/20 w-full sm:w-auto">
                <span className="text-xs font-bold text-primary px-2">{selectedItems.length} Selected</span>
                <div className="flex gap-2 flex-wrap justify-center">
                  <Button variant="outline" size="sm" onClick={() => handleBulkStatusUpdate(true)} className="h-8 text-xs text-green-600 border-green-200 hover:bg-green-50">
                    <Plus className="h-3 w-3 mr-1.5" /> Activate
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleBulkStatusUpdate(false)} className="h-8 text-xs text-orange-600 border-orange-200 hover:bg-orange-50">
                    <EyeOff className="h-3 w-3 mr-1.5" /> Deactivate
                  </Button>
                  <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={handleBulkDelete} disabled={isBulkDeleting}>
                    {isBulkDeleting ? <Loader2 className="animate-spin h-3 w-3 mr-1.5" /> : <Trash className="h-3 w-3 mr-1.5" />}
                    Delete
                  </Button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-md ml-auto sm:ml-0">
              <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('list')} title="List View">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
              </Button>
              <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('grid')} title="Grid View">
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'table' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('table')} title="Detailed Table View">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18"></path></svg>
              </Button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 text-center bg-card rounded-xl border border-dashed">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-muted-foreground">{t("common.loading")}</p>
          </div>
        ) : filteredTours.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground bg-card rounded-xl border border-border border-dashed">
            <Map className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p>{t("admin.noToursFound")}</p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground font-medium border-b">
                  <tr>
                    <th className="p-4 w-10">
                      <div className={`w-5 h-5 rounded flex items-center justify-center cursor-pointer border ${selectedItems.length === filteredTours.length ? "bg-primary border-primary text-primary-foreground" : "bg-white border-gray-300"}`}
                        onClick={() => setSelectedItems(selectedItems.length === filteredTours.length ? [] : filteredTours.map((t: any) => t.id))}
                      >
                        {selectedItems.length === filteredTours.length && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                      </div>
                    </th>
                    <th className="p-4">Product</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Price / Stats</th>
                    <th className="p-4 uppercase text-[10px] tracking-wider font-bold">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y relative">
                  {filteredTours.map((tour: any) => (
                    <tr key={tour.id} className={`hover:bg-muted/50 transition-colors ${!tour.isActive ? "bg-orange-50/30" : ""}`}>
                      <td className="p-4">
                        <div className={`w-5 h-5 rounded flex items-center justify-center cursor-pointer border ${selectedItems.includes(tour.id) ? "bg-primary border-primary text-primary-foreground" : "bg-white border-gray-300"}`}
                          onClick={() => setSelectedItems(prev => prev.includes(tour.id) ? prev.filter(id => id !== tour.id) : [...prev, tour.id])}
                        >
                          {selectedItems.includes(tour.id) && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </div>
                      </td>
                      <td className="p-4 font-medium">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <img src={tour.image} className="w-12 h-12 rounded-lg object-cover border" alt="" />
                            {!tour.isActive && (
                              <div className="absolute -top-1 -right-1 bg-orange-500 rounded-full border-2 border-white p-0.5">
                                <EyeOff className="h-2.5 w-2.5 text-white" />
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="block font-semibold cursor-pointer hover:text-primary transition-colors" onClick={() => { setSelectedTour(tour); setIsDialogOpen(true); }}>{tour.title}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-tighter bg-muted px-1.5 py-0.5 rounded font-bold">ID: {tour.id.slice(0, 8)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          {tour.category === "tour" ? <Map className="h-3.5 w-3.5 text-blue-500" /> :
                            tour.category === "transfer" ? <Car className="h-3.5 w-3.5 text-green-500" /> :
                              <LayoutGrid className="h-3.5 w-3.5 text-orange-500" />}
                          <span className="capitalize text-xs font-medium">{tour.category}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground flex items-center gap-1.5">
                            {tour.pricingType === 'group'
                              ? <>{formatPrice(tour.groupPriceCents)} <Badge variant="secondary" className="text-[8px] py-0 px-1 bg-amber-500/10 text-amber-600 border-0 font-bold uppercase">Group</Badge></>
                              : formatPrice(tour.adultPriceCents)
                            }
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            {tour.pricingType === 'group'
                              ? <><Package className="h-2.5 w-2.5" /> Flat rate</>
                              : <><Users className="h-2.5 w-2.5" /> Per person</>
                            }
                            {' · '} Cap: {tour.defaultCapacity}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        {tour.isActive ?
                          <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-0 hover:bg-green-500/20 px-2 py-0.5 font-bold uppercase text-[9px]">Active</Badge> :
                          <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 border-0 hover:bg-orange-500/20 px-2 py-0.5 font-bold uppercase text-[9px]">Hidden</Badge>
                        }
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedTour(tour); setIsDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => confirmDelete(tour.id, tour.title)}><Trash className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-4"}>
            {filteredTours.map((tour: any) => (
              <div key={tour.id} className={`group relative bg-card rounded-xl border overflow-hidden hover:shadow-primary/20 transition-all ${!tour.isActive ? "border-orange-500/40 opacity-75" :
                selectedItems.includes(tour.id) ? "border-primary ring-1 ring-primary" : "border-border"
                } ${viewMode === 'list' ? 'flex flex-row items-center p-3 gap-4 h-32' : 'flex flex-col'}`}>

                <div className="absolute top-3 left-3 z-10">
                  <div className={`w-5 h-5 rounded flex items-center justify-center cursor-pointer border ${selectedItems.includes(tour.id) ? "bg-primary border-primary text-primary-foreground" : "bg-white/80 border-gray-300 backdrop-blur-sm"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedItems(prev => prev.includes(tour.id) ? prev.filter(id => id !== tour.id) : [...prev, tour.id]);
                    }}
                  >
                    {selectedItems.includes(tour.id) && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                  </div>
                </div>

                <div className={`relative ${viewMode === 'list' ? 'w-40 h-full rounded-md overflow-hidden shrink-0' : 'aspect-video w-full'}`}>
                  <img src={tour.image} alt={tour.title} className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider flex items-center gap-1">
                    {tour.category === "transfer" ? <Car className="h-3 w-3" /> : tour.category === "vehicle" ? <LayoutGrid className="h-3 w-3" /> : <Map className="h-3 w-3" />}
                    {tour.category}
                  </div>
                  {!tour.isActive && (
                    <div className="absolute bottom-2 left-2">
                      <Badge variant="secondary" className="text-[10px] bg-orange-500/90 text-white border-0 py-0.5">
                        <EyeOff className="h-3 w-3 mr-1" /> Hidden
                      </Badge>
                    </div>
                  )}
                </div>

                <div className={`p-4 flex flex-col flex-1 ${viewMode === 'list' ? 'flex-row items-center py-2 px-4 gap-6' : ''}`}>
                  <div className={`flex justify-between items-start ${viewMode === 'list' ? 'w-1/3 mb-0' : 'mb-1'}`}>
                    <h3 className="font-bold text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors cursor-pointer" onClick={() => { setSelectedTour(tour); setIsDialogOpen(true); }}>
                      {tour.title}
                    </h3>
                  </div>

                  <div className={`flex items-center gap-4 text-muted-foreground text-sm ${viewMode === 'list' ? 'w-1/4 mb-0' : 'mb-3'}`}>
                    <span className="font-bold text-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-md flex items-center gap-1.5">
                      {tour.pricingType === 'group'
                        ? <>{formatPrice(tour.groupPriceCents)} <Badge variant="secondary" className="text-[7px] py-0 px-1 bg-amber-500/10 text-amber-600 border-0 font-bold uppercase">Group</Badge></>
                        : formatPrice(tour.adultPriceCents)
                      }
                    </span>
                    <span className="flex items-center gap-1"><Map className="h-3.5 w-3.5" />{tour.duration}</span>
                  </div>

                  <div className={`flex items-center gap-2 text-xs text-muted-foreground ${viewMode === 'list' ? 'w-1/4 mb-0' : 'mb-4'}`}>
                    <Users className="h-3.5 w-3.5" />
                    <span>Capacity: <span className="font-medium text-foreground">{tour.defaultCapacity || "Not set"}</span> {tour.category === "vehicle" ? "vehicles" : "pax"}</span>
                  </div>

                  <div className={`flex gap-2 mt-auto ${viewMode === 'list' ? 'hidden' : ''}`}>
                    <Button variant="outline" size="sm" className="flex-1 bg-white hover:bg-gray-50" onClick={() => { setSelectedTour(tour); setIsDialogOpen(true); }}>
                      <Pencil className="mr-2 h-3.5 w-3.5" /> {t("common.edit")}
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20" onClick={() => confirmDelete(tour.id, tour.title)}>
                      <Trash className="mr-2 h-3.5 w-3.5" /> {t("common.delete")}
                    </Button>
                  </div>
                </div>

                {viewMode === 'list' && (
                  <div className="flex flex-col gap-2 shrink-0 ml-auto pr-2">
                    <Button variant="outline" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => { setSelectedTour(tour); setIsDialogOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive border-transparent hover:border-destructive/20" onClick={() => confirmDelete(tour.id, tour.title)}>
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ProductDialog
        tour={selectedTour}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={handleSave}
      />

      {/* Smart delete dialog */}
      <AlertDialog open={deleteState.open} onOpenChange={(o) => !o && setDeleteState({ open: false, id: null, title: "" })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {deleteState.result?.softDeleted
                ? <><AlertTriangle className="h-5 w-5 text-orange-500" /> Product has linked data</>
                : t("admin.confirmDelete")
              }
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {deleteState.result?.softDeleted ? (
                  <>
                    <p><strong>"{deleteState.title}"</strong> has been hidden from the storefront, but cannot be fully deleted because it has linked records:</p>
                    <ul className="text-sm space-y-1 pl-4 list-disc">
                      <li>{deleteState.result.dependents?.bookings ?? 0} booking(s)</li>
                      <li>{deleteState.result.dependents?.tourInstances ?? 0} schedule / availability entries</li>
                    </ul>
                    <p className="text-orange-600 dark:text-orange-400 font-medium text-sm">
                      Force Delete will permanently erase the product AND all linked bookings, payments, and schedule data. This cannot be undone.
                    </p>
                  </>
                ) : (
                  <p>Permanently delete <strong>"{deleteState.title}"</strong>? This will also remove its schedule, availability holds, and any associated data. This action cannot be undone.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteState({ open: false, id: null, title: "" })}>
              {deleteState.result?.softDeleted ? "Keep it hidden" : t("common.cancel")}
            </AlertDialogCancel>
            {deleteState.result?.softDeleted ? (
              <Button
                variant="destructive"
                onClick={() => handleDelete(true)}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                Force Delete Everything
              </Button>
            ) : (
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => handleDelete(false)}
              >
                {isDeleting ? <Loader2 className="animate-spin h-4 w-4" /> : t("common.delete")}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
