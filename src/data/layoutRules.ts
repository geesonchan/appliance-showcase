import { FIXTURE_BY_ID } from "./fixtures";
import { ISLAND, ROOM, RUNS, type CabinetRun, type RunSegment } from "./room";
import { SLOT_BY_ID } from "./slots";
import type { SlotId } from "../types";

/**
 * Leo's cabinet layout rules, as something the code can be held to.
 *
 * These are trade rules, not preferences: a kitchen that breaks them is wrong
 * on site, not merely unusual. They live here rather than only in
 * docs/decisions.md D11 so that the current room can be checked against them,
 * and so that M3-3's template generator has one definition to satisfy rather
 * than a paragraph to interpret.
 *
 * Every clearance is in inches, which is how the trade states them.
 */
export const LAYOUT_LIMITS = {
  /** Rule 4: counter each side of the range. */
  rangeLandingIn: 12,
  /** Rule 5: how far the dishwasher may sit from the sink. */
  dishwasherToSinkIn: 36,
  /** Rule 6: counter on the refrigerator's door side. */
  fridgeLandingIn: 15,
  /** The aisle a working kitchen needs, for the island. */
  aisleIn: 42,
};

export interface LayoutViolation {
  rule: number;
  /** What is wrong, in the terms a cabinetmaker would use. */
  message: string;
}

const inches = (feet: number) => feet * 12;
const spanOf = (s: RunSegment) => s.to - s.from;

/** The segment carrying a slot, and the run it is on. */
function locate(runs: CabinetRun[], slotId: SlotId): { run: CabinetRun; index: number } | null {
  for (const run of runs) {
    const index = run.segments.findIndex((s) => s.slot === slotId);
    if (index >= 0) return { run, index };
  }
  return null;
}

/**
 * Counter available beside a segment, walking outward until something that is
 * not plain counter stops it.
 */
function landing(run: CabinetRun, index: number, direction: -1 | 1): number {
  let total = 0;
  for (let i = index + direction; i >= 0 && i < run.segments.length; i += direction) {
    const segment = run.segments[i];
    if (segment.kind !== "counter") break;
    total += spanOf(segment);
  }
  return inches(total);
}

/**
 * Check a set of runs against every rule.
 *
 * Returns what is wrong rather than throwing, because M3-3 needs to refuse to
 * generate a layout *and say why*, which is the same question asked of a
 * different set of runs.
 */
