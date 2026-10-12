import type { SlotId } from "../types";
import { HOOD_CABINET } from "./insertHood";
import { hoodTopFt } from "./hood";
import { filledBesideTower, islandAcross, islandAlong, islandHasCooktop, islandPoint } from "./layoutTemplate";
import { axisIndex, extentsOnAxis, onAxis, sizeOnAxis, stripFacing, type Facing } from "./frame";
import { COOKTOP_CABINET } from "./cooktop";
import { openingAlong, rangeModelFor, standsOnTheFloor } from "./cookingSurface";
import { PACKAGE, PACKAGE_SLOTS } from "./packages";
import { SLOT_BY_ID } from "./slots";
import { TOWER_VENT } from "./towerVent";
import {
  CABINET_STANDARDS,
  LAYOUT_LIMITS,
  ISLAND,
  PANEL,
  ROOM,
  RUNS,
  type CabinetModule,
  type CabinetRun,
  type RunSegment,
  type UpperBank,
  ft,
} from "./room";

export type CabinetKind = "base" | "tall" | "upper" | "counter" | "toe" | "surround";

export interface CabinetBox {
  id: string;
  kind: CabinetKind;
  /**
   * Boxes sharing an outline group are pieces of one visual volume (the
   * refrigerator surround). The mobile install view draws the union of each
   * group instead of every piece.
   */
  outline?: string;
  /**
   * The slot this box surrounds, when it is part of that appliance's own
   * enclosure. Such a box must never count as an occluder for that
   * appliance's pin, or the pin hides behind its own side panel.
   */
  slot?: SlotId;
  /** The cabinet this box is, when it is one. Shown under ?debug=1. */
  module?: CabinetModule;
  /**
   * Which stretch of cabinetry this box belongs to.
   *
   * A kitchen is finished by the run, not by the shelf: an accent colour goes
   * on one whole leg or on the island, wall cabinets and base cabinets and
   * towers together. So every box carries its run, and the finish picker asks
   * about runs rather than about heights. See docs/decisions.md D15.
   */
  run: "left" | "back" | "island";
  /**
   * Drawn only in the install view.
   *
   * For a part that is really there and is really not visible: the 5/8" kit
   * between two refrigeration columns is behind their doors, and drawing it in
   * the finished room puts a strip of cabinet colour between two steel fronts
   * that in the room itself you cannot see. The install view is where the
   * parts are, so that is where it is drawn.
   */
  installOnly?: boolean;
  /**
   * The hung oven this box stands over, when it is the open-backed cabinet over
   * one or the box stacked on that cabinet. What goes on its front depends on
   * the machine in the slot, which is the selection's business rather than the
   * layout's: see `GrilleDoor` in CabinetLayer.
   */
  ventSlot?: SlotId;
  /**
   * Which way the box's front faces, recorded where it is made (D22, round 50).
   * A run's boxes face the room; an island's face the side a cook works from,
   * except those on the seating side. Its door is on this face (`doorFace`).
   */
  facing: Facing;
  /**
   * What is on that face: a door, unless the box is a filler or a finished
   * board, which is a flush strip — it closes a gap and does not open. Recorded
   * where the box is made, from what it is ordered as. Round 50.
   */
  face?: "strip";
  /** Centre of the box, in feet. */
  position: [number, number, number];
  /** Full extents, in feet. */
  size: [number, number, number];
  /**
   * A turn about the vertical, for the one box that is not square to a run:
   * the toe kick under a corner susan's diagonal door (round 92b).
   */
  rotationY?: number;
}

/**
 * Where a cabinet standing on the toe kick starts: the kick's height.
 *
 * Round 92b, Leo: base cabinets, and the oven and coffee towers, stand on a
 * toe kick set back under them; a refrigerator's or a column's surround, and
 * the end panel at a run's exposed end, go to the floor. The one figure
 * everything standing on the kick reads — the cabinets here, a dishwasher's
 * door, the front under a microwave drawer, and the rough-in points in a base
 * cabinet (through `BASE_CABINET_BAND`).
 */
export const KICK_LIFT = ROOM.toeKick;

/** The base box under the top, on the kick: 4" to 34.5", and a 1.5" counter makes 36". */
const BASE_BOX = [KICK_LIFT, ROOM.counterHeight - ROOM.counterThickness] as const;

/**
 * Where a base cabinet is, floor to top: the one answer (round 92b, Leo). A
 * connection "in the cabinet" is measured from this floor (`roughIn.ts`).
 */
export const BASE_CABINET_BAND = BASE_BOX;

/** The refrigerator opening's height, in feet, as the slot actually declares it. */
const fridgeOpeningH = () => ft(SLOT_BY_ID["slot-fridge"].cutout.h);

/**
 * Whether this stretch is filled to the top of the oven tower beside it, and
 * to what height: `filledBesideTower` in layoutTemplate.ts is the one answer
 * (round 92c) — the far side from the cooking surface, and only a strip
 * narrower than the narrowest cabinet; the wall cabinets keep off it by the
 * same answer. Until round 92c this asked "the far side" on its own and filled
 * a stretch of any width.
 */
function besideTheTower(run: CabinetRun, segment: RunSegment): number | null {
  const filled = filledBesideTower(run.segments, PACKAGE_SLOTS).find((entry) => entry.segment === segment);
  return filled ? ft(filled.topIn) : null;
}

/**
 * Which volume a board belongs to.
 *
 * A tower's end panel is a segment of its own — three quarters of an inch of
 * the run — but it is not a piece of joinery standing on its own: it is the
 * side of the tower beside it, the same depth and the same height, and what a
 * customer sees is one volume. So it is grouped with the tower rather than
 * drawn as a board next to it.
 */
