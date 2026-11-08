# 2026-11-07 晚：丁接进测试和拍照

> Leo：「接入计划看过了，第 7 节五条都同意，现在开始做，做完接着跑，中间不用等我。」
> 都做完了：**全套测试 166 个文件、3,522 条全过**；结束时的检查是没接上的 0 个、找不到的文件 0 个；接丁以后拍照能用。
> 中途有 3 次运行红了，都是我自己的错，都照实写在下面，没有重跑掉。
> **没提交、没推送**。线上还是 `d668c58`。没碰 Norton 设置，没碰网页代码。

## 时间表

| 事 | 开始 | 结束 | exit |
|---|---|---|---|
| 你补的两点写进计划第 9 节 | 16:58 | 17:00 | — |
| 新测试在旧代码上跑（先红） | 17:01:41 | 17:01:52 | 单元 1、浏览器 1（**红，应该的**） |
| 单元测试 | 17:06:21 | 17:06:33 | **1（红，我的错 ①）** |
| 单元测试 | 17:06:47 | 17:07:05 | **1（同一个红，我的错 ②）** |
| 单元测试 | 17:07:16 | 17:07:35 | 0（126 个文件，3,168 条） |
| 构建 + 3 个浏览器测试试跑 | 17:07:45 | 17:08:25 | 构建 0，试跑 **1（红，我的错 ③）** |
| 单元测试 | | 17:09:25 | 0（3,168 条） |
| 3 个浏览器测试再试 | | 17:09:54 | 0 |
| 跑前读电源设置 | 17:10:03 | | 插电，睡眠、休眠、关屏都是"从不" |
| **全套测试**（`npm test`） | **17:10:14** | **18:28:20** | **0** |
| **拍照一组** | **18:29:02** | **18:37:42** | **0** |
| 和 11-06 夜那组照片对比 | 18:38:03 | 18:38:24 | 0 |
| 查残留、端口、系统日志 | 18:38:33 | 18:38:51 | — |

**三次红，都是我的错**：

1. **17:06 单元测试红**：防接漏的静态检查只数 `realServerContext(` 这种直接调用。`smoke` 里是把它当函数传进去的，没被数到。
2. **17:07 又红一次，一样的原因**：我改这条检查的那一下，因为转义问题没改成功，测试没变，所以同样红。之后改成"除 import 以外提到它的行都算"，才变绿。
3. **17:08 试跑红**：结束时的检查把 globalSetup 自己的两次请求当成了"没接上丁"——一次是等服务器起来，一次是预热。
   - 这一次也证明了：结束时的检查真的能让全套测试变红（exit 1）。
   - 改成只看预热结束以后的请求。先改测试，测试变红，再改代码。

## 一、改了哪些文件

**新文件（5 个）**：

- `scripts/siteRoute.mjs`：丁本身。
  - 照 `vite preview` 的样子回答：首页、每个文件和它的类型、找不到的文件回首页并记一笔；
  - 网站前缀 `/appliance-showcase/` 当根处理；越界的路径一律拒绝。
- `scripts/siteRoute.d.mts`：给 TypeScript 用的类型。
- `scripts/siteRoute.test.ts`：单元测试，见第二节。
- `tests/siteRoute.test.ts`：浏览器测试，见第二节。
- `tests/siteBrowser.ts`：`launchBrowser`，把丁绑上全套测试的地址和 `dist/`。

**改过的（46 个已经在仓库里的文件）**：

- **36 个测试文件**，见第三节的统计。
- `tests/globalSetup.ts`：结束时的检查（读服务器记录和"找不到的文件"，写 `test-results/site-route/summary.json`，有问题就让全套测试红）。
- `scripts/previewServer.mjs`：带 `x-real-server: 1` 的请求，记录里写上 `realServer: true`。
- `scripts/previewServer.test.ts`：加了上面这一条的测试。
- `scripts/pixelShots.mjs`：用丁启动浏览器，不再自己开服务器。
- `scripts/blankCanvasProbe.mjs`：三处启动都接丁；`REAL_SERVER=1` 走旧路。
- `scripts/serverResetLoop.mjs`、`scripts/resetLoopStats.mjs`、`scripts/resetLoopStats.test.ts`：两个函数搬到 `siteRoute.mjs`，循环的 `ROUTE=1` 改走它。
- 文档：`docs/decisions.md`、`docs/HANDOFF.md`。另外 `docs/plans/route-wiring-plan.md` 加了第 9、10 节（它还没进过仓库，不在这 46 个里）。

