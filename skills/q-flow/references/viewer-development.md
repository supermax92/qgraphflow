# Viewer 扩展与维护

这是编译期模块化结构：修改源码并构建后，生成器将全部功能嵌入独立 HTML。没有运行时插件下载或热加载；普通图数据生成仍只输出 `index.html`、`graph.json`。

## 改动入口

以下源码路径均相对于 `assets/viewer/src/`。

| 修改目标 | 入口 | 作用范围 |
| --- | --- | --- |
| 增加图类型 | `diagrams/<type>.js`、`diagrams/registry.js` | 类型名称、顺序、合法种类、专属校验、节点绘制、轮廓与关系策略 |
| 改主题、字号、行高 | `visual-style.js`、`radix-colors.js` | Radix 色阶、主题变量、语义颜色、核心识别、布局尺寸；页面和导出共用 |
| 改节点形状与内部排版 | 对应 `diagrams/<type>.js`；通用卡片用 `diagrams/card.js` | 页面节点与 SVG/PNG 节点同时变化 |
| 改通用 SVG 字体与绘制规则 | `diagrams/drawing.js` | `svgStyles()`、文本转义、共用图元；页面加作用域，导出使用相同样式 |
| 改页面工具栏、详情及响应式外观 | `ViewerShell.jsx`、`styles.css` | 页面外壳；节点内部不再维护第二份 HTML/CSS 绘制 |
| 改选择与搜索入口 | `features/useSelection.js`、`search.js` | 统一选中、暂停、回弹次数、键盘、取消；纯搜索排名可独立测试 |
| 改播放 | `playback.js`、`features/usePlayback.js` | 已编排路径、时序顺序或明确标注的逐步阅读；步骤计时与连线流动各自控制 |
| 改阅读图例 | `ViewerShell.jsx`、`styles.css`；内容来自 `legend.js`、`visual-style.js` | 位于图类型标题下，替换原说明文字；从实际节点和线型生成，保留文字前的原始符号，共用 `nodeAppearance` 颜色与核心优先规则 |
| 改侧栏与焦点 | `features/usePanels.js` | 手机互斥、开关、焦点返回；切图保留面板偏好 |
| 改画布全屏 | `features/useFullscreen.js`、`features/useSelection.js` | 原生全屏状态、失败提示、退出焦点返回；全屏内选择不打开外部详情栏，Esc 优先退出全屏 |
| 改拖动、视角、锁定和整理间距 | `features/useGraphLayout.js`、`layout-nudge.js` | 当前坐标与布局操作；D3 算法仍是有限微调 |
| 改显示状态 | `features/usePresentation.js` | 将选择、播放、搜索状态投影为节点和连线，不拥有第二份状态 |
| 改下载 | `features/download.js`、`export-svg.js` | 当前坐标的静态 SVG；PNG 从该 SVG 栅格化 |
| 改连线与布局检查 | `edge-routing.js`、`text-layout.js` | 页面、导出、校验共用路径、标签分行和测量 |

`main.jsx` 只负责加载数据、切图和主题。`features/useViewerController.js` 组合各项能力，并协调重置等跨功能操作；`ViewerShell.jsx` 绑定 UI。新增功能优先放入对应模块；只有独立的状态和生命周期才需要新 Hook。

## 增加图类型

1. 在 `diagrams/` 增加模块，默认导出定义。
2. 在 `diagrams/registry.js` 导入并加入 `DIAGRAMS`。顺序即集合目录顺序；单图仍不显示类型菜单。
3. 更新 `graph-schema.md`、`visual-contract.md` 及 SKILL 的生成指引，使生成模型知道新类型。数据结构无需因为登记类型而变化。
4. 构建模板、生成样图、验证节点和关系的专属规则及浏览器交互。

已有规则与图元可以直接复用。例如，在保留架构图所有规则的基础上新增一种卡片视角，只需模块导出 `{ ...architecture, id: 'new-view', label: '新视角' }`，再登记一次。独立图类型通常包含：

```js
export default {
  id: 'new-view', label: '新视角',
  nodeKinds: ['component'], groupKinds: [], edgeKinds: ['call'],
  outline, // (node, x, y) => [[SVG 标签名, 几何属性], ...]
  render,  // (node, x, y, fill, stroke, palette) => SVG 字符串
};
```

`render` 应用 `paint(outline(node, x, y), { fill, stroke })` 绘制主体，使用 `text`／`centeredTitle` 输出正文。模块代码可信，图数据不可信：不要把输入直接拼进 SVG 标签、属性或正文；使用共用转义函数。

