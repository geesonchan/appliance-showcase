import { cabinetToken, useAppStore } from "../store/useAppStore";

/**
 * When the quality guard gives up a tier, as a rule of its own (round 100), so
 * it can be asked without a renderer. `QualityGuard` counts the frames and
 * asks this once a second.
 */

/** Below this, for this long, the room is not worth the pixels it costs. */
export const FLOOR_FPS = 55;
export const PATIENCE_MS = 2000;
/**
 * How long after a rebuild nothing is judged. Round 100, Leo, option A, N = 2:
 * the second or two after a package switch dipped under 55 on a machine that
 * draws at sixty the rest of the time, and the guard took it for a machine
 * that cannot draw the room — and never went back up. The same reason as the
 * first second after the page opens, when the shaders are compiling.
 */
export const GRACE_MS = 2000;

export interface Second {
  /** Frames drawn in the second just counted. */
  fps: number;
  /** When that second began, on `performance.now()`'s clock. */
  startedAt: number;
  /** Whether the tab was showing. */
  visible: boolean;
}

/**
 * One second judged: how long the room has been slow, and whether to drop.
 * A second that began before `quietUntil` — the end of the grace after the
 * last rebuild — is not judged, and the count starts again after it.
 */
export function judgeSecond(
  slowForMs: number,
  second: Second,
  quietUntil = -Infinity,
): { slowForMs: number; drop: boolean } {
  // A hidden tab is throttled to about 1Hz. Judging a room on that would
  // downgrade every scene anybody ever left in a background tab.
  if (!second.visible) return { slowForMs: 0, drop: false };
  if (second.startedAt < quietUntil) return { slowForMs: 0, drop: false };
  const slow = second.fps < FLOOR_FPS ? slowForMs + 1000 : 0;
  return { slowForMs: slow, drop: slow >= PATIENCE_MS };
}

/** The guard's judge, one per page: seconds in, a drop out. */
export function createJudge(now: () => number) {
  let slowForMs = 0;
  let quietUntil = -Infinity;
  return {
    /** The scene was rebuilt or made heavier: the next two seconds are not judged. */
    changed() {
      quietUntil = now() + GRACE_MS;
      slowForMs = 0;
    },
    /** One second counted; true when the room should drop a tier. */
    second(second: Second): boolean {
      const judged = judgeSecond(slowForMs, second, quietUntil);
      slowForMs = judged.slowForMs;
      return judged.drop;
    },
  };
}

type SceneState = Pick<
  ReturnType<typeof useAppStore.getState>,
  | "layoutVersion"
  | "selection"
  | "blowerId"
  | "renderMode"
  | "lighting"
  | "finishes"
  | "leftOpen"
  | "rightOpen"
  | "lang"
  | "rightTab"
  | "mobilePanel"
>;

/**
 * The finishes as far as they change a texture (round 100, Leo: "a finish that
 * changes a texture"): the doors' material — paint or oak — and the accent
 * run's where it differs, the countertop, the floor and a tile floor's size.
 * A colour changed within paint, the walls' paint, and a tile size kept for an
 * oak floor recolour or redraw nothing heavy.
 */
function textureKey(finishes: SceneState["finishes"]): string {
  const doors = cabinetToken(finishes.cabinet);
  const accent = cabinetToken(finishes.accent);
  const run = finishes.accentRun !== "none" && accent !== doors ? `${finishes.accentRun}:${accent}` : "";
  const floor = finishes.floor === "floor-tile" ? `floor-tile-${finishes.tileSize}` : finishes.floor;
  return [doors, run, finishes.counter, floor].join("|");
}

/**
 * What the scene is drawn from, as one string: when it changes, the scene was
 * rebuilt or made heavier (round 100, Leo's list). The room (`layoutVersion`,
 * every rebuild), the models and the blower, the render mode, day or night,
 * the finishes that change a texture, and the two side rails, whose folding
 * resizes the canvas. And, Leo after the first build, the language and a tab
 * opened: a tab's controls are worked out when it mounts, and a page that
 * changes its every word is a page re-laid; on a phone a tab is shown in the
 * Configure sheet, so the sheet opened or closed. Not the camera, the toggles
 * or a message.
 */
export function sceneKey(state: SceneState): string {
  return JSON.stringify([
    state.layoutVersion,
    state.selection,
    state.blowerId,
    state.renderMode,
    state.lighting,
    textureKey(state.finishes),
    state.leftOpen,
    state.rightOpen,
    state.lang,
    state.rightTab,
    state.mobilePanel,
  ]);
}

/** Calls `onChange` whenever the store's scene key changes; returns the unsubscribe. */
export function watchScene(
  store: { subscribe: (listener: (state: SceneState, previous: SceneState) => void) => () => void },
  onChange: () => void,
): () => void {
  return store.subscribe((state, previous) => {
    if (sceneKey(state) !== sceneKey(previous)) onChange();
  });
}
