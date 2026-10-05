# Installationsanleitung

[English](clients.md) · [中文](clients.zh-CN.md) · [Русский](clients.ru.md) · [Português](clients.pt.md) · [日本語](clients.ja.md) · [Deutsch](clients.de.md) · [Español](clients.es.md)

[Zurück zur README](readme/README.de.md)

Qoder Desktop kann das Plugin aus dem Marketplace installieren; dann entfällt Schritt 1 (siehe den Abschnitt unten). Die übrigen Clients installieren das Plugin-Paket von npmjs.com.

Du benötigst Node.js 22 oder neuer (mit npm) und einen Client mit eingerichtetem Modellzugriff.

## Schnellinstallation

```bash
npx skills add supermax92/qgraphflow
```

Installiert den Skill `q-flow` für Claude Code, Codex, Cursor und Qoder (getestet mit `skills` 1.7.0) und fragt, in welche Clients installiert werden soll. Für die Installation als Plugin den folgenden Schritten folgen.

## 1. Plugin über npm herunterladen

```bash
mkdir qgraphflow-install
cd qgraphflow-install
npm install qgraphflow --ignore-scripts
cd node_modules/qgraphflow
```

Lege das Verzeichnis außerhalb deines Anwendungsprojekts an; Konto, Anmeldung oder Token sind nicht nötig. Danach befindest du dich im Plugin-Stammverzeichnis. Der Download über npm installiert das Plugin nicht im Client; fahre mit Schritt 2 fort. Um noch nicht veröffentlichten Code zu installieren, siehe die [Anleitung zum Bauen aus dem Quellcode](https://github.com/supermax92/qgraphflow/blob/main/docs/distribution.md#prepare-locally).

## 2. Im Client installieren

Führe die folgenden Befehle im Plugin-Stammverzeichnis aus Schritt 1 (`qgraphflow-install/node_modules/qgraphflow`) aus, nicht im Verzeichnis deines eigenen Anwendungsprojekts.

### Codex App / CLI

```bash
codex plugin marketplace add .
codex plugin add qgraphflow@supermax92
```

Hier registriert `marketplace add` nur eine lokale Installationsquelle; eine Veröffentlichung im öffentlichen Marktplatz ist nicht erforderlich. Siehe die [offizielle OpenAI-Dokumentation](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli).

Starte eine neue Sitzung, gib `$` ein und wähle `qgraphflow:q-flow` aus (verwende den tatsächlich im Client angezeigten Namen).

### Claude Code

```bash
claude plugin marketplace add ./
claude plugin install qgraphflow@supermax92 --scope user
```

Starte eine neue Sitzung und gib `/q-flow` (oder den vollständigen Namen `/qgraphflow:q-flow`) ein.

### Qoder CLI

```bash
qodercli plugins install .
```

Starte eine neue Sitzung und wähle `q-flow` aus.

### Qoder Desktop

**Empfohlen:** Öffne **Settings → Plugins → Marketplace**, suche nach **QGraphFlow** oder **代码图谱可视化** und installiere das Plugin. Starte eine neue Sitzung und wähle `q-flow`.

Für eine lokale Installation führe zuerst Schritt 1 aus. Öffne dann **Settings → Plugins → Custom → Import** und importiere das vollständige Plugin-Stammverzeichnis. Lade den Client neu und wähle `q-flow`.

### Cursor

Kopiere den gesamten Inhalt des Plugin-Stammverzeichnisses, einschließlich versteckter Dateien, nach `~/.cursor/plugins/local/qgraphflow/`. Sichere ein vorhandenes Verzeichnis zuerst; vermische keine alten und neuen Dateien.

Prüfe, ob das Manifest unter `~/.cursor/plugins/local/qgraphflow/.cursor-plugin/plugin.json` liegt. Lade das Fenster neu und wähle unter Customize → Plugins / Skills den Skill `q-flow` aus.

Diese lokale Methode wurde mit Cursor 3.19.13 getestet. Prüfe bei anderen Versionen, ob Plugin und Skill angezeigt werden.
