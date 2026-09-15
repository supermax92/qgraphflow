# Viewer-Entwicklung und Wartung

[English](../../../skills/q-flow/references/viewer-development.md) · [简体中文](../zh-CN/viewer-development.md) · [Русский](../ru/viewer-development.md) · [Português](../pt/viewer-development.md) · [日本語](../ja/viewer-development.md) · [Deutsch](viewer-development.md) · [Español](../es/viewer-development.md)

Module werden beim Build zusammengesetzt. Nach Quelländerung und Build bettet der Generator alle Funktionen in eigenständiges HTML ein; es gibt weder Laufzeit-Downloads von Plugins noch Hot Loading. Normale Generierung schreibt weiterhin nur `index.html` und `graph.json`.

## Änderungspunkte

Pfade relativ zu `assets/viewer/src/`:

| Ziel | Einstieg | Zuständigkeit |
| --- | --- | --- |
| Diagrammtyp ergänzen | `diagrams/<type>.js`, `diagrams/registry.js` | Namen, Reihenfolge, erlaubte Arten, Validierung, Zeichnung, Umrisse, Beziehungsregeln |
| Thema, Schriftgröße, Zeilenhöhe | `visual-style.js`, `radix-colors.js` | Gemeinsame Radix-Skalen, Variablen, Semantik, Kernerkennung und Maße für Seite/Export |
| Knotenform oder Innenlayout | Passendes `diagrams/<type>.js`, gemeinsame Karten in `diagrams/card.js` | Seite und SVG/PNG |
| SVG-Typografie und Grundformen | `diagrams/drawing.js` | `svgStyles()`, Escaping, Grundformen; auf der Seite gekapselt, im Export wiederverwendet |
| Werkzeugleiste, Details, responsive Oberfläche | `ViewerShell.jsx`, `styles.css` | Seitenrahmen, keine zweite HTML/CSS-Implementierung des Knoteninhalts |
| Leuchteffekte | `effects.css`, durch `main.jsx` nach `styles.css` geladen | Rollen-, Auswahl-, Flussleuchten und dunkle Vignette; nur Palettenvariablen, als Datei entfernbar, bei weniger Transparenz/mehr Kontrast aus |
| Auswahl oder Suche | `features/useSelection.js`, `search.js` | Gemeinsame Auswahl, Rückmeldung, Tastatur und Schließen; Suchrangfolge separat testbar |
| Gerichtete Kantenbewegung | `features/useViewerController.js`, `DiagramCanvas.jsx` | Nur Richtung; eigener Schalter und Einstellung für reduzierte Bewegung |
| Legende | `ViewerShell.jsx`, `styles.css`; Inhalt aus `legend.js`, `visual-style.js` | Schwebendes Popover aus tatsächlichen Kategorien/Linien; Originalsymbole, `nodeAppearance` und Kernpriorität |
| Panels und Fokus | `features/usePanels.js` | Mobiler Ausschluss, Sichtbarkeit, Fokusrückgabe; Panelpräferenz beim Ansichtswechsel behalten |
| Vollbild | `features/useFullscreen.js`, `features/useSelection.js` | Natives Vollbild, Fehlermeldung, Fokusrückgabe; Auswahl öffnet keinen externen Inspektor, Escape beendet zuerst Vollbild |
| Ziehen, Ausschnitt, Sperre, Abstände | `features/useGraphLayout.js`, `layout-nudge.js` | Aktuelle Positionen und Layoutoperationen; D3 bleibt begrenzte Verschiebung |
| Präsentationszustand | `features/usePresentation.js` | Auswahl/Suche auf Knoten und Kanten abbilden, kein zweiter Zustandseigner |
| Downloads | `features/download.js`, `export-svg.js` | Statisches SVG aus aktuellen Koordinaten; daraus gerastertes PNG |
| Routing und Layoutprüfung | `edge-routing.js`, `text-layout.js` | Pfade, Umbruch und Messung für Seite, Export und Validierung |

