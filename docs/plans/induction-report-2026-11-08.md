# B、D 的电磁灶：一路做到预览的报告（2026-11-08 凌晨）

> Leo：「电磁灶计划第二稿同意，补下面几处，然后今晚一路做完，中间不用等我」
> **停在预览，等你看。没有提交，没有推送，线上还是 `07cb903`。**
> 本地预览的主文件：`assets/index-C9kPU2y7.js`（http://localhost:4173/，浏览器里读到的就是这个）。
> 预览可能在回合之间被应用关掉，你要看时如果打不开，告诉我，我重新起，并再核一次主文件名。

## 一、补进计划和 decisions.md 的四条

都写进了 [induction-plan.md](induction-plan.md)（第三稿）和 `docs/decisions.md`（Open items，"Leo's decisions, 2026-11-08"）：

1. 灶下柜里，台面下 4-3/4" 以内不能有隔板、抽屉或别的东西，B、D、A、E 一字型、E 岛上都查（新测试 `underCooktopClear.test.ts`，里面放一块假隔板，证明查得出来）。
2. 接线盒沿用 E 现在的字"开口后壁 · 距顶 12""，B、D 照抄，E 不改。
3. rangetop 下面两扇对开平开门，从控制面板下沿开始；电磁灶下面也是 B36，同样对开。
4. 画面不改，不画门缝。

## 二、时间表（每一步的开始、结束、exit code）

| 步骤 | 开始 | 结束 | exit | 结果 |
|---|---|---|---|---|
| 文档补四条 | 00:13 | 00:17:18 | 0 | |
| 旧代码构建（像素用） | 00:18:12 | 00:18:18 | 0 | `index-BeaddrmB.js` |
| 单元测试先红，第一次 | 00:21:25 | 00:21:28 | 1 | 35 红、36 绿。其中 2 条是我把预期字写错（见第七节） |
| 单元测试先红，第二次（改了那 2 条的预期字） | 00:21:46 | 00:21:50 | 1 | **34 红、37 绿** |
| 浏览器测试先红（旧构建，`rangeSwap`） | 00:22:33 | 00:30:03 | 1 | **10 红、4 绿**（4 绿是没碰这件事的那 4 条） |
| 实现后类型检查 | 00:24:20 | 00:24:39 | 0 | |
| 实现后单元测试，第一次 | 约 00:24:40 | 00:25:09 | 1 | 17 条旧测试红，逐条看过（第四节） |
| 改完旧测试：类型检查 | 00:27:40 | | 0 | |
| 单元测试 | | 00:28:21 | 0 | 128 个文件、3,217 条 |
| 构建（真点真按用） | 00:30:14 | 00:30:24 | 0 | |
| 真鼠标、真手指（`rangeSwap`） | 00:30:24 | 00:35:36 | 0 | 14 条全过 |
| 像素第一遍（旧新各两次交替） | 00:35:48 | 01:19:08 | 全 0 | 看特写时发现灶面高度的毛病，这一遍作废，见第七节 |
| 灶面高度：新测试先红 | 01:21:17 | 01:21:20 | 1 | 1 红、34 绿 |
| 修好后：类型检查、单元测试 | | 01:21:56 | 0 / 0 | 128 个文件、**3,218 条** |
| 像素第二遍（最终代码） | 01:25:26 | 02:08:44 | 全 0 | 下面第五节的结果都是这一遍 |
| 逐像素比对、做特写 | 02:08:52 | 02:09:30 | 0 | 特写脚本第一次路径写错，改了重跑 |
| 跑前读电源 | 02:09:36 | | | 见下 |
| **全套测试** `npm test` | 02:09:51 | 03:27:17 | **0** | **168 个文件、3,576 条全过，用时 77 分钟** |
| 跑后查系统日志 | 03:27:41 | | | 见下 |
| 本地预览 | 03:27:45 | | | 主文件 `index-C9kPU2y7.js`，控制台没有报错 |
| 查残留、端口 | 03:27:54 | | | 见下 |

