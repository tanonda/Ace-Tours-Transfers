import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTours, fetchBlackoutDates, createBlackoutDate, deleteBlackoutDate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function AdminBlackouts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState<string>("");

  const { data: tours = [] } = useQuery({ queryKey: ["/api/tours"], queryFn: fetchTours });

  const { data: blackouts = [], refetch } = useQuery({
    queryKey: ["blackouts", productId],
    queryFn: () => fetchBlackoutDates(productId),
    enabled: Boolean(productId),
  });

  const handleCreate = async () => {
    if (!productId || !date) return toast({ title: 'Missing', description: 'Product and date required' });
    try {
      await createBlackoutDate({ productId, date, reason });
      queryClient.invalidateQueries({ queryKey: ["blackouts", productId] });
      toast({ title: 'Created', description: 'Blackout date created' });
      setReason('');
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to create blackout' });
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBlackoutDate(id);
      queryClient.invalidateQueries({ queryKey: ["blackouts", productId] });
      toast({ title: 'Deleted', description: 'Blackout removed' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete blackout' });
      console.error(err);
    }
  };

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Blackout Dates</h1>
          <p className="text-muted-foreground">Manage blackout dates for tours and transfers</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Blackout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 items-end">
              <div className="w-64">
                <label className="block text-sm mb-1">Product</label>
                <select className="w-full p-2 border rounded" value={productId} onChange={e => setProductId(e.target.value)}>
                  <option value="">-- Select Product --</option>
                  {tours.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.title || t.name || t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Date</label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="block text-sm mb-1">Reason (optional)</label>
                <Input value={reason} onChange={e => setReason(e.target.value)} />
              </div>
              <Button onClick={handleCreate}>Create</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Existing Blackouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blackouts.length === 0 ? (
                    <TableRow><TableCell colSpan={4}>No blackout dates</TableCell></TableRow>
                  ) : (
                    blackouts.map((b: any) => (
                      <TableRow key={b.id}>
                        <TableCell>{tours.find((t: any) => t.id === b.productId)?.title || b.productId}</TableCell>
                        <TableCell>{new Date(b.date).toLocaleDateString()}</TableCell>
                        <TableCell>{b.reason}</TableCell>
                        <TableCell><Button variant="ghost" onClick={() => handleDelete(b.id)}>Delete</Button></TableCell>
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
