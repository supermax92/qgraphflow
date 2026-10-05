<div align="center">

<h1><picture><source media="(prefers-color-scheme: dark)" srcset="docs/images/brand/qgraphflow-lockup-dark.svg"><img src="docs/images/brand/qgraphflow-lockup-light.svg" alt="QGraphFlow" height="64"></picture></h1>

### Turn complex code into diagrams you can explore.

Follow the path. Inspect the evidence. Share one offline file.

<sub>💡 Inspired by <a href="https://github.com/Cocoon-AI/architecture-diagram-generator">Cocoon-AI/architecture-diagram-generator</a> — thanks to the original author for the idea.</sub>

[English](README.md) · [中文](docs/readme/README.zh-CN.md) · [Русский](docs/readme/README.ru.md) · [Português](docs/readme/README.pt.md) · [日本語](docs/readme/README.ja.md) · [Deutsch](docs/readme/README.de.md) · [Español](docs/readme/README.es.md)

[Live demo](https://supermax92.github.io/qgraphflow/) · [Client installation](#installation-guide) · [Report an issue](https://github.com/supermax92/qgraphflow/issues) · [MIT](LICENSE)

</div>

![Architecture, sequence and ER views of the agent-desk example, 1.5 seconds each](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.en.hero.gif)

*Nine diagram types: architecture, flowchart, sequence, ER, deployment, class, state, use case and data flow.*

QGraphFlow turns source code, schemas, configuration and requirements into interactive software diagrams, with evidence you can inspect and an offline HTML file you can share.

**What sets it apart:** nine diagram types from one skill, a source for every relationship, automatic layout, editing in the page, and no network requests from the plugin scripts or the Viewer itself.

```bash
npx skills add supermax92/qgraphflow
```

One command installs the skill for Claude Code, Codex, Cursor and Qoder; the [installation guide](#installation-guide) covers the plugin installations and the other clients.

- **Explore:** search, zoom and pan; inspect responsibilities and upstream/downstream relationships.

  ![Explore: search for refund, jump to Order tools, zoom out to the orchestrator upstream and the order database and logistics downstream, then pan](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.en.explore.gif)

- **Verify:** inspect nodes and edges for source files, lines, symbols and explicitly marked uncertainty.

  ![Verify: quick-look card with src/gateway/chat-gateway.js:5-19, details with the symbol and evidence facts, then the POST /chat edge marked as inference](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.en.verify.gif)

- **Edit:** unlock the layout, change text and move elements; reset when needed.

  ![Edit: unlock the layout, rename LLM provider to LLM gateway, drag it with its edges, then reset](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.en.edit.gif)

- **Share:** open offline HTML or export the complete diagram as SVG / PNG.

  ![Share: open the offline HTML, export PNG from More, then the exported file itself](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.en.share.gif)

The top animation shows the architecture, sequence and ER views for 1.5 seconds each (4.5 seconds per loop); the four feature animations run 6.5–8.5 seconds. All of them are recorded from the source-built Viewer on the [agent-desk example](examples/showcase/agent-desk) — fictional business, real code — with English graph and interface text. They are hosted as [showcase-v2 Release assets](https://github.com/supermax92/qgraphflow/releases/tag/showcase-v2) and kept out of Git history and the plugin package, so viewing them needs network access; the generated diagram HTML itself works offline.

## Installation guide

You need Node.js 22 or later and a plugin-capable client with model access configured.

### Quick install

```bash
npx skills add supermax92/qgraphflow
```

Tested with `skills` 1.7.0 for Claude Code, Codex, Cursor and Qoder. It asks which clients to install to; `-a claude-code` names one, and `-g` installs for your user instead of the current project. The skill installs as `q-flow`, without the `qgraphflow:` prefix of the plugin installations below.

To install it as a plugin instead, follow the steps below. [Qoder Desktop](#qoder-desktop) users can install from the marketplace and skip step 1.

### 1. Download the plugin

Get the plugin from npmjs.com; no account, login or token is needed. Create a separate directory outside your application project:

```bash
mkdir qgraphflow-install
cd qgraphflow-install
npm install qgraphflow --ignore-scripts
cd node_modules/qgraphflow
```

You are now in the plugin root. **Downloading through npm does not automatically install the plugin in your client;** continue with step 2. The package also provides the `qgraphflow` command used in [Keep diagrams in sync with code](#keep-diagrams-in-sync-with-code).

Run the following terminal commands from **the plugin root containing `skills/`**.

### 2. Install in your client

#### Codex App / CLI

Codex CLI must be installed and available in your terminal:

```bash
codex plugin marketplace add .
codex plugin add qgraphflow@supermax92
```

Start a new session, type `$`, and select `qgraphflow:q-flow`.

#### Claude Code

```bash
claude plugin marketplace add .
claude plugin install qgraphflow@supermax92 --scope user
```

Start a new session and enter `/q-flow` (or the fully qualified `/qgraphflow:q-flow`).

#### Qoder CLI

```bash
qodercli plugins install .
```

Start a new session and select `q-flow`.

#### Qoder Desktop

**Recommended:** Open **Settings → Plugins → Marketplace**, search for **QGraphFlow** or **代码图谱可视化**, and install the plugin. Start a new session and select `q-flow`.

For local installation, complete step 1, then open **Settings → Plugins → Custom → Import** and import the complete plugin root directory. Start a new session and select `q-flow`.

#### Cursor

Copy everything in the plugin root, including hidden files, into:

```text
~/.cursor/plugins/local/qgraphflow/
```

Confirm that `.cursor-plugin/plugin.json` exists there, reload the window, and find `q-flow` in **Customize**. Back up any previous version first; do not mix old and new files.

### 3. Start using it

Open your project in the client, start a new session, and select the skill. Describe your task using the [Quick start](#quick-start) examples below. Open the generated HTML in your browser.

Building it yourself? See the [source build instructions](https://github.com/supermax92/qgraphflow/blob/main/docs/distribution.md#prepare-locally).

## Quick start

These examples use `$qgraphflow:q-flow` in Codex. If your client shows `$q-flow`, select that entry instead. For other clients, use the skill entry described above.

**Not sure where to begin?** Invoke the skill and choose the subject and question when prompted.

```text
$qgraphflow:q-flow
```

**Already have a goal?** Say which part to draw and what you want to understand. You do not need to choose a diagram type first.

### Example 1: Understand the architecture

```text
$qgraphflow:q-flow Analyze this project and create an architecture diagram in English showing module responsibilities, dependencies and system boundaries.
```

Useful when joining a project and learning its overall structure.

### Example 2: Trace a business flow

```text
$qgraphflow:q-flow Analyze order creation and create a sequence diagram in English showing pricing, stock reservation, payment and order persistence, including failure branches.
```

Replace order creation and its steps with your project's actual flow. Continue in the same conversation:

```text
$qgraphflow:q-flow Expand stock reservation from the previous diagram into a separate flowchart in English, showing success and failure handling.
```

Results go under `docs/qgraphflow/` by default. Open `index.html` to explore, edit and export; `graph.json` retains the graph data. Each view is also written as an SVG (`diagram.svg`, or `diagram-<n>-<type>.svg` for several views) that you can embed as an image in a README, pull request or wiki.

After editing in the page, **More → Save changes** in Chrome or Edge rewrites the page, `graph.json` and the SVGs in place once you pick the diagram's folder. Other browsers save `graph.json` only: put it in the folder and regenerate the page and SVGs with `npx -y qgraphflow generate docs/qgraphflow/<name>/graph.json docs/qgraphflow/<name> --layout preserve --force`.

<details>
<summary>Run the nine-view e-commerce example manually</summary>

These commands run the repository example. An installed plugin does not require cloning this repository. With Node.js 22 or later:

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
node skills/q-flow/scripts/validate-graph.mjs examples/showcase/ecommerce.en.graph.json
node skills/q-flow/scripts/generate-viewer.mjs examples/showcase/ecommerce.en.graph.json output/ecommerce-en
```

Open `output/ecommerce-en/index.html` in a browser; the nine SVGs sit next to it. Switch views with **Diagram types** in the top toolbar; saved text and positions survive switching. **More → Save changes** saves all views as described above. The same pages are online in the [live demo](https://supermax92.github.io/qgraphflow/).

The prebuilt Viewer needs no dependency installation, API key or backend service. AI-assisted evidence gathering and graph authoring use your chosen client's model service.

</details>

## Keep diagrams in sync with code

A diagram generated with a repository root records where each component is defined. Validating it with `--repo-root` fails when a recorded file is gone, a line range no longer fits, or a recorded symbol has left its lines, and the error names the lines where the symbol is now. Add this job to your CI; it needs no build, login or token:

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

When it fails, ask the skill to refresh that diagram:

```text
$qgraphflow:q-flow CI says docs/qgraphflow/order-sequence is out of date. Refresh it.
```

The skill moves anchors whose symbol it finds once, corrects only the anchors still reported, and regenerates the page and SVGs with your edited positions and text kept. It does not redraw the diagram.

## What each of the nine views answers

| View · PNG | Main question | Example scope |
| --- | --- | --- |
| Architecture | Which responsibilities collaborate? | Channels, checkout, pricing, risk, stock, payment, orders, events and fulfillment |
| Flowchart | Where does the process branch and converge? | Stock shortage, risk rejection, payment compensation and successful commit |
| Sequence | In what order do calls and returns occur? | Successful checkout and asynchronous OrderPaid |
| ER | How does core data relate? | Cart, orders, items, payments, reservations and parcels |
| Deployment | Where do runtime units run and connect? | Edge, Kubernetes, data services, payments and logistics networks |
| Class | How do domain objects and contracts depend on each other? | Checkout service, Order and four ports |
| State | Which events and guards advance an order? | Payment, fulfillment, cancellation, refund and closure |
| Use case | What can each actor do? | Buyer, merchant, warehouse and support |
| Data flow | How is data transformed and stored? | Cart, transaction decisions, events, warehouse and delivery receipts |

This is a concept model demonstrating QGraphFlow, not a particular e-commerce repository. The example `graph.json` invents no source paths and marks relationship evidence as `inference`. Real project diagrams need traceable source, DDL, configuration, tests and accepted requirements.

## Develop and contribute

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

Development needs Node.js 22 or later, npm, tar, zip and unzip. Include a minimal redacted graph, client/browser versions and reproduction steps in issue reports.

[Evidence sources](skills/q-flow/references/evidence-sources.md) · [Graph format](skills/q-flow/references/graph-schema.md) · [Guided intake](skills/q-flow/references/guided-intake.md) · [Viewer development](skills/q-flow/references/viewer-development.md) · [Diagram composition](skills/q-flow/references/visual-contract.md)

## License and attribution

[MIT](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md)

QGraphFlow is an independent MIT-licensed project. The scenarios in this document are conceptual and do not represent any company's production architecture; no affiliation, sponsorship or endorsement is implied.
