# Contrato JSON del grafo

[English](../../../skills/q-flow/references/graph-schema.md) · [简体中文](../zh-CN/graph-schema.md) · [Русский](../ru/graph-schema.md) · [Português](../pt/graph-schema.md) · [日本語](../ja/graph-schema.md) · [Deutsch](../de/graph-schema.md) · [Español](graph-schema.md)

`scripts/generate-viewer.mjs` acepta un `Graph` o una colección. Los grafos antiguos sin `meta.diagramType` siguen siendo válidos y se representan como `architecture`. Los fragmentos ilustran la estructura; antes de ejecutarlos, completa los nodos referenciados y valida el diseño.

```json
{
  "meta": {
    "title": "Required title",
    "diagramType": "architecture",
    "subtitle": "Optional supporting line",
    "sourceRef": "Branch, commit, document version, or evidence scope",
    "scope": "Verified evidence scope",
    "generatedAt": "ISO-8601 timestamp"
  },
  "groups": [
    {
      "id": "runtime-boundary",
      "label": "Consumer application JVM",
      "kind": "runtime",
      "position": { "x": 40, "y": 80 },
      "size": { "width": 1440, "height": 620 }
    }
  ],
  "nodes": [
    {
      "id": "jwt-decoder",
      "label": "NimbusJwtDecoder",
      "subtitle": "Verify and decode JWT",
      "module": "Identity",
      "kind": "security",
      "position": { "x": 720, "y": 220 },
      "size": { "width": 220, "height": 120 },
      "source": {
        "kind": "source",
        "file": "module/src/main/java/example/Config.java",
        "lineStart": 111,
        "lineEnd": 130,
        "symbol": "jwtDecoder"
      },
      "facts": ["Built from issuer-uri"],
      "tags": ["JWT", "Spring Security"]
    }
  ],
  "edges": [
    {
      "id": "decode-token",
      "source": "bearer-filter",
      "target": "jwt-decoder",
      "label": "decode and verify",
      "module": "Identity",
      "kind": "call",
      "evidence": "framework",
      "route": {
        "via": [{ "x": 640, "y": 180 }],
        "labelAt": { "x": 640, "y": 156 }
      }
    }
  ]
}
```

Usa un solo grafo por defecto; una página individual no tiene menú de tipos. Para un visor múltiple solicitado, agrupa entre 1 y 9 grafos en `diagrams`. Cada `meta.diagramType` debe ser único. El menú vertical de la barra sigue siempre este orden, independientemente de la entrada: `architecture`, `flowchart`, `sequence`, `er`, `deployment`, `class`, `state`, `usecase`, `dataflow`.

```json
{
  "diagrams": [
    { "meta": { "title": "System", "diagramType": "architecture", "sourceRef": "main" }, "nodes": [], "edges": [] },
    { "meta": { "title": "Request", "diagramType": "sequence", "sourceRef": "main" }, "nodes": [], "edges": [] }
  ]
}
```

Estos grafos abreviados solo muestran el contenedor. Cada grafo debe cumplir el contrato completo y tener nodos.

## Campos comunes

