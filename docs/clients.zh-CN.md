# 安装指南

[English](clients.md) · [中文](clients.zh-CN.md) · [Русский](clients.ru.md) · [Português](clients.pt.md) · [日本語](clients.ja.md) · [Deutsch](clients.de.md) · [Español](clients.es.md)

[返回 README](readme/README.zh-CN.md)

Qoder Desktop 可从插件商城安装，跳过第 1 步（见下方对应小节）。其他客户端安装从 npmjs.com 下载的插件包。

准备 Node.js 22 及以上版本（含 npm），以及已配置好模型访问的客户端。

## 快速安装

```bash
npx skills add supermax92/qgraphflow
```

为 Claude Code、Codex、Cursor 和 Qoder 安装技能 `q-flow`（已用 `skills` 1.7.0 实测），命令会询问装到哪些客户端。如需以插件方式安装，按以下步骤操作。

## 1. 从 npm 下载插件

```bash
mkdir qgraphflow-install
cd qgraphflow-install
npm install qgraphflow --ignore-scripts
cd node_modules/qgraphflow
```

在业务项目之外创建该目录，无需账号、登录或令牌。此时已进入插件根目录。npm 下载不会自动完成客户端安装，请继续第 2 步。如需安装尚未发布的代码，参见[源码构建说明](https://github.com/supermax92/qgraphflow/blob/main/docs/distribution.md#prepare-locally)。

## 2. 选择客户端安装

以下命令均在第 1 步进入的插件根目录（`qgraphflow-install/node_modules/qgraphflow`）执行，不是你的业务项目目录。

### Codex App / CLI

```bash
codex plugin marketplace add .
codex plugin add qgraphflow@supermax92
```

这里的 `marketplace add` 只注册本地安装源，不要求公开市场上架。参见 [OpenAI 官方文档](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli)。

新建会话，输入 `$`，选择 `qgraphflow:q-flow`（以客户端实际显示的名称为准）。

### Claude Code

```bash
claude plugin marketplace add .
claude plugin install qgraphflow@supermax92 --scope user
```

新建会话，输入 `/q-flow`（或完整名称 `/qgraphflow:q-flow`）。

### Qoder CLI

```bash
qodercli plugins install .
```

新建会话，选择 `q-flow`。

### Qoder Desktop

**推荐：**打开 **Settings → Plugins → Marketplace**，搜索 **QGraphFlow** 或 **代码图谱可视化**，安装插件。新建会话，选择 `q-flow`。

如需本地安装，先完成第 1 步，再打开 **Settings → Plugins → Custom → Import**，导入完整的插件根目录；重新加载后选择 `q-flow`。

### Cursor

将插件根目录内的全部内容（含隐藏文件）复制到 `~/.cursor/plugins/local/qgraphflow/`。已有目录先备份，勿混合新旧文件。

确认清单位于 `~/.cursor/plugins/local/qgraphflow/.cursor-plugin/plugin.json`，重新加载窗口，在 Customize → Plugins / Skills 中选择 `q-flow`。

此本地方式曾在 Cursor 3.19.13 验证；其他版本请确认插件和技能已显示。
