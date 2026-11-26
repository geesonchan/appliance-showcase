*Note, 2026-11-25: paths under `scratchpad` and `C:\Users\…\Temp\…` in this plan are this machine's scratch folder, not files in the repository; what was kept of them is local, under this folder's `raw/` (not committed).*

# 12e-3 正式计划，2026-11-24

- 只是计划。主文件夹里仓库的文件没改，没提交，没删东西。
- 原型副本和改前副本都留着（第七节）。

## 一、你定的（原话，照此登记）

2026-11-23：
1. 「英寸号统一用 ″，不用 "。」
2. 「尺寸用分数，不用小数。」
3. 「整数和分数之间用连字符，写成 3-1/2″。」

2026-11-24（对第一稿第三节）：
1. 「分数约到最简，最细到 1/16。不到 1 英寸的不写 0，写成 3/4″。」
2. 「5-29/32″ 照说明书原样留。」守护测试给这一句开一个窄的豁免，按键名，写原因。
   - 咖啡机每侧填板 27/32 怎么进位：**还没定**（第八节）。
3. 「一句里每个数都带 ″；大小用 ×，范围用 –；x 统一成 ×。」
   - 尺寸线旁的小字加不加 ″：**还没定**，要看图（第九节）。
4. 「英尺：英文用 ′，中文保留"英尺"两个字。」
5. 「燃气管径在显示的时候换成 ″，数据和类型不动。」经过同一个出字的地方，不另写一套。
6. 「中英文数字的写法完全一样。」
7. 「测试的期望值跟着改，测试标题不改。」
8. 「新找到的 6 行放进这一轮。」
9. 「D25 放在 D24 后面，可以。」
10. 「2026-11-13 那条"数字用分数（224¼″）"由新规矩取代，换套餐提示写成 224-1/4″。旧条目不改，旁边加注明。」

## 二、范围

照 decisions.md 第 13639–13650 行登记的，加上你第 8 条放进来的 6 行：
- 词典：en.json、zh.json；reviewed.json 里要改的 34 句（第六节，等你重读）。
- 三个格式函数：
  - `formatDimension`（dimensions.ts:334）
  - `formatInches`（fit.ts:213）
  - `inchesSpoken`（inches.ts:10）
- 两处写死：`feetInches`（LeftPanel.tsx:17）、瓷砖尺寸（finishes.ts:114–116）。
- roughIn.ts 的 `inch`（第 667 行）。
- 滑杆默认格式（primitives.tsx:81）。
- 代码里直接写英寸号的 77 行（第一稿第二节怎么数的），加上新找到的 6 行：
  - LayoutControls.tsx:89、RefusalNote.tsx:38 的 `&quot;`；
  - rules.ts:301、useChecklist.ts:430、448、LayoutControls.tsx:396 的"先写再去掉"。
- 燃气管径：只在显示时换（第 5 条），数据（slots.json:74、packages.json:95、308、rules.json:114）和类型（schema.ts:285、515，rules.ts:108、109、128）不动。

## 三、出字的地方怎么写：`src/data/inchText.ts`

- `inchFigure(n)`：只出数。约到最简，最细 1/16。
  - 不到 1 英寸不写 0：`3/4`。
  - 整数和分数之间用连字符：`3-1/2`。
- `inches(n)`：数加 ″：`3-1/2″`。
- `inchText(s)`：数据里写成文字、带直号的尺寸（燃气管径 `3/4"`），显示成 `3/4″`。
- 词典里占位符后面紧跟 ″、传进来的是数的，由它出数。
  - 一个地方管所有句子：`src/i18n/index.ts` 的 `translate` 和中文那一支都问它。
- 三个格式函数和 roughIn 的 `inch` 留名字，里面只调它（调用的 40 处左右不动）。
- 进位（27/32 那一个）：**等你定，动手到这里先停**（第八节）。

## 四、不上页面的 61 行：逐类写明改不改，和豁免名单对上

1. **layoutRules.ts 50 行**（布局检查的英文提示，只有测试调用）→ **改**，改成调 `inches()`。不开豁免。
   - 原因：守护测试照"src 里除了 inchText 一律不许"写，最简单，不用按文件开口子。
   - 这些提示有没有测试按原字比，动手时实跑列出。
