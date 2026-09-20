# 安装指南

[English](clients.md) · [中文](clients.zh-CN.md) · [Русский](clients.ru.md) · [Português](clients.pt.md) · [日本語](clients.ja.md) · [Deutsch](clients.de.md) · [Español](clients.es.md)

[返回 README](readme/README.zh-CN.md)

Qoder Desktop 可从插件商城安装，Claude Code 可直接从 GitHub 安装（见下方对应小节），两者均可跳过第 1 步。采用本地安装时，先下载 QGraphFlow 源码并构建运行包。

准备 Node.js 22，以及已配置好模型访问的客户端。从源码构建还需 Git、npm、`tar`、`zip` 和 `unzip`。

## 1. 下载并构建（用于本地安装）

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
npm run package
unzip -q dist/qgraphflow-0.0.5.zip -d dist/runtime
```

已有 QGraphFlow 源码可跳过克隆，并进入其根目录。ZIP 文件名以 QGraphFlow 的 `package.json` 版本为准；使用新的输出和解压目录，不覆盖旧文件。Git 下载只包含已推送的代码，不包含尚未提交的本地修改。

## 2. 选择客户端安装

以下命令均在 QGraphFlow 源码根目录执行，不是你的业务项目目录。安装的是该目录下 `dist/runtime` 中的完整运行包。

### Codex App / CLI

```bash
codex plugin marketplace add ./dist/runtime
codex plugin add qgraphflow@supermax92
```

这里的 `marketplace add` 只注册本地安装源，不要求公开市场上架。参见 [OpenAI 官方文档](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli)。

新建会话，输入 `$`，选择 `qgraphflow:q-flow`（以客户端实际显示的名称为准）。

### Claude Code

直接从 GitHub 安装，无需执行第 1 步：

```bash
claude plugin marketplace add supermax92/qgraphflow
claude plugin install qgraphflow@supermax92 --scope user
```

或使用第 1 步构建的运行包：

```bash
claude plugin marketplace add ./dist/runtime
claude plugin install qgraphflow@supermax92 --scope user
```

新建会话，输入 `/q-flow`（或完整名称 `/qgraphflow:q-flow`）。

### Qoder CLI

```bash
qodercli plugins install ./dist/runtime
```

新建会话，选择 `q-flow`。

### Qoder Desktop

**推荐：**打开 **Settings → Plugins → Marketplace**，搜索 **代码图谱可视化** 或 **qgraphflow**，安装插件。新建会话，选择 `q-flow`。无需下载 ZIP 或构建源码。

如需本地安装，先完成第 1 步，再打开 **Settings → Plugins → Custom → Import**，导入完整的 `dist/runtime` 目录；重新加载后选择 `q-flow`。

### Cursor

将 `dist/runtime` 内的全部内容（含隐藏文件）复制到 `~/.cursor/plugins/local/qgraphflow/`。已有目录先备份，勿混合新旧文件。

确认清单位于 `~/.cursor/plugins/local/qgraphflow/.cursor-plugin/plugin.json`，重新加载窗口，在 Customize → Plugins / Skills 中选择 `q-flow`。

此本地方式曾在 Cursor 3.19.13 验证；其他版本请确认插件和技能已显示。
