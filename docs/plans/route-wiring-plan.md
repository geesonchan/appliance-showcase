# 丁的接入 · 计划（只写计划，还没动手）

> Leo 2026-11-07 傍晚：「然后写丁的接入计划，先给我看，不动手」。
> 背景：`docs/plans/route-plan.md`。丁 600 次页面 0 次卡住，服务器只收到心跳，心跳也 0 次卡住。照 Leo 定的标准，丁就是修法。
> 只改测试环境，`src/`、`index.html`、`public/`、`data/` 一个字不动。

## 1. 共用的接法：一个小模块，其他地方只改启动那一行

**新文件** `scripts/siteRoute.mjs`（加 `siteRoute.d.mts` 给 TypeScript 用，加 `siteRoute.test.ts`）：

- `routeSite(context, { origin, dir })`：
  - 给一个浏览器上下文挂上 `context.route`；
  - 凡是 `origin` 的请求，都从 `dir`（`dist/`）读出文件回答；
  - 页面本身回答 `index.html`；文件类型照扩展名；
  - 找不到的回 404，并记一笔（见第 5 节）。
  - `routeFileOf`、`contentTypeOf` 从 `scripts/resetLoopStats.mjs` 搬过来，循环脚本改从这里引用。
- `launchSiteBrowser(options)`：
  - 照原样启动浏览器；
  - 把这个浏览器的 `newContext` 和 `newPage` 包一层：以后这个浏览器开的每个上下文，都自动挂上 `routeSite`。
  - 所以测试里**只改启动那一行**，后面开上下文、开页面的代码都不用动。
  - 另外留一个 `realServerContext(browser, options)`：开一个**不挂丁**的上下文，只给第 3 节保留的几个测试用。
- 地址不变，还是 `http://localhost:4174/…`（全套测试）或各脚本自己的地址。

**先例**：`tests/analytics.test.ts` 从第 96 轮起就是这样做的。它自己构建一份带计数器地址的网页，用 `context.route` 从那个文件夹回答，从来不经过本机服务器。

## 2. 要接的每一处，各改哪些文件

**浏览器测试**：`tests/` 下有 38 个测试文件开浏览器。

| 文件 | 改法 |
|---|---|
| 35 个（见下面清单） | 启动那一行 `chromium.launch(…)` 换成 `launchSiteBrowser(…)`，再加一行 import。每个文件改 2 行。 |
| `smoke.test.ts` | 同上，换启动那一行。另外第 3 节保留的两个测试，改用 `realServerContext` 开上下文。 |
| `pageWatch.test.ts` | **不改**，整个文件照旧走真正的本机服务器（第 3 节）。 |
| `analytics.test.ts` | **不改**，它本来就用 route 回答自己的那份构建（见上面的"先例"）。 |

35 个文件：`chimney36`、`columnBank`、`defaultDoors`、`endOfRun`、`fadeRebuild`、`fridgeFront`、`fridgeSurround`、`geometryReturn`、`hoodHousing`、`hoodKinds`、`layoutTabSwitch`、`lightStrips`、`modelCard`、`modelCardSide`、`modelLine`、`overRange`、`panelReady`、`partFence`、`qualityLock`、`ralColours`、`rangeSwap`、`rangeSwapBill`、`rightTabs`、`rule12Note`、`selfHostedFonts`、`shareLink`、`shareLinkCut`、`shareNotice`、`shareQr`、`sheetTabs`、`sideStrips`、`sliderWarning`、`toeKick`、`tooTall`、`topBar`（都是 `.test.ts`）。

- 查过：这些测试打开的都是站点根地址加参数（`?quality=high`、`?v=3&pkg=…` 之类），没有别的路径，所以不需要服务器的"找不到就回 index.html"。
- 查过：`selfHostedFonts` 和 `shareQr` 会监听浏览器发出的请求；用 route 回答的请求，这些事件照样会触发，所以它们要查的东西（不向 Google 要字体、二维码那段脚本是点了才加载）照样查得到。

**拍照脚本** `scripts/pixelShots.mjs`：

