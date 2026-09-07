import { hoodBridgeBand } from "./cabinets";
import { FIXTURE_BY_ID } from "./fixtures";
import {
  CABINET_STANDARDS,
  ISLAND,
  type CabinetModule,
  ROOM,
  RUNS,
  type CabinetRun,
  type RunSegment,
} from "./room";
import { SLOT_BY_ID } from "./slots";
import type { SlotId } from "../types";

/**
 * The cabinet rules, as something the code can be held to.
 *
 * Two sets, checked together. D11 is where things go relative to each other —
 * a tower at the end of a run, the dishwasher beside the sink. D13 is what size
 * they are — 24" deep base boxes, 3" width increments, a canopy 30" over the
 * cooktop. Both are trade rules rather than preferences: a kitchen that breaks
 * them is wrong on site.
 *
 * They live here rather than only in docs/decisions.md so the current room can
 * be checked against them, and so M3-3's generator has one definition to
 * satisfy rather than two paragraphs to interpret.
 *
 * Every clearance is in inches, which is how the trade states them.
 */
export const LAYOUT_LIMITS = {
  /** D11 rule 4: counter each side of the range. */
  rangeLandingIn: 12,
  /** D11 rule 5: how far the dishwasher may sit from the sink. */
  dishwasherToSinkIn: 36,
  /** D11 rule 6: counter on the refrigerator's door side. */
  fridgeLandingIn: 15,
  /** The aisle a working kitchen needs, for the island. */
  aisleIn: 42,
};

/**
 * The stock width lists, from docs/reference/cabinet-modules.md.
 *
 * Fillers are the exception that makes the rest work: widths come in 3" steps,
 * so a wall almost never divides evenly and the remainder is absorbed by a 3"
 * or 6" strip scribed to the wall.
 */
const STOCK_WIDTHS = [6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48];
const FILLER_WIDTHS = [3, 6];
const SINK_BASE_WIDTHS = [30, 33, 36, 42];
const CORNER_WIDTHS = [24, 33, 36, 39, 42, 45, 48];
/** Wall heights: the three standard ones plus the bridge sizes. */
const UPPER_HEIGHTS = [12, 15, 18, 21, 24, 30, 36, 42];

function isOrderable(module: CabinetModule): boolean {
  switch (module.kind) {
    case "filler":
      return FILLER_WIDTHS.includes(module.widthIn);
    case "sink-base":
      return SINK_BASE_WIDTHS.includes(module.widthIn);
    case "corner":
      return CORNER_WIDTHS.includes(module.widthIn);
    case "opening":
      // A rough opening is dimensioned to the appliance, not off a size list.
      return module.widthIn > 0;
    case "tall":
      // An enclosure is built: an opening plus a finished panel each side.
      return STOCK_WIDTHS.includes(module.widthIn) || module.widthIn % 3 === 0;
    default:
      return STOCK_WIDTHS.includes(module.widthIn);
  }
}

export interface LayoutViolation {
  /** Which rule, as `d11-<n>` or `d13-<what>`. */
  code: string;
  /** What is wrong, in the terms a cabinetmaker would use. */
  message: string;
}

