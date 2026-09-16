<div align="center">

# QGraphFlow

### Turn complex code into diagrams you can explore.

Follow the path. Inspect the evidence. Share one offline file.

[English](README.md) · [中文](docs/readme/README.zh-CN.md) · [Русский](docs/readme/README.ru.md) · [Português](docs/readme/README.pt.md) · [日本語](docs/readme/README.ja.md) · [Deutsch](docs/readme/README.de.md) · [Español](docs/readme/README.es.md)

[Client installation](#installation-guide) · [Report an issue](https://github.com/supermax92/qgraphflow/issues) · [MIT](LICENSE)

</div>

![E-commerce architecture, flowchart and sequence: 0.8 seconds per view, 2.4 seconds per loop, with animated edges](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.en.core-three.gif)

*Nine diagram types: architecture, flowchart, sequence, ER, deployment, class, state, use case and data flow.*

QGraphFlow turns source code, schemas, configuration and requirements into interactive software diagrams, with evidence you can inspect and an offline HTML file you can share.

- **Explore:** search, zoom and pan; inspect responsibilities and upstream/downstream relationships.
- **Verify:** inspect nodes and edges for source files, lines, symbols and explicitly marked uncertainty.
- **Edit:** unlock the layout, change text and move elements; reset when needed.
- **Share:** open offline HTML or export the complete diagram as SVG / PNG.

*Explore: open navigation, search for the checkout orchestrator and locate it; select a node to open its quick-look card and highlight incoming/outgoing edges, then zoom and pan.*

![Navigation, search, node quick look, relationship highlighting, zoom and pan](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.en.explore.gif)

*Verify: open the details panel from the quick-look card to inspect paths, line numbers and symbols; then select an edge to inspect its explanation and inference marker.*

The paths, line numbers and symbols in this interaction demo are fictional. They demonstrate the evidence panel and do not represent repository source; the page and details say so too. Use real sources for actual analysis and mark unconfirmed relationships as inference.

![Details with explicitly fictional source paths, lines, symbols and relationship inference](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.en.verify.gif)

*Edit: unlock the layout in **More**, edit a node's name and description, drag it with its connected edges, then reset to restore the original text and position.*

![Unlock, edit text, drag a node with its edges, and reset](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.en.edit.gif)

*Share: open the HTML offline, export SVG and PNG through **More**, and open the PNG to inspect the complete drawing.*

![Offline HTML, SVG and PNG export, and the exported PNG](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.en.share.gif)

The top animation shows each of three views for 0.8 seconds (2.4 seconds per loop). The four interaction animations allow time to read. All media use the source-built Viewer and English graph and interface text. The five GIFs and nine PNGs are hosted as independent [showcase-v1 Release assets](https://github.com/supermax92/qgraphflow/releases/tag/showcase-v1), with public downloads and SHA-256 checksums verified. They are excluded from Git history and plugin packages; viewing them requires network access. The generated diagram HTML itself works offline.

## Installation guide

You need Node.js 22 and a plugin-capable client with model access configured.

### 1. Download the plugin

Download [qgraphflow-0.0.3.zip](https://github.com/supermax92/qgraphflow/releases/download/v0.0.3/qgraphflow-0.0.3.zip) and extract it into a separate directory, keeping hidden files.

Run the following terminal commands from **the extracted plugin root containing `skills/`**.

### 2. Install in your client

#### Codex App / CLI

Codex CLI must be installed and available in your terminal:

```bash
codex plugin marketplace add .
codex plugin add qgraphflow@qgraphflow-local
```

Start a new session, type `$`, and select `qgraphflow:q-flow`.

#### Claude Code

```bash
claude plugin marketplace add .
claude plugin install qgraphflow@qgraphflow-local --scope user
```

Start a new session and enter `/qgraphflow:q-flow`.

#### Qoder CLI

```bash
qodercli plugins install .
```

Start a new session and select `q-flow`.

#### Qoder IDE

Open **Settings → Plugins → Custom → Import**, import the complete plugin root directory, and select `q-flow`.

#### Cursor

Copy everything in the plugin root, including hidden files, into:

```text
~/.cursor/plugins/local/qgraphflow/
```

Confirm that `.cursor-plugin/plugin.json` exists there, reload the window, and find `q-flow` in **Customize**. Back up any previous version first; do not mix old and new files.

### 3. Start using it

Open your project in the client, start a new session, and select the skill. Describe your task using the [Quick start](#quick-start) examples below. Open the generated HTML in your browser.

<details>
<summary>Alternative installation: GitHub npm</summary>

You can also get the plugin through npm instead of the ZIP.

GitHub npm requires your own GitHub **Personal access token (classic)** with `read:packages` permission. Log in with your GitHub username and use the token as the password.

Do not share the token or commit it to a repository. See [GitHub authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).

```bash
npm config set @supermax92:registry=https://npm.pkg.github.com --location=user
npm login --scope=@supermax92 --auth-type=legacy --registry=https://npm.pkg.github.com
```

Create a separate directory outside your application project:

```bash
mkdir qgraphflow-install
cd qgraphflow-install
npm install @supermax92/qgraphflow@0.0.3 --ignore-scripts
cd node_modules/@supermax92/qgraphflow
```

You are now in the plugin root. Continue with the client installation steps above. **Downloading through npm does not automatically install the plugin in your client.**

</details>

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

Results go under `docs/qgraphflow/` by default. Open `index.html` to explore, edit and export; `graph.json` retains the graph data.

<details>
<summary>Run the nine-view e-commerce example manually</summary>

These commands run the repository example. An installed plugin does not require cloning this repository. With Node.js 22:

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
node skills/q-flow/scripts/validate-graph.mjs examples/showcase/ecommerce.en.graph.json
node skills/q-flow/scripts/generate-viewer.mjs examples/showcase/ecommerce.en.graph.json output/ecommerce-en
```

Open `output/ecommerce-en/index.html` in a browser. Switch views with **Diagram types** in the top toolbar; saved text and positions survive switching. Use **More → Save Graph JSON** to save all views to a chosen JSON file, or download a copy in browsers without file saving. Refreshing the original HTML restores embedded data; regenerate from the saved JSON into a new directory to reopen edits.

The prebuilt Viewer needs no dependency installation, API key or backend service. AI-assisted evidence gathering and graph authoring use your chosen client's model service.

</details>

## What each of the nine views answers

| View · PNG | Main question | Example scope |
| --- | --- | --- |
| [Architecture](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.en.architecture.png) | Which responsibilities collaborate? | Channels, checkout, pricing, risk, stock, payment, orders, events and fulfillment |
| [Flowchart](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.en.flowchart.png) | Where does the process branch and converge? | Stock shortage, risk rejection, payment compensation and successful commit |
| [Sequence](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.en.sequence.png) | In what order do calls and returns occur? | Successful checkout and asynchronous OrderPaid |
| [ER](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.en.er.png) | How does core data relate? | Cart, orders, items, payments, reservations and parcels |
| [Deployment](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.en.deployment.png) | Where do runtime units run and connect? | Edge, Kubernetes, data services, payments and logistics networks |
| [Class](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.en.class.png) | How do domain objects and contracts depend on each other? | Checkout service, Order and four ports |
| [State](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.en.state.png) | Which events and guards advance an order? | Payment, fulfillment, cancellation, refund and closure |
| [Use case](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.en.usecase.png) | What can each actor do? | Buyer, merchant, warehouse and support |
| [Data flow](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.en.dataflow.png) | How is data transformed and stored? | Cart, transaction decisions, events, warehouse and delivery receipts |

This is a concept model demonstrating QGraphFlow, not a particular e-commerce repository. The example `graph.json` invents no source paths and marks relationship evidence as `inference`. Real project diagrams need traceable source, DDL, configuration, tests and accepted requirements.

## Develop and contribute

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

Development needs Node.js 22, npm, tar, zip and unzip. Include a minimal redacted graph, client/browser versions and reproduction steps in issue reports.

[Evidence sources](skills/q-flow/references/evidence-sources.md) · [Graph format](skills/q-flow/references/graph-schema.md) · [Guided intake](skills/q-flow/references/guided-intake.md) · [Viewer development](skills/q-flow/references/viewer-development.md) · [Diagram composition](skills/q-flow/references/visual-contract.md)

## License and attribution

[MIT](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md)

QGraphFlow is an independent MIT-licensed project. The commerce scenario is conceptual and does not represent any company's production architecture; no affiliation, sponsorship or endorsement is implied.
