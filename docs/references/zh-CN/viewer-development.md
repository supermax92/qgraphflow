# Viewer 开发与维护

[English](../../../skills/q-flow/references/viewer-development.md) · [简体中文](viewer-development.md) · [Русский](../ru/viewer-development.md) · [Português](../pt/viewer-development.md) · [日本語](../ja/viewer-development.md) · [Deutsch](../de/viewer-development.md) · [Español](../es/viewer-development.md)

模块在构建时组合：源码修改并构建后，生成器把所有功能嵌入独立 HTML，不存在运行时插件下载或热加载。普通图生成仍只输出 `index.html` 与 `graph.json`。

## 修改入口

以下源码路径相对于 `assets/viewer/src/`。

| 目标 | 入口 | 职责 |
| --- | --- | --- |
| 新增图类型 | `diagrams/<type>.js`、`diagrams/registry.js` | 名称、顺序、合法类型、专属校验、绘制、轮廓与关系策略 |
| 修改主题、字号或行高 | `visual-style.js`、`radix-colors.js` | 页面与导出共享的 Radix 色阶、主题变量、语义色、核心识别与尺寸 |
| 修改节点形状或内部布局 | 对应 `diagrams/<type>.js`；共享卡片用 `diagrams/card.js` | 同时作用于页面和 SVG/PNG 节点 |
| 修改共享 SVG 排版与图元 | `diagrams/drawing.js` | `svgStyles()`、转义、共享图元；页面内限定作用域，导出复用 |
| 修改工具栏、详情或响应式外壳 | `ViewerShell.jsx`、`styles.css` | 页面外壳；不再用第二套 HTML/CSS 实现节点内容 |
| 修改画布辉光 | `effects.css`，由 `main.jsx` 在 `styles.css` 之后引入 | 角色、选择、流动辉光与暗色晕影；只用调色板变量，可整文件移除，降低透明度或提高对比度时关闭 |
| 修改选择或搜索 | `features/useSelection.js`、`search.js` | 共享选择、反馈、键盘、取消；搜索排序可独立测试 |
| 修改有向边流动 | `features/useViewerController.js`、`DiagramCanvas.jsx` | 仅表示方向，由独立开关与减少动态效果偏好控制 |
| 修改阅读图例 | `ViewerShell.jsx`、`styles.css`；内容来自 `legend.js`、`visual-style.js` | 从实际类别和线型生成浮动图例；保留原始符号、共享 `nodeAppearance` 颜色和核心优先级 |
| 修改面板与焦点 | `features/usePanels.js` | 手机端互斥、可见性与焦点返回；切图保留面板偏好 |
| 修改画布全屏 | `features/useFullscreen.js`、`features/useSelection.js` | 原生全屏、失败提示、焦点返回；全屏选择不打开外部检查器，Escape 先退出全屏 |
| 修改拖动、视口、锁定或间距 | `features/useGraphLayout.js`、`layout-nudge.js` | 当前位置与布局操作；D3 仅作有界微调 |
| 修改呈现状态 | `features/usePresentation.js` | 将选择与搜索投影到节点、边，不另设状态所有者 |
| 修改下载 | `features/download.js`、`export-svg.js` | 按当前坐标生成静态 SVG，再由它栅格化 PNG |
| 修改路由或布局校验 | `edge-routing.js`、`text-layout.js` | 页面、导出、校验共享路径、换行与测量 |

`main.jsx` 管加载、切图、主题、各图编辑草稿；`features/useViewerController.js` 组合能力并协调保存/重置；`ViewerShell.jsx` 绑定 UI。优先扩展现有模块，仅在状态和生命周期独立时新增 Hook。

## 新增图类型

1. 在 `diagrams/` 新增默认导出定义的模块。
2. 在 `diagrams/registry.js` 导入并加入 `DIAGRAMS`；注册顺序就是集合菜单顺序，单图仍无类型菜单。
3. 更新 `graph-schema.md`、`visual-contract.md` 与 SKILL 中的作图说明。注册新类型不一定需要改数据结构。
4. 构建模板、生成示例，验证专属节点、关系和浏览器交互。

复用规则和图元。完全继承架构图规则的卡片视图只需 `{ ...architecture, id: 'new-view', label: 'New view' }` 加注册。独立类型通常包含：

