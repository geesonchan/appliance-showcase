/**
 * A space between Chinese and a Latin letter (Leo, 2026-11-12, on U-2's seven points,
 * 3: 「中文退回按钮：后面是英文字母时留空格（退回 L 型、退回 U 型），后面是中文时不留（退回一字型）」;
 * and: 「提示第一行「已切换为U 型厨房」，"为"和"U"之间加一个空格；其他中文里夹英文字母的地方照同样
 * 的规矩查一遍」).
 *
 * The Chinese lines as written already keep the rule (「L 型」, 「U 型：」, 「Drop in 炉灶片」);
 * where it broke is where a filled-in name met the line: 「已切换为」 + 「U 型厨房」, 「套餐 A」 +
 * 「需要」, 「放不下」 + 「Drop in 炉灶片」. So the rule is kept in one place, `translate`, at
 * the seams where a value goes in, in Chinese only; a line's own words are left as
 * written, and checked here as they are.
 */
import { describe, expect, it } from "vitest";
import zh from "./zh.json";
import { sayWith, translate } from ".";
import { APPLIANCES } from "../data/catalogue";
import { alternativeTitle } from "../data/machineLabel";

const HAN_THEN_LATIN = /\p{Script=Han}[A-Za-z]|[A-Za-z]\p{Script=Han}/u;
const zhSay = (key: string, vars?: Record<string, string | number>) => sayWith((k, v) => translate("zh", k, v), key, vars);
const lines = Object.entries(zh as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string" && !entry[0].startsWith("_"));

describe("a space between Chinese and a Latin letter (Leo, 2026-11-12)", () => {
  it("puts one between 为 and U: 已切换为 U 型厨房", () => {
    expect(zhSay("toast.shapeSwitched", { shapeKey: "panel.layout.shape.U" })).toBe("已切换为 U 型厨房，墙长已调整：");
  });

  it("puts none before Chinese: 已切换为一字型厨房", () => {
    expect(zhSay("toast.shapeSwitched", { shapeKey: "panel.layout.shape.one-wall" })).toBe("已切换为一字型厨房，墙长已调整：");
  });

  it("says 退回 L 型 and 退回 U 型 with the space, 退回一字型 without", () => {
    const back = (shape: string) => zhSay("toast.undo.toShape", { shapeKey: `topbar.shape.${shape}` });
    expect([back("L"), back("U"), back("one-wall")]).toEqual(["退回 L 型", "退回 U 型", "退回一字型"]);
  });

  it("says 退回套餐 A: the package's name begins in Chinese", () => {
    expect(translate("zh", "toast.undo.package", { package: "套餐 A" })).toBe("退回套餐 A");
  });

  // It was toast.roomGrew's 「套餐 D 需要」, the one line where a package's name met
  // Chinese; that line is retired (item 10; Leo, 2026-11-13, answer 5), and the
  // seam is the same wherever a name put in ends in a letter.
  it("puts one after a name that ends in a letter: 套餐 D 不够长", () => {
    expect(translate("zh", "toast.modelGrew", { wall: "套餐 D", toIn: "132″" })).toBe("换了型号，套餐 D 不够长，已加长到 132″。");
  });

  it("puts none between a name that ends in a letter and a comma: 已切换为套餐 D，", () => {
    expect(translate("zh", "toast.packageSwitched", { package: "套餐 D" })).toBe("已切换为套餐 D，墙长已调整：");
  });

  it("puts one before a name that begins with a letter: 放不下 Drop in 炉灶片", () => {
    expect(zhSay("toast.shapeOmitted", { itemKey: "slot.cooktop" })).toBe("墙已到最长，放不下 Drop in 炉灶片，已省略。");
  });

  it("leaves English as it is, and a line with nothing put in as written", () => {
    expect([
      translate("en", "toast.shapeSwitched", { shape: "U-shaped kitchen" }),
      translate("zh", "topbar.shape.L"),
      translate("zh", "toast.undo.package"),
    ]).toEqual(["Switched to U-shaped kitchen; the walls were adjusted:", "L 型", translate("zh", "toast.undo.package")]);
  });

  it("adds no second space where the line already has one: 后墙加到 132″", () => {
    expect(translate("zh", "toast.shapeWall", { wall: "后墙", fromIn: "120″", toIn: "132″" })).toBe("后墙从 120″ 改为 132″");
  });

  it("keeps it in every Chinese line with a name put in, a letter at either end of the name", () => {
    const broken = lines.flatMap(([key, text]) => {
      const names = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      if (names.length === 0) return [];
      const vars = Object.fromEntries(names.map((name) => [name, "Ab"]));
      const said = translate("zh", key, vars);
      return HAN_THEN_LATIN.test(said) ? [`${key}: ${said}`] : [];
    });
    expect(broken).toEqual([]);
  });

  it("finds no Chinese line written with a letter against Chinese", () => {
    expect(lines.filter(([, text]) => HAN_THEN_LATIN.test(text)).map(([key]) => key)).toEqual([]);
  });

  it("keeps it in every machine's Chinese main title", () => {
    const t = (key: string, vars?: Record<string, string | number>) => translate("zh", key, vars);
    const broken = APPLIANCES.map((appliance) => `${appliance.model}: ${alternativeTitle(appliance, t)}`).filter((line) =>
      HAN_THEN_LATIN.test(line.slice(line.indexOf(": ") + 2)),
    );
    expect(broken).toEqual([]);
  });
});
