# 页面 60 秒画不出来 · 调查计划

> **只查不改，等 Leo 看过再动。** Leo 2026-11-05 登记：「页面偶尔 60 秒都画不出来，已经三次……列出可以怎么查……以及要不要在测试里自动记下这些。先写计划给我看。」登记在 `docs/decisions.md` 的 Open items，接在第 83 轮那条 "A browser test that times out waiting for the page to draw" 下面。

## 1. 现在知道的

**这三次**：

| 时间 | 在哪 | 现象 | 当时机器 |
|---|---|---|---|
| 2026-11-04 晚 | 全套测试，`tests/rangeSwap.test.ts`（A 的 rangetop，桌面） | 等 canvas 60 秒不出 | 两段现代待机（506→507），22:37–23:08、23:12–23:46 |
| 2026-11-04 | 第 101 轮第一步拍像素，新版第一遍 | 第一个页面：服务器断开连接（ERR_CONNECTION_RESET） | 未查日志 |
| 2026-11-05 11:05 | 第 101 轮第二步拍像素，新版第一遍，第二个页面（A 的默认房间） | 等 canvas 60 秒不出 | 系统日志没有待机、睡眠；服务器日志没有报错 |

第二次是连接被断开，和另外两次不一定是一回事，但同样是"页面没起来"，一起查。

**更早的同类**（同一条 Open item）：
- 第 83 轮两次（rangeSwap，modelCard）。
- 第 86 轮一次（modelLine；同一轮另一个测试有 `ERR_CONNECTION_CLOSED`）。
- 第 87 轮证明了：几个浏览器测试文件同时跑会互相抢资源，13 个页面没加载出来。从那以后全套改成一个文件接一个文件跑。
- 之后单个页面偶尔不出来，一直没查到原因。

**现在什么都没留下**：测试和拍图脚本里，`waitForSelector("canvas")` 一超时就直接抛错。这时控制台里有什么、哪个文件没下载成功、WebGL 有没有起来、页面停在哪一步，全都没有记录。所以每次只知道"60 秒没画出来"。

## 2. 可能的原因（都还没证实）

1. **机器待机或降频**：第一次就是在待机里。待机期间计时器照走，页面却不动。
2. **某个文件没下载成功**：预览服务器断开或拒绝了请求（第 86 轮的 CLOSED，第一步拍图的 RESET）。主文件或 three 的文件缺了，React 就挂不上，canvas 永远不出现。
3. **页面自己的脚本出错**：挂载前就抛错，canvas 不出现（会在 `pageerror` 里，现在没记）。
4. **WebGL 没建起来或中途丢了**：GPU 进程崩了或被重置，`webglcontextcreationerror` / `webglcontextlost`。canvas 元素在，但可能不可见，或者一直空白。
5. **着色器编译太久**：ANGLE/D3D11 第一次编译、驱动卡住，第一帧迟迟画不出来（canvas 在，但页面可能把它藏到第一帧画完）。
6. **浏览器标签页本身崩了**（Playwright 的 `crash` 事件），或者浏览器断开。

## 3. 怎么查：出事那一刻记下这些

只在出事时记，测试通过时什么都不多做。

| 记什么 | 怎么记 | 能分开哪几种原因 |
|---|---|---|
| 控制台的错误、警告，`pageerror` | `page.on("console")`、`page.on("pageerror")`，从页面打开起一直收着（测试里已经在收，超时时没打印出来） | 3 |
| 下载失败的请求、4xx/5xx 响应 | `page.on("requestfailed")`、`page.on("response")`，记下网址、错误、耗时 | 2 |
| 每个资源的加载时间 | `performance.getEntriesByType("resource")`、`navigation` | 2、1 |
| WebGL 建立失败、丢失、恢复 | 打开页面前注入脚本：包住 `HTMLCanvasElement.prototype.getContext`，给每个 canvas 挂 `webglcontextcreationerror` / `webglcontextlost` / `webglcontextrestored`，记时间 | 4 |
| GPU 状态 | CDP 的 `SystemInfo.getInfo`：GPU 型号、驱动，有没有退到软件渲染 | 4、5 |
| 第一帧画出来的时间、着色器数量 | 现有的 devtools 钩子已经包了 `render`，再记第一次 `render` 的时间和 `renderer.info.programs.length`；`PerformanceObserver("longtask")` 记长任务 | 5 |
| 页面停在哪一步 | 超时那一刻：`document.readyState`、`#root` 下有什么、canvas 在不在、尺寸和是否可见、页面上的文字；外加一张截图 | 2–6 都看得出一部分 |
| 标签页崩溃、浏览器断开 | `page.on("crash")`、`browser.on("disconnected")` | 6 |
| 机器当时的状态 | 出事时间前后的系统日志：Kernel-Power 42/506/507/107、电源事件；CPU 占用（可选） | 1 |
| 服务器那边 | 预览服务器现在不记请求。可选：测试用的服务器换成一个会记每个请求的小静态服务器 | 2 |

**再主动复现一次**：写一个循环脚本，同一个构建打开页面 200 次（桌面、手机各半），每次都带上上面的记录。量从打开到 canvas 出现、到第一帧画出来的时间分布，看能不能撞到一次。分三种条件各跑一遍：
- 安静时单独跑；
- 同时开三个浏览器加压；
- 每次新开浏览器，和整轮复用同一个浏览器。

第 93 轮查手机点按就用过这种复现循环（120 次，没撞到）。

## 4. 要不要在测试里自动记（请你选）

- **甲（建议）**：写一个共用的 `tests/pageWatch.ts`。每个浏览器测试的 `open()`，以及 `scripts/pixelShots.mjs`，都改用它打开页面。canvas 超时时，它把第 3 节那些写成一份 JSON，加一张截图，放进 `test-results/blank-canvas/`，并把要点附在失败信息里。
  - 改动：34 个打开页面的浏览器测试文件都要接上。其中 27 个有自己的 `open()`，改成调用它；另外 7 个直接 `page.goto`，把那几处换掉。再加上拍图脚本。`previewServer.test.ts` 不开页面，不动。
  - 测试通过时行为不变，只多挂几个监听。全套的测试数不变。
- **乙**：测试不动，只写第 3 节的复现循环脚本（`scripts/blankCanvasProbe.mjs`），专门去撞。
  - 改动小。但真正在全套里出事的那一次，照旧什么都没留下。
- **丙**：甲和乙都做。

不管选哪个，规矩不变：出过一次红的全套就不算通过；有待机的那一次也不算。

## 5. 不在这里

- 不改页面本身的加载流程（等查到原因再说）。
- 不改 60 秒、90 秒这些超时数字。
- 不改测试的跑法（一个文件接一个文件跑，第 87 轮定的）。
