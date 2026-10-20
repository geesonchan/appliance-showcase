import { inchesSpoken } from "./inches";
import { LAYOUT_SHAPES } from "./layoutShape";
import { PARAM_LIMITS, type LayoutParams } from "./layoutTemplate";

/**
 * Every layout setting a page's address carries, by its name there: one table,
 * read by a share link (src/store/shareLink.ts, D23) and by the screenshot
 * parameters (`paramsFromQuery`, room.ts) alike.
 *
 * Round 98a, Leo: "截图参数和链接字段表在 98a 里合成一份（D17 表第 18 行的
 * 'Join them then'），形状只在字段表里写一处". Until then room.ts read eight of
 * these names its own way and the link's table read fifteen: D17's table, the
 * eighteenth row, open and deliberate since round 94 "the day one is changed
 * and not the other — a new layout parameter given a name in one". The shape is
 * that parameter. Here, out of the store, because the room is built at load and
 * reads this before any store exists.
 */

/** How a message is said in the page's language: `sayWith` over `t`. */
export type Say = (key: string, vars?: Record<string, string | number>) => string;

/**
 * One setting in a link.
 *
 * `read` gives undefined for a value it cannot take, which the page reports
 * as a setting it could not use rather than guessing at.
 */
export interface Field<V> {
  /** Its name in the link. */
  name: string;
  /** What it is called on screen, for a line saying it could not be used. */
  labelKey: string;
  /** The page's own names for what it carries, for the completeness test. */
  carries: string[];
  write: (value: V) => string;
  read: (raw: string) => V | undefined;
  /** The value as a customer reads it. */
  show: (value: V, say: Say) => string;
}

export interface LayoutField<V> extends Field<V> {
  get: (params: LayoutParams) => V;
  put: (value: V) => Partial<LayoutParams>;
  /**
   * The link version that first carried it, where that is later than the first
   * (round 98a). A link older than that has no such field and was written when
   * the page had only one value for it, `before`: it is read as that, and
   * nothing is said, because nothing in the link was left out.
   */
  since?: { version: number; before: V };
  /**
   * Older names a screenshot address may still use for it, read and never
   * written: `?fridge=back` and `?sink=left` from before round 98a, when
   * room.ts had names of its own.
   */
  aliases?: string[];
  /** For a choice, the values it takes, said back when one is not among them. */
  allowed?: string[];
}

/**
 * A length or a height, in inches, within the slider's ends. Written as the
 * number itself, so 224-1/4" is `224.25` and the round trip is exact.
 */
function inches(
  name: string,
  key: keyof typeof PARAM_LIMITS & keyof LayoutParams,
  labelKey: string,
): LayoutField<number> {
  const limits = PARAM_LIMITS[key];
  return {
    name,
    labelKey,
    carries: [`layoutParams.${key}`],
    get: (params) => params[key] as number,
    put: (value) => ({ [key]: value }),
    write: (value) => String(value),
    read: (raw) => {
      if (!/^\d+(\.\d+)?$/.test(raw)) return undefined;
      const value = Number(raw);
      return value >= limits.min && value <= limits.max ? value : undefined;
    },
    show: (value) => inchesSpoken(value),
  };
}

/** One of a few named values, each with the label its control shows. */
function choice<K extends keyof LayoutParams>(
  name: string,
  key: K,
  labelKey: string,
  options: Record<string, string>,
  more: Pick<LayoutField<LayoutParams[K]>, "since" | "aliases"> = {},
): LayoutField<LayoutParams[K]> {
  return {
    name,
    labelKey,
    carries: [`layoutParams.${key}`],
    get: (params) => params[key],
    put: (value) => ({ [key]: value }) as Partial<LayoutParams>,
    write: (value) => String(value),
    read: (raw) => (raw in options ? (raw as LayoutParams[K]) : undefined),
    show: (value, say) => say(options[String(value)]),
    allowed: Object.keys(options),
    ...more,
  };
}

const LEGS = { left: "panel.layout.leg.left", back: "panel.layout.leg.back" };

/**
 * The island, which is a length or none at all — the names the screenshot
 * parameters already use (`?island=96`, `?island=none`). An island switched
 * off keeps no length in the link: the page shows none, whatever length it
 * would come back at.
 */
const island: LayoutField<number | "none"> = {
  name: "island",
  labelKey: "panel.layout.island",
  carries: ["layoutParams.hasIsland", "layoutParams.islandLengthIn"],
  get: (params) => (params.hasIsland ? params.islandLengthIn : "none"),
  put: (value) => (value === "none" ? { hasIsland: false } : { hasIsland: true, islandLengthIn: value }),
  write: (value) => String(value),
  read: (raw) => (raw === "none" ? "none" : inches("island", "islandLengthIn", "").read(raw)),
  show: (value, say) => (value === "none" ? say("share.value.noIsland") : inchesSpoken(value)),
};

/**
 * The layout's shape (round 98a). The only value is the L until 98b; a link
 * from before round 98a has no shape and was an L (Leo: "v=1 旧链接一律当 L 型打
 * 开，不提示").
 */
const shape = choice(
  "shape",
  "shape",
  "panel.layout.shape",
  Object.fromEntries(LAYOUT_SHAPES.map((value) => [value, `panel.layout.shape.${value}`])),
  { since: { version: 2, before: "L" } },
);

/**
 * A field of any value. Each field's own type is held where it is made; the
 * lists hold them side by side, and a value read by a field only ever goes
 * back into that same field.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyValue = any;

/** The layout, in the order the Configuration panel shows it. */
export const LAYOUT_FIELDS: LayoutField<AnyValue>[] = [
  shape,
  inches("back", "backWallIn", "panel.room.backWall"),
  inches("left", "leftWallIn", "panel.room.leftWall"),
  choice("corner", "cornerType", "panel.room.corner", {
    blind: "panel.room.corner.blind",
    "lazy-susan": "panel.room.corner.lazySusan",
  }),
  choice("fridgeLeg", "fridgeEnd", "panel.layout.fridge", LEGS, { aliases: ["fridge"] }),
  choice("fridgeAbuts", "fridgeEndAbuts", "panel.layout.fridgeAbuts", {
    cabinet: "panel.layout.abuts.cabinet",
    wall: "panel.layout.abuts.wall",
  }),
  choice("sinkLeg", "sinkLeg", "panel.layout.sink", LEGS, { aliases: ["sink"] }),
  choice("towerSide", "towerSide", "panel.layout.tower", {
    left: "panel.layout.tower.left",
    right: "panel.layout.tower.right",
  }),
  choice("housing", "housingStyle", "panel.layout.housing", {
    box: "panel.layout.housing.box",
    sweep: "panel.layout.housing.sweep",
  }),
  choice("coffeeLeg", "coffeeLeg", "panel.layout.coffee", LEGS),
  inches("coffeeSill", "coffeeSillIn", "panel.layout.coffeeSill"),
  inches("handle", "microwaveHandleIn", "panel.layout.microwaveHandle"),
  island,
  choice("islandTurn", "islandOrientation", "panel.layout.islandOrientation", {
    parallel: "panel.layout.island.parallel",
    perpendicular: "panel.layout.island.perpendicular",
  }),
  inches("islandDepth", "islandDepthIn", "panel.layout.islandDepth"),
  inches("aisle", "aisleIn", "panel.layout.aisle"),
];
