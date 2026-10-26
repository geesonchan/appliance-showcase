import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Round 99d, Leo: an error thrown in a frame is to reach the 3D scene's fence
 * and show its message and Retry, not stop on an empty canvas. @react-three/
 * fiber calls every `useFrame` callback from its frame loop with nothing to
 * catch what one throws (`render$1`, events-776716bd.esm.js:1530-1543), so
 * every frame's work goes through `useSceneFrame`, which hands a failure to
 * the scene's fence. This holds that there is no other way in: no file but
 * that one takes `useFrame` from fiber itself (D17: one rule, one place).
 */

describe("every frame's work goes through useSceneFrame (round 99d)", () => {
  it("is the only file that takes useFrame from @react-three/fiber", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) files.push(path.replace(/\\/g, "/"));
      }
    };
    walk("src");
    const taking = files.filter((file) =>
      /import\s*\{[^}]*\buseFrame\b[^}]*\}\s*from\s*["']@react-three\/fiber["']/.test(readFileSync(file, "utf8")),
    );
    expect(taking).toEqual(["src/three/useSceneFrame.ts"]);
  });
});
