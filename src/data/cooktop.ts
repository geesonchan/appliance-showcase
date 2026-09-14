/**
 * What goes on under an induction cooktop set into a counter.
 *
 * From Thermador's installation guide for CIT367YG, which is
 * `docs/reference/CIT367YG_Installation.pdf`. See docs/decisions.md D20,
 * rounds 47-49.
 */
export const COOKTOP_CABINET = {
  /**
   * The top of the drawer under it, below the counter's surface: at least
   * 3-3/4" (95 mm). Page 7, stated. Page 8's diagram adds up to 4-3/4"; the
   * stated figure is the one drawn, and the inch between them is a known
   * ambiguity. On site Leo leaves 4-3/4" (site practice, not the guide).
   */
  drawerTopBelowCounterIn: 3.75,
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
