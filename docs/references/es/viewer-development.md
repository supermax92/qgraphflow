# Desarrollo y mantenimiento del visor

[English](../../../skills/q-flow/references/viewer-development.md) · [简体中文](../zh-CN/viewer-development.md) · [Русский](../ru/viewer-development.md) · [Português](../pt/viewer-development.md) · [日本語](../ja/viewer-development.md) · [Deutsch](../de/viewer-development.md) · [Español](viewer-development.md)

Los módulos se componen durante la compilación. Tras modificar y compilar el código, el generador integra todas las funciones en HTML independiente. No hay descarga de plugins ni carga en caliente durante la ejecución. La generación normal sigue produciendo solo `index.html` y `graph.json`.

## Puntos de cambio

Rutas relativas a `assets/viewer/src/`:

| Objetivo | Entrada | Responsabilidad |
| --- | --- | --- |
| Añadir un tipo | `diagrams/<type>.js`, `diagrams/registry.js` | Nombres, orden, tipos permitidos, validación, dibujo, contornos y política de relaciones |
| Tema, tamaños o interlineado | `visual-style.js`, `radix-colors.js` | Escalas Radix, variables, semántica, reconocimiento del núcleo y dimensiones compartidas por página/exportación |
| Formas o distribución interna | `diagrams/<type>.js`; tarjetas comunes en `diagrams/card.js` | Nodos de página y SVG/PNG |
| Tipografía SVG y primitivas | `diagrams/drawing.js` | `svgStyles()`, escape y primitivas, con ámbito de página y reutilización en exportación |
| Barra, detalles, estructura adaptable | `ViewerShell.jsx`, `styles.css` | Estructura de página, sin segunda implementación HTML/CSS de los nodos |
| Resplandor | `effects.css`, importado por `main.jsx` después de `styles.css` | Efectos de rol, selección, flujo y viñeta oscura; solo variables de paleta, eliminable como archivo, desactivado con menor transparencia/mayor contraste |
| Selección y búsqueda | `features/useSelection.js`, `search.js` | Selección, respuesta, teclado y cierre; clasificación de búsqueda comprobable por separado |
| Movimiento dirigido | `features/useViewerController.js`, `DiagramCanvas.jsx` | Solo dirección, controlada por su interruptor y movimiento reducido |
| Leyenda | `ViewerShell.jsx`, `styles.css`; contenido de `legend.js`, `visual-style.js` | Ventana flotante según categorías/líneas reales; símbolos originales, `nodeAppearance` y prioridad del núcleo |
| Paneles y foco | `features/usePanels.js` | Exclusión móvil, visibilidad y retorno del foco; conservar preferencia al cambiar vista |
| Pantalla completa | `features/useFullscreen.js`, `features/useSelection.js` | API nativa, errores y foco; seleccionar no abre un inspector externo, Escape sale primero de pantalla completa |
| Arrastre, vista, bloqueo, separación | `features/useGraphLayout.js`, `layout-nudge.js` | Posiciones actuales y operaciones; D3 sigue siendo un ajuste acotado |
| Estado de presentación | `features/usePresentation.js` | Proyectar selección/búsqueda sobre nodos y aristas, sin duplicar el propietario del estado |
| Descargas | `features/download.js`, `export-svg.js` | SVG estático desde coordenadas actuales; PNG rasterizado desde ese SVG |
| Rutas y validación de diseño | `edge-routing.js`, `text-layout.js` | Rutas, ajuste y medidas compartidos por página, exportación y validación |

`main.jsx` controla carga, cambio de vista, tema y borradores por vista. `features/useViewerController.js` combina funciones y coordina guardar/restablecer; `ViewerShell.jsx` enlaza la UI. Amplía primero el módulo existente; crea un Hook solo para estado y ciclo de vida independientes.

## Añadir un tipo de diagrama

1. Añade a `diagrams/` un módulo con definición exportada por defecto.
2. Impórtalo en `diagrams/registry.js` y agrégalo a `DIAGRAMS`. Su orden determina el menú de colección; los grafos únicos no tienen menú.
3. Actualiza `graph-schema.md`, `visual-contract.md` y la autoría en SKILL. Registrar no exige necesariamente modificar la estructura de datos.
4. Compila, genera ejemplos y verifica nodos, relaciones e interacciones específicas.

Reutiliza reglas y primitivas. Una tarjeta que hereda todas las reglas de arquitectura solo requiere `{ ...architecture, id: 'new-view', label: 'New view' }` y registro. Un tipo independiente suele contener:

