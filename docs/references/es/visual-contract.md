# Reglas de composición de diagramas

[English](../../../skills/q-flow/references/visual-contract.md) · [简体中文](../zh-CN/visual-contract.md) · [Русский](../ru/visual-contract.md) · [Português](../pt/visual-contract.md) · [日本語](../ja/visual-contract.md) · [Deutsch](../de/visual-contract.md) · [Español](visual-contract.md)

Usar esta referencia para escribir datos del grafo. La implementación del Viewer y las pruebas de interacción están en la [guía de desarrollo](viewer-development.md#viewer-visual-and-interaction-contract).

- La primera vista debe responder a la pregunta solicitada. Usar un camino claro, nombres reales de componentes/responsabilidades y acciones, mensajes o datos en las conexiones. Mantener los límites detrás de los nodos y las etiquetas lejos de los títulos de grupo.
- Resaltar el centro de negocio real con un `kind` válido `business` o una etiqueta `core`/`business`. El Viewer aporta superficies neutras frías Slate, Iris para centro/interacción, Cyan para datos y Orange para decisiones/fallos. Mantener neutros los componentes ordinarios; no añadir campos de color ni inventar el tipo `core`.
- El color complementa nombres y notación. Reutilizar el mismo `module` no vacío entre vistas permite tintes completos, contornos, franjas y colores de conexiones ordinarias estables. El color no sustituye formas, nombres, símbolos ni estilos de evidencia; no escribir colores literales. Las relaciones de framework/inferencia conservan líneas discontinuas salvo exigencia de la notación. Preservar protocolos, multiplicidades, condiciones y referencias de origen exactos.
- Dimensionar cada caja y corredor para el texto completo. Agrandar todo uniformemente pierde su ventaja al ajustar a la pantalla. Seguir dimensiones, carriles automáticos, holguras y pistas de ruta del [formato de datos](graph-schema.md#routing-and-spacing). Mover nodos antes de añadir pistas; ninguna ruta puede atravesar un nodo.
- Al abrir, restablecer, cambiar de vista o entrar en pantalla completa, el Viewer ajusta el diagrama entero. Escala todo el dibujo sin ocultar campos, miembros, subtítulos ni otros textos al reducir el zoom. Usar zoom, desplazamiento y minimapa para el detalle. SVG/PNG exportan el diagrama completo; conservar todo el contenido en los datos.
- Crear desde las evidencias del dominio solicitado. Los modelos, hechos y rutas de vista previa son solo ejemplos.

## Notación por tipo

Leer la fila correspondiente; los tipos legales y campos obligatorios están en el formato de datos.

| Tipo | Composición y rutas |
| --- | --- |
| Arquitectura | Entradas → responsabilidades centrales → colaboradores; límites explícitos de propiedad/ejecución. Separar bifurcaciones y convergencias entre capas. |
| Flujo | Inicio/fin en cápsula, procesos, rombos de decisión, entrada/salida y subprocesos. Corredores separados para éxito y alternativas. |
| Secuencia | Participantes/actores alineados, líneas de vida, mensajes numerados, retornos discontinuos y marcos `alt`/`opt`/`loop`. Autollamadas fuera de la línea de vida; etiquetas multilínea alejadas de carriles vecinos; no representar callbacks asíncronos como esperas síncronas. |
| ER | Cabeceras de entidad, campos PK/FK/UK completos y cardinalidad en ambos extremos. Separar relaciones múltiples y reservar espacio para símbolos. |
| Despliegue | Dispositivos, nodos, contenedores y artefactos dentro de límites de host/clúster/red. Mostrar ubicación física y despejar etiquetas entre contenedores. |
| Clases | Nombre/estereotipo, atributos y métodos; separar triángulos de herencia, rombos de composición/agregación y multiplicidades. |
| Estados | Punto inicial, círculo doble final, estados, elecciones y transiciones con condiciones. Separar fallos/cancelaciones, transiciones paralelas y bucles propios. |
| Casos de uso | Actores, capacidades elípticas y límite del sistema. Distinguir asociaciones de actores y enlaces `include`/`extend` etiquetados. |
| Flujo de datos | Entidades externas, procesos y almacenes. Nombrar la información de cada flujo dirigido y separar corredores compartidos de productores/consumidores. |

Para una colección solicitada, usar el mismo vocabulario de dominio verificado y el orden canónico de los nueve tipos. Validar la colección completa antes de generarla. Un fallo en una vista bloquea la entrega de la colección.
