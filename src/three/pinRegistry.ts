import type { SlotId } from "../types";

/**
 * A pin is three elements: the dot that marks the appliance, the label set
 * aside from it, and the hairline joining the two.
 *
 * They live in a DOM overlay next to the canvas, but their positions are
 * computed inside the render loop. The overlay registers its elements here and
 * the projector writes transforms straight onto them, so following the camera
 * costs no React renders.
 */
export interface PinElements {
  dot: HTMLElement | null;
  label: HTMLElement | null;
  leader: SVGLineElement | null;
}

export const pinElements = new Map<SlotId, PinElements>();

function slotFor(slot: SlotId): PinElements {
  const existing = pinElements.get(slot);
  if (existing) return existing;
  const created: PinElements = { dot: null, label: null, leader: null };
  pinElements.set(slot, created);
  return created;
}

export function registerPinPart(
  slot: SlotId,
  part: keyof PinElements,
  el: PinElements[keyof PinElements],
) {
  const entry = slotFor(slot);
  // @ts-expect-error the key and the value are chosen together by the caller
  entry[part] = el;
  if (!entry.dot && !entry.label && !entry.leader) pinElements.delete(slot);
}
