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
 * Marble, drawn the way a Calacatta or a Statuario slab actually looks.
 *
 * Observed from photographs rather than invented; the notes are in
 * docs/reference/assets.md. What matters, in the order the eye takes it in:
 *
 * - The ground is not white. It is a warm off-white with slow, low-contrast
 *   clouding through it, and the clouding is what stops a slab reading as a
 *   painted board before you have even noticed a vein.
 * - There is one dominant vein, occasionally two, and it crosses the whole
 *   slab. It is not straight and it does not turn corners; it is a long curve.
 * - Its width changes along its length, and both ends taper away to nothing.
 *   A vein that starts and stops at full width reads as a drawn line.
 * - Around it there is a halo — the same colour, much fainter and much wider,
 *   bleeding into the stone.
 * - Branches leave it at a shallow angle, twenty to forty degrees, each shorter
 *   and finer than the one before.
 * - The colour is warm: grey with brown in it, never a neutral grey and never
 *   black.
 *
 * Everything is drawn three times, offset by a tile width each way, so a vein
 * running off one edge arrives on the other and the tile has no seam.
 */

/** A point on a cubic bezier. */
function bezier(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  t: number,
): [number, number] {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

export function marble(ctx: Ink, size: number) {
  const next = random(31);
  /** A twelve-foot tile, so an inch of stone is this many pixels. */
  const inch = size / (12 * 12);
  // A light ink wash rather than a drawing: warm grey with brown in it, kept
  // pale, so the slab reads as quiet stone rather than as a marked-up board.
  // The strength is in the halo and the taper, not in how dark the line is.
  const warm = (alpha: number) => `rgba(140,131,117,${alpha})`;
  const pale = (alpha: number) => `rgba(170,163,151,${alpha})`;

  ctx.fillStyle = "#F5F2EB";
  ctx.fillRect(0, 0, size, size);
  ctx.lineCap = "round";

  /** Slow clouding: very wide, very faint strokes wandering across the slab. */
  for (let i = 0; i < 7; i += 1) {
    ctx.strokeStyle = `rgba(196,190,180,${0.05 + next() * 0.05})`;
    ctx.lineWidth = size * (0.12 + next() * 0.16);
    ctx.beginPath();
    let x = -size * 0.2;
    let y = next() * size;
    ctx.moveTo(x, y);
    while (x < size * 1.2) {
      const cx = x + size * 0.2;
      const cy = y + (next() - 0.5) * size * 0.3;
      x += size * 0.4;
      y += (next() - 0.5) * size * 0.35;
      ctx.quadraticCurveTo(cx, cy, x, y);
    }
    ctx.stroke();
  }

  /**
   * One vein: a bezier walked in short segments, each stroked at its own
   * width. That is the only way to get a line that swells in the middle and
   * fades to nothing at both ends — a single stroke has one width.
   */
  function vein(
    from: [number, number],
    to: [number, number],
    widthIn: number,
    ink: (alpha: number) => string,
    strength: number,
    depth: number,
  ) {
    const bend = size * (0.18 + next() * 0.22);
    const p1: [number, number] = [
      from[0] + (to[0] - from[0]) * 0.3,
      from[1] + (to[1] - from[1]) * 0.3 - bend,
    ];
    const p2: [number, number] = [
      from[0] + (to[0] - from[0]) * 0.7,
      from[1] + (to[1] - from[1]) * 0.7 + bend * 0.7,
    ];

    const steps = 40;
    const points: [number, number][] = [];
    for (let i = 0; i <= steps; i += 1) points.push(bezier(from, p1, p2, to, i / steps));

    // The halo first, then the vein: wide and faint under narrow and dark.
    for (const [spread, alpha] of [
      [7, 0.09],
      [2.6, 0.18],
      [1, 0.46],
    ] as const) {
      for (let i = 1; i < points.length; i += 1) {
        const t = i / steps;
        // Thin at both ends, fattest around the middle, wobbling as it goes.
        const taper = Math.sin(Math.PI * t) ** 0.55;
        const wobble = 0.7 + 0.6 * Math.sin(t * 9 + depth);
        ctx.strokeStyle = ink(alpha * strength);
        ctx.lineWidth = Math.max(0.4, widthIn * inch * taper * wobble * spread);
        // Three passes across the tile, so nothing stops at an edge.
        for (const shift of [-size, 0, size]) {
          ctx.beginPath();
          ctx.moveTo(points[i - 1][0] + shift, points[i - 1][1]);
          ctx.lineTo(points[i][0] + shift, points[i][1]);
          ctx.stroke();
        }
      }
    }
    return points;
  }

  /** Branches: shallow, shorter each time, finer each time. */
  function branches(spine: [number, number][], widthIn: number, depth: number) {
    let reach = size * 0.3;
    let width = widthIn * 0.45;
    // Three, not a network. An ink wash is a few decided strokes and a lot of
    // paper; a slab covered in branches reads as granite, or as busy.
    for (let i = 0; i < 3; i += 1) {
      const at = spine[6 + Math.floor(next() * (spine.length - 12))];
      // Twenty to forty degrees off the slab's diagonal, either side of it.
      const angle = (20 + next() * 20) * (Math.PI / 180) * (next() < 0.5 ? -1 : 1);
      const to: [number, number] = [
        at[0] + Math.cos(angle) * reach,
        at[1] + Math.sin(angle) * reach,
      ];
      vein(at, to, width, pale, 0.8, depth + i);
      reach *= 0.7;
      width *= 0.75;
    }
  }

  // The dominant vein, corner to corner, and a companion much fainter and
  // never parallel to it.
  const main = vein(
    [-size * 0.15, size * (0.72 + next() * 0.16)],
    [size * 1.15, size * (0.08 + next() * 0.16)],
    0.75,
    warm,
    1,
    0,
  );
  branches(main, 0.75, 3);

  // One companion, far paler and never parallel to it. That is the whole
  // composition: a stroke, a lighter answer to it, and space.
  const second = vein(
    [-size * 0.15, size * (0.25 + next() * 0.15)],
    [size * 1.15, size * (0.58 + next() * 0.22)],
    0.3,
    pale,
    0.6,
    5,
  );
  branches(second, 0.3, 11);
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
/**
 * How much resolution a map needs beyond the tier's default.
 *
 * Marble's tile is twelve feet across, because a vein has to cross a whole
 * counter to read as one — which leaves a three-quarter-inch vein about three
 * pixels wide at the default size. So it gets twice the pixels; everything else
 * has no detail that fine.
 */
const DETAIL: Partial<Record<TextureKind, number>> = { marble: 2 };

export function texture(kind: TextureKind, size: number): THREE.Texture {
  const key = `${kind}@${size}`;
  const found = cache.get(key);
  if (found) return found;

  const px =
    kind === "blank" || kind === "blank-normal" ? 1 : size * (DETAIL[kind] ?? 1);
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
