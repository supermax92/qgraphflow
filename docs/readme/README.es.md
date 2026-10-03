<div align="center">

# QGraphFlow

### Convierte código complejo en diagramas que puedes explorar.

Sigue el recorrido. Comprueba las evidencias. Comparte un archivo sin conexión.

<sub>💡 Inspirado en <a href="https://github.com/Cocoon-AI/architecture-diagram-generator">Cocoon-AI/architecture-diagram-generator</a>; gracias por la idea.</sub>

[English](../../README.md) · [中文](../../docs/readme/README.zh-CN.md) · [Русский](../../docs/readme/README.ru.md) · [Português](../../docs/readme/README.pt.md) · [日本語](../../docs/readme/README.ja.md) · [Deutsch](../../docs/readme/README.de.md) · [Español](../../docs/readme/README.es.md)

[Demo en línea](https://supermax92.github.io/qgraphflow/) · [Instalación por cliente](#guía-de-instalación) · [Informar de un problema](https://github.com/supermax92/qgraphflow/issues) · [MIT](../../LICENSE)

</div>

![Arquitectura, secuencia y ER del ejemplo agent-desk, 1,5 segundos por vista](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.es.hero.gif)

*Nueve tipos: arquitectura, flujo, secuencia, ER, despliegue, clases, estados, casos de uso y flujo de datos.*

QGraphFlow genera diagramas de software interactivos a partir del código, los esquemas, la configuración y los requisitos. Permite comprobar las relaciones y compartir el resultado como HTML sin conexión.

**Qué lo distingue:** nueve tipos de diagrama en una sola habilidad, el origen de cada relación, diseño automático, edición en la propia página y ninguna solicitud de red de los scripts del complemento ni del propio Viewer.

```bash
npx skills add supermax92/qgraphflow
```

Un solo comando instala la habilidad para Claude Code, Codex, Cursor y Qoder; la instalación como complemento y los demás clientes están en la [guía de instalación](#guía-de-instalación).

- **Explorar:** buscar, ampliar y desplazar el lienzo; consultar responsabilidades y relaciones entrantes y salientes.

  ![Explorar: buscar refund, saltar a Herramientas de pedidos, alejar hasta ver el orquestador arriba y la base de datos de pedidos y el seguimiento logístico abajo, luego desplazar](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.es.explore.gif)

- **Verificar:** inspeccionar nodos y conexiones para revisar archivos, líneas, símbolos e incertidumbres explícitas.

  ![Verificar: tarjeta con src/gateway/chat-gateway.js:5-19, panel de detalles con el símbolo y los hechos de evidencia, luego la conexión POST /chat marcada como inference](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.es.verify.gif)

- **Editar:** desbloquear el diseño, cambiar textos y mover elementos; restablecer cuando sea necesario.

  ![Editar: desbloquear el diseño, renombrar Proveedor LLM a Pasarela LLM, arrastrarlo con sus conexiones y restablecer](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.es.edit.gif)

- **Compartir:** abrir el HTML sin conexión o exportar el diagrama completo a SVG / PNG.

  ![Compartir: abrir el HTML sin conexión, exportar PNG desde Más y luego el archivo exportado](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.es.share.gif)

La animación superior muestra arquitectura, secuencia y ER durante 1,5 segundos cada una (4,5 segundos por ciclo); las cuatro animaciones de funciones duran entre 6,5 y 8,5 segundos. Todas se grabaron con el Viewer construido desde el código fuente sobre el [ejemplo agent-desk](../../examples/showcase/agent-desk) — negocio ficticio, código real — con diagramas e interfaz en español. Se alojan como [recursos de la Release showcase-v2](https://github.com/supermax92/qgraphflow/releases/tag/showcase-v2), fuera del historial de Git y del paquete del plugin, así que verlas requiere red; el HTML generado del diagrama funciona sin conexión.

## Guía de instalación

Se necesitan Node.js 22 o posterior y un cliente compatible con complementos que tenga configurado el acceso al modelo.

### Instalación rápida

```bash
npx skills add supermax92/qgraphflow
```

Probado con `skills` 1.7.0 en Claude Code, Codex, Cursor y Qoder. El comando pregunta en qué clientes instalar; `-a claude-code` indica uno directamente y `-g` instala para el usuario en lugar del proyecto actual. La habilidad queda instalada como `q-flow`, sin el prefijo `qgraphflow:` de las instalaciones como complemento de más abajo.

Para instalarla como complemento, seguir los pasos siguientes. En [Qoder Desktop](#qoder-desktop), puedes instalar desde el Marketplace y omitir el paso 1.

### 1. Descargar el complemento

Descargar [qgraphflow-0.0.5.zip](https://github.com/supermax92/qgraphflow/releases/download/v0.0.5/qgraphflow-0.0.5.zip) y extraerlo en un directorio independiente, conservando los archivos ocultos.

Ejecutar los comandos siguientes desde **la raíz del complemento extraído, que contiene `skills/`**.

### 2. Instalar en el cliente

#### Codex App / CLI

Codex CLI debe estar instalado y disponible en la terminal:

```bash
codex plugin marketplace add .
codex plugin add qgraphflow@supermax92
```

Iniciar una sesión nueva, escribir `$` y seleccionar `qgraphflow:q-flow`.

#### Claude Code

Instalar directamente desde GitHub sin descargar el ZIP:

```bash
claude plugin marketplace add supermax92/qgraphflow
claude plugin install qgraphflow@supermax92 --scope user
```

O bien, desde la raíz del complemento extraído:

```bash
claude plugin marketplace add .
claude plugin install qgraphflow@supermax92 --scope user
```

Iniciar una sesión nueva y escribir `/q-flow` (o el nombre completo `/qgraphflow:q-flow`).

#### Qoder CLI

```bash
qodercli plugins install .
```

Iniciar una sesión nueva y seleccionar `q-flow`.

#### Qoder Desktop

**Recomendado:** Abre **Settings → Plugins → Marketplace**, busca **代码图谱可视化** o **qgraphflow** e instala el complemento. Inicia una sesión nueva y selecciona `q-flow`. No necesitas descargar un ZIP ni compilar el código fuente.

Para una instalación local, completa primero el paso 1. Después abre **Settings → Plugins → Custom → Import** e importa el directorio raíz completo del complemento extraído. Inicia una sesión nueva y selecciona `q-flow`.

#### Cursor

Copiar todo el contenido de la raíz del complemento, incluidos los archivos ocultos, a:

```text
~/.cursor/plugins/local/qgraphflow/
```

Comprobar que allí existe `.cursor-plugin/plugin.json`, recargar la ventana y buscar `q-flow` en **Customize**. Si hay una versión anterior, hacer una copia de seguridad antes; no mezclar archivos antiguos y nuevos.

### 3. Empezar a usarlo

Abrir el proyecto en el cliente, iniciar una sesión nueva y seleccionar la habilidad. Describir la tarea siguiendo los ejemplos de [Inicio rápido](#inicio-rápido) más abajo. Abrir el HTML generado en el navegador.

<details>
<summary>Otra forma de instalación: npm</summary>

También se puede obtener el complemento desde npmjs.com en lugar del ZIP, sin cuenta, inicio de sesión ni token. Crear un directorio independiente fuera del proyecto de la aplicación:

```bash
mkdir qgraphflow-install
cd qgraphflow-install
npm install qgraphflow --ignore-scripts
cd node_modules/qgraphflow
```

Ahora se está en la raíz del complemento. Continuar con los pasos de instalación del cliente indicados arriba. **La descarga mediante npm no instala automáticamente el complemento en el cliente.** El paquete también ofrece el comando `qgraphflow`, que se usa en [Mantener los diagramas sincronizados con el código](#mantener-los-diagramas-sincronizados-con-el-código).

</details>

¿Prefieres compilarlo? Consulta las [instrucciones de compilación desde el código fuente](https://github.com/supermax92/qgraphflow/blob/main/docs/distribution.md#prepare-locally).

## Inicio rápido

Estos ejemplos usan `$qgraphflow:q-flow` en Codex. Si el cliente muestra `$q-flow`, seleccionar esa entrada. En los demás clientes, usar la forma de invocación indicada arriba.

**¿No sabes por dónde empezar?** Invocar la habilidad y elegir el tema y la pregunta cuando lo solicite.

```text
$qgraphflow:q-flow
```

**¿Ya tienes un objetivo?** Indicar qué parte quieres dibujar y qué quieres entender. No hace falta elegir antes el tipo de diagrama.

### Ejemplo 1: Entender la arquitectura

```text
$qgraphflow:q-flow Analiza este proyecto y crea un diagrama de arquitectura en español que muestre responsabilidades de los módulos, dependencias y límites del sistema.
```

Útil para conocer la estructura general al llegar a un proyecto.

### Ejemplo 2: Seguir un flujo de negocio

```text
$qgraphflow:q-flow Analiza la creación de pedidos y genera un diagrama de secuencia en español con cálculo de precios, reserva de inventario, pago y persistencia del pedido, incluidas las ramas de fallo.
```

Sustituir la creación de pedidos y sus pasos por el flujo real del proyecto. Continuar en la misma conversación:

```text
$qgraphflow:q-flow Amplía la reserva de inventario del diagrama anterior en un diagrama de flujo independiente en español, con el tratamiento de éxitos y fallos.
```

Los resultados se guardan bajo `docs/qgraphflow/` de forma predeterminada. Abrir `index.html` para explorar, editar y exportar; `graph.json` conserva los datos. Cada vista también se escribe como SVG (`diagram.svg`, o `diagram-<n>-<type>.svg` cuando hay varias), que puede incrustarse como imagen en un README, una pull request o una wiki.

Después de editar en la página, **Más → Guardar cambios** en Chrome o Edge reescribe en su sitio la página, `graph.json` y los SVG, tras elegir una vez la carpeta del diagrama. Otros navegadores solo guardan `graph.json`: colocarlo en la carpeta y volver a generar la página y los SVG con `npx -y qgraphflow generate docs/qgraphflow/<name>/graph.json docs/qgraphflow/<name> --layout preserve --force`.

<details>
<summary>Ejecutar manualmente el ejemplo de comercio con nueve vistas</summary>

Los comandos siguientes ejecutan el ejemplo del repositorio. Usar un complemento ya instalado no requiere clonarlo. Con Node.js 22 o posterior:

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
node skills/q-flow/scripts/validate-graph.mjs examples/showcase/ecommerce.es.graph.json
node skills/q-flow/scripts/generate-viewer.mjs examples/showcase/ecommerce.es.graph.json output/ecommerce-es
```

Abrir `output/ecommerce-es/index.html` en el navegador; los nueve SVG están al lado. Cambiar de vista desde **Tipos de diagramas** en la barra superior; cada vista conserva sus textos y posiciones guardados. **Más → Guardar cambios** guarda todas las vistas como se describe arriba. Las mismas páginas están en la [demo en línea](https://supermax92.github.io/qgraphflow/).

El Viewer precompilado no necesita instalar dependencias, claves API ni servicios de backend. La búsqueda de evidencias y la creación de gráficos con IA usan el servicio de modelos del cliente elegido.

</details>

## Mantener los diagramas sincronizados con el código

Un diagrama generado con la raíz del repositorio registra dónde se define cada componente. La validación con `--repo-root` falla cuando falta un archivo registrado, un rango de líneas ya no cabe en el archivo o un símbolo registrado salió de sus líneas, y el error indica en qué líneas está ahora el símbolo. Añadir este trabajo a la CI; no necesita compilación, inicio de sesión ni token:

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

## Qué responde cada una de las nueve vistas

| Vista · PNG | Pregunta principal | Alcance del ejemplo |
| --- | --- | --- |
| Arquitectura | ¿Qué responsabilidades colaboran? | Canales, compra, precios, riesgo, inventario, pago, pedidos, eventos y entrega |
| Flujo | ¿Dónde se bifurca y converge el proceso? | Falta de inventario, rechazo de riesgo, compensación del pago y confirmación exitosa |
| Secuencia | ¿En qué orden ocurren llamadas y retornos? | Compra exitosa y OrderPaid asíncrono |
| ER | ¿Cómo se relacionan los datos principales? | Carrito, pedidos, líneas, pagos, reservas y paquetes |
| Despliegue | ¿Dónde se ejecutan y conectan las unidades? | Borde, Kubernetes, servicios de datos, pagos y redes logísticas |
| Clases | ¿Cómo dependen los objetos de dominio y los contratos? | Servicio de compra, Order y cuatro puertos |
| Estados | ¿Qué eventos y condiciones hacen avanzar un pedido? | Pago, entrega, cancelación, reembolso y cierre |
| Casos de uso | ¿Qué puede hacer cada actor? | Comprador, comercio, almacén y atención al cliente |
| Flujo de datos | ¿Cómo se transforman y almacenan los datos? | Carrito, decisiones, eventos, almacén y comprobantes de entrega |

Este modelo conceptual demuestra QGraphFlow y no corresponde a un repositorio de comercio concreto. El ejemplo `graph.json` no inventa rutas de código y marca las evidencias de las relaciones como `inference`. Los diagramas reales necesitan código, DDL, configuración, pruebas y requisitos aceptados que se puedan rastrear.

## Desarrollo y contribuciones

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

Se necesitan Node.js 22 o posterior, npm, tar, zip y unzip. Al informar de un problema, incluir un gráfico mínimo sin datos sensibles, versiones del cliente y navegador y pasos de reproducción.

Documentación de referencia (en inglés): [Fuentes de evidencia](../../skills/q-flow/references/evidence-sources.md) · [Formato de gráficos](../../skills/q-flow/references/graph-schema.md) · [Consulta guiada](../../skills/q-flow/references/guided-intake.md) · [Desarrollo del Viewer](../../skills/q-flow/references/viewer-development.md) · [Composición de diagramas](../../skills/q-flow/references/visual-contract.md)

## Licencia y atribución

[MIT](../../LICENSE) · [Avisos de terceros](../../THIRD_PARTY_NOTICES.md)

QGraphFlow es un proyecto independiente con licencia MIT. Los escenarios de este documento son conceptuales y no representan la arquitectura de producción de ninguna empresa; no implica afiliación, patrocinio ni respaldo.