可选项只按实际需求添加：

- `validateNode`、`validateEdge`：在通用数据校验后追加类型约束；通过参数中的 `requireString`、`validateStringArray` 等复用校验。时序顺序集合由每次校验创建。
- `edgeLabel`、`undirected`、`dashedKinds`、`markers`：可见关系名称、有向性、证据之外的虚线规则及已有 UML 箭头符号。
- `flowPlayback`：流程类图在缺少路径时显示明确提示，仍允许逐步阅读；不从坐标猜执行时序。
- `cardLayout`、`compartments`、`sequence`、`cardinalities`、`endpointStub`、`selectionHeight`：复用已有卡片检查、核心分区、生命线、ER 端点和选中高度规则。

矩形卡片与现有规则可以直接接入。如果新增图需要完全不同的路由、连接点或新的 UML 符号，仍需扩展共用路由或符号绘制；注册表不会自动推导未知几何规则。增加新的语义种类时，还应在 `visual-style.js` 补充种类名称和 `nodeAppearance` 颜色归类。Radix MIT 声明保存在 `radix-colors.js`，生成 HTML 与导出 SVG 时保留。

## 共用绘制约束

`DiagramCanvas.jsx` 和 `export-svg.js` 都调用 `node-svg.js` 的 `renderNode()`。页面将生成的 SVG 放入 React Flow 节点；导出对相同绘制传入画布偏移。`SelectionOutline.jsx` 调用 `renderSelection()`，复用同一图类型的 `outline`，只改变描边、透明度和阴影。

节点定位、节点内容和临时交互分开：拖动修改当前坐标；选择和播放不修改坐标或形状。导出只接收当前图与主题，不接收选中状态或动画状态。分组容器、React Flow 箭头适配和页面控件仍各有宿主绘制；不要把“节点内容共用”误解为整页 DOM 与导出 SVG 完全相同。

## 构建与回归

在 skill 目录执行，使用已有依赖和浏览器：

```bash
npm --prefix assets/viewer run build
node --test scripts/*.test.mjs
node scripts/generate-viewer.mjs /tmp/graph.json /tmp/new-viewer
node scripts/browser-interactions.mjs /tmp/new-viewer /tmp/new-viewer-check
```

画布左下角的全屏按钮将整个画布卡片（含标题、图例和状态栏）进入原生全屏，侧栏和顶部操作区不进入全屏。每次进入全屏，在画布尺寸更新后自动适应一次当前图；选择、播放和布局不变，退出时保留当前视角。靶心图标用于手动适应画布，四角图标用于全屏切换。已生成的独立 HTML 需要重新生成才能包含新功能。浏览器或嵌入页面不支持全屏时，按钮标记不可用；请求失败在画布状态栏提示。

全屏专项验收使用真实浏览器 API；`QA_HEADED=1` 打开浏览器窗口，便于确认全屏、Esc 和焦点行为：

```bash
QA_HEADED=1 QA_ONLY_EXTRAS=1 QA_EXTRAS=fullscreen,fullscreen-errors \
node scripts/browser-interactions.mjs /tmp/new-viewer /tmp/fullscreen-check
```

浏览器脚本覆盖输入中所有图类型的三个尺寸、深浅主题和交互；用九类集合输入执行完整矩阵。设置 `QA_FIXTURE_DIR` 可追加特殊形状样图。该脚本需要相邻源码模块，不能单独复制为独立脚本。

详情跟随状态由 useSelection 的 followPlayback 管理，useViewerController 派生 inspectedNode 并协调 startPlayback／stepPlayback。ViewerShell 的全部节点详情读取 inspectedNode；自动演示不调用 selectNode。
阅读图例由 `.board-head > .legend` 承载，位于图类型标题下，替换原副标题/说明。它使用普通文字和原始符号自然换行，无卡片或画布浮层，也不截断或内部滚动。右栏 `.drawer-body` 保留节点基本信息及来源，`.inspector-facts` 在当前步骤之后作为最后一个内容区块，仍读取同一个 inspectedNode。浏览器检查需从整个 Inspector 读取详情，验证事实只出现一次及空事实不显示。
连线流动期间的静态层对比由 DiagramCanvas 的 has-flow 和 styles.css 管理；不要让选中层填满流动虚线间隙。

```bash
QA_ONLY_EXTRAS=1 QA_EXTRAS=flow-contrast,inspector-sync \
node scripts/browser-interactions.mjs /tmp/new-viewer /tmp/new-viewer-sync-check
```

