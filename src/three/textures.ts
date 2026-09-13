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
  | "tile"
  | "floor-tile-24x48"
  | "floor-tile-32x32"
  | "floor-tile-48x48"
  | "sky";

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
  fill(): void;
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
 * The four board tones for each oak.
 *
 * Round 33, Leo: both a shade deeper than they were, toward a mid brown around
 * #8B6B47 rather than the pale yellow oak they had been. The floor sits a step
 * darker than a door, so an oak kitchen on an oak floor still has an edge where
 * the cabinets stop. The rings keep their contrast against the new ground.
 */
export const OAK_TONES = {
  cabinet: ["#9A7A51", "#8B6B47", "#7C5E3D", "#93734B"],
  floor: ["#806140", "#6F5337", "#604730", "#785A3C"],
} as const;

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
  const tones = dark ? OAK_TONES.floor : OAK_TONES.cabinet;
  const ink = dark ? "34,22,12" : "54,36,20";

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
 * Marble, as ink bleeding into stone rather than lines drawn on it.
 *
 * Round 33, Leo: the bezier veins read as something drawn — a stroke has a
 * width, a start and an end, and the eye finds all three. A vein in a slab has
 * none of them. So nothing here is a stroke. The vein is thousands of small,
 * nearly transparent dots piled along a soft path: thick where they overlap in
 * the middle, thinning out to single specks at the edge, which is what a stain
 * spreading through a porous stone looks like. The band's width wanders, it
 * breaks off and resumes, and fainter clusters of the same ink sit beside it.
 *
 * The ground is a warm grey, not white (see round 33's item 3): quartz is the
 * pale counter, and marble is told apart from it at a glance.
 *
 * The tile is twelve feet along a run and two and a half across it, so the
 * canvas is stretched: every dot is an ellipse measured in inches on each axis,
 * which lands round on the counter. A dot near an edge is drawn again on the
 * far side, so the tile has no seam either way.
 */
export const MARBLE = {
  ground: "#D8D2C8",
  /** The vein's ink: a dark grey with brown in it. */
  ink: "86,74,62",
  /** The slow clouding in the ground, a little darker than the ground. */
  cloud: "176,168,156",
  dotRadiusIn: [0.05, 0.4] as const,
  dotAlpha: [0.03, 0.12] as const,
  alongIn: 144,
  acrossIn: 30,
};

export function marble(ctx: Ink, size: number) {
  const next = random(31);
  const sx = size / MARBLE.alongIn;
  const sy = size / MARBLE.acrossIn;
  const [rMin, rMax] = MARBLE.dotRadiusIn;
  const [aMin, aMax] = MARBLE.dotAlpha;

  /** A standard normal, so most dots land near the middle of the band. */
  const gauss = () => {
    let u = 0;
    while (u === 0) u = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  /** A sum of sines with whole periods across the tile, so it wraps. */
  const wave = (terms: [number, number][]) => {
    const phases = terms.map(() => next() * Math.PI * 2);
    return (t: number) =>
      terms.reduce((sum, [amp, k], i) => sum + amp * Math.sin(2 * Math.PI * k * t + phases[i]), 0);
  };
  const wrap = (value: number) => ((value % size) + size) % size;

  /** One dot, measured in inches, drawn again across any edge it touches. */
  const dot = (x: number, y: number, radiusIn: number, style: string) => {
    const rx = radiusIn * sx;
    const ry = radiusIn * sy;
    const cx = wrap(x);
    const cy = wrap(y);
    const xs = [cx];
    if (cx - rx < 0) xs.push(cx + size);
    if (cx + rx > size) xs.push(cx - size);
    const ys = [cy];
    if (cy - ry < 0) ys.push(cy + size);
    if (cy + ry > size) ys.push(cy - size);
    ctx.fillStyle = style;
    for (const px of xs) {
      for (const py of ys) {
        ctx.beginPath();
        ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  ctx.fillStyle = MARBLE.ground;
  ctx.fillRect(0, 0, size, size);

  // Clouding: a few very large, very faint patches, so the ground is not a
  // painted board before any vein is seen.
  for (let i = 0; i < 26; i += 1) {
    dot(
      next() * size,
      next() * size,
      3 + next() * 7,
      `rgba(${MARBLE.cloud},${(0.025 + next() * 0.03).toFixed(3)})`,
    );
  }

  /**
   * A band of ink along a soft path across the slab.
   *
   * Dots are spread across the band by a normal distribution, so they pile up
   * in the middle and thin out at the edges, and each dot's opacity falls with
   * its distance from the middle too. The band's width wanders along its
   * length, and where the gap wave dips most of it is simply not drawn.
   */
  function band(opts: {
    centreIn: number;
    /** The path the band follows across the slab, so two passes can share one. */
    path: (t: number) => number;
    widthIn: [number, number];
    dotsPerPx: number;
    strength: number;
  }) {
    const { path } = opts;
    const width = wave([
      [0.6, 3],
      [0.4, 7],
    ]);
    const gaps = wave([
      [1, 2],
      [0.55, 5],
    ]);
    const count = Math.round(size * opts.dotsPerPx);
    const points: [number, number][] = [];
    for (let i = 0; i < count; i += 1) {
      const t = next();
      // Broken off here and there: most of the dots in a gap are not drawn.
      if (gaps(t) < -0.9 && next() > 0.1) continue;
      const w = opts.widthIn[0] + (opts.widthIn[1] - opts.widthIn[0]) * (0.5 + 0.5 * Math.max(-1, Math.min(1, width(t))));
      const n = gauss();
      const core = Math.exp((-n * n) / 2);
      const yIn = opts.centreIn + path(t) + (n * w) / 2;
      const alpha = aMin + (aMax - aMin) * core * opts.strength;
      const radius = rMin + (rMax - rMin) * next() ** 2;
      dot(t * size, yIn * sy, radius, `rgba(${MARBLE.ink},${alpha.toFixed(3)})`);
      if (i % 97 === 0) points.push([t * size, (opts.centreIn + path(t)) * sy]);
    }
    return points;
  }

  // The dominant band across the slab. Drawn twice along one path: a wide,
  // faint pass that is the stain spreading out into the stone, then the band
  // itself piled up over it. Same ink, same dot sizes; the halo is only wider
  // and thinner. Its companion is narrower and fainter.
  /** A soft path across the slab, wandering this many inches either way. */
  const softPath = (wanderIn: number) =>
    wave([
      [wanderIn, 1],
      [wanderIn * 0.45, 2],
      [wanderIn * 0.18, 5],
    ]);
  const mainPath = { centreIn: MARBLE.acrossIn * 0.58, path: softPath(5) };
  band({ ...mainPath, widthIn: [5, 12], dotsPerPx: 4, strength: 0.25 });
  const main = band({ ...mainPath, widthIn: [2, 6], dotsPerPx: 14, strength: 1 });
  band({
    centreIn: MARBLE.acrossIn * 0.2,
    path: softPath(2.5),
    widthIn: [0.8, 2.5],
    dotsPerPx: 5,
    strength: 0.5,
  });

  // Paler clusters of the same ink beside the main band, where the stain has
  // found its way a couple of inches out into the stone.
  for (let c = 0; c < 28; c += 1) {
    const [x, y] = main[Math.floor(next() * main.length)];
    const offIn = (2 + next() * 3) * (next() < 0.5 ? -1 : 1);
    const spreadIn = 0.4 + next() * 1.2;
    const dots = 20 + Math.floor(next() * 40);
    for (let i = 0; i < dots; i += 1) {
      dot(
        x + gauss() * spreadIn * 2 * sx,
        y + (offIn + gauss() * spreadIn) * sy,
        rMin + (0.2 - rMin) * next(),
        `rgba(${MARBLE.ink},${(aMin + next() * 0.02).toFixed(3)})`,
      );
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
 * Large-format floor tile, the sizes the market sells it in.
 *
 * Round 33, Leo: a floor in 24" x 48" (the default), 32" x 32" or 48" x 48"
 * panels. What makes a large panel look expensive is how little grout there is:
 * the joint is a sixteenth of an inch, darker than the tile but not black. The
 * rows are offset by a third of a tile rather than a half — half-bond is how
 * small tile is laid, and on a four-foot panel it puts a seam in the middle of
 * the next one's width. And no two panels are quite the same grey: a pressed or
 * cut panel varies within a batch, and a floor of identical squares reads as a
 * printed pattern.
 *
 * The long side of a rectangular panel runs along the texture's x axis. One
 * texture covers two panels along and six rows across — six so the third-bond
 * comes round twice and there are twelve panels to vary — and the finish sets
 * its repeat to exactly that many inches so a tile is its real size on the floor.
 */
export const TILE_FORMATS = {
  "24x48": { alongIn: 48, acrossIn: 24 },
  "32x32": { alongIn: 32, acrossIn: 32 },
  "48x48": { alongIn: 48, acrossIn: 48 },
} as const;
export type TileFormat = keyof typeof TILE_FORMATS;

export const FLOOR_TILE = {
  /** Panels along, and rows across, in one texture. */
  along: 2,
  rows: 6,
  groutIn: 1 / 16,
  base: [0x4a, 0x4a, 0x48] as const,
  grout: "#383836",
  /** How far a panel's grey may stray from the base, per channel. */
  shadeSpread: 5,
};

export function floorTile(ctx: Ink, size: number, format: TileFormat) {
  const { alongIn, acrossIn } = TILE_FORMATS[format];
  const next = random(41 + alongIn + acrossIn);
  const sx = size / (alongIn * FLOOR_TILE.along);
  const sy = size / (acrossIn * FLOOR_TILE.rows);
  // A sixteenth of an inch, or a pixel where that is less than one.
  const gx = Math.max(1, FLOOR_TILE.groutIn * sx);
  const gy = Math.max(1, FLOOR_TILE.groutIn * sy);

  ctx.fillStyle = FLOOR_TILE.grout;
  ctx.fillRect(0, 0, size, size);

  for (let row = 0; row < FLOOR_TILE.rows; row += 1) {
    const offsetIn = ((row % 3) * alongIn) / 3;
    const top = row * acrossIn * sy;
    for (let col = 0; col < FLOOR_TILE.along; col += 1) {
      const shade = Math.round((next() * 2 - 1) * FLOOR_TILE.shadeSpread);
      const [r, g, b] = FLOOR_TILE.base.map((channel) => channel + shade);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      const left = (col * alongIn + offsetIn) * sx;
      // A panel pushed past the right edge by the bond arrives on the left.
      for (const shift of [0, -size]) {
        ctx.fillRect(left + shift + gx / 2, top + gy / 2, alongIn * sx - gx, acrossIn * sy - gy);
      }
    }
  }

  // A faint mottle in the face, finer than anything else here.
  const grain = Math.max(1, size / 1024);
  for (let i = 0; i < size * 3; i += 1) {
    const light = next() < 0.5;
    ctx.fillStyle = light
      ? `rgba(255,255,250,${(0.02 + next() * 0.03).toFixed(3)})`
      : `rgba(20,20,18,${(0.02 + next() * 0.03).toFixed(3)})`;
    ctx.fillRect(next() * size, next() * size, grain, grain);
  }
}

/**
 * What is outside a window: a plain gradient, and deliberately nothing else.
 *
 * Not a photograph and not a garden. A window in a drawing of a kitchen is
 * there for the light and for the fact that the wall has a hole in it; putting
 * a real view behind it invites a customer to look at the view, and a
 * rendered-looking one is worse than none. So it is sky at the top going to
 * haze at the bottom, in bands rather than a smooth ramp — a plain gradient,
 * drawn with the same handful of context methods everything else here uses.
 */
export function sky(ctx: Ink, size: number) {
  const bands = 32;
  const top = [0x9d, 0xbc, 0xd8];
  const bottom = [0xe8, 0xe2, 0xd4];
  for (let i = 0; i < bands; i += 1) {
    const t = i / (bands - 1);
    const mix = top.map((from, channel) => Math.round(from + (bottom[channel] - from) * t));
    ctx.fillStyle = `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
    ctx.fillRect(0, Math.floor((i * size) / bands), size, Math.ceil(size / bands) + 1);
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
  "floor-tile-24x48": (ctx, size) => floorTile(ctx, size, "24x48"),
  "floor-tile-32x32": (ctx, size) => floorTile(ctx, size, "32x32"),
  "floor-tile-48x48": (ctx, size) => floorTile(ctx, size, "48x48"),
  sky,
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
const DETAIL: Partial<Record<TextureKind, number>> = {
  marble: 2,
  // A texture of floor tile covers up to two panels by six rows — as much as
  // eight feet by twenty-four — and its grout still has to be a line.
  "floor-tile-24x48": 2,
  "floor-tile-32x32": 2,
  "floor-tile-48x48": 2,
};

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
