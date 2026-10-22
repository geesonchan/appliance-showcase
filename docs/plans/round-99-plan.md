# 第 99 轮 · L 型的标签（只改文字）

> **方案，未定。** 交给 Leo 读，确认前不动代码。Leo 的决定以后写进 `docs/decisions.md`；做完之后以 `decisions.md` 为准，这份文件不再跟着改。

线上是 98b-2：提交 `cc251d5`，部署流程（run 39697491715）build、deploy 两步都成功；带计数器地址在 `cc251d5` 上构建，六个文件和线上逐字节相同，主程序 `index-DIetOK0j.js`。

下面的对照都是在 `cc251d5` 的代码上跑出来的：
- `probe99.ts`：五个套餐、两种形状，每个位置的标签、默认机器、两面墙的组成；
- 98b-2 的几何全量导出：1,045 个 L 型房间，含每个房间的清单文字和墙的组成。

---

## 0. Leo 已定的（round 98b-2，这次的答复）

1. B、E 的组合烤箱在 L 型里标成「微波炉 / Microwave」，改用已定的「组合烤箱 / Combination oven」（`slot.comboOven`）。
2. B、E 的组合烤箱塔在墙的组成里叫「微波抽屉 / microwave drawer」，改用「组合烤箱塔 / combination oven tower」（`requirement.comboOven`）。
3. E 的咖啡柜叫「咖啡机+洗碗机柜」，可 E 的咖啡机下面是酒柜。按每个套餐咖啡机下面实际放的东西给名字；要新叫法的，列给 Leo 定。
4. L 型右墙那块 3" 填板叫「收尾柜 / cabinet at the open end」，改用一字型已定的「靠墙填充板 / filler against the wall」（`requirement.wall-end`）。同一个东西只用一个词。

---

## 1. 每个位置的标签，对默认机器

标签来自 `data/slots.json`（每个位置一个），套餐可以改写（`labelKey`；到现在只有 D 一字型的烤箱用了，98b-2）。

| 套餐 · 形状 | 位置 | 标签 | 默认机器 | 类别 | 对得上 |
|---|---|---|---|---|---|
| A、C · L 和一字型 | slot-microwave | 微波炉 / Microwave | MD24BS | 微波抽屉 | 类别对，用词见第 3 节问题 4 |
| **B · L 和一字型** | slot-microwave | 微波炉 / Microwave | MEM301WS | 组合烤箱 | **✗** |
| **E · L 和一字型** | slot-microwave | 微波炉 / Microwave | MEM301WS | 组合烤箱 | **✗** |
| D · L | slot-oven | 蒸烤箱 / Steam oven | PODS302B | 双门蒸烤箱 | ✓ |
| D · 一字型 | slot-oven | 组合烤箱 / Combination oven | MEM301WS | 组合烤箱 | ✓（98b-2） |
| D · L | slot-microwave | 微波炉 / Microwave | MD24BS | 微波抽屉 | 类别对，同 A、C |
| B、D · 两种形状 | slot-range | 灶台 / Range | PCG366W | Rangetop（台面灶，下面是 DB36 抽屉柜） | 类别对，英文用词见问题 4 |
| E · 两种形状 | slot-wine-2 | 酒柜 / Wine cooler | PRW24C01CG | 酒柜 | ✓；A、C 同一台叫 Wine cabinet，见问题 4 |

其余位置都对得上：冰箱、冷冻柱、酒柜柱、油烟机、洗碗机、第二台洗碗机、咖啡机、E 的电磁灶。

**默认之外：换了型号，标签不跟着换。** 标签跟着位置走，不跟着机器走。几何导出里每个位置能换的型号，见下表。

| 位置 | 能换成的 | 换了以后标签说的 |
|---|---|---|
| B、E 的 slot-microwave | ME301YP 单门烤箱、PO302W 双门烤箱、PODS302B 双门蒸烤箱 | 照第 0 节第 1 条改完后，三种都会叫「组合烤箱」 |
| D 的 slot-oven | ME301YP、MEM301WS 组合烤箱、PO302W | 都叫「蒸烤箱」 |
| A、B、C、D 的 slot-hood | JVM3160RFSS 炉上微波炉（97 轮） | 叫「油烟机」 |
| A 的 slot-range | PCG366W Rangetop | 叫「灶台 / Range」 |

Leo 要的测试只看默认机器，这些情况都会通过。见第 3 节问题 1。

