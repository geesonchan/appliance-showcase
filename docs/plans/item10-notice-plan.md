# 第 10 项计划：L 型、一字型换套餐的提示，和滑杆跟房间对不上（第一稿，没动手）

2026-11-13 夜里写。Leo 的顺序第 10 项（decisions.md，Open items，「Amended 2026-11-12」）：
「第 2、3 条：L 型、一字型换套餐的提示套用 U 的新句式（只列真正变了的墙）；一字型 A 或 C 换成 B 时滑杆和房间不一致。」
他 2026-11-13 夜里的话：「写明改哪些提示、哪些房间、改前改后的句子逐条列出（中英文都列），哪些不变，要我回答的问题。句子怎么说由我定，你给选项和建议，不要替我选。」

**只是计划，主文件夹里没改任何页面代码。** 为了把每一条句子和每一个房间查准，跑过三个只读的探查脚本（在 `docs/plans/u-view-2026-11-12/`，都通过页面自己的代码走一遍）：
- `roomGrewProbe.ts`（11-12 写的）：L 型、一字型各 20 种换法，现在的提示；
- `noticeWords.ts`：同样 40 种换法，按**实际建成**的墙长，列现在的句子和改后的句子，中英文都列，结果在 `noticeWords.txt`；
- `storeVsBuiltProbe.ts`：L 型、一字型、U 型各 20 种换法，滑杆上的墙长（页面记的）和实际建成的墙长对不对得上。

读法：第 1 节是查出来的现状，第 2 节原因，第 3 节打算怎么改，第 4 节逐条句子，第 5 节不变的，第 6 节要你答的问题，第 7 节证明。

---

## 1. 现状（查出来的）

### 1.1 L 型、一字型换套餐的提示（40 种换法）

- **现在弹提示的：19 次**（L 型 10，一字型 9）。
- **其中 13 次提到没变的墙**：
  - L 型 4 次：A→B、C→B、E→B 的左墙没变，B→E 的后墙没变，提示里照样写"加到"；
  - 一字型 9 次全部：一字型没有左墙，提示里也写"左墙加到 144″"（或 178.8″）。
- **墙长了却不弹提示：1 次** —— 一字型 C→A：实际建成的后墙从 230″ 变成 233¾″，没有任何提示，也没有"退回"。
- **数字写法**：现在是小数一位（224.3″、178.8″、270.8″），U 和切换形状的提示是分数（224¼″、178¾″）。

### 1.2 滑杆和房间对不上（60 种换法）

换完套餐以后，"布局"面板滑杆上的墙长和实际建成的房间不一样：**6 次**。
- 一字型 A→B：滑杆 233¾″，房间 239″
- 一字型 C→A：滑杆 230″，房间 233¾″
- 一字型 C→B：滑杆 230″，房间 239″
- U 型 A→C：左右墙滑杆 155¼″，房间 159¾″
- U 型 B→A：左右墙滑杆 144″，房间 155¼″
- U 型 B→C：左右墙滑杆 144″，房间 159¾″

登记时只记了一字型 A、C→B 两条，这次查全了，U 型也有。

**后果**（一字型 A→B、C→B 试过）：
- 分享链接是对的：链接写的是实际建成的 239″，打开也是 239″。
- 但接下来在面板上改任何一样东西，房间会按滑杆上的旧数重建：**239″ 一声不响地缩回 233¾″（从 C 换来的是 230″）**，没有新提示（旧提示可能还在屏幕上）。机器一台不少，只是台面变短。

---

## 2. 原因（代码里看到的）

都在 `src/data/layoutState.ts` 的 `setActivePackage`：

- **滑杆对不上**：换套餐时，房间按"新套餐在这个形状里想要的墙长"建（一字型 `oneWallWantedIn`、U 型 `uWantedIn`，取和现在墙长中较长的那个）。可是写回页面记录（`adjusted`）的，只有新套餐自己 `defaultLayout` 里写了的那几项。墙长如果是"想要的"那一步加长的、又不在 `defaultLayout` 里，房间加长了，页面记录（滑杆）没跟着改。
- **C→A 不弹提示**：同一处。新套餐没有要挪的东西时（`moved` 是空的），函数直接返回，不算"哪面墙加长了"，所以没有提示，也没有退回。
- **提示提到没变的墙**：`toast.roomGrew` 这句本身就是"后墙加到 X、左墙加到 Y"，两面墙一起写，不管变没变；一字型也照写左墙。

---

## 3. 打算怎么改

