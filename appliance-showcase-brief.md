# 北美家电 3D 展示网页 — CC 开工简报

版本 v0.1 · 2026-09-05 · 作者 Leo（由 Claude 整理）

---

## 0. 一句话目标

做一个"栖居 HABITAT"风格的单页交互产品：以一个**等距（isometric）3D 厨房**为舞台，用户旋转/缩放/点击厨房里的每台家电，弹出该家电的参数卡、可替换同位机型、并能生成"整套配置单"发给销售。

---

## 1. 参考产品拆解（视频 "栖居 HABITAT"）

### 1.1 布局（三栏 + 顶栏 + 底部工具条）

| 区域 | 参考产品内容 | 我们的对应内容 |
|---|---|---|
| 顶栏 | Logo + 项目编号/名称 + "交互式空间探索"标签 + 帮助 + 全屏 | Logo + 厨房方案名（如 "Scheme 01 · Modern Farmhouse"）+ 语言切换 EN/中 + 全屏 |
| 左栏 | Hero 文案；两个大数字（120 m² / 06 空间）；房间列表（名称+面积+箭头，点击飞入） | Hero 文案；两个大数字（家电件数 / 套餐总价区间）；**家电列表**（冰箱/灶具/烤箱/洗碗机/油烟机/微波炉…，每行显示品牌+型号+价格，点击飞入） |
| 中央 | 3D 等距场景；房间 pin 标签（01 客厅…）；顶部三档渲染模式：真实材质 / 白模 / 线框；切换时底部 toast 提示 | 3D 等距厨房；**家电 pin 标签**；顶部三档：真实材质 / 白模（看橱柜与开口尺寸）/ **安装模式**（线框橱柜 + 排气管道 + gas line + 电路 + 水路，见第 3.5 节） |
| 右栏 | "空间氛围"面板：日间/夜晚、显示家具、空间标注 开关；设计理念 + 材质色点；平面图缩略图 | "配置面板"：日间/夜晚、显示橱柜、显示标注 开关；**当前套餐摘要**（品牌系列 + 总价 + 能源类型 gas/electric/induction）；平面图缩略图（含家电位置） |
| 底部 | 3D 空间 / 平面图 切换；+ − 重置；操作提示"拖动旋转 · 滚轮缩放 · 点击探索细节"；指南针 | 同上，外加 **"Request Quote / 生成配置单"** 主按钮 |

### 1.2 交互细节（值得原样保留）

- 点击左栏房间 → 相机平滑飞入该房间，右下出现 "进入房间 →" 按钮（我们改为 "查看规格 →"）
- 三档渲染模式切换有 toast（"线框模式 · 查看空间结构与家具轮廓"）
- 开关切换即时生效（隐藏家具 / 隐藏标签）
- 日间/夜晚只改光照和色温，不改几何
- 视觉语言：米灰底色、墨绿主色、橡木 + 白 + 绿植；衬线中文大标题 + 小号无衬线英文副标；大量留白

### 1.3 技术推断（未验证）

- 极大概率是 **Three.js / React Three Fiber**，等距正交相机，glTF 低模场景
- 帖子声称"一句 prompt 生成"——无法核实。即使属实，**视频里 80% 的观感来自 3D 模型资产和配色**，不是代码。这是我们要面对的真正瓶颈（见第 4 节）

---

## 2. 我们的产品定义

### 2.1 核心差异（比参考更"人性化"的点）

1. **家电是主角，厨房是舞台**：每个 pin 对应真实 SKU，不是"客厅"这种抽象房间
2. **同位替换（swap-in-place）**：点击冰箱 → 侧栏列出同 cutout 尺寸的 3–5 个替代机型（Sub-Zero / Thermador / Bosch / Miele / GE Café…），切换后 3D 模型颜色/标签即时更新
3. **尺寸合身检查**：用户输入自家 cutout（宽/高/深，英寸）→ 列表里不合身的机型灰掉，并说明差几英寸
4. **套餐总览 + 一键发给销售**：右栏实时汇总总价、能源类型、交期，"Request Quote" 生成一份配置单（JSON + 可读摘要）发到邮箱 / 存到 Google Sheet
5. **双语**：EN 为主，中文切换（服务华人客群）
6. **手机可用**：单指旋转、双指缩放、点击 pin；左右栏在手机上变成底部抽屉

### 2.2 明确不做（v1）

