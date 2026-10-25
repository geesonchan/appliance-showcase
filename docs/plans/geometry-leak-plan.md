# 连续换型号时几何体一直涨：原因和改法

> **计划最终版，待 Leo 确认后动手。** 按 Leo 2026-10-24 的答复写（`decisions.md`，第 100 轮 "Measured in round 100" 下面的 "Leo's answers"）。确认前不动代码；做完以后以 `decisions.md` 为准，这份文件不再跟着改。
>
> 基准是线上的第 100 轮，提交 `f7a56ea`。行号是那时的。排在第 99c 轮之后；99c 要改 `Scene.tsx`（加一个故意出错的点），动手前先把下面的行号对一遍。

---

## 0. Leo 的答复

1. **倾向乙**：用 3D 库自己的写法声明几何体，这一块卸下时库自己释放。计划先说清楚乙要改多少；改动太大就退回甲（每一处自己释放），要写明理由。
2. **范围**：全部。柜体、管线（安装模式）、墙、台面石材、机器的轮廓。
3. **测试**：换走一间房、再换回同一间房，几何体数回到原来的数，一个都不能多。
4. **排在第 99c 轮之后。**

---

## 1. 现状

### 量到的

第 100 轮用 `scripts/swapMemory.mjs` 量（`decisions.md`，"Measured in round 100"）：电脑 1440 宽，A 的 L 型，鼠标轮流换灶、油烟机、洗碗机，共 50 次。
- 渲染器手里的几何体数（`renderer.info.memory.geometries`）：开页 238，10 次后 600，20 次后 934，30 次后 1,307，40 次后 1,651，50 次后 2,019。只涨不落。
- 换灶或油烟机，每次多 50–60 个；换洗碗机，每次多 10 个左右。
- 贴图数不涨（9–10）。JavaScript 内存随回收上下波动（27–72 MB），没有趋势。
- `102f05e`（当时线上）每一步一模一样，不是第 100 轮带来的。

### 留下的是哪些

一个只读脚本（临时文件夹里，不在仓库），在本地预览上换 9 次（灶、油烟机、洗碗机各 3 次），跟踪画面里出现过的每一个几何体，离开画面又没被释放的算"留下的"。9 次后渲染器手里 539 个。按挂在哪里分：

| 留下的 | 类型 | 挂在哪里 |
|---|---|---|
| 268 | BoxGeometry | `cabinet-layer`，柜体的盒子 |
| 268 | EdgesGeometry | `cabinet-layer`，柜体的轮廓线 |
| 79 + 73 + 6 | 线 | `rough-in-layer`，安装模式的管线和点位 |
| 6 | ExtrudeGeometry | `cabinet-layer`，台面石材 |
| 5 + 5 | ShapeGeometry | `kitchen-shell`，后墙、左墙 |
| 3 + 3 + 3 + 2 | 轮廓线、外形 | `appliance-layer`，灶、油烟机、洗碗机 |
| 2 | 线 | `utility-layer-duct`，OTR 的电线孔 |

盒子和轮廓线一样多（268 = 268）。电脑上每个柜体正好一条轮廓线（`CabinetLayer.tsx:497`，`wireBoxes = solids`），所以留下的盒子是柜体本身，不是柜门：柜门的盒子是 JSX 写的（`CabinetLayer.tsx:89`、`:100` 等），没有留下。

### 为什么不释放（库的源码）

画面用 `@react-three/fiber` 8.18.0，网页打包用的是它的 `dist/events-776716bd.esm.js`（`package.json` 的 `module` 指向 `react-three-fiber.esm.js`，再从这个文件引入）。

- **JSX 里写的几何体**（`<boxGeometry args={…} />`）：
  - 建出来时自动挂在父物体的 `geometry` 上（`:55-58`），并记进父物体的 `__r3f.objects`（`:81`）。
  - 父物体卸下时，`removeChild`（`:118-183`）顺着 `__r3f.objects` 和 `children` 往下走（`:150-156`），对每一个调 `dispose()`（`:162-176`），放在空闲时才做（`:173`，`unstable_IdlePriority`）。
  - `args` 是逐个数比较的（`:290`）：数没变就不重建；变了就新建一个，旧的走 `removeChild`（`:199`）被释放。