function volumeOf(run: CabinetRun, segment: RunSegment): string {
  const at = run.segments.indexOf(segment);
  for (const neighbour of [run.segments[at - 1], run.segments[at + 1]]) {
    if (neighbour?.kind === "tall" && neighbour.slot) return neighbour.id;
  }
  return segment.id;
}

/**
 * Whether a tall unit stands on the toe kick: one whose opening starts above
 * the floor — an oven tower, a coffee tower — is cabinetry like a base cabinet
 * and stands on it. A refrigerator or a column stands on the floor in its
 * opening, and its surround goes to the floor with it. Leo, round 92b.
 */
const towerOnKick = (module: CabinetModule | undefined) =>
  module?.kind === "tall" && (module.sillIn ?? 0) > 0;

/**
 * Whether a finished board stands on the toe kick (round 92b, Leo).
 *
 * A board is the side of the volume it closes (`volumeOf`), so it stands where
 * that volume does: on the kick beside an oven or coffee tower, on the floor
 * beside a refrigerator or a column. Except at the run's end: the board that is
 * the run's exposed end goes to the floor whatever it closes, so the recess
 * shows only at the front — and so does the end panel of a run of base
 * cabinets, which is not a tall segment at all.
 */
function boardOnKick(run: CabinetRun, segment: RunSegment): boolean {
  if (segment.kind !== "tall") return false;
  const at = run.segments.indexOf(segment);
  if (at === 0 || at === run.segments.length - 1) return false;
  for (const neighbour of [run.segments[at - 1], run.segments[at + 1]]) {
    if (neighbour?.kind === "tall" && neighbour.slot) {
      return towerOnKick(neighbour.modules.find((module) => module.kind === "tall"));
    }
  }
  return false;
}

/**
 * The kit between two columns, as a thing to draw.
 *
 * How far behind the run's face it sits: enough that the doors either side,
 * which stand proud of their cases, close over it completely. An inch is more
 * than the three quarters a door stands proud by, which is the figure this has
 * to clear.
 */
export const TRIM_KIT = { setBackIn: 1 };

/** A tall unit's opening, in feet: what the slot it houses declares. */
const openingH = (slot?: SlotId) => (slot ? ft(SLOT_BY_ID[slot].cutout.h) : fridgeOpeningH());

const span = ([a, b]: readonly [number, number]) => b - a;
const mid = ([a, b]: readonly [number, number]) => (a + b) / 2;

/**
 * Place a box on a run.
 *
 * A run travels along one axis and is centred on the other, so everything on it
 * is described in run-local terms — where it starts and stops along the run,
 * how far it stands off the wall — and this turns that into world coordinates.
 * The generator in M3-3 produces runs; this is what draws whatever it produces.
 */
function onRun(
  run: CabinetRun,
  id: string,
  kind: CabinetKind,
  along: readonly [number, number],
  y: readonly [number, number],
  depth: number,
  /** Shift toward the room, for a countertop's overhang. */
  offset = 0,
  extra: Partial<CabinetBox> = {},
): CabinetBox {
  const across = run.centre + offset;
  const [sizeX, sizeZ] = sizeOnAxis(run.axis, span(along), depth);
  return {
    id,
    kind,
    position: onAxis(run.axis, mid(along), across, mid(y)),
    size: [sizeX, span(y), sizeZ],
    run: run.id,
    // A run's cabinetry faces the room, away from the wall it stands on.
    facing: stripFacing(run.axis, 1),
    ...extra,
  };
}

/**
 * Walk a segment's modules, handing each its own stretch of the run.
 *
 * The index comes with it because a bank can hold two of the same box — a 72"
 * stretch is two W3642s — and a box's id has to stay unique whatever the
 * parameters produce, or React quietly drops the second one.
 */
function eachModule(
  from: number,
  modules: CabinetModule[],
  visit: (module: CabinetModule, along: readonly [number, number], index: number) => void,
) {
  let cursor = from;
  for (const [index, module] of modules.entries()) {
    const next = cursor + ft(module.widthIn);
    visit(module, [cursor, next] as const, index);
    cursor = next;
  }
}

/**
 * The base run, one box per cabinet.
 *
 * Drawn module by module rather than segment by segment, because that is what
 * is standing there: a wall of separate boxes, each one orderable, with a
 * reveal between the doors. It also means the debug view can name every one of
 * them, and a run that does not add up shows as a gap rather than being
 * silently stretched to fit.
 */
