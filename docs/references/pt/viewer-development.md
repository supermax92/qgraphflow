# Desenvolvimento e manutenção do visualizador

[English](../../../skills/q-flow/references/viewer-development.md) · [简体中文](../zh-CN/viewer-development.md) · [Русский](../ru/viewer-development.md) · [Português](viewer-development.md) · [日本語](../ja/viewer-development.md) · [Deutsch](../de/viewer-development.md) · [Español](../es/viewer-development.md)

Os módulos são compostos na compilação. Após alterar e compilar o código, o gerador incorpora todos os recursos no HTML independente. Não há download de plugins nem carregamento a quente durante a execução. A geração normal continua produzindo somente `index.html` e `graph.json`.

## Pontos de alteração

Caminhos relativos a `assets/viewer/src/`:

| Objetivo | Entrada | Responsabilidade |
| --- | --- | --- |
| Adicionar um tipo | `diagrams/<type>.js`, `diagrams/registry.js` | Nomes, ordem, tipos permitidos, validação, desenho, contornos e regras de relações |
| Tema, fontes, entrelinhas | `visual-style.js`, `radix-colors.js` | Escalas Radix, variáveis, semântica, reconhecimento do núcleo e dimensões compartilhadas por página/exportação |
| Formas e layout interno | `diagrams/<type>.js`; cartões comuns em `diagrams/card.js` | Nós da página e de SVG/PNG |
| Tipografia SVG e primitivas | `diagrams/drawing.js` | `svgStyles()`, escape e primitivas, com escopo na página e reutilização na exportação |
| Barra, detalhes, estrutura responsiva | `ViewerShell.jsx`, `styles.css` | Estrutura da página, sem segunda implementação HTML/CSS do conteúdo dos nós |
| Brilho do canvas | `effects.css`, importado por `main.jsx` após `styles.css` | Brilho de papel/seleção/fluxo e vinheta escura; só variáveis da paleta, removível como arquivo, desligado com transparência reduzida/contraste alto |
| Seleção e busca | `features/useSelection.js`, `search.js` | Seleção, resposta, teclado e fechamento; ordenação de busca testável separadamente |
| Movimento dirigido | `features/useViewerController.js`, `DiagramCanvas.jsx` | Apenas direção, controlada por interruptor próprio e movimento reduzido |
| Legenda | `ViewerShell.jsx`, `styles.css`; conteúdo de `legend.js`, `visual-style.js` | Popover das categorias/linhas existentes, símbolos originais, `nodeAppearance` e prioridade do núcleo |
| Painéis e foco | `features/usePanels.js` | Exclusão no celular, visibilidade, retorno de foco; preferência preservada entre vistas |
| Tela cheia | `features/useFullscreen.js`, `features/useSelection.js` | API nativa, erros e foco; seleção não abre inspetor externo, Escape sai primeiro da tela cheia |
| Arrastar, vista, bloqueio, espaçamento | `features/useGraphLayout.js`, `layout-nudge.js` | Posições atuais e operações; D3 continua sendo ajuste limitado |
| Estado de apresentação | `features/usePresentation.js` | Projetar seleção/busca nos nós e arestas, sem segundo proprietário do estado |
| Downloads | `features/download.js`, `export-svg.js` | SVG estático das coordenadas atuais; PNG rasterizado desse SVG |
| Rotas e verificação de layout | `edge-routing.js`, `text-layout.js` | Caminhos, quebras e medidas compartilhados por página, exportação e validação |

`main.jsx` controla carga, troca de vista, tema e rascunhos por vista. `features/useViewerController.js` combina recursos e coordena salvar/redefinir; `ViewerShell.jsx` conecta a UI. Amplie o módulo existente primeiro; crie Hook apenas para estado e ciclo de vida independentes.

## Adicionar um tipo de diagrama

1. Adicione em `diagrams/` um módulo com definição exportada por padrão.
2. Importe em `diagrams/registry.js` e inclua em `DIAGRAMS`. A ordem define o menu da coleção; grafos únicos continuam sem menu.
3. Atualize `graph-schema.md`, `visual-contract.md` e instruções de autoria no SKILL. Registrar não exige necessariamente mudar a estrutura de dados.
4. Compile, gere exemplos e verifique nós, relações e interações específicas.

Reutilize regras e primitivas. Um cartão que herda toda a arquitetura precisa apenas de `{ ...architecture, id: 'new-view', label: 'New view' }` e registro. Um tipo independente normalmente contém:

