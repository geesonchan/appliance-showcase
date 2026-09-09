import { hoodBridgeBand } from "./cabinets";
import { roughInFor } from "./roughIn";
import { FIXTURE_BY_ID } from "./fixtures";
import {
  CABINET_STANDARDS,
  ISLAND,
  LAYOUT_LIMITS,
  type CabinetModule,
  ROOM,
  RUNS,
  type CabinetRun,
  type IslandLayout,
  type RunSegment,
} from "./room";
import { PACKAGE_SLOTS } from "./packages";
import { SLOT_BY_ID } from "./slots";
import type { Appliance, SlotId } from "../types";

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
// The clearances themselves live in roomShell.ts, where the generator can read
// them too: it lays a run out to them and this holds it to them.
export { LAYOUT_LIMITS } from "./room";

/**
 * The stock width lists, from docs/reference/cabinet-modules.md.
 *
 * Fillers are the exception that makes the rest work: widths come in 3" steps,
 * so a wall almost never divides evenly and the remainder is absorbed by a 3"
 * or 6" strip scribed to the wall.
 */
const STOCK_WIDTHS = [6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48];
/** Past this a strip of panel is a cabinet somebody forgot to order. */
const FILLER_MAX_IN = 6;
const SINK_BASE_WIDTHS = [30, 33, 36, 42];
const CORNER_WIDTHS = [24, 33, 36, 39, 42, 45, 48];
/** Wall heights: the three standard ones plus the bridge sizes. */
const UPPER_HEIGHTS = [12, 15, 18, 21, 24, 30, 36, 42];

