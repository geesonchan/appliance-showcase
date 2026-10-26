import { describe, expect, it } from "vitest";
import { candidatesFor } from "../data/candidates";
import { APPLIANCES, APPLIANCE_BY_ID, blowersFor } from "../data/catalogue";
import { recordHoodModel } from "../data/hoodMount";
import { DEFAULT_PARAMS, PARAM_LIMITS, type LayoutParams } from "../data/layoutTemplate";
import { DEFAULT_PACKAGE, PACKAGES, PACKAGE_BY_ID } from "../data/packages";
import { lookupRal } from "../data/ral";
import { CABINETS } from "../data/cabinets";
import { ISLAND, LAYOUT_PARAMS, RUNS, SLOT_PLACEMENT } from "../data/room";
import { SLOT_RECORDS } from "../data/slots";
import { resetRoom } from "../data/testRoom";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";
import { kitchenNow, openSharedLink } from "./openLink";
import { LINK_FIELDS, NOT_IN_LINK, readLink, writeLink } from "./shareLink";
import { useAppStore, type NoticeLine } from "./useAppStore";

/**
 * A link rebuilds the kitchen it was shared from. Round 94, Leo;
 * docs/decisions.md D23.
 *
 * Unit tests: the store and the room as the page holds them, no browser.
 * tests/shareLink.test.ts drives the same with the mouse and with touch.
 */

const store = () => useAppStore.getState();
/** The store as the page opens, taken before any test has touched it. */
const OPENED = useAppStore.getState();

/**
 * A page as it loads: package A's room, A's own hood recorded for its cabinets
 * (useAppStore.ts does that at load), nothing chosen, nothing on screen.
 */
function freshPage() {
  recordHoodModel(APPLIANCE_BY_ID[DEFAULT_PACKAGE.defaultSelection["slot-hood"]!], DEFAULT_PACKAGE.id);
  resetRoom();
  useAppStore.setState(OPENED, true);
}

/** What the room is, every box of it: what a link has to come back to. */
const roomNow = () =>
  JSON.parse(JSON.stringify({ params: LAYOUT_PARAMS, runs: RUNS, slots: SLOT_PLACEMENT, island: ISLAND, cabinets: CABINETS }));

const kitchen = () => JSON.parse(JSON.stringify(kitchenNow()));

const PACKAGE_IDS = PACKAGES.filter((entry) => entry.available).map((entry) => entry.id);

/**
 * A kitchen as far from each package's own as the page lets a customer take
 * it — lopsided on purpose (D22, round 50: a test of the defaults passes
 * code that ignores them). Built with the store's own actions, as the panel
 * and the card make it; each step is kept only if the page built it.
 */
function lopsided(packageId: string) {
  freshPage();
  store().setLang("zh");
  store().setPackageId(packageId);
  const entry = PACKAGE_BY_ID[packageId];

  // The layout: each switch and length the panel has, away from where the
  // package opens. A walls an odd number of eighths, as a grown wall can be.
  const room = store().layoutParams;
  const patches: Partial<LayoutParams>[] = [
    { cornerType: room.cornerType === "blind" ? "lazy-susan" : "blind" },
    { towerSide: room.towerSide === "left" ? "right" : "left" },
    { housingStyle: "sweep" },
    { coffeeSillIn: 40 },
    { microwaveHandleIn: 50 },
    { islandOrientation: "perpendicular" },
    { islandDepthIn: room.islandDepthIn + 6 <= PARAM_LIMITS.islandDepthIn.max ? room.islandDepthIn + 6 : room.islandDepthIn - 6 },
    { aisleIn: room.aisleIn + 3 },
    { fridgeEndAbuts: "wall" },
    { backWallIn: LAYOUT_PARAMS.backWallIn + 9.375 },
    { leftWallIn: LAYOUT_PARAMS.leftWallIn + 7.125 },
  ];
  for (const patch of patches) {
    const before = { ...LAYOUT_PARAMS };
    store().setLayout(patch);
    // A refused step is taken back: the link is of a room that stands.
    if (store().layoutIssues.length > 0) store().setLayout(before);
  }

  // Every opening: the last model on its card that goes in and is not its own.
  for (const slot of entry.slots) {
    const own = store().selection[slot.slotId];
    const other = candidatesFor(slot.slotId, entry)
      .filter((candidate) => candidate.fit.fits && candidate.appliance.id !== own)
      .pop();
    if (other) store().selectAppliance(slot.slotId, other.appliance.id);
  }
  const hood = APPLIANCE_BY_ID[store().selection["slot-hood"]];
  if (hood.blower === "required") {
    const other = blowersFor(hood).filter((b) => b.id !== store().blowerId).pop();
    if (other) store().selectBlower(other.id);
  }

  // Every finish off its default, the doors and the accent RAL codes.
  const ral = (code: string) => {
    const found = lookupRal(code);
    if (!found.ok) throw new Error(code);
    return found.colour.hex;
  };
  store().setFinish({
    cabinet: ral("RAL 7016"),
    accentRun: "island",
    accent: ral("RAL 1015"),
    counter: "marble-veined",
    floor: "floor-tile",
    tileSize: "32x32",
    wall: "taupe",
  });
  store().dismissToast();
}

