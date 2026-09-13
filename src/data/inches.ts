/**
 * A length the way it is said to a customer: 178¾″, not 178.75" or 178-3/4".
 *
 * To the nearest eighth, which is what a cabinetmaker marks. The dimension
 * figures on the drawing keep their builder's form (`formatDimension`); this is
 * for sentences.
 */
const EIGHTHS = ["", "⅛", "¼", "⅜", "½", "⅝", "¾", "⅞"];

export function inchesSpoken(value: number): string {
  const eighths = Math.round(value * 8);
  const whole = Math.floor(eighths / 8);
  return `${whole}${EIGHTHS[eighths - whole * 8]}″`;
}
