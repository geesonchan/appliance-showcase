# 第 99 轮 · 句子的改前改后（交 Leo 审）

> 审完再改、再锁。下面的「改后」是把你定的叫法套进原句，别的字一个不动。「锁定」指这句现在在 `reviewed.json` 里锁着，改了要你重新审定。

你定的规则：
- PRW24C01CG：「酒柜 / 红酒柜」改成「小酒柜」，"wine cabinet" 改成 "wine cooler"；
- MD24BS：「微波炉」改成「微波抽屉」，"microwave" 改成 "microwave drawer"；
- PCG366W：英文 "range" 改成 "rangetop"；
- 说到酒柜柱（T18IW905SP 等高柜）的不改。

## 一、要改的（10 句）

| # | 键 | 锁定 | 语言 | 改前 | 改后 |
|---|---|---|---|---|---|
| 1 | `rule.noIslandFallback`（A、C 无岛台时的清单） | 否 | 中 | 无岛台：微波抽屉在{microwaveLeg}侧灶台旁的地柜内，**酒柜**收在{wineLeg}侧末端 | 无岛台：微波抽屉在{microwaveLeg}侧灶台旁的地柜内，**小酒柜**收在{wineLeg}侧末端 |
|   |   |   | 英 | No island: the microwave drawer is in the base beside the range on the {microwaveLeg} leg, and the **wine cabinet** finishes the {wineLeg} leg | No island: the microwave drawer is in the base beside the range on the {microwaveLeg} leg, and the **wine cooler** finishes the {wineLeg} leg |
| 2 | `rule.noIslandOmitted` | 否 | 中 | 无岛台：已省略**酒柜**与微波抽屉；增设岛台或加长左墙即可纳入。 | 无岛台：已省略**小酒柜**与微波抽屉；增设岛台或加长左墙即可纳入。 |
|   |   |   | 英 | 不变：No island: wine cooler and microwave drawer omitted; … | — |
| 3 | `rule.noIslandOmittedWine` | **是** | 中 | 无岛台：已省略**酒柜**；增设岛台或加长左墙即可纳入。 | 无岛台：已省略**小酒柜**；增设岛台或加长左墙即可纳入。 |
| 4 | `rule.oneWallOmitted`（98b-2） | **是** | 中 | 墙不够长，已省略微波抽屉和**酒柜**。加长后墙即可放回。 | 墙不够长，已省略微波抽屉和**小酒柜**。加长后墙即可放回。 |
| 5 | `rule.oneWallOmittedWine`（98b-2） | **是** | 中 | 墙不够长，已省略**酒柜**。加长后墙即可放回。 | 墙不够长，已省略**小酒柜**。加长后墙即可放回。 |
| 6 | `rule.oneWallSpares`（98b-2） | **是** | 中 | 一字型：**酒柜**和微波抽屉都在台面下，**酒柜**靠冰箱一侧，微波抽屉靠灶台一侧。 | 一字型：**小酒柜**和微波抽屉都在台面下，**小酒柜**靠冰箱一侧，微波抽屉靠灶台一侧。 |
| 7 | `suggestion.island`（墙不够长时的建议） | 否 | 中 | 把岛台加回来（**微波炉和红酒柜**就不占墙了），{param}最小变 {minimumIn}"。 | 把岛台加回来（**微波抽屉和小酒柜**就不占墙了），{param}最小变 {minimumIn}"。 |
|   |   |   | 英 | Put the island back — it takes **the microwave and the wine cabinet** off the wall — and {param}'s minimum becomes {minimumIn}". | Put the island back — it takes **the microwave drawer and the wine cooler** off the wall — and {param}'s minimum becomes {minimumIn}". |
| 8 | `panel.layout.coffeeSill.caption.wine`（E 咖啡机高度滑杆下） | 否 | 中 | 咖啡机底边离地 {sillIn}″，下方为**酒柜** | 咖啡机底边离地 {sillIn}″，下方为**小酒柜** |
| 9 | `rule.coffeeWine`（E 的清单） | 否 | 中 | 咖啡机下方的**酒柜**直接落地、用它自己的踢脚面板，……（**酒柜**手册第 6、13 页）…… | 咖啡机下方的**小酒柜**直接落地、用它自己的踢脚面板，……（**小酒柜**手册第 6、13 页）…… |
| 10 | `rule.rangetopCornerSupports`（PCG366W 的清单） | **是** | 中 | 柜内在 **Rangetop** 开孔的角部下方加 2" × 4" 木方支撑，承托**灶**的重量（142 磅）。 | 柜内在**炉灶头**开孔的角部下方加 2" × 4" 木方支撑，承托**炉灶头**的重量（142 磅）。 |

第 10 句的英文本来就是 "rangetop"。中文这一句是你原来的字（「Rangetop」「灶」），要不要换成「炉灶头」，请你定。不换就保持原样。

第 1、2、7 句英文、中文各改了哪里，表里都标粗了。第 3–6、8、9 句英文本来就是 "wine cooler"，只改中文。

## 二、提到这几类机器、但不改的（请过目）

这些句子说的是「灶 / range」作为任何一种炉具，或者说的是别的机器，不只说 PCG366W、MD24BS、PRW24C01CG。按你的规则不在这轮改的范围里，列出来请你确认：

- **泛指炉具**：
  - `panel.layout.tower.left/right`「灶台左侧 / Left of the range」：烤箱塔在灶的哪一边。B、D 默认是 PCG366W（标注现在叫「炉灶头 / Rangetop」），E 是电磁灶。**这一处和画面标注最容易对不上**，你看要不要改；
  - `rule.d11-4`「D11 规则 4 · 灶台两侧台面 / counter each side of the range」；
  - `refusal.oneLegBoth`「这两样加上灶台 / plus the range」；
  - `rule.towerLanding`（中文「灶台与烤箱塔之间」，英文已是 cooking surface）；
  - `rule.hoodNarrow`「灶具」。
- **炉灶一体机**（A、C 的 range）：`rule.antiTip`「灶推入到位前…… / behind the range」，说的是落地的炉灶一体机，不是 Rangetop。还有 `scheme.01.concept`「一台专业燃气灶台 / a professional gas range」，A 的方案介绍。
- **E 的电磁灶**（标签已改叫「Drop in 炉灶片 / Cooktop」）：`shape.note.one-wall.E`（98b-2 锁定）「电磁灶改到墙上 / the induction cooktop」、`refusal.cooktopIsland`、`refusal.cooktopLanding` 里的「电磁灶」。
- **组合烤箱的微波把手**（B、E、D 一字型的 MEM301WS，不是 MD24BS）：`panel.layout.microwaveHandle`「微波把手高度」、`rule.microwaveReach`「微波把手」。
- **酒柜柱**（照你说的不改）：`shape.note.one-wall.D`「酒柜柱」。
