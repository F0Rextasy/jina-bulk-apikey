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

**Jina AI deneme API anahtarlarını toplu olarak üretin — embeddings, reranker ve reader yüzeyleri — bir 9Router bağlayıcısıyla.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-30%20served-412991?style=for-the-badge)](https://jina.ai/embeddings)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![OmniRoute](https://img.shields.io/badge/OmniRoute-connector-8B5CF6?style=for-the-badge)](#-connect-to-omniroute)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Hızlı başlangıç](#-quick-start) · [🎁 Ücretsiz katman](#-free-tier--how-much-you-get) · [🤖 Modeller](#-models--all-30-of-them) · [🧪 API'yi kullanın](#-how-to-use-the-api) · [✅ Doğrulandı](#-verified-working--every-key-is-tested) · [🧭 Nasıl çalışır](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Seçenekler](#️-cli-options) · [🛰️ Proxy'ler](#️-behind-a-proxy) · [🐞 Sorunlar](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Bu neden var

Jina AI, **hiç hesap gerektirmeden deneme API anahtarları** dağıtır: reader sayfası yönetilen bir Turnstile çalıştırır ve `POST keygen.jina.ai/trial` şu yanıtı döndürür: `{"api_key":"jina_…"}` (IP başına deneme kotası 429 döndürdüğünde, `POST keygen.jina.ai/empty` yine de 0 token'lı bir anahtar üretir). Her anahtar, anonim bir `auto_<uuid>` hesabında **10.000.000 token'lık deneme bakiyesi** taşır (trial_end 2036) ve hem embeddings hem de rerank, token sayılarıyla birlikte 200 yanıtı verir. Çıkış başına bir anahtar — bu aracın toplu olarak işlediği birim budur.

## 🎁 Ücretsiz katman — ne kadar elde edersiniz

| Ne | Değer |
| --- | --- |
| Hesap | yok — anahtar başına anonim `auto_<uuid>` (`email: null`) |
| Deneme bakiyesi | anahtar başına **10.000.000 token** (cüzdan `trial_balance`, trial_end 2036-10-19) |
| Kapı | `keygen.jina.ai/trial` üzerinde yönetilen Cloudflare Turnstile (her çalıştırmada taze token) |
| 429 merdiveni | IP başına deneme kotası doldu → `POST keygen.jina.ai/empty` yine de bir anahtar verir (0 deneme token'ı) |
| Hız limitleri | anahtar yok: 20 RPM; ücretsiz anahtar: **500 RPM** (embed/rerank; anahtar başına 2M TPM) |
| Anahtar yönetimi | `api.jina.ai/api/v1/api_key` (iptal) — `cf-turnstile-response` başlığıyla |

> 💡 Ücretsiz katman Jina AI tarafından belirlenir ve değişebilir. Güncel sayıları [jina.ai](https://jina.ai) adresinden kontrol edin — ve kararı aracın kendi kapısına bırakın:

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 Modeller — 30 tanesinin tamamı

`GET https://api.jina.ai/v1/models` herkese açıktır ve **30 id** döndürdü, bunlar arasında:

| Model ID | Yüzey | Doğrulandı |
| --- | --- | --- |
| `jina-ai/jina-embeddings-v4` | `POST /v1/embeddings` | **200** (tokens=3) |
| `jina-ai/jina-reranker-v2-base-multilingual` | `POST /v1/rerank` | **200** (tokens=17) |
| `jina-ai/jina-reranker-v3`, `jina-ai/jina-reranker-v3.5` | rerank hattı | katalog |
| `jina-ai/jina-ocr-v1`, `jina-ai/ReaderLM-v2` | OCR / reader | katalog |
| `jina-ai/jina-clip-v2`, colbert / code-embeddings hatları | embeddings ailesi | katalog |
> ⚠️ **Çağrı tuzağı:** `GET /v1/models` id'leri `jina-ai/` sahip önekiyle listeler, ancak API çağrıları **kısa id**'yi alır — `{"model":"jina-embeddings-v4"}` 200 yanıtı verir, önekli `jina-ai/jina-embeddings-v4` ise **422** verir (ölçüm 2026-10-19).

```bash
curl https://api.jina.ai/v1/embeddings \
  -H "Authorization: Bearer jina_…" -H "Content-Type: application/json" \
  -d '{"model":"jina-ai/jina-embeddings-v4","input":["ping"]}'
```

## 🧪 API nasıl kullanılır

Temel URL **`https://api.jina.ai/v1`**.

```python
import requests
r = requests.post("https://api.jina.ai/v1/embeddings",
  headers={"Authorization": "Bearer jina_…"},
  json={"model": "jina-ai/jina-embeddings-v4", "input": ["ping"]})
print(r.status_code, r.json()["usage"])
```

Anahtarsız yardımcı yüzeyler: `r.jina.ai` (reader, 20 RPM) ve `s.jina.ai` (search).

## 🛠 Hızlı başlangıç

```bash
cd jina-bulk-apikey
printf 'socks5://host:port\n' > proxies.txt   # optional — without it the tool runs direct
node src/launcher.js        # interactive: mint / verify / screen / settings

# or directly — one Turnstile token per key (see the note below):
node src/cli.js --count 5 --token "<cf-turnstile-response from jina.ai/reader>"
# or wire a solver:  node src/cli.js --count 5 --token-cmd "your-solver-command"
```

Deneme uç noktası yönetilen bir Cloudflare Turnstile arkasındadır, bu nedenle CLI'nin anahtar başına bir taze token'a ihtiyacı vardır: <https://jina.ai/reader> adresini açın, **GET YOUR API KEY** düğmesine basın ve gizli input'tan `cf-turnstile-response` değerini kopyalayın (DevTools → Elements) veya `--token-cmd` seçeneğini stdout'a token yazdıran bir çözücüye yönlendirin. `keys.txt` yalnızca canlı bir embeddings/rerank 200 yanıtından sonra yazılır; `accounts.json` user_id + cüzdan anlık görüntüsünü saklar.

### 🖱️ Başlatıcı

Başlatıcı proxy listesini ve sayıyı sorar, bunları hatırlar ve CLI'yi çalıştırır — mint, verify, screen exits, settings, help, Connect to 9Router.

## ✅ Çalıştığı doğrulandı — her anahtar test edilir

| Kontrol | Sonuç |
| --- | --- |
| `POST keygen.jina.ai/trial` (Turnstile token) | **200** `{"api_key":"jina_…"}` — tarayıcı akışı, bir yenilemeden sonra ilk denemede |
| `POST keygen.jina.ai/empty` (429 merdiveni) | **200** — 0 token'lı bir anahtar yine de verilir |
| `POST /v1/embeddings` (`jina-embeddings-v4`, kısa id) — yazılmadan önce **her** anahtar için | **200**, token'lar sayıldı |
| `POST /v1/rerank` (`jina-reranker-v2-base-multilingual`, kısa id) | **200**, token'lar sayıldı |
| `jina-ai/jina-embeddings-v4` (önekli id) | **422** — kısa id'yi kullanın (ölçüm 2026-10-19) |
| cüzdan | `trial_balance=10,000,000`, `trial_end` 2036, `email: null` |
| kontrolünde başarısız olan bir anahtar | asla yazılmaz — hesap `accounts.json` içinde kalır |

```bash
node src/cli.js --verify-only
node src/cli.js --screen
```

## 🧭 Nasıl çalışır

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Jina AI page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.jina.ai/v1/chat/completions → real content = the key is live
```

| Adım | Çağrı | Notlar |
| --- | --- | --- |
| sayfa | `jina.ai/reader` → "GET YOUR API KEY" | yönetilen Turnstile widget'ı |
| anahtar | `POST https://keygen.jina.ai/trial` (multipart, `cf-turnstile-response`) | 200 → `api_key`; 429 → `/empty` deneyin |
| kanıt | `POST api.jina.ai/v1/embeddings` (+ rerank) | gerçek kullanımla 200 = anahtar canlı |
| rotasyon | anahtar başına taze çıkış | deneme kotası IP başınadır |

## ⚙️ CLI seçenekleri

```bash
node src/cli.js --count N        # mint N keys (screen exits, solve, verify)
node src/cli.js --verify-only    # re-verify every key in keys.txt
node src/cli.js --screen         # exit pool self-test
node src/cli.js --connect-9router
node src/cli.js --help
```

| Env | Varsayılan | Anlamı |
| --- | --- | --- |
| `JINA_PROXIES` | `proxies.txt` | çıkış havuzu, satır başına bir proxy |
| `JINA_MODEL` | `jina-ai/jina-embeddings-v4` | canlı doğrulama için model |

## 🛰️ Proxy arkasında

**İsteğe bağlı — ölçekte önerilir (IP başına limitler, yasaklar).** Araç proxy olmadan da çalışır.

- **Havuzla:** `--pool <file>` geçin (veya `JINA_PROXIES` ayarlayın) ve her istek o listeden bir çıkış üzerinden gider — ölü bir satır o denemeyi başarısız kılar ve araç bir sonrakine geçer (bir havuz sağlandığında fail-closed; havuz kullanım anında yeniden yoklanır).
- **Havuz olmadan:** CLI `running WITHOUT a proxy (direct)` yazdırır ve doğrudan bağlanır. Kayıt, check-in, anahtar üretimi veya doğrulamayla ilgili hiçbir şey değişmez — yalnızca paketlerin nereden çıktığı değişir.
- Her iki moda karşı `--screen` çalıştırın: gerçek bir çalıştırmadan önce sahip olduğunuz çıkışları (veya doğrudan rotayı) sağlayıcıya karşı test eder.

## 📄 Dosyalar

| Yol | İçerik |
| --- | --- |
| `keys.txt` | satır başına bir canlı doğrulanmış anahtar — git tarafından yok sayılır |
| `accounts.json` | user_id / cüzdan anlık görüntüsü / anahtar id |
| `proxies.txt` | çıkışlarınız — git tarafından yok sayılır |
| `outputs/` | çalıştırma günlükleri — git tarafından yok sayılır |

## 🔌 9Router'a bağlanın

[9Router](https://9router.com) kendi kendine barındırılan, OpenAI uyumlu bir yönlendiricidir:

```bash
node src/connect-9router.js --base http://localhost:20128 --password 123456
```

Varsayılanlar: `--prefix jina`, `--base-url https://api.jina.ai/v1`, `--model jina-ai/jina-embeddings-v4`. Modeller `jina/<model id>` olarak sunulur.

## 🔌 OmniRoute'a bağlanın

[OmniRoute](https://omniroute.online) kendi kendine barındırılan, OpenAI uyumlu bir yönlendiricidir:

```bash
node src/connect-omniroute.js --base http://localhost:20128 --password 123456
```

Varsayılanlar: `--prefix jina`, `--base-url https://api.jina.ai/v1`, `--model jina-ai/jina-embeddings-v4`. Modeller `jina/<model id>` olarak sunulur.
## 🔑 Bir anahtar size ne kazandırır

| | |
| --- | --- |
| 🏢 Sağlayıcı | **Jina AI** — [jina.ai](https://jina.ai) |
| 🎁 Sağlayıcının verdikleri | anonim deneme anahtarları, 10M deneme token'ı, kayıt yok |
| 🔑 Bir anahtarın size kazandırdıkları | embeddings/rerank üzerinde 500 RPM (2M TPM), `https://api.jina.ai/v1` üzerinde 30 katalog id |
| 🌐 API şekli | `POST https://api.jina.ai/v1/embeddings` · `POST /v1/rerank` |
| 🔒 Verileriniz | yalnızca `jina.ai` / `keygen.jina.ai` / `api.jina.ai` ile iletişime geçilir |

## 🐞 Sorunlar

Jina keygen uç noktalarını, Turnstile sitekey'ini veya deneme politikasını değiştirirse, araç orada durur ve bunu bildirir. Komut ve tam çıktıyla birlikte **[bir sorun açın](../../issues)**.

## 📄 Lisans

MIT © 2026 — bkz. [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 jina-bulk-apikey contributors

</div>