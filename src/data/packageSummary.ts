import { useSelection } from "../store/useSelection";

/** Rounded to whole thousands, e.g. 29481 -> "$29K". */
export const formatThousands = (usd: number) =>
  "$" + Math.round(usd / 1000).toLocaleString("en-US") + "K";

export const formatUSD = (usd: number) =>
  usd.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/**
 * Live totals for the current package. M1 reads the hard-coded selection; M2
 * will recompute this as the user swaps models.
 */
export function usePackageSummary() {
  const selection = useSelection();
  const items = Object.values(selection).filter(Boolean);
  const totalUSD = items.reduce((sum, a) => sum + a.msrpUSD, 0);
  // Built from the fuels actually in the package rather than a fixed label:
  // swapping the gas range for induction has to stop the panel saying "gas".
  const fuels = [...new Set(items.map((a) => a.fuel).filter(Boolean))].sort();

  return {
    items,
    count: items.length,
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
