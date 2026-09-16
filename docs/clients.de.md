# Installationsanleitung

[English](clients.md) · [中文](clients.zh-CN.md) · [Русский](clients.ru.md) · [Português](clients.pt.md) · [日本語](clients.ja.md) · [Deutsch](clients.de.md) · [Español](clients.es.md)

[Zurück zur README](readme/README.de.md)

Claude Code kann das Plugin direkt von GitHub installieren (siehe Abschnitt Claude Code unten). Für andere Clients lade zuerst den QGraphFlow-Quellcode herunter, erstelle das Laufzeitpaket und installiere es dann in deinem Client.

Du benötigst Node.js 22, Git, npm, `tar`, `zip`, `unzip` und einen Client mit eingerichtetem Modellzugriff.

## 1. Herunterladen und Paket erstellen

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
npm run package
unzip -q dist/qgraphflow-0.0.4.zip -d dist/runtime
```

Wenn der QGraphFlow-Quellcode bereits vorliegt, überspringe das Klonen und wechsle in dessen Stammverzeichnis. Passe den ZIP-Dateinamen an die Version in der `package.json` von QGraphFlow an. Verwende neue Ausgabe- und Entpackverzeichnisse, ohne vorhandene Dateien zu überschreiben. Git lädt nur bereits gepushten Code herunter, keine lokalen Änderungen ohne Commit.

## 2. Im Client installieren

Führe die folgenden Befehle im Stammverzeichnis des QGraphFlow-Quellcodes aus, nicht im Verzeichnis deines eigenen Anwendungsprojekts. Sie installieren das vollständige Laufzeitpaket aus dem dortigen Unterverzeichnis `dist/runtime`.

### Codex App / CLI

```bash
codex plugin marketplace add ./dist/runtime
codex plugin add qgraphflow@supermax92
```

Hier registriert `marketplace add` nur eine lokale Installationsquelle; eine Veröffentlichung im öffentlichen Marktplatz ist nicht erforderlich. Siehe die [offizielle OpenAI-Dokumentation](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli).

Starte eine neue Sitzung, gib `$` ein und wähle `qgraphflow:q-flow` aus (verwende den tatsächlich im Client angezeigten Namen).

### Claude Code

Direkt von GitHub installieren, ohne Schritt 1:

```bash
claude plugin marketplace add supermax92/qgraphflow
claude plugin install qgraphflow@supermax92 --scope user
```

Oder aus dem in Schritt 1 erstellten Laufzeitpaket:

```bash
claude plugin marketplace add ./dist/runtime
claude plugin install qgraphflow@supermax92 --scope user
```

Starte eine neue Sitzung und gib `/q-flow` (oder den vollständigen Namen `/qgraphflow:q-flow`) ein.

### Qoder CLI

```bash
qodercli plugins install ./dist/runtime
```

Starte eine neue Sitzung und wähle `q-flow` aus.

### Qoder IDE

Öffne Settings → Plugins → Import und importiere das vollständige Verzeichnis `dist/runtime`. Lade den Client neu und wähle `q-flow` aus.

### Cursor

Kopiere den gesamten Inhalt von `dist/runtime`, einschließlich versteckter Dateien, nach `~/.cursor/plugins/local/qgraphflow/`. Sichere ein vorhandenes Verzeichnis zuerst; vermische keine alten und neuen Dateien.

Prüfe, ob das Manifest unter `~/.cursor/plugins/local/qgraphflow/.cursor-plugin/plugin.json` liegt. Lade das Fenster neu und wähle unter Customize → Plugins / Skills den Skill `q-flow` aus.

Diese lokale Methode wurde mit Cursor 3.19.13 getestet. Prüfe bei anderen Versionen, ob Plugin und Skill angezeigt werden.
