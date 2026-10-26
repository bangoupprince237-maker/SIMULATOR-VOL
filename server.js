// Serveur du simulateur de vol : sert le jeu (dossier public/) et relaie le multijoueur en direct (WebSocket sur /ws).
// Aucune dépendance à installer : Node.js 18 ou plus suffit.  Démarrer : node server.js
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname, PUB = path.join(__dirname, 'public');
const MAX_MSG = 9000, MAX_PER_ROOM = 80, MAX_ROOMS_PER_CLIENT = 16;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8' };

// ---------- Fichiers du jeu ----------
const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/sante') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok ' + clients.size + ' joueur(s)'); }
  if (p.endsWith('/')) p += 'index.html';
  // on cherche le fichier dans public/, puis à la racine (si GitHub a aplati les dossiers)
  const base = path.basename(p), tries = [path.join(PUB, p), path.join(ROOT, p), path.join(PUB, base), path.join(ROOT, base), path.join(PUB, 'js', base), path.join(ROOT, 'js', base)];
  const ext = path.extname(base).toLowerCase();
  if (!TYPES[ext]) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Page introuvable'); }
  (function next(i) {
    if (i >= tries.length) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Page introuvable : ' + p); }
    const file = path.normalize(tries[i]);
    if (!file.startsWith(ROOT + path.sep) || base === 'server.js') return next(i + 1);
    fs.readFile(file, (err, data) => {
      if (err) return next(i + 1);
      res.writeHead(200, { 'Content-Type': TYPES[ext], 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  })(0);
});

// ---------- WebSocket minimal (texte seulement) ----------
const clients = new Set();
server.on('upgrade', (req, sock) => {
  if ((req.url || '').split('?')[0] !== '/ws' || (req.headers.upgrade || '').toLowerCase() !== 'websocket') return sock.destroy();
  const key = req.headers['sec-websocket-key']; if (!key) return sock.destroy();
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const c = { sock, id: crypto.randomBytes(6).toString('hex'), rooms: new Map(), buf: Buffer.alloc(0), frag: [], alive: true, tokens: 80, last: Date.now() };
  clients.add(c);
  send(c, { k: 'welcome', peer: c.id });
  sock.on('data', d => { c.buf = Buffer.concat([c.buf, d]); if (c.buf.length > 64 * 1024) return drop(c); parse(c); });
  sock.on('close', () => drop(c)); sock.on('error', () => drop(c));
});
function frame(op, payload) {
  const n = payload.length; let h;
  if (n < 126) { h = Buffer.alloc(2); h[1] = n; }
  else if (n < 65536) { h = Buffer.alloc(4); h[1] = 126; h.writeUInt16BE(n, 2); }
  else { h = Buffer.alloc(10); h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); }
  h[0] = 0x80 | op; return Buffer.concat([h, payload]);
}
function sendRaw(c, str) { if (!c.dead && c.sock.writable) c.sock.write(frame(1, Buffer.from(str))); }
function send(c, obj) { sendRaw(c, JSON.stringify(obj)); }
function parse(c) {
  for (;;) {
    const b = c.buf; if (b.length < 2) return;
    const fin = b[0] & 0x80, op = b[0] & 0x0f, masked = b[1] & 0x80; let len = b[1] & 0x7f, off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; const big = b.readBigUInt64BE(2); if (big > 65536n) return drop(c); len = Number(big); off = 10; }
    if (!masked) return drop(c);
    if (b.length < off + 4 + len) return;
    const mask = b.slice(off, off + 4), data = Buffer.from(b.slice(off + 4, off + 4 + len));
    for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
    c.buf = b.slice(off + 4 + len);
    if (op === 8) { try { c.sock.write(frame(8, Buffer.alloc(0))); } catch (e) { } return drop(c); }
    if (op === 9) { c.sock.write(frame(10, data)); continue; }
    if (op === 10) { c.alive = true; continue; }
    if (op === 1 || op === 0) { c.frag.push(data); if (fin) { const msg = Buffer.concat(c.frag).toString('utf8'); c.frag = []; if (msg.length <= MAX_MSG) onMessage(c, msg); } }
  }
}
function drop(c) {
  if (c.dead) return; c.dead = true; clients.delete(c);
  for (const name of c.rooms.keys()) leaveRoom(c, name);
  try { c.sock.destroy(); } catch (e) { }
}
// connexions mortes : ping toutes les 25 s
setInterval(() => { for (const c of clients) { if (!c.alive) { drop(c); continue; } c.alive = false; try { c.sock.write(frame(9, Buffer.alloc(0))); } catch (e) { drop(c); } } }, 25000);

// ---------- Salons ----------
const rooms = new Map();   // nom -> Map(id -> client)
const okRoom = n => n === '' || /^[a-z0-9][a-z0-9_.-]{0,47}$/.test(n);
const okTopic = t => /^[a-z][a-z0-9_.-]{0,47}$/.test(t);
function members(name) { let m = rooms.get(name); if (!m) { m = new Map(); rooms.set(name, m); } return m; }
function joinRoom(c, name) {
  if (!okRoom(name)) return;
  if (c.rooms.has(name)) return sendList(c, name);
  if (c.rooms.size >= MAX_ROOMS_PER_CLIENT) return send(c, { k: 'err', room: name, code: 'limit_reached' });
  const m = members(name); if (m.size >= MAX_PER_ROOM) return send(c, { k: 'err', room: name, code: 'limit_reached' });
  m.set(c.id, c); c.rooms.set(name, {});
  sendList(c, name);
}
function sendList(c, name) {
  const m = members(name), list = [];
  for (const [id, o] of m) if (id !== c.id) list.push({ peer: id, p: o.rooms.get(name) || {} });
  send(c, { k: 'peers', room: name, list });
}
function leaveRoom(c, name) {
  if (!c.rooms.has(name)) return; c.rooms.delete(name);
  const m = rooms.get(name); if (!m) return; m.delete(c.id);
  if (!m.size) rooms.delete(name);
  else { const s = JSON.stringify({ k: 'left', room: name, peer: c.id }); for (const o of m.values()) sendRaw(o, s); }
}
function broadcast(c, name, obj) {
  const m = rooms.get(name); if (!m) return; const s = JSON.stringify(obj);
  for (const o of m.values()) if (o !== c) sendRaw(o, s);
}
function onMessage(c, txt) {
  // limite de débit : environ 40 messages par seconde
  const now = Date.now(); c.tokens = Math.min(80, c.tokens + (now - c.last) * 0.04); c.last = now;
  if (c.tokens < 1) return; c.tokens -= 1;
  let m; try { m = JSON.parse(txt); } catch (e) { return; }
  if (!m || typeof m !== 'object') return;
  const room = typeof m.room === 'string' ? m.room : '';
  switch (m.k) {
    case 'join': return joinRoom(c, room);
    case 'leave': return leaveRoom(c, room);
    case 'pres': {
      if (!c.rooms.has(room) || !m.p || typeof m.p !== 'object' || Array.isArray(m.p)) return;
      c.rooms.set(room, m.p);
      return broadcast(c, room, { k: 'pres', room, peer: c.id, p: m.p });
    }
    case 'emit': {
      if (!c.rooms.has(room) || typeof m.topic !== 'string' || !okTopic(m.topic)) return;
      return broadcast(c, room, { k: 'emit', room, peer: c.id, topic: m.topic, data: m.data });
    }
  }
}

server.listen(PORT, () => console.log('Simulateur en ligne sur le port ' + PORT + '  →  http://localhost:' + PORT));
