# 可替换选项的主标题（计划第三稿，2026-11-08）

**状态：第三稿，已做完，Leo 看过本地预览，2026-11-09 确认。** 第二稿他看过，主标题表同意，改两处（第 1 节末）。报告在 `docs/plans/alternative-title-report-2026-11-08.md`。

Leo，2026-11-08：「当我们点中一个家电的时候，会显示这个家电的可替换选项，里面的选项显示的主标题是这个item的归类更好，而不是model number，因为很多使用者都不熟悉model number，只知道 36" Gas Range， 36" Gas Rangetop，30" Gas Range等」

已定的在 `docs/decisions.md`，"An alternative's main title"：所有家电的可替换选项都改；主标题 = 名义尺寸 + 燃料（有的话）+ 种类；中文照叫法表；名义尺寸是 `webSize`，代码不按实际宽度取整；副标题 = 品牌 · 型号（预览时再看）。

## 1. Leo 对第一稿的回答（2026-11-08）

| 条 | 定的 |
|---|---|
| 1 | 重新导出了 `showcase_export.csv`，先核对（第 2 节，已过） |
| 2 | 照建议：VCIN36GWS 填 36 对，测试里唯一的例外，写明是 Leo 定的 |
| 3 | 照建议：管道风机、内置风机、外置风机，下面那行小字去掉 |
| 4 | 分。那 4 台中文叫吊柜式油烟机，「不叫壁挂式（壁挂式是我写错的）」，英文 Under-Cabinet Hood；岛式照建议 |
| 5 | 分。柱式中文叫冷藏柱，和冷冻柱、酒柜柱统一，英文 Refrigerator Column |
| 6 | 照建议：燃气、电磁、电，中文连写，尺寸后一个空格 |
| 7 | PODS302B：双门蒸烤箱 / Double Steam Oven |
| 8 | 照建议，补充：CIT367YG 中文主标题"电磁炉灶片"，不带 Drop in |
| 9 | 照建议：选项里不再显示实际宽度 |
| 10 | 柱子的不锈钢和可装门板两行，主标题后面带外观；其余同名的先这样，预览时再看 |

第 10 条 Leo 的例子：`24" Refrigerator Column · Stainless` / `24" 冷藏柱 · 不锈钢`，`24" Refrigerator Column · Panel-Ready` / `24" 冷藏柱 · 可装门板`；冷冻柱、酒柜柱同样。

Leo 对第二稿，2026-11-08：

1. 「T36BT120NS 和 T36IT100NP 也带外观：36" Built-In Refrigerator · Stainless / 36" 内嵌式冰箱 · 不锈钢，36" Built-In Refrigerator · Panel-Ready / 36" 内嵌式冰箱 · 可装门板。规则改成：目录里记了外观、有成对的，主标题都带外观，不只认柱子。测试跟着改：每一对的两行主标题不同。」
2. 「安装距离那条规则里的"壁挂式"，是我上一轮写给你的说法，意思是"微波炉式以外的油烟机"。hoodMount.ts 的注释和 decisions.md 里改成"微波炉式以外的油烟机 30"，微波炉式 24""，意思不变，只改字，写明原因。」

## 2. `showcase_export.csv` 核对：通过

只读，没有导入。

- 文件：`C:\Users\leoch\Downloads\showcase_export.csv`
- 修改时间：2026-11-08 20:05:01 PST
- 大小：9,453 字节
- SHA-256：`ab656839c31958c341b787cf29553efcaed6eb09cd952b18dc20bb22080d68ba`
- 44 行，目录每台都在，没有多的，没有重复。列和 13:23:43 那份完全一样：25 列，名字和顺序都没变。

**`webSize` 和 `showcase_specs.csv`（`21f9106b…`）：44 台一字不差。**

**有一点要写明**：这次核对时 `showcase_specs.csv` 已经不在 Downloads。比的是 19:01:59 从那份文件（SHA `21f9106b…`）读出后存下的每台 `webSize`，读的时候去掉了前后空格。所以数值是那一份的，但没有再打开原文件。

