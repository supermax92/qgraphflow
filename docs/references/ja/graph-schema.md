# Graph JSON データ契約

[English](../../../skills/q-flow/references/graph-schema.md) · [简体中文](../zh-CN/graph-schema.md) · [Русский](../ru/graph-schema.md) · [Português](../pt/graph-schema.md) · [日本語](graph-schema.md) · [Deutsch](../de/graph-schema.md) · [Español](../es/graph-schema.md)

`scripts/generate-viewer.mjs` は単一の `Graph` または図の集合を受け取ります。`meta.diagramType` のない旧データも有効で、`architecture` として描画します。以下はフィールド構造の例です。実行前に参照先ノードを揃え、配置を検証してください。

```json
{
  "meta": {
    "title": "Required title",
    "diagramType": "architecture",
    "subtitle": "Optional supporting line",
    "sourceRef": "Branch, commit, document version, or evidence scope",
    "scope": "Verified evidence scope",
    "generatedAt": "ISO-8601 timestamp"
  },
  "groups": [
    {
      "id": "runtime-boundary",
      "label": "Consumer application JVM",
      "kind": "runtime",
      "position": { "x": 40, "y": 80 },
      "size": { "width": 1440, "height": 620 }
    }
  ],
  "nodes": [
    {
      "id": "jwt-decoder",
      "label": "NimbusJwtDecoder",
      "subtitle": "Verify and decode JWT",
      "module": "Identity",
      "kind": "security",
      "position": { "x": 720, "y": 220 },
      "size": { "width": 220, "height": 120 },
      "source": {
        "kind": "source",
        "file": "module/src/main/java/example/Config.java",
        "lineStart": 111,
        "lineEnd": 130,
        "symbol": "jwtDecoder"
      },
      "facts": ["Built from issuer-uri"],
      "tags": ["JWT", "Spring Security"]
    }
  ],
  "edges": [
    {
      "id": "decode-token",
      "source": "bearer-filter",
      "target": "jwt-decoder",
      "label": "decode and verify",
      "module": "Identity",
      "kind": "call",
      "evidence": "framework",
      "route": {
        "via": [{ "x": 640, "y": 180 }],
        "labelAt": { "x": 640, "y": 156 }
      }
    }
  ]
}
```

既定は単一図で、図種類メニューはありません。複数図を依頼された場合は1〜9図を `diagrams` で包み、各 `meta.diagramType` を一意にします。メニューは入力順に関係なく `architecture`、`flowchart`、`sequence`、`er`、`deployment`、`class`、`state`、`usecase`、`dataflow` の順に縦並びになります。

```json
{
  "diagrams": [
    { "meta": { "title": "System", "diagramType": "architecture", "sourceRef": "main" }, "nodes": [], "edges": [] },
    { "meta": { "title": "Request", "diagramType": "sequence", "sourceRef": "main" }, "nodes": [], "edges": [] }
  ]
}
```

この省略例は集合の外形だけを示します。各図には完全な契約と空でないノードが必要です。

## 共通フィールド

