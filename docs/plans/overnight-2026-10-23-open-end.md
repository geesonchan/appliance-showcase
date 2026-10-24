# 开放端收尾：石材穿过 3" 侧板（agent3b，只读调查）

登记处：docs/decisions.md:8055-8066（Open items，"The stone at a run's open end runs through the 3" end panel — the L and one wall alike"，Leo 第 99a 轮登记，等他从现场回话）；第 99a 轮的 "Looked at, not changed" 指向它（decisions.md:8164-8166）。round-99 计划里给这块板配词时已经数过同一批房间（docs/plans/round-99-plan.md:70，"A–E · L，228 个房间；A–E · 一字型 | 开放端柜子外侧 3" 侧板 PNL3"）。

仓库里的叫法（照用，不另起名）：开放端那个柜子是「收尾柜」/ "cabinet at the open end"（`requirement.left-end`、`requirement.back-end`，zh.json:374-375，en.json:373-374）；那块 3" 板是「侧板」/ "filler"（`requirement.endPanel`，zh.json:466，en.json:465；decisions.md:631-632）；代码注释里叫 "finished end panel" / "end panel"。

坐标说明：下面的英寸数是沿着那段柜子的世界坐标（和 decisions.md:8064-8066 用的是同一种），不是从墙角量的长度。

---

## 1. 现在怎么画的

### 开放端由什么组成
- `terminal(id, "open")`（src/data/layoutTemplate.ts:1721-1728）返回两项：
  - 一个 gap，`id`，最小 `CABINET_STANDARDS.widthIn.min`，规则 `"d13-terminal"`，`shrink: "landing"`（:1724）——这就是收尾柜，墙有富余时会变宽（探针里见到 B9 到 B33，见第 2 节）。
  - 一个 fixed，`${id}-panel`，宽 `PANEL_IN`（= 3，src/data/roomShell.ts:231），**segmentKind 是 `"counter"`**，模块 `M("PNL3", "panel", 3)`，没有 `heightIn`（:1725-1727；`M` 的定义 :511-516，只放传进去的字段）。
- 哪段柜子有开放端：
  - L：只有左段（src/data/layoutShape.ts:73，`ends: ["corner", "open"]`；后段 :74 是 `"wall"`）。左段只有在冰箱放后段（`fridgeEnd === "back"`）时才以 `terminal("left-end", …)` 收尾（layoutTemplate.ts:2136-2141）；冰箱在左段时左段以冰箱塔收尾，后段以靠墙填充板收尾（:2132-2135）。
  - 一字型：后段右端开放（layoutShape.ts:86），`oneWallRun()` 最后一项就是 `terminal("back-end", …)`（layoutTemplate.ts:2177）。

### 侧板（PNL3）画成什么
- src/data/cabinets.ts:299-311：`module.kind === "panel"` 一律画成 `"surround"` 盒子。
  - 沿柜长：3"，即 segment 的整宽。
  - 高度：从 `boardOnKick(run, segment) ? KICK_LIFT : 0` 到 `ft(module.heightIn ?? 96)`（:306）。`boardOnKick` 对非 tall 的 segment 直接返回 false（:166-167），PNL3 又没有 `heightIn`，所以是 **0"–96"，落地到 96"**（与 decisions.md:8061 "drawn 96" tall" 一致）。
  - 进深：`ROOM.counterDepth` = 24"（roomShell.ts:39），offset 0，即背靠墙、正面与柜体正面齐。
  - 正面：`face: "strip"`（:309），由 `BoardFace` 画一块 3/4" 厚的板，贴在柜体正面外侧（src/three/BoardFace.tsx:50-58，`front + DOOR.thickness / 2`；`DOOR.thickness = ft(CABINET_DOOR_IN)`，BoardFace.tsx:11-12；`CABINET_DOOR_IN = 0.75`，src/data/ovenTrim.ts:54），高 96" 减 1/8" 缝。所以侧板的面在离墙 24-3/4" 处。