---

## 2. 墙的组成（`requirement.*`），对实际放的东西

**先说清楚在哪看得到。** 这些词不在配置单上，也不在报价、规格卡、左栏或画面上。它们只出现在两处，都要把鼠标停上去才看得到（`title` 悬停提示）：
- 布局标签里，墙长滑杆下面那串数字，每一项的悬停提示（`LayoutControls.tsx` 的 `WallMinimum`）；
- 墙不够长时，拒绝说明下面那串数字的悬停提示（`RefusalNote.tsx`）。

配置单（`QuotePage.tsx`）和报价文字（`formatQuote`）用的是第 1 节的位置标签。所以 B 的塔在配置单上写的是「微波炉」；「微波抽屉」只在悬停提示里。截图拍不到悬停提示，所以这一类的证明靠文字导出和测试（第 6 节）。

| 套餐 · 形状 | 那一项 | 现在叫 | 实际是 | 对得上 |
|---|---|---|---|---|
| **B、E · L 和一字型** | 烤箱塔 T3096 | 微波抽屉（`requirement.microwave`） | MEM301WS 组合烤箱塔 | **✗** 已知 |
| D · L | 微波抽屉 | 微波抽屉（`requirement.microwave`） | MD24BS | ✓。所以 `requirement.microwave` 这个词本身不能改，B、E 要换成另一个键 |
| D · L | 烤箱塔 | 蒸烤箱塔（`requirement.oven`） | PODS302B | ✓ |
| **E · L 和一字型** | 咖啡柜 T2496 | 咖啡机+洗碗机柜（`requirement.coffee`） | 下面是酒柜 PRW24C01CG | **✗** 已知 |
| D · L | 咖啡柜 T2496 | 咖啡机+洗碗机柜 | 下面是第二台洗碗机 | ✓ |
| **A–E · L，287 个房间** | 后段靠右墙 BF3 3" | 收尾柜（`requirement.back-end`） | 靠墙填板 | **✗** 已知 |
| A–E · 一字型 | 后墙右端 9" 柜 + 3" 侧板 | 收尾柜（同一个键 `requirement.back-end`） | 开放端的柜子 | ✓ |
| A–E · L，228 个房间 | 左段开放端 9" 柜 | 收尾柜（`requirement.left-end`） | 开放端的柜子 | ✓ |
| **A–E · L，228 个房间；A–E · 一字型** | 开放端柜子外侧 3" 侧板 PNL3 | **没有文字**：`requirement.left-end-panel`、`requirement.back-end-panel` 中英文都没有，悬停提示显示键名本身 | 侧板 | **✗** 新发现 |
| **D、E · L，80 个房间；D · 一字型** | 柱组和墙之间 BF3.5 3-1/2" | **没有文字**：`requirement.tall-clearance`，显示键名本身（第 32 轮起就是这样） | 让柱门开得开的靠墙填板 | **✗** 新发现 |
| **B · 一字型** | 柱组外端 BF3.5 | 列组侧板（`requirement.tall-outer`） | 靠墙填板，不是侧板 | **✗** 新发现 |
| B、D、E · L | 冰箱 T3096 / T3696 | 冰箱柜体（`requirement.fridge`） | D、E 是冷藏柱；同组的冷冻柱叫「冷冻柱」 | 见问题 4 |

**一个陷阱。** L 型右墙的填板和一字型右端的开放柜，用的是同一个键 `requirement.back-end`：
- 在 L 型里，它在右墙那头，是填板，叫「收尾柜」是错的；
- 在一字型里，它在开放的那一头，是 9" 柜加侧板，叫「收尾柜」是对的。

所以不能改 `requirement.back-end` 的文字。要改的是 L 型靠墙的那块：让它用 `requirement.wall-end`。这一块的 id 和几何都不变。

---

## 3. 要 Leo 定的

1. **标签跟位置走，还是跟机器走？**
   - 甲：跟位置走，就是现在的做法。B、E 的塔改叫「组合烤箱」；换成别的烤箱以后，标签仍然叫「组合烤箱」（第 1 节第二张表）。
   - 乙：跟选中的机器走，按类别和安装方式取词。换了型号，标签跟着换，第二张表那几种情况也一起对上。代价是：单门烤箱、双门烤箱、炉上微波炉、Rangetop 这几种要各有一个叫法（现在都没有），要你给。测试也就不只看默认机器，而是看每一个能换的型号。
