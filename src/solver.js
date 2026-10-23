#!/usr/bin/env node
'use strict';
/**
 * solver.js — the captcha solver that ships inside every bulk-apikey repo.
 *
 * One file, one entry point. The CLI calls it with the account's own exit so the
 * token and the request that spends it leave from the same IP (several panels
 * bind the token to the solving exit and answer `Turnstile token is empty` /
 * `校验失败` otherwise).
 *
 *   const { solveCaptcha } = require('./solver');
 *   const { token, ms } = await solveCaptcha({ type: 'turnstile', sitekey, url, proxy });
 *
 * Types
 *   turnstile        Cloudflare Turnstile — a real Chrome window, offscreen.
 *   recaptcha2-image reCAPTCHA v2/v3 — plain HTTP (anchor → reload → image round).
 *   tencent          Tencent TCaptcha (turing.captcha.qcloud.com) — plain HTTP.
 *   image            A PNG challenge handed in by the caller, read by a VLM.
 *
 * Returns `{ token, ms }`; `token` is exactly what the panel expects, never
 * trimmed (panels compare the whole blob). Failures throw an Error carrying
 * `.code` (`no-chrome`, `no-token`, `timeout`, `vlm-unconfigured`,
 * `tencent-tdc-required`, …) so the CLI can class the failure instead of
 * retrying forever.
 *
 * Browser engine: `puppeteer-core` + the Chrome already on the machine
 * (`--chrome-path` / `CHROME_PATH` / the usual install paths / `channel:'chrome'`).
 * No bundled Chromium — a repo stays ~1 MB instead of ~500 MB.
 *
 * Chrome is launched **headed but offscreen** (`--window-position=-32000,-32000`):
 * measured on this fleet, headless solves 0/16 while the offscreen window solves
 * 16/16 (Cloudflare reads the real window/GPU surface).
 *
 * `Runtime.enable` is never sent: that one CDP call is what Turnstile's "CDP
 * detected" check keys on. Puppeteer sends it from its own frame manager, so the
 * CDP session prototypes are patched below to drop it — which also means
 * `page.evaluate()` can never resolve an execution context, and every read/write
 * in this file goes through `Runtime.evaluate` on a private CDP session instead.
 *
 * ToS: automating a captcha is the operator's responsibility; this file ships no
 * proxy, key or account and only solves what the caller points it at.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const tls = require('tls');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const DEFAULT_TIMEOUT_MS = 90 * 1000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (code, message) => Object.assign(new Error(message), { code });

// --------------------------------------------------------------- puppeteer
let _puppeteer = null;
/** puppeteer-core is a declared dependency; cwd is the fallback for a repo whose
 *  node_modules lives one level up from the script (measured: `require` inside a
 *  subdirectory misses the repo root). */
function puppeteer() {
  if (_puppeteer) return _puppeteer;
  try {
    _puppeteer = require('puppeteer-core');
  } catch (e) {
    try {
      _puppeteer = require(path.join(process.cwd(), 'node_modules', 'puppeteer-core'));
    } catch (e2) {
      throw fail('no-puppeteer', 'missing dependency "puppeteer-core" — run: npm i puppeteer-core');
    }
  }
  return _puppeteer;
}

/** Drop `Runtime.enable` and `Runtime.disable` (Turnstile's CDP tell). Done once,
 *  on the CDP session prototypes, before Chrome is launched: the frame manager
 *  fires `Runtime.enable` while attaching, long before any caller can hook it. */
let _patched = false;
function suppressRuntimeDomain() {
  if (_patched) return;
  _patched = true;
  for (const p of ['puppeteer-core/lib/puppeteer/api/CDPSession.js', 'puppeteer-core/lib/puppeteer/cdp/CdpSession.js']) {
    let mod;
    try { mod = require(p); } catch (e) { continue; }
    for (const name of Object.keys(mod)) {
      const proto = mod[name] && mod[name].prototype;
      if (!proto || typeof proto.send !== 'function') continue;
      const orig = proto.send;
      proto.send = function (method, ...rest) {
        if (method === 'Runtime.enable' || method === 'Runtime.disable') return Promise.resolve({});
        return orig.call(this, method, ...rest);
      };
    }
  }
}