### 石材停在哪
- 高度：`band = [counterHeight - counterThickness, counterHeight]` = 34-1/2"–36"（src/data/counter.ts:80；roomShell.ts:37-38）。
- 沿柜长：一字型 `spans(back.segments[0].from, runEnd(back), cuts(back, range))`（counter.ts:87），L 左段 `spans(zBack, runEnd(left), …)`（:108）；`runEnd` = 最后一个 segment 的 `.to`（:193），也就是**侧板的外侧面**。`cuts()` 只切 `kind === "tall"` 的 segment 和落地炉头（:211-217），侧板 segment 是 `"counter"`，不切。
- 进深：背边在墙上，前边 = 柜体正面 + `ROOM.counterOverhang`（1"，roomShell.ts:40；counter.ts:86、103-105）。
- 合起来：
  - 石材的端面和侧板的外侧面在同一个平面上（都在 `runEnd`），**沿柜长方向没有出沿，也不缩进**。
  - 34-1/2"–36" 这一层，石材整块盖过侧板的 3" × 24"，而侧板盒子是 0"–96" 的实心盒子，所以石材是**穿在侧板盒子里面**——这就是 Leo 说的 "looks as if the stone passes through it"。
  - 正面：石材比柜体正面出 1"，侧板的面板出 3/4"，所以石材在侧板面前面露出 **1/4"**——推算出来的（1" − 3/4"），没在截图上量过；Leo 看到的 "a thin edge in front of it" 应该就是它。
  - 推算，没看画面：石材端面和侧板外侧面（0"–24" 深这一段）、以及 3/4" 面板的端面，都在同一个平面上。仓库里有前例说同一平面上的两个面会闪（cabinets.ts:723-726，第 92b 轮像素对比发现的）；这里闪不闪，没看画面，不知道。

### 下柜停在哪
- 收尾柜（base 盒子，4"–34-1/2"，`BASE_BOX`，cabinets.ts:106）停在**侧板的内侧面**。探针：319 处开放端全部是 `baseEnd = 侧板起点`。
- 踢脚也停在侧板内侧面：`endOnTheFloor` 把结尾的 panel 模块宽度算作落地部分（cabinets.ts:731-737）；测试 toeKick.test.ts:160-166（B 的左段，差 3"）。

### 上面的吊柜（顺带看到的，登记条目没提）
- `bankStop` 只跳过末尾的 tall segment（layoutTemplate.ts:2480-2484）；侧板 segment 是 `"counter"`，所以吊柜一排**一直排到侧板外侧面**。探针：319 处全部是吊柜末端 = 侧板外侧面。
- 例：B 的 L 默认房间，`upper-left-end-W1242-3` 12" 宽，54"–96"，12" 深；上面叠 `-stack` 96"–108"，顶线 107"–108-1/2"。所以：
  - 54"–96" 这一层，24" 深、96" 高的侧板和最后一个吊柜有 3" × 12" 的体积重叠；侧板还比吊柜正面多伸出 12"（再加 3/4" 面板）。
  - 96" 以上，叠柜和顶线从侧板顶上越过去。
- 这些是从盒子坐标推出来的，没在画面上看过。

### 实测数（第 99a 轮登记的两组之外，探针给的例子）
| 房间 | 侧板 | 收尾柜 | 石材到 | 石材前沿 vs 侧板柜体正面 |
|---|---|---|---|---|
| B · L 默认（冰箱在后段） | 69"–72"（左段） | DB18，51"–69" | 72" | 出 1" |
| A · L，sinkLeg left / fridgeEnd back / 有岛 | 69"–72" | DB18，51"–69" | 72" | 出 1" |
| D · L，同上 | 86-3/8"–89-3/8" | DB21 | 89-3/8" | 出 1" |
| E · L，同上 | 87-3/4"–90-3/4" | B9 | 90-3/4" | 出 1" |
| A · 一字型默认 | 115-7/8"–118-7/8" | B9，106-7/8"–115-7/8" | 118-7/8" | 出 1" |
| B · 一字型默认 | 119-1/16"–122-1/16" | B9 | 122-1/16" | 出 1" |
| C · 一字型默认 | 113-1/8"–116-1/8" | B9 | 116-1/8" | 出 1" |
| D · 一字型默认 | 121-5/8"–124-5/8" | B9 | 124-5/8" | 出 1" |
| E · 一字型默认 | 133-13/16"–136-13/16" | B9 | 136-13/16" | 出 1" |

