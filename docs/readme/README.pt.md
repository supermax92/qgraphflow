<div align="center">

# QGraphFlow

### Transforme código complexo em diagramas que você pode explorar.

Siga o caminho. Confira as evidências. Compartilhe um arquivo offline.

[English](../../README.md) · [中文](../../docs/readme/README.zh-CN.md) · [Русский](../../docs/readme/README.ru.md) · [Português](../../docs/readme/README.pt.md) · [日本語](../../docs/readme/README.ja.md) · [Deutsch](../../docs/readme/README.de.md) · [Español](../../docs/readme/README.es.md)

[Instalação por cliente](../clients.pt.md) · [Relatar problema](https://github.com/supermax92/qgraphflow/issues) · [MIT](../../LICENSE)

</div>

![Arquitetura, fluxo e sequência de comércio eletrônico: 0,8 segundo por vista, 2,4 segundos por ciclo, com conexões animadas](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.pt.core-three.gif)

*Nove tipos: arquitetura, fluxograma, sequência, ER, implantação, classes, estados, casos de uso e fluxo de dados.*

QGraphFlow gera diagramas de software interativos a partir de código, esquemas, configuração e requisitos. As relações podem ser verificadas e o resultado é um HTML offline compartilhável.

- **Explorar:** pesquisar, ampliar e deslocar a tela; entender responsabilidades e relações de entrada e saída.
- **Verificar:** inspecionar nós e conexões para conferir arquivos, linhas, símbolos e incertezas explícitas.
- **Editar:** desbloquear o layout, alterar textos e mover elementos; redefinir quando necessário.
- **Compartilhar:** abrir o HTML offline ou exportar o diagrama completo em SVG / PNG.

*Explorar: abrir a navegação, buscar o orquestrador da compra e localizá-lo. Selecionar um nó abre seu cartão e destaca conexões de entrada e saída; depois, ampliar e deslocar a tela.*

![Navegação, busca, cartão do nó, destaque das relações, zoom e deslocamento](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.pt.explore.gif)

*Verificar: abrir os detalhes pelo cartão para consultar caminhos, linhas e símbolos. Em seguida, selecionar uma conexão para ler a explicação e a marca de inferência.*

Os caminhos, números de linha e símbolos desta demonstração são fictícios. Ilustram o painel de evidências e não representam o código do repositório; a página e os detalhes também deixam isso explícito. Em análises reais, usar fontes reais e marcar relações não confirmadas como inferência.

![Detalhes com caminhos, linhas e símbolos explicitamente fictícios e inferências das relações](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.pt.verify.gif)

*Editar: desbloquear o layout em **Mais**, alterar nome e descrição, arrastar o nó com suas conexões e redefinir para restaurar texto e posição originais.*

![Desbloqueio, edição de texto, movimento do nó com as conexões e redefinição](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.pt.edit.gif)

*Compartilhar: abrir o HTML offline, exportar SVG e PNG por **Mais** e abrir o PNG para conferir o desenho completo.*

![HTML offline, exportação SVG e PNG e abertura do PNG exportado](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.pt.share.gif)

A visão geral mostra cada um dos três diagramas por 0,8 segundo: 2,4 segundos por ciclo. As quatro animações de interação reservam tempo para leitura. Toda a mídia usa o Viewer compilado do código-fonte, com textos dos diagramas e da interface em português. Os cinco GIFs e nove PNGs estão disponíveis como [arquivos independentes do Release showcase-v1](https://github.com/supermax92/qgraphflow/releases/tag/showcase-v1), com downloads públicos e somas SHA-256 verificados. Não fazem parte do histórico Git nem dos pacotes do plugin; sua visualização requer internet. O HTML gerado para o diagrama funciona offline.

## Início rápido

Instale pelo repositório ou por um diretório local do plugin conforme o [guia de instalação](../clients.pt.md). `qgraphflow-local` é o nome da origem de distribuição do projeto. A versão do código `0.0.2` não significa que um pacote Release correspondente já foi publicado.

Após instalar, inicie uma nova sessão e confirme que `q-flow` aparece na lista de habilidades do cliente. Os exemplos usam `$qgraphflow:q-flow` no Codex App. Se o cliente mostrar `$q-flow`, selecione essa entrada. As formas de chamada de outros clientes estão no guia de instalação.

**Sem saber por onde começar?** Chame a habilidade e escolha o assunto e a pergunta quando solicitado.

```text
$qgraphflow:q-flow
```

**Já tem um objetivo?** Diga qual parte deseja desenhar e o que quer entender. Não é preciso escolher o tipo de diagrama antes.

### Exemplo 1: Entender a arquitetura

```text
$qgraphflow:q-flow Analise este projeto e crie um diagrama de arquitetura em português com responsabilidades dos módulos, dependências e limites do sistema.
```

Útil para conhecer a estrutura geral ao entrar em um projeto.

### Exemplo 2: Acompanhar um fluxo de negócio

```text
$qgraphflow:q-flow Analise a criação de pedidos e gere um diagrama de sequência em português com cálculo de preços, reserva de estoque, pagamento e persistência do pedido, incluindo os ramos de falha.
```

Substitua a criação de pedidos e suas etapas pelo fluxo real do projeto. Continue na mesma conversa:

```text
$qgraphflow:q-flow Expanda a reserva de estoque do diagrama anterior em um fluxograma separado em português, mostrando o tratamento de sucesso e falha.
```

Os resultados ficam em `docs/qgraphflow/` por padrão. Abra `index.html` para explorar, editar e exportar; `graph.json` mantém os dados do grafo.

<details>
<summary>Executar manualmente o exemplo de comércio com nove vistas</summary>

Os comandos abaixo executam o exemplo do repositório. Usar um plugin já instalado não exige clonar este repositório. Com Node.js 22:

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
node skills/q-flow/scripts/validate-graph.mjs examples/showcase/ecommerce.pt.graph.json
node skills/q-flow/scripts/generate-viewer.mjs examples/showcase/ecommerce.pt.graph.json output/ecommerce-pt
```

Abra `output/ecommerce-pt/index.html` no navegador. Alterne em **Tipos de diagrama** na barra superior; cada vista mantém seus textos e posições salvos. **Mais → Salvar Graph JSON** salva todas as vistas em um arquivo JSON escolhido; navegadores sem gravação de arquivos baixam uma cópia. Recarregar o HTML original restaura os dados embutidos. Para reabrir as alterações, gere a partir do JSON salvo em um diretório novo.

O Viewer pré-compilado não exige instalar dependências, chave de API ou backend. A coleta de evidências e a criação de diagramas por IA usam o serviço de modelos do cliente escolhido.

</details>

## O que cada uma das nove vistas responde

| Vista · PNG | Pergunta principal | Escopo do exemplo |
| --- | --- | --- |
| [Arquitetura](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.pt.architecture.png) | Quais responsabilidades colaboram? | Canais, compra, preços, risco, estoque, pagamento, pedidos, eventos e entrega |
| [Fluxograma](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.pt.flowchart.png) | Onde o processo se ramifica e converge? | Falta de estoque, recusa de risco, compensação de pagamento e confirmação bem-sucedida |
| [Sequência](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.pt.sequence.png) | Em que ordem ocorrem chamadas e retornos? | Compra bem-sucedida e OrderPaid assíncrono |
| [ER](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.pt.er.png) | Como os dados centrais se relacionam? | Carrinho, pedidos, itens, pagamentos, reservas e pacotes |
| [Implantação](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.pt.deployment.png) | Onde as unidades executam e se conectam? | Borda, Kubernetes, serviços de dados, pagamentos e redes logísticas |
| [Classes](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.pt.class.png) | Como objetos de domínio e contratos dependem entre si? | Serviço de compra, Order e quatro portas |
| [Estados](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.pt.state.png) | Quais eventos e condições avançam um pedido? | Pagamento, entrega, cancelamento, reembolso e encerramento |
| [Casos de uso](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.pt.usecase.png) | O que cada ator pode fazer? | Comprador, lojista, depósito e atendimento |
| [Fluxo de dados](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.pt.dataflow.png) | Como os dados são transformados e armazenados? | Carrinho, decisões, eventos, depósito e comprovantes de entrega |

Este modelo conceitual demonstra o QGraphFlow e não corresponde a um repositório de comércio específico. O exemplo `graph.json` não inventa caminhos de código e marca as evidências das relações como `inference`. Diagramas reais precisam de código, DDL, configuração, testes e requisitos aceitos rastreáveis.

## Desenvolvimento e contribuição

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

São necessários Node.js 22, npm, tar, zip e unzip. Ao relatar problemas, inclua um grafo mínimo sem informações sensíveis, versões do cliente e navegador e passos de reprodução.

[Fontes de evidência](../references/pt/evidence-sources.md) · [Formato dos grafos](../references/pt/graph-schema.md) · [Consulta guiada](../references/pt/guided-intake.md) · [Desenvolvimento do Viewer](../references/pt/viewer-development.md) · [Composição de diagramas](../references/pt/visual-contract.md)

## Licença e atribuição

[MIT](../../LICENSE) · [Avisos de terceiros](../../THIRD_PARTY_NOTICES.md)

QGraphFlow é um projeto independente sob a licença MIT. O cenário comercial é conceitual e não representa a arquitetura de produção de nenhuma empresa; não implica afiliação, patrocínio ou endosso.