`diagram-modules.test.mjs` 会在临时副本添加第十种测试图，只修改该副本的图模块与注册表，然后实际校验、构建和生成，正式支持类型仍为九种。可设置 `MODULE_TEST_OUTPUT=/tmp/new-module-check` 保留临时副本，再使用其中的 `skills/q-flow/scripts/browser-interactions.mjs` 检查 `page/`。副本保留仓库目录层级和根目录第三方声明，以验证真实构建依赖。目录必须尚不存在。

Viewer 改动需重新构建 `assets/viewer-dist/index.html`。安装后核对缓存，并在新会话中用安装版本生成验收；旧独立 HTML 内嵌旧代码，必须重新生成才会获得变更。

## QGraphFlow 名称与迁移

| 标识 | 旧名称 | 新名称 |
| --- | --- | --- |
| 产品 | CodeGraph Flow | QGraphFlow |
| 插件 ID | `codegraph-flow` | `qgraphflow` |
| 技能目录与调用 | `create-interactive-codegraph` / `$create-interactive-codegraph` | `q-flow` / `$q-flow` |
| 技能展示名 | CodeGraph Flow｜交互式软件图 | Q flow |
| Viewer 私有包 | `codegraph-flow-viewer` | `qgraphflow-viewer` |
| 缺省交付目录 | `docs/codegraph-flow/<scope>-<diagram-type>/` | `docs/qgraphflow/<scope>-<diagram-type>/` |

包内只保留新技能入口，不提供旧技能别名。功能范围仍为九类软件图；MapSprig / QMindFlow 的改名不在本次范围内。

从工程根使用新路径：

```bash
node skills/q-flow/scripts/validate-graph.mjs /tmp/graph.json
node skills/q-flow/scripts/generate-viewer.mjs /tmp/graph.json docs/qgraphflow/example-architecture
```

缺省目录是技能的交付约定，生成器仍要求显式传入输出目录。用户指定的旧目录（包括 `docs/codegraph-flow/`）仍可使用；覆盖已有交付仍需 `--force`。旧 graph.json 无需改写，标题、来源、节点、证据中用户写入的旧名称会原样保留。旧 HTML 可继续离线使用，但仍展示内嵌的旧品牌；要更新品牌，应从原 graph.json 重新生成。

`CodeGraph`、`codegraph`、`@colbymchenry/codegraph` 和 `.codegraph/` 是外部分析工具及其命令、包名、索引目录，不随本产品改名。内部 `__CODEGRAPH_FLOW_DATA__` 数据占位符、`codegraph-*` SVG 标识及测试临时目录前缀也保留原值。

### 本机安装与更新

Codex、Claude Code、Qoder 和 Cursor 的安装、更新、卸载及验证状态统一维护在[多客户端安装说明](../../../docs/clients.md)。仓库改动不会自动刷新已安装插件；安装或迁移时核对实际来源与版本，通过客户端管理入口操作，保留用户图文件和其他插件配置。

## Viewer visual and interaction contract

Read this section only for Viewer maintenance or interaction audits. Graph authoring uses [visual-contract.md](visual-contract.md).

### Shared presentation

- Use the React Flow UI shell: compact brand and actions, a clear title hierarchy, restrained control/board/Inspector cards, a plain canvas, board status, and a plain reading legend directly below the diagram-type title. Replace the former title description with the legend. Let the diagram carry the strongest visual emphasis.
- Default to the light theme and offer a manual dark-theme switch. Theme changes preserve viewport, search, selection, playback, layout lock, and panel state.
- Use Radix Colors (MIT) as the shared palette: Sand for warm-neutral surfaces, Teal for core components and interactions, Blue for data, and Amber for decisions/failures. Keep copyright and license notices in distributed source, standalone HTML, and SVG; no runtime CDN or component-library dependency is required.
- Emphasize an actual business center with the existing `business` kind or a case-insensitive `core`/`business` tag. Use Teal 3 fill, Teal 8 border, and Teal 12 text; ER/class nodes apply it to their header with neutral member rows. Core emphasis takes precedence over data/warning classification. Initial/final state symbols retain their solid-dot/double-circle notation. Do not add a `core` kind or literal color fields to the data format.
- Page, node drawings, MiniMap, Inspector dots, legends, and exports reuse `visual-style.js`. Ordinary cards use Sand 2; the light canvas stays white. Use corresponding dark scales rather than applying light colors unchanged in dark mode.