`main.jsx` verwaltet Laden, Ansichtswechsel, Thema und Entwürfe je Ansicht. `features/useViewerController.js` kombiniert Funktionen und koordiniert Speichern/Zurücksetzen; `ViewerShell.jsx` bindet die UI. Zuerst vorhandene Module erweitern; neue Hooks nur für unabhängigen Zustand und Lebenszyklus.

## Diagrammtyp ergänzen

1. Modul mit Default-Export in `diagrams/` anlegen.
2. In `diagrams/registry.js` importieren und `DIAGRAMS` ergänzen. Registrierreihenfolge bestimmt das Sammlungsmenü; Einzelgraphen bleiben ohne Typmenü.
3. `graph-schema.md`, `visual-contract.md` und Autorenanweisungen in SKILL aktualisieren. Registrierung erfordert nicht zwingend Strukturänderungen.
4. Vorlage bauen, Beispiele generieren, typspezifische Knoten, Beziehungen und Browseraktionen prüfen.

Bestehende Regeln und Grundformen nutzen. Eine Kartenansicht, die alle Architekturregeln erbt, benötigt nur `{ ...architecture, id: 'new-view', label: 'New view' }` plus Registrierung. Ein unabhängiger Typ enthält häufig:

```js
export default {
  id: 'new-view', label: 'New view',
  nodeKinds: ['component'], groupKinds: [], edgeKinds: ['call'],
  outline, // (node, x, y) => [[SVG-Tagname, Geometrieattribute], ...]
  render,  // (node, x, y, fill, stroke, palette) => SVG-Zeichenfolge
};
```

`render` zeichnet den Körper mit `paint(outline(node, x, y), { fill, stroke })`, Text mit `text` / `centeredTitle`. Modulcode ist vertrauenswürdig, Graphdaten nicht. Eingaben niemals ohne gemeinsames Escaping in SVG-Tags, Attribute oder Text einsetzen.

Optionale Hooks nur bei Bedarf:

- `validateNode`, `validateEdge`: zusätzliche Regeln nach gemeinsamer Validierung; übergebene `requireString`, `validateStringArray` usw. nutzen. Jede Prüfung erzeugt eine neue Menge für Sequenznummern.
- `edgeLabel`, `undirected`, `dashedKinds`, `markers`: Labels, Richtung, notationsspezifische Strichelung neben Belegstilen und bestehende UML-Marker.
- `cardLayout`, `compartments`, `sequence`, `cardinalities`, `endpointStub`, `selectionHeight`: Kartenprüfung, Kernfächer, Lebenslinien, ER-Enden und Auswahlhöhe.

Rechteckkarten können Regeln übernehmen. Neue Routen, Verbindungspunkte oder UML-Symbole benötigen gemeinsame Routing-/Zeichnungserweiterungen: Registrierung errät keine unbekannte Geometrie. Neue semantische Arten in `visual-style.js` benennen und über `nodeAppearance` klassifizieren. Radix-MIT-Hinweis aus `radix-colors.js` in HTML und SVG behalten.

## Gemeinsame Rendering-Regeln

`DiagramCanvas.jsx` und `export-svg.js` rufen `renderNode()` aus `node-svg.js` auf. Die Seite setzt SVG in React-Flow-Knoten ein; Export übergibt einen Canvas-Versatz an denselben Renderer. `SelectionOutline.jsx` ruft `renderSelection()` mit demselben `outline` auf und verändert nur Strich, Deckkraft und Schatten.

Position, Inhalt und vorübergehende Interaktion trennen. Ziehen ändert aktuelle Koordinaten, Auswahl weder Koordinaten noch Form. Export erhält nur Graph und Thema, keine Auswahl/Animation. Grenzen, React-Flow-Markeranpassung und Seitenbedienelemente bleiben hostspezifisch; gemeinsamer Inhalt bedeutet nicht identisches Seiten-DOM und Export-SVG.

## Build und Regression

Im Skill-Verzeichnis mit vorhandenen Abhängigkeiten und Browserwerkzeugen:

