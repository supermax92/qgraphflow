<div align="center">

<h1><picture><source media="(prefers-color-scheme: dark)" srcset="../images/brand/qgraphflow-lockup-dark.svg"><img src="../images/brand/qgraphflow-lockup-light.svg" alt="QGraphFlow" height="64"></picture></h1>

### Transforme código complexo em diagramas que você pode explorar.

Siga o caminho. Confira as evidências. Compartilhe um arquivo offline.

<sub>💡 Inspirado em <a href="https://github.com/Cocoon-AI/architecture-diagram-generator">Cocoon-AI/architecture-diagram-generator</a> — agradecemos pela ideia.</sub>

[English](../../README.md) · [中文](../../docs/readme/README.zh-CN.md) · [Русский](../../docs/readme/README.ru.md) · [Português](../../docs/readme/README.pt.md) · [日本語](../../docs/readme/README.ja.md) · [Deutsch](../../docs/readme/README.de.md) · [Español](../../docs/readme/README.es.md)

[Demonstração online](https://supermax92.github.io/qgraphflow/) · [Primeiros passos](#primeiros-passos) · [Instalação por cliente](#guia-de-instalação) · [Relatar problema](https://github.com/supermax92/qgraphflow/issues) · [MIT](../../LICENSE)

</div>

*Onze tipos de diagrama: arquitetura de capacidades da plataforma, arquitetura em camadas de engenharia, arquitetura de relações entre componentes, fluxograma, sequência, ER, implantação, classes, estados, casos de uso e fluxo de dados.*

QGraphFlow gera diagramas de software interativos a partir de código, esquemas, configuração e requisitos. As relações podem ser verificadas e o resultado é um HTML offline compartilhável.

**O que o diferencia:** onze tipos de diagrama em uma só habilidade, o tipo de evidência de cada relação e a linha de código por trás de cada uma que o código sustenta, layout automático, edição na própria página e nenhuma requisição de rede dos scripts do plugin nem do próprio Viewer.

![Demonstração interativa de várias vistas do Jeepay: arquitetura de relações entre componentes, sequência e ER](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/jeepay.en.hero.gif)

Com o código-fonte real do Jeepay, alterne entre diagramas de arquitetura de relações entre componentes, sequência e ER para explorar componentes e relações de chamadas. [Ver GIF no tamanho original](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/jeepay.en.hero.gif)

**Apresentação de um diagrama de sequência complexo**

![Desenho gradual de um diagrama de sequência complexo: participantes, linhas de vida, mensagens, barras de ativação e fragmentos combinados aninhados](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/checkout.en.sequence-drawing.gif)

Um cenário fictício de comércio eletrônico contém 9 participantes, 29 mensagens e 6 fragmentos combinados, com novas tentativas de estoque, ramos aninhados, processamento paralelo, compensação de falhas e callbacks assíncronos. A animação revela gradualmente o diagrama gerado para mostrar sua estrutura e seus detalhes. [Ver GIF no tamanho original](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/checkout.en.sequence-drawing.gif)

```bash
npx skills add supermax92/qgraphflow
```

Um só comando instala a habilidade para Claude Code, Codex, Cursor e Qoder; a instalação como plugin e os demais clientes estão no [guia de instalação](#guia-de-instalação).

- **Explorar:** pesquisar, ampliar e deslocar a tela; entender responsabilidades e relações de entrada e saída.

- **Verificar:** inspecionar nós e conexões para conferir arquivos, linhas, símbolos e incertezas explícitas.

- **Editar:** desbloquear o layout, alterar textos e mover elementos; redefinir quando necessário.

- **Compartilhar:** abrir o HTML offline ou exportar o diagrama completo em SVG / PNG.

O [corpus do Jeepay](../../examples/jeepay), baseado em código-fonte real, contém as onze vistas usadas pelo CI e pela demonstração online.

## Primeiros passos

Após a instalação, abra seu projeto de negócio no cliente e selecione a habilidade `q-flow`. Os exemplos usam `/q-flow` do Claude Code; no Codex, use a entrada `$q-flow` ou `$qgraphflow:q-flow` que seu cliente realmente oferece. Ainda não instalou? Consulte primeiro o [guia de instalação](#guia-de-instalação).

### 1. Entrada vazia: Não sabe por onde começar

Invoque a habilidade sem acrescentar uma solicitação:

```text
/q-flow
```

A habilidade orienta você a escolher a parte a analisar e a pergunta que o diagrama deve responder. O desenho começa quando as informações necessárias estão claras.

### 2. Perguntar sobre capacidades: Saber o que pode desenhar

```text
/q-flow Quais tipos de diagrama você pode desenhar? Que perguntas cada tipo responde? Acabei de assumir um projeto; apresente suas capacidades e sugira um ponto de partida.
```

Conheça primeiro os usos dos onze tipos de diagrama e depois decida se quer explorar a estrutura do projeto, a ordem das chamadas, as relações de dados ou outro conteúdo.

### 3. Entrada vaga: Apenas um objetivo geral

```text
/q-flow Ajude-me a desenhar este projeto. Quero entendê-lo o mais rápido possível.
```

Não é necessário indicar primeiro o tipo de diagrama. A habilidade determina uma vista adequada com base no projeto e no seu objetivo, e pergunta quando faltam informações necessárias.

### 4. Entrada precisa: Definir o escopo e pedir detalhes do desenho

Substitua os nomes de negócio e os passos abaixo por fluxos que realmente existam no seu projeto:

```text
/q-flow Analise o fluxo de criação de pedidos do projeto atual e gere um diagrama de sequência em chinês.
Inclua a entrada da solicitação, o cálculo de preços, a reserva de estoque, a autorização de pagamento e a persistência do pedido.
Mantenha as chamadas síncronas, mensagens assíncronas, retornos emparelhados, barras de ativação, ramificações condicionais, tentativas e compensações de falha que realmente existam no código. Não omita detalhes por brevidade.
Indique os arquivos e números de linha do código dos componentes e chamadas, e salve o resultado em docs/qgraphflow/order-sequence/.
```

Defina claramente o objeto, a pergunta, o nível de detalhe e o local de saída para começar diretamente. O diagrama mantém apenas fatos sustentados por evidências.

### 5. Refinar mais: Expandir parte do diagrama anterior

Após a geração do resultado, continue na mesma conversa:

```text
/q-flow Expanda a etapa de reserva de estoque do diagrama de sequência anterior em um fluxograma separado em chinês.
Mostre todos os ramos de validação do estoque, reserva bem-sucedida, falhas que permitem nova tentativa, limite de tentativas e liberação de estoque. Siga o código-fonte e não adicione etapas ausentes dele.
```

Veja primeiro o todo e depois aprofunde uma etapa. Você também pode pedir mais detalhes de um diagrama existente ou verificar suas relações.

## Guia de instalação

Você precisa do Node.js 22 ou posterior e de um cliente com suporte a plugins e acesso ao modelo configurado.

### Instalação rápida

```bash
npx skills add supermax92/qgraphflow
```

Testado com `skills` 1.7.0 no Claude Code, Codex, Cursor e Qoder. O comando pergunta em quais clientes instalar; `-a claude-code` indica um diretamente e `-g` instala para o seu usuário em vez do projeto atual. A habilidade é instalada como `q-flow`, sem o prefixo `qgraphflow:` das instalações como plugin abaixo.

Para instalar como plugin, siga as etapas abaixo. No [Qoder Desktop](#qoder-desktop), você pode instalar pelo Marketplace e pular a etapa 1.

### 1. Baixe o plugin

Obtenha o plugin no npmjs.com, sem conta, login nem token. Crie um diretório separado, fora do projeto da sua aplicação:

```bash
mkdir qgraphflow-install
cd qgraphflow-install
npm install qgraphflow --ignore-scripts
cd node_modules/qgraphflow
```

Agora você está na raiz do plugin. **Baixar pelo npm não instala automaticamente o plugin no cliente**; continue na etapa 2. O pacote também oferece o comando `qgraphflow`, usado em [Mantenha os diagramas em sincronia com o código](#mantenha-os-diagramas-em-sincronia-com-o-código).

Execute os comandos abaixo na **raiz do plugin, que contém `skills/`**.

### 2. Instale no seu cliente

#### Codex App / CLI

O Codex CLI precisa estar instalado e disponível no terminal:

```bash
codex plugin marketplace add .
codex plugin add qgraphflow@supermax92
```

Inicie uma nova sessão, digite `$` e selecione `qgraphflow:q-flow`.

#### Claude Code

```bash
claude plugin marketplace add ./
claude plugin install qgraphflow@supermax92 --scope user
```

Inicie uma nova sessão e digite `/q-flow` (ou o nome completo `/qgraphflow:q-flow`).

#### Qoder CLI

```bash
qodercli plugins install .
```

Inicie uma nova sessão e selecione `q-flow`.

#### Qoder Desktop

**Recomendado:** Abra **Settings → Plugins → Marketplace**, pesquise **QGraphFlow** ou **代码图谱可视化** e instale o plugin. Inicie uma nova sessão e selecione `q-flow`.

Para uma instalação local, conclua primeiro a etapa 1. Depois, abra **Settings → Plugins → Custom → Import** e importe o diretório raiz completo do plugin. Inicie uma nova sessão e selecione `q-flow`.

#### Cursor

Copie todo o conteúdo da raiz do plugin, incluindo os arquivos ocultos, para:

```text
~/.cursor/plugins/local/qgraphflow/
```

Confirme que `.cursor-plugin/plugin.json` existe nesse local, recarregue a janela e encontre `q-flow` em **Customize**. Se houver uma versão anterior, faça backup primeiro; não misture arquivos antigos e novos.

### 3. Comece a usar

Abra seu projeto de negócio no cliente, inicie uma nova sessão e selecione a habilidade. Descreva sua solicitação seguindo os exemplos de [Primeiros passos](#primeiros-passos). Abra o HTML gerado no navegador.

Quer compilar por conta própria? Consulte as [instruções de compilação do código-fonte](https://github.com/supermax92/qgraphflow/blob/main/docs/distribution.md#prepare-locally).

## Uso rápido

Os exemplos usam `$qgraphflow:q-flow` no Codex. Se o cliente mostrar `$q-flow`, selecione essa entrada. Nos demais clientes, use a forma de chamada da habilidade indicada acima.

**Sem saber por onde começar?** Chame a habilidade e escolha o assunto e a pergunta quando solicitado.

```text
$qgraphflow:q-flow
```

**Já tem um objetivo?** Diga qual parte deseja desenhar e o que quer entender. Não é preciso escolher o tipo de diagrama antes.

### Exemplo 1: Entender a arquitetura

```text
$qgraphflow:q-flow Analise este projeto e crie um diagrama de arquitetura em chinês com responsabilidades dos módulos, dependências e limites do sistema.
```

Útil para conhecer a estrutura geral ao entrar em um projeto.

### Exemplo 2: Acompanhar um fluxo de negócio

```text
$qgraphflow:q-flow Analise a criação de pedidos e gere um diagrama de sequência em chinês com cálculo de preços, reserva de estoque, pagamento e persistência do pedido, incluindo os ramos de falha.
```

Substitua a criação de pedidos e suas etapas pelo fluxo real do projeto. Continue na mesma conversa:

```text
$qgraphflow:q-flow Expanda a reserva de estoque do diagrama anterior em um fluxograma separado em chinês, mostrando o tratamento de sucesso e falha.
```

Os resultados ficam em `docs/qgraphflow/` por padrão. Abra `index.html` para explorar, editar e exportar; `graph.json` mantém os dados do grafo. Cada vista também é gravada como SVG (`diagram.svg`, ou `diagram-<n>-<type>.svg` quando há várias vistas), que pode ser incorporado como imagem em um README, pull request ou wiki.

Depois de editar na página, **Mais → Salvar alterações** no Chrome ou no Edge regrava a página, o `graph.json` e os SVG no lugar, depois que você escolhe a pasta do diagrama uma vez. Outros navegadores salvam só o `graph.json`: coloque-o na pasta e gere de novo a página e os SVG com `npx -y qgraphflow generate docs/qgraphflow/<name>/graph.json docs/qgraphflow/<name> --layout preserve --force`.

<details>
<summary>Executar o exemplo do Jeepay com onze vistas baseado em código-fonte</summary>

Selecione sua cópia local do código-fonte do Jeepay para verificar as evidências:

```bash
export JEEPAY_REPO_ROOT="<local Jeepay repository root>"
node skills/q-flow/scripts/validate-graph.mjs examples/jeepay/collection.graph.json --input-only --repo-root "$JEEPAY_REPO_ROOT"
node skills/q-flow/scripts/generate-viewer.mjs examples/jeepay/collection.graph.json output/jeepay --repo-root "$JEEPAY_REPO_ROOT"
```

Abra `output/jeepay/index.html`; os onze SVG estão no mesmo diretório. Consulte o [README do corpus](../../examples/jeepay) para conhecer a revisão do código-fonte e o procedimento de atualização.

</details>

## Mantenha os diagramas em sincronia com o código

Um diagrama gerado com a raiz do repositório registra onde cada componente é definido e a linha por trás de cada relação sustentada pelo código (uma chamada, uma chave estrangeira). A validação com `--repo-root` falha quando um arquivo registrado sumiu, um intervalo de linhas não cabe mais no arquivo ou um símbolo registrado saiu das suas linhas, e o erro indica as linhas em que o símbolo está agora. Adicione este job ao seu CI; ele não precisa de build, login nem token:

```yaml
name: Diagrams
on: [push, pull_request]
jobs:
  diagrams:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: '22'
      - run: |
          for graph in docs/qgraphflow/*/graph.json; do
            npx -y qgraphflow validate "$graph" --input-only --repo-root . || { echo "::error file=$graph::$graph failed validation"; failed=1; }
          done
          exit ${failed:-0}
```

Quando falhar, peça à habilidade para atualizar o diagrama:

```text
$qgraphflow:q-flow O CI diz que docs/qgraphflow/order-sequence está desatualizado. Atualize-o.
```

A habilidade move as âncoras cujo símbolo aparece uma única vez no arquivo, corrige apenas as âncoras que ainda falham e gera de novo a página e os SVG, mantendo as posições e os textos que você editou. Ela não redesenha o diagrama.

## O que cada um dos onze tipos de diagrama responde

| Vista · PNG | Pergunta principal | Escopo do exemplo |
| --- | --- | --- |
| Arquitetura de capacidades da plataforma | Quais capacidades a plataforma oferece? | Zonas de capacidades e matrizes |
| Arquitetura em camadas de engenharia | Como o código do projeto é organizado? | Camadas de engenharia e suporte compartilhado |
| Arquitetura de relações entre componentes | Quais limites de responsabilidade colaboram no sistema? | Canais, orquestração de transações, preços, risco, estoque, pagamento, pedidos, eventos e execução de pedidos |
| Fluxograma | Como cada decisão se ramifica e converge? | Falta de estoque, recusa de risco, compensação de falha de pagamento e confirmação bem-sucedida |
| Sequência | Em que ordem uma solicitação faz chamadas e recebe retornos? | Fluxo principal de compra bem-sucedida e OrderPaid assíncrono |
| ER | Como os dados centrais se relacionam? | Carrinho, pedidos, itens, pagamentos, reservas de estoque e pacotes |
| Implantação | Onde ficam as unidades de execução e como se conectam? | Borda, Kubernetes, serviços de dados, pagamento e redes de armazém e logística |
| Classes | Como objetos de domínio e contratos do código dependem entre si? | Serviço de aplicação Checkout, Order e quatro portas |
| Estados | Quais eventos e condições de guarda fazem um pedido avançar? | Pagamento, execução do pedido, cancelamento, reembolso e encerramento |
| Casos de uso | Quais capacidades cada ator possui? | Comprador, lojista, depósito e atendimento |
| Fluxo de dados | Por quais transformações e armazenamentos os ativos de dados passam? | Carrinho, decisões de transação, eventos de pedidos, armazém e logística e comprovantes de entrega |

Este modelo conceitual demonstra o QGraphFlow e não corresponde a um repositório de comércio específico. O exemplo `graph.json` não inventa caminhos de código e marca as evidências das relações como `inference`. Diagramas reais precisam de código, DDL, configuração, testes e requisitos aceitos rastreáveis.

## Desenvolvimento e contribuição

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

São necessários Node.js 22 ou posterior, npm, tar, zip e unzip. Ao relatar problemas, inclua um grafo mínimo sem informações sensíveis, versões do cliente e navegador e passos de reprodução.

Documentação de referência (em inglês): [Fontes de evidência](../../skills/q-flow/references/evidence-sources.md) · [Formato dos grafos](../../skills/q-flow/references/graph-schema.md) · [Consulta guiada](../../skills/q-flow/references/guided-intake.md) · [Desenvolvimento e aceitação do Viewer](../../skills/q-flow/references/viewer-development.md) · [Composição de diagramas](../../skills/q-flow/references/visual-contract.md)

## Licença e atribuição

[MIT](../../LICENSE) · [Avisos de terceiros](../../THIRD_PARTY_NOTICES.md)

QGraphFlow é um projeto independente sob a licença MIT. Os cenários deste documento são exemplos conceituais e não representam a arquitetura de produção de nenhuma empresa real.

## Visões gerais de arquitetura

A arquitetura agora inclui relações entre componentes, capacidades da plataforma e camadas de engenharia. Descreva o objeto e a pergunta; a habilidade escolhe o modelo. As coleções solicitadas podem conter várias vistas de arquitetura com edições independentes.

```text
$qgraphflow:q-flow Analise as capacidades da plataforma e as formas de integração de negócio do projeto atual e gere uma visão geral de capacidades da plataforma em chinês.
$qgraphflow:q-flow Analise a organização do projeto atual e suas camadas de componentes e gere visões gerais em chinês do projeto inteiro e de uma seção de um componente.
$qgraphflow:q-flow Gere uma visão geral em inglês das capacidades da plataforma deste projeto e mostre como os módulos de aplicação se integram.
```

Consulte [examples/jeepay](../../examples/jeepay) para ver as vistas de arquitetura de plataforma, engenharia e relações entre componentes baseadas em código-fonte real. Desbloqueie uma visão geral para reordenar cartões dentro de uma camada ou editar textos. Salvar mantém todas as vistas; redefinir restaura apenas a atual.
