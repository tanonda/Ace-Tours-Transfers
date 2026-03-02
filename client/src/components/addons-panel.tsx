/**
 * AddonsPanel — reusable addon selector for tour/transfer/vehicle detail pages.
 *
 * Supports two addon types (from schema):
 *   isPerUnit=false  → flat add-on, toggle on/off (quantity always 1)
 *   isPerUnit=true   → quantity-based, e.g. "Extra Hour × 3 @ VT 1,000/hour"
 *                      uses minUnits/maxUnits for stepper bounds
 *
 * Usage:
 *   <AddonsPanel
 *     addons={product.addons}        // ProductAddonWithDetails[]
 *     selected={addonSelections}     // Record<addonId, quantity>
 *     onChange={setAddonSelections}
 *     currency={currency}
 *   />
 *
 * Total addon cost helper:
 *   import { calcAddonTotal } from '@/components/addons-panel'
 *   const addonTotal = calcAddonTotal(product.addons, addonSelections)
 */

import { formatPriceDisplay } from '@/lib/product.types';
import type { CurrencyCode } from '@/lib/currency-context';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddonDef {
  id: string;
  name: string;
  description?: string | null;
  priceCents: number;
  isPerUnit: boolean;
  unitLabel?: string | null;
  minUnits: number;
  maxUnits: number;
}

export interface ProductAddonEntry {
  id: string;           // product_addons.id
  addonId: string;
  isRequired: boolean;
  sortOrder: number;
  addon: AddonDef;
}

export type AddonSelections = Record<string, number>; // addonId → quantity (0 = not selected)

// ─── Helper: total cost of all selected addons ────────────────────────────────

export function calcAddonTotal(
  productAddons: ProductAddonEntry[],
  selections: AddonSelections
): number {
  return productAddons.reduce((sum, pa) => {
    const qty = selections[pa.addonId] ?? (pa.isRequired ? pa.addon.minUnits : 0);
    return sum + pa.addon.priceCents * qty;
  }, 0);
}

export function buildAddonIdsForCart(
  productAddons: ProductAddonEntry[],
  selections: AddonSelections
): string[] {
  return productAddons
    .filter(pa => (selections[pa.addonId] ?? 0) > 0 || pa.isRequired)
    .map(pa => pa.addonId);
}

// ─── Stepper button ───────────────────────────────────────────────────────────

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-[26px] h-[26px] rounded-full bg-[#1a1710] border border-[rgba(244,168,48,0.18)] text-[#f0ece4] hover:border-[#f4a830] hover:bg-[#f4a830]/15 transition-all text-base leading-none flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
      >−</button>
      <span className="w-5 text-center font-bold text-[#f4a830] text-sm">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-[26px] h-[26px] rounded-full bg-[#1a1710] border border-[rgba(244,168,48,0.18)] text-[#f0ece4] hover:border-[#f4a830] hover:bg-[#f4a830]/15 transition-all text-base leading-none flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
      >+</button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AddonsPanelProps {
  addons: ProductAddonEntry[];
  selected: AddonSelections;
  onChange: (next: AddonSelections) => void;
  currency: CurrencyCode | string;
}

export function AddonsPanel({ addons, selected, onChange, currency }: AddonsPanelProps) {
  if (!addons || addons.length === 0) return null;

  const setAddon = (addonId: string, qty: number) => {
    onChange({ ...selected, [addonId]: qty });
  };

  return (
    <div>
      <label className="text-[0.75rem] font-semibold text-[#8a826e] tracking-[0.07em] uppercase mb-2 block">
        Add-ons & Extras
      </label>
      <div className="flex flex-col gap-2">
        {addons.map((pa) => {
          const { addon } = pa;
          const currentQty = selected[addon.id] ?? (pa.isRequired ? addon.minUnits : 0);
          const isSelected = currentQty > 0;

          if (!addon.isPerUnit) {
            // ── Toggle addon (flat price) ──────────────────────────────────
            return (
              <div
                key={pa.id}
                className={`flex items-center justify-between rounded-[10px] px-4 py-2.5 border transition-all cursor-pointer ${
                  pa.isRequired
                    ? 'bg-[#1e2a1e] border-[rgba(76,175,125,0.3)]'
                    : isSelected
                      ? 'bg-[#211e18] border-[#f4a830]/60'
                      : 'bg-[#211e18] border-[rgba(244,168,48,0.18)] hover:border-[rgba(244,168,48,0.35)]'
                }`}
                onClick={() => !pa.isRequired && setAddon(addon.id, isSelected ? 0 : 1)}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[0.85rem] text-[#f0ece4] font-medium">{addon.name}</span>
                    {pa.isRequired && (
                      <span className="text-[0.6rem] font-bold uppercase tracking-wide text-[#4caf7d] bg-[#4caf7d]/10 px-1.5 py-0.5 rounded">
                        Included
                      </span>
                    )}
                  </div>
                  {addon.description && (
                    <p className="text-[0.72rem] text-[#8a826e] mt-0.5">{addon.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-[0.8rem] text-[#f4a830] font-semibold">
                    {addon.priceCents === 0 ? 'Free' : `+${formatPriceDisplay(addon.priceCents, currency)}`}
                  </span>
                  {!pa.isRequired && (
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-[#f4a830] border-[#f4a830]' : 'border-[rgba(244,168,48,0.4)]'
                    }`}>
                      {isSelected && <span className="text-[#0f0d09] text-[0.65rem] font-black">✓</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // ── Per-unit / quantity addon ──────────────────────────────────────
          return (
            <div
              key={pa.id}
              className={`rounded-[10px] px-4 py-2.5 border transition-all ${
                pa.isRequired
                  ? 'bg-[#1e2a1e] border-[rgba(76,175,125,0.3)]'
                  : currentQty > addon.minUnits - 1
                    ? 'bg-[#211e18] border-[#f4a830]/60'
                    : 'bg-[#211e18] border-[rgba(244,168,48,0.18)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[0.85rem] text-[#f0ece4] font-medium">{addon.name}</span>
                    {pa.isRequired && (
                      <span className="text-[0.6rem] font-bold uppercase tracking-wide text-[#4caf7d] bg-[#4caf7d]/10 px-1.5 py-0.5 rounded">
                        Included
                      </span>
                    )}
                  </div>
                  {addon.description && (
                    <p className="text-[0.72rem] text-[#8a826e] mt-0.5">{addon.description}</p>
                  )}
                  <p className="text-[0.72rem] text-[#f4a830] mt-0.5">
                    {formatPriceDisplay(addon.priceCents, currency)} / {addon.unitLabel || 'unit'}
                    {addon.maxUnits > 1 && (
                      <span className="text-[#8a826e]"> · max {addon.maxUnits - (pa.isRequired ? addon.minUnits : 0)} extra</span>
                    )}
                  </p>
                </div>
                <Stepper
                  value={currentQty}
                  min={pa.isRequired ? addon.minUnits : 0}
                  max={addon.maxUnits}
                  onChange={(n) => setAddon(addon.id, n)}
                />
              </div>
              {currentQty > 0 && (
                <div className="mt-2 pt-2 border-t border-[rgba(244,168,48,0.1)] flex justify-between text-[0.75rem]">
                  <span className="text-[#8a826e]">
                    {currentQty} {addon.unitLabel || 'unit'}{currentQty !== 1 ? 's' : ''} selected
                  </span>
                  <span className="text-[#f4a830] font-semibold">
                    +{formatPriceDisplay(addon.priceCents * currentQty, currency)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