**其他列和目录逐字段比：44 台，1,584 个字段，0 处不同。**用的是导入程序自己的读法，导入 44 行，跳过 0 行，没有警告。

导入程序不读的两列：`webSize`（这一轮要加）和 `makeupAirRequired`（43 格空，PH36HWS 一格 TRUE）。

第一次跑核对脚本 exit 1（20:10:10–20:10:12），因为 `showcase_specs.csv` 不在了。改成读存下的值后再跑，20:10:27–20:10:29，exit 0。

### `webSize` 和实际宽度

| 型号 | 实际 | webSize |
|---|---|---|
| HIS8055U | 30" | 30" |
| MFGS4030RS | 29-7/8" | 30" |
| PCG366W | 35-15/16" | 36" |
| PRG304WH | 30" | 30" |
| PRG366WH | 36" | 36" |
| CIT367YG | 37" | 36" |
| AK7136BS-BF | 36" | 36" |
| AK7300AS | 30" | 30" |
| HMCB30WS | 29-15/16" | 30" |
| HMCB36WS | 35-15/16" | 36" |
| HMIB42WS | 42" | 42" |
| HMWB361WS | 36" | 36" |
| PH36HWS | 36" | 36" |
| VCIN36GWS | 33-3/4" | 36" |
| JVM3160RFSS | 29-7/8" | 30" |
| VTI2FZ | 无 | 空（风机） |
| VTN2FZ | 无 | 空（风机） |
| VTR2FZ | 无 | 空（风机） |
| ME301YP | 29-3/4" | 30" |
| MEM301WS | 29-3/4" | 30" |
| PO302W | 29-3/4" | 30" |
| PODS302B | 29-3/4" | 30" |
| MD24BS | 24" | 24" |
| TCM24PS | 24" | 24" |
| SHV78CM3N | 24" | 24" |
| SHX78CM5N | 24" | 24" |
| T24IR905SP | 24" | 24" |
| T24IR905SP-SS | 24" | 24" |
| T30IR905SP | 30" | 30" |
| T30IR905SP-SS | 30" | 30" |
| T36BT120NS | 36" | 36" |
| T36FT820NS | 35-5/8" | 36" |
| T36IT100NP | 36" | 36" |
| T18IF900SP | 18" | 18" |
| T18IF900SP-SS | 18" | 18" |
| T24IF905SP | 24" | 24" |
| T24IF905SP-SS | 24" | 24" |
| PRW24C01CG | 24" | 24" |
| T18IW100SP | 17-3/4" | 18" |
| T18IW100SP-SS | 17-3/4" | 18" |
| T18IW905SP | 18" | 18" |
| T18IW905SP-SS | 18" | 18" |
| T24IW905SP | 24" | 24" |
| T24IW905SP-SS | 24" | 24" |

- 空的（风机以外）：0 台。
- 不是数字的：0 台。
- 差超过 1"：只有 VCIN36GWS，Leo 定 36 对。

## 3. 打算怎么做

**规则只写一处**：`src/data/machineLabel.ts` 加一个函数，给一台机器出主标题，英文中文同一条规则：

名义尺寸 + 燃料（有的话）+ 种类 + ` · 外观`（有成对的）

- **尺寸**只读 `webSize`，不碰宽度，不取整。风机没有尺寸。
- **种类**：主标题自己一张表，第 1 节定的词都在这里。
- **外观**：目录里记了外观、有成对的（`pairModel` 不空）都带，共 16 行：14 行柱子，加 T36BT120NS、T36IT100NP。读目录的 `finish`。词用页面已有的 `card.look.*`（不锈钢、可装门板），英文在主标题里每词大写。

**显示**：三个地方，第一行主标题，第二行品牌 · 型号，型号照旧不截断。

- 选项卡，`ModelCard.tsx:119-128`，第一行的实际宽度不再显示
- 列表栏，`SwapPanel.tsx:286`
- 风机行，`SwapPanel.tsx:222`，下面那行 inline、internal、external 去掉

