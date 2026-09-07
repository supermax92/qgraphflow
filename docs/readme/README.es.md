<div align="center">

# QGraphFlow

### Convierte el código complejo en diagramas que puedes explorar.

Sigue el recorrido. Comprueba las evidencias. Comparte un archivo sin conexión.

[English](../../README.md) · [中文](../../docs/readme/README.zh-CN.md) · [日本語](../../docs/readme/README.ja.md) · [한국어](../../docs/readme/README.ko.md) · [Deutsch](../../docs/readme/README.de.md) · [Français](../../docs/readme/README.fr.md) · [Español](../../docs/readme/README.es.md)

[Instalación de clientes](../../docs/clients.md) · [Informar de un problema](https://github.com/supermax92/qgraphflow/issues) · [MIT](../../LICENSE)

</div>

![Interacción real con QGraphFlow, basada en el código fuente de Apache Kafka. Arquitectura](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.es.architecture.gif)

*Interacción real con QGraphFlow, basada en el código fuente de Apache Kafka.*

QGraphFlow crea diagramas de software interactivos a partir de código fuente, esquemas, configuración y requisitos. Las evidencias se pueden consultar y el resultado se comparte como un archivo HTML sin conexión.

- **Explora:** reproduce un recorrido preparado, busca nodos y examina sus responsabilidades.
- **Verifica:** conserva archivos fuente, números de línea, símbolos e incertidumbres explícitas.
- **Comparte:** abre el HTML sin conexión o exporta el diagrama completo como SVG / PNG.

Las animaciones del README solo se descargan al consultar la documentación. Los clones de Git y los paquetes del plugin no incluyen GIF. El paquete reducido incluye el ejemplo de pedidos y los diagramas de Kafka en inglés; las siete versiones siguen disponibles en el repositorio Git.

## Prueba las nueve vistas de Kafka

Con Node.js 22, clona este repositorio y ejecuta:

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
node skills/q-flow/scripts/validate-graph.mjs examples/showcase/kafka.es.graph.json
node skills/q-flow/scripts/generate-viewer.mjs examples/showcase/kafka.es.graph.json output/kafka
```

Abre `output/kafka/index.html` en un navegador y selecciona un diagrama en el panel de herramientas. El archivo contiguo `graph.json` conserva el modelo editable. Tras editar el JSON de entrada, genera en una carpeta nueva para conservar los resultados anteriores.

El Viewer incluido no necesita instalar dependencias, una clave API ni un servicio backend para generar las páginas. La creación asistida por IA utiliza el servicio de modelos del cliente elegido.

## Un mismo código. Nueve formas de entenderlo.

La arquitectura de arriba sigue la ruta del productor al registro del líder. Despliega las demás vistas. La interfaz y las explicaciones de cada GIF usan el idioma de este README.

**01 · Arquitectura** — Un recorrido por la escritura en el líder, basado en el código fuente. Los detalles de red, la replicación y las confirmaciones quedan fuera de esta vista.

<details>
<summary><strong>02 · Diagrama de flujo</strong> · Kafka: ¿cuándo despierta send() a Sender?</summary>

![Interacción real con QGraphFlow, basada en el código fuente de Apache Kafka. Diagrama de flujo](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.es.flowchart.gif)

La bifurcación posterior a RecordAccumulator.append(). Se omiten las validaciones y excepciones anteriores. Devolver un Future no significa que el broker haya confirmado el registro.

</details>

<details>
<summary><strong>03 · Diagrama de secuencia</strong> · Kafka: una solicitud Produce con acks=1</summary>

![Interacción real con QGraphFlow, basada en el código fuente de Apache Kafka. Diagrama de secuencia](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.es.sequence.gif)

Solicitud Produce exitosa y no transaccional. KafkaApis representa el límite de solicitudes del broker; la red y los detalles internos de las particiones se agrupan en los participantes. acks=1 no exige confirmación de los seguidores.

</details>

<details>
<summary><strong>04 · Diagrama ER</strong> · Kafka: la estructura de ProduceRequest v13</summary>

![Interacción real con QGraphFlow, basada en el código fuente de Apache Kafka. Diagrama ER](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.es.er.gif)

Relaciones de inclusión del protocolo, no tablas SQL. Los arrays se representan con relaciones de cero a muchos; no se suponen claves primarias ni foráneas de una base de datos. La versión 13 identifica los temas mediante TopicId.

</details>

<details>
<summary><strong>05 · Diagrama de despliegue</strong> · Kafka: roles KRaft separados</summary>

![Interacción real con QGraphFlow, basada en el código fuente de Apache Kafka. Diagrama de despliegue](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.es.deployment.gif)

El ejemplo Docker Compose con comunicación sin cifrar del repositorio: tres brokers y tres contenedores controller separados. El cuórum de controllers se resume en un único nodo visual. Esta configuración de desarrollo no es una recomendación para producción.

</details>

<details>
<summary><strong>06 · Diagrama de clases</strong> · Kafka: la API del productor y sus implementaciones</summary>

![Interacción real con QGraphFlow, basada en el código fuente de Apache Kafka. Diagrama de clases](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.es.class.gif)

Tipos y miembros Java seleccionados. KafkaProducer y MockProducer implementan Producer<K,V>; ProducerRecord contiene la entrada. Las firmas se abrevian y no se infieren relaciones de propiedad.

</details>

<details>
<summary><strong>07 · Diagrama de estados</strong> · Kafka: un consumidor se une a su grupo</summary>

![Interacción real con QGraphFlow, basada en el código fuente de Apache Kafka. Diagrama de estados](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.es.state.gif)

El ciclo normal de asignación de MemberState. Se omiten los estados de error, exclusión y salida. La reconciliación puede repetirse cuando el broker envía otra asignación.

</details>

<details>
<summary><strong>08 · Casos de uso</strong> · Kafka: qué puede hacer cada cliente</summary>

![Interacción real con QGraphFlow, basada en el código fuente de Apache Kafka. Casos de uso](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.es.usecase.gif)

Roles de cliente vinculados a las API Java públicas. Las asociaciones de actores describen capacidades, no un orden de ejecución. Los commits de offsets y las operaciones administrativas siguen siendo decisiones explícitas de la aplicación.

</details>

<details>
<summary><strong>09 · Flujo de datos</strong> · Kafka: de los valores de la aplicación a los registros del consumidor</summary>

![Interacción real con QGraphFlow, basada en el código fuente de Apache Kafka. Flujo de datos](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.es.dataflow.gif)

El recorrido de los datos por la serialización, el almacenamiento por partición y la deserialización. Los lotes, la red Produce/Fetch y la replicación se simplifican; esta vista no modela commits de offsets ni garantías de procesamiento.

</details>

## Dibuja tu propio proyecto

Instala el complemento siguiendo la guía. En Codex, usa `$q-flow`; en Claude Code, `/qgraphflow:q-flow`. En Qoder y Cursor, selecciona la habilidad mediante la opción disponible en el cliente. La guía documenta la instalación y el estado de las comprobaciones en los clientes nativos.

> Analiza los puntos de entrada, los componentes principales y las relaciones de este módulo. Crea un diagrama de arquitectura interactivo en español, conserva archivos y líneas de código como evidencia e indica las relaciones que no se puedan confirmar.

CodeGraph es opcional; si no está configurado, la habilidad lee el código directamente. La salida predeterminada en el proyecto es `docs/qgraphflow/<scope>-<diagram-type>/`. Puedes indicar otra carpeta.

## Basado en código que puedes comprobar

Los nueve ejemplos utilizan el commit de Apache Kafka `634a935e7291` (la versión declarada en esta copia es `4.4.0`). Algunos puntos de referencia:

| Vista | Evidencia en el código |
| --- | --- |
| Arquitectura | [`ReplicaManager.appendToLocalLog` · L1376](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/core/src/main/scala/kafka/server/ReplicaManager.scala#L1376) |
| Diagrama de flujo | [`KafkaProducer.doSend` · L1241](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/KafkaProducer.java#L1241) |
| Diagrama de secuencia | [`KafkaApis.handleProduceRequest` · L457](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/core/src/main/scala/kafka/server/KafkaApis.scala#L457) |
| Diagrama ER | [`ProduceRequest` · L50](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/resources/common/message/ProduceRequest.json#L50) |
| Diagrama de despliegue | [`controller-1 / controller-2 / controller-3` · L18](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/docker/examples/docker-compose-files/cluster/isolated/plaintext/docker-compose.yml#L18) |
| Diagrama de clases | [`Producer` · L97](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/Producer.java#L97) |
| Diagrama de estados | [`STABLE` · L67](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/consumer/internals/MemberState.java#L67) |
| Casos de uso | [`Producer.send` · L97](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/Producer.java#L97) |
| Flujo de datos | [`KafkaProducer.doSend` · L1197](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/KafkaProducer.java#L1197) |

## Cómo interpretar los ejemplos

- La reproducción sigue un recorrido preparado o un orden de lectura de los nodos; no captura la ejecución del programa. La escritura en el líder, la confirmación al productor y el procesamiento completado por el consumidor son eventos distintos.
- La precisión depende de las evidencias. Revisa las relaciones principales. Los diagramas distinguen código, esquema, configuración, convención e inferencia.
- Los cambios de disposición se reflejan en la exportación SVG / PNG, pero no se guardan automáticamente en `graph.json`.
- Todos los idiomas comparten las mismas evidencias y la misma estructura del grafo. Los identificadores del código, nombres de API, campos del esquema y notación estándar conservan su forma original.

## Desarrollo y contribuciones

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

El desarrollo requiere Node.js 22, npm, tar, zip y unzip. Al informar de un problema, incluye un grafo mínimo sin datos sensibles, las versiones del cliente y del navegador y los pasos para reproducirlo.

[Formato del grafo](../../skills/q-flow/references/graph-schema.md) · [Guía de verificación en el navegador](../../skills/q-flow/references/viewer-development.md)

## Licencia y atribución

[MIT](../../LICENSE) · [Avisos de terceros](../../THIRD_PARTY_NOTICES.md)

QGraphFlow es un proyecto independiente con licencia MIT. Apache Kafka es el objeto de la demostración. Los nombres de productos pertenecen a sus respectivos titulares; no se implica afiliación, patrocinio ni respaldo.