- **当属性传进去的几何体**（`<mesh geometry={g}>`）：只是一次赋值（`:749`，`currentInstance[key] = value`），不进 `__r3f.objects`，上面那条路走不到。换掉或卸下时都没人释放。
- **`<primitive object={…} />`**：明确不释放，连它里面的东西也不往下走（`:147-148`）。

渲染器的数怎么来（three 0.169，`node_modules/three/build/three.module.js`）：
- 一个几何体**第一次被画**时加一（`:17539-17549`，从 `:18026` 画每个物体时调用）；收到 `dispose` 事件时减一（`:17484-17535`）。`BufferGeometry.dispose()` 就是发这个事件（`:11593`）。
- 所以这个数只算画过的。成品模式下藏着的东西（柜体轮廓线、安装模式的管线）不画，就不算进去；它们照样留在内存里，只是这个数看不到。第 100 轮量到的 50–60 个，主要是柜体盒子、石材、两面墙和机器外形。

### 两个原因

1. **整间房换掉时**：整个房间挂在 `Scene.tsx:108` 的 `<group key={layoutVersion}>` 下面。换灶、换油烟机、换套餐等会让 `layoutVersion` 加一，整间房卸下再装上：新的一套几何体做出来，旧的一套代码里自己 `new` 的，没人释放。
2. **房间不换、只重算时**：`useBoxGeometry`（`CabinetLayer.tsx:50-52`）的依赖是 `[size]`，一个数组。数一样，但每次重算都是新数组，就又做一个几何体。换洗碗机时 `solids`（`CabinetLayer.tsx:488-496`）重算，带通风口的柜体经 `standOffFromWall` 拿到新数组，这就是"换洗碗机也涨 10 个左右"的来源之一。同样的数组依赖还有两处：`RoughInLayer.tsx:177` 的 `resolved.size`、`:251` 的 `at`。

---

## 2. 乙的改动量，和决定

### 逐处

`src/three` 和 `src/ui` 里查了 `Geometry(`、`useMemo`、`geometry=`、`.dispose(`、`new THREE.`、`<primitive`。房间里（`layoutVersion` 那个 key 下面）代码自己做、又没人释放的几何体共 **16 处**。`src/ui` 里一处都没有。

