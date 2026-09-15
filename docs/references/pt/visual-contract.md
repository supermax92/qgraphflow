# Regras de composição de diagramas

[English](../../../skills/q-flow/references/visual-contract.md) · [简体中文](../zh-CN/visual-contract.md) · [Русский](../ru/visual-contract.md) · [Português](visual-contract.md) · [日本語](../ja/visual-contract.md) · [Deutsch](../de/visual-contract.md) · [Español](../es/visual-contract.md)

Use esta referência para escrever dados do grafo. A implementação do Viewer e as verificações de interação estão no [guia de desenvolvimento](viewer-development.md#viewer-visual-and-interaction-contract).

- A primeira vista deve responder à pergunta solicitada. Use um caminho claro, nomes reais de componentes/responsabilidades e ações, mensagens ou dados nas conexões. Mantenha limites atrás dos nós e rótulos longe dos títulos dos grupos.
- Destaque o centro de negócio real com um `kind` válido `business` ou uma tag `core`/`business`. O Viewer fornece superfícies neutras frias Slate, Iris para centro/interação, Cyan para dados e Orange para decisões/falhas. Componentes comuns ficam neutros; não acrescente campos de cor nem invente o tipo `core`.
- Cor complementa nomes e notação. Reutilizar o mesmo `module` não vazio entre vistas permite tonalidade do nó inteiro, contorno, faixa e cor de conexões comuns estáveis. A cor não substitui formas, nomes, símbolos ou estilos de evidência; não forneça cores literais. Conexões de framework/inferência mantêm tracejado, salvo exigência da notação. Preserve protocolos, multiplicidades, guardas e âncoras exatas.
- Dimensione cada caixa e corredor para o texto completo. Ampliar tudo uniformemente perde a vantagem ao ajustar à tela. Siga dimensões, faixas automáticas, folgas e dicas de rota do [formato dos dados](graph-schema.md#routing-and-spacing). Mova nós antes de adicionar dicas; nenhuma rota pode atravessar o interior de um nó.
- Ao abrir, redefinir, trocar de vista ou entrar em tela cheia, o Viewer ajusta o diagrama inteiro. Escala todo o desenho sem ocultar campos, membros, subtítulos ou outros textos em zoom baixo. Zoom, deslocamento e minimapa permitem ver detalhes. SVG/PNG exportam o diagrama completo; os dados devem preservar todo o conteúdo.
- Crie a partir das evidências do próprio domínio solicitado. Modelos, fatos e caminhos de prévia são apenas exemplos.

## Notação por tipo

Leia a linha do tipo escolhido; os tipos legais e campos obrigatórios estão no formato dos dados.

| Tipo | Composição e rotas |
| --- | --- |
| Arquitetura | Entradas → responsabilidades centrais → colaboradores; limites explícitos de propriedade/execução. Separar ramificações e convergências entre camadas. |
| Fluxograma | Início/fim em cápsula, processos, losangos de decisão, entrada/saída e subprocessos. Corredores distintos para sucesso e alternativas. |
| Sequência | Participantes/atores alinhados, linhas de vida, mensagens numeradas, retornos tracejados e quadros `alt`/`opt`/`loop`. Autochamadas fora das linhas de vida; rótulos multilinha longe das faixas vizinhas; callbacks assíncronos não são esperas síncronas. |
| ER | Cabeçalhos de entidade, campos PK/FK/UK completos e cardinalidades nas duas pontas. Separar múltiplas relações e reservar espaço dos símbolos. |
| Implantação | Dispositivos, nós, contêineres e artefatos dentro de limites de host/cluster/rede. Mostrar posição física e manter rótulos entre contêineres livres. |
| Classes | Nome/estereótipo, atributos e métodos; separar triângulos de herança, losangos de composição/agregação e multiplicidades. |
| Estados | Ponto inicial, círculo duplo final, estados, escolhas e transições com guardas. Separar falhas/cancelamentos, transições paralelas e autolaços. |
| Casos de uso | Atores, capacidades elípticas e limite do sistema. Distinguir associações dos atores e ligações rotuladas `include`/`extend`. |
| Fluxo de dados | Entidades externas, processos e depósitos. Nomear a informação de cada fluxo dirigido e separar corredores compartilhados de produtores/consumidores. |

Para uma coleção solicitada, use o mesmo vocabulário de domínio verificado e a ordem canônica dos nove tipos. Valide a coleção inteira antes da geração. Uma falha em uma vista bloqueia a entrega da coleção.
