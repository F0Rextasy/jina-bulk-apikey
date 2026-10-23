#!/usr/bin/env node
'use strict';

/**
 * jina-bulk-apikey CLI — issue Jina AI trial API keys, one per exit, and keep
 * only the keys that survive a live embeddings call.
 *
 * Jina issues keys with no account at all: the reader page solves a managed
 * Turnstile and `POST keygen.jina.ai/trial` answers `{"api_key":"jina_…"}`; when
 * the per-IP trial quota answers 429, `POST keygen.jina.ai/empty` still issues a
 * key (0 trial tokens). Every key carries a 10,000,000-token trial balance on an
 * anonymous `auto_<uuid>` account. The trial quota is per IP — hence one fresh
 * exit per key: your proxy list is the scale mechanism.
 *
 * Flow, per key, every Jina request through one exit from your pool:
 *   1. exit      screen the pool against api.jina.ai (optional, --screen)
 *   2. token     a fresh Turnstile token (--token list, or --token-cmd hook)
 *   3. key       POST https://keygen.jina.ai/trial   (multipart cf-turnstile-response)
 *                on 429 → POST https://keygen.jina.ai/empty
 *   4. gate      POST https://api.jina.ai/v1/embeddings {model, input:["ping"]} → 200
 *                (rerank also tried; the embeddings 200 is the gate)
 *
 * The key is appended to keys.txt only after step 4 answers 200; a key that
 * never passes is recorded in accounts.json and can be retried later.
 *
 * Options:
 *   --count N        keys to issue                                    [5]
 *   --conc N         keys in flight at once, max 4                    [1]
 *   --gap MS         pause between keys                                [800]
 *   --pool FILE      exit list, one per line, optional (env JINA_PROXIES) [proxies.txt]
 *   --model ID       model used for the live gate  [jina-ai/jina-embeddings-v4]
 *   --token T        Turnstile token(s), comma separated (one per key)
 *   --token-cmd CMD  command that prints one fresh token on stdout (per key)
 *   --verify-only    re-check every key in keys.txt
 *   --screen         only test the exit pool against Jina
 *   --timeout MS     per-request timeout                              [45000]
 *   --help
 *
 * Zero dependencies. Node.js >= 18. Your proxy list is OPTIONAL: pass --pool
 * (or the JINA_PROXIES env) and every request goes through an exit from it;
 * without a pool the tool connects directly.
 */

const fs = require('fs');
const path = require('path');
const net = require('net');
const tls = require('tls');
const http = require('http');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.basename(__dirname) === 'src' ? path.resolve(__dirname, '..') : __dirname;
const KEYS_FILE = path.join(ROOT, 'keys.txt');
const ACCOUNTS_FILE = path.join(ROOT, 'accounts.json');
const OUT_DIR = path.join(ROOT, 'out');

const TRIAL_URL = 'https://keygen.jina.ai/trial';
const EMPTY_URL = 'https://keygen.jina.ai/empty';
const API = 'https://api.jina.ai';
const READER_URL = 'https://jina.ai/reader';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';

