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

**Bulk-issue Jina AI trial API keys — embeddings, reranker and reader surfaces — with a 9Router connector.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-30%20served-412991?style=for-the-badge)](https://jina.ai/embeddings)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![OmniRoute](https://img.shields.io/badge/OmniRoute-connector-8B5CF6?style=for-the-badge)](#-connect-to-omniroute)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Quick start](#-quick-start) · [🎁 Free tier](#-free-tier--how-much-you-get) · [🤖 Models](#-models--all-30-of-them) · [🧪 Use the API](#-how-to-use-the-api) · [✅ Verified](#-verified-working--every-key-is-tested) · [🧭 How it works](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Options](#️-cli-options) · [🛰️ Proxies](#️-behind-a-proxy) · [🐞 Issues](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Why this exists

Jina AI hands out **trial API keys with no account at all**: the reader page runs a managed Turnstile and `POST keygen.jina.ai/trial` returns `{"api_key":"jina_…"}` (when the per-IP trial quota answers 429, `POST keygen.jina.ai/empty` still mints a 0-token key). Every key carries a **10,000,000-token trial balance** (trial_end 2036) on an anonymous `auto_<uuid>` account, and both embeddings and rerank answer 200 with token counts. One key per exit — that is the unit this tool batches.

## 🎁 Free tier — how much you get

| What | Value |
| --- | --- |
| Account | none — anonymous `auto_<uuid>` per key (`email: null`) |
| Trial balance | **10,000,000 tokens** per key (wallet `trial_balance`, trial_end 2036-10-19) |
| Gate | managed Cloudflare Turnstile on `keygen.jina.ai/trial` (fresh token per run) |
| 429 ladder | per-IP trial quota hit → `POST keygen.jina.ai/empty` still issues a key (0 trial tokens) |
| Rate limits | no key: 20 RPM; free key: **500 RPM** (embed/rerank; 2M TPM per key) |
| Key management | `api.jina.ai/api/v1/api_key` (revoke) with a `cf-turnstile-response` header |

> 💡 The free tier is set by Jina AI and can change. Check the live numbers at [jina.ai](https://jina.ai) — and let the tool's own gate decide:

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 Models — all 30 of them

`GET https://api.jina.ai/v1/models` is public and returned **30 ids**, including:

| Model ID | Surface | Verified |
| --- | --- | --- |
| `jina-ai/jina-embeddings-v4` | `POST /v1/embeddings` | **200** (tokens=3) |
| `jina-ai/jina-reranker-v2-base-multilingual` | `POST /v1/rerank` | **200** (tokens=17) |
| `jina-ai/jina-reranker-v3`, `jina-ai/jina-reranker-v3.5` | rerank line | catalogue |
| `jina-ai/jina-ocr-v1`, `jina-ai/ReaderLM-v2` | OCR / reader | catalogue |
| `jina-ai/jina-clip-v2`, colbert / code-embeddings lines | embeddings family | catalogue |
> ⚠️ **Calling gotcha:** `GET /v1/models` lists ids with the `jina-ai/` owner prefix, but the API calls take the **short id** — `{"model":"jina-embeddings-v4"}` answers 200, the prefixed `jina-ai/jina-embeddings-v4` answers **422** (measured 2026-10-19).

```bash
curl https://api.jina.ai/v1/embeddings \
  -H "Authorization: Bearer jina_…" -H "Content-Type: application/json" \
  -d '{"model":"jina-ai/jina-embeddings-v4","input":["ping"]}'
```

## 🧪 How to use the API

Base URL **`https://api.jina.ai/v1`**.

```python
import requests
r = requests.post("https://api.jina.ai/v1/embeddings",
  headers={"Authorization": "Bearer jina_…"},
  json={"model": "jina-ai/jina-embeddings-v4", "input": ["ping"]})
print(r.status_code, r.json()["usage"])
```

Keyless companion surfaces: `r.jina.ai` (reader, 20 RPM) and `s.jina.ai` (search).

## 🛠 Quick start

```bash
cd jina-bulk-apikey
printf 'socks5://host:port\n' > proxies.txt   # optional — without it the tool runs direct
node src/launcher.js        # interactive: mint / verify / screen / settings
# or directly — one Turnstile token per key (see the note below):
node src/cli.js --count 5 --token "<cf-turnstile-response from jina.ai/reader>"
# or wire a solver:  node src/cli.js --count 5 --token-cmd "your-solver-command"
```

The trial endpoint is behind a managed Cloudflare Turnstile, so the CLI needs one fresh token per key: open <https://jina.ai/reader>, press **GET YOUR API KEY**, and copy the `cf-turnstile-response` value from the hidden input (DevTools → Elements), or point `--token-cmd` at a solver that prints a token on stdout. `keys.txt` is written only after a live embeddings/rerank 200; `accounts.json` keeps the user_id + wallet snapshot.

### 🖱️ The launcher

The launcher asks for the proxy list and count, remembers them, and runs the CLI — mint, verify, screen exits, settings, help, Connect to 9Router.

## ✅ Verified working — every key is tested

| Check | Result |
| --- | --- |
| `POST keygen.jina.ai/trial` (Turnstile token) | **200** `{"api_key":"jina_…"}` — browser flow, first try after one refresh |
| `POST keygen.jina.ai/empty` (429 ladder) | **200** — a 0-token key still issues |
| `POST /v1/embeddings` (`jina-embeddings-v4`, short id) — for **every** key before it is written | **200**, tokens counted |
| `POST /v1/rerank` (`jina-reranker-v2-base-multilingual`, short id) | **200**, tokens counted |
| `jina-ai/jina-embeddings-v4` (prefixed id) | **422** — use the short id (measured 2026-10-19) |
| wallet | `trial_balance=10,000,000`, `trial_end` 2036, `email: null` |
| a key that fails its check | never written — account stays in `accounts.json` |

```bash
node src/cli.js --verify-only
node src/cli.js --screen
```

## 🧭 How it works

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Jina AI page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.jina.ai/v1/chat/completions → real content = the key is live
```

| Step | Call | Notes |
| --- | --- | --- |
| page | `jina.ai/reader` → "GET YOUR API KEY" | managed Turnstile widget |
| key | `POST https://keygen.jina.ai/trial` (multipart, `cf-turnstile-response`) | 200 → `api_key`; 429 → try `/empty` |
| proof | `POST api.jina.ai/v1/embeddings` (+ rerank) | 200 with real usage = key verified |
| rotate | fresh exit per key | the trial quota is per IP |

## ⚙️ CLI options

```bash
node src/cli.js --count N        # mint N keys (screen exits, solve, verify)
node src/cli.js --verify-only    # re-verify every key in keys.txt
node src/cli.js --screen         # exit pool self-test
node src/cli.js --connect-9router
node src/cli.js --help
```

| Env | Default | Meaning |
| --- | --- | --- |
| `JINA_PROXIES` | `proxies.txt` | exit pool, one line per proxy |
| `JINA_MODEL` | `jina-ai/jina-embeddings-v4` | model for the live verification |

## 🛰️ Behind a proxy

**Optional — recommended at scale (per-IP limits, bans).** The tool works without a proxy too.

- **With a pool:** pass `--pool <file>` (or set `JINA_PROXIES`) and every request goes through an exit from that list — a dead line fails that attempt and the tool moves to the next one (fail-closed while a pool is provided; the pool is re-probed at use).
- **Without a pool:** the CLI prints `running WITHOUT a proxy (direct)` and connects directly. Nothing about sign-up, check-in, key minting or verification changes — only where the packets leave from.
- Run `--screen` against either mode: it tests the exits you have (or the direct route) against the provider before a real run.

## 📄 Files

| Path | Contents |
| --- | --- |
| `keys.txt` | one live-verified key per line — git-ignored |
| `accounts.json` | user_id / wallet snapshot / key id |
| `proxies.txt` | your exits — git-ignored |
| `outputs/` | run logs — git-ignored |

## 🔌 Connect to 9Router

[9Router](https://9router.com) is a self-hosted, OpenAI-compatible router:

```bash
node src/connect-9router.js --base http://localhost:20128 --password 123456
```

Defaults: `--prefix jina`, `--base-url https://api.jina.ai/v1`, `--model jina-ai/jina-embeddings-v4`. Models are served as `jina/<model id>`.


## 🔌 Connect to OmniRoute

[OmniRoute](https://omniroute.online) is a self-hosted, OpenAI-compatible router:

```bash
node src/connect-omniroute.js --base http://localhost:20128 --password 123456
```

Defaults: `--prefix jina`, `--base-url https://api.jina.ai/v1`, `--model jina-ai/jina-embeddings-v4`. Models are served as `jina/<model id>`.
## 🔑 What one key gets you

| | |
| --- | --- |
| 🏢 Provider | **Jina AI** — [jina.ai](https://jina.ai) |
| 🎁 What the provider gives | anonymous trial keys, 10M trial tokens, no signup |
| 🔑 What one key gets you | 500 RPM on embeddings/rerank (2M TPM), 30 catalogue ids on `https://api.jina.ai/v1` |
| 🌐 API shape | `POST https://api.jina.ai/v1/embeddings` · `POST /v1/rerank` |
| 🔒 Your data | only `jina.ai` / `keygen.jina.ai` / `api.jina.ai` are contacted |

## 🐞 Issues

If Jina changes the keygen endpoints, the Turnstile sitekey or the trial policy, the tool stops there and says so. **[Open an issue](../../issues)** with the command and the exact output.

## 📄 License

MIT © 2026 — see [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 jina-bulk-apikey contributors

</div>
