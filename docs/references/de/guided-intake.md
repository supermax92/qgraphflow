# Geführte Bedarfsklärung

[English](../../../skills/q-flow/references/guided-intake.md) · [简体中文](../zh-CN/guided-intake.md) · [Русский](../ru/guided-intake.md) · [Português](../pt/guided-intake.md) · [日本語](../ja/guided-intake.md) · [Deutsch](guided-intake.md) · [Español](../es/guided-intake.md)

Nur verwenden, wenn Aufruf und Gespräch zusammen noch keinen ausführbaren Auftrag ergeben. Erforderlich sind **Gegenstand** und **Frage**, die das Diagramm beantworten soll. Alles andere hat Standardwerte und wird nicht abgefragt.

## Startbereitschaft

| Punkt | Bereit, wenn | Nicht abfragen |
| --- | --- | --- |
| Gegenstand | Repository, Modul, Ablauf, Entitätsmenge oder Dokument ist genannt und passt zur Frage: Verhalten braucht einen Ablauf, Zustand eine Komponente; Struktur erlaubt Repository oder Modul | — |
| Frage | Der Nutzer nennt die gewünschte Antwort oder eine Diagrammart, aus der sie folgt | — |
| Diagrammart | — | Nach SKILL.md, Author Schritt 1 ableiten; Standard `architecture` |
| Granularität | — | Aus dem Gegenstand gemäß Ebenenregel ableiten; nicht „detailliert oder einfach“ fragen |
| Ausgabeordner, Sprache, Diagrammanzahl, CodeGraph-Einrichtung | — | Bestehende Standards; den Ordner in der Zusammenfassung zur Änderung sichtbar machen |

Nur fehlende Angaben erfragen. Bei Verhaltensfragen mit Repository oder Modul fehlt der Ablauf: den Einstiegsscan der zweiten Runde ausführen und nur nach dem Ablauf fragen. Ein im Gespräch formulierter Auftrag ist bereit, wenn beide Angaben vorliegen, auch bei indirekter Skill-Aktivierung.

## Bestandsaufnahme der ersten Runde

Vor dem Fragen prüfen, damit Optionen reale Module benennen. Budget: Verzeichnisse bis Tiefe 2 und Vorhandensein von Manifesten. Keine Quelldateien lesen, keine Einstiegspunkte scannen, kein `codegraph explore` ausführen.

| Signal | Dateien oder Verzeichnisse | Ermöglicht |
| --- | --- | --- |
| Build | `package.json`, `pom.xml`, `build.gradle*`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `*.csproj` | Modulkandidaten, Sprache und Framework |
| Persistenz | `migrations/`, `db/migration/`, `*.sql`, `entity/`, `model/`, ORM-Zuordnungen | `er` |
| Bereitstellung | `Dockerfile`, `docker-compose*.yml`, `k8s/`, `helm/`, `charts/` | `deployment` |
| Zustand | Dateinamen mit `State`, `Status`, `Phase`, `Lifecycle` | `state` |
| Dokumente | `docs/`, `requirements/`, Anforderungsdateien `*.md` | `flowchart`, `usecase` |
| CodeGraph | `.codegraph/` vorhanden | Zusammenfassung nennt „CodeGraph“ statt „direkte Verfolgung“ |

Bei mehr als 8 obersten Verzeichnissen nur Unterverzeichnisse mit Buildmanifest auflisten. Ist das Arbeitsverzeichnis leer, kein Coderepository oder das Installationsverzeichnis dieses Plugins, stattdessen nach Zielrepository oder Anforderungsdokument fragen und keine Modulkandidaten anbieten.

## Absichtsoptionen

Als Fragen formulieren, die das Diagramm beantwortet. Jede Option trägt Gegenstandsebene und ein kurzes Kostenetikett. Höchstens vier durch die Bestandsaufnahme gestützte Optionen, genau eine Empfehlung; Standard ist der Strukturüberblick des gesamten Repositorys.

| Option | `meta.diagramType` | Gegenstand | Kosten | Anbieten bei |
| --- | --- | --- | --- | --- |
| Woraus das System besteht und wer wovon abhängt | `architecture` | Repository oder Modul | schnell | immer |
| Wo es läuft und wie es bereitgestellt ist | `deployment` | Repository | schnell | Bereitstellungssignal |
| Was gespeichert wird und wie es zusammenhängt | `er` | Repository oder Modul | schnell | Persistenzsignal |
| Welche Typen existieren und wie sie zusammenhängen | `class` | Modul | schnell | Buildsignal |
| Wer was tun kann | `usecase` | Repository oder Modul | schnell | Dokumente oder öffentliche Einstiegspunkte |
| Wer wen in welcher Reihenfolge aufruft | `sequence` | ein Ablauf | Aufrufverfolgung | immer |
| Welche Entscheidungen ein Ablauf trifft | `flowchart` | ein Ablauf | Aufrufverfolgung | immer |
| Wie sich Daten bewegen und verändern | `dataflow` | ein Ablauf | Aufrufverfolgung | immer |
| Welche Zustände etwas durchläuft | `state` | eine Komponente | Aufrufverfolgung | Zustandssignal |

