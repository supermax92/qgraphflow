# Guía de instalación

[English](clients.md) · [中文](clients.zh-CN.md) · [Русский](clients.ru.md) · [Português](clients.pt.md) · [日本語](clients.ja.md) · [Deutsch](clients.de.md) · [Español](clients.es.md)

[Volver al README](readme/README.es.md)

El complemento aún no está publicado en los marketplaces públicos. Primero descarga el código fuente de QGraphFlow, genera el paquete de ejecución e instálalo en tu cliente.

Necesitas Node.js 22, Git, npm, `tar`, `zip`, `unzip` y un cliente con acceso al modelo configurado.

## 1. Descargar y generar el paquete

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
npm run package
unzip -q dist/qgraphflow-0.0.2.zip -d dist/runtime
```

Si ya tienes el código fuente de QGraphFlow, omite la clonación y entra en su directorio raíz. Ajusta el nombre del ZIP a la versión del `package.json` de QGraphFlow. Usa directorios nuevos para generar y extraer el paquete, sin sobrescribir archivos existentes. Git solo descarga el código enviado al repositorio, no los cambios locales sin commit.

## 2. Instalar en el cliente

Ejecuta los siguientes comandos desde la raíz del código fuente de QGraphFlow, no desde el directorio de tu propio proyecto. Instalan el paquete completo de la subcarpeta `dist/runtime`.

### Codex App / CLI

```bash
codex plugin marketplace add ./dist/runtime
codex plugin add qgraphflow@qgraphflow-local
```

Aquí, `marketplace add` solo registra una fuente de instalación local; no requiere publicar el complemento en un marketplace público. Consulta la [documentación oficial de OpenAI](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli).

Inicia una sesión nueva, escribe `$` y selecciona `qgraphflow:q-flow` (usa el nombre que muestre tu cliente).

### Claude Code

```bash
claude plugin marketplace add ./dist/runtime
claude plugin install qgraphflow@qgraphflow-local --scope user
```

Inicia una sesión nueva y escribe `/qgraphflow:q-flow`.

### Qoder CLI

```bash
qodercli plugins install ./dist/runtime
```

Inicia una sesión nueva y selecciona `q-flow`.

### Qoder IDE

Abre Settings → Plugins → Import e importa el directorio completo `dist/runtime`. Recarga el cliente y selecciona `q-flow`.

### Cursor

Copia todo el contenido de `dist/runtime`, incluidos los archivos ocultos, a `~/.cursor/plugins/local/qgraphflow/`. Si el directorio ya existe, haz una copia de seguridad antes; no mezcles archivos antiguos y nuevos.

Comprueba que el manifiesto esté en `~/.cursor/plugins/local/qgraphflow/.cursor-plugin/plugin.json`. Recarga la ventana y selecciona `q-flow` en Customize → Plugins / Skills.

Este método local se probó en Cursor 3.19.13. En otras versiones, comprueba que aparezcan tanto el complemento como la habilidad.
