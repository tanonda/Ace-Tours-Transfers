import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search, Filter, MoreHorizontal, Eye, Download, Trash2,
  CheckSquare, X, RefreshCw, Plus, CheckCircle2, XCircle, Clock, AlertTriangle
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BookingDetailsDialog } from "@/components/admin/booking-details-dialog";
import { EditBookingDialog } from "@/components/admin/edit-booking-dialog";
import { CreateBookingDialog } from "@/components/admin/create-booking-dialog";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchBookings, updateBooking, deleteBooking, exportBookingsCSV } from "@/lib/api";
import type { Booking } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";

export default function AdminBookings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [includeArchived, setIncludeArchived] = useState(false);

  const { data: bookings = [], isLoading, refetch } = useQuery({
    queryKey: ["bookings", includeArchived],
    queryFn: () => fetchBookings(includeArchived),
  });

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortCol, setSortCol] = useState<"id" | "customerName" | "tourName" | "date" | "status" | "amount">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  // keep backward-compat alias
  const dateSort = sortDir;
  const setDateSort = (v: "asc" | "desc" | ((p: "asc" | "desc") => "asc" | "desc")) =>
    setSortDir(typeof v === "function" ? v(sortDir) : v);

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };
  const SortIcon = ({ col }: { col: typeof sortCol }) => sortCol === col
    ? <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
    : <span className="ml-1 opacity-30">↕</span>;

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Booking> }) => updateBooking(id, updates),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bookings"] }); toast({ title: "Booking Updated" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, hard }: { id: string; hard?: boolean }) => deleteBooking(id, hard),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bookings"] }); toast({ title: "Booking Deleted" }); },
  });

  const getStatusColor = (s: string) => ({
    confirmed: "bg-green-100 text-green-800 border-green-200",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    completed: "bg-blue-100 text-blue-800 border-blue-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
    failed: "bg-orange-100 text-orange-800 border-orange-200",
  }[s] || "bg-gray-100 text-gray-800");

  const filteredBookings = useMemo(() => {
    let result = bookings.filter(b => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      const tokens = searchQuery.toLowerCase().trim().split(/\s+/);
      const text = [b.customerName, b.tourName, b.id, b.date, b.status, String(b.guests ?? ""), b.amount].join(" ").toLowerCase();
      return tokens.every(t => text.includes(t));
    });
    return [...result].sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";
      switch (sortCol) {
        case "id": valA = (a.id || "").toLowerCase(); valB = (b.id || "").toLowerCase(); break;
        case "customerName": valA = (a.customerName || "").toLowerCase(); valB = (b.customerName || "").toLowerCase(); break;
        case "tourName": valA = (a.tourName || "").toLowerCase(); valB = (b.tourName || "").toLowerCase(); break;
        case "status": valA = (a.status || "").toLowerCase(); valB = (b.status || "").toLowerCase(); break;
        case "amount":
          valA = parseFloat(String(a.amount).replace(/[^0-9.]/g, "")) || 0;
          valB = parseFloat(String(b.amount).replace(/[^0-9.]/g, "")) || 0;
          break;
        case "date":
        default:
          valA = new Date(a.date).getTime();
          valB = new Date(b.date).getTime();
          break;
      }
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [bookings, searchQuery, statusFilter, sortCol, sortDir]);

  const allSelected = filteredBookings.length > 0 && filteredBookings.every(b => selectedIds.has(b.id));
  const someSelected = selectedIds.size > 0;
  const toggleSelectAll = () => setSelectedIds(allSelected ? new Set() : new Set(filteredBookings.map(b => b.id)));
  const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const bulkUpdateStatus = async (status: string) => {
    for (const id of Array.from(selectedIds)) await updateBooking(id, { status } as any);
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    toast({ title: `${selectedIds.size} booking(s) updated to "${status}"` });
    setSelectedIds(new Set());
  };

  const bulkDelete = async () => {
    const isHard = includeArchived;
    if (!confirm(isHard ? `Permanently delete ${selectedIds.size} booking(s)? This cannot be undone.` : `Archive ${selectedIds.size} booking(s)?`)) return;
    const ids = Array.from(selectedIds);
    try {
      for (const id of ids) await deleteMutation.mutateAsync({ id, hard: isHard });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({ title: `${ids.length} booking(s) ${isHard ? 'permanently deleted' : 'archived'}.` });
      setSelectedIds(new Set());
    } catch {
      toast({ title: "Delete failed", description: "Some bookings could not be deleted.", variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    }
  };

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#004165]">Bookings</h1>
            <p className="text-muted-foreground">Manage and track all tour reservations.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={async () => { try { await exportBookingsCSV(); toast({ title: "Exported" }); } catch { toast({ title: "Failed", variant: "destructive" }); } }}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
                <Button className="bg-[#004165]" size="sm" onClick={() => setIsCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />New Booking</Button>
              </>
            )}
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Smart search: name, tour, ID, date, status…" className="pl-8" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="failed">Failed/Unsuccessful</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center space-x-2 mr-2">
                <Checkbox id="show-deleted" checked={includeArchived} onCheckedChange={(c) => setIncludeArchived(!!c)} />
                <label htmlFor="show-deleted" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Show Deleted
                </label>
              </div>
              <Button variant="outline" size="icon" onClick={() => setDateSort(d => d === "desc" ? "asc" : "desc")} title="Toggle date sort">
                <Filter className="h-4 w-4" />
              </Button>
            </div>

            {someSelected && isAdmin && (
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
                <span className="text-sm font-medium text-primary">{selectedIds.size} selected</span>
                <div className="flex gap-2 ml-auto flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus("confirmed")} className="text-green-700 border-green-300 hover:bg-green-50"><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Confirm</Button>
                  <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus("cancelled")} className="text-orange-700 border-orange-300 hover:bg-orange-50"><XCircle className="h-3.5 w-3.5 mr-1.5" />Cancel</Button>
                  <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus("completed")} className="text-blue-700 border-blue-300 hover:bg-blue-50"><CheckSquare className="h-3.5 w-3.5 mr-1.5" />Complete</Button>
                  <Button size="sm" variant="destructive" onClick={bulkDelete}><Trash2 className="h-3.5 w-3.5 mr-1.5" />{includeArchived ? "Permanently Delete" : "Delete"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}><X className="h-3.5 w-3.5 mr-1" />Clear</Button>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pl-4"><Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} /></TableHead>
                  <TableHead className="cursor-pointer hover:text-primary select-none" onClick={() => handleSort("id")}>Booking ID<SortIcon col="id" /></TableHead>
                  <TableHead className="cursor-pointer hover:text-primary select-none" onClick={() => handleSort("customerName")}>Customer<SortIcon col="customerName" /></TableHead>
                  <TableHead className="cursor-pointer hover:text-primary select-none" onClick={() => handleSort("tourName")}>Tour / Service<SortIcon col="tourName" /></TableHead>
                  <TableHead className="cursor-pointer hover:text-primary select-none" onClick={() => handleSort("date")}>Date<SortIcon col="date" /></TableHead>
                  <TableHead className="cursor-pointer hover:text-primary select-none" onClick={() => handleSort("status")}>Status<SortIcon col="status" /></TableHead>
                  <TableHead className="text-right cursor-pointer hover:text-primary select-none" onClick={() => handleSort("amount")}>Amount<SortIcon col="amount" /></TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10"><RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" /><p className="text-muted-foreground">Loading…</p></TableCell></TableRow>
                ) : filteredBookings.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">{searchQuery || statusFilter !== "all" ? "No bookings match your search/filter." : "No bookings yet."}</TableCell></TableRow>
                ) : filteredBookings.map(booking => (
                  <TableRow key={booking.id} className={selectedIds.has(booking.id) ? "bg-primary/5" : ""}>
                    <TableCell className="pl-4"><Checkbox checked={selectedIds.has(booking.id)} onCheckedChange={() => toggleSelect(booking.id)} /></TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">#{booking.id?.slice(0, 8).toUpperCase()}</TableCell>
                    <TableCell className="font-medium">{booking.customerName}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{booking.tourName}</TableCell>
                    <TableCell>{new Date(booking.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge className={getStatusColor(booking.status)} variant="outline">
                          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                        </Badge>
                        {(booking as any).archivedAt && (
                          <Badge variant="secondary" className="bg-gray-200 text-gray-700 w-fit">Deleted</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{booking.amount}</TableCell>
                    <TableCell className="text-right pr-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedBooking(booking); setIsViewOpen(true); }}><Eye className="h-4 w-4 mr-2" />View Details</DropdownMenuItem>
                          {isAdmin && (
                            <>
                              <DropdownMenuItem onClick={() => { setSelectedBooking(booking); setIsEditOpen(true); }}>Edit Booking</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => updateMutation.mutate({ id: booking.id, updates: { status: "confirmed" } as any })}><CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />Confirm</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateMutation.mutate({ id: booking.id, updates: { status: "cancelled" } as any })}><XCircle className="h-4 w-4 mr-2 text-orange-600" />Cancel</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600" onClick={() => {
                                const isArchived = !!(booking as any).archivedAt;
                                if (confirm(isArchived ? "Permanently delete this booking? This cannot be undone." : "Archive this booking?")) {
                                  deleteMutation.mutate({ id: booking.id, hard: isArchived });
                                }
                              }}><Trash2 className="h-4 w-4 mr-2" />{(booking as any).archivedAt ? "Permanently Delete" : "Delete"}</DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredBookings.length > 0 && (
              <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
                Showing {filteredBookings.length} of {bookings.length} bookings{searchQuery && ` · "${searchQuery}"`}
              </div>
            )}
          </CardContent>
        </Card>

        <BookingDetailsDialog booking={selectedBooking} open={isViewOpen} onOpenChange={setIsViewOpen} />
        <EditBookingDialog booking={selectedBooking} open={isEditOpen} onOpenChange={setIsEditOpen} onSave={b => updateMutation.mutate({ id: b.id, updates: b })} />
        <CreateBookingDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["bookings"] })} />
      </div>
    </DashboardLayout>
  );
}
