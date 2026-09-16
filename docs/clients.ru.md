# Руководство по установке

[English](clients.md) · [中文](clients.zh-CN.md) · [Русский](clients.ru.md) · [Português](clients.pt.md) · [日本語](clients.ja.md) · [Deutsch](clients.de.md) · [Español](clients.es.md)

[Вернуться к README](readme/README.ru.md)

Claude Code может установить плагин напрямую с GitHub (см. раздел Claude Code ниже). Для других клиентов сначала скачайте исходный код QGraphFlow и соберите пакет для установки, затем установите его в свой клиент.

Нужны Node.js 22, Git, npm, `tar`, `zip`, `unzip` и клиент с настроенным доступом к модели.

## 1. Скачать и собрать

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
npm run package
unzip -q dist/qgraphflow-0.0.3.zip -d dist/runtime
```

Если исходный код QGraphFlow уже скачан, пропустите клонирование и перейдите в его корневой каталог. Имя ZIP должно соответствовать версии в `package.json` проекта QGraphFlow. Используйте новые каталоги для сборки и распаковки, не перезаписывая старые файлы. Git скачивает только отправленный в репозиторий код, без незакоммиченных локальных изменений.

## 2. Установить в клиент

Выполняйте команды ниже из корневого каталога исходного кода QGraphFlow, а не из каталога вашего приложения. Они устанавливают полный пакет из вложенного каталога `dist/runtime`.

### Codex App / CLI

```bash
codex plugin marketplace add ./dist/runtime
codex plugin add qgraphflow@supermax92
```

Здесь `marketplace add` только регистрирует локальный источник установки; публикация в маркетплейсе не требуется. См. [официальную документацию OpenAI](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli).

Начните новый сеанс, введите `$` и выберите `qgraphflow:q-flow` (используйте имя, которое показывает ваш клиент).

### Claude Code

Установите напрямую с GitHub, пропустив шаг 1:

```bash
claude plugin marketplace add supermax92/qgraphflow
claude plugin install qgraphflow@supermax92 --scope user
```

Или из пакета, собранного на шаге 1:

```bash
claude plugin marketplace add ./dist/runtime
claude plugin install qgraphflow@supermax92 --scope user
```

Начните новый сеанс и введите `/q-flow` (или полное имя `/qgraphflow:q-flow`).

### Qoder CLI

```bash
qodercli plugins install ./dist/runtime
```

Начните новый сеанс и выберите `q-flow`.

### Qoder IDE

Откройте Settings → Plugins → Import и импортируйте весь каталог `dist/runtime`. Перезагрузите клиент и выберите `q-flow`.

### Cursor

Скопируйте всё содержимое `dist/runtime`, включая скрытые файлы, в `~/.cursor/plugins/local/qgraphflow/`. Если каталог уже существует, сначала сделайте резервную копию; не смешивайте старые и новые файлы.

Убедитесь, что манифест находится по адресу `~/.cursor/plugins/local/qgraphflow/.cursor-plugin/plugin.json`. Перезагрузите окно и выберите `q-flow` в Customize → Plugins / Skills.

Этот способ локальной установки проверялся в Cursor 3.19.13. В других версиях убедитесь, что плагин и навык отображаются.
