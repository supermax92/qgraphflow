# Contrato JSON do grafo

[English](../../../skills/q-flow/references/graph-schema.md) · [简体中文](../zh-CN/graph-schema.md) · [Русский](../ru/graph-schema.md) · [Português](graph-schema.md) · [日本語](../ja/graph-schema.md) · [Deutsch](../de/graph-schema.md) · [Español](../es/graph-schema.md)

`scripts/generate-viewer.mjs` aceita um `Graph` ou uma coleção. Grafos antigos sem `meta.diagramType` continuam válidos e são exibidos como `architecture`. Os trechos ilustram a estrutura; antes de executá-los, complete os nós referenciados e valide o layout.

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

Use um grafo por padrão; uma página individual não tem menu de tipos. Para um visualizador múltiplo solicitado, envolva de 1 a 9 grafos em `diagrams`. Cada `meta.diagramType` deve ser único. O menu vertical da barra segue a ordem fixa `architecture`, `flowchart`, `sequence`, `er`, `deployment`, `class`, `state`, `usecase`, `dataflow`, independentemente da ordem de entrada.

```json
{
  "diagrams": [
    { "meta": { "title": "System", "diagramType": "architecture", "sourceRef": "main" }, "nodes": [], "edges": [] },
    { "meta": { "title": "Request", "diagramType": "sequence", "sourceRef": "main" }, "nodes": [], "edges": [] }
  ]
}
```

Os grafos abreviados mostram apenas o contêiner. Cada grafo ainda precisa cumprir todo o contrato e conter nós.

## Campos comuns

- Obrigatórios: `meta.title`, `meta.sourceRef`, `nodes` não vazio e `edges`.
- `meta`, nós, arestas, grupos e âncoras são objetos; `nodes`, `edges` e o opcional `groups` são arrays de objetos. Contêineres inválidos são rejeitados antes do layout ou da geração.
- Os opcionais `meta.subtitle`, `meta.scope`, `subtitle` de nó, `source.symbol` e `label` de aresta são strings. O `module` opcional de nós/arestas é uma string não vazia: reutilize exatamente o mesmo valor para o mesmo módulo de negócio em toda a coleção; não armazene cores literais. `facts`, `tags`, `attributes` e `methods` são arrays de strings não vazias. Essas regras valem para todos os tipos.
- O `fields` opcional é um array de objetos com strings não vazias `name` e `type`, `key` opcional (`PK`, `FK`, `UK`) e `nullable` booleano opcional. ER exige pelo menos um campo; outros tipos podem mostrá-los na busca e nos detalhes.
- `meta.diagramType`: `architecture`, `flowchart`, `sequence`, `er`, `deployment`, `class`, `state`, `usecase` ou `dataflow`.
- `meta.locale`: idioma opcional do visualizador: `en`, `zh-CN` (padrão), `ru`, `pt`, `ja`, `de` ou `es`; `ko` e `fr` continuam disponíveis para grafos existentes. Controla a interface e os rótulos de exportação. Escreva separadamente títulos, nomes, fatos e relações no idioma desejado; preserve identificadores de código e notação padrão. Cada diagrama da coleção usa seu próprio idioma.
- IDs são strings únicas não vazias. Cada extremidade de aresta identifica um nó.
- Todos os nós e grupos têm `position` e `size` finitos e não negativos.
- `evidence` de aresta: `source`, `code`, `config`, `schema`, `test`, `document`, `framework` ou `inference`.
- `route` é opcional. `via` contém pontos intermediários nas coordenadas do grafo e `labelAt` fixa o centro do rótulo. Omita ambos quando o roteamento ortogonal automático for claro.
- Cada coordenada em `route.via` e `route.labelAt` deve ser finita e não negativa. O roteador insere cotovelos ortogonais entre os pontos e mantém a primeira e a última conexão ancoradas nas posições atuais dos nós.
- O `source.kind` opcional usa os mesmos valores de evidência. `source.file` e `source.lineStart` identificam a âncora exata.
- Com `--repo-root <directory>`, validação e geração leem cada `source.file` como texto UTF-8 relativo ao repositório e verificam o intervalo inclusivo de linhas. Rejeitam caminhos absolutos, travessia para diretórios superiores, diretórios, arquivos binários e links simbólicos que escapem da raiz. Referências repetidas compartilham uma leitura. Sem raiz, os comprovantes marcam âncoras existentes como `skipped`; sem âncoras, como `not-applicable`. A verificação cobre a árvore de trabalho local, não a identidade da revisão de `sourceRef`, resolução de símbolos ou veracidade das afirmações.
- Para enfatizar o núcleo de negócio, use o tipo existente `business` onde permitido, ou inclua `core`/`business` em `tags`, sem diferenciar maiúsculas. Preserve um tipo legal de nó; `core` não é um novo tipo nem campo.
- O sistema visual neutro frio é uma regra de apresentação. Cor, tipografia e destaque central não exigem novos campos. O modelo de pedidos e entrega da prévia é exemplo, não conjunto de dados padrão nem fonte de evidência.

