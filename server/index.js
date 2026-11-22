// Boot: load config + theme, start event source, game, static + WebSocket server.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { normalize } from './normalize.js';
import { Game } from './game.js';
import { SimulatorSource } from './sources/simulator.js';
import { TikTokSource } from './sources/tiktok.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const theme = JSON.parse(fs.readFileSync(path.join(ROOT, 'themes', config.theme + '.json'), 'utf8'));

// Simulator is ALWAYS on (dev panel + chaos). TikTok is optional and can be (re)connected at runtime.
const source = new SimulatorSource();
let tiktok = null;
let liveStatus = { connected: false, source: 'simulator' };
const statusOp = () => ({ op: 'status', ...liveStatus, rate: source.rate });
const game = new Game(theme, config);

// ---- static files (client/ only) ----
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const CLIENT = path.join(ROOT, 'client');
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(CLIENT, p);
  if (!file.startsWith(CLIENT + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

// ---- websocket ----
const wss = new WebSocketServer({ server });
const broadcast = (op) => { const s = JSON.stringify(op); for (const c of wss.clients) if (c.readyState === 1) c.send(s); };

wss.on('connection', (ws) => {
  ws.send(JSON.stringify(current.snapshot()));
  ws.send(JSON.stringify(statusOp()));
  ws.on('message', (buf) => {
    let m; try { m = JSON.parse(buf); } catch { return; }
    if (m.cmd === 'inject') source.inject(m.event ?? {});
    else if (m.cmd === 'chaos') { source.setRate(m.rate); broadcast(statusOp()); }
    else if (m.cmd === 'tiktok') startTikTok(m.username);
    else if (m.cmd === 'tiktokStop') stopTikTok();
    else if (m.cmd === 'reset') { current.destroy(); resetGame(); }
    else if (m.cmd === 'settings') setSetting(m.section, m.key, m.value);
  });
});

// ---- live settings from the dev panel (camera + crowd). Saved into the theme file, sent to every screen (OBS too).
const LIVE = {
  camera: { zoom: [0.5, 1.25], height: [-5, 5], tourEverySec: [0, 600], tourSec: [3, 30] },
  lights: { show: [0, 2] },
  chant: { everySec: [0, 600], groupEverySec: [0, 60], groupSize: [1, 60], supportEverySec: [0, 60], fightGroupBoost: [1, 5] },
};
let saveTimer = null;
function setSetting(section, key, value) {
  const range = LIVE[section]?.[key]; const v = Number(value);
  if (!range || !Number.isFinite(v)) return;
  theme[section] = { ...(theme[section] ?? {}), [key]: Math.min(range[1], Math.max(range[0], v)) };
  broadcast({ op: 'settings', camera: theme.camera ?? {}, chant: theme.chant ?? {}, lights: theme.lights ?? {} });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => fs.writeFileSync(path.join(ROOT, 'themes', config.theme + '.json'), JSON.stringify(theme, null, 2) + '\n'), 800);
}

let current = game;
function wire(g) { g.on('op', broadcast); }
function resetGame() {
  current = new Game(theme, config);
  wire(current);
  broadcast(current.snapshot());
}
wire(game);

// raw -> normalized -> game; also log raw events for replay
const logStream = fs.createWriteStream(path.join(ROOT, 'events.log'), { flags: 'a' });
function onRaw(raw) {
  logStream.write(JSON.stringify(raw) + '\n');
  const ev = normalize(raw);
  if (ev) current.handle(ev);
}
source.on('raw', onRaw);
source.start();

async function stopTikTok() {
  const t = tiktok; tiktok = null;
  if (t) await t.stop();
  liveStatus = { connected: false, source: 'simulator' };
  broadcast(statusOp());
}
async function startTikTok(username) {
  await stopTikTok();
  if (!username) return;
  tiktok = new TikTokSource({ username, signApiKey: config.tiktok?.signApiKey });
  const me = tiktok;
  me.on('raw', onRaw);
  me.on('status', (st) => { if (tiktok !== me) return; liveStatus = st; broadcast(statusOp()); });
  me.start();
}
if (config.source === 'tiktok') startTikTok(config.tiktok?.username);

setInterval(() => broadcast({ op: 'stats', stats: current.stats, avatars: current.avatars.size, queue: current.queue.length }), 1000);

server.listen(config.port, () => console.log(`Game running: http://localhost:${config.port}  (source: ${config.source})\nCapture view: http://localhost:${config.port}/?capture=1`));
