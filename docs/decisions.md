# Decisions

Standing decisions that outlive a single milestone. Each one records what was
decided, why, and what it forbids — the last part matters most, because these
exist to stop a behaviour creeping back in.

---

## D1 · The camera moves for two reasons, and no others

**Decided:** 2026-09-05 (round 2), extended round 3.

The camera pose is user state. Nothing may move it as a side effect of an
unrelated change. Exactly two behaviours are allowed to move it on their own:

1. **Direct navigation.** Selecting an appliance flies the camera in; the reset
   button returns it to the default isometric view; the zoom buttons step the
   orthographic zoom. All are the direct result of the user asking to move.
2. **The mobile sheet framing offset.** While the half-height sheet is open the
   framing shifts up by 12% of the viewport height, easing over 300ms, and
   returns when the sheet closes. Implemented as a pan — target and position
   move by the same vector — so the orbit relationship, and therefore the
   controls' own state, is untouched. The offset is derived in screen space
   every frame, so it survives orbiting and zooming.

**Forbidden:** switching render mode, toggling day/night, toggling a layer, or
changing language must leave the camera pose bit-identical.

**Why this is written down:** it has already regressed once. Passing
`shadows={renderMode === "realistic"}` to the R3F `Canvas` could re-create the
renderer, which re-ran the effect that constructs `OrbitControls`, which reset
the pose to the default. The fix was to make `shadows` a constant and decide
per-light whether it casts. Anything that changes the identity of the renderer
or the camera will do the same thing again.

**How to check:** the smoke test asserts that the on-screen positions of all six
pin labels are byte-identical across the three render-mode switches. Pin
positions are projected through the camera, so they are a direct proxy for the
pose.

---

## D2 · Layers are mounted once and toggled by `visible`

**Decided:** 2026-09-05 (M1).

`CabinetLayer`, `ApplianceLayer` and the four `UtilityLayer`s stay mounted for
the life of the page. Render mode changes material properties and `visible`
flags; it never mounts or unmounts geometry.

**Two consequences that are easy to get wrong:**

- A material whose `transparent` flag changes needs a *new* material, not a
  property write — three.js will not recompile the program otherwise. These
  materials carry a React `key` on the flag. `ShaderWarmup` compiles those
  variants at load so the first switch into install mode does not stall.
- `Raycaster` does **not** skip invisible objects (three.js dropped that in
  r152), and line raycasts use a threshold measured in world units — a whole
  foot at this scale. An invisible wireframe is therefore still a raycast hit.
  The cabinet wireframe opts out with `raycast={() => null}`, and pin occlusion
  only counts visible meshes.

---

## D3 · Product data is JSON, validated at load

**Decided:** 2026-09-05 (M2).

`data/*.json` is the source of truth for appliances, slots, schemes and rules.
It is validated with zod at import time and the app refuses to start on a
schema violation rather than rendering something subtly wrong.

Room geometry — wall positions, cabinet run segments, counter heights — stays in
`src/data/room.ts`. It is scene construction, not product data, and Leo does not
maintain it in the Sheet.

Every catalogue row carries `sourceUrl` and `verifiedAt`. `verifiedAt: null`
means nobody has confirmed that row against the manufacturer's own page yet;
seed data ships that way deliberately, so unverified pricing is visible in the
data rather than assumed.
