<div align="center">

<h1><picture><source media="(prefers-color-scheme: dark)" srcset="../images/brand/qgraphflow-lockup-dark.svg"><img src="../images/brand/qgraphflow-lockup-light.svg" alt="QGraphFlow" height="64"></picture></h1>

### 複雑なコードを、探索できる図へ。

経路をたどり、根拠を確認し、ひとつのオフラインファイルで共有。

<sub>💡 <a href="https://github.com/Cocoon-AI/architecture-diagram-generator">Cocoon-AI/architecture-diagram-generator</a> に着想を得ました。原作者に感謝します。</sub>

[English](../../README.md) · [中文](../../docs/readme/README.zh-CN.md) · [Русский](../../docs/readme/README.ru.md) · [Português](../../docs/readme/README.pt.md) · [日本語](../../docs/readme/README.ja.md) · [Deutsch](../../docs/readme/README.de.md) · [Español](../../docs/readme/README.es.md)

[オンラインデモ](https://supermax92.github.io/qgraphflow/) · [クライアントへの導入](#インストールガイド) · [問題を報告](https://github.com/supermax92/qgraphflow/issues) · [MIT](../../LICENSE)

</div>

![agent-desk サンプルのアーキテクチャ図・シーケンス図・ER 図を 1.5 秒ずつ](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.ja.hero.gif)

*9種類の図に対応：アーキテクチャ、フローチャート、シーケンス、ER、配置、クラス、状態、ユースケース、データフロー。*

QGraphFlow はソースコード、データ構造、設定、要件から対話型のソフトウェア図を生成します。関係の根拠を確認し、共有可能なオフライン HTML として届けます。

**ここが違う：** 1 つのスキルで 9 種類の図、すべての関係に出典、自動レイアウト、ページ上での編集。プラグインのスクリプトと Viewer 自体はネットワーク通信を一切行いません。

```bash
npx skills add supermax92/qgraphflow
```

1 つのコマンドで Claude Code、Codex、Cursor、Qoder にスキルを導入できます。プラグインとしての導入やほかのクライアントは[インストールガイド](#インストールガイド)を参照してください。

- **探索：** 検索・拡大縮小・パンで、責務と上流・下流の関係を確認。

  ![探索：refund を検索して注文ツールへジャンプし、上流のエージェントオーケストレーターと下流の注文データベース・配送追跡サービスが見えるまで縮小してからパンする](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.ja.explore.gif)

- **検証：** ノードや接続線からファイル、行番号、シンボル、明示された不確実性を確認。

  ![検証：src/gateway/chat-gateway.js:5-19 を示すカード、シンボルと根拠事実を示す詳細パネル、そして inference と記された POST /chat の接続線](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.ja.verify.gif)

- **編集：** ロック解除後に文字や位置を変更。必要に応じてリセット。

  ![編集：ロックを解除し、LLM プロバイダーを LLM ゲートウェイに改名し、接続線ごとドラッグしてからリセットする](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.ja.edit.gif)

- **共有：** オフライン HTML を開くか、図全体を SVG / PNG に出力。

  ![共有：オフライン HTML を開き、「その他」から PNG を書き出し、書き出されたファイルそのものを表示する](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.ja.share.gif)

上部のアニメーションはアーキテクチャ図・シーケンス図・ER 図を 1.5 秒ずつ（1 ループ 4.5 秒）表示し、4 つの機能アニメーションは 6.5〜8.5 秒です。すべてソースからビルドした Viewer で [agent-desk サンプル](../../examples/showcase/agent-desk)（架空の業務、実在のコード）を日本語の図と UI で録画しています。[showcase-v2 Release のアセット](https://github.com/supermax92/qgraphflow/releases/tag/showcase-v2)として配置し、Git 履歴やプラグインパッケージには含めないため閲覧にはネットワークが必要です。生成された図の HTML 自体はオフラインで動作します。

## インストールガイド

Node.js 22 以降と、プラグインに対応しモデルへのアクセスを設定済みのクライアントを用意してください。

### クイックインストール

```bash
npx skills add supermax92/qgraphflow
```

`skills` 1.7.0 で Claude Code、Codex、Cursor、Qoder への導入を実測済みです。導入先のクライアントを尋ねられます。`-a claude-code` で直接指定でき、`-g` を付けると現在のプロジェクトではなくユーザー単位で導入します。この方法で導入したスキル名は `q-flow` で、下のプラグイン導入で付く `qgraphflow:` という接頭辞は付きません。

プラグインとして導入する場合は、次の手順に従ってください。[Qoder Desktop](#qoder-desktop) ではマーケットプレイスから直接インストールできるため、手順 1 は不要です。

### 1. プラグインをダウンロード

npmjs.com からプラグインを取得します。アカウント、ログイン、トークンは不要です。業務プロジェクトの外に専用ディレクトリを作成します。

```bash
mkdir qgraphflow-install
cd qgraphflow-install
npm install qgraphflow --ignore-scripts
cd node_modules/qgraphflow
```

これでプラグインのルートディレクトリに移動できました。**npm でダウンロードしても、クライアントへのインストールは自動では行われません。** 手順 2 に進んでください。このパッケージには `qgraphflow` コマンドも含まれ、[図とコードを同期させる](#図とコードを同期させる)で使います。

以下のコマンドはすべて、**`skills/` を含むプラグインのルートディレクトリ**で実行してください。

### 2. クライアントにインストール

#### Codex App / CLI

ターミナルで Codex CLI を使用できるよう、あらかじめインストールしてください。

```bash
codex plugin marketplace add .
codex plugin add qgraphflow@supermax92
```

新しいセッションを開始し、`$` を入力して `qgraphflow:q-flow` を選択します。

#### Claude Code

```bash
claude plugin marketplace add .
claude plugin install qgraphflow@supermax92 --scope user
```

新しいセッションを開始し、`/q-flow`（または完全名 `/qgraphflow:q-flow`）を入力します。

#### Qoder CLI

```bash
qodercli plugins install .
```

新しいセッションを開始し、`q-flow` を選択します。

#### Qoder Desktop

**推奨：** **Settings → Plugins → Marketplace** を開き、**QGraphFlow** または **代码图谱可视化** を検索してインストールします。新しいセッションを開始し、`q-flow` を選択します。

ローカルインストールの場合は手順 1 を完了し、**Settings → Plugins → Custom → Import** を開いて、プラグインのルートディレクトリ全体をインポートします。新しいセッションで `q-flow` を選択します。

#### Cursor

プラグインのルートディレクトリ内のすべてのファイル（隠しファイルを含む）を、次の場所にコピーします。

```text
~/.cursor/plugins/local/qgraphflow/
```

その中に `.cursor-plugin/plugin.json` があることを確認し、ウィンドウを再読み込みして **Customize** で `q-flow` を探します。旧バージョンがある場合は先にバックアップし、新旧のファイルを混在させないでください。

### 3. 使い始める

クライアントで対象のプロジェクトを開き、新しいセッションでスキルを選択します。下の[すぐに使う](#すぐに使う)の例を参考に依頼し、生成された HTML をブラウザで開いてください。

自分でビルドする場合は、[ソースからのビルド手順](https://github.com/supermax92/qgraphflow/blob/main/docs/distribution.md#prepare-locally)を参照してください。

## すぐに使う

以下は Codex の `$qgraphflow:q-flow` を使う例です。クライアントに `$q-flow` と表示される場合は、その入口を選択してください。他のクライアントでは、上記の対応するスキルの呼び出し方を使います。

**どこから始めるか迷ったら：** スキルを呼び出し、案内に従って対象と知りたいことを選びます。

```text
$qgraphflow:q-flow
```

**目的が決まっているなら：** 「どの部分を描くか＋何を知りたいか」を伝えます。先に図の種類を選ぶ必要はありません。

### 例1：プロジェクト構造を理解する

```text
$qgraphflow:q-flow 現在のプロジェクトを分析し、主要モジュールの責務、依存関係、システム境界を示す日本語のアーキテクチャ図を作成してください。
```

初めて触れるプロジェクトの全体像をつかむのに適しています。

### 例2：業務の呼び出しを追う

```text
$qgraphflow:q-flow 注文作成フローを分析し、価格計算、在庫引当、支払い、注文保存の呼び出し順と失敗分岐を示す日本語のシーケンス図を作成してください。
```

「注文作成」と各手順を実際の業務フローに置き換えてください。同じ会話で続けて依頼できます。

```text
$qgraphflow:q-flow 前の図の在庫引当を掘り下げ、成功時と失敗時の処理を示す日本語のフローチャートを別に作成してください。
```

既定の保存先は `docs/qgraphflow/` 配下です。`index.html` を開いて探索・編集・出力でき、`graph.json` に図データが残ります。各ビューは SVG（`diagram.svg`、複数ビューでは `diagram-<n>-<type>.svg`）としても書き出され、README、プルリクエスト、Wiki に画像として埋め込めます。

ページで編集したあと、Chrome または Edge で「その他 → 変更を保存」を実行し、図のフォルダーを一度選ぶと、ページ、`graph.json`、SVG がその場で書き換わります。ほかのブラウザーは `graph.json` だけを保存します。そのフォルダーに置いてから `npx -y qgraphflow generate docs/qgraphflow/<name>/graph.json docs/qgraphflow/<name> --layout preserve --force` でページと SVG を再生成してください。

<details>
<summary>EC の9種類のサンプルを手動で実行</summary>

次のコマンドはリポジトリ内のサンプル用です。導入済みプラグインの使用には、このリポジトリの複製は不要です。Node.js 22 以降を用意して実行します。

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
node skills/q-flow/scripts/validate-graph.mjs examples/showcase/ecommerce.ja.graph.json
node skills/q-flow/scripts/generate-viewer.mjs examples/showcase/ecommerce.ja.graph.json output/ecommerce-ja
```

ブラウザーで `output/ecommerce-ja/index.html` を開きます。9 つの SVG も同じディレクトリにあります。上部の「図の種類」から切り替えます。各図で保存した文字と位置は切り替えても保持されます。「その他 → 変更を保存」で、上で説明したとおり全ビューを保存します。同じページは[オンラインデモ](https://supermax92.github.io/qgraphflow/)でも見られます。

ビルド済み Viewer からのページ生成には、依存関係のインストール、API キー、バックエンドは不要です。AI による根拠収集と図の作成には、選んだクライアントのモデルサービスを使います。

</details>

## 図とコードを同期させる

リポジトリのルートを指定して生成した図には、各コンポーネントの定義位置が記録されます。`--repo-root` 付きで検証すると、記録したファイルがない、行範囲がファイルに収まらない、記録したシンボルが元の行範囲から外れた、のいずれかで失敗し、エラーにはシンボルの現在の行が示されます。次のジョブを CI に追加してください。ビルド、ログイン、トークンは不要です。

```yaml
name: Diagrams
on: [push, pull_request]
jobs:
  diagrams:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: '22'
      - run: |
          for graph in docs/qgraphflow/*/graph.json; do
            npx -y qgraphflow validate "$graph" --input-only --repo-root . || { echo "::error file=$graph::$graph failed validation"; failed=1; }
          done
          exit ${failed:-0}
```

失敗したら、スキルにその図の更新を頼みます。

```text
$qgraphflow:q-flow CI で docs/qgraphflow/order-sequence の図が古いと出ました。更新してください。
```

スキルは、ファイル内で 1 か所だけ見つかったシンボルのアンカーを移し、なお失敗するアンカーだけを修正し、編集した位置と文字を保ったままページと SVG を再生成します。図を描き直すことはしません。

## 9種類の図が答えること

| 図 · PNG | 主な問い | サンプルの範囲 |
| --- | --- | --- |
| アーキテクチャ | どの責務が協調するか？ | チャネル、決済、価格、リスク、在庫、支払い、注文、イベント、出荷 |
| フローチャート | 判断はどこで分岐・合流するか？ | 欠品、リスク拒否、支払い補償、正常コミット |
| シーケンス | 呼び出しと戻りの順序は？ | 決済成功経路と非同期 OrderPaid |
| ER | 主要データはどう関連するか？ | カート、注文、明細、支払い、引当、荷物 |
| 配置 | 実行単位をどこに置き、どう接続するか？ | エッジ、Kubernetes、データサービス、支払い、倉庫配送ネットワーク |
| クラス | ドメインオブジェクトと契約はどう依存するか？ | 決済サービス、Order、4つのポート |
| 状態 | どのイベントとガードが注文を進めるか？ | 支払い、出荷、取消、返金、終了 |
| ユースケース | 各利用者に何ができるか？ | 購入者、店舗、倉庫、サポート |
| データフロー | データをどう変換・保存するか？ | カート、取引判断、注文イベント、倉庫、配送受領記録 |

これは QGraphFlow の機能を示す概念モデルで、特定の EC リポジトリに対応しません。サンプルの `graph.json` に架空のソースパスは入れず、関係の証拠を `inference` に統一しています。実際のプロジェクトでは、追跡可能なソース、DDL、設定、テスト、合意済み要件を使ってください。

## 開発と参加

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

開発には Node.js 22 以降、npm、tar、zip、unzip が必要です。問題報告には、機密情報を除いた最小限の図データ、クライアントとブラウザーのバージョン、再現手順を添えてください。

リファレンス（英語）：[証拠の出典](../../skills/q-flow/references/evidence-sources.md) · [図データ形式](../../skills/q-flow/references/graph-schema.md) · [対話による要件確認](../../skills/q-flow/references/guided-intake.md) · [Viewer の開発](../../skills/q-flow/references/viewer-development.md) · [図の構成](../../skills/q-flow/references/visual-contract.md)

## ライセンスと帰属

[MIT](../../LICENSE) · [第三者の表示](../../THIRD_PARTY_NOTICES.md)

QGraphFlow は MIT ライセンスの独立プロジェクトです。本文のシナリオは概念例で、実在する企業の本番構成を表しません。提携、後援、推奨を意味するものでもありません。