const inches = (feet: number) => feet * 12;
const spanOf = (s: RunSegment) => s.to - s.from;
const widthIn = (s: RunSegment) => inches(spanOf(s));

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
  const fail = (code: string, message: string) => problems.push({ code, message });

  for (const run of runs) {
    // D11 rule 3: the cabinetry is continuous — no gaps, no overlaps.
    for (let i = 1; i < run.segments.length; i += 1) {
      const gap = run.segments[i].from - run.segments[i - 1].to;
      if (Math.abs(gap) > 1e-6) {
        fail(
          "d11-3",
          `${run.id} run: ${inches(Math.abs(gap)).toFixed(1)}" ${gap > 0 ? "gap" : "overlap"} ` +
            `between ${run.segments[i - 1].id} and ${run.segments[i].id}`,
        );
      }
    }

    for (const [i, segment] of run.segments.entries()) {
      // D11 rule 2: the corner carries nothing with a door.
      if (segment.kind === "corner" && (segment.slot || segment.fixture)) {
        fail("d11-2", `${segment.id} puts ${segment.slot ?? segment.fixture} in the corner`);
      }

      if (segment.kind !== "tall") continue;

      // D11 rule 1: a tall cabinet goes at the end of a run, never at a corner.
      // A tower in the middle cuts the countertop in two; one at a corner
      // blocks the corner cabinet's door.
      if (i !== run.segments.length - 1) {
        fail("d11-1", `${segment.id} is a tall cabinet with ${run.segments.length - 1 - i} more segment(s) after it`);
      }
      if (run.segments[i - 1]?.kind === "corner" || run.segments[i + 1]?.kind === "corner") {
        fail("d11-1", `${segment.id} is a tall cabinet hard against the corner`);
      }
    }

    // D13: every segment is built out of orderable boxes whose widths add up
    // to it exactly. A remainder is not something to round away — it is the
    // gap a supplier would ship a filler for, or refuse to quote.
    for (const segment of run.segments) {
      const built = segment.modules.reduce((sum, m) => sum + m.widthIn, 0);
      const wanted = widthIn(segment);
      const off = Number((wanted - built).toFixed(4));
      if (segment.modules.length === 0) {
        fail("d13-modules", `${segment.id} is ${wanted}" of nothing in particular`);
      } else if (Math.abs(off) > 1e-4) {
        fail(
          "d13-modules",
          `${segment.id} wants ${wanted}" and its cabinets make ${built}"` +
            ` — ${Math.abs(off)}" ${off > 0 ? "short" : "over"}`,
        );
      }
      for (const module of segment.modules) {
        if (!isOrderable(module)) {
          fail("d13-modules", `${module.code} is a ${module.widthIn}" box nobody stocks`);
        }
      }
    }

    for (const bank of run.uppers) {
      const built = bank.modules.reduce((sum, m) => sum + m.widthIn, 0);
      const wanted = inches(bank.to - bank.from);
      const off = Number((wanted - built).toFixed(4));
      if (Math.abs(off) > 1e-4) {
        fail(
          "d13-modules",
          `${bank.id} wants ${wanted}" and its cabinets make ${built}"` +
            ` — ${Math.abs(off)}" ${off > 0 ? "short" : "over"}`,
        );
      }
      for (const module of bank.modules) {
        // A bridge over a canopy is made to size: its floor is the canopy's
        // top, which moves with the range under it.
        if (module.kind === "bridge") continue;
        if (module.heightIn && !UPPER_HEIGHTS.includes(module.heightIn)) {
          fail("d13-modules", `${module.code} is ${module.heightIn}" tall, not a stock height`);
        }
      }
    }

    // D13: widths come in 3" increments between 12" and 36". A tall cabinet is
    // its opening plus a finished panel each side, and a corner has its own
    // sizes, so both are measured against their own standard.
    const { min, max, step } = CABINET_STANDARDS.widthIn;
    for (const segment of run.segments) {
      const w = widthIn(segment);
      if (segment.kind === "corner") {
        const { lazySusanIn, blindIn } = CABINET_STANDARDS.corner;
        if (w !== lazySusanIn && w !== blindIn) {
          fail("d13-corner", `${segment.id} is ${w}", wants ${lazySusanIn}" or ${blindIn}"`);
        }
        continue;
      }
      if (segment.kind === "tall") continue;
      if (w < min || w > max) {
        fail("d13-width", `${segment.id} is ${w}", outside the ${min}-${max}" range`);
      } else if (Math.abs(w / step - Math.round(w / step)) > 1e-6) {
        fail("d13-width", `${segment.id} is ${w}", not a ${step}" increment`);
      }
    }

    // D13: the L's legs, each measured from the inside corner outward. The
    // corner square belongs to one run, so counting it into both would make
    // the pair add up to more wall than the room has.
    const legIn = inches(
      run.segments[run.segments.length - 1].to - run.segments[0].from,
    );
    const { shortMin, longMax } = CABINET_STANDARDS.legIn;
    if (legIn < shortMin) {
      fail("d13-leg", `the ${run.id} leg is ${legIn}", wants at least ${shortMin}"`);
    }
    if (legIn > longMax) {
      fail("d13-leg", `the ${run.id} leg is ${legIn}", longer than ${longMax}"`);
    }
  }

  // D11 rule 4: the range sits on a straight run with landing on both sides,
  // and the hood over it is at least as wide.
  const range = locate(runs, "slot-range");
  if (!range) {
    fail("d11-4", "no range on any run");
  } else {
    for (const [side, value] of [
      ["left", landing(range.run, range.index, -1)],
      ["right", landing(range.run, range.index, 1)],
    ] as const) {
      if (value < LAYOUT_LIMITS.rangeLandingIn - 1e-6) {
        fail(
          "d11-4",
          `range has ${value.toFixed(1)}" of counter to its ${side}, needs ${LAYOUT_LIMITS.rangeLandingIn}"`,
        );
      }
    }
    const rangeW = SLOT_BY_ID["slot-range"].cutout.w;
    const hoodW = SLOT_BY_ID["slot-hood"].cutout.w;
    if (hoodW < rangeW) fail("d13-hood-width", `hood is ${hoodW}" over a ${rangeW}" range`);
    if (
      Math.abs(SLOT_BY_ID["slot-hood"].position[0] - SLOT_BY_ID["slot-range"].position[0]) > 1e-6
    ) {
      fail("d11-4", "hood is not centred over the range");
    }
  }

  // D11 rule 5: the dishwasher is beside the sink.
  const dishwasher = locate(runs, "slot-dishwasher");
  const sink = runs.flatMap((run) => run.segments).find((s) => s.fixture === "fixture-sink");
  if (!dishwasher || !sink) {
    fail("d11-5", "the dishwasher and the sink must both be on a run");
  } else {
    const dw = dishwasher.run.segments[dishwasher.index];
    const between = Math.max(sink.from - dw.to, dw.from - sink.to, 0);
    const centres = Math.abs((dw.from + dw.to) / 2 - (sink.from + sink.to) / 2);
    if (inches(between) > 1e-6) {
      fail(
        "d11-5",
        `dishwasher is ${inches(between).toFixed(1)}" clear of the sink base, it should be hard against it`,
      );
    }
    if (inches(centres) > LAYOUT_LIMITS.dishwasherToSinkIn) {
      fail(
        "d11-5",
        `dishwasher is ${inches(centres).toFixed(1)}" from the sink, limit is ${LAYOUT_LIMITS.dishwasherToSinkIn}"`,
      );
    }
  }

  // D11 rule 6: the refrigerator has counter to land things on.
  const fridge = locate(runs, "slot-fridge");
  if (!fridge) {
    fail("d11-6", "no refrigerator on any run");
  } else {
    const best = Math.max(
      landing(fridge.run, fridge.index, -1),
      landing(fridge.run, fridge.index, 1),
    );
    if (best < LAYOUT_LIMITS.fridgeLandingIn - 1e-6) {
      fail(
        "d11-6",
        `refrigerator has ${best.toFixed(1)}" of landing, needs ${LAYOUT_LIMITS.fridgeLandingIn}"`,
      );
    }
  }

  // D11 rule 7: the island's two openings face opposite ways.
  const microwave = SLOT_BY_ID["slot-microwave"];
  const wine = SLOT_BY_ID["slot-wine"];
  if (Math.abs(Math.cos(microwave.rotationY) - Math.cos(wine.rotationY)) < 1e-6) {
    fail("d11-7", "the microwave and the wine cabinet face the same way");
  }
  if (microwave.position[2] > wine.position[2]) {
    fail(
      "d11-7",
      "the microwave drawer should face the working side and the wine cabinet the seating side",
    );
  }
  const runFront = runs.find((r) => r.id === "back")!.centre + ROOM.counterDepth / 2;
  const aisle = inches(ISLAND.z[0] - runFront);
  if (aisle < LAYOUT_LIMITS.aisleIn - 1e-6) {
    fail(
      "d11-7",
      `${aisle.toFixed(1)}" aisle between the island and the back run, needs ${LAYOUT_LIMITS.aisleIn}"`,
    );
  }

  problems.push(...checkHeights());
  return problems;
}

