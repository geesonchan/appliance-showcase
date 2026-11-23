import * as THREE from "three";
import { ROOM } from "../data/slots";

/**
 * Framing the whole room: the one place that works out how close the camera
 * stands and where it looks so the room fits a part of the scene.
 *
 * The reset view is the room framed in the whole canvas. After another model
 * is chosen for the machine on screen, it is the room framed in the part of
 * the canvas the card leaves free (D1's sixth reason; item 12e-2, Leo,
 * 2026-11-20: 「换型号以后的镜头选 bingjia3」). Both go through `frameRoom`, so
 * there is no second copy of the fit to drift from the first (Leo, 2026-11-20:
 * 「cardFraming.ts 和现有的"重置视角"必须走同一段"把厨房放进画面"的算法，不能有第二份」).
 *
 * Pure: boxes in, numbers out, no page. `cardFraming.test.ts` holds it.
 */

/** Centre of the room's bounding box, which is what the default view frames. */
export const DEFAULT_TARGET = new THREE.Vector3(0, 4.5, 0);

/** A camera offset at a given azimuth and pitch, in radians. */
export const isoOffset = (distance: number, azimuth: number, pitch: number) =>
  new THREE.Vector3(
    Math.cos(pitch) * Math.sin(azimuth),
    Math.sin(pitch),
    Math.cos(pitch) * Math.cos(azimuth),
  ).multiplyScalar(distance);

/**
 * How much of the world the default view has to keep in frame, in feet.
 *
 * Derived from the room rather than measured off a screenshot. The old
 * constants were fitted to a version of this room whose front-left corner
 * happened to be empty floor, and the moment the refrigerator tower moved to
 * the end of the left run they cropped it. An orthographic view of a box has a
 * closed-form extent along any axis, so there is no reason to guess.
 */
export function fitExtents(azimuth: number, pitch: number) {
  const half = new THREE.Vector3(ROOM.halfX, ROOM.wallHeight / 2, ROOM.halfZ);
  const { right, up } = screenAxes(azimuth, pitch);
  const extent = (axis: THREE.Vector3) =>
    2 * (half.x * Math.abs(axis.x) + half.y * Math.abs(axis.y) + half.z * Math.abs(axis.z));
  // A little air, for the floating mode switch and the toolbar.
  return { w: extent(right) * 1.06, h: extent(up) * 1.06 };
}

/** The screen's right and up, in the world, for a camera at this angle. */
function screenAxes(azimuth: number, pitch: number) {
  const forward = isoOffset(1, azimuth, pitch).negate();
  const right = forward.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
  const up = right.clone().cross(forward).normalize();
  return { right, up };
}

/** A box on the screen, in CSS pixels. */
export interface ScreenBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The part of the canvas the card leaves free: right of it on a desktop, where
 * it stands at the scene's left; above it on a phone and up to 767 pixels
 * wide, where it comes up from the bottom. No card — none open, or not on the
 * page — leaves the whole canvas, which is the reset view's.
 */
export function freePart(canvas: ScreenBox, card: ScreenBox | null, cardAt: "left" | "bottom"): ScreenBox {
  if (!card || card.width <= 0 || card.height <= 0) return canvas;
  const right = canvas.left + canvas.width;
  const bottom = canvas.top + canvas.height;
  const part =
    cardAt === "left"
      ? { left: Math.max(canvas.left, card.left + card.width), top: canvas.top, right, bottom }
      : { left: canvas.left, top: canvas.top, right, bottom: Math.min(bottom, card.top) };
  const width = part.right - part.left;
  const height = part.bottom - part.top;
  // A card over (nearly) the whole canvas leaves nothing to frame in.
  if (width < 1 || height < 1) return canvas;
  return { left: part.left, top: part.top, width, height };
}

/**
 * The zoom that fits the whole room, seen at this angle, in `part` of the
 * canvas, and the point to look at so the room's centre stands at the part's
 * centre. With `part` the whole canvas this is the reset view: the zoom
 * `CameraRig` calls `fitZoom` and `DEFAULT_TARGET`.
 *
 * Orthographic, as the scene's camera is: one world foot is `zoom` pixels
 * everywhere on the screen, so a shift on the screen is a shift of the target
 * by the same amount over the zoom, along the screen's own right and up.
 */
export function frameRoom(
  canvas: ScreenBox,
  part: ScreenBox,
  azimuth: number,
  pitch: number,
): { zoom: number; target: THREE.Vector3 } {
  const fit = fitExtents(azimuth, pitch);
  const zoom = Math.min(part.width / fit.w, part.height / fit.h);
  // Where the part's centre is from the canvas's: right and down, in pixels.
  const dx = part.left + part.width / 2 - (canvas.left + canvas.width / 2);
  const dy = part.top + part.height / 2 - (canvas.top + canvas.height / 2);
  const { right, up } = screenAxes(azimuth, pitch);
  // Looking further left puts the room further right, and looking further up
  // puts it lower.
  const target = DEFAULT_TARGET.clone()
    .addScaledVector(right, -dx / zoom)
    .addScaledVector(up, dy / zoom);
  return { zoom, target };
}