```js
export default {
  id: 'new-view', label: 'New view',
  nodeKinds: ['component'], groupKinds: [], edgeKinds: ['call'],
  outline, // (node, x, y) => [[SVG 标签名, 几何属性], ...]
  render,  // (node, x, y, fill, stroke, palette) => SVG 字符串
};
```

`render` 用 `paint(outline(node, x, y), { fill, stroke })` 绘制主体，用 `text` / `centeredTitle` 绘制文字。模块代码可信，图数据不可信；不得未经共享转义就把输入拼接到 SVG 标签、属性或文字。

按需增加可选钩子：

- `validateNode`、`validateEdge`：在公共校验后追加约束，复用传入的 `requireString`、`validateStringArray` 等。每次校验新建时序顺序集合。
- `edgeLabel`、`undirected`、`dashedKinds`、`markers`：关系标签、方向、证据线型以外的专属虚线及现有 UML 标记。
- `cardLayout`、`compartments`、`sequence`、`cardinalities`、`endpointStub`、`selectionHeight`：现有卡片校验、核心分区、生命线、ER 端点和选择高度规则。

矩形卡片可复用现有规则。完全不同的路由、连接点或 UML 符号仍需扩展共享路由/绘图；注册不能推断未知几何。新语义类型在 `visual-style.js` 增加名称与 `nodeAppearance` 分类。生成 HTML 和导出 SVG 保留 `radix-colors.js` 的 Radix MIT 声明。

## 共享渲染约束

`DiagramCanvas.jsx` 和 `export-svg.js` 都调用 `node-svg.js` 的 `renderNode()`。页面把 SVG 插入 React Flow 节点，导出把画布偏移传给同一渲染器。`SelectionOutline.jsx` 调用 `renderSelection()`，复用类型的 `outline`，仅修改描边、不透明度和阴影。

位置、内容与临时交互分离：拖动改变当前坐标，选择不改变坐标或形状。导出只接收当前图与主题，不接收选择或动画状态。边界、React Flow 标记适配和页面控件仍由宿主专门绘制；共享节点内容不代表页面 DOM 与导出 SVG 完全相同。

## 构建与回归

在技能目录中使用已有依赖和浏览器工具：

```bash
npm --prefix assets/viewer run build
node --test scripts/*.test.mjs
node scripts/generate-viewer.mjs /tmp/graph.json /tmp/new-viewer
node scripts/browser-interactions.mjs /tmp/new-viewer /tmp/new-viewer-check
```

左下角全屏按钮使画布进入原生全屏，浮动面板与顶部工具栏留在外部。尺寸改变后只适配当前图一次，不改变选择和布局；退出时保留视口。靶心图标适配图，四角图标切换全屏。旧 HTML 须重新生成才能带上新功能。不支持全屏时标记控件不可用；请求失败在画布状态区域提示。

全屏验收使用真实浏览器 API。`QA_HEADED=1` 打开可见浏览器以检查全屏、Escape 和焦点：

```bash
QA_HEADED=1 QA_ONLY_EXTRAS=1 QA_EXTRAS=fullscreen,fullscreen-errors \
node scripts/browser-interactions.mjs /tmp/new-viewer /tmp/fullscreen-check
```

浏览器脚本对所提供的每种类型测试三种尺寸、明暗主题和交互。完整矩阵须提供九图集合。`QA_FIXTURE_DIR` 添加特殊形状样本。脚本依赖相邻源码模块，不能单独复制运行。

详情跟随用户选择：`useSelection` 管选择，`useViewerController` 推导 `inspectedNode`；`ViewerShell` 的速览卡和检查器消费它。没有自动播放、分步阅读或流程编排。图例位于画布左上浮动按钮；`.inspector-facts` 保持为详情末节。`DiagramCanvas` 的 `has-flow` 与 `styles.css` 控制边流动时静态层对比度；选择不能填满流动虚线的间隙。

```bash
QA_ONLY_EXTRAS=1 QA_EXTRAS=flow-contrast,inspector-sync \
node scripts/browser-interactions.mjs /tmp/new-viewer /tmp/new-viewer-sync-check
```

