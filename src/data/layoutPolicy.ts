import rulesFile from "../../data/rules.json";
import { z } from "zod";
import { parseDataFile } from "./schema";

/**
 * What a run may never be shorter than, and the order it gives ground in.
 *
 * These are policy, not geometry, which is why they are in `data/rules.json`
 * beside the install rules rather than in a constants file: a merchant changes
 * a landing figure, a programmer does not.
 *
 * The point of writing them down is what happened without them. A wall that
 * would not fit used to be made to fit by *deleting* an element — the cabinet
 * after the dishwasher went, and the dishwasher finished hard against the right
 * wall with nothing for its door to swing past, while the refrigerator on the
 * other leg kept its filler for exactly that. Same rule, applied to one machine
 * and not the other. So every element now has a hard minimum, the wall's
 * minimum is their sum, and nothing is ever removed to satisfy it.
 */
const layoutSchema = z.object({
  /**
   * A cooking surface wants landing on both sides and they are not equal: the
   * wider one goes on the side away from the corner, where a pan actually
   * lands, and the corner side takes the narrower.
   */
  rangeLandingIn: z.object({ wideIn: z.number().positive(), narrowIn: z.number().positive() }),
  /** D11 rule 10. The dishwasher may stand in for the wide side. */
  sinkLandingIn: z.object({ wideIn: z.number().positive(), narrowIn: z.number().positive() }),
  dishwasherToSinkIn: z.number().positive(),
  /**
   * What finishes a run, and it is never an appliance.
   *
   * Against a wall it is a scribe: a filler wide enough to give a door
   * somewhere to swing past, which is the whole of the bug this exists to
   * stop. In the open it is a whole cabinet with an end panel closing its
   * carcass off — a construction rather than a figure, which is why it is the
   * word rather than a number. Its minimum is the box's own minimum width and
   * the panel's own thickness; there is no policy figure to set.
   */
  terminalIn: z.object({ atWall: z.number().positive(), open: z.literal("cabinet") }),
  /**
   * Which stretch gives up its slack first as a wall gets shorter, first to
   * last. Surplus is handed out in the reverse of it, so a stretch early in
   * this list never carries more slack than one later in it.
   */
  shrinkOrder: z.array(z.enum(["range-to-sink", "corner-to-range", "landing"])).min(1),
});

/** Only the layout block; the rest of the file is parsed by `rules.ts`. */
const parsed = parseDataFile(
  z.object({ layout: layoutSchema }).passthrough(),
  rulesFile,
  "data/rules.json",
);

export const LAYOUT_POLICY = parsed.layout;

export type ShrinkGroup = (typeof LAYOUT_POLICY.shrinkOrder)[number];

/**
 * How readily a stretch gives up its slack: 0 gives first.
 *
 * Anything the order does not name gives last, which is the safe way round —
 * an unnamed stretch keeps its slack rather than being the first thing squeezed
 * by a rule nobody wrote about it.
 */
export function shrinkRank(group: ShrinkGroup | undefined): number {
  if (!group) return LAYOUT_POLICY.shrinkOrder.length;
  const at = LAYOUT_POLICY.shrinkOrder.indexOf(group);
  return at < 0 ? LAYOUT_POLICY.shrinkOrder.length : at;
}