2. **hood.ts 445、446**（`outsideItsManual`，只有测试调用）→ **改**。不开豁免。
3. **hood.ts 218、374、410、417、424、431**（说明书原话的出处：`basis`、`read`、`GAS_AND_INDUCTION`）→ **不改**。**开豁免**，按常量名和属性名列：
   - hood.ts 的 `GAS_AND_INDUCTION`
   - `HOOD_MANUALS` 各条的 `read`
   - 第 218 行所在条目的 `basis`
   - 原因：引的是说明书原字，不上页面。
4. **ovenTower.ts 69**（开发用的报错）→ **改**。不开豁免。
5. **layoutTemplate.ts 2775**（规则说明文字 `U_SPARE_BEFORE_OVEN_TOWER.rule`）→ **改**。不开豁免。
6. **shareLink.ts 246**（链接字段说明文字）→ **改**。不开豁免。

合计：改 55 行（50+2+1+1+1），不改 6 行。

另外不是这 61 行、但守护测试要认的：
- 名字两边的引号 7 行（`"${id}"`，catalogue.ts 298、302，layoutShape.ts 141、171、198，packages.ts 199、200）。
  - 不是英寸号，不改。
  - 守护测试按"同一段里一对引号包住一个占位符"认作引号，不按文件开口子。
- 燃气管径的类型定义 5 行（schema.ts 285、515，rules.ts 108、109、128）。
  - 你第 5 条说类型不动，**开豁免**，按行内容 `'1/2"'`、`'3/4"'` 认，写原因。

**豁免名单（守护测试里逐条写原因）**
- 代码：
  - 说明书原话的 3 个名字（`GAS_AND_INDUCTION`、`read`、第 218 行的 `basis`）
  - 燃气管径的两个类型值
- 词典：
  - `refusal.notALength`、`refusal.notAChoice`：`"{raw}"` 是引号
  - `rule.coffeeDrainOptional`：5-29/32″ 照说明书原样留，你 2026-11-24 的话
- 除此以外一律不许。

## 五、守护测试

**守护一：代码**（`src/data/inchMarks.test.ts`，照 sceneFrame.test.ts 守 useFrame 的写法）
- 用 TypeScript 解析器读 src/ 下全部非测试文件。
- inchText.ts 以外，出现下面任何一种就红：
  - 字符串、模板、JSX 文字里，数字或 `${}` 后面紧跟 `"`、`″`、`′`；
  - JSX 里 `&quot;`、`&Prime;`、`&#8243;` 跟在数字或表达式后面；
  - 正则里写了 `"` 或 `″`（`.replace(/"$/` 这种）；
  - 另写一个按 16 进位的分数函数（`* 16` 或 `/ 16` 和 `Math.round` 在一起），先查误报再定。
- 豁免照第四节，一条一个名字，一条一个原因。
- 故意改坏，每样一次，在另拉的副本里，记下红的输出：
  - hood.ts 加一句 `` `${n}"` ``
  - JSX 加 `{w}&quot;`
  - 加 `.replace(/″$/, "")`
  - 在 inchText.ts 以外复制一份分数函数
  - 把豁免名单里的一个名字改掉
  - 在 layoutRules.ts 改回一句 `"`

**守护二：词典**（`src/i18n/inchDictionary.test.ts`）
- en、zh 每句：
  - 英寸号只能是 ″，只能跟在数字或占位符后面；
  - 不许 ¾ 这种字；
  - 不许 ″ 前面是小数；
  - 分数最细 1/16；
  - 大小之间不许 x；
  - 范围两头都带 ″；
  - 英文的英尺号只能是 ′。
- 同一个键的中英文，数字的写法要一样：抽出全部"数+号"逐个比。
- 豁免：第四节词典那 3 个键。
- 故意改坏，各红一次：
  - 加 `5"`
  - 加 `4¾″`
  - 加 `11.9″`
  - 加 `1/32″`
  - 加 `3″ x 4″`
  - 加 `10–12″`
  - 把一句中文写成和英文不一样

**守护三：页面**
- 像素证明拍 45 个状态时记下的字，和三个 dump 的 words：
  - 不许数字后面的 `"`；
  - 不许 ″ 前面是小数；
  - 不许 `″″`；
  - 不许 `0-` 开头的分数。
- 故意改坏：用词典改回去一句的构建拍一次，要红。

**守护四：出字函数的表**（`src/data/inchText.test.ts`）
- 不对称的样本：0.84375、0.8125、0.75、0.0625、11.875、35.97、3.5、29.6875、负数。
- 每个对一个写法。

## 六、34 句已审句子，新旧两版（等你重读）