**和计划不同的两处**：

- **`sliderWarning.test.ts` 没改**：它开的是开发服务器（另一个端口，直接跑源代码），不是丁回答的那份构建，接了也碰不到它的页面。已写进防接漏名单，写明了原因。
- **保留走真服务器的打开是 3 次，不是 4 次**：`pageWatch` 的另一个测试开的是 `data:` 网页，不开网站。

## 二、siteRoute 的测试（照 previewServer 的一样严）

**单元测试** `scripts/siteRoute.test.ts`：用临时文件夹里的一份小构建，不用先构建，CI 也能跑。逐条照 `previewServer.test.ts` 写：

- 首页：`/`、带参数的 `/?quality=high&qualityLock=1`、不带斜杠的根地址，都回首页，类型 `text/html`。
- 文件类型：`.js` 是 JavaScript，`.woff2` 是 `font/woff2`（逐字节核对），`.css`、`.txt` 也核对了。
- 找不到的文件回首页，状态 200，并标明"回了首页"。
- 前缀：`/appliance-showcase/`、`/appliance-showcase`、`/appliance-showcase/assets/…` 都照常回答。
- 越界：10 种写法（`..`、`%2e%2e`、`..%2f`、`..%5c`、前缀加 `..`、`%00`、坏的编码），回答里都没有 `dist/` 旁边那个"秘密"文件。网址解析器自己消化不掉的那几种，直接回 404。
- 不是本站地址的请求不回答。
- 另外还测了：结束时那项检查怎么认请求，以及静态防接漏。

**浏览器测试** `tests/siteRoute.test.ts`：在全套测试里跑，用的是 4198 端口，那里**根本没有服务器**，所以只要有一个请求绕过了丁，就会直接失败。

- 模块脚本执行了（类型不对浏览器就不会执行）；
- woff2 字体真的加载成功；
- 前缀 `/appliance-showcase/` 下一样能用；
- 直接用 `browser.newPage()` 开的页面也接上了丁；
- 找不到的文件回首页，并且记下来了；
- 越界读不到"秘密"文件；
- 走真服务器的上下文没接丁：4198 上没有服务器，所以连接被拒绝。

**previewServer 的测试**：加了一条，带请求头的请求记上 `realServer`，不带的不记。

## 三、36 个测试文件只改了"怎么启动浏览器"

`git diff --numstat` 的统计：

| 文件 | 加 | 删 | 改了什么 |
|---|---:|---:|---|
| 34 个（下面列出） | 3 | 2 | 只有 import 和启动那一行 |
| `smoke.test.ts` | 10 | 6 | 同上 3 行，另加单独说明的 2 处 |
| `pageWatch.test.ts` | 3 | 1 | 单独说明 |

**34 个文件**：`chimney36`、`columnBank`、`defaultDoors`、`endOfRun`、`fadeRebuild`、`fridgeFront`、`fridgeSurround`、`geometryReturn`、`hoodHousing`、`hoodKinds`、`layoutTabSwitch`、`lightStrips`、`modelCard`、`modelCardSide`、`modelLine`、`overRange`、`panelReady`、`partFence`、`qualityLock`、`ralColours`、`rangeSwap`、`rangeSwapBill`、`rightTabs`、`rule12Note`、`selfHostedFonts`、`shareLink`、`shareLinkCut`、`shareNotice`、`shareQr`、`sheetTabs`、`sideStrips`、`toeKick`、`tooTall`、`topBar`。

- 每个文件动的 5 行，我用脚本逐行归类过，只有三种：
  - playwright 那一行 import 拿掉 `chromium`；
  - 加一行 `import { launchBrowser } from "./siteBrowser";`；
  - `chromium.launch(…)` 改成 `launchBrowser(…)`，参数原样。