**电源（跑前读）**：平衡方案，插电时睡眠"永不"、关屏"永不"、休眠"永不"。（`powercfg /requests` 要管理员权限，读不了。）

**系统日志（跑后查）**：02:09 以来没有 Kernel-Power 42、506、507、187，也没有电源唤醒事件；午夜以来 42、506、507 都是 0 次。这一跑没有睡过。

**残留进程**（按路径查）：`ms-playwright` 路径下 0 个测试浏览器；剩下的只有本地预览自己的 3 个（npm、`vite preview`、esbuild）。**端口**：4173 是预览，4174–4183、5173 都空着。

## 三、改了哪些文件

未提交，总计 36 个已跟踪文件（560 行增、115 行减），新文件 5 项（2 个测试、计划、报告、特写文件夹）。

- **规则（只写一处）**：`src/data/cookingSurface.ts` 加 `cabinetUnderCooking`（灶下放什么）、`cookingSurfaceKind`（三种灶）。
- **问它的地方**：`layoutTemplate.ts`（B、D、A 换 rangetop、E 一字型）、`cabinets.ts`（E 岛上）。
- **选项**：`catalogue.ts`（`takesCooktop`，B、D 的 rangetop 位置）。
- **一起换**：`layoutState.ts`（按灶的种类重建）、`counter.ts`（开孔）、`applianceBox.ts`、`three/ApplianceModel.tsx`、`keepOut.ts`、`pinAnchor.ts`（机器位置）。
- **字和说明**：`roughIn.ts`、`useChecklist.ts`（新的一行柜子说明）、`dimensions.ts`、`rules.ts`、`i18n/zh.json`、`en.json`、`data/rough-in.json`。
- **常量**：`cooktop.ts`（3-3/4" 换成 4-3/4"）。
- **只改注释**：`schema.ts`、`ApplianceModel.tsx` 一句、`toeKick.test.ts`、`fadeRebuild.test.ts`、`screenshots.mjs`。
- **文档**：`decisions.md`、`HANDOFF.md`、`induction-plan.md`。

## 四、每个旧测试改了什么、为什么

| 测试 | 改了什么 | 为什么；查的是不是同一件事 |
|---|---|---|
| `rangeJoinery.test.ts` | "有抽屉底柜"→"有门板底柜"；嵌入次数 3→5 | 查的还是"灶下放什么跟着机器走"。多的 2 次是 B、D 的电磁灶 |
| `tests/rangeSwap.test.ts` | 编号 `DB36`→`B36`；标题；**加 4 条**（B、D × 鼠标、手指） | 同一件事，只是柜子编号变了 |
| `islandCooktop.test.ts` | 编号 `island-cooktop-B36`，柜顶到台面下面；13/16"、朝向、36" 照旧 | 3-3/4" 由新的 4-3/4" 测试接着守（你说的），不是少查 |
| `roughInEnglish.test.ts` + `round69.json` | 加一层 `changedInTheInductionRound`：B、D 共 18 行 | 煤气那句从"抽屉"改成"灶下柜后壁"，位置和数字不变。这一层只收这 18 行 |
| `shareLinkRound98b1.test.ts` | B、D（L 和一字型）、E 的 L，共 5 个房间的校验值 | 旧新代码把整个房间倒出来逐项比：B、D 只有柜子编号和种类（`DB36 drawer-base`→`B36 base`）；E 只有岛上那个柜子的编号和高度（3-3/4" 到台面）。A、C、E 一字型 0 处不同 |
| `shareLinkV2.test.ts` | E 的校验值 | 同上，只有 E 岛上那个柜子。其他 4 个 0 处不同 |
| `chimneyFillers.test.ts` | 31→35 个房间；37→41 | B、D 多了电磁灶：30" 油烟机在 36" 开口里，两边照样是 3-1/32" 填板 |
| `machineLabel.test.ts` | 128→132（两处）；879→913；642→646 | 选择项多了 CIT367YG 的房间，名字照样都找得到 |
| `offeredFor.test.ts` | B、D 的 rangetop 位置多 1 个 | 别的位置的列表照旧一样多 |
| `oneWallSwaps.test.ts` | 79→81 | B、D 一字型多了电磁灶，房间照样跟着机器 |
| `openingAbove.test.ts` | 175→177；143→145 | B、D 多了电磁灶，用 34-3/4" 开孔判断放得下 |
| `toeKick.test.ts`、`tests/fadeRebuild.test.ts` | 只改注释 | |
| `oneWall.test.ts`、`roughInCabinet.test.ts` | 没动 | 答案没变 |

