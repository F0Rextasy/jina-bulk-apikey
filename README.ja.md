<div align="center">

```
     ██╗██╗███╗   ██╗ █████╗
     ██║██║████╗  ██║██╔══██╗
     ██║██║██╔██╗ ██║███████║
██   ██║██║██║╚██╗██║██╔══██║
╚█████╔╝██║██║ ╚████║██║  ██║
 ╚════╝ ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝
```

# jina-bulk-apikey

**Jina AI のトライアル API キーを一括発行 — embeddings、reranker、reader サーフェス — 9Router コネクタ付き。**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-30%20served-412991?style=for-the-badge)](https://jina.ai/embeddings)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 クイックスタート](#-quick-start) · [🎁 無料枠](#-free-tier--how-much-you-get) · [🤖 モデル](#-models--all-30-of-them) · [🧪 API の使い方](#-how-to-use-the-api) · [✅ 検証済み](#-verified-working--every-key-is-tested) · [🧭 仕組み](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ オプション](#️-cli-options) · [🛰️ プロキシ](#️-behind-a-proxy) · [🐞 Issues](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ これが存在する理由

Jina AI は**アカウント不要でトライアル API キーを配布しています**。reader ページはマネージド Turnstile を実行し、`POST keygen.jina.ai/trial` は `{"api_key":"jina_…"}` を返します（IP ごとのトライアルクォータが 429 を返す場合でも、`POST keygen.jina.ai/empty` は 0 トークンのキーを発行します）。各キーは匿名の `auto_<uuid>` アカウント上で **10,000,000 トークンのトライアル残高**（trial_end 2036）を持ち、embeddings と rerank の両方がトークン数付きで 200 を返します。1 出口につき 1 キー — これがこのツールがバッチ処理する単位です。

## 🎁 無料枠 — どれだけ得られるか

| 項目 | 値 |
| --- | --- |
| アカウント | なし — キーごとに匿名の `auto_<uuid>`（`email: null`） |
| トライアル残高 | キーごとに **10,000,000 トークン**（ウォレット `trial_balance`、trial_end 2036-10-19） |
| ゲート | `keygen.jina.ai/trial` 上のマネージド Cloudflare Turnstile（実行ごとに新しいトークン） |
| 429 ラダー | IP ごとのトライアルクォータに到達 → `POST keygen.jina.ai/empty` でもキーを発行（トライアルトークン 0） |
| レート制限 | キーなし: 20 RPM、無料キー: **500 RPM**（embed/rerank、キーごとに 2M TPM） |
| キー管理 | `api.jina.ai/api/v1/api_key`（失効）と `cf-turnstile-response` ヘッダー |

> 💡 無料枠は Jina AI が設定するもので、変更される可能性があります。最新の数値は [jina.ai](https://jina.ai) で確認してください — そしてツール自身のゲートに判断を委ねましょう:

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 モデル — 全 30 種

`GET https://api.jina.ai/v1/models` は公開されており、**30 個の id** を返しました。以下を含みます:

| モデル ID | サーフェス | 検証済み |
| --- | --- | --- |
| `jina-ai/jina-embeddings-v4` | `POST /v1/embeddings` | **200**（tokens=3） |
| `jina-ai/jina-reranker-v2-base-multilingual` | `POST /v1/rerank` | **200**（tokens=17） |
| `jina-ai/jina-reranker-v3`, `jina-ai/jina-reranker-v3.5` | rerank ライン | カタログ |
| `jina-ai/jina-ocr-v1`, `jina-ai/ReaderLM-v2` | OCR / reader | カタログ |
| `jina-ai/jina-clip-v2`, colbert / code-embeddings ライン | embeddings ファミリー | カタログ |
> ⚠️ **呼び出しの落とし穴:** `GET /v1/models` は `jina-ai/` オーナープレフィックス付きの id を列挙しますが、API 呼び出しは**短い id** を受け付けます — `{"model":"jina-embeddings-v4"}` は 200 を返し、プレフィックス付きの `jina-ai/jina-embeddings-v4` は **422** を返します（2026-10-19 計測）。

```bash
curl https://api.jina.ai/v1/embeddings \
  -H "Authorization: Bearer jina_…" -H "Content-Type: application/json" \
  -d '{"model":"jina-ai/jina-embeddings-v4","input":["ping"]}'
```

## 🧪 API の使い方

ベース URL は **`https://api.jina.ai/v1`**。

```python
import requests
r = requests.post("https://api.jina.ai/v1/embeddings",
  headers={"Authorization": "Bearer jina_…"},
  json={"model": "jina-ai/jina-embeddings-v4", "input": ["ping"]})
print(r.status_code, r.json()["usage"])
```

キー不要のコンパニオンサーフェス: `r.jina.ai`（reader、20 RPM）と `s.jina.ai`（search）。

## 🛠 クイックスタート

```bash
cd jina-bulk-apikey
printf 'socks5://host:port\n' > proxies.txt   # optional — without it the tool runs direct
node src/launcher.js        # interactive: mint / verify / screen / settings

# or directly — one Turnstile token per key (see the note below):
node src/cli.js --count 5 --token "<cf-turnstile-response from jina.ai/reader>"
# or wire a solver:  node src/cli.js --count 5 --token-cmd "your-solver-command"
```

トライアルエンドポイントはマネージド Cloudflare Turnstile の背後にあるため、CLI はキーごとに 1 つの新しいトークンを必要とします: <https://jina.ai/reader> を開き、**GET YOUR API KEY** を押し、隠し input から `cf-turnstile-response` の値をコピーするか（DevTools → Elements）、stdout にトークンを出力するソルバーを `--token-cmd` に指定します。`keys.txt` は実際の embeddings/rerank が 200 を返した後にのみ書き込まれ、`accounts.json` は user_id とウォレットのスナップショットを保持します。

### 🖱️ ランチャー

ランチャーはプロキシリストと件数を尋ね、それらを記憶して CLI を実行します — mint、verify、screen exits、settings、help、Connect to 9Router。

## ✅ 動作検証済み — すべてのキーがテストされます

| チェック | 結果 |
| --- | --- |
| `POST keygen.jina.ai/trial`（Turnstile トークン） | **200** `{"api_key":"jina_…"}` — ブラウザフロー、1 回のリフレッシュ後に初回で成功 |
| `POST keygen.jina.ai/empty`（429 ラダー） | **200** — 0 トークンのキーでも発行される |
| `POST /v1/embeddings`（`jina-embeddings-v4`、短い id）— 書き込まれる前の**すべての**キーに対して | **200**、トークン数カウント |
| `POST /v1/rerank`（`jina-reranker-v2-base-multilingual`、短い id） | **200**、トークン数カウント |
| `jina-ai/jina-embeddings-v4`（プレフィックス付き id） | **422** — 短い id を使用（2026-10-19 計測） |
| ウォレット | `trial_balance=10,000,000`、`trial_end` 2036、`email: null` |
| チェックに失敗したキー | 書き込まれない — アカウントは `accounts.json` に残る |

```bash
node src/cli.js --verify-only
node src/cli.js --screen
```

## 🧭 仕組み

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Jina AI page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.jina.ai/v1/chat/completions → real content = the key is live
```

| ステップ | 呼び出し | 備考 |
| --- | --- | --- |
| ページ | `jina.ai/reader` → "GET YOUR API KEY" | マネージド Turnstile ウィジェット |
| キー | `POST https://keygen.jina.ai/trial`（multipart、`cf-turnstile-response`） | 200 → `api_key`、429 → `/empty` を試す |
| 証明 | `POST api.jina.ai/v1/embeddings`（+ rerank） | 実際の usage 付きで 200 = キーが有効 |
| ローテート | キーごとに新しい出口 | トライアルクォータは IP ごと |

## ⚙️ CLI オプション

```bash
node src/cli.js --count N        # mint N keys (screen exits, solve, verify)
node src/cli.js --verify-only    # re-verify every key in keys.txt
node src/cli.js --screen         # exit pool self-test
node src/cli.js --connect-9router
node src/cli.js --help
```

| 環境変数 | デフォルト | 意味 |
| --- | --- | --- |
| `JINA_PROXIES` | `proxies.txt` | 出口プール、1 行につき 1 プロキシ |
| `JINA_MODEL` | `jina-ai/jina-embeddings-v4` | 実検証に使用するモデル |

## 🛰️ プロキシの背後で

**任意 — 規模を拡大する場合は推奨（IP ごとの制限、BAN）。** このツールはプロキシなしでも動作します。

- **プールあり:** `--pool <file>` を渡す（または `JINA_PROXIES` を設定する）と、すべてのリクエストがそのリストの出口を経由します — 死んだ回線はその試行を失敗させ、ツールは次へ進みます（プールが提供されている間はフェイルクローズ、プールは使用時に再プローブされます）。
- **プールなし:** CLI は `running WITHOUT a proxy (direct)` と表示し、直接接続します。サインアップ、チェックイン、キー発行、検証のいずれも変わりません — 変わるのはパケットが出ていく場所だけです。
- どちらのモードでも `--screen` を実行してください: 実際の実行前に、利用可能な出口（または直接ルート）をプロバイダーに対してテストします。

## 📄 ファイル

| パス | 内容 |
| --- | --- |
| `keys.txt` | 1 行につき 1 つの実検証済みキー — git 管理外 |
| `accounts.json` | user_id / ウォレットスナップショット / キー id |
| `proxies.txt` | あなたの出口 — git 管理外 |
| `outputs/` | 実行ログ — git 管理外 |

## 🔌 9Router に接続

[9Router](https://9router.com) はセルフホスト型の OpenAI 互換ルーターです:

```bash
node src/connect-9router.js --base http://localhost:20128 --password 123456
```

デフォルト: `--prefix jina`、`--base-url https://api.jina.ai/v1`、`--model jina-ai/jina-embeddings-v4`。モデルは `jina/<model id>` として提供されます。

## 🔑 1 つのキーで得られるもの

| | |
| --- | --- |
| 🏢 プロバイダー | **Jina AI** — [jina.ai](https://jina.ai) |
| 🎁 プロバイダーが提供するもの | 匿名トライアルキー、10M トライアルトークン、サインアップ不要 |
| 🔑 1 つのキーで得られるもの | embeddings/rerank で 500 RPM（2M TPM）、`https://api.jina.ai/v1` で 30 のカタログ id |
| 🌐 API の形 | `POST https://api.jina.ai/v1/embeddings` · `POST /v1/rerank` |
| 🔒 あなたのデータ | 接続先は `jina.ai` / `keygen.jina.ai` / `api.jina.ai` のみ |

## 🐞 Issues

Jina が keygen エンドポイント、Turnstile サイトキー、またはトライアルポリシーを変更した場合、ツールはそこで停止し、その旨を報告します。コマンドと正確な出力を添えて **[issue を作成してください](../../issues)**。

## 📄 ライセンス

MIT © 2026 — [LICENSE](LICENSE) を参照。

<div align="center">

**[MIT](LICENSE)** © 2026 jina-bulk-apikey contributors

</div>