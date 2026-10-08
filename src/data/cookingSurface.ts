import appliancesFile from "../../data/appliances.json";
import type { Appliance, Package } from "../types";

/**
 * Whether a cooking machine drops into the counter or stands on the floor —
 * asked in one place.
 *
 * Round 83, from Leo using package A: changed from its pro range to the PCG366W
 * rangetop on the model card, the rangetop hung at counter height over an
 * empty opening. Three places had each answered this question: the run (which
 * orders the cabinet under the cooking surface) from the *package's* slot, the
 * counter (a hole, or a cut clean through) from the *model* by the word
 * "freestanding", and the machine's own placement from the model by
 * "rangetop". They disagreed whenever the model was not the package's kind,
 * and on a slide-in range they disagreed with each other. All three ask
 * `dropsIntoCounter` now (D16, round 83; D17's table).
 *
 * Kept in a module with no imports from the room, so the layout template can
 * ask it without a load-time cycle.
 */

type Kind = Pick<Appliance, "installType" | "category">;

/** A rangetop: a cooking surface dropped into the stone, its controls under it. */
export const isRangetop = (appliance: Pick<Appliance, "installType">) =>
  appliance.installType.includes("rangetop");

/**
 * A cooking surface set into the stone — a rangetop, or a cooktop. Both drop
 * through a hole in the counter and stand on a cabinet under it. Anything else
 * that cooks stands on the floor between two cabinets: a freestanding range,
 * and a slide-in, whose top only laps the counter each side (Leo, round 83:
 * the counter stops at its two sides, and nothing runs behind it).
 *
 * Read from what the machine is, never from the word "freestanding": the
 * importer gives that word to a row nothing else matched (D4), and two of the
 * three pro ranges carry it that way.
 */
export const dropsIntoCounter = (appliance: Kind) =>
  isRangetop(appliance) || appliance.category === "cooktop";

/**
 * The range the customer chose, and the package it was chosen in.
 *
 * What stands under the cooking surface is the chosen machine's to say (Leo,
 * round 83: a rangetop always has a base cabinet under it, in any package,
 * whichever way the swap goes), so the run asks for it. A choice made in
 * another package is not this one's: a package switch carries a model across
 * only when it installs the way the new slot does (`suitsPackageSlot`), so the
 * incoming package's own range answers the same.
 */
let CHOSEN: { packageId: string; appliance: Kind } | null = null;

export function recordRangeModel(packageId: string, appliance: Kind | undefined) {
  CHOSEN = appliance ? { packageId, appliance } : null;
}

/** The range a package's room is built round: the one chosen in it, or its own. */
export function rangeModelFor(pkg: Package): Kind | undefined {
  if (CHOSEN && CHOSEN.packageId === pkg.id) return CHOSEN.appliance;
  const id = pkg.defaultSelection["slot-range"];
  if (!id) return undefined;
  const rows = (appliancesFile as { appliances: { id: string }[] }).appliances;
  return rows.find((row) => row.id === id) as Kind | undefined;
}