- 必須：`meta.title`、`meta.sourceRef`、空でない `nodes`、`edges`。
- `meta`、ノード、接続線、グループ、出典アンカーはオブジェクトです。`nodes`、`edges`、任意の `groups` はオブジェクト配列です。不正なコンテナーは配置や生成前に拒否します。
- 任意の `meta.subtitle`、`meta.scope`、ノード `subtitle`、`source.symbol`、接続線 `label` は文字列です。ノード／接続線の `module` は任意の空でない文字列で、同一モジュールには集合全体で同じ値を使い、色値を格納しません。ノードの `facts`、`tags`、`attributes`、`methods` は空でない文字列の配列です。全図種類に適用します。
- 任意の `fields` は、空でない文字列 `name` と `type`、任意の `key`（`PK`、`FK`、`UK`）、任意の真偽値 `nullable` を持つオブジェクト配列です。ER は1フィールド以上必須。他の種類でも検索や詳細に表示できます。
- `meta.diagramType`：`architecture`、`flowchart`、`sequence`、`er`、`deployment`、`class`、`state`、`usecase`、`dataflow`。
- `meta.locale` は任意の画面言語：`en`、`zh-CN`（既定）、`ru`、`pt`、`ja`、`de`、`es`。旧図用に `ko`、`fr` も維持します。内蔵 UI と出力ラベルを制御し、タイトル・ノード名・事実・関係の文章は別途対象言語で作成します。コード識別子と標準記法は変更しません。集合内は図ごとに言語を持ちます。
- ID は一意の空でない文字列です。接続線の両端はノードを参照します。
- 全ノード／グループの `position` と `size` は有限かつ非負の値です。
- 接続線の `evidence`：`source`、`code`、`config`、`schema`、`test`、`document`、`framework`、`inference`。
- `route` は任意です。`via` は図座標の経由点、`labelAt` はラベル中心。自動直交経路で明瞭なら両方省略します。
- `route.via` と `route.labelAt` の座標は有限の非負数です。経由点間に直交の曲がりを挿入し、最初と最後はノードの現在位置につなぎます。
- 任意の `source.kind` は同じ証拠列挙値です。`source.file` と `source.lineStart` が正確な位置を示します。
- `--repo-root <directory>` を渡すと、検証と生成は全 `source.file` をリポジトリ相対の UTF-8 として読み、両端を含む行範囲を確認します。絶対パス、親への移動、ディレクトリ、バイナリー、ルート外を指すシンボリックリンクは拒否します。同じファイルは一度だけ読みます。ルート指定なしでは既存アンカーの結果を `skipped`、アンカーなしは `not-applicable` と記します。対象は現在の作業ツリーであり、`sourceRef` の版同一性、シンボル解決、主張の正しさは証明しません。
- 業務中心は対応する既存の `business` 種別、または大文字小文字を区別しない `core`／`business` タグで強調します。図種類に合法な種別を保ち、`core` を新しい種別やフィールドにしません。
- 冷中性の見た目は Viewer の表示規則です。色・字形・中心の強調に新フィールドは不要です。注文出荷のプレビューは例であり、既定データや証拠ではありません。

旧 `playback` は無視します。自動／段階再生はありません。有向接続線の動きは独立した表示で、実行順を意味しません。

## Viewer の編集を保存

図を切り替えても、現在のページ内で各図の保存済み文字と位置を保持します。リセットは表示中の図だけを元の埋め込み内容に戻します。**Graph JSON を保存**は集合全体、または元の単一図形式を保存し、他のビューの変更、メタデータ、出典も含みます。対応ブラウザーは `.json` の保存先を選択でき、その他は `graph.json` をダウンロードします。取消や失敗でもページ内の変更は残ります。

HTML を再読み込みすると埋め込みデータに戻ります。編集を後で開くには JSON を保管し、新しい出力ディレクトリへ再生成します。保存で検証が免除されるわけではなく、手動変更した文字や位置には配置修正が必要な場合があります。ブラウザーは出典を再検証しません。ソースに基づく引き渡しでは両 CLI を `--repo-root` 付きで再実行します。

<a id="routing-and-spacing"></a>

## 経路と余白

- ノード矩形間は図座標で64px以上。ラベルの経路には推定全文幅＋24pxを確保します。
- 通常カードはタイトル20px、本文／フィールド／メンバー／接続線16px、補助文字14pxを想定します。必要な個々の枠と経路を拡張します。全体の一律拡大は画面に収めると効果を失います。これは作成時の推奨で、新しい最小検証寸法ではありません。旧コンパクトカードや特殊記号は引き続き対応します。初期表示は浮動ツールバーと開いたパネルを避けて全図を収め、最小ズームは0.08です。明示的な全図表示も同じです。
- 平行、分岐、合流は自動で24pxレーンを使い、端点付近の共有は最大12pxです。ER 記号の長い余白は経路共有の許可ではありません。
- ノードの辺は自動レーンが収まる長さにします。端点側のはみ出しが報告されたらノードを拡張するか経路ヒントを使います。
- 自己ループ以外のヒント付き経路は最初／最後の点で接続側と境界上の位置を決めます。ER は外向き直線28px、他は12px。経由点は接続先を含む全ノードの外に置きます。
- 自己ループは既定で右外側の48×32pxです。そこが占有されている場合だけ `route.via`／`route.labelAt` を使います。
- 検証はノードの重なり、ラベルとノード／ラベルの重なり、端点自身も含む内部横断、危険な自己ループ、12pxを超える経路共有を拒否します。シーケンスは頭部下のライフラインに接続します。狭い余白と交差は警告です。
- 参加者中心の間隔は `max(160, estimated message width + 32)` px以上です。

