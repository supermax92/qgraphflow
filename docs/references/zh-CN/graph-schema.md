# Graph JSON 数据契约

[English](../../../skills/q-flow/references/graph-schema.md) · [简体中文](graph-schema.md) · [Русский](../ru/graph-schema.md) · [Português](../pt/graph-schema.md) · [日本語](../ja/graph-schema.md) · [Deutsch](../de/graph-schema.md) · [Español](../es/graph-schema.md)

`scripts/generate-viewer.mjs` 接受单个 `Graph` 或图集合。没有 `meta.diagramType` 的旧数据仍有效，按 `architecture` 渲染。以下片段说明字段结构；运行前需补齐引用的节点并校验布局。

```json
{
  "meta": {
    "title": "Required title",
    "diagramType": "architecture",
    "subtitle": "Optional supporting line",
    "sourceRef": "Branch, commit, document version, or evidence scope",
    "scope": "Verified evidence scope",
    "generatedAt": "ISO-8601 timestamp"
  },
  "groups": [
    {
      "id": "runtime-boundary",
      "label": "Consumer application JVM",
      "kind": "runtime",
      "position": { "x": 40, "y": 80 },
      "size": { "width": 1440, "height": 620 }
    }
  ],
  "nodes": [
    {
      "id": "jwt-decoder",
      "label": "NimbusJwtDecoder",
      "subtitle": "Verify and decode JWT",
      "module": "Identity",
      "kind": "security",
      "position": { "x": 720, "y": 220 },
      "size": { "width": 220, "height": 120 },
      "source": {
        "kind": "source",
        "file": "module/src/main/java/example/Config.java",
        "lineStart": 111,
        "lineEnd": 130,
        "symbol": "jwtDecoder"
      },
      "facts": ["Built from issuer-uri"],
      "tags": ["JWT", "Spring Security"]
    }
  ],
  "edges": [
    {
      "id": "decode-token",
      "source": "bearer-filter",
      "target": "jwt-decoder",
      "label": "decode and verify",
      "module": "Identity",
      "kind": "call",
      "evidence": "framework",
      "route": {
        "via": [{ "x": 640, "y": 180 }],
        "labelAt": { "x": 640, "y": 156 }
      }
    }
  ]
}
```

默认使用单图；单图页面没有图类型菜单。用户要求多图时，用 `diagrams` 包装1–9张图，各图的 `meta.diagramType` 必须唯一。工具栏菜单固定按 `architecture`、`flowchart`、`sequence`、`er`、`deployment`、`class`、`state`、`usecase`、`dataflow` 顺序纵向排列，不受输入顺序影响。

```json
{
  "diagrams": [
    { "meta": { "title": "System", "diagramType": "architecture", "sourceRef": "main" }, "nodes": [], "edges": [] },
    { "meta": { "title": "Request", "diagramType": "sequence", "sourceRef": "main" }, "nodes": [], "edges": [] }
  ]
}
```

上面省略了节点，只演示集合外层结构；每张图仍须满足完整契约，节点不能为空。

## 通用字段