`diagram-modules.test.mjs` 在临时副本添加第十个测试类型，只修改副本模块与注册表，并执行校验、构建、生成；产品仍支持九种类型。设置 `MODULE_TEST_OUTPUT=/tmp/new-module-check` 保留副本，用其中的 `skills/q-flow/scripts/browser-interactions.mjs` 检查 `page/`。副本保留仓库层级与根第三方声明，以验证实际构建依赖。目标目录不能已存在。

Viewer 修改后重建 `assets/viewer-dist/index.html`。安装后检查实际缓存，在新会话用已安装版本生成验收产物。既有独立 HTML 内嵌旧代码，必须重新生成。

## QGraphFlow 命名与迁移

| 标识 | 旧 | 新 |
| --- | --- | --- |
| 产品 | CodeGraph Flow | QGraphFlow |
| 插件 ID | `codegraph-flow` | `qgraphflow` |
| 技能目录与调用 | `create-interactive-codegraph` / `$create-interactive-codegraph` | `q-flow` / `$q-flow` |
| 技能显示名 | CodeGraph Flow｜交互式软件图 | Q flow |
| 私有 Viewer 包 | `codegraph-flow-viewer` | `qgraphflow-viewer` |
| 默认交付目录 | `docs/codegraph-flow/<scope>-<diagram-type>/` | `docs/qgraphflow/<scope>-<diagram-type>/` |

包中只保留新技能入口，无旧别名，范围仍为九类软件图。MapSprig / QMindFlow 更名不在本迁移范围。

在仓库根目录使用新路径：

```bash
node skills/q-flow/scripts/validate-graph.mjs /tmp/graph.json
node skills/q-flow/scripts/generate-viewer.mjs /tmp/graph.json docs/qgraphflow/example-architecture
```

默认目录是技能交付约定，生成器仍要求明确输出目录。用户选定的旧目录（包括 `docs/codegraph-flow/`）继续可用；覆盖已有输出仍需 `--force`。旧 `graph.json` 无需改写，标题、来源、节点和证据中作者写入的旧名称保留。旧 HTML 可离线使用但显示内嵌旧品牌；从原 JSON 重新生成即可更新。

`CodeGraph`、`codegraph`、`@colbymchenry/codegraph`、`.codegraph/` 属于外部分析工具，不变。内部 `__CODEGRAPH_FLOW_DATA__`、`codegraph-*` SVG 标识和测试临时目录前缀也保留。

### 本地安装与更新

Codex、Claude Code、Qoder、Cursor 的安装、更新、移除和验证状态见[客户端安装指南](../../clients.zh-CN.md)。仓库修改不会自动刷新已安装插件。安装/迁移时核对真实来源与版本，使用客户端管理入口，保留用户图与其他插件配置。

<a id="viewer-visual-and-interaction-contract"></a>

## Viewer 视觉与交互契约

仅在维护 Viewer 或审查交互时阅读本节。作图使用 [visual-contract.md](visual-contract.md)。

### 共享呈现

