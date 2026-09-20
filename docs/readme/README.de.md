<div align="center">

# QGraphFlow

### Aus komplexem Code werden Diagramme zum Erkunden.

Pfade verfolgen. Belege prüfen. Eine Offline-Datei teilen.

[English](../../README.md) · [中文](../../docs/readme/README.zh-CN.md) · [Русский](../../docs/readme/README.ru.md) · [Português](../../docs/readme/README.pt.md) · [日本語](../../docs/readme/README.ja.md) · [Deutsch](../../docs/readme/README.de.md) · [Español](../../docs/readme/README.es.md)

[Client-Installation](#installationsanleitung) · [Problem melden](https://github.com/supermax92/qgraphflow/issues) · [MIT](../../LICENSE)

</div>

![Architektur, Sequenz und ER des Beispiels agent-desk, je 1,5 Sekunden](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.de.hero.gif)

*Neun Diagrammarten: Architektur, Flussdiagramm, Sequenz, ER, Bereitstellung, Klasse, Zustand, Anwendungsfall und Datenfluss.*

QGraphFlow erzeugt interaktive Softwarediagramme aus Quellcode, Datenstrukturen, Konfiguration und Anforderungen. Beziehungen bleiben überprüfbar; das Ergebnis lässt sich als Offline-HTML teilen.

- **Erkunden:** suchen, zoomen und verschieben; Verantwortlichkeiten sowie ein- und ausgehende Beziehungen verstehen.

  ![Erkunden: nach refund suchen, zu Bestellwerkzeuge springen, herauszoomen bis der Orchestrator oberhalb sowie Bestelldatenbank und Sendungsverfolgung unterhalb sichtbar sind, dann verschieben](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.de.explore.gif)

- **Prüfen:** Dateien, Zeilen, Symbole und ausdrücklich gekennzeichnete Unsicherheiten an Knoten und Kanten untersuchen.

  ![Prüfen: Karte mit src/gateway/chat-gateway.js:5-19, Detailbereich mit Symbol und Belegen, dann die als inference gekennzeichnete Kante POST /chat](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.de.verify.gif)

- **Bearbeiten:** Layout entsperren, Texte ändern und Elemente verschieben; bei Bedarf zurücksetzen.

  ![Bearbeiten: Layout entsperren, LLM-Anbieter in LLM-Gateway umbenennen, mit seinen Kanten verschieben, dann zurücksetzen](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.de.edit.gif)

- **Teilen:** Offline-HTML öffnen oder das vollständige Diagramm als SVG / PNG exportieren.

  ![Teilen: Offline-HTML öffnen, PNG über Mehr exportieren, dann die exportierte Datei selbst](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.de.share.gif)

Die obere Animation zeigt Architektur, Sequenz und ER je 1,5 Sekunden (4,5 Sekunden pro Schleife); die vier Funktionsanimationen dauern 6,5–8,5 Sekunden. Alle wurden im aus dem Quellcode gebauten Viewer am [Beispiel agent-desk](../../examples/showcase/agent-desk) aufgenommen — fiktives Geschäft, echter Code — mit deutschem Diagramm- und Oberflächentext. Sie liegen als [Assets des Release showcase-v2](https://github.com/supermax92/qgraphflow/releases/tag/showcase-v2) außerhalb der Git-Historie und des Plugin-Pakets, zum Betrachten ist also eine Netzverbindung nötig; das erzeugte Diagramm-HTML selbst funktioniert offline.

## Installationsanleitung

Benötigt werden Node.js 22 und ein Client mit Plugin-Unterstützung und eingerichtetem Modellzugriff.

[Qoder Desktop](#qoder-desktop) kann das Plugin direkt aus dem Marketplace installieren; Schritt 1 entfällt.

### 1. Plugin herunterladen

[qgraphflow-0.0.5.zip](https://github.com/supermax92/qgraphflow/releases/download/v0.0.5/qgraphflow-0.0.5.zip) herunterladen und in ein eigenes Verzeichnis entpacken. Versteckte Dateien beibehalten.

Alle folgenden Terminalbefehle im **entpackten Plugin-Stammverzeichnis mit `skills/`** ausführen.

### 2. Im gewünschten Client installieren

#### Codex App / CLI

Codex CLI muss installiert und im Terminal verfügbar sein:

```bash
codex plugin marketplace add .
codex plugin add qgraphflow@supermax92
```

Eine neue Sitzung starten, `$` eingeben und `qgraphflow:q-flow` auswählen.

#### Claude Code

Direkt von GitHub installieren, ohne das ZIP herunterzuladen:

```bash
claude plugin marketplace add supermax92/qgraphflow
claude plugin install qgraphflow@supermax92 --scope user
```

Oder aus dem entpackten Plugin-Stammverzeichnis:

```bash
claude plugin marketplace add .
claude plugin install qgraphflow@supermax92 --scope user
```

Eine neue Sitzung starten und `/q-flow` (oder den vollständigen Namen `/qgraphflow:q-flow`) eingeben.

#### Qoder CLI

```bash
qodercli plugins install .
```

Eine neue Sitzung starten und `q-flow` auswählen.

#### Qoder Desktop

**Empfohlen:** Öffne **Settings → Plugins → Marketplace**, suche nach **代码图谱可视化** oder **qgraphflow** und installiere das Plugin. Starte eine neue Sitzung und wähle `q-flow`. Ein ZIP-Download oder ein Build aus dem Quellcode ist nicht erforderlich.

Für eine lokale Installation führe zuerst Schritt 1 aus. Öffne dann **Settings → Plugins → Custom → Import** und importiere das vollständige entpackte Plugin-Stammverzeichnis. Starte eine neue Sitzung und wähle `q-flow`.

#### Cursor

Den gesamten Inhalt des Plugin-Stammverzeichnisses einschließlich versteckter Dateien hierhin kopieren:

```text
~/.cursor/plugins/local/qgraphflow/
```

Prüfen, ob dort `.cursor-plugin/plugin.json` vorhanden ist, das Fenster neu laden und `q-flow` unter **Customize** suchen. Eine vorhandene ältere Version zuerst sichern; alte und neue Dateien nicht vermischen.

### 3. Loslegen

Das eigene Projekt im Client öffnen, eine neue Sitzung starten und den Skill wählen. Die Aufgabe anhand der Beispiele unter [Schnellstart](#schnellstart) beschreiben. Das erzeugte HTML im Browser öffnen.

<details>
<summary>Alternative Installation: GitHub npm</summary>

Statt der ZIP-Datei kann das Plugin auch über npm bezogen werden.

GitHub npm benötigt einen eigenen GitHub **Personal access token (classic)** mit der Berechtigung `read:packages`. Beim Anmelden den eigenen GitHub-Benutzernamen und das Token als Passwort verwenden.

Das Token nicht weitergeben oder ins Repository committen. Siehe [GitHub-Authentifizierung](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).

```bash
npm config set @supermax92:registry=https://npm.pkg.github.com --location=user
npm login --scope=@supermax92 --auth-type=legacy --registry=https://npm.pkg.github.com
```

Ein eigenes Verzeichnis außerhalb des Anwendungsprojekts erstellen:

```bash
mkdir qgraphflow-install
cd qgraphflow-install
npm install @supermax92/qgraphflow@0.0.5 --ignore-scripts
cd node_modules/@supermax92/qgraphflow
```

Nun im Plugin-Stammverzeichnis mit den Installationsschritten für den gewünschten Client oben fortfahren. **Der Download über npm installiert das Plugin nicht automatisch im Client.**

</details>

Selbst bauen? Siehe [Anleitung zum Bauen aus dem Quellcode](https://github.com/supermax92/qgraphflow/blob/main/docs/distribution.md#prepare-locally).

## Schnellstart

Die Beispiele verwenden `$qgraphflow:q-flow` in Codex. Zeigt der Client `$q-flow`, diesen Eintrag wählen. In anderen Clients den oben beschriebenen Skill-Aufruf verwenden.

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
| Architektur | Welche Verantwortlichkeiten arbeiten zusammen? | Kanäle, Kaufabschluss, Preise, Risiko, Bestand, Zahlung, Bestellung, Ereignisse und Versand |
| Flussdiagramm | Wo verzweigt und vereinigt sich der Ablauf? | Fehlbestand, Risikoablehnung, Zahlungskompensation und erfolgreicher Commit |
| Sequenz | In welcher Reihenfolge erfolgen Aufrufe und Antworten? | Erfolgreicher Kauf und asynchrones OrderPaid |
| ER | Wie hängen die Kerndaten zusammen? | Warenkorb, Bestellungen, Positionen, Zahlungen, Reservierungen und Pakete |
| Bereitstellung | Wo laufen Einheiten und wie sind sie verbunden? | Randnetz, Kubernetes, Datendienste, Zahlung und Logistiknetz |
| Klasse | Wie hängen Domänenobjekte und Schnittstellen ab? | Kaufdienst, Order und vier Ports |
| Zustand | Welche Ereignisse und Bedingungen steuern eine Bestellung? | Zahlung, Versand, Stornierung, Erstattung und Abschluss |
| Anwendungsfall | Was kann jeder Akteur tun? | Käufer, Händler, Lager und Betreuung |
| Datenfluss | Wie werden Daten umgewandelt und gespeichert? | Warenkorb, Transaktionsentscheidungen, Ereignisse, Lager und Empfangsbelege |

Dies ist ein Konzeptmodell zur Demonstration von QGraphFlow, kein konkretes E-Commerce-Repository. Die Beispieldatei `graph.json` erfindet keine Quellpfade und kennzeichnet Beziehungen mit `inference`. Echte Projektdiagramme benötigen nachvollziehbaren Quellcode, DDL, Konfiguration, Tests und akzeptierte Anforderungen.

## Entwickeln und beitragen

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

Erforderlich sind Node.js 22, npm, tar, zip und unzip. Fehlerberichte sollten ein minimales anonymisiertes Diagramm, Client- und Browserversion sowie Reproduktionsschritte enthalten.

Referenzdokumentation (Englisch): [Belegquellen](../../skills/q-flow/references/evidence-sources.md) · [Diagrammformat](../../skills/q-flow/references/graph-schema.md) · [Geführte Bedarfsklärung](../../skills/q-flow/references/guided-intake.md) · [Viewer-Entwicklung](../../skills/q-flow/references/viewer-development.md) · [Diagrammgestaltung](../../skills/q-flow/references/visual-contract.md)

## Lizenz und Zuordnung

[MIT](../../LICENSE) · [Drittanbieterhinweise](../../THIRD_PARTY_NOTICES.md)

QGraphFlow ist ein unabhängiges Projekt unter MIT-Lizenz. Die Szenarien in diesem Dokument sind konzeptionell und stellen keine Produktionsarchitektur eines Unternehmens dar. Eine Zugehörigkeit, Förderung oder Empfehlung wird nicht behauptet.