// ------------------------------------------------------------------- options
const argv = process.argv.slice(2);
function arg(name, dflt) {
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = argv.indexOf(`--${name}`);
  if (i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  return dflt;
}
const has = (name) => argv.includes(`--${name}`) || argv.includes(`-${name}`);

if (has('help') || has('h')) {
  console.log(`jina-bulk-apikey — issue Jina AI trial keys, one exit per key, every key live-verified.

  node src/cli.js --count 5          issue keys (embeddings 200 gates the write)
  node src/cli.js --verify-only      re-check every key in keys.txt
  node src/cli.js --screen           test your exit pool against Jina
  node src/cli.js --help

  --count N        keys to issue                                       [5]
  --conc N         keys in flight at once, max 4                       [1]
  --pool FILE      exit list, one per line   (env JINA_PROXIES) [optional]
  --model ID       embeddings model for the gate       [jina-embeddings-v4]
  --token T        one Turnstile token per key, comma separated
  --token-cmd CMD  command that prints one fresh token (run once per key)
  --verify-only    re-test keys.txt keys
  --screen         only screen the pool

Requests go through the exits in your proxy list when one is provided (--pool or
the JINA_PROXIES env); without a pool the tool connects DIRECTLY.

Turnstile: Jina's trial endpoint is behind a managed Cloudflare Turnstile. Get a
token from any browser (open ${READER_URL}, press "GET YOUR API KEY", copy the
hidden input cf-turnstile-response), pass it with --token, or wire a solver with
--token-cmd. One token is spent per key.

Requests go through your proxy list when one is provided (--pool / env). Without
a pool the tool connects directly.`);
  process.exit(0);
}

const COUNT = Math.max(1, parseInt(arg('count', '5'), 10) || 5);
const CONC = Math.min(4, Math.max(1, parseInt(arg('conc', '1'), 10) || 1));
const GAP_MS = Math.max(0, parseInt(arg('gap', '800'), 10) || 0);
const TIMEOUT_MS = Math.max(5000, parseInt(arg('timeout', '45000'), 10) || 45000);
const MODEL = arg('model', 'jina-embeddings-v4');
const VERIFY_ONLY = has('verify-only');
const SCREEN = has('screen');
const POOL_ARG = arg('pool', process.env.JINA_PROXIES || 'proxies.txt');
const POOL_FILE = fs.existsSync(path.resolve(POOL_ARG)) ? path.resolve(POOL_ARG) : path.resolve(ROOT, POOL_ARG);
const TOKENS = String(arg('token', '')).split(',').map((s) => s.trim()).filter(Boolean);
const TOKEN_CMD = arg('token-cmd', process.env.JINA_TOKEN_CMD || null);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT_DIR, { recursive: true });
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

// ------------------------------------------------------------------- proxy
/** One exit line → { protocol, host, port, auth } or null. */
function parseProxy(line) {
  const s = String(line || '').trim();
  if (!s || s.startsWith('#')) return null;
  let m = s.match(/^(https?|socks5h?|socks4):\/\/(?:([^:@/]+):([^@/]+)@)?([^:/]+):(\d+)/i);
  if (!m) m = s.match(/^(?:([^:@/]+):([^@/]+)@)?([^:/]+):(\d+)$/);
  if (!m) return null;
  if (m.length === 6) {
    const raw = m[1].toLowerCase();
    if (raw === 'socks4') return null; // socks4 is not supported by this client
    const protocol = raw.startsWith('socks') ? 'socks5' : 'http';
    return { protocol, host: m[4], port: Number(m[5]), auth: m[2] ? `${m[2]}:${m[3]}` : null };
  }
  return { protocol: 'http', host: m[3], port: Number(m[4]), auth: m[1] ? `${m[1]}:${m[2]}` : null };
}

/** A raw socket straight to host:port (no proxy) — the direct-mode twin of connectThrough. */
function directConnect(host, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host, port });
    const t = setTimeout(() => { sock.destroy(); reject(new Error(`connect timeout (${host}:${port})`)); }, timeoutMs);
    sock.once('error', (e) => { clearTimeout(t); try { sock.destroy(); } catch {} reject(new Error(`connect failed: ${e.message}`)); });
    sock.once('connect', () => { clearTimeout(t); resolve(sock); });
  });
}

