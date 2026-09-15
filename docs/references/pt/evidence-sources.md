# Fontes de evidência e alternativa ao CodeGraph

[English](../../../skills/q-flow/references/evidence-sources.md) · [简体中文](../zh-CN/evidence-sources.md) · [Русский](../ru/evidence-sources.md) · [Português](evidence-sources.md) · [日本語](../ja/evidence-sources.md) · [Deutsch](../de/evidence-sources.md) · [Español](../es/evidence-sources.md)

CodeGraph é o acelerador preferido para analisar chamadas, não uma dependência obrigatória.

## Verificação prévia do CodeGraph

A implementação prevista é [`colbymchenry/codegraph`](https://github.com/colbymchenry/codegraph), pela CLI local ou servidor MCP.

1. Verificar se `codegraph` está no `PATH` e se o repositório de destino contém `.codegraph/`.
2. Se ambos existirem, executar `codegraph status` e uma consulta limitada `codegraph explore "<question or symbols>"` antes do rastreamento direto do repositório.
3. Uma ferramenta MCP do CodeGraph já configurada pode fazer a mesma consulta limitada. Usar as ferramentas realmente disponíveis no cliente; não presumir nomes específicos.
4. Se a CLI, a ferramenta MCP ou o índice atualizado não estiverem disponíveis, seguir diretamente com a alternativa abaixo. A criação normal de diagramas não exige instalar/inicializar CodeGraph, resolver versões npm ou alterar configurações do cliente.

## Configuração opcional quando solicitada

1. Somente se o usuário solicitar ou autorizar, resolver a versão estável exata com `npm view @colbymchenry/codegraph version` e verificar as instruções oficiais e os destinos suportados dessa versão.
2. Antes da instalação, identificar cliente, comando e locais de escrita: executável, configuração/instruções do cliente e índice `.codegraph/`. Preferir configuração local ao projeto quando suportada. Não presumir que todos usam `--target=codex` nem inventar destinos a partir de nomes de clientes.
3. Fixar a versão resolvida. Inicializar apenas no repositório autorizado. Se não houver integração com o cliente, usar uma CLI independente suportada ou rastreamento direto; MCP não é obrigatório.
4. Verificar `codegraph status` depois e usar a CLI ou MCP disponível. Seguir o procedimento de recarga/reinício do cliente quando necessário. Se a resolução ou instalação falhar, informar e continuar com rastreamento direto, sem tentar outro instalador automaticamente.

## Ordem da alternativa

1. Usar `rg --files` e depois limitar `rg` a declarações, entradas, chamadores, implementações, chaves de configuração e testes.
2. Ler o caminho relevante completo, preservando âncoras de arquivo, linha e símbolo.
3. Verificar modelos de build, artefatos empacotados, testes específicos e configuração de execução quando afetarem a conclusão.
4. Usar documentação do framework apenas para comportamento de sua responsabilidade; marcar como `framework`, sem atribuir ao código do repositório.
5. Marcar vínculos não críticos ainda incertos como `inference`. Omitir vínculos não confirmados do caminho principal que se afirma representar.

## Autoridade por diagrama

| Diagrama | Evidência preferida sem CodeGraph |
| --- | --- |
| Arquitetura, sequência, classes, fluxo de dados | Entradas, chamadores, interfaces, implementações, dependências de build, clientes RPC/MQ e testes específicos |
| Fluxograma, estados, casos de uso | Requisitos aceitos e documentos de API; depois comportamento de controladores/serviços e testes. Mostrar documentação e implementação separadamente se divergirem |
| ER | Primeiro DDL e migrações; depois entidades JPA, mapeamentos ORM/MyBatis, restrições e testes do repositório |
| Implantação | Dockerfile, Compose, Kubernetes, Helm, configuração de serviços, políticas de rede e manifestos CI/CD |

O rastreamento direto não garante cobertura completa de reflexão, injeção de dependências, proxies gerados, roteamento dinâmico, RPC ou mensageria. Informar esse limite e distinguir `source`, `config`, `schema`, `test`, `document`, `framework` e `inference`.
