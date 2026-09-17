# インストールガイド

[English](clients.md) · [中文](clients.zh-CN.md) · [Русский](clients.ru.md) · [Português](clients.pt.md) · [日本語](clients.ja.md) · [Deutsch](clients.de.md) · [Español](clients.es.md)

[README に戻る](readme/README.ja.md)

Qoder IDE ではマーケットプレイスから、Claude Code では GitHub から直接インストールできます（下記の各項を参照）。どちらも手順 1 は不要です。ローカルインストールの場合は、先に QGraphFlow のソースコードをダウンロードして実行用パッケージを作成してください。

Node.js 22 と、モデルへのアクセスを設定済みのクライアントが必要です。ソースからビルドする場合は、Git、npm、`tar`、`zip`、`unzip` も必要です。

## 1. ローカルインストール用のダウンロードとパッケージ作成

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
npm run package
unzip -q dist/qgraphflow-0.0.4.zip -d dist/runtime
```

QGraphFlow のソースコードが手元にある場合はクローンを省略し、そのルートディレクトリに移動してください。ZIP 名は QGraphFlow の `package.json` のバージョンに合わせます。出力先と展開先には新しいディレクトリを使い、既存ファイルを上書きしないでください。Git で取得できるのはプッシュ済みのコードのみで、未コミットのローカル変更は含まれません。

## 2. クライアントにインストール

以下のコマンドは、自分の業務プロジェクトではなく、QGraphFlow のソースコードのルートディレクトリで実行します。その配下の `dist/runtime` にある完全な実行用パッケージをインストールします。

### Codex App / CLI

```bash
codex plugin marketplace add ./dist/runtime
codex plugin add qgraphflow@supermax92
```

ここでの `marketplace add` はローカルのインストール元を登録するだけで、公開マーケットプレイスへの掲載は不要です。[OpenAI 公式ドキュメント](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli)を参照してください。

新しいセッションを開始し、`$` を入力して `qgraphflow:q-flow` を選択します（クライアントに実際に表示される名前を使用してください）。

### Claude Code

手順 1 を省略して GitHub から直接インストールします：

```bash
claude plugin marketplace add supermax92/qgraphflow
claude plugin install qgraphflow@supermax92 --scope user
```

または、手順 1 で作成した実行用パッケージを使います：

```bash
claude plugin marketplace add ./dist/runtime
claude plugin install qgraphflow@supermax92 --scope user
```

新しいセッションを開始し、`/q-flow`（または完全名 `/qgraphflow:q-flow`）を入力します。

### Qoder CLI

```bash
qodercli plugins install ./dist/runtime
```

新しいセッションを開始し、`q-flow` を選択します。

### Qoder IDE

**推奨：** **Settings → Plugins → Marketplace** を開き、**代码图谱可视化** または **qgraphflow** を検索してインストールします。新しいセッションを開始し、`q-flow` を選択します。ZIP のダウンロードやソースのビルドは不要です。

ローカルインストールの場合は手順 1 を完了し、**Settings → Plugins → Custom → Import** を開いて、`dist/runtime` ディレクトリ全体をインポートします。再読み込み後、`q-flow` を選択します。

### Cursor

`dist/runtime` の内容を隠しファイルも含めてすべて `~/.cursor/plugins/local/qgraphflow/` にコピーします。既存のディレクトリがある場合は先にバックアップし、新旧のファイルを混在させないでください。

マニフェストが `~/.cursor/plugins/local/qgraphflow/.cursor-plugin/plugin.json` にあることを確認します。ウィンドウを再読み込みし、Customize → Plugins / Skills で `q-flow` を選択します。

このローカル方式は Cursor 3.19.13 で検証済みです。他のバージョンでは、プラグインとスキルが表示されることを確認してください。
