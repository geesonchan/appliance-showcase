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
  | "blank"
  | "blank-normal"
  | "brushed-normal"
  | "oak"
  | "oak-floor"
  | "marble"
  | "quartz"
  | "tile";

const cache = new Map<string, THREE.Texture>();

/**
 * The part of a 2D context these textures use.
 *
 * Named rather than taken from the DOM, so a test can pass something that
 * records the strokes instead of drawing them — which is the only way to ask
 * "is marble different from quartz, and is either of them more than a flat
 * colour" without a canvas to rasterise onto.
 */
export interface Ink {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  lineCap?: CanvasLineCap;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rotation: number,
    from: number,
    to: number,
  ): void;
  stroke(): void;
}

function canvas(size: number) {
  const element = document.createElement("canvas");
  element.width = size;
  element.height = size;
  return { element, ctx: element.getContext("2d")! as unknown as Ink };
}

/**
 * Brushed stainless, as a normal map.
 *
 * Steel is not rough so much as scratched in one direction, which is why a
 * fridge door shows a band of reflection rather than a blur. Fine horizontal
 * streaks in the red channel tilt the normal side to side and do exactly that.
 */
export function brushedNormal(ctx: Ink, size: number) {
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
}

/**
 * Oak: boards in four tones, with growth rings running along them.
 *
 * The four tones are the point. A single brown with lines scratched into it
 * reads as brown paper; a floor reads as wood because one board is lighter than
 * the one beside it, and the eye finds the seam between them before it finds
 * any grain. So this lays boards across the tile, gives each a shade off a
 * four-step ladder, darkens the seam, and only then draws rings in it.
 *
 * The grain runs along the texture's x axis. A surface that wants it the other
 * way rotates the map rather than getting a texture of its own — which is how a
 * door frame runs one way and the panel inside it runs the other.
 */
