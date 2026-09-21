import { onAxis } from "./frame";
import { islandAcross, islandAlong, type IslandLayout } from "./layoutTemplate";
import { ROOM, ft } from "./roomShell";

/**
 * A seating overhang past what a stone top carries on its own. D20, round 68.
 *
 * **Sources, which are two different kinds.**
 * - That 3cm quartz carries about 10"-12" unsupported: secondary trade
 *   experience, recorded in D20. Not a fabricator's or a stone maker's figure.
 *   The lower end is taken, so a 12" overhang already asks — at 10-12 the
 *   figure itself is the question, and the list is where a question goes.
 * - That the support is **concealed steel plate** under the top, not an
 *   exposed bracket: Leo's site practice, round 68.
 *
 * Package E's 15" is the only overhang any package has, and it is past both
 * ends of that range.
 */
export const OVERHANG_SUPPORT = {
  /** Past this, in inches, the top needs support. */
  unsupportedMaxIn: 10,
  /** Leo's site practice: plates under the stone, out of sight. */
  kind: "concealed-steel-plate" as const,
};

/** Whether an overhang of this many inches needs its top supported. */
export const needsOverhangSupport = (overhangIn: number) =>
  overhangIn > OVERHANG_SUPPORT.unsupportedMaxIn + 1e-6;

/**
 * The part of the island's top that stands past its cabinets on the seating
 * side and has to be carried: the whole length of the top, from the cabinets'
 * seating face out to the counter's edge, on the underside of the stone.
 *
 * Measured the same way the top itself is (`counter.ts`, `cabinets.ts`): the
 * 1" lap at each end, and the overhang on the seating side. Which side that is
 * comes from the island's own `seating` face, not from which coordinate is
 * larger — the top's own code assumes the larger one, which holds for both
 * ways an island can stand today.
 *
 * The plates themselves are not drawn: how many, how wide and how far under
 * the cabinets they run has no source here. What is drawn is where support is
 * needed, which the rule does know.
 */
export function overhangSupportZone(island: IslandLayout): {
  corners: [number, number, number][];
  overhangIn: number;
} | null {
  if (!island.present || !needsOverhangSupport(island.overhangIn)) return null;
  const along = islandAlong(island);
  const across = islandAcross(island);
  const lap = ROOM.counterOverhang;
  const outward = island.seating >= island.working ? 1 : -1;
  const face = outward > 0 ? across[1] : across[0];
  const edge = face + outward * ft(island.overhangIn);
  const y = ROOM.counterHeight - ROOM.counterThickness;
  const [a0, a1] = [along[0] - lap, along[1] + lap];
  return {
    corners: [
      onAxis(island.axis, a0, face, y),
      onAxis(island.axis, a1, face, y),
      onAxis(island.axis, a1, edge, y),
      onAxis(island.axis, a0, edge, y),
    ],
    overhangIn: island.overhangIn,
  };
}
