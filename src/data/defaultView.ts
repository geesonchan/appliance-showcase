import type { LayoutShape } from "./layoutShape";

/**
 * The angle the room is first seen from, and gone back to by "reset view".
 *
 * The L and one wall from front right, 45° round and 35° down (§10, the
 * isometric default since the first commit). The U from straight in front, 50°
 * down (Leo, 2026-11-12: 「U 的默认视角定：正前方，往下 50°」), by his rule that the
 * default view shows every machine's label, seen and clickable, and a machine's
 * front is seen by flying to it. Of the 48 ways he had counted (0° to 45° left,
 * 25° to 45° down, with and without the backs' boards) none kept every label in
 * all five packages — turned left, the left leg's machines face away — and only
 * straight in front at 50° to 60° did (`docs/plans/u-view-2026-11-12/`).
 * `tests/uLabels.test.ts` holds it there. It was 45° to the left and 25° down
 * the night before (his first pick), straight in front at 45° down before that
 * (U-2).
 *
 * Only the default: switching the shape leaves the camera where it is (D1).
 */
export function defaultView(shape: LayoutShape): { azimuthDeg: number; pitchDeg: number } {
  return shape === "U" ? { azimuthDeg: 0, pitchDeg: 50 } : { azimuthDeg: 45, pitchDeg: 35 };
}