function segmentBoxes(run: CabinetRun, segment: RunSegment): CabinetBox[] {
  const boxes: CabinetBox[] = [];
  const base = BASE_BOX;

  eachModule(segment.from, segment.modules, (module, along, index) => {
    if (module.kind === "opening") return;

    // The opening a freestanding full-height appliance stands in. The machine
    // is not joinery; what is beside it and above it is, and those are modules
    // of their own.
    if (module.kind === "tall-open") {
      const top = ft(module.heightIn ?? 96);
      // The cabinet over it, starting an inch above the machine and running to
      // the ceiling. Not a bridge: a bridge spans an opening between two towers
      // from the head of that opening, and this sits on the machine's own top.
      // See docs/decisions.md D11 rule 11.
      const floor = fridgeOpeningH() + ft(LAYOUT_LIMITS.fridge.aboveIn);
      if (top - floor > ft(3)) {
        boxes.push(
          onRun(run, `${segment.id}-over`, "upper", along, [floor, top], ROOM.counterDepth, 0, {
            slot: module.slot,
            module,
          }),
        );
      }
      return;
    }

    // A finished end panel: the piece that closes the side of a tall opening.
    // Only counter deep, so a freestanding machine's doors and handles stand
    // proud of it rather than being buried in it — which is most of what tells
    // one apart from a built-in at a glance.
    //
    // A filler in a tall segment is the same board. The gap a refrigerator door
    // needs against a wall is not left open: it is closed floor to ceiling in
    // the door finish, flush with the panel on the other side, so the run reads
    // as finished cabinetry rather than as a cabinet somebody left out. See
    // docs/decisions.md D11 rule 11.
    //
    // Beside an oven or a coffee tower it stands on the toe kick with the tower;
    // beside a refrigerator or a column, and at the run's exposed end, it goes
    // to the floor (`boardOnKick`, round 92b).
    if (module.kind === "panel" || (module.kind === "filler" && segment.kind === "tall")) {
      boxes.push(
        onRun(
          run,
          `${segment.id}-${module.code}-${index}`,
          "surround",
          along,
          [boardOnKick(run, segment) ? KICK_LIFT : 0, ft(module.heightIn ?? 96)],
          ROOM.counterDepth,
          0,
          { outline: volumeOf(run, segment), slot: module.slot, module, face: "strip" },
        ),
      );
      return;
    }

    // The manufacturer's kit between two columns standing side by side: 5/8"
    // of divider that carries the trim and keeps the two doors off each other.
    // It is behind them — their doors are wider than their cases and close
    // over it — so it is drawn set back and only where the parts are listed.
    if (module.kind === "spacer") {
      const back = ft(TRIM_KIT.setBackIn);
      boxes.push(
        onRun(
          run,
          `${segment.id}-${module.code}-${index}`,
          "surround",
          along,
          [0, ft(module.heightIn ?? 96)],
          ROOM.counterDepth - back,
          -back / 2,
          { outline: segment.id, module, installOnly: true },
        ),
      );
      return;
    }

    if (module.kind === "tall") {
      // A finished panel each side, the appliance opening between them, and a
      // cabinet over the top. That cabinet starts where the opening stops, so
      // raising the opening shortens it rather than leaving the appliance
      // poking through.
      //
      // And under the opening, where the opening does not start at the floor:
      // an oven tower's hole is off the floor and what is below it is a drawer,
      // which is where the trays go. It stands on the run's toe kick like any
      // base cabinet rather than carrying its front down to the floor. A
      // refrigerator's sill is zero and this draws what it always drew.
      const inset = module.insetIn === undefined ? PANEL : ft(module.insetIn);
      const opening = [along[0] + inset, along[1] - inset] as const;
      const outline = segment.id;
      // An oven or coffee tower's own sides stand on the kick with it; a
      // refrigerator's go to the floor (round 92b).
      const tall = [towerOnKick(module) ? KICK_LIFT : 0, ft(module.heightIn ?? 96)] as const;
      const sill = ft(module.sillIn ?? 0);
      const head = Math.min(sill + openingH(module.slot), tall[1]);
      if (inset > 0) {
        boxes.push(
          onRun(run, `${segment.id}-panel-a`, "surround", [along[0], opening[0]], tall, ROOM.counterDepth, 0, { outline, slot: module.slot, module, face: "strip" }),
          onRun(run, `${segment.id}-panel-b`, "surround", [opening[1], along[1]], tall, ROOM.counterDepth, 0, { outline, slot: module.slot, module, face: "strip" }),
        );
      }
      // Over an opening off the floor the box is marked with the machine it
      // stands over, and so is the box stacked on it, which copies it. Whether
      // the two stand off the wall with open backs and a grille depends on the
      // machine in the slot — its `rearVent`, from its manual or Leo's site
      // practice (D11 rule 12, round 73; a steam oven until then) — and that is
      // the selection's business, so `standOffFromWall` is applied where the
      // machine is known.
      const offTheFloor = sill > 0;
      boxes.push(
        onRun(run, `${segment.id}-bridge`, "upper", opening, [head, tall[1]], ROOM.counterDepth, 0, {
          outline,
          slot: module.slot,
          module,
          ...(offTheFloor && module.slot ? { ventSlot: module.slot } : {}),
        }),
      );
      // Where a machine stands on the floor under the opening — D's second
      // dishwasher, E's wine cooler, in the bottom of the coffee cabinet — the
      // cabinetry starts on top of that machine's own opening, and what fills
      // the gap up to the coffee machine is a fixed panel flush with the doors,
      // not a drawer: TCM24PS's manual says not to install it directly above a
      // cabinet drawer (p. 9), and the hoses run down behind the panel (D11
      // rule 14, round 73). With nothing under the opening it is a cabinet.
      const floor = module.lowerSlot
        ? ft(SLOT_BY_ID[module.lowerSlot].cutout.h)
        : ROOM.toeKick;
      if (sill > floor) {
        boxes.push(
          onRun(run, `${segment.id}-base`, "base", opening, [floor, sill], ROOM.counterDepth, 0, {
            outline,
            slot: module.slot,
            module,
            ...(module.lowerSlot ? { face: "strip" as const } : {}),
          }),
        );
      }
      return;
    }

    // Beside the tower, the same stretch is carried on up to its top: the
    // cabinet under the counter, and finished panel from the counter to 96".
    const fillTo = besideTheTower(run, segment);
    if (fillTo !== null) {
      boxes.push(
        onRun(
          run,
          `${segment.id}-fill-${index}`,
          "surround",
          along,
          [ROOM.counterHeight, fillTo],
          ROOM.counterDepth,
          0,
          {
            outline: segment.id,
            module,
            // A filler carried on up beside the tower is still a strip of board.
            // (A panel never reaches here: it is drawn to its full height above.)
            ...(module.kind === "filler" ? { face: "strip" as const } : {}),
          },
        ),
      );
    }

    // A lazy susan is a square: it belongs to both legs, so it is as deep as
    // it is wide and the other leg starts where it stops. Drawing it one
    // cabinet deep is what left a hole at the inside corner. A blind corner
    // says so itself — it is 42" long and still only 24" deep.
    const depth = module.depthIn ? ft(module.depthIn) : ROOM.counterDepth;
    const offset = (depth - ROOM.counterDepth) / 2;
    boxes.push(
      onRun(run, `${segment.id}-${module.code}-${index}`, "base", along, base, depth, offset, {
        module,
        // A filler in a run of base cabinets is a strip of board, not a cabinet.
        ...(module.kind === "filler" ? { face: "strip" as const } : {}),
      }),
    );
  });

  return boxes;
}

