import { useSelection } from "../store/useSelection";

/** Rounded to whole thousands, e.g. 29481 -> "$29K". */
export const formatThousands = (usd: number) =>
  "$" + Math.round(usd / 1000).toLocaleString("en-US") + "K";

/** A price, or the copy for a model the sheet has no price for. */
export const formatPrice = (usd: number | null, onRequest: string) =>
  usd === null ? onRequest : formatUSD(usd);

export const formatUSD = (usd: number) =>
  usd.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/**
 * Live totals for the current package. M1 reads the hard-coded selection; M2
 * will recompute this as the user swaps models.
 */
export function usePackageSummary() {
  const selection = useSelection();
  const items = Object.values(selection).filter(Boolean);
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
    count: items.length,
    pricedCount: priced.length,
    /** True when the total covers every model in the package. */
    fullyPriced: priced.length === items.length,
    totalUSD,
    // The brief asks for a package *range*; whole-thousand bounds around the
    // real total, so the number stays honest without inventing a margin.
    rangeLow: Math.floor(totalUSD / 1000) * 1000,
    rangeHigh: Math.ceil(totalUSD / 1000) * 1000,
    /** i18n keys for each distinct fuel, joined with "+" by the panel. */
    energyKeys: fuels.length > 0 ? fuels.map((fuel) => `energy.${fuel}`) : ["energy.electric"],
    leadTimeWeeks: Math.max(...items.map((a) => a.leadTimeWeeks ?? 0)),
  };
}
