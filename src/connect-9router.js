#!/usr/bin/env node
'use strict';

/**
 * Connect Jina AI to a 9Router instance.
 *
 * Jina AI serves an OpenAI-compatible endpoint (https://api.jina.ai/v1), so a single
 * provider-node carries every key: this registers one `openai-compatible` node
 * with prefix `jina` and then one connection per API key, named
 * `jina-001`, `jina-002`, … Re-running it is idempotent (an existing node
 * or connection is reused), and 9Router load-balances across the keys of a node.
 *
 * Usage:
 *   node src/connect-9router.js \
 *     --base http://localhost:20128 --password 123456 \
 *     --api-key jina_…(65-char) [--name "Jina AI"] [--prefix jina]
 *
 *   node src/connect-9router.js                  # register every key in keys.txt
 *   node src/connect-9router.js --model <id>     # pin the connection's default model
 *
 * Options:
 *   --base <url>       9Router base URL         (default http://localhost:20128)
 *   --password <pw>    9Router login password   (default 123456)
 *   --api-key <key>    Jina AI API key     (default: every key in keys.txt)
 *   --name <name>      provider-node name       (default Jina AI)
 *   --prefix <slug>    provider prefix in 9Router (default jina)
 *   --base-url <url>   provider base URL        (default https://api.jina.ai/v1)
 *   --model <id>       connection default model (default MiniMaxAI/MiniMax-M2.7)
 *
 * Zero dependencies. Node.js >= 18.
 */

const fs = require('fs');
const path = require('path');

const UA = 'jina-bulk-9router-connector/1.0';

const DEFAULTS = {
  base: 'http://localhost:20128',
  password: '123456',
  name: "Jina AI",
  prefix: "jina",
  baseUrl: "https://api.jina.ai/v1",
  defaultModel: "jina-embeddings-v4",
};

/** Model ids a fresh key lists, as routed under `<prefix>/…` by 9Router. */
const MODELS = ["jina-embeddings-v4","jina-reranker-v2-base-multilingual","jina-reranker-v3","jina-embeddings-v3","jina-clip-v2"];

async function login9router(base, password) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ password: password ?? DEFAULTS.password }),
  });
  const sc = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const cookie = sc.map((c) => c.split(';')[0]).join('; ');
  return { ok: res.ok, cookie, body: (await res.text()).slice(0, 200) };
}

async function api(base, cookie, route, init = {}) {
  const res = await fetch(`${base}${route}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* a non-JSON answer is reported as text */
  }
  return { status: res.status, ok: res.ok, json, text: text.slice(0, 400) };
}

async function ensureNode(base, cookie, { name, prefix, baseUrl }) {
  const list = await api(base, cookie, '/api/provider-nodes');
  const nodes = (list.json && list.json.nodes) || [];
  const existing = nodes.find((n) => n.prefix === prefix || n.name === name);
  if (existing) {
    console.log(`provider-node exists: ${existing.id} (prefix ${existing.prefix} · baseUrl ${existing.baseUrl || baseUrl})`);
    return existing;
  }
  const created = await api(base, cookie, '/api/provider-nodes', {
    method: 'POST',
    body: JSON.stringify({ name, prefix, apiType: 'chat', type: 'openai-compatible', baseUrl }),
  });
  if (!created.ok) throw new Error(`create node failed ${created.status}: ${created.text}`);
  console.log(`provider-node created: ${created.json.node.id}`);
  return created.json.node;
}

async function ensureConnection(base, cookie, { nodeId, name, apiKey, priority = 1, defaultModel }) {
  const list = await api(base, cookie, '/api/providers');
  const conns = (list.json && list.json.connections) || [];
  const existing = conns.find((c) => c.name === name);
  if (existing) {
    console.log(`connection exists: ${existing.id} (${existing.name})`);
    return existing;
  }
  const created = await api(base, cookie, '/api/providers', {
    method: 'POST',
    body: JSON.stringify({ provider: nodeId, apiKey, name, priority, defaultModel: defaultModel || null }),
  });
  if (!created.ok && created.status !== 409) {
    throw new Error(`create connection failed ${created.status}: ${created.text}`);
  }
  console.log(`connection created: ${(created.json && created.json.connection && created.json.connection.id) || '(conflict)'}`);
  return created.json && created.json.connection;
}

/** Register every key of `keys` — one connection per key, `<prefix>-001`, `-002`, … */
async function connectKeys({
  base = DEFAULTS.base,
  password = DEFAULTS.password,
  keys,
  name = DEFAULTS.name,
  prefix = DEFAULTS.prefix,
  baseUrl = DEFAULTS.baseUrl,
  defaultModel = DEFAULTS.defaultModel,
} = {}) {
  const list = (keys || []).map((k) => String(k).trim()).filter(Boolean);
  if (!list.length) throw new Error('--api-key is required (or put your keys in keys.txt)');
  const url = String(base).replace(/\/+$/, '');
  const { ok, cookie, body } = await login9router(url, password);
  console.log(`9Router login: ${ok ? 'ok' : 'not required/failed'} ${ok ? '' : body}`);
  const node = await ensureNode(url, cookie, { name, prefix, baseUrl });
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const connName = `${prefix}-${String(i + 1).padStart(3, '0')}`;
    out.push(await ensureConnection(url, cookie, { nodeId: node.id, name: connName, apiKey: list[i], defaultModel }));
  }
  console.log(`\nDone. ${list.length} key(s) on node ${node.id} — models: ${MODELS.map((m) => `${prefix}/${m}`).join(' · ')}`);
  return out;
}

/** Register one key — rotate keys by calling this again with another `apiKey`. */
async function connect9Router(opts = {}) {
  const [connection] = await connectKeys({ ...opts, keys: [opts.apiKey] });
  return connection;
}

/** `keys.txt` at the checkout root (beside `src/`) — the layout the tools run in. */
function defaultKeysFile() {
  return path.join(__dirname, '..', 'keys.txt');
}

function readKeys(keysFile = defaultKeysFile()) {
  if (!fs.existsSync(keysFile)) return [];
  return fs
    .readFileSync(keysFile, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

async function connectKeysFile({ keysFile = defaultKeysFile(), ...opts } = {}) {
  const keys = readKeys(keysFile);
  if (!keys.length) throw new Error(`no API keys in ${keysFile} — mint some first, or pass --api-key`);
  console.log(`keys: ${keys.length} from ${keysFile}`);
  return connectKeys({ ...opts, keys });
}

function parseRouterArgs(argv = process.argv.slice(2)) {
  const arg = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  return {
    base: arg('base'),
    password: arg('password'),
    apiKey: arg('api-key'),
    name: arg('name'),
    prefix: arg('prefix'),
    baseUrl: arg('base-url'),
    defaultModel: arg('model'),
  };
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    const doc = fs.readFileSync(__filename, 'utf8').match(/\/\*\*([\s\S]*?)\*\//);
    console.log(doc ? doc[1].replace(/^\s*\*[ ]?/gm, '').trim() : 'see README.md');
    process.exit(0);
  }
  const opts = parseRouterArgs(argv);
  const run = opts.apiKey ? connect9Router(opts) : connectKeysFile(opts);
  run.catch((e) => {
    console.error('[fatal] ' + e.message);
    process.exit(1);
  });
}

module.exports = {
  connect9Router,
  connectKeys,
  connectKeysFile,
  readKeys,
  defaultKeysFile,
  parseRouterArgs,
  login9router,
  ensureNode,
  ensureConnection,
  DEFAULTS,
  MODELS,
};
