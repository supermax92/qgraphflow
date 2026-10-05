# Guia de instalação

[English](clients.md) · [中文](clients.zh-CN.md) · [Русский](clients.ru.md) · [Português](clients.pt.md) · [日本語](clients.ja.md) · [Deutsch](clients.de.md) · [Español](clients.es.md)

[Voltar ao README](readme/README.pt.md)

O Qoder Desktop pode instalar o plugin pelo Marketplace e pular a etapa 1 (veja a seção correspondente abaixo). Os demais clientes instalam o pacote do plugin obtido no npmjs.com.

Você precisa de Node.js 22 ou posterior (com npm) e de um cliente com acesso ao modelo configurado.

## Instalação rápida

```bash
npx skills add supermax92/qgraphflow
```

Instala a habilidade `q-flow` no Claude Code, Codex, Cursor e Qoder (testado com `skills` 1.7.0) e pergunta em quais clientes instalar. Para instalar o plugin, siga as etapas abaixo.

## 1. Baixar o plugin pelo npm

```bash
mkdir qgraphflow-install
cd qgraphflow-install
npm install qgraphflow --ignore-scripts
cd node_modules/qgraphflow
```

Crie o diretório fora do projeto da sua aplicação; não é preciso conta, login nem token. Agora você está na raiz do plugin. Baixar pelo npm não instala o plugin no cliente; continue na etapa 2. Para instalar código ainda não lançado, consulte as [instruções de compilação a partir do código-fonte](https://github.com/supermax92/qgraphflow/blob/main/docs/distribution.md#prepare-locally).

## 2. Instalar no cliente

Execute os comandos abaixo na raiz do plugin aberta na etapa 1 (`qgraphflow-install/node_modules/qgraphflow`), não no diretório do seu próprio projeto.

### Codex App / CLI

```bash
codex plugin marketplace add .
codex plugin add qgraphflow@supermax92
```

Aqui, `marketplace add` apenas registra uma fonte de instalação local; não exige publicação em um marketplace público. Consulte a [documentação oficial da OpenAI](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli).

Inicie uma nova sessão, digite `$` e selecione `qgraphflow:q-flow` (use o nome exibido pelo seu cliente).

### Claude Code

```bash
claude plugin marketplace add .
claude plugin install qgraphflow@supermax92 --scope user
```

Inicie uma nova sessão e digite `/q-flow` (ou o nome completo `/qgraphflow:q-flow`).

### Qoder CLI

```bash
qodercli plugins install .
```

Inicie uma nova sessão e selecione `q-flow`.

### Qoder Desktop

**Recomendado:** Abra **Settings → Plugins → Marketplace**, pesquise **QGraphFlow** ou **代码图谱可视化** e instale o plugin. Inicie uma nova sessão e selecione `q-flow`.

Para uma instalação local, conclua primeiro a etapa 1. Depois, abra **Settings → Plugins → Custom → Import** e importe o diretório raiz completo do plugin. Recarregue o cliente e selecione `q-flow`.

### Cursor

Copie todo o conteúdo da raiz do plugin, incluindo arquivos ocultos, para `~/.cursor/plugins/local/qgraphflow/`. Se o diretório já existir, faça um backup antes; não misture arquivos antigos e novos.

Confirme que o manifesto está em `~/.cursor/plugins/local/qgraphflow/.cursor-plugin/plugin.json`. Recarregue a janela e selecione `q-flow` em Customize → Plugins / Skills.

Esse método local foi testado no Cursor 3.19.13. Em outras versões, confirme que o plugin e a habilidade aparecem.