```bash
npm --prefix assets/viewer run build
node --test scripts/*.test.mjs
node scripts/generate-viewer.mjs /tmp/graph.json /tmp/new-viewer
node scripts/browser-interactions.mjs /tmp/new-viewer /tmp/new-viewer-check
```

Der Vollbildknopf unten links versetzt nur den Canvas in natives Vollbild; Panels und obere Leiste bleiben außerhalb. Nach Größenänderung einmal einpassen, ohne Auswahl/Layout zu ändern; beim Verlassen den Ausschnitt behalten. Zielscheibe bedeutet Einpassen, vier Ecken Vollbild. Alte HTML-Dateien für neue Funktionen regenerieren. Bei fehlender Unterstützung den Knopf als nicht verfügbar kennzeichnen; Anfragefehler im Canvas-Status melden.

Vollbildabnahme nutzt echte Browser-APIs. `QA_HEADED=1` öffnet ein Fenster für Vollbild-, Escape- und Fokusprüfungen:

```bash
QA_HEADED=1 QA_ONLY_EXTRAS=1 QA_EXTRAS=fullscreen,fullscreen-errors \
node scripts/browser-interactions.mjs /tmp/new-viewer /tmp/fullscreen-check
```

Das Browserskript prüft alle übergebenen Typen in drei Größen, hell/dunkel und mit Interaktionen. Für die volle Matrix neun Typen übergeben. `QA_FIXTURE_DIR` ergänzt Sonderform-Fixtures. Das Skript braucht benachbarte Quellmodule und ist nicht allein kopierbar.

Details folgen der Auswahl: `useSelection` besitzt sie, `useViewerController` leitet `inspectedNode` ab; Schnellansicht und Inspektor in `ViewerShell` verwenden diesen Knoten. Kein Autoplay, Leseschritt oder Ablaufsteuerung. Legende oben links als schwebender Knopf; `.inspector-facts` bleibt letzter Abschnitt. `has-flow` in `DiagramCanvas` und `styles.css` steuern den Kontrast statischer Linien während der Bewegung; Auswahl darf Lücken bewegter Striche nicht füllen.

```bash
QA_ONLY_EXTRAS=1 QA_EXTRAS=flow-contrast,inspector-sync \
node scripts/browser-interactions.mjs /tmp/new-viewer /tmp/new-viewer-sync-check
```

`diagram-modules.test.mjs` ergänzt einen zehnten Testtyp in einer temporären Kopie, verändert nur deren Modul/Registry und prüft Validierung, Build und Generierung. Das Produkt bleibt bei neun Typen. Mit `MODULE_TEST_OUTPUT=/tmp/new-module-check` die Kopie behalten und deren `skills/q-flow/scripts/browser-interactions.mjs` auf `page/` anwenden. Die Kopie erhält Repository-Hierarchie und Drittanbieterhinweise im Stamm, um reale Build-Abhängigkeiten zu prüfen. Das Ziel darf nicht existieren.

Nach Viewer-Änderungen `assets/viewer-dist/index.html` neu bauen. Nach Installation tatsächlichen Cache prüfen und in einer neuen Sitzung mit der installierten Version Abnahmeausgaben erzeugen. Bestehendes HTML enthält alten Code und braucht Neugenerierung.

## QGraphFlow: Namen und Migration

| Kennung | Alt | Neu |
| --- | --- | --- |
| Produkt | CodeGraph Flow | QGraphFlow |
| Plugin-ID | `codegraph-flow` | `qgraphflow` |
| Skill-Verzeichnis und Aufruf | `create-interactive-codegraph` / `$create-interactive-codegraph` | `q-flow` / `$q-flow` |
| Skill-Anzeigename | CodeGraph Flow｜交互式软件图 | Q flow |
| Privates Viewer-Paket | `codegraph-flow-viewer` | `qgraphflow-viewer` |
| Standard-Lieferverzeichnis | `docs/codegraph-flow/<scope>-<diagram-type>/` | `docs/qgraphflow/<scope>-<diagram-type>/` |