1. **提示**：L 型、一字型换套餐，改用 U 已经在用的那套。第一行一句，然后每面真正变了的墙一行，一面没变就不弹、不给退回。和 U 共用同一个函数（`packageSwitchLines`），规则只写一处。句子怎么说，见第 6 节，你定。
2. **滑杆**：换套餐以后，凡是实际建成的墙长和换之前不一样的，都写回页面记录。这样滑杆显示的就是房间，下一次面板上的改动也从这个房间出发，不会再缩回去。
3. **墙长了一定说**："哪面墙变了"改成按实际建成的房间和换之前比，不再只在有要挪的东西时才算。一字型 C→A 改后会弹提示、给退回。
4. `toast.roomGrew`（你 98b-2 自己写的句子）L 型、一字型都不再用，就从字典里拿掉。这要你同意（第 6 节问题 5）。

---

## 4. 改前、改后的句子，逐条（20 条）

下面是实际建成的墙长，和每条提示改前、改后的原文，中文在前、英文在后，方括号里是退回按钮。改后的句子用的是 U 现在的句式（第 6 节问题 1 的甲），如果你选别的，第一行跟着换，墙的那几行不变。

（整段由 `noticeWords.ts` 用页面自己的翻译和英寸写法生成，原样贴在这里。）

**1. L 型 A→B（实际建成：后墙 168″→196½″，左墙 144″→144″）**
- zh 现在：套餐 B 需要更大的厨房，已把后墙加到 196.5″、左墙加到 144″。　［退回套餐 A］
- zh 改后：已切换为套餐 B，墙长已调整： / 后墙从 168″ 改为 196½″　［退回套餐 A］
- en 现在：Package B needs a bigger kitchen: the back wall is now 196.5″ and the left wall 144″.　［Back to Package A］
- en 改后：Switched to Package B; the walls were adjusted: / Back wall: 168″ → 196½″　［Back to Package A］


**2. L 型 A→D（实际建成：后墙 168″→224¼″，左墙 144″→178¾″）**
- zh 现在：套餐 D 需要更大的厨房，已把后墙加到 224.3″、左墙加到 178.8″。　［退回套餐 A］
- zh 改后：已切换为套餐 D，墙长已调整： / 后墙从 168″ 改为 224¼″ / 左墙从 144″ 改为 178¾″　［退回套餐 A］
- en 现在：Package D needs a bigger kitchen: the back wall is now 224.3″ and the left wall 178.8″.　［Back to Package A］
- en 改后：Switched to Package D; the walls were adjusted: / Back wall: 168″ → 224¼″ / Left wall: 144″ → 178¾″　［Back to Package A］


**3. L 型 A→E（实际建成：后墙 168″→180″，左墙 144″→168″）**
- zh 现在：套餐 E 需要更大的厨房，已把后墙加到 180″、左墙加到 168″。　［退回套餐 A］
- zh 改后：已切换为套餐 E，墙长已调整： / 后墙从 168″ 改为 180″ / 左墙从 144″ 改为 168″　［退回套餐 A］
- en 现在：Package E needs a bigger kitchen: the back wall is now 180″ and the left wall 168″.　［Back to Package A］
- en 改后：Switched to Package E; the walls were adjusted: / Back wall: 168″ → 180″ / Left wall: 144″ → 168″　［Back to Package A］


**4. L 型 B→D（实际建成：后墙 196½″→224¼″，左墙 144″→178¾″）**
- zh 现在：套餐 D 需要更大的厨房，已把后墙加到 224.3″、左墙加到 178.8″。　［退回套餐 B］
- zh 改后：已切换为套餐 D，墙长已调整： / 后墙从 196½″ 改为 224¼″ / 左墙从 144″ 改为 178¾″　［退回套餐 B］
- en 现在：Package D needs a bigger kitchen: the back wall is now 224.3″ and the left wall 178.8″.　［Back to Package B］
- en 改后：Switched to Package D; the walls were adjusted: / Back wall: 196½″ → 224¼″ / Left wall: 144″ → 178¾″　［Back to Package B］


**5. L 型 B→E（实际建成：后墙 196½″→196½″，左墙 144″→168″）**
- zh 现在：套餐 E 需要更大的厨房，已把后墙加到 196.5″、左墙加到 168″。　［退回套餐 B］
- zh 改后：已切换为套餐 E，墙长已调整： / 左墙从 144″ 改为 168″　［退回套餐 B］
- en 现在：Package E needs a bigger kitchen: the back wall is now 196.5″ and the left wall 168″.　［Back to Package B］
- en 改后：Switched to Package E; the walls were adjusted: / Left wall: 144″ → 168″　［Back to Package B］