/**
 * The bridge over a canopy: from the canopy's top up to the 96" line.
 *
 * It cannot be a stock box. Hanging the canopy 30" over a 36-3/4" cooking
 * surface puts its top at 84-3/4", and 96" less that is 11-1/4" — no supplier
 * lists an 11" bridge, and a made-to-size bridge over a hood is ordinary.
 *
 * Under a 96" ceiling it was ordered to the whole inch and the remainder left
 * as the closing scribe. Since round 37 (D19, scheme A) it carries a 12"
 * stacked box like every other cabinet at 96", so it is made to that line
 * exactly: a quarter inch short and its stack would sit out of level with the
 * stacks beside it. The scribe is over the stacks now.
 */
export function hoodBridgeBand(): readonly [number, number] {
  // The canopy's own top, the model's height and not the slot's 18" (round 78).
  return [hoodTopFt(), ROOM.upperTop] as const;
}

/** A bank of wall cabinets, likewise one box per module. */
function upperBoxes(run: CabinetRun, bank: UpperBank): CabinetBox[] {
  const boxes: CabinetBox[] = [];
  const inset = (ROOM.counterDepth - ROOM.upperDepth) / 2;
  const band = bank.band ?? hoodBridgeBand();
  eachModule(bank.from, bank.modules, (module, along, index) => {
    // Same at high level: a corner wall cabinet reaches into both legs, so the
    // run next to it starts where its square stops rather than overlapping it.
    const depth = module.depthIn ? ft(module.depthIn) : ROOM.upperDepth;
    const across = module.depthIn ? -(ROOM.counterDepth - depth) / 2 : -inset;
    boxes.push(
      onRun(run, `${bank.id}-${module.code}-${index}`, "upper", along, band, depth, across, {
        module,
        slot: module.slot,
        // So is one in a bank of wall cabinets.
        ...(module.kind === "filler" || module.kind === "panel" ? { face: "strip" as const } : {}),
      }),
    );
  });

  /**
   * The crown, along the top of the bank.
   *
   * A hood housing carries its own round its own top section, because that one
   * steps forward with the breast. Everything else on a bank that reaches the
   * top line takes the line along the wall — the cabinets, and the scribe
   * between a breast and the tower beside it — so what a customer sees along
   * the top of that wall is a single line that steps forward where the breast
   * does and is unbroken everywhere else.
   *
   * Since round 37 that line is the stacked boxes' top, 108", not the ceiling:
   * a bank that stops at 96" has its stack over it, and a housing runs up to
   * the same line. D19.
   */
  const reachesTheTop =
    Math.abs(band[1] - ROOM.upperTop) < 1e-6 || Math.abs(band[1] - ROOM.stackTop) < 1e-6;
  if (reachesTheTop) {
    const moulding = ft(HOOD_CABINET.mouldingIn);
    const proud = ft(HOOD_CABINET.mouldingProudIn);
    const depth = ROOM.upperDepth + proud;
    for (const [index, along] of crownRuns(bank).entries()) {
      boxes.push(
        onRun(
          run,
          `${bank.id}-crown-${index}`,
          "upper",
          along,
          // Against the ceiling, covering the half-inch scribe over the
          // stacks, which is what a crown is for. Round 39.
          [ROOM.wallHeight - moulding, ROOM.wallHeight] as const,
          depth,
          -(ROOM.counterDepth - depth) / 2,
          // No module: it is a length of moulding along the bank rather than
          // one of the boxes in it, and every rule that counts boxes skips it.
          {},
        ),
      );
    }
  }
  return boxes;
}

/**
 * The stretches of a bank the crown runs along: all of it, less the housing.
 *
 * Contiguous modules make one length of moulding rather than one per cabinet,
 * which is how it is cut and how it has to be drawn — two lengths meeting in
 * the middle of a wall show a seam the joiner never made.
 */
function crownRuns(bank: UpperBank): (readonly [number, number])[] {
  const runs: [number, number][] = [];
  let open: [number, number] | null = null;
  eachModule(bank.from, bank.modules, (module, along) => {
    if (module.kind === "hood-cabinet") {
      if (open) runs.push(open);
      open = null;
      return;
    }
    if (open && Math.abs(open[1] - along[0]) < 1e-9) open[1] = along[1];
    else {
      if (open) runs.push(open);
      open = [along[0], along[1]];
    }
  });
  if (open) runs.push(open);
  return runs;
}

