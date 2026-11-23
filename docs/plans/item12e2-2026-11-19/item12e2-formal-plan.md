# 12e-2 正式计划：换型号以后的镜头照 bingjia3（给 Leo 确认）

2026-11-20 晚写。你 2026-11-20 定了「换型号以后的镜头选 bingjia3」。**这份确认之前，主文件夹不改。** 第一稿到第五稿留着作为来历，不改写，在 `item12e2-plan.md`。

---

## 1. D1 新一条（英文原文草稿，等你确认措辞）

### 1.1 要取代的第五条（现在的原文，`docs/decisions.md` 第 80 到 88 行，一字不改）

> 5. **Another model chosen for the machine on screen.** *Added 2026-11-12, Leo
>    (2026-11-11): 「换了型号以后镜头放远：照原型的做法（角度和中心不动，远近回到看得见整个
>    厨房，卡片不关）。L 型、一字型、U 型一起做，规则只写一处；给 D1 加第五种原因"换了型号"」.*
>    With a machine selected, its model changed — on the card, or by anything
>    else that changes it while the card is open — the camera keeps its angle and
>    its centre and its zoom goes back to the one that frames the whole room; the
>    card stays open, so the next model can be tried. In one place,
>    `CameraRig.tsx`, keyed on the selected machine's model. `tests/cameraKeep.test.ts`
>    holds it, by the mouse and a finger, in the L, one wall and the U.

### 1.2 第五条后面加的注明（原文不动，接在它下面）

> *Replaced by the sixth, below (item 12e-2; Leo, 2026-11-20). Kept as it was decided. Keeping the angle and the centre the machine was flown to left the room off the centre of the scene once the card was up — in 12e-2's measure the room's centre moved off the reset view's by a median of 253 pixels on a desktop, 148 on a phone and 277 at 767 — and labels went under the card, under the mode buttons or off the screen.*

### 1.3 新一条（第六条）