/** The Chrome on this machine, or a clear error naming the one-line install. */
function findChrome(explicit) {
  // An explicit path that is not there must fail loudly: silently falling back to
  // an installed Chrome hides a typo and makes the "no Chrome here" case untestable.
  if (explicit && !fs.existsSync(explicit)) throw fail('no-chrome', `no Chrome found at ${explicit} — check chromePath / CHROME_PATH`);
  const cands = [];
  if (process.env.CHROME_PATH) cands.push(process.env.CHROME_PATH);
  if (process.platform === 'win32') {
    cands.push(
      path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    );
  } else if (process.platform === 'darwin') {
    cands.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  } else {
    cands.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium');
  }
  for (const c of cands) if (c && fs.existsSync(c)) return { executablePath: c };
  // let puppeteer resolve an installed Chrome itself (its error feeds launchHint)
  return { channel: 'chrome' };
}

/** Chrome exited before the first page came up → name the real cause. */
function launchHint(err) {
  const m = String((err && err.message) || err);
  if (/Could not find (Chrome|browser)|channel.*not found|ENOENT/i.test(m)) {
    return fail('no-chrome', `no Chrome found — install Google Chrome, or pass chromePath/CHROME_PATH (${m.slice(0, 120)})`);
  }
  return fail('launch-failed', m.slice(0, 300));
}

/** `http://user:pass@host:port` → the flag-safe server plus the credentials Chrome
 *  refuses to take inside it (`net::ERR_NO_SUPPORTED_PROXIES`). */
function proxyParts(proxy) {
  if (!proxy) return null;
  try {
    const u = new URL(String(proxy));
    return { server: `${u.protocol}//${u.host}`, username: decodeURIComponent(u.username || ''), password: decodeURIComponent(u.password || '') };
  } catch (e) {
    return { server: String(proxy), username: '', password: '' };
  }
}

/** A credentialed exit's 407 is answered on our own CDP session: Chrome sends no
 *  userinfo from `--proxy-server`, so the Fetch domain carries it instead. */
async function authenticateProxy(cdp, creds, log) {
  cdp.on('Fetch.authRequired', (p) => cdp.send('Fetch.continueWithAuth', {
    requestId: p.requestId,
    authChallengeResponse: { response: 'ProvideCredentials', username: creds.username, password: creds.password },
  }).catch(() => {}));
  cdp.on('Fetch.requestPaused', (p) => cdp.send('Fetch.continueRequest', { requestId: p.requestId }).catch(() => {}));
  await cdp.send('Fetch.enable', { handleAuthRequests: true });
  log('proxy auth via Fetch.handleAuthRequests');
}

// ------------------------------------------------------------ chrome session
/**
 * Launches a throwaway offscreen Chrome with a fresh profile and hands the
 * callback a private CDP session on its first page. Everything is released
 * afterwards, profile included (`keepProfile` only for debugging).
 */
async function withChrome({ proxy = '', chromePath = '', timeoutMs = DEFAULT_TIMEOUT_MS, keepProfile = false, log = () => {} }, fn) {
  const puppeteerCore = puppeteer();
  suppressRuntimeDomain();
  const dir = keepProfile ? '' : fs.mkdtempSync(path.join(os.tmpdir(), 'solver-'));
  const opts = Object.assign(
    {
      headless: false,
      viewport: null,
      userDataDir: dir || undefined,
      protocolTimeout: timeoutMs + 30000,
      // `--enable-automation` is what sets navigator.webdriver = true, and Turnstile
      // simply refuses to render while that flag is up (measured: widget absent for
      // 25 s on two panels; the same page renders and issues a token the moment the
      // flag is dropped). `AutomationControlled` is the matching blink feature.
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--window-position=-32000,-32000',
        '--window-size=1280,900',
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    },
    findChrome(chromePath),
  );
  const px = proxyParts(proxy);
  if (px) opts.args.push(`--proxy-server=${px.server}`);

  let browser = null;
  let cdp = null;
  const timer = setTimeout(() => { try { cdp && cdp.close(); } catch (e) {} try { browser && browser.close(); } catch (e) {} }, timeoutMs + 20000);
  try {
    try {
      browser = await puppeteerCore.launch(opts);
    } catch (e) {
      throw launchHint(e);
    }
    const page = await browser.newPage();
    cdp = await page.createCDPSession();
    if (px && px.username) await authenticateProxy(cdp, px, log);
    log(`chrome ${opts.executablePath || 'channel:chrome'}${px ? ` via ${px.server}` : ''}`);
    return await fn({ page, cdp, log });
  } finally {
    clearTimeout(timer);
    try { if (cdp) await cdp.close(); } catch (e) {}
    try { if (browser) await browser.close(); } catch (e) { log(`close err ${e.message}`); }
    if (dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
  }
}

/** Evaluate in the page's main world. `Runtime.evaluate` needs no
 *  `Runtime.enable`, so this is the one read/write path the solver uses. */
async function evalIn(cdp, expression, timeoutMs = 20000) {
  const r = await Promise.race([
    cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }),
    sleep(timeoutMs).then(() => { throw fail('timeout', `Runtime.evaluate timed out (${timeoutMs}ms)`); }),
  ]);
  if (r && r.exceptionDetails) throw fail('eval-failed', String((r.exceptionDetails.exception || {}).description || 'page threw').slice(0, 200));
  return r && r.result ? r.result.value : undefined;
}
const evalJson = async (cdp, expr) => { try { return JSON.parse(await evalIn(cdp, expr)); } catch (e) { return null; } };

