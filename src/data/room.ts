import {
  DEFAULT_PARAMS,
  fridgeOpeningOf,
  generateLayout,
  type GeneratedLayout,
  type LayoutParams,
  type Refusal,
  type SlotPlacement,
} from "./layoutTemplate";
import {
  LAYOUT_LIMITS,
  ROOM,
  ft,
  setRoomSize,
  type CabinetRun,
  type RunSegment,
} from "./roomShell";
import type { ResolvedWindow } from "./windows";
import type { FixtureId, SlotId } from "../types";

export * from "./roomShell";
export { PARAM_LIMITS, DEFAULT_PARAMS } from "./layoutTemplate";
export type {
  LayoutParams,
  Refusal,
  RequirementItem,
  SlotPlacement,
  IslandLayout,
  WallRequirement,
} from "./layoutTemplate";
export { feasibleRange, wallRequirement, generateLayout } from "./layoutTemplate";
export { WINDOW, type ResolvedWindow, type WindowOpening } from "./windows";

/**
 * The room this page is showing.
 *
 * Scheme 01 is no longer written out by hand: it is what the L-with-island
 * template produces for a set of parameters. Those parameters are now changed
 * on screen while the page is running, so nothing here can be a constant —
 * every export is a live binding that `applyLayout` reassigns, and the modules
 * derived from them (slots, fixtures, cabinets) have rebuild functions of their
 * own that `layoutState.ts` calls in order.
 *
 * Live bindings rather than a context or a store because this is not interface
 * state: it is the room. Half the code that reads it is geometry that runs
 * inside the render loop, and threading a hook through all of it would make
 * every one of those files know about React.
 */

/** What the parameters asked for, which is not always what could be built. */
export let REQUESTED_PARAMS: LayoutParams = DEFAULT_PARAMS;

/** What the template refused to build, and why. Empty when it built. */
export let LAYOUT_ISSUES: Refusal[] = [];

export let LAYOUT: GeneratedLayout;
export let LAYOUT_PARAMS: LayoutParams;
export let RUNS: CabinetRun[];
export let RUN_BY_ID: Record<CabinetRun["id"], CabinetRun>;

/** Centre lines of the two runs, kept as named values for the scene code. */
export let RUN: { backZ: number; leftX: number };

/**
 * The refrigerator opening, inset from its enclosure by one finished panel
 * each side.
 */
export let FRIDGE_OPENING: readonly [number, number];

/**
 * Wall left clear above the range for the canopy.
 *
 * The canopy's own width, which is the range's: the wall cabinets come right up
 * to its flanks on both sides. See docs/decisions.md D13.
 */
export let HOOD_OPENING: readonly [number, number];

/**
 * The island: as long and as deep as the parameters ask for, standing clear of
 * both perimeter runs.
 *
 * The two openings face opposite ways, and that is deliberate. The microwave
 * drawer opens toward the perimeter, where the cook stands. The wine cabinet
 * opens toward the seating side, where the person pouring stands — and, not by
 * accident, toward the camera, so the overview shows a glass door rather than a
 * blank cabinet end. See docs/decisions.md D5.
 */
export let ISLAND: GeneratedLayout["island"];

export let SLOT_PLACEMENT: Partial<Record<SlotId, SlotPlacement>>;
/**
 * The machines this room was built without: never more than the island's two,
 * and only in a room with no island short of the wall to carry them.
 *
 * Read it before drawing or counting anything keyed by slot. They keep their
 * entries everywhere else — a missing key is a crash rather than an absence —
 * so this is the one place that says what is actually in the room.
 */
export let OMITTED_SLOTS: readonly SlotId[] = [];
/** Whether a slot is one the room was built without. */
export const isOmitted = (slotId: SlotId) => OMITTED_SLOTS.includes(slotId);
export let FIXTURE_PLACEMENT: Record<FixtureId, SlotPlacement>;

/**
 * The windows, with their place on the wall worked out.
 *
 * The scene draws them, the shell cuts its walls to them and the checklist
 * quotes their figures. See `windows.ts` and docs/decisions.md D11 rule 13.
 */
export let WINDOWS: ResolvedWindow[] = [];

