*Note, 2026-11-25: paths under `scratchpad` and `C:\Users\…\Temp\…` in this plan are this machine's scratch folder, not files in the repository; what was kept of them is local, under this folder's `raw/` (not committed).*

# 12e-3 计划，第一稿（2026-11-23）

只是计划。主文件夹一个文件没改，没提交，没删东西。

## 一、你定的三条（原话，照此登记）

1. 「英寸号统一用 ″，不用 "。」
2. 「尺寸用分数，不用小数。」
3. 「整数和分数之间用连字符，写成 3-1/2″。」

登记在哪：见第十节。

## 二、范围（照登记的，不加不减）

照 decisions.md 第 13639–13650 行列的：
- 词典：en.json、zh.json，reviewed.json 里带英寸号的已审句子（每句改了都要你再读一遍）
- 三个格式函数：
  - `formatDimension`（dimensions.ts 第 334 行）
  - `formatInches`（fit.ts 第 213 行）
  - `inchesSpoken`（inches.ts 第 10 行）
- 两处写死：
  - `feetInches`（LeftPanel.tsx 第 17 行）
  - 瓷砖尺寸（finishes.ts 第 114–116 行）
- roughIn.ts 里重复的函数：`inch`，第 667 行
- 滑杆默认格式：primitives.tsx 第 81 行
- 代码里直接写英寸号的那些行

全部并到一个出字的地方，加守护测试。

### "75 行"重新数

**怎么数的**
- 用 TypeScript 自己的解析器，读 src/ 下全部 150 个非测试的 .ts / .tsx。
- 只看字符串里面的字，包括普通字符串、模板字符串的各段、JSX 文字。
- 凡是 `"` 紧跟在数字或 `${…}` 后面，就记一处。
- 脚本：`scratchpad/r16/scan-marks.mjs`，输出 `marks2.json`。

**现在是多少**
- 按上面的规则：84 行，16 个文件。
- 其中 7 行不是英寸号，是名字两边的引号，像 `"${id}"`：
  - catalogue.ts 298、302
  - layoutShape.ts 141、171、198
  - packages.ts 199、200
- 去掉这 7 行：**77 行，13 个文件**。
- **和 75 不一样。** 登记时没写怎么数，差的 2 行说不出是哪两行。照实写 77。

**77 行分两类**

上页面的，16 行：
- 格式函数里面 7 行：
  - dimensions.ts 338、339、346
  - roughIn.ts 670、677
  - fit.ts 214
  - primitives.tsx 81
- hood.ts 738、739：风管尺寸，进清单
- utilities.ts 67：风管尺寸，规格卡和报价页
- quote.ts 185：报价页复制出来的文字
- 燃气管径：rules.ts 108、109、128 和 schema.ts 285、515，共 5 行。这是 `'1/2"'`、`'3/4"'` 这个数据值本身的类型定义；数据值会上页面（见问题 5）。

不上页面的，61 行：
- **layoutRules.ts 50 行**：布局检查的英文提示，只有测试调用（`checkLayout`、`checkHeights` 没有一个非测试文件引用）。
  - **这和登记写的不一样。** 登记说它"上页面"，查下来不上。拟在登记旁加注明，不改原文。
- hood.ts 445、446：`outsideItsManual`，只有测试调用。
- hood.ts 218、374、410、417、424、431：说明书原话的出处文字，不显示。
- ovenTower.ts 69：开发用的报错。
- layoutTemplate.ts 2775：规则说明文字。
- shareLink.ts 246：链接字段的说明文字。

**这一稿新找到、登记时没数到的 6 行**（也是"代码里直接写英寸号"这一类）：
- JSX 里写成 `&quot;` 的 2 行，上页面：
  - LayoutControls.tsx 89：布局页"最小 147″：24″ BBC42 + …"
  - RefusalNote.tsx 38：同样的组成，在拒绝提示里
  - 这里显示的是原始数，所以今天有 `37.5"`、`1.5"`、`0.75"` 这样的小数。
- 先写 `"` 再用正则去掉的 4 行：
  - rules.ts 301
  - useChecklist.ts 430、448
  - LayoutControls.tsx 396
  - 格式函数一改，这 4 行不跟着改，页面就会出 `11″″` 这样的双号。原型第一版就出了，已核对。
