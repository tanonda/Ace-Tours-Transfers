import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, AlertCircle, Info, Landmark, Check, X, ShieldAlert, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type StalePayment = {
    id: string;
    bookingId: string;
    amount: number;
    currency: string;
    status: string;
    gatewayId: string;
    gatewayReference: string | null;
    createdAt: string;
    lastReconciledAt: string | null;
    reconciliationAttempts: number | null;
};

export default function AdminReconciliation() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [syncingPaymentId, setSyncingPaymentId] = useState<string | null>(null);
    const [isBatchSyncing, setIsBatchSyncing] = useState(false);

    const { data: payments = [], isLoading } = useQuery<StalePayment[]>({
        queryKey: ["stale-payments"],
        queryFn: () => fetch("/api/admin/reconciliation/stale").then(res => res.json()),
    });

    const syncMutation = useMutation({
        mutationFn: async ({ id, note, forceStatus }: { id: string, note?: string, forceStatus?: string }) => {
            const res = await fetch(`/api/admin/reconciliation/sync/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ note, forceStatus }),
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: (updatedPayment) => {
            toast({
                title: "Payment Synced",
                description: `Status updated to ${updatedPayment.status}`,
            });
            queryClient.invalidateQueries({ queryKey: ["stale-payments"] });
            queryClient.invalidateQueries({ queryKey: ["stats"] });
        },
        onError: (err: any) => {
            toast({
                title: "Sync Failed",
                description: err.message || "Failed to sync payment with gateway",
                variant: "destructive",
            });
        },
        onSettled: () => {
            setSyncingPaymentId(null);
        }
    });

    const batchSyncMutation = useMutation({
        mutationFn: async (limit: number = 50) => {
            const res = await fetch("/api/admin/reconciliation/batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ limit }),
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: (data) => {
            toast({
                title: "Batch Sync Complete",
                description: data.message,
            });
            queryClient.invalidateQueries({ queryKey: ["stale-payments"] });
            queryClient.invalidateQueries({ queryKey: ["stats"] });
        },
        onError: (err: any) => {
            toast({
                title: "Batch Sync Failed",
                description: err.message || "Failed to run batch reconciliation",
                variant: "destructive",
            });
        },
        onSettled: () => {
            setIsBatchSyncing(false);
        }
    });

    const handleSync = (paymentId: string) => {
        setSyncingPaymentId(paymentId);
        syncMutation.mutate({ id: paymentId, note: "Admin manual sync trigger" });
    };

    const handleForceComplete = (paymentId: string) => {
        if (!confirm("Are you sure you want to FORCE complete this payment? This will confirm the booking and send tickets.")) return;
        setSyncingPaymentId(paymentId);
        syncMutation.mutate({ id: paymentId, note: "Admin forced completion", forceStatus: "completed" });
    };

    const handleForceFail = (paymentId: string) => {
        if (!confirm("Are you sure you want to Mark this payment as FAILED? This will cancel the booking.")) return;
        setSyncingPaymentId(paymentId);
        syncMutation.mutate({ id: paymentId, note: "Admin forced failure", forceStatus: "failed" });
    };

    const handleBatchSync = () => {
        setIsBatchSyncing(true);
        batchSyncMutation.mutate(50);
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return "Never";
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    return (
        <DashboardLayout type="admin">
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <Landmark className="h-6 w-6 text-muted-foreground" />
                            Payment Reconciliation
                        </h1>
                        <p className="text-sm text-muted-foreground">Monitor and resolve payments stuck in processing states.</p>
                    </div>
                    <Button
                        onClick={handleBatchSync}
                        disabled={isBatchSyncing || payments.length === 0}
                        className="flex items-center gap-2"
                    >
                        {isBatchSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Run Batch Sync
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Stale Processing Payments</CardTitle>
                        <CardDescription>
                            Payments that have been in 'processing' status longer than expected and may require manual synchronization with the gateway.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
                            </div>
                        ) : payments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-muted/20 border-border">
                                <Info className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                                <h3 className="text-lg font-medium text-foreground mb-1">No Stale Payments</h3>
                                <p className="text-sm text-muted-foreground max-w-sm">
                                    Great job! There are currently no payments stuck in a processing state that require your attention.
                                </p>
                            </div>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Payment ID</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Created At</TableHead>
                                            <TableHead>Last Sync Attempt</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {payments.map((payment) => (
                                            <TableRow key={payment.id}>
                                                <TableCell className="font-medium text-xs font-mono">
                                                    {payment.id.split('-')[0]}...
                                                    <div className="text-[10px] text-muted-foreground block mt-1">
                                                        Ref: {payment.gatewayReference || 'N/A'}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {payment.currency.toUpperCase()} {(payment.amount / 100).toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {formatDate(payment.createdAt)}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {formatDate(payment.lastReconciledAt)}
                                                    {payment.reconciliationAttempts ? (
                                                        <Badge variant="outline" className="ml-2 text-[10px]">
                                                            {payment.reconciliationAttempts} tries
                                                        </Badge>
                                                    ) : null}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-transparent">
                                                        {payment.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                disabled={syncingPaymentId === payment.id || isBatchSyncing}
                                                            >
                                                                {syncingPaymentId === payment.id ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                                ) : (
                                                                    <RefreshCw className="h-4 w-4 mr-2" />
                                                                )}
                                                                Actions <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48">
                                                            <DropdownMenuLabel>Reconcile Payment</DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleSync(payment.id)}>
                                                                <RefreshCw className="h-4 w-4 mr-2" /> Auto Sync
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleForceComplete(payment.id)} className="text-green-600 focus:text-green-600 focus:bg-green-50">
                                                                <Check className="h-4 w-4 mr-2" /> Force Complete
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleForceFail(payment.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                                                <X className="h-4 w-4 mr-2" /> Force Fail
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {payments.length > 0 && (
                            <div className="mt-4 p-4 rounded-lg bg-blue-50/50 border border-blue-100 flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                                <div className="text-sm text-blue-800">
                                    <p className="font-medium mb-1">How Reconciliation Works</p>
                                    <p>
                                        Syncing a payment will query the provider (e.g., Stripe, PayPal) for the real-time status of the transaction.
                                        If the gateway reports the payment was successful, the system will automatically confirm the booking and send the confirmation email to the guest.
                                    </p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
