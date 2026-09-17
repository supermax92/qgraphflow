<div align="center">

# QGraphFlow

### Превратите сложный код в диаграммы для исследования.

Проследите путь. Проверьте основания. Поделитесь одним автономным файлом.

[English](../../README.md) · [中文](../../docs/readme/README.zh-CN.md) · [Русский](../../docs/readme/README.ru.md) · [Português](../../docs/readme/README.pt.md) · [日本語](../../docs/readme/README.ja.md) · [Deutsch](../../docs/readme/README.de.md) · [Español](../../docs/readme/README.es.md)

[Установка для клиентов](#установка) · [Сообщить о проблеме](https://github.com/supermax92/qgraphflow/issues) · [MIT](../../LICENSE)

</div>

![Архитектура, блок-схема и последовательность торговли: 0,8 секунды на вид, 2,4 секунды на цикл, с анимацией связей](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ru.core-three.gif)

*Девять типов: архитектура, блок-схема, последовательность, ER, развёртывание, классы, состояния, варианты использования и поток данных.*

QGraphFlow создаёт интерактивные диаграммы программных систем из кода, схем данных, конфигурации и требований. Основания связей можно проверить, а результат — передать как автономный HTML.

- **Исследование:** поиск, масштабирование и перемещение холста; назначение компонентов, входящие и исходящие связи.
- **Проверка:** файлы, строки, символы и явно обозначенная неопределённость в узлах и связях.
- **Редактирование:** разблокировка расположения, изменение текста и перемещение элементов; сброс при необходимости.
- **Обмен:** автономный HTML или экспорт всей диаграммы в SVG / PNG.

*Исследование: откройте навигацию, найдите координатор покупки и перейдите к нему. Щелчок по узлу открывает краткую карточку и выделяет входящие и исходящие связи. Затем измените масштаб и переместите холст.*

![Навигация, поиск, карточка узла, выделение связей, масштабирование и перемещение](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ru.explore.gif)

*Проверка: из карточки откройте панель сведений с путями, строками и символами. Затем выберите связь и прочитайте объяснение и отметку предположения.*

Пути, номера строк и символы в этой демонстрации вымышлены. Они показывают работу панели оснований и не являются кодом репозитория; это явно указано на странице и в сведениях. Для реального анализа используйте настоящие источники, а неподтверждённые связи помечайте как предположения.

![Сведения с явно вымышленными путями, строками, символами и предположениями о связях](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ru.verify.gif)

*Редактирование: в меню **Ещё** разблокируйте расположение, измените имя и описание узла, перетащите его вместе со связями, затем восстановите исходные текст и положение сбросом.*

![Разблокировка, изменение текста, перемещение узла со связями и сброс](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ru.edit.gif)

*Обмен: откройте HTML без сети, через **Ещё** экспортируйте SVG и PNG, затем откройте PNG и проверьте полный рисунок.*

![Автономный HTML, экспорт SVG и PNG, просмотр полученного PNG](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ru.share.gif)

Обзор показывает каждый из трёх видов по 0,8 секунды, полный цикл занимает 2,4 секунды. Четыре анимации взаимодействия оставляют время для чтения. Все изображения используют Viewer, собранный из исходного кода, с русскими текстами диаграмм и интерфейса. Пять GIF и девять PNG размещены отдельными [файлами Release showcase-v1](https://github.com/supermax92/qgraphflow/releases/tag/showcase-v1); публичное скачивание и суммы SHA-256 проверены. Они не входят в историю Git и пакеты плагина; для просмотра нужен интернет. Сам HTML-файл диаграммы работает офлайн.

## Установка

Нужны Node.js 22 и клиент с поддержкой плагинов и настроенным доступом к модели.

### 1. Скачайте плагин

Скачайте [qgraphflow-0.0.4.zip](https://github.com/supermax92/qgraphflow/releases/download/v0.0.4/qgraphflow-0.0.4.zip) и распакуйте в отдельный каталог, сохранив скрытые файлы.

Все команды ниже выполняйте из **корневого каталога распакованного плагина, содержащего `skills/`**.

### 2. Установите в свой клиент

#### Codex App / CLI

В терминале должен быть доступен установленный Codex CLI:

```bash
codex plugin marketplace add .
codex plugin add qgraphflow@supermax92
```

Начните новую сессию, введите `$` и выберите `qgraphflow:q-flow`.

#### Claude Code

Установите напрямую с GitHub без скачивания ZIP:

```bash
claude plugin marketplace add supermax92/qgraphflow
claude plugin install qgraphflow@supermax92 --scope user
```

Или из корня распакованного плагина:

```bash
claude plugin marketplace add .
claude plugin install qgraphflow@supermax92 --scope user
```

Начните новую сессию и введите `/q-flow` (или полное имя `/qgraphflow:q-flow`).

#### Qoder CLI

```bash
qodercli plugins install .
```

Начните новую сессию и выберите `q-flow`.

#### Qoder IDE

Откройте **Settings → Plugins → Custom → Import**, импортируйте корневой каталог плагина целиком и выберите `q-flow`.

#### Cursor

Скопируйте всё содержимое корневого каталога плагина, включая скрытые файлы, в:

```text
~/.cursor/plugins/local/qgraphflow/
```

Убедитесь, что там есть `.cursor-plugin/plugin.json`, перезагрузите окно и найдите `q-flow` в **Customize**. Если уже установлена старая версия, сначала сделайте резервную копию; не смешивайте старые и новые файлы.

### 3. Начните работу

Откройте свой проект в клиенте, начните новую сессию и выберите навык. Опишите задачу по примерам в разделе [Быстрый старт](#быстрый-старт) ниже. Откройте полученный HTML в браузере.

<details>
<summary>Другой способ установки: GitHub npm</summary>

Вместо ZIP можно получить плагин через npm.

GitHub npm требует ваш собственный GitHub **Personal access token (classic)** с разрешением `read:packages`. При входе укажите своё имя пользователя GitHub, а вместо пароля — токен.

Не передавайте токен другим и не добавляйте его в репозиторий. Подробнее: [аутентификация GitHub](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).

```bash
npm config set @supermax92:registry=https://npm.pkg.github.com --location=user
npm login --scope=@supermax92 --auth-type=legacy --registry=https://npm.pkg.github.com
```

Создайте отдельный каталог вне своего рабочего проекта:

```bash
mkdir qgraphflow-install
cd qgraphflow-install
npm install @supermax92/qgraphflow@0.0.4 --ignore-scripts
cd node_modules/@supermax92/qgraphflow
```

Теперь вы в корневом каталоге плагина. Продолжите установку для своего клиента по шагам выше. **Загрузка через npm не устанавливает плагин в клиент автоматически.**

</details>

Хотите собрать самостоятельно? См. [инструкции по сборке из исходников](https://github.com/supermax92/qgraphflow/blob/main/docs/distribution.md#prepare-locally).

## Быстрый старт

Примеры используют `$qgraphflow:q-flow` в Codex. Если клиент показывает `$q-flow`, выберите этот пункт. Для других клиентов используйте способ вызова навыка, указанный выше.

**Не знаете, с чего начать?** Вызовите навык, затем выберите предмет и вопрос по подсказке.

```text
$qgraphflow:q-flow
```

**Цель уже ясна?** Укажите, какую часть нарисовать и что требуется понять. Тип диаграммы заранее выбирать не нужно.

### Пример 1: Понять архитектуру проекта

```text
$qgraphflow:q-flow Проанализируй текущий проект и создай диаграмму архитектуры на русском языке: обязанности модулей, зависимости и границы системы.
```

Подходит для первого знакомства с общей структурой проекта.

### Пример 2: Проследить бизнес-процесс

```text
$qgraphflow:q-flow Проанализируй создание заказа и создай диаграмму последовательности на русском языке: расчёт цены, резерв запасов, оплата и сохранение заказа, включая ветки сбоев.
```

Замените создание заказа и его шаги реальным процессом проекта. Продолжите в том же разговоре:

```text
$qgraphflow:q-flow Подробно раскрой резерв запасов из предыдущей диаграммы отдельной блок-схемой на русском языке с обработкой успеха и сбоев.
```

По умолчанию результаты находятся в `docs/qgraphflow/`. Откройте `index.html` для исследования, редактирования и экспорта; `graph.json` хранит данные графа.

<details>
<summary>Запустить торговый пример с девятью видами вручную</summary>

Команды ниже запускают пример из репозитория. Для использования установленного плагина клонировать репозиторий не нужно. Подготовьте Node.js 22:

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
node skills/q-flow/scripts/validate-graph.mjs examples/showcase/ecommerce.ru.graph.json
node skills/q-flow/scripts/generate-viewer.mjs examples/showcase/ecommerce.ru.graph.json output/ecommerce-ru
```

Откройте `output/ecommerce-ru/index.html` в браузере. Переключайтесь через **Типы диаграмм** в верхней панели: сохранённые тексты и позиции сохраняются для каждого вида. **Ещё → Сохранить Graph JSON** записывает все виды в выбранный JSON-файл; браузеры без записи файлов скачивают копию. Перезагрузка исходного HTML возвращает встроенные данные. Чтобы снова открыть правки, сгенерируйте страницу из сохранённого JSON в новый каталог.

Готовому Viewer не нужны дополнительные зависимости, ключ API или серверная служба. Сбор оснований и создание графов с помощью ИИ используют модельный сервис выбранного клиента.

</details>

## На какие вопросы отвечают девять видов

| Вид · PNG | Главный вопрос | Область примера |
| --- | --- | --- |
| [Архитектура](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ru.architecture.png) | Какие зоны ответственности взаимодействуют? | Каналы, покупка, цены, риски, запасы, оплата, заказы, события и доставка |
| [Блок-схема](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ru.flowchart.png) | Где процесс ветвится и сходится? | Нехватка запасов, отказ по риску, компенсация оплаты и успешная фиксация |
| [Последовательность](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ru.sequence.png) | Каков порядок вызовов и ответов? | Успешная покупка и асинхронный OrderPaid |
| [ER](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ru.er.png) | Как связаны основные данные? | Корзина, заказы, позиции, платежи, резервы и посылки |
| [Развёртывание](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ru.deployment.png) | Где работают и как соединены единицы исполнения? | Периметр, Kubernetes, данные, платежи и логистические сети |
| [Классы](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ru.class.png) | Как зависят объекты домена и контракты? | Сервис покупки, Order и четыре порта |
| [Состояния](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ru.state.png) | Какие события и условия продвигают заказ? | Оплата, доставка, отмена, возврат денег и закрытие |
| [Варианты использования](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ru.usecase.png) | Что может каждый участник? | Покупатель, продавец, склад и поддержка |
| [Поток данных](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ru.dataflow.png) | Как данные преобразуются и сохраняются? | Корзина, решения, события, склад и подтверждения доставки |

Это концептуальная демонстрация QGraphFlow, а не модель конкретного торгового репозитория. Пример `graph.json` не выдумывает пути к коду и обозначает основания связей как `inference`. Диаграммы реальных проектов требуют прослеживаемых исходников, DDL, конфигурации, тестов и согласованных требований.

## Разработка и участие

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

Нужны Node.js 22, npm, tar, zip и unzip. В сообщении о проблеме приложите минимальный граф без конфиденциальных данных, версии клиента и браузера и шаги воспроизведения.

Справочная документация (на английском): [Источники оснований](../../skills/q-flow/references/evidence-sources.md) · [Формат графов](../../skills/q-flow/references/graph-schema.md) · [Уточнение запроса](../../skills/q-flow/references/guided-intake.md) · [Разработка Viewer](../../skills/q-flow/references/viewer-development.md) · [Композиция диаграмм](../../skills/q-flow/references/visual-contract.md)

## Лицензия и принадлежность

[MIT](../../LICENSE) · [Уведомления третьих сторон](../../THIRD_PARTY_NOTICES.md)

QGraphFlow — независимый проект под лицензией MIT. Торговый сценарий является концептуальным и не представляет производственную архитектуру какой-либо компании; связь, спонсорство или одобрение не подразумеваются.
