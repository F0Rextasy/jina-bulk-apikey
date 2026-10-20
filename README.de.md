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

**Jina AI Trial-API-Keys in großen Mengen ausstellen — Embeddings-, Reranker- und Reader-Oberflächen — mit einem 9Router-Connector.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-30%20served-412991?style=for-the-badge)](https://jina.ai/embeddings)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Schnellstart](#-quick-start) · [🎁 Free-Tier](#-free-tier--how-much-you-get) · [🤖 Modelle](#-models--all-30-of-them) · [🧪 Die API verwenden](#-how-to-use-the-api) · [✅ Verifiziert](#-verified-working--every-key-is-tested) · [🧭 So funktioniert es](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Optionen](#️-cli-options) · [🛰️ Proxys](#️-behind-a-proxy) · [🐞 Issues](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Warum es das gibt

Jina AI gibt **Trial-API-Keys ganz ohne Konto** heraus: Die Reader-Seite führt ein verwaltetes Turnstile aus und `POST keygen.jina.ai/trial` liefert `{"api_key":"jina_…"}` (wenn das Trial-Kontingent pro IP mit 429 antwortet, stellt `POST keygen.jina.ai/empty` trotzdem einen Key mit 0 Tokens aus). Jeder Key trägt ein **Trial-Guthaben von 10.000.000 Tokens** (trial_end 2036) auf einem anonymen `auto_<uuid>`-Konto, und sowohl Embeddings als auch Rerank antworten mit 200 samt Token-Zählung. Ein Key pro Exit — das ist die Einheit, die dieses Tool bündelt.

## 🎁 Free-Tier — wie viel du bekommst

| Was | Wert |
| --- | --- |
| Konto | keins — anonymes `auto_<uuid>` pro Key (`email: null`) |
| Trial-Guthaben | **10.000.000 Tokens** pro Key (Wallet `trial_balance`, trial_end 2036-10-19) |
| Gate | verwaltetes Cloudflare Turnstile auf `keygen.jina.ai/trial` (frisches Token pro Lauf) |
| 429-Leiter | Trial-Kontingent pro IP erreicht → `POST keygen.jina.ai/empty` stellt trotzdem einen Key aus (0 Trial-Tokens) |
| Rate-Limits | ohne Key: 20 RPM; Free-Key: **500 RPM** (Embed/Rerank; 2M TPM pro Key) |
| Key-Verwaltung | `api.jina.ai/api/v1/api_key` (widerrufen) mit einem `cf-turnstile-response`-Header |

> 💡 Der Free-Tier wird von Jina AI festgelegt und kann sich ändern. Prüfe die aktuellen Zahlen auf [jina.ai](https://jina.ai) — und lass das Gate des Tools selbst entscheiden:

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 Modelle — alle 30

`GET https://api.jina.ai/v1/models` ist öffentlich und lieferte **30 IDs**, darunter:

| Modell-ID | Oberfläche | Verifiziert |
| --- | --- | --- |
| `jina-ai/jina-embeddings-v4` | `POST /v1/embeddings` | **200** (tokens=3) |
| `jina-ai/jina-reranker-v2-base-multilingual` | `POST /v1/rerank` | **200** (tokens=17) |
| `jina-ai/jina-reranker-v3`, `jina-ai/jina-reranker-v3.5` | Rerank-Linie | Katalog |
| `jina-ai/jina-ocr-v1`, `jina-ai/ReaderLM-v2` | OCR / Reader | Katalog |
| `jina-ai/jina-clip-v2`, ColBERT- / Code-Embeddings-Linien | Embeddings-Familie | Katalog |
> ⚠️ **Aufruf-Stolperfalle:** `GET /v1/models` listet IDs mit dem Owner-Präfix `jina-ai/`, aber die API-Aufrufe nehmen die **kurze ID** — `{"model":"jina-embeddings-v4"}` antwortet mit 200, das präfixierte `jina-ai/jina-embeddings-v4` antwortet mit **422** (gemessen am 2026-10-19).

```bash
curl https://api.jina.ai/v1/embeddings \
  -H "Authorization: Bearer jina_…" -H "Content-Type: application/json" \
  -d '{"model":"jina-ai/jina-embeddings-v4","input":["ping"]}'
```

## 🧪 Die API verwenden

Basis-URL **`https://api.jina.ai/v1`**.

```python
import requests
r = requests.post("https://api.jina.ai/v1/embeddings",
  headers={"Authorization": "Bearer jina_…"},
  json={"model": "jina-ai/jina-embeddings-v4", "input": ["ping"]})
print(r.status_code, r.json()["usage"])
```

Schlüssellose Begleit-Oberflächen: `r.jina.ai` (Reader, 20 RPM) und `s.jina.ai` (Suche).

## 🛠 Schnellstart

```bash
cd jina-bulk-apikey
printf 'socks5://host:port\n' > proxies.txt   # optional — without it the tool runs direct
node src/launcher.js        # interactive: mint / verify / screen / settings
# or directly — one Turnstile token per key (see the note below):
node src/cli.js --count 5 --token "<cf-turnstile-response from jina.ai/reader>"
# or wire a solver:  node src/cli.js --count 5 --token-cmd "your-solver-command"
```

Der Trial-Endpunkt liegt hinter einem verwalteten Cloudflare Turnstile, daher braucht die CLI ein frisches Token pro Key: Öffne <https://jina.ai/reader>, drücke **GET YOUR API KEY** und kopiere den Wert `cf-turnstile-response` aus dem versteckten Input (DevTools → Elements), oder richte `--token-cmd` auf einen Solver, der ein Token auf stdout ausgibt. `keys.txt` wird erst nach einem Live-Embeddings/Rerank-200 geschrieben; `accounts.json` bewahrt den user_id- + Wallet-Snapshot auf.

### 🖱️ Der Launcher

Der Launcher fragt nach Proxy-Liste und Anzahl, merkt sie sich und führt die CLI aus — Mint, Verify, Exits screenen, Einstellungen, Hilfe, Connect to 9Router.

## ✅ Verifiziert funktionierend — jeder Key wird getestet

| Prüfung | Ergebnis |
| --- | --- |
| `POST keygen.jina.ai/trial` (Turnstile-Token) | **200** `{"api_key":"jina_…"}` — Browser-Flow, beim ersten Versuch nach einem Refresh |
| `POST keygen.jina.ai/empty` (429-Leiter) | **200** — ein Key mit 0 Tokens wird trotzdem ausgestellt |
| `POST /v1/embeddings` (`jina-embeddings-v4`, kurze ID) — für **jeden** Key, bevor er geschrieben wird | **200**, Tokens gezählt |
| `POST /v1/rerank` (`jina-reranker-v2-base-multilingual`, kurze ID) | **200**, Tokens gezählt |
| `jina-ai/jina-embeddings-v4` (präfixierte ID) | **422** — verwende die kurze ID (gemessen am 2026-10-19) |
| Wallet | `trial_balance=10,000,000`, `trial_end` 2036, `email: null` |
| ein Key, der seine Prüfung nicht besteht | wird nie geschrieben — das Konto bleibt in `accounts.json` |

```bash
node src/cli.js --verify-only
node src/cli.js --screen
```

## 🧭 So funktioniert es

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Jina AI page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.jina.ai/v1/chat/completions → real content = the key is live
```

| Schritt | Aufruf | Hinweise |
| --- | --- | --- |
| Seite | `jina.ai/reader` → "GET YOUR API KEY" | verwaltetes Turnstile-Widget |
| Key | `POST https://keygen.jina.ai/trial` (multipart, `cf-turnstile-response`) | 200 → `api_key`; 429 → `/empty` versuchen |
| Nachweis | `POST api.jina.ai/v1/embeddings` (+ Rerank) | 200 mit echter Usage = Key ist live |
| Rotation | frischer Exit pro Key | das Trial-Kontingent gilt pro IP |

## ⚙️ CLI-Optionen

```bash
node src/cli.js --count N        # mint N keys (screen exits, solve, verify)
node src/cli.js --verify-only    # re-verify every key in keys.txt
node src/cli.js --screen         # exit pool self-test
node src/cli.js --connect-9router
node src/cli.js --help
```

| Env | Standard | Bedeutung |
| --- | --- | --- |
| `JINA_PROXIES` | `proxies.txt` | Exit-Pool, eine Zeile pro Proxy |
| `JINA_MODEL` | `jina-ai/jina-embeddings-v4` | Modell für die Live-Verifizierung |

## 🛰️ Hinter einem Proxy

**Optional — bei Skalierung empfohlen (Limits pro IP, Bans).** Das Tool funktioniert auch ohne Proxy.

- **Mit einem Pool:** übergib `--pool <file>` (oder setze `JINA_PROXIES`), und jede Anfrage geht durch einen Exit aus dieser Liste — eine tote Leitung lässt diesen Versuch fehlschlagen und das Tool geht zur nächsten über (fail-closed, solange ein Pool angegeben ist; der Pool wird bei der Nutzung erneut geprüft).
- **Ohne einen Pool:** Die CLI gibt `running WITHOUT a proxy (direct)` aus und verbindet direkt. An Sign-up, Check-in, Key-Minting oder Verifizierung ändert sich nichts — nur daran, wo die Pakete rausgehen.
- Führe `--screen` in beiden Modi aus: Es testet die Exits, die du hast (oder die direkte Route), vor einem echten Lauf gegen den Anbieter.

## 📄 Dateien

| Pfad | Inhalt |
| --- | --- |
| `keys.txt` | ein live-verifizierter Key pro Zeile — von Git ignoriert |
| `accounts.json` | user_id / Wallet-Snapshot / Key-ID |
| `proxies.txt` | deine Exits — von Git ignoriert |
| `outputs/` | Lauf-Logs — von Git ignoriert |

## 🔌 Connect to 9Router

[9Router](https://9router.com) ist ein selbst gehosteter, OpenAI-kompatibler Router:

```bash
node src/connect-9router.js --base http://localhost:20128 --password 123456
```

Standardwerte: `--prefix jina`, `--base-url https://api.jina.ai/v1`, `--model jina-ai/jina-embeddings-v4`. Modelle werden als `jina/<model id>` bereitgestellt.

## 🔑 Was ein Key dir bringt

| | |
| --- | --- |
| 🏢 Anbieter | **Jina AI** — [jina.ai](https://jina.ai) |
| 🎁 Was der Anbieter gibt | anonyme Trial-Keys, 10M Trial-Tokens, keine Anmeldung |
| 🔑 Was ein Key dir bringt | 500 RPM bei Embeddings/Rerank (2M TPM), 30 Katalog-IDs auf `https://api.jina.ai/v1` |
| 🌐 API-Form | `POST https://api.jina.ai/v1/embeddings` · `POST /v1/rerank` |
| 🔒 Deine Daten | nur `jina.ai` / `keygen.jina.ai` / `api.jina.ai` werden kontaktiert |

## 🐞 Issues

Wenn Jina die Keygen-Endpunkte, den Turnstile-Sitekey oder die Trial-Richtlinie ändert, stoppt das Tool dort und sagt es. **[Öffne ein Issue](../../issues)** mit dem Befehl und der exakten Ausgabe.

## 📄 Lizenz

MIT © 2026 — siehe [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 jina-bulk-apikey contributors

</div>