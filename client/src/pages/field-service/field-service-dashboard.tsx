import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { fetchBookings, updateBooking } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CalendarCheck, Users, Clock, MapPin, CheckCircle, XCircle,
  Search, RefreshCw, Phone, Mail, AlertCircle, ChevronRight
} from "lucide-react";

function statusColor(status: string) {
  switch (status) {
    case "confirmed": return "bg-green-500/15 text-green-600 border-green-500/20";
    case "pending": return "bg-yellow-500/15 text-yellow-600 border-yellow-500/20";
    case "completed": return "bg-blue-500/15 text-blue-600 border-blue-500/20";
    case "cancelled": return "bg-red-500/15 text-red-500 border-red-500/20";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export default function FieldServiceDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"today" | "tomorrow" | "all">("today");

  const { data: allBookings = [], isLoading, refetch } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => fetchBookings(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateBooking(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({ title: "Booking updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update booking", variant: "destructive" }),
  });

  const today = todayStr();
  const tomorrow = tomorrowStr();

  const bookings = (allBookings as any[]).filter(b => {
    if (b.status === "cancelled" || b.status === "failed") return false;
    const matchSearch = !search || [b.customerName, b.tourName, b.id].join(" ").toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (tab === "today") return b.date === today;
    if (tab === "tomorrow") return b.date === tomorrow;
    return true;
  });

  const todayCount = (allBookings as any[]).filter(b => b.date === today && b.status !== "cancelled").length;
  const tomorrowCount = (allBookings as any[]).filter(b => b.date === tomorrow && b.status !== "cancelled").length;
  const confirmedToday = (allBookings as any[]).filter(b => b.date === today && b.status === "confirmed").length;
  const pendingToday = (allBookings as any[]).filter(b => b.date === today && b.status === "pending").length;

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Field Service Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {user?.name?.split(" ")[0] || "Team"} · {new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
          </Button>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <CalendarCheck className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{todayCount}</div>
                  <div className="text-xs text-muted-foreground">Today's Bookings</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{confirmedToday}</div>
                  <div className="text-xs text-muted-foreground">Confirmed Today</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{pendingToday}</div>
                  <div className="text-xs text-muted-foreground">Pending Today</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <CalendarCheck className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{tomorrowCount}</div>
                  <div className="text-xs text-muted-foreground">Tomorrow</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending alert */}
        {pendingToday > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-sm">
            <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
            <span className="font-semibold text-yellow-700">
              {pendingToday} booking{pendingToday > 1 ? "s" : ""} for today still pending — contact customer to confirm
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-muted rounded-lg p-0.5 text-sm">
            {(["today", "tomorrow", "all"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors capitalize ${tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t === "today" ? `Today (${todayCount})` : t === "tomorrow" ? `Tomorrow (${tomorrowCount})` : "All Upcoming"}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, tour..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Booking Cards */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading bookings...
            </div>
          ) : bookings.length === 0 ? (
            <div className="py-16 text-center bg-card border border-border rounded-xl">
              <CalendarCheck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">
                {tab === "today" ? "No bookings for today" : tab === "tomorrow" ? "No bookings for tomorrow" : "No upcoming bookings"}
              </p>
            </div>
          ) : (
            bookings.map((b: any) => (
              <div key={b.id} className={`bg-card border rounded-xl p-4 ${b.status === "confirmed" ? "border-green-500/20" : b.status === "pending" ? "border-yellow-500/30" : "border-border"}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-foreground truncate">{b.customerName}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${statusColor(b.status)}`}>
                        {b.status}
                      </span>
                      {b.date === today && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">TODAY</span>}
                      {b.date === tomorrow && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 border border-purple-500/20">TOMORROW</span>}
                    </div>
                    <div className="text-sm font-medium text-foreground mb-2">{b.tourName}</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <CalendarCheck className="h-3 w-3 shrink-0" />
                        {b.date} {b.startTime ? `· ${b.startTime}` : ""}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 shrink-0" />
                        {b.guests} {b.guests === 1 ? "guest" : "guests"}
                        {b.childGuests > 0 ? ` + ${b.childGuests} child` : ""}
                      </div>
                      {b.pickupLocation && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{b.pickupLocation}</span>
                        </div>
                      )}
                      {b.customerPhone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 shrink-0" />
                          <a href={`tel:${b.customerPhone}`} className="hover:text-primary transition-colors">{b.customerPhone}</a>
                        </div>
                      )}
                      {b.customerEmail && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 shrink-0" />
                          <a href={`mailto:${b.customerEmail}`} className="hover:text-primary transition-colors truncate">{b.customerEmail}</a>
                        </div>
                      )}
                    </div>
                    {b.notes && (
                      <div className="mt-2 p-2 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                        <span className="font-semibold">Note:</span> {b.notes}
                      </div>
                    )}
                  </div>

                  {/* Quick actions */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {b.status === "pending" && (
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => updateMutation.mutate({ id: b.id, status: "confirmed" })}
                        disabled={updateMutation.isPending}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" /> Confirm
                      </Button>
                    )}
                    {b.status === "confirmed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-blue-500/30 text-blue-600 hover:bg-blue-50"
                        onClick={() => updateMutation.mutate({ id: b.id, status: "completed" })}
                        disabled={updateMutation.isPending}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" /> Mark Done
                      </Button>
                    )}
                    {b.customerPhone && (
                      <a href={`https://wa.me/${b.customerPhone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="h-8 text-xs w-full">
                          <Phone className="h-3 w-3 mr-1" /> WhatsApp
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {bookings.length > 0 && (
          <p className="text-xs text-center text-muted-foreground">
            Showing {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
            {tab !== "all" ? ` for ${tab}` : ""}
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
