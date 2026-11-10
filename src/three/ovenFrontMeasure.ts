/**
 * How far forward an oven's front reaches, for the smoke test's "a hung
 * oven's front stands in the plane of the tower's doors" (round 36).
 *
 * Every part counts but two kinds, which are meant to stand proud: a handle,
 * and a knob — a part marked `knob` and nothing else, and only as far as
 * `PROUD_MAX_IN` (Leo, 2026-11-10: 「旋钮的豁免：证明它只认标成旋钮的零件，凸出不超过规格书
 * 上旋钮的尺寸（写页码）」). No sheet or guide prints a knob's size
 * (po302w-spec.pdf, pods302b-spec.pdf, 8001185222_A): what they print that
 * stands furthest off the door is the handle, "Door Handle Depth … 2 5/8" …
 * Protrusion of handle from door skin", page 2 of each sheet. A knob is held
 * to that. The knobs drawn stand 1" (ApplianceModel.tsx, D21: inferred).
 *
 * Pure, so `ovenFrontMeasure.test.ts` can hold it without a browser.
 */
export const PROUD_MAX_IN = 2.625;

export interface FrontPart {
  userData: Record<string, unknown>;
  /** How far forward this part reaches, in inches along the run's axis. */
  frontIn: number;
}

export function ovenFrontIn(parts: FrontPart[], doorIn: number): { frontIn: number; knobsIn: number | null } {
  const knobs = parts.filter((p) => p.userData.knob === true && p.frontIn - doorIn <= PROUD_MAX_IN);
  const counted = parts.filter((p) => !p.userData.handle && !knobs.includes(p));
  return {
    frontIn: Math.max(...counted.map((p) => p.frontIn)),
    knobsIn: knobs.length ? Math.max(...knobs.map((p) => p.frontIn - doorIn)) : null,
  };
}
