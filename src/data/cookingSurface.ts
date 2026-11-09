import appliancesFile from "../../data/appliances.json";
import type { Appliance, Package } from "../types";
import type { RunSegment } from "./roomShell";
import { PACKAGE_SHAPE, shapeOfChoice, shapeOfPackage } from "./packages";
import type { LayoutShape } from "./layoutShape";

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

/** What a machine has to say for how it goes in. */
type MachineKind = Pick<Appliance, "installType" | "category">;
type Kind = MachineKind & Pick<Appliance, "widthIn" | "cutoutWidthIn">;

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
export const dropsIntoCounter = (appliance: MachineKind) =>
  isRangetop(appliance) || appliance.category === "cooktop";

/**
 * The three kinds of thing that cook, for what has to change together when
 * one is changed for another (`setRangeModel`): where the machine sits, the
 * hole in the stone and the utilities are each kind's own. Leo, 2026-11-07:
 * PCG366W and CIT367YG both stand on a `B36`, so the cabinet no longer tells
 * them apart and something else has to, or a swap leaves half a change.
 */
export type CookingSurfaceKind = "rangetop" | "cooktop" | "floor";
export const cookingSurfaceKind = (appliance?: MachineKind): CookingSurfaceKind =>
  !appliance || !dropsIntoCounter(appliance) ? "floor" : isRangetop(appliance) ? "rangetop" : "cooktop";

/**
 * What the run stands under a cooking surface, asked in one place: the run
 * under a range (`cooking` in layoutTemplate.ts), E's cooktop on one wall (the
 * same place), and E's island (cabinets.ts).
 *
 * Leo, 2026-11-07: every cooking surface set into the counter has a swing-door
 * base cabinet under it, no drawers — 「下面柜子不要抽屉，直接swing door，以后维护方便」;
 * a rangetop too (round 83's drawer base went, D16), one whole front with no
 * false drawer above it. 2026-11-08: the front is a pair of doors, opening left
 * and right, a rangetop's starting below its control panel; drawn as one slab
 * as every cabinet is (「可以」).
 *
 * Nothing under a machine standing on the floor, or under no machine: the run
 * leaves an opening.
 */
export function cabinetUnderCooking(
  openingIn: number,
  appliance: MachineKind | undefined,
): { code: string; kind: "base" } | null {
  return appliance && dropsIntoCounter(appliance) ? { code: `B${openingIn}`, kind: "base" } : null;
}

/**
 * A cooktop's glass above the floor, in inches: the stone it stands in, less
 * the hole it drops into, plus the body. CIT367YG, 4" tall in a 3-3/4" hole,
 * stands 1/4" proud of a 36" counter. The cooking surface a hood's clearance
 * and the dimension lines are measured from (Leo, 2026-11-08: 「30" 和 24" 都从灶面
 * （电磁灶玻璃面）量，照说明书」), asked here alone. Null where a machine does not
 * publish both figures.
 */
export function cooktopGlassIn(
  counterIn: number,
  cooktop: Pick<Appliance, "heightIn" | "cutoutHeightIn">,
): number | null {
  return cooktop.heightIn === null || cooktop.cutoutHeightIn === null
    ? null
    : counterIn + cooktop.heightIn - cooktop.cutoutHeightIn;
}

/** A cooktop as an opening specifies one, where no model is being asked about. */
export const DROP_IN_COOKTOP: MachineKind = { category: "cooktop", installType: ["drop-in"] };

/**
 * The same answer from the other side, for what stops at the machine: the
 * stone is cut at its sides (counter.ts) and the toe kick breaks at them
 * (cabinets.ts). With no machine chosen the run leaves an opening (`cooking`
 * in layoutTemplate.ts), so that reads as standing on the floor too.
 *
 * A freestanding range, and a slide-in too — the stone stops at its two sides
 * and nothing runs behind it (Leo, round 83). Until round 83 the counter read
 * the word "freestanding", so a slide-in got a hole in a slab running over it.
 * This was the counter's own wrapper until round 92b.
 *
 * Round 92b, from Leo trying it on B and D: the kick broke at every cooking
 * opening, and under a rangetop's base cabinet, now standing on the kick, a
 * strip of floor showed. A rangetop's base cabinet stands on the kick like any
 * other, and the kick runs on under it.
 */
export const standsOnTheFloor = (appliance?: Kind) => !appliance || !dropsIntoCounter(appliance);

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
let CHOSEN: { packageId: string; shape: LayoutShape; appliance: Kind } | null = null;

export function recordRangeModel(packageId: string, appliance: Kind | undefined, shape: LayoutShape = PACKAGE_SHAPE) {
  CHOSEN = appliance ? { packageId, shape: shapeOfChoice(packageId, shape), appliance } : null;
}

/**
 * The range a package's room is built round: the one chosen in it, or its own.
 *
 * And to its shape (round 98b): a package's room on one wall is built round
 * the model chosen in it there, not the one chosen in its L — package D's
 * 24" refrigerator opening on one wall is not where its L's 30" column goes.
 */
export function rangeModelFor(pkg: Package): Kind | undefined {
  if (CHOSEN && CHOSEN.packageId === pkg.id && CHOSEN.shape === shapeOfPackage(pkg)) return CHOSEN.appliance;
  const id = pkg.defaultSelection["slot-range"];
  if (!id) return undefined;
  const rows = (appliancesFile as { appliances: { id: string }[] }).appliances;
  return rows.find((row) => row.id === id) as Kind | undefined;
}