| # | 文件:行 | 现在 | 乙改成 | 难点 |
|---|---|---|---|---|
| 1 | `CabinetLayer.tsx:50-52`、`:273`、`:336` | `useBoxGeometry` 做盒子，`<mesh geometry={geometry}>` | 柜体网格里写 `<boxGeometry args={box.size} />` | 直接换。按数比较（fiber `:290`），顺带解决数组依赖 |
| 2 | `CabinetLayer.tsx:371-372`、`:376` | 轮廓线：自己的一个盒子（从不画）+ `new THREE.EdgesGeometry(geometry)` | `<edgesGeometry args={[source]} />`，`source` 仍是一个记住的盒子 | 轮廓线要从一个几何体算出来，JSX 不能把几何体写进另一个几何体的 `args`，所以还得留一个代码里做的"源"。源从不画，不占显卡，没人引用后自然回收 |
| 3 | `CabinetLayer.tsx:414-440`、`:454` | 台面石材：`ExtrudeGeometry`，做完再 `rotateX`、`translate` | `<extrudeGeometry>` 不能在建好后转和抬。两条路：把转和抬放到网格上（`rotation`/`position`）；或者写一个自定义几何体类，构造里照现在的步骤做，用 fiber 的 `extend` 登记，再补 TypeScript 的类型声明 | **难**。前一条路顶点数据和今天的不再逐位相同，石材的明暗、阴影可能差最后一位，像素逐字节比对有风险。后一条路要新类、登记、类型。另外 `args` 里的选项对象每次渲染都是新的，必须记住，否则每帧重建 |
| 4 | `KitchenShell.tsx:47-60`、`:98`；`WindowLayer.tsx:168-190` | 后墙：`wallWithWindows` 返回 `ShapeGeometry` | `wallWithWindows` 改成返回 `Shape`，网格里写 `<shapeGeometry args={[shape]} />` | 直接换。函数的返回类型和注释要改 |
| 5 | `KitchenShell.tsx:61-74`、`:118` | 左墙，同上 | 同上 | 同上 |
| 6 | `ApplianceModel.tsx:103-106`、`:152` | 选中时的轮廓：`EdgesGeometry(new BoxGeometry(…))` | 同 #2：`<edgesGeometry args={[source]} />` | 同 #2 |
| 7 | `ApplianceModel.tsx:1746-1759`、`:1774`；`:1901-1973`、`:1975-1993` | 油烟机外壳：`canopyGeometry` 手搭顶点再 `computeVertexNormals`；`wedgeGeometry` 是 `ExtrudeGeometry` 再 `rotateY`、`translate` | 两个自定义几何体类，`extend` 登记，补类型；或 `<bufferGeometry>` 加 `<bufferAttribute>`，但算法线要在建好之后，得用 ref 加副作用 | **难**。另外这个 `useMemo` 在 `:1703` 一个提前 `return` 之后（见第 7 节后的顺带发现） |
| 8 | `HoodCabinet.tsx:40`、`:70`；`:158-202` | 罩柜的弧形段：`shell` 手搭顶点再算法线 | 同 #7 | **难** |
| 9 | `RoughInLayer.tsx:153-163`、`:210` | 引线：代码里做整条线（`BufferGeometry().setFromPoints` + `lineMaterial` + `computeLineDistances`），`<primitive>` 挂上 | `<lineSegments>` 里写几何体和材质两个子元素。虚线要先有几何体才能算 `lineDistance`：要么写一个自己算 `lineDistance` 的几何体类（照抄 three 的算法），要么 ref 加副作用 | **难**。`<primitive>` 本来就不释放（`:147-148`），几何体和材质都留下。虚线是安装模式画面里的东西，算法抄得不一样就会变 |
| 10 | `RoughInLayer.tsx:167-177`、`:209` | 没确认的点位外框：`EdgesGeometry(BoxGeometry)` 的线 + 材质，`<primitive>` | 同 #9，再加 #2 的"源" | **难** |
| 11 | `RoughInLayer.tsx:253-262`、`:269` | 排水高位弯：`THREE.Line` + `setFromPoints(curve.getPoints(32))`，`<primitive>` | 同 #9。另外 fiber 8 没有 `<line>` 元素（和网页 SVG 的 `line` 撞名，`three-types.d.ts` 的 `ThreeElements` 里只有 `lineSegments`、`lineLoop`），要 `extend` 登记一个 `line_` | **难** |
| 12 | `RoughInLayer.tsx:264-267`、`:271` | 确认了的高位弯：`TubeGeometry(curve, …)` | `<tubeGeometry args={[curve, 20, ft(0.8), 6, false]} />` | 直接换（`curve` 仍记住，它不是几何体） |
| 13 | `UtilityLayer.tsx:95-109`（用在 `:633`） | OTR 电线孔的虚线圈：`THREE.Line` + `LineDashedMaterial`，`<primitive>` | 同 #11 | **难** |
| 14 | `UtilityLayer.tsx:175-184`（用在 `:685`） | 穿天花板的风管虚线：同上 | 同 #11 | **难** |
| 15 | `OverhangSupport.tsx:25-42` | 岛台挑出部分的支撑虚线：同上 | 同 #11 | **难** |
| 16 | `BarStools.tsx:18-21`；`barStoolMesh.ts:29-75` | 吧椅：代码里搭一整组（每张椅子 9 个网格，各自 `new` 圆柱、盒子；每张椅子 2 个材质，椅架材质 8 个网格共用），`<primitive>` 挂上 | 整个改成 JSX | **最难**。共用的材质用 JSX 子元素写不出来，只能改成每个网格一个材质；而 `OcclusionFade` 是按材质淡出整张椅子的（`barStoolMesh.ts:25-27` 的注释），要跟着查。`src/data/barStools.test.ts:136` 用 `buildBarStools` 搭组来测 `furnishingHits`，测试也要改 |