/** Install a generated layout as the room. Everything derived follows. */
export function applyLayout(layout: GeneratedLayout, requested: LayoutParams, issues: Refusal[]) {
  LAYOUT = layout;
  LAYOUT_PARAMS = layout.params;
  // The shell follows the walls the layout was generated for, so the room, the
  // camera framing and the plan cannot disagree about how big the kitchen is.
  setRoomSize(layout.params.backWallIn, layout.params.leftWallIn);
  REQUESTED_PARAMS = requested;
  LAYOUT_ISSUES = issues;

  RUNS = layout.runs;
  RUN_BY_ID = Object.fromEntries(RUNS.map((run) => [run.id, run])) as Record<
    CabinetRun["id"],
    CabinetRun
  >;
  RUN = { backZ: RUN_BY_ID.back.centre, leftX: RUN_BY_ID.left.centre };

  FRIDGE_OPENING = fridgeOpeningOf(layout);
  const range = segmentForSlot("slot-range");
  HOOD_OPENING = range ? ([range.from, range.to] as const) : ([0, 0] as const);

  ISLAND = layout.island;
  SLOT_PLACEMENT = layout.slots;
  OMITTED_SLOTS = layout.omitted;
  FIXTURE_PLACEMENT = layout.fixtures;
  WINDOWS = layout.windows;
}

/**
 * Which side a column's hinge goes, in the appliance's own frame.
 *
 * Away from the machine named: two refrigeration columns standing side by side
 * are hung so their doors open back to back, or the one in front stops the one
 * behind it from opening at all. -1 is the appliance's own left.
 *
 * The run's direction is not the appliance's: a run along z is drawn turned a
 * quarter turn, so what is further along that run is to the machine's left.
 */
export function hingeAwayFrom(slotId: SlotId, neighbour: SlotId): -1 | 1 {
  const run = RUNS.find((r) => r.segments.some((s) => s.slot === slotId));
  const mine = run?.segments.find((s) => s.slot === slotId);
  const other = run?.segments.find((s) => s.slot === neighbour);
  if (!run || !mine || !other) return 1;
  const furtherAlong = other.from > mine.from;
  const alongIsToTheRight = run.axis === "x";
  return furtherAlong === alongIsToTheRight ? -1 : 1;
}

/**
 * The manufacturer's kit beside a machine, in the machine's own frame.
 *
 * Two refrigeration columns standing side by side are joined by one: 5/8" of
 * divider between their cases. What shows in the room is not that 5/8", it is
 * the eighth of an inch between their doors — the doors are wider than the
 * cases and close over the kit. So the machine has to know the kit is there
 * and which side it is on, or it draws its door to its own case and leaves the
 * kit showing between two steel fronts.
 *
 * Same frame as `hingeAwayFrom`: -1 is the appliance's own left, and a run
 * along z is drawn turned a quarter turn.
 */
export function trimKitBeside(slotId: SlotId): { side: -1 | 1; widthIn: number } | null {
  const run = RUNS.find((r) => r.segments.some((s) => s.slot === slotId));
  const mine = run?.segments.find((s) => s.slot === slotId);
  if (!run || !mine) return null;

  const at = run.segments.indexOf(mine);
  for (const step of [-1, 1] as const) {
    const neighbour = run.segments[at + step];
    const kit = neighbour?.modules.find((module) => module.kind === "spacer");
    if (!kit) continue;
    const alongIsToTheRight = run.axis === "x";
    const side = (step > 0) === alongIsToTheRight ? 1 : -1;
    return { side, widthIn: kit.widthIn };
  }
  return null;
}

/**
 * Whether a stretch of run carries a slot.
 *
 * Its own slot, or the one standing in the bottom of its tower: the dishwasher
 * under the coffee machine is in that cabinet's stretch of run and has none of
 * its own.
 */
export const carries = (segment: RunSegment, slotId: SlotId) =>
  segment.slot === slotId || segment.modules.some((module) => module.lowerSlot === slotId);

/** The segment carrying a slot, wherever it is. */
export function segmentForSlot(slotId: SlotId): RunSegment | undefined {
  for (const run of RUNS) {
    const found = run.segments.find((s) => carries(s, slotId));
    if (found) return found;
  }
  return undefined;
}

/**
 * Every kit beside a machine, in the machine's own frame.
 *
 * A column in the middle of a group has one each side, and its door closes over
 * both. `trimKitBeside` is the first of them, for the machines at the ends.
 */
export function trimKitsBeside(slotId: SlotId): { side: -1 | 1; widthIn: number }[] {
  const run = RUNS.find((r) => r.segments.some((s) => s.slot === slotId));
  const mine = run?.segments.find((s) => s.slot === slotId);
  if (!run || !mine) return [];
  const at = run.segments.indexOf(mine);
  const kits: { side: -1 | 1; widthIn: number }[] = [];
  for (const step of [-1, 1] as const) {
    const kit = run.segments[at + step]?.modules.find((module) => module.kind === "spacer");
    if (!kit) continue;
    const side = (step > 0) === (run.axis === "x") ? 1 : -1;
    kits.push({ side, widthIn: kit.widthIn });
  }
  return kits;
}

/**
 * Which stretch of cabinetry a slot stands in.
 *
 * The cabinetry around an appliance is finished with the run it belongs to, so
 * anything drawn as joinery beside an appliance has to be able to ask this. An
 * island slot is on the island; everything else is on the leg carrying it.
 */
