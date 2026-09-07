import { describe, expect, it } from "vitest";
import { CABINET_COLORS, cabinetToken } from "../store/useAppStore";
import { FINISHES, finish, type FinishToken } from "./materials";

/**
 * Every swatch has to resolve to a surface that is actually different.
 *
 * An oak door came out white: the swatch resolved to the wood token and the
 * token named a map, but the material picked the texture up without
 * recompiling the program that samples it, so all that survived was the token's
 * own colour — which for a mapped finish is plain white, since the map is meant
 * to supply the colour. A test that only checked the token would have passed.
 */
const ALL_TOKENS = Object.keys(FINISHES) as FinishToken[];

describe("every finish resolves to something you can see", () => {
  it("gives every swatch on the palette its own surface", () => {
    const seen = new Set<string>();
    for (const paint of CABINET_COLORS) {
      const token = cabinetToken(paint.value);
      const surface = finish("realistic", token, token === "painted" ? paint.value : undefined);

      // A finish that is not painted has to carry a map, or it is a colour with
      // extra steps — and a mapped finish must not also be flat white, which is
      // exactly what the bug looked like.
      if (token === "painted") {
        expect(surface.color, paint.key).toBe(paint.value);
        expect(surface.map, paint.key).toBeUndefined();
      } else {
        expect(surface.map, paint.key).toBeDefined();
      }

      const signature = `${surface.color}|${surface.map ?? ""}|${surface.roughness}`;
      expect(seen.has(signature), `${paint.key} looks like another swatch`).toBe(false);
      seen.add(signature);
    }
  });

  it("names a real texture wherever a token claims one", () => {
    for (const token of ALL_TOKENS) {
      const surface = finish("realistic", token);
      if (!surface.map) continue;
      expect(FINISHES[token].map, token).toBe(surface.map);
      expect(surface.repeatFt, token).toBeGreaterThan(0);
    }
  });

  // The white model and the install view are without materials on purpose, but
  // a surface that had a map keeps the slot — filled blank — so the shader it
  // compiles to is the same one and a mode switch is a uniform write.
  it("keeps the map slots it had, blank, in the modes without materials", () => {
    for (const token of ALL_TOKENS) {
      const real = finish("realistic", token);
      for (const mode of ["white", "install"] as const) {
        const flat = finish(mode, token);
        expect(Boolean(flat.map), `${token} in ${mode}`).toBe(Boolean(real.map));
        expect(Boolean(flat.normalMap), `${token} in ${mode}`).toBe(Boolean(real.normalMap));
        if (flat.map) expect(flat.map, `${token} in ${mode}`).toBe("blank");
      }
    }
  });
});