function isOrderable(module: CabinetModule): boolean {
  switch (module.kind) {
    case "filler":
      // A strip of finished panel cut on site. It is the part that absorbs
      // whatever the boxes do not divide into — a scribe against a wall, the
      // half inch a run does not divide by, the gap a refrigerator door needs
      // — so it has a maximum rather than a size list. Past that it is a
      // cabinet somebody forgot to order.
      return module.widthIn > 0 && module.widthIn <= FILLER_MAX_IN;
    case "sink-base":
      return SINK_BASE_WIDTHS.includes(module.widthIn);
    case "corner":
      return CORNER_WIDTHS.includes(module.widthIn);
    case "panel":
      // A finished panel is cut to the job. Three inches is the standard for
      // one that fills a gap; a tall unit's own side is the board itself, and
      // a board is 3/4" thick.
      return module.widthIn >= 0.75;
    case "spacer":
      // A kit with a part number, so its width is the kit's and not a choice.
      return module.widthIn > 0 && module.code.length > 0;
    case "opening":
    case "tall-open":
      // A rough opening is dimensioned to the appliance, not off a size list —
      // and a freestanding full-height unit is a rough opening that happens to
      // reach the ceiling.
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
 * Whether this tall segment is the oven tower, standing where rule 12 puts it.
 *
 * Two things have to hold. The package has to call it a tower — `beside` on
 * its slot — because the exception is for that one unit and not for whatever
 * else somebody stands mid-run. And the cooking surface has to be its
 * neighbour but one: the cabinet between them is the 6" the rangetop's own
 * sheet asks for, and a tower three cabinets away is not beside anything.
 */
function besideTheRange(run: CabinetRun, index: number): boolean {
  const isTower = (at: number) => {
    const slot = run.segments[at]?.slot;
    return !!slot && PACKAGE_SLOTS[slot]?.beside === "range";
  };
  // The tower's own side panel is part of the tower: a board from the floor to
  // its top, which is a tall segment with nothing in it.
  if (!isTower(index)) {
    const panel = run.segments[index].modules.every((module) => module.kind === "panel");
    return panel && (isTower(index - 1) || isTower(index + 1));
  }
  // And the machine is beside it: counter and the panel are what may be
  // between them, nothing else.
  for (const step of [-1, 1]) {
    for (let at = index + step; at >= 0 && at < run.segments.length; at += step) {
      const segment = run.segments[at];
      if (segment.slot === "slot-range") return true;
      const passable =
        segment.kind === "counter" ||
        (segment.kind === "tall" && segment.modules.every((m) => m.kind === "panel"));
      if (!passable) break;
    }
  }
  return false;
}

/**
 * Counter available beside a segment, walking outward until something that is
 * not plain counter stops it.
 */
/**
 * Whether a segment puts worktop at counter height.
 *
 * Base cabinetry does. So does an under-counter appliance: a dishwasher or a
 * microwave drawer has a countertop over it, and 24" of surface at counter
 * height is 24" of surface at counter height — which is the argument D11 rule
 * 10 already makes about the dishwasher beside a sink. What does not is a
 * freestanding range, whose top is the cooking surface, and a tall unit, which
 * has no counter at all.
 */
function hasWorktop(segment: RunSegment): boolean {
  if (segment.kind === "counter" || segment.kind === "fixture") return true;
  if (segment.kind !== "appliance" || !segment.slot) return false;
  // Named, and base height. Anything else is a segment this cannot vouch for.
  return (
    segment.slot !== "slot-range" &&
    SLOT_BY_ID[segment.slot]?.cabinetConfig.type === "base"
  );
}

function landing(run: CabinetRun, index: number, direction: -1 | 1): number {
  let total = 0;
  for (let i = index + direction; i >= 0 && i < run.segments.length; i += direction) {
    const segment = run.segments[i];
    if (!hasWorktop(segment)) break;
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
export function checkLayout(
  runs: CabinetRun[] = RUNS,
  /** The models specified, when the check has them: rule 8 reads their drawings. */
  selection?: Partial<Record<SlotId, Appliance>>,
  /** The island the runs were generated with, when checking a layout that is not the room. */
  island: IslandLayout = ISLAND,
): LayoutViolation[] {
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

      // An appliance is never what finishes a run. Something has to give its
      // door somewhere to swing and close the carcass off — a filler against a
      // wall, a cabinet in the open, a finished panel beside a tower.
      if (i === run.segments.length - 1) {
        const last = segment.modules[segment.modules.length - 1];
        if (last && (last.kind === "opening" || last.kind === "tall-open")) {
          fail("d13-terminal", `${run.id} run finishes on ${segment.slot ?? segment.id}`);
        }
      }

      if (segment.kind !== "tall") continue;

      // D11 rule 1, as rule 12 amends it: a tall cabinet goes at the end of a
      // run, never at a corner — and a bank of them is one tall cabinet for
      // this purpose. What the rule is against is counter *after* a tower,
      // which cuts the worktop in two; three columns standing together are one
      // wall of joinery and cut nothing.
      //
      // The oven tower is the exception, and only it: it stands beside the
      // cooking surface on purpose, so a dish comes out of it and onto the
      // counter without crossing the kitchen. `beside` on the package slot is
      // what says a unit is that one, and it has to actually be there — one
      // cabinet from the machine, no further.
      const after = run.segments.slice(i + 1).filter((s) => s.kind !== "tall");
      if (after.length > 0 && !besideTheRange(run, i)) {
        fail(
          "d11-1",
          `${segment.id} is a tall cabinet with ${after.length} segment(s) of counter after it`,
        );
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
      // Measured on the boxes, not on the stretch. A run does not always
      // divide by the module step — a refrigerator door's clearance against a
      // wall is three and a half inches — and what goes in the remainder is a
      // scribe. The cabinets still have to come off the size list; the strip
      // of panel beside them does not, and neither does a finished end panel,
      // which is cut to the job.
      const boxes = segment.modules
        .filter((module) => module.kind !== "filler" && module.kind !== "panel")
        .reduce((sum, module) => sum + module.widthIn, 0);
      // A stretch with no box in it is not a cabinet and has no size list to
      // come off: the strip that finishes a run against a wall, so a door has
      // somewhere to swing, is three inches on purpose, and the end panel that
      // closes an open run's last carcass is three inches because that is what
      // a finished panel is. `isOrderable` already holds each to its own.
      if (boxes === 0) continue;
      if (w < min || w > max) {
        fail("d13-width", `${segment.id} is ${w}", outside the ${min}-${max}" range`);
      } else if (Math.abs(boxes / step - Math.round(boxes / step)) > 1e-6) {
        fail("d13-width", `${segment.id} makes ${boxes}" of box, not a ${step}" increment`);
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
    // A cooking surface wants landing on both sides and they are not equal:
    // one wide, one narrow. Which side is which is the generator's business —
    // the check is that the pair is there, so it takes the better of the two
    // as the wide one.
    const sides = [landing(range.run, range.index, -1), landing(range.run, range.index, 1)];
    const wide = Math.max(...sides);
    const narrow = Math.min(...sides);
    const wanted = LAYOUT_LIMITS.rangeLanding;

    /**
     * Rule 12 again: an oven tower takes one side of the cooking surface, and
     * what is between them is a cabinet rather than a landing. So that side is
     * not asked for the narrow figure — d11-12 below asks it for the six
     * inches the machine's sheet wants — and the other side has to be the wide
     * one on its own, which is where a pan actually comes off the burner.
     */
    const towerAt = range.run.segments.findIndex(
      (segment) => segment.slot && PACKAGE_SLOTS[segment.slot]?.beside === "range",
    );
    const towered = towerAt >= 0;
    const towerSide = towered ? (towerAt < range.index ? -1 : 1) : 0;
    const away = towered ? landing(range.run, range.index, towerSide === -1 ? 1 : -1) : wide;

    if (towered ? away < wanted.wideIn - 1e-6 : wide < wanted.wideIn - 1e-6 || narrow < wanted.narrowIn - 1e-6) {
      fail(
        "d11-4",
        towered
          ? `range has ${away.toFixed(1)}" of counter on the side away from the tower, ` +
            `needs ${wanted.wideIn}"`
          : `range has ${narrow.toFixed(1)}" and ${wide.toFixed(1)}" of counter beside it, ` +
            `needs ${wanted.narrowIn}" and ${wanted.wideIn}"`,
      );
    }

    // D11 rule 12: open counter between the two of them, and the tower's own
    // side panel at the end of it. Five inches because the rangetop's sheet
    // asks for five to a combustible surface; more is better, and it is where
    // the wall's slack goes.
    if (towered) {
      const [from, to] = towerAt < range.index ? [towerAt + 1, range.index] : [range.index + 1, towerAt];
      const between = range.run.segments.slice(from, to);
      const counter = between
        .filter((segment) => segment.kind === "counter")
        .reduce((sum, segment) => sum + widthIn(segment), 0);
      const { counterIn, panelIn } = LAYOUT_LIMITS.towerSpacer;
      if (counter < counterIn - 1e-6) {
        fail(
          "d11-12",
          `${counter.toFixed(1)}" of counter between the cooking surface and the oven tower, ` +
            `needs ${counterIn}"`,
        );
      }
      // And what closes the tower is a board, not a cabinet.
      const side = between.find((segment) => segment.kind === "tall");
      if (!side) {
        fail("d11-12", "the oven tower has no finished side toward the cooking surface");
      } else if (Math.abs(widthIn(side) - panelIn) > 1e-6) {
        fail(
          "d11-12",
          `the oven tower's side is ${widthIn(side).toFixed(2)}", wants ${panelIn}"`,
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

  // D11 rule 8: the dishwasher's services all land in the sink base. This is
  // the physical fact rule 5 is a consequence of — the dishwasher is beside the
  // sink because that is the cabinet its power, water and drain are in.
  const dishwasherModel = selection?.["slot-dishwasher"];
  const points = dishwasherModel ? (roughInFor(dishwasherModel)?.points ?? []) : [];
  const stray = points.filter((point) => point.location !== "under-sink");
  if (stray.length > 0) {
    fail(
      "d11-8",
      `the dishwasher's ${stray.map((p) => p.type).join(", ")} ` +
        `${stray.length === 1 ? "does" : "do"} not land in the sink base`,
    );
  }

  // D11 rule 10: the sink has counter on both sides and stands clear of the
  // corner cabinet. One side is a working side and the other is somewhere to
  // stack, and the dishwasher counts as the wide one — 24" of surface at
  // counter height is 24" of surface at counter height.
  const sinkRun = runs.find((run) => run.segments.some((s) => s.fixture === "fixture-sink"));
  if (sinkRun) {
    const index = sinkRun.segments.findIndex((s) => s.fixture === "fixture-sink");
    const { wideIn, narrowIn, fromCornerIn } = LAYOUT_LIMITS.sink;

    /** What is beside the sink on one side, in inches of usable surface. */
    const beside = (direction: -1 | 1) => {
      const next = sinkRun.segments[index + direction];
      if (!next) return 0;
      if (next.slot === "slot-dishwasher") return widthIn(next);
      return landing(sinkRun, index, direction);
    };
    const sides = [beside(-1), beside(1)];
    if (Math.max(...sides) < wideIn - 1e-6) {
      fail(
        "d11-10",
        `sink has ${sides.map((v) => v.toFixed(0)).join('" and ')}" beside it, ` +
          `one side needs ${wideIn}"`,
      );
    }
    if (Math.min(...sides) < narrowIn - 1e-6) {
      fail(
        "d11-10",
        `sink has only ${Math.min(...sides).toFixed(0)}" on one side, needs ${narrowIn}"`,
      );
    }

    // The corner cabinet's door has to clear the sink base. On the leg that
    // carries the corner that is the corner segment; on the other leg it is
    // where the run starts, which is where the corner box stops.
    const cornerAt = sinkRun.segments.findIndex((s) => s.kind === "corner");
    const between = sinkRun.segments
      .slice(cornerAt + 1, index)
      .filter((s) => s.kind === "counter")
      .reduce((sum, s) => sum + widthIn(s), 0);
    if (between < fromCornerIn - 1e-6) {
      fail(
        "d11-10",
        `sink base is ${between.toFixed(0)}" of counter from the corner, needs ${fromCornerIn}"`,
      );
    }
  }

  // D11 rule 6: the refrigerator has counter to land things on.
  const fridge = locate(runs, "slot-fridge");
  if (!fridge) {
    fail("d11-6", "no refrigerator on any run");
  } else {
    // Measured at the bank rather than at the machine. Where three columns
    // stand together the refrigerator's own neighbours are the other two, and
    // the counter the rule is about is the one before the whole wall of them.
    const bank = fridge.run.segments.findIndex(
      (segment, i) =>
        segment.kind === "tall" &&
        fridge.run.segments.slice(i).every((later) => later.kind === "tall"),
    );
    const at = bank >= 0 ? bank : fridge.index;
    const best = Math.max(
      landing(fridge.run, at, -1),
      landing(fridge.run, fridge.index, 1),
    );
    if (best < LAYOUT_LIMITS.fridgeLandingIn - 1e-6) {
      fail(
        "d11-6",
        `refrigerator has ${best.toFixed(1)}" of landing, needs ${LAYOUT_LIMITS.fridgeLandingIn}"`,
      );
    }
  }

  // D11 rule 7 is about an island: two openings coming in from opposite faces,
  // with an aisle to the perimeter. A kitchen with no island has neither a
  // seating side nor an aisle, and its microwave and wine cabinet are two base
  // cabinets in a run — there is nothing here to check rather than a rule to
  // fail.
  // And only when they are actually on it: a package whose wine is an 84"
  // column stands it in the tall bank, and the island is then a prep island
  // with nothing to face either way.
  const islandCarries = (["slot-microwave", "slot-wine"] as const).every(
    (slotId) => SLOT_BY_ID[slotId]?.mount === "island",
  );
  if (island.present && islandCarries) {
    const microwave = SLOT_BY_ID["slot-microwave"];
    const wine = SLOT_BY_ID["slot-wine"];
    // Turned a quarter round, the two faces are on x rather than on z — so
    // which coordinate says "toward the runs" is the island's own, not the
    // room's. The rule is the same one either way: they face opposite ways,
    // and the drawer faces the side the cook works from.
    const across = island.axis === "x" ? 2 : 0;
    const facing = island.axis === "x" ? Math.cos : Math.sin;
    if (Math.abs(facing(microwave.rotationY) - facing(wine.rotationY)) < 1e-6) {
      fail("d11-7", "the microwave and the wine cabinet face the same way");
    }
    if (microwave.position[across] > wine.position[across]) {
      fail(
        "d11-7",
        "the microwave drawer should face the working side and the wine cabinet the seating side",
      );
    }
    // The aisle between the island and the run it stands off: the back run for
    // an island along the back wall, the left run for one turned across it.
    const run = runs.find((r) => r.id === (island.axis === "x" ? "back" : "left"))!;
    const front = run.centre + ROOM.counterDepth / 2;
    const aisle = inches((island.axis === "x" ? island.z[0] : island.x[0]) - front);
    if (aisle < LAYOUT_LIMITS.aisleIn - 1e-6) {
      fail(
        "d11-7",
        `${aisle.toFixed(1)}" aisle between the island and the ${run.id} run, ` +
          `needs ${LAYOUT_LIMITS.aisleIn}"`,
      );
    }
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