export function runForSlot(slotId: SlotId): "left" | "back" | "island" {
  if (SLOT_PLACEMENT[slotId]?.mount === "island") return "island";
  for (const run of RUNS) {
    if (run.segments.some((segment) => carries(segment, slotId))) return run.id;
  }
  return "back";
}

/**
 * The return wall past the refrigerator, when the layout says there is one.
 *
 * A room with a wall at the end of a run is a different room from one that just
 * stops, and the three and a half inches of clearance only make sense if you
 * can see what they are against. So the wall is drawn — in the wall's own
 * colour and material, at the wall's own height — rather than left as an empty
 * gap that reads as a mistake. Its return is D11 rule 11's 30": past that a
 * reveal is a wall to a door swinging into it.
 *
 * Null when the far end is cabinetry, or when there is no freestanding
 * refrigerator to be beside.
 */
export function fridgeReturnWall(): {
  /** Centre of the wall, in feet. */
  position: [number, number, number];
  /** Extent along x, y, z. */
  size: [number, number, number];
} | null {
  if (LAYOUT_PARAMS?.fridgeEndAbuts !== "wall") return null;
  for (const run of RUNS) {
    const segment = run.segments.find((s) => s.slot === "slot-fridge");
    if (!segment) continue;

    const thickness = ft(4.5);
    const depth = ft(LAYOUT_LIMITS.fridge.wallReturnIn);
    // Face on the segment's far end, returning into the room from the wall the
    // run stands against.
    const face = segment.to + thickness / 2;
    const back = run.centre - ROOM.counterDepth / 2;
    const mid = back + depth / 2;
    return run.axis === "x"
      ? {
          position: [face, ROOM.wallHeight / 2, mid],
          size: [thickness, ROOM.wallHeight, depth],
        }
      : {
          position: [mid, ROOM.wallHeight / 2, face],
          size: [depth, ROOM.wallHeight, thickness],
        };
  }
  return null;
}

export const extent = (s: RunSegment) => [s.from, s.to] as const;
export const spanOf = (s: RunSegment) => s.to - s.from;

/**
 * The starting parameters, from the query string.
 *
 * Every parameter has a name there — `?island=96&fridge=back&corner=blind` —
 * because a link is a reproducible room where a slider drag is not, and the
 * screenshot runs need to ask for a particular kitchen without clicking.
 */
function readParams(): { params: LayoutParams; issues: Refusal[] } {
  if (typeof window === "undefined") return { params: DEFAULT_PARAMS, issues: [] };

  const query = new URLSearchParams(window.location.search);
  const issues: Refusal[] = [];
  const params = { ...DEFAULT_PARAMS };

  const number = (name: string, key: "backWallIn" | "leftWallIn" | "islandLengthIn" | "islandDepthIn" | "aisleIn") => {
    const raw = query.get(name);
    if (raw === null) return;
    if (!Number.isFinite(Number(raw))) issues.push({ key: "refusal.notALength", vars: { raw } });
    else params[key] = Number(raw);
  };
  const choice = <K extends "fridgeEnd" | "sinkLeg" | "cornerType">(
    name: string,
    key: K,
    allowed: readonly LayoutParams[K][],
  ) => {
    const raw = query.get(name) as LayoutParams[K] | null;
    if (raw === null) return;
    if (!allowed.includes(raw))
      issues.push({ key: "refusal.notAChoice", vars: { raw, allowed: allowed.join(", ") } });
    else params[key] = raw;
  };

  number("back", "backWallIn");
  number("left", "leftWallIn");
  number("island", "islandLengthIn");
  number("islandDepth", "islandDepthIn");
  number("aisle", "aisleIn");
  choice("fridge", "fridgeEnd", ["left", "back"]);
  choice("sink", "sinkLeg", ["left", "back"]);
  choice("corner", "cornerType", ["lazy-susan", "blind"]);
  if (query.get("island") === "none") {
    params.hasIsland = false;
    params.islandLengthIn = DEFAULT_PARAMS.islandLengthIn;
    issues.length = 0;
  }

  return issues.length > 0 ? { params: DEFAULT_PARAMS, issues } : { params, issues: [] };
}

const requested = readParams();
const attempt = generateLayout(requested.params);
const fallback = generateLayout(DEFAULT_PARAMS);

if (!fallback.ok) {
  // The defaults are the one set of parameters that must always build.
  throw new Error(`the default layout is unbuildable: ${fallback.reasons.join(" ")}`);
}

applyLayout(
  attempt.ok ? attempt.layout : fallback.layout,
  requested.params,
  requested.issues.length > 0 || attempt.ok ? requested.issues : attempt.reasons,
);