/** Stepped, jittered click — a straight `mouse.move` + `click` is the second
 *  thing a bot check looks at. Dispatched on our own session (Input domain). */
async function humanClick(cdp, x, y, log = () => {}) {
  const sx = x - 60 - Math.floor(Math.random() * 120);
  const sy = y + 20 + Math.floor(Math.random() * 60);
  const steps = 14 + Math.floor(Math.random() * 12);
  for (let i = 1; i <= steps; i++) {
    const u = i / steps;
    const ease = u * u * (3 - 2 * u);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sx + (x - sx) * ease, y: sy + (y - sy) * ease, buttons: 0 });
    await sleep(6 + Math.random() * 14);
  }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
  await sleep(50 + Math.random() * 100);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 });
  await sleep(40 + Math.random() * 70);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0 });
  log(`clicked ${x},${y}`);
}

// --------------------------------------------------------------- turnstile
// Current Turnstile releases render the widget inside a *closed* shadow root: a
// plain DOM walk (even one that recurses open shadow roots) sees no iframe. Two
// fallbacks cover it — the hidden `cf-turnstile-response` input the widget
// injects (widget is live) and the CDP DOM domain with `pierce:true`, which
// flattens shadow content and can hand back the iframe's box. Reading the token
// is always the widget's own value; nothing is injected.
const MOUNT = `(() => {
  const hosts = [], frames = [];
  const walk = (root) => {
    let els = [];
    try { els = [...root.querySelectorAll('iframe')]; } catch (e) {}
    for (const el of els) {
      let b; try { b = el.getBoundingClientRect(); } catch (e) { continue; }
      if (b.width >= 20 && b.height >= 10) frames.push({ src: String(el.src || '').slice(0, 120), x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) });
    }
    for (const el of els.concat([...root.querySelectorAll('*')])) if (el.shadowRoot) walk(el.shadowRoot);
  };
  walk(document);
  for (const el of document.querySelectorAll('[data-sitekey], .cf-turnstile, #cf-turnstile')) {
    let b; try { b = el.getBoundingClientRect(); } catch (e) { continue; }
    hosts.push({ sitekey: el.getAttribute('data-sitekey'), x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) });
  }
  const cf = frames.find((f) => /challenges\\.cloudflare\\.com/.test(f.src));
  return JSON.stringify({
    host: hosts[0] || null, frame: cf || frames[0] || null, frames: frames.length,
    input: !!document.querySelector('input[name="cf-turnstile-response"], textarea[name="cf-turnstile-response"]'),
  });
})()`;

const TOKEN = `(() => {
  const vals = [...document.querySelectorAll('input[name="cf-turnstile-response"], textarea[name="cf-turnstile-response"]')]
    .map((i) => i.value).filter((v) => v && v.length > 10);
  let g = '';
  try { if (typeof turnstile !== 'undefined' && turnstile.getResponse) g = turnstile.getResponse() || ''; } catch (e) {}
  return vals.concat(g ? [g] : []).sort((a, b) => b.length - a.length)[0] || '';
})()`;

/** The widget iframe's box, even from inside a closed shadow root. */
async function piercedWidgetBox(cdp) {
  try {
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'iframe[src*="challenges.cloudflare.com"]' });
    if (!nodeId) return null;
    const { model } = await cdp.send('DOM.getBoxModel', { nodeId });
    const b = model.border;
    const xs = [b[0], b[2], b[4], b[6]];
    const ys = [b[1], b[3], b[5], b[7]];
    const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
    return w >= 20 && h >= 10 ? { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), via: 'dom-pierce' } : null;
  } catch (e) { return null; }
}