2. **咖啡柜的名字**，按咖啡机下面放的东西：
   - 下面是洗碗机（D）：现有的「咖啡机+洗碗机柜 / coffee and dishwasher cabinet」；
   - 下面是酒柜（E）：**要新叫法**；
   - 下面是普通柜子：现在没有哪个套餐默认这样。要不要预先给个名字，由你定。

   页面上已经按这三种情况说话的，是咖啡机高度滑杆下面那句：「下方为洗碗机 / 下方为酒柜 / 下方为柜子」（`panel.layout.coffeeSill.caption.*`）。列在这里只作对照，不是我拟的定稿。
3. **两个还没有文字的东西**：
   - 开放端柜子外侧的 3" 侧板（`left-end-panel`、`back-end-panel`）：要一个名字；
   - 柱组和墙之间那块 3-1/2" 填板（`tall-clearance`，以及 B 一字型的 `tall-outer`）：用「靠墙填充板」，还是另起一个名字。
4. **同一个东西两个词**。每一条请你定：这轮统一，还是先不动。
   - MD24BS：标签叫「微波炉 / Microwave」；你定的句子都叫「微波抽屉」（98b-2 的第 10、11 条、D 的提示、无岛台的几句）；`suggestion.island` 叫「微波炉和红酒柜」。
   - PRW24C01CG：A、C 叫 "Wine cabinet"，E 叫 "Wine cooler"。中文的位置标签都叫「酒柜」，墙的组成里叫「红酒柜」（`requirement.wine`）。
   - PCG366W：英文叫 "Range"，它是 Rangetop。中文「灶台」没问题；你锁定的句子里已经写作「Rangetop」（`rule.rangetopCornerSupports`）。
   - D、E 的冷藏柱：墙的组成里叫「冰箱柜体 / refrigerator enclosure」，同一组里的冷冻柱叫「冷冻柱 / freezer column」。
5. **不是标签、是句子的错**（这轮要不要一起改）：
   - B 没有岛台时（32 个房间，B 所有无岛台的摆法），清单里出现「无岛台：微波抽屉在…灶台旁的地柜内，酒柜收在…末端」（`rule.noIslandFallback`）。B 没有微波抽屉，它的酒柜是柱子。这句只该说给 A、C。改法是改出现的条件，文字不动。
   - 分享链接打开、某个型号不能用时，提示里的位置名取的是 `slots.json` 的原名，不是套餐改写过的名字（`shareLink.ts` 的 `MODEL_FIELDS`）。D 一字型的烤箱今天在这个提示里叫「蒸烤箱」。B、E 的塔改名以后，这个提示也会照旧叫「微波炉」，除非一起改成从套餐取名。
6. **这次 decisions.md 和 HANDOFF.md 的两处改动**（98b-2 上线的逐个文件对比、你定的 99–101 轮顺序）现在只在本地，还没提交。
   - 跟第 99 轮一起提交：不多一次部署（推荐）；
   - 单独提交：线上底部的版本号会变，要再部署、再对一次文件。

---

## 4. 每个名字出现在哪里

**位置标签**（`slot.*`，第 1 节）：
- 画面标注（`PinOverlay.tsx`）；
- 左栏清单（`LeftPanel.tsx`）；
- 型号卡，两处（`ModelCard.tsx`）；
- 换型号面板的标题（`SwapPanel.tsx`）；
- 规格卡（`SpecCard.tsx`）；
- 配置单（`QuotePage.tsx`）；
- 报价文字，复制或发送时用（`quote.ts` 的 `formatQuote`）；
- 安装清单的分组标题（`InstallChecklist.tsx`）；
- 管线清单每一行的开头（`RoughInList.tsx`）；
- 分享链接的提示（`share.notice.*`，经 `MODEL_FIELDS`；见问题 5）。

**墙的组成**（`requirement.*`，第 2 节）：只在两处悬停提示里，即布局标签的墙长那串数字、拒绝说明的数字清单。

**锁定状态**（`reviewed.json`）：
- 要用到的三个键都已锁定，是你 98b-2 的原话：`slot.comboOven`、`requirement.comboOven`、`requirement.wall-end`。这轮只是让更多地方用它们，文字一个字不改，所以不需要重审。但它们会出现在 L 型的新位置上，截图会给你看。
- 要改出现条件或出现位置、但文字不改的键，都没锁：`slot.microwave`、`requirement.microwave`、`requirement.back-end`、`requirement.coffee`、`rule.noIslandFallback`。
- 新键（问题 2、3 的名字，问题 1 选乙时的各类叫法）：等你给原话，写进后锁定。
- 问题 4 里你决定要改的词，改完也锁定，交给你审。

