import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * This machine and CI on one Node version (round 93, Leo: the major, 24).
 *
 * Round 92's first push passed `npm run test:unit` here, on Node 24, and failed
 * it in CI, on Node 20 — three tests spawned `node` on a `.ts` file, which only
 * the newer runs (D4 and D17, round 92). The version is written once, in
 * `.nvmrc`; `package.json`'s engines say the same, and the workflow reads the
 * file (`node-version-file`) rather than a number of its own. This runs in both
 * places, so whichever of them is on another major goes red.
 */
const nvmrc = readFileSync(".nvmrc", "utf8").trim();
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { engines?: { node?: string } };
const workflow = readFileSync(".github/workflows/pages.yml", "utf8");

describe("one Node version, here and in CI", () => {
  it("is a major written once, in .nvmrc", () => {
    expect(nvmrc).toBe("24");
  });

  it("runs this suite on that major", () => {
    expect(process.versions.node.split(".")[0]).toBe(nvmrc);
  });

  it("has package.json's engines ask for that major and no other", () => {
    expect(pkg.engines?.node).toBe(`>=${nvmrc} <${Number(nvmrc) + 1}`);
  });

  it("has the workflow read .nvmrc, with no version of its own", () => {
    expect({
      readsFile: /node-version-file:\s*\.nvmrc/.test(workflow),
      ownVersion: /node-version:\s*\S/.test(workflow),
    }).toEqual({ readsFile: true, ownVersion: false });
  });
});
