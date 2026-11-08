/**
 * What goes on under an induction cooktop set into a counter.
 *
 * From Thermador's installation guide for CIT367YG, which is
 * `docs/reference/CIT367YG_Installation.pdf`. See docs/decisions.md D20,
 * rounds 47-49.
 */
export const COOKTOP_CABINET = {
  /**
   * Nothing inside the cabinet under it within this far of the counter's
   * surface: no shelf, no drawer, no other box. At most 2-3/4" of body, the 1"
   * fitting under it and 1" clear under that (the guide's figure on page 9),
   * and what Leo leaves on site (D20). Leo, 2026-11-08: it was 3-3/4" to the
   * top of a drawer (page 7), which went with the drawer; this is what it
   * guarded. Held by underCooktopClear.test.ts; nothing in the room is drawn
   * from it.
   */
  clearBelowCounterIn: 4.75,
  /** At the back of the cabinet, at least 13/16" (20 mm). Page 7, stated. */
  rearGapIn: 13 / 16,
} as const;

export const COOKTOP_BODY = {
  /** At most 2-3/4" of the cooktop below the counter. Page 8. */
  belowCounterIn: 2.75,
  /**
   * The conduit fitting under that, 1". Page 8. Only its height is the
   * guide's: where under the cooktop it is, is not on the drawing.
   */
  fittingIn: 1,
} as const;