- 放不放进来等你定（见第三节第 8 问）。

**代码里写 ″ 和 ′ 的**
- ″ 写在代码里：5 行，3 个文件（finishes.ts 3 行、inches.ts 1 行、LeftPanel.tsx 1 行）。
- ′：1 行（LeftPanel.tsx 21）。

**词典重数**
- 登记写 en.json `″` 3 处、`"` 131 处，zh.json `″` 66 处、`"` 69 处，这几个数对得上。
- 但这两个 `"` 数里各有 2 个是引号，不是英寸号：`refusal.notALength`、`refusal.notAChoice` 里的 `"{raw}"`。
- 去掉以后：
  - en.json：`"` 129 处，65 句；`″` 3 处，1 句
  - zh.json：`"` 67 处，37 句；`″` 66 处，29 句
- reviewed.json 已审的句子，和登记一致：
  - 英文：`″` 3 处 1 句，`"` 41 处 22 句
  - 中文：`″` 26 处 11 句，`"` 18 处 12 句
  - 要改的已审句子：英文 22 句、中文 12 句，共 34 句，都要你再读。
- 原型把 en、zh 改完以后，`reviewed.test.ts` 正好红 34 条，对得上。

## 三、你没定的，列成问题（只列事实和选项，倾向只是倾向）

### 问题 1：分数要不要约到最简，最细到几分之一

**今天页面上的三种写法**（真实例子）
- `formatDimension`，约到最简，最细 1/16：`14-5/8"`、`29-7/8"`、`35-15/16"`
- `inchesSpoken`，最细 1/8，用 `¾` 这种字：墙加长的提示里的 `178¾″`
- `formatInches`，一位小数：`11.9"`（实为 11-7/8）、`0.8"`（实为 3/4 或 13/16）、`0.1"`（实为 1/8）
- 词典手写：`5-29/32"`，咖啡机排水那句，是整个页面唯一的 1/32

**选项**
- 甲：约到最简，最细 1/16。页面上：`11-7/8″`、`3/4″`、`13/16″`。
- 乙：约到最简，最细 1/8。13/16 这种要进位成 3/4 或 7/8（怎么进位是问题 2）。
- 丙：不约，统一用 16 分母：`11-14/16″`、`12/16″`。

**倾向**：甲。和今天的尺寸线一样，原型就是这样做的。

**和你以前的一个决定有关**
- 2026-11-13 你答 item 10 的第 3 条：「数字用分数（224¼″）」（decisions.md 第 12313 行）。换套餐提示今天写 `224¼″`、`196½″`、`178¾″`。
- 墙加长的提示今天还会写 `178⅞″`（D18，decisions.md 第 3522、3952 行），⅞ 两套网站字体里都没有（第四节）。
- 照你新的第 3 条，这些会变成 `224-1/4″`、`178-7/8″`。旧条目不改，旁边加注明，说明被 2026-11-23 的第 3 条取代。

**连带一个小问题：不到 1 英寸的怎么写**
- 今天 `formatDimension` 会写成 `0-1/2"`，原型照这样做，页面上出现 `0-3/4″ deeper than the opening`。
- 选项：
  - `0-3/4″`，和今天的函数一样
  - `3/4″`，没有整数就不写连字符
- 倾向：`3/4″`。你的第 3 条说的是"整数和分数之间"，没有整数就没有"之间"。

### 问题 2：数据里换不成整十六分之一的数，逐个列

**data/ 里一个都没有**
- 名字以 In 结尾的字段里的 363 个英寸数，全是整十六分之一。
- data/ 里所有带小数点的数也扫过了，只有 rules.json 第 255 行的 0.05，是填板判断的门槛，不是尺寸。

**真正换不成整十六分之一的，只有 2 个，都不在 data/ 里**
1. 算出来的：咖啡机 TCM24PS，在 D 和 E 两个套餐里，每侧填板 0.84375″（= 27/32）。
   - 来源：fit.ts 第 107 行，宽差 1-11/16 除以 2。
   - 页面上今天显示 `0.8"`：卡片、换型号列表、清单。
   - 原型按"最近的 1/16，正好一半往上"显示 `7/8″`（原型写成 `0-7/8″`）。
   - 选项：`7/8″`（往上）、`13/16″`（往下）、`27/32″`（不进位，要允许 1/32）。
