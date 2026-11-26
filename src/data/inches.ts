import { inches } from "./inchText";

/**
 * A length the way it is said to a customer in a sentence: 178-3/4″.
 *
 * It was 178¾″, to the nearest eighth, until item 12e-3; D25 writes every
 * figure one way (Leo, 2026-11-24: 「2026-11-13 那条"数字用分数（224¼″）"由新规矩取代，换套餐
 * 提示写成 224-1/4″。」), so this asks the one place a figure is written.
 */
export function inchesSpoken(value: number): string {
  return inches(value);
}