/** Share the kitchen on screen, open the link on a fresh page. */
function shareAndOpen() {
  const link = writeLink(kitchenNow());
  const shared = { kitchen: kitchen(), room: roomNow() };
  freshPage();
  openSharedLink(`?${link}`);
  return { link, shared, opened: { kitchen: kitchen(), room: roomNow() } };
}

describe("one table: every setting is in the link or named as not", () => {
  // Every key the page holds, its layout's and finishes' each by name.
  const settings = () => {
    const state = useAppStore.getState() as unknown as Record<string, unknown>;
    const names: string[] = [];
    for (const [key, value] of Object.entries(state)) {
      if (typeof value === "function") continue;
      if (key === "layoutParams" || key === "finishes") continue;
      if (key === "selection") continue;
      names.push(key);
    }
    // Every layout figure any package names, as well as the default room's.
    const layoutKeys = new Set([
      ...Object.keys(DEFAULT_PARAMS),
      ...PACKAGES.flatMap((entry) => Object.keys(entry.defaultLayout ?? {})),
    ]);
    names.push(...[...layoutKeys].map((key) => `layoutParams.${key}`));
    names.push(...Object.keys(state.finishes as object).map((key) => `finishes.${key}`));
    names.push(...SLOT_RECORDS.map((record) => `selection.${record.id}`));
    return names;
  };
  const carried = new Set(LINK_FIELDS.flatMap((field) => field.carries));

  it("finds every setting in the table or on the list of what a link leaves out", () => {
    freshPage();
    const all = settings();
    const neither = all.filter((name) => !carried.has(name) && !(name in NOT_IN_LINK));
    expect({ settings: all.length, neither }).toEqual({ settings: all.length, neither: [] });
  });

  it("names on the list only settings the page has, so the list cannot go stale", () => {
    freshPage();
    const all = new Set(settings());
    const stale = Object.keys(NOT_IN_LINK).filter((name) => name !== "camera" && !all.has(name));
    expect(stale).toEqual([]);
  });

  it("puts no setting both in the link and on the list", () => {
    const both = Object.keys(NOT_IN_LINK).filter((name) => carried.has(name));
    expect(both).toEqual([]);
  });

  it("leaves out Leo's four: the view, the machine selected, the display mode, day and night", () => {
    expect(["camera", "selectedSlot", "renderMode", "lighting"].filter((name) => !(name in NOT_IN_LINK))).toEqual([]);
  });

  it("gives every field its own name in the link", () => {
    const names = ["v", ...LINK_FIELDS.map((field) => field.name)];
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
  });

  it("can name every model in the catalogue by its model number alone, no two sharing one", () => {
    const numbers = APPLIANCES.map((appliance) => appliance.model.toUpperCase());
    expect({ models: numbers.length, shared: numbers.filter((m, i) => numbers.indexOf(m) !== i) }).toEqual({
      models: APPLIANCES.length,
      shared: [],
    });
  });
});

describe.each(PACKAGE_IDS)("package %s shared and opened", (packageId) => {
  it("comes back as the same kitchen: package, language, layout, models, blower, finishes", () => {
    lopsided(packageId);
    const { shared, opened } = shareAndOpen();
    expect(opened.kitchen).toEqual(shared.kitchen);
  });

  it("comes back as the same room, every run, opening and cabinet box", () => {
    lopsided(packageId);
    const { shared, opened } = shareAndOpen();
    expect(opened.room).toEqual(shared.room);
  });

  it("says nothing on opening, since every setting could be used", () => {
    lopsided(packageId);
    shareAndOpen();
    expect(store().toast).toBeNull();
  });

  it("was shared from a kitchen away from the package's own: models, layout and finishes", () => {
    lopsided(packageId);
    const k = kitchenNow();
    const entry = PACKAGE_BY_ID[packageId];
    const changedModels = entry.slots.filter((slot) => k.selection[slot.slotId] !== entry.defaultSelection[slot.slotId]);
    expect({
      someModels: changedModels.length > 0,
      corner: k.layoutParams.cornerType !== DEFAULT_PARAMS.cornerType,
      cabinet: k.finishes.cabinet !== OPENED.finishes.cabinet,
      lang: k.lang,
    }).toEqual({ someModels: true, corner: true, cabinet: true, lang: "zh" });
  });

  it("opens at the default view and with nothing selected: a page loading moves no camera (D1)", () => {
    lopsided(packageId);
    shareAndOpen();
    expect({ resetToken: store().resetToken, zoom: store().zoomRequest.token, selected: store().selectedSlot }).toEqual({
      resetToken: 0,
      zoom: 0,
      selected: null,
    });
  });
});

describe("what goes in a link", () => {
  it("carries only the table's fields, and no price", () => {
    lopsided("package-d");
    const query = new URLSearchParams(writeLink(kitchenNow()));
    const names = new Set(["v", ...LINK_FIELDS.map((field) => field.name)]);
    const prices = new Set(APPLIANCES.flatMap((a) => (a.msrpUSD === null ? [] : [String(a.msrpUSD)])));
    expect({
      unknown: [...query.keys()].filter((key) => !names.has(key)),
      prices: [...query.values()].filter((value) => prices.has(value)),
    }).toEqual({ unknown: [], prices: [] });
  });
});

