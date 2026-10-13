import { APPLIANCES, APPLIANCE_BY_ID } from "../data/catalogue";
import { inchesSpoken } from "../data/inches";
import { PARAM_LIMITS, type LayoutParams } from "../data/layoutTemplate";
import { LINK_VERSION } from "../data/linkVersion";
import { PACKAGES, PACKAGE_BY_ID } from "../data/packages";
import { SLOT_RECORDS } from "../data/slots";
import type { Appliance, Lang, SlotId } from "../types";
import {
  ACCENT_COLORS,
  ACCENT_RUNS,
  CABINET_COLORS,
  COUNTER_NAMES,
  FLOOR_NAMES,
  TILE_LABEL,
  TILE_SIZES,
  WALL_FINISHES,
  nameIn,
  nameOfPaint,
  paintFromName,
  type Finishes,
  type Palette,
} from "./finishes";

/**
 * A link that rebuilds the same kitchen. Round 94, Leo; docs/decisions.md D23.
 *
 * **One table, read both ways.** Every setting a link carries is a field
 * below, with its name in the link, how it is written, how it is read back,
 * what it is called on screen and how its value is said. The share button
 * writes a link from this table and a page opened from one reads it with the
 * same table, so the two cannot drift (D17: one rule written once).
 * `shareLink.test.ts` holds every setting of the page to being either a field
 * here or on `NOT_IN_LINK`, with its reason.
 *
 * **Written whole** (Leo, round 94, his choice (a)): every field, whether or
 * not it is the package's default, so a link opens on the kitchen as it was
 * shared even after a package's default has changed. Measured (D23): 478-556
 * characters for the five packages as they open, 562 at the longest. No
 * price and nothing about the customer is in it: the fields
 * below are all there is.
 *
 * What a link may not be used for — whether a model it names still goes in
 * its opening, and what is shown instead — is not this file's: openLink.ts
 * asks the page's own checks.
 */

/** The kitchen as a link carries it: what the page is built from. */
export interface Kitchen {
  packageId: string;
  lang: Lang;
  layoutParams: LayoutParams;
  selection: Partial<Record<SlotId, string>>;
  blowerId: string | null;
  finishes: Finishes;
}

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
}

export interface FinishField<V> extends Field<V> {
  get: (finishes: Finishes) => V;
  put: (value: V) => Partial<Finishes>;
}

// ---------------------------------------------------------------- codecs ---

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
 * A field of any value. Each field's own type is held where it is made; the
 * lists hold them side by side, and a value read by a field only ever goes
 * back into that same field.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyValue = any;

