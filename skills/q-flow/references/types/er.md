# er

Tables (entities), their columns and keys, and the relationships with cardinalities. Read with `graph-common.md`.

| Node `kind` | Group `kind` | Edge `kind` |
| --- | --- | --- |
| `entity` | none | `relationship` |

## Rules

- Every entity has a non-empty `fields` array; each field `{ "name", "type", "key"?: "PK" | "FK" | "UK", "nullable"?: boolean }` copied from the DDL / mapping (types verbatim, `nullable: true` only when the column allows NULL). List every column of the table you show; do not invent columns, do not infer foreign keys that the schema does not declare.
- A relationship needs both `sourceCardinality` and `targetCardinality`, each one of `1`, `0..1`, `*`, `1..*`, `0..*`. Source is the referenced (parent) side, target the referencing side: `customers (1) → orders (0..*)`. A UNIQUE foreign key gives `1 → 0..1`. Label with the verb (`places`, `contains`).
- Anchor each entity to its `CREATE TABLE` (or ORM class) with `source.kind: "schema"`. Keep 4–8 entities per view; large schemas become several views by aggregate.

## Minimal valid skeleton

```json
{
  "meta": { "title": "Order schema", "sourceRef": "repo@main", "diagramType": "er", "locale": "zh-CN" },
  "nodes": [
    { "id": "customers", "label": "customers", "kind": "entity", "source": { "kind": "schema", "file": "db/schema.sql", "lineStart": 2, "lineEnd": 6 },
      "fields": [{ "name": "id", "type": "BIGSERIAL", "key": "PK", "nullable": false }, { "name": "email", "type": "VARCHAR(255)", "key": "UK", "nullable": false }] },
    { "id": "orders", "label": "orders", "kind": "entity", "source": { "kind": "schema", "file": "db/schema.sql", "lineStart": 8, "lineEnd": 15 },
      "fields": [{ "name": "id", "type": "VARCHAR(32)", "key": "PK", "nullable": false }, { "name": "customer_id", "type": "BIGINT", "key": "FK", "nullable": false }, { "name": "status", "type": "VARCHAR(16)", "nullable": false }] }
  ],
  "edges": [
    { "id": "r1", "source": "customers", "target": "orders", "kind": "relationship", "label": "places", "sourceCardinality": "1", "targetCardinality": "0..*", "evidence": "schema" }
  ]
}
```

## Frequent validation errors

- `node X.fields must be an array` / entity without fields — every entity lists at least one field.
- `edge r.sourceCardinality is unsupported` — only `1 0..1 * 1..* 0..*`; both ends are required.
- `fields[i].key is unsupported` — only `PK`, `FK`, `UK`; omit the key for plain columns. `nullable` must be boolean.
