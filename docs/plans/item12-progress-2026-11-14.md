# 第 12 项的记录（2026-11-14 下午起）

Leo 的话（2026-11-14 下午）：
- 「第 11 项上线的报告和第 12 项第二稿看过了。」
- 【只有这一处要我填】：手机卡片「照丁的原型做」；微波炉式的叫法统一成「店里做法，不带 24″」。
- 「第 12 项第二稿确认，第 1、2、4 条可以动手，做到本地预览为止，不提交。第 3 条这一轮不改页面。」
- 第 2 条的句子：
  - recommended / suggested 的三台（AK7136BS-BF、AK7300AS、VCIN36GWS）用新句子「最小 {min}，建议最大 {max}」/ "min {min}, recommended max {max}"，他同意，可以进 `reviewed.json`，写明是他 2026-11-14 同意的；
  - PH36HWS 还是「最小 30，最大 40」；
  - 没写最大的三台用现成的「最小 {min}，燃气与电磁相同」，逐台核对燃气和电磁的最小值相同，页码写进数据；
  - 现成的那几句不在 `reviewed.json` 里，把中英文原文列给他看，不要自己写成"已审"；
  - `dimension.clearanceRange` 改完没人用了就拿掉。
- 全套测试开跑前先问他。

计划：`item12-plan.md`（第二稿）。时间都是这台电脑的本地时间，exit code 是命令真实返回的。

---

## 0. 动手前查到的、要报给 Leo 的

1. **PH36HWS 的安装指南写了"建议"**（`ph36hws-install.pdf`，8001213268 A）：
   - 印刷页第 6 页（文件第 10 页；这里原写「PDF 第 8 页」，错了，2026-11-14 晚用 pdftotext 更正，见第 13 节）："30'' (762 mm) to a suggested maximum height of 40'' (1,016 mm)"；
   - 印刷页第 11 页（文件第 15 页；原写「PDF 第 13 页」，同样更正）："30'' (762 mm) to a maximum height of 40'' (1,016 mm)"，没有 suggested。
   - `docs/reference/README.md` 也记着"Page 6: 30" to a recommended maximum of 40""。第二稿 2.5 节"PH36HWS 没写建议"是我写错的。
   - 照 Leo 明说的做：PH36HWS 写「最小 30，最大 40」。要不要也用"建议"那句，等他定；改的话是数据里一个标记。
2. **核对过的原文**（2026-11-14 下午，用 Node 解出页面的字）：
   - VCIN36GWS（`vcin36gws-manual.pdf`）第 8 页："ranges from a minimum height of 30'' (762 mm) to a suggested maximum height of 40''"。
   - AK7136BS-BF（`ak7136bs-bf-install.pdf`）第 13 页："Minimum mounting height … should be no less than 24”." "Maximum recommended mount height should be no higher than 32”."
   - AK7300AS（`ak7300as-install.pdf`）第 10 页："… no less than 24”." "Maximum recommended mount height should be no higher than 34”."
   - HMCB30WS、HMCB36WS（同一本 `hmcb36ws-install.pdf`）第 9 页："For gas cooktop & range installations: Mount the hood so the bottom is at least 30” … For electric/induction cooktop & range installations: … at least 30”"；第 13 页同样两句。图上也是 "30" (762) min over a gas cooktop / … over a electric cooktop"。
   - HMWB361WS（`hmwb361ws-install.pdf`）第 9 页、第 13 页：同样的两句，都是 30″。
3. **`dimension.clearanceRange` 还有人用**：`dimensions.ts` 里没有选中油烟机时的后备分支用它。页面上油烟机总是选着的，所以页面不会走到这一支；只有几条单元测试（例如 `rangeFillers.test.ts`）不给油烟机时会走到。照"没人用了就拿掉"，它还有人用，这一轮保留；要不要把后备分支也改掉、把它拿掉，等 Leo 说。
4. **`dimension.shopPracticeFigure`（「店里做法 {figure}」）改完就没人用了**：统一成「店里做法」以后，E 一字型的微波炉式也用 `dimension.shopPractice`。照第 5 条的同一个道理把它拿掉。
5. **`dimension.shopPractice` 在 `reviewed.json` 里**，中文是「店内做法」。改成「店里做法」要改 `reviewed.json` 里那一条的字，写明是 Leo 2026-11-14 定的（「微波炉式的叫法统一成：店里做法，不带 24″」）。英文 "shop practice" 不变。

## 1. 这一轮有意要变的（逐个列出，先写后拍）

