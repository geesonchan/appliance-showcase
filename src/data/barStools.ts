import { faceRotation } from "./frame";
import { islandAcross, islandAlong, islandPoint, type IslandLayout } from "./layoutTemplate";
import { ft } from "./roomShell";

/**
 * Bar stools along an island's seating overhang. Round 77, Leo.
 *
 * **Why they are drawn.** Package E's top reaches 15" past its cabinets on the
 * seating side (D20). Seen on a phone with nothing at it, that reads as a top
 * the cabinets fail to carry — a drawing mistake — because nothing says people
 * sit there. The stools say it. They are furnishing, not product: nothing about
 * them reaches the quote, the checklist or a label, they take no clicks, and
 * the install view does not draw them.
 *
 * **When.** Wherever the island has a seating overhang at all
 * (`overhangIn > 0`), whichever package asks for one; A to D have none today.
 *
 * **Sources.**
 * - 24" of counter per seat: general trade dimension (D20 used it for "seats
 *   three at 24" each"). Counted on the cabinets' length, `islandLengthIn`,
 *   not the top's.
 * - A counter-height stool's seat is 24"-26" off the floor: general trade
 *   dimension, not any model's manual. 24" is taken, the lower end, which
 *   leaves 10-1/2" under a 34-1/2" counter underside.
 * - The 5" tuck, the 1" clearance, the seat's size, the legs and the footrest
 *   are display figures with no outside source, chosen so a stool reads as one
 *   at phone scale.
 */
export const BAR_STOOL = {
  /** Counter length each seat takes, in inches. General trade dimension. */
  perSeatIn: 24,
  /** Floor to the top of the seat, in inches. General trade dimension. */
  seatHeightIn: 24,
  seatDiameterIn: 16,
  seatThicknessIn: 1.5,
  /** How far inside the top's edge the seat's centre stands, in inches. Display figure, no outside source. */
  tuckIn: 5,
  /** Clearance kept between the seat and the cabinets' face, in inches. Display figure, no outside source. */
  clearOfCabinetsIn: 1,
};

export interface BarStool {
  /** The centre of the stool on the floor, in room coordinates (feet). */
  position: [number, number, number];
  /** Turned to face the island. */
  rotationY: number;
}

/** How many seats an island of this many inches takes: whole seats only. */
export const seatsFor = (lengthIn: number) => Math.floor(lengthIn / BAR_STOOL.perSeatIn + 1e-9);

/**
 * The stools at an island's seating side: one per 24" of island, spaced evenly
 * along it, each pushed partly under the overhang. Worked in the island's own
 * terms — along and across — and turned through `frame.ts`, so an island laid
 * across the room takes them with it.
 */
export function barStools(island: IslandLayout): BarStool[] {
  if (!island.present || !(island.overhangIn > 0)) return [];
  const along = islandAlong(island);
  const across = islandAcross(island);
  const count = seatsFor((along[1] - along[0]) * 12);
  if (count === 0) return [];

  // Which way is out of the seating face comes from the island's own record.
  const outward: -1 | 1 = island.seating >= island.working ? 1 : -1;
  const face = outward > 0 ? across[1] : across[0];
  const radiusIn = BAR_STOOL.seatDiameterIn / 2;
  const outIn = Math.max(
    island.overhangIn - BAR_STOOL.tuckIn,
    radiusIn + BAR_STOOL.clearOfCabinetsIn,
  );
  const acrossAt = face + outward * ft(outIn);
  const pitch = (along[1] - along[0]) / count;
  // Facing the island: the seating face looks out along `outward`, so a stool
  // looks back the other way.
  const rotationY = faceRotation(island.axis, outward === 1 ? -1 : 1);

  return Array.from({ length: count }, (_, i) => ({
    position: islandPoint(island, along[0] + pitch * (i + 0.5), acrossAt, 0),
    rotationY,
  }));
}
