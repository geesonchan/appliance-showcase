import { lookupRal, ralForHex } from "../data/ral";
import type { WallFinish } from "../three/materials";

/**
 * The finishes a room is shown in, and the names they go by in a link.
 *
 * Moved here from useAppStore.ts in round 94, so that the share link and the
 * older screenshot parameters (`?cabinet=navy&counter=marble`) read a colour's
 * name in one place: a swatch's name, a RAL number, and the names of chips
 * that have since been replaced. docs/decisions.md D23.
 */

export type AccentRun = "none" | "left" | "back" | "island";
export type CounterFinish = "quartz-white" | "marble-veined" | "wood-oak";
export type FloorFinish = "floor-oak" | "floor-tile";
/** Large-format panel sizes, long side first along the room. Round 33. */
export type TileSize = "24x48" | "32x32" | "48x48";
export const TILE_SIZES: TileSize[] = ["24x48", "32x32", "48x48"];
export const WALL_FINISHES: WallFinish[] = ["warm-grey", "mid-grey", "taupe", "white"];
export const ACCENT_RUNS: AccentRun[] = ["none", "left", "back", "island"];

/** RAL 5015's value, read from the RAL table rather than written again here. */
const RAL_5015 = (() => {
  const found = lookupRal("RAL 5015");
  if (!found.ok) throw new Error("data/ral.json has no RAL 5015, the doors' default");
  return found.colour.hex;
})();

/**
 * The cabinet colours, which are paint chips rather than data.
 *
 * The first is the doors every package opens with. RAL 5015, sky blue, since
 * round 92a (Leo): it replaced Scheme 01's forest green, #2E5C45, as the first
 * chip and the default. Only the doors: the interface's own green — buttons,
 * what is selected — is `--accent`, and stays.
 */
export const CABINET_COLORS = [
  { key: "finish.cabinet.skyBlue", value: RAL_5015, token: "painted" as const },
  { key: "finish.cabinet.navy", value: "#2B3A4A", token: "painted" as const },
  // Burgundy, round 35, Leo: a deep, cool wine red of the kind phones are sold
  // in, never orange. It was clay, then walnut; wood is the oak swatch's and
  // any RAL number's to cover now.
  { key: "finish.cabinet.burgundy", value: "#6E2639", token: "painted" as const },
  { key: "finish.cabinet.bone", value: "#E3DFD3", token: "painted" as const },
  // Not a colour: a door made of something. Its swatch shows the wood rather
  // than a flat brown, which is the whole difference between the two. The
  // swatch is the wood's own mid tone, round 33.
  { key: "finish.cabinet.oak", value: "#8B6B47", token: "wood-oak" as const },
] as const;

/**
 * The second palette, for the run that is doing something different.
 *
 * A different five, because an accent that is one of the five you just chose
 * from is not an accent — it is the same kitchen with a mistake in it. These
 * are the colours a designer reaches for beside a painted run: the wood, a
 * near-black, a deep clay, an off-white and a slate.
 */
export const ACCENT_COLORS = [
  { key: "finish.accent.oak", value: "#8B6B47", token: "wood-oak" as const },
  { key: "finish.accent.ink", value: "#23282B", token: "painted" as const },
  { key: "finish.accent.brick", value: "#8A4A38", token: "painted" as const },
  { key: "finish.accent.cream", value: "#EFE8D8", token: "painted" as const },
  { key: "finish.accent.slate", value: "#6B7375", token: "painted" as const },
] as const;

export type Palette = typeof CABINET_COLORS | typeof ACCENT_COLORS;

/** The countertops and floors by the short name a link uses. */
export const COUNTER_NAMES: Record<string, CounterFinish> = {
  quartz: "quartz-white",
  marble: "marble-veined",
  oak: "wood-oak",
};
export const FLOOR_NAMES: Record<string, FloorFinish> = { oak: "floor-oak", tile: "floor-tile" };

/**
 * A door colour from its name in a link: a swatch's name, or a RAL number.
 *
 * The third cabinet swatch was clay, then walnut, and is burgundy since round
 * 35; the first was green until round 92a and is sky blue. A link from before
 * still opens on the swatch in that place. Undefined for a name it does not
 * know.
 */
export function paintFromName(palette: Palette, asked: string | null): string | undefined {
  if (!asked) return undefined;
  const name =
    asked === "clay" || asked === "walnut" ? "burgundy" : asked === "green" ? "skyBlue" : asked;
  const ral = lookupRal(name);
  if (ral.ok) return ral.colour.hex;
  return palette.find((paint) => paint.key.endsWith(`.${name}`))?.value;
}

/**
 * A door colour's name in a link: its RAL number where it is one, else its
 * swatch. Every colour a door can be is one or the other, so this always has
 * an answer; the round trip through `paintFromName` is held by shareLink.test.ts.
 */
export function nameOfPaint(palette: Palette, value: string): string {
  const ral = ralForHex(value);
  if (ral) return ral.code.replace(/^RAL /, "ral");
  const swatch = palette.find((paint) => paint.value.toLowerCase() === value.toLowerCase());
  if (!swatch) throw new Error(`a door colour that is neither a RAL code nor a swatch: ${value}`);
  return swatch.key.split(".").pop()!;
}

/** The short name of a value in one of the maps above. */
export const nameIn = <T extends string>(names: Record<string, T>, value: T): string =>
  Object.entries(names).find(([, v]) => v === value)![0];

/** A tile size as its control labels it: figures, the same in both languages. */
export const TILE_LABEL: Record<TileSize, string> = {
  "24x48": "24″ × 48″",
  "32x32": "32″ × 32″",
  "48x48": "48″ × 48″",
};

/**
 * The finishes the room is shown in. Not part of the package and not on the
 * quote: a customer choosing between four greens is choosing how to look at
 * the kitchen, not what to buy. See docs/decisions.md D12.
 */
export interface Finishes {
  cabinet: string;
  /** The second colour, worn by one whole run. See docs/decisions.md D15. */
  accent: string;
  /** Which run wears it, or none — which is the default. */
  accentRun: AccentRun;
  counter: CounterFinish;
  floor: FloorFinish;
  /** The panel size of a tile floor. Kept when the floor is oak, for coming back. */
  tileSize: TileSize;
  /** The walls' paint. Warm grey unless somebody asks otherwise. Round 35. */
  wall: WallFinish;
}
