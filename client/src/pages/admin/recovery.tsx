import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  ShieldAlert, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  RefreshCcw,
  FileSearch,
  CheckCircle,
  XCircle,
  Activity
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Alert, 
  AlertDescription, 
  AlertTitle 
} from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiRequest } from "@/lib/queryClient";

interface IntegrityStatus {
  isSafe: boolean;
  message: string;
  details?: {
    migrationCount?: number;
    driftDetected: boolean;
  };
}

interface InconsistencyEntry {
  type: 'orphaned_payment' | 'orphaned_booking' | 'inventory_mismatch' | 'payment_without_inventory';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  bookingId?: string;
  paymentId?: string;
  description: string;
  recommendedAction: {
    label: string;
    description: string;
  };
}

interface DiffReport {
  summary: {
    totalIssues: number;
  };
  entries: InconsistencyEntry[];
}

export default function RecoveryPage() {
  const queryClient = useQueryClient();
  const [confirmInput, setConfirmInput] = useState("");
  const [isConfirmingPlaybook, setIsConfirmingPlaybook] = useState(false);

  // 1. Fetch System Integrity Status
  const { data: status, isLoading: statusLoading } = useQuery<IntegrityStatus>({
    queryKey: ["/api/admin/recovery/status"],
  });

  // 2. Fetch Diff Report
  const { data: report, isLoading: reportLoading, refetch: refetchReport } = useQuery<DiffReport>({
    queryKey: ["/api/admin/recovery/diff-report"],
  });

  // 3. Mutation: Run Recovery Playbook
  const playbookMutation = useMutation({
    mutationFn: async (data: { confirm: string; dryRun: boolean }) => {
      const res = await apiRequest("POST", "/api/admin/recovery/run", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast.success("Recovery playbook completed successfully.");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recovery/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recovery/diff-report"] });
      setIsConfirmingPlaybook(false);
      setConfirmInput("");
    },
    onError: (error: any) => {
      toast.error(`Playbook failed: ${error.message}`);
    }
  });

  // 4. Mutation: Repair Specific Instance
  const repairInstanceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/recovery/repair-instance/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast.success("Inventory repaired for instance.");
      refetchReport();
    }
  });

  const handleRunPlaybook = (dryRun: boolean = false) => {
    if (confirmInput !== "I_AM_SURE") {
      toast.error("Please type 'I_AM_SURE' to proceed.");
      return;
    }
    playbookMutation.mutate({ confirm: confirmInput, dryRun });
  };

  const getSeverityColor = (severity: string): "destructive" | "outline" | "secondary" | "default" => {
    switch (severity) {
      case 'CRITICAL': return 'destructive';
      case 'WARNING': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <DashboardLayout type="admin">
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Recovery Operations</h1>
        <p className="text-muted-foreground">Deterministic disaster recovery and financial reconciliation center.</p>
      </div>

      {/* 1. Integrity Banner */}
      {status && !status.isSafe && (
        <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-4 duration-500">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>System Integrity Compromised</AlertTitle>
          <AlertDescription>
            {status.message} Mutations are currently blocked. Run the recovery playbook to restore operations.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* 2. System Guard Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Integrity Guard
            </CardTitle>
            <CardDescription>Live database state verification.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Status</span>
              {statusLoading ? (
                <RefreshCcw className="h-4 w-4 animate-spin" />
              ) : (
                <Badge variant={status?.isSafe ? "outline" : "destructive"}>
                  {status?.isSafe ? "Healthy" : "Violation Detected"}
                </Badge>
              )}
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Migrations Applied</span>
              <span className="font-mono">{status?.details?.migrationCount ?? "--"}</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/recovery/status"] })}>
              Re-Scan Database
            </Button>
          </CardFooter>
        </Card>

        {/* 3. Playbook Control Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              Recovery Playbook
            </CardTitle>
            <CardDescription>Automated reconstruction of inventory and reconciliation of state.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Executing the playbook will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Verify schema consistency against migrations.</li>
                <li>Recalculate all <code>tour_instances.confirmed_count</code> from bookings.</li>
                <li>Generate a fresh inconsistency report.</li>
              </ul>
            </p>
          </CardContent>
          <CardFooter className="gap-3">
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
                    This is a high-privilege operation that will modify core inventory state.
                    Please type <strong>I_AM_SURE</strong> to confirm.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Input 
                    placeholder="Type I_AM_SURE" 
                    value={confirmInput} 
                    onChange={(e) => setConfirmInput(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsConfirmingPlaybook(false)}>Cancel</Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => handleRunPlaybook()}
                    disabled={confirmInput !== "I_AM_SURE" || playbookMutation.isPending}
                  >
                    {playbookMutation.isPending ? "Executing..." : "Execute Post-Restore Recovery"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={() => handleRunPlaybook(true)} disabled={playbookMutation.isPending || confirmInput !== "I_AM_SURE"}>
              Dry Run
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* 4. Manual Review Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-primary" />
            Manual Review Queue
          </CardTitle>
          <CardDescription>
            {report?.summary.totalIssues || 0} issues requiring human intervention or verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reportLoading ? (
            <div className="flex justify-center p-8"><RefreshCcw className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : report?.entries.length === 0 ? (
            <div className="text-center p-8 bg-muted/30 rounded-lg">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
              <p className="font-medium text-muted-foreground">No inconsistencies detected. System state is clean.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Recommended Action</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report?.entries.map((entry, i: number) => (
                  <TableRow key={i}>
                    <TableCell><Badge variant={getSeverityColor(entry.severity)}>{entry.severity}</Badge></TableCell>
                    <TableCell className="font-medium capitalize">{entry.type.replace(/_/g, ' ')}</TableCell>
                    <TableCell>
                      <div className="text-sm">{entry.description}</div>
                      {entry.paymentId && <div className="text-xs text-muted-foreground mt-1">Payment: {entry.paymentId}</div>}
                      {entry.bookingId && <div className="text-xs text-muted-foreground">Booking: {entry.bookingId}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium">{entry.recommendedAction.label}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">{entry.recommendedAction.description}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.type === 'payment_without_inventory' && entry.bookingId && (
                        <Button size="sm" variant="outline" onClick={() => repairInstanceMutation.mutate(entry.bookingId!)}>
                          Repair
                        </Button>
                      )}
                      {entry.type === 'orphaned_payment' && (
                        <Button size="sm" variant="ghost">Review</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
    </DashboardLayout>
  );
}
