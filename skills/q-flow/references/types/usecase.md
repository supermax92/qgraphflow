# usecase

Actors and what they can do, with include / extend relationships between use cases, inside a system boundary. Read with `graph-common.md`.

| Node `kind` | Group `kind` | Edge `kind` |
| --- | --- | --- |
| `actor`, `usecase` | `system` | `association`, `include`, `extend` |

## Rules

- Use cases sit inside one `system` group (`groupId`); actors stay outside every group. Name use cases as goals (`Create order`, `Export settlement`), actors as roles (`Buyer`, `Support`), not as UI screens or classes.
- `association` actor → use case (who can do it). `include` base → included (always happens as part of the base); `extend` extension → base (happens only under a condition — put the condition in `label`). Both ends of `include` / `extend` must be use cases. Do not add `«include»` to labels; the Viewer draws the stereotype.
- Evidence is usually `document` (requirements, README) or `source` (route handlers, permission checks). Anchor use cases to the requirement line or the handler that implements them; actors have no anchor.
- Keep 3 actors and ≤ 10 use cases per view; more actors mean more views.

## Minimal valid skeleton

```json
{
  "meta": { "title": "Shop use cases", "sourceRef": "docs/use-cases.md", "diagramType": "usecase", "locale": "zh-CN" },
  "groups": [{ "id": "system", "label": "mini-shop", "kind": "system" }],
  "nodes": [
    { "id": "buyer", "label": "Buyer", "kind": "actor" },
    { "id": "create", "label": "Create order", "kind": "usecase", "groupId": "system", "source": { "kind": "document", "file": "docs/use-cases.md", "lineStart": 7, "lineEnd": 7 } },
    { "id": "pay", "label": "Pay", "kind": "usecase", "groupId": "system", "source": { "kind": "document", "file": "docs/use-cases.md", "lineStart": 15, "lineEnd": 15 } },
    { "id": "cancel", "label": "Cancel order", "kind": "usecase", "groupId": "system", "source": { "kind": "document", "file": "docs/use-cases.md", "lineStart": 15, "lineEnd": 15 } }
  ],
  "edges": [
    { "id": "u1", "source": "buyer", "target": "create", "kind": "association", "evidence": "document" },
    { "id": "u2", "source": "create", "target": "pay", "kind": "include", "evidence": "document" },
    { "id": "u3", "source": "cancel", "target": "pay", "kind": "extend", "label": "payment declined", "evidence": "document" }
  ]
}
```

## Frequent validation errors

- `node X.groupId places an actor inside a system boundary` — remove `groupId` from actors.
- `edge u include endpoints must both be use cases` — `include` / `extend` never touch actors; use `association` for actor links.