/**
 * The box stacked on a cabinet that finishes at 96".
 *
 * Leo, round 37 (D19, scheme A): under the 108-1/2" ceiling every tall cabinet,
 * tower, bridge and wall cabinet that stops at 96" takes a 12" box on top — a
 * stocked height, on the same run and in the same finish — and the half inch
 * left over is the closing scribe D13 has always allowed. There is a door seam
 * at 96", and that is accepted: it is what a stacked cabinet is.
 *
 * It has the footprint of the box under it, so it is as deep as that box and
 * stands where that box stands: 12" over a wall cabinet, 24" over a tower, and
 * off the wall where the box under it is. Narrower than the narrowest cabinet
 * anybody stocks it is not a cabinet but the same board carried on up.
 */
function stackOn(run: CabinetRun, box: CabinetBox): CabinetBox[] {
  if (box.installOnly || box.kind === "counter" || box.kind === "toe") return [];
  if (/-crown-\d+$/.test(box.id)) return [];
  const top = box.position[1] + box.size[1] / 2;
  if (![ROOM.upperTop, ROOM.tallTop].some((line) => Math.abs(top - line) < 1e-6)) return [];

  const height = ROOM.stackTop - top;
  const sixteenths = (feet: number) => Math.round(feet * 12 * 16) / 16;
  const extents = extentsOnAxis(run.axis, box.size[0], box.size[2]);
  const widthIn = sixteenths(extents.along);
  const depthIn = sixteenths(extents.across);
  const heightIn = sixteenths(height);
  const board = widthIn < CABINET_STANDARDS.widthIn.min;
  const module: CabinetModule = board
    ? { code: `PNL${widthIn}X${heightIn}`, kind: "panel", widthIn, heightIn }
    : {
        code: `W${widthIn}${heightIn}${depthIn === CABINET_STANDARDS.upper.depthIn ? "" : `-${depthIn}D`}`,
        kind: "wall",
        widthIn,
        heightIn,
        depthIn,
      };
  return [
    {
      ...box,
      id: `${box.id}-stack`,
      kind: board ? "surround" : "upper",
      module,
      // A board carried on up is a board; a 12" box on a cabinet is a cabinet,
      // whatever the box under it was.
      face: board ? "strip" : undefined,
      position: [box.position[0], top + height / 2, box.position[2]],
      size: [box.size[0], height, box.size[2]],
    },
  ];
}

/**
 * A box stood off the wall by `inches`, its front where it was.
 *
 * The cabinets over a steam oven stand off the wall with their backs open
 * (D11 rule 12, round 39): shallower by the stand-off, the same face to the
 * room. Only run boxes stand over an oven, and a run's boxes face +x on the
 * left wall and +z on the back one.
 */
export function standOffFromWall(
  box: CabinetBox,
  inches: number = TOWER_VENT.bridgeStandOffIn,
): CabinetBox {
  const off = ft(inches);
  const axis = axisIndex(box.facing.axis);
  const size = [...box.size] as [number, number, number];
  const position = [...box.position] as [number, number, number];
  size[axis] -= off;
  position[axis] += off / 2;
  return { ...box, size, position };
}

function runBoxes(run: CabinetRun): CabinetBox[] {
  const boxes: CabinetBox[] = run.segments.flatMap((segment) => segmentBoxes(run, segment));

  for (const bank of run.uppers) boxes.push(...upperBoxes(run, bank));

  // D19, scheme A: a 12" stacked box on everything that finishes at 96".
  for (const box of [...boxes]) boxes.push(...stackOn(run, box));

  // The toe kick runs under the cabinetry, and stops where the cabinetry does.
  // A range — freestanding or slide-in — stands on the floor between two runs
  // of boxes, and so does a freestanding refrigerator: a recessed board carried
  // on behind either is a board behind nothing. A rangetop does not: it drops
  // into the stone over a drawer base, which stands on the kick like any base
  // cabinet, so the kick runs on under it. Which it is, is round 83's one
  // answer (`dropsIntoCounter`), asked of the range the room is built round —
  // the question the run asked when it ordered that drawer base or left the
  // opening. Round 92b, from Leo trying it on B and D: the kick broke at every
  // cooking opening, and under their rangetop a strip of floor showed.
  //
  // Round 92b (Leo): the cabinets stand on it, so it shows — 4" high, its front
  // 3" behind the carcass front, in the doors' finish (CabinetLayer).
  //
  // At the inside corner the leg without the corner box starts at the other
  // leg's carcass front; its kick starts at the other leg's kick front instead,
  // so the two meet with no notch between them.
  let start = run.segments[0].from - intoTheCorner(run);
  const rangeOnTheFloor = standsOnTheFloor(rangeModelFor(PACKAGE));
  for (const [i, segment] of run.segments.entries()) {
    // And a machine standing on the floor in the bottom of a tower — the wine
    // cooler under E's coffee machine, D's second dishwasher — stands on its
    // own kick panel: PRW24C01CG breathes through the vent in its base, which
    // must never be covered (its manual, pp. 6 and 13). Round 73.
    const breaks =
      (segment.slot === "slot-range" && rangeOnTheFloor) ||
      segment.modules.some((module) => module.kind === "tall-open" || module.lowerSlot !== undefined);
    const last = i === run.segments.length - 1;
    // A break is exactly at the machine's side. The run's far end is not a
    // break. Round 50 (Leo): the kick used to run to the very end, flush with
    // the last cabinet's side, and a door wrongly hung on the side had been
    // covering its end. Round 92b (Leo): where the run ends on a board that goes
    // to the floor — an end panel, a column's or a refrigerator's side — the
    // kick stops at its inside face, so the recess shows only at the front;
    // where it ends on a filler against the wall, the filler stands on the kick
    // and the kick runs to the wall under it.
    // At a range narrower than its opening the break is the machine's own
    // sides: the fillers either side are the run's boards and the kick runs
    // under them (round 84, Leo).
    const [breakFrom, breakTo] =
      segment.slot === "slot-range" ? openingAlong(segment) : [segment.from, segment.to];
    const end = breaks ? breakFrom : last ? segment.to - endOnTheFloor(segment) : segment.to;
    if ((breaks || last) && end > start) {
      boxes.push(
        onRun(
          run,
          `${run.id}-toe-${boxes.length}`,
          "toe",
          [start, end],
          [0, ROOM.toeKick],
          ROOM.counterDepth - ROOM.toeRecess,
          -ROOM.toeRecess / 2,
        ),
      );
    }
    if (breaks) start = breakTo;
  }

  const corner = cornerKick(run);
  if (corner) boxes.push(corner);

  return boxes;
}

