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

/**
 * Proportions of a freestanding range with a backguard, in inches.
 *
 * A different machine from a pro range, not a variant of one. It is sold at its
 * full height with the backguard on and cooks at 36"; its controls are on the
 * front rather than on a fascia under the deck; the bottom of it is a storage
 * drawer rather than a toe kick, so it reaches the floor; and its sides are
 * painted rather than steel, because only the front and the top are finished.
 * From Leo's round-17 note against MFES4030RS.
 */
export const FREESTANDING_PROPORTIONS = {
  /** A drawer you keep pans in. Not a toe kick — there is nothing recessed. */
  drawerIn: 7,
  /** The oven door, as a fraction of the cooking-surface height. */
  doorFraction: 0.5,
  /** The exhaust grille along the bottom of the control strip. */
  ventIn: 2.5,
  grateIn: 1.5,
  deckIn: 0.5,
  /** Knobs on the front are smaller than a pro range's fascia knobs. */
  knobDiameterIn: 1.75,
  handleDiameterIn: 1.25,
  handleFractionOfDoor: 0.92,
  /** "A large window": most of the door, which is what the class is known for. */
  windowFraction: 0.55,
  /** How far the backguard stands forward of the machine's back. */
  backguardDepthIn: 3,
  /** The display across the top of the backguard's face. */
  displayWidthFraction: 0.42,
  displayHeightFraction: 0.3,
  /** Painted, not stainless: dark grey, as the sides of one are. */
  sideColor: "#3A3D3F",
};

/** A band of the front, in feet above the floor. */
export type Band = readonly [number, number];

export interface RangeParts {
  /**
   * Which machine this is.
   *
   * Not read off `installType`: a Thermador Pro Harmony is a freestanding range
   * too, and drawing a backguard on one would be wrong. What separates them is
   * whether the model publishes a backguard, which is a figure off the drawing
   * rather than a word off the feature list.
   */
  style: "pro" | "backguard";
  burners: number;
  /** The cooking surface, in feet: the machine's top unless it has a backguard. */
  cooktop: number;
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
   * The raised panel at the back, on a machine that has one. Inside the
   * envelope, because the height such a range is sold at includes it.
   */
  backguard: { h: number; d: number; display: { w: number; h: number } } | null;
  /** The grille along the bottom of the control strip, on a backguard machine. */
  vent: Band | null;
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
 * The height of the cooking surface, in feet.
 *
 * The published height for a pro range, whose top *is* its cooktop. The
 * published cooktop figure for one with a backguard, because that machine is
 * sold at 47-7/8" and cooks at 36" — and it is the second number a hood's
 * clearance and the counter beside it are measured from.
 */
export const cooktopHeight = (appliance: Appliance, box: { h: number }) =>
  appliance.cooktopIn !== null && appliance.cooktopIn !== undefined
    ? ft(appliance.cooktopIn)
    : box.h;

/** True when the model publishes a raised panel above its cooking surface. */
export const hasBackguard = (appliance: Appliance) =>
  appliance.backguardIn !== null && appliance.backguardIn !== undefined;

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
  const F = FREESTANDING_PROPORTIONS;
  const burners = burnerCount(appliance);
  const backguarded = hasBackguard(appliance);
  const cooktop = cooktopHeight(appliance, box);

  const grate = ft(backguarded ? F.grateIn : P.grateIn);
  const deck = ft(backguarded ? F.deckIn : P.deckIn);
  const toe = backguarded ? 0 : ft(P.toeKickIn);
  const door = cooktop * (backguarded ? F.doorFraction : P.doorFraction);
  // A freestanding range's bottom is a storage drawer standing on the floor;
  // a pro range's is a toe kick with a drawer front above it. Either way the
  // bands tile the cooking surface exactly.
  const plinth = backguarded
    ? ft(F.drawerIn)
    : Math.max(0, cooktop - toe - door - ft(P.controlIn) - deck - grate);
  // The control strip takes what is left. On a pro range that is the 3" fascia
  // under the deck; on a freestanding one it is the band above the oven door
  // carrying the knobs and the exhaust grille.
  const control = backguarded
    ? Math.max(0, cooktop - plinth - door - deck - grate)
    : ft(P.controlIn);