```js
export default {
  id: 'new-view', label: 'New view',
  nodeKinds: ['component'], groupKinds: [], edgeKinds: ['call'],
  outline, // (node, x, y) => [[nome da tag SVG, atributos geométricos], ...]
  render,  // (node, x, y, fill, stroke, palette) => string SVG
};
```

`render` desenha o corpo com `paint(outline(node, x, y), { fill, stroke })` e texto com `text` / `centeredTitle`. O código do módulo é confiável; os dados não. Nunca concatene entrada em tags, atributos ou texto SVG sem o escape compartilhado.

Adicione hooks opcionais só quando necessário:

- `validateNode`, `validateEdge`: restrições após as comuns; reutilize `requireString`, `validateStringArray` etc. Cada validação cria um conjunto novo de ordens de sequência.
- `edgeLabel`, `undirected`, `dashedKinds`, `markers`: rótulos, direção, tracejados de notação além dos estilos de evidência e marcadores UML existentes.
- `cardLayout`, `compartments`, `sequence`, `cardinalities`, `endpointStub`, `selectionHeight`: regras de cartões, compartimentos do núcleo, linhas de vida, extremidades ER e altura de seleção.

Cartões retangulares reutilizam regras existentes. Rotas, conexões ou símbolos UML diferentes exigem extensão compartilhada de roteamento/desenho: registrar não infere geometria desconhecida. Adicione nomes e classificação `nodeAppearance` para novas semânticas em `visual-style.js`. Mantenha o aviso MIT de Radix de `radix-colors.js` no HTML e SVG.

## Restrições de renderização compartilhada

`DiagramCanvas.jsx` e `export-svg.js` chamam `renderNode()` de `node-svg.js`. A página insere SVG nos nós React Flow; a exportação passa um deslocamento ao mesmo renderizador. `SelectionOutline.jsx` chama `renderSelection()` e reutiliza `outline`, mudando somente traço, opacidade e sombra.

Separe posição, conteúdo e interação temporária. Arrastar altera coordenadas; selecionar não altera coordenadas nem formas. Exporte somente grafo atual e tema, sem seleção/animação. Limites, adaptação de marcadores React Flow e controles mantêm desenho específico do ambiente; compartilhar conteúdo não significa DOM e SVG idênticos.

## Compilação e regressão

No diretório do skill, com dependências e ferramentas existentes:

```bash
npm --prefix assets/viewer run build
node --test scripts/*.test.mjs
node scripts/generate-viewer.mjs /tmp/graph.json /tmp/new-viewer
node scripts/browser-interactions.mjs /tmp/new-viewer /tmp/new-viewer-check
```

O botão inferior esquerdo coloca o canvas em tela cheia nativa; painéis e barra ficam fora. Após mudar dimensões, ajuste uma vez sem mudar seleção/layout; preserve a vista ao sair. Alvo ajusta, quatro cantos alternam tela cheia. Regenere HTML antigos. Sem suporte, marque o controle indisponível; anuncie falhas na região de estado do canvas.

A aceitação usa APIs reais. `QA_HEADED=1` abre janela para tela cheia, Escape e foco:

```bash
QA_HEADED=1 QA_ONLY_EXTRAS=1 QA_EXTRAS=fullscreen,fullscreen-errors \
node scripts/browser-interactions.mjs /tmp/new-viewer /tmp/fullscreen-check
```

O script verifica cada tipo fornecido em três tamanhos, temas claro/escuro e interações. Use coleção de nove tipos para a matriz completa. `QA_FIXTURE_DIR` adiciona casos de formas especiais. O script exige módulos vizinhos; não funciona copiado sozinho.

Detalhes seguem o usuário: `useSelection` possui a seleção, `useViewerController` deriva `inspectedNode`, e cartão rápido/inspetor de `ViewerShell` o utilizam. Sem reprodução, leitura por passos ou orquestração. Legenda flutuante no alto à esquerda; `.inspector-facts` ao final. `has-flow` de `DiagramCanvas` e `styles.css` controlam contraste da camada estática durante fluxo; seleção não preenche espaços dos traços móveis.

```bash
QA_ONLY_EXTRAS=1 QA_EXTRAS=flow-contrast,inspector-sync \
node scripts/browser-interactions.mjs /tmp/new-viewer /tmp/new-viewer-sync-check
```

