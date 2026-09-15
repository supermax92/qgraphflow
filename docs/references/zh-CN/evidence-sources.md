# 证据来源与 CodeGraph 回退

[English](../../../skills/q-flow/references/evidence-sources.md) · [简体中文](evidence-sources.md) · [Русский](../ru/evidence-sources.md) · [Português](../pt/evidence-sources.md) · [日本語](../ja/evidence-sources.md) · [Deutsch](../de/evidence-sources.md) · [Español](../es/evidence-sources.md)

CodeGraph 是首选的调用图加速工具，不是必需依赖。

## CodeGraph 预检

这里指 [`colbymchenry/codegraph`](https://github.com/colbymchenry/codegraph)，通过本地 CLI 或 MCP 服务使用。

1. 检查 `PATH` 中是否有 `codegraph`，目标仓库中是否有 `.codegraph/`。
2. 两者都存在时，先运行 `codegraph status`，再执行一次范围明确的 `codegraph explore "<question or symbols>"` 查询，然后直接追踪仓库源码。
3. 已配置的 CodeGraph MCP 工具也可承担同一次有界查询。使用当前客户端实际可用的工具，不假设客户端专属工具名称。
4. CLI、MCP 工具或最新索引不可用时，直接按下方方式回退。普通绘图不需要安装、初始化 CodeGraph，解析 npm 版本或更改客户端配置。

## 用户要求时的可选安装

1. 仅在用户要求或授权配置 CodeGraph 时，使用 `npm view @colbymchenry/codegraph version` 解析确切的稳定版本，并核对该版本的官方安装说明和支持目标。
2. 安装前明确目标客户端、命令和写入位置：可执行文件、客户端配置／指引、`.codegraph/` 索引。安装器支持时优先采用项目级配置。不要假设所有客户端都用 `--target=codex`，也不要由客户端名称臆造目标值。
3. 固定已解析的包版本，仅在已授权仓库中初始化。若安装器未集成该客户端，使用受支持的独立 CLI 配置或直接读源码；不强制要求 MCP 集成。
4. 安装后运行 `codegraph status` 验证，使用可用 CLI 或 MCP 工具；必要时按客户端流程重新加载或重启。如果版本解析或安装失败，报告结果并继续直接追踪，不自动换另一个安装器。

## 回退顺序

1. 先用 `rg --files` 定位文件，再缩小 `rg` 范围，查找声明、入口、调用方、实现、配置键和测试。
2. 阅读完整的相关源码路径，保留文件、行号和符号锚点。
3. 构建模型、包内产物、聚焦测试或运行配置会影响结论时，一并核验。
4. 仅用框架文档解释框架负责的行为，将其标为 `framework`，不要当成仓库源码证据。
5. 非关键但尚未确认的关系标为 `inference`。声称的主路径中无法确认的关系应省略。

## 各图类型的权威依据

| 图类型 | 不使用 CodeGraph 时优先采用的证据 |
| --- | --- |
| 架构、时序、类、数据流 | 入口、调用方、接口、实现、构建依赖、RPC/MQ 客户端和聚焦测试 |
| 流程、状态、用例 | 已接受的需求和 API 文档，再核对控制器／服务行为与测试；文档和实现不一致时分别展示 |
| ER | 优先 DDL 和迁移，再看 JPA 实体、ORM/MyBatis 映射、约束和仓库测试 |
| 部署 | Dockerfile、Compose、Kubernetes、Helm、服务配置、网络策略和 CI/CD 清单 |

直接追踪不能保证完整覆盖反射、依赖注入、生成代理、运行时路由、RPC 或消息通信。说明这一限制，并区分 `source`、`config`、`schema`、`test`、`document`、`framework`、`inference` 证据。
