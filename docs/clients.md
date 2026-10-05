# Installation guide

[English](clients.md) · [中文](clients.zh-CN.md) · [Русский](clients.ru.md) · [Português](clients.pt.md) · [日本語](clients.ja.md) · [Deutsch](clients.de.md) · [Español](clients.es.md)

[Back to README](../README.md)

Qoder Desktop can install the plugin from its marketplace and skip step 1 (see its section below). The other clients install the plugin package from npmjs.com.

You need Node.js 22 or later (with npm) and a client with model access configured.

## Quick install

```bash
npx skills add supermax92/qgraphflow
```

Installs the skill as `q-flow` for Claude Code, Codex, Cursor and Qoder (tested with `skills` 1.7.0); it asks which clients to install to. To install the plugin instead, follow the steps below.

## 1. Download the plugin from npm

```bash
mkdir qgraphflow-install
cd qgraphflow-install
npm install qgraphflow --ignore-scripts
cd node_modules/qgraphflow
```

Create the directory outside your application project; no account, login or token is needed. You are now in the plugin root. Downloading through npm does not install the plugin in your client; continue with step 2. To install code that is not yet released, see the [source build instructions](https://github.com/supermax92/qgraphflow/blob/main/docs/distribution.md#prepare-locally).

## 2. Install in your client

Run the commands below from the plugin root entered in step 1 (`qgraphflow-install/node_modules/qgraphflow`), not your application's project directory.

### Codex App / CLI

```bash
codex plugin marketplace add .
codex plugin add qgraphflow@supermax92
```

Here, `marketplace add` only registers a local installation source; no public marketplace listing is required. See the [official OpenAI documentation](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli).

Start a new session, type `$`, and select `qgraphflow:q-flow` (use the name actually shown by your client).

### Claude Code

```bash
claude plugin marketplace add .
claude plugin install qgraphflow@supermax92 --scope user
```

Start a new session and enter `/q-flow` (or the fully qualified `/qgraphflow:q-flow`).

### Qoder CLI

```bash
qodercli plugins install .
```

Start a new session and select `q-flow`.

### Qoder Desktop

**Recommended:** Open **Settings → Plugins → Marketplace**, search for **QGraphFlow** or **代码图谱可视化**, and install the plugin. Start a new session and select `q-flow`.

For local installation, complete step 1, then open **Settings → Plugins → Custom → Import** and import the complete plugin root directory. Reload, then select `q-flow`.

### Cursor

Copy everything inside the plugin root, including hidden files, to `~/.cursor/plugins/local/qgraphflow/`. Back up any existing directory first; do not mix old and new files.

Confirm the manifest is at `~/.cursor/plugins/local/qgraphflow/.cursor-plugin/plugin.json`. Reload the window, then select `q-flow` under Customize → Plugins / Skills.

This local method was tested with Cursor 3.19.13. On other versions, confirm that both the plugin and skill appear.
