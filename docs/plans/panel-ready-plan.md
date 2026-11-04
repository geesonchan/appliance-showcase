# 同一个嵌入式柱子或冰箱：不锈钢还是可装门板

> **第五版（2026-11-02）**：Leo 改了柱子在表格里的写法，每根柱子两行（原型号可装门板、加 -SS 的不锈钢），用 pairModel 配对，见第 3 节；decisions.md 的 **Answered 2026-11-02**。和前面不一样的地方以第 3 节为准。
>
> **第四版（2026-10-29）**：Leo 答了第 8 节的 6 题，见第 8 节；表格要补的栏和格见第 3 节。下面第 1–7 节是第三版原文，和第 8 节不一样的地方以第 8 节为准。
>
> **定稿计划（第三版，2026-10-28 晚）。** Leo 2026-10-28 答了第二版第 8 节（decisions.md，"How a flush column's finish is recorded" 下的 **Answered 2026-10-28**），并同意这一轮跳过"先看计划"、直接做到本地预览（只限这一轮）。他答复里没覆盖、要他拍板的，停在第 8 节，不做；其余照做。
>
> 基准是线上的 `ba94ef5`。行号是那时的。

---

## 0. Leo 的答复（2026-10-28）

1. 价格不用太严谨；不锈钢价格一栏空着 = 同价。
2. 嵌入式柱子（冷藏、冷冻、酒柜柱）出厂只有可装门板；要不锈钢外观是另买不锈钢门板和把手。界面上"原型号 = 可装门板"，"原型号 + -SS = 不锈钢外观"，-SS 是展示用的写法。36" 嵌入式冰箱 T36BT120NS（不锈钢）和 T36IT100NP（可装门板）是两个真型号，算同一台的两种；连成一对的写法由计划提出，他确认。
3. 报价上不锈钢版带 -SS（冰箱就是 T36BT120NS 本身）。
4. 表格选丙：一行一个型号，"颜色"填 `SS / Panel Ready`，只加一栏不锈钢价格（空着同价）。嵌入式柱子和冰箱的"颜色"一定要填，空着导入时停下来列出，不再默认不锈钢。
5. 各套餐打开时默认不锈钢，线上画面不变。
6. 可装门板时清单里：「门板由柜子厂按柜门做，不含在本报价内。」/ "Door panels are made by your cabinet maker to match the cabinet doors and are not included in this quote."，锁进 `reviewed.json`。
7. 柱子门面齐平留到第 101 轮，这一轮只换颜色。

## 1. 这一轮做什么（Leo 的答复已覆盖的）

### 1.1 导入

- `scripts/normalise.ts` 的 `toFinish` 不变：`SS / Panel Ready` 读成 `["stainless", "panel-ready"]`，不锈钢在前 = 默认（答复 5）。
- **新栏 `ssMsrpUSD`**（不锈钢外观的价格）→ 目录的 `stainlessMsrpUSD`；空着 = `null` = 同价（答复 1、4）。
- **"颜色"空着就停**：嵌入式柱子（安装方式含 `column`）和嵌入式冰箱（冰箱类、安装方式含 `built-in`），"颜色"空着、Feature 里也没有 `Panel Ready` 的，导入停下，一行一个列出型号，什么都不写（答复 4）。其他类别空着仍照旧默认不锈钢（答复只说了柱子和冰箱）。
- 这一轮**不用 Leo 的表格真正导入**：他的表格这几格还没填。校验用测试数据验证（`scripts/*.test.ts`），并用他 2026-10-28 那份 CSV 空跑一次，应停下并列出那几行。

### 1.2 目录里怎么记，页面怎么用

- 一行有两种面板（`finish` 同时有 `stainless` 和 `panel-ready`）的型号，页面载入目录时给它两个"样子"：
  - **不锈钢外观**：就是这一行本身（同一个 id），面板 `stainless`，价格 `stainlessMsrpUSD`，空着用原价；显示型号 `原型号-SS`。
  - **可装门板**：面板 `panel-ready`，原价，显示原型号。选择里记成 `id#panel-ready`；id 不变，所以按 id 查的东西（预埋点 `rough-in.json` 等）照旧。
- 所以默认（各套餐写的 id）仍是不锈钢，房间一点不变（答复 5）；候选列表还是一行一项。

### 1.3 界面

