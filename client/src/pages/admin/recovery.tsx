import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  ShieldAlert, RotateCcw, CheckCircle2, AlertTriangle, Search,
  RefreshCcw, FileSearch, CheckCircle, XCircle, Activity,
  AlertCircle, Wrench, Eye, RotateCcw as Reset, Info
} from "lucide-react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiRequest } from "@/lib/queryClient";

interface IntegrityStatus {
  isSafe: boolean;
  message: string;
  details?: { migrationCount?: number; driftDetected: boolean; };
}

interface InconsistencyEntry {
  type: 'orphaned_payment' | 'orphaned_booking' | 'inventory_mismatch' | 'payment_without_inventory';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  bookingId?: string;
  paymentId?: string;
  description: string;
  recommendedAction: { label: string; description: string; };
}

interface DiffReport {
  summary: { totalIssues: number; };
  entries: InconsistencyEntry[];
}

const ISSUE_REMEDIATION: Record<string, { title: string; steps: string[]; actionLabel: string; }> = {
  orphaned_payment: {
    title: "Orphaned Payment",
    steps: [
      "1. Navigate to the payment record using the Payment ID below.",
      "2. Verify whether a corresponding booking was intended to be created.",
      "3. If yes: manually create a booking and link the payment ID.",
      "4. If no: void the payment record in your payment gateway dashboard.",
      "5. Mark this entry as resolved once complete.",
    ],
    actionLabel: "Void Payment"
  },
  orphaned_booking: {
    title: "Orphaned Booking",
    steps: [
      "1. Open the booking using the Booking ID below.",
      "2. Check if a payment exists for this booking in your payment records.",
      "3. If payment exists: link the payment to the booking via the booking edit page.",
      "4. If no payment: cancel the booking or request payment from the customer.",
      "5. If booking should not exist: delete it from the bookings management page.",
    ],
    actionLabel: "Review Booking"
  },
  inventory_mismatch: {
    title: "Inventory Mismatch",
    steps: [
      "1. The confirmed booking count in the database does not match the inventory count.",
      "2. Click 'Repair Instance' to recalculate the count from actual booking records.",
      "3. This is a safe, non-destructive operation — it only corrects the count.",
      "4. After repair, verify the tour instance availability is correct in the calendar.",
    ],
    actionLabel: "Repair Instance"
  },
  payment_without_inventory: {
    title: "Payment Without Inventory",
    steps: [
      "1. A payment was received for a booking but no tour instance was created.",
      "2. Click 'Create Instance' to automatically create the missing tour instance.",
      "3. Verify the tour date and capacity are correct after creation.",
      "4. Notify operations team to confirm the booking is on the schedule.",
    ],
    actionLabel: "Create Instance"
  },
};

