/**
 * A part of the page made to fail on purpose, for the tests only. Round 99c,
 * Leo: "测试用只给测试用的开关故意出错（和 qualityLock 同一种做法）".
 *
 * A page opened with `?fault=<part>` has that part throw while it draws, until
 * its fence is retried — the Retry button, or a package switch — so a test can
 * see the fence take the failure and give the part back. On no control and in
 * no share link; a page opened without it draws as it always has.
 */

/** The parts a fence stands round (round 99c), by the name the visit counter knows them by. */
export const PARTS = ["right-panel", "scene", "left-panel", "quote", "link-notice"] as const;
export type Part = (typeof PARTS)[number];

/** The part this page was asked to fail, if any. */
export const FAULT: string | null =
  typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("fault");

const cleared = new Set<string>();

/**
 * Throws while this part is the one asked to fail and has not been retried.
 * Not a one-off: React draws a part once more after it throws, and a fault
 * that had already gone would show nothing.
 */
export function FaultProbe({ part }: { part: Part }): null {
  if (FAULT === part && !cleared.has(part)) throw new Error(`?fault=${part}: failing on purpose`);
  return null;
}

/** A retry clears the fault asked for, so the part comes back. */
export function clearFault(part: Part) {
  cleared.add(part);
}
