import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { fetchAuditLogs, fetchTours } from "@/lib/api";
import { ScrollText, RefreshCw, Download, Search, Filter } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  booking_confirmed:    "bg-green-100 text-green-800",
  booking_cancelled:    "bg-red-100 text-red-800",
  hold_created:         "bg-blue-100 text-blue-800",
  hold_expired:         "bg-yellow-100 text-yellow-800",
  hold_released:        "bg-orange-100 text-orange-800",
  capacity_updated:     "bg-purple-100 text-purple-800",
  blackout_created:     "bg-gray-100 text-gray-800",
  blackout_deleted:     "bg-gray-100 text-gray-800",
};

export default function AdminAuditLogs() {
  const [productId, setProductId] = useState<string>("");
  const [action, setAction] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [limit, setLimit] = useState<number>(200);

  const { data: tours = [] } = useQuery({ queryKey: ["/api/tours"], queryFn: fetchTours });

  const { data: entries = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/audit-log", productId, action, limit],
    queryFn: () => fetchAuditLogs({
      productId: productId || undefined,
      action: action || undefined,
      limit,
    }),
  });

  const filtered = entries.filter((e: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      e.action?.toLowerCase().includes(s) ||
      e.performedBy?.toLowerCase().includes(s) ||
      tours.find((t: any) => t.id === e.productId)?.title?.toLowerCase().includes(s)
    );
  });

  const handleExport = () => {
    const rows = [
      ["Time", "Action", "Product", "Quantity", "Performed By", "Details"],
      ...filtered.map((e: any) => [
        new Date(e.createdAt).toLocaleString(),
        e.action,
        tours.find((t: any) => t.id === e.productId)?.title || e.productId,
        e.quantity ?? "",
        e.performedBy,
        e.metadata ? JSON.stringify(e.metadata) : "",
      ]),
    ];
    const csv = rows.map(r => r.map(String).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#004165]/10 flex items-center justify-center">
              <ScrollText className="h-5 w-5 text-[#004165]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#004165]">Audit Log</h1>
              <p className="text-muted-foreground text-sm">Track capacity events, holds, and booking changes</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()} size="sm">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button variant="outline" onClick={handleExport} size="sm">
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" /> Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="product-filter">Product</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger id="product-filter">
                    <SelectValue placeholder="All products" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All products</SelectItem>
                    {tours.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.title || t.name || t.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="action-filter">Action Type</Label>
                <Select value={action} onValueChange={setAction}>
                  <SelectTrigger id="action-filter">
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All actions</SelectItem>
                    <SelectItem value="booking_confirmed">Booking Confirmed</SelectItem>
                    <SelectItem value="booking_cancelled">Booking Cancelled</SelectItem>
                    <SelectItem value="hold_created">Hold Created</SelectItem>
                    <SelectItem value="hold_expired">Hold Expired</SelectItem>
                    <SelectItem value="hold_released">Hold Released</SelectItem>
                    <SelectItem value="capacity_updated">Capacity Updated</SelectItem>
                    <SelectItem value="blackout_created">Blackout Created</SelectItem>
                    <SelectItem value="blackout_deleted">Blackout Deleted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="limit-filter">Entries to Show</Label>
                <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
                  <SelectTrigger id="limit-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">Last 50</SelectItem>
                    <SelectItem value="100">Last 100</SelectItem>
                    <SelectItem value="200">Last 200</SelectItem>
                    <SelectItem value="500">Last 500</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="search-filter">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search-filter"
                    className="pl-8"
                    placeholder="Action, user, product…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Events", value: filtered.length },
            { label: "Bookings", value: filtered.filter((e: any) => e.action?.includes("booking")).length },
            { label: "Holds", value: filtered.filter((e: any) => e.action?.includes("hold")).length },
            { label: "Capacity Changes", value: filtered.filter((e: any) => e.action?.includes("capacity")).length },
          ].map(stat => (
            <Card key={stat.label}>
              <CardContent className="pt-4 pb-3">
                <div className="text-2xl font-bold text-[#004165]">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Entries <span className="text-muted-foreground font-normal text-sm">({filtered.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Performed By</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Loading audit log…
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No entries found for the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(e.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs font-medium ${ACTION_COLORS[e.action] || "bg-gray-100 text-gray-700"}`}
                          >
                            {e.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {tours.find((t: any) => t.id === e.productId)?.title || (
                            <span className="text-muted-foreground text-xs">{e.productId?.slice(0, 8) || "—"}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {e.quantity != null ? (
                            <span className="font-mono font-bold">{e.quantity > 0 ? `+${e.quantity}` : e.quantity}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{e.performedBy || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {e.metadata ? JSON.stringify(e.metadata) : "—"}
                        </TableCell>
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
