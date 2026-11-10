"""Measure each oven's front off its spec sheet's page-1 photograph.

Method: render page 1 at 4x. Inside the photo's box, find the front's left and right edges (the
columns where the pale steel starts against the white page) and its top and bottom (rows likewise).
Inches per pixel = the sheet's printed overall height / the front's height in pixels; the printed
width checks it. Then, down a column a fifth of the way in (clear of knobs and displays), find the
dark horizontal lines: the gaps between panel and door and between the doors. Each band between two
lines, in inches. Also the display and the knobs, by their dark/bright extents in the panel band.
"""
import sys, pypdfium2 as pdfium
import numpy as np
R = "C:/Users/leoch/Downloads/appliance-showcase/docs/reference/"
OVENS = {  # photo box at 1.5x render, printed overall H x W
    "ME301YP": ("me301yp-spec", (40, 150, 420, 510), 29.0, 29.75),
    "MEM301WS": ("mem301ws-spec", (40, 150, 345, 620), 49.0, 29.75),
    "PO302W": ("po302w-spec", (40, 150, 345, 645), 52.0625, 29.75),
    "PODS302B": ("pods302b-spec", (40, 150, 345, 620), 48.875, 29.75),
}
S = 4 / 1.5
for name, (pdf, box, H, W) in OVENS.items():
    img = np.asarray(pdfium.PdfDocument(R + pdf + ".pdf")[0].render(scale=4).to_pil().convert("L"), dtype=float)
    x0, y0, x1, y1 = (int(v * S) for v in box)
    a = img[y0:y1, x0:x1]
    nonwhite = a < 235
    cols = np.where(nonwhite.mean(axis=0) > 0.5)[0]; rows = np.where(nonwhite.mean(axis=1) > 0.5)[0]
    L, Rt, T, B = cols[0], cols[-1], rows[0], rows[-1]
    ppi_h = (B - T) / H; ppi_w = (Rt - L) / W
    print(f"\n{name}: front {Rt-L}x{B-T}px; px/in from height {ppi_h:.2f}, from width {ppi_w:.2f}")
    col = a[:, L + int((Rt - L) * 0.2)]
    # dark lines: rows darker than 120, grouped
    dark = np.where(col < 110)[0]
    groups = []
    for r in dark:
        if groups and r - groups[-1][1] <= 3: groups[-1][1] = r
        else: groups.append([r, r])
    lines = [(g[0], g[1]) for g in groups if g[0] >= T]
    print("  dark lines (in from the top, thickness):", [(round((g[0] - T) / ppi_h, 2), round((g[1] - g[0] + 1) / ppi_h, 2)) for g in lines][:12])
    # the panel band: from the top to the first dark line below 2"
    first = next((g for g in lines if (g[0] - T) / ppi_h > 2), None)
    if first:
        band = a[T:first[0], L:Rt]
        pb = (first[0] - T) / ppi_h
        print(f"  top panel: {pb:.2f} in")
        # display: darkest block in the band's middle third of width
        mid = band[:, band.shape[1] // 3: 2 * band.shape[1] // 3]
        print(f"  band mean {band.mean():.0f}; middle third min {mid.min():.0f}")
        for thr, label in ((80, "black (<80)"),):
            m = band < thr
            ys, xs = np.where(m)
            if len(xs):
                print(f"  {label}: x {xs.min()/ppi_w:.2f}-{xs.max()/ppi_w:.2f} in, y {ys.min()/ppi_h:.2f}-{ys.max()/ppi_h:.2f} in from the top")