- Obligatorios: `meta.title`, `meta.sourceRef`, `nodes` no vacío y `edges`.
- `meta`, los nodos, las aristas, los grupos y los anclajes de evidencia son objetos; `nodes`, `edges` y el opcional `groups` son matrices de objetos. Los contenedores inválidos se rechazan antes del diseño o de generar archivos.
- Los opcionales `meta.subtitle`, `meta.scope`, `subtitle` de nodo, `source.symbol` y `label` de arista son cadenas. Los valores opcionales `module` de nodos y aristas son cadenas no vacías: reutiliza exactamente el mismo valor para el mismo módulo de negocio en toda la colección, sin almacenar colores literales. `facts`, `tags`, `attributes` y `methods` son matrices de cadenas no vacías. Estas reglas se aplican a todos los tipos de diagrama.
- El opcional `fields` es una matriz de objetos con `name` y `type` de cadena no vacía, `key` opcional (`PK`, `FK`, `UK`) y `nullable` booleano opcional. ER requiere al menos un campo; otros tipos pueden mostrarlos en búsquedas y detalles.
- `meta.diagramType`: `architecture`, `flowchart`, `sequence`, `er`, `deployment`, `class`, `state`, `usecase` o `dataflow`.
- `meta.locale`: idioma opcional del visor: `en`, `zh-CN` (predeterminado), `ru`, `pt`, `ja`, `de` o `es`; `ko` y `fr` siguen admitidos para grafos existentes. Controla la interfaz y las etiquetas de exportación. Redacta por separado títulos, etiquetas, hechos y relaciones en el idioma deseado; conserva identificadores de código y notación estándar. Cada diagrama de una colección usa su propio idioma.
- Los ID son cadenas únicas no vacías. Cada extremo de arista nombra un nodo.
- Todos los nodos y grupos tienen valores `position` y `size` finitos y no negativos.
- `evidence` de arista: `source`, `code`, `config`, `schema`, `test`, `document`, `framework` o `inference`.
- `route` es opcional. `via` contiene puntos intermedios en coordenadas del grafo; `labelAt` fija el centro de la etiqueta. Omite ambos si el trazado ortogonal automático resulta claro.
- Cada coordenada de `route.via` y `route.labelAt` debe ser finita y no negativa. El trazador inserta codos ortogonales entre puntos y mantiene la primera y última conexión ancladas a las posiciones actuales de los nodos.
- El opcional `source.kind` usa los mismos valores de evidencia. `source.file` y `source.lineStart` identifican el anclaje exacto.
- Con `--repo-root <directory>`, validación y generación leen cada `source.file` como texto UTF-8 relativo al repositorio y comprueban el intervalo de líneas inclusivo. Rechazan rutas absolutas, recorridos al directorio padre, directorios, binarios y enlaces simbólicos que salgan de la raíz. Referencias repetidas comparten una lectura. Sin raíz, los comprobantes marcan los anclajes existentes como `skipped`; sin anclajes indican `not-applicable`. Se comprueba el árbol de trabajo local, no la identidad de revisión de `sourceRef`, la resolución de símbolos ni la veracidad de las afirmaciones.
- Para destacar el núcleo de negocio, usa el tipo existente `business` donde se admita o incluye `core` o `business` en `tags`, sin distinguir mayúsculas. Conserva un tipo de nodo permitido: `core` no es un tipo ni un campo nuevo.
- El sistema visual neutro frío es una regla del visor. Color, tipografía y estilo del núcleo no requieren campos nuevos. El modelo de pedidos y entrega de la vista previa es un ejemplo, no un conjunto de datos predeterminado ni una fuente de evidencia.

Se ignoran los metadatos heredados `playback`. No hay reproducción automática ni por pasos; el movimiento de aristas dirigidas es una señal visual independiente y no implica orden de ejecución.

## Guardar cambios del visor

Cambiar de tipo conserva el texto y las posiciones guardadas de cada grafo dentro de la página abierta. Restablecer recupera solo el contenido original integrado del grafo activo. **Guardar Graph JSON** guarda la colección completa o la forma original de grafo único, incluidos los cambios de otras vistas, metadatos y anclajes. Los navegadores compatibles permiten elegir un archivo `.json`; los demás descargan `graph.json`. Cancelar o fallar el guardado conserva todas las ediciones.

Al recargar el HTML se vuelve a los datos integrados. Conserva el JSON guardado y genera en un directorio nuevo para reabrir permanentemente el modelo editado. Guardar no omite la validación: textos o posiciones editados pueden requerir ajustes antes de regenerar. El navegador no vuelve a verificar anclajes; para entregar diagramas respaldados por fuentes, repite ambos comandos CLI con `--repo-root`.

<a id="routing-and-spacing"></a>

## Trazado y espaciado

- Deja al menos 64 píxeles del grafo entre rectángulos de nodos. Un pasillo con etiqueta debe contener toda su anchura estimada más 24 píxeles.
- Dimensiona tarjetas normales para títulos de 20px, texto de cuerpo/campos/miembros/aristas de 16px y texto secundario de 14px. Amplía cada caja y pasillo según su contenido; escalar todo por igual pierde la ventaja al ajustar la vista. Son recomendaciones de autoría, no mínimos de validación nuevos; se conservan tarjetas antiguas compactas y símbolos especializados. La vista inicial ajusta todo el diagrama alrededor de barra y paneles abiertos, con zoom mínimo 0.08; ajustar todo explícitamente usa la misma vista.
- Relaciones paralelas, divergentes y convergentes reciben carriles automáticos de 24px; pueden compartir como máximo 12px cerca de un extremo. El mayor espacio de los símbolos ER no permite fusionar rutas.
- El lado de un nodo debe alojar sus carriles. Amplía el nodo o proporciona rutas cuando la validación indique desbordamiento de extremos.
- En rutas indicadas que no sean bucles, el primer y último punto determinan el lado y la posición proyectada sobre el borde. Deja un tramo recto exterior de 28px para cardinalidades ER y de 12px para otros diagramas. Los puntos deben quedar fuera de todos los interiores, incluidos los nodos extremos.
- Los bucles usan por defecto una ruta de 48×32px fuera del borde derecho. Usa `route.via` o `route.labelAt` solo cuando ese espacio esté ocupado.
- Se rechazan solapamientos entre nodos, etiquetas sobre nodos o etiquetas, rutas por el interior de cualquier nodo (también sus extremos), bucles inseguros y tramos compartidos mayores de 12px. Los mensajes de secuencia mantienen conexiones con las líneas de vida bajo las cabeceras. Espacios estrechos y cruces producen advertencias.
- Los centros de participantes de secuencia deben separarse al menos `max(160, estimated message width + 32)` píxeles.

