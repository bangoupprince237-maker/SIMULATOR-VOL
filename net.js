// En ligne : plusieurs joueurs dans le même ciel (présence en direct, discussion, combat entre joueurs)
(function () {
  const P = SIM.P, D2R = SIM.D2R, clamp = SIM.clamp;
  const N = SIM.net = { on: false, peers: new Map(), myPeer: null, pvp: false, roomName: '', kills: 0, chatLog: [] };
  const $ = id => document.getElementById(id);
  let room = null, lobby = null, offs = [], scene, toast = () => { }, say = () => { }, sendT = 0, lastSent = '', lastShotFrom = {};
  const lblV = new THREE.Vector3();
  const store = { get(k, d) { try { const v = localStorage.getItem('sim.' + k); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('sim.' + k, v); } catch (e) { } } };
  const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯]/g, '').slice(0, n);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const hue = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 360; };
  N.name = clean(store.get('nick', 'Pilote-' + Math.floor(1000 + Math.random() * 9000)), 16);

  const TYPE_NAMES = { A319: 'A319', A320: 'A320', A321: 'A321', gros: 'Gros porteur', jumbo: 'Jumbo', super: 'Super-jumbo', jet: 'Jet privé', militaire: 'Transport militaire', chasseur: 'Rafale', heli: 'Hélicoptère' };

  // ---------- Connexion ----------
  N.init = function (sc, hooks) {
    scene = sc; if (hooks) { toast = hooks.toast || toast; say = hooks.say || say; }
    status('Connexion…');
    const c = window.claude;
    if (!c || typeof c.use !== 'function') { status('Mode solo : ouvrez le jeu depuis son adresse internet (http…) pour jouer à plusieurs.'); return; }
    c.use('room').then(r => {
      if (!r) { status('Mode solo : le multijoueur n\'est pas disponible ici.'); return; }
      lobby = r; bind(r, '');
      r.onConnection(ok => { N.on = ok; status(ok ? (N.roomName ? 'En ligne · salon « ' + N.roomName + ' »' : 'En ligne · salon public') : 'Reconnexion…'); },
        e => { N.on = false; status('Mode solo (' + e.code + ').'); });
    }).catch(() => status('Mode solo.'));
  };
  function status(t) { const e = $('netStatus'); if (e) e.textContent = t; const b = $('netInfo'); if (b) b.textContent = N.on ? 'en ligne' : 'solo'; }

  function bind(r, name) {
    offs.forEach(f => { try { f(); } catch (e) { } }); offs = [];
    clearGhosts(); room = r; N.roomName = name;
    offs.push(r.onPeers(ch => onPeers(ch)));
    offs.push(r.on('chat', m => onChat(m)));
    offs.push(r.on('shot', m => onShot(m)));
    offs.push(r.on('hit', m => onHit(m)));
    offs.push(r.on('down', m => onDown(m)));
    lastSent = ''; sendNow();
    status(N.on || r.connected() ? (name ? 'En ligne · salon « ' + name + ' »' : 'En ligne · salon public') : 'Connexion…');
    renderList();
  }
  N.joinRoom = async function (code) {
    if (!lobby) return toast('Le multijoueur n\'est pas connecté.');
    code = String(code || '').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 40);
    if (!code) return N.leaveRoom();
    try {
      if (room && room !== lobby) await room.leave();
      lobby.presence({ x: null, y: null, z: null, n: N.name, salon: 1 });
      const r = await lobby.join('vol-' + code); bind(r, code);
      toast('Vous êtes dans le salon « ' + code + ' ». Donnez ce nom à vos amis pour qu\'ils vous rejoignent.', 5000);
    } catch (e) { toast('Impossible d\'entrer dans ce salon (' + (e && e.code || 'erreur') + ').'); }
  };
  N.leaveRoom = async function () {
    if (!lobby) return; if (room && room !== lobby) { try { await room.leave(); } catch (e) { } }
    lobby.presence({ salon: null }); bind(lobby, ''); toast('Retour au salon public.');
  };
  N.setName = function (n) { N.name = clean(n, 16).trim() || N.name; store.set('nick', N.name); lastSent = ''; renderList(); };

  // ---------- Ce que j'envoie (mon avion, environ 6 fois par seconde) ----------
  const r1 = v => Math.round(v * 10) / 10, r3 = v => Math.round(v * 1000) / 1000;
  function myState() {
    const V = SIM.view, T = SIM.troops, W = SIM.war;
    const hv = P.V * Math.cos(P.gamma || 0);
    const s = { n: N.name, t: V.myType, l: V.myLiv, ps: (W && W.paint) || 'gris', k: W && W.SIZES && W.SIZES[W.size] ? W.SIZES[W.size].k : 1,
      x: r1(P.x), y: r1(P.y), z: r1(P.z), h: r3(P.psi), p: r3(P.theta), r: r3(P.phi),
      vx: r1(Math.sin(P.psi) * hv), vy: r1(P.V * Math.sin(P.gamma || 0)), vz: r1(-Math.cos(P.psi) * hv),
      kt: Math.round(((P.ias || P.V) / 0.5144) || 0), ft: Math.round((P.y || 0) / 0.3048), g: r1(P.gearPos == null ? 1 : P.gearPos), gr: P.onGround ? 1 : 0,
      d: P.crashed ? 1 : 0, m: W && W.truckMode ? 'c' : T && T.active ? 'p' : 'v', pv: N.pvp ? 1 : 0, sc: N.kills };
    if (T && T.active && T.me) { const u = T.me; s.f = { x: r1(u.x), y: r1(u.y), z: r1(u.z), h: r3(u.psi), u: u.kind, w: u.weapon, c: u.crouch ? 1 : 0, o: u.prone ? 1 : 0, s: r1(u.spd || 0), d: u.dead ? 1 : 0 }; }
    return s;
  }
  function sendNow() {
    if (!room) return; const s = myState(), j = JSON.stringify(s);
    if (j === lastSent) return; lastSent = j;
    room.presence(s).catch(() => { });
  }

  // ---------- Les autres joueurs ----------
  function onPeers(ch) {
    if (!ch) return;
    for (const p of ch.peers) if (p.sameTab) N.myPeer = p.peer;
    ch.joined.forEach(p => { if (!p.isMe && ch.joined.length < 6 && p.presence && p.presence.n) toast('✈ ' + clean(p.presence.n, 16) + ' a rejoint le ciel.', 2500); });
    ch.left.forEach(p => { const g = N.peers.get(p.peer); if (g) { removeGhost(g); N.peers.delete(p.peer); toast((g.name || 'Un joueur') + ' a quitté la partie.', 2200); } });
    const seen = new Set();
    for (const p of ch.peers) {
      if (p.sameTab || p.kind !== 'viewer') continue; seen.add(p.peer);
      const s = p.presence || {}; if (typeof s.x !== 'number') { const og = N.peers.get(p.peer); if (og) { removeGhost(og); N.peers.delete(p.peer); } continue; }
      let g = N.peers.get(p.peer);
      if (!g) { g = { peer: p.peer, isPeer: true, alive: true, kind: 'joueur', r: 22, x: s.x, y: s.y, z: s.z, psi: 0, gamma: 0, V: 0, dx: s.x, dy: s.y, dz: s.z }; N.peers.set(p.peer, g); }
      if (g.s === s) continue;
      g.s = s; g.rt = performance.now() / 1000; g.guest = p.guest;
      g.name = clean(s.n, 16) || 'Joueur'; g.hue = hue(p.peer);
      g.sx = num(s.x, g.x); g.sy = num(s.y, g.y); g.sz = num(s.z, g.z);
      g.vx = clamp(num(s.vx, 0), -900, 900); g.vy = clamp(num(s.vy, 0), -400, 400); g.vz = clamp(num(s.vz, 0), -900, 900);
      g.psi = num(s.h, 0); g.V = Math.hypot(g.vx, g.vy, g.vz); g.gamma = Math.atan2(g.vy, Math.hypot(g.vx, g.vz) || 1);
      g.name2 = (s.m === 'p' ? 'à pied' : s.m === 'c' ? 'camion' : TYPE_NAMES[s.t] || 'avion');
      const wasDead = g.dead; g.dead = !!s.d; g.alive = !g.dead && s.m === 'v' && !s.gr;
      if (g.dead && !wasDead && g.model) { SIM.boom.small(g.x, g.y, g.z, 1.2); g.model.root.visible = false; }
      ensureModel(g);
    }
    for (const [k, g] of N.peers) if (!seen.has(k)) { removeGhost(g); N.peers.delete(k); }
    renderList();
  }
  function clearGhosts() { for (const g of N.peers.values()) removeGhost(g); N.peers.clear(); }
  function removeGhost(g) { if (g.model) scene.remove(g.model.root); if (g.av) scene.remove(g.av.o); g.model = null; g.av = null; }

  function ensureModel(g) {
    const s = g.s, key = [s.t, s.l, s.ps].join('|');
    if (g.key !== key) {
      if (g.model) scene.remove(g.model.root); g.model = null; g.key = key;
      try {
        if (s.t === 'heli') {
          const m = SIM.life.heliModel(clean(s.l, 20) || 'armee'), root = new THREE.Group(); root.add(m); root.rotation.order = 'YXZ';
          g.model = { root, heli: m.userData };
        } else if (s.t === 'chasseur') {
          g.model = SIM.buildFighter({ style: ['gris', 'desert', 'noir', 'rouge'].includes(s.ps) ? s.ps : 'gris' });
        } else {
          const ok = ['A319', 'A320', 'A321', 'gros', 'jumbo', 'super', 'jet', 'militaire'];
          g.model = SIM.buildAircraft(clean(s.l, 20) || 'sanaga', true, ok.includes(s.t) ? s.t : 'A320');
        }
        g.model.root.rotation.order = 'YXZ'; scene.add(g.model.root);
      } catch (e) { g.model = null; }
    }
    if (g.model) g.model.root.scale.setScalar(s.t === 'chasseur' ? clamp(num(s.k, 1.3), 0.5, 2.5) : 1);
    // soldat visible quand le joueur est à pied
    if (s.m === 'p' && s.f) {
      const T = SIM.troops, f = s.f, kind = ['mil', 'cmdMil', 'agent', 'veste', 'bir'].includes(f.u) ? f.u : 'mil', wp = T._W && T._W[f.w] ? f.w : 'carabine';
      if (g.av && g.av.kind !== kind) { scene.remove(g.av.o); g.av = null; }
      if (!g.av && T._make) { try { g.av = T._make(kind, wp, num(f.x, g.x), num(f.z, g.z)); g.av.fx = g.av.x; g.av.fz = g.av.z; } catch (e) { g.av = null; } }
      if (g.av && g.av.weapon !== wp && T._setW) { try { T._setW(g.av, wp); } catch (e) { } }
    } else if (g.av) { scene.remove(g.av.o); g.av = null; }
  }

  // ---------- Boucle ----------
  N.update = function (dt, t) {
    sendT -= dt; if (sendT <= 0) { sendT = 0.16; sendNow(); }
    const now = performance.now() / 1000;
    for (const g of N.peers.values()) {
      const s = g.s; if (!s) continue;
      const age = Math.min(now - g.rt, 1.5), moving = !s.gr && s.m === 'v';
      const px = g.sx + (moving ? g.vx * age : 0), py = g.sy + (moving ? g.vy * age : 0), pz = g.sz + (moving ? g.vz * age : 0);
      const far = Math.hypot(px - g.dx, py - g.dy, pz - g.dz) > 600, k = far ? 1 : Math.min(1, dt * 6);
      g.dx += (px - g.dx) * k; g.dy += (py - g.dy) * k; g.dz += (pz - g.dz) * k;
      g.x = g.dx; g.y = g.dy; g.z = g.dz;
      if (g.model) {
        const R = g.model.root, vis = !g.dead && s.m === 'v';
        R.visible = vis;
        if (vis) {
          R.position.set(g.x, g.y, g.z);
          g.ry = g.ry == null ? g.psi : g.ry + SIM.wrap((g.psi - g.ry) / D2R) * D2R * Math.min(1, dt * 6);
          R.rotation.set(num(s.p, 0), -g.ry, -num(s.r, 0), 'YXZ');
          if (g.model.heli) { const u = g.model.heli; if (u.rot) u.rot.rotation.y += 25 * dt; if (u.tr) u.tr.rotation.x += 55 * dt; }
          else if (g.model.update) { try { g.model.update({ flapPos: 0, ail: 0, elev: 0, rud: 0, spoil: 0, gearPos: clamp(num(s.g, 1), 0, 1), n1: [0.7, 0.7], dt, t, wheelV: 0, steer: 0, lights: { nav: true, strobe: true, beacon: true, landing: s.ft < 10000 } }); } catch (e) { } }
        }
      }
      if (g.av && s.f) {
        const f = s.f, a = g.av, kk = Math.min(1, dt * 8);
        a.x += (num(f.x, a.x) - a.x) * kk; a.z += (num(f.z, a.z) - a.z) * kk; a.y = SIM.groundH(a.x, a.z);
        a.psi += SIM.wrap((num(f.h, 0) - a.psi) / D2R) * D2R * kk; a.spd = num(f.s, 0); a.crouch = !!f.c; a.prone = !!f.o; a.dead = !!f.d;
        try { SIM.troops._pose(a, dt); } catch (e) { }
        if (!a.dead) { a.o.position.set(a.x, a.y, a.z); a.o.rotation.set(0, -a.psi, 0, 'YXZ'); }
      }
    }
  };

  // ---------- Étiquettes au-dessus des autres joueurs ----------
  N.labels = function (cam) {
    const box = $('netLbls'); if (!box) return;
    const hide = box.style.display === 'none';
    cam.updateMatrixWorld();
    const list = [...N.peers.values()].filter(g => g.s && !hide), w = innerWidth, h = innerHeight;
    while (box.children.length < list.length) { const d = document.createElement('div'); d.className = 'nlbl'; box.appendChild(d); }
    for (let i = 0; i < box.children.length; i++) {
      const d = box.children[i], g = list[i]; if (!g) { d.style.display = 'none'; continue; }
      const s = g.s, onFoot = s.m === 'p' && g.av, ax = onFoot ? g.av.x : g.x, ay = onFoot ? g.av.y + 2.2 : g.y + 8, az = onFoot ? g.av.z : g.z;
      const dist = Math.hypot(ax - cam.position.x, ay - cam.position.y, az - cam.position.z);
      lblV.set(ax, ay, az).applyMatrix4(cam.matrixWorldInverse);
      if (lblV.z > -0.5 || dist > 400000) { d.style.display = 'none'; continue; }
      lblV.applyMatrix4(cam.projectionMatrix);
      if (Math.abs(lblV.x) > 1.05 || Math.abs(lblV.y) > 1.05) { d.style.display = 'none'; continue; }
      d.style.display = ''; d.style.transform = `translate(${((lblV.x + 1) / 2 * w).toFixed(0)}px,${((1 - lblV.y) / 2 * h).toFixed(0)}px) translate(-50%,-100%)`;
      d.style.borderColor = `hsl(${g.hue},90%,65%)`;
      const txt = `${g.dead ? '✖ ' : '▼ '}${g.name} · ${g.name2}${s.m === 'v' && !s.gr ? ' · ' + num(s.ft, 0) + ' ft' : ''} · ${dist < 1000 ? Math.round(dist) + ' m' : (dist / 1000).toFixed(1) + ' km'}${s.pv ? ' ⚔' : ''}`;
      if (d.textContent !== txt) d.textContent = txt;
    }
  };

  // ---------- Liste des joueurs ----------
  function nearestAirport(x, z) { let b = null, bd = 1e12; SIM.AIRPORTS.forEach(a => { const d = Math.hypot(a.x - x, a.z - z); if (d < bd) { bd = d; b = a; } }); return b; }
  function renderList() {
    const el = $('netList'); if (!el) return;
    const list = [...N.peers.values()].filter(g => g.s);
    const cnt = $('netCount'); if (cnt) cnt.textContent = (list.length + 1) + ' joueur' + (list.length ? 's' : '');
    el.textContent = '';
    const me = document.createElement('div'); me.className = 'np me'; me.textContent = '● ' + N.name + ' (vous)' + (N.kills ? ' · ' + N.kills + ' victoire' + (N.kills > 1 ? 's' : '') : ''); el.appendChild(me);
    if (!list.length) { const e = document.createElement('div'); e.className = 'np'; e.style.opacity = '.7'; e.textContent = N.on ? 'Personne d\'autre pour l\'instant. Partagez la page à vos amis.' : 'Pas encore connecté.'; el.appendChild(e); return; }
    list.forEach(g => {
      const s = g.s, row = document.createElement('div'); row.className = 'np';
      const a = nearestAirport(g.x, g.z), where = s.gr || s.m !== 'v' ? 'au sol près de ' + (a ? a.city : '?') : num(s.ft, 0) + ' ft · ' + num(s.kt, 0) + ' kt';
      const lab = document.createElement('span'); lab.style.color = `hsl(${g.hue},90%,70%)`;
      lab.textContent = '● ' + g.name + (g.guest ? ' (invité)' : '') + ' — ' + g.name2 + ', ' + (g.dead ? 'abattu / accidenté' : where) + (num(s.sc, 0) ? ' · ' + num(s.sc, 0) + ' victoire(s)' : '');
      const b = document.createElement('button'); b.textContent = 'Le rejoindre'; b.className = 'mini'; b.onclick = () => N.joinPeer(g.peer);
      row.appendChild(lab); row.appendChild(b); el.appendChild(row);
    });
  }
  N.renderList = renderList;

  // se placer à côté d'un autre joueur
  N.joinPeer = function (peer) {
    const g = N.peers.get(peer); if (!g || !g.s) return;
    const s = g.s;
    if (s.gr || s.m !== 'v' || g.dead) {
      const a = nearestAirport(g.x, g.z); if (!a) return;
      const sel = $('dep'); sel.value = a.id; sel.dispatchEvent(new Event('change'));
      toast(g.name + ' est au sol près de ' + a.city + '. Vous êtes placé sur cet aéroport.', 4500); return;
    }
    if (P.heli) return toast('Pour voler en patrouille, prenez un avion (Votre avion → Type), puis cliquez de nouveau sur « Le rejoindre ».', 5000);
    const back = 350, side = 60, c = Math.cos(g.psi), sn = Math.sin(g.psi);
    const x = g.x - sn * back + c * side, z = g.z + c * back + sn * side, y = Math.max(g.y, SIM.groundH(x, z) + 300);
    const V = clamp(g.V || 120, 75, 400);
    Object.assign(P, { x, z, y, psi: g.psi, theta: 0.03, phi: 0, gamma: 0, V, onGround: false, gearDown: false, gearPos: 0, flapSel: 0, flapPos: 0,
      thr: 0.7, rev: false, pbrk: false, brake: false, brakeMax: false, parked: false, boarding: false, doorsClosed: true, autoTaxi: null, landed: false, crashed: false, belly: false, airTime: 100, lawB: 1, liftOn: false, lift: 0, n1: [0.7, 0.7], eng: [true, true], ci: {} });
    Object.assign(P.ap, { on: false, athr: false, full: false, srs: false });
    if (SIM.atc) { SIM.atc.q.length = 0; SIM.atc.st = 99; }
    SIM.view.clearFx(); SIM.world.terrain.rebuild(P.x, P.z, true); if (SIM.nature.rebuild) SIM.nature.rebuild(P.x, P.z, true);
    $('over') && ($('over').hidden = true);
    toast('Vous volez en patrouille à droite de ' + g.name + '. Gardez la même vitesse (' + Math.round(V / 0.5144) + ' kt).', 5000);
  };

  // ---------- Discussion ----------
  N.chat = function (txt) {
    txt = clean(txt, 140).trim(); if (!txt) return;
    if (!room) return toast('Pas connecté : la discussion est indisponible.');
    room.emit('chat', { n: N.name, m: txt }).catch(e => toast(e && e.code === 'not_permitted' ? 'Vous ne pouvez pas écrire ici : demandez au propriétaire un accès « contributeur ».' : 'Message non envoyé.'));
  };
  function onChat(m) {
    const d = m.data || {}, n = clean(d.n, 16) || 'Joueur', t = clean(d.m, 140); if (!t) return;
    N.chatLog.push({ n, t, me: m.isMe && m.sameTab, h: m.sameTab ? 200 : hue(m.peer), at: Date.now() }); if (N.chatLog.length > 40) N.chatLog.shift();
    drawChat(); if (!m.sameTab) say(n + ' dit : ' + t);
  }
  function drawChat() {
    const box = $('netChat'), body = $('netChatBody'); if (!box || !body) return; body.textContent = '';
    N.chatLog.slice(-7).forEach(c => { const d = document.createElement('div'); const b = document.createElement('b'); b.textContent = c.n + ' : '; b.style.color = `hsl(${c.h},90%,72%)`; d.appendChild(b); d.appendChild(document.createTextNode(c.t)); body.appendChild(d); });
    box.hidden = !N.chatLog.length; clearTimeout(drawChat.t); box.classList.remove('fade'); drawChat.t = setTimeout(() => box.classList.add('fade'), 15000);
  }

  // ---------- Combat entre joueurs (missiles du Rafale) ----------
  N.setPvp = function (on) { N.pvp = !!on; lastSent = ''; toast(on ? 'Combat entre joueurs ACTIVÉ : vous pouvez viser les autres Rafale qui l\'ont aussi activé (⚔), et eux vous.' : 'Combat entre joueurs coupé : personne ne peut vous abattre.', 4500); };
  // cibles possibles pour le Rafale : les joueurs en vol qui ont aussi activé le combat
  N.targets = function () { if (!N.pvp) return []; return [...N.peers.values()].filter(g => g.s && g.s.pv && g.alive && g.s.m === 'v'); };
  N.onLaunch = function (m) {
    if (!room || !m.target || !m.target.isPeer) return;
    m.pvpTo = m.target.peer;
    room.emit('shot', { to: m.target.peer, x: Math.round(m.x), y: Math.round(m.y), z: Math.round(m.z), vx: Math.round(m.dir.x * m.spd), vy: Math.round(m.dir.y * m.spd), vz: Math.round(m.dir.z * m.spd), n: N.name }).catch(() => { });
  };
  N.onPeerHit = function (g) { if (room) room.emit('hit', { to: g.peer, n: N.name }).catch(() => { }); };
  function onShot(m) {
    if (m.sameTab) return; const d = m.data || {};
    const shooter = N.peers.get(m.peer), toMe = d.to === N.myPeer;
    if (toMe && (!N.pvp || P.crashed || P.onGround || SIM.troops.active)) return;
    const tgt = toMe ? 'player' : N.peers.get(d.to); if (!tgt) return;
    const sx = num(d.x, 0), sy = num(d.y, 0), sz = num(d.z, 0);
    if (Math.hypot(sx - P.x, sz - P.z) > 120000 && !toMe) return;
    SIM.war.launchExt && SIM.war.launchExt('peer', sx, sy, sz, { x: num(d.vx, 0), y: num(d.vy, 0), z: num(d.vz, 0) }, tgt, { cs: clean(d.n, 16), from: m.peer, cosmetic: !toMe });
    if (toMe) { lastShotFrom[m.peer] = performance.now(); toast('⚠ MISSILE ! ' + (clean(d.n, 16) || (shooter && shooter.name) || 'Un joueur') + ' a tiré sur vous ! Leurres : touche Retour arrière.', 4000); say('Missile, missile'); }
  }
  function onHit(m) {
    if (m.sameTab) return; const d = m.data || {};
    if (d.to !== N.myPeer || !N.pvp || P.crashed || P.onGround) return;
    // mon propre calcul fait foi ; si le tir ne m'est jamais parvenu, l'impact annoncé compte
    const t0 = lastShotFrom[m.peer]; if (t0 && performance.now() - t0 < 45000) return;
    N.downBy(m.peer, clean(d.n, 16));
  }
  N.downBy = function (peer, name) {
    if (P.crashed) return;
    const g = N.peers.get(peer); name = name || (g && g.name) || 'un joueur';
    if (room) room.emit('down', { by: peer, n: N.name }).catch(() => { });
    SIM.war.shotDownExt && SIM.war.shotDownExt('Abattu par le missile de ' + name + ' !');
  };
  function onDown(m) {
    if (m.sameTab) return; const d = m.data || {};
    const n = clean(d.n, 16) || 'Un joueur';
    if (d.by === N.myPeer) { N.kills++; lastSent = ''; toast('✔ Vous avez abattu ' + n + ' ! (' + N.kills + ' victoire' + (N.kills > 1 ? 's' : '') + ')', 4000); say('Joueur abattu'); renderList(); }
    else { const b = N.peers.get(d.by); toast(n + ' a été abattu' + (b ? ' par ' + b.name : '') + '.', 3000); }
  }
})();
