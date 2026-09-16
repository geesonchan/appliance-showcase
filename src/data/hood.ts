import { CABINET_STANDARDS, ROOM, RUNS, ft } from "./room";
import { facingOf, toPlan } from "./frame";
import { againstWall } from "./roomWalls";
import { SLOT_BY_ID } from "./slots";
import type { Appliance, Slot } from "../types";

/**
 * The shape of a canopy, from the Thermador clearance drawing
 * (docs/reference/thermador-hood-clearance.png).
 *
 * A wall canopy is a wedge, not a box: 24" deep at the cooktop, a short
 * vertical lip at the front, then a slope back to a flat top only 12" deep
 * where it meets the wall. Drawing it as a box makes it look like a cupboard
 * and hides the fact that the duct comes off the *top*, well behind the front
 * edge — which is the whole reason the cabinet above it needs a hole in its
 * floor.
 */
export const HOOD_PROFILE = {
  /** The vertical face at the front, before the slope starts. */
  frontLipIn: 4.1875,
  /** Flat top against the wall when the model does not publish one. */
  defaultTopDepthIn: 12,
};

/**
 * The canopy as a solid, in inches.
 *
 * It is not a wedge. A wall canopy collects on all three open sides and
 * gathers into the flue, so it draws in on the front *and* both flanks: a
 * vertical face at the front, then four faces sloping up and inward to a top
 * the size of the chimney's own section, with the back staying flat against the
 * wall. Seen from the front it is an isosceles trapezoid; seen from the side it
 * is a wedge, which is the half of it the old geometry drew.
 *
 * Everything is in inches, from the canopy's underside (y = 0) upward, with x
 * across the run and z from the wall (0) into the room. See
 * docs/reference/hmcb30ws-spec.png.
 */
export function canopySolid(canopy: {
  widthIn: number;
  depthIn: number;
  heightIn: number;
  frontLipIn: number;
  topWidthIn: number;
  topDepthIn: number;
}) {
  const { widthIn, depthIn, heightIn } = canopy;
  const lip = Math.min(canopy.frontLipIn, heightIn);
  // The top can only draw in, never out: a canopy narrower than its own flue
  // would be a funnel the wrong way round.
  const topW = Math.min(canopy.topWidthIn, widthIn);
  const topD = Math.min(canopy.topDepthIn, depthIn);

  return {
    /** The rim, at the cooking surface end. */
    bottom: { w: widthIn, d: depthIn },
    /** Where the chimney lands. The same section, or the canopy does not meet it. */
    top: { w: topW, d: topD },
    /** How high the vertical front face runs before the slope starts. */
    lip,
    height: heightIn,
    /** Both back faces sit here: the canopy is flat against the wall. */
    backZ: 0,
    /** How far each flank draws in, which is the same on both sides. */
    insetX: (widthIn - topW) / 2,
    /** And how far the front draws back. */
    insetZ: depthIn - topD,
  };
}

/**
 * The canopy's section through the middle, in inches, as a closed polygon.
 *
 * Measured from the wall (x = 0) outward and from the canopy's underside
 * (y = 0) upward. Kept for the side elevation and the clearance drawing; the
 * solid itself is `canopySolid`.
 */
export function hoodProfile(
  depthIn: number,
  topDepthIn: number,
  heightIn: number,
  /** The model's own front face, where it publishes one. */
  frontLipIn = HOOD_PROFILE.frontLipIn,
) {
  const top = Math.min(Math.max(topDepthIn, 1), depthIn);
  const lip = Math.min(frontLipIn, heightIn);
  return [
    [0, 0],
    [depthIn, 0],
    [depthIn, lip],
    [top, heightIn],
    [0, heightIn],
  ] as [number, number][];
}

/**
 * The telescopic duct cover above a chimney hood.
 *
 * Not decoration and not a cabinet: it is the part that carries the duct from
 * the canopy to the ceiling, and it is sized to the room rather than to the
 * hood. Two sections, the lower sliding over the upper with a half-inch step
 * where they meet, and it always finishes at the ceiling — that is what makes a
 * chimney hood a chimney hood, and it is why nothing is built above one.
 *
 * The assembly has its own travel. Past the top of it the manufacturer sells an
 * extension, and a room that needs one has to say so on the install list rather
 * than draw a chimney that does not exist. Figures from Leo's round-17 note
 * against HMCB30WS.
 */
