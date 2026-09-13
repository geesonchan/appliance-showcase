import { describe, expect, it } from "vitest";
import { RAIL_DEFAULTS, readRails, writeRails } from "./railState";

/** A stand-in for sessionStorage. */
function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

describe("rail state", () => {
  it("opens with the list closed and Configuration open", () => {
    expect(RAIL_DEFAULTS).toEqual({ leftOpen: false, rightOpen: true });
    expect(readRails(memory())).toEqual(RAIL_DEFAULTS);
    // No storage at all — a test runner, a locked-down browser — is the default too.
    expect(readRails(null)).toEqual(RAIL_DEFAULTS);
  });

  it("remembers what was changed, for the same storage", () => {
    const storage = memory();
    writeRails({ leftOpen: true, rightOpen: false }, storage);
    expect(readRails(storage)).toEqual({ leftOpen: true, rightOpen: false });
    // A fresh tab is a fresh storage, and gets the default back.
    expect(readRails(memory())).toEqual(RAIL_DEFAULTS);
  });

  it("falls back to the default on anything it cannot read", () => {
    const storage = memory();
    storage.setItem("appliance-showcase:rails", "not json");
    expect(readRails(storage)).toEqual(RAIL_DEFAULTS);
    storage.setItem("appliance-showcase:rails", JSON.stringify({ leftOpen: "yes" }));
    expect(readRails(storage)).toEqual(RAIL_DEFAULTS);
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readRails(throwing)).toEqual(RAIL_DEFAULTS);
    expect(() => writeRails({ leftOpen: true, rightOpen: true }, throwing)).not.toThrow();
  });
});
