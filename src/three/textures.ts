import * as THREE from "three";

/**
 * The room's textures, drawn rather than downloaded.
 *
 * Every one of these is a few lines of canvas: brushed steel is streaks, oak is
 * bands with grain in them, marble is veins, tile is a grid. Procedural because
 * the alternative is shipping a megabyte of photographs for surfaces the camera
 * mostly sees at forty-five degrees from ten feet away — and because a repo with
 * no binary assets in it stays a repo anybody can read. `docs/reference/
 * assets.md` records that choice and what it would take to swap in real maps.
 *
 * They are generated once per size and cached: a phone gets half-resolution
 * maps, and the quality guard can ask for them again at the smaller size
 * without the scene noticing.
 */

/** A repeatable noise, so the same room draws the same way every time. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export type TextureKind =
  | "brushed-normal"
  | "oak"
  | "oak-floor"
  | "marble"
  | "quartz"
  | "tile";

const cache = new Map<string, THREE.Texture>();

function canvas(size: number) {
  const element = document.createElement("canvas");
  element.width = size;
  element.height = size;
  return { element, ctx: element.getContext("2d")! };
}

/**
 * Brushed stainless, as a normal map.
 *
 * Steel is not rough so much as scratched in one direction, which is why a
 * fridge door shows a band of reflection rather than a blur. Fine horizontal
 * streaks in the red channel tilt the normal side to side and do exactly that.
 */
function brushedNormal(size: number) {
  const { element, ctx } = canvas(size);
  const next = random(7);
  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 12; i += 1) {
    const y = Math.floor(next() * size);
    const x = next() * size;
    const length = 6 + next() * size * 0.4;
    const tilt = Math.floor(112 + next() * 32);
    ctx.strokeStyle = `rgb(${tilt},128,255)`;
    ctx.lineWidth = next() < 0.2 ? 1.5 : 0.75;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + length, y);
    ctx.stroke();
  }
  return element;
}

/** Oak: warm bands with the grain running along them. */
function oak(size: number, dark: boolean) {
  const { element, ctx } = canvas(size);
  const next = random(dark ? 21 : 13);
  const base = dark ? "#9A7448" : "#C6A276";
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 26; i += 1) {
    const y = next() * size;
    const height = size * (0.01 + next() * 0.05);
    ctx.fillStyle = `rgba(${dark ? "60,42,24" : "120,88,54"},${0.06 + next() * 0.14})`;
    ctx.fillRect(0, y, size, height);
  }
  // The grain itself: long wandering lines, which is what reads as wood.
  for (let i = 0; i < size / 2; i += 1) {
    const y = next() * size;
    ctx.strokeStyle = `rgba(${dark ? "56,38,20" : "110,80,48"},${0.05 + next() * 0.2})`;
    ctx.lineWidth = next() < 0.15 ? 1.6 : 0.7;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += size / 16) {
      ctx.lineTo(x, y + Math.sin((x / size) * Math.PI * (1 + next())) * size * 0.012);
    }
    ctx.stroke();
  }
  return element;
}

/** Marble: a pale ground with veins running across it. */
function marble(size: number) {
  const { element, ctx } = canvas(size);
  const next = random(31);
  ctx.fillStyle = "#F2F1EC";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 14; i += 1) {
    const width = next() < 0.3 ? 2.4 : 1;
    ctx.strokeStyle = `rgba(120,124,126,${0.1 + next() * 0.28})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    let x = -size * 0.1;
    let y = next() * size;
    ctx.moveTo(x, y);
    while (x < size * 1.1) {
      x += size * (0.05 + next() * 0.1);
      y += (next() - 0.5) * size * 0.22;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return element;
}

/** Engineered quartz: near-white with a fine speckle, and no veining. */
function quartz(size: number) {
  const { element, ctx } = canvas(size);
  const next = random(5);
  ctx.fillStyle = "#EFEEE8";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 8; i += 1) {
    const shade = Math.floor(190 + next() * 55);
    ctx.fillStyle = `rgba(${shade},${shade},${shade - 6},${0.25 + next() * 0.4})`;
    ctx.fillRect(next() * size, next() * size, 1 + next(), 1 + next());
  }
  return element;
}

/** Square tile with a grout line, for the splash behind the range. */
function tile(size: number) {
  const { element, ctx } = canvas(size);
  const cells = 4;
  const cell = size / cells;
  ctx.fillStyle = "#CFCCC2";
  ctx.fillRect(0, 0, size, size);
  const inset = Math.max(1, size / 128);
  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      ctx.fillStyle = "#F4F2EC";
      ctx.fillRect(x * cell + inset, y * cell + inset, cell - inset * 2, cell - inset * 2);
    }
  }
  return element;
}

const DRAW: Record<TextureKind, (size: number) => HTMLCanvasElement> = {
  "brushed-normal": brushedNormal,
  oak: (size) => oak(size, false),
  "oak-floor": (size) => oak(size, true),
  marble,
  quartz,
  tile,
};

/**
 * A texture, made once and kept.
 *
 * `repeat` is in world units — the room is measured in feet, so a floor plank
 * texture repeating every 2 feet is `repeat: 2`, not a guess in UV space. The
 * caller sets it because the same oak serves a 12-foot floor and a 2-foot door.
 */
export function texture(kind: TextureKind, size: number): THREE.Texture {
  const key = `${kind}@${size}`;
  const found = cache.get(key);
  if (found) return found;

  const made = new THREE.CanvasTexture(DRAW[kind](size));
  made.wrapS = THREE.RepeatWrapping;
  made.wrapT = THREE.RepeatWrapping;
  made.anisotropy = 4;
  // A normal map carries directions, not colour, so it must not be gamma
  // corrected on the way in.
  made.colorSpace =
    kind === "brushed-normal" ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  cache.set(key, made);
  return made;
}

/** Drop every cached map. Called when the quality tier changes. */
export function disposeTextures() {
  for (const map of cache.values()) map.dispose();
  cache.clear();
}