A 一字型这一行和 decisions.md:8065-8066 登记的数一致（115-7/8"–118-7/8"，石材到 118-7/8"）。

---

## 2. 出现在哪些房间

**这一节是跑出来的，不是读出来的。**
- 脚本：`openEnd.ts`，在这次会话的临时文件夹（scratchpad/agent3b/，不在仓库里），用仓库自己的 `npx vite-node` 跑。
- 房间：跑 `roomSets.lRooms` 和 `roomSets.oneWallRooms`（src/data/roomSets.ts），共 1,136 个，其中 L 建成 515、拒 530，一字型建成 91；这和 decisions.md:8136-8139 的数一样。
- 判定：每个建成的房间里，找最后一个 segment 的 id 以 `-end-panel` 结尾、模块是 PNL3 的那段柜子。
- 用时约 1 秒。原始输出：`full.jsonl`，同在那个临时文件夹。

| 套餐 | L：有开放端侧板 / 建成 | 一字型：有 / 建成 |
|---|---|---|
| A | 48 / 115 | 20 / 20 |
| B | 70 / 118 | 23 / 23 |
| C | 48 / 108 | 13 / 13 |
| D | 30 / 102 | 20 / 20 |
| E | 32 / 72 | 15 / 15 |
| 合计 | **228 / 515** | **91 / 91** |

- L 的 228 和 round-99-plan.md:70 的 "228 个房间" 对得上。
- L 里全部在左段；每一个都是 `fridgeEnd: "back"` 的房间（A 48、B 48、C 48、D 30、E 32 是排列里冰箱放后段、并且建成的那些）。B 还多出 22 个，因为 B 的默认布局就是冰箱放后段（data/packages.json:179-181，`"fridgeEnd": "back"`）：B 默认 1 个，sweep 罩子加两种墙长共 2 个，换型号 19 个。
- **各套餐打开时就能看到开放端侧板的：L 只有 B；一字型五个套餐都有。** A、C、D、E 的 L 要把冰箱换到后段才出现。
- 319 处开放端（228 + 91）无一例外：
  - 石材到侧板外侧面；
  - 收尾柜和踢脚停在侧板内侧面；
  - 侧板 0"–96"、24" 深；
  - 石材前沿比侧板柜体正面多 1"；
  - 吊柜排到侧板外侧面。
- 收尾柜的型号分布：B9 101 处、DB18 96、DB21 84、B33 14、B24 12、B30 9、B15 3。
- L 左段侧板的位置：69"–72" 165 处、86-3/8"–89-3/8" 30、81"–84" 16、84-3/4"–87-3/4" 8、87-3/4"–90-3/4" 8、82-9/16"–85-9/16" 1。

---

## 3. 几种做法（只列，不选；Leo 定）

下面四种是木工/台面师傅常见的收法，名字是描述，不是仓库里的词（仓库里没有 "waterfall"：docs/ 下 grep 不到）。每种都说"像什么样、改哪里、哪些测试和底稿会变"。下面的"测试会红"都是读代码推的，**一个测试都没跑**。

### 做法甲：侧板只做到石材底下，石材盖在侧板上，端头与侧板外面齐平
- **样子**：
  - 开放端是"下柜 + 3" 侧板"，侧板 0"–34-1/2"，石材像现在一样到侧板外侧面为止，端头齐平。
  - 正面仍是石材比侧板面多 1/4"。
  - 36" 以上没有板。吊柜那一端是什么，见问题 3。
- **改哪里**：
  - 侧板高度：可以在 `terminal()` 给 PNL3 加 `heightIn`（layoutTemplate.ts:1725；要加到柜体顶 34-1/2"，还是要扣掉别的，看 Leo 的答案）；或者在 cabinets.ts:306 对"非 tall segment 里的 panel"取 `BASE_BOX` 的顶。
  - 石材：counter.ts 不动。
  - 踢脚：`endOnTheFloor`（cabinets.ts:731-737）不动，仍落地。