1. **管线进口**：L 型、一字型，所有套餐，安装模式里电表箱和燃气、电、上下水主管的起点，从离后墙远端 4″ 挪到 48″。U 型不变。
2. **A–D 油烟机线旁的字**（安装模式，灶面到油烟机下沿那条线；L 型、一字型、U 型都一样）：
   - 默认房间：
     - A（PH36HWS）：「燃气最小 30，最大 40」→「最小 30，最大 40」
     - B、D（VCIN36GWS）：「燃气最小 30，最大 40」→「**最小 30，建议最大 40**」
     - **C（HMCB30WS）**：「燃气最小 30，最大 40」→「**最小 30，燃气与电磁相同**」
   - 换油烟机时：
     - PH36HWS：→「最小 30，最大 40」
     - VCIN36GWS：→「最小 30，建议最大 40」
     - AK7136BS-BF：→「最小 24，建议最大 32」
     - AK7300AS：→「最小 24，建议最大 34」
     - HMCB30WS、HMCB36WS、HMWB361WS：→「最小 30，燃气与电磁相同」
     - JVM3160RFSS（微波炉式）：「店内做法」→「**店里做法**」
   - 英文对应："gas min 30, max 40" → "min 30, max 40" / "min 30, recommended max 40" / "min 30, gas or induction"；微波炉式 "shop practice" 不变。
3. **E 的油烟机线旁的字**（E 一字型、E 的 U 型，本来就按说明书写）：
   - 选 VCIN36GWS、AK7136BS-BF、AK7300AS 时带上"建议"：「最小 30，建议最大 40」「最小 24，建议最大 32」「最小 24，建议最大 34」；
   - 选 JVM3160RFSS 时「店里做法 24″」→「店里做法」/ 'shop practice 24"' → "shop practice"。
   - E 的默认房间（HMCB36WS；L 型是岛上的 HMIB42WS）不变。
4. **手机上的模型卡**（窄于 768）：照丁——标题 11 号字一行，"Specified" 挪到第二行右边，每一格 168 → 228 宽。英文下卡高回到主标题之前；中文本来没变高，高度不变。
5. 油烟机挂的高度、尺寸线上的数：**不变**。

## 2. 45 个像素状态（`scripts/pixelShots.mjs`）

- **有意要变的 5 个**：`desk-A-install`、`desk-B-install`、`desk-C-install`、`desk-D-install`、`desk-E-install`。
  - A–D：管线进口 + 线旁的字；
  - E（L 型，岛上油烟机）：只有管线进口。
- **必须逐像素相同的 40 个**：
  - `desk-{A..E}-materials`、`desk-{A..E}-white`、`desk-{A..E}-fly-refrigerator`、`desk-{A..E}-fly-dishwasher`（20 个，不是安装模式；桌面的卡没改）；
  - `link-{A..E}`、`link-{A..E}-noisland`（10 个，真实材质）；
  - `phone390-{A..E}`、`phone360-zh-{A..E}`（10 个，手机打开时不选机器，卡不出现）。
- 每次拍都会有的 1 个像素那种浮动（`link-E`、`link-A-noisland` 以前出现过）：补拍核对，照实写。

## 3. 底稿（L 型、一字型、U 型）

- 预期变的：A–D 每一间（和 E 换了那几台油烟机的房间）的尺寸链里，`cooktop-to-canopy` 那一条的 `noteKey`、`noteVars`。
- 预期不变的：别的一切，包括尺寸线上的数（`valueIn`）、房间、柜子、清单、接点。管线进口不在底稿里。

## 4. 改了什么

- **管线进口**（第 1 条，写法乙）：
  - `src/data/serviceRoute.ts`：`serviceEntryPoint` 三种房型都用 `serviceEntry()`，去掉 L 型、一字型的 `ROOM.halfX - ft(4)`；
  - 注释：`room.ts`、`UtilityLayer.tsx`。电表箱本来就画在进口那一点，跟着挪，代码没另改。
- **线旁的字**（第 2 条）：
  - `src/data/hood.ts`：`HOOD_MANUALS` 每台加两项：
    - `maxRecommended`：VCIN36GWS、AK7136BS-BF、AK7300AS 是 true；PH36HWS 照 Leo 的话是 false，原文和页码写在旁边；
    - `sameOverGasAndInduction`：没写最大的四台（HMCB30WS、HMCB36WS、HMWB361WS，还有岛上的 HMIB42WS）写明哪几页、哪两句；
  - `read` 里把原文引了出来。
  - `manualNote`：建议的用新句子；微波炉式用「店里做法」。
  - `src/data/dimensions.ts`：A–D 也走 `manualNote`（选了油烟机就照说明书）；没选油烟机的后备分支不动。
- **字**：
  - 新句子 `dimension.clearanceRangeRecommended`：「最小 {min}，建议最大 {max}」/ "min {min}, recommended max {max}"，进了 `reviewed.json`，写明是 Leo 2026-11-14 同意的；
  - `dimension.shopPractice` 中文「店内做法」→「店里做法」，`reviewed.json` 里那一条照改，写明是 Leo 2026-11-14 定的；英文不变；
  - `dimension.shopPracticeFigure`（「店里做法 {figure}」）拿掉，没人用了；
  - `dimension.clearanceRange` 留着（后备分支还用，见第 0 节第 3 条）。
