/** A pin label's screen-space box, as the projector computes it each frame. */
export interface PinBox {
  x: number;
  y: number;
  w: number;
  h: number;
  hidden: boolean;
}

/**
 * Push overlapping pin labels apart, lowest priority first.
 *
 * Priority is the array order, which is the pin numbering: 01 keeps its anchor
 * and higher numbers move. A pin only ever moves along Y — the anchor's X is
 * what tells you which appliance it is about, and sliding it sideways would
 * point it at the neighbour.
 *
 * Mutates the boxes in place: this runs inside the render loop and must not
 * allocate.
 */
export function spreadPins(boxes: PinBox[], gap: number): void {
  for (let i = 1; i < boxes.length; i += 1) {
    const box = boxes[i];
    if (box.hidden) continue;
    // Moving clear of one neighbour can push a pin into another, so re-check.
    // It settles in one or two passes with six pins.
    for (let pass = 0; pass < 3; pass += 1) {
      let moved = false;
      for (let j = 0; j < i; j += 1) {
        const other = boxes[j];
        if (other.hidden) continue;
        const minX = (box.w + other.w) / 2 + gap;
        const minY = (box.h + other.h) / 2 + gap;
        const dx = box.x - other.x;
        const dy = box.y - other.y;
        if (Math.abs(dx) >= minX || Math.abs(dy) >= minY) continue;
        // Carry on the way it was already leaning, and upward on a tie.
        box.y = other.y + (dy <= 0 ? -minY : minY);
        moved = true;
      }
      if (!moved) break;
    }
  }
}