export function checkLayout(runs: CabinetRun[] = RUNS): LayoutViolation[] {
  const problems: LayoutViolation[] = [];
  const fail = (rule: number, message: string) => problems.push({ rule, message });

  for (const run of runs) {
    // Rule 3: the cabinetry is continuous — no gaps, no overlaps — from the
    // corner to the end of the run.
    for (let i = 1; i < run.segments.length; i += 1) {
      const gap = run.segments[i].from - run.segments[i - 1].to;
      if (Math.abs(gap) > 1e-6) {
        fail(
          3,
          `${run.id} run: ${inches(Math.abs(gap)).toFixed(1)}" ${gap > 0 ? "gap" : "overlap"} ` +
            `between ${run.segments[i - 1].id} and ${run.segments[i].id}`,
        );
      }
    }

    for (const [i, segment] of run.segments.entries()) {
      // Rule 1: a tall cabinet goes at the end of a run.
      if (segment.kind === "tall" && i !== 0 && i !== run.segments.length - 1) {
        fail(1, `${segment.id} is a tall cabinet in the middle of the ${run.id} run`);
      }
      // Rule 2: the corner is a corner cabinet and carries nothing with a door.
      if (segment.kind === "corner" && (segment.slot || segment.fixture)) {
        fail(2, `${segment.id} puts ${segment.slot ?? segment.fixture} in the corner`);
      }
      if (segment.kind === "tall" && run.segments[i === 0 ? 1 : i - 1]?.kind === "corner") {
        fail(1, `${segment.id} is a tall cabinet hard against the corner`);
      }
    }
  }

  // Rule 4: the range sits on a straight run with landing on both sides, and
  // the hood over it is at least as wide.
  const range = locate(runs, "slot-range");
  if (!range) {
    fail(4, "no range on any run");
  } else {
    const left = landing(range.run, range.index, -1);
    const right = landing(range.run, range.index, 1);
    for (const [side, value] of [["left", left], ["right", right]] as const) {
      if (value < LAYOUT_LIMITS.rangeLandingIn - 1e-6) {
        fail(4, `range has ${value.toFixed(1)}" of counter to its ${side}, needs ${LAYOUT_LIMITS.rangeLandingIn}"`);
      }
    }
    const rangeW = SLOT_BY_ID["slot-range"].cutout.w;
    const hoodW = SLOT_BY_ID["slot-hood"].cutout.w;
    if (hoodW < rangeW) {
      fail(4, `hood is ${hoodW}" over a ${rangeW}" range`);
    }
    const hoodX = SLOT_BY_ID["slot-hood"].position[0];
    const rangeX = SLOT_BY_ID["slot-range"].position[0];
    if (Math.abs(hoodX - rangeX) > 1e-6) {
      fail(4, "hood is not centred over the range");
    }
  }

  // Rule 5: the dishwasher is beside the sink.
  const dishwasher = locate(runs, "slot-dishwasher");
  const sink = runs.flatMap((run) => run.segments).find((s) => s.fixture === "fixture-sink");
  if (!dishwasher || !sink) {
    fail(5, "the dishwasher and the sink must both be on a run");
  } else {
    const dw = dishwasher.run.segments[dishwasher.index];
    const between = Math.max(sink.from - dw.to, dw.from - sink.to, 0);
    const centres = Math.abs((dw.from + dw.to) / 2 - (sink.from + sink.to) / 2);
    if (inches(between) > 1e-6) {
      fail(5, `dishwasher is ${inches(between).toFixed(1)}" clear of the sink base, it should be hard against it`);
    }
    if (inches(centres) > LAYOUT_LIMITS.dishwasherToSinkIn) {
      fail(5, `dishwasher is ${inches(centres).toFixed(1)}" from the sink, limit is ${LAYOUT_LIMITS.dishwasherToSinkIn}"`);
    }
  }

  // Rule 6: the refrigerator has counter to land things on.
  const fridge = locate(runs, "slot-fridge");
  if (!fridge) {
    fail(6, "no refrigerator on any run");
  } else {
    const best = Math.max(
      landing(fridge.run, fridge.index, -1),
      landing(fridge.run, fridge.index, 1),
    );
    if (best < LAYOUT_LIMITS.fridgeLandingIn - 1e-6) {
      fail(6, `refrigerator has ${best.toFixed(1)}" of landing, needs ${LAYOUT_LIMITS.fridgeLandingIn}"`);
    }
  }

  // Rule 7: the island's two openings face opposite ways.
  const microwave = SLOT_BY_ID["slot-microwave"];
  const wine = SLOT_BY_ID["slot-wine"];
  if (Math.abs(Math.cos(microwave.rotationY) - Math.cos(wine.rotationY)) < 1e-6) {
    fail(7, "the microwave and the wine cabinet face the same way");
  }
  if (microwave.position[2] > wine.position[2]) {
    fail(7, "the microwave drawer should face the working side and the wine cabinet the seating side");
  }

  // The aisle the island stands in, which is what set the room's depth.
  const runFront = runs.find((r) => r.id === "back")!.centre + ROOM.counterDepth / 2;
  const aisle = inches(ISLAND.z[0] - runFront);
  if (aisle < LAYOUT_LIMITS.aisleIn - 1e-6) {
    fail(7, `${aisle.toFixed(1)}" aisle between the island and the back run, needs ${LAYOUT_LIMITS.aisleIn}"`);
  }

  return problems;
}

/** Every segment that carries something, for tests and for the plan key. */
export function occupants() {
  return RUNS.flatMap((run) =>
    run.segments
      .filter((s) => s.slot || s.fixture)
      .map((s) => ({
        run: run.id,
        segment: s.id,
        kind: s.kind,
        widthIn: inches(spanOf(s)),
        label: s.slot
          ? SLOT_BY_ID[s.slot].labelKey
          : FIXTURE_BY_ID[s.fixture!].labelKey,
      })),
  );
}
