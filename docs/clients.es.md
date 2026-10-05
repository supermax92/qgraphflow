# Guía de instalación

[English](clients.md) · [中文](clients.zh-CN.md) · [Русский](clients.ru.md) · [Português](clients.pt.md) · [日本語](clients.ja.md) · [Deutsch](clients.de.md) · [Español](clients.es.md)

[Volver al README](readme/README.es.md)

Qoder Desktop permite instalar el complemento desde su Marketplace y omitir el paso 1 (consulta su sección más abajo). Los demás clientes instalan el paquete del complemento obtenido de npmjs.com.

Necesitas Node.js 22 o posterior (con npm) y un cliente con acceso al modelo configurado.

## Instalación rápida

```bash
npx skills add supermax92/qgraphflow
```

Instala la habilidad `q-flow` en Claude Code, Codex, Cursor y Qoder (probado con `skills` 1.7.0) y pregunta en qué clientes instalar. Para instalar el complemento, sigue los pasos siguientes.

## 1. Descargar el complemento con npm

```bash
mkdir qgraphflow-install
cd qgraphflow-install
npm install qgraphflow --ignore-scripts
cd node_modules/qgraphflow
```

Crea el directorio fuera del proyecto de tu aplicación; no se necesita cuenta, inicio de sesión ni token. Ahora estás en la raíz del complemento. La descarga mediante npm no instala el complemento en el cliente; continúa con el paso 2. Para instalar código aún no publicado, consulta las [instrucciones de compilación desde el código fuente](https://github.com/supermax92/qgraphflow/blob/main/docs/distribution.md#prepare-locally).

## 2. Instalar en el cliente

Ejecuta los siguientes comandos desde la raíz del complemento a la que entraste en el paso 1 (`qgraphflow-install/node_modules/qgraphflow`), no desde el directorio de tu propio proyecto.

### Codex App / CLI

```bash
codex plugin marketplace add .
codex plugin add qgraphflow@supermax92
```

Aquí, `marketplace add` solo registra una fuente de instalación local; no requiere publicar el complemento en un marketplace público. Consulta la [documentación oficial de OpenAI](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli).

Inicia una sesión nueva, escribe `$` y selecciona `qgraphflow:q-flow` (usa el nombre que muestre tu cliente).

### Claude Code

```bash
claude plugin marketplace add ./
claude plugin install qgraphflow@supermax92 --scope user
```

Inicia una sesión nueva y escribe `/q-flow` (o el nombre completo `/qgraphflow:q-flow`).

### Qoder CLI

```bash
qodercli plugins install .
```

Inicia una sesión nueva y selecciona `q-flow`.

### Qoder Desktop

**Recomendado:** Abre **Settings → Plugins → Marketplace**, busca **QGraphFlow** o **代码图谱可视化** e instala el complemento. Inicia una sesión nueva y selecciona `q-flow`.

Para una instalación local, completa primero el paso 1. Después abre **Settings → Plugins → Custom → Import** e importa el directorio raíz completo del complemento. Recarga el cliente y selecciona `q-flow`.

### Cursor

Copia todo el contenido de la raíz del complemento, incluidos los archivos ocultos, a `~/.cursor/plugins/local/qgraphflow/`. Si el directorio ya existe, haz una copia de seguridad antes; no mezcles archivos antiguos y nuevos.

Comprueba que el manifiesto esté en `~/.cursor/plugins/local/qgraphflow/.cursor-plugin/plugin.json`. Recarga la ventana y selecciona `q-flow` en Customize → Plugins / Skills.

Este método local se probó en Cursor 3.19.13. En otras versiones, comprueba que aparezcan tanto el complemento como la habilidad.
