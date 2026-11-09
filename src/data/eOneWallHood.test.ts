import { afterAll, describe, expect, it } from "vitest";
import appliancesFile from "../../data/appliances.json";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";
import { hoodBridgeBand } from "./cabinets";
import { APPLIANCE_BY_ID } from "./catalogue";
import { candidatesFor } from "./candidates";
import { dimensionsFor } from "./dimensions";
import { HOOD_MANUALS, ISLAND_HOOD, hoodTopFt, outsideItsManual } from "./hood";
import { hoodMount, shopInstallDistanceIn } from "./hoodMount";
import { hoodCabinetBand } from "./insertHood";
import { setActivePackage, setHoodModel, setLayoutParamsGrowing } from "./layoutState";
import { checkHeights } from "./layoutRules";
import { oneWallWantedIn, type LayoutParams } from "./layoutTemplate";
import { PACKAGE, PACKAGE_BY_ID } from "./packages";
import { REQUESTED_PARAMS, RUNS } from "./room";
import { SLOT_BY_ID } from "./slots";
import { resetRoom } from "./testRoom";
import type { Appliance, SlotId } from "../types";

/**
 * E on one wall: the cooking surface is its cooktop's glass, the hood hangs off
 * that surface by the shop's installation distance, and the note beside the
 * line says what that hood's own manual says.
 * docs/plans/e-one-wall-dimension-plan.md; Leo, 2026-11-08.
 */
afterAll(() => resetRoom());

const hoodOf = (model: string) =>
  Object.values(APPLIANCE_BY_ID).find((row) => row.model === model) as Appliance;

function selectionWith(model?: string) {
  const selection = Object.fromEntries(
    Object.entries(PACKAGE.defaultSelection).map(([slot, id]) => [slot, APPLIANCE_BY_ID[id as string]]),
  ) as Record<SlotId, Appliance>;
  if (model) selection["slot-hood"] = hoodOf(model);
  return selection;
}

function eOneWall(model?: string) {
  resetRoom();
  const entry = PACKAGE_BY_ID["package-e"];
  if (!setActivePackage(entry.id).ok) throw new Error("E will not build");
  const asked: LayoutParams = { ...REQUESTED_PARAMS, shape: "one-wall" };
  asked.backWallIn = Math.max(asked.backWallIn, oneWallWantedIn(asked, entry));
  if (!setLayoutParamsGrowing(asked).ok) throw new Error("E on one wall will not build");
  if (model) setHoodModel(hoodOf(model));
  return selectionWith(model);
}

const chain = (selection: Record<SlotId, Appliance>) =>
  Object.fromEntries(dimensionsFor(selection).map((d) => [d.id, d]));

const undersideIn = () => SLOT_BY_ID["slot-hood"].position[1] * 12;

/** What the note says, in a language, as the overlay fills it in. */
function words(strings: Record<string, string>, key: string | undefined, vars: Record<string, string | number> = {}) {
  let text = strings[key as string];
  for (const [name, value] of Object.entries(vars)) text = text.replace(`{${name}}`, String(value));
  return text;
}

describe("E on one wall, as it opens", () => {
  it('reads the cooking surface as the glass, 36-1/4", not the cooktop\'s own 4"', () => {
    expect(chain(eOneWall())["floor-to-cooktop"].valueIn).toBeCloseTo(36.25, 3);
  });

  it('reads 30-1/4" from the glass to HMCB36WS, whose underside stays at 66-1/2"', () => {
    const dims = chain(eOneWall("HMCB36WS"));
    expect(undersideIn()).toBeCloseTo(66.5, 6);
    expect(dims["cooktop-to-canopy"].valueIn).toBeCloseTo(30.25, 3);
  });

  it("says what HMCB36WS's manual says, in both languages, and nothing about gas alone or a maximum", () => {
    const note = chain(eOneWall("HMCB36WS"))["cooktop-to-canopy"];
    const inEnglish = words(en, note.noteKey, note.noteVars);
    const inChinese = words(zh, note.noteKey, note.noteVars);
    expect(inEnglish).toBe("min 30, gas or induction");
    expect(inChinese).toBe("最小 30，燃气与电磁相同");
    expect(`${inEnglish} ${inChinese}`).not.toMatch(/max|最大|gas min|燃气最小/);
  });
});

