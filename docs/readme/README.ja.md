<div align="center">

# QGraphFlow

### 複雑なコードを、探索できる図へ。

経路をたどる。根拠を確かめる。ひとつのオフラインファイルで共有する。

[English](../../README.md) · [中文](../../docs/readme/README.zh-CN.md) · [日本語](../../docs/readme/README.ja.md) · [한국어](../../docs/readme/README.ko.md) · [Deutsch](../../docs/readme/README.de.md) · [Français](../../docs/readme/README.fr.md) · [Español](../../docs/readme/README.es.md)

[クライアントの導入](../../docs/clients.md) · [問題を報告](https://github.com/supermax92/qgraphflow/issues) · [MIT](../../LICENSE)

</div>

![Apache Kafka のソースに基づく QGraphFlow の実際の操作。 アーキテクチャ](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.ja.architecture.gif)

*Apache Kafka のソースに基づく QGraphFlow の実際の操作。*

QGraphFlow は、ソースコード、スキーマ、設定、要件からインタラクティブなソフトウェア図を作成します。根拠を確認でき、オフライン HTML として共有できます。

- **探索：**作成した経路を再生し、ノードを検索して役割を確認。
- **検証：**ソースファイル、行番号、シンボル、不確実な点を明示。
- **共有：**オフライン HTML を開くか、図全体を SVG / PNG に出力。

README のアニメーションは文書の閲覧時にのみダウンロードされます。Git クローンとプラグインパッケージに GIF は含まれません。軽量パッケージには注文フローの例と英語の Kafka 図集が含まれ、全 7 言語の図集は Git リポジトリで利用できます。

## Kafka の9種類の図を試す

Node.js 22 を用意し、このリポジトリをクローンして実行します。

```bash
git clone https://github.com/supermax92/qgraphflow.git
cd qgraphflow
node skills/q-flow/scripts/validate-graph.mjs examples/showcase/kafka.ja.graph.json
node skills/q-flow/scripts/generate-viewer.mjs examples/showcase/kafka.ja.graph.json output/kafka
```

ブラウザーで `output/kafka/index.html` を開き、ツールパネルで図を選択します。同じフォルダーの `graph.json` に編集可能なモデルが保存されています。入力 JSON を編集した後は、新しい出力先に生成すると以前の結果を残せます。

同梱の Viewer での生成には、依存関係のインストール、API キー、バックエンドサービスは不要です。AI による図の作成には、選択したクライアントのモデルサービスを使用します。

## ひとつのコードベースを、9つの視点から。

上のアーキテクチャ図は、プロデューサーからリーダーログへの経路を示します。以下を展開すると、他の図も確認できます。各 GIF の画面と説明は、この README と同じ言語です。

**01 · アーキテクチャ** — ソースコードに基づく Leader への追記経路です。ネットワーク内部、レプリケーション、確認応答はこの図の対象外です。

<details>
<summary><strong>02 · フローチャート</strong> · Kafka：send() はいつ Sender を起こす？</summary>

![Apache Kafka のソースに基づく QGraphFlow の実際の操作。 フローチャート](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.ja.flowchart.gif)

RecordAccumulator.append() の後の分岐です。それ以前の検証と例外経路は省略しています。Future の返却は Broker の確認応答を意味しません。

</details>

<details>
<summary><strong>03 · シーケンス図</strong> · Kafka：acks=1 のProduce リクエスト</summary>

![Apache Kafka のソースに基づく QGraphFlow の実際の操作。 シーケンス図](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.ja.sequence.gif)

成功する非トランザクションのProduce リクエストです。KafkaApis は Broker のリクエスト境界を表し、ネットワークとパーティション内部は参加者にまとめています。acks=1 は Follower の確認応答を要求しません。

</details>

<details>
<summary><strong>04 · ER 図</strong> · Kafka：ProduceRequest v13 の内部構造</summary>

![Apache Kafka のソースに基づく QGraphFlow の実際の操作。 ER 図](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.ja.er.gif)

SQL テーブルではなく、プロトコルの包含関係です。配列をゼロ対多の関係として表し、データベースの主キーや外部キーは想定していません。バージョン 13 は TopicId でトピックを識別します。

</details>

<details>
<summary><strong>05 · 配置図</strong> · Kafka：KRaft の役割を分離して配置</summary>

![Apache Kafka のソースに基づく QGraphFlow の実際の操作。 配置図](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.ja.deployment.gif)

リポジトリの Docker Compose 平文通信の例です。Broker が 3 個、独立した Controller コンテナが 3 個あります。Controller クォーラムは 1 ノードにまとめています。開発用設定であり、本番構成の推奨ではありません。

</details>

<details>
<summary><strong>06 · クラス図</strong> · Kafka：プロデューサー API と実装クラス</summary>

![Apache Kafka のソースに基づく QGraphFlow の実際の操作。 クラス図](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.ja.class.gif)

一部の Java 型とメンバーを示します。KafkaProducer と MockProducer は Producer<K,V> を実装し、ProducerRecord が入力を保持します。シグネチャは省略表記で、所有関係は推測していません。

</details>

<details>
<summary><strong>07 · 状態図</strong> · Kafka：コンシューマーがグループに参加するまで</summary>

![Apache Kafka のソースに基づく QGraphFlow の実際の操作。 状態図](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.ja.state.gif)

MemberState の通常の割り当て処理です。エラー、フェンシング、離脱の状態は省略しています。Broker が新しい割り当てを送ると、調整が繰り返されることがあります。

</details>

<details>
<summary><strong>08 · ユースケース図</strong> · Kafka：各クライアントでできること</summary>

![Apache Kafka のソースに基づく QGraphFlow の実際の操作。 ユースケース図](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.ja.usecase.gif)

クライアントの役割と公開 Java API の対応です。アクターの関連は機能を示し、実行順序ではありません。オフセットのコミットと管理操作はアプリケーションが明示的に選びます。

</details>

<details>
<summary><strong>09 · データフロー図</strong> · Kafka：アプリケーションの値から取得レコードまで</summary>

![Apache Kafka のソースに基づく QGraphFlow の実際の操作。 データフロー図](https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/kafka.ja.dataflow.gif)

シリアライズ、パーティションへの保存、デシリアライズを通るデータの経路です。バッチ処理、Produce/Fetch のネットワーク、複製は簡略化しています。オフセットのコミットや処理保証は対象外です。

</details>

## 自分のプロジェクトを図にする

導入ガイドに従ってプラグインをインストールします。Codex では `$q-flow`、Claude Code では `/qgraphflow:q-flow` を使います。Qoder と Cursor では、クライアントのスキル選択機能を使用します。ガイドには導入手順と各クライアントでの検証状況を記載しています。

> このモジュールの入口、主要コンポーネント、関係を分析し、日本語のインタラクティブなアーキテクチャ図を作成してください。ソースファイルと行番号の根拠を残し、確認できない関係を明示してください。

CodeGraph は任意です。未設定の場合はソースを直接読みます。既定の出力先は対象プロジェクトの `docs/qgraphflow/<scope>-<diagram-type>/` です。別のフォルダーも指定できます。

## 確認できるコードに基づく図

9つの例はすべて Apache Kafka のコミット `634a935e7291` に基づきます（チェックアウト内の宣言バージョンは `4.4.0`）。主な根拠：

| 図 | ソースの根拠 |
| --- | --- |
| アーキテクチャ | [`ReplicaManager.appendToLocalLog` · L1376](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/core/src/main/scala/kafka/server/ReplicaManager.scala#L1376) |
| フローチャート | [`KafkaProducer.doSend` · L1241](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/KafkaProducer.java#L1241) |
| シーケンス図 | [`KafkaApis.handleProduceRequest` · L457](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/core/src/main/scala/kafka/server/KafkaApis.scala#L457) |
| ER 図 | [`ProduceRequest` · L50](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/resources/common/message/ProduceRequest.json#L50) |
| 配置図 | [`controller-1 / controller-2 / controller-3` · L18](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/docker/examples/docker-compose-files/cluster/isolated/plaintext/docker-compose.yml#L18) |
| クラス図 | [`Producer` · L97](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/Producer.java#L97) |
| 状態図 | [`STABLE` · L67](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/consumer/internals/MemberState.java#L67) |
| ユースケース図 | [`Producer.send` · L97](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/Producer.java#L97) |
| データフロー図 | [`KafkaProducer.doSend` · L1197](https://github.com/apache/kafka/blob/634a935e729197848ffd958c06458215f96f103e/clients/src/main/java/org/apache/kafka/clients/producer/KafkaProducer.java#L1197) |

## 例の読み方と制約

- 再生は作成済みの経路やノードの読順を示し、実行時のトレースを取得するものではありません。リーダーへの追記、プロデューサーへの応答、コンシューマーの処理完了は別の出来事です。
- 正確さは根拠に依存します。主要な関係をレビューしてください。ソース、スキーマ、設定、慣例、推論を区別します。
- 画面上の配置変更は SVG / PNG に反映されますが、`graph.json` には自動保存されません。
- すべての言語で同じソースの根拠とグラフ構造を使用します。コード識別子、API 名、スキーマのフィールド、標準記法は原文のままです。

## 開発と参加

```bash
npm ci --prefix skills/q-flow/assets/viewer
npm run build --prefix skills/q-flow/assets/viewer
node --test tests/*.test.mjs skills/q-flow/scripts/*.test.mjs
```

開発には Node.js 22、npm、tar、zip、unzip が必要です。問題の報告には、機密情報を除いた最小限の図データ、クライアントとブラウザーのバージョン、再現手順を添えてください。

[図データの形式](../../skills/q-flow/references/graph-schema.md) · [ブラウザー検証ガイド](../../skills/q-flow/references/viewer-development.md)

## ライセンスと帰属

[MIT](../../LICENSE) · [第三者コンポーネントの表記](../../THIRD_PARTY_NOTICES.md)

QGraphFlow は MIT ライセンスの独立したプロジェクトです。Apache Kafka はデモの題材です。製品名は各権利者に帰属し、提携、協賛、推奨を示すものではありません。