- 新版是原型词典里的字，照你的规矩改的。
- 你认了才写进 reviewed.json。
- 你没认的句子，这一轮不改。

已审句子，新旧两版（reviewed.json 原文 / 原型词典），共 34 句：英文 22、中文 12

1. 英文 `rule.coffeeHigh`（reviewed.json 第 275 行，approval "written"）
   - 旧：The manual advises against mounting it much higher than about 37-7/16", so the water tank and brewing unit can be taken out easily.
   - 新：The manual advises against mounting it much higher than about 37-7/16″, so the water tank and brewing unit can be taken out easily.
2. 英文 `rule.hoodNarrow`（reviewed.json 第 280 行，approval "written"）
   - 旧：{hood}" hood over a {cooking}" cooking surface. A hood is normally at least as wide as the cooking surface under it — please confirm before ordering.
   - 新：{hood}″ hood over a {cooking}″ cooking surface. A hood is normally at least as wide as the cooking surface under it — please confirm before ordering.
3. 英文 `rule.fillerNeeded`（reviewed.json 第 310 行，approval "read"）
   - 旧：Needs {filler}" of filler each side
   - 新：Needs {filler}″ of filler each side
4. 英文 `rule.fridgeDoorClearance`（reviewed.json 第 315 行，approval "written"）
   - 旧：A full-height {gapIn}" filler between the refrigerator and the wall, so its door opens 90°. Optional door stop (part no. {doorStop}).
   - 新：A full-height {gapIn}″ filler between the refrigerator and the wall, so its door opens 90°. Optional door stop (part no. {doorStop}).
5. 英文 `rule.rangetopCornerSupports`（reviewed.json 第 325 行，approval "written"）
   - 旧：2" x 4" corner supports in the cabinet under the rangetop, under the corners of its cutout, to carry it (142 lb).
   - 新：2″ × 4″ corner supports in the cabinet under the rangetop, under the corners of its cutout, to carry it (142 lb).
6. 英文 `rule.ductSizeOtr`（reviewed.json 第 470 行，approval "read"）
   - 旧：{cfm} CFM; the duct is 3-1/4" x 10" rectangular, or 6" round with a transition (GE installation instructions)
   - 新：{cfm} CFM; the duct is 3-1/4″ × 10″ rectangular, or 6″ round with a transition (GE installation instructions)
7. 英文 `shape.note.one-wall.D`（reviewed.json 第 495 行，approval "written"）
   - 旧：Single wall: coffee machine, second dishwasher and microwave drawer omitted; the oven is a combination oven with microwave; freezer, refrigerator and wine columns are the 18" / 24" / 18" models.
   - 新：Single wall: coffee machine, second dishwasher and microwave drawer omitted; the oven is a combination oven with microwave; freezer, refrigerator and wine columns are the 18″ / 24″ / 18″ models.
8. 英文 `shape.note.one-wall.E`（reviewed.json 第 500 行，approval "written"）
   - 旧：Single wall: no island; the induction cooktop moves to the wall, with the 36" chimney wall hood HMCB36WS.
   - 新：Single wall: no island; the induction cooktop moves to the wall, with the 36″ chimney wall hood HMCB36WS.
9. 英文 `suggestion.island`（reviewed.json 第 710 行，approval "written"）
   - 旧：Put the island back — it takes the microwave drawer and the wine cooler off the wall — and {param}'s minimum becomes {minimumIn}".
   - 新：Put the island back — it takes the microwave drawer and the wine cooler off the wall — and {param}'s minimum becomes {minimumIn}″.
10. 英文 `panel.layout.coffeeSill.caption.wine`（reviewed.json 第 715 行，approval "written"）
   - 旧：Machine starts {sillIn}" off the floor; wine cooler under it
   - 新：Machine starts {sillIn}″ off the floor; wine cooler under it
11. 英文 `rule.coffeeWine`（reviewed.json 第 720 行，approval "written"）
   - 旧：Wine cooler under the coffee machine: it stands on the floor on its own kick panel, and the vent in its base must never be covered, so there is no cabinet toe kick in front of it (its manual, pp. 6 and 13); at least 1" behind it for the plug (p. 14)
   - 新：Wine cooler under the coffee machine: it stands on the floor on its own kick panel, and the vent in its base must never be covered, so there is no cabinet toe kick in front of it (its manual, pp. 6 and 13); at least 1″ behind it for the plug (p. 14)
