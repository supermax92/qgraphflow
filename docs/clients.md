# Installation guide

[English](clients.md) · [中文](clients.zh-CN.md) · [Русский](clients.ru.md) · [Português](clients.pt.md) · [日本語](clients.ja.md) · [Deutsch](clients.de.md) · [Español](clients.es.md)

[Back to README](../README.md)

Qoder IDE can install the plugin from its marketplace, and Claude Code can install directly from GitHub (see their sections below). Both can skip step 1. For local installation, download the QGraphFlow source and build the runtime package first.

You need Node.js 22 and a client with model access configured. Building from source also requires Git, npm, `tar`, `zip` and `unzip`.

## 1. Download and build for local installation

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
npm run package
unzip -q dist/qgraphflow-0.0.4.zip -d dist/runtime
```

If you already have the QGraphFlow source, skip cloning and enter its root directory. Match the ZIP filename to the version in QGraphFlow's `package.json`. Use new build and extraction directories; do not overwrite existing files. Git downloads contain only pushed code, not uncommitted local changes.

## 2. Install in your client

Run the commands below from the QGraphFlow source root, not your application's project directory. They install the complete runtime package in that directory's `dist/runtime` folder.

### Codex App / CLI

```bash
codex plugin marketplace add ./dist/runtime
codex plugin add qgraphflow@supermax92
```

Here, `marketplace add` only registers a local installation source; no public marketplace listing is required. See the [official OpenAI documentation](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli).

Start a new session, type `$`, and select `qgraphflow:q-flow` (use the name actually shown by your client).

### Claude Code

Install directly from GitHub without step 1:

```bash
claude plugin marketplace add supermax92/qgraphflow
claude plugin install qgraphflow@supermax92 --scope user
```

Or, from the runtime package built in step 1:

```bash
claude plugin marketplace add ./dist/runtime
claude plugin install qgraphflow@supermax92 --scope user
```

Start a new session and enter `/q-flow` (or the fully qualified `/qgraphflow:q-flow`).

### Qoder CLI

```bash
qodercli plugins install ./dist/runtime
```

Start a new session and select `q-flow`.

### Qoder IDE

**Recommended:** Open **Settings → Plugins → Marketplace**, search for **代码图谱可视化** or **qgraphflow**, and install the plugin. Start a new session and select `q-flow`. No ZIP download or source build is required.

For local installation, complete step 1, then open **Settings → Plugins → Custom → Import** and import the complete `dist/runtime` directory. Reload, then select `q-flow`.

### Cursor

Copy everything inside `dist/runtime`, including hidden files, to `~/.cursor/plugins/local/qgraphflow/`. Back up any existing directory first; do not mix old and new files.

Confirm the manifest is at `~/.cursor/plugins/local/qgraphflow/.cursor-plugin/plugin.json`. Reload the window, then select `q-flow` under Customize → Plugins / Skills.

This local method was tested with Cursor 3.19.13. On other versions, confirm that both the plugin and skill appear.