`diagram-modules.test.mjs` adiciona um décimo tipo de teste em cópia temporária, altera apenas seu módulo/registro e valida, compila e gera. O produto mantém nove tipos. `MODULE_TEST_OUTPUT=/tmp/new-module-check` preserva a cópia; use seu `skills/q-flow/scripts/browser-interactions.mjs` em `page/`. A cópia conserva hierarquia e avisos de terceiros da raiz para verificar dependências reais. O destino não pode existir.

Reconstrua `assets/viewer-dist/index.html` após alterações. Depois de instalar, verifique o cache real e gere aceitação com a versão instalada em nova sessão. HTML existente contém código antigo e precisa ser regenerado.

## Nomes e migração do QGraphFlow

| Identificador | Antigo | Novo |
| --- | --- | --- |
| Produto | CodeGraph Flow | QGraphFlow |
| ID do plugin | `codegraph-flow` | `qgraphflow` |
| Diretório e invocação do skill | `create-interactive-codegraph` / `$create-interactive-codegraph` | `q-flow` / `$q-flow` |
| Nome exibido do skill | CodeGraph Flow｜交互式软件图 | Q flow |
| Pacote privado do visualizador | `codegraph-flow-viewer` | `qgraphflow-viewer` |
| Diretório padrão de entrega | `docs/codegraph-flow/<scope>-<diagram-type>/` | `docs/qgraphflow/<scope>-<diagram-type>/` |

O pacote mantém somente a entrada nova, sem aliases antigos. O escopo continua sendo nove tipos de diagramas de software. Renomear MapSprig / QMindFlow está fora desta migração.

Na raiz, use os novos caminhos:

```bash
node skills/q-flow/scripts/validate-graph.mjs /tmp/graph.json
node skills/q-flow/scripts/generate-viewer.mjs /tmp/graph.json docs/qgraphflow/example-architecture
```

O diretório padrão é convenção de entrega do skill; o gerador exige destino explícito. Diretórios antigos escolhidos pelo usuário, incluindo `docs/codegraph-flow/`, continuam aceitos. Substituir exige `--force`. Os `graph.json` antigos não precisam de reescrita: nomes antigos redigidos em títulos, fontes, nós e evidências são preservados. HTML antigo funciona offline com a marca incorporada; regenere do JSON original.

`CodeGraph`, `codegraph`, `@colbymchenry/codegraph`, `.codegraph/` pertencem ao analisador externo e não mudam; também permanecem `__CODEGRAPH_FLOW_DATA__`, IDs SVG `codegraph-*` e prefixos dos diretórios temporários de teste.

### Instalação local e atualizações

Instalação, atualização, remoção e situação de verificação de Codex, Claude Code, Qoder e Cursor: [guia de clientes](../../clients.pt.md). Editar o repositório não atualiza plugins instalados. Verifique fonte/versão reais ao instalar/migrar, use controles do cliente e preserve diagramas do usuário e configurações de outros plugins.

<a id="viewer-visual-and-interaction-contract"></a>

## Contrato visual e de interação do visualizador

Leia para manutenção ou auditoria. Na autoria de grafos, use [visual-contract.md](visual-contract.md).

### Apresentação compartilhada

