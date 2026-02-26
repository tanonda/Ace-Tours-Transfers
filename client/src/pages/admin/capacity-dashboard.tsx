import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { upsertAvailability, fetchTours } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  RefreshCw, Edit2, AlertCircle, Users, TrendingUp, Plus, Calendar,
  ChevronLeft, ChevronRight, BarChart2, Settings2, Lock, Unlock
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, parseISO, isToday, isPast } from "date-fns";

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

// ─── Utility helpers ──────────────────────────────────────────────────────────

function statusColor(status: TourCapacity["status"]) {
  switch (status) {
    case "available": return "bg-green-100 text-green-800 border-green-200";
    case "limited": return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "critical": return "bg-orange-100 text-orange-800 border-orange-200";
    case "sold-out": return "bg-red-100 text-red-800 border-red-200";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function utilizationBarColor(pct: number) {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 90) return "bg-orange-500";
  if (pct >= 70) return "bg-yellow-500";
  return "bg-green-500";
}

// ─── Edit Capacity Dialog ─────────────────────────────────────────────────────

function EditCapacityDialog({
  instance,
  open,
  onClose,
  onSaved,
}: {
  instance: TourCapacity | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [totalCapacity, setTotalCapacity] = useState(instance?.totalCapacity ?? 20);
  const [blockedCount, setBlockedCount] = useState(instance?.blockedCount ?? 0);
  const [saving, setSaving] = useState(false);

  // Reset when instance changes
  useState(() => {
    setTotalCapacity(instance?.totalCapacity ?? 20);
    setBlockedCount(instance?.blockedCount ?? 0);
  });

  if (!instance) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertAvailability({
        tourId: instance.tourId,
        date: instance.date,
        totalCapacity,
        blockedCount,
      });
      toast({ title: "Capacity updated", description: `${instance.tourTitle} on ${instance.date} updated.` });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remaining = totalCapacity - blockedCount - (instance.confirmedCount || 0) - (instance.heldCount || 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#004165]">
            <Settings2 className="h-5 w-5" />
            Edit Capacity
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-muted/40 rounded-lg p-3 text-sm">
            <div className="font-semibold text-foreground">{instance.tourTitle}</div>
            <div className="text-muted-foreground">{format(parseISO(instance.date), "EEEE, MMMM d, yyyy")}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Total Capacity</Label>
              <Input
                type="number"
                min={1}
                max={9999}
                value={totalCapacity}
                onChange={(e) => setTotalCapacity(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Blocked Seats</Label>
              <Input
                type="number"
                min={0}
                max={totalCapacity}
                value={blockedCount}
                onChange={(e) => setBlockedCount(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">Reserved / unavailable</p>
            </div>
          </div>

          {/* Live preview */}
          <div className="bg-muted/40 rounded-lg p-3 space-y-2 text-sm border">
            <div className="font-medium text-foreground">Preview after save</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-[#004165]">{instance.confirmedCount}</div>
                <div className="text-xs text-muted-foreground">Confirmed</div>
              </div>
              <div>
                <div className="text-lg font-bold text-orange-600">{blockedCount}</div>
                <div className="text-xs text-muted-foreground">Blocked</div>
              </div>
              <div>
                <div className={`text-lg font-bold ${remaining > 0 ? "text-green-600" : "text-red-600"}`}>
                  {Math.max(0, remaining)}
                </div>
                <div className="text-xs text-muted-foreground">Remaining</div>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#004165] text-white hover:bg-[#004165]/90">
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Availability Slot Dialog ─────────────────────────────────────────────

function AddAvailabilityDialog({
  open,
  onClose,
  onSaved,
  tours,
  preselectedDate,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  tours: any[];
  preselectedDate?: string;
}) {
  const { toast } = useToast();
  const [tourId, setTourId] = useState("");
  const [date, setDate] = useState(preselectedDate || format(new Date(), "yyyy-MM-dd"));
  const [totalCapacity, setTotalCapacity] = useState(20);
  const [blockedCount, setBlockedCount] = useState(0);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!tourId) return toast({ title: "Select a tour", variant: "destructive" });
    setSaving(true);
    try {
      await upsertAvailability({ tourId, date, totalCapacity, blockedCount });
      toast({ title: "Availability added", description: `Slot created for ${date}.` });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#004165]">
            <Plus className="h-5 w-5" />
            Add Availability Slot
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {/* Product selector — shows ALL products (tours + transfers + vehicles) */}
          <div className="space-y-1.5">
            <Label className="font-semibold">Product *</Label>
            <Select value={tourId} onValueChange={setTourId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a tour, transfer or vehicle hire..." />
              </SelectTrigger>
              <SelectContent className="max-h-[360px] overflow-y-auto">
                {tours.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No products available</div>
                )}
                {/* Group by category */}
                {["tour","transfer","vehicle"].map(cat => {
                  const group = tours.filter((t: any) => {
                    const c = (t.category || "tour").toLowerCase();
                    if (cat === "tour") return !c.includes("transfer") && !c.includes("vehicle");
                    return c.includes(cat);
                  });
                  if (group.length === 0) return null;
                  return (
                    <div key={cat}>
                      <div className="px-2 py-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                        {cat === "tour" ? "Tours" : cat === "transfer" ? "Transfers" : "Vehicle Hire"}
                      </div>
                      {group.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="flex items-center gap-2">
                            {t.title}
                            {t.isActive === false && <span className="text-xs text-red-500">(inactive)</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </div>
                  );
                })}
              </SelectContent>
            </Select>
            {tourId && (() => {
              const selected = tours.find((t: any) => t.id === tourId);
              return selected ? (
                <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
                  <strong>{selected.title}</strong>
                  {selected.duration && <span> · {selected.duration}</span>}
                  {selected.defaultCapacity && <span> · Default cap: {selected.defaultCapacity}</span>}
                </div>
              ) : null;
            })()}
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold">Date *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={format(new Date(), "yyyy-MM-dd")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-semibold">Total Capacity</Label>
              <Input type="number" min={1} value={totalCapacity} onChange={(e) => setTotalCapacity(parseInt(e.target.value) || 1)} />
              <p className="text-xs text-muted-foreground">Max seats/spots for this date</p>
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">Blocked Seats</Label>
              <Input type="number" min={0} max={totalCapacity} value={blockedCount} onChange={(e) => setBlockedCount(parseInt(e.target.value) || 0)} />
              <p className="text-xs text-muted-foreground">Reserved / unavailable</p>
            </div>
          </div>

          {/* Available preview */}
          <div className="bg-muted/30 rounded-lg p-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Available for booking</span>
              <span className="font-bold text-lg text-green-700">{Math.max(0, totalCapacity - blockedCount)}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-muted-foreground">Total capacity</span>
              <span className="font-medium">{totalCapacity}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !tourId} className="bg-[#004165] text-white hover:bg-[#004165]/90">
            {saving ? "Creating…" : "Create Availability Slot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function CalendarView({
  overview,
  onDayClick,
}: {
  overview: TourCapacity[];
  onDayClick: (date: string) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const firstDayOfWeek = getDay(startOfMonth(currentMonth));

  // Group overview by date
  const byDate: Record<string, TourCapacity[]> = {};
  overview.forEach((item) => {
    if (!byDate[item.date]) byDate[item.date] = [];
    byDate[item.date].push(item);
  });

  function getDayStatus(dateStr: string): TourCapacity["status"] | null {
    const items = byDate[dateStr];
    if (!items || items.length === 0) return null;
    if (items.some(i => i.status === "sold-out")) return "sold-out";
    if (items.some(i => i.status === "critical")) return "critical";
    if (items.some(i => i.status === "limited")) return "limited";
    return "available";
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold text-[#004165]">{format(currentMonth, "MMMM yyyy")}</h3>
        <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {dayNames.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells before first day */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const status = getDayStatus(dateStr);
          const items = byDate[dateStr] || [];
          const today = isToday(day);
          const past = isPast(day) && !today;

          return (
            <button
              key={dateStr}
              onClick={() => items.length > 0 && onDayClick(dateStr)}
              disabled={items.length === 0}
              className={`
                relative aspect-square rounded-lg flex flex-col items-center justify-center text-sm font-medium
                transition-all
                ${today ? "ring-2 ring-[#004165]" : ""}
                ${past ? "opacity-50" : ""}
                ${items.length > 0 ? "cursor-pointer hover:scale-105" : "cursor-default"}
                ${status === "sold-out" ? "bg-red-100 text-red-800" :
                  status === "critical" ? "bg-orange-100 text-orange-800" :
                  status === "limited" ? "bg-yellow-100 text-yellow-800" :
                  status === "available" ? "bg-green-100 text-green-800" :
                  "bg-muted/30 text-muted-foreground"}
              `}
              title={items.length > 0 ? `${items.length} tour(s) — ${status}` : "No availability set"}
            >
              <span>{format(day, "d")}</span>
              {items.length > 0 && (
                <span className="text-[9px] font-bold opacity-70">{items.length}T</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 text-xs">
        {[
          { label: "Available", color: "bg-green-100 text-green-800" },
          { label: "Limited (<70%)", color: "bg-yellow-100 text-yellow-800" },
          { label: "Critical (>90%)", color: "bg-orange-100 text-orange-800" },
          { label: "Sold Out", color: "bg-red-100 text-red-800" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${l.color}`} />
            <span className="text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function CapacityDashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [dateRange, setDateRange] = useState({
    start: format(new Date(), "yyyy-MM-dd"),
    end: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
  });

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTour, setFilterTour] = useState<string>("all");
  const [editingInstance, setEditingInstance] = useState<TourCapacity | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [dayFilterDate, setDayFilterDate] = useState<string | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: overview = [], isLoading: loadingOverview, refetch: refetchOverview } = useQuery<TourCapacity[]>({
    queryKey: ["/api/admin/capacity-overview", dateRange],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/capacity-overview?start=${dateRange.start}&end=${dateRange.end}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: summary, refetch: refetchSummary } = useQuery<CapacitySummary>({
    queryKey: ["/api/admin/capacity-summary", dateRange],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/capacity-summary?start=${dateRange.start}&end=${dateRange.end}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: tours = [] } = useQuery({
    queryKey: ["tours"],
    queryFn: fetchTours,
  });

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = overview.filter(item => {
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (filterTour !== "all" && item.tourId !== filterTour) return false;
    if (dayFilterDate && item.date !== dayFilterDate) return false;
    return true;
  });

  const activeTours = tours.filter((t: any) => t.isActive !== false && !t.title.toLowerCase().includes("test"));
  const uniqueTourIds = [...new Set(overview.map(o => o.tourId))];
  const toursWithAvailability = activeTours.filter((t: any) => uniqueTourIds.includes(t.id));

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRefresh = useCallback(() => {
    refetchOverview();
    refetchSummary();
    toast({ title: "Refreshed", description: "Availability data reloaded." });
  }, [refetchOverview, refetchSummary, toast]);

  const handleSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/capacity-overview"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/capacity-summary"] });
  }, [queryClient]);

  const handleDayClick = useCallback((date: string) => {
    setDayFilterDate(prev => prev === date ? null : date);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#004165]">Availability Dashboard</h1>
            <p className="text-muted-foreground text-sm">Real-time capacity management across all products</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button size="sm" className="bg-[#004165] text-white hover:bg-[#004165]/90" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Slot
            </Button>
          </div>
        </div>

        {/* Date range controls */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1.5">
                <Label>From</Label>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(r => ({ ...r, start: e.target.value }))}
                  className="w-40"
                />
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(r => ({ ...r, end: e.target.value }))}
                  min={dateRange.start}
                  className="w-40"
                />
              </div>
              {/* Quick range presets */}
              <div className="flex gap-2">
                {[
                  { label: "7 days", days: 7 },
                  { label: "30 days", days: 30 },
                  { label: "90 days", days: 90 },
                ].map(preset => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    onClick={() => setDateRange({
                      start: format(new Date(), "yyyy-MM-dd"),
                      end: format(new Date(Date.now() + preset.days * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
                    })}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Slots</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#004165]">{summary?.totalTours || overview.length}</div>
              <p className="text-xs text-muted-foreground">across {dateRange.start} – {dateRange.end}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sold Out</CardTitle>
              <Lock className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{summary?.soldOutTours || overview.filter(o => o.status === "sold-out").length}</div>
              <p className="text-xs text-muted-foreground">fully booked dates</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical (&gt;90%)</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{summary?.criticalTours || overview.filter(o => o.status === "critical").length}</div>
              <p className="text-xs text-muted-foreground">nearly full slots</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Utilization</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#004165]">
                {summary?.averageUtilization
                  ? `${Math.round(summary.averageUtilization * 100)}%`
                  : overview.length > 0
                    ? `${Math.round(overview.reduce((a, o) => a + o.utilizationPercent, 0) / overview.length)}%`
                    : "—"}
              </div>
              <p className="text-xs text-muted-foreground">across selected range</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="table">
          <TabsList>
            <TabsTrigger value="table" className="flex items-center gap-1.5">
              <BarChart2 className="h-4 w-4" /> Table View
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" /> Calendar View
            </TabsTrigger>
          </TabsList>

          {/* ── Table View ── */}
          <TabsContent value="table" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-4">
                  <span>Capacity Overview</span>
                  <div className="flex gap-2 ml-auto">
                    {/* Status filter */}
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="limited">Limited</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="sold-out">Sold Out</SelectItem>
                      </SelectContent>
                    </Select>
                    {/* Product filter */}
                    <Select value={filterTour} onValueChange={setFilterTour}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="All products" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All products</SelectItem>
                        {toursWithAvailability.map((t: any) => (
                          <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {dayFilterDate && (
                      <Button variant="outline" size="sm" onClick={() => setDayFilterDate(null)}>
                        Clear date filter
                      </Button>
                    )}
                  </div>
                </CardTitle>
                <CardDescription>
                  {dayFilterDate ? `Showing ${filtered.length} slots for ${dayFilterDate}` : `Showing ${filtered.length} slots`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingOverview ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 opacity-50" />
                    Loading capacity data…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No availability data found</p>
                    <p className="text-sm mt-1">Adjust the date range or add slots using the button above.</p>
                    <Button className="mt-4 bg-[#004165] text-white hover:bg-[#004165]/90" onClick={() => setAddDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" /> Add First Slot
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="p-3 font-medium text-muted-foreground">Product</th>
                          <th className="p-3 font-medium text-muted-foreground">Date</th>
                          <th className="p-3 font-medium text-muted-foreground text-right">Total</th>
                          <th className="p-3 font-medium text-muted-foreground text-right">Confirmed</th>
                          <th className="p-3 font-medium text-muted-foreground text-right">Held</th>
                          <th className="p-3 font-medium text-muted-foreground text-right">Blocked</th>
                          <th className="p-3 font-medium text-muted-foreground text-right">Remaining</th>
                          <th className="p-3 font-medium text-muted-foreground">Utilization</th>
                          <th className="p-3 font-medium text-muted-foreground text-center">Status</th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-muted">
                        {filtered.map((item, idx) => (
                          <tr key={`${item.tourId}-${item.date}-${idx}`} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-medium">{item.tourTitle}</td>
                            <td className="p-3 text-muted-foreground whitespace-nowrap">
                              {format(parseISO(item.date), "MMM d, yyyy")}
                            </td>
                            <td className="p-3 text-right font-mono">{item.totalCapacity}</td>
                            <td className="p-3 text-right font-mono text-green-700">{item.confirmedCount}</td>
                            <td className="p-3 text-right font-mono text-blue-600">{item.heldCount}</td>
                            <td className="p-3 text-right font-mono text-orange-600">{item.blockedCount}</td>
                            <td className="p-3 text-right font-mono font-semibold">{item.remainingCapacity}</td>
                            <td className="p-3 w-40">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${utilizationBarColor(item.utilizationPercent)}`}
                                    style={{ width: `${Math.min(100, item.utilizationPercent)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground w-10 text-right">
                                  {Math.round(item.utilizationPercent)}%
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <Badge variant="outline" className={`text-xs ${statusColor(item.status)}`}>
                                {item.status === "sold-out" ? "Sold Out" :
                                  item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingInstance(item)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Calendar View ── */}
          <TabsContent value="calendar" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-[#004165]" />
                  Availability Calendar
                </CardTitle>
                <CardDescription>Click a day to filter the table by that date</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingOverview ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 opacity-50" />
                    Loading calendar…
                  </div>
                ) : (
                  <CalendarView overview={overview} onDayClick={handleDayClick} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </div>

      {/* Edit Dialog */}
      <EditCapacityDialog
        instance={editingInstance}
        open={!!editingInstance}
        onClose={() => setEditingInstance(null)}
        onSaved={handleSaved}
      />

      {/* Add Dialog */}
      <AddAvailabilityDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSaved={handleSaved}
        tours={activeTours}
        preselectedDate={dayFilterDate || undefined}
      />
    </DashboardLayout>
  );
}