```js
export default {
  id: 'new-view', label: 'New view',
  nodeKinds: ['component'], groupKinds: [], edgeKinds: ['call'],
  outline, // (node, x, y) => [[nombre de etiqueta SVG, atributos geométricos], ...]
  render,  // (node, x, y, fill, stroke, palette) => cadena SVG
};
```

`render` pinta el cuerpo con `paint(outline(node, x, y), { fill, stroke })` y texto con `text` / `centeredTitle`. El código del módulo es fiable; los datos no. Nunca concatentes entradas en etiquetas, atributos o texto SVG sin el escape compartido.

Añade hooks opcionales solo cuando hagan falta:

- `validateNode`, `validateEdge`: restricciones después de las comunes; reutiliza `requireString`, `validateStringArray`, etc. Cada validación crea un conjunto nuevo de órdenes de secuencia.
- `edgeLabel`, `undirected`, `dashedKinds`, `markers`: etiquetas, dirección, trazos de notación adicionales a evidencia y marcadores UML existentes.
- `cardLayout`, `compartments`, `sequence`, `cardinalities`, `endpointStub`, `selectionHeight`: comprobaciones de tarjeta, compartimentos del núcleo, líneas de vida, extremos ER y altura de selección.

Las tarjetas rectangulares reutilizan reglas existentes. Nuevas rutas, conexiones o símbolos UML requieren ampliar trazado/dibujo compartido: el registro no deduce geometría desconocida. Añade nombres y clasificación `nodeAppearance` de nuevas semánticas a `visual-style.js`. Conserva el aviso MIT de Radix de `radix-colors.js` en HTML y SVG.

## Restricciones de representación compartida

`DiagramCanvas.jsx` y `export-svg.js` llaman a `renderNode()` de `node-svg.js`. La página inserta SVG en nodos React Flow; la exportación pasa un desplazamiento al mismo dibujante. `SelectionOutline.jsx` llama a `renderSelection()` y reutiliza `outline`, cambiando solo trazo, opacidad y sombra.

Separa posición, contenido e interacción temporal. Arrastrar cambia coordenadas; seleccionar no cambia coordenadas ni formas. Exporta solo grafo actual y tema, sin selección/animación. Límites, adaptación de marcadores React Flow y controles conservan representación específica del entorno; compartir nodos no implica DOM y SVG idénticos.

## Compilación y regresión

Desde el directorio del skill, con dependencias y navegador existentes:

```bash
npm --prefix assets/viewer run build
node --test scripts/*.test.mjs
node scripts/generate-viewer.mjs /tmp/graph.json /tmp/new-viewer
node scripts/browser-interactions.mjs /tmp/new-viewer /tmp/new-viewer-check
```

El botón inferior izquierdo pone el lienzo en pantalla completa nativa; paneles y barra quedan fuera. Tras cambiar dimensiones, ajusta una vez sin cambiar selección/diseño; al salir conserva la vista. La diana ajusta, las cuatro esquinas alternan pantalla completa. Regenera HTML antiguos. Si no se admite, marca el control como no disponible; anuncia fallos en el estado del lienzo.

La aceptación usa API reales. `QA_HEADED=1` abre una ventana para comprobar pantalla completa, Escape y foco:

```bash
QA_HEADED=1 QA_ONLY_EXTRAS=1 QA_EXTRAS=fullscreen,fullscreen-errors \
node scripts/browser-interactions.mjs /tmp/new-viewer /tmp/fullscreen-check
```

El script comprueba cada tipo suministrado en tres tamaños, temas claro/oscuro e interacciones. Usa una colección de nueve tipos para la matriz completa. `QA_FIXTURE_DIR` añade casos de formas especiales. Se necesitan módulos de código adyacentes; el script no es autónomo.

Los detalles siguen al usuario: `useSelection` posee la selección, `useViewerController` deriva `inspectedNode` y la vista rápida/inspector de `ViewerShell` lo consumen. Sin reproducción, lectura por pasos ni orquestación. Leyenda flotante arriba a la izquierda; `.inspector-facts` al final. `has-flow` de `DiagramCanvas` y `styles.css` controlan el contraste estático durante el flujo; la selección no puede rellenar huecos de los trazos móviles.

```bash
QA_ONLY_EXTRAS=1 QA_EXTRAS=flow-contrast,inspector-sync \
node scripts/browser-interactions.mjs /tmp/new-viewer /tmp/new-viewer-sync-check
```