/** Raw socket to host:port through the exit (CONNECT for http, SOCKS5 for socks). */
function connectThrough(proxy, host, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host: proxy.host, port: proxy.port });
    const t = setTimeout(() => { sock.destroy(); reject(new Error(`proxy timeout (${proxy.host}:${proxy.port})`)); }, timeoutMs);
    const done = (err, s) => { clearTimeout(t); if (err) { try { sock.destroy(); } catch {} reject(err); } else resolve(s); };
    sock.once('error', (e) => done(new Error(`proxy connect failed: ${e.message}`)));
    sock.once('connect', () => {
      if (proxy.protocol === 'socks5') {
        sock.write(proxy.auth ? Buffer.from([5, 2, 0, 2]) : Buffer.from([5, 1, 0]));
        let stage = 0; // 0: greeting reply → 1: auth reply → 2: connect reply
        let buf = Buffer.alloc(0);
        const sendConnect = () => {
          const hb = Buffer.from(host);
          sock.write(Buffer.concat([Buffer.from([5, 1, 0, 3, hb.length]), hb, Buffer.from([port >> 8, port & 0xff])]));
        };
        const onData = (d) => {
          try {
            buf = Buffer.concat([buf, d]);
            for (;;) {
              if (stage === 0) {
                if (buf.length < 2) return;
                const v = buf; buf = buf.slice(2);
                if (v[0] !== 5) return done(new Error('SOCKS5 bad version'));
                if (v[1] === 2) {
                  if (!proxy.auth) return done(new Error('SOCKS5 auth required'));
                  const [u, p] = proxy.auth.split(':');
                  sock.write(Buffer.concat([Buffer.from([1, u.length]), Buffer.from(u), Buffer.from([p.length]), Buffer.from(p)]));
                  stage = 1;
                  continue;
                }
                if (v[1] !== 0) return done(new Error('SOCKS5 no acceptable method'));
                stage = 2; sendConnect(); continue;
              }
              if (stage === 1) {
                if (buf.length < 2) return;
                const v = buf; buf = buf.slice(2);
                if (v[1] !== 0) return done(new Error('SOCKS5 auth failed'));
                stage = 2; sendConnect(); continue;
              }
              if (stage === 2) {
                if (buf.length < 5) return;
                const atyp = buf[3];
                const need = 4 + (atyp === 1 ? 4 : atyp === 3 ? 1 + buf[4] : 16) + 2;
                if (buf.length < need) return;
                const rep = buf[1]; buf = buf.slice(need);
                if (rep !== 0) return done(new Error(`SOCKS5 connect failed (code ${rep})`));
                sock.off('data', onData);
                return done(null, sock);
              }
            }
          } catch (e) { done(e); }
        };
        sock.on('data', onData);
        return;
      }
      const auth = proxy.auth ? `Proxy-Authorization: Basic ${Buffer.from(proxy.auth).toString('base64')}\r\n` : '';
      sock.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n${auth}\r\n`);
      let buf = '';
      const onData = (d) => {
        buf += d;
        if (!buf.includes('\r\n\r\n')) return;
        sock.off('data', onData);
        if (!/^HTTP\/\d(\.\d)? 200/.test(buf)) return done(new Error(`proxy CONNECT refused: ${buf.split('\r\n')[0]}`));
        done(null, sock);
      };
      sock.on('data', onData);
    });
  });
}

/** One HTTPS request through one exit. Returns { status, headers, body }. */
async function exitFetch(proxy, url, { method = 'GET', headers = {}, body = null, redirects = 2, timeoutMs = TIMEOUT_MS } = {}) {
  const u = new URL(url);
  const raw = proxy ? await connectThrough(proxy, u.hostname, u.port || 443, timeoutMs) : await directConnect(u.hostname, u.port || 443, timeoutMs);
  const sock = tls.connect({ socket: raw, servername: u.hostname });
  await new Promise((res, rej) => { sock.once('secureConnect', res); sock.once('error', rej); });
  const chunks = [];
  const finish = (res) => {
    const text = Buffer.concat(chunks).toString('utf8');
    if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
      const next = new URL(res.headers.location, url).toString();
      exitFetch(proxy, next, { method, headers, body, redirects: redirects - 1, timeoutMs }).then(resolve, reject);
      return;
    }
    resolve({ status: res.statusCode, headers: res.headers, body: text });
  };
  let resolve, reject;
  const p = new Promise((res, rej) => { resolve = res; reject = rej; });
  const req = http.request({
    method,
    path: u.pathname + u.search,
    createConnection: () => sock,
    headers: { host: u.host, 'user-agent': UA, accept: '*/*', ...headers },
  });
  const t = setTimeout(() => { try { req.destroy(); } catch {} reject(new Error('request timeout')); }, timeoutMs);
  req.on('response', (res) => {
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => { clearTimeout(t); finish(res); });
  });
  req.on('error', (e) => { clearTimeout(t); reject(e); });
  if (body != null) req.write(body);
  req.end();
  return p;
}

const multipart = (fields) => {
  const b = `----jina${crypto.randomBytes(8).toString('hex')}`;
  const parts = [];
  for (const [k, v] of Object.entries(fields)) parts.push(`--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`);
  parts.push(`--${b}--\r\n`);
  return { boundary: `multipart/form-data; boundary=${b}`, body: Buffer.from(parts.join('')) };
};

// ------------------------------------------------------------------- keys/gate
function readKeys() {
  try { return fs.readFileSync(KEYS_FILE, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean); } catch { return []; }
}
function appendKey(key) { fs.appendFileSync(KEYS_FILE, (fs.existsSync(KEYS_FILE) && fs.statSync(KEYS_FILE).size ? '\n' : '') + key + '\n'); }
function loadAccounts() { try { return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8')); } catch { return []; } }
function saveAccounts(list) { fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(list, null, 2) + '\n'); }

async function gate(proxy, key) {
  const emb = await exitFetch(proxy, `${API}/v1/embeddings`, {
    method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: ['ping'] }),
  });
  let rerank = null;
  try {
    rerank = await exitFetch(proxy, `${API}/v1/rerank`, {
      method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'jina-reranker-v2-base-multilingual', query: 'ping', documents: ['ping'] }),
    });
  } catch (e) { rerank = { status: 0, body: e.message }; }
  return { emb, rerank };
}

function loadPool() {
  if (!fs.existsSync(POOL_FILE)) {
    // No pool = DIRECT mode: a proxy is recommended at scale (per-IP trial
    // quota), but the tool works without one. `null` is the direct sentinel.
    console.log(`no proxy list at ${POOL_FILE} — running WITHOUT a proxy (direct). Put exits there (or pass --pool) to rotate per key.`);
    return [null];
  }
  const exits = fs.readFileSync(POOL_FILE, 'utf8').split(/\r?\n/).map(parseProxy).filter(Boolean);
  if (!exits.length) {
    console.log(`${POOL_FILE} has no usable exits — running WITHOUT a proxy (direct).`);
    return [null];
  }
  return exits;
}

async function screen(exits) {
  let ok = 0;
  for (const e of exits.slice(0, 64)) {
    try {
      const t0 = Date.now();
      const r = await exitFetch(e, `${API}/v1/models`, { timeoutMs: 20000 });
      const good = r.status === 200;
      if (good) ok++;
      console.log(`  ${good ? '✔' : '✘'} ${e ? `${e.host}:${e.port}` : 'direct'} status=${r.status} ${Date.now() - t0}ms`);
    } catch (err) {
      console.log(`  ✘ ${e ? `${e.host}:${e.port}` : 'direct'} ${String(err.message).slice(0, 80)}`);
    }
  }
  console.log(`screened ${Math.min(exits.length, 64)} exit(s): ${ok} reach api.jina.ai`);
  return ok;
}

function nextToken(i) {
  if (TOKENS.length > i) return TOKENS[i];
  if (TOKEN_CMD) {
    try {
      const out = execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', TOKEN_CMD], { encoding: 'utf8', timeout: 300000, windowsHide: true });
      const line = String(out).split(/\r?\n/).map((s) => s.trim()).filter(Boolean).pop() || '';
      // Turnstile tokens carry dots ("1.iwHu…"); the char class must include '.' or the
      // token is truncated to a middle segment and Cloudflare rejects it.
      const m = line.match(/[A-Za-z0-9_.-]{40,}/);
      if (m) return m[0];
    } catch (e) { /* fall through to the error below */ }
  }
  return null;
}

// ------------------------------------------------------------------- flows
async function mint() {
  const exits = loadPool();
  if (SCREEN) return void (await screen(exits));
  const accounts = loadAccounts();
  log(`jina · ${COUNT} key(s) · conc ${CONC} · exits ${exits.filter(Boolean).length || 'direct'} from ${path.basename(POOL_FILE)} · keys land in keys.txt`);
  let made = 0;
  for (let round = 0; round < COUNT; round += CONC) {
    const jobs = [];
    for (let k = 0; k < CONC && round + k < COUNT; k++) {
      const i = round + k;
      const exit = exits[i % exits.length];
      const token = nextToken(i);
      if (!token) {
        log(`key ${i + 1}: no Turnstile token — pass --token (one per key) or --token-cmd. See --help.`);
        continue;
      }
      jobs.push((async () => {
        try {
          const mp = multipart({ 'cf-turnstile-response': token });
          let r = await exitFetch(exit, TRIAL_URL, { method: 'POST', headers: { 'content-type': mp.boundary }, body: mp.body });
          let via = 'trial';
          if (r.status === 429 || !/"api_key"/.test(r.body)) {
            r = await exitFetch(exit, EMPTY_URL, { method: 'POST', headers: { 'content-type': mp.boundary }, body: mp.body });
            via = 'empty';
          }
          let key = null;
          try { key = JSON.parse(r.body).api_key || null; } catch { /* not json */ }
          if (!key) { log(`key ${i + 1}: ${via} status=${r.status} body=${String(r.body).slice(0, 120)}`); return; }
          const g = await gate(exit, key);
          if (g.emb.status !== 200) {
            log(`key ${i + 1}: issued but embeddings gate ${g.emb.status} — recorded in accounts.json, not written`);
            accounts.push({ at: new Date().toISOString(), via, exit: exit ? `${exit.host}:${exit.port}` : 'direct', key_masked: `${key.slice(0, 10)}…`, gate: g.emb.status });
            saveAccounts(accounts);
            return;
          }
          appendKey(key);
          accounts.push({ at: new Date().toISOString(), via, exit: exit ? `${exit.host}:${exit.port}` : 'direct', key_masked: `${key.slice(0, 10)}…`, gate: 200, rerank: g.rerank ? g.rerank.status : null });
          saveAccounts(accounts);
          made++;
          log(`key ${i + 1} ✔ ${via} · embeddings 200 · rerank ${g.rerank ? g.rerank.status : 'n/a'} · ${key.slice(0, 10)}…`);
        } catch (e) {
          log(`key ${i + 1}: ${String(e.message).slice(0, 120)}`);
        }
      })());
    }
    await Promise.all(jobs);
    if (GAP_MS) await sleep(GAP_MS);
  }
  log(`done — ${made}/${COUNT} key(s) written to ${KEYS_FILE}`);
}

async function verifyOnly() {
  const exits = loadPool();
  const keys = readKeys();
  if (!keys.length) { console.log(`no keys in ${KEYS_FILE}`); process.exit(0); }
  let live = 0;
  for (let i = 0; i < keys.length; i++) {
    const exit = exits[i % exits.length];
    try {
      const g = await gate(exit, keys[i]);
      if (g.emb.status === 200) live++;
      console.log(`  ${g.emb.status === 200 ? '✔' : '✘'} ${keys[i].slice(0, 10)}… embeddings=${g.emb.status} rerank=${g.rerank ? g.rerank.status : 'n/a'}`);
    } catch (e) {
      console.log(`  ✘ ${keys[i].slice(0, 10)}… ${String(e.message).slice(0, 90)}`);
    }
  }
  console.log(`verify: ${live}/${keys.length} keys live`);
  process.exit(live === keys.length ? 0 : 1);
}

(VERIFY_ONLY ? verifyOnly() : mint()).catch((e) => { console.error('[fatal]', e.message); process.exit(1); });
