# sequence

Calls and returns along one flow, with activation bars and fragments. Read with `graph-common.md`; every sequence rule the validator checks is on this page.

| Node `kind` | Group `kind` | Edge `kind` |
| --- | --- | --- |
| `actor`, `participant`, `external`, `service`, `database` | `alt`, `opt`, `loop`, `par` | `sync`, `async`, `return` |

## Participants (nodes)

- One node per lifeline: `actor` for the human or caller, `service` / `participant` for code you read, `external` for systems outside the repository, `database` for a store or repository. Participants never have `groupId`.
- Left-to-right order follows first appearance in the messages; `layout.participantOrder` (all ids, once) only reproduces an existing convention.

## Messages (edges)

- Every message has `order` (positive integer, unique, increasing in time; gaps allowed), a non-empty `label` (method or message with the important arguments), `evidence`, and `kind`: `sync` (caller waits), `async` (no wait: events, publish), `return` (reply, drawn dashed).
- A `return` carries `"replyTo": "<call id>"`: the call is an earlier `sync` / `async` with reversed endpoints, has at most one return, and both sit in the same fragment operand. Unpaired returns are legal but drawn without pair colour and `C1` labels.
- Self-messages are allowed. Alternative outcomes of one call are one return labelled `ok | declined`, not two.

## Activation bars (`executions`)

Top-level array of `{ "id", "participantId", "start": { "edgeId", "at" }, "end": { "edgeId", "at" }, "parentId"? }`. `at` is `send` (participant is the edge's source) or `receive` (its target); start precedes end in `order`; a bar usually runs from the call's `receive` to the return's `send`. Bars on one participant either nest (`parentId`, child inside parent) or do not overlap in time; start and end lie in the same operand. Nothing is inferred: no `executions`, no bars.

## Fragments (`groups` with `operands`)

```json
{ "id": "retry", "label": "reserve stock", "kind": "loop", "loop": { "min": 1, "max": 3 },
  "operands": [{ "id": "attempt", "guard": "attempt < 3", "edgeIds": ["m4", "m5"] }] },
{ "id": "outcome", "label": "result", "kind": "alt", "parentId": "retry", "parentOperandId": "attempt",
  "operands": [{ "id": "ok", "guard": "reserved", "edgeIds": ["m6"] }, { "id": "no", "guard": "else", "edgeIds": [], "body": "attempt += 1" }] }
```

- `alt`: two or more guarded operands, optional `else` last. `opt`: one guarded operand. `loop`: one guarded operand plus `loop: { "min", "max" | "*" }`. `par`: two or more operands with `label` instead of `guard` (concurrent; vertical order is not time).
- `edgeIds` lists the operand's messages; an operand may instead or also carry `body` text or a child fragment (`parentId` + `parentOperandId`). Operand ids are required except on `alt`; a message belongs to at most one operand; successive operands' `order` ranges must not interleave. A call and its return, and a bar's start and end, stay in one operand path.
- Guards are display text — copy the real condition. Only fragments the source establishes (an `if`, a retry loop, concurrent handlers).

## Minimal valid skeleton

```json
{
  "meta": { "title": "POST /orders → createOrder", "sourceRef": "repo@main", "diagramType": "sequence", "locale": "zh-CN" },
  "nodes": [
    { "id": "client", "label": "caller", "kind": "actor" },
    { "id": "service", "label": "OrderService", "kind": "service", "source": { "kind": "source", "file": "src/services/order-service.js", "lineStart": 15, "lineEnd": 37 } },
    { "id": "payments", "label": "PaymentProvider", "kind": "external", "source": { "kind": "source", "file": "src/domain/payment-provider.js", "lineStart": 2, "lineEnd": 6 } },
    { "id": "bus", "label": "EventBus", "kind": "participant", "source": { "kind": "source", "file": "src/events/bus.js", "lineStart": 13, "lineEnd": 17 } }
  ],
  "groups": [
    { "id": "outcome", "label": "payment result", "kind": "alt", "operands": [
      { "id": "ok", "guard": "payment.ok", "edgeIds": ["m4"] },
      { "id": "declined", "guard": "else", "edgeIds": [], "body": "release inventory, throw 402" } ] }
  ],
  "edges": [
    { "id": "m1", "source": "client", "target": "service", "kind": "sync", "label": "createOrder(items)", "order": 1, "evidence": "source" },
    { "id": "m2", "source": "service", "target": "payments", "kind": "sync", "label": "charge(orderId, total)", "order": 2, "evidence": "source" },
    { "id": "m3", "source": "payments", "target": "service", "kind": "return", "label": "{ ok, transactionId }", "order": 3, "replyTo": "m2", "evidence": "source" },
    { "id": "m4", "source": "service", "target": "bus", "kind": "async", "label": "publish(order.created)", "order": 4, "evidence": "source" },
    { "id": "m5", "source": "service", "target": "client", "kind": "return", "label": "order | 402", "order": 5, "replyTo": "m1", "evidence": "source" }
  ],
  "executions": [
    { "id": "x-service", "participantId": "service", "start": { "edgeId": "m1", "at": "receive" }, "end": { "edgeId": "m5", "at": "send" } },
    { "id": "x-charge", "participantId": "payments", "start": { "edgeId": "m2", "at": "receive" }, "end": { "edgeId": "m3", "at": "send" } }
  ]
}
```

## Frequent validation errors

- `edge m.order must be a positive integer for sequence` / `order duplicates N` — `--fix` renumbers in array order, or edit the number.
- `edge r.replyTo m must reference a sync or async call from a return` / `endpoints must be reversed` / `must precede its return` — point at the right call; `--fix` fills it when exactly one candidate exists.
- `group g.operands order ranges must be ordered and non-interleaving` — all messages of operand 1 come before operand 2; move a message or split the fragment.
- `group g.operands[i].id is required` — `opt` / `loop` / `par` operands need ids (`--fix` adds `op1..`).
- `execution x.start endpoint m does not belong to participant p` — `send` ⇒ source, `receive` ⇒ target.
- `Sequence group g needs explicit operands before automatic layout` — every fragment declares `operands`.