export const CHIMNEY = {
  widthIn: 13.1875,
  depthIn: 10.75,
  /**
   * How much bigger the outer section is than the inner, all round.
   *
   * Nearly nothing: the two read as one flue with a joint in it, not as a
   * stepped stack. The drawing gives one cross-section for both.
   */
  stepIn: 0.25,
  /**
   * One section's height, and therefore the whole assembly collapsed.
   *
   * Read off docs/reference/hmcb30ws-spec.png: its 30-42" is measured from the
   * canopy's *underside* to the top of the chimney, and the canopy is 8-9/16"
   * of that. So collapsed the chimney shows 30 - 8-9/16 = 21-7/16", which is
   * the outer section with the inner entirely inside it.
   *
   * What the assembly can cover is therefore one section at the bottom and two
   * nearly fully drawn apart at the top — not the sheet's 30-42, which is the
   * rated installation range for an 8' to 9' ceiling rather than the travel of
   * the part.
   */
  sectionIn: 30 - 8.5625,
  /** The extension a taller room needs. */
  extension: "CHXTHMCB",
  /** The grille across the top of each side, from the drawing's 5-1/2". */
  vent: { heightIn: 5.5, fromTopIn: 1 },
};

export interface ChimneyParts {
  /** Canopy top to ceiling, in feet. What the assembly has to cover. */
  rise: number;
  /**
   * The two sections. Both are one section tall — they telescope, so they
   * overlap rather than tile: the outer one hangs from the canopy's top and the
   * inner one from the ceiling, and how far apart they are drawn is the rise.
   */
  lower: { from: number; h: number; w: number; d: number };
  upper: { from: number; h: number; w: number; d: number };
  /** How much of the outer section the inner is still inside, in feet. */
  overlap: number;
  /** True when the room is taller than the two sections reach. */
  needsExtension: boolean;
  /** How much taller, in inches. Zero when it fits. */
  shortIn: number;
  /** True when the ceiling is too low for even one section. */
  tooLow: boolean;
}

/**
 * The chimney for a canopy whose top is at `canopyTop` feet above the floor.
 *
 * Measured, not assumed. The canopy hangs its clearance above the cooking
 * surface the wall was drilled for, so where its top lands moves with the range
 * — and the chimney is whatever is left between there and the ceiling.
 */
export function chimneyParts(canopyTop: number, ceiling = ROOM.wallHeight): ChimneyParts {
  const rise = Math.max(0, ceiling - canopyTop);
  const section = ft(CHIMNEY.sectionIn);
  const step = ft(CHIMNEY.stepIn);
  const w = ft(CHIMNEY.widthIn);
  const d = ft(CHIMNEY.depthIn);

  // Both sections are the same length and they slide on each other. The outer
  // hangs off the canopy, the inner off the ceiling, and what changes with the
  // room is how much of the inner is still inside the outer. Collapsed they
  // are one section tall; drawn nearly apart they are two.
  const overlap = 2 * section - rise;
  const overIn = -overlap * 12;
  return {
    rise,
    lower: { from: 0, h: section, w, d },
    upper: { from: rise - section, h: section, w: w - step, d: d - step },
    overlap: Math.max(0, overlap),
    needsExtension: overIn > 1e-6,
    shortIn: overIn > 1e-6 ? overIn : 0,
    tooLow: rise < section - 1e-6,
  };
}

/**
 * A hood hung from the ceiling over an island, from HMIB42WS's installation
 * guide, page 8 (docs/reference/HMIB42WS_Installation.pdf): a canopy 2-3/4"
 * thick, a 13-1/4" x 14-7/8" duct cover over it, and 30"-45-1/16" from the
 * bottom of the hood to the top of the cover, ducted. D20, round 46.
 */