**汇总**：16 处里，能直接换的 6 处（#1、#4、#5、#12，加上要留一个"源"的 #2、#6）；另外 10 处要新写 4 个自定义几何体类（石材、外壳、楔形、弧形段），6 条线要登记 `line_` 并自己算虚线距离（或者用 ref），吧椅要重写并改测试。乙大约是这 10 处的画法重写，几百行；甲是一个小 hook 加每处一两行。

### 不改的（查过）

- **`ShaderWarmup.tsx:25-27`、`:32-36`**：一个轮廓线、一个 1 像素贴图，在房间的 key 外面，一页只装一次，不会反复做。
- **`Environment.tsx:36-48`**：已经自己释放。**`SceneDebug.tsx:209-213`**：复制出来的几何体用完就释放。
- **大约 150 处 JSX 几何体**（柜门、机器的各个部件、窗、地板、点位盒子等）：库自己释放，见第 1 节。

### 材质和贴图算不算

渲染器的这个数只数几何体，材质和贴图都不在里面。
- **材质**：JSX 写的材质库自己释放。代码里 `new` 的材质跟着 #9–#11、#13–#16 那几条线和吧椅一起做出来，也没人释放：`RoughInLayer.tsx:39-45`（`lineMaterial`）、`UtilityLayer.tsx:102`、`:178`、`OverhangSupport.tsx:33`、`barStoolMesh.ts:42-43`。它们**不算进 Leo 测试的那个数**。同一种材质共用一个着色程序，所以程序数也不涨，留下的只是内存里的对象。和它们的线一起释放，顺手，放进这一轮。
- **贴图**：`Surface.tsx:60` 和 `CabinetLayer.tsx:39` 每装一次就复制一份贴图，也没人释放。**不算进那个数**：复制的贴图和原图共用显卡里同一张（three 按图源和参数共用，`three.module.js:24822-24834`），所以贴图数一直是 9–10。释放复制品会改变那张共用贴图什么时候真的被丢掉（`:24467-24471`），可能引出重新上传，正是 `Surface.tsx:55-59` 注释里避开的那种卡顿。建议不放进这一轮（第 7 节问题 2）。

### 决定：退回甲

**乙改动太大，我建议全部用甲。** 理由：
1. **乙真正省事的只有 6 处。** 另外 10 处不是把 `new` 换成一个标签那么简单：要新写几何体类、用 `extend` 登记、补类型、给 `THREE.Line` 登记一个元素、自己算虚线距离，吧椅还要重写。这是在新写画法。
2. **这一轮答应的是画面一点不变。** 甲不碰任何一个顶点：还是同一个对象、同一份数据，只是不用了就释放，所以几何底稿和像素在道理上就该逐字节相同。乙把石材、油烟机外壳、罩柜弧形段、安装模式的虚线换了做法，每一处都可能差最后一位，要靠像素比对一处处去查。
3. **吧椅牵连别处。** 乙要改淡出用的材质结构和一个单元测试；甲只在卸下时把那一组释放掉，`barStoolMesh.ts` 和它的测试都不动。
4. **甲的弱点是漏掉一处就还会涨。** 第 4 节的新测试读的就是渲染器的数，漏掉的那处只要在测试走的状态里被画过，测试就红。测不到的是测试没走到的状态（例如没有走到的套餐或手机），这一点在第 4 节说明。

**甲具体做什么**：
- 一个小 hook（`src/three/useDisposable.ts`，新文件）：传进来的东西换掉或卸下时调它的 `dispose()`；传进来的是一个 three 物体（一条线、一组吧椅）时，顺着里面每个网格，把几何体和材质都释放掉。
- 16 处每处在记住的那个值旁边加一行用它。#1 是 `useBoxGeometry` 一处，管住 #1 和 #2 里的两个盒子。
- 三处数组依赖改成数：`useBoxGeometry` 的 `[size]` 改成三个数；`RoughInLayer.tsx:177` 的 `resolved.size`、`:251` 的 `at` 同样。数一样就不再重做，数一样做出来的东西也一样，画面不变。
- 用了已释放的几何体再画，three 会重新上传它（`:17539-17549` 重新登记），不会画成空的。所以即使 React 开发模式（`main.tsx:30` 的 `StrictMode`）把副作用跑两遍，画面也不会坏。线上和测试用的是正式构建，不跑两遍。