- 使用画布优先的 React Flow 外壳。画布铺满窗口，在一条 52px 材质工具栏下方延伸；工具栏包含导航开关、集合视图菜单、标题/副标题、带结果浮层的搜索、含导出/重置/布局锁定/间距/外观的 `···` 菜单和检查器开关。无看板头、页脚或品牌块，产品名仅在文档标题中。导航与检查器从各自边缘滑入，所有宽度均默认收起。点击节点在旁边显示速览卡（类型、名称、职责、来源、最多四个标签、`查看详情`），不直接打开检查器；视觉重点留给图。
- 外观默认跟随 `prefers-color-scheme` 并实时更新；`···` 提供 `跟随系统 / 浅色 / 深色` 分段选择，手动选项在两个方向都优先。切主题保留视口、搜索、选择、布局锁定和面板状态。
- 共用 Radix Colors（MIT）：Slate 用于冷中性表面，Iris 用于核心与交互，Cyan 用于数据，Orange 用于判断/失败。分发源码、独立 HTML、SVG 都保留版权与许可，无需运行时 CDN 或组件库。
- 通过现有 `business` 类型或不区分大小写的 `core`/`business` 标签标记真实业务核心。用 Iris 3 填充、Iris 8 边框、Iris 12 文字；ER/类图应用于头部，成员行保持中性。核心优先于数据/警告分类，初始/终止状态保留实心点/双圈。不得新增 `core` 类型或字面颜色字段。
- 页面、节点、MiniMap、检查器色点、图例、导出共用 `visual-style.js`。普通卡片 Slate 2；浅色画布 Slate 1（`#fcfcfd`，近白），与暗色同为第 1 阶。暗色使用对应暗色阶，不能直接沿用浅色颜色。
- 工具栏、面板、检查器、画布控件的颜色由 `styles.css` 用 `color-mix` 从调色板变量生成：四级标签 `--label`、`--label-2/3/4`，分隔 `--sep`，三级填充 `--fill`、`--fill-2/3`，三种材质 `--material-thick`、`--material`、`--material-thin`。暗色只覆盖材质底色和阴影。外壳文字采用 11 / 12 / 13 / 15 / 20 px，节点 SVG 保留 `TYPOGRAPHY` / `--font-*`；每个控件有 `:active` 与共享 `:focus-visible`，面板用 .5px 细线加一层阴影分隔，`1px solid` 仅用于画布图形。除 `prefers-reduced-motion` 外，响应 `prefers-reduced-transparency`（材质变为不透明 `--panel`、无模糊）和 `prefers-contrast: more`（分隔/次要文字用标签色，浮层加 1px 外框）。

| 用途 | Radix 色阶 |
| --- | --- |
| 页面 / 普通表面 | Slate 1 / Slate 2 |
| 主 / 次文字 | Slate 12 / Slate 11 |
| 核心填充 / 边框 / 文字 | Iris 3 / Iris 8 / Iris 12 |
| 交互 / 有向流动 | Iris 11 |
| 数据填充 / 边框 / 强调 | Cyan 3 / Cyan 8 / Cyan 11 |
| 警告填充 / 边框 / 强调 | Orange 3 / Orange 8 / Orange 11 |
| 弱边框 / 普通连线 | Slate 6 / Slate 9 |

- 浅色中无 `module` 的节点保留角色填充；有 `module` 的节点使用模块整卡底色、轮廓与顶条。已审查的电商示例映射：渠道 `#6b7280`、结算 `#5753d7`、价格 `#8b5cf6`、库存 `#0f8f83`、风控 `#c26a17`、支付 `#2474d2`、订单 `#348052`、履约 `#b14b7d`。颜色可突出，但不能代替标签、形状、基数、线型或构造型。选择时保留模块填充。
- 图例只展示图中实际存在的类别和线型，沿用绘图的核心优先级、语义外观与当前主题，省略未用类别。
- 画布左上 `图例` 浮动按钮打开浮层；有有向关系时包含 `连线流动` 开关。每个标签前保留原始符号的形状、主题色、实虚线，以普通内联文字换行。导航展开时按钮右移；平移/缩放不改变位置或字大小。Escape 或外部点击关闭浮层。
- 有向关系默认显示一条从源到目标的柔和流动短线，无向关系静止；下方证据实/虚线保留。选择不停止流动；独立 `连线流动` 只停环境流动，减少动态效果停止全部环境动画。
- 悬停/选择使用轮廓与阴影，不缩放几何或替换语义填充/边框。用户选择对节点及直接关联边触发一次共享 760ms 轮廓/辉光回弹，然后静态强调；只动画描边宽度、不透明度、阴影。
- `effects.css` 是在 `styles.css` 后加载的独立屏幕效果层。暗色对 SVG `.node-surface` 施加 `filter: drop-shadow`：优先模块色，否则角色色；悬停/选择强调辉光、加宽选择光晕（节点 14px、.5；关联边 14px、.3，使选中流动短线保留 ≥60% 参考对比度）、加粗发光 `.edge-flow`，以及画布顶端 10% 强调色径向晕影。浅色用同模块色柔和阴影、平坦画布。该层仅引用调色板 token，不用卡片 `box-shadow`（生命线必须 `boxShadow === 'none'`），不影响导出。`prefers-reduced-transparency: reduce` 或 `prefers-contrast: more` 关闭整层：过滤器 `none`、光晕与流动恢复 `styles.css`、移除晕影。
- 减少动态效果时关闭关系/选择动画，视口变化直接完成。
- SVG/PNG 下载采用当前主题、记法、排版层级、共享正交路径，排除临时选择/搜索高亮；标签和符号不能越出形状，SVG 描述保留完整原文。

