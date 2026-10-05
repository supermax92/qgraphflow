# Руководство по установке

[English](clients.md) · [中文](clients.zh-CN.md) · [Русский](clients.ru.md) · [Português](clients.pt.md) · [日本語](clients.ja.md) · [Deutsch](clients.de.md) · [Español](clients.es.md)

[Вернуться к README](readme/README.ru.md)

В Qoder Desktop плагин можно установить из Marketplace и пропустить шаг 1 (см. соответствующий раздел ниже). Остальные клиенты устанавливают пакет плагина с npmjs.com.

Нужны Node.js 22 или новее (с npm) и клиент с настроенным доступом к модели.

## Быстрая установка

```bash
npx skills add supermax92/qgraphflow
```

Устанавливает навык `q-flow` для Claude Code, Codex, Cursor и Qoder (проверено с `skills` 1.7.0) и спрашивает, в какие клиенты устанавливать. Чтобы установить плагин, выполните шаги ниже.

## 1. Скачать плагин из npm

```bash
mkdir qgraphflow-install
cd qgraphflow-install
npm install qgraphflow --ignore-scripts
cd node_modules/qgraphflow
```

Создайте каталог вне своего рабочего проекта; учётная запись, вход и токен не нужны. Теперь вы в корневом каталоге плагина. Загрузка через npm не устанавливает плагин в клиент — перейдите к шагу 2. Чтобы установить ещё не выпущенный код, см. [инструкции по сборке из исходников](https://github.com/supermax92/qgraphflow/blob/main/docs/distribution.md#prepare-locally).

## 2. Установить в клиент

Выполняйте команды ниже из корневого каталога плагина, в который вы перешли на шаге 1 (`qgraphflow-install/node_modules/qgraphflow`), а не из каталога вашего приложения.

### Codex App / CLI

```bash
codex plugin marketplace add .
codex plugin add qgraphflow@supermax92
```

Здесь `marketplace add` только регистрирует локальный источник установки; публикация в маркетплейсе не требуется. См. [официальную документацию OpenAI](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli).

Начните новый сеанс, введите `$` и выберите `qgraphflow:q-flow` (используйте имя, которое показывает ваш клиент).

### Claude Code

```bash
claude plugin marketplace add ./
claude plugin install qgraphflow@supermax92 --scope user
```

Начните новый сеанс и введите `/q-flow` (или полное имя `/qgraphflow:q-flow`).

### Qoder CLI

```bash
qodercli plugins install .
```

Начните новый сеанс и выберите `q-flow`.

### Qoder Desktop

**Рекомендуется:** Откройте **Settings → Plugins → Marketplace**, найдите **QGraphFlow** или **代码图谱可视化** и установите плагин. Начните новый сеанс и выберите `q-flow`.

Для локальной установки выполните шаг 1, затем откройте **Settings → Plugins → Custom → Import** и импортируйте весь корневой каталог плагина. Перезагрузите клиент и выберите `q-flow`.

### Cursor

Скопируйте всё содержимое корневого каталога плагина, включая скрытые файлы, в `~/.cursor/plugins/local/qgraphflow/`. Если каталог уже существует, сначала сделайте резервную копию; не смешивайте старые и новые файлы.

Убедитесь, что манифест находится по адресу `~/.cursor/plugins/local/qgraphflow/.cursor-plugin/plugin.json`. Перезагрузите окно и выберите `q-flow` в Customize → Plugins / Skills.

Этот способ локальной установки проверялся в Cursor 3.19.13. В других версиях убедитесь, что плагин и навык отображаются.