Das Paket enthält nur den neuen Skill-Einstieg ohne alte Aliase, weiterhin für neun Softwarediagrammtypen. MapSprig / QMindFlow werden hier nicht umbenannt.

Vom Repository-Stamm die neuen Pfade verwenden:

```bash
node skills/q-flow/scripts/validate-graph.mjs /tmp/graph.json
node skills/q-flow/scripts/generate-viewer.mjs /tmp/graph.json docs/qgraphflow/example-architecture
```

Das Standardverzeichnis ist eine Lieferkonvention des Skills; der Generator verlangt weiterhin ein explizites Ziel. Nutzergewählte alte Verzeichnisse einschließlich `docs/codegraph-flow/` bleiben möglich. Überschreiben benötigt `--force`. Alte `graph.json` brauchen keine Änderung; verfasste alte Namen in Titel, Quellen, Knoten und Belegen bleiben erhalten. Altes HTML läuft offline mit alter eingebetteter Marke; aus Original-JSON neu generieren.

`CodeGraph`, `codegraph`, `@colbymchenry/codegraph`, `.codegraph/` gehören zum externen Analysewerkzeug und bleiben unverändert, ebenso interne `__CODEGRAPH_FLOW_DATA__`, `codegraph-*`-SVG-IDs und Präfixe temporärer Testverzeichnisse.

### Lokale Installation und Aktualisierung

Installation, Update, Entfernung und Prüfstatus für Codex, Claude Code, Qoder und Cursor stehen in der [Client-Anleitung](../../clients.de.md). Repository-Änderungen aktualisieren installierte Plugins nicht automatisch. Bei Installation/Migration tatsächliche Quelle und Version prüfen, Client-Verwaltung verwenden und Nutzerdiagramme sowie andere Plugin-Konfiguration erhalten.

<a id="viewer-visual-and-interaction-contract"></a>

## Visueller und interaktiver Viewer-Vertrag

Nur für Wartung/Interaktionsaudits lesen. Zur Graph-Erstellung dient [visual-contract.md](visual-contract.md).

### Gemeinsame Darstellung

- Canvas-first React-Flow-Oberfläche: Canvas füllt das Fenster unter einer 52px Materialleiste mit Navigation, Sammlungsmenü, Titel/Untertitel, Suche samt Ergebnis-Popover, `···` für Export/Reset/Layoutsperre/Abstände/Aussehen und Inspektor-Schalter. Kein Board-Kopf, Fußbereich oder Markenblock; Produktname nur im Dokumenttitel. Navigation/Inspektor sind von ihrem Rand einschiebende Panels, anfangs bei jeder Breite geschlossen. Klick zeigt neben dem Knoten eine Schnellansicht (Typ, Name, Aufgabe, Quelle, bis vier Tags, Details), keinen Inspektor. Das Diagramm trägt das größte visuelle Gewicht.
- Standardmäßig `prefers-color-scheme` live folgen. `···` bietet System/Hell/Dunkel; manuelle Wahl gewinnt in beide Richtungen. Themawechsel bewahrt Ausschnitt, Suche, Auswahl, Sperre und Panels.
- Gemeinsame Palette Radix Colors (MIT): Slate für kühle neutrale Flächen, Iris für Kern/Interaktion, Cyan für Daten, Orange für Entscheidungen/Fehler. Urheberrecht/Lizenz in Quellpaket, HTML, SVG erhalten; kein Laufzeit-CDN oder Komponentenbibliothek nötig.
- Tatsächlichen Geschäftskern mit `business` oder groß-/kleinschreibungsunabhängigem `core`/`business`-Tag markieren. Iris 3/8/12 für Füllung/Rand/Text, bei ER/Klassen nur Kopf und neutrale Mitgliedszeilen. Kern gewinnt vor Daten/Warnung. Start-/Endzustand behält Vollpunkt/Doppelkreis. Kein neuer `core`-Typ oder Farbwert im Format.
- Seite, Knoten, MiniMap, Inspektorpunkte, Legende und Export teilen `visual-style.js`. Normale Karten Slate 2; heller Canvas Slate 1 (`#fcfcfd`, nahezu weiß), dieselbe Stufe-1-Regel wie dunkel. Dunkle Skalen statt unveränderter heller Farben nutzen.
- Oberflächenfarben werden in `styles.css` per `color-mix` aus Palettenwerten abgeleitet: vier Textstufen `--label`, `--label-2/3/4`, Trenner `--sep`, drei Füllungen `--fill`, `--fill-2/3`, Materialien `--material-thick`, `--material`, `--material-thin`. Dunkel überschreibt nur Materialbasis/Schatten. Oberflächentext 11 / 12 / 13 / 15 / 20 px, SVG weiterhin `TYPOGRAPHY` / `--font-*`. Jeder Regler hat `:active` und gemeinsamen `:focus-visible`; Panels .5px Haarlinie plus eine Schattenlage, `1px solid` nur für Canvas-Zeichen. Neben `prefers-reduced-motion` beachten: `prefers-reduced-transparency` macht Material zu opakem `--panel` ohne Blur; `prefers-contrast: more` nutzt Labelfarbe für Trenner/Sekundärtext und 1px Umrandung für schwebende Ebenen.

