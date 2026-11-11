// The U's three runs as the generator's own packing would lay them (U-1 plan):
// `packLeg` from layoutTemplate.ts, and `counterWidths`' even split copied here
// as it stands at 2bcc22f (it is not exported). Item lists per Leo's settled
// arrangement (docs/plans/u-shape-plan.md, third draft) and the L's own gaps,
// minimums and shrink groups. Compared with the sketches' figures.json.
import { readFileSync } from "node:fs";
const ROOT = process.cwd();
const lt: any = await import(`${ROOT}/src/data/layoutTemplate.ts`);
const sketch = JSON.parse(readFileSync(`${ROOT}/docs/plans/u-shape-2026-11-10/figures.json`, "utf8"));

type It = any;
const F = (id: string, widthIn: number, code: string, kind = "tall"): It => ({ kind: "fixed", id, widthIn, segmentKind: kind, modules: [{ code, kind, widthIn }] });
const G = (id: string, minIn: number, shrink?: string, extra: any = {}): It => ({ kind: "gap", id, minIn, rule: "u", labelKey: id, ...(shrink ? { shrink } : {}), ...extra });

function counterWidths(totalIn: number) {
  const max = 36, step = 3;
  const count = Math.max(1, Math.ceil(totalIn / max));
  const each = Math.floor(totalIn / count / step) * step;
  const widths = Array.from({ length: count }, () => each);
  let spare = totalIn - each * count;
  for (let i = 0; spare >= step - 1e-6; i = (i + 1) % count) { widths[i] += step; spare -= step; }
  return { widths, scribeIn: spare > 1e-6 ? spare : 0 };
}
const fr = (x: number) => { const w = Math.floor(x + 1e-9); const r = Math.round((x - w) * 16); if (!r) return `${w}`; let n = r, d = 16; while (n % 2 === 0) { n /= 2; d /= 2; } return `${w ? w + "-" : ""}${n}/${d}`; };

/** Pack and lay out; returns segments [{id, from, to, code}] in inches from the run's start. */
function lay(available: number, items: It[]) {
  const packed = lt.packLeg(available, items);
  if (!("widths" in packed)) return { short: packed.shortIn };
  const segs: any[] = []; let at = 0, g = 0;
  for (const it of items) {
    if (it.kind === "fixed") { segs.push({ id: it.id, from: at, to: at + it.widthIn, code: it.modules.map((m: any) => m.code).join("+") }); at += it.widthIn; continue; }
    const total = packed.widths[g++]; if (total <= 0) continue;
    const c = counterWidths(total);
    c.widths.forEach((w, i) => { const s = i === c.widths.length - 1 ? c.scribeIn : 0; segs.push({ id: it.id, from: at, to: at + w + s, code: `B${w}${s ? "+BF" + fr(s) : ""}` }); at += w + s; });
  }
  return { segs, length: at };
}
const need = (items: It[]) => items.reduce((s: number, it: It) => s + (it.kind === "fixed" ? it.widthIn : it.minIn), 0);

const CORNER = () => F("corner", 42, "BBC42", "corner");
const PNL = (id: string) => F(id, 0.75, "PNL0.75");
const cols = (...xs: [string, number][]) => [PNL("tall-inner"), ...xs.map(([n, w]) => F(n, w, `T${w}96`)), PNL("tall-outer")];
const COFFEE = () => [PNL("coffee-panel-start"), F("coffee", 24, "T2496"), PNL("coffee-panel-end")];
const PANTRY = () => F("pantry", 15, "T1596");
const OVEN = () => F("oven-tower", 30, "T3096");
const SPARES = () => [F("microwave", 24, "RO24", "appliance"), F("divider", 0.75, "PNL0.75", "counter"), F("wine", 24, "RO24", "appliance")];
// Tall run: the corner's 12" (rule 1) and the refrigerator's 15" (rule 6) are one stretch when nothing stands between.
const tall: Record<string, It[]> = {
  A: [CORNER(), G("corner-landing", 12, "corner-to-range"), ...SPARES(), G("fridge-landing", 15), F("fridge", 37.5, "PNL0.75+T3696+PNL0.75")],
  B: [CORNER(), G("fridge-landing", 15, "corner-to-range"), ...cols(["fridge", 36], ["wine", 18]), PANTRY(), OVEN()],
  C: [CORNER(), G("corner-landing", 12, "corner-to-range"), ...SPARES(), G("fridge-landing", 15), F("fridge", 42, "PNL3+RO36+PNL3")],
  D: [CORNER(), G("fridge-landing", 15, "corner-to-range"), ...cols(["wine", 24], ["fridge", 30], ["freezer", 24]), ...COFFEE(), PANTRY(), OVEN()],
  E: [CORNER(), G("fridge-landing", 15, "corner-to-range"), ...cols(["fridge", 30], ["freezer", 18]), ...COFFEE(), PANTRY(), OVEN()],
};
// Working run: the wide 15" toward the sink (round the corner), the narrow 12" and the open end's 9" one stretch.
const cooking: Record<string, [number, string]> = { A: [36, "RO36"], B: [36, "B36"], C: [30, "RO30"], D: [36, "B36"], E: [36, "B36"] };
const working = (p: string, withMicrowave: boolean): It[] => [
  CORNER(),
  ...(withMicrowave ? [G("corner-landing", 12, "corner-to-range", { maxIn: 12 }), F("microwave", 24, "RO24", "appliance")] : []),
  G("range-landing-wide", 15, "range-to-sink"),
  F("cooking", cooking[p][0], cooking[p][1], "appliance"),
  G("range-landing-narrow", 12, "corner-to-range"),
  F("end-panel", 0.75, "BEP0.75", "counter"),
];
const back = (): It[] => [G("dishwasher-from-corner", 12), F("dishwasher", 24, "RO24", "appliance"), F("sink", 30, "SB30", "fixture"), G("sink-landing", 18)];