| Role | Radix scale / step |
| --- | --- |
| Page / ordinary surface | Sand 1 / Sand 2 |
| Main / secondary text | Sand 12 / Sand 11 |
| Core fill / border / text | Teal 3 / Teal 8 / Teal 12 |
| Interaction / directed motion | Teal 11 |
| Data fill / border / accent | Blue 3 / Blue 8 / Blue 11 |
| Warning fill / border / accent | Amber 3 / Amber 8 / Amber 11 |
| Subtle border / ordinary edge | Sand 6 / Sand 9 |

- In light mode, core fill is `#e0f8f3`, border `#53b9ab`, and text `#0d3d38`. Color reinforces meaning but never replaces labels, shapes, cardinality, line style, or stereotypes. Preserve semantic fills during selection and playback.
- Build the reading legend from categories and line styles actually present. Apply the same core-priority and semantic appearance rules as the drawing; omit unused categories and use the current theme.
- Place the reading legend in the board header above the canvas. Keep each original symbol before its label, including its shape, theme colors and solid/dashed line style. Use ordinary inline text that wraps within the header width, without a legend card, background, border, overlay or internal scroll area. Keep every entry visible and retain the legend when the Inspector is closed; pan/zoom leaves its position relative to the title and text size unchanged.
- Directed relationships show one subtle moving dash overlay from source to target by default; undirected relationships remain static. Preserve the solid/dashed evidence baseline beneath the overlay. Step pause and user selection leave these overlays moving. The separate `连线流动` switch stops only ambient dashes; reduced motion stops all ambient motion.
- Hover, selection, and current-node emphasis use outlines and shadows without scaling node geometry or replacing semantic fills and borders. User selection adds one shared 760ms outline/glow rebound to the node and its direct incident edges, then retains static emphasis; only stroke width, opacity, and shadow animate.
- Honor reduced-motion preferences by starting paused, disabling relationship and selection motion, and applying view changes without animation.
- SVG and PNG downloads use the current theme, notation, typography hierarchy, and shared orthogonal paths. They exclude temporary playback, selection, and search highlights; full labels and symbols must remain legible after export.

### Interaction

- A standalone graph has no diagram-type menu or unused navigation divider. A requested graph collection exposes its available diagram types in a three-column grid in canonical order; all nine types form a 3×3 menu. Switching restores authored positions, clears search and the previous selection, resets playback, and opens the reading view with that graph's initial core selection.
- Use an authored `playback.edgeIds` path when available; otherwise sequence diagrams use message order and other diagrams use a clearly labeled node-directory reading tour. Keep the step panel visible even for old graphs without playback. Do not imply execution order for a reading tour. Playback advances every 1800ms; a new current node receives one 760ms outline/glow rebound, with no scaling, geometry change, or duplicate outline if it is already selected. The current edge uses the interaction accent while failures retain their warm color. Manual stepping pauses the step timer before advancing and leaves edge motion unchanged.
- Initially select the first explicitly marked core node, if any, with static emphasis on it and its direct incident edges. Do not pulse or pause playback for this initialization; graph switching follows the same rule. Without a core marker, leave selection empty.
- Selecting a node opens evidence details and highlights its direct incoming/outgoing edges together; include a self-loop once and do not traverse further or dim unrelated relationships. Reuse the current routed path for edge emphasis without adding arrowheads or changing arrow sizes. Preserve evidence dashes, ER cardinality, and UML symbols.
- Match selection outlines to the actual shape: cards, diamonds, parallelograms, ellipses, and state circles. In sequence diagrams emphasize only participant headers or actor figures, never the full lifeline box. After the 760ms rebound, retain static emphasis; selecting another node replaces the whole highlighted set, and selecting the same node replays once.
- User selection through a node click, search result, Enter/Space, or drag start pauses the step timer immediately while directed edges keep flowing, preserving the current step and completed record. An edge click or keyboard activation also pauses without adding edge details. Apply selection feedback and detail positioning once per operation; dragging does not recenter the viewport or move focus away from the drag target.
- Clear selection with a canvas click, detail close, or Escape; keep playback paused. Play resumes at the current step with a fresh 1800ms interval. A step-paused diagram still allows the one-shot selection rebound unless reduced motion is enabled. Search dims non-matching nodes without changing topology.
- During automatic playback and manual previous/next stepping, the Inspector shows the current step's node, including all facts, fields, nullability, attributes, methods, source anchors and tags. Explicit user selection temporarily takes over the Inspector and pauses only the step timer. Play or manual stepping restores Inspector following. Automatic following never changes manual selection, opens a panel, steals focus or moves the viewport.
- Directed flow must remain visibly distinguishable while its node is selected and while the edge is the current playback edge. Static emphasis must not fill the moving dash gaps with an opaque same-color line. Validate all incident directed edges, not only the first edge or animationPlayState. Reduced motion and the independent flow switch retain priority.
- Search ignores case and surrounding whitespace. Rank exact names, name prefixes, name substrings, subtitle/tags, then facts/fields/attributes/methods; preserve original order within ties and take eight results after sorting.
- Layout is locked by default. An explicit control enables dragging; downloads use the current node positions.
- The `整理间距` action uses bounded D3 nudging after unlocking layout. With a selection it moves that node and its one-hop neighbors; without a selection it moves all nodes. It targets 65px rectangle clearance while staying close to authored positions, keeps contained nodes inside their smallest boundary, and only moves sequence participants horizontally. It is spacing cleanup, not a fresh topology or full automatic layout.
- While locked, keep `整理间距` grey with `aria-disabled="true"`, but retain mouse and keyboard activation so the existing status region can say `请先解除布局锁定`. Do not run the solver or automatically unlock. After an unlocked attempt, report local/all-diagram scope and moved-node count, `当前间距无需调整` when nothing moved and validation is clear, or remaining issue count with a manual-adjustment hint. Count both validation errors and warnings, and report unresolved issues even when no node moved.
- Spacing cleanup never changes graph evidence, edge route hints, groups, selection, viewport, panels, or theme. `重置` restores authored `graph.json` positions and the reading view, clears search, selection, and old operation messages, returns playback to its first step, and restores default play (paused for reduced motion). Keep the current theme, panel visibility, and layout lock; announce the completed reset in the existing status region.
- Pan, zoom, fit view, reset, SVG download, and PNG download remain available.
- Keyboard selection and panel dismissal preserve graph topology; Backspace and Delete do not remove nodes from this Viewer.
- The initial reading view keeps zoom at least 0.9 so large diagrams remain readable; pan and the minimap reach the rest. Explicit fit-all still includes nodes, groups, outer routes, labels, and ER endpoint symbols using the same bounds as export. Directory selection and fit use current positions after dragging or nudging; reset restores authored positions.
- SVG and PNG exports contain the complete diagram rather than only the current viewport.

