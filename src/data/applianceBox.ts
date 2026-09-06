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
  const d = pick(appliance.depthIn, appliance.cutoutDepthIn, slot.cutout.d);

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

  return {
    w,
    h,
    d,
    y: fromTop && !hung ? spareH : 0,
    filler: {
      below: hung ? 0 : fromTop ? spareH : 0,
      above: hung ? 0 : fromTop ? 0 : spareH,
      eachSide: spareW / 2,
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
export function flushOffset(slot: Slot, depth: number): number {
  if (slot.id === "slot-hood") return -(ROOM.counterDepth - depth) / 2;
  return (ROOM.counterDepth - depth) / 2 + ft(0.5);
}
