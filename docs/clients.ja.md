# インストールガイド

[English](clients.md) · [中文](clients.zh-CN.md) · [Русский](clients.ru.md) · [Português](clients.pt.md) · [日本語](clients.ja.md) · [Deutsch](clients.de.md) · [Español](clients.es.md)

[README に戻る](readme/README.ja.md)

Qoder Desktop ではマーケットプレイスからインストールでき、手順 1 は不要です（下記の該当項を参照）。その他のクライアントでは、npmjs.com から取得したプラグインパッケージをインストールします。

Node.js 22 以降（npm を含む）と、モデルへのアクセスを設定済みのクライアントが必要です。

## クイックインストール

```bash
npx skills add supermax92/qgraphflow
```

Claude Code、Codex、Cursor、Qoder にスキル `q-flow` を導入します（`skills` 1.7.0 で実測済み）。導入先のクライアントを尋ねられます。プラグインとして導入する場合は、次の手順に従ってください。

## 1. npm からプラグインをダウンロード

```bash
mkdir qgraphflow-install
cd qgraphflow-install
npm install qgraphflow --ignore-scripts
cd node_modules/qgraphflow
```

ディレクトリは業務プロジェクトの外に作成します。アカウント、ログイン、トークンは不要です。これでプラグインのルートディレクトリに移動できました。npm でダウンロードしてもクライアントへのインストールは自動では行われないため、手順 2 に進んでください。未リリースのコードをインストールする場合は、[ソースからのビルド手順](https://github.com/supermax92/qgraphflow/blob/main/docs/distribution.md#prepare-locally)を参照してください。

## 2. クライアントにインストール

以下のコマンドは、自分の業務プロジェクトではなく、手順 1 で移動したプラグインのルートディレクトリ（`qgraphflow-install/node_modules/qgraphflow`）で実行します。

### Codex App / CLI

```bash
codex plugin marketplace add .
codex plugin add qgraphflow@supermax92
```

ここでの `marketplace add` はローカルのインストール元を登録するだけで、公開マーケットプレイスへの掲載は不要です。[OpenAI 公式ドキュメント](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli)を参照してください。

新しいセッションを開始し、`$` を入力して `qgraphflow:q-flow` を選択します（クライアントに実際に表示される名前を使用してください）。

### Claude Code

```bash
claude plugin marketplace add ./
claude plugin install qgraphflow@supermax92 --scope user
```

新しいセッションを開始し、`/q-flow`（または完全名 `/qgraphflow:q-flow`）を入力します。

### Qoder CLI

```bash
qodercli plugins install .
```

新しいセッションを開始し、`q-flow` を選択します。

### Qoder Desktop

**推奨：** **Settings → Plugins → Marketplace** を開き、**QGraphFlow** または **代码图谱可视化** を検索してインストールします。新しいセッションを開始し、`q-flow` を選択します。

ローカルインストールの場合は手順 1 を完了し、**Settings → Plugins → Custom → Import** を開いて、プラグインのルートディレクトリ全体をインポートします。再読み込み後、`q-flow` を選択します。

### Cursor

プラグインのルートディレクトリの内容を隠しファイルも含めてすべて `~/.cursor/plugins/local/qgraphflow/` にコピーします。既存のディレクトリがある場合は先にバックアップし、新旧のファイルを混在させないでください。

マニフェストが `~/.cursor/plugins/local/qgraphflow/.cursor-plugin/plugin.json` にあることを確認します。ウィンドウを再読み込みし、Customize → Plugins / Skills で `q-flow` を選択します。

このローカル方式は Cursor 3.19.13 で検証済みです。他のバージョンでは、プラグインとスキルが表示されることを確認してください。
