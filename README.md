# Appliance Showcase

An isometric 3D kitchen that presents six appliances as real cutouts, real cabinet
runs and real utility rough-ins. See `appliance-showcase-brief.md` for the product
brief. M1 (skeleton) is complete; M2 is in progress — the data pipeline is in,
swap-in-place and the rules engine are not yet.

## Run

```bash
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on :5173 |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build on :4173 |
| `npm run typecheck` | Types only |
| `npm test` | Build, then unit and smoke tests |
| `npm run test:unit` | Schema and data invariants only, no browser |
| `npm run screenshots` | Capture the review set (see below) |
| `npm run import:csv -- file.csv` | Rebuild the catalogue from a `showcase_export` CSV |

### Review screenshots

With a server running, capture the set from §10 of the brief:

```bash
npm run screenshots -- 2
```

That writes `screenshots/round-2/` with a `mobile-` and a `desktop-` set, each
covering overview / white model / install / flown-in / night, plus
`mobile-sheet.png` for the half-height panel. `SET=mobile` or `SET=desktop`
captures only one; `BASE_URL=http://localhost:4173` points it at the production
build. The directory is git-ignored; the images are for side-by-side review,
not history.

### Diagnostics

Load any URL with `?debug=1` for a small overlay showing the live frame rate
and how long the last render-mode switch took to reach the screen. It also puts
a few handles on `window`, which is how the smoke suite asserts things a
screenshot cannot: `__applianceBoxes` (what each machine actually measures),
`__pinLayout`, `__faded`, `__generic`, and `__cabinetPanels()` — call it for the
distinct colours currently on the room's cabinet panels, which should never be
more than the picked colour and the accent.

## How it is put together

```
data/                   Source of truth, validated with zod at import time
  appliances.json       Catalogue, generated from the inventory sheet CSV
  slots.json            The product half of each slot: cutout, cabinet, utilities
  schemes.json          Which appliance fills each slot by default

src/
  types.ts              Domain types, derived from the zod schemas
  data/
    schema.ts           zod schemas and the loader that fails loudly
    catalogue.ts        Appliances and schemes, indexed by id and by slot
    slots.ts            slots.json merged with the placement from room.ts
    room.ts             Room shell, cabinet run segments, slot placement
    cabinets.ts         L-shaped cabinet run derived from the slot openings
    fit.ts              Does this model go in this opening, and by how much not
    utilities.ts        What the rough-in becomes given what is actually in the slot
    packageSummary.ts   Package totals shown in both side panels
  i18n/                 t(key, vars) over two JSON tables; en only for now
  store/useAppStore.ts  zustand: render mode, lighting, layers, selection, toasts
  three/                Scene graph, one file per layer
  ui/                   Panels, toolbar, pin overlay, mobile sheet
scripts/
  normalise.ts          Every cleaning rule for the sheet's raw columns
  csv-to-json.ts        CSV in, validated data/appliances.json out
tests/                  Smoke suite: a real browser against the real build
docs/decisions.md       Standing decisions, and what each one forbids
docs/data-sheet-spec.md App field to sheet column, with every mapping rule
```

Three things are worth knowing before changing anything:

**Selection is store state, and everything reads it.** `useSelection()` resolves
the store's slot-to-id map into appliances. The scene, the pins, both panels and
the utility layers all read it, so a swap updates every one of them from a single
write; `data/utilities.ts` turns the selected appliance's `requires` into what
the install view draws.

**Product data is JSON; room geometry is code.** `data/*.json` is what Leo
maintains and what the Sheet export will replace. Where the oven tower stands is
scene construction and lives in `src/data/room.ts`; `slots.ts` merges the two.
See docs/decisions.md D3.

**Scene units are feet.** Every inch measurement from the brief crosses the
boundary through `ft()` in `data/slots.ts`. Slot positions are the floor-level
centre of the appliance footprint (except the hood and the wall oven, which are
mounted at height).

**Layers are mounted once and toggled by `visible`.** `CabinetLayer`,
`ApplianceLayer` and the four `UtilityLayer`s never unmount. Render mode changes
material properties and visibility only, so switching modes cannot rebuild the
scene graph. The one exception is deliberate: a `key` on the materials that flip
`transparent`, because three.js needs a fresh material rather than a property
write when that flag changes.

**Pins live in the DOM, not the scene.** `ui/PinOverlay` renders the labels;
`three/PinProjector` projects each anchor to screen space every frame and writes
`transform` and `opacity` straight onto the elements, so following the camera
costs no React renders. Occlusion is a raycast against the room shell and
cabinetry, run every fourth frame. Two things that look like details are not:
the ray runs along the camera's forward axis because the camera is orthographic,
and only visible meshes count as occluders, because three.js raycasts invisible
objects and line thresholds are measured in world units.

## Swapping the procedural models for glTF

`ApplianceModel` takes `slot`, `category` and `finish` and nothing else. To move
to real assets (brief §4, option B), replace the body of that component with a
glTF lookup keyed on category; the layers, pins, camera and interaction code do
not need to change.

## Deployment

`vite.config.ts` sets `base: "./"`, so the same `dist/` works at a domain root or
under a GitHub Pages project path.