> 6. **Another model chosen for the machine on screen: the shape's default angle, the whole room clear of the card.** *Added with item 12e-2, replacing the fifth; Leo, 2026-11-20: 「我看过预览了，换型号以后的镜头选 bingjia3」, after its prototype (`?p12e2=bingjia3`) and five drafts of the plan.*
>    With a machine selected, its model changed — on the card, or by anything
>    else that changes it while the card is open — the camera turns to the
>    default view of the shape on screen (the reset button's angle) and frames
>    the whole room in the part of the scene the card leaves free: right of the
>    card on a desktop, above it on a phone and up to 767 pixels wide. The zoom
>    is the one that fits the room in that part, and no smaller. The card stays
>    open, so the next model can be tried.
>    **Closing the card then takes the camera to the reset button's view**, if
>    the camera is still where the swap put it. A drag, a zoom step, Reset or a
>    fly-in to another machine in between, and closing the card moves nothing,
>    as D12 has it.
>    In one place, `CameraRig.tsx`, keyed on the selected machine's model; the
>    free part and the framing are worked out in one function,
>    `src/three/cardFraming.ts`. `tests/cameraKeep.test.ts` holds it, by the
>    mouse and a finger, at 1440, 767 and 390 wide: the default angle, the
>    room's centre within 10 pixels of the free part's centre, every pin label
>    seen whole at nine points, none laid over another, none off the screen,
>    and the reset button's view once the card is closed.

### 1.4 D1 开头那句的注明（原文 "Exactly five behaviours…" 不改）

> *Since item 12e-2 the fifth is replaced by the sixth; five reasons stand, as before.*

### 1.5 D12 那句怎么注明（第 1756 到 1757 行，原文不改，接在下面）

原文：

> - **D1: the card moves no camera** — the pins stand where they were when it
>   closes, held by a test.

注明：

> *Amended with item 12e-2 (D1's sixth reason; Leo, 2026-11-20): closing the card just after a model swap, with the camera where the swap put it, takes the camera to the reset view. Closing it at any other time moves no camera, as before; `tests/modelCard.test.ts` still holds that.*

### 1.6 "让标签"标记写在哪

标签让开卡片是 D12 第 82 轮的规矩。新标记接在 D12 后面，作为一条修订：

> *Amended with item 12e-2 (Leo, 2026-11-20): the pin labels also keep clear of the mode buttons at the top of the scene and of the message shown there.* The row of Materials / White model / Install and the toast — every message it shows: a wall grown, a shape or a package switched, a machine left out, each with its Undo — carry `data-pin-keep-out`, as the card, the hint line and the bottom bar do. A label that stood under the row now stands clear of it, on the open page, at a fly-in and after a swap. The share link's notice is not the toast and does not carry it. Of the 45 pixel states only `desk-B-fly-refrigerator` changes: its 「05」 and 「06」 labels, which touched the row, now stand at the refrigerator's foot.

### 1.7 几处要你定的措辞

- "sixth replacing the fifth"，D1 标题 "five reasons" 不改，只加 1.4 那句注明。我建议这样，因为标题是旧原文。
- 1.3 里"中间拖动、缩放、按重置、飞到别的机器，关卡片就不动镜头"：原型里没有这一条（原型换型号以后只要一关卡片就回正中，飞到别的机器以后再关也回）。我建议照 1.3 写（第 9 节第 2 条）。
- 1.6 里提示条的标记盖住提示条显示的每一种消息，不只"墙已加长"。原型就是这样（标记加在提示条那个元素上）。我建议照原型（第 9 节第 3 条）。

---

## 2. 范围：只有这几样

1. **换型号以后的镜头**：默认角度，房间放在卡片没盖住那块的正中，远近放到整个房间刚好装进那块。
2. **关卡片时回正中**：换型号以后镜头没被别的动作动过，关卡片就回重置视角（600 毫秒，和重置按钮一样）。
3. **"让标签"标记**：上排「真实材质 / 白模 / 安装」那一排、提示条，各加 `data-pin-keep-out`。
4. **cameraKeep 的修改和新加的检查**（第 3 节）。
5. **第 14 节那些文档更正**（第五稿以前的第 14 节，照抄在第 6 节）。

**原型代码不搬。** 原型里的参数开关、甲乙丙那些分支、查找「家电 / 配置」按钮文字、`LABEL_BAND` 都不进主文件夹。在主文件夹重新写：

- **`src/three/cardFraming.ts`（新）**：一个纯计算函数。
  - 输入：画布的框、卡片的框、手机还是电脑、房间在默认角度下的大小（`fitExtents`）、默认角度。
  - 输出：远近，以及平移后的镜头中心。
  - 不碰页面，单元测试直接测。
- **`src/three/CameraRig.tsx`**：
  - 换型号那段（现在第 285 到 302 行）读卡片的框，调上面那个函数，从现在的位置缓到新位置（700 毫秒，和现在一样）。
  - 记一个"现在停在换型号放的位置"的标记，下面几种情况把它清掉：
    - 关卡片：回重置视角
    - 自己拖动或缩放（OrbitControls 的 start 事件）
    - 按缩放按钮或重置
    - 飞到别的机器
  - 两处过时的注释照最终规矩改：U 型默认视角写成往左 45°、往下 25°；"exactly two behaviours"。
- **`src/ui/SceneControls.tsx`**：上排那个 div 和提示条那个 div 加 `data-pin-keep-out`，旁边写一句为什么。
- **`src/ui/ModelCard.tsx` 第 39 行注释**："It moves no camera (D1)" 改成和 D1 第六条一致。

**这一轮不变的**：

- 飞近时的角度和远近（D1 第一、三条）
- 缩放按钮保持角度
- 切形状、换套餐时镜头怎么动
- 链接打开在默认视角
- 手机抽屉往上让 12%（D1 第二条），以及第 5.4 节登记的"飞近途中关清单"那个问题
- 卡片里的东西、卡片的位置和大小
- 标签让开卡片、提示文字、底栏的规矩
- 房间、柜子、三份清单
- 词典和格式函数（英寸号归 12e-3）
- 45 个像素状态里的 44 个、12e 那一轮的 30 个默认房间

---

## 3. 测试

### 3.1 新检查，都写进 `tests/cameraKeep.test.ts`（不另开文件）

每个换型号的例子都查这几项：

- **角度**：换型号以后是这个形状的默认角度，L 型、一字型 45°/35°，U 型 0°/50°。
- **房间在不在正中**：房间（看得见的网格的外框）的中心，离卡片没盖住那块的中心不超过 **10 像素**。
  - 第五稿量的：新原型 1 到 7 像素，线上现在 66 到 493 像素。
  - 剩下这几个像素，是房间外框中心和默认镜头中心本来就差的那一点，按重置视角也有。
- **标签 9 点查法**：每个标签取 9 个点用 `elementFromPoint` 查，都要点到标签自己。
- **不互相叠住**：两个标签的方框横竖都重叠 2 像素以上，算叠住。
- **不出屏幕**。
- **型号真的换了**：卡片标题和「已选」那一格都变成点的那一个。
- **卡片开着**。
- **关卡片以后**：回到重置视角，标签位置和按重置按钮以后一样，同样过 9 点查法。

例子（都不对称，都是第五稿量出来线上会出问题的）：

- **原有 4 条，改预期**：
  - A 的 L 型洗碗机，电脑，鼠标（线上：油烟机标签被上排按钮压住）
  - A 的 L 型洗碗机，手机，手指
  - E 的一字型冰箱，电脑，鼠标
  - D 的 U 型油烟机，电脑，鼠标（线上：多个标签被卡片盖住或变淡）
- **新加 4 条**：
  - 767 宽：
    - A 的一字型洗碗机（线上：油烟机、酒柜标签被上排按钮压住）
    - E 的 U 型油烟机（线上：标签被卡片盖住、变淡）
  - 390：
    - B 的 U 型冰箱（线上：4 个标签出屏幕）
    - D 的 L 型烤箱（线上：标签出屏幕、互相叠住）
- **767 和 390 的例子都从家电清单选机器**：点了清单行以后，先等镜头停了再关清单（你说的）。"停了"的判法：每 250 毫秒读一次镜头矩阵和远近，前后两次一样才算停，最多等 10 秒，没停就让测试失败。
- **新加 1 条，标记本身**：B 套餐电脑飞近冰箱（就是像素状态 `desk-B-fly-refrigerator`），05、06 两个标签不碰上排按钮的框。
- **新加 1 条，关卡片不回的情况**：换型号以后先拖一下镜头，再关卡片，镜头不动。这条要你同意第 9 节第 2 条才加。
- `EXPECTED_TESTS` 从 8 改成 13 或 14（看第 9 节第 2 条），原因写在旁边。
- 缩放按钮那 4 条不动。

### 3.2 单元测试 `src/three/cardFraming.test.ts`（新）

- 电脑：卡片在左边 16 到 276 像素，没盖住那块是卡片右边到画布右边。
- 手机和 767：卡片从下面上来，没盖住那块是画布顶到卡片顶。
- 远近等于那块的宽、高分别除以房间宽、高，取小的那个。
- 平移：屏幕上偏几像素，换成世界坐标偏多少，方向对（原型里左右曾经反过一次，这条专门守它）。
- 画布不是正方形，卡片不在正中，都用不对称的数。
- 没有卡片的框（读不到）时，退回整块画布，也就是重置视角的远近。

### 3.3 先在旧代码上变红

- 用最终版本的测试，在 769657a 的新拉副本上跑。
- 预计结果：
  - 原有 4 条换型号：都红在中心上；飞近角度和默认角度不同的，也红在角度上（哪几条不同，跑的时候报）
  - 新加的 767、390 那 4 条：红在中心和标签上
  - 标记那条：红
  - 关卡片那几项：红（旧代码关卡片不动镜头）
  - 缩放 4 条：绿
  - `cardFraming.test.ts`：红（文件不存在）
- 每一条报红在哪一项、是不是我预计的那一项。预计红却是绿的，停下来报告。

### 3.4 cameraKeep 改了的旧预期

- 换型号那 4 条：
  - 角度从"飞近时的角度"改成默认角度
  - "远近回到看得见整个厨房的那一档"改成"房间在没盖住那块的正中、整个在里面"
- 旁边写原因："D1 新一条取代第五条"（D1 第六条，item 12e-2，Leo 2026-11-20）。
- 文件开头说明里引的第五条原话不删，旁边注明已被第六条取代。
- `EXPECTED_TESTS` 改数，写原因。

### 3.5 守护测试故意改坏来证明

每一种改坏单独做，测试要红，改回来要绿：

1. 中心留在机器前面（第五条的做法）：中心检查红
2. 远近用整块画布的那一档，不管卡片：中心和标签检查红
3. 角度留在飞近的角度：角度检查红
4. 上排按钮去掉标记：标记那条红，767 那两条的标签检查红
5. 提示条去掉标记：要先在 107 次里找一个"提示条在、而且压到标签"的例子。找到就用它；找不到，就照实写"没有例子能证明它"，只在页面上查这个元素带着标记。
6. 关卡片不回：关卡片那几项红
7. 拖动以后标记不清：拖动那条红（如果有这条）
8. 平移方向反了：`cardFraming.test.ts` 红

### 3.6 沾边的浏览器测试，全套之前单跑

- 在 `tests/*.test.ts` 里搜以下几样，搜到的一共 **31 个文件**：
  - 按别的型号的格子（`data-candidate`）
  - 读相机（`__camera`、`__view`、`matrixWorld`）
  - 读或点标签（`data-pin-label`、`data-pin-dot`）
  - 读提示条（`data-toast`）
  - 按重置
- 文件：alternativeTitle、cameraKeep、chimney36、desktopCardHeight、eLOvenSocket、fadeRebuild、fridgeFront、fridgeSurround、geometryReturn、hoodHousing、hoodKinds、hoodLineReal、modelCard、modelCardSide、overRange、packageSwitchUndo、panelReady、partFence、phoneCard、rangeSwap、rangeSwapBill、rightTabs、rule12Note、shareLink、sideStrips、smoke、steamSill、tooTall、towerHeight12e、uBackBoardTile、uLabels
- 其中最可能受影响的：
  - 换型号以后又读相机或标签的：modelCardSide、fridgeFront、fridgeSurround、sideStrips、fadeRebuild
  - 换型号以后关卡片或按重置的：geometryReturn、hoodKinds、shareLink、phoneCard、steamSill、towerHeight12e
  - 守标签位置的：smoke、uLabels
- **哪一个变红，先停下来报告，不改它。** 要改，等你点头，并写原因。

---

## 4. 证明

### 4.1 全部 107 次换型号，三档宽度重跑

- 电脑 41、767 宽 33、手机 390 共 33，新旧构建各跑一遍。
- 用第五稿那份量数脚本（临时副本里，不进仓库），加两处：
  - "型号真的换了"的断言
  - 从清单选机器以后先等镜头停了再关清单
- 每次报：
  - 型号是否真的换了
  - 换型号以后卡片开着、关卡片以后两格：标签 9 点、互相叠住、出屏幕、房间中心离那块中心多少像素、刚换的机器有没有被卡片盖住、厨房多宽、引线长度
- **新构建通过的条件**：
  - 107 次都真的换了
  - 两格的标签三项都是 0
  - 中心都在 10 像素以内
  - 关卡片以后和重置视角一样
- 新旧并排列出。

### 4.2 45 个像素状态

- **事先写明**：
  - **44 个必须相同**：
    - 电脑 A 到 E 的 真实材质、白模、安装（15）
    - A、C、D、E 飞近冰箱（4）
    - A 到 E 飞近洗碗机（5）
    - 链接 A 到 E 带岛台、不带岛台（10）
    - 手机 390 英文 A 到 E、360 中文 A 到 E（10）
    - 理由：没有标签贴着上排按钮；提示条拍之前已经消失；都不换型号，镜头不变。只有已知的 (144, 225) 那一个点可以差 1 级，要补拍确认。
  - **`desk-B-fly-refrigerator` 有意要变**：只变「05 组合烤箱」「06 酒柜」两个标签和它们的引线（挪到冰箱脚下），3D 画布要逐字节相同。
- **拍法**：旧（769657a，从提交拉的副本构建）和新各拍两次，交替着拍：旧、新、旧、新。用 `scripts/pixelShots.mjs` 和 `scripts/pixelCompare.mjs`。
- 先比新的两次、旧的两次，看同一份构建自己会不会差；再比新旧。
- 有任何一个状态在上面的预期之外变了，停下来报告。

### 4.3 其余照规矩

- **12e 那一轮的 30 个默认房间**：必须相同。刚打开页面时标签不动，第五稿量过：电脑 15/15、手机 15/15 一样。
- **三份清单**（L 型 1,065 行、一字型 108 行、U 型 112 行）逐字节不变。
- **构建对比**：和 769657a 的构建比，只有主文件和 index.html 不同；别的文件不同就停。
- **提交带的图**：第四稿 L 节那三张对比图加 767 动图（319,417 字节），加这一轮像素证明里要看的一两张。总共不超过 2 MB，报总字节数。

---

## 5. 不在这一轮、只登记的（等提交时一起进 decisions.md）

英文是要写进 Open items 的原文；你的话照原样。

### 5.1 英寸号单做一轮（12e-3）

照第四稿的登记草稿（`inch-round-registration-draft.md`），加一句"分数和小数混用也归它"：

> 12e-3. **The inch marks made one: one place writes every inch figure on the page** *(registered with item 12e-2; Leo, 2026-11-20: 「英寸号从 12e-2 里拆出去，单做一轮，排在 12e-2 后面、12f 前面。12e-2 只做镜头和标签，词典和格式函数一个字不动。」)* … *(草稿正文照旧，见那份文件)* …
> - **Fractions and decimals mixed are this round's too** (Leo, 2026-11-20): `formatDimension` writes sixteenths ("35-5/8"") and `formatInches` one decimal ("0.8" taller than the opening"), side by side on one card. Which form, and to what step, Leo decides in its plan.

### 5.2 飞近时标签被卡片、清单竖条和手机「家电 / 配置」压住

> **At a fly-in, a pin label can stand under the card, the desktop's list rail or the phone's Appliances / Configure buttons** *(registered with item 12e-2; Leo, 2026-11-20: not this round)*. Measured on the live code (769657a) in 12e-2's fifth draft, 45 fly-ins at each width, a label not seen whole at nine points:
> - under the card: 7 on a desktop (A's U microwave and range, B's U range and hood, D's L microwave, D's U hood, E's U hood), 3 on a 390 phone, 2 at 767;
> - under the list rail's strip at the left of a desktop (`RailToggle`): 7, all in a U;
> - partly under 家电 / 配置 on a 390 phone: 3 after a swap with the reset view kept on screen (12e-2's 甲), 1 at a fly-in in bingjia3's run.
>
> The card is a keep-out, and the labels move off it as far as they can; the rail's strip and the two phone buttons are not keep-outs. 12e-2 changes none of this. When its turn comes: a plan first, and Leo's word on what to mark.

### 5.3 英文 "Specified" 这个词

> **"Specified" on the card can be read as the package's own model, which it is not** *(registered with item 12e-2; Leo, 2026-11-20: the word is his to choose)*. The tag marks the model the opening holds now (`appliance.id === current.id`, `src/ui/ModelCard.tsx`) and moves with every swap. The Chinese 「已选」 says that; the English "Specified" (`swap.selected`) can read as "what the package specifies". On 2026-11-20 a Maytag MFGS4030RS marked "Specified" after a swap was taken for package A's own range (A's is the Thermador PRG366WH; C's is the Maytag). Leo chooses the word; it goes into `en.json` and `reviewed.json` read by him first.

### 5.4 飞近途中关清单，镜头停偏

> **Closing the Appliances list while the camera is still flying in leaves the room lower** *(registered with item 12e-2; Leo, 2026-11-20: a separate item, not in 12e-2)*. At 767 wide, by the mouse, package A's L: the dishwasher picked from 家电 and the list closed 0.1 or 0.3 s later, the camera stops about 1.3 ft lower than when the list is closed after 0.7 s or more (its height 4.231 ft against 5.527), and stays there through a model swap until Reset. At 0.5 s two runs stopped in two places. With the list closed after the fly-in had ended it stopped in one place every time: 6 runs, and 6 more with the browser slowed 4 and 8 times. Under a loaded machine the probe's 0.9 s step fell inside the fly-in, and the camera stopped elsewhere in 11 of 12 cases where one run was still moving at the close and the other was not; one (767, D's U freezer) stopped elsewhere with neither moving, not explained.
> **The cause is inferred, not proven:** the sheet's framing offset (D1's second reason, `SHEET_FRAMING_OFFSET` in `CameraRig.tsx`) is added to the fly-in's destination when the fly-in starts and is worked out again every frame; closing the list mid-flight would leave part of it behind.
> **Not tried with a finger on a phone.**
> 12e-2's tests wait for the camera to stop after a list row is pressed and before the list is closed, so this does not reach them. When its turn comes: try it on a phone first, then a plan.

---

## 6. 文档更正（第二稿第 14 节，照做）

1. HANDOFF 开头 "Live"：
   - 不写具体提交号和主文件名，改成一句"线上以线上为准，开工第一步构建对比时对出来；每次上线记录在 decisions.md 各项的 Shipped"
   - 旧上线记录（第 38 到 87 行）删掉
2. 补记 769657a，写进 decisions.md 12e 的 Shipped：
   - Pages 运行 44682129634，build 21:36:21–21:37:50，deploy 21:37:54–21:38:02，都 success
   - 带计数器地址的构建，20 个文件和线上逐字节相同
   - 主文件 `index-D1M0qFzm.js`，738,102 字节
   - "Where the order stands" 里线上那一行同步改
3. HANDOFF 第 9 节指顺序那句，改成指 "Where the order stands"。
4. 全套测试时间统一成"1 小时 45 分到 1 小时 56 分"：
   - 最近三次用时列在 decisions.md 一处（3b2780a 105 分 30 秒、5d25826 112 分 15 秒、4f4351b 115 分 19 秒），HANDOFF 只指过去
   - 计划按 2 小时（你定的）
   - 旧的 "75 to 86 minutes; planned as 90" 不改写，旁边注明已被取代
5. Open items 开头那句改成和现状相符：登记的事项、你的顺序（在 "Where the order stands"）、各轮记录；没有你点头哪一项都不开工。
6. HANDOFF 里 11-06 的 "Registered, not in that order" 清单删掉，只留一句指向 decisions.md。
7. HANDOFF 第 3 节两处过时：
   - `roomSets.ts` 那行改成 1,065 和 108
   - U-2 的 "(not yet committed)" 去掉
8. decisions.md 四处早于 D1 第四、五条的说法，原文不动，旁边注明：
   - D23 "not a fourth reason"
   - 第 9012 行同样的话
   - 第 7242 行 "D1 is not changed"
   - D13 换油烟机 "the camera are kept"：注明自第六条起，换型号会动镜头
9. D1 第五条：第 1 节。
10. `CameraRig.tsx` 两处过时注释：做法定了，跟这一轮一起改（第 2 节）。
11. 只列出、不动：第 10464 行 "Built (not committed)"、第 14766 行 "not committed yet"。
12. 第 13 项只有一行，不补。
13. 旧条目一律不改写、不删，只在旁边注明已被哪一条取代。

另外跟这一轮一起进 decisions.md 的：

- 第 5 节四条登记
- 12f 那一条照你 2026-11-20 的话改：D 一字型 50A 是店里做法
- "Where the order stands" 加 12e-3 那一行，12e-2 那一行改成已上线

---

## 7. 第二稿第 16 节第 3、4、5 个问题（原文）

> 3. **全套测试排时间按多少分钟算？** 现在写的还是 90 分钟，最近三次 105 到 115 分钟。我建议按 2 小时。
> 4. **选甲或丙的话，cameraKeep 那几条换型号的预期角度改成默认角度**，旁边写原因。可以吗？
> 5. **乙要不要也在全部 74 次上补跑**，再和甲、丙比？

三个都已经解决了，这次不用再答：

- **第 3 个**：第五稿以前你说「全套测试可以按 2 小时排，写出最近三次全套测试的实际用时和各是哪一轮」。第五稿 Z 节写了出处，三次是 105 分 30 秒、112 分 15 秒、115 分 19 秒。
- **第 4 个**：你在第五稿以前说「等我选定做法再改。如果选的是丙这一类，改的原因写"D1 新一条取代第五条"」。这次选了 bingjia3，又在第 3 条里写明了，照第 3.4 节做。
- **第 5 个**：你在第五稿以前说「乙不用补跑」。

---

## 8. 步骤和预计时间

时间是估的，按以往几轮的实际用时。每一步报开始、结束时间和 exit code，以及主文件夹的 git status。

1. **动手**，约 4 小时：
   - 写 `cardFraming.ts` 和它的单元测试
   - 改 `CameraRig.tsx`、`SceneControls.tsx`、`ModelCard.tsx` 的注释
   - 改、加 cameraKeep
   - 在 769657a 的新拉副本上用最终测试跑红（第 3.3 节）
   - 一样一样故意改坏再改回（第 3.5 节）
   - 单元测试全跑一遍（约 10 分钟）
2. **单跑沾边的浏览器测试**（第 3.6 节，31 个文件），约 45 到 60 分钟。有红就停下来报告。
3. **证明**，约 1 小时 45 分：
   - 107 次换型号，新旧各一遍，三条线同时跑，约 50 分钟
   - 45 个像素状态，旧新旧新四次，约 40 分钟
   - 30 个默认房间、三份清单、构建对比，约 15 分钟
4. **起预览给你看**，约 10 分钟：
   - 用仓库自己的 Vite 构建、起预览
   - 报地址和主文件名，确认预览里的主文件就是那一个
   - 然后等你看
5. **全套测试，按 2 小时**：
   - 开始前告诉你：屏幕关闭和睡眠要设成"从不"
   - 我一直守在这一轮里等它跑完
   - 系统日志里有睡眠的那次不算，整套重跑
   - 开始以后 src/、tests/、scripts/、data/ 一个字不动
6. **你说可以提交以后**，约 1 小时：
   - 按路径提交
   - 在这次提交的新拉干净副本里跑 CI 的三条命令（约 15 分钟），一条红就停
   - 推送，等 Pages 跑完
   - 提交以后带计数器地址构建，和线上 20 个文件逐个比
   - 上线记录写进 decisions.md 的 Shipped，交接文档跟上，另一次提交，同样先跑 CI 三条命令再推送

从动手到预览，大约 7 小时；加上全套测试，约 9 小时。

---

## 9. 等你定

1. **第 1 节的英文措辞**：确认以后才算你定的。
2. **关卡片回正中的条件**：换型号以后，中间你自己拖动、缩放、按重置、飞到别的机器，再关卡片，镜头要不要回？
   - 我建议**不回**，照 D12"关卡片不动镜头"。只有镜头还停在换型号放的位置才回。
   - 原型是只要换过型号，以后一关卡片就回，包括中间飞到了别的机器。
3. **提示条的标记**：盖住提示条显示的每一种消息（墙已加长、切形状、换套餐、省略、带撤销的），还是只盖"墙已加长"？
   - 我建议每一种。原型就是这样，标记加在提示条那个元素上；只加给一种消息，要按消息分开写。
