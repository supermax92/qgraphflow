# Client installation and distribution

The default branch contains the **0.0.2 development version**, including the multilingual Kafka showcase and slim packaging. The latest packaged software Release remains **v0.0.1**; use the source checkout to try the new version. The separate `showcase-v1` Release hosts README animations.

For a release installation, download `qgraphflow-<version>.zip` from [GitHub Releases](https://github.com/supermax92/qgraphflow/releases) and extract it. The plugin root contains `skills/`, `LICENSE`, and the four hidden manifest directories. Keep the entire extracted directory; copying only `SKILL.md` loses required runtime files.

Node.js 22 is required. Ordinary generation needs no `npm install`, API key, or backend. AI authoring uses the selected client's model service and permissions. Try the [English Kafka example](../README.md#try-all-nine-kafka-views) or the included `examples/order-flow.graph.json`.

For local-directory installation, always point the client at an extracted runtime package. Some clients copy the whole local directory, including ignored recordings, build dependencies, and test outputs. `.gitignore` protects Git distribution; it does not constrain a client's local-directory copy.

## Codex App / CLI

Manifest: `.codex-plugin/plugin.json`. Local marketplace: `.agents/plugins/marketplace.json`.

Run from the extracted plugin root:

```bash
codex plugin marketplace add .
codex plugin add qgraphflow@qgraphflow-local
```

For Git installation, replace the first command with:

```bash
codex plugin marketplace add supermax92/qgraphflow
```

Start a fresh task and select `$q-flow`. Check the installed version with `codex plugin list --json`. CLI and App discovery must be checked separately after installation.

Update a Git source with `codex plugin marketplace upgrade qgraphflow-local`, then run `codex plugin add qgraphflow@qgraphflow-local` again. For an extracted release, replace the same source directory with the complete new release, then repeat `plugin add`. If the new release is in a different directory, first run `codex plugin marketplace remove qgraphflow-local`, add the new directory, and repeat `plugin add`; Codex rejects changing the source path while the old marketplace registration exists. Uninstall with:

```bash
codex plugin remove qgraphflow@qgraphflow-local
```

These commands match Codex CLI 0.144.1. [OpenAI plugin documentation](https://developers.openai.com/plugins).

## Claude Code

Manifest: `.claude-plugin/plugin.json`. Marketplace: `.claude-plugin/marketplace.json`.

```bash
claude plugin marketplace add .
claude plugin install qgraphflow@qgraphflow-local
```

For Git installation, use `claude plugin marketplace add supermax92/qgraphflow`. Start a fresh session and call `/qgraphflow:q-flow`. A signed-in Claude Code account is needed for model-based authoring.

After refreshing the Git marketplace or replacing the extracted source directory, run:

```bash
claude plugin marketplace update qgraphflow-local
claude plugin update qgraphflow@qgraphflow-local
```

Restart the session. Uninstall with `claude plugin uninstall qgraphflow@qgraphflow-local`. [Claude Code documentation](https://code.claude.com/docs/en/discover-plugins).

## Qoder CLI / IDE

Manifest: `.qoder-plugin/plugin.json`. Qoder CLI 1.0.13 supports persistent installation from a local directory:

```bash
qodercli plugins validate /absolute/path/to/qgraphflow
qodercli plugins install /absolute/path/to/qgraphflow
qodercli plugins list --json
```

Quote paths containing spaces. Reload plugins or start a new session and select `q-flow`. For session-only loading, use `qodercli --plugin-dir /absolute/path/to/qgraphflow`; this does not test persistent installation or uninstall.

This CLI version has no `plugins update` command. Install the complete new version from its directory and verify the listed version. Uninstall with `qodercli plugins uninstall qgraphflow@local`.

Qoder IDE has a separate Settings → Plugins → Import entry. Confirm skill discovery in that IDE after import; CLI installation and Qoder/QoderWork desktop imports are not interchangeable acceptance evidence. [Qoder plugin documentation](https://docs.qoder.com/extensions/plugins).

## Cursor

Manifest: `.cursor-plugin/plugin.json`. Place the complete plugin directory at `~/.cursor/plugins/local/qgraphflow/`. Reload the window, then check Customize → Plugins and Skills for `qgraphflow` and `q-flow`.

To update, replace the whole local plugin directory with the new extracted release and reload. To uninstall, move that directory out of `plugins/local/` and reload. Preserve a backup until the new version works. Organization policy or a same-name marketplace plugin may change local discovery. [Cursor plugin documentation](https://cursor.com/docs/reference/plugins).

## What gets downloaded

| Installation | Contents |
| --- | --- |
| Release ZIP / npm-format archive | Shared runtime and required JS imports, four manifests, skill references, licenses, seven READMEs, the order-flow example, and the English Kafka collection |
| Git repository | Source, tests, build files, lightweight docs, and all seven Kafka JSON collections |
| Reading a README online | That language's GIFs, fetched separately from the fixed `showcase-v1` Release |

No GIFs or recordings belong in the Git branches/tags or install packages. Reading a README may download images into the browser cache; generating and viewing a diagram offline does not require these images. Do not use `git push --mirror` to publish local development references.

## Build locally

From a source checkout:

```bash
npm pack --ignore-scripts --dry-run
npm run package
```

The second command creates `dist/qgraphflow-0.0.2.tgz` and `dist/qgraphflow-0.0.2.zip` without uploading anything. To keep multiple builds, use `node scripts/package.mjs /absolute/new-output-directory`. Existing archives are never overwritten.

The `.tgz` has a `package/` top-level directory. The ZIP starts at the plugin root, including hidden manifests. Both use the same `package.json` runtime allowlist. Development sources, tests, recordings, and `node_modules` are excluded.

Versions must agree across the root package, four client manifests, Claude marketplace entry, and Viewer package/lock root. Automated checks extract the real archives into paths containing spaces and Chinese characters, generate the two output files from another working directory, and verify overwrite protection and all nine Kafka views.

## Acceptance status (2026-09-07)

| Client | Install / update / uninstall | Discover / analyze / generate | View / SVG / PNG |
| --- | --- | --- | --- |
| Codex CLI 0.144.1 | Passed, 0.0.1 → 0.0.2 | Passed using the installed 0.0.2 skill and gpt-5.5 | Passed in Chrome using the client-generated files; CLI browser tooling was unavailable |
| Claude Code 2.1.227 | Passed, 0.0.1 → 0.0.2 | Blocked: Claude Code login required | Not run |
| Qoder CLI 1.0.13 | Passed, 0.0.1 → 0.0.2 | Skill discovered; model calls blocked by API FORBIDDEN code 112 | Not run |
| Cursor 3.19.13 | Passed, 0.0.1 → 0.0.2; reload verified | Passed using the installed local skill | Passed in the native embedded browser and Chrome; actual SVG/PNG files saved and checked |

The same Kafka `MemberState.java` source was used for each available model run. Qoder rejected both Qwen3.8-Max and Qwen3.8-Flash for the signed-in CLI account. Qoder IDE 1.28.0 displayed the installed plugin, but its full generation workflow was not completed. Cursor hit its usage limit after generating and opening the artifact; manual native export checks then completed. Codex's configured gpt-6-astra was rejected as requiring a newer CLI, so this test used gpt-5.5 without changing the global model setting.

Four-client acceptance remains incomplete until Claude Code and Qoder finish the source-to-export chain. The local client tests used a clone of the released base plus the 0.0.2 candidate files; they do not establish all clients' remote-marketplace behavior. Public marketplace submission is outside this run.
