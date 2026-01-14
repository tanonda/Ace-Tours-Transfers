
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTours, createTour, updateTour, deleteTour, fetchBookings } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash, Search, Map, Car, LayoutGrid, DollarSign, Users, Clock, Image as ImageIcon, Loader2 } from "lucide-react";
import { TourDialog } from "@/components/admin/tour-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminTours() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTour, setSelectedTour] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [tourToDelete, setTourToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: tours = [], isLoading } = useQuery({
    queryKey: ["tours"],
    queryFn: fetchTours,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["admin", "bookings"],
    queryFn: fetchBookings,
  });

  const createMutation = useMutation({
    mutationFn: createTour,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      toast({ title: t("admin.tourCreated"), description: t("admin.tourCreatedDesc") });
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("admin.createFailed"), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateTour(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      toast({ title: t("admin.tourUpdated"), description: t("admin.tourUpdatedDesc") });
      setIsDialogOpen(false);
      setSelectedTour(null);
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("admin.updateFailed"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTour,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      toast({ title: t("admin.tourDeleted"), description: t("admin.tourDeletedDesc") });
      setIsDeleteDialogOpen(false);
      setTourToDelete(null);
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("admin.deleteFailed"), variant: "destructive" });
    },
  });

  const handleCreate = () => {
    setSelectedTour(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (tour: any) => {
    setSelectedTour(tour);
    setIsDialogOpen(true);
  };

  const confirmDelete = (id: string) => {
    setTourToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleSave = (data: any) => {
    if (selectedTour) {
      updateMutation.mutate({ id: selectedTour.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredTours = tours.filter(tour =>
    tour.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tour.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tourStats = {
    totalTours: tours.filter(t => t.category === 'tour').length,
    totalTransfers: tours.filter(t => t.category === 'transfer').length,
    totalVehicles: tours.filter(t => t.category === 'vehicle').length,
    totalBookings: bookings.length,
    totalRevenue: bookings.reduce((sum, b) => 
      sum + parseFloat(String(b.amount).replace(/[^0-9.-]+/g, '') || '0'), 0
    )
  };

  return (
    <DashboardLayout type="admin">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("admin.toursManagement")}</h1>
            <p className="text-sm text-muted-foreground">{t("admin.manageToursDesc")}</p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" /> {t("admin.addTour")}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card><CardContent className="p-4 flex items-center gap-3"><ImageIcon className="h-5 w-5 text-blue-500" /><div><p className="text-xs text-muted-foreground">Tours</p><p className="text-xl font-bold">{tourStats.totalTours}</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><Car className="h-5 w-5 text-green-500" /><div><p className="text-xs text-muted-foreground">Transfers</p><p className="text-xl font-bold">{tourStats.totalTransfers}</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><LayoutGrid className="h-5 w-5 text-orange-500" /><div><p className="text-xs text-muted-foreground">Vehicles</p><p className="text-xl font-bold">{tourStats.totalVehicles}</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><Users className="h-5 w-5 text-purple-500" /><div><p className="text-xs text-muted-foreground">Bookings</p><p className="text-xl font-bold">{tourStats.totalBookings}</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><DollarSign className="h-5 w-5 text-yellow-500" /><div><p className="text-xs text-muted-foreground">Revenue</p><p className="text-xl font-bold">${tourStats.totalRevenue.toLocaleString()}</p></div></CardContent></Card>
        </div>

        <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("common.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-full py-10 text-center">{t("common.loading")}</div>
          ) : filteredTours.length > 0 ? (
            filteredTours.map((tour) => (
              <div key={tour.id} className="group relative bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-video relative">
                  <img src={tour.image} alt={tour.title} className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded text-xs font-medium uppercase tracking-wider flex items-center gap-1">
                    {tour.category === 'transfer' ? <Car className="h-3 w-3" /> : tour.category === 'vehicle' ? <LayoutGrid className="h-3 w-3" /> : <Map className="h-3 w-3" />}
                    {tour.category}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-1 line-clamp-1">{tour.title}</h3>
                  <div className="flex items-center justify-between text-muted-foreground text-sm mb-4">
                    <span className="font-bold text-foreground">{tour.price}</span>
                    <span>{tour.duration}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(tour)}>
                      <Pencil className="mr-2 h-3 w-3" /> {t("common.edit")}
                    </Button>
                    <Button variant="destructive" size="sm" className="flex-1" onClick={() => confirmDelete(tour.id)}>
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

      <TourDialog
        tour={selectedTour}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={handleSave}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.confirmDeleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => tourToDelete && deleteMutation.mutate(tourToDelete)}
            >
              {deleteMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