- 34 个文件里**没有一行**属于别的。

**`smoke.test.ts` 另外的 2 处**：

1. `openPage` 多了一个参数 `realServer`。为 true 时，用 `realServerContext` 开上下文，其他照旧。改了 2 行。
2. 两个开站检查——桌面 "loads the scene with all six pins and no console errors"、手机 "keeps the three render modes on one line"——调用时传 `true`，各加一行注释："走真服务器，可能偶尔遇到 10 秒卡顿"。改了 2 行，加了 2 行注释。

- 两个测试里检查的内容一条没动。

**`pageWatch.test.ts`**：

- 文件里只有一个测试真的打开网站。它开上下文那一行，改用 `realServerContext`，这样服务器记录能认出它；
- 加了一行同样的注释和一行 import；
- 检查的内容没动。

## 四、全套测试

- 跑前 17:10:03 读电源设置：插电，睡眠、休眠、关屏都是"从不"。
- **17:10:14–18:28:20，exit 0**：166 个文件、3,522 条全过。
- 跑后查系统日志：17:05 起没有 42、506、507、107、187、41、6008 号事件。**跑过了 18:00，电脑没睡。**

**总用时对比**：

| 哪一次 | 用时 |
|---|---:|
| 字体那一轮（11-06 下午） | 5,173 秒（86 分钟） |
| 11-06 夜 | 4,525 秒（75 分钟） |
| **这次（接丁后）** | **4,673 秒（78 分钟）** |

**每个文件的用时**（秒，三次都有的 39 个浏览器测试文件）：

| 文件 | 字体轮 | 11-06 夜 | 接丁后 |
|---|---:|---:|---:|
| smoke | 1,012.5 | 759.1 | 792.7 |
| fadeRebuild | 729.7 | 666.2 | 658.5 |
| modelCard | 425.7 | 378.6 | 408.3 |
| modelCardSide | 441.4 | 373.2 | 393.0 |
| modelLine | 309.5 | 274.4 | 275.7 |
| shareLinkCut | 228.2 | 213.0 | 220.4 |
| layoutTabSwitch | 217.2 | 197.9 | 198.2 |
| rangeSwap | 193.2 | 184.7 | 189.1 |
| sideStrips | 152.9 | 147.7 | 149.5 |
| geometryReturn | 135.8 | 121.8 | 128.7 |
| ralColours | 121.0 | 120.3 | 121.5 |
| overRange | 121.7 | 101.8 | 108.2 |
| partFence | 104.8 | 96.0 | 98.3 |
| shareLink | 80.8 | 66.8 | 72.4 |
| analytics | 74.6 | 62.7 | 66.8 |
| fridgeSurround | 56.9 | 55.3 | 55.4 |
| hoodHousing | 56.9 | 51.7 | 51.8 |
| tooTall | 48.0 | 45.2 | 45.3 |
| chimney36 | 44.2 | 42.3 | 44.0 |
| fridgeFront | 43.1 | 38.6 | 40.9 |
| panelReady | 40.8 | 38.4 | 40.1 |
| defaultDoors | 40.2 | 36.9 | 39.1 |
| rightTabs | 39.4 | 38.4 | 38.1 |
| shareQr | 37.7 | 29.4 | 28.9 |
| toeKick | 38.3 | 35.9 | 36.4 |
| hoodKinds | 42.3 | 36.0 | 36.0 |
| rule12Note | 36.0 | 33.8 | 33.8 |
| sheetTabs | 29.2 | 27.7 | 28.3 |
| rangeSwapBill | 28.8 | 27.2 | 28.2 |
| shareNotice | 26.0 | 25.2 | 24.9 |
| sliderWarning | 24.9 | 14.1 | 18.2 |
| columnBank | 23.7 | 20.0 | 20.7 |
| qualityLock | 21.8 | 21.4 | 21.5 |
| topBar | 20.7 | 19.9 | 19.6 |
| lightStrips | 17.5 | 14.8 | 16.6 |
| endOfRun | 16.8 | 15.0 | 15.8 |
| pageWatch | 4.7 | 4.2 | 4.2 |
| selfHostedFonts | 4.4 | 4.1 | 4.4 |
| previewServer | 1.2 | 0.9 | 0.9 |
| **合计** | **5,093** | **4,441** | **4,574** |
| siteRoute（新） | — | — | 0.9 |

