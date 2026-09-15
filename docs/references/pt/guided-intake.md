# Consulta guiada

[English](../../../skills/q-flow/references/guided-intake.md) · [简体中文](../zh-CN/guided-intake.md) · [Русский](../ru/guided-intake.md) · [Português](guided-intake.md) · [日本語](../ja/guided-intake.md) · [Deutsch](../de/guided-intake.md) · [Español](../es/guided-intake.md)

Use apenas quando a invocação e a conversa juntas ainda não formam uma solicitação pronta. São necessários um **assunto** e a **pergunta** que o diagrama responderá. Todo o restante tem padrões e nunca é perguntado.

## Prontidão

| Item | Pronto quando | Não perguntar |
| --- | --- | --- |
| Assunto | Repositório, módulo, fluxo, conjunto de entidades ou documento nomeado no nível necessário: comportamento exige um fluxo; estado, um componente; estrutura aceita repositório ou módulo | — |
| Pergunta | O usuário diz o que deseja entender ou nomeia um tipo que implica a pergunta | — |
| Tipo | — | Derivar pela etapa 1 de Author no SKILL.md; padrão `architecture` |
| Granularidade | — | Derivar do assunto pela regra de nível; não perguntar «detalhado ou simples» |
| Diretório, idioma, quantidade de grafos, configuração CodeGraph | — | Padrões existentes; o resumo mostra o diretório para permitir alteração |

Pergunte apenas o item ausente. Comportamento com assunto de repositório/módulo está sem um fluxo: faça a busca de entradas da segunda rodada e pergunte só o fluxo. Uma solicitação recebida pela conversa também está pronta se contém ambos os itens.

## Inventário inicial

Faça antes de perguntar, para oferecer módulos reais. Limite: diretórios até profundidade 2 e presença de manifestos. Não leia código, procure entradas nem execute `codegraph explore`.

| Sinal | Arquivos ou diretórios | Habilita |
| --- | --- | --- |
| Build | `package.json`, `pom.xml`, `build.gradle*`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `*.csproj` | Módulos candidatos, linguagem e framework |
| Persistência | `migrations/`, `db/migration/`, `*.sql`, `entity/`, `model/`, mapeamentos ORM | `er` |
| Implantação | `Dockerfile`, `docker-compose*.yml`, `k8s/`, `helm/`, `charts/` | `deployment` |
| Estado | Nomes com `State`, `Status`, `Phase`, `Lifecycle` | `state` |
| Documentos | `docs/`, `requirements/`, requisitos `*.md` | `flowchart`, `usecase` |
| CodeGraph | Existe `.codegraph/` | Resumo diz «CodeGraph», não «rastreamento direto» |

Se houver mais de 8 diretórios principais, liste apenas subdiretórios com manifesto de build. Se o diretório estiver vazio, não for repositório de código ou for a instalação deste plugin, peça a localização do repositório alvo ou o documento de requisitos; não ofereça módulos.

## Opções de intenção

Escreva cada opção como a pergunta respondida pelo diagrama, com o nível exigido e uma etiqueta curta de custo. Ofereça no máximo quatro opções sustentadas pelo inventário e recomende exatamente uma: por padrão, a visão estrutural do repositório inteiro.

| Opção | `meta.diagramType` | Assunto | Custo | Oferecer quando |
| --- | --- | --- | --- | --- |
| Do que o sistema é feito e quem depende de quem | `architecture` | Repositório ou módulo | rápido | Sempre |
| Onde executa e como é implantado | `deployment` | Repositório | rápido | Sinal de implantação |
| O que é armazenado e como se relaciona | `er` | Repositório ou módulo | rápido | Sinal de persistência |
| Quais tipos existem e como se relacionam | `class` | Módulo | rápido | Sinal de build |
| Quem pode fazer o quê | `usecase` | Repositório ou módulo | rápido | Documentos ou entradas públicas |
| Quem chama quem e em que ordem | `sequence` | Um fluxo | rastreamento | Sempre |
| Quais decisões um processo toma | `flowchart` | Um fluxo | rastreamento | Sempre |
| Como os dados se movem e mudam | `dataflow` | Um fluxo | rastreamento | Sempre |
| Por quais estados algo passa | `state` | Um componente | rastreamento | Sinal de estado |

Intenções estruturais (`architecture`, `deployment`, `er`, `class`, `usecase`) leem manifestos e declarações. Intenções comportamentais (`sequence`, `flowchart`, `dataflow`, `state`) rastreiam execução e custam mais. A etiqueta informa o custo, sem alterar a recomendação.

## Nível e orçamento por vista

A unidade do nó fica um nível abaixo do assunto:

| Assunto | Unidade do nó |
| --- | --- |
| Repositório inteiro | Módulo ou serviço |
| Módulo | Componente ou classe |
| Um fluxo | Etapa ou função |
| Conjunto de entidades | Tabela |

Uma vista fica no orçamento de rotas do Viewer: cerca de 10 nós e 9 conexões. Mantenha os nós principais que respondem à pergunta e liste os omitidos em `facts` ou na nota de entrega. Aprofundar é uma chamada posterior à primeira visualização: o nó escolhido vira assunto e a saída vai para um novo `<node-scope>-<diagram-type>/`. Não pergunte sobre aprofundamento na primeira rodada.

## Perguntar

Pergunte assunto e intenção em uma única mensagem. Use a ferramenta de perguntas estruturadas do cliente, se existir; caso contrário, opções numeradas em texto. Não presuma um nome de ferramenta específico. Pergunte no idioma do usuário.

```text
Qual parte? 1 pedidos  2 pagamentos  3 estoque  4 repositório inteiro (recomendado)
O que o diagrama deve responder?
  a composição e dependências — repositório/módulo · rápido (recomendado)
  b ordem das chamadas — um fluxo · rastreamento
  c dados armazenados e relações — repositório/módulo · rápido
  d local de execução — repositório · rápido
```

Depois, **encerre o turno e aguarde a resposta**. Não presuma a escolha. Não escreva `index.html`, `graph.json` ou qualquer saída antes de concluir a rodada.

## Segunda rodada

Intenções estruturais terminam na primeira. Só há segunda rodada nestes casos; nunca uma terceira:

- **Sem assunto:** ofereça até três módulos do inventário, um recomendado.
- **Duas intenções:** adote a principal e informe que a outra pode gerar um segundo diagrama.
- **Comportamento com assunto de repositório/módulo:** busque entradas e ofereça até quatro fluxos. Use `rg -l` em nomes e anotações (`*Controller*`, `*Handler*`, `*Listener*`, `*Consumer*`, `main`, `@RestController`, `@KafkaListener`, decoradores de rotas), sem ler corpos de funções. Priorize termos já usados pelo usuário. Se ainda houver muitos, agrupe por pacote e peça escolher um; essa escolha é a segunda rodada.

«Qualquer um», «você decide» ou equivalente aceita a recomendação; declare o pressuposto no resumo.

## Resumir e começar

Uma linha, depois colete evidências sem outra confirmação. O usuário pode corrigir a qualquer momento.

```text
<tipo> · <assunto> · responde <pergunta> · <unidade do nó>, cerca de 10 · <diretório> · <CodeGraph | rastreamento direto>. Depois é possível aprofundar um nó.
```

Exemplo: `sequence · módulo de pedidos, OrderController.create · ordem de chamadas do pedido · etapas, cerca de 10 · docs/qgraphflow/order-create-sequence/ · rastreamento direto. Depois é possível ampliar uma etapa.`