- Estrutura React Flow centrada no canvas: ocupa a janela sob barra material de 52px com navegação, menu da coleção, título/subtítulo, busca com resultados flutuantes, `···` para exportar/redefinir/bloqueio/espaçamento/aparência e inspetor. Sem cabeçalho de quadro, rodapé ou bloco de marca; nome do produto só no título do documento. Navegação/inspetor deslizam das próprias bordas e começam fechados em todas as larguras. Clicar num nó mostra cartão ao lado (tipo, nome, responsabilidade, fonte, até quatro tags e detalhes), sem abrir inspetor. O diagrama recebe o maior destaque.
- Siga `prefers-color-scheme` por padrão e ao vivo. `···` oferece sistema/claro/escuro; escolha manual vence nas duas direções. Preserve vista, busca, seleção, bloqueio e painéis ao trocar tema.
- Paleta Radix Colors (MIT): Slate para superfícies neutras frias, Iris para núcleo/interação, Cyan para dados, Orange para decisões/falhas. Preserve avisos no código distribuído, HTML e SVG; sem CDN em execução ou biblioteca de componentes.
- Núcleo real: `business` existente ou tag `core`/`business` sem diferenciar maiúsculas. Iris 3/8/12 para preenchimento/borda/texto; ER/classes só no cabeçalho, membros neutros. Núcleo precede dados/alertas. Estados inicial/final mantêm ponto/círculo duplo; não crie tipo `core` nem campos de cor.
- Página, nós, MiniMap, pontos do inspetor, legendas e exportações compartilham `visual-style.js`. Cartões Slate 2; canvas claro Slate 1 (`#fcfcfd`, quase branco), mesmo passo 1 do escuro. Use as escalas escuras correspondentes.
- Cores da interface derivadas em `styles.css` com `color-mix`: quatro níveis `--label`, `--label-2/3/4`, separador `--sep`, preenchimentos `--fill`, `--fill-2/3`, materiais `--material-thick`, `--material`, `--material-thin`. Escuro muda só base e sombras. Texto de interface 11 / 12 / 13 / 15 / 20 px; SVG usa `TYPOGRAPHY` / `--font-*`. Todo controle tem `:active` e `:focus-visible` comum; painéis usam linha .5px e uma sombra, `1px solid` só em glifos do canvas. Além de `prefers-reduced-motion`, `prefers-reduced-transparency` torna materiais opacos `--panel`, sem desfoque; `prefers-contrast: more` usa cor de rótulo para separadores/texto secundário e contorno de 1px em camadas flutuantes.

| Função | Escala / passo Radix |
| --- | --- |
| Página / superfície comum | Slate 1 / Slate 2 |
| Texto principal / secundário | Slate 12 / Slate 11 |
| Núcleo: preenchimento / borda / texto | Iris 3 / Iris 8 / Iris 12 |
| Interação / movimento dirigido | Iris 11 |
| Dados: preenchimento / borda / destaque | Cyan 3 / Cyan 8 / Cyan 11 |
| Alerta: preenchimento / borda / destaque | Orange 3 / Orange 8 / Orange 11 |
| Borda sutil / aresta comum | Slate 6 / Slate 9 |

- Em claro, sem `module` o nó conserva preenchimento de papel; com módulo, cartão inteiro, contorno e faixa superior usam sua cor. Mapeamento revisado do exemplo chinês: 渠道 `#6b7280`, 结算 `#5753d7`, 价格 `#8b5cf6`, 库存 `#0f8f83`, 风控 `#c26a17`, 支付 `#2474d2`, 订单 `#348052`, 履约 `#b14b7d`. Cor não substitui nomes, formas, cardinalidade, linhas ou estereótipos; preserve preenchimento ao selecionar.
- Legenda apenas com categorias/linhas presentes, mesma prioridade do núcleo, semântica e tema atual.
- Botão da legenda no alto à esquerda abre popover com interruptor de fluxo quando há relações dirigidas. Símbolos originais antes dos rótulos mantêm forma, cores e linha contínua/tracejada; texto inline com quebra. Desloca à direita da navegação aberta; pan/zoom não mudam posição/tamanho. Escape ou clique externo fecha.
- Relações dirigidas mostram por padrão um traço sutil móvel da origem ao destino; não dirigidas ficam estáticas. Mantenha a linha de evidência por baixo. Seleção não para fluxo; interruptor próprio para só os traços ambientais, movimento reduzido para todo movimento ambiental.
- Hover/seleção usam contornos/sombras sem escalar geometria ou substituir preenchimentos/bordas. Seleção aplica uma resposta compartilhada de 760ms ao nó e arestas incidentes, depois destaque estático; só espessura, opacidade e sombra animam.
- `effects.css` é camada exclusiva da tela após `styles.css`. Escuro: `filter: drop-shadow` de módulo ou papel em `.node-surface`, destaque hover/seleção, halo amplo (nó 14px a .5, arestas incidentes 14px a .3, mantendo ≥60% do contraste de referência do traço móvel), `.edge-flow` mais grosso e vinheta radial superior de 10%. Claro: sombra suave do módulo e canvas plano. Só tokens, sem `box-shadow` de cartão (linhas de vida `boxShadow === 'none'`), sem afetar exportação. `prefers-reduced-transparency: reduce` ou `prefers-contrast: more` desligam a camada: filtros `none`, halo/fluxo retornam a `styles.css`, sem vinheta.
- Movimento reduzido desativa animação das relações/seleção e muda a vista instantaneamente.
- SVG/PNG usam tema, notação, hierarquia e rotas ortogonais compartilhadas, sem seleção/busca temporária. Rótulos/símbolos ficam dentro das formas; descrições SVG preservam todo o texto.