## 図固有の記法

| `diagramType` | ノード `kind` | グループ `kind` | エッジ `kind` |
| --- | --- | --- | --- |
| `architecture` | `external`, `config`, `framework`, `security`, `service`, `business`, `data`, `failure`, `system`, `component`, `database` | `runtime`, `security`, `ownership`, `external` | `request`, `call`, `data`, `success`, `failure`, `framework`, `optional`, `depends` |
| `flowchart` | `start`, `end`, `process`, `decision`, `input`, `output`, `subprocess` | なし | `flow`, `yes`, `no`, `success`, `failure` |
| `sequence` | `actor`, `participant`, `external`, `service`, `database` | `alt`, `opt`, `loop` | `sync`, `async`, `return` |
| `er` | `entity` | なし | `relationship` |
| `deployment` | `device`, `node`, `container`, `artifact`, `service`, `database`, `external` | `host`, `network`, `cluster`, `namespace` | `deploy`, `network`, `depends` |
| `class` | `class`, `interface`, `abstract` | なし | `association`, `inheritance`, `implementation`, `composition`, `aggregation`, `dependency` |
| `state` | `initial`, `state`, `final`, `choice` | なし | `transition` |
| `usecase` | `actor`, `usecase` | `system` | `association`, `include`, `extend` |
| `dataflow` | `external`, `process`, `dataStore` | `ownership`, `external` | `data` |

### シーケンス

接続線には一意の正整数 `order` が必要です。参加者の上端を揃え、通常の頭部72px、アクターラベル108px、メッセージ間隔54pxに必要な全体高さを確保します。番号付きラベルは16px文字・24px行高で改行でき、頭部下と隣接メッセージの間に全文を収めます。2行を超えるなら参加者間隔を広げ、必要ならフレーム境界を動かします。`alt`／`opt`／`loop` は該当範囲を囲み、独立した非同期段階を元の同期待ちとして表しません。

```json
{ "id": "request", "source": "browser", "target": "api", "label": "POST /orders", "kind": "sync", "order": 1, "evidence": "source" }
```

### ER

全エンティティに空でない `fields` が必要です。`key` は `PK`／`FK`／`UK`。関係の両端の基数を `1`、`0..1`、`*`、`1..*`、`0..*` から指定します。

頭部72px、フィールド約32px／行、下部余白を確保します。フィールド名16px、型と鍵の表示14pxに合わせて列を広げ、長い識別子にも対応します。エンティティ外に記号用の直線28pxを残します。JSON の基数値は変更しません。

```json
{
  "id": "orders",
  "label": "orders",
  "kind": "entity",
  "fields": [
    { "name": "id", "type": "bigint", "key": "PK", "nullable": false },
    { "name": "user_id", "type": "bigint", "key": "FK", "nullable": false }
  ],
  "position": { "x": 80, "y": 120 },
  "size": { "width": 260, "height": 170 }
}
```

```json
{ "id": "user-orders", "source": "users", "target": "orders", "kind": "relationship", "sourceCardinality": "1", "targetCardinality": "0..*", "evidence": "schema" }
```

### クラス

`attributes` と `methods` は任意の文字列配列です。インターフェースと抽象クラスはステレオタイプを表示します。頭部68px、メンバー16px・行高28px、両区画の余白を確保し、名前・構造・全メンバーを切り取りや縮小なしで収めます。継承／実装、合成／集約は専用の三角／菱形記号を使い、既存の接続線種別は変えません。

### 状態

遷移は任意の `guard`、`action` を持ち、表示を `label [guard] / action` として組み立てます。

### 出典アンカー

正確なリポジトリまたは提供文書の位置に対応する場合だけ `source` を使います。外部アクターやフレームワーク管理の実行要素には省略します。`facts` は短く単一の事実にし、不確実性を文章と証拠種別の両方で示します。

明示的な概念例の依頼では、業務モデルを `facts` に記し、推論の関係を `inference` にし、メタデータで範囲を示します。パスを捏造したり、他の図へプレビュー文書の出典を流用したりしません。通常生成の出力は `index.html` と `graph.json` のみです。