- 和 11-06 夜相比，39 个里有 27 个差在 5% 以内。
- 差得最多的是 `sliderWarning` +29%（14.1 → 18.2 秒，它走开发服务器，没接丁），其次 `lightStrips` +12%、`shareLink` +8%；最少的 `shareQr` −2%。
- **丁没让全套测试变快**。以前那两次全套测试本来就没碰上卡顿：11-06 夜那次的服务器记录里，没有一个请求超过 1 秒。丁的作用是去掉碰上 10 秒卡顿的可能，不是提速。

**卡顿记录**：

- 服务器一共只收到 **26 个请求**（11-06 夜那次是 2,359 个）：
  - 没有一个超过 1 秒；
  - 没有被断开的；
  - 没有连接出错。
- 服务器主线程超过 1 秒的卡顿有 3 次（1,544、1,265、1,172 毫秒），当时它没有东西要送。11-06 夜那次一次都没有，最长 416 毫秒。
- 没有新的"画不出来"记录。

**保留走真服务器的 3 次打开**：

| 测试 | 时间 | 服务器回应页面 | 状态 |
|---|---|---:|---|
| smoke 桌面 "loads the scene…" | 17:10:37 | 2 毫秒 | 200 |
| smoke 手机 "keeps the three render modes on one line" | 17:13:45 | 2 毫秒 | 200 |
| pageWatch "the real page that draws" | 18:23:06 | 1 毫秒 | 200 |

- 3 次都没碰上卡顿，它们页面里的文件也没有一个超过 1 秒。
- 3 次都不是新浏览器的第一次打开：`smoke` 的浏览器先做了一次（接了丁的）预热，`pageWatch` 先开的是 `data:` 网页。所以它们碰上 10 秒卡顿的可能，比计划里估的还低。

**防接漏的结果**：

- **静态**（单元测试里）：
  - 接之前红，红在 40 处：36 个测试文件、拍照脚本 1 处、探针脚本 3 处；
  - 接完全绿。
  - 名单上留着、写明原因的：`pageWatch`（保留真服务器）、`analytics`（自己 route）、`sliderWarning`（开发服务器）、`serverResetLoop`（量问题的工具）、4 个不在全套测试里的工具脚本，以及 `siteRoute.mjs` 自己。
  - `realServerContext` 只出现在 `smoke`、`pageWatch`、`siteRoute` 浏览器测试各一处。
- **运行时**（全套测试结束时）：
  - 保留的真服务器页面请求 3 个，**没接上丁的 0 个，找不到的文件 0 个**；
  - 写在 `test-results/site-route/summary.json`。
  - 试跑那次已经证明，有问题时它真的会让全套测试红。

## 五、拍照一组（接丁以后）

- **18:29:02–18:37:42，exit 0**：45 个状态都拍了。
  - 用的是 `dist/`（`index-D3IWZtrQ.js`，就是 `d668c58`，不带计数器地址）；
  - 没开服务器；没有找不到的文件。
- **确认能用**：用 `pixelCompare.mjs` 和 11-06 夜那一组比（那组走的是真服务器，`664b570`）：
  - **45 个状态的 3D 画布全部逐像素相同**；
  - 手机截图完全相同；
  - 桌面截图差 1,4xx–1,5xx 个像素，就是页脚的提交号 `664b570` → `d668c58`，那一行字因此挪了 1 像素。

## 六、收尾（18:38:51）

- 没有残留的 node、esbuild、typeperf 进程或测试浏览器（按 `ms-playwright` 路径查的）。
- 测试用的端口（4173–4178、4191、4196–4199、4206、5173）都空着。
- 什么都没提交、没推送。
