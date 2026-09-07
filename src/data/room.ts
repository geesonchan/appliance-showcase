import {
  DEFAULT_PARAMS,
  fridgeOpeningOf,
  generateLayout,
  type GeneratedLayout,
  type LayoutParams,
  type SlotPlacement,
} from "./layoutTemplate";
import { ft, type CabinetRun, type RunSegment } from "./roomShell";
import type { FixtureId, SlotId } from "../types";

export * from "./roomShell";
export { PARAM_LIMITS, DEFAULT_PARAMS } from "./layoutTemplate";
export type { LayoutParams, SlotPlacement, IslandLayout } from "./layoutTemplate";

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
export let LAYOUT_ISSUES: string[] = [];

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

/** Wall left clear above the range for the hood, 3" proud of it each side. */
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

export let SLOT_PLACEMENT: Record<SlotId, SlotPlacement>;
export let FIXTURE_PLACEMENT: Record<FixtureId, SlotPlacement>;

/** Install a generated layout as the room. Everything derived follows. */
export function applyLayout(layout: GeneratedLayout, requested: LayoutParams, issues: string[]) {
  LAYOUT = layout;
  LAYOUT_PARAMS = layout.params;
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
  HOOD_OPENING = range ? ([range.from - ft(3), range.to + ft(3)] as const) : ([0, 0] as const);

  ISLAND = layout.island;
  SLOT_PLACEMENT = layout.slots;
  FIXTURE_PLACEMENT = layout.fixtures;
}

/** The segment carrying a slot, wherever it is. */
export function segmentForSlot(slotId: SlotId): RunSegment | undefined {
  for (const run of RUNS) {
    const found = run.segments.find((s) => s.slot === slotId);
    if (found) return found;
  }
  return undefined;
}

export const extent = (s: RunSegment) => [s.from, s.to] as const;
export const spanOf = (s: RunSegment) => s.to - s.from;

/**
 * The starting parameters, from the query string.
 *
 * `?island=96&fridge=back` still works and is what the screenshot runs use —
 * a link is a reproducible room, where a slider drag is not.
 */
function readParams(): { params: LayoutParams; issues: string[] } {
  if (typeof window === "undefined") return { params: DEFAULT_PARAMS, issues: [] };

  const query = new URLSearchParams(window.location.search);
  const island = query.get("island");
  const fridge = query.get("fridge");

  if (island !== null && !Number.isFinite(Number(island))) {
    return { params: DEFAULT_PARAMS, issues: [`"${island}" is not a length.`] };
  }
  if (fridge !== null && fridge !== "left" && fridge !== "back") {
    return {
      params: DEFAULT_PARAMS,
      issues: [`The refrigerator goes at the left end or the back end, not "${fridge}".`],
    };
  }

  return {
    params: {
      ...DEFAULT_PARAMS,
      islandLengthIn: island === null ? DEFAULT_PARAMS.islandLengthIn : Number(island),
      fridgeEnd: fridge === "back" ? "back" : DEFAULT_PARAMS.fridgeEnd,
    },
    issues: [],
  };
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
