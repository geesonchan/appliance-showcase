import {
  DEFAULT_PARAMS,
  cooksOnTheRun,
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
import type { RunId } from "./layoutShape";
import { alongIsToTheRight, onAxis, sizeOnAxis } from "./frame";
import { wallBehind } from "./roomWalls";
import { isShareLink } from "./linkVersion";
import { LAYOUT_FIELDS } from "./layoutFields";

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
 * The machines this room was built without: never more than the island's two —
 * in a room with no island short of the wall to carry them (D18), and the
 * microwave drawer under an over-the-range microwave (round 97).
 *
 * Read it before drawing or counting anything keyed by slot. They keep their
 * entries everywhere else — a missing key is a crash rather than an absence —
 * so this is the one place that says what is actually in the room.
 */
export let OMITTED_SLOTS: readonly SlotId[] = [];
/**
 * The part of `OMITTED_SLOTS` the wall was too short for (D18): the machines
 * the no-island line names. The microwave drawer an over-the-range microwave
 * takes out (round 97) is not one of them.
 */
export let OMITTED_FOR_WALL: readonly SlotId[] = [];
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

  FRIDGE_OPENING = fridgeOpeningOf(layout);
  // The cooking surface on a run: a range, or one wall's cooktop (round 98b).
  const range = RUNS.flatMap((run) => run.segments).find(cooksOnTheRun);
  HOOD_OPENING = range ? ([range.from, range.to] as const) : ([0, 0] as const);

  ISLAND = layout.island;
  SLOT_PLACEMENT = layout.slots;
  OMITTED_SLOTS = layout.omitted;
  OMITTED_FOR_WALL = layout.omittedForWall;
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
  return furtherAlong === alongIsToTheRight(run.facing) ? -1 : 1;
}

/**
 * The leg whose D11 rule 12 counter, between an oven tower and the cooking
 * surface, is under 9" in the room standing, or null.
 *
 * The 9" round (Leo, 2026-11-05, 乙): a room the page builds itself has at
 * least 9" there; only a wall slider dragged short leaves 6", and the slider of
 * the wall it is on says so — 「台面只剩 6"，实际不建议」.
 */