- 不做用户自定义户型/拖拽布局（那是设计软件，不是展示产品）
- 不做在线支付
- 不做 AR / 实景扫描
- 不做后台管理 UI（数据直接维护在 Google Sheet / JSON）

---

## 3. 数据模型（先定这个，再画一个像素）

```ts
type Appliance = {
  id: string;                 // "fridge-01"
  category: "refrigerator" | "range" | "cooktop" | "wall-oven"
          | "dishwasher" | "hood" | "microwave" | "wine" | "other";
  brand: string;              // "Thermador"
  model: string;              // "T36IT905NP"
  series?: string;            // "Freedom Collection"
  priceUSD: number;
  fuel?: "gas" | "electric" | "induction" | "dual";
  widthIn: number; heightIn: number; depthIn: number;   // 产品尺寸
  cutoutWidthIn?: number; cutoutHeightIn?: number; cutoutDepthIn?: number;
  finish: string[];           // ["stainless","panel-ready","matte-black"]
  leadTimeWeeks?: number;
  highlights: { en: string[]; zh: string[] };
  imageUrl?: string;
  slot: SlotId;               // 在厨房里占哪个位置
};

type Slot = {
  id: SlotId;                 // "slot-fridge" | "slot-range" | ...
  label: { en: string; zh: string };
  position: [x, y, z];        // 3D 场景坐标
  cutout: { w: number; h: number; d: number };  // 该位置的开口尺寸
  compatibleCategories: Category[];
};

type Scheme = {
  id: string;                 // "scheme-01"
  name: { en: string; zh: string };
  concept: { en: string; zh: string };
  palette: string[];
  defaultSelection: Record<SlotId, Appliance["id"]>;
};
```

数据源：一张 Google Sheet（Leo 已有类似系统）→ 构建时导出为 `data/appliances.json`。v1 不接实时 API。

---

## 3.5 安装约束层（橱柜 · 排气 · 燃气 · 电 · 水）

这是本产品区别于"好看的 3D 页面"的核心：**每类家电绑定一套橱柜配置和管线要求，场景里画出来，换机型时自动校验。**

### 3.5.1 家电类别 → 橱柜配置 → 管线

| 类别 | 安装形式（决定橱柜） | 橱柜配置要点 | 管线 |
|---|---|---|---|
| 冰箱 | freestanding / counter-depth / built-in / integrated (panel-ready) | 围合宽度 30–48"、顶柜高度、两侧 finished panel、integrated 需门板与铰链预留 | 120V 专用插座；制冰 → 1/4" 水线 |
| 灶台 Range | freestanding / slide-in / pro-style | 30/36/48" 橱柜间隙、slide-in 需台面切口、pro-style 后墙防火材料、anti-tip 固定 | Gas：1/2" 或 3/4" 管（按总 BTU）+ 关断阀；Electric/Induction：240V 40–50A；Dual fuel：两者都要 |
| 炉头 Cooktop | drop-in | 台面切口尺寸、下方柜体（抽屉或 wall oven）净空 | Gas 同上；Induction 240V |
| 嵌入烤箱 Wall oven | single / double / combo | 高柜 tall tower 或 base cabinet 内嵌，开口高度、通风缝 | 240V 专线 |
| 油烟机 Hood | wall-mount / under-cabinet / island / insert(liner) / downdraft | 上方吊柜是否保留、宽度 ≥ 灶台宽、离灶面高度 | 排气管 6"/8"/10"（按 CFM）；走向：向上穿柜出屋顶 / 向后穿墙；≥400 CFM 需 makeup air（加州 Title 24）；无法排外则 recirculating |
| 洗碗机 | 24" 标准 / 18" 紧凑 / panel-ready | 底柜开口 24"×34"×24"，门板预留 | 120V；热水线；排水接 sink/air gap |
| 微波炉 | OTR / built-in + trim kit / drawer | OTR 占用灶台上方吊柜位（与 hood 互斥）；drawer 占 base cabinet | 120V；OTR 排气或内循环 |

### 3.5.2 数据模型补充