export const ISLAND_HOOD = {
  canopyThicknessIn: 2.75,
  cover: { widthIn: 13.25, depthIn: 14.875 },
  /** Bottom of the hood to the top of the duct cover, ducted. */
  spanIn: [30, 45.0625] as const,
  /**
   * How far the underside hangs off the floor. D20: under the 108-1/2" ceiling
   * the drawing allows 63-7/16" to 78-1/2", and a head clears 66", so the band
   * anyone may use is 66"-76" and the figure is 72".
   *
   * The band holds under this ceiling and no other: under an 8' ceiling the
   * highest the drawing allows is 66", which is the head line with nothing
   * over.
   */
  undersideIn: 72,
  usableIn: [66, 76] as const,
};

export interface IslandHoodParts {
  /** Bottom of the hood to the ceiling. */
  overallIn: number;
  canopyIn: number;
  /** The duct cover, from the canopy's top to the ceiling. */
  coverIn: number;
  /** Whether the overall height is inside the drawing's span. */
  withinSpan: boolean;
}

/**
 * A hung hood, its underside `undersideIn` off the floor, in inches.
 *
 * Every height starts from where it hangs. Round 44's prototype drew a 30"
 * solid canopy from `heightIn` and a stem as long as the ceiling less that — as
 * if the hood stood on the floor — so the stem ran 72" through the ceiling. The
 * overall height is the ceiling less the underside; the canopy is its own
 * thickness; the duct cover is the rest, from the canopy's top to the ceiling.
 */
export function islandHoodParts(undersideIn: number, ceilingIn = ROOM.wallHeight * 12): IslandHoodParts {
  const overallIn = ceilingIn - undersideIn;
  const canopyIn = ISLAND_HOOD.canopyThicknessIn;
  const [low, high] = ISLAND_HOOD.spanIn;
  return {
    overallIn,
    canopyIn,
    coverIn: overallIn - canopyIn,
    withinSpan: overallIn >= low - 1e-6 && overallIn <= high + 1e-6,
  };
}

/**
 * How tall the hood's own body is, in feet: the part that is the machine.
 *
 * For a canopy against a wall that is what the catalogue sells it as. For a
 * hood hung over an island it is **the canopy alone** — HMIB42WS's `heightIn`
 * of 30" is the assembly collapsed for shipping, and the canopy is 2-3/4" of
 * it (D20). Round 55: three things read "the top of the hood" off that 30" —
 * the duct outlet, the damper above it and the selection outline — and all
 * three were 27-1/4" out. One cause, one answer, asked here.
 */
export function hoodBodyHeightFt(slot: Slot, appliance: Appliance | undefined): number {
  if (slot.id === "slot-hood" && slot.mount === "island") {
    return ft(ISLAND_HOOD.canopyThicknessIn);
  }
  // The same three-way fall-back `applianceBox` uses everywhere else: the body,
  // then the cutout, then the opening. Round 55's first draft left the middle
  // one out and `applianceBox.test.ts` caught it on AK7136AS-BF, an
  // under-cabinet hood that publishes 7-3/8" as a cutout height and no body
  // height — it was drawn at the opening's 18".
  return ft(appliance?.heightIn ?? appliance?.cutoutHeightIn ?? slot.cutout.h);
}

/** True when this model hangs its own duct cover rather than living under a box. */
export const isChimney = (appliance: Appliance | undefined) =>
  !!appliance?.installType.some((type) => type === "chimney" || type === "wall-mount");

/** How deep the flat top is, in inches. */
export const hoodTopDepthIn = (appliance: Appliance | undefined, depthIn: number) =>
  Math.min(appliance?.topDepthIn ?? HOOD_PROFILE.defaultTopDepthIn, depthIn);

export interface HoodOutlet {
  /** Centre of the opening, in world feet. */
  position: [number, number, number];
  /** The rectangle itself, in feet. */
  widthFt: number;
  depthFt: number;
  /** The same rectangle in inches, for the copy that quotes it. */
  widthIn: number;
  depthIn: number;
}

/**
 * Where the duct leaves the canopy.
 *
 * One definition, used by three things that must agree: the collar drawn on the
 * hood, the duct that rises from it, and the hole cut in the floor of the
 * cabinet above. Two of those are on opposite sides of a cabinet panel, so a
 * disagreement between them is a duct that misses its hole.
 */
