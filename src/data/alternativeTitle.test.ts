import { describe, expect, it } from "vitest";
import appliancesFile from "../../data/appliances.json";
import { translate } from "../i18n";
import type { Appliance } from "../types";
import { APPLIANCE_BY_ID } from "./catalogue";
import { alternativeTitle, webSizeFarFromWidth } from "./machineLabel";

/**
 * An alternative's main title: what the machine is, not its model number.
 *
 * Leo, 2026-11-08: 「当我们点中一个家电的时候，会显示这个家电的可替换选项，里面的选项显示的主
 * 标题是这个item的归类更好，而不是model number」. Nominal size + fuel + kind, the
 * look after a dot where the catalogue has a pair; the table below is the
 * plan's section 7, which he read and agreed, sentence by sentence.
 * `docs/plans/alternative-title-plan.md`.
 */

const all = appliancesFile.appliances as unknown as Appliance[];
const byModel = (model: string) => all.find((a) => a.model === model)!;
const en = (a: Appliance) => alternativeTitle(a, (key, vars) => translate("en", key, vars));
const zh = (a: Appliance) => alternativeTitle(a, (key, vars) => translate("zh", key, vars));

const TITLES: [string, string, string][] = [
  ["HIS8055U", '30" Induction Range', '30" 电磁炉头'],
  ["MFGS4030RS", '30" Gas Range', '30" 燃气炉头'],
  ["PCG366W", '36" Gas Rangetop', '36" 燃气炉灶头'],
  ["PRG304WH", '30" Gas Range', '30" 燃气炉头'],
  ["PRG366WH", '36" Gas Range', '36" 燃气炉头'],
  ["CIT367YG", '36" Induction Cooktop', '36" 电磁炉灶片'],
  ["AK7136BS-BF", '36" Under-Cabinet Hood', '36" 吊柜式油烟机'],
  ["AK7300AS", '30" Under-Cabinet Hood', '30" 吊柜式油烟机'],
  ["HMCB30WS", '30" Chimney Hood', '30" 烟囱式油烟机'],
  ["HMCB36WS", '36" Chimney Hood', '36" 烟囱式油烟机'],
  ["HMIB42WS", '42" Island Hood', '42" 岛式油烟机'],
  ["HMWB361WS", '36" Under-Cabinet Hood', '36" 吊柜式油烟机'],
  ["PH36HWS", '36" Under-Cabinet Hood', '36" 吊柜式油烟机'],
  ["VCIN36GWS", '36" Insert Hood', '36" 嵌入式油烟机'],
  ["JVM3160RFSS", '30" Over-the-Range Microwave', '30" 微波炉油烟机'],
  ["VTI2FZ", "Inline Blower", "管道风机"],
  ["VTN2FZ", "Internal Blower", "内置风机"],
  ["VTR2FZ", "External Blower", "外置风机"],
  ["ME301YP", '30" Single Oven', '30" 单门烤箱'],
  ["MEM301WS", '30" Combination Oven', '30" 组合烤箱'],
  ["PO302W", '30" Double Oven', '30" 双门烤箱'],
  ["PODS302B", '30" Double Steam Oven', '30" 双门蒸烤箱'],
  ["MD24BS", '24" Microwave Drawer', '24" 微波抽屉'],
  ["TCM24PS", '24" Coffee Machine', '24" 咖啡机'],
  ["SHV78CM3N", '24" Dishwasher', '24" 洗碗机'],
  ["SHX78CM5N", '24" Dishwasher', '24" 洗碗机'],
  ["T24IR905SP", '24" Refrigerator Column · Panel-Ready', '24" 冷藏柱 · 可装门板'],
  ["T24IR905SP-SS", '24" Refrigerator Column · Stainless', '24" 冷藏柱 · 不锈钢'],
  ["T30IR905SP", '30" Refrigerator Column · Panel-Ready', '30" 冷藏柱 · 可装门板'],
  ["T30IR905SP-SS", '30" Refrigerator Column · Stainless', '30" 冷藏柱 · 不锈钢'],
  ["T36BT120NS", '36" Built-In Refrigerator · Stainless', '36" 内嵌式冰箱 · 不锈钢'],
  ["T36FT820NS", '36" Counter-Depth Refrigerator', '36" 浅深度冰箱'],
  ["T36IT100NP", '36" Built-In Refrigerator · Panel-Ready', '36" 内嵌式冰箱 · 可装门板'],
  ["T18IF900SP", '18" Freezer Column · Panel-Ready', '18" 冷冻柱 · 可装门板'],
  ["T18IF900SP-SS", '18" Freezer Column · Stainless', '18" 冷冻柱 · 不锈钢'],
  ["T24IF905SP", '24" Freezer Column · Panel-Ready', '24" 冷冻柱 · 可装门板'],
  ["T24IF905SP-SS", '24" Freezer Column · Stainless', '24" 冷冻柱 · 不锈钢'],
  ["PRW24C01CG", '24" Wine Cooler', '24" 小酒柜'],
  ["T18IW100SP", '18" Wine Column · Panel-Ready', '18" 酒柜柱 · 可装门板'],
  ["T18IW100SP-SS", '18" Wine Column · Stainless', '18" 酒柜柱 · 不锈钢'],
  ["T18IW905SP", '18" Wine Column · Panel-Ready', '18" 酒柜柱 · 可装门板'],
  ["T18IW905SP-SS", '18" Wine Column · Stainless', '18" 酒柜柱 · 不锈钢'],
  ["T24IW905SP", '24" Wine Column · Panel-Ready', '24" 酒柜柱 · 可装门板'],
  ["T24IW905SP-SS", '24" Wine Column · Stainless', '24" 酒柜柱 · 不锈钢'],
];

