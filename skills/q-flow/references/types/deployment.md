# deployment

Where runtime units run and how they connect: hosts, networks, containers, databases, external services. Read with `graph-common.md`.

| Node `kind` | Group `kind` | Edge `kind` |
| --- | --- | --- |
| `device`, `node`, `container`, `artifact`, `service`, `database`, `external` | `host`, `network`, `cluster`, `namespace` | `deploy`, `network`, `depends` |

## Rules

- `container` for a running container / process, `node` for a VM or machine, `device` for hardware or a client device, `artifact` for a deployable file (jar, image, bundle), `service` for a managed / logical service, `database` for stores, `external` for third-party endpoints (no `source`).
- Groups model real boundaries from the manifests: `network` (compose networks, VPC subnets), `host`, `cluster`, `namespace`; nest with `parentId`. A node belongs to one group; when a unit sits on two networks, place it by its primary role and say so in `facts`.
- Edges: `network` for traffic (label with port or protocol), `depends` for `depends_on` / environment-variable references, `deploy` from a unit to the artifact it runs. Direction follows the connection initiator.
- Anchor each unit to its service block in the manifest (`source.kind: "config"`); evidence for edges is `config` or `document`.

## Minimal valid skeleton

```json
{
  "meta": { "title": "mini-shop deployment", "sourceRef": "deploy/docker-compose.yml", "diagramType": "deployment", "locale": "zh-CN" },
  "groups": [{ "id": "app", "label": "app network", "kind": "network" }, { "id": "data", "label": "data network", "kind": "network" }],
  "nodes": [
    { "id": "browser", "label": "browser", "kind": "external" },
    { "id": "api", "label": "api", "kind": "container", "groupId": "app", "subtitle": "mini-shop:0.1", "source": { "kind": "config", "file": "deploy/docker-compose.yml", "lineStart": 9, "lineEnd": 17 } },
    { "id": "postgres", "label": "postgres", "kind": "database", "groupId": "data", "source": { "kind": "config", "file": "deploy/docker-compose.yml", "lineStart": 30, "lineEnd": 33 } }
  ],
  "edges": [
    { "id": "d1", "source": "browser", "target": "api", "kind": "network", "label": "443", "evidence": "config" },
    { "id": "d2", "source": "api", "target": "postgres", "kind": "depends", "label": "DATABASE_URL", "evidence": "config" }
  ]
}
```

## Frequent validation errors

- `group X.parentId does not name a group` — nested networks must list their parent first.
- `node X.kind is unsupported for deployment` — `service` here is a deployment unit; application-code kinds (`component`, `business`) belong to architecture.
