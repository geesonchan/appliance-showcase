import { beforeEach, describe, expect, it } from "vitest";
import { readTab, writeTab } from "./railState";
import { useAppStore } from "./useAppStore";

/**
 * The right panel's tabs. Round 91, Leo (round 80's plan, decision 4, and
 * round 91's decisions): Look by default; Install mode brings the Install tab
 * forward and leaving it puts back the tab that was showing, unless somebody
 * chose a tab meanwhile, which stays; only a chosen tab is kept for the
 * browser tab. docs/decisions.md D12, round 91.
 */

const OPENED = useAppStore.getState();
const store = () => useAppStore.getState();

beforeEach(() => {
  useAppStore.setState(OPENED, true);
});

describe("the right panel's tabs", () => {
  it("opens on Look", () => {
    expect(store().rightTab).toBe("look");
  });

  it("goes to Install when Install mode starts", () => {
    store().setRightTab("layout");
    store().setRenderMode("install");
    expect(store().rightTab).toBe("install");
  });

  it("goes back to the tab that was showing when Install mode ends", () => {
    store().setRightTab("layout");
    store().setRenderMode("install");
    store().setRenderMode("white");
    expect(store().rightTab).toBe("layout");
  });

  it("stays on a tab somebody chose while in Install mode", () => {
    store().setRightTab("layout");
    store().setRenderMode("install");
    store().setRightTab("list");
    store().setRenderMode("realistic");
    expect(store().rightTab).toBe("list");
  });

  it("stays on Install when it was the tab chosen before Install mode", () => {
    store().setRightTab("install");
    store().setRenderMode("install");
    store().setRenderMode("realistic");
    expect(store().rightTab).toBe("install");
  });

  it("changes no tab between two modes that are not Install", () => {
    store().setRightTab("list");
    store().setRenderMode("white");
    store().setRenderMode("realistic");
    expect(store().rightTab).toBe("list");
  });
});

describe("what the browser tab keeps", () => {
  /** A storage of its own, as sessionStorage is per browser tab. */
  const memory = () => {
    const values = new Map<string, string>();
    return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value) };
  };

  it("reads Look where nothing is kept", () => {
    expect(readTab(memory())).toBe("look");
  });

  it("reads back a tab that was kept", () => {
    const storage = memory();
    writeTab("list", storage);
    expect(readTab(storage)).toBe("list");
  });

  it("reads Look for anything else", () => {
    const storage = memory();
    storage.setItem("appliance-showcase:right-tab", "price");
    expect(readTab(storage)).toBe("look");
  });
});
