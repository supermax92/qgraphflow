# Belegquellen und Ersatz für CodeGraph

[English](../../../skills/q-flow/references/evidence-sources.md) · [简体中文](../zh-CN/evidence-sources.md) · [Русский](../ru/evidence-sources.md) · [Português](../pt/evidence-sources.md) · [日本語](../ja/evidence-sources.md) · [Deutsch](evidence-sources.md) · [Español](../es/evidence-sources.md)

CodeGraph beschleunigt vorzugsweise die Aufrufgraphanalyse, ist aber keine zwingende Abhängigkeit.

## CodeGraph vorab prüfen

Gemeint ist [`colbymchenry/codegraph`](https://github.com/colbymchenry/codegraph), verfügbar über lokale CLI oder MCP-Server.

1. Prüfen, ob `codegraph` im `PATH` und `.codegraph/` im Zielrepository vorhanden sind.
2. Wenn beides vorhanden ist, `codegraph status` ausführen und vor direkter Quellverfolgung genau eine begrenzte Abfrage mit `codegraph explore "<question or symbols>"` verwenden.
3. Ein bereits eingerichtetes CodeGraph-MCP-Werkzeug kann dieselbe begrenzte Abfrage übernehmen. Tatsächlich verfügbare Werkzeuge verwenden; keine clientspezifischen Werkzeugnamen voraussetzen.
4. Fehlen CLI, MCP-Werkzeug oder aktueller Index, direkt mit dem folgenden Ersatzverfahren fortfahren. Normales Zeichnen benötigt weder Installation/Initialisierung von CodeGraph noch npm-Versionsauflösung oder Änderungen der Clientkonfiguration.

## Optionale Einrichtung auf Anfrage

1. Nur bei angeforderter oder genehmigter Einrichtung mit `npm view @colbymchenry/codegraph version` die genaue stabile Version ermitteln und deren offizielle Installationsanleitung und unterstützte Ziele prüfen.
2. Vor der Installation Client, Befehl und Schreibziele bestimmen: ausführbare Datei, Clientkonfiguration/Anweisungen und `.codegraph/`-Index. Projektlokale Konfiguration bevorzugen, soweit unterstützt. Weder überall `--target=codex` annehmen noch Zielwerte aus Clientnamen erfinden.
3. Die ermittelte Paketversion festlegen. Nur im autorisierten Repository initialisieren. Fehlt eine Installerintegration, eine unterstützte eigenständige CLI-Einrichtung oder direkte Quellverfolgung verwenden; MCP ist nicht zwingend.
4. Anschließend `codegraph status` prüfen und verfügbare CLI oder MCP verwenden. Falls erforderlich nach Clientvorgabe neu laden/starten. Fehler bei Auflösung oder Installation melden und direkt im Code weiterarbeiten, ohne automatisch andere Installer zu versuchen.

## Reihenfolge des Ersatzverfahrens

1. Mit `rg --files` beginnen, dann `rg` auf Deklarationen, Einstiegspunkte, Aufrufer, Implementierungen, Konfigurationsschlüssel und Tests begrenzen.
2. Den vollständigen relevanten Quellpfad lesen; Datei-, Zeilen- und Symbolanker bewahren.
3. Buildmodelle, Paketartefakte, gezielte Tests und Laufzeitkonfiguration prüfen, wenn sie die Schlussfolgerung beeinflussen.
4. Frameworkdokumentation nur für Frameworkverhalten verwenden und als `framework`, nicht als Repository-Quellbeleg kennzeichnen.
5. Unbestätigte, nicht kritische Beziehungen mit `inference` markieren. Ungeklärte Beziehungen aus dem behaupteten Hauptpfad weglassen.

## Maßgebliche Quellen je Diagramm

| Diagramm | Bevorzugte Belege ohne CodeGraph |
| --- | --- |
| Architektur, Sequenz, Klasse, Datenfluss | Einstiegspunkte, Aufrufer, Schnittstellen, Implementierungen, Buildabhängigkeiten, RPC/MQ-Clients und gezielte Tests |
| Ablauf, Zustand, Anwendungsfall | Akzeptierte Anforderungen und API-Dokumente, danach Controller-/Serviceverhalten und Tests; Abweichungen zwischen Dokumentation und Implementierung getrennt zeigen |
| ER | Zuerst DDL und Migrationen, danach JPA-Entitäten, ORM/MyBatis-Zuordnungen, Constraints und Repository-Tests |
| Bereitstellung | Dockerfile, Compose, Kubernetes, Helm, Dienstkonfiguration, Netzwerkrichtlinien und CI/CD-Manifeste |

Direkte Verfolgung garantiert keine vollständige Erfassung von Reflection, Dependency Injection, generierten Proxys, Laufzeitrouting, RPC oder Messaging. Diese Grenze nennen und `source`, `config`, `schema`, `test`, `document`, `framework` und `inference` unterscheiden.
