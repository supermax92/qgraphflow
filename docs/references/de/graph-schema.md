# Graph-JSON-Vertrag

[English](../../../skills/q-flow/references/graph-schema.md) · [简体中文](../zh-CN/graph-schema.md) · [Русский](../ru/graph-schema.md) · [Português](../pt/graph-schema.md) · [日本語](../ja/graph-schema.md) · [Deutsch](graph-schema.md) · [Español](../es/graph-schema.md)

`scripts/generate-viewer.mjs` akzeptiert einen `Graph` oder eine Sammlung. Alte Graphen ohne `meta.diagramType` bleiben gültig und werden als `architecture` dargestellt. Die Ausschnitte zeigen die Feldstruktur; vor dem Ausführen referenzierte Knoten ergänzen und das Layout validieren.

```json
{
  "meta": {
    "title": "Required title",
    "diagramType": "architecture",
    "subtitle": "Optional supporting line",
    "sourceRef": "Branch, commit, document version, or evidence scope",
    "scope": "Verified evidence scope",
    "generatedAt": "ISO-8601 timestamp"
  },
  "groups": [
    {
      "id": "runtime-boundary",
      "label": "Consumer application JVM",
      "kind": "runtime",
      "position": { "x": 40, "y": 80 },
      "size": { "width": 1440, "height": 620 }
    }
  ],
  "nodes": [
    {
      "id": "jwt-decoder",
      "label": "NimbusJwtDecoder",
      "subtitle": "Verify and decode JWT",
      "module": "Identity",
      "kind": "security",
      "position": { "x": 720, "y": 220 },
      "size": { "width": 220, "height": 120 },
      "source": {
        "kind": "source",
        "file": "module/src/main/java/example/Config.java",
        "lineStart": 111,
        "lineEnd": 130,
        "symbol": "jwtDecoder"
      },
      "facts": ["Built from issuer-uri"],
      "tags": ["JWT", "Spring Security"]
    }
  ],
  "edges": [
    {
      "id": "decode-token",
      "source": "bearer-filter",
      "target": "jwt-decoder",
      "label": "decode and verify",
      "module": "Identity",
      "kind": "call",
      "evidence": "framework",
      "route": {
        "via": [{ "x": 640, "y": 180 }],
        "labelAt": { "x": 640, "y": 156 }
      }
    }
  ]
}
```

Standardmäßig einen Graphen verwenden; einzelne Seiten haben kein Typmenü. Für angeforderte Mehrfachansichten 1–9 Graphen in `diagrams` verpacken. Jeder `meta.diagramType` muss eindeutig sein. Das vertikale Werkzeugleistenmenü folgt unabhängig von der Eingabereihenfolge `architecture`, `flowchart`, `sequence`, `er`, `deployment`, `class`, `state`, `usecase`, `dataflow`.

```json
{
  "diagrams": [
    { "meta": { "title": "System", "diagramType": "architecture", "sourceRef": "main" }, "nodes": [], "edges": [] },
    { "meta": { "title": "Request", "diagramType": "sequence", "sourceRef": "main" }, "nodes": [], "edges": [] }
  ]
}
```

Die verkürzten Beispiele zeigen nur die äußere Struktur. Jeder Graph muss den vollständigen Vertrag erfüllen und nicht leere Knoten enthalten.

## Gemeinsame Felder

