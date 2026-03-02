/**
 * BookingForm price display patch — booking-form.tsx
 *
 * KEY CHANGES:
 *  1. `BookingFormProps` now accepts `pricingType` and `groupPriceCents`
 *  2. `estimatedTotal` uses the correct calculation path depending on pricingType
 *  3. Group-priced products show a flat rate label ("Package rate") instead of
 *     per-person counters when pax input doesn't affect the price
 *  4. All price display goes through `formatPriceDisplay(vuvAmount, currency)`
 *     which uses the CurrencyContext — no more manual conversion in the form
 *
 * This file shows only the CHANGED sections. Apply as diffs to your existing
 * booking-form.tsx — the rest of the file (fields, draft persistence, etc.) is unchanged.
 */

// ─── Props change ─────────────────────────────────────────────────────────────
/*
  ADD to BookingFormProps interface:

  pricingType?: 'per_person' | 'group';
  groupPriceCents?: number;   // Flat rate for group-priced products
*/

// ─── estimatedTotal useMemo — REPLACE existing block ─────────────────────────
/*
  const estimatedTotal = useMemo(() => {
    // Always prefer authoritative server price after availability check
    if (serverPricingCents !== null && serverPricingCents !== undefined) {
      return formatPriceDisplay(serverPricingCents, currency);
    }

    if (pricingType === 'group') {
      // Group/package: flat rate — pax count doesn't change the price
      const base = groupPriceCents ?? 0;
      const selectedAddonsPrice = watchedAddonIds.reduce((sum, id) => {
        const addon = availableAddons.find(a => a.id === id);
        return sum + (addon?.priceCents || 0);
      }, 0);
      return formatPriceDisplay(base + selectedAddonsPrice, currency);
    }

    // Per-person estimate
    const adults = parseInt(watchedAdultPax || '0');
    const children = parseInt(watchedChildPax || '0');
    let totalCents = (adults * adultPriceCents) + (children * childPriceCents);

    const selectedAddonsPrice = watchedAddonIds.reduce((sum, id) => {
      const addon = availableAddons.find(a => a.id === id);
      return sum + (addon?.priceCents || 0);
    }, 0);
    totalCents += selectedAddonsPrice;

    return formatPriceDisplay(totalCents, currency);
  }, [
    serverPricingCents, pricingType, groupPriceCents,
    watchedAdultPax, watchedChildPax, adultPriceCents, childPriceCents,
    watchedAddonIds, availableAddons, currency,
  ]);
*/

// ─── Price summary section — UPDATE the label for group pricing ───────────────
/*
  In the JSX price summary card, replace the "Estimated Total" description:

  {pricingType === 'group' ? (
    <div className="text-sm text-muted-foreground">
      Package rate (covers entire group)
    </div>
  ) : (
    <div className="text-sm text-muted-foreground">
      {parseInt(watchedAdultPax || '0')} adult{parseInt(watchedAdultPax || '0') !== 1 ? 's' : ''}
      {parseInt(watchedChildPax || '0') > 0 && `, ${watchedChildPax} child${parseInt(watchedChildPax || '0') !== 1 ? 'ren' : ''}`}
    </div>
  )}
*/

// ─── Currency-aware pax counters — ADD note for group pricing ─────────────────
/*
  Wrap the pax counter section with a conditional note:

  {pricingType === 'group' && (
    <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-md px-3 py-2 mb-2">
      <Package className="h-3.5 w-3.5 shrink-0" />
      This is a group booking — the price covers your whole party.
      {groupMaxPax && ` Up to ${groupMaxPax} guests included.`}
    </div>
  )}
*/

export {}; // Patch guide — see comments above