| Rolle | Radix-Skala / Stufe |
| --- | --- |
| Seite / normale Fläche | Slate 1 / Slate 2 |
| Haupt- / Sekundärtext | Slate 12 / Slate 11 |
| Kernfüllung / Rand / Text | Iris 3 / Iris 8 / Iris 12 |
| Interaktion / gerichtete Bewegung | Iris 11 |
| Datenfüllung / Rand / Akzent | Cyan 3 / Cyan 8 / Cyan 11 |
| Warnfüllung / Rand / Akzent | Orange 3 / Orange 8 / Orange 11 |
| Dezenter Rand / normale Kante | Slate 6 / Slate 9 |

- Hell behalten Knoten ohne `module` ihre Rollenfüllung; mit `module` erhalten sie ganzflächige Modultönung, Umriss und Kopfstreifen. Geprüfte Zuordnung des chinesischen E-Commerce-Beispiels: 渠道 `#6b7280`, 结算 `#5753d7`, 价格 `#8b5cf6`, 库存 `#0f8f83`, 风控 `#c26a17`, 支付 `#2474d2`, 订单 `#348052`, 履约 `#b14b7d`. Farbe ersetzt weder Text, Form, Kardinalität, Linienstil noch Stereotyp; Modulfüllung auch bei Auswahl erhalten.
- Legende nur aus vorhandenen Kategorien/Linienstilen, mit gemeinsamer Kernpriorität, Semantik und aktuellem Thema bilden.
- Legendenknopf oben links öffnet ein Popover mit Flussschalter bei gerichteten Beziehungen. Originalsymbole vor Labels behalten Form, Themenfarben und Voll-/Strichlinie, Text bricht inline um. Bei offener Navigation nach rechts ausweichen; Pan/Zoom ändert weder Position noch Schriftgröße. Escape/Außenklick schließt.
- Gerichtete Beziehungen zeigen standardmäßig einen dezenten wandernden Strich vom Ursprung zum Ziel, ungerichtete stehen still. Darunter bleibt die Beleglinie. Auswahl lässt Bewegung laufen; separater Flussschalter stoppt nur Umgebungsstriche, reduzierte Bewegung alle Umgebungsanimationen.
- Hover/Auswahl betonen mit Umriss/Schatten, ohne Geometrieskalierung oder Ersatz semantischer Füllung/Ränder. Auswahl erzeugt einmal gemeinsamen 760ms Rückprall an Knoten und direkten Kanten, danach statische Betonung; nur Strichbreite, Deckkraft und Schatten animieren.
- `effects.css` ist eine reine Bildschirmebene nach `styles.css`. Dunkel: `filter: drop-shadow` entlang `.node-surface` in Modul-, sonst Rollenfarbe; Akzent für Hover/Auswahl; breiter Halo (Knoten 14px bei .5, direkte Kanten 14px bei .3, bewegter Strich behält ≥60% Referenzkontrast), stärkere `.edge-flow` und 10% Akzent-Radialvignette von oben. Hell: weich getönter Modulschatten und flacher Canvas. Nur Palettentokens, kein Karten-`box-shadow` (Lebenslinien `boxShadow === 'none'`), keine Exporte. `prefers-reduced-transparency: reduce` oder `prefers-contrast: more` schaltet die Ebene ab: Filter `none`, Halo/Fluss auf `styles.css`, Vignette weg.
- Reduzierte Bewegung deaktiviert Kanten-/Auswahlanimation und führt Ansichtswechsel sofort aus.
- SVG/PNG nutzen aktuelles Thema, Notation, Typhierarchie und gemeinsame orthogonale Pfade; keine temporäre Auswahl/Suche. Labels/Symbole bleiben in ihren Formen; SVG-Beschreibungen enthalten den vollständigen verfassten Text.