`diagram-modules.test.mjs` añade un décimo tipo de prueba a una copia temporal, modifica solo su módulo/registro y valida, compila y genera. El producto mantiene nueve tipos. `MODULE_TEST_OUTPUT=/tmp/new-module-check` conserva la copia; usa su `skills/q-flow/scripts/browser-interactions.mjs` para revisar `page/`. Mantiene jerarquía y avisos de terceros del raíz para verificar dependencias reales. El directorio no debe existir.

Reconstruye `assets/viewer-dist/index.html` después de cambios. Tras instalar, comprueba la caché real y genera evidencias con la versión instalada en una sesión nueva. El HTML anterior contiene código antiguo y debe regenerarse.

## Nombres y migración de QGraphFlow

| Identificador | Anterior | Nuevo |
| --- | --- | --- |
| Producto | CodeGraph Flow | QGraphFlow |
| ID del plugin | `codegraph-flow` | `qgraphflow` |
| Directorio e invocación del skill | `create-interactive-codegraph` / `$create-interactive-codegraph` | `q-flow` / `$q-flow` |
| Nombre visible del skill | CodeGraph Flow｜交互式软件图 | Q flow |
| Paquete privado del visor | `codegraph-flow-viewer` | `qgraphflow-viewer` |
| Directorio de entrega predeterminado | `docs/codegraph-flow/<scope>-<diagram-type>/` | `docs/qgraphflow/<scope>-<diagram-type>/` |

El paquete conserva solo la entrada nueva, sin alias antiguos. El alcance sigue siendo nueve tipos de diagramas de software. Renombrar MapSprig / QMindFlow queda fuera.

Desde la raíz usa las rutas nuevas:

```bash
node skills/q-flow/scripts/validate-graph.mjs /tmp/graph.json
node skills/q-flow/scripts/generate-viewer.mjs /tmp/graph.json docs/qgraphflow/example-architecture
```

El directorio predeterminado es una convención de entrega del skill; el generador exige destino explícito. Se admiten directorios antiguos elegidos por el usuario, incluido `docs/codegraph-flow/`; reemplazar aún requiere `--force`. Los `graph.json` antiguos no necesitan reescritura: se conservan nombres redactados en títulos, fuentes, nodos y evidencia. El HTML antiguo funciona sin conexión con su marca integrada; regenera desde su JSON original.

`CodeGraph`, `codegraph`, `@colbymchenry/codegraph`, `.codegraph/` pertenecen al analizador externo y no cambian, tampoco `__CODEGRAPH_FLOW_DATA__`, ID SVG `codegraph-*` ni prefijos de directorios temporales de pruebas.

### Instalación local y actualizaciones

Instalación, actualización, eliminación y estado de verificación de Codex, Claude Code, Qoder y Cursor: [guía de clientes](../../clients.es.md). Editar el repositorio no actualiza plugins instalados. Verifica fuente y versión reales al instalar/migrar, usa gestión del cliente y conserva diagramas del usuario y configuración de otros plugins.

<a id="viewer-visual-and-interaction-contract"></a>

## Contrato visual y de interacción del visor

Lee esta sección para mantenimiento o auditoría. Para crear grafos, usa [visual-contract.md](visual-contract.md).

### Presentación compartida

- Estructura React Flow centrada en lienzo: ocupa la ventana bajo una barra material de 52px con navegación, menú de colección, título/subtítulo, búsqueda con resultados flotantes, `···` con exportación/restablecer/bloqueo/espaciado/apariencia e interruptor del inspector. Sin cabecera de tablero, pie o bloque de marca; nombre del producto solo en título del documento. Navegación e inspector se deslizan desde sus bordes y empiezan cerrados a cualquier ancho. Pulsar un nodo muestra al lado una vista rápida (tipo, nombre, responsabilidad, fuente, hasta cuatro etiquetas y detalles), sin abrir inspector. El diagrama recibe el mayor énfasis.
- Sigue `prefers-color-scheme` por defecto y en vivo. `···` ofrece sistema/claro/oscuro; la elección manual prevalece en ambas direcciones. Conserva vista, búsqueda, selección, bloqueo y paneles al cambiar tema.
- Paleta Radix Colors (MIT): Slate para superficies neutras frías, Iris para núcleo/interacción, Cyan para datos, Orange para decisiones/fallos. Conserva avisos en código distribuido, HTML y SVG; sin CDN de ejecución ni biblioteca de componentes.
- Marca un núcleo real con `business` o etiqueta `core`/`business` sin distinguir mayúsculas. Iris 3/8/12 para fondo/borde/texto; en ER/clases solo cabecera, filas neutras. Núcleo prevalece sobre datos/advertencias. Estados inicial/final conservan punto/círculo doble; no añadas tipo `core` ni campos de color.
- Página, nodos, MiniMap, puntos del inspector, leyendas y exportaciones comparten `visual-style.js`. Tarjetas Slate 2; lienzo claro Slate 1 (`#fcfcfd`, casi blanco), misma regla de paso 1 que oscuro. Usa escalas oscuras correspondientes.
- Colores de interfaz derivados en `styles.css` con `color-mix`: cuatro niveles `--label`, `--label-2/3/4`, separador `--sep`, rellenos `--fill`, `--fill-2/3`, materiales `--material-thick`, `--material`, `--material-thin`. Oscuro cambia solo base y sombras. Texto de interfaz 11 / 12 / 13 / 15 / 20 px; SVG mantiene `TYPOGRAPHY` / `--font-*`. Controles con `:active` y `:focus-visible` compartido; paneles con línea .5px y una sombra, `1px solid` solo en símbolos del lienzo. Además de `prefers-reduced-motion`, `prefers-reduced-transparency` vuelve materiales opacos `--panel` sin desenfoque; `prefers-contrast: more` usa color de etiqueta en separadores/texto secundario y contorno de 1px en capas flotantes.

