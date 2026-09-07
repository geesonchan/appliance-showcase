import type { Finish, Lighting, RenderMode } from "../types";
import type { TextureKind } from "./textures";

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

/**
 * Utility colours are pulled apart in hue *and* saturation so the four
 * disciplines stay separable on a phone screen: saturated amber, saturated
 * red, deep indigo, and a teal that reads as water without competing with the
 * indigo. The duct stays neutral because it is the only large-diameter run.
 */
export const UTILITY_COLORS = {
  gas: "#F2A100",
  power120: "#1A56DB",
  power240: "#D93025",
  water: "#21A8B0",
  duct: "#8E938C",
} as const;

/**
 * Pipe radii in inches. Line weight carries the same ordering as real trades:
 * the gas line is the heaviest small run, then water, then the 240V feeder,
 * with 120V branch circuits thinnest.
 */
export const UTILITY_RADIUS_IN = {
  gas: 0.9,
  water: 0.7,
  power240: 0.55,
  power120: 0.4,
} as const;

/**
 * The finish a catalogue record names, as one of the room's own tokens.
 *
 * The sheet's vocabulary is a buyer's — "stainless", "matte black" — and the
 * room's is a surface's. Mapping one onto the other here means a steel
 * appliance and a steel countertop edge are the same steel, brushed the same
 * way, rather than two definitions of the colour of metal that drift apart.
 *
 * Panel-ready is the odd one: a machine sold without a front. It only lands
 * here if something has forgotten to resolve it against the cabinets, so it
 * gets the wood it would most likely be hung in.
 */
const FINISH_TOKENS: Record<Finish, FinishToken> = {
  stainless: "stainless",
  "panel-ready": "wood-oak",
  "matte-black": "black-stainless",
  white: "painted",
};

const FINISH_OVERRIDE: Partial<Record<Finish, string>> = {
  "matte-black": "#2A2D2A",
  white: "#F1F0EA",
};

export interface SurfaceProps {
  color: string;
  metalness: number;
  roughness: number;
  transparent: boolean;
  opacity: number;
  /** Colour map, when the surface has one. */
  map?: TextureKind;
  normalMap?: TextureKind;
  /** How many feet of room one tile of the map covers. */
  repeatFt?: number;
  normalScale?: number;
}

/**
 * The finishes a kitchen is specified in.
 *
 * A token rather than a colour: "the cabinet doors are painted" is a decision
 * about the surface, and the colour is a separate decision inside it. Quartz
 * and marble are the same slab thickness and differ only in what is drawn on
 * them; stainless and black stainless are the same steel at different
 * brightness. Keeping them as tokens is what lets the finish picker change one
 * without knowing anything about the geometry it lands on.
 */
export type FinishToken =
  | "painted"
  | "stainless"
  | "black-stainless"
  | "wood-oak"
  | "quartz-white"
  | "marble-veined"
  | "tile-white"
  | "floor-oak";

export const FINISHES: Record<FinishToken, Omit<SurfaceProps, "transparent" | "opacity">> = {
  // Cabinet paint: a satin sheen, not a gloss. The colour is supplied.
  painted: { color: SCENE_COLORS.cabinet, metalness: 0.02, roughness: 0.5 },
  // Steel is not rough so much as scratched one way, which is what the normal
  // map is for: a low roughness with a directional grain over it.
  stainless: {
    color: "#B9BDBA",
    metalness: 0.9,
    roughness: 0.35,
    normalMap: "brushed-normal",
    repeatFt: 1.2,
    normalScale: 0.35,
  },
  "black-stainless": {
    color: "#3A3D3B",
    metalness: 0.85,
    roughness: 0.42,
    normalMap: "brushed-normal",
    repeatFt: 1.2,
    normalScale: 0.3,
  },
  "wood-oak": { color: "#FFFFFF", metalness: 0, roughness: 0.62, map: "oak", repeatFt: 2 },
  "quartz-white": {
    color: "#FFFFFF",
    metalness: 0.02,
    roughness: 0.28,
    map: "quartz",
    repeatFt: 3,
  },
  "marble-veined": {
    color: "#FFFFFF",
    metalness: 0.02,
    roughness: 0.22,
    map: "marble",
    repeatFt: 5,
  },
  "tile-white": { color: "#FFFFFF", metalness: 0.03, roughness: 0.35, map: "tile", repeatFt: 1 },
  "floor-oak": { color: "#FFFFFF", metalness: 0, roughness: 0.72, map: "oak-floor", repeatFt: 4 },
};

/**
 * A finish, resolved against the render mode.
 *
 * The white model and the install view are deliberately without materials —
 * that is what they are for — so a token only survives into the realistic view.
 * `color` overrides the token's own, which is how four cabinet colours share one
 * painted finish.
 */
export function finish(
  mode: RenderMode,
  token: FinishToken,
  color?: string,
): SurfaceProps {
  const spec = FINISHES[token];
  const resolved = surface(mode, color ?? spec.color, {
    metalness: spec.metalness,
    roughness: spec.roughness,
  });
  if (mode !== "realistic") return resolved;
  return {
    ...resolved,
    map: spec.map,
    normalMap: spec.normalMap,
    repeatFt: spec.repeatFt,
    normalScale: spec.normalScale,
  };
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

export function finishSurface(mode: RenderMode, named: Finish): SurfaceProps {
  return finish(mode, FINISH_TOKENS[named], FINISH_OVERRIDE[named]);
}

export function floorColor(mode: RenderMode, lighting: Lighting): string {
  if (mode === "white") return SCENE_COLORS.whiteModel;
  return lighting === "night" ? SCENE_COLORS.floorNight : SCENE_COLORS.floor;
}

export function wallColor(mode: RenderMode, lighting: Lighting): string {
  if (mode === "white") return SCENE_COLORS.whiteModel;
  return lighting === "night" ? SCENE_COLORS.wallNight : SCENE_COLORS.wall;
}

/**
 * True when a machine is meant to disappear into the joinery.
 *
 * A panel-ready dishwasher is sold without a front: the cabinetmaker hangs the
 * same door on it as on the cabinet beside it, in the same wood or the same
 * paint, and the only steel you see is the handle. Drawing it in a generic
 * brown is drawing the one thing about it that is wrong.
 */
export const isPanelReady = (finishes: Finish[]) => finishes.includes("panel-ready");