async function solveTurnstile({ sitekey = '', url, proxy = '', chromePath = '', timeoutMs = DEFAULT_TIMEOUT_MS, log = () => {} }) {
  if (!url) throw fail('bad-args', 'turnstile needs { url } (the page the widget lives on)');
  const t0 = Date.now();
  const left = () => timeoutMs - (Date.now() - t0);
  return withChrome({ proxy, chromePath, timeoutMs, log }, async ({ page, cdp }) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: Math.min(45000, Math.max(10000, left())) });
    let mount = null;
    let rect = null;
    // mount window: a SPA can mount the widget several seconds after DOMContentLoaded
    while (left() > timeoutMs - 25000) {
      mount = await evalJson(cdp, MOUNT);
      rect = (mount && mount.host && mount.host.w >= 20 && mount.host.h >= 10 ? mount.host : null) || (mount && mount.frame) || (await piercedWidgetBox(cdp));
      if (rect || (mount && mount.input)) break;
      await sleep(1000);
    }
    if (!rect && !(mount && mount.input)) {
      throw Object.assign(fail('no-token', `no Turnstile widget on ${url} (sitekey ${sitekey || '?'})`), { mount });
    }
    let tok = String((await evalIn(cdp, TOKEN)) || '');
    for (let round = 0; rect && round < 3 && !tok && left() > 8000; round++) {
      const until = Date.now() + Math.min(round === 0 ? 8000 : 20000, left());
      while (!tok && Date.now() < until) { await sleep(600); tok = String((await evalIn(cdp, TOKEN)) || ''); }
      if (tok) break;
      await humanClick(cdp, rect.x + 30, rect.y + Math.round(rect.h / 2), log);
      await sleep(1500 + Math.random() * 2000);
      tok = String((await evalIn(cdp, TOKEN)) || '');
    }
    while (!tok && left() > 2500) { await sleep(600); tok = String((await evalIn(cdp, TOKEN)) || ''); }
    if (tok.length <= 20) {
      throw Object.assign(fail('no-token', `Turnstile issued no token in ${Date.now() - t0}ms (mount=${JSON.stringify(mount)})`), { mount });
    }
    log(`turnstile ${tok.length} chars${rect ? ` (click point ${rect.x},${rect.y})` : ''}`);
    // never trim: panels compare the whole blob, and a trimmed token is refused
    return { token: tok, ms: Date.now() - t0, mount };
  });
}

// ------------------------------------------------------------- http plumbing
/** One tunnel socket to `host:port` through `proxy` (http/https CONNECT or
 *  socks5). `null` dials straight out. */
function dial(proxy, host, port, timeoutMs = 15000) {
  if (!proxy) {
    return new Promise((resolve, reject) => {
      const s = net.connect({ host, port });
      const t = setTimeout(() => { s.destroy(); reject(new Error(`connect timeout ${host}:${port}`)); }, timeoutMs);
      s.once('connect', () => { clearTimeout(t); resolve(s); });
      s.once('error', (e) => { clearTimeout(t); reject(e); });
    });
  }
  const u = new URL(proxy);
  const kind = u.protocol.replace(':', '');
  if (kind === 'socks5' || kind === 'socks5h') {
    return new Promise((resolve, reject) => {
      const s = net.connect({ host: u.hostname, port: Number(u.port) || 1080 });
      const t = setTimeout(() => { s.destroy(); reject(new Error(`socks5 timeout ${u.hostname}`)); }, timeoutMs);
      let stage = 'method';
      let buf = Buffer.alloc(0);
      const done = (e) => { clearTimeout(t); s.removeAllListeners('data'); e ? (s.destroy(), reject(e)) : resolve(s); };
      s.on('error', (e) => done(e));
      s.on('connect', () => s.write(Buffer.from(u.username ? [0x05, 0x02, 0x00, 0x02] : [0x05, 0x01, 0x00])));
      s.on('data', (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        if (stage === 'method') {
          if (buf.length < 2) return;
          const method = buf[1];
          buf = buf.slice(2);
          if (method === 0xff) return done(new Error('socks5: no acceptable auth method'));
          if (method === 0x02) {
            stage = 'auth';
            const a = Buffer.from(u.username || '');
            const b = Buffer.from(u.password || '');
            return s.write(Buffer.concat([Buffer.from([0x01, a.length]), a, Buffer.from([b.length]), b]));
          }
          stage = 'reply';
          const h = Buffer.from(host);
          return s.write(Buffer.concat([Buffer.from([0x05, 0x01, 0x00, 0x03, h.length]), h, Buffer.from([(port >> 8) & 0xff, port & 0xff])]));
        }
        if (stage === 'auth') {
          if (buf.length < 2) return;
          const ok = buf[1] === 0x00;
          buf = buf.slice(2);
          if (!ok) return done(new Error('socks5: auth rejected'));
          stage = 'reply';
          const h = Buffer.from(host);
          return s.write(Buffer.concat([Buffer.from([0x05, 0x01, 0x00, 0x03, h.length]), h, Buffer.from([(port >> 8) & 0xff, port & 0xff])]));
        }
        if (buf.length < 5) return;
        const atyp = buf[3];
        const need = atyp === 0x01 ? 10 : atyp === 0x04 ? 22 : 7 + buf[4];
        if (buf.length < need) return;
        if (buf[1] !== 0x00) return done(new Error(`socks5: connect failed (code ${buf[1]})`));
        const rest = buf.slice(need);
        clearTimeout(t);
        s.removeAllListeners('data');
        if (rest.length) s.unshift(rest);
        resolve(s);
      });
    });
  }
  if (kind !== 'http' && kind !== 'https') throw fail('bad-proxy', `unsupported proxy scheme "${kind}" (use http, https or socks5)`);
  return new Promise((resolve, reject) => {
    const s = net.connect({ host: u.hostname, port: Number(u.port) || 8080 });
    let buf = '';
    const t = setTimeout(() => { s.destroy(); reject(new Error(`proxy timeout ${u.hostname}`)); }, timeoutMs);

    s.once('connect', () => {
      const auth = u.username ? `Proxy-Authorization: Basic ${Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password || '')}`).toString('base64')}\r\n` : '';
      s.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n${auth}\r\n`);
    });
    const onData = (c) => {
      buf += c.toString('latin1');
      const i = buf.indexOf('\r\n\r\n');
      if (i < 0) return;
      const code = Number((/^HTTP\/1\.[01] (\d{3})/.exec(buf) || [])[1]);
      clearTimeout(t);
      s.removeListener('data', onData);
      const rest = Buffer.from(buf.slice(i + 4), 'latin1');
      if (code !== 200) return (s.destroy(), reject(new Error(`proxy CONNECT refused (${code || 'no status'})`)));
      if (rest.length) s.unshift(rest);
      resolve(s);
    };
    s.on('data', onData);
  });
}