/** The leg that holds the corner box, if either does. */
const cornerRun = () => RUNS.find((run) => run.segments[0]?.kind === "corner");

/**
 * How far a leg's kick reaches past its first segment into the corner.
 *
 * Nothing for the leg that holds the corner box: its kick starts at the wall.
 * The other leg starts at the corner box's front — 24" off the wall for a blind
 * corner, 36" for a susan — and its kick has to start at the corner leg's kick
 * front, 21" off that wall, or the two leave a notch between them.
 */
function intoTheCorner(run: CabinetRun): number {
  const holder = cornerRun();
  if (!holder || holder === run) return 0;
  const corner = holder.segments[0].modules.find((module) => module.kind === "corner");
  const depth = corner?.depthIn ? ft(corner.depthIn) : ROOM.counterDepth;
  return depth - (ROOM.counterDepth - ROOM.toeRecess);
}

/**
 * How much of a run's last segment, at its far end, goes to the floor: the
 * board that closes the run (round 92b). Nothing where the run ends on
 * something standing on the kick — a cabinet, or a filler against the wall.
 */
function endOnTheFloor(segment: RunSegment): number {
  // A board segment of its own — a column's or a refrigerator's side, or a
  // tower's at the run's end — goes to the floor whole.
  if (segment.kind === "tall" && segment.modules.every((module) => module.kind === "panel" || module.kind === "filler")) {
    return segment.to - segment.from;
  }
  // A refrigerator's enclosure that ends the run: its outer board goes to the
  // floor (`towerOnKick`), and a kick run to the run's end would have its end
  // face in that board's outer face — two faces in one plane, which flicker
  // (found by round 92b's pixel diff, package A's left run on a phone).
  const tall = segment.modules[segment.modules.length - 1];
  if (segment.kind === "tall" && tall?.kind === "tall" && !towerOnKick(tall)) {
    return tall.insetIn === undefined ? PANEL : ft(tall.insetIn);
  }
  // A run of base cabinets that ends on its finished end panel.
  let floor = 0;
  for (const module of [...segment.modules].reverse()) {
    if (module.kind !== "panel") break;
    floor += ft(module.widthIn);
  }
  return floor;
}

/**
 * The toe kick under a corner susan's diagonal door.
 *
 * The susan is a square that belongs to both legs, and its one door runs
 * across the corner on the chord between the two legs' fronts (`diagonalDoor`).
 * The two legs' kicks leave the triangle behind that door without one, so this
 * piece runs along the chord, 3" behind it like every other kick front, from
 * one leg's kick front to the other's. A blind corner is a straight box and
 * needs none: the legs' kicks meet (`intoTheCorner`). Round 92b.
 */
function cornerKick(run: CabinetRun): CabinetBox | null {
  if (cornerRun() !== run) return null;
  const segment = run.segments[0];
  const module = segment.modules.find((m) => m.kind === "corner");
  if (!module?.depthIn || module.depthIn !== module.widthIn) return null;

  // In the corner's own terms: `a` along this leg from the corner's wall, `c`
  // out from this leg's wall, both in feet.
  const leg = ft(module.widthIn);
  const front = ROOM.counterDepth - ROOM.toeRecess;
  // The chord is a + c = leg + counter depth; the kick's front 3" behind it.
  const line = leg + ROOM.counterDepth - ROOM.toeRecess * Math.SQRT2;
  const wall = run.centre - ROOM.counterDepth / 2;
  const world = (a: number, c: number) => onAxis(run.axis, segment.from + a, wall + c, 0);
  const p1 = world(front, line - front);
  const p2 = world(line - front, front);
  const inner = world(front, front);
  const length = Math.hypot(p2[0] - p1[0], p2[2] - p1[2]);
  // Deep enough to reach the corner of the two legs' kick fronts behind it.
  const depth = ((line - 2 * front) / Math.SQRT2) * 1.25;
  const mid = [(p1[0] + p2[0]) / 2, (p1[2] + p2[2]) / 2] as const;
  const back = Math.hypot(inner[0] - mid[0], inner[2] - mid[1]);
  const toward = [(inner[0] - mid[0]) / back, (inner[2] - mid[1]) / back] as const;
  return {
    id: `${run.id}-toe-corner`,
    kind: "toe",
    run: run.id,
    facing: stripFacing(run.axis, 1),
    position: [mid[0] + (toward[0] * depth) / 2, ROOM.toeKick / 2, mid[1] + (toward[1] * depth) / 2],
    size: [length, ROOM.toeKick, depth],
    rotationY: Math.atan2(-(p2[2] - p1[2]), p2[0] - p1[0]),
  };
}

