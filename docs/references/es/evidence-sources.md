# Fuentes de evidencia y alternativa a CodeGraph

[English](../../../skills/q-flow/references/evidence-sources.md) · [简体中文](../zh-CN/evidence-sources.md) · [Русский](../ru/evidence-sources.md) · [Português](../pt/evidence-sources.md) · [日本語](../ja/evidence-sources.md) · [Deutsch](../de/evidence-sources.md) · [Español](evidence-sources.md)

CodeGraph es el acelerador preferido para analizar llamadas, no una dependencia obligatoria.

## Comprobación previa de CodeGraph

La implementación prevista es [`colbymchenry/codegraph`](https://github.com/colbymchenry/codegraph), mediante su CLI local o servidor MCP.

1. Comprobar si `codegraph` está en `PATH` y si el repositorio destino contiene `.codegraph/`.
2. Si ambos existen, ejecutar `codegraph status` y una consulta acotada `codegraph explore "<question or symbols>"` antes del rastreo directo del repositorio.
3. Una herramienta MCP de CodeGraph ya configurada puede realizar la misma consulta acotada. Usar las herramientas disponibles en el cliente, sin suponer nombres específicos.
4. Si faltan la CLI, la herramienta MCP o un índice actualizado, seguir directamente con la alternativa indicada abajo. El dibujo habitual no requiere instalar ni inicializar CodeGraph, resolver versiones npm o cambiar la configuración del cliente.

## Configuración opcional cuando se solicite

1. Solo si el usuario solicita o autoriza configurar CodeGraph, resolver la versión estable exacta con `npm view @colbymchenry/codegraph version` y comprobar las instrucciones oficiales y los destinos compatibles de esa versión.
2. Antes de instalar, identificar cliente, comando y escrituras: ejecutable, configuración/instrucciones del cliente e índice `.codegraph/`. Preferir configuración local al proyecto cuando el instalador la admita. No suponer que todos usan `--target=codex` ni inventar destinos a partir de nombres de clientes.
3. Fijar la versión resuelta e inicializar solo dentro del repositorio autorizado. Si no existe integración con ese cliente, usar una CLI independiente compatible o rastreo directo; MCP no es obligatorio.
4. Verificar `codegraph status` después y usar la CLI o MCP disponible. Seguir el procedimiento de recarga/reinicio del cliente si hace falta. Si falla la resolución o instalación, informar y continuar con rastreo directo, sin probar automáticamente otro instalador.

## Orden de la alternativa

1. Usar `rg --files` y después acotar `rg` a declaraciones, entradas, llamadores, implementaciones, claves de configuración y pruebas.
2. Leer el recorrido relevante completo y conservar referencias de archivo, línea y símbolo.
3. Comprobar modelos de compilación, artefactos empaquetados, pruebas específicas y configuración de ejecución cuando cambien la conclusión.
4. Usar documentación del framework solo para su propio comportamiento; marcarla `framework`, sin atribuirla al código del repositorio.
5. Marcar vínculos no críticos sin resolver como `inference`. Omitir los vínculos no confirmados de la ruta principal que se afirma representar.

## Autoridad según el diagrama

| Diagrama | Evidencia preferida sin CodeGraph |
| --- | --- |
| Arquitectura, secuencia, clases, flujo de datos | Entradas, llamadores, interfaces, implementaciones, dependencias de compilación, clientes RPC/MQ y pruebas específicas |
| Flujo, estados, casos de uso | Requisitos aceptados y documentación API; después comportamiento de controladores/servicios y pruebas. Mostrar por separado documentación e implementación cuando difieran |
| ER | Primero DDL y migraciones; después entidades JPA, mapeos ORM/MyBatis, restricciones y pruebas del repositorio |
| Despliegue | Dockerfile, Compose, Kubernetes, Helm, configuración de servicios, políticas de red y manifiestos CI/CD |

El rastreo directo no garantiza cobertura completa de reflexión, inyección de dependencias, proxies generados, enrutamiento dinámico, RPC o mensajería. Explicar este límite y distinguir `source`, `config`, `schema`, `test`, `document`, `framework` e `inference`.
