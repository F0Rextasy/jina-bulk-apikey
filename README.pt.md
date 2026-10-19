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

**Emissão em massa de chaves de API de teste da Jina AI — superfícies de embeddings, reranker e reader — com um conector 9Router.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-30%20served-412991?style=for-the-badge)](https://jina.ai/embeddings)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Início rápido](#-quick-start) · [🎁 Camada gratuita](#-free-tier--how-much-you-get) · [🤖 Modelos](#-models--all-30-of-them) · [🧪 Usar a API](#-how-to-use-the-api) · [✅ Verificado](#-verified-working--every-key-is-tested) · [🧭 Como funciona](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Opções](#️-cli-options) · [🛰️ Proxies](#️-behind-a-proxy) · [🐞 Problemas](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Por que isto existe

A Jina AI distribui **chaves de API de teste sem nenhuma conta**: a página do reader executa um Turnstile gerenciado e `POST keygen.jina.ai/trial` retorna `{"api_key":"jina_…"}` (quando a cota de teste por IP responde 429, `POST keygen.jina.ai/empty` ainda emite uma chave de 0 tokens). Cada chave carrega um **saldo de teste de 10.000.000 de tokens** (trial_end 2036) em uma conta anônima `auto_<uuid>`, e tanto embeddings quanto rerank respondem 200 com contagens de tokens. Uma chave por saída — essa é a unidade que esta ferramenta processa em lote.

## 🎁 Camada gratuita — quanto você recebe

| O quê | Valor |
| --- | --- |
| Conta | nenhuma — `auto_<uuid>` anônima por chave (`email: null`) |
| Saldo de teste | **10.000.000 de tokens** por chave (carteira `trial_balance`, trial_end 2036-10-19) |
| Barreira | Cloudflare Turnstile gerenciado em `keygen.jina.ai/trial` (token novo por execução) |
| Escada 429 | cota de teste por IP atingida → `POST keygen.jina.ai/empty` ainda emite uma chave (0 tokens de teste) |
| Limites de taxa | sem chave: 20 RPM; chave gratuita: **500 RPM** (embed/rerank; 2M TPM por chave) |
| Gerenciamento de chaves | `api.jina.ai/api/v1/api_key` (revogar) com um cabeçalho `cf-turnstile-response` |

> 💡 A camada gratuita é definida pela Jina AI e pode mudar. Confira os números atuais em [jina.ai](https://jina.ai) — e deixe a própria barreira da ferramenta decidir:

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 Modelos — todos os 30

`GET https://api.jina.ai/v1/models` é público e retornou **30 ids**, incluindo:

| ID do modelo | Superfície | Verificado |
| --- | --- | --- |
| `jina-ai/jina-embeddings-v4` | `POST /v1/embeddings` | **200** (tokens=3) |
| `jina-ai/jina-reranker-v2-base-multilingual` | `POST /v1/rerank` | **200** (tokens=17) |
| `jina-ai/jina-reranker-v3`, `jina-ai/jina-reranker-v3.5` | linha rerank | catálogo |
| `jina-ai/jina-ocr-v1`, `jina-ai/ReaderLM-v2` | OCR / reader | catálogo |
| `jina-ai/jina-clip-v2`, linhas colbert / code-embeddings | família embeddings | catálogo |
> ⚠️ **Pegadinha na chamada:** `GET /v1/models` lista os ids com o prefixo de proprietário `jina-ai/`, mas as chamadas da API aceitam o **id curto** — `{"model":"jina-embeddings-v4"}` responde 200, o prefixado `jina-ai/jina-embeddings-v4` responde **422** (medido em 2026-10-19).

```bash
curl https://api.jina.ai/v1/embeddings \
  -H "Authorization: Bearer jina_…" -H "Content-Type: application/json" \
  -d '{"model":"jina-ai/jina-embeddings-v4","input":["ping"]}'
```

## 🧪 Como usar a API

URL base **`https://api.jina.ai/v1`**.

```python
import requests
r = requests.post("https://api.jina.ai/v1/embeddings",
  headers={"Authorization": "Bearer jina_…"},
  json={"model": "jina-ai/jina-embeddings-v4", "input": ["ping"]})
print(r.status_code, r.json()["usage"])
```

Superfícies complementares sem chave: `r.jina.ai` (reader, 20 RPM) e `s.jina.ai` (search).

## 🛠 Início rápido

```bash
cd jina-bulk-apikey
printf 'socks5://host:port\n' > proxies.txt
node src/launcher.js        # interactive: mint / verify / screen / settings
# or directly — one Turnstile token per key (see the note below):
node src/cli.js --count 5 --token "<cf-turnstile-response from jina.ai/reader>"
# or wire a solver:  node src/cli.js --count 5 --token-cmd "your-solver-command"
```

O endpoint de teste está atrás de um Cloudflare Turnstile gerenciado, então a CLI precisa de um token novo por chave: abra <https://jina.ai/reader>, pressione **GET YOUR API KEY** e copie o valor de `cf-turnstile-response` do input oculto (DevTools → Elements), ou aponte `--token-cmd` para um solver que imprima um token no stdout. `keys.txt` só é escrito após um 200 ao vivo de embeddings/rerank; `accounts.json` guarda o user_id + o snapshot da carteira.

### 🖱️ O launcher

O launcher pede a lista de proxies e a contagem, memoriza-os e executa a CLI — mint, verify, screen exits, settings, help, Connect to 9Router.

## ✅ Verificado e funcionando — toda chave é testada

| Verificação | Resultado |
| --- | --- |
| `POST keygen.jina.ai/trial` (token Turnstile) | **200** `{"api_key":"jina_…"}` — fluxo no navegador, de primeira após um refresh |
| `POST keygen.jina.ai/empty` (escada 429) | **200** — uma chave de 0 tokens ainda é emitida |
| `POST /v1/embeddings` (`jina-embeddings-v4`, id curto) — para **toda** chave antes de ser escrita | **200**, tokens contados |
| `POST /v1/rerank` (`jina-reranker-v2-base-multilingual`, id curto) | **200**, tokens contados |
| `jina-ai/jina-embeddings-v4` (id prefixado) | **422** — use o id curto (medido em 2026-10-19) |
| carteira | `trial_balance=10,000,000`, `trial_end` 2036, `email: null` |
| uma chave que falha na verificação | nunca é escrita — a conta permanece em `accounts.json` |

```bash
node src/cli.js --verify-only
node src/cli.js --screen
```

## 🧭 Como funciona

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Jina AI page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.jina.ai/v1/chat/completions → real content = the key is live
```

| Etapa | Chamada | Observações |
| --- | --- | --- |
| página | `jina.ai/reader` → "GET YOUR API KEY" | widget Turnstile gerenciado |
| chave | `POST https://keygen.jina.ai/trial` (multipart, `cf-turnstile-response`) | 200 → `api_key`; 429 → tente `/empty` |
| prova | `POST api.jina.ai/v1/embeddings` (+ rerank) | 200 com uso real = chave ativa |
| rotação | saída nova por chave | a cota de teste é por IP |

## ⚙️ Opções da CLI

```bash
node src/cli.js --count N        # mint N keys (screen exits, solve, verify)
node src/cli.js --verify-only    # re-verify every key in keys.txt
node src/cli.js --screen         # exit pool self-test
node src/cli.js --connect-9router
node src/cli.js --help
```

| Env | Padrão | Significado |
| --- | --- | --- |
| `JINA_PROXIES` | `proxies.txt` | pool de saídas, uma linha por proxy |
| `JINA_MODEL` | `jina-ai/jina-embeddings-v4` | modelo para a verificação ao vivo |

## 🛰️ Atrás de um proxy

**Obrigatório — as chaves são emitidas por IP.** Uma saída nova por chave é o mecanismo de escala (a cota de teste é por IP); a ferramenta testa o pool contra `keygen.jina.ai` e `api.jina.ai` antes de uma execução.

## 📄 Arquivos

| Caminho | Conteúdo |
| --- | --- |
| `keys.txt` | uma chave verificada ao vivo por linha — ignorada pelo git |
| `accounts.json` | user_id / snapshot da carteira / id da chave |
| `proxies.txt` | suas saídas — ignorado pelo git |
| `outputs/` | logs de execução — ignorados pelo git |

## 🔌 Conectar ao 9Router

[9Router](https://9router.com) é um roteador auto-hospedado e compatível com OpenAI:

```bash
node src/connect-9router.js --base http://localhost:20128 --password 123456
```

Padrões: `--prefix jina`, `--base-url https://api.jina.ai/v1`, `--model jina-ai/jina-embeddings-v4`. Os modelos são servidos como `jina/<model id>`.

## 🔑 O que uma chave oferece

| | |
| --- | --- |
| 🏢 Provedor | **Jina AI** — [jina.ai](https://jina.ai) |
| 🎁 O que o provedor oferece | chaves de teste anônimas, 10M tokens de teste, sem cadastro |
| 🔑 O que uma chave oferece | 500 RPM em embeddings/rerank (2M TPM), 30 ids de catálogo em `https://api.jina.ai/v1` |
| 🌐 Formato da API | `POST https://api.jina.ai/v1/embeddings` · `POST /v1/rerank` |
| 🔒 Seus dados | apenas `jina.ai` / `keygen.jina.ai` / `api.jina.ai` são contatados |

## 🐞 Problemas

Se a Jina mudar os endpoints do keygen, a sitekey do Turnstile ou a política de teste, a ferramenta para ali e avisa. **[Abra uma issue](../../issues)** com o comando e a saída exata.

## 📄 Licença

MIT © 2026 — veja [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 jina-bulk-apikey contributors

</div>