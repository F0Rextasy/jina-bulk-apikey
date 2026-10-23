#!/usr/bin/env node
'use strict';

/**
 * Interactive launcher for the compiled build.
 *
 * The CLI's options stay configurable without reading its source: this launcher
 * asks for them, remembers the answers in `launcher.config.json`, and then runs
 * the CLI with the right flags — including the proxy list, which is the setting
 * people most often need and cannot guess.
 *
 * Usage: node src/launcher.js            (menu)
 *        node src/launcher.js --help
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = path.join(ROOT, 'launcher.config.json');
const CLI = path.join(__dirname, 'cli.js');

const defaults = {
  count: 50,
  proxyFile: process.env['JINA_PROXIES'] || 'proxies.txt',
  model: "jina-embeddings-v4",
  routerBase: 'http://localhost:20128',
  routerPassword: '123456',
};

function loadConfig() {
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync(CONFIG, 'utf8')) };
  } catch (e) {
    return { ...defaults };
  }
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + '\n');
  } catch (e) {
    console.error(`  ! could not write ${path.basename(CONFIG)}: ${e.message}`);
  }
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question, fallback) =>
  new Promise((resolve) => {
    const hint = fallback ? ` [${String(fallback).slice(0, 30)}${String(fallback).length > 30 ? '…' : ''}]` : '';
    rl.question(`  ${question}${hint}: `, (answer) => resolve(answer.trim() || fallback || ''));
  });

function run(args, env = {}) {
  console.log('');
  const res = spawnSync(process.execPath, [CLI, ...args], {
    windowsHide: true,
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (res.status !== 0) console.log(`  ! exited with code ${res.status}`);
}

const BANNER_LOGO = String.raw`
     ██╗██╗███╗   ██╗ █████╗
     ██║██║████╗  ██║██╔══██╗
     ██║██║██╔██╗ ██║███████║
██   ██║██║██║╚██╗██║██╔══██║
╚█████╔╝██║██║ ╚████║██║  ██║
 ╚════╝ ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝
`;

function banner() {
  const cyan = '\x1b[36m';
  const dim = '\x1b[2m';
  const bold = '\x1b[1m';
  const reset = '\x1b[0m';
  const title = 'jina-bulk-apikey';
  const tagline = "no-account trial keys — 10M trial balance, embeddings + rerank + reader";
  const lines = BANNER_LOGO.replace(/^\n/, '').replace(/\n$/, '').split('\n');
  const width = Math.max(...lines.map((l) => [...l].length), [...title].length, [...tagline].length);
  const pad = (s) => s + ' '.repeat(width - [...s].length);
  const inner = width + 4;
  console.log('');
  console.log(`${cyan}╔${'═'.repeat(inner)}╗${reset}`);
  console.log(`${cyan}║${' '.repeat(inner)}║${reset}`);
  for (const line of lines) console.log(`${cyan}║${reset}  ${bold}${pad(line)}${reset}  ${cyan}║${reset}`);
  console.log(`${cyan}║${' '.repeat(inner)}║${reset}`);
  console.log(`${cyan}║${reset}  ${pad(title)}  ${cyan}║${reset}`);
  console.log(`${cyan}║${reset}  ${dim}${pad(tagline)}${reset}  ${cyan}║${reset}`);
  console.log(`${cyan}║${' '.repeat(inner)}║${reset}`);
  console.log(`${cyan}╚${'═'.repeat(inner)}╝${reset}`);
  console.log(`  ${dim}jina-bulk-apikey contributors${reset}`);
  console.log('');
}

async function mintFlow(cfg) {
  cfg.count = parseInt(await ask('How many accounts/keys do you want (any number)', cfg.count), 10) || cfg.count;
  cfg.proxyFile = await ask('Proxy list file (one proxy per line)', cfg.proxyFile);
  cfg.model = await ask('Model used for the live verification', cfg.model);
  saveConfig(cfg);

  if (!fs.existsSync(path.resolve(ROOT, cfg.proxyFile)) && !fs.existsSync(cfg.proxyFile)) {
    console.log(`  ! ${cfg.proxyFile} not found — running WITHOUT a proxy (direct)`);
    console.log('    (put one exit per line there to route through proxies: http://host:port, socks5://host:port or host:port)');
  }
  run(['--count', String(cfg.count), '--model', cfg.model], { ['JINA_PROXIES']: cfg.proxyFile });
}

async function verifyFlow(cfg) {
  cfg.proxyFile = await ask('Proxy list file', cfg.proxyFile);
  saveConfig(cfg);
  run(['--verify-only'], { ['JINA_PROXIES']: cfg.proxyFile });
}

async function screenFlow(cfg) {
  cfg.proxyFile = await ask('Proxy list file to screen', cfg.proxyFile);
  saveConfig(cfg);
  run(['--screen'], { ['JINA_PROXIES']: cfg.proxyFile });
}

async function connectFlow(cfg) {
  const { connectKeysFile, connect9Router } = require('./connect-9router.js');
  cfg.routerBase = await ask('9Router base URL', cfg.routerBase);
  cfg.routerPassword = await ask('9Router password', cfg.routerPassword);
  saveConfig(cfg);
  console.log('');
  try {
    await connectKeysFile({ base: cfg.routerBase, password: cfg.routerPassword });
  } catch (e) {
    if (!/no API keys/.test(e.message)) throw e;
    console.log(`  ! ${e.message}`);
    const apiKey = await ask('Single Jina AI key to register');
    if (apiKey) await connect9Router({ base: cfg.routerBase, password: cfg.routerPassword, apiKey });
  }
}

async function connectFlowOmni(cfg) {
  const { connectKeysFile, connectOmniRoute } = require('./connect-omniroute.js');
  cfg.routerBase = await ask('OmniRoute base URL', cfg.routerBase);
  cfg.routerPassword = await ask('OmniRoute password', cfg.routerPassword);
  saveConfig(cfg);
  console.log('');
  try {
    await connectKeysFile({ base: cfg.routerBase, password: cfg.routerPassword });
  } catch (e) {
    if (!/no API keys/.test(e.message)) throw e;
    console.log(`  ! ${e.message}`);
    const apiKey = await ask('Single Jina AI key to register');
    if (apiKey) await connectOmniRoute({ base: cfg.routerBase, password: cfg.routerPassword, apiKey });
  }
}

async function main() {
  const cfg = loadConfig();
  if (process.argv.includes('--connect-9router')) {
    await connectFlow(cfg);
    rl.close();
    return;
  }

  if (process.argv.includes('--connect-omniroute')) {
    await connectFlowOmni(cfg);
    rl.close();
    return;
  }
  banner();
  console.log('  1) Mint keys      — create one account per key and verify each with a live chat call');
  console.log('  2) Verify keys    — re-check every key in keys.txt with a live chat call');
  console.log('  3) Screen proxies — test your proxy list for exits that reach Jina AI');
  console.log('  4) Settings       — show what this launcher remembers');
  console.log('  5) Help           — CLI options and notes');
  console.log('  6) Connect to 9Router — register the keys in keys.txt with a local 9Router');
  console.log('  7) Connect to OmniRoute — register the keys in keys.txt with a local OmniRoute');
  console.log('  q) Quit\n');
  const choice = (await ask('Choose', '1')).toLowerCase();

  if (choice === '1') await mintFlow(cfg);
  else if (choice === '2') await verifyFlow(cfg);
  else if (choice === '3') await screenFlow(cfg);
  else if (choice === '4') console.log('\n' + JSON.stringify(cfg, null, 2));
  else if (choice === '5') run(['--help']);
  else if (choice === '6') await connectFlow(cfg);
  else if (choice === '7') await connectFlowOmni(cfg);
  rl.close();
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Interactive launcher: run `node src/launcher.js` and pick a menu item.');
  process.exit(0);
}

main().catch((e) => {
  console.error('[fatal]', e.message);
  process.exit(1);
});
