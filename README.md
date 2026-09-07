<div align="center">

# QGraphFlow

### Turn complex code into diagrams you can explore.

Follow the path. Inspect the evidence. Share one offline file.

[English](README.md) · [中文](docs/readme/README.zh-CN.md) · [日本語](docs/readme/README.ja.md) · [한국어](docs/readme/README.ko.md) · [Deutsch](docs/readme/README.de.md) · [Français](docs/readme/README.fr.md) · [Español](docs/readme/README.es.md)

[Client installation](docs/clients.md) · [Report an issue](https://github.com/supermax92/qgraphflow/issues) · [MIT](LICENSE)

</div>

![Real QGraphFlow interaction, built from Apache Kafka source. Architecture](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.en.architecture.gif)

*Real QGraphFlow interaction, built from Apache Kafka source.*

QGraphFlow turns source code, schemas, configuration and requirements into interactive software diagrams, with evidence you can inspect and an offline HTML file you can share.

- **Explore:** play an authored path, search nodes and inspect their responsibilities.
- **Verify:** retain source files, line numbers, symbols and explicit uncertainty.
- **Share:** open offline HTML or export the complete diagram as SVG / PNG.

README animations are downloaded only when viewing the documentation. Git clones and plugin packages contain no GIFs. The slim package includes the order-flow example and the English Kafka collection; all seven collections remain available in the Git repository.

## Try all nine Kafka views

With Node.js 22, clone this repository and run:

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
node skills/q-flow/scripts/validate-graph.mjs examples/showcase/kafka.en.graph.json
node skills/q-flow/scripts/generate-viewer.mjs examples/showcase/kafka.en.graph.json output/kafka
```

Open `output/kafka/index.html` in a browser and select a diagram from the tools panel. The adjacent `graph.json` keeps the editable model. After editing the input JSON, generate into a new output directory to keep earlier results.

The bundled Viewer needs no dependency installation, API key or backend service. AI-assisted authoring uses your chosen client's model service.

## One codebase. Nine ways to understand it.

The architecture above follows the producer-to-leader-log path. Open the other views below; every GIF has matching interface text and graph explanations in this README's language.

**01 · Architecture** — A source-based tour of the leader append path. Network internals, replication and acknowledgements are outside this view.

<details>
<summary><strong>02 · Flowchart</strong> · Kafka: when does send() wake Sender?</summary>

![Real QGraphFlow interaction, built from Apache Kafka source. Flowchart](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.en.flowchart.gif)

The branch after RecordAccumulator.append(). This view omits earlier validation and exception paths; returning a Future does not mean the broker has acknowledged the record.

</details>

<details>
<summary><strong>03 · Sequence</strong> · Kafka: a produce request with acks=1</summary>

![Real QGraphFlow interaction, built from Apache Kafka source. Sequence](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.en.sequence.gif)

Successful, non-transactional produce request. KafkaApis represents the broker request boundary; networking and partition internals are folded into the participants. No follower acknowledgement is required by acks=1.

</details>

<details>
<summary><strong>04 · ER diagram</strong> · Kafka: inside ProduceRequest v13</summary>

![Real QGraphFlow interaction, built from Apache Kafka source. ER diagram](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.en.er.gif)

Protocol containment, not SQL tables. Arrays are shown as zero-to-many schema relationships; no database primary or foreign keys are implied. Version 13 identifies topics by TopicId.

</details>

<details>
<summary><strong>05 · Deployment</strong> · Kafka: isolated KRaft roles</summary>

![Real QGraphFlow interaction, built from Apache Kafka source. Deployment](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.en.deployment.gif)

The repository Docker Compose plaintext example: three brokers and three separate controller containers. The controller quorum is collapsed into one visual node. This development configuration is not a production deployment recommendation.

</details>

<details>
<summary><strong>06 · Class diagram</strong> · Kafka: the producer API and its implementations</summary>

![Real QGraphFlow interaction, built from Apache Kafka source. Class diagram](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.en.class.gif)

Selected Java types and members. KafkaProducer and MockProducer both implement Producer<K,V>; ProducerRecord carries the input. Signatures are abbreviated; no ownership relationship is inferred.

</details>

<details>
<summary><strong>07 · State diagram</strong> · Kafka: a consumer joins its group</summary>

![Real QGraphFlow interaction, built from Apache Kafka source. State diagram](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.en.state.gif)

The normal assignment cycle from MemberState. Error, fencing and leaving states are omitted. Reconciliation can repeat when the broker sends another assignment.

</details>

<details>
<summary><strong>08 · Use cases</strong> · Kafka: what each client can do</summary>

![Real QGraphFlow interaction, built from Apache Kafka source. Use cases](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.en.usecase.gif)

Client roles mapped to the public Java APIs. Actor associations describe capabilities, not an execution sequence. Offset commits and administrative operations remain explicit application choices.

</details>

<details>
<summary><strong>09 · Data flow</strong> · Kafka: from application values to consumer records</summary>

![Real QGraphFlow interaction, built from Apache Kafka source. Data flow](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.en.dataflow.gif)

The payload journey through serialization, partition storage and deserialization. Batching, Produce/Fetch networking and replication are condensed; this view does not model offset commits or processing guarantees.

</details>

## Draw your own project

Install the plugin using the client guide. In Codex, use `$q-flow`; in Claude Code, use `/qgraphflow:q-flow`. Select the skill through the available entry in Qoder or Cursor. The guide records installation steps and native-client verification status.

> Analyze this module's entry points, core components and relationships. Create an interactive architecture diagram in English, retain source file and line evidence, and label relationships that cannot be confirmed.

CodeGraph is optional; without it, the skill reads source directly. Default output: `docs/qgraphflow/<scope>-<diagram-type>/` in the target project. You can specify another directory.

## Built from code you can check

All nine examples use Apache Kafka commit `634a935e7291` (the checkout declares version `4.4.0`). Selected entry points:

| View | Source evidence |
| --- | --- |
| Architecture | [`ReplicaManager.appendToLocalLog` · L1376](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/core/src/main/scala/kafka/server/ReplicaManager.scala#L1376) |
| Flowchart | [`KafkaProducer.doSend` · L1241](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/KafkaProducer.java#L1241) |
| Sequence | [`KafkaApis.handleProduceRequest` · L457](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/core/src/main/scala/kafka/server/KafkaApis.scala#L457) |
| ER diagram | [`ProduceRequest` · L50](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/resources/common/message/ProduceRequest.json#L50) |
| Deployment | [`controller-1 / controller-2 / controller-3` · L18](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/docker/examples/docker-compose-files/cluster/isolated/plaintext/docker-compose.yml#L18) |
| Class diagram | [`Producer` · L97](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/Producer.java#L97) |
| State diagram | [`STABLE` · L67](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/consumer/internals/MemberState.java#L67) |
| Use cases | [`Producer.send` · L97](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/Producer.java#L97) |
| Data flow | [`KafkaProducer.doSend` · L1197](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/KafkaProducer.java#L1197) |

## Reading the examples correctly

- Playback follows an authored path or node reading order; it does not capture runtime execution. Leader append, producer acknowledgement and completed consumer processing are distinct events.
- Evidence determines accuracy. Review key relationships; diagrams distinguish source, schema, configuration, conventions and inference.
- Layout edits affect SVG / PNG export but are not automatically saved to `graph.json`.
- Each language uses the same source evidence and topology. Code identifiers, API names, schema fields and standard notation remain in their original form.

## Develop and contribute

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

Development needs Node.js 22, npm, tar, zip and unzip. For issues, include a minimal redacted graph, client/browser versions and reproduction steps.

[Graph format](skills/q-flow/references/graph-schema.md) · [Browser verification guide](skills/q-flow/references/viewer-development.md)

## License and attribution

[MIT](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md)

QGraphFlow is an independent MIT-licensed project. Apache Kafka is the demonstration subject. Mentioned product names belong to their respective owners; no affiliation, sponsorship or endorsement is implied.