---

## 5. 怎么改（只改文字，几何一处不动）

- `data/packages.json`：B、E 的 slot-microwave 加 `labelKey: "slot.comboOven"`。一字型继承 L 型的写法，不重复写（98b-2 的规则）。墙的组成会经 `labelOfSlot` 自动取 `requirement.comboOven`，D 一字型已经是这样。
- `layoutTemplate.ts`：
  - 靠墙的那块收尾填板，`labelKey` 用 `requirement.wall-end`；`id` 仍叫 `back-end`，柜体、位置、编号都不变。
  - 咖啡柜的 `labelKey` 按 `underCoffee` 取（已有的函数）。
  - 侧板、柱旁填板按问题 3 的答复。
- 问题 1 选乙：位置标签改由选中机器的类别和安装方式决定，一处函数，所有显示位置都经它取词。
- 问题 5 要改的话：`rule.noIslandFallback` 只在有微波抽屉和独立酒柜的套餐出现；`MODEL_FIELDS` 从当前套餐取位置名。
- 新词写进 `en.json`、`zh.json` 和 `reviewed.json`。

---

## 6. 测试

每条测试先在旧代码上变红，读清楚红的原因，再改代码。

1. **位置标签对机器**：五个套餐、两种形状，每个位置显示的标签都必须和默认机器的类别相符（问题 1 选乙时，是每个能换的型号）。按一张「类别 + 安装方式 → 标签键」的表比对：微波抽屉 → `slot.microwave`；组合烤箱 → `slot.comboOven`；双门蒸烤箱 → `slot.oven`；其余一一对应。今天会在 B、E 的四个组合上变红。以后再出现「组合烤箱标成微波炉」，这条就会红。
2. **墙的组成对实际放的东西**：每一项凡是放着机器的，键跟那台机器的类别对上；咖啡柜的键跟 `underCoffee` 对上；凡是一块 BF 填板顶着墙，键是 `requirement.wall-end`（或问题 3 定的名字）。今天会在 B、E 的塔、E 的咖啡柜、L 型右墙的填板上变红。
3. **每个出现在墙的组成里的键，中英文都有文字**：今天在三个键上变红（`left-end-panel`、`back-end-panel`、`tall-clearance`）。
4. 问题 5 要改的话：B 无岛台的清单里没有那句；分享链接提示的位置名和画面上的一样。

---

## 7. 证明

1. **几何**：1,045 个 L 型房间。导出拆成两部分：
   - 去掉文字以外的部分，要和 `cc251d5` 逐字节相同；
   - 文字部分（清单句子、墙的组成的键）逐条比对。每一处差别都必须在本方案列出的改动之内，由脚本对照这张清单；清单外有任何差别就算失败，并逐个列给你。
2. **像素**（D17 第三种办法）：
   - 在本地构建 `cc251d5` 的代码，和新代码比；照上次的 45 个状态，各拍两次，`?quality=high`，鼠标点击。
   - 每一块有差别的区域，都必须落在某个文字改了的元素里。这些元素从两边的 DOM 取出：画面标注、左栏的行、规格卡、配置单等等。
   - 逐个列出：哪个状态、哪个元素、旧字 → 新字。3D 画面（canvas）必须一个像素都不差。
   - 文字变长，那一行或那个标注会变宽，这算在那个元素里。
3. **全套测试**（`npm test`），以及 `scripts/qualityDrop.mjs`：旧构建和新构建交替各跑 10 次。
4. **截图给你**，中英各一张：每个改了名字的地方，B、E 的标注、左栏、配置单、清单分组标题，还有墙的组成的悬停提示（鼠标停住再拍）。

---

## 8. 流程

1. 你确认这份方案，答第 3 节的问题，给新叫法的原话。
2. 照方案做。做完起本地预览给你看，报出它用的主程序文件名，截图都标上这个文件名；同时说清线上仍是 `cc251d5`。
3. 你确认后提交、推送，等部署流程跑完，报 build、deploy 两步各自的结果。
4. 在提交之后的那个版本上，带计数器地址重新构建，和线上逐个文件对比文件名和内容，把结果告诉你，并写进 `decisions.md`。
