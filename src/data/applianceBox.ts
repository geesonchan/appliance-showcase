import { ROOM, ft } from "./room";
import type { Appliance, Slot } from "../types";

/**
 * How big an appliance is, and where in its opening it sits.
 *
 * The scene used to draw every appliance at the size of its slot, which is what
 * turned a 16-5/8" microwave drawer into a 34" cabinet front. A slot is a hole
 * in the cabinetry; the thing that goes in it has its own dimensions, and the
 * space left over is cabinetry, not appliance.
 *
 * Everything here is in feet, because that is what the scene works in. Missing
 * figures fall back the same way the fit check does: the published cutout where
 * there is no body dimension, and the slot itself only when the sheet has
 * neither.
 */
export interface ApplianceBox {
  /** The appliance body. */
  w: number;
  h: number;
  d: number;
  /** Bottom of the body, above the slot's own origin. */
  y: number;
  /** How far its own spacers hold it off the wall, where `d` does not include them. */
  rearSpacerIn: number;
  /** Cabinetry filling the rest of the opening. */
  filler: { below: number; above: number; eachSide: number };
}

const pick = (body: number | null, cutout: number | null, fallback: number) =>
  ft(body ?? cutout ?? fallback);

/**
 * A drawer microwave hangs from the underside of the counter with a drawer
 * beneath it. Everything else stands on the floor of its opening.
 */
function hangsFromTheTop(appliance: Appliance): boolean {
  return (
    appliance.category === "microwave" &&
    appliance.installType.some((type) => type === "drawer" || type === "built-in")
  );
}

export function applianceBox(slot: Slot, appliance: Appliance): ApplianceBox {
  const w = pick(appliance.widthIn, appliance.cutoutWidthIn, slot.cutout.w);
  const h = pick(appliance.heightIn, appliance.cutoutHeightIn, slot.cutout.h);
  // The envelope, which for a freestanding machine is the depth with its doors
  // shut: the doors are part of the box rather than panels hung off a carcass,
  // and the published figure is measured from the wall with its rear spacers
  // included. Only the handles stand outside it.
  const d =
    appliance.depthWithDoorsIn !== null
      ? ft(appliance.depthWithDoorsIn)
      : pick(appliance.depthIn, appliance.cutoutDepthIn, slot.cutout.d);

  const openingH = ft(slot.cutout.h);
  const openingW = ft(slot.cutout.w);
  // An appliance taller or wider than its opening is a real state — the fit
  // check reports it rather than blocking — so the leftover never goes below
  // zero and turns into cabinetry that is not there.
  const spareH = Math.max(0, openingH - h);
  const spareW = Math.max(0, openingW - w);

  // A hood is hung, not stood: its slot position is already the underside of
  // the canopy, so there is nothing below it to fill.
  const hung = slot.id === "slot-hood";
  const fromTop = hung || hangsFromTheTop(appliance);

  // The leftover is only cabinetry where there is cabinetry. A full-height
  // appliance the joiner does not build round — a refrigerator standing at the
  // end of a counter — leaves no panel above it and no filler beside it: what
  // is there is the room. See docs/decisions.md D16.
  const standsAlone = slot.cabinetConfig.type === "tall";

  return {
    w,
    h,
    d,
    // Counted whatever the depth figure is. A depth-with-doors is the machine
    // with its doors shut, measured on the machine; the spacers behind it are
    // a separate inch, and the two add up to where the doors actually end up.
    rearSpacerIn: appliance.rearSpacerIn ?? 0,
    y: fromTop && !hung ? spareH : 0,
    filler: {
      below: hung || standsAlone ? 0 : fromTop ? spareH : 0,
      above: hung || standsAlone ? 0 : fromTop ? 0 : spareH,
      eachSide: standsAlone ? 0 : spareW / 2,
    },
  };
}

/**
 * How far forward the body sits within the run.
 *
 * Slots are on the centre line of a 24" run and appliances install flush with
 * the cabinet face, so a shallower body moves toward the room. A hood is the
 * exception: it hangs off the wall behind it.
 */
export function flushOffset(slot: Slot, depth: number, rearSpacerIn = 0): number {
  if (slot.id === "slot-hood") return -(ROOM.counterDepth - depth) / 2;
  // A machine that carries its own spacers stands exactly that far off the
  // wall — which is the figure its published depth-to-wall is measured over.
  if (rearSpacerIn > 0) return (depth - ROOM.counterDepth) / 2 + ft(rearSpacerIn);
  // Flush with the cabinet face, but never with its back inside the wall.
  // Aligning the fronts of a 28" range in a 24" run puts four inches of the
  // machine into the plaster; what actually happens is that it stands against
  // the wall and projects into the room, which is most of what a freestanding
  // appliance looks like from the side.
  const flushWithTheFace = (ROOM.counterDepth - depth) / 2 + ft(0.5);
  const backAgainstTheWall = (depth - ROOM.counterDepth) / 2;
  return Math.max(flushWithTheFace, backAgainstTheWall);
}