**不动**：3D、图钉上的名字、报价单、左边清单、上方当前机型那一块（实际宽度还在）。细分的词**只用在主标题**，图钉和报价单还是"油烟机""冰箱"。

**这次导入顺带**：`_meta` 不再写日期和路径（已定的第 3 种做法）。`data/appliances.json` 的 `_meta` 只留 provenance。`updatedAt` 别的数据文件还要用，只给这个文件单独放宽 schema。

**导入新增**：`webSize` 进目录。风机以外空着或不是数字，**导入停下、列出、什么都不写**。差超过 1" 只打印，不停。

## 4. 动手时发现，要你知道的

- **风机那行小字还带着 CFM**：第一稿我只说了 inline、internal、external，那一行其实是 `inline · 1,000 CFM`。主标题说不出 CFM，所以只去掉安装方式的词，CFM 留着（VTR2FZ 没有 CFM，这一行就没有）。你看预览时说要不要也去掉。

## 5. 测试，先红后绿

用不对称的假数据，免得碰巧过：

- 假机器实际宽 37"、`webSize` 35，主标题必须是 35"，证明没取整、没拿宽度。
- 目录每台（风机除外）有尺寸，中英文都有主标题，没有英文漏到中文页（CIT367YG 不带 Drop in）。
- 风机主标题不带尺寸。
- 16 行成对的都带外观；**每一对的两行主标题不同**；没有成对的 28 行都不带。
- 没有一台中文主标题含"壁挂式"。
- `webSize` 和实际宽度差超过 1" 的，只有 VCIN36GWS；再来一台就红。先用一台假的让它变红。
- 第 7 节 44 台按整句比对，中英文。
- 导入：空的、`36"x`、风机空着，三种情况各一条。
- `_meta`：不含日期和路径，换一天导入，主文件名不变。
- 手机宽 360：最长的主标题（`24" Refrigerator Column · Panel-Ready`）放得下，型号不截断。

## 6. 步骤（你确认之后）

1. 再核对一次 `showcase_export.csv`：修改时间、SHA-256 是不是第 2 节这份。不是就报给你，用新的那份重新核对。
2. 干跑导入，和目录比：**只许多 `webSize` 和 `_meta` 的变化，其他有变就停，列给你。**
3. 测试先红。
4. 写代码，导入写进 `data/appliances.json`，目录和代码同一次提交。
5. 测试转绿，类型检查。
6. 像素证明：原 45 个、上一轮 11 个、E 一字型那些，3D 画面全部相同；打开选项列表的那几张列为有意要变，做特写，中英文、桌面、手机 390 和 360。
7. 全套测试，开始前告诉你。
8. 起预览，报主文件名，等你看。不提交。

**预计改的文件**：`scripts/csv-to-json.ts` 和它的测试、`src/data/schema.ts`、`src/types.ts`、`data/appliances.json`、`src/data/machineLabel.ts`、`src/ui/ModelCard.tsx`、`src/ui/SwapPanel.tsx`、`src/i18n/en.json`、`zh.json`、`docs/data-sheet-spec.md`，一个新测试文件，文档。

## 7. 全部主标题（按 Leo 的回答）

副标题都是品牌 · 型号。

