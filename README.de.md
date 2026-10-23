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

**Jina AI Test-API-Schlüssel in großen Mengen ausstellen — Embeddings-, Reranker- und Reader-Oberflächen — mit einem 9Router-Connector.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-30%20served-412991?style=for-the-badge)](https://jina.ai/embeddings)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![OmniRoute](https://img.shields.io/badge/OmniRoute-connector-8B5CF6?style=for-the-badge)](#-connect-to-omniroute)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Schnellstart](#-quick-start) · [🎁 Kostenloser Tarif](#-free-tier--how-much-you-get) · [🤖 Modelle](#-models--all-30-of-them) · [🧪 Die API verwenden](#-how-to-use-the-api) · [✅ Verifiziert](#-verified-working--every-key-is-tested) · [🧭 So funktioniert es](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [🔌 OmniRoute](#-connect-to-omniroute) · [⚙️ Optionen](#️-cli-options) · [🛰️ Proxys](#️-behind-a-proxy) · [🐞 Probleme](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Warum es das gibt

Jina AI gibt **Test-API-Schlüssel ganz ohne Konto** heraus: Die Reader-Seite führt ein verwaltetes Turnstile aus und `POST keygen.jina.ai/trial` liefert `{"api_key":"jina_…"}` (wenn das Trial-Kontingent pro IP mit 429 antwortet, stellt `POST keygen.jina.ai/empty` immer noch einen Schlüssel mit 0 Tokens aus). Jeder Schlüssel trägt ein **Guthaben von 10.000.000 Tokens** (trial_end 2036) auf einem anonymen `auto_<uuid>`-Konto, und sowohl Embeddings als auch Rerank antworten mit 200 samt Token-Zählung. Ein Schlüssel pro Exit — das ist die Einheit, die dieses Tool bündelt.

## 🎁 Kostenloser Tarif — wie viel du bekommst

| Was | Wert |
| --- | --- |
| Konto | keins — anonymes `auto_<uuid>` pro Schlüssel (`email: null`) |
| Test-Guthaben | **10.000.000 Tokens** pro Schlüssel (Wallet `trial_balance`, trial_end 2036-10-19) |
| Gate | verwaltetes Cloudflare Turnstile auf `keygen.jina.ai/trial` (frisches Token pro Lauf) |
| 429-Leiter | Trial-Kontingent pro IP erreicht → `POST keygen.jina.ai/empty` stellt trotzdem einen Schlüssel aus (0 Test-Tokens) |
| Ratenlimits | ohne Schlüssel: 20 RPM; kostenloser Schlüssel: **500 RPM** (Embed/Rerank; 2M TPM pro Schlüssel) |
| Schlüsselverwaltung | `api.jina.ai/api/v1/api_key` (widerrufen) mit einem `cf-turnstile-response`-Header |

> 💡 Der kostenlose Tarif wird von Jina AI festgelegt und kann sich ändern. Prüfe die aktuellen Zahlen auf [jina.ai](https://jina.ai) — und lass das Gate des Tools selbst entscheiden:

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 Modelle — alle 30 davon

`GET https://api.jina.ai/v1/models` ist öffentlich und lieferte **30 IDs**, darunter:

| Modell-ID | Oberfläche | Verifiziert |
| --- | --- | --- |
| `jina-ai/jina-embeddings-v4` | `POST /v1/embeddings` | **200** (tokens=3) |
| `jina-ai/jina-reranker-v2-base-multilingual` | `POST /v1/rerank` | **200** (tokens=17) |
| `jina-ai/jina-reranker-v3`, `jina-ai/jina-reranker-v3.5` | Rerank-Linie | Katalog |
| `jina-ai/jina-ocr-v1`, `jina-ai/ReaderLM-v2` | OCR / Reader | Katalog |
| `jina-ai/jina-clip-v2`, colbert / code-embeddings-Linien | Embeddings-Familie | Katalog |
> ⚠️ **Aufruf-Stolperfalle:** `GET /v1/models` listet IDs mit dem `jina-ai/`-Owner-Präfix, aber die API-Aufrufe nehmen die **kurze ID** — `{"model":"jina-embeddings-v4"}` antwortet mit 200, das präfixierte `jina-ai/jina-embeddings-v4` antwortet mit **422** (gemessen am 2026-10-19).

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

Schlüsselfreie Begleit-Oberflächen: `r.jina.ai` (Reader, 20 RPM) und `s.jina.ai` (Suche).

## 🛠 Schnellstart

```bash
cd jina-bulk-apikey
printf 'socks5://host:port\n' > proxies.txt   # optional — without it the tool runs direct
node src/launcher.js        # interactive: mint / verify / screen / settings

# or directly — one Turnstile token per key (see the note below):
node src/cli.js --count 5 --token "<cf-turnstile-response from jina.ai/reader>"
# or wire a solver:  node src/cli.js --count 5 --token-cmd "your-solver-command"
```

Der Trial-Endpunkt liegt hinter einem verwalteten Cloudflare Turnstile, daher braucht die CLI ein frisches Token pro Schlüssel: Öffne <https://jina.ai/reader>, drücke **GET YOUR API KEY** und kopiere den Wert von `cf-turnstile-response` aus dem versteckten Input (DevTools → Elements), oder richte `--token-cmd` auf einen Solver, der ein Token auf stdout ausgibt. `keys.txt` wird erst nach einem Live-Embeddings/Rerank-200 geschrieben; `accounts.json` behält den user_id- + Wallet-Snapshot.

### 🖱️ Der Launcher

Der Launcher fragt nach der Proxy-Liste und der Anzahl, merkt sie sich und führt die CLI aus — Mint, Verify, Exits screenen, Einstellungen, Hilfe, Connect to 9Router.

## 🚀 Ein Befehl

Das Captcha wird für dich gelöst — ein Befehl stellt N Konten aus und behält nur die Schlüssel, die ein Live-Chat-Aufruf verifiziert hat:

```bash
npm install                  # once: pulls puppeteer-core
npm start                    # menu → "1) Mint keys" → "How many keys?" (Enter = 10)
# or non-interactive:
node src/cli.js --count N
```

`--auto` ist der Standard und es muss nichts übergeben werden: Der eingebettete `src/solver.js` öffnet ein sichtbares Chrome über den eigenen Exit des Kontos und gibt das Turnstile-Token des Panels automatisch zurück. `--dry` gibt den aufgelösten Plan aus und beendet sich mit **keiner geschriebenen Datei und keinem Netzwerkaufruf**.

> ⚠️ **Nutzungsbedingungen & Kontorisiko.** Dies ist ein Automatisierungstool, kein Konto-Verkäufer. Massenregistrierungen und Schlüsselausstellung liegen vollständig in deiner Verantwortung: Sie können gegen die Nutzungsbedingungen des Anbieters verstoßen und dazu führen, dass Adressen, Exits oder Konten blockiert werden. Verwende es nur auf Infrastruktur, die du automatisieren darfst, und halte die Anfragerate niedrig.

## 🔧 Erweitert (optional)

Einen eigenen Solver einzubinden, ein Token manuell einzufügen oder das Tool auf ein bestimmtes Chrome zu richten, ist in **[ADVANCED.md](ADVANCED.md)** dokumentiert. Der übliche Weg braucht nichts davon.

## ✅ Verifiziert funktionierend — jeder Schlüssel wird getestet

| Prüfung | Ergebnis |
| --- | --- |
| `POST keygen.jina.ai/trial` (Turnstile-Token) | **200** `{"api_key":"jina_…"}` — Browser-Flow, beim ersten Versuch nach einem Refresh |
| `POST keygen.jina.ai/empty` (429-Leiter) | **200** — ein Schlüssel mit 0 Tokens wird trotzdem ausgestellt |
| `POST /v1/embeddings` (`jina-embeddings-v4`, kurze ID) — für **jeden** Schlüssel, bevor er geschrieben wird | **200**, Tokens gezählt |
| `POST /v1/rerank` (`jina-reranker-v2-base-multilingual`, kurze ID) | **200**, Tokens gezählt |
| `jina-ai/jina-embeddings-v4` (präfixierte ID) | **422** — verwende die kurze ID (gemessen am 2026-10-19) |
| Wallet | `trial_balance=10,000,000`, `trial_end` 2036, `email: null` |
| ein Schlüssel, der seine Prüfung nicht besteht | wird nie geschrieben — das Konto bleibt in `accounts.json` |

```bash
node src/cli.js --verify-only
node src/cli.js --screen
```

> **Qualitätsgates.** Jeder Schlüssel hier hat einen Live-`chat-200` bestanden, bevor er in `keys.txt` geschrieben wurde
> (tote Schlüssel werden nie ausgeliefert). Router-Kombinationen folgen derselben Regel auf Modellebene: Ein Eintrag wird
> **nur hinzugefügt, wenn das Modell `chat-200` antwortet und Tools aufrufen kann** — ein Modell ohne Tool-Unterstützung,
> ein toter Schlüssel oder ein toter Anbieter wird verworfen statt hinzugefügt. Führe den Verifizierungsschritt jederzeit erneut aus;
> Fehler werden gemeldet, nie versteckt.

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
| Schlüssel | `POST https://keygen.jina.ai/trial` (multipart, `cf-turnstile-response`) | 200 → `api_key`; 429 → `/empty` versuchen |
| Nachweis | `POST api.jina.ai/v1/embeddings` (+ rerank) | 200 mit echter Nutzung = Schlüssel verifiziert |
| Rotation | frischer Exit pro Schlüssel | das Trial-Kontingent gilt pro IP |

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
| `JINA_PROXIES` | `proxies.txt` | optionaler Exit-Pool, eine Zeile pro Proxy |
| `JINA_MODEL` | `jina-ai/jina-embeddings-v4` | Modell für die Live-Verifizierung |

## 🛰️ Hinter einem Proxy

**Optional — bei Skalierung empfohlen (Limits pro IP, Bans).** Das Tool funktioniert auch ohne Proxy.

- **Mit einem Pool:** Übergib `--pool <file>` (oder setze `JINA_PROXIES`), und jede Anfrage geht durch einen Exit aus dieser Liste — eine tote Leitung lässt diesen Versuch fehlschlagen und das Tool geht zur nächsten über (fail-closed, solange ein Pool bereitgestellt wird; der Pool wird bei der Verwendung erneut geprüft).
- **Ohne einen Pool:** Die CLI gibt `running WITHOUT a proxy (direct)` aus und verbindet direkt. An Registrierung, Check-in, Schlüsselausstellung oder Verifizierung ändert sich nichts — nur daran, wo die Pakete rausgehen.
- Führe `--screen` gegen beide Modi aus: Es testet die Exits, die du hast (oder die direkte Route), gegen den Anbieter vor einem echten Lauf.

## 📄 Dateien

| Pfad | Inhalt |
| --- | --- |
| `keys.txt` | ein live-verifizierter Schlüssel pro Zeile — von Git ignoriert |
| `accounts.json` | user_id / Wallet-Snapshot / Schlüssel-ID |
| `proxies.txt` | deine Exits — von Git ignoriert |
| `outputs/` | Lauf-Logs — von Git ignoriert |

## 🔌 Mit 9Router verbinden

[9Router](https://9router.com) ist ein selbst gehosteter, OpenAI-kompatibler Router:

```bash
node src/connect-9router.js --base http://localhost:20128 --password 123456
```

Standardwerte: `--prefix jina`, `--base-url https://api.jina.ai/v1`, `--model jina-ai/jina-embeddings-v4`. Modelle werden als `jina/<model id>` bereitgestellt.

## 🔌 Mit OmniRoute verbinden

[OmniRoute](https://omniroute.online) ist ein selbst gehosteter, OpenAI-kompatibler Router:

```bash
node src/connect-omniroute.js --base http://localhost:20128 --password 123456
```

Standardwerte: `--prefix jina`, `--base-url https://api.jina.ai/v1`, `--model jina-ai/jina-embeddings-v4`. Modelle werden als `jina/<model id>` bereitgestellt.

## 🔑 Was ein Schlüssel dir bringt

| | |
| --- | --- |
| 🏢 Anbieter | **Jina AI** — [jina.ai](https://jina.ai) |
| 🎁 Was der Anbieter gibt | anonyme Test-Schlüssel, 10M Test-Tokens, keine Registrierung |
| 🔑 Was ein Schlüssel dir bringt | 500 RPM bei Embeddings/Rerank (2M TPM), 30 Katalog-IDs auf `https://api.jina.ai/v1` |
| 🌐 API-Form | `POST https://api.jina.ai/v1/embeddings` · `POST /v1/rerank` |
| 🔒 Deine Daten | nur `jina.ai` / `keygen.jina.ai` / `api.jina.ai` werden kontaktiert |

## 🐞 Probleme

Wenn Jina die Keygen-Endpunkte, den Turnstile-Sitekey oder die Trial-Richtlinie ändert, stoppt das Tool dort und sagt es dir. **[Öffne ein Issue](../../issues)** mit dem Befehl und der exakten Ausgabe.

## 📄 Lizenz

MIT © 2026 — siehe [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 jina-bulk-apikey contributors

</div>