2. 词典手写：`5-29/32″`。
   - en.json 第 548 行、zh.json 第 549 行，`rule.coffeeDrainOptional`，咖啡机排水口至少低多少。
   - 今天英文显示 `5-29/32"`，中文 `5-29/32″`。
   - 选项：照说明书留 `5-29/32″`、`5-15/16″`、`6″`。

**是整十六分之一、但今天显示成小数的**（改成分数就是准的，不用进位，列出来给你看）
- `formatInches` 一位小数：`0.8"`（3/4）、`11.9"`（11-7/8）、`36.8"`（36-3/4）、`0.1"`（1/8）、`22.8"`（22-13/16）等。逐条在 `scratchpad/r16/fitProbe.out`，197 行。
- 清单里先取一位小数的：rules.ts 第 278 行，名字带 filler / depth 的数先 `toFixed(1)`。
- 清单里取三位小数的：rules.ts 第 349 行，罩底距炉面 29.6875 写成 `29.688"`。同一个数，尺寸线上写 `29-11/16"`。
- 油烟机上方吊柜开口：`8.8125" × 6.8125"`（roomShell.ts 第 135 行的常数，hood.ts 第 739 行直接写），实为 8-13/16 × 6-13/16。
- 下烤箱门全开前伸：`26.625"`，实为 26-5/8。
- 布局页组成里的模块宽：`37.5"`、`1.5"`、`0.75"`。

### 问题 3：一句里有几个数时，符号怎么带，中间用什么连

**今天的真实例子**
- 规格卡：`36" × 36.8" × 24.8"`，每个数都带，用 ×
- 报价页复制文字：`36" x 36" x 24"`，每个都带，用小写 x（quote.ts 第 185 行）
- 风管：`3-1/4" x 10"`（`rule.ductSizeOtr`，en 第 145 行、zh 第 147 行），用 x
- 灶台转角支撑：英文 `2" x 4"`（en 第 307 行），中文 `2" × 4"`（zh 第 308 行），中英文连接符不一样
- 瓷砖：`24″ × 48″`（finishes.ts）
- 范围：英文 `4-3/4"–18"`、中文 `4¾″–18″`（`rule.microwaveReach`）；`{min}"–{max}"`（`refusal.outOfRange`）
- 只带一次：`10–12"`（`rule.overhangSupport`，en 第 534 行、zh 第 535 行）
- 一个都不带：尺寸线旁的小字 `min 30, recommended max 40`、`standard 18`

**选项**
- 甲：每个数都带 ″；大小用 ×，范围用 –。例：`36″ × 36-3/4″ × 24-3/4″`、`10″–12″`、`4-3/4″–18″`。原型就是这样。
- 乙：只在最后带一次。例：`36 × 36-3/4 × 24-3/4″`、`10–12″`。
- 丙：大小每个带（甲），范围只带一次（乙）。

另外两个小选择：
- 报价页、风管里的 x 统一成 ×，还是保留 x？
- 尺寸线旁的 `min 30, recommended max 40` 要不要加 ″？

**倾向**：甲，x 统一成 ×；小字加不加，你看原型截图再定。

### 问题 4：用到英尺或英尺号的地方

上页面的：
- 左侧面板的房间大小：`feetInches`（LeftPanel.tsx 第 21 行），写成 `16′10″`、`14′`。标题是 `hero.stat.room`：英文 "Room, feet"、中文"房间（英尺）"。
- 岛台风管罩那句（`rule.islandHoodCoverKit`）：
  - 英文用撇号当英尺号：`8' ceiling`、`9'–12'`（en.json 第 535 行）
  - 中文用字：`8 英尺天花`、`9–12 英尺`（zh.json 第 536 行）

不上页面的：
- data/rough-in.json 一条 note 里的 `3 ft`，不显示。

选项：
- 英尺号用 ′（和 ″ 配）、用 '，或者写 ft / 英尺
- 中英文要不要一样

倾向：英文用 ′，中文保留"英尺"二字。等你定。

### 问题 5：不是尺寸的 "（数据，先只列）

