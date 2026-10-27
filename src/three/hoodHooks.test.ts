import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The chimney fillers' round, Leo: the hood's geometry was made after the
 * insert liner's early `return` in `Hood` (`ApplianceModel.tsx`) — a hook
 * called on some renders and not others (registered in the geometries'
 * round). Nothing went wrong only because every hood chosen makes the whole
 * room again (`layoutVersion`, `Scene.tsx`), and with it this component; a
 * hood changing kind in a component still standing would throw. Fixed here,
 * so it no longer leans on that.
 *
 * Read off the source, as `sceneFrame.test.ts` does: the page cannot show it
 * today, for the reason above (`tests/hoodKinds.test.ts` swaps the kinds in
 * the page). Every hook in `Hood` is called before its first `return`.
 */

describe("the hood's hooks (the chimney fillers' round)", () => {
  it("are all called before Hood's first return", () => {
    const source = readFileSync("src/three/ApplianceModel.tsx", "utf8");
    const start = source.indexOf("\nfunction Hood(");
    expect(start).toBeGreaterThan(0);
    // To the end of the function: the next line that closes a block at the margin.
    const end = source.indexOf("\n}\n", start);
    // The code only: a comment may well say "return".
    const body = source
      .slice(start, end)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\/.*$/gm, "");
    const firstReturn = body.search(/\breturn\b/);
    const hooks = [...body.matchAll(/\buse[A-Z]\w*\(/g)].map((match) => ({ hook: match[0], at: match.index! }));
    expect(hooks.length).toBeGreaterThan(0);
    expect(hooks.filter(({ at }) => at > firstReturn).map(({ hook }) => hook)).toEqual([]);
  });
});
