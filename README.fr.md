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

**Émission en masse de clés API d'essai Jina AI — surfaces embeddings, reranker et reader — avec un connecteur 9Router.**

[![Node](https://img.shields.io/badge/Node-%E2%89%A518-3DA639?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/license-MIT-6ea8fe?style=for-the-badge)](LICENSE)
[![Models](https://img.shields.io/badge/models-30%20served-412991?style=for-the-badge)](https://jina.ai/embeddings)
[![9Router](https://img.shields.io/badge/9Router-connector-8B5CF6?style=for-the-badge)](#-connect-to-9router)
[![X](https://img.shields.io/badge/X-%40bigbullapp-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/bigbullapp)

[🛠 Démarrage rapide](#-quick-start) · [🎁 Niveau gratuit](#-free-tier--how-much-you-get) · [🤖 Modèles](#-models--all-30-of-them) · [🧪 Utiliser l'API](#-how-to-use-the-api) · [✅ Vérifié](#-verified-working--every-key-is-tested) · [🧭 Comment ça marche](#-how-it-works) · [🔌 9Router](#-connect-to-9router) · [⚙️ Options](#️-cli-options) · [🛰️ Proxys](#️-behind-a-proxy) · [🐞 Problèmes](#-issues)

</div>

<div align="center">

**English** · [Türkçe](README.tr.md) · [中文](README.cn.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Русский](README.ru.md) · [Português](README.pt.md)

</div>

---

## ✨ Pourquoi cet outil existe

Jina AI distribue des **clés API d'essai sans aucun compte** : la page reader exécute un Turnstile géré et `POST keygen.jina.ai/trial` renvoie `{"api_key":"jina_…"}` (lorsque le quota d'essai par IP répond 429, `POST keygen.jina.ai/empty` génère quand même une clé à 0 token). Chaque clé porte un **solde d'essai de 10 000 000 de tokens** (trial_end 2036) sur un compte anonyme `auto_<uuid>`, et les surfaces embeddings comme rerank répondent 200 avec les décomptes de tokens. Une clé par sortie — c'est l'unité que cet outil traite par lots.

## 🎁 Niveau gratuit — ce que vous obtenez

| Élément | Valeur |
| --- | --- |
| Compte | aucun — `auto_<uuid>` anonyme par clé (`email: null`) |
| Solde d'essai | **10 000 000 de tokens** par clé (portefeuille `trial_balance`, trial_end 2036-10-19) |
| Barrière | Cloudflare Turnstile géré sur `keygen.jina.ai/trial` (token frais à chaque exécution) |
| Échelle 429 | quota d'essai par IP atteint → `POST keygen.jina.ai/empty` émet quand même une clé (0 token d'essai) |
| Limites de débit | sans clé : 20 RPM ; clé gratuite : **500 RPM** (embed/rerank ; 2M TPM par clé) |
| Gestion des clés | `api.jina.ai/api/v1/api_key` (révocation) avec un en-tête `cf-turnstile-response` |

> 💡 Le niveau gratuit est défini par Jina AI et peut changer. Consultez les chiffres en direct sur [jina.ai](https://jina.ai) — et laissez la barrière de l'outil décider :

```bash
node src/cli.js --verify-only     # every key in keys.txt is re-tested with a real chat call
```

## 🤖 Modèles — les 30 au complet

`GET https://api.jina.ai/v1/models` est public et a renvoyé **30 ids**, dont :

| ID de modèle | Surface | Vérifié |
| --- | --- | --- |
| `jina-ai/jina-embeddings-v4` | `POST /v1/embeddings` | **200** (tokens=3) |
| `jina-ai/jina-reranker-v2-base-multilingual` | `POST /v1/rerank` | **200** (tokens=17) |
| `jina-ai/jina-reranker-v3`, `jina-ai/jina-reranker-v3.5` | ligne rerank | catalogue |
| `jina-ai/jina-ocr-v1`, `jina-ai/ReaderLM-v2` | OCR / reader | catalogue |
| `jina-ai/jina-clip-v2`, lignes colbert / code-embeddings | famille embeddings | catalogue |
> ⚠️ **Piège d'appel :** `GET /v1/models` liste les ids avec le préfixe de propriétaire `jina-ai/`, mais les appels API prennent l'**id court** — `{"model":"jina-embeddings-v4"}` répond 200, le préfixé `jina-ai/jina-embeddings-v4` répond **422** (mesuré le 2026-10-19).

```bash
curl https://api.jina.ai/v1/embeddings \
  -H "Authorization: Bearer jina_…" -H "Content-Type: application/json" \
  -d '{"model":"jina-ai/jina-embeddings-v4","input":["ping"]}'
```

## 🧪 Comment utiliser l'API

URL de base **`https://api.jina.ai/v1`**.

```python
import requests
r = requests.post("https://api.jina.ai/v1/embeddings",
  headers={"Authorization": "Bearer jina_…"},
  json={"model": "jina-ai/jina-embeddings-v4", "input": ["ping"]})
print(r.status_code, r.json()["usage"])
```

Surfaces compagnes sans clé : `r.jina.ai` (reader, 20 RPM) et `s.jina.ai` (search).

## 🛠 Démarrage rapide

```bash
cd jina-bulk-apikey
printf 'socks5://host:port\n' > proxies.txt
node src/launcher.js        # interactive: mint / verify / screen / settings
# or directly — one Turnstile token per key (see the note below):
node src/cli.js --count 5 --token "<cf-turnstile-response from jina.ai/reader>"
# or wire a solver:  node src/cli.js --count 5 --token-cmd "your-solver-command"
```

Le point de terminaison d'essai est derrière un Cloudflare Turnstile géré, donc le CLI a besoin d'un token frais par clé : ouvrez <https://jina.ai/reader>, appuyez sur **GET YOUR API KEY**, et copiez la valeur `cf-turnstile-response` depuis le champ caché (DevTools → Elements), ou pointez `--token-cmd` vers un solveur qui affiche un token sur stdout. `keys.txt` n'est écrit qu'après un 200 réel en embeddings/rerank ; `accounts.json` conserve l'instantané user_id + portefeuille.

### 🖱️ Le launcher

Le launcher demande la liste de proxys et le nombre, les mémorise, et exécute le CLI — mint, verify, screen exits, settings, help, Connect to 9Router.

## ✅ Vérifié fonctionnel — chaque clé est testée

| Vérification | Résultat |
| --- | --- |
| `POST keygen.jina.ai/trial` (token Turnstile) | **200** `{"api_key":"jina_…"}` — flux navigateur, du premier coup après un rafraîchissement |
| `POST keygen.jina.ai/empty` (échelle 429) | **200** — une clé à 0 token est quand même émise |
| `POST /v1/embeddings` (`jina-embeddings-v4`, id court) — pour **chaque** clé avant écriture | **200**, tokens comptés |
| `POST /v1/rerank` (`jina-reranker-v2-base-multilingual`, id court) | **200**, tokens comptés |
| `jina-ai/jina-embeddings-v4` (id préfixé) | **422** — utilisez l'id court (mesuré le 2026-10-19) |
| portefeuille | `trial_balance=10,000,000`, `trial_end` 2036, `email: null` |
| une clé qui échoue à sa vérification | jamais écrite — le compte reste dans `accounts.json` |

```bash
node src/cli.js --verify-only
node src/cli.js --screen
```

## 🧭 Comment ça marche

```
inbox (one address per account)                                  a fresh address per account
   │
   ├─▶ sign-up: Jina AI page → e-mail address → code / link from the inbox
   ├─▶ session: the account's cookies or access token in hand
   ├─▶ key mint: the account's key endpoint → plaintext key returned once (written to disk immediately)
   └─▶ live proof: POST https://api.jina.ai/v1/chat/completions → real content = the key is live
```

| Étape | Appel | Remarques |
| --- | --- | --- |
| page | `jina.ai/reader` → « GET YOUR API KEY » | widget Turnstile géré |
| clé | `POST https://keygen.jina.ai/trial` (multipart, `cf-turnstile-response`) | 200 → `api_key` ; 429 → essayer `/empty` |
| preuve | `POST api.jina.ai/v1/embeddings` (+ rerank) | 200 avec un usage réel = clé active |
| rotation | sortie fraîche par clé | le quota d'essai est par IP |

## ⚙️ Options du CLI

```bash
node src/cli.js --count N        # mint N keys (screen exits, solve, verify)
node src/cli.js --verify-only    # re-verify every key in keys.txt
node src/cli.js --screen         # exit pool self-test
node src/cli.js --connect-9router
node src/cli.js --help
```

| Env | Défaut | Signification |
| --- | --- | --- |
| `JINA_PROXIES` | `proxies.txt` | pool de sorties, une ligne par proxy |
| `JINA_MODEL` | `jina-ai/jina-embeddings-v4` | modèle pour la vérification en direct |

## 🛰️ Derrière un proxy

**Requis — les clés sont émises par IP.** Une sortie fraîche par clé est le mécanisme de mise à l'échelle (le quota d'essai est par IP) ; l'outil filtre le pool contre `keygen.jina.ai` et `api.jina.ai` avant une exécution.

## 📄 Fichiers

| Chemin | Contenu |
| --- | --- |
| `keys.txt` | une clé vérifiée en direct par ligne — ignoré par git |
| `accounts.json` | instantané user_id / portefeuille / id de clé |
| `proxies.txt` | vos sorties — ignoré par git |
| `outputs/` | journaux d'exécution — ignorés par git |

## 🔌 Connexion à 9Router

[9Router](https://9router.com) est un routeur auto-hébergé compatible OpenAI :

```bash
node src/connect-9router.js --base http://localhost:20128 --password 123456
```

Valeurs par défaut : `--prefix jina`, `--base-url https://api.jina.ai/v1`, `--model jina-ai/jina-embeddings-v4`. Les modèles sont servis sous `jina/<model id>`.

## 🔑 Ce qu'une clé vous apporte

| | |
| --- | --- |
| 🏢 Fournisseur | **Jina AI** — [jina.ai](https://jina.ai) |
| 🎁 Ce que le fournisseur donne | clés d'essai anonymes, 10M tokens d'essai, sans inscription |
| 🔑 Ce qu'une clé vous apporte | 500 RPM sur embeddings/rerank (2M TPM), 30 ids au catalogue sur `https://api.jina.ai/v1` |
| 🌐 Forme de l'API | `POST https://api.jina.ai/v1/embeddings` · `POST /v1/rerank` |
| 🔒 Vos données | seuls `jina.ai` / `keygen.jina.ai` / `api.jina.ai` sont contactés |

## 🐞 Problèmes

Si Jina modifie les points de terminaison keygen, la sitekey Turnstile ou la politique d'essai, l'outil s'arrête là et le signale. **[Ouvrez un ticket](../../issues)** avec la commande et la sortie exacte.

## 📄 Licence

MIT © 2026 — voir [LICENSE](LICENSE).

<div align="center">

**[MIT](LICENSE)** © 2026 jina-bulk-apikey contributors

</div>