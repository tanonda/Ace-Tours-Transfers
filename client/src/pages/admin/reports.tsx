import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchRevenue, fetchBookingStats, fetchBookings } from "@/lib/api";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Download, TrendingUp, CreditCard, DollarSign, Calendar, Users, FileText, Printer, Search } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from "recharts";

export default function AdminReports() {
  const { t } = useTranslation();
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().split("T")[0]; });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [guestDate, setGuestDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  const { data: revenueData = [], isLoading: isLoadingRevenue } = useQuery({ queryKey: ["revenue"], queryFn: fetchRevenue });
  const { data: stats, isLoading: isLoadingStats } = useQuery({ queryKey: ["stats"], queryFn: fetchBookingStats });
  const { data: allBookings = [], isLoading: isLoadingBookings } = useQuery({ queryKey: ["bookings"], queryFn: () => fetchBookings() });

  const fmtCurrency = (val: number) => `${Math.round(val).toLocaleString()} VT`;

  const filteredBookings = allBookings.filter((b: any) => {
    if (!b.createdAt) return false;
    const bookingDate = new Date(b.createdAt).toISOString().split("T")[0];
    const inRange = bookingDate >= dateFrom && bookingDate <= dateTo;
    const matchStatus = statusFilter === "all" || b.status === statusFilter;
    const matchSearch = !search || b.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      b.tourName?.toLowerCase().includes(search.toLowerCase()) ||
      b.customerEmail?.toLowerCase().includes(search.toLowerCase());
    return inRange && matchStatus && matchSearch;
  });

  const guestManifest = allBookings.filter((b: any) => {
    if (!b.createdAt) return false;
    return new Date(b.createdAt).toISOString().split("T")[0] === guestDate && b.status !== "cancelled";
  });

  // Group daily revenue by month for the chart
  const monthlyRevenue = revenueData.reduce((acc: any[], curr: any) => {
    if (!curr.date) return acc;
    const dateStr = new Date(curr.date);
    const month = dateStr.toLocaleString('en-US', { month: 'short' }) + ' ' + dateStr.getFullYear();
    const existing = acc.find(m => m.month === month);
    if (existing) {
      existing.total += ((curr.amount || 0) / 100);
    } else {
      acc.push({ month, total: ((curr.amount || 0) / 100) });
    }
    return acc;
  }, []);

  const totalRevenue = stats?.totalRevenueCents ? stats.totalRevenueCents / 100 : allBookings.reduce((sum: number, b: any) => {
    if (b.status === 'confirmed' || b.status === 'completed') {
      return sum + ((b.totalAmountCents || 0) / 100);
    }
    return sum;
  }, 0);

  const pendingPaymentsAmount = stats?.pendingRevenueCents ? stats.pendingRevenueCents / 100 : allBookings.reduce((sum: number, b: any) => {
    if (b.status === 'pending') {
      return sum + ((b.totalAmountCents || 0) / 100);
    }
    return sum;
  }, 0);

  const averageMonthly = monthlyRevenue.length ? totalRevenue / monthlyRevenue.length : totalRevenue;
  const filteredRevenue = filteredBookings.reduce((sum: number, b: any) => {
    return sum + ((b.totalAmountCents || 0) / 100);
  }, 0);

  const exportBookingCSV = () => {
    const rows = [
      ["Booking ID", "Customer", "Email", "Phone", "Tour", "Date", "Adults", "Children", "Infants", "Pets", "Amount", "Status"],
      ...filteredBookings.map((b: any) => [
        `ACT-${(b.id || "").replace(/^book_/i, "").replace(/-/g, "").slice(0, 8).toUpperCase()}`,
        b.customerName || "", b.customerEmail || "", b.customerPhone || "",
        b.tourName || "", b.date || "", b.guests || "", b.childGuests || "", b.infantGuests || "", b.petGuests || "",
        b.amount || "", b.status || "",
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `bookings-report-${dateFrom}-to-${dateTo}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const exportGuestManifest = () => {
    const rows = [
      ["#", "Customer Name", "Email", "Phone", "Tour/Transfer", "Adults", "Children", "Infants", "Status", "Amount", "Notes"],
      ...guestManifest.map((b: any, i: number) => [
        String(i + 1), b.customerName || "", b.customerEmail || "", b.customerPhone || "",
        b.tourName || "", b.guests || "", b.childGuests || "", b.infantGuests || "",
        b.status || "", b.amount || "", b.notes || ""
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `guest-manifest-${guestDate}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const printManifest = () => {
    const w = window.open("", "_blank", "width=950,height=700");
    if (!w) return;
    const rows = guestManifest.map((b: any, i: number) => `
      <tr>
        <td>${i + 1}</td><td>${b.customerName || ""}</td><td>${b.customerEmail || ""}</td>
        <td>${b.customerPhone || ""}</td><td>${b.tourName || ""}</td>
        <td>${b.guests || ""} adult${(b.childGuests || 0) > 0 ? ` / ${b.childGuests} child` : ""}</td>
        <td><span class="badge ${b.status}">${b.status}</span></td>
        <td>${b.amount || ""}</td>
      </tr>`).join("");
    w.document.write(`<!DOCTYPE html><html><head><title>Guest Manifest — ${guestDate}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#222}
        h1{color:#004165;margin:0 0 4px}p{margin:0 0 16px;color:#555;font-size:13px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{background:#004165;color:white;padding:8px 10px;text-align:left;font-weight:600}
        td{padding:7px 10px;border-bottom:1px solid #e5e7eb}
        tr:nth-child(even) td{background:#f9fafb}
        .badge{padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600}
        .confirmed{background:#dcfce7;color:#166534}.pending{background:#fef9c3;color:#854d0e}
        .completed{background:#dbeafe;color:#1e40af}
        @media print{button,a{display:none!important}}
        .footer{margin-top:24px;font-size:11px;color:#999;border-top:1px solid #e5e7eb;padding-top:12px}
      </style></head>
      <body>
        <h1>Ace Tours & Transfers — Guest Manifest</h1>
        <p><strong>Date:</strong> ${new Date(guestDate).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} &nbsp;|&nbsp; <strong>Total Guests:</strong> ${guestManifest.length}</p>
        <table>
          <thead><tr><th>#</th><th>Guest Name</th><th>Email</th><th>Phone</th><th>Tour / Transfer</th><th>Pax</th><th>Status</th><th>Amount</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">Printed: ${new Date().toLocaleString('en-AU')} &nbsp;|&nbsp; Ace Tours & Transfers Vanuatu &nbsp;|&nbsp; Confidential — Staff Use Only</div>
        <script>window.onload=()=>window.print()<\/script>
      </body></html>`);
    w.document.close();
  };

  if (isLoadingRevenue || isLoadingStats) {
    return (
      <DashboardLayout type="admin">
        <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout type="admin">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("dashboard.reports")}</h1>
            <p className="text-sm text-muted-foreground">Financial overview, booking reports, and guest manifests</p>
          </div>
        </div>

        {/* KPI Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue", value: fmtCurrency(totalRevenue), sub: "Confirmed/Completed", icon: DollarSign, color: "bg-yellow-500/15 text-yellow-600" },
            { label: "Total Bookings", value: stats?.total || 0, sub: `${stats?.confirmed} confirmed`, icon: Calendar, color: "bg-blue-500/15 text-blue-600" },
            { label: "Monthly Avg Revenue", value: fmtCurrency(averageMonthly), sub: `Across ${monthlyRevenue.length || 1} month${monthlyRevenue.length > 1 ? 's' : ''}`, icon: TrendingUp, color: "bg-green-500/15 text-green-600" },
            { label: "Pending Payments", value: fmtCurrency(pendingPaymentsAmount), sub: stats?.pending ? `${stats.pending} booking${stats.pending > 1 ? 's' : ''} awaiting payment` : "No pending payments", icon: CreditCard, color: pendingPaymentsAmount > 0 ? "bg-red-500/15 text-red-500" : "bg-green-500/15 text-green-600" },
          ].map(kpi => (
            <Card key={kpi.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${kpi.color}`}>
                    <kpi.icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold">{kpi.value}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mt-0.5">{kpi.label}</div>
                <div className="text-xs text-primary mt-1">{kpi.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="revenue">
          <TabsList>
            <TabsTrigger value="revenue">Revenue Chart</TabsTrigger>
            <TabsTrigger value="bookings">Booking Report</TabsTrigger>
            <TabsTrigger value="manifest">Guest Manifest</TabsTrigger>
          </TabsList>

          {/* Revenue Chart */}
          <TabsContent value="revenue" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Over Time</CardTitle>
                <CardDescription>Monthly revenue trend — all time</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                      <Tooltip cursor={{ fill: 'transparent' }} formatter={(val: number) => [fmtCurrency(val), "Revenue"]}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Booking Report */}
          <TabsContent value="bookings" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div><CardTitle>Booking Report</CardTitle><CardDescription>Filter, search, and export bookings</CardDescription></div>
                  <Button variant="outline" size="sm" onClick={exportBookingCSV} disabled={filteredBookings.length === 0}>
                    <Download className="h-4 w-4 mr-2" /> Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filter bar */}
                <div className="flex flex-wrap gap-3 mb-4 p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">From</Label>
                    <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40 h-8" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">To</Label>
                    <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40 h-8" />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 w-44" />
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <Badge variant="secondary">{filteredBookings.length} bookings</Badge>
                    <Badge variant="outline" className="text-green-600">{fmtCurrency(filteredRevenue)}</Badge>
                  </div>
                </div>

                {isLoadingBookings ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin h-5 w-5" /></div>
                ) : filteredBookings.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No bookings match your filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Booking ID</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Tour / Transfer</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Pax</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBookings.map((b: any) => (
                          <TableRow key={b.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedBooking(b)}>
                            <TableCell className="font-mono text-xs">
                              ACT-{(b.id || "").replace(/^book_/i, "").replace(/-/g, "").slice(0, 8).toUpperCase()}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-medium">{b.customerName}</div>
                              <div className="text-xs text-muted-foreground">{b.customerEmail}</div>
                            </TableCell>
                            <TableCell className="text-sm max-w-[160px] truncate">{b.tourName}</TableCell>
                            <TableCell className="text-sm">{b.date}</TableCell>
                            <TableCell className="text-sm">{b.guests}</TableCell>
                            <TableCell className="text-sm font-medium">{b.amount}</TableCell>
                            <TableCell>
                              <Badge className={
                                b.status === "confirmed" ? "bg-green-100 text-green-800" :
                                  b.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                                    b.status === "completed" ? "bg-blue-100 text-blue-800" :
                                      "bg-red-100 text-red-800"
                              }>{b.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedBooking(b)}>View</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Guest Manifest */}
          <TabsContent value="manifest" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Guest Manifest</CardTitle>
                    <CardDescription>Full daily guest list — ideal for guides and operations</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={printManifest} disabled={guestManifest.length === 0}>
                      <Printer className="h-4 w-4 mr-2" /> Print
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportGuestManifest} disabled={guestManifest.length === 0}>
                      <Download className="h-4 w-4 mr-2" /> Export CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4 p-4 bg-muted/30 rounded-lg flex-wrap">
                  <Label className="text-sm whitespace-nowrap">Date</Label>
                  <Input type="date" value={guestDate} onChange={e => setGuestDate(e.target.value)} className="w-44 h-8" />
                  <div className="flex gap-2 ml-auto">
                    <Badge variant="secondary">{guestManifest.length} guests</Badge>
                    <Badge variant="outline" className="text-green-600">
                      {fmtCurrency(guestManifest.reduce((s: number, b: any) => s + (parseFloat(String(b.amount).replace(/[^0-9.]/g, '')) || 0), 0))}
                    </Badge>
                  </div>
                </div>

                {isLoadingBookings ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin h-5 w-5" /></div>
                ) : guestManifest.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>No bookings on {guestDate}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Guest Name</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Tour / Transfer</TableHead>
                          <TableHead>Pax Breakdown</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {guestManifest.map((b: any, i: number) => (
                          <TableRow key={b.id} className="hover:bg-muted/20">
                            <TableCell className="text-muted-foreground text-sm font-bold">{i + 1}</TableCell>
                            <TableCell>
                              <div className="font-medium text-sm">{b.customerName}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{b.customerEmail}</div>
                              {b.customerPhone && <div className="text-xs text-muted-foreground">{b.customerPhone}</div>}
                            </TableCell>
                            <TableCell className="text-sm max-w-[140px] truncate">{b.tourName}</TableCell>
                            <TableCell>
                              <div className="text-sm space-y-0.5">
                                <div>{b.guests || 0} adult{(b.guests || 0) !== 1 ? 's' : ''}</div>
                                {(b.childGuests || 0) > 0 && <div className="text-xs text-muted-foreground">{b.childGuests} child</div>}
                                {(b.infantGuests || 0) > 0 && <div className="text-xs text-muted-foreground">{b.infantGuests} infant</div>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={
                                b.status === "confirmed" ? "bg-green-100 text-green-800" :
                                  b.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                                    "bg-blue-100 text-blue-800"
                              }>{b.status}</Badge>
                            </TableCell>
                            <TableCell className="font-medium text-sm">{b.amount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Booking Detail Modal */}
      <Dialog open={!!selectedBooking} onOpenChange={open => !open && setSelectedBooking(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Booking ID", `ACT-${(selectedBooking.id || "").replace(/^book_/i, "").replace(/-/g, "").slice(0, 8).toUpperCase()}`],
                  ["Status", selectedBooking.status],
                  ["Customer", selectedBooking.customerName],
                  ["Email", selectedBooking.customerEmail || "—"],
                  ["Phone", selectedBooking.customerPhone || "—"],
                  ["Tour", selectedBooking.tourName],
                  ["Date", selectedBooking.date],
                  ["Adults", selectedBooking.guests],
                  ["Children", selectedBooking.childGuests || 0],
                  ["Infants", selectedBooking.infantGuests || 0],
                  ["Amount", selectedBooking.amount],
                  ["Created", selectedBooking.createdAt ? new Date(selectedBooking.createdAt).toLocaleDateString('en-AU') : "—"],
                ].map(([label, val]) => (
                  <div key={String(label)} className="bg-muted/40 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                    <div className="font-semibold text-sm">{val}</div>
                  </div>
                ))}
              </div>
              {selectedBooking.notes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                  <strong>Notes:</strong> {selectedBooking.notes}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