- **型号名、系列名、亮点里，没有一处带英寸号。** appliances.json 全扫过。
- 卡片标题 `36" Gas Range` 的宽度不是数据带来的，是代码用 `formatDimension` 拼的，已经在范围里。
- 上页面的数据值只有燃气管径 `1/2"`、`3/4"`：
  - slots.json 第 74 行
  - packages.json 第 95、308 行
  - rules.json 第 114 行
  - 类型定义：schema.ts 第 285、515 行，rules.ts 第 108、109、128 行
  - 显示在：规格卡"Gas 3/4" · with shutoff valve"，报价页，清单"so the run wants 3/4" pipe"
  - 原型没改它，截图里还是 `3/4"`
- 不上页面的数据文字（出处、备注），共 34 行：
  - appliances.json basis 1 行
  - rough-in.json basis 18 行、note 8 行
  - rules.json basis 5 行
  - packages.json provenance 1 行
- 选项：管径换成 `1/2″`（改数据和类型），或者在显示时换，或者不换。出处、备注倾向不动。

### 问题 6：中英文写法不一样的地方

- 带英寸号的句子共 66 个键：38 个中英文写法一样，28 个不一样。
- 不一样的 28 个，绝大多数是中文用 ″、英文用 "。例：
  - `rule.ovenSill.panel` 等 4 个
  - `refusal.window*` 6 个
  - 3 个 `panel.layout.coffeeSill.caption.*`
- 除了号以外的不同：
  - `rule.microwaveReach`：中文 `4¾″`，英文 `4-3/4"`
  - `rule.rangetopCornerSupports`：中文 ×，英文 x
  - `refusal.windowGap`：英文 2 个号，中文 3 个，句子本身不一样
- 照你第 1、3 条改完，剩下的差别只有 × / x 和句子本身。
- 问：中英文数字的写法要不要完全一样？倾向：一样。

### 问题 7：读屏文字、测试里写死的期望值

**读屏**
- 30 张截图的页面里，带尺寸的 aria-label、title 一个都没有。
- 滑杆的 aria-label 只有名字（"后墙长度"），数值由浏览器读。
- 读屏软件怎么念 ″，我没试过，不猜。
- 所以读屏这边没有要改的字。

**测试**（用同一个解析器数，包括测试标题和引号，逐条以正式计划为准）
- src/ 下单元测试：`"` 307 行，56 个文件；`″` 67 行，10 个文件
- tests/ 浏览器测试：`"` 139 行，35 个文件；`″` 14 行，4 个文件
- scripts/：`"` 24 行，10 个文件；`″` 1 行

**在原型上实跑单元测试**（19:27:38–19:28:17，exit 1）
- 4,660 条里 276 条红，在 22 个文件里，全是写死了 `"` 的期望值。
- 其中 34 条是 reviewed.test.ts（已审句子）。

跟不跟着改：
- 期望值跟着改，因为它们守的是页面写什么。
- 测试标题里写的尺寸，倾向不改。
- 等你定。

### 问题 8（这一稿新加）：没数到的 6 行放不放进来

- 2 行 `&quot;`、4 行"先写再去掉"（第二节）。
- 倾向放进来：
  - 那 4 行不改会出双号；
  - 那 2 行不改，布局页就还是 `"` 和小数。
- 照你"计划外只登记"的话，先列在这里问。

## 四、″ 在页面字体里有没有

**出处一：读字体文件本身**（`scratchpad/r16/woff2cmap.mjs`，18:55:17，exit 0）
- 页面拉丁字母用的两个文件都有 ″（U+2033）、′、"、¾、⁄、×、–：
  - Inter latin：`UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2`，″ 是第 361 号字形
  - Cormorant Garamond latin：`co3bmX5slCNuHLi8bLeY9MK7whWMhyjYqXtK.woff2`，″ 是第 325 号字形
- 两个文件的 unicode-range 都包括 U+2000–206F（src/fonts.css 第 68、266 行等）。
- 两个文件都**没有** ⅛（U+215B）。

**出处二：问浏览器实际用哪个字体画**（CDP 的 CSS.getPlatformFontsForNode，Chromium 153，Windows，19:18:08–19:19:21，exit 0）
- ″：正文 Inter（网站自带字体），标题 Cormorant Garamond（网站自带）。400、500 两种粗细都一样。
- 页面上真的尺寸线文字，`108-1/2″`、`36-3/4″` 等 9 处，英文、中文界面都由 Inter 画。
- 中文句子里，汉字落到 Noto Sans SC（系统），″ 和数字仍是 Inter。
- ⅛、⅜：正文落到 **Segoe UI**（系统），标题落到 **Georgia**（系统）。

