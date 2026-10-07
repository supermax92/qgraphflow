<div align="center">

<h1><picture><source media="(prefers-color-scheme: dark)" srcset="../images/brand/qgraphflow-lockup-dark.svg"><img src="../images/brand/qgraphflow-lockup-light.svg" alt="QGraphFlow" height="64"></picture></h1>

### 複雑なコードを、探索できる図へ。

経路をたどり、根拠を確認し、ひとつのオフラインファイルで共有。

<sub>💡 <a href="https://github.com/Cocoon-AI/architecture-diagram-generator">Cocoon-AI/architecture-diagram-generator</a> に着想を得ました。原作者に感謝します。</sub>

[English](../../README.md) · [中文](../../docs/readme/README.zh-CN.md) · [Русский](../../docs/readme/README.ru.md) · [Português](../../docs/readme/README.pt.md) · [日本語](../../docs/readme/README.ja.md) · [Deutsch](../../docs/readme/README.de.md) · [Español](../../docs/readme/README.es.md)

[オンラインデモ](https://supermax92.github.io/qgraphflow/) · [はじめに](#はじめに) · [クライアントへの導入](#インストールガイド) · [問題を報告](https://github.com/supermax92/qgraphflow/issues) · [MIT](../../LICENSE)

</div>

*11 種類の図に対応：プラットフォーム機能アーキテクチャ図、エンジニアリング層アーキテクチャ図、コンポーネント関係アーキテクチャ図、フローチャート、シーケンス図、ER 図、配置図、クラス図、状態図、ユースケース図、データフロー図。*

QGraphFlow はソースコード、データ構造、設定、要件から対話型のソフトウェア図を生成します。関係の根拠を確認し、共有可能なオフライン HTML として届けます。

**ここが違う：** 1 つのスキルで 11 種類の図、すべての関係に根拠の種別、コードで裏付けられた関係にはその根拠となるソース行、自動レイアウト、ページ上での編集。プラグインのスクリプトと Viewer 自体はネットワーク通信を一切行いません。

![Jeepay の複数ビュー操作デモ：コンポーネント関係アーキテクチャ図、シーケンス図、ER 図](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/jeepay.en.hero.gif)

Jeepay の実際のソースを例に、コンポーネント関係アーキテクチャ図、シーケンス図、ER 図を切り替えて、コンポーネントと呼び出し関係を探索します。 [原寸の GIF を見る](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/jeepay.en.hero.gif)

**複雑なシーケンス図の紹介**

![複雑なシーケンス図の段階的な描画：参加者、ライフライン、メッセージ、活性区間、入れ子の結合フラグメント](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/checkout.en.sequence-drawing.gif)

架空の EC シナリオに 9 人の参加者、29 件のメッセージ、6 個の結合フラグメントを含め、在庫の再試行、入れ子の分岐、並行処理、失敗時の補償、非同期コールバックを扱います。生成済みの図をアニメーションで段階的に表示し、複雑なシーケンス図の構造と詳細を紹介します。 [原寸の GIF を見る](https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/checkout.en.sequence-drawing.gif)

```bash
npx skills add supermax92/qgraphflow
```

1 つのコマンドで Claude Code、Codex、Cursor、Qoder にスキルを導入できます。プラグインとしての導入やほかのクライアントは[インストールガイド](#インストールガイド)を参照してください。

- **探索：** 検索・拡大縮小・パンで、責務と上流・下流の関係を確認。

- **検証：** ノードや接続線からファイル、行番号、シンボル、明示された不確実性を確認。

- **編集：** ロック解除後に文字や位置を変更。必要に応じてリセット。

- **共有：** オフライン HTML を開くか、図全体を SVG / PNG に出力。

実際のソースに基づく [Jeepay コーパス](../../examples/jeepay)には、CI とオンラインデモで使う 11 種類のビューがすべて含まれます。

## はじめに

インストール後、クライアントで業務プロジェクトを開き、`q-flow` スキルを選択します。以下は Claude Code の `/q-flow` を使う例です。Codex ではクライアントが実際に提供する `$q-flow` または `$qgraphflow:q-flow` を使ってください。まだインストールしていない場合は、先に[インストールガイド](#インストールガイド)を参照してください。

### 1. 空の入力：どこから始めるか分からない

要件を付けずにスキルだけを呼び出します。

```text
/q-flow
```

スキルが、分析する部分と図で答えてほしい問いの選択を案内します。必要な情報が明確になったら描画を始めます。

### 2. 機能を尋ねる：何を描けるか知る

```text
/q-flow どの種類の図を描けますか？各種類はどのような問いに答えるのに適していますか？プロジェクトを引き継いだばかりなので、まず機能を紹介し、始める場所を提案してください。
```

まず 11 種類の図の用途を知り、それからプロジェクト構造、呼び出し順序、データ関係など、何を見るかを決めます。

### 3. 曖昧な入力：大まかな目的だけがある

```text
/q-flow このプロジェクトを図にしてください。できるだけ早く理解したいです。
```

先に図の種類を指定する必要はありません。スキルがプロジェクトと目的に応じて適したビューを決め、必要な情報が不足している場合に質問します。

### 4. 正確な入力：範囲を明示して描画の詳細を求める

次の業務名と手順を、プロジェクトに実際に存在するフローに置き換えてください。

```text
/q-flow 現在のプロジェクトの注文作成フローを分析し、中国語のシーケンス図を生成してください。
リクエスト入口、価格計算、在庫引当、支払い承認、注文の永続化を含めてください。
ソースに実際に存在する同期呼び出し、非同期メッセージ、対応する戻り、活性区間、条件分岐、再試行、失敗時の補償を残し、簡潔さのために詳細を省略しないでください。
コンポーネントと呼び出しのソースファイルと行番号を示し、結果を docs/qgraphflow/order-sequence/ に保存してください。
```

対象、問い、詳細度、出力先を明確に伝えると、そのまま開始できます。図には根拠のある事実だけを残します。

### 5. さらに詳しく：前の図の一部分を展開する

結果の生成後、同じ会話で続けます。

```text
/q-flow 前のシーケンス図の在庫引当ステップを展開し、独立した中国語のフローチャートを生成してください。
在庫確認、引当成功、再試行可能な失敗、再試行上限、在庫解放の分岐をすべて示してください。ソースコードに従い、コードにない手順は追加しないでください。
```

まず全体を見てから、ひとつの手順を掘り下げます。既存の図の詳細追加や、関係の検証を続けて依頼することもできます。

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
claude plugin marketplace add ./
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

クライアントで業務プロジェクトを開き、新しいセッションでスキルを選択します。[はじめに](#はじめに)の例を参考に要件を伝えてください。生成後、出力された HTML をブラウザで開きます。

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
$qgraphflow:q-flow 現在のプロジェクトを分析し、主要モジュールの責務、依存関係、システム境界を示す中国語のアーキテクチャ図を作成してください。
```

初めて触れるプロジェクトの全体像をつかむのに適しています。

### 例2：業務の呼び出しを追う

```text
$qgraphflow:q-flow 注文作成フローを分析し、価格計算、在庫引当、支払い、注文保存の呼び出し順と失敗分岐を示す中国語のシーケンス図を作成してください。
```

「注文作成」と各手順を実際の業務フローに置き換えてください。同じ会話で続けて依頼できます。

```text
$qgraphflow:q-flow 前の図の在庫引当を掘り下げ、成功時と失敗時の処理を示す中国語のフローチャートを別に作成してください。
```

既定の保存先は `docs/qgraphflow/` 配下です。`index.html` を開いて探索・編集・出力でき、`graph.json` に図データが残ります。各ビューは SVG（`diagram.svg`、複数ビューでは `diagram-<n>-<type>.svg`）としても書き出され、README、プルリクエスト、Wiki に画像として埋め込めます。

ページで編集したあと、Chrome または Edge で「その他 → 変更を保存」を実行し、図のフォルダーを一度選ぶと、ページ、`graph.json`、SVG がその場で書き換わります。ほかのブラウザーは `graph.json` だけを保存します。そのフォルダーに置いてから `npx -y qgraphflow generate docs/qgraphflow/<name>/graph.json docs/qgraphflow/<name> --layout preserve --force` でページと SVG を再生成してください。

<details>
<summary>Jeepay のソースに基づく 11 ビューの例を実行する</summary>

根拠を検証するため、ローカルの Jeepay ソースチェックアウトを指定してください。

```bash
export JEEPAY_REPO_ROOT="<local Jeepay repository root>"
node skills/q-flow/scripts/validate-graph.mjs examples/jeepay/collection.graph.json --input-only --repo-root "$JEEPAY_REPO_ROOT"
node skills/q-flow/scripts/generate-viewer.mjs examples/jeepay/collection.graph.json output/jeepay --repo-root "$JEEPAY_REPO_ROOT"
```

`output/jeepay/index.html` を開いてください。11 個の SVG も同じディレクトリにあります。ソースのリビジョンと更新手順は[コーパスの README](../../examples/jeepay)を参照してください。

</details>

## 図とコードを同期させる

リポジトリのルートを指定して生成した図には、各コンポーネントの定義位置と、コードで裏付けられた各関係を成立させている行（呼び出し、外部キーなど）が記録されます。`--repo-root` 付きで検証すると、記録したファイルがない、行範囲がファイルに収まらない、記録したシンボルが元の行範囲から外れた、のいずれかで失敗し、エラーにはシンボルの現在の行が示されます。次のジョブを CI に追加してください。ビルド、ログイン、トークンは不要です。

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

## 11 種類の図がそれぞれ答えること

| ビュー · PNG | 主な問い | 本サンプルの範囲 |
| --- | --- | --- |
| プラットフォーム機能アーキテクチャ図 | プラットフォームにはどんな機能があるか？ | 機能の区分とマトリクス |
| エンジニアリング層アーキテクチャ図 | プロジェクトのコードはどう構成されているか？ | エンジニアリング層と共通の支援機能 |
| コンポーネント関係アーキテクチャ図 | システムのどの責務境界が協調するか？ | チャネル、取引のオーケストレーション、価格、リスク、在庫、支払い、注文、イベント、注文履行 |
| フローチャート | 各判断点はどう分岐・合流するか？ | 欠品、リスク拒否、支払い失敗時の補償、正常コミット |
| シーケンス図 | ひとつのリクエストはどの順序で呼び出しと戻りを行うか？ | 決済成功の主経路と非同期 OrderPaid |
| ER 図 | 主要データはどう関連するか？ | カート、注文、明細、支払い、在庫引当、荷物 |
| 配置図 | 実行単位をどこに置き、どう接続するか？ | エッジ、Kubernetes、データサービス、支払い、倉庫配送ネットワーク |
| クラス図 | ドメインオブジェクトとコードの契約はどう依存するか？ | Checkout アプリケーションサービス、Order、4 つのポート |
| 状態図 | どのイベントとガード条件が注文を進めるか？ | 支払い、注文履行、取消、返金、終了 |
| ユースケース図 | 各参加者にはどんな機能があるか？ | 購入者、店舗、倉庫、カスタマーサポート |
| データフロー図 | データ資産はどの変換と保存を経るか？ | カート、取引判断、注文イベント、倉庫配送、配送受領記録 |

これは QGraphFlow の機能を示す概念モデルで、特定の EC リポジトリに対応しません。サンプルの `graph.json` に架空のソースパスは入れず、関係の証拠を `inference` に統一しています。実際のプロジェクトでは、追跡可能なソース、DDL、設定、テスト、合意済み要件を使ってください。

## 開発と参加

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

開発には Node.js 22 以降、npm、tar、zip、unzip が必要です。問題報告には、機密情報を除いた最小限の図データ、クライアントとブラウザーのバージョン、再現手順を添えてください。

リファレンス（英語）：[証拠の出典](../../skills/q-flow/references/evidence-sources.md) · [図データ形式](../../skills/q-flow/references/graph-schema.md) · [対話による要件確認](../../skills/q-flow/references/guided-intake.md) · [Viewer の開発と受け入れ検証](../../skills/q-flow/references/viewer-development.md) · [図の構成](../../skills/q-flow/references/visual-contract.md)

## ライセンスと帰属

[MIT](../../LICENSE) · [第三者の表示](../../THIRD_PARTY_NOTICES.md)

QGraphFlow は MIT ライセンスを採用する独立したプロジェクトです。本文のシナリオは概念例で、実在する企業の本番アーキテクチャを表しません。

## アーキテクチャの全体像

アーキテクチャには、コンポーネント関係、プラットフォーム機能、エンジニアリング層が含まれます。対象と問いを伝えると、スキルがテンプレートを選びます。依頼したコレクションには、個別に編集できる複数のアーキテクチャビューを含められます。

```text
$qgraphflow:q-flow 現在のプロジェクトのプラットフォーム機能と業務の接続方法を分析し、中国語のプラットフォーム機能全体図を生成してください。
$qgraphflow:q-flow 現在のプロジェクト構成とコンポーネントの階層を分析し、プロジェクト全体とひとつのコンポーネント断面の中国語の全体図を生成してください。
$qgraphflow:q-flow このプロジェクトのプラットフォーム機能の全体図を英語で生成し、アプリケーションモジュールがどのように統合されるかを示してください。
```

実際のソースに基づくプラットフォーム、エンジニアリング、コンポーネント関係のアーキテクチャビューは [examples/jeepay](../../examples/jeepay)を参照してください。全体図のロックを解除すると、同じ層のカードの並べ替えや文字の編集ができます。保存は全ビューを保持し、リセットは現在のビューだけを戻します。