### Interação

- Grafo único sem menu; coleção em ordem canônica com `role=menu`, `menuitemradio`, item marcado e contagem de relações. Troca conserva texto/posição por grafo, limpa busca/seleção anterior, ajusta tudo e aplica núcleo inicial.
- Sem reprodução, passos, passeio de leitura ou estado de passo atual/concluído. Ignore `playback`; movimento não representa ordem de execução.
- Selecione inicialmente o primeiro núcleo explícito e arestas diretas estaticamente, sem pulso; igual na troca. Sem núcleo, sem seleção.
- Seleção mostra cartão rápido e arestas diretas de entrada/saída; autorrelação uma vez, sem percorrer além nem escurecer relações alheias. Reutilize rota atual, sem novas setas/tamanhos. Preserve evidência tracejada, cardinalidade ER e UML.
- Contorno segue cartão, losango, paralelogramo, elipse e círculo. Sequência só cabeçalhos/atores, nunca caixa inteira da linha de vida. Após 760ms estático; outro nó substitui todo o conjunto, o mesmo repete uma vez.
- Clique/início de arraste selecionam e mostram cartão; diretório/busca e Enter/Space abrem inspetor. Fluxo continua. Uma resposta/posição por operação; arrastar não recentraliza nem tira foco.
- Clique no canvas, fechar detalhes ou Escape limpam seleção. Busca atenua não correspondentes sem mudar topologia.
- Inspetor mantém fatos, campos, nulabilidade, atributos, métodos, fontes e tags até mudança/limpeza do usuário; não avança nem rouba foco.
- Fluxo deve continuar distinguível durante seleção; não preencher lacunas com linha opaca da mesma cor. Verifique todas as arestas incidentes dirigidas, não só a primeira ou `animationPlayState`. Movimento reduzido e interruptor têm prioridade.
- Busca ignora maiúsculas e espaços externos. Ordem: nome exato, prefixo, trecho, subtítulo/tags, fatos/campos/atributos/métodos; empates mantêm ordem original; pegue oito depois de ordenar.
- Layout bloqueado por padrão; controle explícito permite arrastar; downloads usam posições atuais.
- Organizar espaçamento após desbloqueio usa D3 limitado: nó selecionado e vizinhos de um salto, ou todos sem seleção. Meta 65px entre retângulos perto da autoria; nós contidos ficam no menor limite, participantes de sequência movem só horizontalmente. Não é nova topologia nem layout automático completo.
- Bloqueado, organizar fica cinza com `aria-disabled="true"`, mas aceita mouse/teclado para anunciar o desbloqueio necessário. Rótulo de bloqueio em uma linha, interruptor 32×20px na linha em todas as larguras. Sem solver ou desbloqueio automático. Depois informe escopo local/total e quantidade movida, nenhuma mudança se validação limpa, ou problemas restantes com ajuste manual. Conte erros e avisos mesmo sem movimento.
- Se cabeçalho/espaço desejados não cabem no limite de deslocamento de 156px, mantenha posição original e relate problemas. Nós alheios conservam coordenadas exatas, inclusive frações. Cada operação renova mensagem e temporizador de 4.5s, mesmo repetida.
- Organizar não altera evidência, dicas de rota, grupos, seleção, vista, painéis ou tema. Redefinir restaura posições de `graph.json`, vista de leitura e fluxo padrão; limpa busca/seleção/mensagens; conserva tema, painéis e bloqueio e anuncia conclusão.
- Pan, zoom, ajustar, redefinir e SVG/PNG permanecem disponíveis.
- Salvar Graph JSON preserva texto/posição de todas as vistas na forma original única/coleção com metadados, fontes e campos estruturados. Seletor nativo quando possível, download caso contrário. Cancelar/falhar conserva edições; redefinição afeta só vista ativa e próximo salvamento. Recarregar usa dados incorporados; regenere do JSON salvo. Regressão cobre troca de ida/volta, isolamento da redefinição, download JSON e regeneração.
- Teclado/fechamento preservam topologia; Backspace/Delete não removem nós.
- Abrir/redefinir/trocar ajusta tudo; pan/zoom/minimapa dão detalhe. Limites iguais aos de exportação: nós, grupos, rotas externas, rótulos e símbolos ER. Diretório/ajuste usam posições após arrastar/organizar; redefinir recupera originais.
- Todo ajuste, inclusive tela cheia, desconta interface: topo 52px+12px, linha inferior de controles, lados abertos 304px+24px ou fechados 24px. `readingPadding()` em `useGraphLayout.js` lê `data-nav-open` / `data-drawer-open`; padding precisa de strings `px`, números puros são proporções.
- Navegação/inspetor/detalhes rápidos que abrem painel sobre o nó movem só o necessário para 12px da borda, sem zoom. Sem cobertura ou em ≤700px, não move. `useReveal.js` é chamado explicitamente dessas três ações, não de efeito. Diretório/busca continuam centralizando.
- Movimentos programáticos compartilham `cubic-bezier(.32,.72,0,1)` em 320–420ms; painéis usam mola criticamente amortecida (`visualDuration .36`, `bounce 0`). Movimento reduzido põe duração zero e painel no destino, sem percurso desenhado.
- Zoom escala nó completo sem esconder subtítulos, campos, atributos, métodos ou estereótipos, inclusive em tela cheia. Texto central quebra no retângulo útil, mais estreito em losangos/elipses/cápsulas/formas inclinadas. Medição reserva maiúsculas/letras latinas largas e notação de fragmento nos limites. `text-bounds` testa todos os tipos, campos/membros longos, títulos de limites, arestas em maiúsculas e três zooms; texto não vazio com opacidade calculada zero falha.
- Cartão rápido tenta direita→esquerda→baixo→cima: primeiro local no canvas sem cobrir nós. Se todos os locais que cabem sobrepõem, escolha menor sobreposição pela altura real. Cresce do nó (`is-flipped / is-below / is-above` define `transform-origin`).
- Conteúdo longo quebra e rola na altura disponível; fechar/detalhes continuam acessíveis por teclado. Em tela cheia, detalhes sai antes de abrir/focar inspetor; se a saída falhar, mantenha cartão e anuncie erro.
- Navegação aberta move legenda/zoom para 328px da esquerda; inspetor move minimapa para 328px da direita (`.workspace.nav-open / .drawer-open`); em ≤700px ficam parados.
- SVG/PNG incluem o diagrama completo, não apenas a vista atual.