12. 英文 `refusal.oneLegBoth`（reviewed.json 第 740 行，approval "written"）
   - 旧：The {leg} leg cannot take both the sink and the refrigerator: a leg stops at {maxIn}", and those two plus the cooking surface need more than that.
   - 新：The {leg} leg cannot take both the sink and the refrigerator: a leg stops at {maxIn}″, and those two plus the cooking surface need more than that.
13. 英文 `panel.room.narrowCounter`（reviewed.json 第 815 行，approval "written"）
   - 旧：Only 6" of counter left here — not practical.
   - 新：Only 6″ of counter left here — not practical.
14. 英文 `shape.note.U.E`（reviewed.json 第 865 行，approval "read"）
   - 旧：U-shaped: no island; the induction cooktop moves to the right leg's wall, with the 36" chimney wall hood HMCB36WS.
   - 新：U-shaped: no island; the induction cooktop moves to the right leg's wall, with the 36″ chimney wall hood HMCB36WS.
15. 英文 `panel.layout.steamSill.caption`（reviewed.json 第 910 行，approval "read"）
   - 旧：Opening starts {sillIn}" off the floor; lower handle at {lowIn}"
   - 新：Opening starts {sillIn}″ off the floor; lower handle at {lowIn}″
16. 英文 `panel.layout.steamSill.caption.single`（reviewed.json 第 915 行，approval "read"）
   - 旧：Opening starts {sillIn}" off the floor
   - 新：Opening starts {sillIn}″ off the floor
17. 英文 `rule.ovenSill.panel`（reviewed.json 第 920 行，approval "read"）
   - 旧：Oven opening starts {sillIn}" off the floor (the sheet allows {lowIn}"–{highIn}", from the floor); under it a fixed panel, {boxIn}" tall
   - 新：Oven opening starts {sillIn}″ off the floor (the sheet allows {lowIn}″–{highIn}″, from the floor); under it a fixed panel, {boxIn}″ tall
18. 英文 `rule.ovenSill.drawer`（reviewed.json 第 925 行，approval "read"）
   - 旧：Oven opening starts {sillIn}" off the floor (the sheet allows {lowIn}"–{highIn}", from the floor); under it one drawer, {boxIn}" tall
   - 新：Oven opening starts {sillIn}″ off the floor (the sheet allows {lowIn}″–{highIn}″, from the floor); under it one drawer, {boxIn}″ tall
19. 英文 `rule.ovenSill.drawers`（reviewed.json 第 930 行，approval "read"）
   - 旧：Oven opening starts {sillIn}" off the floor (the sheet allows {lowIn}"–{highIn}", from the floor); under it two drawers, {boxIn}" each
   - 新：Oven opening starts {sillIn}″ off the floor (the sheet allows {lowIn}″–{highIn}″, from the floor); under it two drawers, {boxIn}″ each
20. 英文 `rule.steamOven.handle`（reviewed.json 第 935 行，approval "read"）
   - 旧：Steam oven lower door handle at {handleIn}"; 240V {amps}A dedicated circuit
   - 新：Steam oven lower door handle at {handleIn}″; 240V {amps}A dedicated circuit
21. 英文 `rule.doubleOven.handle`（reviewed.json 第 940 行，approval "read"）
   - 旧：Oven lower door handle at {handleIn}"; 240V {amps}A dedicated circuit
   - 新：Oven lower door handle at {handleIn}″; 240V {amps}A dedicated circuit
22. 英文 `rule.ovenSillHeld`（reviewed.json 第 945 行，approval "read"）
   - 旧：The oven opening starts {sillIn}" off the floor, not the {askedIn}" asked for: the {model} sheet allows only {lowIn}"–{highIn}"
   - 新：The oven opening starts {sillIn}″ off the floor, not the {askedIn}″ asked for: the {model} sheet allows only {lowIn}″–{highIn}″
23. 中文 `rule.coffeeHigh`（reviewed.json 第 1237 行，approval "written"）
   - 旧：手册建议安装高度不宜明显高于约 37-7/16"，以便取出水箱和冲泡单元。
   - 新：手册建议安装高度不宜明显高于约 37-7/16″，以便取出水箱和冲泡单元。
24. 中文 `rule.hoodNarrow`（reviewed.json 第 1242 行，approval "written"）
   - 旧：油烟机宽 {hood}"，灶具宽 {cooking}"。油烟机宽度一般应大于或等于灶具宽度，下单前请确认。
   - 新：油烟机宽 {hood}″，灶具宽 {cooking}″。油烟机宽度一般应大于或等于灶具宽度，下单前请确认。
