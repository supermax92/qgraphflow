# Guia de instalação

[English](clients.md) · [中文](clients.zh-CN.md) · [Русский](clients.ru.md) · [Português](clients.pt.md) · [日本語](clients.ja.md) · [Deutsch](clients.de.md) · [Español](clients.es.md)

[Voltar ao README](readme/README.pt.md)

O Claude Code pode instalar o plugin diretamente do GitHub (veja a seção Claude Code abaixo). Para os demais clientes, primeiro baixe o código-fonte do QGraphFlow, gere o pacote de execução e instale-o no seu cliente.

Você precisa de Node.js 22, Git, npm, `tar`, `zip`, `unzip` e um cliente com acesso ao modelo configurado.

## 1. Baixar e gerar o pacote

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
npm run package
unzip -q dist/qgraphflow-0.0.4.zip -d dist/runtime
```

Se já tiver o código-fonte do QGraphFlow, pule a clonagem e entre no diretório raiz dele. Ajuste o nome do ZIP à versão no `package.json` do QGraphFlow. Use novos diretórios para gerar e extrair o pacote, sem sobrescrever arquivos existentes. O Git baixa apenas o código enviado ao repositório, não as alterações locais sem commit.

## 2. Instalar no cliente

Execute os comandos abaixo na raiz do código-fonte do QGraphFlow, não no diretório do seu próprio projeto. Eles instalam o pacote completo da subpasta `dist/runtime`.

### Codex App / CLI

```bash
codex plugin marketplace add ./dist/runtime
codex plugin add qgraphflow@supermax92
```

Aqui, `marketplace add` apenas registra uma fonte de instalação local; não exige publicação em um marketplace público. Consulte a [documentação oficial da OpenAI](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli).

Inicie uma nova sessão, digite `$` e selecione `qgraphflow:q-flow` (use o nome exibido pelo seu cliente).

### Claude Code

Instale diretamente do GitHub, sem o passo 1:

```bash
claude plugin marketplace add supermax92/qgraphflow
claude plugin install qgraphflow@supermax92 --scope user
```

Ou a partir do pacote de execução gerado no passo 1:

```bash
claude plugin marketplace add ./dist/runtime
claude plugin install qgraphflow@supermax92 --scope user
```

Inicie uma nova sessão e digite `/q-flow` (ou o nome completo `/qgraphflow:q-flow`).

### Qoder CLI

```bash
qodercli plugins install ./dist/runtime
```

Inicie uma nova sessão e selecione `q-flow`.

### Qoder IDE

Abra Settings → Plugins → Import e importe o diretório completo `dist/runtime`. Recarregue o cliente e selecione `q-flow`.

### Cursor

Copie todo o conteúdo de `dist/runtime`, incluindo arquivos ocultos, para `~/.cursor/plugins/local/qgraphflow/`. Se o diretório já existir, faça um backup antes; não misture arquivos antigos e novos.

Confirme que o manifesto está em `~/.cursor/plugins/local/qgraphflow/.cursor-plugin/plugin.json`. Recarregue a janela e selecione `q-flow` em Customize → Plugins / Skills.

Esse método local foi testado no Cursor 3.19.13. Em outras versões, confirme que o plugin e a habilidade aparecem.
