// The U's default view chosen again (Leo, 2026-11-12: 「默认画面里，每台机器的标签都要看得见、点得到；
// 在满足这一条的角度里，挑最能看到灶、油烟机、烤箱塔正面的」). On the view prototype (a link's
// protoAz, protoPitch and protoBoard set the U's default; negative is to the left), each
// package's U opened at the walls it opens at, the mouse's 1440 x 900 (or the phone's
// 390 x 844 with --phone), the page in Chinese, nothing selected; for every direction and
// pitch the link's view written into the address and "重置视角" pressed, then read:
//  - each machine's pin label: shown (not hidden by the page's own occlusion test or
//    off screen, opacity not 0) and clickable (the point at its centre is the label);
//  - the fronts of the cooking surface, the hood and the oven tower (a cooktop's face is its top; every machine on the
//    cooking leg rising above the counter but the hood; their mean): a 6 x 6 grid on the face toward the
//    room, a point seen when the face turns to the camera, the point is on screen and no
//    opaque mesh of another slot is on its sight line; a front "seen" at half its points.
//   node docs/plans/u-view-2026-11-12/viewTable.mjs <build folder> <out json> [--phone] [--az=..] [--pitch=..] [--boards=both,none]
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { launchSiteBrowser } from "../../../scripts/siteRoute.mjs";

const [build, outFile, ...flags] = process.argv.slice(2);
const flag = (name, fallback) => flags.find((f) => f.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const phone = flags.includes("--phone");
const AZ = flag("az", "0,-10,-15,-20,-30,-45").split(",").map(Number);
const PITCH = flag("pitch", "25,30,35,45").split(",").map(Number);
const BOARDS = flag("boards", "both,none").split(",");
const PACKAGES = flag("pkg", "A,B,C,D,E").split(",");
const shotDir = flag("shots", null);
mkdirSync(dirname(resolve(outFile)), { recursive: true });
if (shotDir) mkdirSync(shotDir, { recursive: true });

const origin = "http://localhost:4177";
const browser = await launchSiteBrowser(
  { args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] },
  { origin, dir: resolve(build), onMiss: () => {} },
);
const SIDE = { A: 155.25, B: 141, C: 159.75, D: 177, E: 147 };
const device = phone
  ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }
  : { viewport: { width: 1440, height: 900 } };
const rows = [];
for (const code of PACKAGES) {
  for (const board of BOARDS) {
    const context = await browser.newContext(device);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const base = `/?v=2&pkg=${code}&shape=U&back=132&left=${SIDE[code]}&corner=blind&lang=zh&quality=high&qualityLock=1&debug=1&protoBoard=${board}`;
    await page.goto(`${origin}${base}&protoAz=${AZ[0]}&protoPitch=${PITCH[0]}`);
    await page.waitForSelector("canvas", { timeout: 60_000 });
    await page.waitForTimeout(3000);
    const close = page.locator("[data-share-notice-close]").filter({ visible: true });
    if (await close.count()) {
      const box = await close.first().boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(800);
    }
    for (const az of AZ) {
      for (const pitch of PITCH) {
        await page.evaluate((q) => history.replaceState(null, "", q), `${base}&protoAz=${az}&protoPitch=${pitch}`);
        await page.getByRole("button", { name: "重置视角", exact: true }).filter({ visible: true }).first().click();
        await page.waitForTimeout(1800);
        const r = await page.evaluate(measure);
        const row = { code, board, az, pitch, ...r, errors: errors.splice(0).join(" | ") };
        rows.push(row);
        if (shotDir) await page.screenshot({ path: resolve(shotDir, `${code}-${board}-az${az}-p${pitch}${phone ? "-phone" : ""}.png`) });
        console.log(
          `${code} ${board.padEnd(4)} az ${String(az).padStart(3)} pitch ${pitch} | view ${r.view} | labels ${r.shown}/${r.total}` +
            `${r.hiddenSlots.length ? " hidden " + r.hiddenSlots.join(",") : ""} | cook ${r.fronts.cooking} hood ${r.fronts.hood} tower ${r.fronts.tower}`,
        );
      }
    }
    await context.close();
  }
}
await browser.close();
writeFileSync(resolve(outFile), JSON.stringify(rows, null, 1));

