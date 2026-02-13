import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { fetchAuditLogs, fetchTours } from "@/lib/api";
import { Input } from "@/components/ui/input";

export default function AdminAuditLogs() {
  const [productId, setProductId] = useState<string>("");
  const [action, setAction] = useState<string>("");

  const { data: tours = [] } = useQuery({ queryKey: ["/api/tours"], queryFn: fetchTours });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["/api/admin/audit-log", productId, action],
    queryFn: () => fetchAuditLogs({ productId: productId || undefined, action: action || undefined, limit: 200 }),
  });

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Capacity Audit Log</h1>
          <p className="text-muted-foreground">Recent capacity-related events (holds, expiries, cancellations)</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="w-64">
                <label className="block text-sm mb-1">Product</label>
                <select className="w-full p-2 border rounded" value={productId} onChange={e => setProductId(e.target.value)}>
                  <option value="">-- Any --</option>
                  {tours.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.title || t.name || t.label}</option>
                  ))}
                </select>
              </div>
              <div className="w-64">
                <label className="block text-sm mb-1">Action</label>
                <Input value={action} onChange={e => setAction(e.target.value)} placeholder="booking_cancelled" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entries</CardTitle>
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
                    <TableRow><TableCell colSpan={6}>Loading...</TableCell></TableRow>
                  ) : entries.length === 0 ? (
                    <TableRow><TableCell colSpan={6}>No entries</TableCell></TableRow>
                  ) : entries.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell>{new Date(e.createdAt).toLocaleString()}</TableCell>
                      <TableCell>{e.action}</TableCell>
                      <TableCell>{tours.find((t: any) => t.id === e.productId)?.title || e.productId}</TableCell>
                      <TableCell>{e.quantity ?? ''}</TableCell>
                      <TableCell>{e.performedBy}</TableCell>
                      <TableCell>{e.metadata ? JSON.stringify(e.metadata) : ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