export function hoodOutlet(slot: Slot, appliance: Appliance | undefined): HoodOutlet {
  const { outlet } = CABINET_STANDARDS.hood;
  const depthFt = ft(slot.cutout.d);
  // Out of the canopy's own back face, not out of the back wall. The two are
  // the same point for a hood on the back run and for no other, which is why
  // this stood as `position[2] - depth/2` until round 52 (D22 step 3).
  //
  // A hood hung over an island has no back face to measure from: its duct
  // cover is centred on the canopy (D20, round 46, and it is drawn that way),
  // so the duct inside it is centred too.
  const [x, z] =
    slot.mount === "island"
      ? [slot.position[0], slot.position[2]]
      : toPlan(slot, 0, -depthFt / 2 + ft(outlet.fromWallIn));

  return {
    position: [x, slot.position[1] + hoodBodyHeightFt(slot, appliance), z],
    widthFt: ft(outlet.widthIn),
    depthFt: ft(outlet.depthIn),
    widthIn: outlet.widthIn,
    depthIn: outlet.depthIn,
  };
}

/**
 * The underside of the cabinet the duct has to pass through, in feet.
 *
 * That is the bridge over the canopy, whose floor sits at 84" — not the 54" the
 * rest of the wall cabinets start at. Cutting the hole at the wrong height puts
 * it in mid-air.
 *
 * A housing built round an insert liner is not that cabinet, even though it is
 * a module over the hood the same way. It is hollow: the duct goes up inside
 * it, through the taper and out at the ceiling, and there is no floor in it to
 * cut. Telling an installer to cut one is the same error as telling them to
 * cut the bridge over a chimney hood that has no bridge.
 */
export function hoodCabinetFloor(): number | null {
  const hood = SLOT_BY_ID["slot-hood"];
  const carries = RUNS.some((run) =>
    run.uppers.some((bank) =>
      bank.modules.some(
        (module) => module.slot === "slot-hood" && module.kind !== "hood-cabinet",
      ),
    ),
  );
  return carries ? hood.position[1] + ft(hood.cutout.h) : null;
}

/**
 * Formatted for the install checklist and the duct's own callout.
 *
 * A liner's outlet is a round transition — a 10" pipe on the top of the tray —
 * and a canopy's is the rectangular collar on its drawing. Which of the two is
 * over the range is read off the run, the same way the cabinet floor is.
 */
export const outletSize = () => {
  const hood = SLOT_BY_ID["slot-hood"];
  const duct = hood.utilities.duct;
  // A hood over an island leaves through an 8" round transition (HMIB42WS's
  // guide, page 11), not the wall canopy's rectangular collar. Round 58.
  return (housed() || hood.mount === "island") && duct
    ? `${duct.diameterIn}" round`
    : `${CABINET_STANDARDS.hood.outlet.widthIn}" × ${CABINET_STANDARDS.hood.outlet.depthIn}"`;
};

/** Whether the hood over the range is a liner inside a housing somebody built. */
const housed = () =>
  RUNS.some((run) =>
    run.uppers.some((bank) => bank.modules.some((module) => module.kind === "hood-cabinet")),
  );

/**
 * Where the duct goes once it is off the canopy, and where a blower in it sits.
 *
 * Two routes. Up through the cabinet above to the roof, which is every route
 * but one; or straight out the back of the canopy through the wall behind it,
 * which is `back-wall`. Round 52 (D22 step 3): this was written inside
 * `UtilityLayer` with the back wall as the only wall a duct could go through,
 * so a hood on the left run sent its duct across the kitchen to the far wall.
 *
 * Feet. `collarY` is the top of the transition off the canopy.
 */