### 交互

- 单图无视图菜单。集合菜单按规范顺序展示类型（`role=menu`，条目 `menuitemradio`），勾选当前项并显示各图关系数。切换保留各图已保存文本/位置，清除搜索和上次选择，适配整图并应用该图初始核心选择。
- 无自动播放、步进、阅读导览、当前步、已完成步状态；忽略旧 `playback`。边流动独立，不宣称运行顺序。
- 初始静态选择第一个显式核心节点及直接关联边，不触发脉冲；切图同规则。无核心标记则不选择。
- 选择节点显示速览卡，同时强调直接入/出边；自环只算一次，不继续遍历、不淡化无关关系。复用当前路径，不新增箭头或改变箭头大小；保留证据虚线、ER 基数、UML 符号。
- 选择轮廓匹配卡片、菱形、平行四边形、椭圆、状态圆的真实形状。时序图只强调参与者头部或人物，不强调整个生命线框。760ms 回弹后静态强调；换节点替换整个高亮集合，同节点再选重播一次。
- 节点点击和拖动开始都选择并显示速览；目录/搜索及 Enter/Space 打开检查器。选择保持边流动；每次操作只应用一次反馈和详情定位；拖动不重新居中视口、不移走目标焦点。
- 点画布、关详情或 Escape 清除选择。搜索淡化不匹配节点，不改变拓扑。
- 检查器保留选中节点的全部事实、字段、可空性、属性、方法、来源与标签，直到用户改变/清除选择；不自动前进或抢焦点。
- 选中时有向流动仍须清晰。静态强调不得用同色不透明线填满短线间隙。检查所有直接有向边，不能只看首条或 `animationPlayState`。减少动态效果与独立流动开关优先。
- 搜索忽略大小写和首尾空白，依次按名称精确、名称前缀、名称包含、副标题/标签、事实/字段/属性/方法排序；同级保留原顺序，排序后取八条。
- 布局默认锁定，显式控件允许拖动；下载使用当前位置。
- 解锁后 `整理间距` 使用有界 D3 微调：有选择只移动该节点及一跳邻居，无选择移动全部。目标矩形间距 65px，尽量贴近原位置；包含节点留在最小边界内，时序参与者只水平移动。这是间距清理，不重新建立拓扑或全自动布局。
- 锁定时 `整理间距` 置灰且 `aria-disabled="true"`，但仍接受鼠标/键盘激活，以现有状态区域提示 `请先解除布局锁定`。锁标签保持一行，开关在各宽度菜单行内保持 32×20px。不运行求解器或自动解锁。解锁尝试后报告局部/整图范围与移动数；无移动且校验清晰时显示 `当前间距无需调整`，否则报告剩余问题数及手动调整提示。错误与警告都计数，即使无移动也报告未解决问题。
- 边界在 156px 移动上限内容不下理想头部/留白时，保留节点原位置并报告剩余问题。无关节点精确保留坐标，包括小数。每次操作刷新状态与 4.5s 定时器，即使文本重复。
- 间距清理不改变证据、边路由提示、分组、选择、视口、面板或主题。`重置` 恢复原 `graph.json` 位置和阅读视图，清搜索/选择/旧状态，恢复默认流动开关；保留主题、面板可见性、锁定，并在既有状态区域提示完成。
- 平移、缩放、适配、重置、SVG/PNG 下载始终可用。
- `保存 Graph JSON` 按原单图/集合形态保存所有视图当前文本/位置，保留元数据、来源、结构字段。支持时用原生保存选择器，否则下载 JSON。取消/失败保留编辑；重置只作用当前图，并进入下次保存。重载仍读嵌入数据；用保存的 JSON 重新生成以打开编辑结果。浏览器回归覆盖切出/切回、重置隔离、JSON 下载及重新生成。
- 键盘选择与关闭面板保留拓扑；Backspace、Delete 不删除节点。
- 打开、重置、切图都适配整图；平移/缩放/小地图查看细节。适配边界与导出一致，包括节点、分组、外侧路径、标签、ER 端点符号。拖动/微调后目录定位和适配使用当前位置；重置恢复原位。
- 每次适配（打开、重置、切图、`适应画布`、进入全屏）先扣除外壳：顶部 52px 工具栏 +12px，底部控件行；每侧面板展开占 304px +24px，收起占 24px。`useGraphLayout.js` 的 `readingPadding()` 读取画布 `data-nav-open` / `data-drawer-open`；padding 必须为 `px` 字符串，裸数字表示比例。
- 导航开关、检查器开关、速览 `查看详情` 打开面板遮住选中节点时，只平移到距面板边缘 12px，不缩放；未被挡住则不动，≤700px 完全不动。`useReveal.js` 由这三个动作显式调用，非 effect。目录/搜索选择仍按原方式居中节点。
- 所有程序视口移动（适配、定位、显露）共用 320–420ms 的 `cubic-bezier(.32,.72,0,1)`；面板进出用临界阻尼弹簧（`visualDuration .36`、`bounce 0`）。减少动态效果将两者时长归零，面板直接在终点显示。
- 缩放把完整节点作为整体，不在任何缩放级别隐藏副标题、字段、属性、方法、构造型等；全屏同规则。居中文字在可用矩形内换行，菱形/椭圆/胶囊/斜边形收窄区域；宽度估算照顾大写标识与宽拉丁字母，边界标题给片段符号留位。浏览器 `text-bounds` 检查所有节点类型、长字段/成员、边界标题、大写边标签和三级缩放；任意非空原文计算不透明度为零即失败。
- 速览按右→左→下→上尝试，选首个不超画布且不遮其他节点的位置；所有可容纳方向都遮邻居时，按真实卡高选最少覆盖。卡从节点侧展开，`is-flipped / is-below / is-above` 设置 `transform-origin`。
- 长速览在可用画布高度内换行/滚动，关闭/详情可用键盘触达。全屏中 `查看详情` 先退出再打开并聚焦已有检查器；退出失败保留速览并播报错误。
- 导航展开时图例/缩放控件距左 328px；检查器展开时小地图距右 328px（`.workspace.nav-open / .drawer-open`）；≤700px 保持原位。
- SVG/PNG 导出包含整图，不仅当前视口。