### Interaktion

- Einzelgraph ohne Menü; Sammlung mit kanonischem `role=menu` / `menuitemradio`, aktuellem Häkchen und Beziehungszahl pro Eintrag. Wechsel bewahrt Texte/Positionen je Graph, löscht Suche/vorige Auswahl, passt alles ein und wählt den anfänglichen Kern.
- Kein Autoplay, Schrittregler, Lesetour, aktueller oder erledigter Schritt. `playback` ignorieren; Kantenbewegung ist keine Ausführungsreihenfolge.
- Anfangs ersten expliziten Kern samt direkten Kanten statisch auswählen, ohne Puls; ebenso beim Wechsel. Ohne Kernmarkierung keine Auswahl.
- Knotenauswahl zeigt Schnellansicht und alle direkt ein-/ausgehenden Kanten. Selbstschleife einmal, keine weitere Traversierung oder Abdunklung anderer Beziehungen. Aktuellen Pfad wiederverwenden, keine neuen/größeren Pfeile; Belegstriche, ER-Kardinalitäten und UML erhalten.
- Umrisse folgen Karte, Raute, Parallelogramm, Ellipse, Zustandskreis. Sequenzen betonen nur Kopf/Akteur, nicht die Lebenslinienbox. Nach 760ms statisch; anderer Knoten ersetzt die ganze Menge, gleicher Knoten wiederholt einmal.
- Klick/Ziehbeginn wählt und zeigt Schnellansicht; Verzeichnis/Suche und Enter/Space öffnen den Inspektor. Kanten bewegen sich weiter. Rückmeldung/Detailposition einmal je Aktion; Ziehen zentriert nicht neu und entzieht dem Ziel keinen Fokus.
- Canvas-Klick, Details schließen oder Escape löscht Auswahl. Suche dimmt unpassende Knoten ohne Topologieänderung.
- Inspektor hält alle Fakten, Felder, Nullbarkeit, Attribute, Methoden, Anker und Tags bis zur Nutzeränderung; kein automatischer Fortschritt oder Fokusraub.
- Gerichteter Fluss bleibt bei Auswahl erkennbar; keine opake gleichfarbige Linie in Strichlücken. Alle direkten gerichteten Kanten prüfen, nicht nur erste Kante oder `animationPlayState`. Reduzierte Bewegung/Flussschalter haben Vorrang.
- Suche ignoriert Großschreibung/Rand-Leerraum. Rangfolge: exakter Name, Namenspräfix, Namensteil, Untertitel/Tags, Fakten/Felder/Attribute/Methoden; Gleichstände in Originalreihenfolge, danach acht Ergebnisse.
- Layout standardmäßig gesperrt; expliziter Schalter erlaubt Ziehen, Download nutzt aktuelle Positionen.
- Abstände ordnen nutzt nach Entsperren begrenztes D3-Nudging: ausgewählter Knoten plus direkte Nachbarn, ohne Auswahl alle. Ziel 65px Rechteckabstand nahe Originalpositionen, enthaltene Knoten in kleinster Grenze, Sequenzteilnehmer nur horizontal. Keine neue Topologie oder automatische Gesamtplanung.
- Gesperrt bleibt Ordnen grau mit `aria-disabled="true"`, aber aktivierbar per Maus/Tastatur, um im Status zum Entsperren aufzufordern. Sperrlabel einzeilig, Schalter immer 32×20px in der Menüzeile. Kein Solver/Autoentsperren. Danach lokal/gesamt und Anzahl bewegter Knoten melden, bei unverändertem fehlerfreiem Layout keinen Änderungsbedarf, sonst verbleibende Probleme mit manueller Korrektur. Fehler und Warnungen zählen, auch bei null Bewegung.
- Passt gewünschter Kopf/Abstand nicht in die Grenze innerhalb 156px Bewegung, Originalposition behalten und Probleme melden. Unbeteiligte Koordinaten inklusive Bruchteilen exakt erhalten. Jede Aktion erneuert Status und 4.5s Timer, auch bei gleichem Text.
- Ordnen ändert weder Belege, Routenhinweise, Gruppen, Auswahl, Ausschnitt, Panels noch Thema. Reset stellt `graph.json`-Positionen/Lesesicht und Standardfluss wieder her, löscht Suche, Auswahl und alte Meldungen; Thema, Panel-Sichtbarkeit, Sperre bleiben. Abschluss im vorhandenen Status melden.
- Pan, Zoom, Einpassen, Reset, SVG/PNG bleiben verfügbar.
- Graph JSON speichern sichert Texte/Positionen aller Ansichten in ursprünglicher Einzel-/Sammlungsform mit Metadaten, Ankern und strukturierten Feldern. Nativer Dateidialog, sonst Download. Abbruch/Schreibfehler erhält Änderungen; Reset nur für aktiven Graphen, im nächsten Speichern enthalten. Neuladen liest Einbettung; aus gespeichertem JSON regenerieren. Regression: hin/zurück wechseln, Reset-Isolation, JSON-Download, Neugenerierung.
- Tastaturauswahl/Schließen erhält Topologie; Backspace/Delete löscht keine Knoten.
- Öffnen/Reset/Wechsel passt alles ein; Pan/Zoom/MiniMap für Details. Gleiche Grenzen wie Export: Knoten, Gruppen, Außenrouten, Labels, ER-Symbole. Verzeichnis/Einpassen nutzt nach Ziehen/Ordnen aktuelle Positionen, Reset Originale.
- Jedes Einpassen inklusive Vollbild zieht Oberfläche ab: oben 52px+12px, unten Kontrollzeile, pro Seite offen 304px+24px, geschlossen 24px. `readingPadding()` in `useGraphLayout.js` liest `data-nav-open` / `data-drawer-open`; Padding als `px`-Strings, nackte Zahlen sind Verhältnisse.
- Öffnet Navigation, Inspektorschalter oder Schnellansicht-Details ein Panel über dem gewählten Knoten, nur bis 12px Abstand freipannen, ohne Zoom. Unverdeckte Knoten und Breiten ≤700px bewegen sich nicht. `useReveal.js` explizit aus diesen drei Aktionen aufrufen, nicht als Effekt. Verzeichnis/Suche zentriert weiterhin.
- Programmatische Bewegungen teilen `cubic-bezier(.32,.72,0,1)` mit 320–420ms. Panels: kritisch gedämpfte Feder (`visualDuration .36`, `bounce 0`). Bei reduzierter Bewegung beide Dauer null, Panel direkt am Ziel ohne sichtbaren Weg.
- Zoom skaliert vollständige Knoten; nie Untertitel, Felder, Attribute, Methoden oder Stereotype ausblenden, auch nicht im Vollbild. Zentrierter Text bricht innerhalb nutzbarer Rechtecke, bei Raute/Ellipse/Pille/Schrägform enger. Breiten berücksichtigen Großbuchstaben und breite lateinische Zeichen, Grenztitel reservieren Fragmentnotation. `text-bounds` prüft alle Arten, lange Felder/Mitglieder, Grenztitel, Großbuchstabenlabels und drei Zoomstufen; nicht leerer Text mit berechneter Deckkraft null lässt den Test scheitern.
- Schnellansicht versucht rechts→links→unten→oben: erster Platz innerhalb Canvas ohne andere Knoten. Überlappen alle passenden Seiten, kleinste Überdeckung anhand echter Kartenhöhe wählen. Vom Knotenrand wachsen (`is-flipped / is-below / is-above` setzen `transform-origin`).
- Lange Karten umbrechen/scrollen innerhalb verfügbarer Höhe, Schließen/Details bleiben tastaturerreichbar. Im Vollbild vor Detailöffnung erst beenden und vorhandenen Inspektor fokussieren. Bei abgelehntem Beenden Karte behalten, Fehler ansagen.
- Offene Navigation verschiebt Legende/Zoom auf 328px links; offener Inspektor MiniMap auf 328px rechts (`.workspace.nav-open / .drawer-open`). Bei ≤700px bleiben sie stehen.
- SVG/PNG enthalten die ganze Zeichnung, nicht nur den Ausschnitt.

