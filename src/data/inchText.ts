/**
 * The one place an inch figure is written (D25, item 12e-3). Everything on the
 * page that shows a length in inches asks this file: the three formatters that
 * were (`formatDimension`, `formatInches`, `inchesSpoken`), the slider's
 * readout, the dictionary's placeholders, the room's size. `inchMarks.test.ts`
 * fails on a mark written anywhere else in `src/`.
 *
 * How a figure is written is D25's, in Leo's words; the one thing here that is
 * a method rather than his rule is the rounding: the nearest sixteenth, a figure
 * exactly between two going up (Leo, 2026-11-24: 「咖啡机每侧填板 27/32，往上写 7/8″。」
 * — the only figure on the page today that is not a whole sixteenth). A new one
 * in the data is to be put to him, not rounded quietly.
 */
export const INCH_MARK = "″";
export const FOOT_MARK = "′";
const STEP = 16;

/** The figure without its mark: 3-1/2, 30, 3/4. Reduced, a sixteenth at the finest, no 0 under an inch. */
export function inchFigure(value: number): string {
  const sign = value < 0 ? "-" : "";
  const size = Math.abs(value);
  let whole = Math.floor(size + 1e-6);
  let parts = Math.round((size - whole) * STEP);
  if (parts === STEP) {
    whole += 1;
    parts = 0;
  }
  if (parts === 0) return `${sign}${whole}`;
  let numerator = parts;
  let denominator = STEP;
  while (numerator % 2 === 0) {
    numerator /= 2;
    denominator /= 2;
  }
  return whole === 0 ? `${sign}${numerator}/${denominator}` : `${sign}${whole}-${numerator}/${denominator}`;
}

/** The figure with its mark: 3-1/2″. */
export const inches = (value: number): string => `${inchFigure(value)}${INCH_MARK}`;

/**
 * A size the data writes as text with its own straight mark — the gas pipe's
 * `3/4"` — shown with ″. The data and its type stay as they are (Leo,
 * 2026-11-24: 「燃气管径在显示的时候换成 ″，数据和类型不动。」).
 */
export function inchText(written: string): string {
  return /^\d[\d/ -]*"$/.test(written) ? `${written.slice(0, -1)}${INCH_MARK}` : written;
}

/**
 * A room's size in feet and inches, 16′10″, to the nearest inch: the same in
 * Chinese and English (Leo, 2026-11-24: 「中文页面左侧的房间大小照旧写 16′10″。」 — "英尺" is
 * kept in Chinese sentences, and this is a figure, not a sentence).
 */
export function feetAndInches(feet: number): string {
  const total = Math.round(feet * 12);
  const whole = Math.floor(total / 12);
  const rest = total - whole * 12;
  return rest === 0 ? `${whole}${FOOT_MARK}` : `${whole}${FOOT_MARK}${rest}${INCH_MARK}`;
}

/**
 * What a sentence puts in for `{name}`: a number standing right before ″ is a
 * figure; a size the data writes as text gets ″; anything else as it is.
 */
export function sentenceValue(value: string | number, beforeMark: boolean): string {
  if (typeof value === "number") return beforeMark ? inchFigure(value) : String(value);
  return inchText(value);
}
