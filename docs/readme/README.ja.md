<div align="center">

# QGraphFlow

### 複雑なコードを、探索できる図へ。

経路をたどり、根拠を確認し、ひとつのオフラインファイルで共有。

[English](../../README.md) · [中文](../../docs/readme/README.zh-CN.md) · [Русский](../../docs/readme/README.ru.md) · [Português](../../docs/readme/README.pt.md) · [日本語](../../docs/readme/README.ja.md) · [Deutsch](../../docs/readme/README.de.md) · [Español](../../docs/readme/README.es.md)

[クライアントへの導入](#インストールガイド) · [問題を報告](https://github.com/supermax92/qgraphflow/issues) · [MIT](../../LICENSE)

</div>

![EC のアーキテクチャ図・フロー図・シーケンス図。各0.8秒、1周2.4秒。接続線のアニメーション付き](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ja.core-three.gif)

*9種類の図に対応：アーキテクチャ、フローチャート、シーケンス、ER、配置、クラス、状態、ユースケース、データフロー。*

QGraphFlow はソースコード、データ構造、設定、要件から対話型のソフトウェア図を生成します。関係の根拠を確認し、共有可能なオフライン HTML として届けます。

- **探索：** 検索・拡大縮小・パンで、責務と上流・下流の関係を確認。
- **検証：** ノードや接続線からファイル、行番号、シンボル、明示された不確実性を確認。
- **編集：** ロック解除後に文字や位置を変更。必要に応じてリセット。
- **共有：** オフライン HTML を開くか、図全体を SVG / PNG に出力。

*探索：ナビゲーションを開き、決済オーケストレーターを検索して移動。ノードをクリックして概要カードを開き、入出力の接続線を強調表示した後、拡大縮小とパンを操作します。*

![ナビゲーション・検索・ノード概要・関係の強調・拡大縮小とパン](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ja.explore.gif)

*検証：概要カードから詳細パネルを開いてパス・行番号・シンボルを確認。続いて接続線を選び、関係の説明と推論の印を確認します。*

この操作デモのコードパス、行番号、シンボルは架空です。証拠パネルの操作例であり、リポジトリのソースを表していません。画面と詳細にも明記しています。実際の分析では本当の出典を使い、未確認の関係は推論と記してください。

![架空と明示されたパス・行番号・シンボルと関係の推論を示す詳細](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ja.verify.gif)

*編集：「その他」で配置のロックを解除し、名前と説明を編集。ノードをドラッグすると接続線も追従します。リセットで元の文字と位置に戻します。*

![ロック解除・文字編集・ノードと接続線の移動・リセット](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ja.edit.gif)

*共有：HTML をオフラインで開き、「その他」から SVG と PNG を出力。PNG を開き、図全体を確認します。*

![オフライン HTML・SVG / PNG 出力・出力した PNG の確認](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ja.share.gif)

上の総覧は各図0.8秒、1周2.4秒です。下の4つの操作動画には読む時間を確保しています。ソースからビルドした Viewer を使い、図と画面の文字を日本語に揃えています。5つの GIF と9つの PNG は [showcase-v1 Release の独立した添付ファイル](https://github.com/supermax92/qgraphflow/releases/tag/showcase-v1)として公開し、ダウンロードと SHA-256 を検証済みです。Git 履歴やプラグインパッケージには含まれず、表示にはインターネット接続が必要です。生成した図の HTML 自体はオフラインで使用できます。

## インストールガイド

Node.js 22 と、プラグインに対応しモデルへのアクセスを設定済みのクライアントを用意してください。

### 1. プラグインをダウンロード

[qgraphflow-0.0.3.zip](https://github.com/supermax92/qgraphflow/releases/download/v0.0.3/qgraphflow-0.0.3.zip) をダウンロードし、隠しファイルを保持したまま専用のディレクトリに展開します。

以下のコマンドはすべて、**展開後の `skills/` を含むプラグインのルートディレクトリ**で実行してください。

### 2. クライアントにインストール

#### Codex App / CLI

ターミナルで Codex CLI を使用できるよう、あらかじめインストールしてください。

```bash
codex plugin marketplace add .
codex plugin add qgraphflow@supermax92
```

新しいセッションを開始し、`$` を入力して `qgraphflow:q-flow` を選択します。

#### Claude Code

ZIP をダウンロードせず、GitHub から直接インストールします：

```bash
claude plugin marketplace add supermax92/qgraphflow
claude plugin install qgraphflow@supermax92 --scope user
```

または、展開したプラグインのルートで実行します：

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

#### Qoder IDE

**Settings → Plugins → Custom → Import** を開き、プラグインのルートディレクトリ全体をインポートして `q-flow` を選択します。

#### Cursor

プラグインのルートディレクトリ内のすべてのファイル（隠しファイルを含む）を、次の場所にコピーします。

```text
~/.cursor/plugins/local/qgraphflow/
```

その中に `.cursor-plugin/plugin.json` があることを確認し、ウィンドウを再読み込みして **Customize** で `q-flow` を探します。旧バージョンがある場合は先にバックアップし、新旧のファイルを混在させないでください。

### 3. 使い始める

クライアントで対象のプロジェクトを開き、新しいセッションでスキルを選択します。下の[すぐに使う](#すぐに使う)の例を参考に依頼し、生成された HTML をブラウザで開いてください。

<details>
<summary>別のインストール方法：GitHub npm</summary>

ZIP の代わりに npm からプラグインを取得することもできます。

GitHub npm では、自分の GitHub **Personal access token（classic）** に `read:packages` 権限を付けて認証します。ログイン時は自分の GitHub ユーザー名を使い、パスワード欄にトークンを入力してください。

トークンを共有したり、リポジトリにコミットしたりしないでください。[GitHub の認証ガイド](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)も参照できます。

```bash
npm config set @supermax92:registry=https://npm.pkg.github.com --location=user
npm login --scope=@supermax92 --auth-type=legacy --registry=https://npm.pkg.github.com
```

業務プロジェクトの外に専用ディレクトリを作成します。

```bash
mkdir qgraphflow-install
cd qgraphflow-install
npm install @supermax92/qgraphflow@0.0.3 --ignore-scripts
cd node_modules/@supermax92/qgraphflow
```

これでプラグインのルートディレクトリに移動できました。上記のクライアント別インストール手順に進んでください。**npm でダウンロードしても、クライアントへのインストールは自動では行われません。**

</details>

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

既定の保存先は `docs/qgraphflow/` 配下です。`index.html` を開いて探索・編集・出力でき、`graph.json` に図データが残ります。

<details>
<summary>EC の9種類のサンプルを手動で実行</summary>

次のコマンドはリポジトリ内のサンプル用です。導入済みプラグインの使用には、このリポジトリの複製は不要です。Node.js 22 を用意して実行します。

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
node skills/q-flow/scripts/validate-graph.mjs examples/showcase/ecommerce.ja.graph.json
node skills/q-flow/scripts/generate-viewer.mjs examples/showcase/ecommerce.ja.graph.json output/ecommerce-ja
```

ブラウザーで `output/ecommerce-ja/index.html` を開き、上部の「図の種類」から切り替えます。各図で保存した文字と位置は切り替えても保持されます。「その他 → Graph JSON を保存」で全ビューを保存してください。対応ブラウザーでは JSON の保存先を選択でき、非対応ではコピーをダウンロードします。元の HTML の再読み込みでは埋め込みデータに戻ります。編集内容を再度開くには、保存した JSON から新しいディレクトリに生成します。

ビルド済み Viewer からのページ生成には、依存関係のインストール、API キー、バックエンドは不要です。AI による根拠収集と図の作成には、選んだクライアントのモデルサービスを使います。

</details>

## 9種類の図が答えること

| 図 · PNG | 主な問い | サンプルの範囲 |
| --- | --- | --- |
| [アーキテクチャ](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ja.architecture.png) | どの責務が協調するか？ | チャネル、決済、価格、リスク、在庫、支払い、注文、イベント、出荷 |
| [フローチャート](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ja.flowchart.png) | 判断はどこで分岐・合流するか？ | 欠品、リスク拒否、支払い補償、正常コミット |
| [シーケンス](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ja.sequence.png) | 呼び出しと戻りの順序は？ | 決済成功経路と非同期 OrderPaid |
| [ER](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ja.er.png) | 主要データはどう関連するか？ | カート、注文、明細、支払い、引当、荷物 |
| [配置](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ja.deployment.png) | 実行単位をどこに置き、どう接続するか？ | エッジ、Kubernetes、データサービス、支払い、倉庫配送ネットワーク |
| [クラス](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ja.class.png) | ドメインオブジェクトと契約はどう依存するか？ | 決済サービス、Order、4つのポート |
| [状態](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ja.state.png) | どのイベントとガードが注文を進めるか？ | 支払い、出荷、取消、返金、終了 |
| [ユースケース](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ja.usecase.png) | 各利用者に何ができるか？ | 購入者、店舗、倉庫、サポート |
| [データフロー](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/ecommerce.ja.dataflow.png) | データをどう変換・保存するか？ | カート、取引判断、注文イベント、倉庫、配送受領記録 |

これは QGraphFlow の機能を示す概念モデルで、特定の EC リポジトリに対応しません。サンプルの `graph.json` に架空のソースパスは入れず、関係の証拠を `inference` に統一しています。実際のプロジェクトでは、追跡可能なソース、DDL、設定、テスト、合意済み要件を使ってください。

## 開発と参加

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

開発には Node.js 22、npm、tar、zip、unzip が必要です。問題報告には、機密情報を除いた最小限の図データ、クライアントとブラウザーのバージョン、再現手順を添えてください。

[証拠の出典](../references/ja/evidence-sources.md) · [図データ形式](../references/ja/graph-schema.md) · [対話による要件確認](../references/ja/guided-intake.md) · [Viewer の開発](../references/ja/viewer-development.md) · [図の構成](../references/ja/visual-contract.md)

## ライセンスと帰属

[MIT](../../LICENSE) · [第三者の表示](../../THIRD_PARTY_NOTICES.md)

QGraphFlow は MIT ライセンスの独立プロジェクトです。この EC シナリオは概念例で、実在する企業の本番構成を表しません。提携、後援、推奨を意味するものでもありません。