**6. L 型 C→B（实际建成：后墙 168″→196½″，左墙 144″→144″）**
- zh 现在：套餐 B 需要更大的厨房，已把后墙加到 196.5″、左墙加到 144″。　［退回套餐 C］
- zh 改后：已切换为套餐 B，墙长已调整： / 后墙从 168″ 改为 196½″　［退回套餐 C］
- en 现在：Package B needs a bigger kitchen: the back wall is now 196.5″ and the left wall 144″.　［Back to Package C］
- en 改后：Switched to Package B; the walls were adjusted: / Back wall: 168″ → 196½″　［Back to Package C］


**7. L 型 C→D（实际建成：后墙 168″→224¼″，左墙 144″→178¾″）**
- zh 现在：套餐 D 需要更大的厨房，已把后墙加到 224.3″、左墙加到 178.8″。　［退回套餐 C］
- zh 改后：已切换为套餐 D，墙长已调整： / 后墙从 168″ 改为 224¼″ / 左墙从 144″ 改为 178¾″　［退回套餐 C］
- en 现在：Package D needs a bigger kitchen: the back wall is now 224.3″ and the left wall 178.8″.　［Back to Package C］
- en 改后：Switched to Package D; the walls were adjusted: / Back wall: 168″ → 224¼″ / Left wall: 144″ → 178¾″　［Back to Package C］


**8. L 型 C→E（实际建成：后墙 168″→180″，左墙 144″→168″）**
- zh 现在：套餐 E 需要更大的厨房，已把后墙加到 180″、左墙加到 168″。　［退回套餐 C］
- zh 改后：已切换为套餐 E，墙长已调整： / 后墙从 168″ 改为 180″ / 左墙从 144″ 改为 168″　［退回套餐 C］
- en 现在：Package E needs a bigger kitchen: the back wall is now 180″ and the left wall 168″.　［Back to Package C］
- en 改后：Switched to Package E; the walls were adjusted: / Back wall: 168″ → 180″ / Left wall: 144″ → 168″　［Back to Package C］


**9. L 型 E→B（实际建成：后墙 180″→196½″，左墙 168″→168″）**
- zh 现在：套餐 B 需要更大的厨房，已把后墙加到 196.5″、左墙加到 168″。　［退回套餐 E］
- zh 改后：已切换为套餐 B，墙长已调整： / 后墙从 180″ 改为 196½″　［退回套餐 E］
- en 现在：Package B needs a bigger kitchen: the back wall is now 196.5″ and the left wall 168″.　［Back to Package E］
- en 改后：Switched to Package B; the walls were adjusted: / Back wall: 180″ → 196½″　［Back to Package E］


**10. L 型 E→D（实际建成：后墙 180″→224¼″，左墙 168″→178¾″）**
- zh 现在：套餐 D 需要更大的厨房，已把后墙加到 224.3″、左墙加到 178.8″。　［退回套餐 E］
- zh 改后：已切换为套餐 D，墙长已调整： / 后墙从 180″ 改为 224¼″ / 左墙从 168″ 改为 178¾″　［退回套餐 E］
- en 现在：Package D needs a bigger kitchen: the back wall is now 224.3″ and the left wall 178.8″.　［Back to Package E］
- en 改后：Switched to Package D; the walls were adjusted: / Back wall: 180″ → 224¼″ / Left wall: 168″ → 178¾″　［Back to Package E］


**11. 一字型 A→B（实际建成：后墙 233¾″→239″）**
- zh 现在：套餐 B 需要更大的厨房，已把后墙加到 239″、左墙加到 144″。　［退回套餐 A］
- zh 改后：已切换为套餐 B，墙长已调整： / 后墙从 233¾″ 改为 239″　［退回套餐 A］
- en 现在：Package B needs a bigger kitchen: the back wall is now 239″ and the left wall 144″.　［Back to Package A］
- en 改后：Switched to Package B; the walls were adjusted: / Back wall: 233¾″ → 239″　［Back to Package A］


