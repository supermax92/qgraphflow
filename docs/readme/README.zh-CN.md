<div align="center">

# QGraphFlow

### 把复杂代码，变成可以探索的图。

跟随路径，查看证据，用一个离线文件分享。

[English](../../README.md) · [中文](../../docs/readme/README.zh-CN.md) · [Русский](../../docs/readme/README.ru.md) · [Português](../../docs/readme/README.pt.md) · [日本語](../../docs/readme/README.ja.md) · [Deutsch](../../docs/readme/README.de.md) · [Español](../../docs/readme/README.es.md)

[客户端安装](../clients.zh-CN.md) · [反馈问题](https://github.com/supermax92/qgraphflow/issues) · [MIT](../../LICENSE)

</div>

![复杂电商架构图、流程图与时序图动态总览，每类图展示 0.8 秒，完整循环 2.4 秒，保留连线流动](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.zh-CN.core-three.gif)

*支持九类图：【架构图、流程图、时序图、ER 图、部署图、类图、状态图、用例图、数据流图】*

QGraphFlow 从源码、数据结构、配置和需求生成交互式软件图，让关系有据可查，并将结果交付为可分享的离线 HTML。

- **探索：** 搜索定位、缩放和平移画布，查看组件职责与上下游关系。
- **核验：** 从节点或连线查看详情，核对源码文件、行号、符号和明确标注的不确定性。
- **编辑：** 解锁后修改文字、移动元素；不满意时一键重置。
- **分享：** 打开离线 HTML，或将完整图导出为 SVG / PNG。

*探索：展开左侧导航，搜索结算编排器并定位；点击节点弹出快速查看卡片，高亮上下游连线，再缩放和平移画布。*

![QGraphFlow 探索能力：左侧导航、搜索定位、节点快速查看、上下游高亮与画布缩放平移](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.zh-CN.explore.gif)

*核验：从快速查看卡片进入右侧详情栏，查看文件路径、行号与符号；再选择连线，查看关系说明与推断标记。*

本段中的代码路径、行号与符号均为虚构，仅演示证据栏交互，不代表仓库源码；页面和详情中也已标明。实际分析时应填写真实来源，无法确认的关系应标注为推断。

![QGraphFlow 核验能力：右侧详情展示虚构源码路径、行号、符号以及关系推断](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.zh-CN.verify.gif)

*编辑：在「更多」菜单解除布局锁定，修改节点名称与说明，拖动节点并让连线跟随；最后重置，恢复原始文字和位置。*

![QGraphFlow 编辑能力：解锁、修改文字、拖动节点与连线跟随、一键重置](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.zh-CN.edit.gif)

*分享：离线打开完整 HTML，展开下载菜单，实际导出 SVG 和 PNG，再打开 PNG 检查完整图形。*

![QGraphFlow 分享能力：离线 HTML、下载菜单、SVG 和 PNG 导出及完整 PNG 预览](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.zh-CN.share.gif)

顶部三图总览每类展示 0.8 秒，完整循环 2.4 秒；下方四张能力动图留出操作与阅读时间，保留模块配色、完整文字和连线流动。全部 GIF 与 PNG 使用源码构建的 Viewer 生成，图中文字和界面均为中文。这五张 GIF 和九张 PNG 作为独立附件托管在 [showcase-v1 Release](https://github.com/supermax92/qgraphflow/releases/tag/showcase-v1)，已核验公开下载与 SHA-256；不进入 Git 历史或插件包，查看这些媒体需要联网。生成的图形 HTML 本身支持离线使用。

## 快速使用

截至 2026-09-15，QGraphFlow 尚未在 Codex、Claude Code、Qoder、Cursor 的公开插件市场上架。当前通过 GitHub 仓库或本地插件目录安装；`qgraphflow-local` 是项目自带的分发源名称，不是官方市场。源码版本 `0.0.2` 也不代表同版本 Release 安装包已经发布。

按[安装指南](../clients.zh-CN.md)先下载源码、构建运行包，再按客户端安装。安装后新建会话，先在客户端技能列表中确认 `q-flow` 可见。以下以当前 Codex App 的 `$qgraphflow:q-flow` 入口为例；如果客户端显示 `$q-flow`，请选择它实际提供的入口。其他客户端的调用方式见安装指南。

**不知道从哪里开始？** 直接调用，按提示选择要分析的部分和想了解的问题。

```text
$qgraphflow:q-flow
```

**目标已经明确？** 一句话说明“画哪个部分＋想看什么”，无需先选择图类型。

### 示例一：看懂项目架构

```text
$qgraphflow:q-flow 分析当前项目，生成中文架构图，展示主要模块的职责、依赖关系和系统边界。
```

适合初次接触项目，先了解整体结构。

### 示例二：追踪业务调用

```text
$qgraphflow:q-flow 分析订单创建流程，生成中文时序图，展示价格计算、库存预占、支付和订单落库的调用顺序，并标明失败分支。
```

将“订单创建”及相关步骤替换成项目中的实际业务流程。看完后，在同一对话中继续追问：

```text
$qgraphflow:q-flow 展开上一张图中的库存预占步骤，单独生成中文流程图，展示成功与失败的处理流程。
```

结果默认保存在 `docs/qgraphflow/` 下：打开 `index.html` 即可交互查看、编辑和导出，`graph.json` 保留图数据。

<details>
<summary>手动运行示例：复杂电商九类图</summary>

以下命令仅用于运行仓库自带示例，使用已安装的插件无需克隆本仓库。

准备 Node.js 22，克隆仓库并执行：

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
node skills/q-flow/scripts/validate-graph.mjs examples/showcase/ecommerce.zh-CN.graph.json
node skills/q-flow/scripts/generate-viewer.mjs examples/showcase/ecommerce.zh-CN.graph.json output/ecommerce-zh-CN
```

用浏览器打开 `output/ecommerce-zh-CN/index.html`，在顶部工具栏的「图类型」菜单切换视图。切换图类型会保留各图已保存的文字和位置。通过「更多 → 保存 Graph JSON」保存全部视图：支持的浏览器可选择 JSON 文件写入，其他浏览器下载副本。刷新原 HTML 仍会恢复页面内嵌数据；要重新打开修改后的模型，请用保存的 JSON 生成到新目录。

使用预构建 Viewer 生成页面，无需安装依赖、API Key 或后端服务。让 AI 取证并编写图数据时，使用所选客户端的模型服务。

</details>

## 九类图各自回答什么

| 视图 · PNG | 主要问题 | 本示例范围 |
| --- | --- | --- |
| [架构图](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.zh-CN.architecture.png) | 系统由哪些责任边界协作？ | 渠道、交易编排、价格、风控、库存、支付、订单、事件与履约 |
| [流程图](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.zh-CN.flowchart.png) | 每个决策点如何分支和收敛？ | 缺货、风控拒绝、支付失败补偿与成功提交 |
| [时序图](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.zh-CN.sequence.png) | 一次请求按什么顺序调用和返回？ | 成功结算主链及异步 OrderPaid |
| [ER 图](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.zh-CN.er.png) | 核心数据如何关联？ | 购物车、订单、明细、支付、库存预占和包裹 |
| [部署图](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.zh-CN.deployment.png) | 运行单元放在哪里、怎样连接？ | 边缘、Kubernetes、数据服务、支付和仓配网络 |
| [类图](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.zh-CN.class.png) | 领域对象和代码契约怎样依赖？ | Checkout 应用服务、Order 与四个端口 |
| [状态图](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.zh-CN.state.png) | 订单受哪些事件和守卫条件推进？ | 支付、履约、取消、退款和关闭 |
| [用例图](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.zh-CN.usecase.png) | 每类参与者拥有哪些能力？ | 买家、商家、仓库与客服 |
| [数据流图](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.zh-CN.dataflow.png) | 数据资产经过哪些变换和存储？ | 购物车、交易决策、订单事件、仓配和物流回执 |

这是用于展示 QGraphFlow 能力的概念模型，不对应某个电商仓库。`graph.json` 不伪造源码路径，关系证据统一标记为 `inference`；对真实项目绘图时，应改用源码、DDL、配置、测试和已接受需求中的可追溯证据。

## 开发与参与

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

开发需要 Node.js 22、npm、tar、zip 和 unzip。反馈问题时，请附最小脱敏图数据、客户端和浏览器版本，以及复现步骤。

[证据来源](../references/zh-CN/evidence-sources.md) · [图数据格式](../references/zh-CN/graph-schema.md) · [需求引导](../references/zh-CN/guided-intake.md) · [Viewer 开发与验收](../references/zh-CN/viewer-development.md) · [图形表达约定](../references/zh-CN/visual-contract.md)

## 许可证与归属

[MIT](../../LICENSE) · [第三方声明](../../THIRD_PARTY_NOTICES.md)

QGraphFlow 是采用 MIT 许可证的独立项目。本文电商场景为概念示例，不代表任何真实公司的生产架构。
