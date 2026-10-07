<div align="center">

<h1><picture><source media="(prefers-color-scheme: dark)" srcset="../images/brand/qgraphflow-lockup-dark.svg"><img src="../images/brand/qgraphflow-lockup-light.svg" alt="QGraphFlow" height="64"></picture></h1>

### 把复杂代码，变成可以探索的图。

跟随路径，查看证据，用一个离线文件分享。

<sub>💡 灵感来自 <a href="https://github.com/Cocoon-AI/architecture-diagram-generator">Cocoon-AI/architecture-diagram-generator</a>，感谢原作者的启发。</sub>

[English](../../README.md) · [中文](../../docs/readme/README.zh-CN.md) · [Русский](../../docs/readme/README.ru.md) · [Português](../../docs/readme/README.pt.md) · [日本語](../../docs/readme/README.ja.md) · [Deutsch](../../docs/readme/README.de.md) · [Español](../../docs/readme/README.es.md)

[在线演示](https://supermax92.github.io/qgraphflow/) · [客户端安装](#安装指南) · [反馈问题](https://github.com/supermax92/qgraphflow/issues) · [MIT](../../LICENSE)

</div>

![agent-desk 示例的架构图、时序图与 ER 图，每类 1.5 秒](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.zh-CN.hero.gif)

*支持十一类图：【平台能力架构图、工程分层架构图、组件关系架构图、流程图、时序图、ER 图、部署图、类图、状态图、用例图、数据流图】*

QGraphFlow 从源码、数据结构、配置和需求生成交互式软件图，让关系有据可查，并将结果交付为可分享的离线 HTML。

**差异在哪：** 一个技能覆盖十一类图，每条关系都标明证据类别，有代码支撑的关系还记录对应的源码行，自动布局，能直接在页面里编辑，插件脚本和 Viewer 本身不发任何网络请求。

```bash
npx skills add supermax92/qgraphflow
```

一条命令即可为 Claude Code、Codex、Cursor 和 Qoder 装好技能；以插件方式安装和其他客户端见[安装指南](#安装指南)。

- **探索：** 搜索定位、缩放和平移画布，查看组件职责与上下游关系。

  ![探索：搜索 refund 定位到订单工具集，拉远查看上游的智能体编排器与下游的订单库、物流查询平台，再平移画布](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.zh-CN.explore.gif)

- **核验：** 从节点或连线查看详情，核对源码文件、行号、符号和明确标注的不确定性。

  ![核验：速览卡显示 src/gateway/chat-gateway.js:5-19，详情栏显示符号与证据事实，再查看标为 inference 的 POST /chat 连线](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.zh-CN.verify.gif)

- **编辑：** 解锁后修改文字、移动元素；不满意时一键重置。

  ![编辑：解除布局锁定，把 LLM 服务商改名为 LLM 网关，拖动节点带动连线，最后一键重置](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.zh-CN.edit.gif)

- **分享：** 打开离线 HTML，或将完整图导出为 SVG / PNG。

  ![分享：打开离线 HTML，从「更多」导出 PNG，最后展示导出的文件本身](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.zh-CN.share.gif)

顶部动图依次展示架构图、时序图与 ER 图，每类 1.5 秒，完整循环 4.5 秒；下方四张能力动图各 6.5–8.5 秒。全部动图用源码构建的 Viewer 录制自 [agent-desk 示例](../../examples/showcase/agent-desk)（虚构业务、真实代码），图中文字与界面均为中文。它们作为 [showcase-v2 Release 附件](https://github.com/supermax92/qgraphflow/releases/tag/showcase-v2)托管，不进入 Git 历史与插件包，查看需要联网；生成的图形 HTML 本身可离线使用。

## 安装指南

准备 Node.js 22 及以上版本，以及已配置好模型访问、支持插件功能的客户端。

### 快速安装

```bash
npx skills add supermax92/qgraphflow
```

已用 `skills` 1.7.0 在 Claude Code、Codex、Cursor 和 Qoder 上实测。命令会询问装到哪些客户端；`-a claude-code` 可直接指定，`-g` 改为装到当前用户而不是当前项目。这样装上的技能名是 `q-flow`，不带下文插件安装方式里的 `qgraphflow:` 前缀。

如需以插件方式安装，按以下步骤操作。[Qoder Desktop](#qoder-desktop) 可直接从插件商城安装，跳过第 1 步。

### 1. 下载插件

从 npmjs.com 获取插件，无需账号、登录或令牌。在业务项目之外创建独立目录：

```bash
mkdir qgraphflow-install
cd qgraphflow-install
npm install qgraphflow --ignore-scripts
cd node_modules/qgraphflow
```

此时已进入插件根目录。**npm 下载不会自动完成客户端安装**，请继续第 2 步。这个包还提供 `qgraphflow` 命令，[让图和代码保持同步](#让图和代码保持同步)一节会用到。

以下终端命令均在**包含 `skills/` 的插件根目录**执行。

### 2. 选择客户端安装

#### Codex App / CLI

终端需已安装 Codex CLI：

```bash
codex plugin marketplace add .
codex plugin add qgraphflow@supermax92
```

新建会话，输入 `$`，选择 `qgraphflow:q-flow`。

#### Claude Code

```bash
claude plugin marketplace add ./
claude plugin install qgraphflow@supermax92 --scope user
```

新建会话，输入 `/q-flow`（或完整名称 `/qgraphflow:q-flow`）。

#### Qoder CLI

```bash
qodercli plugins install .
```

新建会话，选择 `q-flow`。

#### Qoder Desktop

**推荐：**打开 **Settings → Plugins → Marketplace**，搜索 **QGraphFlow** 或 **代码图谱可视化**，安装插件。新建会话，选择 `q-flow`。

如需本地安装，先完成第 1 步，再打开 **Settings → Plugins → Custom → Import**，导入完整的插件根目录。新建会话，选择 `q-flow`。

#### Cursor

将插件根目录中的全部内容（含隐藏文件）复制到：

```text
~/.cursor/plugins/local/qgraphflow/
```

确认其中存在 `.cursor-plugin/plugin.json`，重新加载窗口，在 **Customize** 中找到 `q-flow`。若已有旧版本，先备份，勿混合新旧文件。

### 3. 开始使用

在客户端打开你的业务项目，新建会话并选择技能，按下方[快速使用](#快速使用)中的示例描述需求。生成后，用浏览器打开输出的 HTML。

需要自行构建？参见[源码构建说明](https://github.com/supermax92/qgraphflow/blob/main/docs/distribution.md#prepare-locally)。

## 快速使用

以下以 Codex 的 `$qgraphflow:q-flow` 入口为例；如果客户端显示 `$q-flow`，请选择它实际提供的入口。其他客户端使用上方对应的技能入口。

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

结果默认保存在 `docs/qgraphflow/` 下：打开 `index.html` 即可交互查看、编辑和导出，`graph.json` 保留图数据。每个视图还会写出一份 SVG（`diagram.svg`，多视图时为 `diagram-<n>-<type>.svg`），可以直接作为图片嵌进 README、PR 或 Wiki。

在页面里编辑后，用 Chrome 或 Edge 执行「更多 → 保存修改」并选一次图所在的文件夹，即可原地重写页面、`graph.json` 和 SVG。其他浏览器只能保存 `graph.json`：把它放回该文件夹，再用 `npx -y qgraphflow generate docs/qgraphflow/<name>/graph.json docs/qgraphflow/<name> --layout preserve --force` 重新生成页面和 SVG。

<details>
<summary>手动运行示例：复杂电商九类图</summary>

以下命令仅用于运行仓库自带示例，使用已安装的插件无需克隆本仓库。

准备 Node.js 22 及以上版本，克隆仓库并执行：

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
node skills/q-flow/scripts/validate-graph.mjs examples/showcase/ecommerce.zh-CN.graph.json
node skills/q-flow/scripts/generate-viewer.mjs examples/showcase/ecommerce.zh-CN.graph.json output/ecommerce-zh-CN
```

用浏览器打开 `output/ecommerce-zh-CN/index.html`，九个 SVG 就在同一目录。在顶部工具栏的「图类型」菜单切换视图，切换图类型会保留各图已保存的文字和位置。「更多 → 保存修改」按上文所述保存全部视图。同样的页面也在[在线演示](https://supermax92.github.io/qgraphflow/)里。

使用预构建 Viewer 生成页面，无需安装依赖、API Key 或后端服务。让 AI 取证并编写图数据时，使用所选客户端的模型服务。

</details>

## 让图和代码保持同步

带仓库根目录生成的图会记下每个组件定义在哪里，以及每条有代码支撑的关系所在的那一行（调用、外键等）。用 `--repo-root` 校验时，记录的文件不在了、行号超出文件，或记录的符号离开了原来的行范围，校验都会失败，并在错误里写出这个符号现在所在的行。把下面这个任务加进 CI，不需要构建、登录或令牌：

```yaml
name: Diagrams
on: [push, pull_request]
jobs:
  diagrams:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: '22'
      - run: |
          for graph in docs/qgraphflow/*/graph.json; do
            npx -y qgraphflow validate "$graph" --input-only --repo-root . || { echo "::error file=$graph::$graph failed validation"; failed=1; }
          done
          exit ${failed:-0}
```

失败后，让技能刷新这张图：

```text
$qgraphflow:q-flow CI 提示 docs/qgraphflow/order-sequence 的图过时了，刷新一下。
```

技能会把在文件里只找到一处的符号重新定位，只修改仍然报错的锚点，再保留你调整过的位置和文字，重新生成页面和 SVG；不会重画整张图。

## 十一类图各自回答什么

| 视图 · PNG | 主要问题 | 本示例范围 |
| --- | --- | --- |
| 平台能力架构图 | 平台具备哪些能力？ | 能力分区与矩阵 |
| 工程分层架构图 | 工程代码怎样组织？ | 工程层级与共享支撑 |
| 组件关系架构图 | 系统由哪些责任边界协作？ | 渠道、交易编排、价格、风控、库存、支付、订单、事件与履约 |
| 流程图 | 每个决策点如何分支和收敛？ | 缺货、风控拒绝、支付失败补偿与成功提交 |
| 时序图 | 一次请求按什么顺序调用和返回？ | 成功结算主链及异步 OrderPaid |
| ER 图 | 核心数据如何关联？ | 购物车、订单、明细、支付、库存预占和包裹 |
| 部署图 | 运行单元放在哪里、怎样连接？ | 边缘、Kubernetes、数据服务、支付和仓配网络 |
| 类图 | 领域对象和代码契约怎样依赖？ | Checkout 应用服务、Order 与四个端口 |
| 状态图 | 订单受哪些事件和守卫条件推进？ | 支付、履约、取消、退款和关闭 |
| 用例图 | 每类参与者拥有哪些能力？ | 买家、商家、仓库与客服 |
| 数据流图 | 数据资产经过哪些变换和存储？ | 购物车、交易决策、订单事件、仓配和物流回执 |

这是用于展示 QGraphFlow 能力的概念模型，不对应某个电商仓库。`graph.json` 不伪造源码路径，关系证据统一标记为 `inference`；对真实项目绘图时，应改用源码、DDL、配置、测试和已接受需求中的可追溯证据。

## 开发与参与

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

开发需要 Node.js 22 及以上版本、npm、tar、zip 和 unzip。反馈问题时，请附最小脱敏图数据、客户端和浏览器版本，以及复现步骤。

参考文档（英文）：[证据来源](../../skills/q-flow/references/evidence-sources.md) · [图数据格式](../../skills/q-flow/references/graph-schema.md) · [需求引导](../../skills/q-flow/references/guided-intake.md) · [Viewer 开发与验收](../../skills/q-flow/references/viewer-development.md) · [图形表达约定](../../skills/q-flow/references/visual-contract.md)

## 许可证与归属

[MIT](../../LICENSE) · [第三方声明](../../THIRD_PARTY_NOTICES.md)

QGraphFlow 是采用 MIT 许可证的独立项目。本文场景为概念示例，不代表任何真实公司的生产架构。

## Architecture overviews / 架构总览

Architecture now includes component relations, platform capabilities and engineering layers. Describe the subject and question; the skill chooses the template. Requested collections can contain multiple architecture views with independent edits.

```text
$qgraphflow:q-flow 分析当前项目的平台能力和业务接入方式，生成中文平台能力总览。
$qgraphflow:q-flow 分析当前工程组织和组件分层，生成工程整体与一个组件剖面的中文总览。
$qgraphflow:q-flow Generate an English platform capability overview of this project and show how application modules integrate.
```

See [examples/architecture-overviews](../../examples/architecture-overviews) for conceptual reference diagrams and a small source-backed Maven example. Unlock an overview to reorder cards within a layer or edit body text, badges and explanatory sections. Save keeps all views; reset restores only the current one.
