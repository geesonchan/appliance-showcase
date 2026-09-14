# Where the room's surfaces come from

Every texture and every reflection in this app is generated at run time. The app
loads no image files, and nothing is fetched from a CDN. (The drawings in this
directory are reference material for the figures, not something the page loads.)

## Textures — `src/three/textures.ts`

| Map | What it is | Source | Licence |
| --- | --- | --- | --- |
| `brushed-normal` | Horizontal streaks in a normal map, so stainless catches a band of reflection rather than a blur | Drawn on a canvas in `brushedNormal()` | Original, MIT with this repository |
| `oak` / `oak-floor` | Mid-brown boards (round 33: around #8B6B47, the floor a step darker) with grain lines wandering along them | `oak()` | Original |
| `marble` | Warm grey ground (#D8D2C8) with ink-dot veining: thousands of small translucent dots piled along soft paths, and no strokes (round 33) | `marble()` | Original |
| `quartz` | Near-white with a fine speckle and no veining | `quartz()` | Original |
| `tile` | A four-by-four grid with a grout line, for the backsplash | `tile()` | Original |
| `floor-tile-24x48` / `-32x32` / `-48x48` | Large-format grey panels (#4A4A48) laid in third-bond, 1/16" joints, each panel a slightly different grey (round 33) | `floorTile()` | Original |

They are drawn once per size and cached. The quality tier picks the size: 512px
on a desktop, 256px on a phone or after the frame-rate guard steps in.

## Environment — `src/three/Environment.tsx`

`RoomEnvironment` from `three/examples/jsm/environments/`, filtered through
`PMREMGenerator`. It ships with three.js under the same MIT licence as the
library, so it is a dependency rather than an asset.

## What marble actually looks like

**Superseded in round 33, Leo.** The six points below produced tapered bezier
veins, and a stroke still reads as drawn: it has a width, a start and an end.
The marble is now ink bleeding into stone. The ground is a warm grey (#D8D2C8)
rather than off-white, so it stands apart from the quartz. The veining is no
strokes at all: thousands of dots, each 0.05"-0.4" across and 3%-12% opaque,
piled along a soft path. They are dense and dark at the middle of the band and
thin to single specks at its edges. The band's width wanders and breaks off, and
paler clusters of the same ink sit a few inches out from it. `textures.test.ts`
holds it to that: no stroke longer than an inch at one width, more than 500 ink
dots, every dot inside those radius and opacity ranges, a band that crosses the
slab and is densest at its middle, and a ground clearly darker than the quartz.
What the photographs showed still stands for the composition — one dominant
band, warm ink, clouding in the ground.

Before redrawing the marble I looked at Calacatta and Statuario photographs on
Pexels — search results only, nothing downloaded, nothing in this repository.
Six or seven slabs across two searches
(`pexels.com/search/calacatta marble`, `pexels.com/search/statuario marble texture`).
What they have in common, in the order the eye takes it in:

1. **The ground is not white.** It is a warm off-white, and it has slow,
   low-contrast clouding through it. That clouding is what stops a slab reading
   as a painted board before you have even noticed a vein.
2. **One vein dominates.** Occasionally two. It crosses the whole slab, corner
   to corner, in a long curve — never straight, never turning a corner.
3. **Its width changes along its length, and both ends taper to nothing.** A
   vein that starts and stops at full width reads as a drawn line, which is
   exactly what this app's first attempt looked like.
4. **There is a halo.** The same colour, much fainter and several times wider,
   bleeding into the stone either side of the vein.
5. **Branches leave at a shallow angle** — twenty to forty degrees — each
   shorter and finer than the last, often clustered rather than evenly spaced.
6. **The colour is warm.** Statuario runs cool grey, Calacatta runs gold-taupe;
   both have brown in them. Neither is a neutral grey and neither is black.

The generator in `textures.ts` is built to those six points, and
`textures.test.ts` holds it to the ones that can be stated as numbers: the
veining crosses the tile, its width varies, and the ink is warmer than it is
blue.

**One consequence worth recording.** A countertop is a long narrow piece cut out
of a slab, so the pattern on it is the couple of feet of stone the cut passed
through — not a square metre of it squashed onto a band. That is why the marble
finish tiles twelve feet along a run and two and a half across it, and why a
first attempt at a square twelve-foot tile came out looking blank: it was
showing a sixth of the pattern and usually none of the veins.

## Why not photographs

Leo's M3-5 note allows either procedural maps or CC0 textures, and points at a
Poly Haven HDRI for the environment. Both would work. Generated maps were chosen
for three reasons:

1. **Nothing to download, nothing to keep current.** A CC0 texture pack means a
   megabyte of binaries, a licence file, and a note about which version of which
   pack — for surfaces this scene shows at forty-five degrees from ten feet away.
2. **They resize for free.** The quality guard halves the resolution on a slow
   phone by asking for the same canvas at 256px. A downloaded KTX2 file would
   need a second copy at the smaller size, shipped whether or not it is used.
3. **The room is already procedural.** Every cabinet and every appliance in this
   app is built from primitives at the size the manufacturer publishes. A
   photographed oak on a generated carcass is the odd one out.

**What swapping them in would take.** `texture(kind, size)` is the only place
that makes one, and every finish names its maps by kind in `FINISHES`. Point
that function at a loader instead, add the files under `public/textures/`, and
list them in the table above with their source URL and licence. The environment
is the same shape of change: `Environment.tsx` builds a PMREM target, and where
it comes from is four lines.

If real captures are wanted, these are the ones that fit the room, all CC0:

- Poly Haven `small_empty_room_1` (interior HDRI, 1k is enough at this size)
- ambientCG `Wood051` (white oak flooring)
- ambientCG `Marble016`, `Tiles101`

Anything added has to keep to the M3-5 budget: 1MB per map, compressed to
KTX2/basis, with its source and licence recorded here.
