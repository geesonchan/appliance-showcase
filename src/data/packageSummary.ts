import type { SlotId } from "../types";
import { OMITTED_SLOTS } from "./room";
import { useSelection, useSelectedBlower } from "../store/useSelection";
import { formatUSD } from "./money";

/** A price, or the copy for a model the sheet has no price for. */
export const formatPrice = (usd: number | null, onRequest: string) =>
  usd === null ? onRequest : formatUSD(usd);

export { formatUSD } from "./money";

/**
 * Live totals for the current package. M1 reads the hard-coded selection; M2
 * will recompute this as the user swaps models.
 */
export function usePackageSummary() {
  const selection = useSelection();
  const blower = useSelectedBlower();
  const hood = selection["slot-hood"];
  // The blower is its own line: it is a separate purchase with its own lead
  // time, and burying it in the hood's price hides that. See decisions.md D6.
  const items = [
    // What is in the room, which in a small kitchen with no island is not
    // everything the package names: see `OMITTED_SLOTS`.
    ...Object.entries(selection)
      .filter(([slotId, appliance]) => appliance && !OMITTED_SLOTS.includes(slotId as SlotId))
      .map(([, appliance]) => appliance),
    ...(hood?.blower === "required" && blower ? [blower] : []),
  ];
  // Totals cover only what has a price. An unpriced model is a real state in
  // the inventory, and counting it as zero would quietly understate the
  // package, which is the one number a customer remembers.
  const priced = items.filter((a) => a.msrpUSD !== null);
  const totalUSD = priced.reduce((sum, a) => sum + (a.msrpUSD ?? 0), 0);
  // Built from the fuels actually in the package rather than a fixed label:
  // swapping the gas range for induction has to stop the panel saying "gas".
  const fuels = [...new Set(items.map((a) => a.fuel).filter(Boolean))].sort();

  return {
    items,
    /** Named on the panel beside the count they are missing from. */
    omitted: OMITTED_SLOTS,
    blower: hood?.blower === "required" ? blower : null,
    count: items.length,
    pricedCount: priced.length,
    /** True when the total covers every model in the package. */
    fullyPriced: priced.length === items.length,
    totalUSD,
    /** i18n keys for each distinct fuel, joined with "+" by the panel. */
    energyKeys: fuels.length > 0 ? fuels.map((fuel) => `energy.${fuel}`) : ["energy.electric"],
    // Unknown, not zero: the current import publishes no lead times at all,
    // and "0 weeks" would read as a promise.
    leadTimeWeeks: (() => {
      const known = items.map((a) => a.leadTimeWeeks).filter((w): w is number => w !== null);
      return known.length > 0 ? Math.max(...known) : null;
    })(),
  };
}
