import { APPLIANCE_BY_SLOT, SLOT_ORDER } from "./appliances";

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
  const items = SLOT_ORDER.map((slot) => APPLIANCE_BY_SLOT[slot]).filter(Boolean);
  const totalUSD = items.reduce((sum, a) => sum + a.priceUSD, 0);
  const fuels = new Set(items.map((a) => a.fuel).filter(Boolean));

  let energyKey = "energy.electric";
  if (fuels.size > 1) energyKey = "energy.mixed";
  else if (fuels.size === 1) energyKey = "energy." + [...fuels][0];

  return {
    items,
    count: items.length,
    totalUSD,
    // The brief asks for a package *range*; whole-thousand bounds around the
    // real total, so the number stays honest without inventing a margin.
    rangeLow: Math.floor(totalUSD / 1000) * 1000,
    rangeHigh: Math.ceil(totalUSD / 1000) * 1000,
    energyKey,
    leadTimeWeeks: Math.max(...items.map((a) => a.leadTimeWeeks ?? 0)),
  };
}