**这是现有的问题**：今天的 `inchesSpoken` 会写 ⅛ ⅜ ⅝ ⅞。照你的第 3 条，这些字不再出现。

**没查的**：苹果手机、Mac 上没测。″ 在网站自带的字体文件里，字体到了以后不靠系统字体；字体到之前，页面先用系统字体（font-display: swap）。

## 五、原型

**在哪**
- 副本：`C:\Users\leoch\AppData\Local\Temp\claude\2d05e9ef00c4ba20\a893b756-812e-493a-8c91-ab24b4a5973e\scratchpad\r16\wt-proto`（e601271，没提交）
- 对照用的旧版副本：`…\scratchpad\r16\wt-old`（e601271 原样）
- 两个都留着，没删。

**预览**
- 原型：http://localhost:4310/ ，主文件 `index-DlOtJqc-.js`
- 改前：http://localhost:4311/ ，主文件 `index-B3fBdUA5.js`
- 用项目自己的 Vite 起的（`node node_modules/vite/bin/vite.js preview`）。
- app 有时会在两轮对话之间把它停掉。打不开就告诉我，我重新起，并核对主文件名。

**原型做了什么**（一次性的，不并进主文件夹）
- 新文件 `src/data/inchText.ts`：唯一出字的地方，`inchFigure()` 出数，`inches()` 出数加 ″。
- 没定的几样照今天的做法：约到最简、最细 1/16、最近一档一半往上、每个数都带号、不到 1 英寸写 `0-3/4″`。
- 三个格式函数、roughIn 的 `inch`、滑杆默认格式都改成问它。
- 词典里数字和占位符后面的 `"` 全换成 ″（en 129 处、zh 67 处，`"{raw}"` 的引号不动），`4¾″` 改成 `4-3/4″`。
- 词典占位符后面紧跟 ″、传进来的是数时，由它写成分数。
- hood.ts 738–739、utilities.ts 67、quote.ts 185、`&quot;` 2 行、"先写再去掉" 4 行改成问它。
- 清单里 filler / depth 不再先取一位小数。

**原型没做的**
- 燃气管径（数据）
- 英尺
- layoutRules.ts（不上页面）
- reviewed.json
- 测试

**原型核对**
- 三个 dump 在原型上照常跑完（19:23 左右，exit 0），没有 `throws`，没有 `″″`。
- 清单、卡片的文字里只剩燃气管径的 `3/4"`。
- 还看得到的小数只有 `5-29/32`（手写）。

**截图**
- 三档宽度，每档 5 个画面：
  - 清单（英文、中文，安装模式，含尺寸线旁的字和标签）
  - 炉头卡片的机型列表
  - 规格卡
  - 布局页滑杆（中文）
- 改前和原型各一张，共 30 张。
- 1440 用鼠标，767 和 390 用手指。
- 拼成三张对照图，左改前、右原型，1440 那张加一行尺寸线放大 2.5 倍。
- 原图在 `scratchpad/r16/shots2`（改前，和原型第一版）、`shots3`（原型最终版）。

## 六、做法（你答完第三节以后）

1. 新建 `src/data/inchText.ts`，唯一出英寸字的地方，按你的答案写。
2. 三个格式函数、roughIn 的 `inch`、滑杆默认格式改成调用它。
   - 格式函数留不留名字，倾向留，只改里面。这样调用的 40 处左右（第 12e-2 计划第三稿 I 节数的 23、11、6）不用动。
3. 两处写死、代码里直接写的那些行，改成调用它。
4. 词典 en、zh 照你的答案改。
   - reviewed.json 里要改的 34 句，先把新旧两版逐句列给你读，你认了再写进去。
5. i18n 里"占位符后面紧跟 ″、传进来的是数"的由它出字。
6. 你答了问题 2、4、5 的，按答案做。没答的不做。

## 七、守护测试守什么，怎么故意改坏