  let y = 0;
  const band = (height: number): Band => {
    const start = y;
    y += height;
    return [start, y] as const;
  };
  // Bottom to top. The order is the machine's: a pro range carries its knobs
  // on a fascia under the deck, a freestanding one carries them on the front
  // above the oven door. Both stacks reach the cooking surface exactly.
  const bands = {
    toe: band(toe),
    plinth: band(plinth),
    door: band(door),
    control: band(control),
    deck: band(deck),
    grate: band(grate),
  };

  // Grates tile the deck with nothing between them: the cast iron is
  // continuous, so a pan slides from one burner to the next. A pro range lays
  // them two deep in pairs; a freestanding one lays them straight across, one
  // per burner, the full depth of the deck.
  const rows = backguarded ? 1 : P.grateRows;
  const columns = Math.ceil(burners / rows);
  const margin = ft(backguarded ? 1 : P.deckMarginIn);
  const fieldW = box.w - margin * 2;
  const fieldD = box.d - margin * 2;
  const grateW = fieldW / columns;
  const grateD = fieldD / rows;
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

  const knobs: RangeParts["knobs"] = [];
  // The exhaust grille runs along the bottom of a freestanding range's control
  // strip; the knobs sit above it.
  const vent: Band | null = backguarded
    ? ([bands.control[0], Math.min(bands.control[1], bands.control[0] + ft(F.ventIn))] as const)
    : null;
  const knobBand: Band = vent ? ([vent[1], bands.control[1]] as const) : bands.control;
  const centreY = (knobBand[0] + knobBand[1]) / 2;
  const displayW = box.w * 0.16;

  if (backguarded) {
    // One knob per burner, straight across the strip, and nothing else on it:
    // the display is on the backguard, where that machine puts it.
    const r = Math.min(ft(F.knobDiameterIn / 2), (knobBand[1] - knobBand[0]) / 2.4);
    const edge = box.w / 2 - ft(1) - r;
    for (let i = 0; i < burners; i += 1) {
      const t = burners === 1 ? 0.5 : i / (burners - 1);
      knobs.push({ x: -edge + 2 * edge * t, y: centreY, r });
    }
    return {
      style: "backguard",
      burners,
      cooktop,
      bands,
      grates,
      knobs,
      // On the backguard, not on the fascia: this is where the machine's own
      // drawing puts the clock and the oven readout.
      display: {
        x: 0,
        y: cooktop + ft(appliance.backguardIn!) * (1 - F.displayHeightFraction / 2 - 0.18),
        w: box.w * F.displayWidthFraction,
        h: ft(appliance.backguardIn!) * F.displayHeightFraction,
      },
      islandTrim: { h: 0, d: 0 },
      backguard: {
        h: ft(appliance.backguardIn!),
        d: ft(F.backguardDepthIn),
        display: {
          w: box.w * F.displayWidthFraction,
          h: ft(appliance.backguardIn!) * F.displayHeightFraction,
        },
      },
      vent,
      sides: "finished",
      counterLip: null,
    };
  }

  // Knobs in two banks with the display between them, so the fascia reads the
  // way the front of the machine does.
  const count = knobCount(burners);
  const perSide = count / 2;
  // A knob is the size the drawing says, unless the fascia is too shallow to
  // take one — a 30" range has the same 2-1/4" knobs as a 36".
  const r = Math.min(ft(P.knobDiameterIn / 2), control / 2.4);
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
    style: "pro",
    burners,
    cooktop,
    bands,
    grates,
    knobs,
    display: { x: 0, y: centreY, w: displayW, h: control * 0.45 },
    islandTrim: { h: ft(P.islandTrimIn), d: ft(2) },
    backguard: null,
    vent: null,
    sides: appliance.installType.some((type) => /freestanding/i.test(type))
      ? "finished"
      : "unfinished",
    counterLip: appliance.installType.some((type) => /slide.?in/i.test(type))
      ? { h: ft(0.75), d: ft(P.counterLipIn) }
      : null,
  };
}