/** HTTP(S) request through `proxy`, body as Buffer. */
function request(proxy, url, { method = 'GET', headers = {}, body = null, binary = false, timeoutMs = 30000 } = {}) {
  const u = new URL(url);
  const secure = u.protocol === 'https:';
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`request timeout ${url.slice(0, 60)}`)), timeoutMs);
    dial(proxy, u.hostname, Number(u.port) || (secure ? 443 : 80), Math.min(timeoutMs, 15000))
      .then((socket) => {
        const sock = secure ? tls.connect({ socket, servername: u.hostname }) : socket;
        const fire = () => {
          const req = http.request(
            { createConnection: () => sock, method, path: u.pathname + u.search, headers: Object.assign({ host: u.host }, headers), setHost: false },
            (res) => {
              const chunks = [];
              res.on('data', (c) => chunks.push(c));
              res.on('end', () => {
                clearTimeout(t);
                const buf = Buffer.concat(chunks);
                resolve({ status: res.statusCode, headers: res.headers, buf, text: buf.toString(binary ? 'latin1' : 'utf8') });
              });
            },
          );
          req.on('error', (e) => { clearTimeout(t); reject(e); });
          if (body) req.write(body);
          req.end();
        };
        if (secure) socket.once('secureConnect', fire); else fire();
      })
      .catch((e) => { clearTimeout(t); reject(e); });
  });
}

// --------------------------------------------------------------------- VLM
/** Vision model endpoint, caller-supplied (a repo ships no key): SOLVER_VLM_URL
 *  (OpenAI-compatible base), SOLVER_VLM_KEY, SOLVER_VLM_MODEL. */
function vlmConfig(opts = {}) {
  const base = opts.vlmUrl || process.env.SOLVER_VLM_URL;
  const key = opts.vlmKey || process.env.SOLVER_VLM_KEY;
  const model = opts.vlmModel || process.env.SOLVER_VLM_MODEL;
  if (!base || !key || !model) {
    throw fail('vlm-unconfigured', 'no vision model: set SOLVER_VLM_URL, SOLVER_VLM_KEY, SOLVER_VLM_MODEL (an OpenAI-compatible /chat/completions endpoint)');
  }
  return { base: base.replace(/\/$/, ''), key, model };
}

