import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTours, fetchBlackoutDates, createBlackoutDate, deleteBlackoutDate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Ban, Plus, Trash2, AlertTriangle, CalendarOff } from "lucide-react";

export default function AdminBlackouts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [newProductId, setNewProductId] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);

  const { data: tours = [] } = useQuery({ queryKey: ["/api/tours"], queryFn: fetchTours });

  const { data: blackouts = [] } = useQuery({
    queryKey: ["blackouts", selectedProductId],
    queryFn: () => fetchBlackoutDates(selectedProductId),
    enabled: Boolean(selectedProductId),
  });

  const handleCreate = async () => {
    if (!newProductId || !date) {
      return toast({ title: "Missing fields", description: "Please select a product and date.", variant: "destructive" });
    }
    setIsCreating(true);
    try {
      await createBlackoutDate({ productId: newProductId, date, reason: reason || undefined });
      queryClient.invalidateQueries({ queryKey: ["blackouts"] });
      toast({ title: "Blackout created", description: `${date} has been blocked.` });
      setReason("");
    } catch (err) {
      toast({ title: "Error", description: "Failed to create blackout date.", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string, dateStr: string) => {
    if (!confirm(`Remove blackout for ${dateStr}?`)) return;
    try {
      await deleteBlackoutDate(id);
      queryClient.invalidateQueries({ queryKey: ["blackouts"] });
      toast({ title: "Removed", description: "Blackout date has been removed." });
    } catch (err) {
      toast({ title: "Error", description: "Failed to remove blackout.", variant: "destructive" });
    }
  };

  // Count blackouts per product
  const productBlackoutCounts = tours.reduce((acc: Record<string, number>, t: any) => {
    acc[t.id] = 0;
    return acc;
  }, {});

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center">
              <Ban className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#004165]">Blackout Dates</h1>
              <p className="text-muted-foreground text-sm">Block specific dates from public booking</p>
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <span>Blackout dates immediately remove the selected date from the public availability calendar. Existing bookings on those dates are <strong>not</strong> automatically cancelled.</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Create Blackout Date
              </CardTitle>
              <CardDescription>Block a date for a specific product</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-product">Product *</Label>
                <Select value={newProductId} onValueChange={setNewProductId}>
                  <SelectTrigger id="new-product">
                    <SelectValue placeholder="Select a product…" />
                  </SelectTrigger>
                  <SelectContent>
                    {tours.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.title || t.name || t.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="blackout-date">Date *</Label>
                <Input
                  id="blackout-date"
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="blackout-reason">Reason <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="blackout-reason"
                  placeholder="e.g. Public holiday, maintenance, private event…"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
              </div>

              <Button
                onClick={handleCreate}
                disabled={isCreating || !newProductId || !date}
                className="w-full bg-[#004165] hover:bg-[#005580]"
              >
                {isCreating ? "Creating…" : (
                  <><Ban className="h-4 w-4 mr-2" /> Block This Date</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* View blackouts for a product */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarOff className="h-4 w-4" /> View Blackouts by Product
              </CardTitle>
              <CardDescription>Select a product to see its blocked dates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product to view…" />
                </SelectTrigger>
                <SelectContent>
                  {tours.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.title || t.name || t.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedProductId && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {blackouts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No blackout dates for this product.
                    </div>
                  ) : (
                    blackouts.map((b: any) => (
                      <div key={b.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg">
                        <div>
                          <div className="font-semibold text-sm text-red-900">
                            {new Date(b.date + 'T00:00:00').toLocaleDateString("en-AU", {
                              weekday: "short", day: "numeric", month: "long", year: "numeric"
                            })}
                          </div>
                          {b.reason && <div className="text-xs text-red-600 mt-0.5">{b.reason}</div>}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:text-red-700 hover:bg-red-100 h-8 w-8"
                          onClick={() => handleDelete(b.id, b.date)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* All blackouts table */}
        <Card>
          <CardHeader>
            <CardTitle>All Blackout Dates</CardTitle>
            <CardDescription>All blocked dates across products</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!selectedProductId ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                      Select a product above to view blackout dates
                    </TableCell>
                  </TableRow>
                ) : blackouts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                      No blackout dates found.
                    </TableCell>
                  </TableRow>
                ) : (
                  blackouts.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium text-sm">
                        {tours.find((t: any) => t.id === b.productId)?.title || b.productId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-medium">
                          {new Date(b.date + 'T00:00:00').toLocaleDateString("en-AU", {
                            weekday: "short", day: "numeric", month: "short", year: "numeric"
                          })}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{b.reason || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(b.id, b.date)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
