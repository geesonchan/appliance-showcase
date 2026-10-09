import appliancesFile from "../../data/appliances.json";
import type { Appliance, Package } from "../types";
import type { RunSegment } from "./roomShell";

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

type Kind = Pick<Appliance, "installType" | "category" | "widthIn" | "cutoutWidthIn">;

/**
 * Up to this much either side of a machine is a scribe, not a board: nothing
 * is built for it. The one figure: the range's fillers here, `Filler` in
 * ApplianceModel, and the strips beside a hood (`hoodSideFillers`) all read it
 * (round 85 joined the hood's own copy, D17's table, the twelfth).
 */
export const SCRIBE_IN = 0.5;

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
 * How much of the cooking opening is left each side of a range standing on
 * the floor in it, in inches — 0 where nothing is built there.
 *
 * Round 84, Leo, from site: "30“宽炉头两边的填充应该是顺滑的橱柜和countertop的无缝
 * 填充才对". A range narrower than its opening is closed in by the run: a
 * filler each side, in the cabinets' finish and flush with their fronts, the
 * toe kick carried under it and the stone run over it to the machine's side.
 * In any package. The run orders the fillers (`cooking` in layoutTemplate.ts)
 * and the machine stops filling the gap itself (`applianceBox`); both ask
 * this, so the two cannot disagree about whether there is a gap.
 *
 * Nothing for a machine that drops into the stone — what is beside a rangetop
 * is the cabinet under it — nor for a gap of a scribe or less, nor for a
 * machine as wide as its opening or wider.
 */
export function rangeFillerIn(openingIn: number, appliance: Kind | undefined): number {
  if (!appliance || dropsIntoCounter(appliance)) return 0;
  const width = appliance.widthIn ?? appliance.cutoutWidthIn;
  if (width === null) return 0;
  const each = (openingIn - width) / 2;
  return each > SCRIBE_IN ? each : 0;
}

/**
 * Where in a run segment the machine itself stands, in the run's feet.
 *
 * A cooking opening with a range narrower than it is a filler, the machine's
 * own opening and a filler (round 84). What stops at the machine — the stone,
 * the toe kick, the landing measured beside it — asks this; what is about the
 * wall the cabinets leave — the backsplash, the wall cabinets either side of
 * the hood — keeps the segment. A segment with no opening in it is all machine
 * or all cabinet, and is its own extent.
 */
export function openingAlong(segment: Pick<RunSegment, "from" | "to" | "modules">): [number, number] {
  let cursor = segment.from;
  for (const module of segment.modules) {
    const next = cursor + module.widthIn / 12;
    if (module.kind === "opening") return [cursor, next];
    cursor = next;
  }
  return [segment.from, segment.to];
}

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
