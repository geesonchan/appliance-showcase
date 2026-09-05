import type { SlotId } from "../types";

/**
 * Pin labels live in a DOM overlay next to the canvas, but their positions are
 * computed inside the render loop. The overlay registers its elements here and
 * the projector writes transforms straight onto them, so following the camera
 * costs no React renders.
 */
export const pinElements = new Map<SlotId, HTMLElement>();

export function registerPin(slot: SlotId, el: HTMLElement | null) {
  if (el) pinElements.set(slot, el);
  else pinElements.delete(slot);
}
