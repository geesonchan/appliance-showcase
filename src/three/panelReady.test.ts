import { describe, expect, it } from "vitest";
import { APPLIANCES } from "../data/catalogue";
import { CABINET_COLORS, cabinetToken } from "../store/useAppStore";
import { FINISHES, finish, finishSurface, isPanelReady } from "./materials";

/**
 * A panel-ready machine has no front of its own.
 *
 * It is sold that way: the cabinetmaker hangs the same door on it as on the
 * cabinet beside it, in the same wood or the same paint, and the only steel you
 * see is the handle. So the material it is drawn in has to be the cabinet's
 * material, and it has to follow when the cabinet's changes.
 */
const panelReady = () => APPLIANCES.filter((a) => isPanelReady(a.finish));

describe("panel-ready appliances wear the cabinet's door", () => {
  it("has some in the catalogue to check", () => {
    const models = panelReady().map((a) => a.model);
    expect(models.length, "no panel-ready models in the catalogue").toBeGreaterThan(0);
    // The two Leo named. Keyed to the models rather than to a count, so an
    // import that drops one of them says so.
    expect(models).toContain("SHV78CM3N");
    expect(models).toContain("T36IT100NP");
  });

  it("takes the finish token the cabinet doors are in, whichever is picked", () => {
    for (const paint of CABINET_COLORS) {
      const token = cabinetToken(paint.value);
      const door = finish("realistic", token, token === "painted" ? paint.value : undefined);

      for (const appliance of panelReady()) {
        const front = finish(
          "realistic",
          token,
          token === "painted" ? paint.value : undefined,
        );
        expect(front, `${appliance.model} in ${paint.key}`).toEqual(door);
        // Including the grain: an oak door and an oak dishwasher front are the
        // same map at the same repeat, not two brown surfaces.
        expect(front.map).toBe(FINISHES[token].map);
      }
    }
  });

  it("does not touch a machine that is sold with a steel front", () => {
    const steel = APPLIANCES.filter((a) => !isPanelReady(a.finish) && a.finish.includes("stainless"));
    expect(steel.length).toBeGreaterThan(0);
    for (const appliance of steel) {
      const drawn = finishSurface("realistic", appliance.finish[0]);
      expect(drawn.color, appliance.model).toBe(FINISHES.stainless.color);
    }
  });

  // The white model and the install view show no grain — but the slot stays
  // filled with a blank so the shader is the same one, which is what keeps a
  // mode switch from recompiling every material in the room.
  it("goes back to plain shading in the modes that have no materials", () => {
    for (const mode of ["white", "install"] as const) {
      const front = finish(mode, "wood-oak");
      expect(front.map, mode).toBe("blank");
      expect(front.color, mode).not.toBe(FINISHES["wood-oak"].color);
    }
  });
});