- **手机卡片**（第 4 条，丁）：`src/ui/ModelCard.tsx` 手机那一格，标题 11 号字一行，"Specified" 在第二行右边，每格 228 宽。写法和原型 `proto12b` 一字不差（只差注释）。
- **现成的两句**（不在 `reviewed.json`，没有写成"已审"，原文列给 Leo）：
  - `dimension.clearanceRangeCooktop`：「最小 {min}，最大 {max}」/ "min {min}, max {max}"
  - `dimension.clearanceMinIsland`：「最小 {min}，燃气与电磁相同」/ "min {min}, gas or induction"

## 5. 测试

- 新的：
  - `src/data/serviceEntry48.test.ts`：L 型 538 间、一字型 108 间，进口都在后墙、离远端 48″（Leo 要的那条）；
  - `src/data/hoodLineWords.test.ts`：A–D 每个套餐、每台能选的油烟机，线旁的中英文；每个套餐默认房间（C 单独一条）；不再有「燃气最小」「店内做法」；说明书的两项标记；
  - `tests/hoodLineReal.test.ts`（浏览器）：真鼠标、真手指，C、B 的默认房间（电脑），A 换 AK7136BS-BF、D 换微波炉式（手机），读页面上线旁的字；
  - `tests/phoneCard.test.ts`（浏览器）：390、中英文、A–E 每个套餐的 L 型、每台机器（真手指从「家电」里选），卡高等于主标题之前量到的数（`tests/fixtures/phoneCardPretitle.json`，在 `a2a8646` 上量的）；每格标题一行、不出格、不截断；另外 44 台的标题中英文各放进选中和没选中的格子里试一遍。
- 改的：
  - `src/store/uInterface.test.ts`：L 型那条从 4″ 改成 48″；
  - `src/data/orientationGuard.test.ts`：`serviceRoute.ts` 那一处登记去掉；
  - `src/data/eOneWallHood.test.ts`：E 一字型换 VCIN36GWS、两台 Zephyr 时带"建议"，微波炉式「店里做法」；
  - `src/data/dimensions.test.ts`、`src/data/inductionRangetop.test.ts`：原来写着旧说法的两条（见下面 5.3）。

### 5.1 手机卡片：和主标题之前比，有 7 个状态矮了（超出计划，要 Leo 定）
- 在 `a2a8646`（主标题之前）、`b139163`（改前）、丁上各量了 A–E 的 L 型、中英文、每台机器，72 个状态（`card3.mjs`，14:09:46–14:34:54，exit 0，没有报错）。
- 中文 36 个：三个版本一样高。
- 英文 36 个：
  - 改前比主标题之前高 18–37.5 像素的 29 个，丁都回到主标题之前的数；
  - **7 个丁比主标题之前矮 16.5 像素**（这 7 个改前本来就和主标题之前一样高）：
    - A 的灶 232.8 → 216.3
    - B 的灶 232.8 → 216.3
    - B 的组合烤箱 238.3 → 221.8
    - C 的灶 238.3 → 221.8
    - D 的灶 232.8 → 216.3
    - D 的烤箱 212.3 → 195.8
    - E 的组合烤箱 238.3 → 221.8
  - 原因：格子从 168 宽变成 228 宽，格子里第二行的字不再折行。
- 测试里这 7 个写的是丁量到的数，单独列出来；其余 65 个是主标题之前的数。要 Leo 定：这 7 个这样算"一样高"可以，还是要做到一模一样。

### 5.2 先红
- **第一次**，新的和改过的单元测试在 `b139163` 上（`rel11`，干净的 worktree）：14:09:54–14:10:04，exit 1，247 条里 16 条红：
  - 进口：`serviceEntry48` 2 条、`uInterface` 1 条（旧代码算出离远端 4″）、`orientationGuard` 1 条（旧代码还读 `ROOM.halfX`）；
  - 字：`hoodLineWords` 8 条（还是「燃气最小 30，最大 40」「店内做法」，说明书的两项标记还没有）、`eOneWallHood` 4 条（没有"建议"，微波炉式还是「店里做法 24″」）。
- **新代码上**：同样的文件加 `src/i18n`，14:12:32–14:12:44，exit 0，8 个文件、621 条全过。
- **全部单元测试第一次**：14:12:49–14:13:33，exit 1，2 条红，都是写着旧说法的老测试（5.3）。
- **全部单元测试第二次**：14:14:27–14:15:09，exit 0，145 个文件、4,068 条全过。
- **测试文件改过，用最终版本在 `b139163` 上重跑**（7 个单元测试文件）：14:45:50–14:46:00，exit 1，298 条里 18 条红。
- **浏览器测试**：
  - 新构建（`index-DXmeEnSr.js`，14:36:18–14:36:30，exit 0）上：14:36:30–14:45:38，exit 0，16 条全过；
  - 最终版本在 `b139163` 的构建（`index-DqYoEXjk.js`，不带计数器）上：14:46:06–14:55:15，exit 1，16 条里 10 条红：线旁的字 4 条、英文的卡 5 条、英文标题放不下 1 条（168 宽的格子里 36 处折行或出格）。
  - **中文的 6 条在旧代码上本来就绿**：中文本来没变高、标题本来放得下，这 6 条守的是"不变"，没法先红。