- **测试可能受影响**：
  - toeKick.test.ts 的 `BOARDS`（:97-110）只看底是 0 还是 4，不受影响；oneWall.test.ts:88-101 的条目顺序不受影响。
  - 如果改的是模块（加 `heightIn`），要看有没有测试或清单读 PNL3 的模块对象——没逐个查。
- **底稿/像素**：
  - lDump / oneWallDump 的 `cabinets`、`outlines`、`labelled`，在 228 个 L 房间和 91 个一字型房间里会变；如果改的是模块，`runs` 和 `requirement` 也会变（scripts/lDump.ts:110、124-126、137；scripts/oneWallDump.ts:117-118、130）。
  - `counter` 不变。
  - 像素：凡是镜头里有开放端的状态都会变（36"–96" 那段板没了）。

### 做法乙：侧板通高（落地到 96"），石材停在侧板内侧面
- **样子**：
  - 开放端立着一块 3" 的通高侧板，下柜和石材都顶到它的内侧面为止，像石材碰到高柜侧板那样（counter.ts:199-205 说的 "the stone dies into its side"）。
  - 正面：石材在侧板旁边比侧板面多 1/4"。
  - 侧板本身看起来和现在一样。吊柜是停在侧板内侧，还是照旧排过去，见问题 3。
- **改哪里**，两条路：
  - (a) 把 `terminal()` 里侧板的 segmentKind 从 `"counter"` 改成 `"tall"`（layoutTemplate.ts:1725）。这样会连带：
    - 石材被 `cuts()` 切在侧板内侧（counter.ts:214）；
    - `bankStop` 让吊柜停在侧板内侧（layoutTemplate.ts:2482），吊柜一排短 3"，排出来的柜子和清单可能变；
    - `endOnTheFloor` 走第一支（cabinets.ts:720），仍是 3"；
    - `boardOnKick` 最后一项返回 false（cabinets.ts:169），仍落地。
    - 但 tall segment 在规则里另有处理（例如 layoutRules.ts:367 跳过 tall 的 d13 宽度检查；D11 rule 1 关于高柜在一段末端的检查），会不会因此报错或改判，**没查完**。
  - (b) segmentKind 不动，只在 `cuts()` 里把开放端侧板也当一刀。
- **测试可能受影响**：
  - packageLayouts.test.ts:225-253 的 `expectStoneOverEveryCabinet` 要求每个非 tall 的 segment 上都有石材。走 (b) 时侧板仍是 `"counter"`，这条会红；走 (a) 时它被跳过。
  - layout.test.ts:496-507 "reaches both walls and both leg ends"（石材到 tall 或到段末）：在有开放端的房间里会受影响；它建的房间左段以冰箱塔结束（读的，没跑），按读到的应不受影响。
  - 走 (a) 还要看吊柜相关的测试和 d13 规则测试。
- **底稿/像素**：
  - `counter` 在 319 处都变（石材短 3"）。
  - 走 (a) 时 `runs`（segment kind）、吊柜盒子、`requirement` 可能也变。
  - 像素：石材端头缩进 3"，侧板外观不变；吊柜是否缩进，看答案。

### 做法丙：侧板做到石材底下，石材越过侧板外面 1"（和前沿一样的出沿）
- **样子**：
  - 石材在开放端也出 1"，和它在正面出 1" 一样，侧板在石材底下。
  - 仓库里有同样的先例：岛台的台面在两端各出 1"（counter.ts:159-170；decisions.md:4227-4228，"74" with the 1" lap each end"）。
- **改哪里**：
  - 侧板高度同做法甲。
  - 石材：counter.ts 在开放端用 `runEnd + ROOM.counterOverhang`。一字型改 :87；L 左段改 :108，转角整块的 `lShape` 用 `leftSpans[0][1]` 作为左腿的 `to`（:127-129），所以也跟着变。
  - counter.ts 得知道哪一端是开放的。现在只有模板知道：`farEnd`（layoutTemplate.ts:566-570）和 `terminal()`（:1722）；grep 不到别处读 `ends[1]`。所以要么把 shape 传进去，要么认出 `-end-panel` 这个 segment。
