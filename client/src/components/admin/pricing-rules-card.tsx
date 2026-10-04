import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Percent } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateSiteSetting } from "@/lib/api";
import { SITE_SETTINGS_QUERY_KEY, usePricingRules } from "@/lib/site-settings";
import { MONTH_NAMES, PRICING_RULES_SETTING_KEY, parsePricingRules, type PricingRules } from "@shared/pricing-rules";
import { cn } from "@/lib/utils";

/**
 * Admin editor for the checkout discount and surcharge rules. The server normalises
 * and range-checks the saved value, and new quotes use it straight away.
 */
export function PricingRulesCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const saved = usePricingRules();
  const [draft, setDraft] = useState<PricingRules>(saved);
  const [isSaving, setIsSaving] = useState(false);

  // Refill the form once the saved settings arrive (or after another admin saves).
  useEffect(() => setDraft(saved), [saved]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const gd = draft.groupDiscount;
  const ps = draft.peakSeason;

  const setGroup = (patch: Partial<PricingRules["groupDiscount"]>) =>
    setDraft((d) => ({ ...d, groupDiscount: { ...d.groupDiscount, ...patch } }));
  const setPeak = (patch: Partial<PricingRules["peakSeason"]>) =>
    setDraft((d) => ({ ...d, peakSeason: { ...d.peakSeason, ...patch } }));
  const toggleMonth = (m: number) =>
    setPeak({ months: ps.months.includes(m) ? ps.months.filter((x) => x !== m) : [...ps.months, m].sort((a, b) => a - b) });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSiteSetting(PRICING_RULES_SETTING_KEY, parsePricingRules(draft));
      await queryClient.invalidateQueries({ queryKey: SITE_SETTINGS_QUERY_KEY });
      toast({ title: "Pricing rules saved", description: "New quotes and bookings use them now. Existing bookings keep their price." });
    } catch {
      toast({ title: "Error", description: "Failed to save pricing rules.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="h-4 w-4" /> Discounts &amp; Surcharges
        </CardTitle>
        <CardDescription>
          Applied automatically at checkout. Flat-price group packages are never discounted.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Group discount */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="rule-group-enabled" className="text-base">Group discount</Label>
              <p className="text-sm text-muted-foreground">Per-person tours booked for a large group</p>
            </div>
            <Switch id="rule-group-enabled" checked={gd.enabled} onCheckedChange={(enabled) => setGroup({ enabled })} />
          </div>
          <div className={cn("grid grid-cols-2 gap-4", !gd.enabled && "opacity-50")}>
            <div className="space-y-1.5">
              <Label htmlFor="rule-group-min">Minimum adults</Label>
              <Input id="rule-group-min" type="number" min={1} max={100} disabled={!gd.enabled}
                value={gd.minAdults} onChange={(e) => setGroup({ minAdults: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-group-pct">Discount %</Label>
              <Input id="rule-group-pct" type="number" min={0} max={100} step={0.5} disabled={!gd.enabled}
                value={gd.percent} onChange={(e) => setGroup({ percent: Number(e.target.value) })} />
            </div>
          </div>
        </div>

        {/* Peak season surcharge */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="rule-peak-enabled" className="text-base">Peak season surcharge</Label>
              <p className="text-sm text-muted-foreground">Added to bookings dated in the selected months</p>
            </div>
            <Switch id="rule-peak-enabled" checked={ps.enabled} onCheckedChange={(enabled) => setPeak({ enabled })} />
          </div>
          <div className={cn("space-y-4", !ps.enabled && "opacity-50")}>
            <div className="space-y-1.5 max-w-[50%]">
              <Label htmlFor="rule-peak-pct">Surcharge %</Label>
              <Input id="rule-peak-pct" type="number" min={0} max={100} step={0.5} disabled={!ps.enabled}
                value={ps.percent} onChange={(e) => setPeak({ percent: Number(e.target.value) })} />
            </div>
            <fieldset disabled={!ps.enabled} className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
              <legend className="text-sm font-medium mb-1.5">Peak months</legend>
              {MONTH_NAMES.map((name, m) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={ps.months.includes(m)}
                  onClick={() => toggleMonth(m)}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed",
                    ps.months.includes(m) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                  )}
                >
                  {name.slice(0, 3)}
                </button>
              ))}
            </fieldset>
          </div>
        </div>

        <div className="lg:col-span-2 flex justify-end gap-2">
          <Button variant="outline" disabled={!dirty || isSaving} onClick={() => setDraft(saved)}>Reset</Button>
          <Button disabled={!dirty || isSaving} onClick={handleSave}>{isSaving ? "Saving…" : "Save rules"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