| Función | Escala / paso Radix |
| --- | --- |
| Página / superficie normal | Slate 1 / Slate 2 |
| Texto principal / secundario | Slate 12 / Slate 11 |
| Núcleo: fondo / borde / texto | Iris 3 / Iris 8 / Iris 12 |
| Interacción / movimiento dirigido | Iris 11 |
| Datos: fondo / borde / acento | Cyan 3 / Cyan 8 / Cyan 11 |
| Advertencia: fondo / borde / acento | Orange 3 / Orange 8 / Orange 11 |
| Borde sutil / arista normal | Slate 6 / Slate 9 |

- En claro, sin `module` se conserva el fondo de rol; con él, toda la tarjeta, contorno y franja usan tinte de módulo. Correspondencia revisada del ejemplo chino: 渠道 `#6b7280`, 结算 `#5753d7`, 价格 `#8b5cf6`, 库存 `#0f8f83`, 风控 `#c26a17`, 支付 `#2474d2`, 订单 `#348052`, 履约 `#b14b7d`. El color no reemplaza etiquetas, formas, cardinalidad, líneas o estereotipos; conserva el fondo durante selección.
- Leyenda solo con categorías y líneas presentes, misma prioridad del núcleo, semántica y tema actual.
- El botón de leyenda superior izquierdo abre una ventana con interruptor de flujo si hay relaciones dirigidas. Conserva símbolos originales antes del texto, con forma, colores y línea continua/discontinua; texto en línea ajustable. Se aparta a la derecha de navegación abierta; pan/zoom no cambia posición ni tamaño. Escape o clic exterior cierra.
- Las dirigidas muestran por defecto un trazo móvil sutil de origen a destino; las no dirigidas quedan estáticas. Conserva debajo la línea de evidencia. Seleccionar no para el flujo; su interruptor detiene solo trazos ambientales, movimiento reducido detiene todo movimiento ambiental.
- Hover/selección usan contornos y sombras sin escalar ni sustituir fondos/bordes semánticos. La selección añade un rebote compartido de 760ms al nodo y aristas incidentes, luego énfasis estático; anima solo grosor, opacidad y sombra.
- `effects.css` es una capa exclusiva de pantalla tras `styles.css`. En oscuro: `filter: drop-shadow` de módulo o rol sobre `.node-surface`, acento de hover/selección, halo amplio (nodo 14px a .5, aristas incidentes 14px a .3 para mantener ≥60% de contraste del trazo móvil), `.edge-flow` más grueso y viñeta radial superior al 10%. En claro: sombra suave del módulo y fondo plano. Solo tokens, sin `box-shadow` de tarjeta (líneas de vida `boxShadow === 'none'`), sin afectar exportaciones. `prefers-reduced-transparency: reduce` o `prefers-contrast: more` apagan la capa: filtros `none`, halos/flujo vuelven a `styles.css`, sin viñeta.
- Movimiento reducido desactiva animación de relaciones/selección y aplica cambios de vista sin transición.
- SVG/PNG usan tema, notación, jerarquía y rutas ortogonales compartidas, sin selección/búsqueda transitoria. Etiquetas/símbolos permanecen dentro de sus formas; las descripciones SVG conservan todo el texto.