- **测试可能受影响**：
  - layout.test.ts:503-505（石材到段末，`toBeCloseTo(stop)`），在有开放端的房间里会差 1"。
  - packageLayouts 的"每段都有石材"不受影响（石材只会更多）。
  - 有没有规则从开放端的石材末端量间距：grep 没找到。aisle 是从段的前沿量的（layoutRules.ts:737-741），不是从末端。
- **底稿/像素**：`counter` 和 `cabinets` 在 319 处变；像素在开放端可见的状态里变。

### 做法丁：瀑布端（石材在端头折下到地面）
- **样子**：石材到开放端转 90° 一直下到地，石材本身就是那一端的面，代替 3" 侧板或包在它外面。
- **改哪里**（改动最大）：
  - 石材的几何：`CounterOutline` 只有水平的块和一个 `band`（counter.ts:18-26），`CounterSlab` 是把平面图形挤出成形（src/three/CabinetLayer.tsx:404-440）。竖着的一块是新几何。
  - 模板：侧板 PNL3 是换掉还是留着？石材不是柜子清单上的东西，而 roughIn.ts:382 把 3" 侧板算作 joinery。
  - 宽度：石材 1-1/2" 厚（roomShell.ts:38），侧板 3"。宽度一变，墙的最小长度、拒绝时报的数都会变（`wallRequirement`、`oneWallWantedIn`），228 个 L 房间和 91 个一字型房间都受影响。
  - 踢脚：`endOnTheFloor` 按 panel 模块计宽（cabinets.ts:731-737）。
  - 文字：`requirement.endPanel`（machineLabel.test.ts 读每个侧板的词）。
- **测试/底稿/像素**：上面各项基本都会动；`counter`、`cabinets`、`runs`、`requirement` 都变。

（另外，"侧板通高、石材照旧穿过去"就是现在的画法，不另列。）

---

## 4. 要 Leo 答的问题（现场做法）

1. 开放端那块侧板，现场是只做到台面底下（下柜高），还是落地一直到顶（96"）？
2. 石材在开放端：和侧板外面齐平？像正面一样出 1"？还是停在侧板里面、由侧板包住端头？
3. 如果侧板做到顶，上面的吊柜是停在侧板里侧，还是照常排到头、侧板只到吊柜底？吊柜在开放的那一端，外侧要不要另加一块板？（文件没写）
4. 侧板厚度：代码是 3"（`PANEL_IN`，roomShell.ts:231；layoutRules.ts:379-380 "three inches because that is what a finished panel is"），而 docs/reference/cabinet-modules.md:31、126 写的是 `BEP` / `WEP` ¾"。开放端现场用的是哪一种？
5. 正面：石材现在比侧板面多 1/4"（1" 出沿减 3/4" 面板）。现场侧板的面和门面齐平吗？石材在端头前角是直角、倒角还是圆角？（文件没写）
6. 瀑布端有客户做吗？做的话是选配，还是某个套餐默认？
7. L 的开放端和一字型的开放端，是同一种收法吗？

---

## 顺带看到的（不在登记条目里，供 Leo 知道）
- 吊柜一排到侧板外侧面，和 96" 高、24" 深的侧板在 54"–96" 有 3" × 12" 的体积重叠；96" 以上的叠柜和顶线从侧板顶上越过（第 1 节"上面的吊柜"，319 处全部如此，盒子坐标推的，没看画面）。
- 石材端面、侧板外侧面、3/4" 面板端面在同一个平面上，可能闪（前例 cabinets.ts:723-726）；没看画面，不知道。
- 本次没有改仓库里的任何文件，没跑测试、没构建、没开浏览器；只在临时文件夹 scratchpad/agent3b/ 写了 `openEnd.ts`、`small.jsonl`、`full.jsonl` 和本文件的原稿（本文件是它的副本）。