- Pflicht: `meta.title`, `meta.sourceRef`, nicht leeres `nodes` und `edges`.
- `meta`, Knoten, Kanten, Gruppen und Quellanker sind Objekte; `nodes`, `edges` und optional `groups` sind Objektarrays. Ungültige Container werden vor Layout und Generierung abgelehnt.
- Optionale `meta.subtitle`, `meta.scope`, Knoten-`subtitle`, `source.symbol` und Kanten-`label` sind Zeichenfolgen. Optionale `module`-Werte an Knoten/Kanten sind nicht leere Zeichenfolgen: über alle Ansichten exakt denselben Wert für dasselbe Geschäftsmodul verwenden, keine literalen Farben speichern. Knoten-`facts`, `tags`, `attributes` und `methods` sind Arrays nicht leerer Zeichenfolgen. Diese Regeln gelten für jeden Diagrammtyp.
- Optionales `fields` ist ein Objektarray mit nicht leeren Zeichenfolgen `name` und `type`, optionalem `key` (`PK`, `FK`, `UK`) und optionalem booleschen `nullable`. ER benötigt mindestens ein Feld; andere Typen können Felder in Suche und Details zeigen.
- `meta.diagramType`: `architecture`, `flowchart`, `sequence`, `er`, `deployment`, `class`, `state`, `usecase`, `dataflow`.
- `meta.locale`: optionale Viewer-Sprache `en`, `zh-CN` (Standard), `ru`, `pt`, `ja`, `de`, `es`; für ältere Graphen bleiben `ko` und `fr` unterstützt. Sie steuert eingebaute Oberfläche und Exportlabels. Titel, Knotennamen, Fakten und Beziehungstexte separat in der Zielsprache verfassen. Codebezeichner und Standardnotation bleiben unverändert. Jeder Graph einer Sammlung nutzt seine eigene Sprache.
- IDs sind eindeutige, nicht leere Zeichenfolgen. Jeder Kantenendpunkt benennt einen Knoten.
- Alle Knoten und Gruppen besitzen endliche, nicht negative `position`- und `size`-Werte.
- Kanten-`evidence`: `source`, `code`, `config`, `schema`, `test`, `document`, `framework`, `inference`.
- `route` ist optional: `via` enthält Wegpunkte im Graphkoordinatensystem, `labelAt` fixiert die Labelmitte. Beides weglassen, wenn automatische orthogonale Routen klar sind.
- Koordinaten in `route.via` und `route.labelAt` müssen endlich und nicht negativ sein. Der Router fügt rechtwinklige Bögen zwischen Wegpunkten ein; Anfang und Ende bleiben an aktuellen Knotenpositionen verankert.
- Optionales `source.kind` verwendet dieselben Belegwerte. `source.file` und `source.lineStart` benennen den exakten Anker.
- Mit `--repo-root <directory>` lesen Validierung und Generierung jede `source.file` als repositoryrelativen UTF-8-Text und prüfen den einschließlich beider Enden gültigen Zeilenbereich. Absolute Pfade, übergeordnete Traversierung, Verzeichnisse, Binärdateien und Symlinks außerhalb der Wurzel werden abgelehnt. Mehrfachreferenzen teilen einen Lesevorgang. Ohne Wurzel werden vorhandene Quellanker als `skipped`, fehlende Anker als `not-applicable` protokolliert. Geprüft wird der lokale Arbeitsbaum, nicht Versionsidentität von `sourceRef`, Symbolauflösung oder sachliche Richtigkeit.
- Für den Geschäftskern den vorhandenen `business`-Kind verwenden, wo unterstützt, oder `core`/`business` in `tags` aufnehmen (ohne Beachtung der Großschreibung). Den erlaubten Knotentyp behalten; `core` ist weder neuer Kind noch neues Schemafeld.
- Das kühle neutrale Farbsystem ist eine Viewer-Regel. Farbe, Typografie und Kernbetonung benötigen keine zusätzlichen Graphfelder. Das Bestell-/Versand-Vorschaumodell ist Beispielinhalt, kein Standarddatensatz oder Beleg.

Alte `playback`-Metadaten werden ignoriert. Es gibt keine automatische oder schrittweise Wiedergabe. Gerichtete Kantenbewegung ist ein unabhängiger visueller Hinweis und behauptet keine Ausführungsreihenfolge.

## Viewer-Änderungen speichern

Ansichtswechsel bewahren Texte und Positionen jedes Graphen innerhalb der geöffneten Seite. Zurücksetzen stellt nur den aktiven Graphen aus seinen ursprünglichen eingebetteten Daten wieder her. **Graph JSON speichern** sichert die ganze Sammlung bzw. das ursprüngliche Einzelgraphformat einschließlich anderer Ansichten, Metadaten und Quellanker. Unterstützte Browser schreiben in eine gewählte `.json`-Datei; andere laden `graph.json` herunter. Abbruch oder Fehler bewahren alle Seitenänderungen.

