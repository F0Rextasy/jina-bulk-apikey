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

**Массовый выпуск пробных API-ключей Jina AI — для эмбеддингов, реранкера и ридера — с коннектором для 9Router.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-30%20served-412991?style=for-the-badge)](https://jina.ai/embeddings)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Быстрый старт](#-quick-start) · [🎁 Бесплатный тариф](#-free-tier--how-much-you-get) · [🤖 Модели](#-models--all-30-of-them) · [🧪 Использование API](#-how-to-use-the-api) · [✅ Проверено](#-verified-working--every-key-is-tested) · [🧭 Как это работает](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Опции](#️-cli-options) · [🛰️ Прокси](#️-behind-a-proxy) · [🐞 Проблемы](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Зачем это нужно

Jina AI выдаёт **пробные API-ключи вообще без аккаунта**: страница ридера запускает управляемый Turnstile, и `POST keygen.jina.ai/trial` возвращает `{"api_key":"jina_…"}` (когда квота проб на IP отвечает 429, `POST keygen.jina.ai/empty` всё равно выпускает ключ с 0 токенов). Каждый ключ несёт **пробный баланс в 10 000 000 токенов** (trial_end 2036) на анонимном аккаунте `auto_<uuid>`, и как эмбеддинги, так и реранк отвечают 200 с подсчётом токенов. Один ключ на один выход — именно эту единицу инструмент и пакетирует.

## 🎁 Бесплатный тариф — сколько вы получаете

| Что | Значение |
| --- | --- |
| Аккаунт | нет — анонимный `auto_<uuid>` на каждый ключ (`email: null`) |
| Пробный баланс | **10 000 000 токенов** на ключ (кошелёк `trial_balance`, trial_end 2036-10-19) |
| Защита | управляемый Cloudflare Turnstile на `keygen.jina.ai/trial` (свежий токен на каждый запуск) |
| Лестница 429 | исчерпана квота проб на IP → `POST keygen.jina.ai/empty` всё равно выдаёт ключ (0 пробных токенов) |
| Лимиты | без ключа: 20 RPM; бесплатный ключ: **500 RPM** (embed/rerank; 2M TPM на ключ) |
| Управление ключами | `api.jina.ai/api/v1/api_key` (отзыв) с заголовком `cf-turnstile-response` |

> 💡 Бесплатный тариф устанавливает Jina AI, и он может измениться. Проверяйте актуальные цифры на [jina.ai](https://jina.ai) — и пусть решение принимает собственный гейт инструмента:

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 Модели — все 30

`GET https://api.jina.ai/v1/models` публичен и вернул **30 идентификаторов**, включая:

| ID модели | Поверхность | Проверено |
| --- | --- | --- |
| `jina-ai/jina-embeddings-v4` | `POST /v1/embeddings` | **200** (tokens=3) |
| `jina-ai/jina-reranker-v2-base-multilingual` | `POST /v1/rerank` | **200** (tokens=17) |
| `jina-ai/jina-reranker-v3`, `jina-ai/jina-reranker-v3.5` | линейка rerank | каталог |
| `jina-ai/jina-ocr-v1`, `jina-ai/ReaderLM-v2` | OCR / ридер | каталог |
| `jina-ai/jina-clip-v2`, линейки colbert / code-embeddings | семейство эмбеддингов | каталог |
> ⚠️ **Подвох при вызове:** `GET /v1/models` перечисляет id с префиксом владельца `jina-ai/`, но вызовы API принимают **короткий id** — `{"model":"jina-embeddings-v4"}` отвечает 200, а с префиксом `jina-ai/jina-embeddings-v4` отвечает **422** (измерено 2026-10-19).

```bash
curl https://api.jina.ai/v1/embeddings \
  -H "Authorization: Bearer jina_…" -H "Content-Type: application/json" \
  -d '{"model":"jina-ai/jina-embeddings-v4","input":["ping"]}'
```

## 🧪 Как использовать API

Базовый URL — **`https://api.jina.ai/v1`**.

```python
import requests
r = requests.post("https://api.jina.ai/v1/embeddings",
  headers={"Authorization": "Bearer jina_…"},
  json={"model": "jina-ai/jina-embeddings-v4", "input": ["ping"]})
print(r.status_code, r.json()["usage"])
```

Сопутствующие поверхности без ключа: `r.jina.ai` (ридер, 20 RPM) и `s.jina.ai` (поиск).

## 🛠 Быстрый старт

```bash
cd jina-bulk-apikey
printf 'socks5://host:port\n' > proxies.txt   # optional — without it the tool runs direct
node src/launcher.js        # interactive: mint / verify / screen / settings

# or directly — one Turnstile token per key (see the note below):
node src/cli.js --count 5 --token "<cf-turnstile-response from jina.ai/reader>"
# or wire a solver:  node src/cli.js --count 5 --token-cmd "your-solver-command"
```

Пробная конечная точка защищена управляемым Cloudflare Turnstile, поэтому CLI требует один свежий токен на каждый ключ: откройте <https://jina.ai/reader>, нажмите **GET YOUR API KEY** и скопируйте значение `cf-turnstile-response` из скрытого поля (DevTools → Elements), либо укажите в `--token-cmd` решатель, который печатает токен в stdout. `keys.txt` записывается только после живого ответа 200 от embeddings/rerank; `accounts.json` хранит user_id + снимок кошелька.

### 🖱️ Лаунчер

Лаунчер запрашивает список прокси и количество, запоминает их и запускает CLI — выпуск, проверка, отбор выходов, настройки, справка, подключение к 9Router.

## ✅ Проверено в работе — каждый ключ тестируется

| Проверка | Результат |
| --- | --- |
| `POST keygen.jina.ai/trial` (токен Turnstile) | **200** `{"api_key":"jina_…"}` — браузерный поток, с первой попытки после одного обновления |
| `POST keygen.jina.ai/empty` (лестница 429) | **200** — ключ с 0 токенов всё равно выдаётся |
| `POST /v1/embeddings` (`jina-embeddings-v4`, короткий id) — для **каждого** ключа перед записью | **200**, токены подсчитаны |
| `POST /v1/rerank` (`jina-reranker-v2-base-multilingual`, короткий id) | **200**, токены подсчитаны |
| `jina-ai/jina-embeddings-v4` (id с префиксом) | **422** — используйте короткий id (измерено 2026-10-19) |
| кошелёк | `trial_balance=10,000,000`, `trial_end` 2036, `email: null` |
| ключ, не прошедший проверку | никогда не записывается — аккаунт остаётся в `accounts.json` |

```bash
node src/cli.js --verify-only
node src/cli.js --screen
```

## 🧭 Как это работает

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Jina AI page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.jina.ai/v1/chat/completions → real content = the key is live
```

| Шаг | Вызов | Примечания |
| --- | --- | --- |
| страница | `jina.ai/reader` → "GET YOUR API KEY" | управляемый виджет Turnstile |
| ключ | `POST https://keygen.jina.ai/trial` (multipart, `cf-turnstile-response`) | 200 → `api_key`; 429 → попробуйте `/empty` |
| доказательство | `POST api.jina.ai/v1/embeddings` (+ rerank) | 200 с реальным usage = ключ живой |
| ротация | свежий выход на каждый ключ | квота проб считается на IP |

## ⚙️ Опции CLI

```bash
node src/cli.js --count N        # mint N keys (screen exits, solve, verify)
node src/cli.js --verify-only    # re-verify every key in keys.txt
node src/cli.js --screen         # exit pool self-test
node src/cli.js --connect-9router
node src/cli.js --help
```

| Переменная | По умолчанию | Значение |
| --- | --- | --- |
| `JINA_PROXIES` | `proxies.txt` | пул выходов, по одной строке на прокси |
| `JINA_MODEL` | `jina-ai/jina-embeddings-v4` | модель для живой проверки |

## 🛰️ За прокси

**Необязательно — рекомендуется при масштабе (лимиты на IP, блокировки).** Инструмент работает и без прокси.

- **С пулом:** передайте `--pool <file>` (или задайте `JINA_PROXIES`), и каждый запрос идёт через выход из этого списка — мёртвая строка проваливает эту попытку, и инструмент переходит к следующей (fail-closed, пока пул задан; пул перепроверяется при использовании).
- **Без пула:** CLI печатает `running WITHOUT a proxy (direct)` и подключается напрямую. В регистрации, проверке, выпуске ключей или верификации ничего не меняется — только то, откуда уходят пакеты.
- Запустите `--screen` в любом из режимов: он тестирует имеющиеся выходы (или прямой маршрут) против провайдера перед реальным запуском.

## 📄 Файлы

| Путь | Содержимое |
| --- | --- |
| `keys.txt` | по одному проверенному в работе ключу на строку — игнорируется git |
| `accounts.json` | user_id / снимок кошелька / id ключа |
| `proxies.txt` | ваши выходы — игнорируется git |
| `outputs/` | логи запусков — игнорируется git |

## 🔌 Подключение к 9Router

[9Router](https://9router.com) — это самостоятельно размещаемый роутер, совместимый с OpenAI:

```bash
node src/connect-9router.js --base http://localhost:20128 --password 123456
```

По умолчанию: `--prefix jina`, `--base-url https://api.jina.ai/v1`, `--model jina-ai/jina-embeddings-v4`. Модели подаются как `jina/<model id>`.

## 🔑 Что даёт один ключ

| | |
| --- | --- |
| 🏢 Провайдер | **Jina AI** — [jina.ai](https://jina.ai) |
| 🎁 Что даёт провайдер | анонимные пробные ключи, 10M пробных токенов, без регистрации |
| 🔑 Что даёт один ключ | 500 RPM на embeddings/rerank (2M TPM), 30 идентификаторов каталога на `https://api.jina.ai/v1` |
| 🌐 Форма API | `POST https://api.jina.ai/v1/embeddings` · `POST /v1/rerank` |
| 🔒 Ваши данные | контакт только с `jina.ai` / `keygen.jina.ai` / `api.jina.ai` |

## 🐞 Проблемы

Если Jina изменит конечные точки keygen, sitekey Turnstile или политику проб, инструмент остановится на этом месте и сообщит об этом. **[Откройте issue](../../issues)**, указав команду и точный вывод.

## 📄 Лицензия

MIT © 2026 — см. [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 jina-bulk-apikey contributors

</div>