**如果 Leo 仍想用乙的写法**：可以只在那 6 处用乙，其余 10 处用甲。好处是数量最多的柜体盒子和轮廓线由库自己释放；代价是一个代码库里有两种规矩，读代码的人要知道哪处是哪种。我仍建议全部用甲（第 7 节问题 1）。

---

## 3. 要改的文件（按甲）

| 文件 | 改什么 |
|---|---|
| `src/three/useDisposable.ts`（新） | 第 2 节说的那个 hook |
| `src/three/CabinetLayer.tsx` | #1、#2、#3：`useBoxGeometry` 依赖改成三个数并释放；轮廓线、台面释放 |
| `src/three/KitchenShell.tsx` | #4、#5：两面墙释放 |
| `src/three/ApplianceModel.tsx` | #6、#7：选中轮廓、油烟机外壳释放 |
| `src/three/HoodCabinet.tsx` | #8：弧形段释放 |
| `src/three/RoughInLayer.tsx` | #9–#12：三条线连同材质、管子释放；两处数组依赖改成数 |
| `src/three/UtilityLayer.tsx` | #13、#14：两条虚线连同材质释放 |
| `src/three/OverhangSupport.tsx` | #15：虚线连同材质释放 |
| `src/three/BarStools.tsx` | #16：整组吧椅卸下时释放 |
| `tests/geometryReturn.test.ts`（新） | 第 4 节 |
| `docs/decisions.md` | 这一轮的条目，Leo 的答复 |

不动：`Scene.tsx`、`WindowLayer.tsx`、`barStoolMesh.ts`、`src/data/` 下的一切、`src/ui/` 下的一切。

---

## 4. 测试怎么先红后绿

**做的顺序**：先写测试，在旧代码（99c 之后的那一版）上跑，红，把每一项的数列给 Leo；再改代码，绿。

**`tests/geometryReturn.test.ts`**（新，浏览器，照 `tests/layoutTabSwitch.test.ts` 的写法）：
- 用 `tests/globalSetup.ts` 起的正式构建（`PREVIEW_URL`），链接带 `?quality=high&qualityLock=1`，守卫不会中途降档。
- 开页前装上 `__THREE_DEVTOOLS__` 钩子，拿到渲染器，和 `scripts/swapMemory.mjs` 同一种做法，读 `renderer.info.memory.geometries`。
- **读数前等它稳住**：库是空闲时才释放的（fiber `:173`），新房间也要先画出来，才会算进去。每 0.5 秒读一次，连续三次一样才算数，最多等 10 秒；等不到就判红，并说是等不到。
- **两次读数时界面一样**：同一个形状、同一个显示模式、同一个格子选中、同一张卡片开着。选中的机器有一条轮廓线（#6），状态不一样就会多一条，冤枉代码。
- **确认真的换了**：换走之后，新型号的 `aria-pressed` 是 `true`；换回来之后，原来那个是 `true`。没换成就判红，不当作通过。
- 电脑 1440 宽，鼠标。照 `layoutTabSwitch.test.ts` 数一下测试真跑了几条。

**每一项都断言换回来以后的数和换走前完全相等**（`toBe`，不给余量）。旧代码上会差多少，是用第 100 轮量到的数推的，**是估计，没跑**：

| 项 | 怎么走 | 旧代码上估计多出 |
|---|---|---|
| 换油烟机再换回 | L 型，成品模式。点油烟机的点，卡片开着，读；点另一个装得下的，再点回原来的，读 | 约 +100 到 +120（两次整间重建，每次 50–60） |
| 换灶再换回 | 同上，灶 | 约 +100 到 +120（第 100 轮换的灶每次都 50–60） |
| 换洗碗机再换回 | 同上，洗碗机；房间不重建 | 约 +20（每次 10 个左右） |
| 换套餐再换回 | L 型，A → B → A，不选格子 | 约 +100（两次整间重建；B 的房间有多少件没单独量过） |
| 安装模式下换油烟机再换回 | 选中油烟机，切到安装模式，读；切回成品模式换走、换回；再切到安装模式，读 | 约 +150 到 +200。安装模式会把柜体轮廓线、管线、虚线都画出来，这些在成品模式下不算数，只有这一项能管住它们 |
| 一字型换套餐再换回 | 切到一字型，A → B → A | 没量过。每次整间重建都留下整间房，应明显大于 0 |

