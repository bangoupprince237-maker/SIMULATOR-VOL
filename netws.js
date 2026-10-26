// Multijoueur sur votre propre site : se connecte au serveur (WebSocket /ws) et offre à net.js
// la même interface « salon » que sur claude.ai (presence, emit/on, onPeers, join...).
(function () {
  if (window.claude && typeof window.claude.use === 'function') return;   // déjà sur claude.ai
  if (!/^https?:$/.test(location.protocol)) return;                         // fichier ouvert en local : mode solo
  let ws = null, myPeer = null, up = false, retry = 1000;
  const rooms = new Map();   // nom -> état du salon
  const connH = new Set();
  const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';

  function raw(o) { if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(o)); return true; } catch (e) { } } return false; }
  function connect() {
    try { ws = new WebSocket(url); } catch (e) { return later(); }
    ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
    ws.onclose = () => { const was = up; up = false; myPeer = null; if (was) connH.forEach(f => f(false)); rooms.forEach(r => r.connFns.forEach(f => f(false))); later(); };
    ws.onerror = () => { };
  }
  function later() { setTimeout(connect, retry); retry = Math.min(retry * 1.6, 15000); }
  function onMsg(m) {
    if (m.k === 'welcome') {
      myPeer = m.peer; up = true; retry = 1000;
      rooms.forEach(r => { raw({ k: 'join', room: r.name }); if (Object.keys(r.pres).length) raw({ k: 'pres', room: r.name, p: r.pres }); });
      connH.forEach(f => f(true)); rooms.forEach(r => r.connFns.forEach(f => f(true)));
      return;
    }
    const r = rooms.get(typeof m.room === 'string' ? m.room : ''); if (!r) return;
    if (m.k === 'peers') {
      const old = r.others, now = new Map(), joined = [], left = [], updated = [];
      (m.list || []).forEach(x => { const p = mkPeer(x.peer, x.p); now.set(x.peer, p); (old.has(x.peer) ? updated : joined).push(p); });
      old.forEach((p, id) => { if (!now.has(id)) left.push(p); });
      r.others = now; r.fire(joined, left, updated, true);
    } else if (m.k === 'pres') {
      const had = r.others.has(m.peer), p = mkPeer(m.peer, m.p); r.others.set(m.peer, p); r.fire(had ? [] : [p], [], had ? [p] : []);
    } else if (m.k === 'left') {
      const p = r.others.get(m.peer); if (p) { r.others.delete(m.peer); r.fire([], [p], []); }
    } else if (m.k === 'emit') {
      (r.topics.get(m.topic) || []).forEach(f => { try { f({ topic: m.topic, data: m.data, peer: m.peer, by: null, isMe: false, sameTab: false, kind: 'viewer', guest: false }); } catch (e) { } });
    }
  }
  function mkPeer(id, p) { return Object.freeze({ peer: id, by: null, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence: Object.freeze(p && typeof p === 'object' ? p : {}), updatedAt: Date.now() }); }

  function makeRoom(name) {
    const r = { name, pres: {}, others: new Map(), topics: new Map(), peerFns: new Set(), connFns: new Set(), snap: [] };
    const selfPeer = () => Object.freeze({ peer: myPeer || 'moi', by: null, isMe: true, sameTab: true, kind: 'viewer', guest: false, presence: Object.freeze({ ...r.pres }), updatedAt: Date.now() });
    r.fire = (joined, left, updated, withSelf) => {
      r.snap = Object.freeze([selfPeer(), ...r.others.values()]);
      const ch = { peers: r.snap, joined: withSelf ? [r.snap[0], ...joined] : joined, left, updated };
      r.peerFns.forEach(f => { try { f(ch); } catch (e) { console.error(e); } });
    };
    const api = {
      name,
      emit(topic, data) {
        if (!up) return Promise.resolve();
        raw({ k: 'emit', room: name, topic, data });
        (r.topics.get(topic) || []).forEach(f => { try { f({ topic, data, peer: myPeer, by: null, isMe: true, sameTab: true, kind: 'viewer', guest: false }); } catch (e) { } });
        return Promise.resolve();
      },
      on(topic, fn) { if (!r.topics.has(topic)) r.topics.set(topic, []); r.topics.get(topic).push(fn); return () => { r.topics.set(topic, (r.topics.get(topic) || []).filter(x => x !== fn)); }; },
      presence(patch) {
        for (const k in patch) { if (patch[k] === null) delete r.pres[k]; else r.pres[k] = patch[k]; }
        raw({ k: 'pres', room: name, p: r.pres }); return Promise.resolve();
      },
      peers: () => r.snap,
      onPeers(fn) { r.peerFns.add(fn); setTimeout(() => { r.snap = Object.freeze([selfPeer(), ...r.others.values()]); fn({ peers: r.snap, joined: r.snap, left: [], updated: [] }); }, 0); return () => r.peerFns.delete(fn); },
      connected: () => up,
      onConnection(fn) { r.connFns.add(fn); setTimeout(() => fn(up), 0); return () => r.connFns.delete(fn); },
      join(n) { return Promise.resolve(getRoom(n)); },
      leave() { raw({ k: 'leave', room: name }); rooms.delete(name); r.peerFns.clear(); r.topics.clear(); r.connFns.clear(); return Promise.resolve(); },
      sendToClaudeSession() { return Promise.reject({ code: 'claude_unavailable' }); },
      canSendToClaudeSession() { return Promise.resolve('off'); },
    };
    r.api = api; return r;
  }
  function getRoom(name) {
    let r = rooms.get(name);
    if (!r) { r = makeRoom(name); rooms.set(name, r); raw({ k: 'join', room: name }); }
    return r.api;
  }
  window.claude = Object.freeze({ use: n => Promise.resolve(n === 'room' ? getRoom('') : null) });
  connect();
})();
