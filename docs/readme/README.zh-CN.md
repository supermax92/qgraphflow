<div align="center">

# QGraphFlow

### 把复杂代码，变成可以探索的图。

跟随路径，查看证据，用一个离线文件分享。

[English](../../README.md) · [中文](../../docs/readme/README.zh-CN.md) · [日本語](../../docs/readme/README.ja.md) · [한국어](../../docs/readme/README.ko.md) · [Deutsch](../../docs/readme/README.de.md) · [Français](../../docs/readme/README.fr.md) · [Español](../../docs/readme/README.es.md)

[客户端安装](../../docs/clients.md) · [反馈问题](https://github.com/supermax92/qgraphflow/issues) · [MIT](../../LICENSE)

</div>

![基于 Apache Kafka 源码录制的 QGraphFlow 真实交互。 架构图](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.zh-CN.architecture.gif)

*基于 Apache Kafka 源码录制的 QGraphFlow 真实交互。*

QGraphFlow 从源码、数据结构、配置和需求生成交互式软件图，让关系有据可查，并将结果交付为可分享的离线 HTML。

- **探索：**播放编排路径、搜索节点、查看组件职责。
- **核验：**保留源码文件、行号、符号和明确标注的不确定性。
- **分享：**打开离线 HTML，或将完整图导出为 SVG / PNG。

README 动图仅在阅读文档时下载，Git 克隆和插件安装包都不包含 GIF。精简安装包保留订单流程示例及英文 Kafka 图集；七种语言的图集均保留在 Git 仓库中。

## 立即体验 Kafka 的九类图

准备 Node.js 22，克隆仓库并执行：

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
node skills/q-flow/scripts/validate-graph.mjs examples/showcase/kafka.zh-CN.graph.json
node skills/q-flow/scripts/generate-viewer.mjs examples/showcase/kafka.zh-CN.graph.json output/kafka
```

用浏览器打开 `output/kafka/index.html`，在工具栏选择图类型。同目录的 `graph.json` 保留可编辑模型。修改输入 JSON 后，请生成到新目录，以保留先前结果。

使用预构建 Viewer 生成页面，无需安装依赖、API Key 或后端服务。让 AI 取证并编写图数据时，使用所选客户端的模型服务。

## 同一份代码，九种理解方式。

上方架构图跟随生产者到 Leader 日志的路径。展开下方其他视图；每段 GIF 的界面和图内说明都与本 README 的语言一致。

**01 · 架构图** — 依据源码梳理 Leader 追加路径。本图未展开网络内部、复制和确认响应。

<details>
<summary><strong>02 · 流程图</strong> · Kafka：send() 何时唤醒 Sender？</summary>

![基于 Apache Kafka 源码录制的 QGraphFlow 真实交互。 流程图](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.zh-CN.flowchart.gif)

RecordAccumulator.append() 之后的分支。本图省略此前的校验与异常路径；返回 Future 不代表 Broker 已确认记录。

</details>

<details>
<summary><strong>03 · 时序图</strong> · Kafka：acks=1 的生产请求</summary>

![基于 Apache Kafka 源码录制的 QGraphFlow 真实交互。 时序图](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.zh-CN.sequence.gif)

成功的非事务生产请求。KafkaApis 表示 Broker 请求边界，网络与分区内部细节折叠在参与者中。acks=1 不要求 Follower 确认。

</details>

<details>
<summary><strong>04 · ER 图</strong> · Kafka：ProduceRequest v13 的内部结构</summary>

![基于 Apache Kafka 源码录制的 QGraphFlow 真实交互。 ER 图](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.zh-CN.er.gif)

这里展示协议包含关系，并非 SQL 表。数组用零到多的结构关系表示，不隐含数据库主键或外键。版本 13 通过 TopicId 标识主题。

</details>

<details>
<summary><strong>05 · 部署图</strong> · Kafka：分离部署的 KRaft 角色</summary>

![基于 Apache Kafka 源码录制的 QGraphFlow 真实交互。 部署图](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.zh-CN.deployment.gif)

仓库中的 Docker Compose 明文示例：三个 Broker 和三个独立 Controller 容器。Controller 仲裁组折叠为一个可视节点。这是开发配置，不是生产部署建议。

</details>

<details>
<summary><strong>06 · 类图</strong> · Kafka：生产者 API 与实现类</summary>

![基于 Apache Kafka 源码录制的 QGraphFlow 真实交互。 类图](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.zh-CN.class.gif)

展示部分 Java 类型和成员。KafkaProducer 与 MockProducer 都实现 Producer<K,V>，ProducerRecord 承载输入。签名已简写，不推断对象所有权关系。

</details>

<details>
<summary><strong>07 · 状态图</strong> · Kafka：消费者如何加入消费组</summary>

![基于 Apache Kafka 源码录制的 QGraphFlow 真实交互。 状态图](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.zh-CN.state.gif)

MemberState 的正常分配流程。本图省略错误、隔离与离组状态；Broker 发来新分配时，协调过程可能再次发生。

</details>

<details>
<summary><strong>08 · 用例图</strong> · Kafka：不同客户端能做什么</summary>

![基于 Apache Kafka 源码录制的 QGraphFlow 真实交互。 用例图](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.zh-CN.usecase.gif)

将客户端角色映射到公开 Java API。角色关联描述能力，不代表执行顺序。位点提交与管理操作仍由应用显式选择。

</details>

<details>
<summary><strong>09 · 数据流图</strong> · Kafka：从应用数据到消费记录</summary>

![基于 Apache Kafka 源码录制的 QGraphFlow 真实交互。 数据流图](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.zh-CN.dataflow.gif)

数据经过序列化、分区存储与反序列化的过程。批处理、Produce/Fetch 网络传输及复制被折叠；本图不描述位点提交或处理保证。

</details>

## 为你自己的项目绘图

按客户端安装指南安装插件。Codex 使用 `$q-flow`，Claude Code 使用 `/qgraphflow:q-flow`；Qoder 和 Cursor 通过客户端提供的技能入口选择。指南记录了安装步骤及原生客户端的验收状态。

> 分析当前模块的入口、核心组件与关系，生成中文交互式架构图；保留源码文件和行号证据，并标明无法确认的关系。

CodeGraph 为可选工具；未配置时，技能直接读取源码。默认产物位于目标项目的 `docs/qgraphflow/<scope>-<diagram-type>/`，也可以指定其他目录。

## 从源码出发，让结论可核验

九个示例均基于 Apache Kafka 提交 `634a935e7291`（该检出版本声明为 `4.4.0`）。部分取证入口如下：

| 视图 | 源码证据 |
| --- | --- |
| 架构图 | [`ReplicaManager.appendToLocalLog` · L1376](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/core/src/main/scala/kafka/server/ReplicaManager.scala#L1376) |
| 流程图 | [`KafkaProducer.doSend` · L1241](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/KafkaProducer.java#L1241) |
| 时序图 | [`KafkaApis.handleProduceRequest` · L457](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/core/src/main/scala/kafka/server/KafkaApis.scala#L457) |
| ER 图 | [`ProduceRequest` · L50](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/resources/common/message/ProduceRequest.json#L50) |
| 部署图 | [`controller-1 / controller-2 / controller-3` · L18](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/docker/examples/docker-compose-files/cluster/isolated/plaintext/docker-compose.yml#L18) |
| 类图 | [`Producer` · L97](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/Producer.java#L97) |
| 状态图 | [`STABLE` · L67](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/consumer/internals/MemberState.java#L67) |
| 用例图 | [`Producer.send` · L97](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/Producer.java#L97) |
| 数据流图 | [`KafkaProducer.doSend` · L1197](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/KafkaProducer.java#L1197) |

## 正确理解这些示例

- 播放展示编排路径或节点阅读顺序，不采集程序的真实执行轨迹。Leader 追加、生产者确认和消费者处理完成是不同事件。
- 准确性取决于证据。关键关系需人工复核；图中区分源码、结构、配置、约定和推断。
- 页面中的布局调整会用于 SVG / PNG 导出，但不会自动保存到 `graph.json`。
- 不同语言共享相同的源码证据和图结构。代码标识符、API 名称、结构字段和标准图形记法保留原文。

## 开发与参与

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

开发需要 Node.js 22、npm、tar、zip 和 unzip。反馈问题时，请附最小脱敏图数据、客户端和浏览器版本，以及复现步骤。

[图数据格式](../../skills/q-flow/references/graph-schema.md) · [浏览器验收指南](../../skills/q-flow/references/viewer-development.md)

## 许可证与归属

[MIT](../../LICENSE) · [第三方声明](../../THIRD_PARTY_NOTICES.md)

QGraphFlow 是采用 MIT 许可证的独立项目。Apache Kafka 仅作为演示对象。文中产品名称归各自权利人所有，不表示隶属、赞助或背书关系。