/** A link written from package A as it opens, with some fields put in by hand. */
function linkWith(changes: Record<string, string | null>) {
  freshPage();
  const query = new URLSearchParams(writeLink(kitchenNow()));
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) query.delete(key);
    else query.set(key, value);
  }
  return `?${query.toString()}`;
}

const notice = () => store().toast?.notice;
/** The fields of the lines a notice lists. */
const fields = () => {
  const lines = notice();
  return Array.isArray(lines) ? lines.map((line) => line.field) : lines;
};

describe("an older link, checked by what the page already asks", () => {
  it("shows the package's own model for one not in the catalogue, and says so", () => {
    openSharedLink(linkWith({ hood: "ZZ9999XX" }));
    expect(notice()).toEqual([
      { kind: "catalogue", field: "hood", from: "ZZ9999XX", to: "thermador-ph36hws" },
    ] satisfies NoticeLine[]);
  });

  it("shows the package's own model for one that does not go in its opening, and says so", () => {
    // A wine column, 84" tall, in A's island wine opening under the stone:
    // refused on the card (D20, round 86), so refused from a link.
    openSharedLink(linkWith({ wine: "T24IW905SP" }));
    expect(notice()).toEqual([
      { kind: "fit", field: "wine", from: "thermador-t24iw905sp", to: "zephyr-prw24c01cg" },
    ] satisfies NoticeLine[]);
  });

  it("keeps every other setting as the link has it when one cannot be used", () => {
    // Lopsided: two bad, the rest good and away from the default.
    openSharedLink(linkWith({ hood: "ZZ9999XX", back: "not-a-length", counter: "marble", corner: "lazy-susan", lang: "zh" }));
    expect({
      lines: fields(),
      counter: store().finishes.counter,
      corner: LAYOUT_PARAMS.cornerType,
      lang: store().lang,
    }).toEqual({ lines: ["back", "hood"], counter: "marble-veined", corner: "lazy-susan", lang: "zh" });
  });

  it("says which setting it could not use and what is shown", () => {
    openSharedLink(linkWith({ wall: "purple" }));
    expect(notice()).toEqual([{ kind: "setting", field: "wall", to: "warm-grey" }] satisfies NoticeLine[]);
  });

  // Round 99d (Leo): a setting the link does not have at all is said apart from
  // one it has and cannot use — "链接里没有这一项，此处显示 X。" / "Not in the
  // link; showing X." The two, side by side, in one link.
  it("says a setting the link left out is not in it, apart from one it cannot use", () => {
    openSharedLink(linkWith({ wall: null, counter: "granite" }));
    expect(notice()).toEqual([
      { kind: "setting", field: "counter", to: "quartz-white" },
      { kind: "missing", field: "wall", to: "warm-grey" },
    ] satisfies NoticeLine[]);
  });

  it("grows a wall the link's layout needs, and says what is shown (D18)", () => {
    // A lazy susan at A's 144" left wall asks more wall than that.
    freshPage();
    const need = linkWith({ corner: "lazy-susan", left: "96" });
    openSharedLink(need);
    expect(fields()).toEqual(["left"]);
  });

  it("opens the default kitchen and says the link could not be read, for a version it does not know", () => {
    freshPage();
    openSharedLink("?v=7&pkg=D");
    expect({ notice: notice(), pkg: store().packageId }).toEqual({ notice: "unreadable", pkg: DEFAULT_PACKAGE.id });
  });

  it("opens the default kitchen and says the link could not be read, for a package it does not build", () => {
    freshPage();
    openSharedLink("?v=1&pkg=Z&back=200");
    expect({ notice: notice(), pkg: store().packageId }).toEqual({ notice: "unreadable", pkg: DEFAULT_PACKAGE.id });
  });

  it("leaves a page with no link version alone: the screenshot parameters are not a share link", () => {
    expect(readLink(new URLSearchParams("?cabinet=navy&back=180"))).toEqual({ kind: "none" });
  });
});

describe("the notice's words (D10, reviewed.json)", () => {
  const keys = Object.keys(en).filter((key) => key.startsWith("share.notice."));
  // Five lines since round 94; four more in round 99d (Leo): the sentence a
  // long notice is folded into, its Details and Hide details, and a setting
  // the link does not have.
  it("has its nine lines in both languages", () => {
    expect({ en: keys.length, zh: keys.filter((key) => key in zh).length }).toEqual({ en: 9, zh: 9 });
  });

  it("never says what was changed: no 改到, 移到, 更新为 or their English", () => {
    const said = keys.flatMap((key) => [
      (en as Record<string, string>)[key],
      (zh as Record<string, string>)[key],
    ]);
    const forbidden = /改到|移到|更新为|更新|changed|moved|updated|replaced/i;
    expect(said.filter((line) => forbidden.test(line))).toEqual([]);
  });
});
