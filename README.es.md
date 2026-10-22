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

**Emisión masiva de claves API de prueba de Jina AI — superficies de embeddings, reranker y reader — con un conector 9Router.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-30%20served-412991?style=for-the-badge)](https://jina.ai/embeddings)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![OmniRoute](https://img.shields.io/badge/OmniRoute-connector-8B5CF6?style=for-the-badge)](#-connect-to-omniroute)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Inicio rápido](#-quick-start) · [🎁 Nivel gratuito](#-free-tier--how-much-you-get) · [🤖 Modelos](#-models--all-30-of-them) · [🧪 Usar la API](#-how-to-use-the-api) · [✅ Verificado](#-verified-working--every-key-is-tested) · [🧭 Cómo funciona](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Opciones](#️-cli-options) · [🛰️ Proxies](#️-behind-a-proxy) · [🐞 Problemas](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Por qué existe esto

Jina AI reparte **claves API de prueba sin necesidad de cuenta**: la página del reader ejecuta un Turnstile gestionado y `POST keygen.jina.ai/trial` devuelve `{"api_key":"jina_…"}` (cuando la cuota de prueba por IP responde 429, `POST keygen.jina.ai/empty` sigue acuñando una clave de 0 tokens). Cada clave lleva un **saldo de prueba de 10.000.000 de tokens** (trial_end 2036) en una cuenta anónima `auto_<uuid>`, y tanto embeddings como rerank responden 200 con recuentos de tokens. Una clave por salida — esa es la unidad que este herramienta procesa por lotes.

## 🎁 Nivel gratuito — cuánto obtienes

| Qué | Valor |
| --- | --- |
| Cuenta | ninguna — `auto_<uuid>` anónima por clave (`email: null`) |
| Saldo de prueba | **10.000.000 de tokens** por clave (wallet `trial_balance`, trial_end 2036-10-19) |
| Puerta | Cloudflare Turnstile gestionado en `keygen.jina.ai/trial` (token nuevo por ejecución) |
| Escalera 429 | cuota de prueba por IP agotada → `POST keygen.jina.ai/empty` sigue emitiendo una clave (0 tokens de prueba) |
| Límites de velocidad | sin clave: 20 RPM; clave gratuita: **500 RPM** (embed/rerank; 2M TPM por clave) |
| Gestión de claves | `api.jina.ai/api/v1/api_key` (revocar) con una cabecera `cf-turnstile-response` |

> 💡 El nivel gratuito lo define Jina AI y puede cambiar. Consulta las cifras en vivo en [jina.ai](https://jina.ai) — y deja que la propia puerta de la herramienta decida:

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 Modelos — los 30

`GET https://api.jina.ai/v1/models` es público y devolvió **30 ids**, incluidos:

| ID de modelo | Superficie | Verificado |
| --- | --- | --- |
| `jina-ai/jina-embeddings-v4` | `POST /v1/embeddings` | **200** (tokens=3) |
| `jina-ai/jina-reranker-v2-base-multilingual` | `POST /v1/rerank` | **200** (tokens=17) |
| `jina-ai/jina-reranker-v3`, `jina-ai/jina-reranker-v3.5` | línea rerank | catálogo |
| `jina-ai/jina-ocr-v1`, `jina-ai/ReaderLM-v2` | OCR / reader | catálogo |
| `jina-ai/jina-clip-v2`, líneas colbert / code-embeddings | familia embeddings | catálogo |
> ⚠️ **Trampa al llamar:** `GET /v1/models` lista los ids con el prefijo de propietario `jina-ai/`, pero las llamadas a la API aceptan el **id corto** — `{"model":"jina-embeddings-v4"}` responde 200, el prefijado `jina-ai/jina-embeddings-v4` responde **422** (medido el 2026-10-19).

```bash
curl https://api.jina.ai/v1/embeddings \
  -H "Authorization: Bearer jina_…" -H "Content-Type: application/json" \
  -d '{"model":"jina-ai/jina-embeddings-v4","input":["ping"]}'
```

## 🧪 Cómo usar la API

URL base **`https://api.jina.ai/v1`**.

```python
import requests
r = requests.post("https://api.jina.ai/v1/embeddings",
  headers={"Authorization": "Bearer jina_…"},
  json={"model": "jina-ai/jina-embeddings-v4", "input": ["ping"]})
print(r.status_code, r.json()["usage"])
```

Superficies complementarias sin clave: `r.jina.ai` (reader, 20 RPM) y `s.jina.ai` (search).

## 🛠 Inicio rápido

```bash
cd jina-bulk-apikey
printf 'socks5://host:port\n' > proxies.txt   # optional — without it the tool runs direct
node src/launcher.js        # interactive: mint / verify / screen / settings

# or directly — one Turnstile token per key (see the note below):
node src/cli.js --count 5 --token "<cf-turnstile-response from jina.ai/reader>"
# or wire a solver:  node src/cli.js --count 5 --token-cmd "your-solver-command"
```

El endpoint de prueba está detrás de un Cloudflare Turnstile gestionado, así que el CLI necesita un token nuevo por clave: abre <https://jina.ai/reader>, pulsa **GET YOUR API KEY** y copia el valor `cf-turnstile-response` del input oculto (DevTools → Elements), o apunta `--token-cmd` a un solver que imprima un token en stdout. `keys.txt` se escribe solo tras un 200 en vivo de embeddings/rerank; `accounts.json` guarda el user_id + la instantánea del wallet.

### 🖱️ El launcher

El launcher pide la lista de proxies y la cantidad, las recuerda y ejecuta el CLI — mint, verify, screen exits, settings, help, Connect to 9Router.

## ✅ Verificado y funcionando — cada clave se prueba

| Comprobación | Resultado |
| --- | --- |
| `POST keygen.jina.ai/trial` (token Turnstile) | **200** `{"api_key":"jina_…"}` — flujo de navegador, a la primera tras un refresco |
| `POST keygen.jina.ai/empty` (escalera 429) | **200** — una clave de 0 tokens igualmente se emite |
| `POST /v1/embeddings` (`jina-embeddings-v4`, id corto) — para **cada** clave antes de escribirse | **200**, tokens contados |
| `POST /v1/rerank` (`jina-reranker-v2-base-multilingual`, id corto) | **200**, tokens contados |
| `jina-ai/jina-embeddings-v4` (id prefijado) | **422** — usa el id corto (medido el 2026-10-19) |
| wallet | `trial_balance=10,000,000`, `trial_end` 2036, `email: null` |
| una clave que falla su comprobación | nunca se escribe — la cuenta permanece en `accounts.json` |

```bash
node src/cli.js --verify-only
node src/cli.js --screen
```

## 🧭 Cómo funciona

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Jina AI page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.jina.ai/v1/chat/completions → real content = the key is live
```

| Paso | Llamada | Notas |
| --- | --- | --- |
| página | `jina.ai/reader` → "GET YOUR API KEY" | widget Turnstile gestionado |
| clave | `POST https://keygen.jina.ai/trial` (multipart, `cf-turnstile-response`) | 200 → `api_key`; 429 → prueba `/empty` |
| prueba | `POST api.jina.ai/v1/embeddings` (+ rerank) | 200 con uso real = clave activa |
| rotación | salida nueva por clave | la cuota de prueba es por IP |

## ⚙️ Opciones del CLI

```bash
node src/cli.js --count N        # mint N keys (screen exits, solve, verify)
node src/cli.js --verify-only    # re-verify every key in keys.txt
node src/cli.js --screen         # exit pool self-test
node src/cli.js --connect-9router
node src/cli.js --help
```

| Variable de entorno | Por defecto | Significado |
| --- | --- | --- |
| `JINA_PROXIES` | `proxies.txt` | pool de salidas, una línea por proxy |
| `JINA_MODEL` | `jina-ai/jina-embeddings-v4` | modelo para la verificación en vivo |

## 🛰️ Detrás de un proxy

**Opcional — recomendado a escala (límites por IP, baneos).** La herramienta también funciona sin proxy.

- **Con un pool:** pasa `--pool <file>` (o define `JINA_PROXIES`) y cada petición sale por una salida de esa lista — una línea muerta hace fallar ese intento y la herramienta pasa a la siguiente (fail-closed mientras se proporciona un pool; el pool se vuelve a sondear al usarse).
- **Sin un pool:** el CLI imprime `running WITHOUT a proxy (direct)` y se conecta directamente. Nada del registro, check-in, acuñación de claves o verificación cambia — solo desde dónde salen los paquetes.
- Ejecuta `--screen` en cualquiera de los dos modos: prueba las salidas que tengas (o la ruta directa) contra el proveedor antes de una ejecución real.

## 📄 Archivos

| Ruta | Contenido |
| --- | --- |
| `keys.txt` | una clave verificada en vivo por línea — ignorada por git |
| `accounts.json` | user_id / instantánea del wallet / id de clave |
| `proxies.txt` | tus salidas — ignorado por git |
| `outputs/` | registros de ejecución — ignorados por git |

## 🔌 Conectar con 9Router

[9Router](https://9router.com) es un router autoalojado compatible con OpenAI:

```bash
node src/connect-9router.js --base http://localhost:20128 --password 123456
```

Valores por defecto: `--prefix jina`, `--base-url https://api.jina.ai/v1`, `--model jina-ai/jina-embeddings-v4`. Los modelos se sirven como `jina/<model id>`.

## 🔌 Conectar con OmniRoute

[OmniRoute](https://omniroute.online) es un router autoalojado compatible con OpenAI:

```bash
node src/connect-omniroute.js --base http://localhost:20128 --password 123456
```

Valores por defecto: `--prefix jina`, `--base-url https://api.jina.ai/v1`, `--model jina-ai/jina-embeddings-v4`. Los modelos se sirven como `jina/<model id>`.
## 🔑 Qué te da una clave

| | |
| --- | --- |
| 🏢 Proveedor | **Jina AI** — [jina.ai](https://jina.ai) |
| 🎁 Qué da el proveedor | claves de prueba anónimas, 10M tokens de prueba, sin registro |
| 🔑 Qué te da una clave | 500 RPM en embeddings/rerank (2M TPM), 30 ids de catálogo en `https://api.jina.ai/v1` |
| 🌐 Forma de la API | `POST https://api.jina.ai/v1/embeddings` · `POST /v1/rerank` |
| 🔒 Tus datos | solo se contacta con `jina.ai` / `keygen.jina.ai` / `api.jina.ai` |

## 🐞 Problemas

Si Jina cambia los endpoints de keygen, la sitekey de Turnstile o la política de prueba, la herramienta se detiene ahí y lo indica. **[Abre un issue](../../issues)** con el comando y la salida exacta.

## 📄 Licencia

MIT © 2026 — consulta [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 jina-bulk-apikey contributors

</div>