**新测试**：`inductionRangetop.test.ts`（规则、选项、半截状态、分享链接重开、叫法、柜子说明）、`underCooktopClear.test.ts`（4-3/4"）。

## 五、像素结果（最终代码，锁画质，旧新各两次交替）

**45 个状态：38 个逐像素相同**，其余 7 个：

| 状态 | 3D 画面 | 整屏 | 说明 |
|---|---|---|---|
| `desk-B-install`、`desk-D-install` | 0 | 1,289 像素 | **有意**：预留清单那句煤气的字。全部在这句字的框里 |
| `desk-E-install` | 1,593 | 1,576 | **有意**：E 岛上门板 |
| `desk-E-fly-dishwasher` | 1,770 | 1,769 | **有意**：同上 |
| `desk-D-materials`、`link-A-noisland`、`link-B-noisland` | 0 | 各 1 像素 | 不是改动：3D 画面 0，同版本自己比也常出现 1 像素（下面） |

- B、D 默认的 3D 画面：**逐像素相同**（你预期的）。
- E 的 materials、white 默认角度、E 手机：相同（门板在那些角度看不到）。

**另拍的 11 个状态：**

- A 换 rangetop（L 型、一字型、飞到灶前）、B、D 一字型：3D 和整屏都**相同**。
- E 一字型飞到灶前：**相同**。
- E 岛上飞到灶前：3D 变了，**有意**（materials 4,932、white 4,645、install 8,268 像素）。
- B、D 飞到灶前（L 型）：3D 画面 **0**；整屏变了，因为模型卡的可选型号多了一行（"Models for this opening · 5 → 6"），下面的行跟着下移，一根引线也跟着动。**有意**。

**同一版本自己两次之间的差别**：3D 画面 **全部 0**。整屏：

- 旧版：`link-B`、`link-C`、`link-D`、`link-D-noisland`、`link-E` 各 1 像素；
- 新版：`desk-E-materials`、`link-A`、`link-D`、`link-E-noisland`、`rt-B-one`、`rt-D-one` 各 1 像素。

**特写**（都在 `docs/plans/induction-2026-11-08/`）：

- E 岛上门板，旧 | 新 | 差别：`E-island-door-materials.png`、`E-island-door-white.png`、`E-island-door-install.png`、`E-default-view-install.png`、`E-fly-dishwasher.png`；
- B、D 选了电磁灶（L 型和一字型）：`B-D-cooktop-materials.png`、`B-D-cooktop-white.png`、`B-D-cooktop-install.png`、`B-D-cooktop-opening-view.png`；
- 变的字：`B-install-gas-sentence.diff.png`；多的一行：`B-model-card-one-more-row.diff.png`。

## 六、两台电磁炉最终显示的中英文（从页面上读下来的）

| 显示在哪里 | HIS8055U | CIT367YG |
|---|---|---|
| 选择项（列表一行） | `30"` Bosch · HIS8055U，小字：每侧需 3" 挡板 / 比开口深 1"（3" filler each side / 1" deeper than the opening） | `37"` Thermador · CIT367YG，没有小字 |
| 图钉、模型卡标题 | 炉头 / Range | Drop in 炉灶片 / Cooktop |
| 配置单一行的标题 | 炉头 / RANGE | DROP IN 炉灶片 / COOKTOP |
| 配置单机型、价格 | Bosch HIS8055U · $5,399.00 | Thermador CIT367YG · $4,999.00 |
| 配置单开口 | 槽位开口 36" × 36" × 24"；要求 30" × 36" × 25" | 槽位开口 36" × 36" × 24"；要求 34.8" × 3.8" × 19.9" |
| 配置单水电 | 240V · 50A | 240V · 50A |
| 提醒 | 需新增 240V/50A 专线（Needs a new 240V/50A dedicated circuit）；两侧各需 3" 挡板；比开口深 1"，围合柜需加深；防倾支架 | 需新增 240V/50A 专线（同左） |
| 预留清单 | | 电源：开口后壁，距顶 12" / power — rear wall of the opening, 12" below the top |
| 柜子说明（新的一行） | 没有（站在地上） | 灶下柜 B36：左右对开两扇平开门 / Cabinet under it: B36, a pair of swing doors opening left and right |
| 复制摘要 | 炉头，下一行 Bosch HIS8055U $5,399.00 / Range | Drop in 炉灶片，下一行 Thermador CIT367YG $4,999.00 / Cooktop |