### Responsive layout

- Above 700px, keep controls, board, and Inspector available; reduce panel widths on narrower desktop/tablet layouts and let the user collapse either panel. Do not remove evidence access at an intermediate breakpoint.
- At 700px and below, start both panels collapsed so the canvas is visible. Keep both panel toggles accessible; open the controls or Inspector as an overlay, and close the other panel when one opens. Selecting a search result opens its details and closes the controls.
- Keep mobile actions reachable, retain a visible canvas beside an open panel, and prevent horizontal page overflow at 390px. The Inspector still shows complete text and scrolls vertically.

### Evidence display

- Keep node identity, fields, attributes, methods, source anchors and tags first in the Inspector, followed by the current step when available, then a separate final facts section. Facts use the same inspected node during manual selection and playback following; show `证据事实` with a source or `节点说明` without one. Omit this section when there are no facts or no inspected node. It scrolls with the Inspector content, rather than being pinned to the window bottom.
- Direct source, configuration, schema, test, or document evidence uses a solid baseline unless the relationship notation requires a dashed line, such as a return, dependency, or implementation.
- Framework behavior and inference retain a dashed baseline. Preserve this evidence distinction during flow and playback.
- The detail drawer says `Evidence` rather than claiming every anchor is source code.
- Facts, subtitles, fields, methods, source symbols, and tags wrap long tokens within the Inspector. Preserve complete text and allow only vertical scrolling.

### Browser acceptance

- Run the full browser matrix only when Viewer source, edge routing, graph schema, or validation behavior changed. Cover all nine diagram types at 1440×900, 1920×1080, and 390×844 in light and dark themes; check default directed flow, missing-playback reading controls, selection-paused steps with still-moving edges, the independent flow switch, same-step resume, dynamic semantic legends, pan/zoom, ranked search, linked node/edge emphasis without geometry changes or duplicate pulses, complete Inspector wrapping, layout lock and spacing-result feedback, reset, SVG/PNG download without transient effects, keyboard use, reduced motion, and horizontal overflow. Check each type's own notation and core emphasis. Standalone pages have no diagram-type menu; requested collections use a three-column navigation grid, with all nine types forming 3×3. At 700px and below both panels start collapsed, remain accessible, and open mutually exclusively.
- Open downloaded images to check complete labels, notation, uncropped boundaries, and theme parity. Reuse installed browser tooling and close temporary HTTP servers in `finally`.
