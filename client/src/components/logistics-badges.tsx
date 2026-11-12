import { Badge } from "@/components/ui/badge";
import type { GuestNeed, LogisticsFlags } from "@shared/logistics-flags";

const NEED_LABEL: Record<GuestNeed, string> = {
  dietary: "Dietary need",
  limited_mobility: "Limited mobility",
  child_seat: "Child seat",
};

const WARN = "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400";
const INFO = "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400";

/**
 * Staff-only badges read from a booking's pickup and special-request text.
 * Renders nothing when the booking has not been assessed or has nothing to flag.
 */
export function LogisticsBadges({ flags }: { flags?: LogisticsFlags | null }) {
  if (!flags) return null;
  const badges: { key: string; label: string; className: string }[] = [];
  if (flags.flight === "missing") badges.push({ key: "flight", label: "Flight number needed", className: WARN });
  if (flags.flight === "unclear") badges.push({ key: "flight", label: "Check flight number", className: WARN });
  if (flags.pickup === "missing") badges.push({ key: "pickup", label: "Pickup place needed", className: WARN });
  if (flags.pickup === "unclear") badges.push({ key: "pickup", label: "Check pickup place", className: WARN });
  for (const need of flags.needs) badges.push({ key: need, label: NEED_LABEL[need], className: INFO });
  for (const need of flags.checkNotes) badges.push({ key: `${need}?`, label: `${NEED_LABEL[need]}? Read notes`, className: INFO });
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="logistics-badges">
      {badges.map((b) => (
        <Badge key={b.key} variant="outline" className={`text-[0.7rem] ${b.className}`}>{b.label}</Badge>
      ))}
    </div>
  );
}