## Notación por tipo

| `diagramType` | Nodo `kind` | Grupo `kind` | Arista `kind` |
| --- | --- | --- | --- |
| `architecture` | `external`, `config`, `framework`, `security`, `service`, `business`, `data`, `failure`, `system`, `component`, `database` | `runtime`, `security`, `ownership`, `external` | `request`, `call`, `data`, `success`, `failure`, `framework`, `optional`, `depends` |
| `flowchart` | `start`, `end`, `process`, `decision`, `input`, `output`, `subprocess` | ninguno | `flow`, `yes`, `no`, `success`, `failure` |
| `sequence` | `actor`, `participant`, `external`, `service`, `database` | `alt`, `opt`, `loop` | `sync`, `async`, `return` |
| `er` | `entity` | ninguno | `relationship` |
| `deployment` | `device`, `node`, `container`, `artifact`, `service`, `database`, `external` | `host`, `network`, `cluster`, `namespace` | `deploy`, `network`, `depends` |
| `class` | `class`, `interface`, `abstract` | ninguno | `association`, `inheritance`, `implementation`, `composition`, `aggregation`, `dependency` |
| `state` | `initial`, `state`, `final`, `choice` | ninguno | `transition` |
| `usecase` | `actor`, `usecase` | `system` | `association`, `include`, `extend` |
| `dataflow` | `external`, `process`, `dataStore` | `ownership`, `external` | `data` |

### Secuencia

Las aristas requieren un `order` entero positivo único. Alinea participantes por arriba, con cabeceras de 72px (108px para etiquetas de actores) y altura suficiente para todos los mensajes al paso existente de 54px. Las etiquetas muestran el número de orden y pueden ocupar varias líneas a 16px con interlineado de 24px; reserva todos sus límites entre mensajes y bajo cabeceras. Si necesitan más de dos líneas, separa participantes o mueve los marcos para dar espacio. Los grupos `alt`, `opt` y `loop` rodean el intervalo pertinente; una fase asíncrona independiente no debe sugerir que la solicitud síncrona original sigue esperando.

```json
{ "id": "request", "source": "browser", "target": "api", "label": "POST /orders", "kind": "sync", "order": 1, "evidence": "source" }
```

### ER

Cada entidad requiere `fields` no vacío. `key` puede ser `PK`, `FK` o `UK`. Toda relación requiere ambas cardinalidades: `1`, `0..1`, `*`, `1..*` o `0..*`.

Reserva cabecera de 72px, unos 32px por campo y relleno inferior. Amplía las columnas de clave/nombre/tipo para nombres de 16px y tipos e insignias de 14px, especialmente con identificadores largos. Deja 28px rectos fuera de cada entidad para los símbolos. Las cardinalidades JSON no cambian.

```json
{
  "id": "orders",
  "label": "orders",
  "kind": "entity",
  "fields": [
    { "name": "id", "type": "bigint", "key": "PK", "nullable": false },
    { "name": "user_id", "type": "bigint", "key": "FK", "nullable": false }
  ],
  "position": { "x": 80, "y": 120 },
  "size": { "width": 260, "height": 170 }
}
```

```json
{ "id": "user-orders", "source": "users", "target": "orders", "kind": "relationship", "sourceCardinality": "1", "targetCardinality": "0..*", "evidence": "schema" }
```

### Clases

Los nodos pueden incluir matrices de cadenas `attributes` y `methods`. Interfaces y clases abstractas muestran su estereotipo. Reserva cabecera de 68px, filas de 28px con letra de 16px y relleno en ambos compartimentos; ajusta ancho y alto para nombre, estereotipo y todos los miembros sin recortar ni reducirlos. Herencia/implementación y composición/agregación usan marcadores propios de triángulo y rombo sin cambiar los tipos de arista existentes.

### Estados

Las transiciones pueden contener `guard` y `action`. La etiqueta visible se compone como `label [guard] / action`.

### Anclajes de fuente

Usa `source` solo si el nodo corresponde a una ubicación precisa del repositorio o de un documento facilitado. Omítelo para actores externos y componentes de ejecución del framework. Mantén `facts` breves y atómicos; expresa la incertidumbre tanto en el texto como en el tipo de evidencia.

En ejemplos conceptuales solicitados explícitamente, describe el modelo de negocio en `facts`, marca relaciones deducidas como `inference` y declara ese alcance en metadatos. No inventes rutas ni reutilices anclajes de la vista previa en otro grafo. La generación normal sigue escribiendo exactamente `index.html` y `graph.json`.
