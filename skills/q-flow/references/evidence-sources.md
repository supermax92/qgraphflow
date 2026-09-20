# Evidence sources and CodeGraph fallback

CodeGraph is the preferred call-graph accelerator, not a hard dependency.

## CodeGraph preflight

The intended implementation is [`colbymchenry/codegraph`](https://github.com/colbymchenry/codegraph), exposed through its local CLI or MCP server.

1. Check whether `codegraph` is on `PATH` and whether the target repository contains `.codegraph/`.
2. When both are present, run `codegraph status` and use one bounded `codegraph explore "<question or symbols>"` query before direct repository tracing.
3. An already configured CodeGraph MCP tool can serve the same bounded query. Use the tools actually available in this client; do not assume a client-specific tool name.
4. If the CLI, MCP tool or current index is unavailable, continue directly with the fallback below. Ordinary drawing does not require installing or initializing CodeGraph, resolving npm versions, or changing client configuration.

## Optional setup when requested

1. Only when the user requests or has authorized CodeGraph setup, resolve the exact stable package version with `npm view @colbymchenry/codegraph version` and check that version's official installation instructions and supported targets.
2. Before installation, identify the target client, command and writes: executable, client configuration/instructions, and `.codegraph/` index. Prefer project-local configuration when the installer supports it. Do not assume every client uses `--target=codex` or invent target values from client names.
3. Pin the resolved package version. Run initialization only within the authorized repository. If no installer integration exists for the client, use a supported standalone CLI setup or direct source tracing; an MCP integration is not required.
4. Verify `codegraph status` after setup and use the available CLI or MCP tool. Follow the target client's reload/restart procedure if needed. If version resolution or installation fails, report it and continue with direct tracing rather than trying another installer automatically.

## Fallback order

1. Use `rg --files`, then narrow `rg` searches to declarations, entry points, callers, implementations, configuration keys, and tests.
2. Read the complete relevant source path and preserve file, line, and symbol anchors.
3. Check build models, packaged artifacts, focused tests, and runtime configuration when they change the conclusion.
4. Use framework documentation only for behavior owned by the framework; label it `framework` rather than repository source.
5. Mark non-critical unresolved links as `inference`. Omit unresolved links on the claimed main path.

## Diagram-specific authority

| Diagram | Preferred evidence without CodeGraph |
| --- | --- |
| Architecture, sequence, class, data flow | Entrypoints, callers, interfaces, implementations, build dependencies, RPC/MQ clients, and focused tests |
| Flowchart, state, use case | Accepted requirements and API documents, then controller/service behavior and tests; show documented and implemented behavior separately when they differ |
| ER | DDL and migrations first, then JPA entities, ORM/MyBatis mappings, constraints, and repository tests |
| Deployment | Dockerfile, Compose, Kubernetes, Helm, service configuration, network policy, and CI/CD manifests |

Direct tracing cannot guarantee complete coverage of reflection, dependency injection, generated proxies, runtime routing, RPC, or messaging. State this limit and distinguish `source`, `config`, `schema`, `test`, `document`, `framework`, and `inference` evidence.
