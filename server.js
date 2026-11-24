import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { Room, TICK_MS } from './public/js/shared.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const PUB = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/') url = '/index.html';
  if (url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, players: room.players.size, state: room.state })); }
  const file = path.normalize(path.join(PUB, url));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});

const clients = new Map();
const room = new Room({
  send: (id, m) => { const c = clients.get(id); if (c && c.readyState === 1) c.send(JSON.stringify(m)); },
  broadcast: (m) => { const s = JSON.stringify(m); for (const c of clients.values()) if (c.readyState === 1) c.send(s); },
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
let seq = 0;
wss.on('connection', (ws, req) => {
  const id = 'p' + (++seq);
  let joined = false, budget = 0, windowStart = Date.now();
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (data) => {
    const now = Date.now();
    if (now - windowStart > 1000) { windowStart = now; budget = 0; }
    if (++budget > 200) return; // flood guard
    let m; try { m = JSON.parse(data); } catch { return; }
    if (!joined) {
      if (m && m.t === 'hello') { joined = true; clients.set(id, ws); room.addPlayer(id, m.name); console.log(`[join] ${id} ${m.name} (${req.headers['x-forwarded-for'] || req.socket.remoteAddress})`); }
      return;
    }
    room.handle(id, m);
  });
  ws.on('close', () => { if (joined) { clients.delete(id); room.removePlayer(id); console.log(`[leave] ${id}`); } });
  ws.on('error', () => {});
});

setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); } }, 15000);
setInterval(() => { try { room.tick(); } catch (e) { console.error('tick error', e); } }, TICK_MS);

server.listen(PORT, () => console.log(`Strikepoint server on http://localhost:${PORT}`));