- 必需：`meta.title`、`meta.sourceRef`、非空 `nodes` 和 `edges`。
- `meta`、节点、边、分组、来源锚点均为对象；`nodes`、`edges`、可选 `groups` 均为对象数组。非法容器在布局与生成前被拒绝。
- 可选的 `meta.subtitle`、`meta.scope`、节点 `subtitle`、`source.symbol`、边 `label` 都是字符串。节点／边可有非空字符串 `module`：同一模块在集合所有图中复用完全相同的值，不能存字面颜色。节点 `facts`、`tags`、`attributes`、`methods` 是非空字符串数组。规则适用于全部类型。
- 可选节点 `fields` 为对象数组，`name`、`type` 为非空字符串，`key` 可选 `PK`、`FK`、`UK`，`nullable` 为可选布尔值。ER 至少要有一个字段；其他类型也可在搜索和详情中显示字段。
- `meta.diagramType`：`architecture`、`flowchart`、`sequence`、`er`、`deployment`、`class`、`state`、`usecase`、`dataflow`。
- `meta.locale`：可选界面语言 `en`、`zh-CN`（默认）、`ru`、`pt`、`ja`、`de`、`es`；旧图继续支持 `ko`、`fr`。它控制内置界面和导出标签；标题、节点名、事实和关系文字需要作者另行用目标语言编写。代码标识和标准记法保持不变。集合中的每张图使用各自语言。
- ID 是唯一的非空字符串。每条边的两个端点都必须引用节点。
- 每个节点和分组都有数值有限、非负的 `position` 和 `size`。
- 边 `evidence`：`source`、`code`、`config`、`schema`、`test`、`document`、`framework`、`inference`。
- 边的 `route` 可选：`via` 是图坐标中的路径点，`labelAt` 固定标签中心。自动正交路由清晰时都省略。
- `route.via`、`route.labelAt` 坐标必须为有限非负数。路由器在路径点间插入正交拐角，并始终把起终点连接到节点当前坐标。
- 可选 `source.kind` 使用相同证据枚举；`source.file` 和 `source.lineStart` 标识精确来源。
- 提供 `--repo-root <directory>` 后，校验和生成按仓库相对路径读取每个 `source.file` 的 UTF-8 文本，检查包含首尾的行号范围。拒绝绝对路径、父目录跳转、目录、二进制文件以及逃出根目录的符号链接。重复引用只读一次。未提供根目录时，已有锚点的回执状态是 `skipped`；没有锚点为 `not-applicable`。检查针对当前工作区，不证明 `sourceRef` 的版本身份、符号解析或结论正确性。
- 强调业务中心时，用该类型支持的 `business` 种类，或在 `tags` 中放 `core`／`business`（忽略大小写）。仍使用合法节点种类；`core` 不是新种类或新字段。
- 冷中性视觉系统属于 Viewer 展示规则。颜色、字形和核心样式不需要新增数据字段。订单履约预览模型只是例子，不是默认数据或证据来源。

旧 `playback` 元数据被忽略。Viewer 没有自动或逐步播放；有向边流动是独立提示，不代表执行顺序。

## 保存 Viewer 编辑

切图会在当前页面保留各图已保存的文字和位置。重置只恢复当前图内嵌的原始内容。**保存 Graph JSON** 保存完整集合，或保持原来的单图结构，包含其他视图的修改、元数据和来源锚点。支持的浏览器可选择 `.json` 写入；其他浏览器下载 `graph.json`。取消或失败不会丢失当前页面修改。

重新加载 HTML 仍使用内嵌数据。要持久重开编辑结果，保留 JSON 并生成到新的输出目录。保存不会跳过校验：手动修改的文字和坐标可能仍需布局修正。浏览器不重新核验来源锚点；基于源码交付时，需对两个 CLI 命令都加 `--repo-root` 重新运行。

<a id="routing-and-spacing"></a>

## 路由与间距

- 节点矩形至少间隔64个图坐标像素；标签通道要容纳完整估算宽度再加24像素。
- 普通卡片按20px标题、16px正文／字段／成员／边文字、14px次要文字设计。根据内容单独扩大框和通道；整体同比放大会在适应画布时抵消收益。这是作者建议，不是新校验下限，旧紧凑卡片和特殊符号仍兼容。初始视图避开浮动工具栏和已打开面板，整体适应，最小缩放0.08；显式适应全图使用同一规则。
- 平行、扇出、扇入关系自动使用24像素通道，端点附近最多共享12像素。ER 的较长符号净空不是合并路由的许可。
- 节点边长应足够容纳自动通道；端点侧溢出时扩大节点或提供路径提示。
- 非自循环的提示路由由首尾路径点决定端点侧和边界投影位置。ER 向外保留28像素直线，其他图保留12像素。路径点必须在所有节点外，包括自身端点节点。
- 自循环默认在节点右侧使用48×32像素的外部路线。只有被占用时才用 `route.via` 或 `route.labelAt`。
- 校验拒绝节点重叠、标签覆盖节点或其他标签、路线穿过任意节点内部（含自身端点）、不安全的自循环及超过12像素的共享线段。时序消息在参与者头部下方连接生命线。间距偏小和交叉属于警告。
- 时序参与者中心至少间隔 `max(160, estimated message width + 32)` 像素。