- 启动那一行换成 `launchSiteBrowser`。
- 它现在会自己开一个本机服务器（4177）。接上丁以后就不需要了，改成不开；找不到的文件照样记一笔，写进它的记录。

**空白画布探针** `scripts/blankCanvasProbe.mjs`：

- 启动的三处都换成 `launchSiteBrowser`。
- 加一个选项 `REAL_SERVER=1`，可以照旧走真正的本机服务器。探针本来就是查原因用的，留着这条旧路。

**循环脚本** `scripts/serverResetLoop.mjs`：

- 已经有 `ROUTE=1`，默认仍是走真正的本机服务器。它是量这个问题的工具，不改默认值。
- 只改成从 `siteRoute.mjs` 引用那两个函数。

**globalSetup** `tests/globalSetup.ts`：

- 照旧开本机服务器（4174）：保留的测试要用，`warm()` 也要用。
- 结束时加两项检查（第 5 节）。

**不在全套测试里的脚本**：`qualityDrop.mjs`、`swapMemory.mjs`、`screenshots.mjs`、`pixelCompare.mjs` 都是给一个地址去开的工具。这次不改，写进第 5 节的清单，并写明原因。

## 3. 保留几个测试，照旧走真正的本机服务器

保留这几个，全套测试才一直有一部分经过真正的 HTTP，才知道本机服务器本身还能用：

- **`smoke.test.ts` 里开站的基本检查，桌面和手机各一个**：
  - 桌面："loads the scene with all six pins and no console errors"；
  - 手机："keeps the three render modes on one line"（手机那一组的第一个）。
  - 理由：最基本的"网站从服务器开得起来、画得出来、没有报错"，应该走真的服务器。
- **`pageWatch.test.ts` 整个文件（2 个测试）**：
  - 理由：它测的是"页面画不出来时记下当时在做什么"那个记录工具。工具要看的是真实的请求和失败，用 route 回答就测不到它真正要面对的情况。
- 一共 **4 次打开**走真服务器，每次全套测试都有。

**这 4 个测试可能偶尔遇到 10 秒卡顿**：

- 每个都会在代码里写一行注释，说明这一点。
- 这 4 次里只有 2 次是新浏览器的第一次打开（`smoke` 和 `pageWatch` 各自的第一个测试）。按这次的实验，第一次打开出事的比例在 0.5%–1.5% 之间；其他打开在 11-06 夜里的 1,920 次里一次都没出事。所以一次全套测试里碰上的可能大约 1%–3%。
- 碰上了，通常是多等 10–40 秒，不会红：开页面最多等 90 秒，三组实验 1,800 次里没有一次断连。
- 如果真的红了，照"红就是红"报，重跑，记下时间。

## 4. 丁测不到什么，由什么补上

丁回答文件不经过 HTTP 服务器，所以下面这些，接上丁的测试都测不到：

- 响应头：文件类型由服务器给出、缓存头；
- 缓存：浏览器带上 ETag 再要一次，服务器回 304；
- 压缩：gzip 是服务器边送边压的，丁原样整个送；
- 服务器的规矩：找不到的路径回 `index.html`；
- 连接本身：连接数、保持连接、断连。

**由什么补上**：

1. **线上核对**（每一轮都做）：
   - 已有：本地带计数器地址构建的 20 个文件，和线上逐字节对比。
   - **加一项**：同时记下线上每个文件的状态码、`content-type` 和 `content-encoding`，写进报告。
   - 客户拿到的是 GitHub Pages 送的，不是本机预览服务器送的，所以"线上真的这样送"比本机服务器更要紧。
2. **第 3 节保留的 4 次打开**，走真正的本机服务器。
3. **globalSetup 的 `warm()`**：照旧用 HTTP 把页面和所有文件从本机服务器拿一遍。

## 5. 怎么防接漏

**一、静态检查**（新的单元测试 `scripts/siteRoute.test.ts`，在单元测试里，几秒跑完）：

