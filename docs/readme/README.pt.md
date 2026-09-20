<div align="center">

# QGraphFlow

### Transforme código complexo em diagramas que você pode explorar.

Siga o caminho. Confira as evidências. Compartilhe um arquivo offline.

[English](../../README.md) · [中文](../../docs/readme/README.zh-CN.md) · [Русский](../../docs/readme/README.ru.md) · [Português](../../docs/readme/README.pt.md) · [日本語](../../docs/readme/README.ja.md) · [Deutsch](../../docs/readme/README.de.md) · [Español](../../docs/readme/README.es.md)

[Instalação por cliente](#guia-de-instalação) · [Relatar problema](https://github.com/supermax92/qgraphflow/issues) · [MIT](../../LICENSE)

</div>

![Arquitetura, sequência e ER do exemplo agent-desk, 1,5 segundo por vista](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.pt.hero.gif)

*Nove tipos: arquitetura, fluxograma, sequência, ER, implantação, classes, estados, casos de uso e fluxo de dados.*

QGraphFlow gera diagramas de software interativos a partir de código, esquemas, configuração e requisitos. As relações podem ser verificadas e o resultado é um HTML offline compartilhável.

- **Explorar:** pesquisar, ampliar e deslocar a tela; entender responsabilidades e relações de entrada e saída.

  ![Explorar: pesquisar refund, saltar para Ferramentas de pedidos, afastar até o orquestrador acima e o banco de pedidos e o rastreamento logístico abaixo, depois deslocar a tela](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.pt.explore.gif)

- **Verificar:** inspecionar nós e conexões para conferir arquivos, linhas, símbolos e incertezas explícitas.

  ![Verificar: cartão com src/gateway/chat-gateway.js:5-19, painel de detalhes com o símbolo e os fatos de evidência, depois a conexão POST /chat marcada como inference](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.pt.verify.gif)

- **Editar:** desbloquear o layout, alterar textos e mover elementos; redefinir quando necessário.

  ![Editar: desbloquear o layout, renomear Provedor LLM para Gateway LLM, arrastá-lo com suas conexões, depois redefinir](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.pt.edit.gif)

- **Compartilhar:** abrir o HTML offline ou exportar o diagrama completo em SVG / PNG.

  ![Compartilhar: abrir o HTML offline, exportar PNG em Mais, depois o próprio arquivo exportado](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.pt.share.gif)

A animação do topo mostra arquitetura, sequência e ER por 1,5 segundo cada (4,5 segundos por ciclo); as quatro animações de recursos duram de 6,5 a 8,5 segundos. Todas foram gravadas no Viewer construído a partir do código-fonte sobre o [exemplo agent-desk](../../examples/showcase/agent-desk) — negócio fictício, código real — com diagramas e interface em português. Estão hospedadas como [assets da Release showcase-v2](https://github.com/supermax92/qgraphflow/releases/tag/showcase-v2), fora do histórico Git e do pacote do plugin, portanto vê-las exige rede; o HTML gerado do diagrama funciona offline.

## Guia de instalação

Você precisa do Node.js 22 e de um cliente com suporte a plugins e acesso ao modelo configurado.

No [Qoder Desktop](#qoder-desktop), você pode instalar pelo Marketplace e pular a etapa 1.

### 1. Baixe o plugin

Baixe [qgraphflow-0.0.5.zip](https://github.com/supermax92/qgraphflow/releases/download/v0.0.5/qgraphflow-0.0.5.zip) e extraia em um diretório separado, preservando os arquivos ocultos.

Execute os comandos abaixo na **raiz do plugin extraído, que contém `skills/`**.

### 2. Instale no seu cliente

#### Codex App / CLI

O Codex CLI precisa estar instalado e disponível no terminal:

```bash
codex plugin marketplace add .
codex plugin add qgraphflow@supermax92
```

Inicie uma nova sessão, digite `$` e selecione `qgraphflow:q-flow`.

#### Claude Code

Instale diretamente do GitHub sem baixar o ZIP:

```bash
claude plugin marketplace add supermax92/qgraphflow
claude plugin install qgraphflow@supermax92 --scope user
```

Ou, a partir da raiz do plugin extraído:

```bash
claude plugin marketplace add .
claude plugin install qgraphflow@supermax92 --scope user
```

Inicie uma nova sessão e digite `/q-flow` (ou o nome completo `/qgraphflow:q-flow`).

#### Qoder CLI

```bash
qodercli plugins install .
```

Inicie uma nova sessão e selecione `q-flow`.

#### Qoder Desktop

**Recomendado:** Abra **Settings → Plugins → Marketplace**, pesquise **代码图谱可视化** ou **qgraphflow** e instale o plugin. Inicie uma nova sessão e selecione `q-flow`. Não é necessário baixar um ZIP nem compilar o código-fonte.

Para uma instalação local, conclua primeiro a etapa 1. Depois, abra **Settings → Plugins → Custom → Import** e importe o diretório raiz completo do plugin extraído. Inicie uma nova sessão e selecione `q-flow`.

#### Cursor

Copie todo o conteúdo da raiz do plugin, incluindo os arquivos ocultos, para:

```text
~/.cursor/plugins/local/qgraphflow/
```

Confirme que `.cursor-plugin/plugin.json` existe nesse local, recarregue a janela e encontre `q-flow` em **Customize**. Se houver uma versão anterior, faça backup primeiro; não misture arquivos antigos e novos.

### 3. Comece a usar

Abra seu projeto no cliente, inicie uma nova sessão e selecione a habilidade. Descreva a tarefa seguindo os exemplos de [Início rápido](#início-rápido) abaixo. Abra o HTML gerado no navegador.

<details>
<summary>Outra forma de instalação: GitHub npm</summary>

Você também pode obter o plugin pelo npm em vez do ZIP.

O GitHub npm exige seu próprio GitHub **Personal access token (classic)** com a permissão `read:packages`. No login, informe seu nome de usuário do GitHub e use o token como senha.

Não compartilhe o token nem o inclua em commits. Consulte a [autenticação do GitHub](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).

```bash
npm config set @supermax92:registry=https://npm.pkg.github.com --location=user
npm login --scope=@supermax92 --auth-type=legacy --registry=https://npm.pkg.github.com
```

Crie um diretório separado, fora do projeto da sua aplicação:

```bash
mkdir qgraphflow-install
cd qgraphflow-install
npm install @supermax92/qgraphflow@0.0.5 --ignore-scripts
cd node_modules/@supermax92/qgraphflow
```

Agora você está na raiz do plugin. Continue com as etapas de instalação no cliente acima. **Baixar pelo npm não instala automaticamente o plugin no cliente.**

</details>

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

São necessários Node.js 22, npm, tar, zip e unzip. Ao relatar problemas, inclua um grafo mínimo sem informações sensíveis, versões do cliente e navegador e passos de reprodução.

Documentação de referência (em inglês): [Fontes de evidência](../../skills/q-flow/references/evidence-sources.md) · [Formato dos grafos](../../skills/q-flow/references/graph-schema.md) · [Consulta guiada](../../skills/q-flow/references/guided-intake.md) · [Desenvolvimento do Viewer](../../skills/q-flow/references/viewer-development.md) · [Composição de diagramas](../../skills/q-flow/references/visual-contract.md)

## Licença e atribuição

[MIT](../../LICENSE) · [Avisos de terceiros](../../THIRD_PARTY_NOTICES.md)

QGraphFlow é um projeto independente sob a licença MIT. Os cenários deste documento são conceituais e não representam a arquitetura de produção de nenhuma empresa; não implica afiliação, patrocínio ou endosso.
