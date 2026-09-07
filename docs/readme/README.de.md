<div align="center">

# QGraphFlow

### Aus komplexem Code werden Diagramme zum Erkunden.

Dem Pfad folgen. Die Belege prüfen. Eine Offline-Datei teilen.

[English](../../README.md) · [中文](../../docs/readme/README.zh-CN.md) · [日本語](../../docs/readme/README.ja.md) · [한국어](../../docs/readme/README.ko.md) · [Deutsch](../../docs/readme/README.de.md) · [Français](../../docs/readme/README.fr.md) · [Español](../../docs/readme/README.es.md)

[Client-Installation](../../docs/clients.md) · [Problem melden](https://github.com/supermax92/qgraphflow/issues) · [MIT](../../LICENSE)

</div>

![Echte QGraphFlow-Bedienung, erstellt anhand des Apache-Kafka-Quellcodes. Architektur](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.de.architecture.gif)

*Echte QGraphFlow-Bedienung, erstellt anhand des Apache-Kafka-Quellcodes.*

QGraphFlow erstellt interaktive Softwarediagramme aus Quellcode, Schemas, Konfiguration und Anforderungen. Die Belege bleiben nachvollziehbar; das Ergebnis lässt sich als Offline-HTML teilen.

- **Erkunden:** einen erstellten Pfad abspielen, Knoten suchen und ihre Aufgaben untersuchen.
- **Prüfen:** Quelldateien, Zeilennummern, Symbole und ausdrücklich benannte Unsicherheiten behalten.
- **Teilen:** Offline-HTML öffnen oder das gesamte Diagramm als SVG / PNG exportieren.

README-Animationen werden nur beim Lesen der Dokumentation geladen. Git-Klone und Plugin-Pakete enthalten keine GIFs. Das schlanke Paket enthält das Bestellablauf-Beispiel und die englische Kafka-Sammlung; alle sieben Sprachfassungen bleiben im Git-Repository verfügbar.

## Alle neun Kafka-Ansichten ausprobieren

Mit Node.js 22 dieses Repository klonen und ausführen:

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
node skills/q-flow/scripts/validate-graph.mjs examples/showcase/kafka.de.graph.json
node skills/q-flow/scripts/generate-viewer.mjs examples/showcase/kafka.de.graph.json output/kafka
```

`output/kafka/index.html` im Browser öffnen und im Werkzeugbereich ein Diagramm auswählen. Die benachbarte Datei `graph.json` enthält das bearbeitbare Modell. Nach Änderungen an der Eingabe-JSON in ein neues Ausgabeverzeichnis generieren, um frühere Ergebnisse zu behalten.

Der mitgelieferte Viewer benötigt zur Generierung weder zusätzliche Abhängigkeiten noch API-Schlüssel oder Backend-Dienst. Für die Erstellung mit KI wird der Modelldienst des gewählten Clients verwendet.

## Eine Codebasis. Neun Perspektiven.

Die Architektur oben zeigt den Pfad vom Producer zum Leader-Log. Die weiteren Ansichten lassen sich unten aufklappen. Oberfläche und Erläuterungen in jedem GIF entsprechen der Sprache dieser README.

**01 · Architektur** — Ein quellcodebasierter Rundgang durch den Schreibpfad des Leaders. Netzwerkdetails, Replikation und Bestätigungen sind nicht Teil dieser Ansicht.

<details>
<summary><strong>02 · Flussdiagramm</strong> · Kafka: wann weckt send() den Sender?</summary>

![Echte QGraphFlow-Bedienung, erstellt anhand des Apache-Kafka-Quellcodes. Flussdiagramm](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.de.flowchart.gif)

Die Verzweigung nach RecordAccumulator.append(). Vorherige Validierung und Fehlerpfade sind ausgelassen. Ein zurückgegebenes Future bedeutet keine Bestätigung durch den Broker.

</details>

<details>
<summary><strong>03 · Sequenzdiagramm</strong> · Kafka: eine Produce-Anfrage mit acks=1</summary>

![Echte QGraphFlow-Bedienung, erstellt anhand des Apache-Kafka-Quellcodes. Sequenzdiagramm](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.de.sequence.gif)

Erfolgreiche, nicht transaktionale Produce-Anfrage. KafkaApis steht für die Anfragegrenze des Brokers; Netzwerk- und Partitionsdetails sind in den Teilnehmern zusammengefasst. acks=1 verlangt keine Follower-Bestätigung.

</details>

<details>
<summary><strong>04 · ER-Diagramm</strong> · Kafka: der Aufbau von ProduceRequest v13</summary>

![Echte QGraphFlow-Bedienung, erstellt anhand des Apache-Kafka-Quellcodes. ER-Diagramm](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.de.er.gif)

Enthaltensein im Protokoll, keine SQL-Tabellen. Arrays werden als Null-bis-viele-Beziehungen dargestellt; Datenbank-Primär- oder Fremdschlüssel werden nicht unterstellt. Version 13 identifiziert Topics über TopicId.

</details>

<details>
<summary><strong>05 · Deployment-Diagramm</strong> · Kafka: getrennte KRaft-Rollen</summary>

![Echte QGraphFlow-Bedienung, erstellt anhand des Apache-Kafka-Quellcodes. Deployment-Diagramm](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.de.deployment.gif)

Das Docker-Compose-Beispiel mit Klartextkommunikation aus dem Repository: drei Broker und drei separate Controller-Container. Das Controller-Quorum ist zu einem visuellen Knoten zusammengefasst. Diese Entwicklungskonfiguration ist keine Empfehlung für den Produktivbetrieb.

</details>

<details>
<summary><strong>06 · Klassendiagramm</strong> · Kafka: Producer-API und Implementierungen</summary>

![Echte QGraphFlow-Bedienung, erstellt anhand des Apache-Kafka-Quellcodes. Klassendiagramm](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.de.class.gif)

Ausgewählte Java-Typen und Mitglieder. KafkaProducer und MockProducer implementieren Producer<K,V>; ProducerRecord enthält die Eingabe. Signaturen sind gekürzt; Besitzverhältnisse werden nicht abgeleitet.

</details>

<details>
<summary><strong>07 · Zustandsdiagramm</strong> · Kafka: ein Consumer tritt seiner Gruppe bei</summary>

![Echte QGraphFlow-Bedienung, erstellt anhand des Apache-Kafka-Quellcodes. Zustandsdiagramm](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.de.state.gif)

Der normale Zuweisungszyklus aus MemberState. Fehler-, Fencing- und Austrittszustände sind ausgelassen. Ein Abgleich kann sich wiederholen, wenn der Broker eine neue Zuweisung sendet.

</details>

<details>
<summary><strong>08 · Anwendungsfalldiagramm</strong> · Kafka: die Fähigkeiten der Clients</summary>

![Echte QGraphFlow-Bedienung, erstellt anhand des Apache-Kafka-Quellcodes. Anwendungsfalldiagramm](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.de.usecase.gif)

Client-Rollen und ihre öffentlichen Java-APIs. Akteurbeziehungen beschreiben Fähigkeiten, keine Ausführungsreihenfolge. Offset-Commits und Verwaltungsaktionen bleiben explizite Entscheidungen der Anwendung.

</details>

<details>
<summary><strong>09 · Datenflussdiagramm</strong> · Kafka: von Anwendungswerten zu Consumer-Datensätzen</summary>

![Echte QGraphFlow-Bedienung, erstellt anhand des Apache-Kafka-Quellcodes. Datenflussdiagramm](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.de.dataflow.gif)

Der Weg der Nutzdaten durch Serialisierung, Partitionsspeicherung und Deserialisierung. Batching, Produce/Fetch-Netzwerkverkehr und Replikation sind zusammengefasst. Offset-Commits oder Verarbeitungsgarantien werden nicht modelliert.

</details>

## Das eigene Projekt visualisieren

Das Plugin gemäß der Installationsanleitung einrichten. In Codex `$q-flow`, in Claude Code `/qgraphflow:q-flow` verwenden. In Qoder und Cursor den Skill über den jeweiligen Client auswählen. Die Anleitung dokumentiert Einrichtung und Prüfstatus der nativen Clients.

> Analysiere Einstiegspunkte, zentrale Komponenten und Beziehungen dieses Moduls. Erstelle ein interaktives Architekturdiagramm auf Deutsch, erhalte Quelldateien und Zeilennummern als Belege und kennzeichne nicht bestätigte Beziehungen.

CodeGraph ist optional. Ohne diese Integration liest der Skill den Quellcode direkt. Standardausgabe im Zielprojekt: `docs/qgraphflow/<scope>-<diagram-type>/`. Ein anderes Verzeichnis kann angegeben werden.

## Auf überprüfbarem Code aufgebaut

Alle neun Beispiele verwenden Apache Kafka, Commit `634a935e7291` (im Checkout deklarierte Version: `4.4.0`). Ausgewählte Belegstellen:

| Ansicht | Quellbeleg |
| --- | --- |
| Architektur | [`ReplicaManager.appendToLocalLog` · L1376](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/core/src/main/scala/kafka/server/ReplicaManager.scala#L1376) |
| Flussdiagramm | [`KafkaProducer.doSend` · L1241](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/KafkaProducer.java#L1241) |
| Sequenzdiagramm | [`KafkaApis.handleProduceRequest` · L457](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/core/src/main/scala/kafka/server/KafkaApis.scala#L457) |
| ER-Diagramm | [`ProduceRequest` · L50](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/resources/common/message/ProduceRequest.json#L50) |
| Deployment-Diagramm | [`controller-1 / controller-2 / controller-3` · L18](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/docker/examples/docker-compose-files/cluster/isolated/plaintext/docker-compose.yml#L18) |
| Klassendiagramm | [`Producer` · L97](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/Producer.java#L97) |
| Zustandsdiagramm | [`STABLE` · L67](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/consumer/internals/MemberState.java#L67) |
| Anwendungsfalldiagramm | [`Producer.send` · L97](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/Producer.java#L97) |
| Datenflussdiagramm | [`KafkaProducer.doSend` · L1197](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/KafkaProducer.java#L1197) |

## Die Beispiele richtig lesen

- Die Wiedergabe zeigt einen erstellten Pfad oder eine Lesereihenfolge der Knoten; sie zeichnet keine Programmausführung auf. Leader-Append, Producer-Bestätigung und abgeschlossene Consumer-Verarbeitung sind verschiedene Ereignisse.
- Die Genauigkeit hängt von den Belegen ab. Wichtige Beziehungen sollten geprüft werden. Quellcode, Schema, Konfiguration, Konvention und Schlussfolgerung werden unterschieden.
- Layoutänderungen fließen in den SVG- / PNG-Export ein, werden aber nicht automatisch in `graph.json` gespeichert.
- Alle Sprachen verwenden dieselben Quellbelege und dieselbe Graphstruktur. Codebezeichner, API-Namen, Schemafelder und Standardnotation bleiben unverändert.

## Entwickeln und beitragen

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

Für die Entwicklung werden Node.js 22, npm, tar, zip und unzip benötigt. Bei Problemen bitte einen minimalen Graphen ohne vertrauliche Daten, Client- und Browserversionen sowie Schritte zur Reproduktion angeben.

[Graphformat](../../skills/q-flow/references/graph-schema.md) · [Anleitung zur Browserprüfung](../../skills/q-flow/references/viewer-development.md)

## Lizenz und Zuordnung

[MIT](../../LICENSE) · [Hinweise zu Drittanbietern](../../THIRD_PARTY_NOTICES.md)

QGraphFlow ist ein unabhängiges Projekt unter der MIT-Lizenz. Apache Kafka dient als Gegenstand der Demonstration. Genannte Produktnamen gehören ihren jeweiligen Rechteinhabern; eine Verbindung, Förderung oder Empfehlung wird nicht behauptet.