- 跑完 `rel11` 恢复干净。

### 5.3 两条写着旧说法的老测试
- `src/data/dimensions.test.ts` "prints the clearance the manufacturer allows beside it"：原来要线旁写间距图的 30/40；改成写选中那台（PH36HWS）说明书的 30/40。
- `src/data/inductionRangetop.test.ts`：B 的电磁灶，原来要「最小 30，最大 40」；B 的油烟机是 VCIN36GWS，现在是「最小 30，建议最大 40」。
- 两条都是这一轮有意要变的，改了测试，放进了上面"最终版本在旧代码上重跑"那一遍（都红）。

## 6. 底稿（`docs/plans/item12-proof/`）
- 旧 `b139163` 和新代码各出三份，每份 exit 0：L 型 14:15:17–14:15:28（各 1,065 行，538 间建成），一字型 14:15:28–14:15:36（各 108 间），U 型 14:15:36–14:15:43（各 112 间）。
- 比（`dumpDiff.mjs`，每次 exit 0）：**变的只有灶面到油烟机那条线的 `noteKey`、`noteVars`，别的一条路径都没变**（尺寸线上的数、房间、柜子、清单、接点都一样）。
  - L 型：606 行一样，459 间变了，A 116、B 122、C 109、D 112；E 0。
  - 一字型：18 间一样，90 间变了，A 21、B 27、C 14、D 24、E 4（E 换 VCIN36GWS、两台 Zephyr、微波炉式的那 4 间）。
  - U 型：18 间一样，94 间变了，A 20、B 26、C 13、D 31、E 4。
  - 详细的 from → to 计数在 `l-diff.txt`、`oneWall-diff.txt`、`u-diff.txt`。

## 7. 像素证明（45 个状态）

- 构建：旧 `b139163`（`rel11` 的 `dist-plain`，不带计数器，`index-DqYoEXjk.js`）；新：主文件夹 14:36:18–14:36:30，exit 0，`index-DXmeEnSr.js`。两个构建页脚印的版本号都是 `b139163`。
- 拍（旧、新交替各两次），每次 exit 0：
  - old1：14:55:37–15:04:03
  - new1：15:04:03–15:12:30
  - old2：15:12:30–15:20:56
  - new2：15:20:56–15:29:23
- 比：15:29:23–15:29:43，exit 0。
- **有意要变的 5 个**（第 2 节先写的）：
  - `desk-A-install`：3D 画面 9,442 个像素，整屏 9,913，字变了 1 处；
  - `desk-B-install`：7,704 / 9,159，字 1 处；
  - `desk-C-install`：9,443 / 10,061，字 1 处；
  - `desk-D-install`：7,071 / 8,540，字 1 处；
  - `desk-E-install`：7,539 / 7,276，字 0 处（E 的 L 型只有管线进口）。
- **必须相同的 40 个**：3D 画面全部 0。整屏只有 `link-C-noisland` 1 个像素（旧对旧 0、新对新 0）。
  - 补拍 `link-C-noisland`（`ONLY=link-C-noisland`，旧、新交替各两次）：15:30:06–15:30:41，四次 exit 0；比 15:30:41–15:30:42，exit 0。
  - 补拍结果：**新旧之间 0**，旧拍两次之间 1、新拍两次之间 1。所以这 1 个像素是每次拍都会有的浮动，不是改动。
- 结论：40 个逐像素相同（那 1 个像素是浮动），5 个有意要变的变了。

## 8. 有意要变的，改前改后（`docs/plans/item12-proof/`）

- **管线进口**：`closeup.mjs`，15:30:50–15:32:37，exit 0。L 型 A、C、E，一字型 B、E，安装模式，两倍清晰度的局部，左改前（`b139163`）、中改后、右红色标出不同。A、C、B 的图里线旁的字也在变（第 2 条）。
  - 同一个脚本补拍了 U 型 D（不在 45 个状态里）：旧拍两次之间 0、新拍两次之间 0，新旧之间 358 个像素，全在一行小字的范围里（53 × 7 像素），是 D 的那句字变成"建议最大"。U 型的管线没动。
