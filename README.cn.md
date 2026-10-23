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

**批量签发 Jina AI 试用 API 密钥 —— 涵盖 embeddings、reranker 和 reader 接口 —— 并附带 9Router 连接器。**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-30%20served-412991?style=for-the-badge)](https://jina.ai/embeddings)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![OmniRoute](https://img.shields.io/badge/OmniRoute-connector-8B5CF6?style=for-the-badge)](#-connect-to-omniroute)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 快速开始](#-quick-start) · [🎁 免费额度](#-free-tier--how-much-you-get) · [🤖 模型](#-models--all-30-of-them) · [🧪 使用 API](#-how-to-use-the-api) · [✅ 已验证](#-verified-working--every-key-is-tested) · [🧭 工作原理](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [🔌 OmniRoute](#-connect-to-omniroute) · [⚙️ 选项](#️-cli-options) · [🛰️ 代理](#️-behind-a-proxy) · [🐞 问题反馈](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ 为什么会有这个项目

Jina AI **无需任何账户**即可发放**试用 API 密钥**：reader 页面运行一个托管式 Turnstile，`POST keygen.jina.ai/trial` 返回 `{"api_key":"jina_…"}`（当每 IP 试用配额返回 429 时，`POST keygen.jina.ai/empty` 仍会签发一个 0 token 的密钥）。每个密钥在匿名 `auto_<uuid>` 账户上带有 **10,000,000 token 试用余额**（trial_end 2036），且 embeddings 和 rerank 均返回 200 并附带 token 计数。每个出口一个密钥 —— 这就是本工具批量处理的单位。

## 🎁 免费额度 —— 你能获得多少

| 项目 | 值 |
| --- | --- |
| 账户 | 无 —— 每个密钥对应匿名 `auto_<uuid>`（`email: null`） |
| 试用余额 | 每个密钥 **10,000,000 token**（钱包 `trial_balance`，trial_end 2036-10-19） |
| 关卡 | `keygen.jina.ai/trial` 上的托管式 Cloudflare Turnstile（每次运行使用全新 token） |
| 429 阶梯 | 触发每 IP 试用配额 → `POST keygen.jina.ai/empty` 仍会签发密钥（0 试用 token） |
| 速率限制 | 无密钥：20 RPM；免费密钥：**500 RPM**（embed/rerank；每密钥 2M TPM） |
| 密钥管理 | `api.jina.ai/api/v1/api_key`（吊销），需带 `cf-turnstile-response` 请求头 |

> 💡 免费额度由 Jina AI 设定，可能发生变化。请在 [jina.ai](https://jina.ai) 查看实时数据 —— 并让工具自身的关卡来做判断：

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 模型 —— 全部 30 个

`GET https://api.jina.ai/v1/models` 是公开的，返回了 **30 个 id**，包括：

| 模型 ID | 接口 | 已验证 |
| --- | --- | --- |
| `jina-ai/jina-embeddings-v4` | `POST /v1/embeddings` | **200**（tokens=3） |
| `jina-ai/jina-reranker-v2-base-multilingual` | `POST /v1/rerank` | **200**（tokens=17） |
| `jina-ai/jina-reranker-v3`, `jina-ai/jina-reranker-v3.5` | rerank 系列 | 目录 |
| `jina-ai/jina-ocr-v1`, `jina-ai/ReaderLM-v2` | OCR / reader | 目录 |
| `jina-ai/jina-clip-v2`, colbert / code-embeddings 系列 | embeddings 家族 | 目录 |
> ⚠️ **调用陷阱：** `GET /v1/models` 列出的 id 带有 `jina-ai/` 所有者前缀，但 API 调用使用**短 id** —— `{"model":"jina-embeddings-v4"}` 返回 200，而带前缀的 `jina-ai/jina-embeddings-v4` 返回 **422**（实测于 2026-10-19）。

```bash
curl https://api.jina.ai/v1/embeddings \
  -H "Authorization: Bearer jina_…" -H "Content-Type: application/json" \
  -d '{"model":"jina-ai/jina-embeddings-v4","input":["ping"]}'
```

## 🧪 如何使用 API

基础 URL **`https://api.jina.ai/v1`**。

```python
import requests
r = requests.post("https://api.jina.ai/v1/embeddings",
  headers={"Authorization": "Bearer jina_…"},
  json={"model": "jina-ai/jina-embeddings-v4", "input": ["ping"]})
print(r.status_code, r.json()["usage"])
```

无需密钥的配套接口：`r.jina.ai`（reader，20 RPM）和 `s.jina.ai`（search）。

## 🛠 快速开始

```bash
cd jina-bulk-apikey
printf 'socks5://host:port\n' > proxies.txt   # optional — without it the tool runs direct
node src/launcher.js        # interactive: mint / verify / screen / settings

# or directly — one Turnstile token per key (see the note below):
node src/cli.js --count 5 --token "<cf-turnstile-response from jina.ai/reader>"
# or wire a solver:  node src/cli.js --count 5 --token-cmd "your-solver-command"
```

试用端点位于托管式 Cloudflare Turnstile 之后，因此 CLI 每个密钥需要一个全新 token：打开 <https://jina.ai/reader>，点击 **GET YOUR API KEY**，然后从隐藏输入框中复制 `cf-turnstile-response` 值（DevTools → Elements），或者将 `--token-cmd` 指向一个在 stdout 打印 token 的求解器。只有在实时 embeddings/rerank 返回 200 之后才会写入 `keys.txt`；`accounts.json` 保存 user_id + 钱包快照。

### 🖱️ 启动器

启动器会询问代理列表和数量，记住它们，然后运行 CLI —— 签发、验证、筛选出口、设置、帮助、连接到 9Router。

## 🚀 一条命令

验证码会为你自动解决 —— 一条命令即可签发 N 个账户，并只保留通过实时 chat 调用验证的密钥：

```bash
npm install                  # once: pulls puppeteer-core
npm start                    # menu → "1) Mint keys" → "How many keys?" (Enter = 10)
# or non-interactive:
node src/cli.js --count N
```

`--auto` 是默认值，无需传入任何参数：内嵌的 `src/solver.js` 会通过账户自身的出口打开一个有界面的 Chrome，并自动返回面板的 Turnstile token。`--dry` 会打印解析后的计划并退出，**不写入任何文件，也不发起任何网络调用**。

> ⚠️ **条款与账户风险。** 这是一个自动化工具，不是账户供应商。批量注册和密钥签发完全由你自行负责：它们可能违反提供商的服务条款，并可能导致地址、出口或账户被封禁。请仅在你被允许自动化的基础设施上使用它，并保持较低的请求速率。

## 🔧 高级（可选）

接入你自己的求解器、手动粘贴 token，或将工具指向特定的 Chrome，均记录在 **[ADVANCED.md](ADVANCED.md)** 中。常规使用路径完全不需要这些。

## ✅ 已验证可用 —— 每个密钥都经过测试

| 检查 | 结果 |
| --- | --- |
| `POST keygen.jina.ai/trial`（Turnstile token） | **200** `{"api_key":"jina_…"}` —— 浏览器流程，刷新一次后首次尝试即成功 |
| `POST keygen.jina.ai/empty`（429 阶梯） | **200** —— 0 token 密钥仍会签发 |
| `POST /v1/embeddings`（`jina-embeddings-v4`，短 id）—— 对**每个**密钥在写入前执行 | **200**，已统计 token |
| `POST /v1/rerank`（`jina-reranker-v2-base-multilingual`，短 id） | **200**，已统计 token |
| `jina-ai/jina-embeddings-v4`（带前缀 id） | **422** —— 请使用短 id（实测于 2026-10-19） |
| 钱包 | `trial_balance=10,000,000`，`trial_end` 2036，`email: null` |
| 未通过检查的密钥 | 永不写入 —— 账户保留在 `accounts.json` 中 |

```bash
node src/cli.js --verify-only
node src/cli.js --screen
```

> **质量关卡。** 这里的每个密钥在写入 `keys.txt` 之前都通过了实时 `chat-200`
> （绝不交付失效密钥）。路由组合在模型层面遵循同样的规则：只有**当模型返回 `chat-200` 且能调用工具**时才会添加条目 —— 不支持工具的模型、
> 失效的密钥或失效的提供商会直接丢弃而非添加。可随时重新运行验证步骤；
> 失败会被报告，绝不隐藏。

## 🧭 工作原理

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Jina AI page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.jina.ai/v1/chat/completions → real content = the key is live
```

| 步骤 | 调用 | 备注 |
| --- | --- | --- |
| 页面 | `jina.ai/reader` → "GET YOUR API KEY" | 托管式 Turnstile 组件 |
| 密钥 | `POST https://keygen.jina.ai/trial`（multipart，`cf-turnstile-response`） | 200 → `api_key`；429 → 尝试 `/empty` |
| 验证 | `POST api.jina.ai/v1/embeddings`（+ rerank） | 200 且带真实用量 = 密钥已验证 |
| 轮换 | 每个密钥使用全新出口 | 试用配额按 IP 计算 |

## ⚙️ CLI 选项

```bash
node src/cli.js --count N        # mint N keys (screen exits, solve, verify)
node src/cli.js --verify-only    # re-verify every key in keys.txt
node src/cli.js --screen         # exit pool self-test
node src/cli.js --connect-9router
node src/cli.js --help
```

| 环境变量 | 默认值 | 含义 |
| --- | --- | --- |
| `JINA_PROXIES` | `proxies.txt` | 可选出口池，每行一个代理 |
| `JINA_MODEL` | `jina-ai/jina-embeddings-v4` | 用于实时验证的模型 |

## 🛰️ 在代理之后

**可选 —— 大规模使用时推荐（每 IP 限制、封禁）。** 本工具在没有代理的情况下也能工作。

- **有代理池时：** 传入 `--pool <file>`（或设置 `JINA_PROXIES`），每个请求都会经过该列表中的一个出口 —— 失效线路会使该次尝试失败，工具会转向下一个（提供代理池时采用故障关闭策略；代理池在使用时会重新探测）。
- **无代理池时：** CLI 会打印 `running WITHOUT a proxy (direct)` 并直接连接。注册、签到、密钥签发或验证都不会有任何变化 —— 只是数据包的发出位置不同。
- 对任一模式运行 `--screen`：它会在真实运行前，用你现有的出口（或直连路由）对提供商进行测试。

## 📄 文件

| 路径 | 内容 |
| --- | --- |
| `keys.txt` | 每行一个经过实时验证的密钥 —— 已被 git 忽略 |
| `accounts.json` | user_id / 钱包快照 / 密钥 id |
| `proxies.txt` | 你的出口 —— 已被 git 忽略 |
| `outputs/` | 运行日志 —— 已被 git 忽略 |

## 🔌 连接到 9Router

[9Router](https://9router.com) 是一个自托管、兼容 OpenAI 的路由器：

```bash
node src/connect-9router.js --base http://localhost:20128 --password 123456
```

默认值：`--prefix jina`、`--base-url https://api.jina.ai/v1`、`--model jina-ai/jina-embeddings-v4`。模型以 `jina/<model id>` 形式提供。

## 🔌 连接到 OmniRoute

[OmniRoute](https://omniroute.online) 是一个自托管、兼容 OpenAI 的路由器：

```bash
node src/connect-omniroute.js --base http://localhost:20128 --password 123456
```

默认值：`--prefix jina`、`--base-url https://api.jina.ai/v1`、`--model jina-ai/jina-embeddings-v4`。模型以 `jina/<model id>` 形式提供。

## 🔑 一个密钥能带给你什么

| | |
| --- | --- |
| 🏢 提供商 | **Jina AI** —— [jina.ai](https://jina.ai) |
| 🎁 提供商提供的内容 | 匿名试用密钥，10M 试用 token，无需注册 |
| 🔑 一个密钥能带给你什么 | embeddings/rerank 500 RPM（2M TPM），`https://api.jina.ai/v1` 上 30 个目录 id |
| 🌐 API 形态 | `POST https://api.jina.ai/v1/embeddings` · `POST /v1/rerank` |
| 🔒 你的数据 | 仅会联系 `jina.ai` / `keygen.jina.ai` / `api.jina.ai` |

## 🐞 问题反馈

如果 Jina 更改了 keygen 端点、Turnstile sitekey 或试用政策，工具会在此处停止并说明原因。请附上命令和确切输出 **[提交 issue](../../issues)**。

## 📄 许可证

MIT © 2026 —— 参见 [LICENSE](LICENSE)。

<div align="center">

**[MIT](LICENSE)** © 2026 jina-bulk-apikey contributors

</div>