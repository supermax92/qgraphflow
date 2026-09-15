# 証拠の出典と CodeGraph の代替手順

[English](../../../skills/q-flow/references/evidence-sources.md) · [简体中文](../zh-CN/evidence-sources.md) · [Русский](../ru/evidence-sources.md) · [Português](../pt/evidence-sources.md) · [日本語](evidence-sources.md) · [Deutsch](../de/evidence-sources.md) · [Español](../es/evidence-sources.md)

CodeGraph は呼び出しグラフの調査を速める第一候補であり、必須の依存関係ではありません。

## CodeGraph の事前確認

対象は [`colbymchenry/codegraph`](https://github.com/colbymchenry/codegraph) です。ローカル CLI または MCP サーバーを使います。

1. `PATH` に `codegraph` があり、対象リポジトリに `.codegraph/` があるか確認します。
2. 両方ある場合は `codegraph status` を実行し、範囲を限定した `codegraph explore "<question or symbols>"` を1回使ってから、リポジトリを直接追跡します。
3. 設定済みの CodeGraph MCP ツールでも同じ限定クエリを実行できます。現在のクライアントに実在するツールを使い、固有のツール名を仮定しません。
4. CLI、MCP ツール、最新の索引が利用できなければ、以下の代替手順へ進みます。通常の作図に CodeGraph のインストール・初期化、npm バージョン解決、クライアント設定変更は不要です。

## 依頼された場合の任意セットアップ

1. ユーザーが設定を依頼または承認した場合のみ、`npm view @colbymchenry/codegraph version` で正確な安定版を調べ、その版の公式導入手順と対応対象を確認します。
2. 実行前にクライアント、コマンド、書き込み先を明確にします。対象は実行ファイル、クライアント設定／指示、`.codegraph/` 索引です。対応していればプロジェクト内の設定を優先します。全クライアントが `--target=codex` を使うと仮定したり、製品名から値を作ったりしません。
3. 解決したパッケージ版を固定し、許可されたリポジトリ内だけで初期化します。インストーラーのクライアント連携がなければ、対応する独立 CLI または直接のソース追跡を使います。MCP 連携は必須ではありません。
4. 設定後に `codegraph status` を確認し、使える CLI または MCP を利用します。必要ならクライアントの手順で再読み込み・再起動します。版の解決や導入が失敗したら報告し、別のインストーラーを自動試行せずソース追跡を続けます。

## 代替手順の順序

1. `rg --files` の後、宣言、入口、呼び出し元、実装、設定キー、テストに絞って `rg` を実行します。
2. 関連するソース経路全体を読み、ファイル・行・シンボルのアンカーを残します。
3. 結論に影響する場合は、ビルドモデル、パッケージ内の成果物、対象を絞ったテスト、実行時設定も確認します。
4. フレームワークの文書は、その責任範囲の動作だけに使い、リポジトリの証拠とせず `framework` に分類します。
5. 未確認の非重要な関係は `inference` と記します。主経路として主張する部分の未確認関係は省略します。

## 図ごとの優先出典

| 図 | CodeGraph がない場合の優先証拠 |
| --- | --- |
| アーキテクチャ・シーケンス・クラス・データフロー | 入口、呼び出し元、インターフェース、実装、ビルド依存、RPC/MQ クライアント、対象テスト |
| フロー・状態・ユースケース | 合意済み要件と API 文書、その後にコントローラー／サービス動作とテスト。文書と実装に差があれば分けて示す |
| ER | DDL とマイグレーションを優先し、次に JPA エンティティ、ORM/MyBatis マッピング、制約、リポジトリのテスト |
| 配置 | Dockerfile、Compose、Kubernetes、Helm、サービス設定、ネットワークポリシー、CI/CD 定義 |

直接追跡ではリフレクション、依存注入、生成プロキシ、実行時ルーティング、RPC、メッセージ通信の完全な網羅は保証できません。この限界を記し、証拠の `source`、`config`、`schema`、`test`、`document`、`framework`、`inference` を区別してください。