export default function RecoveryPage() {
  const queryClient = useQueryClient();
  const [confirmInput, setConfirmInput] = useState("");
  const [isConfirmingPlaybook, setIsConfirmingPlaybook] = useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<InconsistencyEntry | null>(null);

  const { data: status, isLoading: statusLoading } = useQuery<IntegrityStatus>({
    queryKey: ["/api/admin/recovery/status"],
  });
  const { data: report, isLoading: reportLoading, refetch: refetchReport } = useQuery<DiffReport>({
    queryKey: ["/api/admin/recovery/diff-report"],
  });

  const playbookMutation = useMutation({
    mutationFn: async (data: { confirm: string; dryRun: boolean }) => {
      const res = await apiRequest("POST", "/api/admin/recovery/run", data);
      return res.json();
    },
    onSuccess: () => {
      toast.success("Recovery playbook completed successfully.");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recovery/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recovery/diff-report"] });
      setIsConfirmingPlaybook(false);
      setConfirmInput("");
    },
    onError: (error: any) => toast.error(`Playbook failed: ${error.message}`),
  });

  const repairInstanceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/recovery/repair-instance/${id}`);
      return res.json();
    },
    onSuccess: () => { toast.success("Inventory repaired for instance."); refetchReport(); },
    onError: () => toast.error("Repair failed."),
  });

  const handleRunPlaybook = (dryRun = false) => {
    if (confirmInput !== "I_AM_SURE") { toast.error("Please type 'I_AM_SURE' to proceed."); return; }
    playbookMutation.mutate({ confirm: confirmInput, dryRun });
  };

  const getSeverityConfig = (severity: string) => ({
    CRITICAL: { variant: "destructive" as const, color: "bg-red-500/15 text-red-600 border-red-500/30", dot: "bg-red-500" },
    WARNING: { variant: "outline" as const, color: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30", dot: "bg-yellow-500" },
    INFO: { variant: "secondary" as const, color: "bg-blue-500/15 text-blue-600 border-blue-500/30", dot: "bg-blue-500" },
  }[severity] || { variant: "secondary" as const, color: "bg-gray-100 text-gray-600", dot: "bg-gray-400" });

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recovery Operations</h1>
          <p className="text-muted-foreground text-sm mt-1">Deterministic disaster recovery and financial reconciliation centre.</p>
        </div>

        {status && !status.isSafe && (
          <Alert variant="destructive" className="animate-in fade-in">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>System Integrity Compromised</AlertTitle>
            <AlertDescription>{status.message} Run the recovery playbook to restore operations.</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Integrity Guard */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" /> Integrity Guard
              </CardTitle>
              <CardDescription>Live database state verification.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Status</span>
                {statusLoading ? (
                  <RefreshCcw className="h-4 w-4 animate-spin" />
                ) : (
                  <Badge variant={status?.isSafe ? "outline" : "destructive"}>
                    {status?.isSafe ? "✓ Healthy" : "⚠ Violation"}
                  </Badge>
                )}
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Migrations Applied</span>
                <span className="font-mono text-xs">{status?.details?.migrationCount ?? "—"}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Issues Found</span>
                <span className={`font-bold text-sm ${(report?.summary.totalIssues || 0) > 0 ? "text-red-500" : "text-green-600"}`}>
                  {report?.summary.totalIssues ?? 0}
                </span>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/recovery/status"] })}>
                <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Re-Scan
              </Button>
            </CardFooter>
          </Card>

          {/* Recovery Playbook */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <RotateCcw className="h-4 w-4 text-primary" /> Recovery Playbook
              </CardTitle>
              <CardDescription>Automated reconstruction of inventory and reconciliation of state.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Executing the playbook will:</p>
                <ul className="list-disc list-inside space-y-0.5 mt-1 pl-2">
                  <li>Verify schema consistency against migrations.</li>
                  <li>Recalculate all <code className="text-xs bg-muted px-1 rounded">tour_instances.confirmed_count</code> from bookings.</li>
                  <li>Generate a fresh inconsistency report.</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Dialog open={isConfirmingPlaybook} onOpenChange={setIsConfirmingPlaybook}>
                <DialogTrigger asChild>
                  <Button className="flex-1" variant="destructive" disabled={playbookMutation.isPending}>
                    Run Discovery & Repair
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Recovery Action</DialogTitle>
                    <DialogDescription>
                      High-privilege operation. Type <strong>I_AM_SURE</strong> to confirm.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Input placeholder="Type I_AM_SURE" value={confirmInput} onChange={e => setConfirmInput(e.target.value)} />
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsConfirmingPlaybook(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={() => handleRunPlaybook()}
                      disabled={confirmInput !== "I_AM_SURE" || playbookMutation.isPending}>
                      {playbookMutation.isPending ? "Executing..." : "Execute Recovery"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="outline" onClick={() => handleRunPlaybook(true)}
                disabled={playbookMutation.isPending || confirmInput !== "I_AM_SURE"}>
                Dry Run
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Reset Dashboard — visible and documented */}
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-orange-700">
              <Reset className="h-4 w-4" /> Reset Admin Dashboards
            </CardTitle>
            <CardDescription>
              Use this to clear cached dashboard data and force a fresh load from the database. Useful after a major data import, bulk edit, or if the dashboard displays stale information.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>This action will:</p>
            <ul className="list-disc list-inside pl-2 space-y-0.5 mt-1">
              <li>Clear all cached query data in the browser (bookings, stats, tours, analytics).</li>
              <li>Force a fresh API call on next page load for all dashboards.</li>
              <li>Not delete any database records — data is only refreshed, not removed.</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Dialog open={isConfirmingReset} onOpenChange={setIsConfirmingReset}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-orange-500/40 text-orange-700 hover:bg-orange-50">
                  <Reset className="h-4 w-4 mr-2" /> Reset Dashboards
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reset Admin Dashboards</DialogTitle>
                  <DialogDescription>
                    This clears all browser-cached query data and forces a fresh reload from the server. No database records will be deleted.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsConfirmingReset(false)}>Cancel</Button>
                  <Button
                    onClick={() => {
                      queryClient.clear();
                      setIsConfirmingReset(false);
                      toast.success("Dashboard cache cleared. All data will reload fresh.");
                    }}
                    className="bg-orange-600 hover:bg-orange-700 text-white">
                    <Reset className="h-4 w-4 mr-2" /> Clear & Reset
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>

        {/* Manual Review Queue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSearch className="h-4 w-4 text-primary" /> Manual Review Queue
            </CardTitle>
            <CardDescription>
              {report?.summary.totalIssues || 0} issue(s) requiring human intervention. Click any row for detailed remediation steps.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reportLoading ? (
              <div className="flex justify-center p-8"><RefreshCcw className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : !report?.entries.length ? (
              <div className="text-center p-8 bg-muted/30 rounded-lg">
                <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
                <p className="font-medium text-muted-foreground">No inconsistencies detected. System state is clean.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Severity</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>IDs</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.entries.map((entry, i) => {
                    const sc = getSeverityConfig(entry.severity);
                    return (
                      <TableRow key={i} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedIssue(entry)}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
                            <Badge variant={sc.variant} className="text-xs">{entry.severity}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-sm capitalize">{entry.type.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[240px]">{entry.description}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {entry.bookingId && <div>BK: {entry.bookingId.slice(0,12)}</div>}
                          {entry.paymentId && <div>PY: {entry.paymentId.slice(0,12)}</div>}
                        </TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectedIssue(entry)}>
                              <Eye className="h-3 w-3 mr-1" /> Details
                            </Button>
                            {entry.type === 'inventory_mismatch' && entry.bookingId && (
                              <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => repairInstanceMutation.mutate(entry.bookingId!)}
                                disabled={repairInstanceMutation.isPending}>
                                <Wrench className="h-3 w-3 mr-1" /> Repair
                              </Button>
                            )}
                            {entry.type === 'payment_without_inventory' && entry.bookingId && (
                              <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => repairInstanceMutation.mutate(entry.bookingId!)}
                                disabled={repairInstanceMutation.isPending}>
                                <Wrench className="h-3 w-3 mr-1" /> Create Instance
                              </Button>
                            )}
                            {(entry.type === 'orphaned_payment' || entry.type === 'orphaned_booking') && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectedIssue(entry)}>
                                <Info className="h-3 w-3 mr-1" /> Review
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Issue Detail Dialog */}
      <Dialog open={!!selectedIssue} onOpenChange={open => !open && setSelectedIssue(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              {selectedIssue ? ISSUE_REMEDIATION[selectedIssue.type]?.title || selectedIssue.type.replace(/_/g, ' ') : ''}
            </DialogTitle>
            <DialogDescription>
              Detailed information and step-by-step remediation guide.
            </DialogDescription>
          </DialogHeader>
          {selectedIssue && (
            <div className="space-y-4">
              {/* Severity + Type */}
              <div className="flex items-center gap-3">
                <Badge variant={getSeverityConfig(selectedIssue.severity).variant}>
                  {selectedIssue.severity}
                </Badge>
                <span className="text-sm text-muted-foreground capitalize">{selectedIssue.type.replace(/_/g, ' ')}</span>
              </div>

              {/* Description */}
              <div className="bg-muted/40 rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Issue Description</div>
                <p className="text-sm text-foreground">{selectedIssue.description}</p>
              </div>

              {/* Affected IDs */}
              {(selectedIssue.bookingId || selectedIssue.paymentId) && (
                <div className="grid grid-cols-2 gap-3">
                  {selectedIssue.bookingId && (
                    <div className="bg-muted/40 rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">Booking ID</div>
                      <div className="font-mono text-xs text-foreground">{selectedIssue.bookingId}</div>
                    </div>
                  )}
                  {selectedIssue.paymentId && (
                    <div className="bg-muted/40 rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">Payment ID</div>
                      <div className="font-mono text-xs text-foreground">{selectedIssue.paymentId}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Remediation steps */}
              <div className="border border-blue-500/20 bg-blue-500/5 rounded-lg p-4">
                <div className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-blue-500" /> How to Fix
                </div>
                <div className="space-y-2">
                  {(ISSUE_REMEDIATION[selectedIssue.type]?.steps || [
                    "1. Review the affected records using the IDs above.",
                    `2. Recommended action: ${selectedIssue.recommendedAction.label}`,
                    `3. ${selectedIssue.recommendedAction.description}`,
                  ]).map((step, i) => (
                    <p key={i} className="text-sm text-muted-foreground leading-relaxed">{step}</p>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedIssue(null)}>Close</Button>
            {selectedIssue?.type === 'inventory_mismatch' && selectedIssue.bookingId && (
              <Button className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => { repairInstanceMutation.mutate(selectedIssue.bookingId!); setSelectedIssue(null); }}
                disabled={repairInstanceMutation.isPending}>
                <Wrench className="h-4 w-4 mr-2" /> Repair Instance
              </Button>
            )}
            {selectedIssue?.type === 'payment_without_inventory' && selectedIssue.bookingId && (
              <Button className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => { repairInstanceMutation.mutate(selectedIssue.bookingId!); setSelectedIssue(null); }}
                disabled={repairInstanceMutation.isPending}>
                <Wrench className="h-4 w-4 mr-2" /> Create Instance
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