HTML-Neuladen beginnt wieder mit eingebetteten Daten. JSON behalten und in ein neues Ausgabeziel generieren, um Änderungen später erneut zu öffnen. Speichern umgeht keine Validierung; geänderte Texte oder Positionen können Layoutkorrekturen erfordern. Der Browser prüft Quellanker nicht erneut. Für quellbasierte Lieferung beide CLI-Befehle mit `--repo-root` wiederholen.

<a id="routing-and-spacing"></a>

## Routing und Abstände

- Mindestens 64 Graphpixel zwischen Knotenrechtecken lassen. Ein beschrifteter Korridor muss die vollständig geschätzte Textbreite plus 24 Pixel aufnehmen.
- Gewöhnliche Karten für 20px Titel,16px Fließ-/Feld-/Mitglieds-/Kantentext und 14px Sekundärtext auslegen. Einzelne Kästen und Korridore dem Inhalt anpassen; einheitliches Skalieren verliert beim Einpassen seinen Nutzen. Das sind Autorenempfehlungen, keine neuen Validierungsminima; kompakte Altkarten und Spezialzeichen bleiben kompatibel. Die erste Ansicht passt die ganze Zeichnung um Werkzeugleiste und offene Panels ein, bei mindestens 0.08 Zoom. Explizites Einpassen folgt derselben Regel.
- Parallele, auffächernde und zusammenlaufende Beziehungen erhalten automatisch 24px Spuren. Nahe einem Endpunkt dürfen höchstens 12px geteilt werden; längere ER-Symbolabstände erlauben keine verschmolzenen Routen.
- Knotenseiten müssen ihre automatischen Spuren aufnehmen. Bei gemeldetem Endpunktüberlauf Knoten vergrößern oder Routenhinweise geben.
- Bei Nicht-Selbstschleifen bestimmen erster/letzter Wegpunkt Endpunktseite und projizierte Randposition. Nach außen 28px gerade Strecke für ER-Kardinalitäten, sonst 12px freihalten. Wegpunkte müssen außerhalb sämtlicher Knoten einschließlich der eigenen Endpunkte liegen.
- Selbstschleifen verlaufen standardmäßig 48×32px außerhalb des rechten Knotenrands. Nur bei belegtem Platz `route.via` oder `route.labelAt` einsetzen.
- Validierung verbietet überlappende Knoten, Labels über Knoten/Labels, Routen durch Knoteninneres einschließlich eigener Endpunkte, unsichere Selbstschleifen und gemeinsame Abschnitte über 12px. Sequenznachrichten bleiben unterhalb der Teilnehmerköpfe an Lebenslinien angeschlossen. Enge Abstände und Kreuzungen sind Warnungen.
- Teilnehmermitten in Sequenzen müssen mindestens `max(160, estimated message width + 32)` Pixel auseinanderliegen.

## Typspezifische Notation

| `diagramType` | Knoten `kind` | Gruppe `kind` | Kante `kind` |
| --- | --- | --- | --- |
| `architecture` | `external`, `config`, `framework`, `security`, `service`, `business`, `data`, `failure`, `system`, `component`, `database` | `runtime`, `security`, `ownership`, `external` | `request`, `call`, `data`, `success`, `failure`, `framework`, `optional`, `depends` |
| `flowchart` | `start`, `end`, `process`, `decision`, `input`, `output`, `subprocess` | keine | `flow`, `yes`, `no`, `success`, `failure` |
| `sequence` | `actor`, `participant`, `external`, `service`, `database` | `alt`, `opt`, `loop` | `sync`, `async`, `return` |
| `er` | `entity` | keine | `relationship` |
| `deployment` | `device`, `node`, `container`, `artifact`, `service`, `database`, `external` | `host`, `network`, `cluster`, `namespace` | `deploy`, `network`, `depends` |
| `class` | `class`, `interface`, `abstract` | keine | `association`, `inheritance`, `implementation`, `composition`, `aggregation`, `dependency` |
| `state` | `initial`, `state`, `final`, `choice` | keine | `transition` |
| `usecase` | `actor`, `usecase` | `system` | `association`, `include`, `extend` |
| `dataflow` | `external`, `process`, `dataStore` | `ownership`, `external` | `data` |

