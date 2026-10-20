import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, AlertCircle, Info, Landmark, Check, X, ShieldAlert, ChevronDown, Wallet, Calendar, User, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateBooking } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import type { Booking } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
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

type StatementMatch = {
    bookingId: string;
    ref: string;
    customerName: string | null;
    lineNo: number;
    line: string;
    statementAmount: number | null;
    expectedAmount: number;
    updatedAt: string;
    status: "suggested" | "needs_review";
    reason?: "amount_mismatch" | "no_amount_column" | "unparseable_amount" | "duplicate_reference";
};
type StatementResult = { amountColumn: string | null; suggestions: StatementMatch[]; needsReview: StatementMatch[]; ignored: number };

const REVIEW_REASONS: Record<NonNullable<StatementMatch["reason"]>, string> = {
    amount_mismatch: "Amount differs",
    no_amount_column: "No amount column (add a header row)",
    unparseable_amount: "Amount cell unreadable",
    duplicate_reference: "Reference already matched",
};

// Vatu has no minor unit: amounts are whole vatu.
const vatu = (n: number | null) => (n === null ? "—" : `VT ${n.toLocaleString()}`);

export default function AdminReconciliation() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [syncingPaymentId, setSyncingPaymentId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [statement, setStatement] = useState<StatementResult | null>(null);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);

    const { data: payments = [], isLoading: isStaleLoading } = useQuery<StalePayment[]>({
        queryKey: ["stale-payments"],
        queryFn: () => fetch("/api/admin/reconciliation/stale").then(res => res.json()),
    });

    // The server picks the candidates: pending bookings with an open payment on an offline gateway.
    const { data: pendingOfflineBookings = [], isLoading: isBookingsLoading } = useQuery<Booking[]>({
        queryKey: ["statement-candidates"],
        queryFn: async () => {
            const res = await fetch("/api/admin/statement-matches/candidates");
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
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
            queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
            queryClient.invalidateQueries({ queryKey: ["statement-candidates"] });
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

    const updateBookingMutation = useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: any }) => updateBooking(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
            queryClient.invalidateQueries({ queryKey: ["statement-candidates"] });
            toast({ title: "Success", description: "Booking updated successfully." });
        },
        onError: (err) => {
            // The server's own message, e.g. "Couldn't reserve the seats for this booking. ..."
            toast({ title: "Error", description: apiErrorMessage(err, "Failed to update booking."), variant: "destructive" });
        },
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

    const handleConfirmSuggestion = async (match: StatementMatch) => {
        if (!confirm(`Confirm booking ACT-${match.ref} (${match.customerName ?? ""}) as paid ${vatu(match.statementAmount)}?`)) return;
        setConfirmingId(match.bookingId);
        try {
            const res = await fetch(`/api/admin/statement-matches/${match.bookingId}/confirm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ expectedUpdatedAt: match.updatedAt, statementAmount: match.statementAmount }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || "Failed to confirm the booking");
            setStatement((s) => s && { ...s, suggestions: s.suggestions.filter((m) => m.bookingId !== match.bookingId) });
            queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
            queryClient.invalidateQueries({ queryKey: ["statement-candidates"] });
            toast({ title: "Booking confirmed", description: `ACT-${match.ref}` });
        } catch (err: any) {
            toast({ title: "Not confirmed", description: err.message, variant: "destructive" });
        } finally {
            setConfirmingId(null);
        }
    };

    const handleConfirmOffline = (id: string) => {
        updateBookingMutation.mutate({ id, updates: { status: 'confirmed' } });
    };

    const handleCancelOffline = (id: string) => {
        if (!confirm("Are you sure you want to cancel this booking?")) return;
        updateBookingMutation.mutate({ id, updates: { status: 'cancelled' } });
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return "Never";
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("statement", file);

        try {
            const res = await fetch("/api/admin/reconciliation/statement", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) throw new Error(await res.text());

            const result: StatementResult = await res.json();
            setStatement(result);

            // Nothing is confirmed by the upload: each suggestion needs an admin's confirmation.
            toast({
                title: "Statement Processed",
                description: `${result.suggestions.length} suggested match(es) to confirm, ${result.needsReview.length} line(s) need review.`,
            });

            // Reset input
            e.target.value = '';
        } catch (error: any) {
            toast({
                title: "Upload Failed",
                description: error.message || "Failed to process statement CSV",
                variant: "destructive",
            });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <DashboardLayout type="admin">
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Landmark className="h-6 w-6 text-muted-foreground" />
                        Management & Reconciliation
                    </h1>
                    <p className="text-sm text-muted-foreground">Monitor stale online payments and confirm offline manual bookings.</p>
                </div>

                <Tabs defaultValue="offline">
                    <TabsList>
                        <TabsTrigger value="offline" className="flex items-center gap-2">
                            <Wallet className="h-4 w-4" />
                            Offline Payments
                            {pendingOfflineBookings.length > 0 && (
                                <Badge variant="destructive" className="ml-1 h-5 w-5 flex items-center justify-center p-0 rounded-full">
                                    {pendingOfflineBookings.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="stale" className="flex items-center gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Stale Online
                            {payments.length > 0 && (
                                <Badge variant="destructive" className="ml-1 h-5 w-5 flex items-center justify-center p-0 rounded-full">
                                    {payments.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="offline" className="mt-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-600">
                                        <Wallet className="h-4 w-4" /> Pending Offline
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{pendingOfflineBookings.length}</div>
                                    <p className="text-xs text-muted-foreground">Waiting for manual confirmation</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-600">
                                        <DollarSign className="h-4 w-4" /> Total Value
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {vatu(pendingOfflineBookings.reduce((sum, b) => sum + (b.totalAmountCents || 0), 0))}
                                    </div>
                                    <p className="text-xs text-muted-foreground">Projected revenue from pending items</p>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Awaiting Confirmation</CardTitle>
                                <CardDescription>
                                    Bookings made with manual methods (Bank Transfer, Cash) that require admin verification.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="mb-6 rounded-md bg-muted/30 p-4 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <h4 className="font-medium text-sm">Statement Matching</h4>
                                        <p className="text-xs text-muted-foreground">Upload a CSV bank statement with a header row (Date, Description, Amount or Credit). Lines quoting a booking reference (e.g. ACT-1234ABCD) are matched; nothing is confirmed until you confirm each suggestion.</p>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <Input
                                            type="file"
                                            accept=".csv,.txt,text/csv,text/plain"
                                            onChange={handleFileUpload}
                                            disabled={isUploading}
                                            className="w-auto h-8 text-xs cursor-pointer file:cursor-pointer"
                                        />
                                        {isUploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground inline" />}
                                    </div>
                                </div>

                                {statement && (
                                    <div className="mb-6 space-y-4">
                                        <p className="text-xs text-muted-foreground">
                                            Amount column: {statement.amountColumn ?? "none found"} · {statement.ignored} line(s) with no booking reference
                                        </p>
                                        <div className="rounded-md border overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/50">
                                                        <TableHead>Suggested match</TableHead>
                                                        <TableHead>Guest</TableHead>
                                                        <TableHead className="text-right">Statement</TableHead>
                                                        <TableHead className="text-right">Expected</TableHead>
                                                        <TableHead className="text-right">Action</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {statement.suggestions.length === 0 ? (
                                                        <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground">No suggested matches.</TableCell></TableRow>
                                                    ) : statement.suggestions.map((m) => (
                                                        <TableRow key={`s-${m.bookingId}`}>
                                                            <TableCell className="font-mono text-xs">ACT-{m.ref}<div className="text-[10px] text-muted-foreground">line {m.lineNo}</div></TableCell>
                                                            <TableCell className="text-sm">{m.customerName}</TableCell>
                                                            <TableCell className="text-right">{vatu(m.statementAmount)}</TableCell>
                                                            <TableCell className="text-right">{vatu(m.expectedAmount)}</TableCell>
                                                            <TableCell className="text-right">
                                                                <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700" disabled={confirmingId === m.bookingId}
                                                                    onClick={() => handleConfirmSuggestion(m)}>
                                                                    {confirmingId === m.bookingId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        <div className="rounded-md border overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/50">
                                                        <TableHead>Needs review</TableHead>
                                                        <TableHead>Why</TableHead>
                                                        <TableHead className="text-right">Statement</TableHead>
                                                        <TableHead className="text-right">Expected</TableHead>
                                                        <TableHead>Line</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {statement.needsReview.length === 0 ? (
                                                        <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground">Nothing to review.</TableCell></TableRow>
                                                    ) : statement.needsReview.map((m) => (
                                                        <TableRow key={`r-${m.bookingId}-${m.lineNo}`}>
                                                            <TableCell className="font-mono text-xs">ACT-{m.ref}<div className="text-[10px] text-muted-foreground">{m.customerName}</div></TableCell>
                                                            <TableCell className="text-xs">{m.reason ? REVIEW_REASONS[m.reason] : ""}</TableCell>
                                                            <TableCell className="text-right">{vatu(m.statementAmount)}</TableCell>
                                                            <TableCell className="text-right">{vatu(m.expectedAmount)}</TableCell>
                                                            <TableCell className="font-mono text-[10px] max-w-xs truncate" title={m.line}>{m.lineNo}: {m.line}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                )}

                                {isBookingsLoading ? (
                                    <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
                                ) : pendingOfflineBookings.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-muted/20 border-border">
                                        <Check className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                                        <h3 className="text-lg font-medium">All Reconciled</h3>
                                        <p className="text-sm text-muted-foreground">No pending offline payments to confirm.</p>
                                    </div>
                                ) : (
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead>Booking</TableHead>
                                                    <TableHead>Guest</TableHead>
                                                    <TableHead>Method</TableHead>
                                                    <TableHead className="text-right">Amount</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {pendingOfflineBookings.map((booking) => (
                                                    <TableRow key={booking.id}>
                                                        <TableCell className="font-mono text-xs">
                                                            {booking.id.split('-')[0].toUpperCase()}
                                                            <div className="text-[10px] text-muted-foreground mt-1">
                                                                {format(new Date(booking.createdAt), "MMM dd, yyyy")}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="font-semibold text-sm">{booking.customerName}</div>
                                                            <div className="text-xs text-muted-foreground">{booking.customerEmail}</div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="capitalize text-[10px]">
                                                                {booking.paymentMethod?.replace(/[-_]/g, ' ') || 'Manual'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-primary">
                                                            {vatu(booking.totalAmountCents || 0)}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    className="h-8 bg-green-600 hover:bg-green-700"
                                                                    onClick={() => handleConfirmOffline(booking.id)}
                                                                >
                                                                    Confirm
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 text-destructive"
                                                                    onClick={() => handleCancelOffline(booking.id)}
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            </div>
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

                    <TabsContent value="stale" className="mt-6 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Stale Online Payments</CardTitle>
                                <CardDescription>
                                    Payments that have been in 'processing' status longer than expected.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isStaleLoading ? (
                                    <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
                                ) : payments.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-muted/20 border-border">
                                        <Info className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                                        <h3 className="text-lg font-medium">No Stale Online Payments</h3>
                                    </div>
                                ) : (
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Payment ID</TableHead>
                                                    <TableHead>Amount</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {payments.map((payment) => (
                                                    <TableRow key={payment.id}>
                                                        <TableCell className="font-mono text-xs">
                                                            {payment.id.split('-')[0]}...
                                                            <div className="text-[10px] text-muted-foreground mt-1">Ref: {payment.gatewayReference || 'N/A'}</div>
                                                        </TableCell>
                                                        <TableCell>{payment.currency.toUpperCase()} {(payment.amount / 100).toFixed(2)}</TableCell>
                                                        <TableCell><Badge variant="secondary">{payment.status}</Badge></TableCell>
                                                        <TableCell className="text-right">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="outline" size="sm">Actions <ChevronDown className="h-4 w-4 ml-2" /></Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem onClick={() => handleSync(payment.id)}>Auto Sync</DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleForceComplete(payment.id)} className="text-green-600">Force Complete</DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleForceFail(payment.id)} className="text-destructive">Force Fail</DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
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
                </Tabs>
            </div>
        </DashboardLayout>
    );
}