### Layout responsivo

- Ambos os painéis começam fechados em qualquer largura, abrem como sobreposições de 304px do fundo da barra+12px ao fundo da janela−12px, sem bloqueio de fundo e com canvas arrastável ao lado. Escape fecha primeiro popover, depois painel com foco (devolve ao interruptor), depois seleção. Nenhum ponto intermediário elimina acesso à evidência.
- Em ≤700px: largura janela−24px, exclusão mútua, minimapa oculto. Resultado de busca abre detalhes e fecha navegação.
- Ações móveis acessíveis, canvas visível ao lado, sem transbordamento horizontal em 390px. Inspetor mantém texto completo e rolagem vertical.

### Exibição de evidência

- Identidade, campos, atributos, métodos, âncoras e tags primeiro; fatos do mesmo nó ao final em seção separada. Com fonte, fatos de evidência; sem fonte, descrição do nó. Omita sem fatos/nó, role com o conteúdo.
- Código, configuração, esquema, teste e documento diretos usam linha contínua, salvo notação tracejada exigida, como retorno, dependência ou implementação.
- Comportamento do framework e inferência continuam tracejados durante fluxo.
- Detalhes dizem evidência; não alegam que toda âncora seja código-fonte.
- Quebre palavras longas em fatos, subtítulos, campos, métodos, símbolos e tags, preserve texto completo e somente rolagem vertical.

### Aceitação no navegador

- Matriz completa só com mudanças em código do visualizador, rotas, esquema ou validação: nove tipos × 1440×900 / 1920×1080 / 390×844 × claro/escuro. Verifique fluxo padrão, ausência de reprodução, seleção estável com movimento, interruptor independente, legenda dinâmica, pan/zoom, busca ordenada, destaque vinculado sem mudança geométrica/pulsos duplos, detalhes completos, bloqueio/resultado do espaçamento, redefinir, SVG/PNG sem efeitos temporários, teclado, movimento reduzido e transbordamento. Confira notação/núcleo por tipo. Único sem menu, coleção vertical; em ≤700px painéis inicialmente fechados, acessíveis e exclusivos.
- Abra downloads para conferir rótulos completos, notação, limites sem corte e tema. Reutilize navegador instalado e feche servidores HTTP temporários em `finally`.
