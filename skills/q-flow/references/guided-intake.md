# Guided intake

Use only when the invocation, supplied material and conversation leave necessary information missing. A ready request gives each requested view a **subject** and **question**, with a usable output location. Honor supplied preferences; use defaults for the rest.

## Input and readiness

Resolve intent before material: an audit is read-only. Inspect, validate without `--fix`, and report findings; do not generate or overwrite artifacts. Evidence drift does not authorize an update. Then identify all supplied material before building options:

- **Existing graph:** read `graph.json`, including every view's metadata; inherit scope, type, granularity and directory. Follow SKILL.md Refresh for refresh, simplification or expansion. Ask only about an unresolved change, not the original drawing purpose again. Resolve which collection views the user wants changed; inherit every other view unchanged. For simplification or expansion, repeat `--view <view-id>` for the affected views during generation, keeping the others in preserve mode.
- **Requirements:** read the supplied file, attachment or pasted text; derive subjects and questions from it. Do not scan unrelated repository modules or ask for material already supplied. Documented behaviour is not verified implementation. For mixed source/document requests, retain both and distinguish their evidence.
- **Repository:** use the named repository or current project. Inventory only when needed to offer subjects or questions. If none of these materials is available, ask for a target repository or requirements; the plugin installation directory is not the target.

Structure questions accept a system, module or entity set. Behaviour questions need one flow (state: one component) per view, including a flow described in requirements. A named type can supply the question. An existing graph can supply the subject and question for a requested update.

Ask only for missing information. Never ask for type, language, granularity, graph count or CodeGraph setup merely to fill a default. Document-only output uses the current project's `docs/qgraphflow/<scope>-<type>/`; honor a supplied directory. If no suitable project or supplied directory exists, ask only for the output location when that is all that is missing. Never output into the plugin cache.

Explicit multiple-view requests retain **every view**: keep shared subject/preferences and resolve only each view's missing scope. "Architecture and sequence, both" is not indecision; "architecture or sequence, which helps?" invites a recommendation. Default to one graph otherwise. Repeated architecture needs unique `meta.viewId`; repeated other types use separate outputs, as specified by [graph-common.md](graph-common.md#granularity).

## Repository inventory

Before offering repository options, list directories to depth 2 and check manifest presence; do not read function bodies, scan entry points or run `codegraph explore` during this inventory.

| Signal | Files or directories | Enables |
| --- | --- | --- |
| Build | `package.json`, `pom.xml`, `build.gradle*`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `*.csproj` | Real module candidates |
| Persistence | `migrations/`, `db/migration/`, `*.sql`, `entity/`, `model/`, ORM mappings | ER |
| Deployment | `Dockerfile`, `docker-compose*.yml`, `k8s/`, `helm/`, `charts/` | Deployment |
| State | file names containing `State`, `Status`, `Phase`, `Lifecycle` | State |
| Documents | `docs/`, `requirements/`, requirements files | Document-backed subjects and questions |
| CodeGraph | `.codegraph/` present | Candidate index only; availability/freshness still require preflight |

For more than eight top-level directories, prefer candidates containing build manifests. Do not invent module candidates for an empty, unrelated or plugin directory.

## Intent options

Phrase choices as questions the diagram answers. Offer at most four relevant options, with one recommendation; use the user's words and available material. Default a repository overview to component relationships. Derive type/view from intent without an extra selection round.

| Question | Type / architecture view | Subject |
| --- | --- | --- |
| What capabilities does the platform provide and how does business connect? | `architecture` / `capabilities` | system or module |
| How are engineering layers and components organized? | `architecture` / `engineering` | system or module |
| What is the system made of and who depends on whom? | `architecture` / `relations` | system or module |
| Where does it run? | `deployment` | system |
| What is stored and how does it relate? | `er` | entity set or module |
| Which types exist and how do they relate? | `class` | module |
| Who can do what? | `usecase` | system or module |
| Who calls whom, in what order? | `sequence` | flow |
| What decisions does the process make? | `flowchart` | flow |
| How does data move and change? | `dataflow` | flow |
| What states does something go through? | `state` | component |

Select relevant alternatives from this table, not all eleven at once. A platform/integration question brings capability architecture forward; a layering question brings engineering architecture forward. Do not require the user to learn internal view names. Repository call/behaviour questions require execution tracing; do not promise that declarations alone prove dependencies or behaviour.

## Asking and follow-up

Ask subject and question together only when both are missing. Use the client's structured question tool when available, otherwise numbered plain text; do not assume a tool name. Ask in the user's language. Each question offers at most four choices and one recommendation, for example:

```
Which part? 1 order  2 payment  3 inventory  4 whole repository (recommended)
What should the diagram answer?
  1 system components and dependencies (recommended)
  2 platform capabilities and business integration
  3 engineering layers and components
  4 the call order of a particular flow
```

After asking, **end the turn and wait for the reply**. Do not assume an answer or create graph/output files while essential information is unresolved. Usually one or two rounds suffice; readiness, not a fixed round count, ends intake.

- **Subject still missing:** offer grounded subjects from the material, with one recommendation.
- **Behaviour flow missing:** for a repository, use `rg --files` / `rg -l` to find entry-point files and annotations (`*Controller*`, `*Handler*`, `*Listener*`, `*Consumer*`, `main`, route decorators). Do not read function bodies yet. Offer up to four flows matching the user's words; if necessary, first group by package. Selecting a package is not selecting a flow: if several remain, ask for the specific flow next. For documents, offer the described flows instead.
- **Several views:** retain the full list and ask only for unresolved subjects/questions; do not replace it with the primary intent. Once all are ready, proceed without another confirmation.
- **Delegated choice:** "whatever" / "you decide" permits the grounded recommendation; state it and proceed. Do not invent an unavailable repository, document or output location.

## Granularity, recap and start

Apply [Granularity](graph-common.md#granularity), including when intake is skipped. Carry the user's level and coverage into the recap; visual minimalism does not remove requested facts.

After scope is ready, determine the evidence path using [evidence-sources.md](evidence-sources.md#codegraph-preflight). A directory alone never proves CodeGraph availability. Use document evidence for document-only work; report CodeGraph only after checking the tool and current index, otherwise direct tracing. If not checked yet, say evidence preflight is pending rather than claiming either tool was used.

Give one compact recap covering all requested views, subject/question, granularity/coverage, output directory and the actual evidence status, then start without another confirmation. Do not present internal schema fields as questions for the user. If bounded layout fails, report the blockers and propose views covering the original facts; never silently reduce detail or change an explicit graph count.
