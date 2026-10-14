# Appliance Showcase

An interactive 3D kitchen that a salesperson of high-end kitchen appliances uses
in front of a customer, to explain a layout and how its machines are installed.
In English and Chinese.

Live: <https://geesonchan.github.io/appliance-showcase/>

Where the project stands, and how the work is done: [docs/HANDOFF.md](docs/HANDOFF.md).

The hosted copy carries one anonymous page-view counter
([GoatCounter](https://www.goatcounter.com/) — no cookies, no personal data); a
copy you run yourself has none.

一个可交互的 3D 厨房：高端厨电的销售人员在顾客面前用它讲解厨房的布局，
以及机器怎么安装。中英双语。

线上地址：<https://geesonchan.github.io/appliance-showcase/>

项目现状和工作方法见 [docs/HANDOFF.md](docs/HANDOFF.md)。

线上版本只有一个匿名的访问计数（[GoatCounter](https://www.goatcounter.com/)，
无 cookie、不采集个人信息）；自己下载下来跑的版本没有。

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
| `npm test` | Build, then the unit and browser tests |
| `npm run test:unit` | The unit tests only, no browser — what CI runs |
| `npm run screenshots` | Capture a set of screenshots (below) |
| `npm run import:csv -- file.csv` | Rebuild the catalogue from a `showcase_export` CSV |

The Node version is the one in `.nvmrc`.

### Screenshots

With a server running:

```bash
npm run screenshots -- 2
```

writes `screenshots/round-2/`. `BASE_URL=http://localhost:4173` points it at
the production build; `SET=` picks one of the sets listed at the top of
`scripts/screenshots.mjs`. The directory is git-ignored.

### Diagnostics

Load any URL with `?debug=1` for a small overlay with the frame rate and how
long the last render-mode switch took, and a few handles on `window` that the
browser tests read (`__kitchen()`, `__room()`, `__pinLayout`, `__faded` and
others).

## Deployment

Every push to `master` builds and publishes the site through
`.github/workflows/pages.yml`. `vite.config.ts` sets `base: "./"`, so the same
`dist/` works at a domain root or under a GitHub Pages project path. The
workflow gives the build the visit counter's address, and only in this
repository; a copy built anywhere else counts nothing. To check the live site
against a local build, build with the same address
(`VITE_GOATCOUNTER=https://geesonchan.goatcounter.com/count npm run build`) —
see `docs/HANDOFF.md`.