- **线旁的字**：`words.mjs`，15:32:37–15:37:21，exit 0，36 次打开页面，没有报错。中英文从页面上读的，和第 1 节先写的一样：
  - A：「燃气最小 30，最大 40」→「最小 30，最大 40」
  - B、D：→「最小 30，建议最大 40」
  - **C：「燃气最小 30，最大 40」→「最小 30，燃气与电磁相同」**，线上的数 30-1/2″ 不变（对照图里这一行用橙色框单独标出）
  - A 换 AK7136BS-BF：→「最小 24，建议最大 32」
  - C 换 AK7300AS：→「最小 24，建议最大 34」
  - B 换微波炉式：「店内做法」→「店里做法」
  - E 一字型换 VCIN36GWS：「最小 30，最大 40」→「最小 30，建议最大 40」
  - E 一字型换微波炉式：「店里做法 24″」→「店里做法」
  - 英文对应："gas min 30, max 40" → "min 30, max 40" / "min 30, recommended max 40" / "min 30, gas or induction"；'shop practice 24"' → "shop practice"。
- **手机卡片**：B、E 的 L 型在新构建上重量了一遍（`card3.mjs`，`PKGS=B,E`，15:37:21–15:40:38，exit 0）：28 个状态的卡高和丁的原型一个不差。
  - 对照图 `cardSheets.mjs`（15:41:19–15:41:22，exit 0）：主标题之前、改前、改后三张并排，标着卡高：E 英文选中油烟机、B 英文选中冰箱、B 英文选中灶（7 个变矮的之一）、E 中文选中冰箱（对照）。
- 小图：`small/` 10 张，合计 798,474 字节（压缩 15:41:32–15:41:35，exit 0）；原图在 `raw/`，不提交。

## 9. 本地预览

- http://127.0.0.1:4181 （localhost 也行），主文件 **`index-DXmeEnSr.js`**，15:41:49 开的，独立进程 PID 25712，这一轮结束也不会被停。
- 4182 上丁的原型（PID 32812，`index-BS83jeGC.js`）还开着；全套测试开跑前和别的预览一起停掉。

## 10. 要 Leo 定的

1. **PH36HWS**：安装指南第 6 页写的是"suggested maximum"（第 11 页是"maximum"）。照你的话现在写「最小 30，最大 40」；要不要也改成「最小 30，建议最大 40」？A 的默认油烟机就是它。
2. **手机卡片那 7 个状态比主标题之前矮 16.5 像素**（5.1）：这样可以，还是要做到一模一样？测试里现在写的是丁量到的数，单独列出来了。
3. **`dimension.clearanceRange`**：还被"没选油烟机"的后备分支用着（页面不会走到），这一轮保留；要拿掉的话，后备分支改用「最小 {min}，最大 {max}」。
4. **现成的两句**（不在 `reviewed.json`），原文：
   - `dimension.clearanceRangeCooktop`：「最小 {min}，最大 {max}」/ "min {min}, max {max}"
   - `dimension.clearanceMinIsland`：「最小 {min}，燃气与电磁相同」/ "min {min}, gas or induction"
5. 全套测试：开跑前问你。

## 11. 范围外，只登记

- 这一轮没有新的范围外发现。上面第 10 节的 1、3 是这一项里冒出来、要你定的，不是范围外。
- 记一笔工具上的事：`grep -c $'\r'` 在这台机器上会数错（数出几百个"CR"），以 Node 查的为准：30 个文本文件都是 LF。

## 12. 还没做的

- 全套测试（等你说）。
- 没提交。第 3 条（HMCB36WS 的总高）这一轮没碰页面。

## 13. 晚上：Leo 的答复以后（2026-11-14 22:30 起）

Leo 的答复（「第 12 项的报告看过了」）：
- PH36HWS 带"建议"，用「最小 30，建议最大 40」；出处写印刷页码第 6 页（文件第 10 页）。A 的默认房间这行字会变，和 C 一样单独标出。
- 手机卡那 7 个矮 16.5 像素的：接受；测试里保留量到的确切数，旁边写原因和他的话。
- `dimension.clearanceRange` 拿掉，后备分支改用「最小 {min}，最大 {max}」。
- 两句现成的进 `reviewed.json`，写明他 2026-11-14 看过。
- 页码：印刷页码和文件页码不一样的两种都写；先改第 12 项碰到的几本，别的登记。
- 「18:00 被 Windows 自己弄睡」要列依据，没有就更正。
- 改完在最终代码上重做证明，然后直接跑全套测试，不提交。

