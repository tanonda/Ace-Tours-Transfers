
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTours, createTour, updateTour, fetchBookings } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash, Search, Map, Car, LayoutGrid, DollarSign, Users, Image as ImageIcon, Loader2, Package, EyeOff, AlertTriangle } from "lucide-react";
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

async function deleteTourAdvanced(id: string, force = false): Promise<{
  deleted?: boolean;
  softDeleted?: boolean;
  dependents?: { tourInstances: number; bookings: number };
  message: string;
}> {
  const url = force ? `/api/tours/${id}?force=true` : `/api/tours/${id}`;
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

  const { data: tours = [], isLoading } = useQuery({ queryKey: ["tours"], queryFn: fetchTours });
  const { data: bookings = [] } = useQuery({ queryKey: ["admin", "bookings"], queryFn: fetchBookings });

  const createMutation = useMutation({
    mutationFn: createTour,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      toast({ title: t("admin.tourCreated"), description: t("admin.tourCreatedDesc") });
      setIsDialogOpen(false);
    },
    onError: () => toast({ title: t("common.error"), description: t("admin.createFailed"), variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateTour(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tours"] });
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
      const result = await deleteTourAdvanced(deleteState.id, force);
      queryClient.invalidateQueries({ queryKey: ["tours"] });

      if (result.softDeleted) {
        // Show the "has dependents" info — offer force delete
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

  const filteredTours = tours.filter((tour: any) => {
    const matchesSearch = tour.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tour.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeTab === "all" || tour.category === activeTab;
    return matchesSearch && matchesCategory;
  });

  const tourStats = {
    totalTours: tours.filter((t: any) => t.category === "tour").length,
    totalTransfers: tours.filter((t: any) => t.category === "transfer").length,
    totalVehicles: tours.filter((t: any) => t.category === "vehicle").length,
    totalBookings: bookings.length,
    totalRevenueCents: bookings.reduce((sum: number, b: any) => sum + (b.totalAmountCents || 0), 0),
  };

  return (
    <DashboardLayout type="admin">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Products Management</h1>
            <p className="text-sm text-muted-foreground">Manage tours, transfers, and vehicle hire listings</p>
          </div>
          <Button onClick={() => { setSelectedTour(null); setIsDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all"><Package className="h-4 w-4 mr-1.5" /> All ({tours.length})</TabsTrigger>
            <TabsTrigger value="tour"><Map className="h-4 w-4 mr-1.5" /> Tours ({tourStats.totalTours})</TabsTrigger>
            <TabsTrigger value="transfer"><Car className="h-4 w-4 mr-1.5" /> Transfers ({tourStats.totalTransfers})</TabsTrigger>
            <TabsTrigger value="vehicle"><LayoutGrid className="h-4 w-4 mr-1.5" /> Vehicles ({tourStats.totalVehicles})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card><CardContent className="p-4 flex items-center gap-3"><ImageIcon className="h-5 w-5 text-blue-500" /><div><p className="text-xs text-muted-foreground">Tours</p><p className="text-xl font-bold">{tourStats.totalTours}</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><Car className="h-5 w-5 text-green-500" /><div><p className="text-xs text-muted-foreground">Transfers</p><p className="text-xl font-bold">{tourStats.totalTransfers}</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><LayoutGrid className="h-5 w-5 text-orange-500" /><div><p className="text-xs text-muted-foreground">Vehicles</p><p className="text-xl font-bold">{tourStats.totalVehicles}</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><Users className="h-5 w-5 text-purple-500" /><div><p className="text-xs text-muted-foreground">Bookings</p><p className="text-xl font-bold">{tourStats.totalBookings}</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><DollarSign className="h-5 w-5 text-yellow-500" /><div><p className="text-xs text-muted-foreground">Revenue</p><p className="text-xl font-bold">{formatPrice(tourStats.totalRevenueCents)}</p></div></CardContent></Card>
        </div>

        <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("common.searchPlaceholder")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-full py-10 text-center">{t("common.loading")}</div>
          ) : filteredTours.length > 0 ? (
            filteredTours.map((tour: any) => (
              <div key={tour.id} className={`group relative bg-card rounded-xl border overflow-hidden hover:shadow-lg transition-shadow ${!tour.isActive ? "border-orange-500/40 opacity-75" : "border-border"}`}>
                <div className="aspect-video relative">
                  <img src={tour.image} alt={tour.title} className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded text-xs font-medium uppercase tracking-wider flex items-center gap-1">
                    {tour.category === "transfer" ? <Car className="h-3 w-3" /> : tour.category === "vehicle" ? <LayoutGrid className="h-3 w-3" /> : <Map className="h-3 w-3" />}
                    {tour.category}
                  </div>
                  {!tour.isActive && (
                    <div className="absolute top-2 left-2">
                      <Badge variant="secondary" className="text-xs bg-orange-500/90 text-white border-0">
                        <EyeOff className="h-3 w-3 mr-1" /> Hidden
                      </Badge>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-1 line-clamp-1">{tour.title}</h3>
                  <div className="flex items-center justify-between text-muted-foreground text-sm mb-2">
                    <span className="font-bold text-foreground">{formatPrice(tour.adultPriceCents)}</span>
                    <span>{tour.duration}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                    <Users className="h-3 w-3" />
                    <span>Capacity: <span className="font-semibold text-foreground">{tour.defaultCapacity || "Not set"}</span> {tour.category === "vehicle" ? "vehicles" : "pax"}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { setSelectedTour(tour); setIsDialogOpen(true); }}>
                      <Pencil className="mr-2 h-3 w-3" /> {t("common.edit")}
                    </Button>
                    <Button variant="destructive" size="sm" className="flex-1" onClick={() => confirmDelete(tour.id, tour.title)}>
                      <Trash className="mr-2 h-3 w-3" /> {t("common.delete")}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-20 text-center text-muted-foreground bg-card rounded-xl border border-border border-dashed">
              <Map className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p>{t("admin.noToursFound")}</p>
            </div>
          )}
        </div>
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