const SLAB = 120;
for (const p of ["A", "B", "C", "D", "E"]) {
  // D's microwave drawer: on the tall run unless that passes D13's 216" (the plan's rule).
  let tallItems = tall[p];
  let micOnWorking = false;
  if (p === "D") {
    const withMic = [...tallItems.slice(0, 2), F("microwave", 24, "RO24", "appliance"), ...tallItems.slice(2)];
    micOnWorking = need(withMic) > 216;
    if (!micOnWorking) tallItems = withMic;
  }
  const workItems = working(p, micOnWorking);
  const H = Math.max(need(tallItems), need(workItems), 96);
  const W = Math.max(need(back()) + 48, 98 + 0); // back run between the two 24" bites; the aisle's 48" is a floor
  const L = lay(H, tallItems), R = lay(H, workItems), B = lay(W - 48, back());
  console.log(`\n=== ${p}: back wall ${fr(W)}", side walls ${fr(H)}" (tall needs ${fr(need(tallItems))}, working ${fr(need(workItems))})${p === "D" ? `, microwave drawer on the ${micOnWorking ? "working" : "tall"} run` : ""}`);
  for (const [name, run, sk] of [["left (tall)", L, sketch[p].left], ["right (cooking)", R, sketch[p].right]] as const) {
    console.log(`  ${name}: ` + run.segs.map((s: any) => `${s.code} ${fr(s.to - s.from)}`).join(" | "));
    console.log(`  sketch    : ` + sk.map((s: any) => `${s.short ?? s.label} ${fr(s.w)}`).join(" | "));
  }
  console.log(`  back: ` + B.segs.map((s: any) => `${s.code} ${fr(s.to - s.from)}`).join(" | "));
  // Stone and the mid seam, as approved: each side leg's slab from the back wall; the right one to 1" past the open end.
  const rightStone = H + 1;
  const free = R.segs.find((s: any) => s.id === "cooking" && (s.code === "RO36" || s.code === "RO30"));
  if (free) console.log(`  right stone: ${fr(free.from)}" + ${fr(rightStone - free.to)}" (freestanding range breaks it)`);
  else if (rightStone > SLAB) {
    const least = rightStone - SLAB;
    const cut = R.segs.find((s: any) => s.id === "cooking");
    const joints = R.segs.map((s: any, i: number) => ({ at: s.to, next: R.segs[i + 1] })).filter((j: any) => j.next);
    const ok = joints.find((j: any) => j.at >= least - 1e-9 && j.at <= SLAB && !(j.at > cut.from - 1e-9 && j.at < cut.to + 1e-9) && !["RO24"].includes(R.segs.find((s: any) => Math.abs(s.from - j.at) < 1e-9)?.code) && !["RO24"].includes(R.segs.find((s: any) => Math.abs(s.to - j.at) < 1e-9)?.code));
    console.log(`  right stone ${fr(rightStone)}": first joint at or past ${fr(least)}" clear of cutout and machines: ${ok ? fr(ok.at) + '" -> ' + fr(ok.at) + '" + ' + fr(rightStone - ok.at) + '"' : "none"}; cutout ${fr(cut.from)}-${fr(cut.to)}"; joints ${joints.map((j: any) => fr(j.at)).join(", ")}`);
  } else console.log(`  right stone ${fr(rightStone)}" in one`);
  const leftStone = (() => { let a = 0; for (const s of L.segs) { if (/^T|^PNL0.75\+T|^PNL3/.test(s.code) || s.id === "tall-inner") break; a = s.to; } return a; })();
  console.log(`  left stone ${fr(leftStone)}", back stone ${fr(W - 50)}"`);
}
