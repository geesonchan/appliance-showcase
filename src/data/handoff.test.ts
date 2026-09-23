import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The handoff brief points at decisions, and the decisions are still there
 * (round 72).
 *
 * `docs/HANDOFF.md` is an index: it names a D number rather than repeating what
 * that section says. An index rots silently — a section renumbered, a decision
 * folded into another — and the next person to pick the project up reads a
 * pointer into nothing. This turns that into a red run.
 *
 * It does not check what the sections say. That is the point of the brief being
 * an index: the words live in one place.
 */
const handoff = readFileSync("docs/HANDOFF.md", "utf8");
const decisions = readFileSync("docs/decisions.md", "utf8");

/** Every `D12`-style reference in the brief, in the order it makes them. */
const mentioned = [...new Set([...handoff.matchAll(/\bD(\d+)\b/g)].map((m) => Number(m[1])))].sort(
  (a, b) => a - b,
);
/** Every section the decisions file actually has: `## D12 · ...`. */
const sections = new Set([...decisions.matchAll(/^## D(\d+)\b/gm)].map((m) => Number(m[1])));

describe("the handoff brief", () => {
  it("mentions decisions at all, so the check below is not an empty pass", () => {
    expect(mentioned.length).toBeGreaterThan(10);
  });

  it("points only at sections docs/decisions.md has", () => {
    const missing = mentioned.filter((d) => !sections.has(d));
    expect(missing.map((d) => `D${d}`)).toEqual([]);
  });

  it("names every section, so a new decision is not left out of the index", () => {
    const unmentioned = [...sections].filter((d) => !mentioned.includes(d)).sort((a, b) => a - b);
    expect(unmentioned.map((d) => `D${d}`)).toEqual([]);
  });
});