### 13.1 改了什么
- `src/data/hood.ts`：PH36HWS 的 `maxRecommended` 改成 true；`read` 写成「printed p. 6 (file p. 10)」「printed p. 11 (file p. 15)」；注释照改。
- `src/data/dimensions.ts`：后备分支只用 `dimension.clearanceRangeCooktop`；`cooktopInRangeOpening` 没人用了，拿掉。
- `src/i18n/en.json`、`zh.json`：拿掉 `dimension.clearanceRange`。
- `src/i18n/reviewed.json`：加 `dimension.clearanceRangeCooktop`、`dimension.clearanceMinIsland` 中英文各一条，写明 Leo 2026-11-14 看过。
- 测试：`dimensions.test.ts`（PH36HWS 改成"建议"；加一条"没选油烟机时写「最小 {min}，最大 {max}」"）、`eOneWallHood.test.ts`（PH36HWS 一行）、`hoodLineWords.test.ts`（PH36HWS 的字、A 的默认房间、标"建议"的四台、PH36HWS 两种页码都写）、`tests/phoneCard.test.ts`（只改注释：原因和 Leo 的话）。
- `docs/decisions.md`：PH36HWS 两处页码改成两种都写；加了今晚的答复和更正。
- 本文件第 0 节的「PDF 第 8 页」「PDF 第 13 页」更正为文件第 10、15 页。

### 13.2 页码
- 用 `pdftotext` 一页一页读（之前用的是我自己写的解码脚本，它在 PH36HWS 这本上把页序走错了两页）。
- `HOOD_MANUALS` 里的 9 本，只有 PH36HWS 的安装指南（8001213268_A）印刷页码和文件页码不一样：整本文件页 = 印刷页 + 4。其余 8 本英文部分两者相同。
- 登记，不改：Zephyr 的 AK7136BS-BF、AK7300AS、PRW24C01CG 和 GE 的 JVM3160RFSS 在法文、西班牙文那半本里印刷页码从 1 重新数；英文部分和文件页相同，我们没引用那半本。`docs/reference` 里其他文件凡是印了页码的，都和文件页相同。

### 13.3 睡眠的依据
- 2026-10-16 到 2026-11-14 系统日志里一共 37 次睡眠，21 次在 17:57–18:17，其余是早上和一次半夜 00:36。
- 每一次都是：Winlogon 7002（User Logoff Notification），0–3 秒后 Kernel-Power 187（调用者 `winlogon.exe`），再 1–2 秒后 Kernel-Power 42（Sleep Reason: Application API）。这是有人在开始菜单选"睡眠"时的样子。
- 没有一次是定时自己睡的；电源方案（平衡）接电时睡眠、休眠、关屏都是 0（从不）。所以"被 Windows 自己弄睡"是我说错了，已改。

### 13.4 在最终代码上重做的证明
- 全部单元测试：22:35:17–22:35:56，exit 0，145 个文件、4,074 条全过。
- 改过的测试用最终版本在 `b139163` 上（`rel11`，7 个单元测试文件）：22:36:21–22:36:32，exit 1，300 条里 21 条红，7 个文件每个都有红：
  - `dimensions` 2 条（PH36HWS 的"建议"、没选油烟机的后备）；
  - `eOneWallHood` 5 条（PH36HWS 新加进红的这边）；
  - `hoodLineWords` 9 条（PH36HWS 两种页码那条也红）；
  - `inductionRangetop` 1 条、`serviceEntry48` 2 条、`uInterface` 1 条、`orientationGuard` 1 条。
  - 跑完 `rel11` 恢复干净（只剩它本来就有的 `dist-plain/`）。
- 构建：22:36:41–22:36:53，exit 0，**`index-CN3VkDjk.js`**。
- 底稿：L 型 22:37:03–22:37:08、一字型 22:37:08–22:37:12、U 型 22:37:12–22:37:16，每份 exit 0（538 / 108 / 112 间）。
  - **和下午的新代码比**（22:37:22–22:37:25，每次 exit 0）：变的只有那条线的 `noteKey`，`clearanceRangeCooktop` → `clearanceRangeRecommended`，数不变：
    - L 型 112 间：A 110 间，加 B、D 各一间"换成 PH36HWS"的房间；
    - 一字型 18 间：A 15，B、D、E 各一间换成 PH36HWS 的；
    - U 型 17 间：A 14，B、D、E 各一间换成 PH36HWS 的。
    - 也就是：凡是油烟机是 PH36HWS 的房间，那一行字变了，别的一条都没变。不只 A——B、D、E 里"换成 PH36HWS"的那几间也变，同一句话。
  - 和 `b139163` 比（22:37:40–22:37:44，每次 exit 0）：L 型 459 间（A 116、B 122、C 109、D 112），一字型 91 间（比下午多 E 换 PH36HWS 那间），U 型 95 间（同样多一间）。别的路径都没变。文件：`docs/plans/item12-proof/*-diff-final.txt`、`*-diff-afternoon-vs-final.txt`。