/**
 * The L-shaped cabinet run plus the island, built so the finished view, the
 * white model and the install wireframe all read from the same boxes.
 */
function buildCabinets(): CabinetBox[] {
  return [
    ...RUNS.flatMap(runBoxes),
    ...(ISLAND.present ? islandBoxes().map((box) => ({ ...box, run: "island" as const })) : []),
  ];
}

/**
 * The island.
 *
 * The two openings come in from opposite faces, so the carcass is the island
 * minus each of them: solid across the full depth where there is no opening,
 * and solid behind each opening on its own side. A kitchen whose parameters ask
 * for no island has none of these boxes at all — the microwave and the wine
 * cabinet go on the perimeter instead.
 */
function islandBoxes(): Omit<CabinetBox, "run">[] {
  const along = islandAlong(ISLAND);
  const across = islandAcross(ISLAND);

  /**
   * One box on the island, in the island's own terms.
   *
   * How far along it, how far across it, how tall — and the last step turns
   * that into the room's axes. Written this way because everything here is a
   * statement about the island rather than about the room: the carcass beside
   * an opening, the carcass behind one, the top over all of it.
   */
  const box = (
    id: string,
    alongSpan: readonly [number, number],
    acrossSpan: readonly [number, number],
    /** Floor to top; a bare height is from the floor. */
    y: number | readonly [number, number],
    extra: Partial<Omit<CabinetBox, "run">> = {},
  ): Omit<CabinetBox, "run"> => {
    const [sizeX, sizeZ] = sizeOnAxis(ISLAND.axis, span(alongSpan), span(acrossSpan));
    const band = typeof y === "number" ? ([0, y] as const) : y;
    return {
      id,
      kind: "base",
      position: islandPoint(ISLAND, mid(alongSpan), mid(acrossSpan), mid(band)),
      size: [sizeX, span(band), sizeZ],
      // The side a cook works from, unless the box is on the seating side:
      // `extra` says so for the carcass behind an opening that faces the seats.
      facing: stripFacing(ISLAND.axis, -1),
      ...extra,
    };
  };

  /**
   * Under a cooktop, a drawer base on the working side and a carcass behind it.
   *
   * The drawer base stops short of the counter by the guide's 3-3/4" to the top
   * of its drawer, and short of the carcass behind it by the 13/16" at its back,
   * so both gaps are in the drawing as the guide states them (CIT367YG, page 7).
   * The top is cut for the cooktop in counter.ts, where every cutout is.
   */
  const cooktop = islandHasCooktop(ISLAND);
  const underCooktop = cooktop
    ? [
        box(
          "island-cooktop-drawers",
          ISLAND.cooktop,
          [ISLAND.working, ISLAND.working + ROOM.counterDepth - ft(COOKTOP_CABINET.rearGapIn)],
          [KICK_LIFT, ROOM.counterHeight - ft(COOKTOP_CABINET.drawerTopBelowCounterIn)],
          { outline: "island", slot: "slot-cooktop" },
        ),
        box(
          "island-behind-cooktop",
          ISLAND.cooktop,
          [ISLAND.working + ROOM.counterDepth, across[1]],
          BASE_BOX,
          { outline: "island", slot: "slot-cooktop", facing: stripFacing(ISLAND.axis, 1) },
        ),
      ]
    : [];

  return [
    box("island-left", [along[0], ISLAND.microwave[0]], across, BASE_BOX, {
      outline: "island",
    }),
    ...(cooktop
      ? [
          box("island-middle", [ISLAND.microwave[1], ISLAND.cooktop[0]], across, BASE_BOX, {
            outline: "island",
          }),
          ...underCooktop,
          box("island-middle-2", [ISLAND.cooktop[1], ISLAND.wine[0]], across, BASE_BOX, {
            outline: "island",
          }),
        ]
      : [
          box("island-middle", [ISLAND.microwave[1], ISLAND.wine[0]], across, BASE_BOX, {
            outline: "island",
          }),
        ]),
    box("island-right", [ISLAND.wine[1], along[1]], across, BASE_BOX, { outline: "island" }),
    // Behind the microwave, on the seating side.
    //
    // Part of that appliance's own enclosure, and it says so: an appliance's
    // own joinery must never count as something standing in its way, or flying
    // to the microwave fades the box the microwave is sitting in.
    box(
      "island-behind-microwave",
      ISLAND.microwave,
      [ISLAND.working + ROOM.counterDepth, across[1]],
      BASE_BOX,
      { outline: "island", slot: "slot-microwave", facing: stripFacing(ISLAND.axis, 1) },
    ),
    // Behind the wine cabinet, on the working side. Its enclosure too.
    box(
      "island-behind-wine",
      ISLAND.wine,
      [across[0], ISLAND.seating - ROOM.counterDepth],
      BASE_BOX,
      { outline: "island", slot: "slot-wine" },
    ),
    // With a cooktop the top is a slab with a hole in it, drawn with the rest
    // of the stone (`counterOutline`); a box cannot have one.
    ...(cooktop
      ? []
      : [
    {
      ...box(
        "island-counter",
        [along[0] - ROOM.counterOverhang, along[1] + ROOM.counterOverhang],
        // The seating side reaches past the cabinets by the overhang where
        // there is one, and by the ordinary 1" lap where there is not. D20.
        [across[0] - ROOM.counterOverhang, across[1] + Math.max(ft(ISLAND.overhangIn), ROOM.counterOverhang)],
        ROOM.counterThickness,
      ),
      kind: "counter" as const,
      position: islandPoint(
        ISLAND,
        mid(along),
        mid(across),
        ROOM.counterHeight - ROOM.counterThickness / 2,
      ),
    },
        ]),
    {
      ...box(
        "island-toe",
        // Set in 3" on all four sides, the seating side and the ends too: the
        // island stands on its kick all round (round 92b, Leo).
        [along[0] + ROOM.toeRecess, along[1] - ROOM.toeRecess],
        [across[0] + ROOM.toeRecess, across[1] - ROOM.toeRecess],
        ROOM.toeKick,
      ),
      kind: "toe" as const,
    },
  ];
}