**12. 一字型 A→D（实际建成：后墙 233¾″→245¾″）**
- zh 现在：套餐 D 需要更大的厨房，已把后墙加到 245.8″、左墙加到 144″。　［退回套餐 A］
- zh 改后：已切换为套餐 D，墙长已调整： / 后墙从 233¾″ 改为 245¾″　［退回套餐 A］
- en 现在：Package D needs a bigger kitchen: the back wall is now 245.8″ and the left wall 144″.　［Back to Package A］
- en 改后：Switched to Package D; the walls were adjusted: / Back wall: 233¾″ → 245¾″　［Back to Package A］


**13. 一字型 A→E（实际建成：后墙 233¾″→270¾″）**
- zh 现在：套餐 E 需要更大的厨房，已把后墙加到 270.8″、左墙加到 144″。　［退回套餐 A］
- zh 改后：已切换为套餐 E，墙长已调整： / 后墙从 233¾″ 改为 270¾″　［退回套餐 A］
- en 现在：Package E needs a bigger kitchen: the back wall is now 270.8″ and the left wall 144″.　［Back to Package A］
- en 改后：Switched to Package E; the walls were adjusted: / Back wall: 233¾″ → 270¾″　［Back to Package A］


**14. 一字型 B→D（实际建成：后墙 239″→245¾″）**
- zh 现在：套餐 D 需要更大的厨房，已把后墙加到 245.8″、左墙加到 144″。　［退回套餐 B］
- zh 改后：已切换为套餐 D，墙长已调整： / 后墙从 239″ 改为 245¾″　［退回套餐 B］
- en 现在：Package D needs a bigger kitchen: the back wall is now 245.8″ and the left wall 144″.　［Back to Package B］
- en 改后：Switched to Package D; the walls were adjusted: / Back wall: 239″ → 245¾″　［Back to Package B］


**15. 一字型 B→E（实际建成：后墙 239″→270¾″）**
- zh 现在：套餐 E 需要更大的厨房，已把后墙加到 270.8″、左墙加到 144″。　［退回套餐 B］
- zh 改后：已切换为套餐 E，墙长已调整： / 后墙从 239″ 改为 270¾″　［退回套餐 B］
- en 现在：Package E needs a bigger kitchen: the back wall is now 270.8″ and the left wall 144″.　［Back to Package B］
- en 改后：Switched to Package E; the walls were adjusted: / Back wall: 239″ → 270¾″　［Back to Package B］


**16. 一字型 C→A（实际建成：后墙 230″→233¾″）**（现在不弹提示）
- zh 现在：（不弹提示）
- zh 改后：已切换为套餐 A，墙长已调整： / 后墙从 230″ 改为 233¾″　［退回套餐 C］
- en 现在：（不弹提示）
- en 改后：Switched to Package A; the walls were adjusted: / Back wall: 230″ → 233¾″　［Back to Package C］


**17. 一字型 C→B（实际建成：后墙 230″→239″）**
- zh 现在：套餐 B 需要更大的厨房，已把后墙加到 239″、左墙加到 144″。　［退回套餐 C］
- zh 改后：已切换为套餐 B，墙长已调整： / 后墙从 230″ 改为 239″　［退回套餐 C］
- en 现在：Package B needs a bigger kitchen: the back wall is now 239″ and the left wall 144″.　［Back to Package C］
- en 改后：Switched to Package B; the walls were adjusted: / Back wall: 230″ → 239″　［Back to Package C］


**18. 一字型 C→D（实际建成：后墙 230″→245¾″）**
- zh 现在：套餐 D 需要更大的厨房，已把后墙加到 245.8″、左墙加到 144″。　［退回套餐 C］
- zh 改后：已切换为套餐 D，墙长已调整： / 后墙从 230″ 改为 245¾″　［退回套餐 C］
- en 现在：Package D needs a bigger kitchen: the back wall is now 245.8″ and the left wall 144″.　［Back to Package C］
- en 改后：Switched to Package D; the walls were adjusted: / Back wall: 230″ → 245¾″　［Back to Package C］


**19. 一字型 C→E（实际建成：后墙 230″→270¾″）**
- zh 现在：套餐 E 需要更大的厨房，已把后墙加到 270.8″、左墙加到 144″。　［退回套餐 C］
- zh 改后：已切换为套餐 E，墙长已调整： / 后墙从 230″ 改为 270¾″　［退回套餐 C］
- en 现在：Package E needs a bigger kitchen: the back wall is now 270.8″ and the left wall 144″.　［Back to Package C］
- en 改后：Switched to Package E; the walls were adjusted: / Back wall: 230″ → 270¾″　［Back to Package C］