- 45 个像素状态（旧 `b139163` 的 `dist-plain`，新 `index-CN3VkDjk.js`，交替各两次）：old1 22:38:46–22:47:11、new1 –22:55:38、old2 –23:04:05、new2 –23:12:32，每次 exit 0；比 23:12:32–23:12:52，exit 0。
  - 拍之前写下的：和 `b139163` 比，5 个 `desk-*-install` 要变，其余 40 个必须相同；和下午的新构建比，只有 `desk-A-install` 可以变（A 的那行字）。
  - 结果：5 个变了（A 3D 9,442 / 整屏 10,636，B 7,704 / 9,159，C 9,443 / 10,061，D 7,071 / 8,540，E 7,539 / 7,276）；其余 40 个 3D 画面全部 0，整屏只有 `link-D-noisland` 差 1 个像素。
  - 补拍 `link-D-noisland`（旧、新交替各两次）：23:32:07–23:32:43，四次 exit 0；比 23:32:43–23:32:44，exit 0：**新旧之间 0**，旧对旧 0，新对新 0。前一次补拍（23:31:14–23:31:51）新旧之间也是 0、新对新 1；那一次我把 exit code 放在 `$(date)` 后面读，不可靠，所以整组重拍了一遍。这 1 个像素是拍摄浮动。
  - 和下午的新构建比（23:12:52–23:13:11，exit 0）：只有 `desk-A-install` 变了，3D 画面 0、整屏 1,754 像素、字变 1 处；另外 `link-C-noisland` 1 个像素，就是下午补拍过的那个浮动。
- 浏览器测试在最终构建上：23:13:11–23:22:17，exit 0，16 条全过（手机卡 12、线旁的字 4）。
- `tests/phoneCard.test.ts` 改过（只改注释），最终版本在 `b139163` 的构建（`index-DqYoEXjk.js`）上：23:22:18–23:30:57，exit 1，12 条里 6 条红，都是英文的；中文 6 条和下午一样本来就绿。
- 线旁的字重拍（`words.mjs`，A 也用橙框单独标出）：23:32:55–23:37:39，exit 0，36 次打开页面没有报错：
  - **A：「燃气最小 30，最大 40」→「最小 30，建议最大 40」**（下午那版是「最小 30，最大 40」）；英文 "gas min 30, max 40" → "min 30, recommended max 40"
  - **C：「燃气最小 30，最大 40」→「最小 30，燃气与电磁相同」**，线上 30-1/2″ 不变
  - 其余和第 8 节一样。
  - 压缩 23:37:54–23:37:55，exit 0：`small/words-sheet.jpg` 换成新的（260,031 字节）；原图在 `raw/final/`，不提交。

### 13.5 本地预览
- 23:38:15 在 4181 重开（PID 36360），主文件 `index-CN3VkDjk.js`；4182 的原型 22:35:11 停了。
- 全套测试开跑前 23:38 停掉了 4181。全套测试和之后的事写在 `docs/plans/overnight-2026-11-15.md`。

### 13.6 提交前要注意的
- 图片：`item12-proof/small/` 799,667 字节，加上计划阶段的 `item12-2026-11-14/small/` 1,555,512 字节，一共 2,355,179 字节，**超过 2 MB**。下午只报了各自的数，没有加起来。提交前要把计划阶段那批再压一压，等你说。

## 14. 2026-11-15 白天：Leo 的答复以后（09:50 起）

Leo 的话（原样）：「cameraKeep 那条红：改测试，不改卡片。」「点另一个型号之前，先把那个格子横着滑进画面（人会这样做），再点正中。」「只改测试，不改页面代码。」「小图：两批合计压到 2 MB 以内，报总数。」「不提交，等我看过全套测试的结果再说。」

### 14.1 cameraKeep 改了什么（只改测试）
- 新文件 `tests/swipeIntoRow.ts`：手机上，型号格子先用手指横着滑进卡片，再点正中。
  - 手指：`Input.dispatchTouchEvent` 按下、每 16 毫秒移几个像素、抬起（Playwright 自己点按用的就是这种输入），不是脚本滚动。
  - Chrome 的 `Input.synthesizeScrollGesture`（touch）我先试了，在这里一点没滚（09:55:19–09:55:36，exit 1，滑了三次 `scrollLeft` 还是 0，帮手照写好的报错停下，没有瞎点）；探针 09:56:06–09:56:15，exit 0：手指一步一步移，行滚了 116 像素，选中的型号没变。
  - 只对 `[data-candidate]` 格子、只在横着滚的那一行里、只在格子没整个露出来时才滑；滑三次还在外面就报错，不瞎点。
  - 原因和 Leo 的话写在帮手上面：第 12 项丁把格子从 168 加宽到 228，390 宽的手机上第二格一半在卡片外，正中是卡片边框。
- `tests/cameraKeep.test.ts`：`press` 帮手里手机先 `swipeIntoRow`，旁边写了原因和 Leo 的话。
- 页面代码没动。