describe("an alternative's main title, sentence by sentence (the plan's section 7)", () => {
  it("has a line for every machine in the catalogue", () => {
    expect(TITLES.map(([model]) => model).sort()).toEqual(all.map((a) => a.model).sort());
  });

  it.each(TITLES)("%s", (model, english, chinese) => {
    const a = byModel(model);
    expect([en(a), zh(a)]).toEqual([english, chinese]);
  });
});

describe("where the size comes from", () => {
  // Lopsided: 37" wide, called 35", so rounding the width gives 37 and only
  // the column gives 35.
  const fake = { ...byModel("CIT367YG"), widthIn: 37, webSizeIn: 35 } as Appliance;

  it("reads the column, never the width", () => {
    expect(en(fake)).toBe('35" Induction Cooktop');
    expect(zh(fake)).toBe('35" 电磁炉灶片');
  });

  it("does not round the column either", () => {
    expect(en({ ...fake, webSizeIn: 35.5 } as Appliance)).toBe('35-1/2" Induction Cooktop');
  });

  it("has a size on everything but the blowers", () => {
    const missing = all.filter((a) => a.category !== "blower" && !/^\d+"/.test(en(a))).map((a) => a.model);
    expect(missing).toEqual([]);
  });

  it("puts no size on a blower, even one given a size", () => {
    const blowers = all.filter((a) => a.category === "blower");
    expect(blowers.length).toBe(3);
    for (const a of blowers) expect(en({ ...a, webSizeIn: 30 } as Appliance)).not.toMatch(/\d/);
  });
});

describe("the look, where the catalogue has a pair (Leo, 2026-11-08)", () => {
  const paired = all.filter((a) => a.pairModel !== null);
  const unpaired = all.filter((a) => a.pairModel === null);

  it("is 16 rows with a pair and 28 without", () => {
    expect([paired.length, unpaired.length]).toEqual([16, 28]);
  });

  it("is on every row with a pair, and each row of a pair says one finish", () => {
    for (const a of paired) {
      expect(a.finish.length, a.model).toBe(1);
      expect(en(a), a.model).toMatch(/ · (Stainless|Panel-Ready)$/);
      expect(zh(a), a.model).toMatch(/ · (不锈钢|可装门板)$/);
    }
  });

  it("is on no row without a pair", () => {
    for (const a of unpaired) expect(en(a), a.model).not.toContain("·");
  });

  it.each(paired.map((a) => [a.model, a.pairModel!] as const))("%s and its pair %s read differently", (model, pair) => {
    const [a, b] = [byModel(model), byModel(pair)];
    expect(en(a)).not.toBe(en(b));
    expect(zh(a)).not.toBe(zh(b));
  });

  it("follows the catalogue, not the model number: the look swapped, the word swaps", () => {
    const a = byModel("T36BT120NS");
    expect(en({ ...a, finish: ["panel-ready"] } as Appliance)).toBe('36" Built-In Refrigerator · Panel-Ready');
  });
});

describe("the words", () => {
  it("leaves no Latin letter in a Chinese title", () => {
    const latin = all.filter((a) => /[A-Za-z]/.test(zh(a))).map((a) => `${a.model}: ${zh(a)}`);
    expect(latin).toEqual([]);
  });

  it('never says 壁挂式: the four under-cabinet hoods are 吊柜式 (Leo, 2026-11-08)', () => {
    expect(all.filter((a) => zh(a).includes("壁挂式")).map((a) => a.model)).toEqual([]);
  });

  it("names every fuel the catalogue has", () => {
    const named = all.filter((a) => a.fuel !== null);
    expect(named.length).toBeGreaterThan(0);
    for (const a of named) expect(en(a), a.model).toMatch(/Gas|Induction|Electric/);
  });

  it("has 电 ready for an electric machine, though none is on the list today", () => {
    const fake = { ...byModel("MFGS4030RS"), fuel: "electric" } as Appliance;
    expect([en(fake), zh(fake)]).toEqual(['30" Electric Range', '30" 电炉头']);
  });

  it("is the one a machine in the app gets", () => {
    expect(en(APPLIANCE_BY_ID["thermador-cit367yg"])).toBe('36" Induction Cooktop');
  });
});

describe("a size far from the width", () => {
  it("is VCIN36GWS alone, Leo's own exception (2026-11-08: 36 is right)", () => {
    expect(webSizeFarFromWidth(all).map((a) => a.model)).toEqual(["VCIN36GWS"]);
  });

  it("finds a fake one: this check can go red", () => {
    const fake = { ...byModel("MFGS4030RS"), model: "FAKE", webSizeIn: 36 } as Appliance;
    expect(webSizeFarFromWidth([byModel("CIT367YG"), fake]).map((a) => a.model)).toEqual(["FAKE"]);
  });

  it('lets exactly 1" through: CIT367YG, 37" wide, called 36', () => {
    expect(webSizeFarFromWidth([byModel("CIT367YG")])).toEqual([]);
  });
});