- **在哪里选**：型号卡片（`src/ui/ModelCard.tsx`）里，选中的那台有两种样子时，下面一个两项开关。电脑、手机是同一张卡片。
- **字**：中文用 Leo 答复里的「不锈钢外观」「可装门板」；英文暂用 "Stainless" / "Panel-ready"。**不锁进 `reviewed.json`**，选项列在第 8 节。
- **型号写法**：卡片、列表、说明卡、配置单、分享链接里，不锈钢外观写 `原型号-SS`，可装门板写原型号（答复 2、3）。
- **门怎么画**（答复 7）：只换颜色。可装门板穿这排柜子的门色（点缀色那一排上穿点缀色，D15），不锈钢是钢色；尺寸、位置不动。柜子、侧板、填充板不跟着变。

### 1.4 配置单和清单

- 配置单：型号照上面写法，价格照选的那种（答复 1、3）。
- 清单：
  - 柱子或嵌入式冰箱是可装门板时，加一行答复 6 的话，锁进 `reviewed.json`。T36IT100NP 本来就是可装门板，选了它也有这一行。
  - 18" 酒柜的不锈钢门板提醒（TFL18IW105 / TFL18IW10R）照旧：不锈钢外观时有，可装门板时没有。

### 1.5 分享链接

- 链接里的型号照 1.3 的写法：`wine=T18IW905SP-SS` 是不锈钢外观，`wine=T18IW905SP` 是可装门板。
- 旧链接（`v=1`、`v=2`）里的 `T18IW905SP` 写的时候就是不锈钢，所以照不锈钢打开，什么都不说（像 `v=1` 读成 L 型那样，D23）。为了分得开，新链接写成 `v=3`。

## 2. 重新导入（这一轮准备好，不执行）

1. Leo 补好表格（第 3 节的行）、加 `ssMsrpUSD` 一栏，重新导出。
2. 先空跑：在内存里转换，和现在的 `data/appliances.json` 逐项比。只能变他改的那几格（T36IT100NP 的 `cutoutDepthIn` 25、各行的"颜色"、新的价格栏）；其他有任何变化，停下来逐条列给他。
3. 他确认后写入，再比一次，记进 decisions.md。

## 3. 表格里要补的行（Leo 2026-11-02 定的写法，取代 10-29 的"一行写 SS / Panel Ready"）

`showcase_specs` 有两栏，名字照下面写（导入按栏名读）；`showcase_export` 右边也各一栏，按 Model 用 XLOOKUP 从 `showcase_specs` 取。`Stock current` 的 Color 一格都不动。

- **`webColor`**：网页用的面板，只能是 `SS` 或 `Panel Ready`。填了就用它，Color 和 Feature 都不读；空着照旧读 Color。别的字（包括 `SS / Panel Ready`）导入会停下并列出来。
- **`pairModel`**：同一台机器的另一行，两行互填对方。页面上的开关只按它在两行之间切换。
- 每根嵌入式柱子两行：原型号可装门板，加 -SS 的一行不锈钢。-SS 行除 Model、webColor、msrpUSD、pairModel 外每一格都要和原型号行相同，不同导入就停下逐格列出。-SS 行读原型号的规格表修正和接线点。套餐默认用 -SS 行。
- 不锈钢价那一栏（`ssMsrpUSD`）不要了：每行有自己的 `msrpUSD`。

| Model | webColor | pairModel | msrpUSD |
|---|---|---|---|
| T18IF900SP | `Panel Ready` | `T18IF900SP-SS` | 照旧 |
| T18IF900SP-SS | `SS` | `T18IF900SP` | 7599 |
| T18IW905SP | `Panel Ready` | `T18IW905SP-SS` | 照旧 |
| T18IW905SP-SS | `SS` | `T18IW905SP` | 7099 |
| T24IF905SP | `Panel Ready` | `T24IF905SP-SS` | 照旧 |
| T24IF905SP-SS | `SS` | `T24IF905SP` | 8099 |
| T24IR905SP | `Panel Ready` | `T24IR905SP-SS` | 照旧 |
| T24IR905SP-SS | `SS` | `T24IR905SP` | 8099 |
| T24IW905SP | `Panel Ready` | `T24IW905SP-SS` | 照旧 |
| T24IW905SP-SS | `SS` | `T24IW905SP` | 7599 |
| T30IR905SP | `Panel Ready` | `T30IR905SP-SS` | 照旧 |
| T30IR905SP-SS | `SS` | `T30IR905SP` | 8599 |
| T18IW100SP | `Panel Ready` | `T18IW100SP-SS` | 照旧 |
| T18IW100SP-SS | `SS` | `T18IW100SP` | 7799 |
| T36BT120NS | `SS` | `T36IT100NP` | 照旧 |
| T36IT100NP | `Panel Ready` | `T36BT120NS` | 照旧 |

