<div align="center">

# QGraphFlow

### Aus komplexem Code werden Diagramme zum Erkunden.

Pfade verfolgen. Belege prüfen. Eine Offline-Datei teilen.

[English](../../README.md) · [中文](../../docs/readme/README.zh-CN.md) · [Русский](../../docs/readme/README.ru.md) · [Português](../../docs/readme/README.pt.md) · [日本語](../../docs/readme/README.ja.md) · [Deutsch](../../docs/readme/README.de.md) · [Español](../../docs/readme/README.es.md)

[Client-Installation](../clients.de.md) · [Problem melden](https://github.com/supermax92/qgraphflow/issues) · [MIT](../../LICENSE)

</div>

![E-Commerce als Architektur, Ablauf und Sequenz: 0,8 Sekunden je Ansicht, 2,4 Sekunden je Schleife, mit bewegten Verbindungslinien](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.de.core-three.gif)

*Neun Diagrammarten: Architektur, Flussdiagramm, Sequenz, ER, Bereitstellung, Klasse, Zustand, Anwendungsfall und Datenfluss.*

QGraphFlow erzeugt interaktive Softwarediagramme aus Quellcode, Datenstrukturen, Konfiguration und Anforderungen. Beziehungen bleiben überprüfbar; das Ergebnis lässt sich als Offline-HTML teilen.

- **Erkunden:** suchen, zoomen und verschieben; Verantwortlichkeiten sowie ein- und ausgehende Beziehungen verstehen.
- **Prüfen:** Dateien, Zeilen, Symbole und ausdrücklich gekennzeichnete Unsicherheiten an Knoten und Kanten untersuchen.
- **Bearbeiten:** Layout entsperren, Texte ändern und Elemente verschieben; bei Bedarf zurücksetzen.
- **Teilen:** Offline-HTML öffnen oder das vollständige Diagramm als SVG / PNG exportieren.

*Erkunden: Navigation öffnen, den Kaufkoordinator suchen und lokalisieren. Ein Klick auf einen Knoten öffnet die Kurzansicht und hebt ein- und ausgehende Kanten hervor. Danach zoomen und den Ausschnitt verschieben.*

![Navigation, Suche, Knotenkurzansicht, hervorgehobene Beziehungen, Zoom und Verschieben](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.de.explore.gif)

*Prüfen: Aus der Kurzansicht die Detailleiste öffnen und Pfade, Zeilennummern und Symbole lesen. Anschließend eine Kante auswählen und ihre Erklärung samt Ableitungskennzeichnung prüfen.*

Pfade, Zeilennummern und Symbole in dieser Interaktionsdemo sind erfunden. Sie zeigen die Beleganzeige und stehen nicht für Repository-Quellcode; Seite und Detailansicht kennzeichnen das ebenfalls. Bei echten Analysen reale Quellen verwenden und unbestätigte Beziehungen als Ableitung markieren.

![Details mit ausdrücklich fiktiven Quellpfaden, Zeilen, Symbolen und abgeleiteten Beziehungen](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.de.verify.gif)

*Bearbeiten: Im Menü **Mehr** das Layout entsperren, Namen und Beschreibung ändern, einen Knoten mit seinen Kanten verschieben und anschließend ursprüngliche Texte und Positionen wiederherstellen.*

![Entsperren, Text bearbeiten, Knoten mit Kanten verschieben und zurücksetzen](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.de.edit.gif)

*Teilen: HTML offline öffnen, über **Mehr** SVG und PNG exportieren und die PNG-Datei zur Prüfung des vollständigen Diagramms öffnen.*

![Offline-HTML, SVG- und PNG-Export sowie die exportierte PNG-Datei](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.de.share.gif)

Die Übersicht zeigt jede der drei Ansichten 0,8 Sekunden lang; eine Schleife dauert 2,4 Sekunden. Die vier Interaktionsanimationen lassen Zeit zum Lesen. Alle Medien verwenden den aus dem Quellcode gebauten Viewer mit deutschen Diagramm- und Oberflächentexten. Die fünf GIFs und neun PNGs liegen als separate [Dateien im Release showcase-v1](https://github.com/supermax92/qgraphflow/releases/tag/showcase-v1) vor; öffentliche Downloads und SHA-256-Prüfsummen wurden geprüft. Sie gehören weder zur Git-Historie noch zum Plugin-Paket; ihre Anzeige benötigt Internetzugang. Die erzeugte Diagramm-HTML selbst funktioniert offline.

## Schnellstart

Nach der [Installationsanleitung](../clients.de.md) aus dem Repository oder einem lokalen Plugin-Verzeichnis installieren. `qgraphflow-local` bezeichnet die Verteilungsquelle des Projekts. Die Quellcodeversion `0.0.2` bedeutet nicht, dass bereits ein gleichnamiges Release-Paket veröffentlicht wurde.

Nach der Installation eine neue Sitzung starten und prüfen, ob `q-flow` in der Skill-Liste erscheint. Die Beispiele verwenden `$qgraphflow:q-flow` in der Codex App. Zeigt der Client `$q-flow`, diesen tatsächlich vorhandenen Eintrag wählen. Aufrufe in anderen Clients stehen in der Installationsanleitung.

**Noch kein Ausgangspunkt?** Den Skill aufrufen und auf Nachfrage Gegenstand und Fragestellung auswählen.

```text
$qgraphflow:q-flow
```

**Das Ziel steht fest?** Beschreiben, welchen Teil das Diagramm zeigen und welche Frage es beantworten soll. Die Diagrammart muss nicht vorab gewählt werden.

### Beispiel 1: Projektarchitektur verstehen

```text
$qgraphflow:q-flow Analysiere dieses Projekt und erstelle ein deutsches Architekturdiagramm mit Verantwortlichkeiten der Module, Abhängigkeiten und Systemgrenzen.
```

Geeignet, um sich erstmals einen Überblick über ein Projekt zu verschaffen.

### Beispiel 2: Einen Geschäftsablauf verfolgen

```text
$qgraphflow:q-flow Analysiere die Bestellerstellung und erstelle ein deutsches Sequenzdiagramm für Preisberechnung, Bestandsreservierung, Zahlung und Speicherung der Bestellung, einschließlich Fehlerzweigen.
```

Bestellerstellung und Schritte durch den tatsächlichen Projektablauf ersetzen. Im selben Gespräch weiterfragen:

```text
$qgraphflow:q-flow Vertiefe die Bestandsreservierung aus dem letzten Diagramm als separates deutsches Flussdiagramm mit Erfolgs- und Fehlerbehandlung.
```

Ergebnisse landen standardmäßig unter `docs/qgraphflow/`. `index.html` zum Erkunden, Bearbeiten und Exportieren öffnen; `graph.json` enthält die Diagrammdaten.

<details>
<summary>Das E-Commerce-Beispiel mit neun Ansichten manuell ausführen</summary>

Diese Befehle dienen dem Repository-Beispiel. Für ein installiertes Plugin muss dieses Repository nicht geklont werden. Mit Node.js 22:

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
node skills/q-flow/scripts/validate-graph.mjs examples/showcase/ecommerce.de.graph.json
node skills/q-flow/scripts/generate-viewer.mjs examples/showcase/ecommerce.de.graph.json output/ecommerce-de
```

`output/ecommerce-de/index.html` im Browser öffnen. Über **Diagrammarten** in der oberen Werkzeugleiste wechseln; gespeicherte Texte und Positionen bleiben je Ansicht erhalten. **Mehr → Graph JSON speichern** sichert alle Ansichten in einer gewählten JSON-Datei; Browser ohne Dateispeicherung laden eine Kopie herunter. Beim Neuladen des ursprünglichen HTML gelten wieder die eingebetteten Daten. Zum erneuten Öffnen der Änderungen aus dem gespeicherten JSON in ein neues Verzeichnis generieren.

Der vorgebaute Viewer benötigt weder zusätzliche Abhängigkeiten noch API-Schlüssel oder Backend. Die KI-gestützte Belegsuche und Diagrammerstellung verwenden den Modelldienst des gewählten Clients.

</details>

## Welche Fragen die neun Ansichten beantworten

| Ansicht · PNG | Hauptfrage | Umfang des Beispiels |
| --- | --- | --- |
| [Architektur](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.de.architecture.png) | Welche Verantwortlichkeiten arbeiten zusammen? | Kanäle, Kaufabschluss, Preise, Risiko, Bestand, Zahlung, Bestellung, Ereignisse und Versand |
| [Flussdiagramm](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.de.flowchart.png) | Wo verzweigt und vereinigt sich der Ablauf? | Fehlbestand, Risikoablehnung, Zahlungskompensation und erfolgreicher Commit |
| [Sequenz](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.de.sequence.png) | In welcher Reihenfolge erfolgen Aufrufe und Antworten? | Erfolgreicher Kauf und asynchrones OrderPaid |
| [ER](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.de.er.png) | Wie hängen die Kerndaten zusammen? | Warenkorb, Bestellungen, Positionen, Zahlungen, Reservierungen und Pakete |
| [Bereitstellung](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.de.deployment.png) | Wo laufen Einheiten und wie sind sie verbunden? | Randnetz, Kubernetes, Datendienste, Zahlung und Logistiknetz |
| [Klasse](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.de.class.png) | Wie hängen Domänenobjekte und Schnittstellen ab? | Kaufdienst, Order und vier Ports |
| [Zustand](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.de.state.png) | Welche Ereignisse und Bedingungen steuern eine Bestellung? | Zahlung, Versand, Stornierung, Erstattung und Abschluss |
| [Anwendungsfall](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.de.usecase.png) | Was kann jeder Akteur tun? | Käufer, Händler, Lager und Betreuung |
| [Datenfluss](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.de.dataflow.png) | Wie werden Daten umgewandelt und gespeichert? | Warenkorb, Transaktionsentscheidungen, Ereignisse, Lager und Empfangsbelege |

Dies ist ein Konzeptmodell zur Demonstration von QGraphFlow, kein konkretes E-Commerce-Repository. Die Beispieldatei `graph.json` erfindet keine Quellpfade und kennzeichnet Beziehungen mit `inference`. Echte Projektdiagramme benötigen nachvollziehbaren Quellcode, DDL, Konfiguration, Tests und akzeptierte Anforderungen.

## Entwickeln und beitragen

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

Erforderlich sind Node.js 22, npm, tar, zip und unzip. Fehlerberichte sollten ein minimales anonymisiertes Diagramm, Client- und Browserversion sowie Reproduktionsschritte enthalten.

[Belegquellen](../references/de/evidence-sources.md) · [Diagrammformat](../references/de/graph-schema.md) · [Geführte Bedarfsklärung](../references/de/guided-intake.md) · [Viewer-Entwicklung](../references/de/viewer-development.md) · [Diagrammgestaltung](../references/de/visual-contract.md)

## Lizenz und Zuordnung

[MIT](../../LICENSE) · [Drittanbieterhinweise](../../THIRD_PARTY_NOTICES.md)

QGraphFlow ist ein unabhängiges Projekt unter MIT-Lizenz. Das Handelsszenario ist konzeptionell und stellt keine Produktionsarchitektur eines Unternehmens dar. Eine Zugehörigkeit, Förderung oder Empfehlung wird nicht behauptet.
