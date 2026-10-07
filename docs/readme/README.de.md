<div align="center">

<h1><picture><source media="(prefers-color-scheme: dark)" srcset="../images/brand/qgraphflow-lockup-dark.svg"><img src="../images/brand/qgraphflow-lockup-light.svg" alt="QGraphFlow" height="64"></picture></h1>

### Aus komplexem Code werden Diagramme zum Erkunden.

Pfade verfolgen. Belege prüfen. Eine Offline-Datei teilen.

<sub>💡 Inspiriert von <a href="https://github.com/Cocoon-AI/architecture-diagram-generator">Cocoon-AI/architecture-diagram-generator</a> – vielen Dank für die Anregung.</sub>

[English](../../README.md) · [中文](../../docs/readme/README.zh-CN.md) · [Русский](../../docs/readme/README.ru.md) · [Português](../../docs/readme/README.pt.md) · [日本語](../../docs/readme/README.ja.md) · [Deutsch](../../docs/readme/README.de.md) · [Español](../../docs/readme/README.es.md)

[Online-Demo](https://supermax92.github.io/qgraphflow/) · [Erste Schritte](#erste-schritte) · [Client-Installation](#installationsanleitung) · [Problem melden](https://github.com/supermax92/qgraphflow/issues) · [MIT](../../LICENSE)

</div>

*Elf Diagrammarten: Plattformfähigkeitsarchitektur, Architektur der Engineering-Schichten, Komponentenbeziehungsarchitektur, Flussdiagramm, Sequenz, ER, Bereitstellung, Klasse, Zustand, Anwendungsfall und Datenfluss.*

QGraphFlow erzeugt interaktive Softwarediagramme aus Quellcode, Datenstrukturen, Konfiguration und Anforderungen. Beziehungen bleiben überprüfbar; das Ergebnis lässt sich als Offline-HTML teilen.

**Was es auszeichnet:** elf Diagrammarten in einem Skill, eine Belegart für jede Beziehung und die Quellzeile hinter jeder durch Code gestützten, automatisches Layout, Bearbeiten direkt auf der Seite und keine Netzwerkanfragen von den Plugin-Skripten oder dem Viewer selbst.

![Interaktive Jeepay-Demo mit mehreren Ansichten: Komponentenbeziehungsarchitektur, Sequenz- und ER-Diagramme](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/jeepay.en.hero.gif)

Wechsle anhand des echten Jeepay-Quellcodes zwischen Komponentenbeziehungsarchitektur, Sequenz- und ER-Diagrammen, um Komponenten und Aufrufbeziehungen zu erkunden. [GIF in Originalgröße ansehen](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/jeepay.en.hero.gif)

**Präsentation eines komplexen Sequenzdiagramms**

![Schrittweises Zeichnen eines komplexen Sequenzdiagramms: Teilnehmer, Lebenslinien, Nachrichten, Aktivierungsbalken und verschachtelte kombinierte Fragmente](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/checkout.en.sequence-drawing.gif)

Ein fiktives E-Commerce-Szenario enthält 9 Teilnehmer, 29 Nachrichten und 6 kombinierte Fragmente mit Bestandswiederholungen, verschachtelten Zweigen, paralleler Verarbeitung, Fehlerkompensation und asynchronen Rückrufen. Die Animation zeigt das erzeugte Diagramm schrittweise und macht seine Struktur und Details sichtbar. [GIF in Originalgröße ansehen](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/checkout.en.sequence-drawing.gif)

```bash
npx skills add supermax92/qgraphflow
```

Ein Befehl installiert den Skill für Claude Code, Codex, Cursor und Qoder; die Installation als Plugin und weitere Clients beschreibt die [Installationsanleitung](#installationsanleitung).

- **Erkunden:** suchen, zoomen und verschieben; Verantwortlichkeiten sowie ein- und ausgehende Beziehungen verstehen.

- **Prüfen:** Dateien, Zeilen, Symbole und ausdrücklich gekennzeichnete Unsicherheiten an Knoten und Kanten untersuchen.

- **Bearbeiten:** Layout entsperren, Texte ändern und Elemente verschieben; bei Bedarf zurücksetzen.

- **Teilen:** Offline-HTML öffnen oder das vollständige Diagramm als SVG / PNG exportieren.

Der auf echtem Quellcode beruhende [Jeepay-Korpus](../../examples/jeepay) enthält alle elf Ansichten, die CI und die Online-Demo verwenden.

## Erste Schritte

Öffne nach der Installation dein Geschäftsprojekt im Client und wähle den Skill `q-flow`. Die Beispiele verwenden `/q-flow` in Claude Code; in Codex verwendest du den Eintrag `$q-flow` oder `$qgraphflow:q-flow`, den dein Client tatsächlich anbietet. Noch nicht installiert? Lies zuerst die [Installationsanleitung](#installationsanleitung).

### 1. Leere Eingabe: Du weißt nicht, wo du anfangen sollst

Rufe den Skill ohne zusätzliche Anforderungen auf:

```text
/q-flow
```

Der Skill hilft dir, den zu analysierenden Teil und die Frage auszuwählen, die das Diagramm beantworten soll. Sobald die nötigen Informationen geklärt sind, beginnt das Zeichnen.

### 2. Nach Fähigkeiten fragen: Erfahren, was er zeichnen kann

```text
/q-flow Welche Diagrammarten kannst du zeichnen? Welche Fragen beantwortet jede Art? Ich habe gerade ein Projekt übernommen; stelle deine Fähigkeiten vor und schlage einen Einstieg vor.
```

Lerne zuerst die Einsatzgebiete der elf Diagrammarten kennen. Entscheide dann, ob du Projektstruktur, Aufrufreihenfolge, Datenbeziehungen oder etwas anderes betrachten möchtest.

### 3. Vage Eingabe: Nur ein grobes Ziel

```text
/q-flow Hilf mir, dieses Projekt zu zeichnen. Ich möchte es möglichst schnell verstehen.
```

Du musst vorher keine Diagrammart angeben. Der Skill bestimmt anhand des Projekts und deines Ziels eine passende Ansicht und fragt nach, wenn notwendige Informationen fehlen.

### 4. Präzise Eingabe: Umfang festlegen und Zeichnungsdetails anfordern

Ersetze die folgenden Geschäftsbegriffe und Schritte durch Abläufe, die tatsächlich in deinem Projekt vorkommen:

```text
/q-flow Analysiere die Bestellerstellung im aktuellen Projekt und erzeuge ein Sequenzdiagramm auf Chinesisch.
Berücksichtige den Anfrageeingang, die Preisberechnung, Bestandsreservierung, Zahlungsautorisierung und Speicherung der Bestellung.
Erhalte die synchronen Aufrufe, asynchronen Nachrichten, gepaarten Rückgaben, Aktivierungsbalken, bedingten Zweige, Wiederholungen und Fehlerkompensationen, die tatsächlich im Quellcode vorkommen. Lasse keine Details zugunsten der Kürze weg.
Kennzeichne Quelldateien und Zeilennummern der Komponenten und Aufrufe und speichere das Ergebnis unter docs/qgraphflow/order-sequence/.
```

Benenne Gegenstand, Frage, Detailgrad und Ausgabeort klar, damit es direkt losgehen kann. Das Diagramm enthält nur durch Belege gestützte Fakten.

### 5. Weiter verfeinern: Einen Teil des letzten Diagramms vertiefen

Fahre nach der Erzeugung des Ergebnisses im selben Gespräch fort:

```text
/q-flow Vertiefe die Bestandsreservierung aus dem letzten Sequenzdiagramm als separates Flussdiagramm auf Chinesisch.
Zeige sämtliche Zweige für Bestandsprüfung, erfolgreiche Reservierung, wiederholbare Fehler, Wiederholungslimit und Bestandsfreigabe. Halte dich an den Quellcode und füge keine dort fehlenden Schritte hinzu.
```

Betrachte zuerst das Ganze und vertiefe dann einen Schritt. Du kannst auch weitere Details für ein vorhandenes Diagramm anfordern oder seine Beziehungen prüfen.

## Installationsanleitung

Benötigt werden Node.js 22 oder neuer und ein Client mit Plugin-Unterstützung und eingerichtetem Modellzugriff.

### Schnellinstallation

```bash
npx skills add supermax92/qgraphflow
```

Getestet mit `skills` 1.7.0 für Claude Code, Codex, Cursor und Qoder. Der Befehl fragt, in welche Clients installiert werden soll; `-a claude-code` gibt einen direkt an, `-g` installiert für den eigenen Benutzer statt für das aktuelle Projekt. Der Skill heißt danach `q-flow`, ohne das Präfix `qgraphflow:` der Plugin-Installationen unten.

Für die Installation als Plugin den folgenden Schritten folgen. [Qoder Desktop](#qoder-desktop) kann das Plugin direkt aus dem Marketplace installieren; Schritt 1 entfällt.

### 1. Plugin herunterladen

Das Plugin von npmjs.com beziehen, ohne Konto, Anmeldung oder Token. Ein eigenes Verzeichnis außerhalb des Anwendungsprojekts erstellen:

```bash
mkdir qgraphflow-install
cd qgraphflow-install
npm install qgraphflow --ignore-scripts
cd node_modules/qgraphflow
```

Nun befindet man sich im Plugin-Stammverzeichnis. **Der Download über npm installiert das Plugin nicht automatisch im Client;** mit Schritt 2 fortfahren. Das Paket stellt außerdem den Befehl `qgraphflow` bereit, den [Diagramme mit dem Code synchron halten](#diagramme-mit-dem-code-synchron-halten) verwendet.

Alle folgenden Terminalbefehle im **Plugin-Stammverzeichnis mit `skills/`** ausführen.

### 2. Im gewünschten Client installieren

#### Codex App / CLI

Codex CLI muss installiert und im Terminal verfügbar sein:

```bash
codex plugin marketplace add .
codex plugin add qgraphflow@supermax92
```

Eine neue Sitzung starten, `$` eingeben und `qgraphflow:q-flow` auswählen.

#### Claude Code

```bash
claude plugin marketplace add ./
claude plugin install qgraphflow@supermax92 --scope user
```

Eine neue Sitzung starten und `/q-flow` (oder den vollständigen Namen `/qgraphflow:q-flow`) eingeben.

#### Qoder CLI

```bash
qodercli plugins install .
```

Eine neue Sitzung starten und `q-flow` auswählen.

#### Qoder Desktop

**Empfohlen:** Öffne **Settings → Plugins → Marketplace**, suche nach **QGraphFlow** oder **代码图谱可视化** und installiere das Plugin. Starte eine neue Sitzung und wähle `q-flow`.

Für eine lokale Installation führe zuerst Schritt 1 aus. Öffne dann **Settings → Plugins → Custom → Import** und importiere das vollständige Plugin-Stammverzeichnis. Starte eine neue Sitzung und wähle `q-flow`.

#### Cursor

Den gesamten Inhalt des Plugin-Stammverzeichnisses einschließlich versteckter Dateien hierhin kopieren:

```text
~/.cursor/plugins/local/qgraphflow/
```

Prüfen, ob dort `.cursor-plugin/plugin.json` vorhanden ist, das Fenster neu laden und `q-flow` unter **Customize** suchen. Eine vorhandene ältere Version zuerst sichern; alte und neue Dateien nicht vermischen.

### 3. Loslegen

Öffne dein Geschäftsprojekt im Client, starte eine neue Sitzung und wähle den Skill. Beschreibe deine Anforderungen anhand der Beispiele unter [Erste Schritte](#erste-schritte). Öffne das erzeugte HTML im Browser.

Selbst bauen? Siehe [Anleitung zum Bauen aus dem Quellcode](https://github.com/supermax92/qgraphflow/blob/main/docs/distribution.md#prepare-locally).

## Schnell verwenden

Die Beispiele verwenden `$qgraphflow:q-flow` in Codex. Zeigt der Client `$q-flow`, diesen Eintrag wählen. In anderen Clients den oben beschriebenen Skill-Aufruf verwenden.

**Noch kein Ausgangspunkt?** Den Skill aufrufen und auf Nachfrage Gegenstand und Fragestellung auswählen.

```text
$qgraphflow:q-flow
```

**Das Ziel steht fest?** Beschreiben, welchen Teil das Diagramm zeigen und welche Frage es beantworten soll. Die Diagrammart muss nicht vorab gewählt werden.

### Beispiel 1: Projektarchitektur verstehen

```text
$qgraphflow:q-flow Analysiere dieses Projekt und erstelle ein chinesisches Architekturdiagramm mit Verantwortlichkeiten der Module, Abhängigkeiten und Systemgrenzen.
```

Geeignet, um sich erstmals einen Überblick über ein Projekt zu verschaffen.

### Beispiel 2: Einen Geschäftsablauf verfolgen

```text
$qgraphflow:q-flow Analysiere die Bestellerstellung und erstelle ein chinesisches Sequenzdiagramm für Preisberechnung, Bestandsreservierung, Zahlung und Speicherung der Bestellung, einschließlich Fehlerzweigen.
```

Bestellerstellung und Schritte durch den tatsächlichen Projektablauf ersetzen. Im selben Gespräch weiterfragen:

```text
$qgraphflow:q-flow Vertiefe die Bestandsreservierung aus dem letzten Diagramm als separates chinesisches Flussdiagramm mit Erfolgs- und Fehlerbehandlung.
```

Ergebnisse landen standardmäßig unter `docs/qgraphflow/`. `index.html` zum Erkunden, Bearbeiten und Exportieren öffnen; `graph.json` enthält die Diagrammdaten. Jede Ansicht wird außerdem als SVG geschrieben (`diagram.svg`, bei mehreren Ansichten `diagram-<n>-<type>.svg`), das sich als Bild in eine README, einen Pull Request oder ein Wiki einbinden lässt.

Nach Änderungen auf der Seite schreibt **Mehr → Änderungen speichern** in Chrome oder Edge Seite, `graph.json` und SVGs direkt zurück, sobald der Diagrammordner einmal gewählt ist. Andere Browser speichern nur `graph.json`: die Datei in den Ordner legen und Seite und SVGs mit `npx -y qgraphflow generate docs/qgraphflow/<name>/graph.json docs/qgraphflow/<name> --layout preserve --force` neu erzeugen.

<details>
<summary>Das Jeepay-Quellcodebeispiel mit elf Ansichten ausführen</summary>

Wähle deine lokale Jeepay-Quellcodekopie, um die Belege zu prüfen:

```bash
export JEEPAY_REPO_ROOT="<local Jeepay repository root>"
node skills/q-flow/scripts/validate-graph.mjs examples/jeepay/collection.graph.json --input-only --repo-root "$JEEPAY_REPO_ROOT"
node skills/q-flow/scripts/generate-viewer.mjs examples/jeepay/collection.graph.json output/jeepay --repo-root "$JEEPAY_REPO_ROOT"
```

Öffne `output/jeepay/index.html`; die elf SVGs liegen im selben Verzeichnis. Die Quellcoderevision und das Aktualisierungsverfahren stehen in der [Korpus-README](../../examples/jeepay).

</details>

## Diagramme mit dem Code synchron halten

Ein mit Repository-Wurzel erzeugtes Diagramm hält fest, wo jede Komponente definiert ist, und die Zeile hinter jeder durch Code gestützten Beziehung (ein Aufruf, ein Fremdschlüssel). Die Prüfung mit `--repo-root` schlägt fehl, wenn eine erfasste Datei fehlt, ein Zeilenbereich nicht mehr in die Datei passt oder ein erfasstes Symbol seine Zeilen verlassen hat; die Meldung nennt die Zeilen, in denen das Symbol jetzt steht. Diesen Job in die CI aufnehmen; er braucht keinen Build, keine Anmeldung und kein Token:

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

Schlägt er fehl, den Skill bitten, dieses Diagramm zu aktualisieren:

```text
$qgraphflow:q-flow Laut CI ist docs/qgraphflow/order-sequence veraltet. Bitte aktualisieren.
```

Der Skill verschiebt Anker, deren Symbol er genau einmal in der Datei findet, korrigiert nur die weiterhin gemeldeten Anker und erzeugt Seite und SVGs neu, wobei bearbeitete Positionen und Texte erhalten bleiben. Er zeichnet das Diagramm nicht neu.

## Welche Fragen die elf Diagrammarten beantworten

| Ansicht · PNG | Hauptfrage | Umfang des Beispiels |
| --- | --- | --- |
| Plattformfähigkeitsarchitektur | Welche Fähigkeiten bietet die Plattform? | Fähigkeitsbereiche und Matrizen |
| Architektur der Engineering-Schichten | Wie ist der Projektcode organisiert? | Engineering-Schichten und gemeinsame Unterstützung |
| Komponentenbeziehungsarchitektur | Welche Verantwortungsgrenzen arbeiten im System zusammen? | Kanäle, Transaktionsorchestrierung, Preise, Risiko, Bestand, Zahlung, Bestellungen, Ereignisse und Auftragsabwicklung |
| Flussdiagramm | Wie verzweigt und vereinigt sich jeder Entscheidungspunkt? | Fehlbestand, Risikoablehnung, Kompensation bei Zahlungsfehlern und erfolgreicher Commit |
| Sequenz | In welcher Reihenfolge führt eine Anfrage Aufrufe aus und erhält Rückgaben? | Hauptpfad eines erfolgreichen Kaufabschlusses und asynchrones OrderPaid |
| ER | Wie hängen die Kerndaten zusammen? | Warenkorb, Bestellungen, Positionen, Zahlungen, Bestandsreservierungen und Pakete |
| Bereitstellung | Wo werden Laufzeiteinheiten platziert und wie sind sie verbunden? | Randnetz, Kubernetes, Datendienste, Zahlung und Lager-/Logistiknetze |
| Klasse | Wie hängen Domänenobjekte und Codeverträge voneinander ab? | Checkout-Anwendungsdienst, Order und vier Ports |
| Zustand | Welche Ereignisse und Wächterbedingungen treiben eine Bestellung voran? | Zahlung, Auftragsabwicklung, Stornierung, Erstattung und Abschluss |
| Anwendungsfall | Welche Fähigkeiten besitzt jeder Akteur? | Käufer, Händler, Lager und Kundendienst |
| Datenfluss | Welche Transformationen und Speicher durchlaufen Datenbestände? | Warenkorb, Transaktionsentscheidungen, Bestellereignisse, Lager/Logistik und Lieferbelege |

Dies ist ein Konzeptmodell zur Demonstration von QGraphFlow, kein konkretes E-Commerce-Repository. Die Beispieldatei `graph.json` erfindet keine Quellpfade und kennzeichnet Beziehungen mit `inference`. Echte Projektdiagramme benötigen nachvollziehbaren Quellcode, DDL, Konfiguration, Tests und akzeptierte Anforderungen.

## Entwickeln und beitragen

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

Erforderlich sind Node.js 22 oder neuer, npm, tar, zip und unzip. Fehlerberichte sollten ein minimales anonymisiertes Diagramm, Client- und Browserversion sowie Reproduktionsschritte enthalten.

Referenzdokumentation (Englisch): [Belegquellen](../../skills/q-flow/references/evidence-sources.md) · [Diagrammformat](../../skills/q-flow/references/graph-schema.md) · [Geführte Bedarfsklärung](../../skills/q-flow/references/guided-intake.md) · [Viewer-Entwicklung und Abnahme](../../skills/q-flow/references/viewer-development.md) · [Diagrammgestaltung](../../skills/q-flow/references/visual-contract.md)

## Lizenz und Zuordnung

[MIT](../../LICENSE) · [Drittanbieterhinweise](../../THIRD_PARTY_NOTICES.md)

QGraphFlow ist ein unabhängiges Projekt unter MIT-Lizenz. Die Szenarien in diesem Dokument sind konzeptionelle Beispiele und stellen keine Produktionsarchitektur eines realen Unternehmens dar.

## Architekturübersichten

Architektur umfasst jetzt Komponentenbeziehungen, Plattformfähigkeiten und Engineering-Schichten. Beschreibe den Gegenstand und die Frage; der Skill wählt die Vorlage. Angeforderte Sammlungen können mehrere Architekturansichten mit unabhängigen Bearbeitungen enthalten.

```text
$qgraphflow:q-flow Analysiere die Plattformfähigkeiten und die geschäftlichen Integrationswege des aktuellen Projekts und erzeuge eine Übersicht der Plattformfähigkeiten auf Chinesisch.
$qgraphflow:q-flow Analysiere die Organisation des aktuellen Projekts und seine Komponentenschichten und erzeuge chinesische Übersichten des Gesamtprojekts und eines Komponentenquerschnitts.
$qgraphflow:q-flow Erzeuge eine englische Übersicht der Plattformfähigkeiten dieses Projekts und zeige, wie sich Anwendungsmodule integrieren.
```

Siehe [examples/jeepay](../../examples/jeepay) für quellenbasierte Architekturansichten zu Plattform, Engineering und Komponentenbeziehungen. Entsperre eine Übersicht, um Karten innerhalb einer Schicht neu anzuordnen oder Texte zu bearbeiten. Speichern erhält alle Ansichten; Zurücksetzen stellt nur die aktuelle wieder her.