### Responsive Anordnung

- Beide Panels starten immer geschlossen, öffnen als 304px Overlays von Werkzeugleistenunterkante+12px bis Fensterunterkante−12px, ohne Hintergrundmaske; Canvas daneben bleibt verschiebbar. Escape schließt zuerst Popover, dann fokussiertes Panel mit Fokusrückgabe zum Schalter, dann Auswahl. Belegzugang an keinem Zwischen-Breakpoint entfernen.
- Bei ≤700px Panelbreite Fenster−24px, gegenseitiger Ausschluss, MiniMap verborgen. Suchtreffer öffnet Details und schließt Navigation.
- Mobile Aktionen erreichbar halten, sichtbaren Canvas neben Panel lassen, bei 390px kein horizontaler Seitenüberlauf. Inspektor zeigt vollständigen Text mit vertikalem Scrollen.

### Belege anzeigen

- Inspektor zeigt Identität, Felder, Attribute, Methoden, Anker, Tags zuerst und Fakten desselben Knotens als eigenen letzten Abschnitt. Mit Quelle Belegfakten, ohne Quelle Knotenbeschreibung; ohne Fakten/Knoten weglassen. Abschnitt scrollt mit.
- Direkte Quell-, Konfigurations-, Schema-, Test- und Dokumentbelege: Vollinie, außer die Notation verlangt Strichelung, etwa Rückgabe, Abhängigkeit, Implementierung.
- Framework-Verhalten und Ableitungen bleiben gestrichelt, auch während Bewegung.
- Details sprechen von Belegen, nicht pauschal von Quellcode.
- Lange Wörter in Fakten, Untertiteln, Feldern, Methoden, Quellsymbolen und Tags umbrechen, vollständigen Text und nur vertikales Scrollen erhalten.

### Browserabnahme

- Volle Matrix nur bei Änderungen an Viewer-Quellen, Routing, Schema oder Validierung: neun Typen × 1440×900 / 1920×1080 / 390×844 × hell/dunkel. Prüfen: Standardfluss, keine Wiedergaberegler, stabile Auswahl mit weiterbewegten Kanten, eigener Flussschalter, dynamische Legende, Pan/Zoom, Suchrangfolge, gekoppelte Kanten/Knoten ohne Geometrieänderung/Doppelpuls, vollständige Details, Sperre/Abstandsmeldung, Reset, SVG/PNG ohne temporäre Effekte, Tastatur, reduzierte Bewegung, horizontaler Überlauf. Je Typ Notation/Kern prüfen. Einzelgraph ohne Menü, Sammlung vertikales Menü; ≤700px Panels anfangs zu, erreichbar, gegenseitig ausschließend.
- Downloads öffnen: vollständige Labels/Notation, unbeschnittene Grenzen, Themenparität. Installierte Browserwerkzeuge nutzen, temporäre HTTP-Server in `finally` schließen.