25. 中文 `rule.fillerNeeded`（reviewed.json 第 1277 行，approval "written"）
   - 旧：两侧各需 {filler}" 挡板
   - 新：两侧各需 {filler}″ 挡板
26. 中文 `rule.fridgeDoorClearance`（reviewed.json 第 1282 行，approval "written"）
   - 旧：冰箱与墙之间需 {gapIn}" 整高挡板，冰箱门才能开到 90°。门挡（配件号 {doorStop}）为选配。
   - 新：冰箱与墙之间需 {gapIn}″ 整高挡板，冰箱门才能开到 90°。门挡（配件号 {doorStop}）为选配。
27. 中文 `rule.rangetopCornerSupports`（reviewed.json 第 1292 行，approval "written"）
   - 旧：柜内在炉灶头开孔的角部下方加 2" × 4" 木方支撑，承托炉灶头的重量（142 磅）。
   - 新：柜内在炉灶头开孔的角部下方加 2″ × 4″ 木方支撑，承托炉灶头的重量（142 磅）。
28. 中文 `rule.ductSizeOtr`（reviewed.json 第 1437 行，approval "read"）
   - 旧：{cfm} CFM；风管用 3-1/4" x 10" 长方形，或经转接用 6" 圆管（GE 安装说明）
   - 新：{cfm} CFM；风管用 3-1/4″ × 10″ 长方形，或经转接用 6″ 圆管（GE 安装说明）
29. 中文 `shape.note.one-wall.D`（reviewed.json 第 1462 行，approval "written"）
   - 旧：一字型：已省略咖啡机、第二台洗碗机和微波抽屉；烤箱为带微波的组合烤箱；冷冻柱、冷藏柱、酒柜柱为 18" / 24" / 18" 款。
   - 新：一字型：已省略咖啡机、第二台洗碗机和微波抽屉；烤箱为带微波的组合烤箱；冷冻柱、冷藏柱、酒柜柱为 18″ / 24″ / 18″ 款。
30. 中文 `shape.note.one-wall.E`（reviewed.json 第 1467 行，approval "written"）
   - 旧：一字型：不配岛台；电磁灶改到墙上，油烟机为 36" 墙挂烟囱式 HMCB36WS。
   - 新：一字型：不配岛台；电磁灶改到墙上，油烟机为 36″ 墙挂烟囱式 HMCB36WS。
31. 中文 `suggestion.island`（reviewed.json 第 1677 行，approval "written"）
   - 旧：把岛台加回来（微波抽屉和小酒柜就不占墙了），{param}最小变 {minimumIn}"。
   - 新：把岛台加回来（微波抽屉和小酒柜就不占墙了），{param}最小变 {minimumIn}″。
32. 中文 `refusal.oneLegBoth`（reviewed.json 第 1707 行，approval "written"）
   - 旧：{leg}段放不下水槽和冰箱：单段上限 {maxIn}"，这两样加上灶台已经超了。
   - 新：{leg}段放不下水槽和冰箱：单段上限 {maxIn}″，这两样加上灶台已经超了。
33. 中文 `panel.room.narrowCounter`（reviewed.json 第 1782 行，approval "written"）
   - 旧：台面只剩 6"，实际不建议
   - 新：台面只剩 6″，实际不建议
34. 中文 `shape.note.U.E`（reviewed.json 第 1832 行，approval "read"）
   - 旧：U 型：不配岛台；电磁灶改到右段墙上，油烟机为 36" 墙挂烟囱式 HMCB36WS。
   - 新：U 型：不配岛台；电磁灶改到右段墙上，油烟机为 36″ 墙挂烟囱式 HMCB36WS。

## 七、原型和预览

- 原型副本：`C:\Users\leoch\AppData\Local\Temp\claude\2d05e9ef00c4ba20\a893b756-812e-493a-8c91-ab24b4a5973e\scratchpad\r16\wt-proto`
- 改前副本：`C:\Users\leoch\AppData\Local\Temp\claude\2d05e9ef00c4ba20\a893b756-812e-493a-8c91-ab24b4a5973e\scratchpad\r16\wt-old`
- 原型预览：http://localhost:4310/ ，主文件 **`index-B0rM-a5K.js`**
- 改前预览：http://localhost:4311/ ，主文件 **`index-B3fBdUA5.js`**（e601271 原样，不带计数器地址）
- 2026-11-24 11:03:35 用 curl 核对过，两边都是这两个名字。
- 原型地址可以加：
  - `?p12e3note=1`：尺寸线旁的小字加 ″
  - `?p12e3filler=up|down|exact`：27/32 往上 / 往下 / 不进位