- 扫 `tests/` 和 `scripts/` 下所有文件，找 `chromium.launch(` 和 `launchPersistentContext(`。
- 每一处都必须满足下面一条，否则测试红，并说出是哪个文件哪一行：
  - 用的是 `launchSiteBrowser`；
  - 或者在一张写明原因的名单上：`pageWatch.test.ts`（保留真服务器）、`analytics.test.ts`（自己 route）、`serverResetLoop.mjs`（量问题的工具）、第 2 节那 4 个不在全套测试里的脚本。
- `realServerContext` 的每一处用法，也必须在名单上（就是 `smoke.test.ts` 那两个）。
- **测试先红**：接之前跑，应该红在那 35 个文件和两个脚本上。接完变绿。
- 以后谁新加一个开浏览器的测试却没接丁，这条测试就会红。

**二、运行时检查**（globalSetup 结束时）：

- 保留的那几个上下文，开的时候带一个请求头 `x-real-server: 1`。服务器的记录（`scripts/previewServer.mjs`）把这个头也记下来。
- 全套测试结束时，globalSetup 读服务器的记录：
  - 凡是页面本身的请求（`/?…`）**没带这个头的**，说明有测试没接上丁 → 全套测试红，列出是什么时候、什么地址；
  - 第 1 节记下的"找不到的文件" → 也红，列出来。
- 只看页面本身的请求就够了：一个没接丁的上下文，第一个请求一定是页面本身。
- 用请求头而不用网址参数，是因为网址参数会进页面，可能被网页读到；请求头不会。

## 6. 怎么证明

接好以后：

1. 单元测试全过，静态检查从红变绿。
2. **跑一次全套测试**（按 90 分钟排，17:45 前跑完，所以最晚 16:15 开始），和以前的全套测试对比：
   - **总用时**：以前是 77、86、75 分钟（2026-11-06 22:10 那次 4,525 秒）；
   - **每个文件的用时**：和 22:10 那次的记录逐个对比；
   - **卡顿记录**：`test-results/preview-server/` 里的服务器记录、`test-results/blank-canvas/` 里画不出来的记录。接丁的那些测试，本站文件应该一次都不超过 5 秒；保留的 4 次打开单独列。
   - **运行时检查**：没带头的页面请求 0 个，找不到的文件 0 个。
3. **拍照一组**（照原来的拍照开法）：
   - 本站文件有没有超过 5 秒的；
   - 和以前"每 300 次左右断一次"对比，一组的打开次数也写出来。
4. 都过了，才提交、推送、线上核对，线上核对加上第 4 节那一项。

## 7. 要你定的

1. 第 3 节保留哪几个走真服务器：我建议 `smoke` 的桌面、手机各一个，加 `pageWatch` 整个文件。你要多留或少留，说一声。
2. 运行时检查用请求头 `x-real-server: 1`，要记下这个头，得改 `scripts/previewServer.mjs` 的记录。可以吗？
3. 探针脚本默认接丁，加 `REAL_SERVER=1` 走旧路；循环脚本默认仍走真服务器。可以吗？
4. `pixelShots.mjs` 接丁以后不再自己开服务器。可以吗？
5. 线上核对加记"状态码、`content-type`、`content-encoding`"。可以吗？

## 8. 改动的文件一览

- 新：`scripts/siteRoute.mjs`、`scripts/siteRoute.d.mts`、`scripts/siteRoute.test.ts`
- 改：
  - 36 个测试文件：35 个只改启动那一行和 import，`smoke.test.ts` 另改 2 个测试开上下文的地方；
  - `tests/globalSetup.ts`（结束时的检查）；
  - `scripts/previewServer.mjs`（记下请求头）；
  - `scripts/pixelShots.mjs`、`scripts/blankCanvasProbe.mjs`；
  - `scripts/serverResetLoop.mjs`、`scripts/resetLoopStats.mjs` 和它的测试（两个函数搬走）。
- 不动：`pageWatch.test.ts`、`analytics.test.ts`、网页代码。

## 9. Leo 的答复和补充（2026-11-07 傍晚）

Leo：「接入计划看过了，第 7 节五条都同意，现在开始做，做完接着跑，中间不用等我。另外补两点，先写进计划再动手」。第 7 节五条照我的建议定。

**补充一：siteRoute 的测试要和 previewServer 的一样严。**