T36BT120NS 和 T36IT100NP 是厂里两个型号，不做"其余每格相同"的检查。别的行这两栏都空着。

## 4. 测试怎么先红后绿

- 导入（单元测试，测试数据）：`ssMsrpUSD` 读进来；嵌入式柱子和冰箱"颜色"空着就停、一个个列出、不写；其他类别空着照旧不锈钢。旧代码上红。
- 目录（单元测试）：两种面板的行有两个样子，型号写法、价格、面板对；只有一种的行不变。
- 配置单、清单、分享链接（单元测试）：照 1.4、1.5。旧链接 `T18IW905SP` 读成不锈钢。
- 浏览器：电脑用鼠标、手机用手指点开关，柱子的门从钢色变成柜门色，门的位置和宽度不变；配置单上型号和价格跟着变。旧代码上红（没有开关）。
- **证明（Leo 2026-10-28）**：
  - 默认房间（默认不锈钢）：L 型和一字型底稿、锁画质的像素，**都应完全不变**（和 `ba94ef5` 逐字节比）；
  - 选了可装门板或 -SS 的房间：改前改后截图；
  - 全套测试。

## 5. 预览用的目录

Leo 的表格还没补，仓库里的目录没有两种面板的行，开关不会出现。为了测试和预览，用**测试目录**：他 2026-10-28 的 CSV 加上第 3 节"应该填"的那几格，经同一个导入程序转出来，放在 `data/appliances.json`（工作区，不提交）。它和他补好以后导出的结果应该一样；早上他可以 `git checkout data/appliances.json` 换回原来的。

## 6. 要改的文件

| 文件 | 改什么 |
|---|---|
| `scripts/normalise.ts`、`scripts/csv-to-json.ts`、`docs/data-sheet-spec.md` | `ssMsrpUSD`；"颜色"空着就停 |
| `src/data/schema.ts` | `stainlessMsrpUSD` |
| `src/data/catalogue.ts` | 两个样子、型号写法 |
| `src/store/shareLink.ts`、`src/store/openLink.ts`、`src/data/linkVersion.ts` | 链接 `v=3` |
| `src/ui/ModelCard.tsx`、`SpecCard.tsx`、`LeftPanel.tsx`、`SwapPanel.tsx`、`src/i18n/*.json` | 开关、型号写法 |
| `src/data/quote.ts` | 型号、价格 |
| `src/data/useChecklist.ts`、`src/i18n/reviewed.json` | 清单那一行 |

## 7. 不做的

- 柱子门面齐平、柱子组里门盖过连接件（第 101 轮，答复 7）。

## 8. Leo 2026-10-29 的答复（原来停在计划的 6 题）

1. 冰箱那一对：记在 `showcase_specs` 的 `pairModel`，两行互填对方型号（第 3 节）。页面上同一个开关，切换就是换型号，各写各的型号和价格，不加 -SS。
2. "颜色"：`Stock current` 不动，`showcase_specs` 加一栏 `webColor`，专门给网页用（第 3 节）。
3. 清单那一行也管洗碗机：套餐里可装门板的洗碗机（例如 SHV78CM3N）也写，不锈钢面的不写。A 和 E 的默认清单因此多这一行。
4. 开关上的字：「不锈钢 / 可装门板」/ "Stainless / Panel-ready"，锁进 `reviewed.json`。
5. 默认的柱子写 -SS，照现在。
6. 配置单不另写一行面板。门板说明只留「门板由柜子厂按柜门做…」一行：同一个槽位有这一行时，原来的「预留门板机型装在按饰面侧预留的槽位中」不再出现。

另外：T18IW100SP 按 17.75" 对，出处是 `docs/reference/t18iw100sp-spec.pdf`。所以 B 里没有 18" 面板那一行是对的。
