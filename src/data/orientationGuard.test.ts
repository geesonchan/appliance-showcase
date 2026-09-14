import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Nothing works out which way a thing faces on its own. Round 50, D22.
 *
 * The round-49 sweep found sixteen places that got an island wrong, and each
 * round that fixed some added more: round 49's own fixes were two new copies of
 * a turn, and the three places fixed by then used three different spellings.
 * So the rule is a test: outside `frame.ts`, a hand-written turn, a branch on a
 * strip's axis, or a guess at a box's facing from its proportions is a failure.
 *
 * What it can see is spelling, not meaning. A position written as though the
 * back wall were the only wall — `-ROOM.halfZ` as "behind the machine" — is not
 * a pattern it can tell from the room's own walls, so those are named in
 * `PENDING` by the step that fixes them rather than found.
 *
 * `PENDING` is the list of what is still written by hand, file by file, with
 * how many times and which step takes it. It is exact: a file with more hits
 * than it is allowed fails, and so does one with fewer, so a site migrated
 * without its entry being cut fails too and the list cannot go stale.
 */

const PATTERNS: { name: string; pattern: RegExp }[] = [
  // Math.cos(slot.rotationY), Math.sin(rotationY) ...
  { name: "turn written by hand", pattern: /Math\.(sin|cos)\([^)]*rotation/g },
  // island.axis === "x" ? ... : ..., and a bare axis === "z"
  { name: "branch on an axis", pattern: /\baxis\s*[!=]==?\s*"(x|z)"/g },
  // local.applyAxisAngle(new THREE.Vector3(0, 1, 0), slot.rotationY) — the
  // argument has brackets of its own, so the pattern reads to the end of the line.
  { name: "turn through three.js", pattern: /applyAxisAngle\(.*rotation/g },
  // Math.abs(slot.rotationY) > 0.01, slot.rotationY - Math.PI / 2
  { name: "turn read by size", pattern: /Math\.abs\([^)]*rotationY|rotationY\s*[-+]\s*Math\.PI/g },
  // box.size[0] < box.size[2]; Math.abs(max[0] - min[0]) > Math.abs(max[2] - min[2])
  {
    name: "facing guessed from proportions",
    pattern: /size\[0\]\s*[<>]=?\s*[\w.]*size\[2\]|max\[0\]\s*-\s*[\w.]*min\[0\]\)\s*>\s*Math\.abs/g,
  },
];

/** Where turns are allowed to be written: the one place that writes them. */
const FRAME_MODULE = "src/data/frame.ts";

/**
 * What is still written by hand, and the step that takes it (D22). Counts are
 * exact. Step 2 fixes the ones that are wrong today; step 3 the ones that are
 * wrong once a hood hangs over the island.
 */
// Round 50, step 2: the four that were here — doors, leader lines, the wall
// anchor and the plan thumbnail — now read `facing`, and the list is empty.
// Step 3's sites are back-wall assumptions this guard cannot see (D22).
const PENDING: Record<string, { hits: number; step: 2 | 3; why: string }> = {};

/**
 * Where a turn is decided rather than read: allowed, permanently, at the count
 * given. `islandFor` is where the orientation parameter becomes an island on
 * one axis or the other, and where it stands off which run — the one place an
 * axis is chosen rather than asked.
 */
const ORIGIN: Record<string, { hits: number; why: string }> = {
  "src/data/layoutTemplate.ts": {
    hits: 2,
    why: "islandFor: which wall the island starts from, turned along the back wall or across the room",
  },
};

/** Both lists, for the checks: the counts are held exactly either way. */
const ALLOWED: Record<string, { hits: number }> = { ...PENDING, ...ORIGIN };

const ROOT = join(__dirname, "..", "..");

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sources(path));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/** Every hit in a piece of source, as `line: pattern: text`. */
export function scan(text: string): string[] {
  const hits: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    // A comment may describe a turn; only code is held to it.
    const code = line.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
    for (const { name, pattern } of PATTERNS) {
      for (const _match of code.matchAll(pattern)) hits.push(`${i + 1}: ${name}: ${line.trim()}`);
    }
  });
  return hits;
}

describe("the guard sees what it is for", () => {
  it.each([
    "const cos = Math.cos(slot.rotationY);",
    'const across = island.axis === "x" ? 2 : 0;',
    "local.applyAxisAngle(UP, slot.rotationY);",
    // Round 50: these two got past the first version of the patterns.
    "local.applyAxisAngle(new THREE.Vector3(0, 1, 0), slot.rotationY);",
    'const x = axis === "x" ? along : across;',
    "const alongZ = Math.abs(slot.rotationY) > 0.01;",
    "const onLeftWall = Math.abs(slot.rotationY - Math.PI / 2) < 0.01;",
    "const alongZ = box.size[0] < box.size[2];",
    "if (Math.abs(host.max[0] - host.min[0]) > Math.abs(host.max[2] - host.min[2])) {",
  ])("catches %s", (line) => {
    expect(scan(line)).toHaveLength(1);
  });

  it.each([
    "const [x, z] = toPlan(slot, across, out);",
    "rotation={[0, slot.rotationY, 0]}",
    "// Math.cos(slot.rotationY) is what toPlan does",
    "const offset = isoOffset(distance, azimuth, pitch);",
  ])("lets %s through", (line) => {
    expect(scan(line)).toEqual([]);
  });
});

describe("nothing outside frame.ts works out which way a thing faces", () => {
  const files = sources(join(ROOT, "src"));
  const found = new Map<string, string[]>();
  for (const path of files) {
    const file = relative(ROOT, path).split(sep).join("/");
    if (file === FRAME_MODULE) continue;
    const hits = scan(readFileSync(path, "utf8"));
    if (hits.length > 0) found.set(file, hits);
  }

  it("scans the source it means to", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((path) => path.endsWith(join("data", "frame.ts")))).toBe(true);
  });

  it("finds nothing new", () => {
    const unexpected = [...found.entries()]
      .filter(([file]) => !ALLOWED[file])
      .map(([file, hits]) => `${file}\n  ${hits.join("\n  ")}`);
    expect(unexpected, unexpected.join("\n")).toEqual([]);
  });

  it("finds exactly what is pending or allowed, so neither list can go stale", () => {
    const wrong = Object.entries(ALLOWED)
      .filter(([file, entry]) => (found.get(file)?.length ?? 0) !== entry.hits)
      .map(
        ([file, entry]) =>
          `${file}: allowed ${entry.hits}, found ${found.get(file)?.length ?? 0}` +
          `\n  ${(found.get(file) ?? []).join("\n  ")}`,
      );
    expect(wrong, wrong.join("\n")).toEqual([]);
  });

  it("has nothing left pending", () => {
    // D22: step 2 took the four that were wrong today. Nothing is allowed to be
    // added back here as a tolerance; a new site is migrated, not listed.
    expect(PENDING).toEqual({});
  });
});