## 各图类型记法

| `diagramType` | 节点 `kind` | 分组 `kind` | 关系 `kind` |
| --- | --- | --- | --- |
| `architecture` | `external`, `config`, `framework`, `security`, `service`, `business`, `data`, `failure`, `system`, `component`, `database` | `runtime`, `security`, `ownership`, `external` | `request`, `call`, `data`, `success`, `failure`, `framework`, `optional`, `depends` |
| `flowchart` | `start`, `end`, `process`, `decision`, `input`, `output`, `subprocess` | 无 | `flow`, `yes`, `no`, `success`, `failure` |
| `sequence` | `actor`, `participant`, `external`, `service`, `database` | `alt`, `opt`, `loop` | `sync`, `async`, `return` |
| `er` | `entity` | 无 | `relationship` |
| `deployment` | `device`, `node`, `container`, `artifact`, `service`, `database`, `external` | `host`, `network`, `cluster`, `namespace` | `deploy`, `network`, `depends` |
| `class` | `class`, `interface`, `abstract` | 无 | `association`, `inheritance`, `implementation`, `composition`, `aggregation`, `dependency` |
| `state` | `initial`, `state`, `final`, `choice` | 无 | `transition` |
| `usecase` | `actor`, `usecase` | `system` | `association`, `include`, `extend` |
| `dataflow` | `external`, `process`, `dataStore` | `ownership`, `external` | `data` |

### 时序

边必须有唯一正整数 `order`。参与者顶部对齐，头部72px，角色标签108px，并按现有54px编号步距为全部消息预留高度。标签显示编号，可按16px字号、24px行高换行；相邻消息之间和参与者头部以下要放下完整多行标签。超过两行时加宽参与者间距；必要时移动片段边界。`alt`、`opt`、`loop` 包围相关消息范围，独立异步阶段不能暗示原同步请求仍在等待。

```json
{ "id": "request", "source": "browser", "target": "api", "label": "POST /orders", "kind": "sync", "order": 1, "evidence": "source" }
```

### ER

每个实体必须有非空 `fields`。`key` 可为 `PK`、`FK`、`UK`。每条关系必须提供两端基数：`1`、`0..1`、`*`、`1..*`、`0..*`。

按72px头部、每字段约32px和底部留白确定高度。按16px字段名、14px类型和键标记确定各列宽度，长标识尤其要留足。实体外留28px直线路段绘制基数符号；JSON 中的基数值不变。

```json
{
  "id": "orders",
  "label": "orders",
  "kind": "entity",
  "fields": [
    { "name": "id", "type": "bigint", "key": "PK", "nullable": false },
    { "name": "user_id", "type": "bigint", "key": "FK", "nullable": false }
  ],
  "position": { "x": 80, "y": 120 },
  "size": { "width": 260, "height": 170 }
}
```

```json
{ "id": "user-orders", "source": "users", "target": "orders", "kind": "relationship", "sourceCardinality": "1", "targetCardinality": "0..*", "evidence": "schema" }
```

### 类

类节点可有字符串数组 `attributes`、`methods`。接口和抽象类显示构造型。按68px头部、16px成员字、28px成员行和两分区留白设置尺寸，确保名称、构造型和全部成员不裁切、不缩字。继承／实现、组合／聚合使用各自三角和菱形箭头，边种类不变。

### 状态

迁移边可带 `guard` 和 `action`，可见标签组合为 `label [guard] / action`。

### 来源锚点

只有节点对应精确仓库或用户提供文档位置时才写 `source`。外部角色和框架负责的运行组件省略来源。`facts` 应短小、原子化，在文字和证据类型中都体现不确定性。

用户明确要求概念示例时，在 `facts` 中描述相关业务模型，将推断关系标为 `inference`，在元数据说明范围。不伪造路径，也不挪用预览文档锚点为其他图背书。正常生成仍只输出 `index.html` 和 `graph.json`。