- 原型这一版已经照你的答案改了：
  - 不到 1 英寸写 3/4″
  - x → ×
  - 范围两头都带 ″
  - 英文英尺 ′
  - 燃气管径显示成 3/4″
- 原型核对：
  - 三个 dump 在原型上照常跑完（11:03:12–11:03:21，exit 0），没有 `″″`、没有 `0-`、没有小数、没有直号 `"`。
  - 清单文字里还剩的只有 5-29/32（照原样留）和英文的英尺 ′。

## 八、咖啡机每侧填板 27/32：三种样子（等你定，动手到这里先停）

- 只在 D、E 的咖啡机位、配 TCM24PS 时出现。
- 宽差 1-11/16 除以 2，来源 fit.ts:107。
- 出现在三处，写法一样：
  - 清单「Needs … of filler each side」
  - 卡片机型列表「… filler each side」
  - 规格卡
- 改前：`Needs 0.8" of filler each side`
- 往上到 1/16：`Needs 7/8″ of filler each side`
- 往下到 1/16：`Needs 13/16″ of filler each side`
- 不进位：`Needs 27/32″ of filler each side`（要在 1/16 的规矩里给它开口子）
- 截图见回复里的图（D 套餐清单，1440，放大 2 倍）。

## 九、尺寸线旁的小字加不加 ″（等你看图定）

- 涉及 4 个键：
  - `dimension.clearanceRangeCooktop`
  - `dimension.clearanceRangeRecommended`
  - `dimension.clearanceMinIsland`
  - `dimension.standard`
- 不加：`min 30, recommended max 40`、`standard 18`；中文「最小 30，建议最大 40」「标准 18」。
- 加：`min 30″, recommended max 40″`、`standard 18″`；中文「最小 30″，建议最大 40″」「标准 18″」。
- 截图：三档宽度各一组，中英文，放大 3 倍。

## 十、新的一个问题（等你定）：左侧面板的房间大小，中文页面怎么写

- `feetInches`（LeftPanel.tsx:21）在中文页面也写 `16′10″`。标题是「房间（英尺）」。
- 你第 4 条说"中文保留'英尺'两个字"。
- 这里是标题里写"英尺"、数字用 ′″。照不照旧？还是中文写成「16 英尺 10 英寸」？
- 原型照旧，没改。

## 十一、做法和顺序

1. 开工先核对：主文件夹干净、在 e601271，两个副本在。
2. **先红**：新测试（守护一到四）先写，在 e601271 的干净副本上跑，记下红的条数。
3. `inchText.ts` 和它的表。27/32 的进位按你的答案；没答就停在这一步。
4. 三个格式函数、roughIn 的 `inch`、滑杆、两处写死、新找到的 6 行。
5. 不上页面的 55 行（第四节）。
6. 词典 en、zh；reviewed.json 只写你认了的。
7. i18n 的 `translate` 和中文那一支问出字的地方；燃气管径显示。
8. 旧测试的期望值跟着改，标题不改（第十二节的清单），每条旁边写原因和你的哪一条。
9. 守护测试的故意改坏，逐样做，记下红。
10. 单元测试全绿；这一轮动到的浏览器测试先单独跑。
11. 全套测试（第十五节）。
12. 像素证明（第十三节）、dump、起预览给你看，报主文件名。
13. 你看过再提交。提交前文档改动（第十四节）一起做。

## 十二、要改的旧测试

原型上实跑单元测试：11:13:10–11:13:54，exit 1，4,660 条里红 276 条，22 个文件。原因全是期望值写的是 `"`、小数或 ¾。

- alternativeTitle.test.ts 47 条：卡片标题 `30" Induction Range`
- roughInSides.test.ts 46 条：测试自己的解析函数只认 `"`
- underOven12d.test.ts 36 条：烤箱塔清单句子
- reviewed.test.ts 34 条：已审句子（第六节）
- packageSwitchNotice.test.ts 32 条：换套餐提示 `224¼″` 等（你第 10 条）
- towerHeight12e.test.ts 23 条
- steamSill.test.ts 18 条
- eLCornerSocket.test.ts 16 条
- roughInEnglish.test.ts 5 条
- uInterface.test.ts 5 条
- inductionRangetop.test.ts 2 条
- autoGrow.test.ts 2 条
- 各 1 条：coffeeTower、dimensions、ductThroughCeiling、fit、hood、rules（这两条查的是 `8.8125`）、overRange、roughIn、oneWallSwitch、rule12Floor
- 浏览器测试：`"` 在 tests/ 的 35 个文件、`″` 在 4 个文件；动手后实跑，逐条列。

