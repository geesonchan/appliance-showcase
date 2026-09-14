import { ft } from "./room";
import { sizeOnPlan } from "./frame";
import type { Slot } from "../types";

/**
 * How big a machine is on the plan thumbnail, as its extent along x (`w`) and
 * along z (`h`), in feet: its width across its face and its depth out of it,
 * turned the way it faces.
 *
 * Round 50 (D22 step 2). This used to swap width and depth for any turn at all,
 * so an island machine facing the back run — turned half round, not a quarter —
 * was drawn sideways. Every island opening in A, C and D is square, which is why
 * nobody saw it; the cooktop's 36" by 24" shows it.
 */
export function planFootprint(slot: Pick<Slot, "rotationY" | "cutout">): { w: number; h: number } {
  const [w, h] = sizeOnPlan(slot.rotationY, ft(slot.cutout.w), ft(slot.cutout.d));
  return { w, h };
}