### Sequenz

Kanten benötigen eine eindeutige positive ganze `order`. Teilnehmer oben ausrichten:72px Kopf,108px für Akteurbezeichnungen und ausreichend Höhe für alle Nachrichten im 54px Reihenabstand. Nummerierte Labels können mit 16px Schrift und 24px Zeilenhöhe umbrechen. Vollständige Mehrzeiler müssen unter Köpfe und zwischen Nachrichten passen. Bei mehr als zwei Zeilen Teilnehmerabstände vergrößern oder Rahmen verschieben. `alt`/`opt`/`loop` umschließen den zugehörigen Bereich; eine unabhängige asynchrone Phase darf kein weiter wartendes synchrones Ausgangsgesuch suggerieren.

```json
{ "id": "request", "source": "browser", "target": "api", "label": "POST /orders", "kind": "sync", "order": 1, "evidence": "source" }
```

### ER

Jede Entität braucht nicht leeres `fields`. `key` kann `PK`, `FK`, `UK` sein. Beziehungen benötigen Kardinalitäten an beiden Enden: `1`, `0..1`, `*`, `1..*`, `0..*`.

Mit 72px Kopf, etwa 32px je Feld und unterem Abstand dimensionieren. Spalten für 16px Feldnamen,14px Typen und Schlüsselabzeichen verbreitern, besonders bei langen Bezeichnern. Außerhalb jeder Entität 28px gerade Strecke für Kardinalitätssymbole lassen. Die JSON-Kardinalitätswerte ändern sich nicht.

```json
{
  "id": "orders",
  "label": "orders",
  "kind": "entity",
  "fields": [
    { "name": "id", "type": "bigint", "key": "PK", "nullable": false },
    { "name": "user_id", "type": "bigint", "key": "FK", "nullable": false }
  ],
  "position": { "x": 80, "y": 120 },
  "size": { "width": 260, "height": 170 }
}
```

```json
{ "id": "user-orders", "source": "users", "target": "orders", "kind": "relationship", "sourceCardinality": "1", "targetCardinality": "0..*", "evidence": "schema" }
```

### Klasse

Klassen können Zeichenfolgenarrays `attributes` und `methods` enthalten. Schnittstellen und abstrakte Klassen zeigen ihren Stereotyp.68px Kopf,28px Mitgliedszeilen bei 16px Schrift und Abstand beider Fächer einplanen. Name, Stereotyp und alle Mitglieder müssen ohne Abschneiden oder Schrumpfen hineinpassen. Vererbung/Implementierung und Komposition/Aggregation nutzen eigene Dreieck-/Rautenmarker ohne Änderung vorhandener Kantenarten.

### Zustand

Übergänge können `guard` und `action` enthalten. Das sichtbare Label wird als `label [guard] / action` zusammengesetzt.

### Quellanker

`source` nur verwenden, wenn ein Knoten einer genauen Repository- oder bereitgestellten Dokumentstelle entspricht. Bei externen Akteuren und Framework-Laufzeitkomponenten weglassen. `facts` kurz und atomar halten; Unsicherheit sowohl sprachlich als auch im Belegtyp kennzeichnen.

Für ausdrücklich gewünschte Konzeptbeispiele das Geschäftsmodell in `facts` beschreiben, abgeleitete Beziehungen als `inference` kennzeichnen und den Umfang in Metadaten nennen. Keine Quellpfade erfinden oder Vorschauanker für fremde Diagramme wiederverwenden. Normale Generierung schreibt weiterhin nur `index.html` und `graph.json`.
