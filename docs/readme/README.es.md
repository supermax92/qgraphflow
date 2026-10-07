<div align="center">

<h1><picture><source media="(prefers-color-scheme: dark)" srcset="../images/brand/qgraphflow-lockup-dark.svg"><img src="../images/brand/qgraphflow-lockup-light.svg" alt="QGraphFlow" height="64"></picture></h1>

### Convierte código complejo en diagramas que puedes explorar.

Sigue el recorrido. Comprueba las evidencias. Comparte un archivo sin conexión.

<sub>💡 Inspirado en <a href="https://github.com/Cocoon-AI/architecture-diagram-generator">Cocoon-AI/architecture-diagram-generator</a>; gracias por la idea.</sub>

[English](../../README.md) · [中文](../../docs/readme/README.zh-CN.md) · [Русский](../../docs/readme/README.ru.md) · [Português](../../docs/readme/README.pt.md) · [日本語](../../docs/readme/README.ja.md) · [Deutsch](../../docs/readme/README.de.md) · [Español](../../docs/readme/README.es.md)

[Demo en línea](https://supermax92.github.io/qgraphflow/) · [Primeros pasos](#primeros-pasos) · [Instalación por cliente](#guía-de-instalación) · [Informar de un problema](https://github.com/supermax92/qgraphflow/issues) · [MIT](../../LICENSE)

</div>

*Once tipos de diagramas: arquitectura de capacidades de la plataforma, arquitectura por capas de ingeniería, arquitectura de relaciones entre componentes, diagrama de flujo, secuencia, ER, despliegue, clases, estados, casos de uso y flujo de datos.*

QGraphFlow genera diagramas de software interactivos a partir del código, los esquemas, la configuración y los requisitos. Permite comprobar las relaciones y compartir el resultado como HTML sin conexión.

**Qué lo distingue:** once tipos de diagrama en una sola habilidad, un tipo de evidencia en cada relación y la línea de código detrás de cada una respaldada por código, diseño automático, edición en la propia página y ninguna solicitud de red de los scripts del complemento ni del propio Viewer.

![Demostración interactiva de varias vistas de Jeepay: arquitectura de relaciones entre componentes, secuencia y ER](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/jeepay.en.hero.gif)

Con el código fuente real de Jeepay, alterna entre diagramas de arquitectura de relaciones entre componentes, secuencia y ER para explorar componentes y relaciones de llamadas. [Ver GIF a tamaño original](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/jeepay.en.hero.gif)

**Presentación de un diagrama de secuencia complejo**

![Dibujo gradual de un diagrama de secuencia complejo: participantes, líneas de vida, mensajes, barras de activación y fragmentos combinados anidados](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/checkout.en.sequence-drawing.gif)

Un escenario ficticio de comercio electrónico contiene 9 participantes, 29 mensajes y 6 fragmentos combinados, con reintentos de inventario, ramas anidadas, procesamiento paralelo, compensación de fallos y callbacks asíncronos. La animación muestra gradualmente el diagrama generado para presentar su estructura y sus detalles. [Ver GIF a tamaño original](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/checkout.en.sequence-drawing.gif)

```bash
npx skills add supermax92/qgraphflow
```

Un solo comando instala la habilidad para Claude Code, Codex, Cursor y Qoder; la instalación como complemento y los demás clientes están en la [guía de instalación](#guía-de-instalación).

- **Explorar:** buscar, ampliar y desplazar el lienzo; consultar responsabilidades y relaciones entrantes y salientes.

- **Verificar:** inspeccionar nodos y conexiones para revisar archivos, líneas, símbolos e incertidumbres explícitas.

- **Editar:** desbloquear el diseño, cambiar textos y mover elementos; restablecer cuando sea necesario.

- **Compartir:** abrir el HTML sin conexión o exportar el diagrama completo a SVG / PNG.

El [corpus de Jeepay](../../examples/jeepay), basado en código fuente real, contiene las once vistas utilizadas por CI y la demostración online.

## Primeros pasos

Tras la instalación, abre tu proyecto de negocio en el cliente y selecciona la habilidad `q-flow`. Los ejemplos usan `/q-flow` de Claude Code; en Codex, usa la entrada `$q-flow` o `$qgraphflow:q-flow` que ofrezca tu cliente. ¿Todavía no lo has instalado? Consulta primero la [guía de instalación](#guía-de-instalación).

### 1. Entrada vacía: No sabes por dónde empezar

Invoca la habilidad sin añadir una petición:

```text
/q-flow
```

La habilidad te guía para elegir la parte que analizar y la pregunta que debe responder el diagrama. Empieza a dibujar cuando la información necesaria está clara.

### 2. Preguntar por las capacidades: Saber qué puede dibujar

```text
/q-flow ¿Qué tipos de diagramas puedes dibujar? ¿Qué preguntas responde cada tipo? Acabo de hacerme cargo de un proyecto; presenta tus capacidades y sugiere un punto de partida.
```

Conoce primero los usos de los once tipos de diagramas y decide después si quieres ver la estructura del proyecto, el orden de llamadas, las relaciones de datos u otro contenido.

### 3. Entrada vaga: Solo tienes un objetivo general

```text
/q-flow Ayúdame a dibujar este proyecto. Quiero entenderlo lo antes posible.
```

No necesitas indicar primero el tipo de diagrama. La habilidad determina una vista adecuada según el proyecto y tu objetivo, y pregunta cuando falta información necesaria.

### 4. Entrada precisa: Definir el alcance y pedir detalles del dibujo

Sustituye los nombres de negocio y los pasos siguientes por procesos que existan realmente en tu proyecto:

```text
/q-flow Analiza el proceso de creación de pedidos del proyecto actual y genera un diagrama de secuencia en chino.
Incluye la entrada de solicitudes, el cálculo de precios, la reserva de inventario, la autorización de pago y la persistencia del pedido.
Conserva las llamadas síncronas, mensajes asíncronos, retornos emparejados, barras de activación, ramas condicionales, reintentos y compensaciones de fallos que existan realmente en el código. No omitas detalles por brevedad.
Indica los archivos y números de línea del código de los componentes y llamadas, y guarda el resultado en docs/qgraphflow/order-sequence/.
```

Define claramente el objeto, la pregunta, el nivel de detalle y la ubicación de salida para empezar directamente. El diagrama conserva solo hechos respaldados por evidencia.

### 5. Seguir refinando: Ampliar una parte del diagrama anterior

Una vez generado el resultado, continúa en la misma conversación:

```text
/q-flow Amplía el paso de reserva de inventario del diagrama de secuencia anterior en un diagrama de flujo independiente en chino.
Muestra todas las ramas de validación de inventario, reserva exitosa, fallos reintentables, límite de reintentos y liberación de inventario. Sigue el código fuente y no añadas pasos que no existan en él.
```

Mira primero el conjunto y profundiza después en un paso. También puedes pedir más detalles de un diagrama existente o verificar sus relaciones.

## Guía de instalación

Se necesitan Node.js 22 o posterior y un cliente compatible con complementos que tenga configurado el acceso al modelo.

### Instalación rápida

```bash
npx skills add supermax92/qgraphflow
```

Probado con `skills` 1.7.0 en Claude Code, Codex, Cursor y Qoder. El comando pregunta en qué clientes instalar; `-a claude-code` indica uno directamente y `-g` instala para el usuario en lugar del proyecto actual. La habilidad queda instalada como `q-flow`, sin el prefijo `qgraphflow:` de las instalaciones como complemento de más abajo.

Para instalarla como complemento, seguir los pasos siguientes. En [Qoder Desktop](#qoder-desktop), puedes instalar desde el Marketplace y omitir el paso 1.

### 1. Descargar el complemento

Obtener el complemento desde npmjs.com, sin cuenta, inicio de sesión ni token. Crear un directorio independiente fuera del proyecto de la aplicación:

```bash
mkdir qgraphflow-install
cd qgraphflow-install
npm install qgraphflow --ignore-scripts
cd node_modules/qgraphflow
```

Ahora se está en la raíz del complemento. **La descarga mediante npm no instala automáticamente el complemento en el cliente**; continuar con el paso 2. El paquete también ofrece el comando `qgraphflow`, que se usa en [Mantener los diagramas sincronizados con el código](#mantener-los-diagramas-sincronizados-con-el-código).

Ejecutar los comandos siguientes desde **la raíz del complemento, que contiene `skills/`**.

### 2. Instalar en el cliente

#### Codex App / CLI

Codex CLI debe estar instalado y disponible en la terminal:

```bash
codex plugin marketplace add .
codex plugin add qgraphflow@supermax92
```

Iniciar una sesión nueva, escribir `$` y seleccionar `qgraphflow:q-flow`.

#### Claude Code

```bash
claude plugin marketplace add ./
claude plugin install qgraphflow@supermax92 --scope user
```

Iniciar una sesión nueva y escribir `/q-flow` (o el nombre completo `/qgraphflow:q-flow`).

#### Qoder CLI

```bash
qodercli plugins install .
```

Iniciar una sesión nueva y seleccionar `q-flow`.

#### Qoder Desktop

**Recomendado:** Abre **Settings → Plugins → Marketplace**, busca **QGraphFlow** o **代码图谱可视化** e instala el complemento. Inicia una sesión nueva y selecciona `q-flow`.

Para una instalación local, completa primero el paso 1. Después abre **Settings → Plugins → Custom → Import** e importa el directorio raíz completo del complemento. Inicia una sesión nueva y selecciona `q-flow`.

#### Cursor

Copiar todo el contenido de la raíz del complemento, incluidos los archivos ocultos, a:

```text
~/.cursor/plugins/local/qgraphflow/
```

Comprobar que allí existe `.cursor-plugin/plugin.json`, recargar la ventana y buscar `q-flow` en **Customize**. Si hay una versión anterior, hacer una copia de seguridad antes; no mezclar archivos antiguos y nuevos.

### 3. Empezar a usarlo

Abre tu proyecto de negocio en el cliente, inicia una sesión nueva y selecciona la habilidad. Describe tu petición siguiendo los ejemplos de [Primeros pasos](#primeros-pasos). Abre el HTML generado en el navegador.

¿Prefieres compilarlo? Consulta las [instrucciones de compilación desde el código fuente](https://github.com/supermax92/qgraphflow/blob/main/docs/distribution.md#prepare-locally).

## Uso rápido

Estos ejemplos usan `$qgraphflow:q-flow` en Codex. Si el cliente muestra `$q-flow`, seleccionar esa entrada. En los demás clientes, usar la forma de invocación indicada arriba.

**¿No sabes por dónde empezar?** Invocar la habilidad y elegir el tema y la pregunta cuando lo solicite.

```text
$qgraphflow:q-flow
```

**¿Ya tienes un objetivo?** Indicar qué parte quieres dibujar y qué quieres entender. No hace falta elegir antes el tipo de diagrama.

### Ejemplo 1: Entender la arquitectura

```text
$qgraphflow:q-flow Analiza este proyecto y crea un diagrama de arquitectura en chino que muestre responsabilidades de los módulos, dependencias y límites del sistema.
```

Útil para conocer la estructura general al llegar a un proyecto.

### Ejemplo 2: Seguir un flujo de negocio

```text
$qgraphflow:q-flow Analiza la creación de pedidos y genera un diagrama de secuencia en chino con cálculo de precios, reserva de inventario, pago y persistencia del pedido, incluidas las ramas de fallo.
```

Sustituir la creación de pedidos y sus pasos por el flujo real del proyecto. Continuar en la misma conversación:

```text
$qgraphflow:q-flow Amplía la reserva de inventario del diagrama anterior en un diagrama de flujo independiente en chino, con el tratamiento de éxitos y fallos.
```

Los resultados se guardan bajo `docs/qgraphflow/` de forma predeterminada. Abrir `index.html` para explorar, editar y exportar; `graph.json` conserva los datos. Cada vista también se escribe como SVG (`diagram.svg`, o `diagram-<n>-<type>.svg` cuando hay varias), que puede incrustarse como imagen en un README, una pull request o una wiki.

Después de editar en la página, **Más → Guardar cambios** en Chrome o Edge reescribe en su sitio la página, `graph.json` y los SVG, tras elegir una vez la carpeta del diagrama. Otros navegadores solo guardan `graph.json`: colocarlo en la carpeta y volver a generar la página y los SVG con `npx -y qgraphflow generate docs/qgraphflow/<name>/graph.json docs/qgraphflow/<name> --layout preserve --force`.

<details>
<summary>Ejecutar el ejemplo de Jeepay con once vistas basado en código fuente</summary>

Selecciona tu copia local del código fuente de Jeepay para verificar la evidencia:

```bash
export JEEPAY_REPO_ROOT="<local Jeepay repository root>"
node skills/q-flow/scripts/validate-graph.mjs examples/jeepay/collection.graph.json --input-only --repo-root "$JEEPAY_REPO_ROOT"
node skills/q-flow/scripts/generate-viewer.mjs examples/jeepay/collection.graph.json output/jeepay --repo-root "$JEEPAY_REPO_ROOT"
```

Abre `output/jeepay/index.html`; sus once SVG están en el mismo directorio. Consulta el [README del corpus](../../examples/jeepay) para conocer la revisión del código fuente y el procedimiento de actualización.

</details>

## Mantener los diagramas sincronizados con el código

Un diagrama generado con la raíz del repositorio registra dónde se define cada componente y la línea detrás de cada relación respaldada por código (una llamada, una clave foránea). La validación con `--repo-root` falla cuando falta un archivo registrado, un rango de líneas ya no cabe en el archivo o un símbolo registrado salió de sus líneas, y el error indica en qué líneas está ahora el símbolo. Añadir este trabajo a la CI; no necesita compilación, inicio de sesión ni token:

```yaml
name: Diagrams
on: [push, pull_request]
jobs:
  diagrams:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: '22'
      - run: |
          for graph in docs/qgraphflow/*/graph.json; do
            npx -y qgraphflow validate "$graph" --input-only --repo-root . || { echo "::error file=$graph::$graph failed validation"; failed=1; }
          done
          exit ${failed:-0}
```

Si falla, pedir a la habilidad que actualice ese diagrama:

```text
$qgraphflow:q-flow La CI dice que docs/qgraphflow/order-sequence está desactualizado. Actualízalo.
```

La habilidad mueve los anclajes cuyo símbolo encuentra una sola vez en el archivo, corrige solo los que siguen fallando y vuelve a generar la página y los SVG conservando las posiciones y los textos editados. No redibuja el diagrama.

## Qué responde cada uno de los once tipos de diagramas

| Vista · PNG | Pregunta principal | Alcance del ejemplo |
| --- | --- | --- |
| Arquitectura de capacidades de la plataforma | ¿Qué capacidades ofrece la plataforma? | Zonas de capacidades y matrices |
| Arquitectura por capas de ingeniería | ¿Cómo se organiza el código del proyecto? | Capas de ingeniería y soporte compartido |
| Arquitectura de relaciones entre componentes | ¿Qué límites de responsabilidad colaboran en el sistema? | Canales, orquestación de transacciones, precios, riesgo, inventario, pago, pedidos, eventos y ejecución de pedidos |
| Diagrama de flujo | ¿Cómo se bifurca y converge cada decisión? | Falta de inventario, rechazo de riesgo, compensación de fallos de pago y confirmación exitosa |
| Secuencia | ¿En qué orden hace llamadas y recibe retornos una solicitud? | Flujo principal de compra exitosa y OrderPaid asíncrono |
| ER | ¿Cómo se relacionan los datos principales? | Carrito, pedidos, líneas, pagos, reservas de inventario y paquetes |
| Despliegue | ¿Dónde se ubican las unidades de ejecución y cómo se conectan? | Borde, Kubernetes, servicios de datos, pago y redes de almacén y logística |
| Clases | ¿Cómo dependen los objetos de dominio y los contratos del código? | Servicio de aplicación Checkout, Order y cuatro puertos |
| Estados | ¿Qué eventos y condiciones de guarda hacen avanzar un pedido? | Pago, ejecución del pedido, cancelación, reembolso y cierre |
| Casos de uso | ¿Qué capacidades tiene cada actor? | Comprador, comercio, almacén y atención al cliente |
| Flujo de datos | ¿Por qué transformaciones y almacenes pasan los activos de datos? | Carrito, decisiones de transacción, eventos de pedidos, almacén y logística y comprobantes de entrega |

Este modelo conceptual demuestra QGraphFlow y no corresponde a un repositorio de comercio concreto. El ejemplo `graph.json` no inventa rutas de código y marca las evidencias de las relaciones como `inference`. Los diagramas reales necesitan código, DDL, configuración, pruebas y requisitos aceptados que se puedan rastrear.

## Desarrollo y contribuciones

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

Se necesitan Node.js 22 o posterior, npm, tar, zip y unzip. Al informar de un problema, incluir un gráfico mínimo sin datos sensibles, versiones del cliente y navegador y pasos de reproducción.

Documentación de referencia (en inglés): [Fuentes de evidencia](../../skills/q-flow/references/evidence-sources.md) · [Formato de gráficos](../../skills/q-flow/references/graph-schema.md) · [Consulta guiada](../../skills/q-flow/references/guided-intake.md) · [Desarrollo y aceptación del Viewer](../../skills/q-flow/references/viewer-development.md) · [Composición de diagramas](../../skills/q-flow/references/visual-contract.md)

## Licencia y atribución

[MIT](../../LICENSE) · [Avisos de terceros](../../THIRD_PARTY_NOTICES.md)

QGraphFlow es un proyecto independiente con licencia MIT. Los escenarios de este documento son ejemplos conceptuales y no representan la arquitectura de producción de ninguna empresa real.

## Vistas generales de arquitectura

La arquitectura incluye ahora relaciones entre componentes, capacidades de la plataforma y capas de ingeniería. Describe el objeto y la pregunta; la habilidad elige la plantilla. Las colecciones solicitadas pueden contener varias vistas de arquitectura con ediciones independientes.

```text
$qgraphflow:q-flow Analiza las capacidades de la plataforma y las formas de integración de negocio del proyecto actual, y genera una vista general de capacidades de la plataforma en chino.
$qgraphflow:q-flow Analiza la organización del proyecto actual y sus capas de componentes, y genera vistas generales en chino del proyecto completo y de una sección de un componente.
$qgraphflow:q-flow Genera una vista general en inglés de las capacidades de la plataforma de este proyecto y muestra cómo se integran los módulos de aplicación.
```

Consulta [examples/jeepay](../../examples/jeepay) para ver las vistas de arquitectura de plataforma, ingeniería y relaciones entre componentes basadas en código fuente real. Desbloquea una vista general para reordenar tarjetas dentro de una capa o editar texto. Guardar conserva todas las vistas; restablecer restaura solo la actual.