## 十三、像素证明：哪些必须一样，哪些有意要变

**必须一样**
- 45 个状态的 3D 画布、30 个默认房间的画布：逐像素相同。
- 不带英寸数的字：内容和位置相同。
- 三个 dump 的几何部分：逐字节相同。

**有意要变**
- 带英寸数的字：`"` → ″，小数 → 分数，`0-3/4` → `3/4`，x → ×，¾ → -3/4。
- 这些字变宽变窄，可能挪动同一行后面的字和标签引线，逐处列出原因。

**dump 的字**
- 用脚本把旧字按新规矩换一遍，要和新字逐字相同；对不上的逐条列。

## 十四、文档改动（随 12e-3 一起提交）

**A. 上一轮定稿的六段**（原样，和第一稿第十一节逐字相同）：

1. 12e-2 "Shipped" 下面的补记：

> - **The release commit's own release: `e601271`** (docs only; checked as the next round's first step, 2026-11-23; Leo, 2026-11-22: 「写一条待办：这一次收尾提交自己的部署和 20 个文件对比，由下一轮开工第一步核对后补记。」). Before the push, CI's three commands in a fresh worktree of `e601271`, 2026-11-22: `npm ci` 17:41:14-17:41:20, `npm run test:unit` 17:41:20-17:42:03 (153 files, 4,660 passed), `npm run build` 17:42:03-17:42:18, each exit 0; pushed (`5ead543..e601271`). Pages run 45096072380: build 17:42:31-17:43:56 and deploy 17:44:01-17:44:11 (local time, GitHub's record), each a success. The counter build of `e601271` made 2026-11-22, `index-fb5XsbHP.js` (740,451 bytes), compared 2026-11-23 with the twenty files fetched from the live site that day: **twenty of twenty the same byte for byte**. Against `5ead543`'s build only the main chunk and `index.html` differ (compared 2026-11-23, the output kept local; first seen 2026-11-22, that output not kept).

2. "Where the order stands" 那条待办旁边：

> *Done 2026-11-23: see 12e-2's "Shipped".*

3. 第 12141 行旁边：

> *Note, 2026-11-23: a read-only list of every current on the page was made 2026-11-20 (at `769657a`; four places checked by CC, the rest as a read-only helper reported them) and sent to Leo with 12e-2's fourth draft. Kept local, not in the repository (`docs/plans/item12f-2026-11-20/raw/`, two files). It is not the plan item 12f asks for: no manual read page by page, no largest breaker, no wordings.*

4. 12f 条目末尾：