Metadados antigos `playback` são ignorados. Não existe reprodução automática ou por etapas; o movimento das arestas direcionadas é uma pista visual independente e não indica ordem de execução.

## Salvar edições do visualizador

Trocar de tipo preserva textos e posições salvos de cada grafo na página aberta. Redefinir restaura somente o conteúdo original incorporado do grafo ativo. **Salvar Graph JSON** salva toda a coleção ou o formato original de grafo único, incluindo outras vistas, metadados e âncoras. Navegadores compatíveis permitem escolher um arquivo `.json`; os demais baixam `graph.json`. Cancelamento ou falha preservam todas as edições.

Recarregar o HTML volta aos dados incorporados. Guarde o JSON salvo e gere em um novo diretório para reabrir o modelo editado permanentemente. Salvar não dispensa validação: textos ou posições editados podem exigir correções antes de regenerar. O navegador não reverifica âncoras; para entrega baseada em fontes, execute novamente os dois comandos CLI com `--repo-root`.

<a id="routing-and-spacing"></a>

## Rotas e espaçamento

- Deixe pelo menos 64 pixels do grafo entre retângulos de nós. Um corredor com rótulo deve acomodar toda a largura estimada mais 24 pixels.
- Dimensione cartões comuns para títulos de 20px, corpo/campos/membros/arestas de 16px e texto secundário de 14px. Amplie caixas e corredores individuais conforme o conteúdo; escalar tudo perde o ganho ao ajustar a vista. São recomendações de autoria, não novos mínimos de validação; cartões antigos compactos e símbolos especializados continuam compatíveis. A vista inicial ajusta todo o diagrama ao redor da barra e dos painéis abertos, com zoom mínimo 0.08; ajustar tudo explicitamente usa a mesma vista.
- Relações paralelas, divergentes e convergentes recebem faixas automáticas de 24px; podem compartilhar no máximo 12px perto de uma extremidade. A folga maior dos símbolos ER não permite unir rotas.
- O lado de um nó deve comportar suas faixas. Amplie o nó ou forneça dicas de rota quando a validação indicar transbordamento de extremidades.
- Em rotas indicadas sem autorrelação, o primeiro/último ponto determina o lado e a posição projetada na borda. Preserve um trecho reto externo de 28px para cardinalidades ER e de 12px para outros diagramas. Pontos devem ficar fora de todos os interiores, inclusive dos nós das extremidades.
- Autorrelações usam por padrão uma rota de 48×32px fora da borda direita. Use `route.via` ou `route.labelAt` somente se a área estiver ocupada.
- A validação rejeita sobreposição de nós, rótulos sobre nós/rótulos, rotas pelo interior de qualquer nó (inclusive suas extremidades), autorrelações inseguras e segmentos compartilhados maiores que 12px. Mensagens de sequência mantêm suas conexões nas linhas de vida abaixo dos cabeçalhos. Espaços apertados e cruzamentos geram avisos.
- Centros dos participantes de sequência devem estar separados por pelo menos `max(160, estimated message width + 32)` pixels.