describe("E on one wall, with each of its hoods", () => {
  const CASES: [string, number, number, Record<string, string>][] = [
    ["HMCB36WS", 66.5, 30.25, { en: "min 30, gas or induction", zh: "最小 30，燃气与电磁相同" }],
    ["HMCB30WS", 66.5, 30.25, { en: "min 30, gas or induction", zh: "最小 30，燃气与电磁相同" }],
    ["AK7136BS-BF", 66.25, 30, { en: "min 24, max 32", zh: "最小 24，最大 32" }],
    ["AK7300AS", 66.25, 30, { en: "min 24, max 34", zh: "最小 24，最大 34" }],
    ["VCIN36GWS", 66.25, 30, { en: "min 30, max 40", zh: "最小 30，最大 40" }],
    ["HMWB361WS", 66.25, 30, { en: "min 30, gas or induction", zh: "最小 30，燃气与电磁相同" }],
    ["PH36HWS", 66.25, 30, { en: "min 30, max 40", zh: "最小 30，最大 40" }],
    ["JVM3160RFSS", 60.25, 24, { en: 'shop practice 24"', zh: '店里做法 24"' }],
  ];

  it.each(CASES)('%s hangs at %f", %f" over the glass, and its note is its own', (model, under, gap, note) => {
    const dims = chain(eOneWall(model));
    expect(undersideIn()).toBeCloseTo(under, 6);
    const line = dims["cooktop-to-canopy"];
    expect(line.valueIn).toBeCloseTo(gap, 3);
    expect(words(en, line.noteKey, line.noteVars)).toBe(note.en);
    expect(words(zh, line.noteKey, line.noteVars)).toBe(note.zh);
  });

  it("offers these eight and no others", () => {
    eOneWall();
    expect(
      candidatesFor("slot-hood", PACKAGE)
        .filter((c) => c.fit.fits)
        .map((c) => c.appliance.model)
        .sort(),
    ).toEqual(CASES.map(([model]) => model).sort());
  });

  it.each(["AK7136BS-BF", "AK7300AS", "HMWB361WS", "PH36HWS", "JVM3160RFSS"])(
    "starts the cabinet over %s at the top of the hood",
    (model) => {
      eOneWall(model);
      expect(hoodBridgeBand()[0]).toBeCloseTo(hoodTopFt(), 9);
    },
  );

  it('starts VCIN36GWS\'s housing where the liner hangs, 66-1/4"', () => {
    eOneWall("VCIN36GWS");
    const housing = RUNS.flatMap((run) => run.uppers).find((bank) => bank.id.endsWith("-hood"));
    expect(housing?.band?.[0]).toBeCloseTo(hoodCabinetBand(66.25 / 12)[0], 6);
  });

  it.each(CASES.map(([model]) => model))("passes the room's own rules with %s (D13)", (model) => {
    eOneWall(model);
    expect(checkHeights()).toEqual([]);
  });
});