**守护一：代码**（单元测试，照 sceneFrame.test.ts 守 useFrame 的写法）
- 用 TypeScript 解析器读 src/ 下全部非测试文件。
- 以下任何一种出现在 inchText.ts 以外的地方就红：
  - 字符串、模板、JSX 文字里，数字或 `${}` 后面紧跟 `"`、`″`、`′`
  - JSX 里写成 `&quot;`、`&Prime;`、`&#8243;` 并紧跟数字或表达式
  - 正则里写了 `"` 或 `″`（`.replace(/"$/` 这种绕开的写法）
  - 自己写 `* 16`、`toFixed(` 拼英寸数，这条先查有没有误报再定
- 豁免要窄，逐条写原因：
  - 名字两边的引号 7 行（`"${id}"`）：是引号不是英寸号。按"引号在同一段里成对包住一个占位符"认，不按文件豁免。
  - 说明书原话 6 行（hood.ts 218、374、410、417、424、431）：是出处，引的是说明书的原字，不上页面。按常量名豁免，逐个列名字。
  - 燃气管径的类型定义 5 行：看问题 5 的答案。换就不豁免。
- 故意改坏，每样各一次，在另拉的副本里做，记下红的输出：
  - hood.ts 加一句 `` `${n}"` ``
  - JSX 加一个 `{w}&quot;`
  - 加一行 `.replace(/″$/, "")`
  - 在 inchText.ts 以外复制一份分数函数
  - 把豁免名单里的一个常量改名

**守护二：词典**
- en、zh 每句里：
  - 英寸号只能是 ″；
  - 只能跟在数字或占位符后面；
  - 不许 `¾` 这种字；
  - 不许 ″ 前面是小数。
- `"{raw}"` 那 2 个键是引号，按键名豁免。
- 故意改坏：加一个 `5"`、加一个 `4¾″`、加一个 `11.9″`，各红一次。

**守护三：页面**
- 像素证明拍 45 个状态时记下的每段字，以及三个 dump 的 words：
  - 不许出现数字后面的 `"`；
  - 不许 ″ 前面是小数；
  - 不许 `″″`。
- 故意改坏：用一个把词典改回去一句的构建拍一次，要红。

**守护四：出字函数本身的表**
- 用不对称的样本，不用 .5 这种对称的：0.84375、0.8125、11.875、35.97、0.0625、3.5、负数。
- 每个答案对一个写法。

## 八、先红后绿；要改的旧测试

**先红**
- 新测试先写，在 e601271 的干净副本上跑，要红。
- 守护一、二在旧代码上本来就会红，因为旧代码到处是 `"`，记下红的条数。

**后绿**
- 在改好的代码上全绿。

**要改的旧测试**（原型上实跑，红 276 条、22 个文件，原因全是期望值写的是 `"` 或小数）
- alternativeTitle.test.ts：47 条，卡片标题 `30" Induction Range`
- roughInSides.test.ts：46 条，测试里自己的解析函数只认 `"`（"not an inch figure: 6″"）
- underOven12d.test.ts：36 条，烤箱塔清单句子
- reviewed.test.ts：34 条，已审句子，要你重读
- packageSwitchNotice.test.ts：32 条，换套餐提示里的墙长（今天是 `¾` 写法）
- towerHeight12e.test.ts：23 条
- steamSill.test.ts：18 条
- eLCornerSocket.test.ts：16 条
- roughInEnglish.test.ts：5 条
- uInterface.test.ts：5 条
- inductionRangetop.test.ts：2 条
- autoGrow.test.ts：2 条
- 各 1 条：
  - coffeeTower、dimensions、ductThroughCeiling、fit
  - hood、rules：这两条查的是 `8.8125` 这个小数
  - overRange、roughIn、oneWallSwitch、rule12Floor
- 浏览器测试（tests/）：`"` 在 35 个文件、`″` 在 4 个文件。
  - 哪几条真要改，答完第三节后在副本里实跑一次逐条列。
  - 预计最多的：tooTall、packageSwitchUndo、towerHeight12e、steamSill、smoke、rule12Note、eLOvenSocket。
- 每条改的测试，旁边写原因和你的哪一条。

## 九、像素证明：哪些必须一样，哪些有意要变

**必须一样**
- 45 个状态的 3D 画布：全部逐像素相同（尺寸线是叠在上面的字，不在画布里）。
- 30 个默认房间：画布相同。
- 不带英寸数的字：内容和位置都相同。
- 三个 dump：几何部分逐字节相同。