/** Runs in the page. */
function measure() {
  const T = window.__THREE;
  const scene = window.__scene;
  const cam = window.__cam;
  const e = cam.matrixWorld.elements;
  const view = `${Math.round((Math.atan2(e[8], e[10]) * 180) / Math.PI)}/${Math.round((Math.asin(e[9]) * 180) / Math.PI)}`;
  // Labels.
  const labels = window.__pinLayout?.labels ?? [];
  const results = [];
  for (const l of labels) {
    const el = document.querySelector(`[data-pin-label="${l.slot}"]`);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    const opacity = Number(getComputedStyle(el).opacity);
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const onScreen = rect.width > 0 && cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight;
    const hit = onScreen ? document.elementFromPoint(cx, cy) : null;
    const clickable = !!hit && (el === hit || el.contains(hit));
    results.push({ slot: l.slot, shown: !l.hidden && opacity > 0.5 && onScreen, clickable });
  }
  const ok = results.filter((r) => r.shown && r.clickable);
  // Fronts.
  const owning = (o) => {
    for (let n = o; n; n = n.parent) if (n.userData?.slot) return n.userData.slot;
    return undefined;
  };
  const opaqueVisible = (o) => {
    if (!o.isMesh) return false;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m?.transparent && m.opacity < 0.9) return false;
    for (let n = o; n; n = n.parent) if (!n.visible) return false;
    return true;
  };
  const bodies = {};
  scene.traverse((o) => {
    if (o.name?.startsWith("appliance-body-")) bodies[o.name.slice("appliance-body-".length)] = new T.Box3().setFromObject(o);
  });
  const layer = scene.getObjectByName("cabinet-layer");
  const centre = new T.Box3().setFromObject(layer).getCenter(new T.Vector3());
  const cooking = ["slot-range", "slot-rangetop", "slot-cooktop"].find((s) => bodies[s]);
  const facing = (box) => {
    const size = box.getSize(new T.Vector3());
    const c = box.getCenter(new T.Vector3());
    return size.x < size.z ? new T.Vector3(Math.sign(centre.x - c.x), 0, 0) : new T.Vector3(0, 0, Math.sign(centre.z - c.z));
  };
  const cookBox = bodies[cooking];
  const cookN = facing(cookBox);
  const along = cookN.x !== 0 ? "x" : "z";
  const cookC = cookBox.getCenter(new T.Vector3());
  const counterTop = cookBox.max.y;
  const tower = Object.entries(bodies)
    .filter(([slot, b]) => {
      if (slot === "slot-hood" || slot === cooking) return false;
      const c = b.getCenter(new T.Vector3());
      return Math.abs(c[along] - cookC[along]) < 1.5 && b.max.y > counterTop + 0.5 && facing(b)[along] === cookN[along];
    })
    .map(([slot]) => slot);
  const forward = cam.getWorldDirection(new T.Vector3());
  const ray = new T.Raycaster();
  // How square on each face is to the camera: 100 face on, 0 edge on.
  const square = {};
  const seen = (slot) => {
    // The face toward the room, on the machine's own box; the slot's own cabinetry
    // (an insert hood's housing, the tower's carcass) never blocks it.
    // A cooktop lies in the counter: its face is its top.
    const box = bodies[slot];
    const n = slot === "slot-cooktop" ? new T.Vector3(0, 1, 0) : facing(bodies[slot]);
    square[slot] = Math.max(0, -n.dot(forward));
    if (n.dot(forward) >= 0) return 0;
    const axis = n.x !== 0 ? "x" : n.y !== 0 ? "y" : "z";
    const [u, v] = axis === "x" ? ["z", "y"] : axis === "y" ? ["x", "z"] : ["x", "y"];
    const plane = n[axis] > 0 ? box.max[axis] + 0.01 : box.min[axis] - 0.01;
    let hits = 0;
    let total = 0;
    for (let i = 0; i < 6; i += 1) {
      for (let j = 0; j < 6; j += 1) {
        const p = new T.Vector3();
        p[axis] = plane;
        p[u] = box.min[u] + (box.max[u] - box.min[u]) * (0.08 + (0.84 * i) / 5);
        p[v] = box.min[v] + (box.max[v] - box.min[v]) * (0.08 + (0.84 * j) / 5);
        total += 1;
        const s = p.clone().project(cam);
        if (Math.abs(s.x) > 1 || Math.abs(s.y) > 1) continue;
        ray.set(p.clone().addScaledVector(forward, -500), forward);
        ray.far = 500 - 0.005;
        const blocked = ray.intersectObjects(scene.children, true).some((h) => opaqueVisible(h.object) && owning(h.object) !== slot);
        if (!blocked) hits += 1;
      }
    }
    return hits / total;
  };
  const pct = (v) => Math.round(v * 100);
  const cookingSeen = seen(cooking);
  const hoodSeen = bodies["slot-hood"] ? seen("slot-hood") : null;
  const towerSeen = tower.length ? tower.map(seen).reduce((a, b) => a + b, 0) / tower.length : null;
  return {
    view,
    total: results.length,
    shown: ok.length,
    hiddenSlots: results.filter((r) => !(r.shown && r.clickable)).map((r) => r.slot.replace("slot-", "") + (r.shown ? "(covered)" : "")),
    towerSlots: tower,
    cookingSlot: cooking,
    fronts: {
      cooking: pct(cookingSeen),
      hood: hoodSeen === null ? null : pct(hoodSeen),
      tower: towerSeen === null ? null : pct(towerSeen),
    },
    square: {
      cooking: pct(square[cooking]),
      hood: bodies["slot-hood"] ? pct(square["slot-hood"]) : null,
      tower: tower.length ? pct(tower.map((t) => square[t]).reduce((a, b) => a + b, 0) / tower.length) : null,
    },
  };
}