/** Trim pieces that only add line noise at phone scale. */
const OUTLINE_SKIP: CabinetKind[] = ["counter", "toe"];

/**
 * The 45-degree door across a corner susan, or null for anything else.
 *
 * A corner lazy susan reads from the room as one diagonal door, not as two flat
 * fronts meeting at a right angle — the door is what you see and the square
 * carcass is what is behind it. A blind corner is a long shallow box with an
 * ordinary front, and gets one.
 *
 * Everything is in the box's own frame, centred on it, with the room at +x and
 * +z: that is the inside corner of the L, and it is where the door faces.
 */
export function diagonalDoor(box: CabinetBox): {
  /** Centre of the door on the floor plan, in feet from the box's centre. */
  x: number;
  z: number;
  /** The chord it spans, in feet. */
  width: number;
  /** A quarter turn, so the door faces the corner it cuts across. */
  rotationY: number;
} | null {
  const module = box.module;
  if (!module || module.kind !== "corner") return null;
  // The square one. A blind corner is 42" of run only 24" deep.
  if (module.depthIn === undefined || module.depthIn !== module.widthIn) return null;

  // The face is not a figure anybody stores: it is what is left when the two
  // adjacent runs meet the corner box. Their fronts land on it at (leg, depth)
  // and (depth, leg), so the door spans (leg - depth) on each axis, and the
  // chord across is that times root two. A 36" susan between 24" runs makes a
  // 17" door, not the 24" a first reading of the note assumed.
  const leg = ft(module.widthIn);
  const adjacent = box.kind === "upper" ? ROOM.upperDepth : ROOM.counterDepth;
  const cut = leg - adjacent;
  if (cut <= 0) return null;
  const width = cut * Math.SQRT2;
  // The chord's midpoint, measured from the box's own centre toward the room.
  const mid = leg / 2 - cut / 2;
  return { x: mid, z: mid, width, rotationY: Math.PI / 4 };
}

/**
 * Whether a box is finished in the door colour.
 *
 * The counter is stone whatever the doors are; every other box in the room is
 * the cabinetmaker's, and takes the run's finish — the toe kick too since round
 * 92b (Leo): it follows the door colour, the accent run, a RAL colour and oak.
 * Until then it was a dark board hidden inside the carcass.
 */
export function wearsDoorFinish(kind: CabinetKind) {
  return kind !== "counter";
}

function unionBox(id: string, boxes: CabinetBox[]): CabinetBox {
  const axes = [0, 1, 2].map((axis) => {
    const min = Math.min(...boxes.map((b) => b.position[axis] - b.size[axis] / 2));
    const max = Math.max(...boxes.map((b) => b.position[axis] + b.size[axis] / 2));
    return { centre: (min + max) / 2, extent: max - min };
  });
  return {
    id,
    kind: boxes[0].kind,
    slot: boxes[0].slot,
    run: boxes[0].run,
    facing: boxes[0].facing,
    position: [axes[0].centre, axes[1].centre, axes[2].centre],
    size: [axes[0].extent, axes[1].extent, axes[2].extent],
  };
}

/**
 * The cabinetry reduced to its outer volumes: trim omitted, and each outline
 * group collapsed to a single box. This is what the install view draws on a
 * phone, where the full carcass wireframe turns into noise.
 */
function buildOutlines(): CabinetBox[] {
  const result: CabinetBox[] = [];
  const groups = new Map<string, CabinetBox[]>();

  for (const box of CABINETS) {
    if (OUTLINE_SKIP.includes(box.kind)) continue;
    if (box.outline) {
      const bucket = groups.get(box.outline);
      if (bucket) bucket.push(box);
      else groups.set(box.outline, [box]);
    } else {
      result.push(box);
    }
  }

  for (const [id, boxes] of groups) result.push(unionBox(id, boxes));
  return result;
}

export let CABINETS: CabinetBox[];
export let CABINET_OUTLINES: CabinetBox[];

/**
 * Re-cut the carcass for the room as it now stands.
 *
 * Called after the runs and the slots have been replaced, never before: the
 * boxes are derived from both, and a half-updated set would draw a cabinet run
 * from one layout around appliances from another.
 */
export function rebuildCabinets() {
  CABINETS = buildCabinets();
  CABINET_OUTLINES = buildOutlines();
}

rebuildCabinets();

/**
 * One label per cabinet, not per box.
 *
 * A tall enclosure is drawn as three pieces — two panels and the bridge over
 * the opening — that all carry the same module, and three copies of "T4296"
 * stacked on each other reads as a rendering fault.
 */
export function labelledBoxes() {
  const seen = new Set<CabinetModule>();
  return CABINETS.filter((box) => {
    if (!box.module || box.module.kind === "opening") return false;
    if (seen.has(box.module)) return false;
    seen.add(box.module);
    return true;
  });
}