export function oak(ctx: Ink, size: number, dark: boolean) {
  const next = random(dark ? 21 : 13);
  const tones = dark
    ? ["#B08A5E", "#9C7448", "#87613C", "#A67F53"]
    : ["#D6B58C", "#C6A276", "#B18F63", "#CDAA80"];
  const ink = dark ? "48,32,18" : "100,72,44";

  const boards = 4;
  const boardH = size / boards;
  const hair = Math.max(1, size / 256);

  for (let b = 0; b < boards; b += 1) {
    const top = b * boardH;
    ctx.fillStyle = tones[Math.floor(next() * tones.length)];
    ctx.fillRect(0, top, size, boardH);

    // The seam between two boards: a shadow with a lit chamfer under it.
    ctx.fillStyle = `rgba(${ink},0.5)`;
    ctx.fillRect(0, top, size, hair);
    ctx.fillStyle = "rgba(255,248,236,0.18)";
    ctx.fillRect(0, top + hair, size, hair * 0.7);

    // Growth rings: long wandering lines along the board, never across it.
    const rings = Math.max(6, Math.round(boardH / 4));
    for (let i = 0; i < rings; i += 1) {
      const at = top + hair * 2 + next() * (boardH - hair * 3);
      const wander = boardH * 0.05;
      const phase = next() * Math.PI * 2;
      ctx.strokeStyle = `rgba(${ink},${0.1 + next() * 0.32})`;
      ctx.lineWidth = next() < 0.2 ? 1.8 : 0.8;
      ctx.beginPath();
      ctx.moveTo(0, at);
      for (let x = 0; x <= size; x += size / 24) {
        ctx.lineTo(x, at + Math.sin(phase + (x / size) * Math.PI * 2) * wander);
      }
      ctx.stroke();
    }

    // A knot or two, which is what stops it reading as a printed pattern.
    if (next() < 0.4) {
      const kx = next() * size;
      const ky = top + boardH * (0.3 + next() * 0.4);
      const r = boardH * 0.07;
      ctx.strokeStyle = `rgba(${ink},0.4)`;
      ctx.lineWidth = 1.2;
      for (let ring = 1; ring <= 3; ring += 1) {
        ctx.beginPath();
        ctx.ellipse(kx, ky, r * ring * 1.6, r * ring, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}

/**
 * Marble: a warm white ground with two or three big veins across it.
 *
 * The scale is the point. Marble reads as marble because a vein crosses the
 * whole slab in one sweep, half an inch wide, with a soft edge and finer
 * branches running off it — not because the surface is speckled. That is
 * quartz, and drawing both as noise is why the two came out looking the same.
 *
 * Each vein is drawn three times: a wide pale pass for the bleed into the
 * stone, a narrower mid pass, and a thin dark line down the middle. That is
 * what a soft edge is, without a blur to do it with.
 */
export function marble(ctx: Ink, size: number) {
  const next = random(31);
  ctx.fillStyle = "#F4F1EA";
  ctx.fillRect(0, 0, size, size);

  /** One vein, wandering from one edge of the tile to the other. */
  const vein = (
    from: { x: number; y: number },
    slope: number,
    width: number,
    ink: string,
    depth: number,
  ) => {
    let { x, y } = from;
    const step = size / 7;
    const points: { x: number; y: number }[] = [{ x, y }];
    while (x < size * 1.2) {
      x += step;
      y += step * slope + (next() - 0.5) * size * 0.09;
      points.push({ x, y });
    }
    // Three passes, widest and palest first: the bleed, the body, the line.
    for (const [scale, alpha] of [
      [3.2, 0.1],
      [1.7, 0.22],
      [1, 0.42],
    ]) {
      ctx.strokeStyle = `rgba(${ink},${alpha * depth})`;
      ctx.lineWidth = Math.max(0.6, width * scale);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length - 1; i += 1) {
        const mid = {
          x: (points[i].x + points[i + 1].x) / 2,
          y: (points[i].y + points[i + 1].y) / 2,
        };
        ctx.quadraticCurveTo(points[i].x, points[i].y, mid.x, mid.y);
      }
      ctx.stroke();
    }
    return points;
  };

  // Two or three main veins, running diagonally and well apart, each half an
  // inch wide at a foot of stone per two feet of tile.
  const main = 2 + Math.floor(next() * 2);
  const wide = size / 24;
  for (let i = 0; i < main; i += 1) {
    const spine = vein(
      { x: -size * 0.2, y: size * (0.15 + (i / main) * 0.7) },
      0.35 + next() * 0.5,
      wide,
      "108,110,112",
      1,
    );
    // Finer branches, leaving the spine at a shallower angle.
    for (let b = 0; b < 3; b += 1) {
      const at = spine[1 + Math.floor(next() * (spine.length - 2))];
      vein(at, -0.2 + next() * 0.9, wide * 0.3, "126,128,130", 0.75);
    }
  }
}

/**
 * Engineered quartz: a solid ground with a fine even speckle and no veining.
 *
 * Speckle is what quartz is: crushed stone in resin, the same all over, with
 * no direction and no feature bigger than a grain. Nothing here is wider than a
 * sixteenth of an inch at the scale the counter is drawn.
 */
export function quartz(ctx: Ink, size: number) {
  const next = random(5);
  ctx.fillStyle = "#EFEEE8";
  ctx.fillRect(0, 0, size, size);
  // A sixteenth of an inch at three feet of counter per tile.
  const grain = Math.max(1, size / 576);
  for (let i = 0; i < size * 14; i += 1) {
    const shade = Math.floor(196 + next() * 52);
    ctx.fillStyle = `rgba(${shade},${shade},${shade - 8},${0.3 + next() * 0.45})`;
    ctx.fillRect(next() * size, next() * size, grain, grain);
  }
}

/** Square tile with a grout line, for the splash behind the range. */
export function tile(ctx: Ink, size: number) {
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
}

/**
 * A single white pixel, and a single flat normal.
 *
 * Not decoration: they are what a mapped surface wears in the white model and
 * the install view. Dropping the map instead would change which shader the
 * material compiles to, and a mode switch would pay to swap the program on
 * every cabinet in the room. A white pixel multiplies to nothing and a flat
 * normal perturbs nothing, so the picture is the same and the program is too.
 */
function flat(colour: string) {
  return (ctx: Ink, size: number) => {
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, size, size);
  };
}

/** What draws each map. Exported so a test can run one against a recorder. */
export const DRAW: Record<TextureKind, (ctx: Ink, size: number) => void> = {
  blank: flat("#ffffff"),
  "blank-normal": flat("#8080ff"),
  "brushed-normal": brushedNormal,
  oak: (ctx, size) => oak(ctx, size, false),
  "oak-floor": (ctx, size) => oak(ctx, size, true),
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

  const px = kind === "blank" || kind === "blank-normal" ? 1 : size;
  const { element, ctx } = canvas(px);
  DRAW[kind](ctx, px);
  const made = new THREE.CanvasTexture(element);
  made.wrapS = THREE.RepeatWrapping;
  made.wrapT = THREE.RepeatWrapping;
  made.anisotropy = 4;
  // A normal map carries directions, not colour, so it must not be gamma
  // corrected on the way in.
  made.colorSpace =
    kind === "brushed-normal" || kind === "blank-normal"
      ? THREE.NoColorSpace
      : THREE.SRGBColorSpace;
  cache.set(key, made);
  return made;
}

/** Drop every cached map. Called when the quality tier changes. */
export function disposeTextures() {
  for (const map of cache.values()) map.dispose();
  cache.clear();
}
