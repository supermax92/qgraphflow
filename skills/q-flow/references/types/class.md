# class

Types and their structural relationships: inheritance, implementation, composition, aggregation, association, dependency. Read with `graph-common.md`.

| Node `kind` | Group `kind` | Edge `kind` |
| --- | --- | --- |
| `class`, `interface`, `abstract` | none | `association`, `inheritance`, `implementation`, `composition`, `aggregation`, `dependency` |

## Rules

- `attributes` and `methods` are arrays of strings in UML form (`+cents: number`, `+charge(orderId, amount): Promise<Result>`); list the real members, keep declared types. `interface` and `abstract` render with their stereotype.
- Edge direction: `inheritance` child → parent; `implementation` class → `interface` (the target must be an interface); `composition` / `aggregation` whole → part (diamond at the whole); `association` from the holder of the reference to the referenced type; `dependency` user → used (`new`, parameter, return type).
- `sourceMultiplicity` / `targetMultiplicity` (`1`, `*`, `0..1`, `1..*`, `2..4`) are allowed only on `association`, `aggregation` and `composition`.
- Optional `layout.rank` puts parents / interfaces above their children; when given, a child must not rank above its parent.
- Keep 5–10 classes per view; show the members that matter for the question, but never fabricate ones.

## Minimal valid skeleton

```json
{
  "meta": { "title": "Order domain", "sourceRef": "repo@main", "diagramType": "class", "locale": "zh-CN" },
  "nodes": [
    { "id": "provider", "label": "PaymentProvider", "kind": "abstract", "methods": ["+charge(orderId, amount): Promise<Result>"], "source": { "kind": "source", "file": "src/domain/payment-provider.js", "lineStart": 2, "lineEnd": 6 } },
    { "id": "gateway", "label": "GatewayPaymentProvider", "kind": "class", "attributes": ["+client: PaymentGatewayClient"], "methods": ["+charge(orderId, amount): Promise<Result>"], "source": { "kind": "source", "file": "src/domain/payment-provider.js", "lineStart": 8, "lineEnd": 17 } },
    { "id": "order", "label": "Order", "kind": "class", "attributes": ["+id: string", "+items: OrderItem[]"], "methods": ["+total(): Money"], "source": { "kind": "source", "file": "src/domain/order.js", "lineStart": 17, "lineEnd": 34 } },
    { "id": "item", "label": "OrderItem", "kind": "class", "attributes": ["+sku: string", "+quantity: number"], "source": { "kind": "source", "file": "src/domain/order.js", "lineStart": 5, "lineEnd": 15 } }
  ],
  "edges": [
    { "id": "c1", "source": "gateway", "target": "provider", "kind": "inheritance", "evidence": "source" },
    { "id": "c2", "source": "order", "target": "item", "kind": "composition", "label": "items", "sourceMultiplicity": "1", "targetMultiplicity": "1..*", "evidence": "source" }
  ]
}
```

## Frequent validation errors

- `edge c implementation target must be an interface` — use `inheritance` for an abstract base class, `implementation` only towards `kind: "interface"`.
- `edge c.sourceMultiplicity is only supported on associations, aggregation and composition` — remove multiplicities from inheritance / implementation / dependency.
- `edge c layout.rank must place parent/interface above` — drop the conflicting `layout.rank` or reorder it.
- Layout `spacing.labels` on two associations from different holders into one target with the same end multiplicity (`0..1` twice) — the multiplicity labels land on one port; write the multiplicity into those two labels (`ledger 0..1（…）`) and drop the field on them only.