export function ductRoute(
  slot: Slot,
  outlet: HoodOutlet,
  collarY: number,
  route: string,
  ceiling = ROOM.wallHeight,
): { runsUp: boolean; end: [number, number, number]; inlineAt: [number, number, number] } {
  const x = outlet.position[0];
  const z = outlet.position[2];
  // A hood over an island backs onto nothing, so there is no wall route out of
  // it whatever the model's duct says: it goes up, through the ceiling.
  const runsUp = route !== "back-wall" || slot.mount === "island";
  if (runsUp) {
    return {
      runsUp,
      end: [x, ceiling, z],
      inlineAt: [x, collarY + (ceiling - collarY) * 0.62, z],
    };
  }
  // Through the wall the canopy's own back is against.
  const wall = againstWall(facingOf(slot.rotationY), x, z);
  const part = (from: number, to: number) => from + (to - from) * 0.62;
  return {
    runsUp,
    end: [wall.x, collarY, wall.z],
    inlineAt: [
      part(slot.position[0], wall.x),
      collarY,
      part(slot.position[2], wall.z),
    ],
  };
}

/**
 * What a click on the duct says, in the room it is in.
 *
 * Round 58. It used to say "the cabinet floor needs a cutout; the duct passes
 * through the cabinet" whatever the hood hung under, which was wrong for package
 * C's chimney hood — no cabinet over it — and for any hood over an island.
 *
 * - A hood hung over an island: through the ceiling to the roof, 8" round, and
 *   a metal vent cover where it leaves the house. HMIB42WS's guide, pages 11-12:
 *   "venting through the ceiling", an 8" round transition and 8" round duct,
 *   "always install a metal vent cover where the ductwork exits the house".
 * - A chimney hood against a wall: the duct rises inside the chimney cover to
 *   the ceiling, which HMCB30WS's sheet draws (30"-42" from the canopy's
 *   underside to the top of the chimney, extension kit to 12' ceilings). Its
 *   installation guide is not in `docs/reference/`, so nothing past the
 *   ceiling is claimed for it.
 */
export function ductCallout(
  slot: Slot,
  route: string,
): { key: string; vars: Record<string, string | number> } {
  if (route !== "through-ceiling") return { key: "duct.callout", vars: { size: outletSize() } };
  return slot.mount === "island"
    ? { key: "duct.calloutCeiling", vars: { size: outletSize() } }
    : { key: "duct.calloutChimney", vars: { size: outletSize() } };
}

/** How far past the ceiling the install view carries a duct going through it, in feet. */
const CEILING_STUB = ft(12);

/**
 * The piece of duct drawn past the ceiling, where a hood's own guide shows one.
 *
 * Round 58. The scene draws no ceiling, and does not try to draw what is above
 * one: this is a foot of 8" duct straight up past 108-1/2", enough to say the
 * duct goes on through. Only for a hood hung over an island, whose guide shows
 * the configuration; package C's chimney hood also goes through the ceiling,
 * but its guide is not in the repo, so its duct stops at the ceiling as before.
 *
 * Dashed grey — D21's reviewed-but-not-off-a-drawing tier. The configuration
 * is in the guide; that the duct rises from the middle of the canopy is not
 * drawn there, it follows from the cover being centred (D20, round 52).
 */
export function ceilingStub(
  slot: Slot,
  outlet: HoodOutlet,
  route: string,
): { from: [number, number, number]; to: [number, number, number]; tier: "unconfirmed" } | null {
  if (route !== "through-ceiling" || slot.mount !== "island") return null;
  const [x, , z] = outlet.position;
  return {
    from: [x, ROOM.wallHeight, z],
    to: [x, ROOM.wallHeight + CEILING_STUB, z],
    tier: "unconfirmed",
  };
}

/**
 * A hood's duct route has to be one its mounting can have.
 *
 * Round 58, Leo. A hood hung over an island has no cabinet over it and no wall
 * behind it, so `up-through-cabinet` and `back-wall` are mistakes in the data,
 * and a mistake in the data is thrown where it is found rather than drawn.
 * Round 52 had quietly sent such a duct up anyway; this says so instead.
 */
export function assertHoodRoute(slot: Slot): void {
  if (slot.id !== "slot-hood" || slot.mount !== "island") return;
  const route = slot.utilities.duct?.route;
  if (route === "up-through-cabinet" || route === "back-wall") {
    throw new Error(
      `slot-hood hangs over the island and its duct is declared ${route}: ` +
        "there is no cabinet over it and no wall behind it. " +
        "Declare through-ceiling, as its guide does, or recirc.",
    );
  }
}