## Notação por tipo

| `diagramType` | Nó `kind` | Grupo `kind` | Aresta `kind` |
| --- | --- | --- | --- |
| `architecture` | `external`, `config`, `framework`, `security`, `service`, `business`, `data`, `failure`, `system`, `component`, `database` | `runtime`, `security`, `ownership`, `external` | `request`, `call`, `data`, `success`, `failure`, `framework`, `optional`, `depends` |
| `flowchart` | `start`, `end`, `process`, `decision`, `input`, `output`, `subprocess` | nenhum | `flow`, `yes`, `no`, `success`, `failure` |
| `sequence` | `actor`, `participant`, `external`, `service`, `database` | `alt`, `opt`, `loop` | `sync`, `async`, `return` |
| `er` | `entity` | nenhum | `relationship` |
| `deployment` | `device`, `node`, `container`, `artifact`, `service`, `database`, `external` | `host`, `network`, `cluster`, `namespace` | `deploy`, `network`, `depends` |
| `class` | `class`, `interface`, `abstract` | nenhum | `association`, `inheritance`, `implementation`, `composition`, `aggregation`, `dependency` |
| `state` | `initial`, `state`, `final`, `choice` | nenhum | `transition` |
| `usecase` | `actor`, `usecase` | `system` | `association`, `include`, `extend` |
| `dataflow` | `external`, `process`, `dataStore` | `ownership`, `external` | `data` |

### Sequência

Arestas exigem `order` inteiro positivo único. Alinhe os participantes pelo topo, com cabeçalhos de 72px (108px para rótulos de atores) e altura suficiente para todas as mensagens no passo existente de 54px. Os rótulos mostram a ordem e podem quebrar linhas com fonte de 16px e entrelinha de 24px; reserve seus limites completos entre mensagens consecutivas e abaixo dos cabeçalhos. Se precisarem de mais de duas linhas, aumente a distância entre participantes ou mova as bordas dos quadros. Grupos `alt`, `opt` e `loop` envolvem o intervalo pertinente; uma fase assíncrona independente não deve sugerir que a solicitação síncrona original continua esperando.

```json
{ "id": "request", "source": "browser", "target": "api", "label": "POST /orders", "kind": "sync", "order": 1, "evidence": "source" }
```

### ER

Toda entidade exige `fields` não vazio. `key` pode ser `PK`, `FK` ou `UK`. Uma relação exige ambas as cardinalidades: `1`, `0..1`, `*`, `1..*` ou `0..*`.

Reserve cabeçalho de 72px, cerca de 32px por campo e espaço inferior. Amplie as colunas de chave/nome/tipo para nomes de 16px e tipos e identificadores de chave de 14px, sobretudo com nomes longos. Deixe 28px retos fora de cada entidade para os símbolos. As cardinalidades JSON não mudam.

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

### Classes

Nós podem conter arrays de strings `attributes` e `methods`. Interfaces e classes abstratas mostram seu estereótipo. Reserve cabeçalho de 68px, linhas de membros de 28px com fonte de 16px e espaço interno nos dois compartimentos; amplie largura e altura para nome, estereótipo e todos os membros sem cortar ou reduzir. Herança/implementação e composição/agregação usam seus próprios triângulos e losangos sem mudar os tipos existentes de aresta.

### Estados

Transições podem conter `guard` e `action`. O rótulo visível é composto como `label [guard] / action`.

### Âncoras de fonte

Use `source` apenas quando o nó corresponder a um local exato do repositório ou de documento fornecido. Omita para atores externos e componentes de execução do framework. Mantenha `facts` curtos e atômicos; indique incerteza tanto na redação quanto no tipo de evidência.

Em exemplos conceituais explicitamente solicitados, descreva o modelo de negócio em `facts`, marque relações inferidas como `inference` e declare o escopo nos metadados. Não invente caminhos nem reutilize âncoras da prévia em outro grafo. A geração normal continua escrevendo exatamente `index.html` e `graph.json`.