```ts
type Slot = {
  // ...原字段
  cabinetConfig: {
    type: "base" | "tall" | "upper" | "enclosure" | "countertop-cutout";
    openingIn: { w: number; h: number; d: number };
    panelReady: boolean;
    finishedSides: number;
  };
  utilities: {
    gas?:   { pipeSize: '1/2"' | '3/4"'; shutoff: boolean };
    power:  { voltage: 120 | 240; amps: number; dedicated: boolean };
    water?: { supply: boolean; drain: boolean };
    duct?:  { diameterIn: 6 | 8 | 10; route: "up-through-cabinet" | "back-wall" | "recirc" };
  };
};

type Appliance = {
  // ...原字段
  installType: string;           // 见上表"安装形式"
  requires: {
    gasBTU?: number;               // 总 BTU → 决定管径
    voltage: 120 | 240; amps?: number;
    water?: boolean;
    cfm?: number;                  // 油烟机 → 决定管径 + makeup air
    makeupAirRequired?: boolean;   // cfm >= 400 时自动置 true
  };
};
```

### 3.5.3 场景表现（安装模式 = 第三档渲染）

- 橱柜转线框，家电半透明，台面切口/开口尺寸标注（英寸）
- 管线用固定色：**黄 = gas line**（从灶台后方沿墙到关断阀）、**红 = 240V / 蓝点 = 120V 插座**、**浅蓝 = 水线/排水**、**灰色空心管 = 排气管**（画出实际走向：穿吊柜向上 or 穿后墙）
- 点击任意管线 → 小卡片说明规格与为什么需要（例如"36" 灶台 6 头 60k BTU → 3/4" 管"）
- 右栏新增"安装清单"折叠区：当前套餐所需的全部管线 + 橱柜改动，可随配置单一起导出

### 3.5.4 换机型时的自动校验（这是销售最常在现场解释的东西）

| 触发 | 提示 |
|---|---|
| 选了 induction，槽位只有 120V | "需要新增 240V/40A 专线" |
| 选了 dual fuel | "同时需要 gas line + 240V" |
| 选了 ≥400 CFM 油烟机 | "加州需 makeup air 系统" |
| 选了 OTR 微波炉 | 自动隐藏/冲突提示 hood 槽位 |
| 选了 integrated 冰箱 | "橱柜需门板 + 铰链预留，交期 +X 周" |
| 机型宽度 > 槽位开口 | 灰掉 + 显示差值 |

规则写在 `data/rules.json`，不写死在代码里，Leo 自己可维护。

---

## 4. 3D 资产策略（最大风险，先决策）

| 方案 | 效果 | 成本 | 适合 |
|---|---|---|---|
| A. 程序化低模（Three.js 基础几何拼厨房 + 家电盒体贴 logo/颜色） | 干净、统一、"白模"风格天然好看；真实材质档会偏简陋 | CC 可全代码生成，0 资产采购 | **MVP 首选** |
| B. 免费 glTF 资产（Kenney / Poly Haven / Sketchfab CC 许可） | 接近视频效果 | 找资产 + 调尺寸 4–8 小时人工；许可要逐个确认 | v1.5 |
| C. 2.5D 等距 SVG/插画 + 热点 | 视觉可以很精致；无真 3D 旋转（可做 4 个固定视角） | 需要插画师或 AI 出图后手工切层 | 若 3D 做不出质感的退路 |
| D. 真实展厅照片 + 热点 | 最"真"，最快上线 | 拍摄 + 标注 | 最保守备胎 |

**建议**：A 起步，架构上把"家电模型"抽象成可替换组件，后续换 B 不用改交互层。

---

## 5. 技术栈（给 CC 的约束）

- React 18 + Vite + TypeScript
- **@react-three/fiber + @react-three/drei**（OrbitControls、Html 标签、正交相机）
- 状态：zustand（选中家电、渲染模式、日夜、语言、cutout 输入）
- 样式：Tailwind；设计 token 见第 6 节
- i18n：简单的 `t(key)` + 两个 JSON，不上重型库
- 部署：GitHub Pages（Leo 已有 geesonchan.github.io 流程）
- 手机：drei 的 OrbitControls 自带触控；面板用抽屉组件

---

## 6. 设计 token（照参考产品的气质）

```
--bg:         #EFEDE6   米灰底
--surface:    #F7F5EF   面板
--ink:        #1F2A22   主文字
--ink-muted:  #6B7268
--accent:     #2E5C45   墨绿（按钮/激活态）
--wood:       #C9A77B   橡木
--line:       #D8D4CA
字体：标题 Noto Serif SC / 英文 Cormorant；正文 Inter / Noto Sans SC
```

---

## 7. 交付分期