照 `scripts/previewServer.test.ts` 的情况，逐条写，先在旧代码上变红：

- **首页**：`/` 回答 `index.html`，类型 `text/html`。
- **文件类型**：
  - `.js` 回答 JavaScript 类型。浏览器开 `type="module"` 的脚本时，类型不对就不执行，所以在真浏览器里也要证明模块脚本跑起来了；
  - `.woff2` 回答 `font/woff2`，在真浏览器里证明字体加载成功；
  - `.css` 回答 `text/css`。
- **找不到的文件回首页**：和 `vite preview` 一样，回 `index.html`，状态 200。
  - 这一条改了第 1 节原来写的"回 404"。
  - 照样记一笔，globalSetup 结束时检查：全套测试里只开站点根地址，正常应该一笔都没有（第 5 节）。
- **网站路径前缀** `/appliance-showcase/`：线上地址带这个前缀。`/appliance-showcase/assets/x.js` 回答 `dist/assets/x.js`，`/appliance-showcase/` 回答首页。
- **越界**：`..`、编码过的 `%2e%2e`、藏在反斜杠后面的 `..%5c`、`%00`，都不能读出 `dist/` 以外的文件。
  - 测试在 `dist/` 旁边放一个"秘密"文件，用这几种写法去要，回答里都不能有它。
- **两层测试**：
  - **单元测试** `scripts/siteRoute.test.ts`：直接测"给一个地址，回答什么"（状态、类型、内容），用临时文件夹里的一份小构建。和 previewServer 的测试一样，不需要先 `npm run build`，CI 也能跑。
  - **浏览器测试** `tests/siteRoute.test.ts`：在全套测试里，用真浏览器开那份小构建，证明模块脚本执行了、字体加载了、前缀可用、越界读不到，并且本机服务器一个请求都没收到。
  - previewServer 测的"压缩"不适用：丁不压缩，这一点第 4 节已写明由线上核对补上。

**补充二：36 个测试文件只改"怎么启动浏览器"，不改任何一条测试检查的内容。**

- 每个文件只动两处：
  - 启动那一行：`chromium.launch(…)` → `launchBrowser(…)`，参数原样不动；
  - import：加一行 `import { launchBrowser } from "./siteBrowser";`；如果 `chromium` 只在启动那一行用过，就从 playwright 那一行 import 里拿掉。
- 为此新加 `tests/siteBrowser.ts`：把 `launchSiteBrowser` 绑上全套测试的地址（`PREVIEW_URL`）和 `dist/`，测试文件不用各自写这两样。
- `smoke.test.ts` 另外 2 处：保留走真服务器的两个测试，开上下文那一行改用 `realServerContext`。这两处在报告里单独说明。
- 报告里用 `git diff --stat` 和每个文件的改动行证明：每个文件只动了启动那一行和 import。

**顺序**：

1. 写代码，测试先红后绿，单元测试全过；
2. 全套测试（按 90 分钟算）：跑前读电源设置，跑后查系统日志；和以前几次比总用时、每个文件的用时、卡顿记录；保留的 4 次真服务器打开单独列出；接漏检查（静态和运行时）的结果写清楚；
3. 接丁以后拍照一组，确认能用；
4. 跑完就停，不提交、不推送；确认没有残留进程和测试浏览器（按路径查），端口都空着。

## 10. 做完的结果（2026-11-07 晚，没提交）

- 全套测试 17:10:14–18:28:20，exit 0：166 个文件、3,522 条全过，用时 4,673 秒。
- 结束时的检查：保留的真服务器页面请求 3 个，没接上的 0 个，找不到的文件 0 个。
- 拍照一组 18:29:02–18:37:42，exit 0：45 张，3D 画布和 11-06 夜里那组 45 张全部逐像素相同。
- 和计划不同的两处：
  - `sliderWarning.test.ts` 没改：它开的是开发服务器，不是丁回答的那份构建。写进了防接漏名单，并写明原因。
  - 保留走真服务器的打开是 3 次，不是 4 次：`pageWatch` 另一个测试开的是 `data:` 网页。
- 详细在 decisions.md 的 "丁's wiring, built"。
