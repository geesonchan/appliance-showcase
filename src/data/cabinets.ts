import type { SlotId } from "../types";
import { HOOD_CABINET } from "./insertHood";
import { islandAcross, islandPoint } from "./layoutTemplate";
import { PACKAGE_SLOTS } from "./packages";
import { SLOT_BY_ID } from "./slots";
import {
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
  /** Centre of the box, in feet. */
  position: [number, number, number];
  /** Full extents, in feet. */
  size: [number, number, number];
}

/** The base box under the top: 34.5" plus a 1.5" counter makes 36". */
const BASE_BOX = [0, ROOM.counterHeight - ROOM.counterThickness] as const;

/** The refrigerator opening's height, in feet, as the slot actually declares it. */
const fridgeOpeningH = () => ft(SLOT_BY_ID["slot-fridge"].cutout.h);

/**
 * Whether this stretch is filled to the top of the oven tower beside it.
 *
 * A tower in the middle of a run is 96" of joinery, and a strip of bare wall
 * down the side of it is a detail nobody builds — so what finishes the run
 * beside it is carried up to its top.
 *
 * The side toward the cooking surface is not, and that is the whole
 * difference: what is between the tower and the machine is the clearance the
 * rangetop's own sheet asks for — five inches to anything beside it — and it
 * has to read as counter, not as the tower's side carried down to the stone.
 * So the far side is filled and the near side keeps its worktop.
 */