export function narrowCounterLeg(): CabinetRun["id"] | null {
  for (const run of RUNS) {
    const counter = run.segments.find((segment) => /tower-clearance/.test(segment.id));
    if (counter && (counter.to - counter.from) * 12 < LAYOUT_LIMITS.towerSpacer.builtMinIn - 1e-6) return run.id;
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
 * Where the services come into the kitchen: on the wall of the run the cooking
 * surface stands on, 4' back from that run's far end; on the back run's where
 * the cooking is in an island. Leo, 2026-11-11: 「炉头在哪边就假设从那一头进来厨房」,
 * 「水、电、煤气都从炉头所在的那面墙进来；电表箱也按这一侧假设」, and for the U
 * 「右墙（炉头那一段）、离开放端 4'，和 L 型对应」. In the L and on one wall it is the
 * point the utility layer has drawn since round 52 (the back wall, 4' back from
 * U's is its right wall, 4' from the open end. Data only in
 * U-1: the utility layer is wired to it in U-2.
 *
 * Found 2026-11-11: the utility layer draws the L's entry 4 INCHES from the
 * back wall's far end (`ROOM.halfX - ft(4)`, `ft` taking inches), where its
 * comment and the U's plan said four feet. Not changed (U-1 changes nothing on
 * the page); Leo decides (Open items, "The services' entry: 4" or 4'").
 */
export const SERVICE_ENTRY_FROM_END_IN = 48;
export function serviceEntry(runs: CabinetRun[] = RUNS): { run: RunId; along: number } {
  const cooking = runs.find((run) => run.segments.some(cooksOnTheRun)) ?? runs.find((run) => run.id === "back")!;
  const end = cooking.segments[cooking.segments.length - 1].to;
  return { run: cooking.id, along: end - ft(SERVICE_ENTRY_FROM_END_IN) };
}

/**
 * A wall drawn only as a line on the floor (U-2): one that would stand between
 * the default view and the cabinets — the U's right wall, the default view
 * looking in from the open end (Leo, 2026-11-10: 「挡视线的墙只画地面墙线」). Where
 * the wall is, across its own axis (`axis`, `at`, as `wallBehind` has it), and
 * along it from the back wall to 1" past the run's open end, as the stone runs;
 * 1" wide. None in an L or on one wall.
 */
export interface FloorLineWall {
  wall: "right";
  axis: "x" | "z";
  at: number;
  /** Outward from the room: the side of `at` the line is drawn on. */
  outward: 1 | -1;
  from: number;
  to: number;
  widthIn: number;
}
export function floorLineWalls(): FloorLineWall[] {
  const right = RUN_BY_ID.right;
  if (!right) return [];
  const wall = wallBehind(right.facing);
  const end = right.segments[right.segments.length - 1].to;
  return [
    {
      wall: "right",
      axis: wall.axis,
      at: wall.at,
      outward: (-right.facing.sign) as 1 | -1,
      from: wallBehind(RUN_BY_ID.back.facing).at,
      to: end + ft(1),
      widthIn: 1,
    },
  ];
}

/**
 * Which stretch of cabinetry a slot stands in.
 *
 * The cabinetry around an appliance is finished with the run it belongs to, so
 * anything drawn as joinery beside an appliance has to be able to ask this. An
 * island slot is on the island; everything else is on the leg carrying it.
 */
export function runForSlot(slotId: SlotId): RunId | "island" {
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
  const run = fridgeRun();
  if (!run) return null;
  // One wall's refrigerator stands against the room's own left wall (round
  // 98b), which is drawn whole: there is no return to draw beside it.
  if (run.ends[0] === "wall") return null;

  const thickness = ft(4.5);
  const depth = ft(LAYOUT_LIMITS.fridge.wallReturnIn);
  // Face on the far end of the run — past the clearance filler where there is
  // one, past a built-in refrigerator's own tower where there is not — and
  // returning into the room from the wall the run stands against.
  const face = run.segments[run.segments.length - 1].to + thickness / 2;
  // The wall the run stands on is behind the way it faces (round 98a).
  const toRoom = run.facing.sign;
  const back = run.centre - toRoom * (ROOM.counterDepth / 2);
  const mid = back + toRoom * (depth / 2);
  const [sizeX, sizeZ] = sizeOnAxis(run.axis, thickness, depth);
  return {
    position: onAxis(run.axis, face, mid, ROOM.wallHeight / 2),
    size: [sizeX, ROOM.wallHeight, sizeZ],
  };
}

/**
 * The door clearance against a return wall: the filler that finishes the
 * refrigerator's run, and where along the run it is.
 *
 * Read off the end of the run rather than off the refrigerator's own segment.
 * A single refrigerator carries its filler inside its surround, so the two are
 * the same place; a group of columns does not. Package D's refrigerator is the
 * middle one of three, and a wall put beside *it* stood between two columns —
 * round 32. The wall is past the whole group, whichever column is in the middle.
 *
 * Null where nothing finishes the run as a clearance: a built-in refrigerator
 * against a wall is drawn against it with no filler, and has no figure to print.
 */
export function fridgeWallClearance(): {
  run: CabinetRun;
  /** Extent along the run, in feet. */
  from: number;
  to: number;
  widthIn: number;
} | null {
  if (LAYOUT_PARAMS?.fridgeEndAbuts !== "wall") return null;
  const run = fridgeRun();
  if (!run) return null;
  // On one wall the refrigeration stands at the run's first end, against the
  // wall (round 98b), and its clearance is the first thing on the run.
  if (run.ends[0] === "wall") {
    const first = run.segments[0];
    const filler = first?.modules[0];
    if (!filler || filler.kind !== "filler") return null;
    return { run, from: first.from, to: first.from + ft(filler.widthIn), widthIn: filler.widthIn };
  }
  const last = run.segments[run.segments.length - 1];
  const filler = last?.modules[last.modules.length - 1];
  if (!filler || filler.kind !== "filler") return null;
  return { run, from: last.to - ft(filler.widthIn), to: last.to, widthIn: filler.widthIn };
}

/** The run the refrigerator stands at the end of. */
const fridgeRun = () =>
  RUNS.find((run) => run.segments.some((segment) => carries(segment, "slot-fridge")));

export const extent = (s: RunSegment) => [s.from, s.to] as const;
export const spanOf = (s: RunSegment) => s.to - s.from;

/**
 * The starting parameters, from a page's address.
 *
 * Every parameter has a name there — `?island=96&fridgeLeg=back&corner=blind` —
 * because a link is a reproducible room where a slider drag is not, and the
 * screenshot runs need to ask for a particular kitchen without clicking.
 *
 * Read by the share link's own table (`LAYOUT_FIELDS`), by its names, within
 * its ranges, since round 98a (Leo: D17's table, the eighteenth row, "Join
 * them then"): until then these were eight names of room.ts's own, read here
 * and nowhere else. The two older names screenshots used, `fridge` and
 * `sink`, are the table's aliases. One the page cannot use opens the default
 * room and says why, as before.
 */
export function paramsFromQuery(query: URLSearchParams): { params: LayoutParams; issues: Refusal[] } {
  // A share link is read whole by its own table once the page has loaded
  // (round 94, src/store/openLink.ts): the room starts as the default.
  if (isShareLink(query)) return { params: DEFAULT_PARAMS, issues: [] };
  const issues: Refusal[] = [];
  let params = { ...DEFAULT_PARAMS };
  for (const field of LAYOUT_FIELDS) {
    const name = [field.name, ...(field.aliases ?? [])].find((each) => query.get(each) !== null);
    if (name === undefined) continue;
    const raw = query.get(name)!;
    const value = field.read(raw);
    if (value === undefined) {
      issues.push(
        field.allowed
          ? { key: "refusal.notAChoice", vars: { raw, allowed: field.allowed.join(", ") } }
          : { key: "refusal.notALength", vars: { raw } },
      );
    } else params = { ...params, ...field.put(value) };
  }
  return issues.length > 0 ? { params: DEFAULT_PARAMS, issues } : { params, issues: [] };
}

function readParams(): { params: LayoutParams; issues: Refusal[] } {
  if (typeof window === "undefined") return { params: DEFAULT_PARAMS, issues: [] };
  return paramsFromQuery(new URLSearchParams(window.location.search));
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
