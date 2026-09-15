# Regeln für die Diagrammgestaltung

[English](../../../skills/q-flow/references/visual-contract.md) · [简体中文](../zh-CN/visual-contract.md) · [Русский](../ru/visual-contract.md) · [Português](../pt/visual-contract.md) · [日本語](../ja/visual-contract.md) · [Deutsch](visual-contract.md) · [Español](../es/visual-contract.md)

Diese Referenz dient der Diagrammautorenschaft. Implementierung und Interaktionsprüfungen stehen im [Entwicklungsleitfaden](viewer-development.md#viewer-visual-and-interaction-contract).

- Die erste Ansicht soll die gewünschte Frage beantworten. Einen klaren Hauptpfad, echte Komponenten-/Verantwortungsnamen und Aktions-, Nachrichten- oder Datennamen an Kanten verwenden. Grenzen liegen hinter Knoten; Beschriftungen meiden Gruppenüberschriften.
- Den tatsächlichen Geschäftskern mit einem gültigen `business`-Kind oder `core`/`business`-Tag betonen. Der Viewer liefert kühle neutrale Slate-Flächen, Iris für Kern/Interaktion, Cyan für Daten und Orange für Entscheidungen/Fehler. Gewöhnliche Komponenten neutral halten; keine Farbfelder oder erfundenen `core`-Kinds hinzufügen.
- Farbe ergänzt Namen und Notation. Derselbe nicht leere `module`-Wert über Ansichten hinweg ermöglicht stabile Ganzknotenfarbe, Kontur, Streifen und gewöhnliche Kantenfarbe. Farbe ersetzt keine Formen, Namen, Beziehungssymbole oder Belegstile; keine literalen Farbwerte angeben. Framework-/Ableitungskanten bleiben gestrichelt, sofern die Notation nichts anderes bestimmt. Protokolle, Multiplizitäten, Bedingungen und Quellanker exakt bewahren.
- Einzelne Kästen und Korridore auf vollständige Texte abstimmen. Einheitliches Vergrößern verliert beim Einpassen seinen Lesbarkeitsgewinn. Maße, automatische Spuren, Endpunktabstände und Routenhinweise aus dem [Datenformat](graph-schema.md#routing-and-spacing) beachten. Vor Routenhinweisen Knoten verschieben; keine Route darf ein Knoteninneres durchqueren.
- Beim Öffnen, Zurücksetzen, Ansichtswechsel und Vollbild passt der Viewer das gesamte Diagramm ein. Er skaliert die vollständige Zeichnung und verbirgt bei kleinerem Zoom weder Felder noch Mitglieder, Untertitel oder andere Knotentexte. Zoom, Verschieben und Minikarte erschließen Details. SVG/PNG enthalten das vollständige Diagramm; die Daten müssen alle Inhalte bewahren.
- Aus Belegen der angefragten Domäne arbeiten. Vorschau-Modelle, Fakten und Pfade sind nur Beispiele.

## Notation je Typ

Die passende Zeile lesen; erlaubte Kinds und Pflichtfelder stehen im Datenformat.

| Typ | Gestaltung und Routing |
| --- | --- |
| Architektur | Einstieg → Kernverantwortung → Partner; explizite Eigentums-/Laufzeitgrenzen. Ebenenübergreifende Verzweigungen und Zusammenführungen trennen. |
| Flussdiagramm | Kapselförmiger Start/Ende, Prozesse, Entscheidungsrauten, Ein-/Ausgabe und Unterprozesse. Erfolg und Alternativen in getrennten Korridoren. |
| Sequenz | Ausgerichtete Teilnehmer/Akteure, Lebenslinien, nummerierte Nachrichten, gestrichelte Antworten und `alt`/`opt`/`loop`. Selbstaufrufe außerhalb der Lebenslinie; mehrzeilige Labels von Nachbarspuren trennen; asynchrone Rückmeldungen nicht als synchrones Warten darstellen. |
| ER | Entitätsköpfe und vollständige PK/FK/UK-Felder, Kardinalität an beiden Enden. Mehrfachbeziehungen trennen und Symbolabstände einplanen. |
| Bereitstellung | Geräte, Knoten, Container und Artefakte innerhalb von Host-/Cluster-/Netzgrenzen. Physische Platzierung zeigen und containerübergreifende Labels freihalten. |
| Klasse | Name/Stereotyp, Attribute und Methoden; Vererbungsdreiecke, Kompositions-/Aggregationsrauten und Multiplizitäten voneinander trennen. |
| Zustand | Anfangspunkt, doppelter Endkreis, Zustände, Auswahl und bewachte Übergänge. Fehler-/Abbruchwege, parallele Übergänge und Selbstschleifen trennen. |
| Anwendungsfall | Akteure, elliptische Fähigkeiten und Systemgrenze. Akteurassoziationen von beschriftetem `include`/`extend` unterscheiden. |
| Datenfluss | Externe Entitäten, Prozesse und Datenspeicher. Jeden gerichteten Informationsfluss benennen und gemeinsame Erzeuger-/Verbraucherkorridore trennen. |

Für eine angeforderte Sammlung überall dasselbe geprüfte Domänenvokabular und die kanonische Reihenfolge der neun Typen verwenden. Vor der Erzeugung die gesamte Sammlung validieren. Ein Fehler in einer Ansicht blockiert die Lieferung der Sammlung.