> *Note, 2026-11-23: the list of 2026-11-20 has twenty opening currents with no source found; they wait for Leo one by one (the list's 「请逐条认」), none to be inferred from another.*

5. HANDOFF 第 6 节两处改 2 h 15，以及 decisions.md 第 11393 行之后的注明：
   - HANDOFF 第 793–795 行：

> - **The full suite** (`npm test`; how long it takes, and the 2 h 15 a run is planned as, are in decisions.md, Open items, "The full suite takes 1 h 45 to 1 h 56" and the note beside it of 2026-11-22):

   - HANDOFF 第 800–801 行：

> - **Plan it as 2 h 15** (Leo, 2026-11-22: 「以后按 2 小时 15 分排」; the last four runs, 1 h 45 to 2 h 01: decisions.md, the entry above). Before it: …（后面不变）

   - decisions.md 第 11393 行之后：

> *Note, with item 12e-3 (Leo, 2026-11-23: 「HANDOFF 第 6 节两处改 2 h 15，全部放进 12e-3 那一轮的文档改动里，随 12e-3 一起提交」): HANDOFF section 6 now says "Plan it as 2 h 15"; "still says 'Plan it as 2 hours'" above is kept as it was.*

6. HANDOFF 第 6 节新的日志规矩，放在第 684–686 行那段之后：

> **Written to a file as it happens** (Leo, 2026-11-23: 「每一步的起止时间和真实 exit code 当场写进这一轮文件夹里的日志文件，不只打印在对话里；写进文档的数必须指得出存下来的文件。」; 2026-11-23: 「收尾前，这些日志要进这一轮在 docs/plans 下面的本地 raw 文件夹，临时文件夹里的不算留下了。」): each step's start, end and real exit code go into a log file the moment the step ends, not only into the conversation; before the round closes the logs are in the round's local `raw/` folder under `docs/plans/` — a copy only in the scratch folder is not kept; a figure written into the documents names the saved file it comes from, and a figure with no saved file is not written.

**B. 12e-3 自己的**
- decisions.md 新增 **D25**，放在 D24 后面（草稿原文在下面）。
- 12e-3 条目旁加注明，不改原文：
  - "75 lines" 重数是 77 行；
  - layoutRules.ts 不上页面；
  - 词典的 131、69 里各有 2 个引号；
  - 新找到的 6 行放进了这一轮（你第 8 条）。
- 第 12313 行（「数字用分数（224¼″）」）旁边加注明：由 D25 取代，换套餐提示写成 224-1/4″（你第 10 条）。
- D18 里写 `178⅞″` 的地方（第 3522、3952 行）旁边加注明：由 D25 取代。
- HANDOFF 决定表第 467 行后加一行 D25。
- 计划和截图压缩放进 `docs/plans/item12e3-2026-11-23/`，图 ≤ 2 MB，原图留在本地 raw。

**D25 草稿原文**（等你看）：

> ## D25 · An inch figure is written in one place
>
> *(Leo, 2026-11-23 and 2026-11-24; item 12e-3.)* Every inch figure on the page is written by `src/data/inchText.ts`, and by nothing else; `src/data/inchMarks.test.ts` fails on one written anywhere else, and `src/i18n/inchDictionary.test.ts` on a dictionary line that writes one otherwise. His rules, word for word:
> - 「英寸号统一用 ″，不用 "。」
> - 「尺寸用分数，不用小数。」「分数约到最简，最细到 1/16。不到 1 英寸的不写 0，写成 3/4″。」
> - 「整数和分数之间用连字符，写成 3-1/2″。」
> - 「一句里每个数都带 ″；大小用 ×，范围用 –；x 统一成 ×。」
> - 「英尺：英文用 ′，中文保留"英尺"两个字。」
> - 「中英文数字的写法完全一样。」
> - 「燃气管径在显示的时候换成 ″，数据和类型不动。」
> - One line kept as its manual prints it: 「5-29/32″ 照说明书原样留。」 (`rule.coffeeDrainOptional`, TCM24PS's installation manual, p. 10).
>
> （27/32 怎么进位、尺寸线旁的小字加不加 ″：等你定了补进来。）

## 十五、日志、全套测试

**日志**
- 每一步的起止时间和真实 exit code 当场写进 `scratchpad\r18\steps.log`。
- 收尾前复制进 `docs/plans/item12e3-2026-11-23/raw/`。
- 写进文档的数指得出存下来的文件。

**全套测试**：按 2 小时 15 分排，放在第十一节第 11 步。开跑前：
- 停掉 4310、4311 和别的演示服务器，查没有剩下的 node.exe、esbuild.exe（不是本项目的不碰）；
- 列出开着的程序，告诉你预计几点结束；
- 记下 src/、tests/、scripts/、data/ 的校验值，跑完再核一次；
- 屏幕关闭和睡眠设成"从不"；
- 中途有待机或被关机打断的不算，整套重跑。

## 十六、计划外发现（照旧只登记，不并进来）

1. roughIn.ts 的 `inch` 少 16/16 进位那一种，会写成 `35-1/1"`。今天的数据碰不到。并到一个出字的地方以后自然没了。
2. ⅛、⅜、⅝、⅞ 两套网站字体里都没有，落到系统字体。照新规矩不再出现。
3. 清单英文 `needs a 8…` 应为 `an 8`，和英寸号无关。
4. 卡片、报价页"比开口高 / 深"今天把 3/4 写成 `0.8"`、1/8 写成 `0.1"`。改成分数后自然准了，已在范围里。

## 十七、等你定的

- 第八节：27/32 往上（7/8″）、往下（13/16″）还是不进位（27/32″）。
- 第九节：尺寸线旁的小字加不加 ″。
- 第十节：中文页面左侧面板的房间大小怎么写。
- 第六节：34 句已审句子逐句认。
- 第十四节：D25 草稿原文。