**M1 · 骨架（CC 第一轮，目标 1 个工作日）**
- 三栏布局 + 顶栏 + 底部工具条，全部 UI 用假数据渲染
- 程序化低模厨房：地板、两面墙、L 型橱柜、6 个家电盒体（fridge / range / hood / dishwasher / wall-oven / microwave）
- 旋转、缩放、重置；点击左栏 → 相机飞入；pin 标签跟随
- 三档渲染模式（安装模式 M1 先画橱柜线框 + 静态管线几何：gas 黄线、排气灰管、240V 红点）+ 日夜切换 + 两个开关 + toast
- 验收：手机 Safari 能流畅旋转

**M2 · 数据与业务（第二轮）**
- 接 `appliances.json` + `rules.json`；家电详情卡；同位替换；套餐汇总；cutout 合身检查
- 安装模式接真实数据：管线随所选机型变化；第 3.5.4 节校验规则；右栏"安装清单"
- 中英切换
- "Request Quote" 生成配置单（先 mailto + 复制 JSON，后接 Google Apps Script 写入 Sheet）

**M3 · 打磨**
- 真实材质档换 glTF 资产（方案 B）
- 平面图视图（顶视正交 + 家电占位矩形）
- 分享链接（URL 编码当前套餐）

---

## 8. 开工前 Leo 需要拍板的 3 件事

1. **舞台范围**：只做一个厨房（推荐），还是像参考那样整套房子？→ 影响资产量 3–5 倍
2. **数据从哪来**：用 AA Kitchen 真实 SKU（要考虑是否需要雇主授权）还是先用公开机型做 demo？
3. **产品定位**：给自己做作品集/内容资产，还是准备给店里/其他零售商用？→ 决定是否要 M2 的 quote 流程和多方案（Scheme）

---

## 9. 给 CC 的首条指令（可直接粘贴）

```
读取 appliance-showcase-brief.md。按第 5 节技术栈初始化项目，完成第 7 节 M1 的全部内容。
约束：
- 3D 场景先全部用程序化几何体，不下载任何外部模型
- 家电模型封装为 <ApplianceModel slot category finish /> 组件，后续可替换为 glTF
- 橱柜和管线各自独立图层：<CabinetLayer />、<UtilityLayer type="gas|power|water|duct" />，安装模式只是切换图层可见性，不重建场景
- Slot 定义先按第 3.5.2 节结构写死 6 个槽位的 cabinetConfig 和 utilities，M2 再接 JSON
- 所有文案走 t() 函数，先只填 en
- 每完成一个子功能就 git commit，commit 信息用英文祈使句
- 不要引入 M1 之外的功能；遇到设计歧义按第 1 节参考产品的做法
完成后给我一份：已实现清单 / 已知问题 / 你建议 M2 先做什么。
```

---

## 10. 视觉与体验验收标准（CC 的及格线，对照 ref_*.png）

参考图：`ref_overview.png`（全景 + 真实材质）、`ref_wireframe.png`（线框档）、`ref_zoomed_room.png`（飞入房间后）。

**必须达到（M1 结束时）**
- [ ] 首屏三栏比例、留白、字号层级与 ref_overview 肉眼一致（左栏 ≈ 15%，中央 ≈ 65%，右栏 ≈ 20%）
- [ ] 等距视角默认角度接近参考（俯角约 35°，方位约 45°），场景居中且不被面板遮挡
- [ ] 相机飞入动画 ≥ 600ms、缓动（ease-in-out），不是瞬切
- [ ] pin 标签始终朝向屏幕，随缩放保持可读，被遮挡时淡出
- [ ] 三档渲染切换 < 100ms，且有 toast
- [ ] 日夜切换只改光照与色温，场景不闪烁
- [ ] 手机 Safari：单指旋转、双指缩放、60fps 不掉帧（6 个盒体场景下）
- [ ] 无 console 错误；Lighthouse 性能 ≥ 85

**超过参考（M2–M3 目标）**
- [ ] 安装模式下管线走向清晰，点击可解释
- [ ] 换机型 3D 即时更新 + 校验提示
- [ ] 中英切换不重排布局
- [ ] 配置单一键导出

**工作流要求**
- 每轮迭代用 Playwright 截三张图（全景 / 线框 / 飞入）放到 `screenshots/round-N/`，与 ref 并排给 Leo 审
- Leo 只对截图给反馈，不读代码