### 14.2 证明查的还是同一件事
- 单跑改过的手机那条：09:56:36–09:56:52，exit 1，那一条绿；exit 1 是用 `-t` 只挑一条时"8 条都跑了"的检查跳出来（昨晚登记过的，不是这条红）。
- 故意弄坏：`src/three/CameraRig.tsx` 换型号后退回镜头那段开头加一行 `return;`，构建 09:57:09–09:57:16，exit 0（`index-Cdj4jC1v.js`）。
  - 整个文件 09:57:21–09:58:34，**exit 1，8 条里 4 条红**：换型号退回的 4 条全红（A 的 L 洗碗机桌面、**A 的 L 洗碗机手机**、E 一字型冰箱桌面、D 的 U 油烟机桌面），每条只差 `backToTheRoom` false；缩放的 4 条绿。
- 恢复：那一行删掉，`git diff` 里 `CameraRig.tsx` 没有改动；`npm run build` 09:58:45–09:58:58，exit 0，**`index-CN3VkDjk.js`**；整个文件 09:58:58–10:00:10，**exit 0，8 条全过**。
- 重新构建的 `dist` 和昨晚最终构建逐个文件比，完全一样。

### 14.3 别的在手机上点型号格子的测试
逐个看了 `tests/` 里所有碰 `[data-model-card]` 的 22 个文件。**没有别的文件是 cameraKeep 那种"点正中、不先滑进来"的写法**，所以没改。
- 在手机上点型号格子的有 11 个：`chimney36`、`fridgeFront`、`hoodKinds`、`hoodHousing`、`geometryReturn`、`overRange`、`rangeSwap`、`fridgeSurround`、`shareLink`、`sideStrips`、`fadeRebuild`。
  - 它们的 `press` 点之前都先 `locator.scrollIntoViewIfNeeded()`，格子会被滚进来再点正中。
  - 但那是**脚本滚动，不是手指滑**。要不要也换成 `swipeIntoRow`，是超出这次说的范围的改动，没动，等你定。
- 只读格子、不点的：`alternativeTitle`、`phoneCard`、`modelCardSide`、`desktopCardHeight`、`tooTall`（手机那条只点标签）、`modelLine`。
- 只在桌面点的：`modelCard`、`rangeSwapBill`、`smoke`（左边清单）、`panelReady`（点的是外观按钮）。
- 平板（768 宽）按桌面排版，格子竖着排，不在这件事里。

### 14.4 小图
- 计划阶段那批的卡片 5 张、烟囱式 4 张从原图重压：卡片宽 780、烟囱式宽 820，质量 0.5（10:04:23–10:04:25，exit 0）。看了一张卡片、一张烟囱式，标题、卡高、标签手机上看得清。
- **这一次要提交的图全部加起来：26 张，1,933,013 字节**（计划阶段 16 张 1,133,346，证明 10 张 799,667），在 2 MB 以内。原图在各自的 `raw/`，不提交。

### 14.5 新登记：U 型侧段上柜和台面之间的颜色
写进 `docs/decisions.md` 的顺序，第 12 项之后、第 13 项之前，编号 12a（13、14 保持记录里用的编号）。只读核实：
- 原因：U-2（`5d5da45`）的侧段背板。每个侧段一块 3/4″ 门板色的板，从地面到那段最高的柜顶，贴在柜子背面。从里面看，上柜和台面之间那一条就是这块板的正面，所以是门板色；后段靠后墙、没有板，所以是墙色。
- 从 `5d5da45` 起就有（U 第一次上页面），之后没改过；`bdeedb5` 只能手改链接看 U，没有板。
- 五个套餐、左右两个侧段都有。
- 从里面看（U 自己的视角和转到侧段台面的角度）看得到；从外面看是要的背板。安装模式和白模没用眼睛核对。
- 开跑前 10:01 在最终构建上拍了一张 A 的 U（10:01:28–10:01:41，exit 0），那个高度上这一条太细，图说明不了；从里面、从外面的截图放到它的计划里。全套测试跑的时候没开浏览器。

### 14.6 全套测试
- 开跑前：
  - 10:04:51 停掉 4181（PID 56608 和它的两个子进程）；之后没有 node、esbuild 进程。
  - 开着的窗口：Chrome、Claude、Edge、Phone Link、设置。
  - 接着电（电池 97%）；接电时睡眠、休眠、关屏都是"从不"。
  - 预计结束 11:45 左右。
- **10:05:03–11:44:21，exit 0：193 个文件、4,509 条全过。** 构建出来的主文件是 `index-CN3VkDjk.js`。
- 系统日志 10:04–11:45：没有 Kernel-Power、Power-Troubleshooter、Winlogon 的事件；整段只有一条，10:13:53 BTHUSB 16（蓝牙配对认证失败），和睡眠无关。
- 跑的时候没开浏览器。

### 14.7 本地预览
- 11:44:45 在 4181 重开（PID 11560）：http://127.0.0.1:4181 ，HTTP 200，主文件 **`index-CN3VkDjk.js`**，没变。
- 没提交，网站上还是原来的版本。