describe('the hood follows the cooktop\'s own glass (no 66" or 60" written down)', () => {
  type Row = { model: string; heightIn: number };
  const cit = (appliancesFile as unknown as { appliances: Row[] }).appliances.find((row) => row.model === "CIT367YG")!;
  const itsOwn = cit.heightIn;

  /** The same machine standing 3/8" proud of the stone rather than 1/4". */
  function withGlassThreeEighths<T>(body: () => T): T {
    cit.heightIn = itsOwn + 0.125;
    try {
      return body();
    } finally {
      cit.heightIn = itsOwn;
    }
  }

  it('a wall hood moves up with it', () => {
    withGlassThreeEighths(() => {
      eOneWall("AK7136BS-BF");
      expect(undersideIn()).toBeCloseTo(36.375 + 30, 6);
    });
  });

  it('a microwave moves up with it', () => {
    withGlassThreeEighths(() => {
      eOneWall("JVM3160RFSS");
      expect(undersideIn()).toBeCloseTo(36.375 + 24, 6);
    });
  });

  it('a chimney hood stays on its 66-1/2" until the glass takes it higher', () => {
    withGlassThreeEighths(() => {
      eOneWall("HMCB36WS");
      expect(undersideIn()).toBeCloseTo(66.5, 6);
    });
  });

  it("E on one wall offers one cooktop: a second would have to be recorded when chosen", () => {
    // The hood reads the package's own cooktop. Nothing records a choice of
    // another here because there is none to make; this goes red the day there is.
    eOneWall();
    expect(candidatesFor("slot-cooktop", PACKAGE).map((c) => c.appliance.model)).toEqual(["CIT367YG"]);
  });
});

describe("what does not move", () => {
  function inPackage(id: string) {
    resetRoom();
    if (!setActivePackage(id).ok) throw new Error(`${id} will not build`);
  }

  it('A\'s hood still hangs off the surface its wall was drilled for, 66-3/4"', () => {
    inPackage("package-a");
    expect(undersideIn()).toBeCloseTo(66.75, 6);
  });

  it('E\'s island hood still hangs at its 72"', () => {
    inPackage("package-e");
    expect(undersideIn()).toBeCloseTo(ISLAND_HOOD.undersideIn, 6);
  });
});

describe("the shop's installation distance, and each hood's manual (Leo, 2026-11-08)", () => {
  it('is 30" for a wall hood and 24" for a microwave, Leo\'s', () => {
    expect(shopInstallDistanceIn("chimney")).toBe(30);
    expect(shopInstallDistanceIn("under-cabinet")).toBe(30);
    expect(shopInstallDistanceIn("insert")).toBe(30);
    expect(shopInstallDistanceIn("otr")).toBe(24);
  });

  const everyHood = [
    ...Object.values(APPLIANCE_BY_ID).filter((row) => row.category === "hood"),
    hoodOf("JVM3160RFSS"),
  ];

  /** Where the shop puts it, over the surface: an island hood is hung at its own 72". */
  const shopIn = (hood: Appliance) =>
    hoodMount(hood) === "island" ? ISLAND_HOOD.undersideIn - 36.25 : shopInstallDistanceIn(hoodMount(hood));

  it("is inside every hood's manual, its maximum too", () => {
    const models = new Set([...everyHood.map((hood) => hood.model), ...Object.keys(HOOD_MANUALS)]);
    const outside = [...models].flatMap((model) => {
      const hood = everyHood.find((row) => row.model === model);
      return outsideItsManual(model, hood ? shopIn(hood) : 30);
    });
    expect(outside).toEqual([]);
  });

  it("has a manual row for every hood the catalogue sells", () => {
    expect(everyHood.map((hood) => hood.model).filter((model) => !HOOD_MANUALS[model])).toEqual([]);
  });

  it("writes where each figure was read", () => {
    expect(Object.entries(HOOD_MANUALS).filter(([, manual]) => !manual.read)).toEqual([]);
  });

  it("would catch a hood whose manual asks for more than the shop gives", () => {
    expect(outsideItsManual("FAKE32", 30, { minIn: 32, maxIn: null, read: "a false one" })).toHaveLength(1);
  });

  it("would catch a hood whose manual allows less than the shop gives", () => {
    expect(outsideItsManual("FAKE28", 30, { minIn: 24, maxIn: 28, read: "a false one" })).toHaveLength(1);
  });

  it("would catch a hood with no manual row", () => {
    expect(outsideItsManual("NOT-IN-THE-TABLE", 30)).toHaveLength(1);
  });

  it("does not check a figure the manual does not give", () => {
    expect(HOOD_MANUALS["JVM3160RFSS"]).toMatchObject({ minIn: null, maxIn: null });
    expect(outsideItsManual("JVM3160RFSS", 24)).toEqual([]);
  });
});