/** The layout, in the order the Configuration panel shows it. */
export const LAYOUT_FIELDS: LayoutField<AnyValue>[] = [
  inches("back", "backWallIn", "panel.room.backWall"),
  inches("left", "leftWallIn", "panel.room.leftWall"),
  choice("corner", "cornerType", "panel.room.corner", {
    blind: "panel.room.corner.blind",
    "lazy-susan": "panel.room.corner.lazySusan",
  }),
  choice("fridgeLeg", "fridgeEnd", "panel.layout.fridge", LEGS),
  choice("fridgeAbuts", "fridgeEndAbuts", "panel.layout.fridgeAbuts", {
    cabinet: "panel.layout.abuts.cabinet",
    wall: "panel.layout.abuts.wall",
  }),
  choice("sinkLeg", "sinkLeg", "panel.layout.sink", LEGS),
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

/** A door colour: a RAL number (`ral5015`) or a swatch's name (`navy`). */
function paint(name: string, key: "cabinet" | "accent", palette: Palette, labelKey: string): FinishField<string> {
  return {
    name,
    labelKey,
    carries: [`finishes.${key}`],
    get: (finishes) => finishes[key],
    put: (value) => ({ [key]: value }),
    write: (value) => nameOfPaint(palette, value),
    read: (raw) => paintFromName(palette, raw),
    show: (value, say) => {
      const written = nameOfPaint(palette, value);
      if (written.startsWith("ral")) return `RAL ${written.slice(3)}`;
      const swatch = palette.find((entry) => entry.value === value);
      return swatch ? say(swatch.key) : written;
    },
  };
}

/** A finish by a short name, each with the label its control shows. */
function named<K extends "accentRun" | "counter" | "floor" | "tileSize" | "wall">(
  name: string,
  key: K,
  labelKey: string,
  names: Record<string, Finishes[K]>,
  labels: Record<string, string>,
  literal = false,
): FinishField<Finishes[K]> {
  return {
    name,
    labelKey,
    carries: [`finishes.${key}`],
    get: (finishes) => finishes[key],
    put: (value) => ({ [key]: value }) as Partial<Finishes>,
    write: (value) => nameIn(names, value),
    read: (raw) => (raw in names ? names[raw] : undefined),
    show: (value, say) => {
      const label = labels[nameIn(names, value)];
      return literal ? label : say(label);
    },
  };
}

const own = <T extends string>(values: readonly T[]) =>
  Object.fromEntries(values.map((value) => [value, value])) as Record<string, T>;

/** The finishes, in the order the Finishes panel shows them. */
export const FINISH_FIELDS: FinishField<AnyValue>[] = [
  paint("cabinet", "cabinet", CABINET_COLORS, "finish.cabinet"),
  named("accentRun", "accentRun", "finish.accentRun", own(ACCENT_RUNS), {
    none: "finish.accentRun.none",
    left: "panel.layout.leg.left",
    back: "panel.layout.leg.back",
    island: "panel.layout.island",
  }),
  paint("accent", "accent", ACCENT_COLORS, "finish.accent"),
  named("counter", "counter", "finish.counter", COUNTER_NAMES, {
    quartz: "finish.counter.quartz",
    marble: "finish.counter.marble",
    oak: "finish.counter.oak",
  }),
  named("floor", "floor", "finish.floor", FLOOR_NAMES, {
    oak: "finish.floor.oak",
    tile: "finish.floor.tile",
  }),
  named("tile", "tileSize", "finish.floor.tileSize", own(TILE_SIZES), TILE_LABEL, true),
  named("wall", "wall", "finish.wall", own(WALL_FINISHES), {
    "warm-grey": "finish.wall.warmGrey",
    "mid-grey": "finish.wall.midGrey",
    taupe: "finish.wall.taupe",
    white: "finish.wall.white",
  }),
];

/** A machine by its model number, which no two in the catalogue share. */
const BY_MODEL = new Map(APPLIANCES.map((appliance) => [appliance.model.toUpperCase(), appliance]));
export const applianceByModel = (raw: string): Appliance | undefined => BY_MODEL.get(raw.toUpperCase());

/** A machine as a customer reads it: brand and model. */
export const sayAppliance = (appliance: Appliance) => `${appliance.brand} ${appliance.model}`;

/**
 * Each opening's model, named for the slot without its prefix: `hood=PH36HWS`,
 * `dishwasher-2=SHX78CM5N`. Read as a model number only; whether that model
 * is in the catalogue and goes in this opening is openLink.ts's to ask.
 */
export const MODEL_FIELDS: (Field<string> & { slotId: SlotId })[] = SLOT_RECORDS.map((record) => ({
  slotId: record.id,
  name: record.id.replace(/^slot-/, ""),
  labelKey: record.labelKey,
  carries: [`selection.${record.id}`],
  write: (id: string) => APPLIANCE_BY_ID[id].model,
  read: (raw: string) => (/^[A-Za-z0-9-]+$/.test(raw) ? raw : undefined),
  show: (id: string) => (APPLIANCE_BY_ID[id] ? sayAppliance(APPLIANCE_BY_ID[id]) : id),
}));

/** The blower with the hood: its model number, or `none`. */
export const BLOWER_FIELD: Field<string> = {
  name: "blower",
  labelKey: "blower.title",
  carries: ["blowerId"],
  write: (id) => (id === "none" ? "none" : APPLIANCE_BY_ID[id].model),
  read: (raw) => (/^[A-Za-z0-9-]+$/.test(raw) ? raw : undefined),
  show: (id, say) => (APPLIANCE_BY_ID[id] ? sayAppliance(APPLIANCE_BY_ID[id]) : say("blower.none")),
};

/** The package, by the letter on its button. */
export const PACKAGE_FIELD: Field<string> = {
  name: "pkg",
  labelKey: "panel.package",
  carries: ["packageId"],
  write: (id) => PACKAGE_BY_ID[id].code,
  read: (raw) => PACKAGES.find((entry) => entry.available && entry.code === raw.toUpperCase())?.id,
  show: (id) => PACKAGE_BY_ID[id]?.code ?? id,
};

/** The language the page opens in; the customer can still switch it. Leo, round 94. */
export const LANG_FIELD: Field<Lang> = {
  name: "lang",
  labelKey: "share.field.lang",
  carries: ["lang"],
  write: (lang) => lang,
  read: (raw) => (raw === "en" || raw === "zh" ? raw : undefined),
  show: (lang, say) => say(`share.value.lang.${lang}`),
};

/**
 * What the page holds and a link does not carry, each with why. Leo, round
 * 94: the view, the machine selected, the display mode, day and night; the
 * rest are the page's own state or the package's, never a customer's choice.
 */
export const NOT_IN_LINK: Record<string, string> = {
  // Leo's four (round 94): a link always opens at the default view (D1, D23).
  camera: "the view: a link opens at the default view, which is the page loading (D1, D23)",
  resetToken: "the view: a request to return to the default view",
  zoomRequest: "the view: a request to zoom",
  selectedSlot: "the machine selected",
  specSlot: "the machine whose spec card is open",
  renderMode: "the display mode",
  lighting: "day or night (Leo, round 94)",
  // The page's own state, not the kitchen.
  quality: "render quality, measured from the frame rate",
  fps: "the frame rate",
  showCabinets: "a layer switch",
  showLabels: "a layer switch",
  visibleUtilities: "the install view's layer switches",
  showDimensions: "a layer switch",
  helpOpen: "a dialog open",
  quoteOpen: "a dialog open",
  leftOpen: "a rail open (per tab, D12)",
  rightOpen: "a rail open (per tab, D12)",
  // Round 91: the panel's tabs are the page's own, like the rails.
  rightTab: "a tab of the right panel and the phone's sheet: the page's own state, like the rails, kept per browser tab (D12)",
  tabBeforeInstall: "the tab to go back to after Install mode: the page's own state",
  mobilePanel: "the phone's sheet open",
  toast: "a message on screen",
  modeSwitchStartedAt: "a timing for ?debug=1",
  modeSwitchMs: "a timing for ?debug=1",
  layoutIssues: "a refusal printed under a control; the link carries what was built",
  layoutVersion: "a counter the interface rebuilds on",
  // Layout figures nobody on screen can change: each package's own.
  "layoutParams.windows": "the window: no control changes it, the template places it",
  "layoutParams.sinkUnderWindow": "no control changes it",
  "layoutParams.islandOverhangIn": "the package's own (E's 15\"), no control changes it",
};

/** Every field a link carries, in the order it is written. */
export const LINK_FIELDS: Field<AnyValue>[] = [
  PACKAGE_FIELD,
  LANG_FIELD,
  ...LAYOUT_FIELDS,
  ...MODEL_FIELDS,
  BLOWER_FIELD,
  ...FINISH_FIELDS,
];

/** The slots a package has, in its order, with their fields. */
export const modelFieldsOf = (packageId: string) =>
  PACKAGE_BY_ID[packageId].slots.map(
    (slot) => MODEL_FIELDS.find((field) => field.slotId === slot.slotId)!,
  );

/**
 * The link's query, without the `?`: every field, in the table's order. The
 * models are the package's own openings; a blower is `none` when there is
 * none.
 */
export function writeLink(kitchen: Kitchen): string {
  const query = new URLSearchParams();
  query.set("v", LINK_VERSION);
  query.set(PACKAGE_FIELD.name, PACKAGE_FIELD.write(kitchen.packageId));
  query.set(LANG_FIELD.name, LANG_FIELD.write(kitchen.lang));
  for (const field of LAYOUT_FIELDS) query.set(field.name, field.write(field.get(kitchen.layoutParams)));
  for (const field of modelFieldsOf(kitchen.packageId)) {
    const id = kitchen.selection[field.slotId];
    if (!id) throw new Error(`no model in ${field.slotId} to write into a link`);
    query.set(field.name, field.write(id));
  }
  query.set(BLOWER_FIELD.name, BLOWER_FIELD.write(kitchen.blowerId ?? "none"));
  for (const field of FINISH_FIELDS) query.set(field.name, field.write(field.get(kitchen.finishes)));
  return query.toString();
}

/** How one field reads from a link. */
export type FieldRead<V> = { state: "missing" } | { state: "bad"; raw: string } | { state: "ok"; value: V };

export function readField<V>(field: Field<V>, query: URLSearchParams): FieldRead<V> {
  const raw = query.get(field.name);
  if (raw === null || raw === "") return { state: "missing" };
  const value = field.read(raw);
  return value === undefined ? { state: "bad", raw } : { state: "ok", value };
}

/**
 * What a query is, before anything is applied: not a link (no `v` — the older
 * screenshot parameters, read as before), a link that cannot be read at all —
 * a version this page does not know, or no package it builds — or a link,
 * with its package.
 */
export function readLink(
  query: URLSearchParams,
): { kind: "none" } | { kind: "unreadable" } | { kind: "link"; packageId: string } {
  const version = query.get("v");
  if (version === null) return { kind: "none" };
  if (version !== LINK_VERSION) return { kind: "unreadable" };
  const pkg = readField(PACKAGE_FIELD, query);
  return pkg.state === "ok" ? { kind: "link", packageId: pkg.value } : { kind: "unreadable" };
}