### Interacción

- Grafo único sin menú; colección en orden canónico con `role=menu`, `menuitemradio`, selección marcada y número de relaciones. Cambiar conserva texto/posición por grafo, limpia búsqueda/selección anterior, ajusta todo y aplica núcleo inicial.
- Sin reproducción, pasos, recorrido guiado, paso actual o completado. Ignora `playback`; el movimiento no representa orden de ejecución.
- Selecciona inicialmente el primer núcleo explícito y aristas directas estáticamente, sin pulso; lo mismo al cambiar. Sin núcleo, sin selección.
- Selección muestra vista rápida y aristas entrantes/salientes directas; bucle una vez, sin atravesar más ni atenuar otras relaciones. Reutiliza ruta actual sin añadir/modificar flechas. Preserva trazos de evidencia, cardinalidad ER y UML.
- Contorno ajustado a tarjeta, rombo, paralelogramo, elipse y círculo. Secuencia solo cabeceras/actores, nunca caja de vida. Tras 760ms estático; otro nodo reemplaza todo el conjunto, el mismo repite una vez.
- Clic/inicio de arrastre seleccionan y muestran vista rápida; directorio/búsqueda y Enter/Space abren inspector. Flujo continúa. Una respuesta y posicionamiento por operación; arrastrar no recentra ni quita foco.
- Clic en lienzo, cerrar detalles o Escape limpian selección. Búsqueda atenúa no coincidentes sin cambiar topología.
- Inspector conserva hechos, campos, nulabilidad, atributos, métodos, fuentes y etiquetas hasta cambio/borrado del usuario; no avanza ni roba foco.
- Flujo reconocible durante selección: no rellenar huecos con línea opaca del mismo color. Comprueba todas las aristas incidentes dirigidas, no solo primera o `animationPlayState`. Movimiento reducido e interruptor tienen prioridad.
- Búsqueda ignora mayúsculas y espacios exteriores. Orden: nombre exacto, prefijo, subcadena, subtítulo/etiquetas, hechos/campos/atributos/métodos; empates mantienen orden original y se toman ocho tras ordenar.
- Bloqueo predeterminado; control explícito permite arrastrar; descargas usan posiciones actuales.
- Ordenar espaciado tras desbloquear usa D3 acotado: seleccionado y vecinos de un salto, o todos sin selección. Busca 65px entre rectángulos cerca de posiciones originales; mantiene nodos dentro de su menor límite y secuencia solo horizontal. No cambia topología ni hace diseño automático completo.
- Bloqueado, ordenar queda gris con `aria-disabled="true"` pero acepta ratón/teclado para anunciar que hay que desbloquear. Etiqueta de bloqueo en una línea e interruptor 32×20px en toda anchura. Sin ejecutar solver ni desbloquear solo. Después anuncia alcance local/global y número movido, ausencia de cambios si validación limpia, o problemas restantes con ajuste manual. Cuenta errores y avisos, incluso sin movimiento.
- Si cabecera/márgenes deseados no caben dentro del límite de movimiento de 156px, conserva posición original y anuncia problemas. Nodos ajenos retienen coordenadas exactas, incluidas fracciones. Cada operación renueva mensaje y temporizador de 4.5s, incluso repetido.
- Ordenar no cambia evidencia, rutas indicadas, grupos, selección, vista, paneles ni tema. Restablecer recupera posiciones de `graph.json` y vista de lectura, borra búsqueda/selección/mensajes, restaura flujo predeterminado; conserva tema, paneles y bloqueo, y anuncia finalización.
- Pan, zoom, ajustar, restablecer y SVG/PNG siguen disponibles.
- Guardar Graph JSON conserva texto/posición de todas las vistas en forma original única/colección con metadatos, fuentes y campos estructurados. Selector nativo si se admite, descarga si no. Cancelar/fallar conserva ediciones; restablecer solo afecta vista actual y próximo guardado. Recargar usa datos integrados; regenera desde JSON guardado. Regresión cubre ida/vuelta de vista, aislamiento de restablecer, descarga JSON y regeneración.
- Teclado/cierre conservan topología; Backspace/Delete no eliminan nodos.
- Abrir/restablecer/cambiar ajusta todo; pan/zoom/minimapa dan detalle. Límites iguales al exportar: nodos, grupos, rutas exteriores, etiquetas y símbolos ER. Directorio/ajuste usan posiciones tras arrastre/ordenado; restablecer recupera originales.
- Cada ajuste, incluido pantalla completa, descuenta UI: arriba 52px+12px, fila inferior de controles, lados abiertos 304px+24px o cerrados 24px. `readingPadding()` en `useGraphLayout.js` lee `data-nav-open` / `data-drawer-open`; usa cadenas `px`, números solos son proporciones.
- Abrir navegación/inspector/detalles rápidos sobre el nodo mueve solo lo necesario para dejar 12px del borde, sin zoom. Sin cobertura o a ≤700px no mueve. `useReveal.js` se llama explícitamente desde esas tres acciones, no desde efecto. Directorio/búsqueda siguen centrando.
- Movimientos programados comparten `cubic-bezier(.32,.72,0,1)` de 320–420ms; paneles usan resorte críticamente amortiguado (`visualDuration .36`, `bounce 0`). Movimiento reducido pone duración cero y panel en destino sin recorrido pintado.
- Zoom escala el nodo completo sin ocultar subtítulos, campos, atributos, métodos o estereotipos, también en pantalla completa. Texto centrado ajusta dentro del rectángulo útil, más estrecho en rombos/elipses/cápsulas/formas inclinadas. Medición reserva mayúsculas/letras latinas anchas y notación de fragmento en títulos de límites. `text-bounds` prueba todos los tipos, campos/miembros largos, límites, aristas en mayúsculas y tres zooms; falla con texto no vacío de opacidad calculada cero.
- Vista rápida intenta derecha→izquierda→abajo→arriba: primera posición dentro del lienzo sin tapar nodos. Si todas las que caben solapan, elige menor solapamiento usando altura real. Crece desde el nodo (`is-flipped / is-below / is-above` fija `transform-origin`).
- Texto largo ajusta y desplaza dentro de altura disponible; cerrar/detalles siguen accesibles por teclado. En pantalla completa, detalles sale antes de abrir/enfocar inspector; si falla salir, conserva tarjeta y anuncia error.
- Navegación abierta desplaza leyenda/zoom a 328px de izquierda; inspector desplaza minimapa a 328px de derecha (`.workspace.nav-open / .drawer-open`); a ≤700px se quedan.
- SVG/PNG incluyen el diagrama completo, no solo la vista actual.

