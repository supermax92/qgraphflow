# Guided intake

Used only when the invocation and the conversation together do not supply a ready request. A ready request names a **subject** and the **question** the diagram must answer. Everything else has a default and is never asked.

## Readiness

| Item | Ready when | Never asked |
| --- | --- | --- |
| Subject | A repository, module, flow, entity set or document is named, at the level the question needs: behaviour questions need one flow (state: one component); structure questions accept a repository or module | — |
| Question | The user says what the diagram must answer, or names a type that implies it | — |
| Diagram type | — | Derived from the question by SKILL.md Author step 1; default `architecture` |
| Granularity | — | Derived from the subject by the altitude rule below; never ask "detailed or simple" |
| Output directory, language, graph count, CodeGraph setup | — | Existing defaults; the recap shows the directory so the user can override |

Only the missing item is asked. A behaviour question with a repository- or module-level subject is missing its flow: run the entry-point scan from the second round below on that subject and ask only for the flow. A request that arrived through the conversation (the skill was triggered by its description) is a ready request when it names both items.

## First-round inventory

Run before asking so that options name real modules. Budget: directory listing to depth 2 plus manifest presence; do not read source, do not scan entry points, do not run `codegraph explore`.

| Signal | Files or directories | Enables |
| --- | --- | --- |
| Build | `package.json`, `pom.xml`, `build.gradle*`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `*.csproj` | Module candidates; language and framework |
| Persistence | `migrations/`, `db/migration/`, `*.sql`, `entity/`, `model/`, ORM mapping files | `er` |
| Deployment | `Dockerfile`, `docker-compose*.yml`, `k8s/`, `helm/`, `charts/` | `deployment` |
| State | file names containing `State`, `Status`, `Phase`, `Lifecycle` | `state` |
| Documents | `docs/`, `requirements/`, `*.md` requirement files | `flowchart`, `usecase` |
| CodeGraph | `.codegraph/` present | Recap says "CodeGraph" instead of "direct tracing" |

More than 8 top-level directories: list only subdirectories that contain a build manifest. If the working directory is empty, is not a code repository, or is this plugin's own installation directory, ask for the target repository path or requirements document instead and list no module candidates.

## Intent options

Phrase options as the question the diagram answers. Each option carries the subject level it needs and a one-word cost tag. Offer at most four, only those the inventory supports, and mark exactly one as recommended (default: the whole repository's structural overview).

| Option text | `meta.diagramType` | Needs | Cost | Offer when |
| --- | --- | --- | --- | --- |
| What the system is made of and who depends on whom | `architecture` | repository or module | fast | always |
| Where it runs and how the pieces are deployed | `deployment` | repository | fast | deployment signal |
| What is stored and how it relates | `er` | repository or module | fast | persistence signal |
| Which types exist and how they relate | `class` | module | fast | build signal |
| Who can do what | `usecase` | repository or module | fast | documents signal or public entry points |
| Who calls whom, in what order | `sequence` | one flow | traces calls | always |
| What decisions a process makes | `flowchart` | one flow | traces calls | always |
| How data moves and changes | `dataflow` | one flow | traces calls | always |
| What states something goes through | `state` | one component | traces calls | state signal |

Structure intents (`architecture`, `deployment`, `er`, `class`, `usecase`) read manifests and declarations. Behaviour intents (`sequence`, `flowchart`, `dataflow`, `state`) trace execution paths and cost more; the tag states this, it does not change the recommendation.

## Altitude rule and view budget

Node unit is one level below the subject:

| Subject | Node unit |
| --- | --- |
| Whole repository | Module or service |
| Module | Component or class |
| One flow | Step or function |
| Entity set | Table |

No fixed node or edge cap applies. Keep all facts needed by the requested scope; use the type-specific canvas budget and strict readability checks. A separate detail view may supplement the original model, but must not silently remove its relationships.

## Asking

One message asks subject and intent together. Use the client's structured question tool when one exists; otherwise number the options in plain text. Do not assume a client-specific tool name. Ask in the user's language.

Plain-text shape:

```
Which part? 1 order  2 payment  3 inventory  4 whole repository (recommended)
What should the diagram answer?
  a  what the system is made of and who depends on whom — repository or module · fast (recommended)
  b  who calls whom, in what order — one flow · traces calls
  c  what is stored and how it relates — repository or module · fast
  d  where it runs — repository · fast
```

After asking, **end the turn and wait for the reply**. Do not assume an answer. Do not write `index.html`, `graph.json` or any other output before the round completes.

## Second round

Structure intents finish in the first round. A second round happens only in these cases, and there is never a third:

- **No subject yet**: offer at most three modules from the inventory, one recommended.
- **Two intents**: take the primary one, note that the other can be a second diagram.
- **Behaviour intent with a repository- or module-level subject**: scan the chosen subject for entry points and offer at most four flows. Use `rg -l` on file names and annotations (`*Controller*`, `*Handler*`, `*Listener*`, `*Consumer*`, `main`, `@RestController`, `@KafkaListener`, route decorators); do not read function bodies. Prefer candidates matching words the user already used. If still too many, group by package and let the user pick a package; that pick is the second round.

"Whatever", "you decide" or an equivalent takes the recommended option; state the assumption in the recap.

## Recap, then start

One line, then start evidence without a second confirmation. The user can correct it with a new message at any time.

```
<type> · <subject> · answers <question> · <node unit>, nodes required by the evidence · <type-specific layout> · <output directory> · <CodeGraph | direct tracing>. Say so to drill into a node later.
```

Example: `sequence · order module, OrderController.create flow · answers the call order of placing an order · step-level nodes, as required · participants across and time down · docs/qgraphflow/order-create-sequence/ · direct tracing. Say so to drill into a step later.`

If bounded layout fails, report the blocking nodes and relationships and propose separate views with explicit coverage of the original model; never silently reduce the requested detail.