哪一项在旧代码上没有红，那一项就证明不了什么：把它的数报出来，换一个会改动几何体的型号再试，不留着一项永远是绿的测试。

**其余测试**：全套照跑，都该照样绿。`src/data/barStools.test.ts` 不改。

---

## 5. 证明哪些不变

- **L 型几何**：`scripts/lDump.ts`，1,045 间，和改之前的提交逐字节相同。它只读 `src/data/`，这一轮不改那里，本来就该相同，照样跑。
- **一字型底稿**：`scripts/oneWallDump.ts`，91 间，逐字节相同。
- **像素**：`scripts/pixelShots.mjs`，第 99 轮的 45 个状态，链接带 `?qualityLock=1`。高档（`QUALITY=high`）、低档（`QUALITY=low`）各一套，旧新各拍两次交替（旧、新、旧、新），用 `scripts/pixelCompare.mjs` 比。3D 画面和整个画面都必须完全相同；同一版本自己两次之间的差别也列出来。
- **全套测试**，包括新测试。
- **`scripts/swapMemory.mjs`** 改前改后各跑一次 50 次，列出对比。改前应该和第 100 轮一样（238 → 2,019）。改后应该不再一路涨：数会随站着的型号上下几个，但 50 次以后应该还在开页那个数附近。只有"换回同一间房"才要求完全相等，那是第 4 节的测试。

---

## 6. 会变的

**画面上什么都不该变。** 变的只是看不见的：渲染器的几何体数不再越换越多，内存里的旧对象被回收。

万一做错，会在哪里露出来：
- **把还在用的东西释放了**：three 会把它重新上传，画面仍在，但多一次卡顿。16 处里没有两个网格共用一个几何体；吧椅一张椅子的 8 个网格共用一个材质，只在整组卸下时才释放。
- **数组依赖改成数时写错了**：柜体会留着旧尺寸。像素比对里所有套餐的状态都会露出来。
- 和具体状态对应：
  - 柜体盒子、台面、墙：45 个状态全部；
  - 台面的灶孔、水槽孔：换灶的状态，飞到机器的状态；
  - 油烟机外壳、罩柜弧形段：飞到油烟机的状态、带罩柜的套餐；
  - 安装模式的轮廓线、管线、虚线、电线孔、风管、岛台支撑线：三种模式里安装模式的那些状态；
  - 吧椅：有岛台座位的套餐、第 97 轮带岛台的链接。
- 手机和电脑走同一套代码。手机上柜体轮廓线用的是 `CABINET_OUTLINES`，安装模式下不画柜体盒子（`CabinetLayer.tsx:296`）；释放的写法一样，但第 4 节的测试只在电脑上跑（第 7 节问题 3）。

---

## 7. 要 Leo 答的问题

1. **全部用甲（我建议），还是那 6 处能直接换的用乙、其余 10 处用甲？**
2. **复制的贴图**（`Surface.tsx:60`、`CabinetLayer.tsx:39`，不算进几何体数）：另外登记一条，不放进这一轮（我建议），还是这一轮一起管？
3. **新测试只在电脑 1440 上跑，还是也在手机上跑？** 手机上柜体轮廓线是另一份列表（`CABINET_OUTLINES`），安装模式也不一样。第 99b 轮的测试你定的是电脑、平板、手机三种宽度；平板 768 宽走的是电脑那条路，所以我建议加手机一种就够。

---

**顺带发现，登记，不放进这一轮**（只读推断，没在运行中验证）：
1. 画质降档时 `disposeTextures`（`textures.ts:565-567`）只释放原图。复制品没释放，那张共用的贴图引用数就到不了零，高档的 512 像素贴图可能一直留在显卡里。
2. `ApplianceModel.tsx` 油烟机那段，`:1746` 的 `useMemo` 在 `:1703` 一个提前 `return` 之后，是有条件的 hook。今天不出事，因为换油烟机每次都整间重建，组件是重新装的。哪天换油烟机不再重建，从嵌入式换成别的种类就会报错。
