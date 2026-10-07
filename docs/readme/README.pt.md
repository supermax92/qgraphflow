<div align="center">

<h1><picture><source media="(prefers-color-scheme: dark)" srcset="../images/brand/qgraphflow-lockup-dark.svg"><img src="../images/brand/qgraphflow-lockup-light.svg" alt="QGraphFlow" height="64"></picture></h1>

### Transforme código complexo em diagramas que você pode explorar.

Siga o caminho. Confira as evidências. Compartilhe um arquivo offline.

<sub>💡 Inspirado em <a href="https://github.com/Cocoon-AI/architecture-diagram-generator">Cocoon-AI/architecture-diagram-generator</a> — agradecemos pela ideia.</sub>

[English](../../README.md) · [中文](../../docs/readme/README.zh-CN.md) · [Русский](../../docs/readme/README.ru.md) · [Português](../../docs/readme/README.pt.md) · [日本語](../../docs/readme/README.ja.md) · [Deutsch](../../docs/readme/README.de.md) · [Español](../../docs/readme/README.es.md)

[Demonstração online](https://supermax92.github.io/qgraphflow/) · [Instalação por cliente](#guia-de-instalação) · [Relatar problema](https://github.com/supermax92/qgraphflow/issues) · [MIT](../../LICENSE)

</div>

*Onze tipos: arquitetura de capacidades, arquitetura em camadas, arquitetura de componentes, fluxograma, sequência, ER, implantação, classes, estados, casos de uso e fluxo de dados.*

QGraphFlow gera diagramas de software interativos a partir de código, esquemas, configuração e requisitos. As relações podem ser verificadas e o resultado é um HTML offline compartilhável.

**O que o diferencia:** onze tipos de diagrama em uma só habilidade, o tipo de evidência de cada relação e a linha de código por trás de cada uma que o código sustenta, layout automático, edição na própria página e nenhuma requisição de rede dos scripts do plugin nem do próprio Viewer.

```bash
npx skills add supermax92/qgraphflow
```

Um só comando instala a habilidade para Claude Code, Codex, Cursor e Qoder; a instalação como plugin e os demais clientes estão no [guia de instalação](#guia-de-instalação).

- **Explorar:** pesquisar, ampliar e deslocar a tela; entender responsabilidades e relações de entrada e saída.

- **Verificar:** inspecionar nós e conexões para conferir arquivos, linhas, símbolos e incertezas explícitas.

- **Editar:** desbloquear o layout, alterar textos e mover elementos; redefinir quando necessário.

- **Compartilhar:** abrir o HTML offline ou exportar o diagrama completo em SVG / PNG.

The real-source [Jeepay corpus](../../examples/jeepay) contains all eleven views used by CI and the live demo.

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

Abra seu projeto no cliente, inicie uma nova sessão e selecione a habilidade. Descreva a tarefa seguindo os exemplos de [Início rápido](#início-rápido) abaixo. Abra o HTML gerado no navegador.

Quer compilar por conta própria? Consulte as [instruções de compilação do código-fonte](https://github.com/supermax92/qgraphflow/blob/main/docs/distribution.md#prepare-locally).

## Início rápido

Os exemplos usam `$qgraphflow:q-flow` no Codex. Se o cliente mostrar `$q-flow`, selecione essa entrada. Nos demais clientes, use a forma de chamada da habilidade indicada acima.

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

Os resultados ficam em `docs/qgraphflow/` por padrão. Abra `index.html` para explorar, editar e exportar; `graph.json` mantém os dados do grafo. Cada vista também é gravada como SVG (`diagram.svg`, ou `diagram-<n>-<type>.svg` quando há várias vistas), que pode ser incorporado como imagem em um README, pull request ou wiki.

Depois de editar na página, **Mais → Salvar alterações** no Chrome ou no Edge regrava a página, o `graph.json` e os SVG no lugar, depois que você escolhe a pasta do diagrama uma vez. Outros navegadores salvam só o `graph.json`: coloque-o na pasta e gere de novo a página e os SVG com `npx -y qgraphflow generate docs/qgraphflow/<name>/graph.json docs/qgraphflow/<name> --layout preserve --force`.

<details>
<summary>Run the eleven-view Jeepay source example</summary>

Select your Jeepay source checkout to verify the evidence:

```bash
export JEEPAY_REPO_ROOT="<local Jeepay repository root>"
node skills/q-flow/scripts/validate-graph.mjs examples/jeepay/collection.graph.json --input-only --repo-root "$JEEPAY_REPO_ROOT"
node skills/q-flow/scripts/generate-viewer.mjs examples/jeepay/collection.graph.json output/jeepay --repo-root "$JEEPAY_REPO_ROOT"
```

Open `output/jeepay/index.html`; its eleven SVGs are in the same directory. See the [corpus README](../../examples/jeepay) for the source revision and refresh procedure.

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

## O que cada uma das nove vistas responde

| Vista · PNG | Pergunta principal | Escopo do exemplo |
| --- | --- | --- |
| Arquitetura | Quais responsabilidades colaboram? | Canais, compra, preços, risco, estoque, pagamento, pedidos, eventos e entrega |
| Fluxograma | Onde o processo se ramifica e converge? | Falta de estoque, recusa de risco, compensação de pagamento e confirmação bem-sucedida |
| Sequência | Em que ordem ocorrem chamadas e retornos? | Compra bem-sucedida e OrderPaid assíncrono |
| ER | Como os dados centrais se relacionam? | Carrinho, pedidos, itens, pagamentos, reservas e pacotes |
| Implantação | Onde as unidades executam e se conectam? | Borda, Kubernetes, serviços de dados, pagamentos e redes logísticas |
| Classes | Como objetos de domínio e contratos dependem entre si? | Serviço de compra, Order e quatro portas |
| Estados | Quais eventos e condições avançam um pedido? | Pagamento, entrega, cancelamento, reembolso e encerramento |
| Casos de uso | O que cada ator pode fazer? | Comprador, lojista, depósito e atendimento |
| Fluxo de dados | Como os dados são transformados e armazenados? | Carrinho, decisões, eventos, depósito e comprovantes de entrega |

Este modelo conceitual demonstra o QGraphFlow e não corresponde a um repositório de comércio específico. O exemplo `graph.json` não inventa caminhos de código e marca as evidências das relações como `inference`. Diagramas reais precisam de código, DDL, configuração, testes e requisitos aceitos rastreáveis.

## Desenvolvimento e contribuição

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

São necessários Node.js 22 ou posterior, npm, tar, zip e unzip. Ao relatar problemas, inclua um grafo mínimo sem informações sensíveis, versões do cliente e navegador e passos de reprodução.

Documentação de referência (em inglês): [Fontes de evidência](../../skills/q-flow/references/evidence-sources.md) · [Formato dos grafos](../../skills/q-flow/references/graph-schema.md) · [Consulta guiada](../../skills/q-flow/references/guided-intake.md) · [Desenvolvimento do Viewer](../../skills/q-flow/references/viewer-development.md) · [Composição de diagramas](../../skills/q-flow/references/visual-contract.md)

## Licença e atribuição

[MIT](../../LICENSE) · [Avisos de terceiros](../../THIRD_PARTY_NOTICES.md)

QGraphFlow é um projeto independente sob a licença MIT. Os cenários deste documento são conceituais e não representam a arquitetura de produção de nenhuma empresa; não implica afiliação, patrocínio ou endosso.