Strukturabsichten (`architecture`, `deployment`, `er`, `class`, `usecase`) lesen Manifeste und Deklarationen. Verhaltensabsichten (`sequence`, `flowchart`, `dataflow`, `state`) verfolgen Ausführungspfade und kosten mehr. Das Etikett erklärt die Kosten und ändert nicht die Empfehlung.

## Ebenenregel und Ansichtsbudget

Knoten liegen eine Ebene unter dem Gegenstand:

| Gegenstand | Knoteneinheit |
| --- | --- |
| Gesamtes Repository | Modul oder Dienst |
| Modul | Komponente oder Klasse |
| Ein Ablauf | Schritt oder Funktion |
| Entitätsmenge | Tabelle |

Eine Ansicht bleibt im Routingbudget: etwa 10 Knoten und 9 Kanten. Die zur Antwort nötigen Hauptknoten behalten, ausgelassene Elemente in `facts` oder im Lieferhinweis nennen. Vertiefung erfolgt als Folgeaufruf nach dem ersten Diagramm: Der gewählte Knoten wird Gegenstand, die Ausgabe landet in einem neuen `<node-scope>-<diagram-type>/`. In Runde eins nicht nach Vertiefung fragen.

## Fragen

Gegenstand und Absicht zusammen in einer Nachricht erfragen. Das strukturierte Fragewerkzeug des Clients verwenden, falls vorhanden; andernfalls nummerierte Textoptionen. Keine clientspezifischen Werkzeugnamen voraussetzen. In der Sprache des Nutzers fragen.

```text
Welcher Teil? 1 Bestellung  2 Zahlung  3 Bestand  4 gesamtes Repository (empfohlen)
Was soll das Diagramm beantworten?
  a Aufbau und Abhängigkeiten — Repository/Modul · schnell (empfohlen)
  b Aufrufreihenfolge — ein Ablauf · Aufrufverfolgung
  c Gespeicherte Daten und Beziehungen — Repository/Modul · schnell
  d Laufzeitorte — Repository · schnell
```

Danach **den Turn beenden und auf die Antwort warten**. Keine Antwort annehmen. Vor Abschluss der Runde weder `index.html`, `graph.json` noch andere Ausgaben schreiben.

## Zweite Runde

Strukturabsichten enden in Runde eins. Eine zweite Runde gibt es nur in diesen Fällen, nie eine dritte:

- **Noch kein Gegenstand:** höchstens drei Module aus der Bestandsaufnahme, eines empfohlen.
- **Zwei Absichten:** die primäre nehmen und die andere als mögliches zweites Diagramm nennen.
- **Verhalten mit Repository/Modul als Gegenstand:** Einstiegspunkte im gewählten Bereich scannen und höchstens vier Abläufe anbieten. Mit `rg -l` Dateinamen und Annotationen suchen (`*Controller*`, `*Handler*`, `*Listener*`, `*Consumer*`, `main`, `@RestController`, `@KafkaListener`, Routendekoratoren); keine Funktionskörper lesen. Bereits genannte Wörter bevorzugen. Bei zu vielen Kandidaten nach Paket gruppieren und eines wählen lassen; diese Wahl ist Runde zwei.

„Egal“, „entscheide du“ oder Gleichwertiges übernimmt die Empfehlung; die Annahme in der Zusammenfassung nennen.

## Zusammenfassen und beginnen

Eine Zeile, dann ohne zweite Bestätigung Belege sammeln. Der Nutzer kann jederzeit korrigieren.

```text
<Typ> · <Gegenstand> · beantwortet <Frage> · <Knoteneinheit>, etwa 10 · <Ausgabeordner> · <CodeGraph | direkte Verfolgung>. Spätere Vertiefung eines Knotens ist möglich.
```

Beispiel: `sequence · Bestellmodul, OrderController.create · Aufrufreihenfolge der Bestellung · Schritte, etwa 10 · docs/qgraphflow/order-create-sequence/ · direkte Verfolgung. Ein Schritt kann später vertieft werden.`
