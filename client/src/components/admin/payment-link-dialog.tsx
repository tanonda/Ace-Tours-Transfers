import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Copy, Link2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createPaymentLink, fetchAdminPaymentGateways } from "@/lib/api";
import { MPGS_GATEWAY_SLUGS, type Booking } from "@shared/schema";

/** The server's error text from apiRequest's "400: {json}" message. */
function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  try {
    return JSON.parse(message.replace(/^\d+:\s*/, "")).error ?? message;
  } catch {
    return message;
  }
}

/**
 * Admin: create a bank-hosted payment link (ANZ, BSP or NBV on MPGS) for a pending
 * booking, to copy into an email or text to the guest.
 */
export function PaymentLinkDialog({ booking, open, onOpenChange }: {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [gateway, setGateway] = useState("");

  const { data: gateways = [] } = useQuery({
    queryKey: ["payment-gateways"],
    queryFn: fetchAdminPaymentGateways,
    enabled: open,
  });
  const banks = gateways.filter((g) => g.active && (MPGS_GATEWAY_SLUGS as readonly string[]).includes(g.slug));
  const chosen = banks.find((g) => g.slug === gateway);
  const isTestMode = (chosen?.credentials as { mode?: string } | null)?.mode === "TEST";

  const link = useMutation({
    mutationFn: () => createPaymentLink(booking!.id, gateway),
  });

  // Fresh form each time the dialog opens for a booking.
  const { reset } = link;
  useEffect(() => {
    if (open) { reset(); setGateway(""); }
  }, [open, booking?.id, reset]);

  // With one bank switched on there is nothing to choose.
  const onlyBank = banks.length === 1 ? banks[0].slug : "";
  useEffect(() => {
    if (open && !gateway && onlyBank) setGateway(onlyBank);
  }, [open, gateway, onlyBank]);

  const copy = async () => {
    if (!link.data) return;
    try {
      await navigator.clipboard.writeText(link.data.url);
      toast({ title: "Payment link copied" });
    } catch {
      toast({ title: "Copy failed", description: "Select the link and copy it.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" />Payment link</DialogTitle>
          <DialogDescription>
            A secure card payment page hosted by the bank. Send the link to {booking?.customerName || "the guest"}; the
            booking confirms automatically once they pay.
          </DialogDescription>
        </DialogHeader>

        {banks.length === 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No bank card gateway is switched on. Set up ANZ, BSP or NBV in Admin → Payments first.
            </AlertDescription>
          </Alert>
        ) : link.data ? (
          <div className="space-y-3">
            <Label htmlFor="payment-link-url">Link for {booking?.customerName || "the guest"}</Label>
            <div className="flex gap-2">
              <Input id="payment-link-url" readOnly value={link.data.url} onFocus={(e) => e.target.select()} />
              <Button type="button" variant="outline" onClick={copy} aria-label="Copy link"><Copy className="h-4 w-4" /></Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Works until {new Date(link.data.expiresAt).toLocaleString()}. The booking's seats are held until then.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <Label>Bank</Label>
            <Select value={gateway} onValueChange={setGateway}>
              <SelectTrigger><SelectValue placeholder="Choose a bank" /></SelectTrigger>
              <SelectContent>
                {banks.map((g) => <SelectItem key={g.slug} value={g.slug}>{g.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
            {isTestMode && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {chosen?.displayName} is in TEST mode: the link takes test cards only. Don't send it to a real guest.
                </AlertDescription>
              </Alert>
            )}
            {link.isError && <p className="text-sm text-destructive">{errorText(link.error)}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{link.data ? "Done" : "Cancel"}</Button>
          {!link.data && banks.length > 0 && (
            <Button onClick={() => link.mutate()} disabled={!gateway || !booking || link.isPending}>
              {link.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
