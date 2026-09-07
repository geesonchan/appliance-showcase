import { ft } from "./roomShell";
import type { Appliance } from "../types";

/**
 * How a pro-style range is put together, as numbers rather than as JSX.
 *
 * The shape of a range is not decoration: a customer looks at the front of it
 * and counts the knobs, and a 36" Thermador has six burners in three pairs and
 * eight knobs across the fascia. So the arrangement is worked out here, where
 * it can be checked, and `ApplianceModel` draws whatever it is handed — the
 * same split as `hood.ts`.
 *
 * Everything comes from the appliance's own record. The figures below are the
 * proportions of the class of machine, not of one model: how tall a toe kick
 * is, how thick a cast-iron grate is. The overall size is the model's.
 */

/** Proportions of a pro-style range, in inches. */
export const RANGE_PROPORTIONS = {
  toeKickIn: 4,
  /** The control fascia carrying the knobs. */
  controlIn: 3,
  /** Cast iron, and heavy enough to see. */
  grateIn: 1.5,
  /** The stainless deck the grates sit on. */
  deckIn: 0.5,
  /** The oven door as a fraction of the front. */
  doorFraction: 0.6,
  /** The low back rail, which stands above the cooking surface. */
  islandTrimIn: 3,
  /** A slide-in laps this far over the counter each side of its front. */
  counterLipIn: 1,
  /** Knobs are 2-1/4" across on a Thermador Pro Harmony, and stainless. */
  knobDiameterIn: 2.25,
  /** The oven handle: a 1-1/4" tube on two brackets, near the door's width. */
  handleDiameterIn: 1.25,
  handleFractionOfDoor: 0.9,
  /** The window in the oven door, as a fraction of the door's height. */
  windowFraction: 0.4,
  /** The stainless band between the fascia and the door. */
  bandIn: 1,
  /** Grates are laid two deep, in as many columns as that takes. */
  grateRows: 2,
  /** Stainless left showing round the edge of the deck. */
  deckMarginIn: 2,
  /** The shadow line between one grate and the next; they still abut. */
  grateGapIn: 0.25,
};

/** A band of the front, in feet above the floor. */
export type Band = readonly [number, number];

export interface RangeParts {
  burners: number;
  /** Bands of the front, bottom to top. They tile the height exactly. */
  bands: {
    toe: Band;
    /** The drawer front between the toe kick and the oven door. */
    plinth: Band;
    door: Band;
    control: Band;
    /** The deck and the grates on it, which reach the published height. */
    deck: Band;
    grate: Band;
  };
  /** Grates on the deck, in feet, relative to the body's centre. */
  grates: { x: number; z: number; w: number; d: number; h: number }[];
  /** Knobs across the fascia, in feet, relative to the body's centre. */
  knobs: { x: number; y: number; r: number }[];
  /** The display between the two banks of knobs. */
  display: { x: number; y: number; w: number; h: number };
  /** The low back rail: above the published height, as it is on the drawing. */
  islandTrim: { h: number; d: number };
  /**
   * A freestanding range has finished sides and stands on its own; a slide-in
   * has unfinished sides and laps its cooktop over the counter beside it.
   */
  sides: "finished" | "unfinished";
  counterLip: { h: number; d: number } | null;
}

/**
 * How many burners, and how many knobs in front of them.
 *
 * The count is the appliance's own where the record has it. Where it does not,
 * a 36" pro range is six and anything narrower is four, which is what the
 * category is: nobody makes a 30" pro range with six burners. The knobs are the
 * burners plus two — the oven and the griddle — which is the eight across a
 * PRG366WH.
 */
export function burnerCount(appliance: Appliance): number {
  if (appliance.burners !== null && appliance.burners !== undefined) return appliance.burners;
  return (appliance.widthIn ?? 30) >= 36 ? 6 : 4;
}

export const knobCount = (burners: number) => burners + 2;

/**
 * Lay a range out inside the envelope it publishes.
 *
 * The bands stack to the full height and the grates reach the top of it,
 * because the height a range is sold at is the height of its cooking surface —
 * which is also the figure the hood's clearance is measured from. The island
 * trim is the one thing above that line, as it is on the drawing.
 */
export function rangeParts(
  appliance: Appliance,
  box: { w: number; h: number; d: number },
): RangeParts {
  const P = RANGE_PROPORTIONS;
  const burners = burnerCount(appliance);

  const grate = ft(P.grateIn);
  const deck = ft(P.deckIn);
  const control = ft(P.controlIn);
  const toe = ft(P.toeKickIn);
  const door = box.h * P.doorFraction;
  // Whatever is left between the toe kick and the oven door is a drawer front.
  const plinth = Math.max(0, box.h - toe - door - control - deck - grate);

  let y = 0;
  const band = (height: number): Band => {
    const start = y;
    y += height;
    return [start, y] as const;
  };
  const bands = {
    toe: band(toe),
    plinth: band(plinth),
    door: band(door),
    control: band(control),
    deck: band(deck),
    grate: band(grate),
  };

  // Grates tile the deck two deep with nothing between them: on a pro range
  // the cast iron is continuous, so a pan slides from one burner to the next.
  const columns = Math.ceil(burners / P.grateRows);
  const margin = ft(P.deckMarginIn);
  const fieldW = box.w - margin * 2;
  const fieldD = box.d - margin * 2;
  const grateW = fieldW / columns;
  const grateD = fieldD / P.grateRows;
  const grates: RangeParts["grates"] = [];
  for (let i = 0; i < burners; i += 1) {
    const column = i % columns;
    const row = Math.floor(i / columns);
    grates.push({
      x: -fieldW / 2 + grateW * (column + 0.5),
      z: -fieldD / 2 + grateD * (row + 0.5),
      w: grateW,
      d: grateD,
      h: grate,
    });
  }

  // Knobs in two banks with the display between them, so the fascia reads the
  // way the front of the machine does.
  const knobs: RangeParts["knobs"] = [];
  const count = knobCount(burners);
  const perSide = count / 2;
  // A knob is the size the drawing says, unless the fascia is too shallow to
  // take one — a 30" range has the same 2-1/4" knobs as a 36".
  const r = Math.min(ft(P.knobDiameterIn / 2), control / 2.4);
  const centreY = (bands.control[0] + bands.control[1]) / 2;
  const displayW = box.w * 0.16;
  for (const side of [-1, 1]) {
    // Three quarters of an inch of steel between the display and the first
    // knob, measured to the knob's edge.
    const from = side * (displayW / 2 + ft(0.75) + r);
    // An inch of steel outside the last knob, measured to its edge rather than
    // its centre: a knob half over the side of the machine is not a knob.
    const to = side * (box.w / 2 - ft(1) - r);
    for (let i = 0; i < perSide; i += 1) {
      const t = perSide === 1 ? 0.5 : i / (perSide - 1);
      knobs.push({ x: from + (to - from) * t, y: centreY, r });
    }
  }

  return {
    burners,
    bands,
    grates,
    knobs,
    display: { x: 0, y: centreY, w: displayW, h: control * 0.45 },
    islandTrim: { h: ft(P.islandTrimIn), d: ft(2) },
    sides: appliance.installType.some((type) => /freestanding/i.test(type))
      ? "finished"
      : "unfinished",
    counterLip: appliance.installType.some((type) => /slide.?in/i.test(type))
      ? { h: ft(0.75), d: ft(P.counterLipIn) }
      : null,
  };
}
