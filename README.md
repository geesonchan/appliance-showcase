# Appliance Showcase

An isometric 3D kitchen that presents six appliances as real cutouts, real cabinet
runs and real utility rough-ins. See `appliance-showcase-brief.md` for the product
brief; this repository currently implements **M1 (skeleton)**.

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
| `npm run screenshots` | Capture the review set (see below) |

### Review screenshots

With a server running, capture the set from §10 of the brief:

```bash
npm run screenshots -- 2
```

That writes `screenshots/round-2/{overview,white-model,install,zoomed,night,mobile}.png`.
Point it at the production build with `BASE_URL=http://localhost:4173`. The
directory is git-ignored; the images are for side-by-side review, not history.

## How it is put together

```
src/
  types.ts              Appliance / Slot / Scheme, exactly as in brief §3 and §3.5.2
  data/
    slots.ts            The six slots, hard-coded, with cabinetConfig + utilities
    cabinets.ts         L-shaped cabinet run derived from the slot openings
    appliances.ts       Placeholder catalogue and the current scheme
    packageSummary.ts   Package totals shown in both side panels
  i18n/                 t(key, vars) over two JSON tables; en only for now
  store/useAppStore.ts  zustand: render mode, lighting, layers, selection, toasts
  three/                Scene graph, one file per layer
  ui/                   Panels, toolbar, pin overlay
```

Three things are worth knowing before changing anything:

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
cabinetry, run every fourth frame.

## Swapping the procedural models for glTF

`ApplianceModel` takes `slot`, `category` and `finish` and nothing else. To move
to real assets (brief §4, option B), replace the body of that component with a
glTF lookup keyed on category; the layers, pins, camera and interaction code do
not need to change.

## Deployment

`vite.config.ts` sets `base: "./"`, so the same `dist/` works at a domain root or
under a GitHub Pages project path.
