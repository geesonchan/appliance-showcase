# 第 99 轮 · 像素对比：每个状态的差别在哪里

旧：`cc251d5` 的代码本地构建（`index-DkvOnxRx.js`）；新：本轮（`index-DnNMT1Gk.js`）。每个版本各拍两次，旧新交替。每个状态取 3D 画面最接近、整个画面也最接近的那一对比较（D17）。

- **3D 画面**：只拍画布，把画面上的文字和按钮全部隐去后比较，变了的像素数。
- **画面**：整张截图里变了的像素数。
- **框外**：落在改了字的元素（及它移动过的引线）之外的像素数。
- 位置是那个元素在截图里的方框：x, y, 宽, 高（像素）。

| 状态 | 3D 画面 | 画面 | 框外 | 改了的元素：旧 → 新 @ 位置 |
|---|---|---|---|---|
| desk-A-fly-dishwasher | 0 | 3078 | 0 | 05 Microwave → 05 Microwave drawer @ 167,685,121,16<br>06 Wine cabinet → 06 Wine cooler @ 251,707,90,16 |
| desk-A-fly-refrigerator | 0 | 2228 | 0 | 05 Microwave → 05 Microwave drawer / 06 Wine cooler @ 1055,251,121,16<br>06 Wine cabinet → 05 Microwave drawer / 06 Wine cooler @ 1055,251,121,16 |
| desk-A-install | 0 | 4613 | 0 | 05 Microwave → 05 Microwave drawer @ 630,168,121,16<br>06 Wine cabinet → 06 Wine cooler @ 709,146,90,16<br>Microwave · anti-tip rear wall of the opening → Microwave drawer · anti-tip rear wall of the opening @ 1230,392,190,33<br>Microwave · power rear wall of the opening → Microwave drawer · power rear wall of the opening @ 1230,720,190,33<br>Wine cabinet · power in the cabinet to the left → Wine cooler · power in the cabinet to the left @ 1230,755,190,33 |
| desk-A-materials | 0 | 3275 | 0 | 05 Microwave → 05 Microwave drawer @ 630,174,121,16<br>06 Wine cabinet → 06 Wine cooler @ 709,152,90,16 |
| desk-A-white | 0 | 3273 | 0 | 05 Microwave → 05 Microwave drawer @ 630,174,121,16<br>06 Wine cabinet → 06 Wine cooler @ 709,152,90,16 |
| desk-B-fly-dishwasher | 0 | 1062 | 0 | 02 Range → 02 Rangetop @ 1098,452,79,16<br>05 Microwave → 05 Combination oven @ 1360,149,120,16<br>06 Wine cabinet → 06 Wine column @ 1547,96,95,16 |
| desk-B-fly-refrigerator | 0 | 2530 | 0 | 02 Range → 02 Rangetop @ 223,607,79,16<br>05 Microwave → 05 Combination oven @ 408,110,120,16<br>06 Wine cabinet → 06 Wine column @ 570,110,95,16 |
| desk-B-install | 0 | 5178 | 0 | 02 Range → 02 Rangetop @ 688,563,79,16<br>05 Microwave → 05 Combination oven @ 788,291,120,16<br>06 Wine cabinet → 06 Wine column @ 888,331,95,16<br>Range · gas at the back of the drawer under the opening → Rangetop · gas at the back of the drawer under the opening @ 1230,542,190,47<br>Range · power in the cabinet to the right → Rangetop · power in the cabinet to the right @ 1230,621,190,33<br>Microwave · power in the base cabinet beside the tower — open its door to see it → Combination oven · power in the base cabinet beside the tower — open its door to see it @ 1230,727,190,47<br>Wine cabinet · power in the cabinet to the left → Wine column · power in the cabinet to the left @ 1230,776,190,33<br>Wine cabinet · service-channel rear wall of the opening → Wine column · service-channel rear wall of the opening @ 1230,811,190,33 |
| desk-B-materials | 0 | 2700 | 0 | 02 Range → 02 Rangetop @ 688,563,79,16<br>05 Microwave → 05 Combination oven @ 788,319,120,16<br>06 Wine cabinet → 06 Wine column @ 888,297,95,16 |
| desk-B-white | 0 | 2696 | 0 | 02 Range → 02 Rangetop @ 688,563,79,16<br>05 Microwave → 05 Combination oven @ 788,319,120,16<br>06 Wine cabinet → 06 Wine column @ 888,297,95,16 |
| desk-C-fly-dishwasher | 0 | 3078 | 0 | 05 Microwave → 05 Microwave drawer @ 167,685,121,16<br>06 Wine cabinet → 06 Wine cooler @ 251,707,90,16 |
| desk-C-fly-refrigerator | 0 | 2764 | 0 | 05 Microwave → 05 Microwave drawer @ 1055,879,121,16<br>06 Wine cabinet → 06 Wine cooler @ 1087,536,90,16 |
| desk-C-install | 0 | 3884 | 0 | 05 Microwave → 05 Microwave drawer @ 630,186,121,16<br>06 Wine cabinet → 06 Wine cooler @ 709,577,90,16<br>Microwave · anti-tip rear wall of the opening → Microwave drawer · anti-tip rear wall of the opening @ 1230,392,190,33<br>Microwave · power rear wall of the opening → Microwave drawer · power rear wall of the opening @ 1230,474,190,33<br>Wine cabinet · power in the cabinet to the left → Wine cooler · power in the cabinet to the left @ 1230,509,190,33 |
| desk-C-materials | 0 | 2563 | 0 | 05 Microwave → 05 Microwave drawer @ 630,186,121,16<br>06 Wine cabinet → 06 Wine cooler @ 709,577,90,16 |
| desk-C-white | 0 | 2563 | 0 | 05 Microwave → 05 Microwave drawer @ 630,186,121,16<br>06 Wine cabinet → 06 Wine cooler @ 709,577,90,16 |
| desk-D-fly-dishwasher | 0 | 6150 | 0 | 03 Wine cabinet → 03 Wine column @ 102,488,95,16<br>04 Range → 04 Rangetop @ 884,382,79,16<br>06 Steam oven → 06 Steam combo oven @ 1016,382,125,16<br>10 Microwave → （没有了） @ 505,431,85,16<br>（原来没有） → 10 Microwave drawer @ 487,310,121,16 |
| desk-D-fly-refrigerator | 0 | 1827 | 0 | 03 Wine cabinet → 03 Wine column @ 751,162,95,16<br>04 Range → 04 Rangetop @ 1595,517,79,16<br>06 Steam oven → 06 Steam combo oven @ 1761,462,125,16<br>10 Microwave → 10 Microwave drawer @ 1055,357,121,16 |
| desk-D-install | 0 | 6244 | 0 | 03 Wine cabinet → 03 Wine column @ 408,197,95,16<br>04 Range → 04 Rangetop @ 908,649,79,16<br>06 Steam oven → 06 Steam combo oven @ 997,397,125,16<br>10 Microwave → 10 Microwave drawer @ 666,653,121,16<br>Microwave · anti-tip rear wall of the opening → Microwave drawer · anti-tip rear wall of the opening @ 1230,392,190,33<br>Range · gas at the back of the drawer under the opening → Rangetop · gas at the back of the drawer under the opening @ 1230,474,190,47<br>Microwave · power rear wall of the opening → Microwave drawer · power rear wall of the opening @ 1230,628,190,33<br>Range · power in the cabinet to the right → Rangetop · power in the cabinet to the right @ 1230,694,190,33<br>Steam oven · power in the base cabinet beside the tower — open its door to see it → Steam combo oven · power in the base cabinet beside the tower — open its door to see it @ 1230,799,190,47 |
| desk-D-materials | 0 | 4069 | 0 | 03 Wine cabinet → 03 Wine column @ 408,225,95,16<br>04 Range → 04 Rangetop @ 908,649,79,16<br>06 Steam oven → 06 Steam combo oven @ 997,425,125,16<br>10 Microwave → 10 Microwave drawer @ 666,361,121,16 |
| desk-D-white | 0 | 4064 | 0 | 03 Wine cabinet → 03 Wine column @ 408,225,95,16<br>04 Range → 04 Rangetop @ 908,649,79,16<br>06 Steam oven → 06 Steam combo oven @ 997,425,125,16<br>10 Microwave → 10 Microwave drawer @ 666,361,121,16 |
| desk-E-fly-dishwasher | 0 | 13095 | 0 | 03 Microwave → 04 Coffee machine @ 414,420,108,16<br>04 Coffee machine → （没有了） @ 414,442,108,16<br>05 Wine cooler → 03 Combination oven @ 326,459,120,16<br>08 Ventilation hood → 05 Wine cooler @ 425,481,90,16<br>（原来没有） → 08 Ventilation hood @ 361,503,110,16 |
| desk-E-fly-refrigerator | 0 | 1398 | 0 | 03 Microwave → 03 Combination oven @ 1057,116,120,16 |
| desk-E-install | 0 | 2121 | 0 | 03 Microwave → 03 Combination oven @ 711,215,120,16<br>Microwave · power in the base cabinet beside the tower — open its door to see it → Combination oven · power in the base cabinet beside the tower — open its door to see it @ 1230,855,190,47 |
| desk-E-materials | 0 | 1299 | 0 | 03 Microwave → 03 Combination oven @ 711,243,120,16 |
| desk-E-white | 0 | 1297 | 0 | 03 Microwave → 03 Combination oven @ 711,243,120,16 |
| link-A | 0 | 1777 | 0 | 02 灶台 → 02 炉头 @ 775,571,53,16<br>05 微波炉 → 05 微波抽屉 @ 586,479,73,16<br>06 酒柜 → 06 小酒柜 @ 545,457,63,16 |
| link-A-noisland | 0 | 170 | 0 | 02 灶台 → 02 炉头 @ 775,571,53,16 |
| link-B | 0 | 1210 | 0 | 02 灶台 → 02 炉头 @ 835,285,53,16<br>05 微波炉 → 05 蒸烤箱 @ 701,262,63,16<br>06 酒柜 → 06 酒柜柱 @ 916,336,63,16 |
| link-B-noisland | 0 | 1210 | 0 | 02 灶台 → 02 炉头 @ 835,285,53,16<br>05 微波炉 → 05 蒸烤箱 @ 701,262,63,16<br>06 酒柜 → 06 酒柜柱 @ 916,336,63,16 |
| link-C | 0 | 1777 | 0 | 02 灶台 → 02 炉头 @ 775,571,53,16<br>05 微波炉 → 05 微波抽屉 @ 586,479,73,16<br>06 酒柜 → 06 小酒柜 @ 545,457,63,16 |
| link-C-noisland | 0 | 170 | 0 | 02 灶台 → 02 炉头 @ 775,571,53,16 |
| link-D | 0 | 2664 | 0 | 03 酒柜 → 03 酒柜柱 @ 412,229,63,16<br>04 灶台 → 04 炉头 @ 856,572,53,16<br>06 蒸烤箱 → 06 双门烤箱 @ 731,247,73,16<br>10 微波炉 → 10 微波抽屉 @ 569,558,73,16 |
| link-D-noisland | 0 | 1769 | 1 | 03 酒柜 → 03 酒柜柱 @ 412,229,63,16<br>04 灶台 → 04 炉头 @ 856,572,53,16<br>06 蒸烤箱 → 06 双门烤箱 @ 731,247,73,16 |
| link-E | 0 | 2463 | 0 | 03 微波炉 → 03 蒸烤箱 @ 755,261,63,16<br>05 酒柜 → 05 小酒柜 @ 815,562,63,16<br>07 电磁灶 → 07 Drop in 炉灶片 @ 546,379,100,16 |
| link-E-noisland | 0 | 1437 | 0 | 03 微波炉 → 03 蒸烤箱 @ 740,243,63,16<br>05 酒柜 → 05 小酒柜 @ 800,563,63,16<br>07 电磁灶 → 07 Drop in 炉灶片 @ 706,641,100,16 |
| phone360-zh-A | 0 | 3285 | 0 | 02 灶台 → 02 炉头 @ 264,403,53,16<br>05 微波炉 → 05 微波抽屉 @ 215,298,73,16<br>06 酒柜 → （没有了） @ 251,545,53,16<br>（原来没有） → 06 小酒柜 @ 246,584,63,16 |
| phone360-zh-B | 0 | 6859 | 0 | 02 灶台 → （没有了） @ 238,373,53,16<br>03 油烟机 → 03 油烟机 @ 236,348,63,16<br>05 微波炉 → 02 炉灶头 @ 233,326,63,16<br>06 酒柜 → 05 组合烤箱 @ 277,304,73,16<br>（原来没有） → 06 酒柜柱 @ 294,282,63,16 |
| phone360-zh-C | 0 | 3137 | 0 | 02 灶台 → 02 炉头 @ 257,334,53,16<br>05 微波炉 → 05 微波抽屉 @ 215,584,73,16<br>06 酒柜 → （没有了） @ 251,545,53,16<br>（原来没有） → 06 小酒柜 @ 246,606,63,16 |
| phone360-zh-D | 0 | 3662 | 0 | 03 酒柜 → 03 酒柜柱 @ 130,334,63,16<br>04 灶台 → 04 炉灶头 @ 294,373,63,16<br>10 微波炉 → （没有了） @ 232,480,63,16<br>（原来没有） → 10 微波抽屉 @ 227,307,73,16 |
| phone360-zh-E | 0 | 5515 | 0 | 03 微波炉 → 03 组合烤箱 / 04 咖啡机 @ 246,343,73,16<br>04 咖啡机 → 03 组合烤箱 @ 246,343,73,16<br>05 酒柜 → 05 小酒柜 @ 275,439,63,16<br>07 电磁灶 → 07 Drop in 炉灶片 @ 226,532,100,16 |
| phone390-A | 0 | 3352 | 1017 | 05 Microwave → 05 Microwave drawer @ 205,595,121,16<br>06 Wine cabinet → 06 Wine cooler @ 250,617,90,16 |
| phone390-B | 0 | 2948 | 0 | 02 Range → 02 Rangetop @ 242,318,79,16<br>05 Microwave → 05 Combination oven @ 266,347,120,16<br>06 Wine cabinet → 06 Wine column @ 291,274,95,16 |
| phone390-C | 0 | 2263 | 0 | 05 Microwave → 05 Microwave drawer @ 205,595,121,16<br>06 Wine cabinet → 06 Wine cooler @ 250,617,90,16 |
| phone390-D | 0 | 6174 | 0 | 03 Wine cabinet → 03 Wine column @ 121,298,95,16<br>04 Range → 04 Rangetop @ 308,368,79,16<br>06 Steam oven → 06 Steam combo oven @ 262,324,125,16<br>10 Microwave → （没有了） @ 237,280,85,16<br>（原来没有） → 10 Microwave drawer @ 219,532,121,16 |
| phone390-E | 0 | 1216 | 0 | 03 Microwave → 03 Combination oven @ 240,336,120,16 |
