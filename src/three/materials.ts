import type { Finish, Lighting, RenderMode } from "../types";

/** Palette used by the procedural scene, keyed to the §6 design tokens. */
export const SCENE_COLORS = {
  floor: "#C9A77B",
  floorNight: "#8E7455",
  wall: "#EFEDE6",
  wallNight: "#C3C4BD",
  cabinet: "#2E5C45",
  cabinetUpper: "#EDEAE1",
  counter: "#E4E1D6",
  toe: "#1F2A22",
  whiteModel: "#E2DFD4",
  wireframe: "#6B7268",
  selection: "#2E5C45",
};

export const UTILITY_COLORS = {
  gas: "#E0A800",
  power120: "#3B7DD8",
  power240: "#C0392B",
  water: "#7FC4E8",
  duct: "#9A9E97",
} as const;

const FINISH_COLORS: Record<Finish, string> = {
  stainless: "#B7BBB7",
  "panel-ready": "#C9A77B",
  "matte-black": "#2A2D2A",
  white: "#F1F0EA",
};

const FINISH_PBR: Record<Finish, { metalness: number; roughness: number }> = {
  stainless: { metalness: 0.85, roughness: 0.32 },
  "panel-ready": { metalness: 0.05, roughness: 0.75 },
  "matte-black": { metalness: 0.15, roughness: 0.7 },
  white: { metalness: 0.05, roughness: 0.6 },
};

export interface SurfaceProps {
  color: string;
  metalness: number;
  roughness: number;
  transparent: boolean;
  opacity: number;
}

/**
 * One place where render mode turns into material props. Layers stay mounted
 * across mode switches — only these values change — so switching modes never
 * rebuilds the scene graph.
 */
export function surface(
  mode: RenderMode,
  color: string,
  pbr: { metalness: number; roughness: number } = { metalness: 0.1, roughness: 0.8 },
): SurfaceProps {
  if (mode === "white") {
    return {
      color: SCENE_COLORS.whiteModel,
      metalness: 0,
      roughness: 0.95,
      transparent: false,
      opacity: 1,
    };
  }
  if (mode === "install") {
    return { color, metalness: 0, roughness: 0.9, transparent: true, opacity: 0.22 };
  }
  return { color, ...pbr, transparent: false, opacity: 1 };
}

export function finishSurface(mode: RenderMode, finish: Finish): SurfaceProps {
  return surface(mode, FINISH_COLORS[finish], FINISH_PBR[finish]);
}

export function floorColor(mode: RenderMode, lighting: Lighting): string {
  if (mode === "white") return SCENE_COLORS.whiteModel;
  return lighting === "night" ? SCENE_COLORS.floorNight : SCENE_COLORS.floor;
}

export function wallColor(mode: RenderMode, lighting: Lighting): string {
  if (mode === "white") return SCENE_COLORS.whiteModel;
  return lighting === "night" ? SCENE_COLORS.wallNight : SCENE_COLORS.wall;
}
