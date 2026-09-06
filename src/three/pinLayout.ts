/** A pin label's screen-space box, as the projector computes it each frame. */
export interface PinBox {
  x: number;
  y: number;
  w: number;
  h: number;
  hidden: boolean;
}

/** A rectangle a label must stay out of: an appliance, on screen. */
export interface KeepOut {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Place the labels: off the appliances, off each other, in pin order.
 *
 * The two rules have to be resolved together rather than one after the other.
 * Run separately they fight — pushing a label off a hood drops it onto its
 * neighbour, separating the two puts it back onto the hood — and nudging away
 * from one obstacle at a time can walk a label into a third and back again.
 *
 * So each label is placed in one step, against everything already fixed: the
 * appliances, which never move, and the labels before it in pin order, which
 * are already placed. Collect the bands of Y those obstacles forbid at this
 * label's X, then take the nearest free position. 01 keeps its anchor and
 * higher numbers give way, which is the priority the numbering already implies.
 *
 * A label only ever moves along Y. The anchor's X is what tells you which
 * appliance it belongs to, and sliding it sideways would point it at the
 * neighbour. Upward wins ties, because the room sits low in frame and the wall
 * above it is where the space is.
 *
 * Mutates in place: this runs inside the render loop and must not allocate
 * anything that outlives the call.
 */
export function layoutPins(boxes: PinBox[], areas: KeepOut[], gap: number, height: number): void {
  for (let i = 0; i < boxes.length; i += 1) {
    const box = boxes[i];
    if (box.hidden) continue;

    // Every band of Y this label may not occupy, given where it sits in X.
    const blocked: [number, number][] = [];
    const consider = (other: KeepOut) => {
      if (Math.abs(box.x - other.x) >= (box.w + other.w) / 2 + gap) return;
      const reach = (box.h + other.h) / 2 + gap;
      blocked.push([other.y - reach, other.y + reach]);
    };
    for (const area of areas) consider(area);
    for (let j = 0; j < i; j += 1) {
      if (!boxes[j].hidden) consider(boxes[j]);
    }
    if (blocked.length === 0) continue;

    box.y = nearestFree(box.y, box.h, blocked, height);
  }
}

/**
 * The closest Y to `wanted` that is outside every blocked band.
 *
 * Merges the bands first, because two overlapping obstacles leave no room
 * between them and stepping to the edge of one would land inside the other —
 * which is exactly what nudging away from one obstacle at a time got wrong.
 */
function nearestFree(
  wanted: number,
  boxHeight: number,
  blocked: [number, number][],
  height: number,
): number {
  const bands = blocked.slice().sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const band of bands) {
    const last = merged[merged.length - 1];
    if (last && band[0] <= last[1]) last[1] = Math.max(last[1], band[1]);
    else merged.push([band[0], band[1]]);
  }

  const inside = merged.find(([from, to]) => wanted > from && wanted < to);
  if (!inside) return wanted;

  const above = inside[0];
  const below = inside[1];
  const fits = (y: number) => y - boxHeight / 2 > 0 && y + boxHeight / 2 < height;
  // Try the nearer edge first, then the other, then give up and stay put
  // rather than leaving the canvas.
  const order =
    wanted - above <= below - wanted ? [above, below] : [below, above];
  for (const candidate of order) {
    if (fits(candidate) && !merged.some(([f, t]) => candidate > f && candidate < t)) {
      return candidate;
    }
  }
  return order.find(fits) ?? wanted;
}

/**
 * Keep a label inside the canvas.
 *
 * A label pushed off the edge is worse than one overlapping something: it is
 * simply not there, and the dot it belongs to is left pointing at nothing.
 */
export function clampPins(boxes: PinBox[], width: number, height: number, margin = 4): void {
  for (const box of boxes) {
    if (box.hidden) continue;
    const halfW = box.w / 2 + margin;
    const halfH = box.h / 2 + margin;
    if (width > box.w + margin * 2) {
      box.x = Math.min(Math.max(box.x, halfW), width - halfW);
    }
    if (height > box.h + margin * 2) {
      box.y = Math.min(Math.max(box.y, halfH), height - halfH);
    }
  }
}