| 型号 | 英文 | 中文 |
|---|---|---|
| HIS8055U | 30" Induction Range | 30" 电磁炉头 |
| MFGS4030RS | 30" Gas Range | 30" 燃气炉头 |
| PCG366W | 36" Gas Rangetop | 36" 燃气炉灶头 |
| PRG304WH | 30" Gas Range | 30" 燃气炉头 |
| PRG366WH | 36" Gas Range | 36" 燃气炉头 |
| CIT367YG | 36" Induction Cooktop | 36" 电磁炉灶片 |
| AK7136BS-BF | 36" Under-Cabinet Hood | 36" 吊柜式油烟机 |
| AK7300AS | 30" Under-Cabinet Hood | 30" 吊柜式油烟机 |
| HMCB30WS | 30" Chimney Hood | 30" 烟囱式油烟机 |
| HMCB36WS | 36" Chimney Hood | 36" 烟囱式油烟机 |
| HMIB42WS | 42" Island Hood | 42" 岛式油烟机 |
| HMWB361WS | 36" Under-Cabinet Hood | 36" 吊柜式油烟机 |
| PH36HWS | 36" Under-Cabinet Hood | 36" 吊柜式油烟机 |
| VCIN36GWS | 36" Insert Hood | 36" 嵌入式油烟机 |
| JVM3160RFSS | 30" Over-the-Range Microwave | 30" 微波炉油烟机 |
| VTI2FZ | Inline Blower | 管道风机 |
| VTN2FZ | Internal Blower | 内置风机 |
| VTR2FZ | External Blower | 外置风机 |
| ME301YP | 30" Single Oven | 30" 单门烤箱 |
| MEM301WS | 30" Combination Oven | 30" 组合烤箱 |
| PO302W | 30" Double Oven | 30" 双门烤箱 |
| PODS302B | 30" Double Steam Oven | 30" 双门蒸烤箱 |
| MD24BS | 24" Microwave Drawer | 24" 微波抽屉 |
| TCM24PS | 24" Coffee Machine | 24" 咖啡机 |
| SHV78CM3N | 24" Dishwasher | 24" 洗碗机 |
| SHX78CM5N | 24" Dishwasher | 24" 洗碗机 |
| T24IR905SP | 24" Refrigerator Column · Panel-Ready | 24" 冷藏柱 · 可装门板 |
| T24IR905SP-SS | 24" Refrigerator Column · Stainless | 24" 冷藏柱 · 不锈钢 |
| T30IR905SP | 30" Refrigerator Column · Panel-Ready | 30" 冷藏柱 · 可装门板 |
| T30IR905SP-SS | 30" Refrigerator Column · Stainless | 30" 冷藏柱 · 不锈钢 |
| T36BT120NS | 36" Built-In Refrigerator · Stainless | 36" 内嵌式冰箱 · 不锈钢 |
| T36FT820NS | 36" Counter-Depth Refrigerator | 36" 浅深度冰箱 |
| T36IT100NP | 36" Built-In Refrigerator · Panel-Ready | 36" 内嵌式冰箱 · 可装门板 |
| T18IF900SP | 18" Freezer Column · Panel-Ready | 18" 冷冻柱 · 可装门板 |
| T18IF900SP-SS | 18" Freezer Column · Stainless | 18" 冷冻柱 · 不锈钢 |
| T24IF905SP | 24" Freezer Column · Panel-Ready | 24" 冷冻柱 · 可装门板 |
| T24IF905SP-SS | 24" Freezer Column · Stainless | 24" 冷冻柱 · 不锈钢 |
| PRW24C01CG | 24" Wine Cooler | 24" 小酒柜 |
| T18IW100SP | 18" Wine Column · Panel-Ready | 18" 酒柜柱 · 可装门板 |
| T18IW100SP-SS | 18" Wine Column · Stainless | 18" 酒柜柱 · 不锈钢 |
| T18IW905SP | 18" Wine Column · Panel-Ready | 18" 酒柜柱 · 可装门板 |
| T18IW905SP-SS | 18" Wine Column · Stainless | 18" 酒柜柱 · 不锈钢 |
| T24IW905SP | 24" Wine Column · Panel-Ready | 24" 酒柜柱 · 可装门板 |
| T24IW905SP-SS | 24" Wine Column · Stainless | 24" 酒柜柱 · 不锈钢 |

**还是同名、只靠型号分的**（第 10 条：先这样，预览时再看）：

- `24" Dishwasher`：SHV78CM3N、SHX78CM5N
- `30" Gas Range`：MFGS4030RS、PRG304WH
- `36" Under-Cabinet Hood`：HMWB361WS、PH36HWS、AK7136BS-BF
- `18" Wine Column · Panel-Ready`：T18IW905SP、T18IW100SP
- `18" Wine Column · Stainless`：T18IW905SP-SS、T18IW100SP-SS