Rangetop（PCG366W）的柜子说明：**灶下柜 B36：左右对开两扇平开门，门从控制面板下沿（柜子正面最上面 7-5/8" 以下）开始** / Cabinet under it: B36, a pair of swing doors opening left and right, starting below the control panel (the top 7-5/8" of the cabinet front)。煤气：**燃气：灶下柜后壁，距左侧 11"、距底 2"** / gas — back wall of the cabinet under the cooktop, 11" from the left side, 2" up。

## 七、中途失败和要你看的

**中途失败的（照实写）：**

1. **先红第一次**：35 条红里有 2 条是我把预期字写错（E 的接线盒字多写了"居中、"；30" 油烟机实际宽 29-15/16"，我写了 30）。改成对的字后再跑，34 红。这 2 条里，接线盒那条本来就是"E 不改"的守门测试，旧代码上也应该绿。
2. **实现后第一次单元测试**：17 条旧测试红，全部是这次有意的改动（第四节），一条都没跳过。
3. **像素第一遍作废**：01:19 比对都对，但看特写时发现 B、D 选电磁灶时，尺寸线把灶面量成 **4"**，灶面到油烟机量成 **62-7/16"**，旁边写"燃气最小 30"。单元测试和第一遍像素都没抓到，因为这一项只在选了电磁灶、再开 Install 才看得到，而第一遍只是把这些状态拍下来，没逐张读。加测试先红、修好（灶面 36-1/4"，那句字改成"最小 30，最大 40"），然后最终代码**重拍了一整遍**。第一遍的文件留在临时文件夹，没有用它的结果。
4. **几个我自己写的工具脚本**第一次跑错、改了重跑，没有动到代码：shell 把一条长命令解析错（什么都没改）、`mklink` 引号写错（改用 PowerShell）、读字脚本里"摘要"按钮第二次已经展开、特写脚本路径写法。

**要你看的：**

1. **柜子说明那一行是我加的。** 你说"配置单、预留清单上写柜子说明的地方照这个写"。查了代码，两张单子原来**没有**专门写灶下柜子的地方。我的做法：在安装清单和配置单这台机器下面**加一行**（只写一处，第六节的字），B、D、A（换 rangetop）、E 都有。如果你的意思不是加一行，告诉我，这一条去掉就行。
2. **列表开头显示 `37"`。** 每一行开头都是机型自己的宽度，CIT367YG 是玻璃宽 37"。"放得下"是按 36" 开口判断的，没有红字。看预览时你判断一下要不要动。
3. **E 一字型的尺寸线一直是错的，线上就这样**：灶面 4"、到油烟机 62-1/2"、写"燃气最小 30"。这一轮 E 一字型必须逐像素不变，所以没改，登记在 decisions.md。要不要修，你定。
4. **`DB36`→`B36` 的范围**：B、D 默认、A 换 rangetop 的 3D 画面确实不变；变的是墙下明细里的编号（`DB36`→`B36`）和预留清单那句煤气的字。

## 八、没提交的

全部未提交：上面第三节的代码和测试、`induction-plan.md`、`decisions.md`、`HANDOFF.md`、这份报告、特写文件夹，以及上次的 `commit-07cb903-2026-11-07.md`。你确认之后我再提交、推送、报部署、线上核对。
