# Consulta guiada

[English](../../../skills/q-flow/references/guided-intake.md) · [简体中文](../zh-CN/guided-intake.md) · [Русский](../ru/guided-intake.md) · [Português](../pt/guided-intake.md) · [日本語](../ja/guided-intake.md) · [Deutsch](../de/guided-intake.md) · [Español](guided-intake.md)

Usar solo si la invocación y la conversación juntas no aportan una solicitud lista. Son necesarios un **tema** y la **pregunta** que responderá el diagrama. Todo lo demás tiene valores predeterminados y no se pregunta.

## Preparación

| Elemento | Listo cuando | No preguntar |
| --- | --- | --- |
| Tema | Se identifica repositorio, módulo, flujo, conjunto de entidades o documento al nivel necesario: comportamiento requiere un flujo, estado un componente; estructura admite repositorio o módulo | — |
| Pregunta | El usuario indica qué quiere entender o nombra un tipo que lo implica | — |
| Tipo | — | Derivar según SKILL.md, Author paso 1; predeterminado `architecture` |
| Granularidad | — | Derivar del tema con la regla de nivel; no preguntar «detallado o simple» |
| Directorio, idioma, cantidad de gráficos, configuración CodeGraph | — | Valores existentes; mostrar el directorio en el resumen para permitir cambios |

Preguntar únicamente lo que falta. Si una pregunta de comportamiento solo tiene repositorio o módulo, falta el flujo: realizar la búsqueda de entradas de la segunda ronda y preguntar solo por él. Una solicitud llegada por la conversación también está lista si contiene ambos elementos.

## Inventario inicial

Hacerlo antes de preguntar para ofrecer módulos reales. Límite: directorios hasta profundidad 2 y presencia de manifiestos. No leer código, buscar entradas ni ejecutar `codegraph explore`.

| Señal | Archivos o directorios | Habilita |
| --- | --- | --- |
| Compilación | `package.json`, `pom.xml`, `build.gradle*`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `*.csproj` | Módulos candidatos, lenguaje y framework |
| Persistencia | `migrations/`, `db/migration/`, `*.sql`, `entity/`, `model/`, mapeos ORM | `er` |
| Despliegue | `Dockerfile`, `docker-compose*.yml`, `k8s/`, `helm/`, `charts/` | `deployment` |
| Estado | Nombres con `State`, `Status`, `Phase`, `Lifecycle` | `state` |
| Documentos | `docs/`, `requirements/`, requisitos `*.md` | `flowchart`, `usecase` |
| CodeGraph | Existe `.codegraph/` | El resumen dice «CodeGraph», no «rastreo directo» |

Si hay más de 8 directorios principales, listar solo subdirectorios con manifiesto de compilación. Si el directorio está vacío, no es un repositorio de código o es la instalación de este plugin, pedir la ruta del repositorio destino o el documento de requisitos y no ofrecer módulos.

## Opciones de intención

Formular cada opción como una pregunta que resuelve el diagrama, con nivel del tema y una etiqueta breve de coste. Máximo cuatro opciones respaldadas por el inventario; recomendar exactamente una, por defecto la visión estructural de todo el repositorio.

| Opción | `meta.diagramType` | Necesita | Coste | Ofrecer cuando |
| --- | --- | --- | --- | --- |
| De qué se compone el sistema y quién depende de quién | `architecture` | Repositorio o módulo | rápido | Siempre |
| Dónde ejecuta y cómo se despliega | `deployment` | Repositorio | rápido | Señal de despliegue |
| Qué se almacena y cómo se relaciona | `er` | Repositorio o módulo | rápido | Señal de persistencia |
| Qué tipos existen y cómo se relacionan | `class` | Módulo | rápido | Señal de compilación |
| Quién puede hacer qué | `usecase` | Repositorio o módulo | rápido | Documentos o entradas públicas |
| Quién llama a quién y en qué orden | `sequence` | Un flujo | rastreo | Siempre |
| Qué decisiones toma un proceso | `flowchart` | Un flujo | rastreo | Siempre |
| Cómo se mueven y cambian los datos | `dataflow` | Un flujo | rastreo | Siempre |
| Por qué estados pasa algo | `state` | Un componente | rastreo | Señal de estado |

Las intenciones estructurales (`architecture`, `deployment`, `er`, `class`, `usecase`) leen manifiestos y declaraciones. Las de comportamiento (`sequence`, `flowchart`, `dataflow`, `state`) rastrean ejecución y cuestan más. La etiqueta informa del coste, sin cambiar la recomendación.

## Regla de nivel y presupuesto

El nodo está un nivel por debajo del tema:

| Tema | Unidad de nodo |
| --- | --- |
| Repositorio completo | Módulo o servicio |
| Módulo | Componente o clase |
| Un flujo | Paso o función |
| Conjunto de entidades | Tabla |

Una vista se mantiene en el presupuesto de rutas del Viewer: unos 10 nodos y 9 conexiones. Conservar los principales que responden la pregunta y mencionar los omitidos en `facts` o la entrega. Profundizar es una petición posterior a ver el primer diagrama: usar el nodo elegido como tema y escribir en un nuevo `<node-scope>-<diagram-type>/`. No preguntar por profundización en la primera ronda.

## Preguntar

Una sola pregunta combina tema e intención. Usar la herramienta de preguntas estructuradas del cliente si existe; si no, opciones numeradas. No asumir un nombre específico de herramienta. Preguntar en el idioma del usuario.

```text
¿Qué parte? 1 pedidos  2 pagos  3 inventario  4 repositorio completo (recomendado)
¿Qué debe responder el diagrama?
  a composición y dependencias — repositorio/módulo · rápido (recomendado)
  b orden de llamadas — un flujo · rastreo
  c datos almacenados y relaciones — repositorio/módulo · rápido
  d ubicación de ejecución — repositorio · rápido
```

Después, **terminar el turno y esperar la respuesta**. No suponer una elección. No escribir `index.html`, `graph.json` ni otra salida antes de completar la ronda.

## Segunda ronda

Las intenciones estructurales terminan en la primera. Solo hay segunda ronda en estos casos; nunca una tercera:

- **Sin tema:** ofrecer como máximo tres módulos del inventario, uno recomendado.
- **Dos intenciones:** elegir la principal y señalar que la otra puede ser un segundo diagrama.
- **Comportamiento con tema de repositorio/módulo:** buscar entradas y ofrecer hasta cuatro flujos. Usar `rg -l` sobre nombres y anotaciones (`*Controller*`, `*Handler*`, `*Listener*`, `*Consumer*`, `main`, `@RestController`, `@KafkaListener`, decoradores de rutas), sin leer cuerpos de funciones. Priorizar palabras ya usadas por el usuario. Si siguen siendo demasiados, agrupar por paquete y pedir elegir uno; esa elección es la segunda ronda.

«Cualquiera», «tú decides» o equivalente acepta la recomendación; indicar el supuesto en el resumen.

## Resumir y comenzar

Una línea y luego recopilar evidencias sin nueva confirmación. El usuario puede corregir en cualquier momento.

```text
<tipo> · <tema> · responde <pregunta> · <unidad de nodo>, unos 10 · <directorio> · <CodeGraph | rastreo directo>. Después se puede profundizar en un nodo.
```

Ejemplo: `sequence · módulo de pedidos, OrderController.create · orden de llamadas al pedir · pasos, unos 10 · docs/qgraphflow/order-create-sequence/ · rastreo directo. Después se puede ampliar un paso.`