**有意要变**
- 带英寸数的字：`"` → ″、小数 → 分数。
- 这些字变宽或变窄，可能把同一行后面的字、标签的引线挪几个像素。逐处列出，说明是哪个字变了引起的。

**dump 的字**
- 用一个脚本把旧的字按新规矩换一遍，要和新的字逐字相同。
- 对不上的逐条列。

## 十、同一条规则只写一处

- 三条写法规矩（和你对问题的答案），只写在 decisions.md 新的一条 **D25 · An inch figure is written in one place**，放在 D24 后面。
- 别处只引用，不重写：
  - inchText.ts 开头的注释只写"D25"和一句话；
  - HANDOFF 的决定表第 467 行后加一行 D25，一句话；
  - 12e-3 的条目写"见 D25"。

## 十一、文档改动（随 12e-3 一起提交）

**A. 上一轮定稿的六段，原样放进来**

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

**B. 12e-3 自己的文档改动**（原文到正式计划里贴）
- decisions.md 新增 D25（第十节）。
- 12e-3 条目旁加注明，不改原文：
  - "75 lines" 重数是 77 行，怎么数的；
  - layoutRules.ts 不上页面；
  - 词典的 131、69 里各有 2 个引号；
  - 这一稿新找到的 6 行。
- 第 12313 行（「数字用分数（224¼″）」）和 D18 里写 `178⅞″` 的地方，旁边加注明：被 D25 取代，原文不改。
- HANDOFF 决定表加 D25 一行。
- 12e-3 的 "Shipped"：上线后另写。
- 计划、截图压缩放进 `docs/plans/item12e3-2026-11-23/`：图总共 ≤ 2 MB，原图留本地。

## 十二、日志

- 从这一稿起，每一步的起止时间和真实 exit code 当场写进 `scratchpad/r16/steps.log`。
- 收尾前复制进 `docs/plans/item12e3-2026-11-23/raw/`。
  - 这个 raw 要在 `.git/info/exclude` 加一行，加的时候报行号。
- 写进文档的每个数，指得出 raw 里存下来的文件；指不出的不写。

## 十三、全套测试（按 2 h 15 排）

放在哪一步：
1. 代码、测试都改完，单元测试全绿。
2. 守护测试的故意改坏都做完、记下。
3. 这一轮动到的浏览器测试先单独跑（HANDOFF 第 6 节的规矩）。
4. 然后全套测试。
5. 之后才拍像素、跑 dump、起预览给你看。

开跑前要做的：
- 停掉预览和所有演示用的服务器（包括 4310、4311）
- 查没有剩下的 node.exe、esbuild.exe（不是本项目的不碰，比如 Codex 的那个）
- 列出开着的程序
- 告诉你预计几点结束
- 记下 src/、tests/、scripts/、data/ 的校验值，跑完再核对一次没动过
- 屏幕关闭、睡眠设成"从不"
- 中途有待机、或者 18:00 被你关机打断的，不算，整套重跑

## 十四、计划外发现（只登记，不并进来）

1. roughIn.ts 的 `inch` 少一种情况：小数部分进位到 16/16 时会写成 `35-1/1"`。`formatDimension` 有这一条，它没有。今天的出线点数据里没有会碰到的数（dump 里 x、y 全是整十六分之一），所以页面上没出现过。并到一个出字的地方以后自然没了。
2. ⅛、⅜（还有 ⅝、⅞）两套网站字体里都没有，今天落到系统字体（第四节）。
3. 清单英文一句语法：`Cabinet above the hood needs a 8.8125" × …`，"a 8" 应为 "an 8"。今天就是这样，与英寸号无关。
4. 规格卡、报价页的"比开口高 / 深"今天会把 3/4 写成 `0.8"`、1/8 写成 `0.1"`，数被改了。改成分数后自然准了，已经在范围里。这里只记一笔是现在的状态。

## 十五、等你的

- 第三节问题 1–8 的答案（问题 1 还带一个"不到 1 英寸"的小问题）
- 看截图和预览以后的意见
- D25 放在 decisions.md 这个位置行不行
- 答完我写正式计划，再动手；动手前不改主文件夹。
