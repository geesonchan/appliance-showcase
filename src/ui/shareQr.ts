import qrcode from "qrcode-generator";

/**
 * The share link as a QR code, drawn on a canvas. Round 95, Leo; D23.
 *
 * This module, and the library with it, is loaded only when the share box is
 * opened (`import("./shareQr")` in TopBar.tsx), so the page as it opens does
 * not carry it.
 *
 * Leo's figures, round 95:
 * - **Error correction L.** The code is shown on a screen, where nothing
 *   smudges or tears it, so the lowest level is enough — and the fewer modules
 *   a link takes, the larger each is at a given size, and the further a phone
 *   can read it from. Measured on the round's links: 483 characters is version
 *   15, 77 x 77 modules; 562 is version 16, 81 x 81 (round 95's plan).
 * - **4 CSS pixels a module, a whole number of device pixels each, no
 *   smoothing.** Each module is drawn as one solid square of `round(4 x
 *   devicePixelRatio)` device pixels, so its edges fall on pixel boundaries at
 *   1x, 1.25x, 1.5x and 2x alike, and the canvas is shown at its own size with
 *   `image-rendering: pixelated`, so the browser does not blur it.
 * - **A quiet zone of 4 modules**, the standard's own, white all round.
 */
export const QR = { cssPerModule: 4, quietModules: 4, errorCorrection: "L" as const };

export function drawQr(canvas: HTMLCanvasElement, text: string): { modules: number; version: number } {
  const code = qrcode(0, QR.errorCorrection);
  code.addData(text, "Byte");
  code.make();
  const modules = code.getModuleCount();
  const ratio = window.devicePixelRatio || 1;
  const cell = Math.max(1, Math.round(QR.cssPerModule * ratio));
  const side = (modules + 2 * QR.quietModules) * cell;
  canvas.width = side;
  canvas.height = side;
  canvas.style.width = `${side / ratio}px`;
  canvas.style.height = `${side / ratio}px`;
  canvas.style.imageRendering = "pixelated";
  const context = canvas.getContext("2d")!;
  context.imageSmoothingEnabled = false;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, side, side);
  context.fillStyle = "#000000";
  for (let row = 0; row < modules; row += 1) {
    for (let col = 0; col < modules; col += 1) {
      if (!code.isDark(row, col)) continue;
      context.fillRect((col + QR.quietModules) * cell, (row + QR.quietModules) * cell, cell, cell);
    }
  }
  canvas.dataset.modules = String(modules);
  return { modules, version: (modules - 17) / 4 };
}