function besideTheTower(run: CabinetRun, segment: RunSegment): number | null {
  const at = run.segments.indexOf(segment);
  if (segment.kind !== "counter") return null;
  const rangeAt = run.segments.findIndex((s) => s.slot === "slot-range");

  for (const towerAt of [at - 1, at + 1]) {
    const tower = run.segments[towerAt];
    if (!tower || tower.kind !== "tall" || !tower.slot) continue;
    if (PACKAGE_SLOTS[tower.slot]?.beside !== "range") continue;
    // Between the tower and the machine: that stretch is the clearance.
    if (rangeAt >= 0 && Math.sign(rangeAt - towerAt) === Math.sign(at - towerAt)) continue;
    const module = tower.modules.find((m) => m.kind === "tall");
    return ft(module?.heightIn ?? 96);
  }
  return null;
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
  const size: [number, number, number] =
    run.axis === "x"
      ? [span(along), span(y), depth]
      : [depth, span(y), span(along)];
  const position: [number, number, number] =
    run.axis === "x" ? [mid(along), mid(y), across] : [across, mid(y), mid(along)];
  return { id, kind, position, size, run: run.id, ...extra };
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
    if (module.kind === "panel" || (module.kind === "filler" && segment.kind === "tall")) {
      boxes.push(
        onRun(
          run,
          `${segment.id}-${module.code}-${index}`,
          "surround",
          along,
          [0, ft(module.heightIn ?? 96)],
          ROOM.counterDepth,
          0,
          { outline: volumeOf(run, segment), slot: module.slot, module },
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
      // an oven tower's hole is 18" up and what is below it is a drawer base,
      // which is where the trays go. A refrigerator's sill is zero and this
      // draws what it always drew.
      const inset = module.insetIn === undefined ? PANEL : ft(module.insetIn);
      const opening = [along[0] + inset, along[1] - inset] as const;
      const outline = segment.id;
      const tall = [0, ft(module.heightIn ?? 96)] as const;
      const sill = ft(module.sillIn ?? 0);
      const head = Math.min(sill + openingH(module.slot), tall[1]);
      if (inset > 0) {
        boxes.push(
          onRun(run, `${segment.id}-panel-a`, "surround", [along[0], opening[0]], tall, ROOM.counterDepth, 0, { outline, slot: module.slot, module }),
          onRun(run, `${segment.id}-panel-b`, "surround", [opening[1], along[1]], tall, ROOM.counterDepth, 0, { outline, slot: module.slot, module }),
        );
      }
      boxes.push(
        onRun(run, `${segment.id}-bridge`, "upper", opening, [head, tall[1]], ROOM.counterDepth, 0, { outline, slot: module.slot, module }),
      );
      if (sill > 0) {
        boxes.push(
          onRun(run, `${segment.id}-base`, "base", opening, [0, sill], ROOM.counterDepth, 0, {
            outline,
            slot: module.slot,
            module,
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
          { outline: segment.id, module },
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
      }),
    );
  });

  return boxes;
}

/**
 * The bridge over a canopy: from the canopy's top up to the ceiling, less a
 * closing scribe.
 *
 * It cannot be a stock box. Hanging the canopy 30" over a 36-3/4" cooking
 * surface puts its top at 84-3/4", and 96" less that is 11-1/4" — no supplier
 * lists an 11" bridge. A made-to-size bridge over a hood is ordinary, so it is
 * ordered to the whole inch and the remainder becomes the closing gap D13
 * allows at the ceiling.
 */
export function hoodBridgeBand(): readonly [number, number] {
  const hood = SLOT_BY_ID["slot-hood"];
  const floor = hood.position[1] + ft(hood.cutout.h);
  const heightIn = Math.floor((ROOM.wallHeight - floor) * 12);
  return [floor, floor + ft(heightIn)] as const;
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
      }),
    );
  });

  /**
   * The crown, along the top of the bank.
   *
   * A hood housing carries its own round its own top section, because that one
   * steps forward with the breast. Everything else on a bank that reaches the
   * ceiling takes the line along the wall — the cabinets, and the scribe
   * between a breast and the tower beside it — so what a customer sees along
   * the top of that wall is a single line that steps forward where the breast
   * does and is unbroken everywhere else.
   */
  if (Math.abs(band[1] - ROOM.wallHeight) < 1e-6) {
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
          [band[1] - moulding, band[1]] as const,
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

function runBoxes(run: CabinetRun): CabinetBox[] {
  const boxes: CabinetBox[] = run.segments.flatMap((segment) => segmentBoxes(run, segment));

  for (const bank of run.uppers) boxes.push(...upperBoxes(run, bank));

  // The toe kick runs under the cabinetry, and stops where the cabinetry does.
  // A freestanding range stands on the floor between two runs of boxes, and so
  // does a freestanding refrigerator: a recessed board carried on behind
  // either is a board behind nothing.
  let start = run.segments[0].from;
  for (const [i, segment] of run.segments.entries()) {
    const breaks =
      segment.slot === "slot-range" ||
      segment.modules.some((module) => module.kind === "tall-open");
    const end = breaks ? segment.from : segment.to;
    const last = i === run.segments.length - 1;
    if ((breaks || last) && end > start) {
      boxes.push(
        onRun(
          run,
          `${run.id}-toe-${boxes.length}`,
          "toe",
          [start, end],
          [0, ROOM.toeKick],
          ROOM.counterDepth - ft(3),
          -ft(1.5),
        ),
      );
    }
    if (breaks) start = segment.to;
  }

  return boxes;
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
  const along = ISLAND.axis === "x" ? ISLAND.x : ISLAND.z;
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
    height: number,
    extra: Partial<Omit<CabinetBox, "run">> = {},
  ): Omit<CabinetBox, "run"> => ({
    id,
    kind: "base",
    position: islandPoint(ISLAND, mid(alongSpan), mid(acrossSpan), height / 2),
    size:
      ISLAND.axis === "x"
        ? [span(alongSpan), height, span(acrossSpan)]
        : [span(acrossSpan), height, span(alongSpan)],
    ...extra,
  });

  return [
    box("island-left", [along[0], ISLAND.microwave[0]], across, BASE_BOX[1], {
      outline: "island",
    }),
    box("island-middle", [ISLAND.microwave[1], ISLAND.wine[0]], across, BASE_BOX[1], {
      outline: "island",
    }),
    box("island-right", [ISLAND.wine[1], along[1]], across, BASE_BOX[1], { outline: "island" }),
    // Behind the microwave, on the seating side.
    //
    // Part of that appliance's own enclosure, and it says so: an appliance's
    // own joinery must never count as something standing in its way, or flying
    // to the microwave fades the box the microwave is sitting in.
    box(
      "island-behind-microwave",
      ISLAND.microwave,
      [ISLAND.working + ROOM.counterDepth, across[1]],
      BASE_BOX[1],
      { outline: "island", slot: "slot-microwave" },
    ),
    // Behind the wine cabinet, on the working side. Its enclosure too.
    box(
      "island-behind-wine",
      ISLAND.wine,
      [across[0], ISLAND.seating - ROOM.counterDepth],
      BASE_BOX[1],
      { outline: "island", slot: "slot-wine" },
    ),
    {
      ...box(
        "island-counter",
        [along[0] - ROOM.counterOverhang, along[1] + ROOM.counterOverhang],
        [across[0] - ROOM.counterOverhang, across[1] + ROOM.counterOverhang],
        ROOM.counterThickness,
      ),
      kind: "counter",
      position: islandPoint(
        ISLAND,
        mid(along),
        mid(across),
        ROOM.counterHeight - ROOM.counterThickness / 2,
      ),
    },
    {
      ...box(
        "island-toe",
        [along[0] + ft(1.5), along[1] - ft(1.5)],
        [across[0] + ft(1.5), across[1] - ft(1.5)],
        ROOM.toeKick,
      ),
      kind: "toe",
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
 * The counter is stone and the toe kick is dark whatever the doors are; every
 * other box in the room is the cabinetmaker's, and takes the run's finish.
 */
export function wearsDoorFinish(kind: CabinetKind) {
  return !OUTLINE_SKIP.includes(kind);
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
