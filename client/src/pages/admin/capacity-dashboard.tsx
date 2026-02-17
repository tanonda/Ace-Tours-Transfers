import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertAvailability } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Edit2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";

interface TourCapacity {
    tourId: string;
    tourTitle: string;
    date: string;
    totalCapacity: number;
    confirmedCount: number;
    heldCount: number;
    blockedCount: number;
    remainingCapacity: number;
    utilizationPercent: number;
    status: "available" | "limited" | "critical" | "sold-out";
}

interface CapacitySummary {
    totalTours: number;
    soldOutTours: number;
    criticalTours: number;
    averageUtilization: number;
}

export default function CapacityDashboard() {
    const [dateRange, setDateRange] = useState({
        start: new Date().toISOString().split("T")[0],
        end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    });

    const { data: overview = [], isLoading: loadingOverview } = useQuery<TourCapacity[]>({
        queryKey: ["/api/admin/capacity-overview", dateRange],
        refetchInterval: 30000, // Refresh every 30 seconds
    });

    const { data: summary } = useQuery<CapacitySummary>({
        queryKey: ["/api/admin/capacity-summary", dateRange],
        refetchInterval: 30000,
    });

    const { data: alerts = [] } = useQuery<string[]>({
        queryKey: ["/api/admin/alerts"],
        refetchInterval: 15000,
    });

    const { toast } = useToast();
    const [editingInstance, setEditingInstance] = useState<TourCapacity | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [editForm, setEditForm] = useState({
        totalCapacity: 0,
        blockedCount: 0
    });

    const handleEditClick = (instance: TourCapacity) => {
        setEditingInstance(instance);
        setEditForm({
            totalCapacity: instance.totalCapacity,
            blockedCount: instance.blockedCount
        });
    };

    const handleUpdate = async () => {
        if (!editingInstance) return;
        setIsUpdating(true);
        try {
            await upsertAvailability({
                tourId: editingInstance.tourId,
                date: editingInstance.date,
                totalCapacity: editForm.totalCapacity,
                blockedCount: editForm.blockedCount
            });
            toast({ title: "Success", description: "Capacity updated successfully" });
            setEditingInstance(null);
            // Query invalidation will be handled by React Query if we add it
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    };

    const getStatusBadge = (status: TourCapacity["status"]) => {
        const variants: Record<TourCapacity["status"], { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
            available: { variant: "default", label: "Available" },
            limited: { variant: "secondary", label: "Limited" },
            critical: { variant: "destructive", label: "Critical" },
            "sold-out": { variant: "outline", label: "Sold Out" },
        };
        const config = variants[status];
        return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    return (
        <DashboardLayout type="admin">
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">Capacity Dashboard</h1>
                    <p className="text-muted-foreground">Real-time capacity utilization across all tours</p>
                </div>

                {/* System Alerts Section */}
                {alerts.length > 0 && (
                    <Card className="border-destructive bg-destructive/5">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2 text-destructive font-semibold">
                                <AlertCircle className="h-5 w-5" />
                                <CardTitle className="text-lg">System Alerts</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ul className="list-disc list-inside space-y-1">
                                {alerts.map((alert, idx) => (
                                    <li key={idx} className="text-sm text-destructive">{alert}</li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Tours</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary?.totalTours || 0}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Sold Out</CardTitle>
                            <AlertCircle className="h-4 w-4 text-destructive" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary?.soldOutTours || 0}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Critical (&gt;90%)</CardTitle>
                            <AlertCircle className="h-4 w-4 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary?.criticalTours || 0}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Avg Utilization</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {summary?.averageUtilization ? `${Math.round(summary.averageUtilization * 100)}%` : "0%"}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Capacity Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Tour Capacity Overview</CardTitle>
                        <CardDescription>Detailed capacity breakdown for each tour instance</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-2">Tour</th>
                                        <th className="text-left p-2">Date</th>
                                        <th className="text-right p-2">Confirmed</th>
                                        <th className="text-right p-2">Held</th>
                                        <th className="text-right p-2">Remaining</th>
                                        <th className="text-right p-2">Utilization</th>
                                        <th className="text-center p-2">Status</th>
                                        <th className="text-right p-2">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingOverview ? (
                                        <tr>
                                            <td colSpan={7} className="text-center p-4 text-muted-foreground">
                                                Loading...
                                            </td>
                                        </tr>
                                    ) : overview.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center p-4 text-muted-foreground">
                                                No tour instances found for selected date range
                                            </td>
                                        </tr>
                                    ) : (
                                        overview.map((tour, idx) => (
                                            <tr key={idx} className="border-b hover:bg-muted/50">
                                                <td className="p-2 font-medium">{tour.tourTitle}</td>
                                                <td className="p-2">{new Date(tour.date).toLocaleDateString()}</td>
                                                <td className="p-2 text-right">{tour.confirmedCount}</td>
                                                <td className="p-2 text-right">{tour.heldCount}</td>
                                                <td className="p-2 text-right font-semibold">{tour.remainingCapacity}/{tour.totalCapacity}</td>
                                                <td className="p-2 text-right">{Math.round(tour.utilizationPercent * 100)}%</td>
                                                <td className="text-center p-2">{getStatusBadge(tour.status)}</td>
                                                <td className="text-right p-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleEditClick(tour)}
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                <Dialog open={!!editingInstance} onOpenChange={(open) => !open && setEditingInstance(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Adjust Capacity: {editingInstance?.tourTitle}</DialogTitle>
                            <CardDescription>{editingInstance?.date && new Date(editingInstance.date).toLocaleDateString()}</CardDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Total Capacity</Label>
                                    <Input
                                        type="number"
                                        value={editForm.totalCapacity}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, totalCapacity: parseInt(e.target.value) || 0 }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Blocked Seats</Label>
                                    <Input
                                        type="number"
                                        value={editForm.blockedCount}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, blockedCount: parseInt(e.target.value) || 0 }))}
                                    />
                                </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Current bookings: {editingInstance?.confirmedCount} | Current holds: {editingInstance?.heldCount}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditingInstance(null)}>Cancel</Button>
                            <Button onClick={handleUpdate} disabled={isUpdating}>
                                {isUpdating && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                Update Capacity
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
}