async function askVlm(cfg, { b64, mime = 'image/png', instruction, maxTokens = 200, proxy = '', timeoutMs = 90000 }) {
  const r = await request(proxy, `${cfg.base}/chat/completions`, {
    method: 'POST',
    timeoutMs,
    headers: { authorization: `Bearer ${cfg.key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: [{ type: 'text', text: instruction }, { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } }] }],
    }),
  });
  if (r.status !== 200) throw fail('vlm-error', `vision model answered HTTP ${r.status}: ${r.text.slice(0, 160)}`);
  let content = '';
  try { content = (((JSON.parse(r.text).choices || [])[0] || {}).message || {}).content || ''; } catch (e) { throw fail('vlm-error', `vision model envelope unreadable: ${r.text.slice(0, 160)}`); }
  if (!content) throw fail('vlm-error', 'vision model returned no content');
  return String(content).trim();
}

// ------------------------------------------------------- image (caller PNG)
async function solveImage({ imageB64, instruction, proxy = '', log = () => {} }, opts = {}) {
  if (!imageB64) throw fail('bad-args', 'image needs { imageB64 } (a base64 PNG/JPEG challenge)');
  const cfg = vlmConfig(opts);
  const b64 = String(imageB64).replace(/^data:[^,]+,/, '');
  const answer = await askVlm(cfg, {
    b64,
    proxy,
    instruction: instruction || 'This is an image captcha. Read the characters/answer it asks for and reply with the answer only, no punctuation, no explanation.',
  });
  log(`image → ${answer.slice(0, 40)}`);
  return { token: answer, ms: 0 };
}

// ------------------------------------------------- recaptcha v2/v3 (HTTP)
const RECAPTCHA_VER = 'NhfdZHzre16wrc2m6BxEdu7J'; // pinned anchor release the fleet captured; override with opts.ver
const xssi = (text) => { try { return JSON.parse(String(text).replace(/^\)\]\}'\s*/, '')); } catch (e) { return null; } };
/** Google's `co`: base64 of `scheme://host:port` — the port is not optional. */
function coOf(origin) {
  const u = new URL(origin);
  return Buffer.from(`${u.protocol}//${u.hostname}:${u.port || (u.protocol === 'https:' ? 443 : 80)}`).toString('base64').replace(/=+$/, '') + '.';
}

async function solveRecaptcha2({ sitekey, url, proxy = '', log = () => {} }, opts = {}) {
  if (!sitekey || !url) throw fail('bad-args', 'recaptcha2-image needs { sitekey, url } (url is the page that hosts the widget)');
  const origin = new URL(url).origin;
  const ver = opts.ver || RECAPTCHA_VER;
  const t0 = Date.now();
  const H = { 'user-agent': UA, referer: origin + '/', 'accept-language': 'en-US,en;q=0.9' };
  const anchor = `https://www.google.com/recaptcha/api2/anchor?ar=1&k=${sitekey}&co=${encodeURIComponent(coOf(origin))}&hl=en&v=${ver}&size=normal&sa=action&anchor-ms=20000&execute-ms=30000&cb=${crypto.randomBytes(8).toString('hex')}`;
  const a = await request(proxy, anchor, { headers: H });
  const tok = /id="recaptcha-token"[^>]*value="([^"]+)"/.exec(a.text);
  if (!tok) throw fail('reactcha-refused', `anchor refused for sitekey ${sitekey} (HTTP ${a.status})`);
  const c = tok[1];
  const reload = await request(proxy, `https://www.google.com/recaptcha/api2/reload?k=${sitekey}`, {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', origin: 'https://www.google.com' }, H),
    body: `v=${ver}&reason=r&c=${encodeURIComponent(c)}&k=${sitekey}&hl=en&size=normal&sa=action&anchor-ms=20000&execute-ms=30000`,
  });
  const j = xssi(reload.text);
  if (!j) throw fail('recaptcha-error', `reload unreadable: ${reload.text.slice(0, 160)}`);
  // Google hands the token straight out whenever it does not want an image round
  if (Array.isArray(j) && j[0] === 'rresp' && typeof j[1] === 'string') return { token: j[1], ms: Date.now() - t0 };

  const spec = Array.isArray(j) ? j[1] : j;
  const p = spec && (spec.p || spec.pd || spec.payload);
  if (!p) throw fail('captcha-error', `challenge without a payload id: ${JSON.stringify(j).slice(0, 200)}`);
  const img = await request(proxy, `https://www.google.com/recaptcha/api2/payload?k=${sitekey}&c=${encodeURIComponent(c)}&p=${encodeURIComponent(p)}`, { headers: H, binary: true });
  const mime = /PNG/.test(img.buf.slice(0, 4).toString('latin1')) ? 'image/png' : 'image/jpeg';
  const read = await askVlm(vlmConfig(opts), {
    b64: img.buf.toString('base64'),
    mime,
    proxy,
    instruction: 'This is a reCAPTCHA image challenge. Answer with a JSON object {"instruction":"<the prompt text>","picks":[<0-based tile indices>]} and nothing else.',
  });
  const m = /\[[\s\S]*\]/.exec(read);
  const picks = (m ? JSON.parse(m[0]) : []) || [];
  if (!picks.length) throw fail('captcha-error', `vision model named no tiles: ${read.slice(0, 120)}`);
  const v = await request(proxy, `https://www.google.com/recaptcha/api2/userverify?k=${sitekey}`, {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', origin: 'https://www.google.com' }, H),
    body: `v=${ver}&c=${encodeURIComponent(c)}&k=${sitekey}&response=${encodeURIComponent(`${p}/${picks.join('/')}`)}`,
  });
  const vj = xssi(v.text);
  log(`reCAPTCHA image round answered (${picks.length} tiles) → ${Array.isArray(vj) ? vj[0] : 'unparsed'}`);
  if (Array.isArray(vj) && vj[0] === 'rresp' && typeof vj[1] === 'string') return { token: vj[1], ms: Date.now() - t0 };
  throw fail('captcha-failed', `image round rejected: ${v.text.slice(0, 160)}`);
}

// ----------------------------------------------------- tencent TCaptcha (HTTP)
const TC_BASE = 'https://turing.captcha.qcloud.com';
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
/** Tencent's PoW: find the nonce whose md5(prefix+nonce) is the target digest. */
function solvePow(prefix, target, maxNonce = 2000000) {
  for (let i = 0; i < maxNonce; i++) {
    const cand = prefix + i;
    if (md5(cand) === target) return cand;
  }
  throw fail('tencent-pow', 'PoW not solved inside 2e6 nonces');
}
const jsonp = (text) => { const m = /^\s*\w+\s*\(\s*([\s\S]*)\s*\)\s*;?\s*$/.exec(String(text)); try { return JSON.parse(m ? m[1] : text); } catch (e) { return null; } };

/**
 * Tencent TCaptcha, protocol side: `cap_union_prehandle` → solve the challenge
 * (a VLM reads the image) → `cap_union_new_verify`.
 *
 * `sitekey` is the tenant's CaptchaAppId — Tencent challenges are bound to it and
 * there is no universal public one. The verify body also carries Tencent's TDC
 * payload (`collect`/`eks`/`tlg`), which their own `tdc.js` produces from a
 * browser fingerprint; pass it in (`opts.collect`/`opts.eks`/`opts.tlg`, or
 * `TCAPTCHA_COLLECT`/`TCAPTCHA_EKS`/`TCAPTCHA_TLG`) when the tenant enforces it,
 * otherwise this throws `tencent-tdc-required` instead of pretending to pass.
 */
async function solveTencent({ sitekey, url = '', proxy = '', log = () => {} }, opts = {}) {
  if (!sitekey) throw fail('bad-args', 'tencent needs { sitekey } = the tenant CaptchaAppId');
  const t0 = Date.now();
  const entry = url || `${TC_BASE}/`;
  const ua = opts.ua || UA;
  const params = new URLSearchParams({
    aid: sitekey, protocol: 'https', accver: '1', showtype: 'popup', ua: Buffer.from(ua).toString('base64'),
    noheader: '1', fb: '1', aged: '0', enableAged: '0', enableDarkMode: '0', grayscale: '1', clientype: '2',
    cap_cd: '', uid: '', lang: 'zh-cn', entry_url: url, elder_captcha: '0', js: '/tgJCap.627c7f42.js',
    login_appid: '', wb: '1', subsid: '1', callback: `_aq_${Math.floor(Math.random() * 899999 + 100000)}`, sess: '',
  });
  const ph = await request(proxy, `${TC_BASE}/cap_union_prehandle?${params}`, { headers: { 'user-agent': ua, referer: entry } });
  const data = jsonp(ph.text);
  const dyn = data && data.data && data.data.dyn_show_info;
  if (!dyn) throw fail('tencent-prehandle', `prehandle gave no challenge (HTTP ${ph.status}): ${ph.text.slice(0, 200)}`);
  const sess = data.sess || '';
  const bg = dyn.bg_elem_cfg || {};
  const size = Array.isArray(bg.size_2d) ? bg.size_2d : [bg.width || 672, bg.height || 480];
  const bgUrl = bg.img_url || '';
  if (!bgUrl) throw fail('tencent-prehandle', 'challenge without a background image');

  const img = await request(proxy, bgUrl.startsWith('http') ? bgUrl : TC_BASE + bgUrl, { headers: { 'user-agent': ua, referer: 'https://turing.captcha.gtimg.com/' }, binary: true });
  const mime = /PNG/.test(img.buf.slice(0, 4).toString('latin1')) ? 'image/png' : 'image/jpeg';
  const read = await askVlm(vlmConfig(opts), {
    b64: img.buf.toString('base64'),
    mime,
    proxy,
    instruction: `This is a Tencent captcha (${size[0]}x${size[1]} px). The task: "${dyn.instruction || ''}". Answer with JSON {"points":[{"x":<px>,"y":<px>}]} giving the pixel coordinates (origin top-left) of the elements to click, in the order asked. Nothing else.`,
  });
  const pts = JSON.parse((/\[[\s\S]*\]/.exec(read) || ['[]'])[0]).map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
  if (!pts.length) throw fail('tencent-answer', `vision model found no target: ${read.slice(0, 120)}`);
  const ans = JSON.stringify(pts.map((p, i) => ({ elem_id: i + 1, type: 'DynAnswerType_POS', data: `${p.x},${p.y}` })));
  const powCfg = (((data.data || {}).comm_captcha_cfg || {}).pow_cfg) || {};
  const powAnswer = powCfg.prefix && powCfg.md5 ? solvePow(powCfg.prefix, powCfg.md5) : '';
  const collect = opts.collect || process.env.TCAPTCHA_COLLECT || '';
  if (!collect) {
    throw fail(
      'tencent-tdc-required',
      'Tencent verify needs the TDC payload (`collect`) that Tencent\'s own tdc.js builds from a browser fingerprint; ' +
        'pass opts.collect/eks/tlg (or TCAPTCHA_COLLECT/TCAPTCHA_EKS/TCAPTCHA_TLG). ' +
        'Without it Tencent answers errorCode 7/9 — a silent pass is impossible.',
    );
  }
  const body = new URLSearchParams({
    ans, sess, pow_answer: powAnswer, pow_calc_time: String(300 + Math.floor(Math.random() * 200)),
    collect, tlg: String(opts.tlg || process.env.TCAPTCHA_TLG || collect.length), eks: opts.eks || process.env.TCAPTCHA_EKS || '',
  });
  const v = await request(proxy, `${TC_BASE}/cap_union_new_verify`, {
    method: 'POST',
    headers: {
      'user-agent': ua, referer: entry, origin: new URL(entry).origin,
      accept: 'application/json, text/javascript, */*; q=0.01', 'content-type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  let vj = null;
  try { vj = JSON.parse(v.text); } catch (e) { vj = null; }
  if (!vj || String(vj.errorCode) !== '0' || !vj.ticket) {
    throw fail('tencent-verify', `verify refused (errorCode ${vj ? vj.errorCode : '?'} ${vj ? vj.errMessage || vj.errMsg || '' : v.text.slice(0, 120)})`);
  }
  log(`tencent ticket ${String(vj.ticket).slice(0, 12)}… randstr=${String(vj.randstr).slice(0, 8)}…`);
  return { token: vj.ticket, randstr: vj.randstr, ms: Date.now() - t0 };
}

// ------------------------------------------------------------------ dispatch
/**
 * @param {{type:string, sitekey?:string, url?:string, proxy?:string, imageB64?:string}} args
 * @returns {Promise<{token:string, ms:number}>}
 */
async function solveCaptcha(args = {}, opts = {}) {
  const { type, sitekey = '', url = '', proxy = '', imageB64, chromePath = '', timeoutMs = DEFAULT_TIMEOUT_MS, log = () => {} } = args;
  const t0 = Date.now();
  switch (String(type || '').toLowerCase()) {
    case 'turnstile':
    case 'cf-turnstile':
      return solveTurnstile({ sitekey, url, proxy, chromePath, timeoutMs, log });
    case 'recaptcha2-image':
    case 'recaptcha':
      return solveRecaptcha2({ sitekey, url, proxy, log }, opts);
    case 'tencent':
      return solveTencent({ sitekey, url, proxy, log }, opts);
    case 'image': {
      const r = await solveImage({ imageB64, proxy, log, instruction: opts.instruction }, opts);
      return { token: r.token, ms: Date.now() - t0 };
    }
    default:
      throw fail('bad-args', `unknown captcha type "${type}" (turnstile | recaptcha2-image | tencent | image)`);
  }
}

module.exports = { solveCaptcha, findChrome };
