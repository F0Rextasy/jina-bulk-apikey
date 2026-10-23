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

**Jina AI 체험판 API 키 대량 발급 — 임베딩, 리랭커, 리더 표면 — 9Router 커넥터 포함.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-30%20served-412991?style=for-the-badge)](https://jina.ai/embeddings)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![OmniRoute](https://img.shields.io/badge/OmniRoute-connector-8B5CF6?style=for-the-badge)](#-connect-to-omniroute)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 빠른 시작](#-quick-start) · [🎁 무료 티어](#-free-tier--how-much-you-get) · [🤖 모델](#-models--all-30-of-them) · [🧪 API 사용법](#-how-to-use-the-api) · [✅ 검증됨](#-verified-working--every-key-is-tested) · [🧭 작동 방식](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [🔌 OmniRoute](#-connect-to-omniroute) · [⚙️ 옵션](#️-cli-options) · [🛰️ 프록시](#️-behind-a-proxy) · [🐞 이슈](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ 이 도구가 존재하는 이유

Jina AI는 **계정 없이도 체험판 API 키를 발급**합니다: 리더 페이지가 관리형 Turnstile을 실행하고 `POST keygen.jina.ai/trial`이 `{"api_key":"jina_…"}`를 반환합니다 (IP당 체험판 할당량이 429로 응답할 때도 `POST keygen.jina.ai/empty`는 여전히 0토큰 키를 발급합니다). 모든 키는 익명 `auto_<uuid>` 계정에 **10,000,000토큰 체험판 잔액**(trial_end 2036)을 가지며, 임베딩과 리랭크 모두 토큰 수와 함께 200으로 응답합니다. 출구당 키 하나 — 이것이 이 도구가 배치로 처리하는 단위입니다.

## 🎁 무료 티어 — 얼마나 받을 수 있나

| 항목 | 값 |
| --- | --- |
| 계정 | 없음 — 키당 익명 `auto_<uuid>` (`email: null`) |
| 체험판 잔액 | 키당 **10,000,000 토큰** (지갑 `trial_balance`, trial_end 2036-10-19) |
| 게이트 | `keygen.jina.ai/trial`의 관리형 Cloudflare Turnstile (실행마다 새 토큰) |
| 429 사다리 | IP당 체험판 할당량 도달 → `POST keygen.jina.ai/empty`가 여전히 키 발급 (0 체험판 토큰) |
| 속도 제한 | 키 없음: 20 RPM; 무료 키: **500 RPM** (embed/rerank; 키당 2M TPM) |
| 키 관리 | `api.jina.ai/api/v1/api_key` (폐기) — `cf-turnstile-response` 헤더 사용 |

> 💡 무료 티어는 Jina AI가 정하며 변경될 수 있습니다. 실시간 수치는 [jina.ai](https://jina.ai)에서 확인하세요 — 그리고 도구 자체의 게이트가 판단하게 하세요:

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 모델 — 30개 전부

`GET https://api.jina.ai/v1/models`는 공개되어 있으며 **30개의 id**를 반환했습니다, 그중:

| 모델 ID | 표면 | 검증됨 |
| --- | --- | --- |
| `jina-ai/jina-embeddings-v4` | `POST /v1/embeddings` | **200** (tokens=3) |
| `jina-ai/jina-reranker-v2-base-multilingual` | `POST /v1/rerank` | **200** (tokens=17) |
| `jina-ai/jina-reranker-v3`, `jina-ai/jina-reranker-v3.5` | rerank 라인 | 카탈로그 |
| `jina-ai/jina-ocr-v1`, `jina-ai/ReaderLM-v2` | OCR / 리더 | 카탈로그 |
| `jina-ai/jina-clip-v2`, colbert / code-embeddings 라인 | 임베딩 계열 | 카탈로그 |
> ⚠️ **호출 시 주의점:** `GET /v1/models`는 `jina-ai/` 소유자 접두사가 붙은 id를 나열하지만, API 호출은 **짧은 id**를 받습니다 — `{"model":"jina-embeddings-v4"}`는 200으로 응답하고, 접두사가 붙은 `jina-ai/jina-embeddings-v4`는 **422**로 응답합니다 (2026-10-19 측정).

```bash
curl https://api.jina.ai/v1/embeddings \
  -H "Authorization: Bearer jina_…" -H "Content-Type: application/json" \
  -d '{"model":"jina-ai/jina-embeddings-v4","input":["ping"]}'
```

## 🧪 API 사용법

기본 URL **`https://api.jina.ai/v1`**.

```python
import requests
r = requests.post("https://api.jina.ai/v1/embeddings",
  headers={"Authorization": "Bearer jina_…"},
  json={"model": "jina-ai/jina-embeddings-v4", "input": ["ping"]})
print(r.status_code, r.json()["usage"])
```

키가 필요 없는 동반 표면: `r.jina.ai` (리더, 20 RPM) 및 `s.jina.ai` (검색).

## 🛠 빠른 시작

```bash
cd jina-bulk-apikey
printf 'socks5://host:port\n' > proxies.txt   # optional — without it the tool runs direct
node src/launcher.js        # interactive: mint / verify / screen / settings

# or directly — one Turnstile token per key (see the note below):
node src/cli.js --count 5 --token "<cf-turnstile-response from jina.ai/reader>"
# or wire a solver:  node src/cli.js --count 5 --token-cmd "your-solver-command"
```

체험판 엔드포인트는 관리형 Cloudflare Turnstile 뒤에 있으므로, CLI는 키마다 새 토큰 하나가 필요합니다: <https://jina.ai/reader>를 열고 **GET YOUR API KEY**를 누른 뒤 숨겨진 입력(DevTools → Elements)에서 `cf-turnstile-response` 값을 복사하거나, `--token-cmd`를 stdout에 토큰을 출력하는 솔버로 지정하세요. `keys.txt`는 실시간 embeddings/rerank 200 이후에만 기록되며, `accounts.json`은 user_id + 지갑 스냅샷을 보관합니다.

### 🖱️ 런처

런처는 프록시 목록과 개수를 묻고, 이를 기억한 뒤 CLI를 실행합니다 — 발급, 검증, 출구 스크린, 설정, 도움말, 9Router 연결.

## 🚀 명령 하나로

캡차는 자동으로 해결됩니다 — 명령 하나로 N개의 계정을 발급하고, 실시간 chat 호출로 검증된 키만 보관합니다:

```bash
npm install                  # once: pulls puppeteer-core
npm start                    # menu → "1) Mint keys" → "How many keys?" (Enter = 10)
# or non-interactive:
node src/cli.js --count N
```

`--auto`가 기본값이며 아무것도 전달할 필요가 없습니다: 내장된 `src/solver.js`가 계정 자체의 출구를 통해 헤드리스가 아닌 Chrome을 열고 패널의 Turnstile 토큰을 자동으로 반환합니다. `--dry`는 결정된 계획을 출력하고 **파일 기록도 네트워크 호출도 없이** 종료합니다.

> ⚠️ **약관 및 계정 위험.** 이것은 자동화 도구이지 계정 판매자가 아닙니다. 대량 가입과 키 발급은 전적으로 귀하의 책임입니다: 제공자의 서비스 약관을 위반할 수 있으며 주소, 출구 또는 계정이 차단될 수 있습니다. 자동화가 허용된 인프라에서만 사용하고 요청 속도를 낮게 유지하세요.

## 🔧 고급 (선택 사항)

자체 솔버 연결, 토큰 수동 붙여넣기, 특정 Chrome 지정은 **[ADVANCED.md](ADVANCED.md)**에 문서화되어 있습니다. 일반적인 경로에는 이 중 어느 것도 필요하지 않습니다.

## ✅ 검증됨 — 모든 키가 테스트됩니다

| 검사 | 결과 |
| --- | --- |
| `POST keygen.jina.ai/trial` (Turnstile 토큰) | **200** `{"api_key":"jina_…"}` — 브라우저 흐름, 한 번 새로고침 후 첫 시도 성공 |
| `POST keygen.jina.ai/empty` (429 사다리) | **200** — 0토큰 키도 여전히 발급됨 |
| `POST /v1/embeddings` (`jina-embeddings-v4`, 짧은 id) — 기록되기 전 **모든** 키에 대해 | **200**, 토큰 집계됨 |
| `POST /v1/rerank` (`jina-reranker-v2-base-multilingual`, 짧은 id) | **200**, 토큰 집계됨 |
| `jina-ai/jina-embeddings-v4` (접두사 붙은 id) | **422** — 짧은 id를 사용하세요 (2026-10-19 측정) |
| 지갑 | `trial_balance=10,000,000`, `trial_end` 2036, `email: null` |
| 검사에 실패한 키 | 기록되지 않음 — 계정은 `accounts.json`에 남음 |

```bash
node src/cli.js --verify-only
node src/cli.js --screen
```

> **품질 게이트.** 여기의 모든 키는 `keys.txt`에 기록되기 전에 실시간 `chat-200`을 통과했습니다
> (죽은 키는 절대 배포되지 않습니다). 라우터 조합도 모델 수준에서 같은 규칙을 따릅니다: 항목은
> **모델이 `chat-200`으로 응답하고 도구를 호출할 수 있을 때만** 추가됩니다 — 도구 지원이 없는 모델,
> 죽은 키, 죽은 제공자는 추가되지 않고 제거됩니다. 검증 단계는 언제든 다시 실행하세요;
> 실패는 보고되며 절대 숨겨지지 않습니다.

## 🧭 작동 방식

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Jina AI page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.jina.ai/v1/chat/completions → real content = the key is live
```

| 단계 | 호출 | 비고 |
| --- | --- | --- |
| 페이지 | `jina.ai/reader` → "GET YOUR API KEY" | 관리형 Turnstile 위젯 |
| 키 | `POST https://keygen.jina.ai/trial` (multipart, `cf-turnstile-response`) | 200 → `api_key`; 429 → `/empty` 시도 |
| 증명 | `POST api.jina.ai/v1/embeddings` (+ rerank) | 실제 usage와 함께 200 = 키 검증됨 |
| 교체 | 키마다 새 출구 | 체험판 할당량은 IP당 |

## ⚙️ CLI 옵션

```bash
node src/cli.js --count N        # mint N keys (screen exits, solve, verify)
node src/cli.js --verify-only    # re-verify every key in keys.txt
node src/cli.js --screen         # exit pool self-test
node src/cli.js --connect-9router
node src/cli.js --help
```

| 환경 변수 | 기본값 | 의미 |
| --- | --- | --- |
| `JINA_PROXIES` | `proxies.txt` | 선택적 출구 풀, 프록시당 한 줄 |
| `JINA_MODEL` | `jina-ai/jina-embeddings-v4` | 실시간 검증에 사용할 모델 |

## 🛰️ 프록시 뒤에서

**선택 사항 — 대규모에서는 권장 (IP당 제한, 차단).** 이 도구는 프록시 없이도 작동합니다.

- **풀이 있을 때:** `--pool <file>`을 전달하거나 `JINA_PROXIES`를 설정하면 모든 요청이 해당 목록의 출구를 통해 나갑니다 — 죽은 회선은 해당 시도를 실패시키고 도구는 다음으로 넘어갑니다 (풀이 제공되면 fail-closed; 풀은 사용 시점에 다시 검사됩니다).
- **풀이 없을 때:** CLI는 `running WITHOUT a proxy (direct)`를 출력하고 직접 연결합니다. 가입, 체크인, 키 발급, 검증에 관해서는 아무것도 바뀌지 않습니다 — 패킷이 나가는 위치만 바뀝니다.
- 어느 모드에서든 `--screen`을 실행하세요: 실제 실행 전에 보유한 출구(또는 직접 경로)를 제공자에 대해 테스트합니다.

## 📄 파일

| 경로 | 내용 |
| --- | --- |
| `keys.txt` | 한 줄에 하나의 실시간 검증된 키 — git 무시됨 |
| `accounts.json` | user_id / 지갑 스냅샷 / 키 id |
| `proxies.txt` | 귀하의 출구 — git 무시됨 |
| `outputs/` | 실행 로그 — git 무시됨 |

## 🔌 9Router에 연결

[9Router](https://9router.com)는 자체 호스팅, OpenAI 호환 라우터입니다:

```bash
node src/connect-9router.js --base http://localhost:20128 --password 123456
```

기본값: `--prefix jina`, `--base-url https://api.jina.ai/v1`, `--model jina-ai/jina-embeddings-v4`. 모델은 `jina/<model id>`로 제공됩니다.

## 🔌 OmniRoute에 연결

[OmniRoute](https://omniroute.online)는 자체 호스팅, OpenAI 호환 라우터입니다:

```bash
node src/connect-omniroute.js --base http://localhost:20128 --password 123456
```

기본값: `--prefix jina`, `--base-url https://api.jina.ai/v1`, `--model jina-ai/jina-embeddings-v4`. 모델은 `jina/<model id>`로 제공됩니다.

## 🔑 키 하나로 얻는 것

| | |
| --- | --- |
| 🏢 제공자 | **Jina AI** — [jina.ai](https://jina.ai) |
| 🎁 제공자가 주는 것 | 익명 체험판 키, 10M 체험판 토큰, 가입 불필요 |
| 🔑 키 하나로 얻는 것 | embeddings/rerank에서 500 RPM (2M TPM), `https://api.jina.ai/v1`에서 30개 카탈로그 id |
| 🌐 API 형태 | `POST https://api.jina.ai/v1/embeddings` · `POST /v1/rerank` |
| 🔒 귀하의 데이터 | `jina.ai` / `keygen.jina.ai` / `api.jina.ai`만 접속됨 |

## 🐞 이슈

Jina가 keygen 엔드포인트, Turnstile 사이트키 또는 체험판 정책을 변경하면, 도구는 그 지점에서 멈추고 그 사실을 알립니다. 명령과 정확한 출력을 포함하여 **[이슈를 열어주세요](../../issues)**.

## 📄 라이선스

MIT © 2026 — [LICENSE](LICENSE) 참조.

<div align="center">

**[MIT](LICENSE)** © 2026 jina-bulk-apikey 기여자들

</div>