### Diseño adaptable

- Ambos paneles empiezan cerrados a cualquier ancho, se abren como superposiciones de 304px desde barra inferior+12px hasta ventana inferior−12px, sin fondo modal y con lienzo desplazable al lado. Escape cierra ventana emergente, panel con foco (lo devuelve al interruptor) y selección, en ese orden. Ningún ancho intermedio elimina acceso a evidencia.
- A ≤700px, ancho ventana−24px, exclusión mutua y minimapa oculto. Buscar abre detalles y cierra navegación.
- Mantén acciones móviles accesibles y lienzo visible al lado; evita desbordamiento horizontal a 390px. Inspector con texto completo y desplazamiento vertical.

### Presentación de evidencia

- Inspector: identidad, campos, atributos, métodos, anclajes y etiquetas primero; hechos del mismo nodo al final en sección independiente. Con fuente, hechos de evidencia; sin ella, descripción del nodo. Omite sin hechos/nodo, desplaza con el contenido.
- Código, configuración, esquema, prueba y documento directos usan línea continua salvo notación discontinua exigida, como retorno, dependencia o implementación.
- Comportamiento del framework e inferencia siguen discontinuos, incluso durante flujo.
- Detalles dicen evidencia; no afirman que todo anclaje sea código fuente.
- Ajusta palabras largas en hechos, subtítulos, campos, métodos, símbolos y etiquetas, conserva texto completo y solo desplazamiento vertical.

### Aceptación en navegador

- Matriz completa solo con cambios en código del visor, rutas, esquema o validación: nueve tipos × 1440×900 / 1920×1080 / 390×844 × claro/oscuro. Comprueba flujo predeterminado, ausencia de reproducción, selección estable con movimiento, interruptor independiente, leyenda dinámica, pan/zoom, búsqueda ordenada, énfasis vinculado sin geometría cambiada/pulsos dobles, detalles completos, bloqueo/resultado de espaciado, restablecer, SVG/PNG sin efectos temporales, teclado, movimiento reducido y desbordamiento. Revisa notación/núcleo por tipo. Individual sin menú, colección vertical; a ≤700px paneles cerrados inicialmente, accesibles y excluyentes.
- Abre descargas para revisar etiquetas completas, notación, límites sin recorte y tema. Reutiliza navegador instalado y cierra servidores HTTP temporales en `finally`.