### 响应式布局

- 所有宽度双面板默认收起，展开为 304px 浮层，从工具栏底 +12px 到窗口底 −12px；无遮罩，旁边画布仍可平移。Escape 先关浮层，再关持有焦点的面板并归还工具栏焦点，最后清选择。中间断点不得移除证据入口。
- ≤700px 面板宽为窗口减 24px，打开一侧关闭另一侧，隐藏小地图；搜索结果打开详情并关闭导航。
- 手机操作可达，面板旁仍有可见画布，390px 不出现页面横向溢出。检查器完整显示文字、只纵向滚动。

### 证据展示

- 检查器先展示身份、字段、属性、方法、来源、标签，最后单独展示同一选中节点的事实。有来源叫 `证据事实`，无来源叫 `节点说明`；无事实或无节点时省略，随检查器内容滚动。
- 直接源码、配置、结构、测试、文档证据用实线，除非关系记法要求虚线（返回、依赖、实现等）。
- 框架行为与推断保持虚线；流动时仍区分证据。
- 详情使用“证据”标签，不声称所有锚点都是源码。
- 事实、副标题、字段、方法、来源符号、标签的长词在检查器内换行，保留完整文字，仅纵向滚动。

### 浏览器验收

- 仅在 Viewer 源码、路由、图结构或校验行为修改时运行完整矩阵：九类型 × 1440×900、1920×1080、390×844 × 明暗主题。检查默认有向流动、无播放控件、稳定手动选择且边继续流动、独立流动开关、动态语义图例、平移/缩放、排序搜索、节点/边联动且几何不变无重复脉冲、完整详情换行、布局锁与间距反馈、重置、无临时效果 SVG/PNG、键盘、减少动态效果、横向溢出。核对专属记法与核心强调。单图无类型菜单，集合用纵向菜单；≤700px 双面板收起、可达、互斥。
- 打开下载图，核查完整文字、记法、边界无裁切、主题一致。复用已安装浏览器工具，在 `finally` 关闭临时 HTTP 服务。