**20. 一字型 D→E（实际建成：后墙 245¾″→270¾″）**
- zh 现在：套餐 E 需要更大的厨房，已把后墙加到 270.8″、左墙加到 178.8″。　［退回套餐 D］
- zh 改后：已切换为套餐 E，墙长已调整： / 后墙从 245¾″ 改为 270¾″　［退回套餐 D］
- en 现在：Package E needs a bigger kitchen: the back wall is now 270.8″ and the left wall 178.8″.　［Back to Package D］
- en 改后：Switched to Package E; the walls were adjusted: / Back wall: 245¾″ → 270¾″　［Back to Package D］

---

## 5. 不变的

- 房间本身：每个套餐、每种形状建出来的柜子、机器、墙长和现在逐字节一样（L 型、一字型、U 型的底稿都要对比）。滑杆写回的就是本来就建成的墙长，房间不动。
- 切换形状的提示（「已切换为 U 型厨房，墙长已调整：」那套）。
- U 型里换套餐的提示（11-12 那一轮做的）。
- 换型号、改布局让墙加长的提示（`toast.modelGrew`、`toast.wallGrew`）。
- 退回按钮的字（「退回套餐 A」 / "Back to Package A"）。
- 拒绝和建议的字（`refusal.*`、`suggestion.*`）。
- L 型、U 型换套餐时墙长"只加不减"的规矩（D18）。

---

## 6. 要你答的问题（按轻重排）

1. **提示第一行怎么说**（L 型、一字型；U 型要不要跟着改也一起定）：
   - 甲、和 U 现在一样：「已切换为套餐 B，墙长已调整：」 / "Switched to Package B; the walls were adjusted:"。
   - 乙、留你原来那句的意思：「套餐 B 需要更大的厨房，墙长已调整：」 / "Package B needs a bigger kitchen; the walls were adjusted:"。
   - 丙、说明是加长：「已切换为套餐 B，墙已加长：」 / "Switched to Package B; the walls were lengthened:"（换套餐只会加长，不会缩短）。
   - 我的建议：甲。三种形状、切形状和换套餐都是同一句话，规则只写一处。乙的好处是告诉客户为什么变；丙最直白，但切形状的提示有缩短的时候，两句就不一样了。
2. **U 的这句英文、中文你还没看过**（`toast.packageSwitched`，11-12 那一轮新加的，没进 reviewed.json）：照甲的原文同意吗？
3. **数字写法**：
   - 甲、分数（224¼″），和 U、切换形状的提示一样；
   - 乙、小数一位（224.3″），和现在的一样。
   - 我的建议：甲。
4. **滑杆和房间对不上的 U 型 3 条**（A→C、B→A、B→C），登记时没有，这次查出来的。一起改吗？我的建议：一起改，同一处原因、同一处改法。
5. **`toast.roomGrew` 拿掉**：这是你 98b-2 自己写的句子。L 型、一字型改用新句式以后它不再被用到，从字典和 reviewed.json 里拿掉，同意吗？
6. **一字型 C→A 改后会多一条提示**（现在一声不响地加长 3¾″）。同意吗？

---

## 7. 怎么证明（动手时照做）

- **新测试先在现在的代码上变红**：
  - 60 种换法，滑杆的墙长和实际建成的一样（现在 6 种不一样）；
  - 40 种换法的提示，逐条对第 4 节的句子（中英文），一面墙没变就不提，没变就不弹；
  - 一字型 C→A 有提示和退回；
  - 换完套餐后，在面板上改一样无关的东西，房间不缩回。
- **旧测试要改的**：每处在文件里写明原因。
- **底稿**：L 型、一字型、U 型的底稿和 `1ea029b` 逐字节对比，必须一样（这一轮不动房间）。
- **像素证明**：旧版本从 `1ea029b` 本身构建（git worktree）。45 个状态里没有换套餐的提示，必须逐像素相同；有意要变的是换套餐后的提示，拍改前改后并排（中英文，L 型、一字型各两条）。
- **真鼠标、真手指**：电脑 1440、手机 390，中英文。L 型、一字型、U 型各换几次套餐（含一字型 C→A、A→B 和 U 型 B→A）。每一步查提示、滑杆上的数和退回；退回以后再查滑杆。
- **全套测试**在最终代码上跑。开跑前停掉预览和服务器，列出开着的程序，告诉你预计结束时间。

---

## 8. 时间

- 改代码和测试：2–3 小时。
- 证明（底稿、像素、真鼠标真手指）：1.5 小时。
- 全套测试：约 90 分钟。