/**
 * The vertical dimensions, which are the same wherever the cabinets go.
 *
 * Separate from the run check because a run says nothing about how tall
 * anything is, and M3-3's generator will not change any of it.
 */
export function checkHeights(): LayoutViolation[] {
  const problems: LayoutViolation[] = [];
  const fail = (code: string, message: string) => problems.push({ code, message });
  const { base, upper, tall, hood } = CABINET_STANDARDS;

  if (inches(ROOM.counterHeight) !== base.counterHeightIn) {
    fail("d13-base", `counter is at ${inches(ROOM.counterHeight)}", wants ${base.counterHeightIn}"`);
  }
  if (inches(ROOM.counterHeight - ROOM.counterThickness) !== base.boxHeightIn) {
    fail("d13-base", `base box is ${inches(ROOM.counterHeight - ROOM.counterThickness)}" tall`);
  }
  if (inches(ROOM.counterDepth) !== base.depthIn) {
    fail("d13-base", `base run is ${inches(ROOM.counterDepth)}" deep`);
  }

  if (inches(ROOM.upperBottom) !== base.counterHeightIn + upper.bottomAboveCounterIn) {
    fail("d13-upper", `uppers start at ${inches(ROOM.upperBottom)}", wants 54"`);
  }
  if (inches(ROOM.upperDepth) !== upper.depthIn) {
    fail("d13-upper", `uppers are ${inches(ROOM.upperDepth)}" deep, wants ${upper.depthIn}"`);
  }
  const upperH = inches(ROOM.upperTop - ROOM.upperBottom);
  if (!upper.heightsIn.includes(upperH)) {
    fail("d13-upper", `uppers are ${upperH}" tall, wants one of ${upper.heightsIn.join("/")}`);
  }
  if (!tall.heightsIn.includes(inches(ROOM.tallTop))) {
    fail("d13-tall", `tall cabinets are ${inches(ROOM.tallTop)}" tall`);
  }

  // D13: a run may finish short of the ceiling, but only by a scribe.
  const { closingGapIn } = CABINET_STANDARDS;
  for (const top of [ROOM.upperTop, ROOM.tallTop, hoodBridgeBand()[1]]) {
    const gap = inches(ROOM.wallHeight - top);
    if (gap < closingGapIn.min - 1e-6 || gap > closingGapIn.max + 1e-6) {
      fail(
        "d13-closing-gap",
        `a run finishes ${gap.toFixed(2)}" below the ceiling, wants ${closingGapIn.min}-${closingGapIn.max}"`,
      );
    }
  }

  // The canopy hangs its clearance above the cooking surface the wall was
  // drilled for — not above the counter, which is lower.
  const hoodSlot = SLOT_BY_ID["slot-hood"];
  const builtFor = hoodSlot.builtForCooktopIn ?? base.counterHeightIn;
  const bottomAbove = inches(hoodSlot.position[1]) - builtFor;
  if (bottomAbove < hood.aboveCooktopMinIn || bottomAbove > hood.aboveCooktopMaxIn) {
    fail(
      "d13-hood",
      `canopy sits ${bottomAbove}" over the cooktop, wants ${hood.aboveCooktopMinIn}-${hood.aboveCooktopMaxIn}"`,
    );
  }
  if (hoodSlot.cutout.h !== hood.bodyHeightIn) {
    fail("d13-hood", `canopy opening is ${hoodSlot.cutout.h}" tall, wants ${hood.bodyHeightIn}"`);
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
        widthIn: widthIn(s),
        label: s.slot ? SLOT_BY_ID[s.slot].labelKey : FIXTURE_BY_ID[s.fixture!].labelKey,
      })),
  );
}
