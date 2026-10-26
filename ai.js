// Trafic : autres avions (départs, arrivées, roulage, croisière) et navires sur l'océan
(function () {
  const D2R = SIM.D2R, R2D = SIM.R2D, clamp = SIM.clamp, P = SIM.P, KT = 0.514444, FT = 0.3048;
  const wrap = a => ((a + 540) % 360) - 180;
  const AI = SIM.ai = { list: [], ships: [] };
  const AIRLINES = [['mungo', 'Air Mungo', 'A320'], ['atlas', 'Atlantic Star', 'jumbo'], ['kivu', 'Kivu Airways', 'A321'], ['prive', 'Jet Privé', 'jet'], ['sablon', 'Sablon Air', 'A320'], ['lagune', 'Lagune Air', 'super'], ['essai', 'Essais Constructeur', 'gros'], ['armee', 'Force Aérienne', 'militaire'], ['sahel', 'Sahel Air', 'A319'], ['kribi', 'Kribi Express', 'A319'], ['seine', 'Seine Airways', 'gros'], ['prive', 'Jet Privé', 'jet']];
  let scene = null, nextId = 0;

  AI.init = function (sc) { scene = sc; makeShips(); };
  function say(spk, txt) { SIM.radio && SIM.radio(spk, txt, true); }

  // ---------- Création ----------
  function spawn(opts) {
    const [liv, name, type] = AIRLINES[(nextId++) % AIRLINES.length];
    const m = SIM.buildAircraft(liv, true, type); m.root.rotation.order = 'YXZ'; scene.add(m.root);
    const ai = Object.assign({ m, liv, type, airline: name, id: nextId, cs: name + ' ' + (100 + Math.floor(Math.random() * 800)), x: 0, y: 0, z: 0, psi: 0, theta: 0, phi: 0, gamma: 0, V: 0,
      gearPos: 1, gearDown: true, flap: 0.25, n1: 0.25, path: [], pi: 0, t: 0, air: 0, trail: null }, opts);
    AI.list.push(ai); return ai;
  }
  function remove(ai) { scene.remove(ai.m.root); if (ai.trail) scene.remove(ai.trail.line); if (ai.stand) ai.stand.busy = false; AI.list.splice(AI.list.indexOf(ai), 1); }
  AI.clear = function () { AI.list.slice().forEach(remove); AI.destDone = false; AI.cruiseT = 0; };

  // repères de piste : extrémité k (0 = ids[0], 1 = ids[1])
  const endInfo = (C, end) => { const k = end.id === C.ids[0] ? 0 : 1, s = k === 0 ? 1 : -1; return { k, s, L: C.layout, h: end.hdg * D2R }; };
  const W = (C, lx, lz) => C.toW(lx, lz);
  function runwayOccupiedByPlayer(C) { if (!P.onGround) return false; const s = SIM.surface(P.x, P.z); return s.type === 'piste' && s.comp === C; }

  function departAI(C, end, startOff, V) {
    const a = C.a, { s } = endInfo(C, end), lz0 = s * (a.len / 2 - 30 - startOff), p0 = W(C, 0, lz0);
    const far = W(C, 0, -s * (a.len / 2 + 25000));
    return spawn({ ap: a, C, end, mode: 'roll', x: p0.x, z: p0.z, y: a.elev + 0.15, psi: end.hdg * D2R, V: V || 0, n1: 1, path: [far], flap: 0.25 });
  }
  function finalAI(C, end, dist) {
    const a = C.a;
    const h = end.hdg * D2R, dx = Math.sin(h), dz = -Math.cos(h);
    const x = end.x - dx * dist, z = end.z - dz * dist;
    const rollEnd = { x: end.x + dx * (a.len - 200), z: end.z + dz * (a.len - 200) };
    return spawn({ ap: a, C, end, mode: 'final', x, z, y: a.elev + 15 + dist * Math.tan(3 * D2R), psi: h, V: 72, n1: 0.55, flap: 1, path: [{ x: end.x, z: end.z }, rollEnd], gearPos: 1 });
  }
  function holderAI(C, end) {
    const a = C.a, { s, L } = endInfo(C, end);
    const cA = Math.sign(s) * L.APL * 0.5 || L.APL * 0.5, hz = s * (a.len / 2 - 70);
    const p = [W(C, L.AX0 + 10, cA), W(C, L.TX, cA), W(C, L.TX, hz), W(C, a.wid / 2 + 55, hz)];
    const p0 = W(C, L.AX0 + 60, cA);
    return spawn({ ap: a, C, end, mode: 'taxi', next: 'hold', x: p0.x, z: p0.z, y: a.elev + 0.15, psi: (C.hdg - 90) * D2R, V: 7, n1: 0.32, path: p, flap: 0.25 });
  }

  // scénario au départ : un avion décolle devant vous, un autre est en finale, un troisième roule vers le point d'arrêt
  AI.reset = function () {
    AI.clear(); if (!scene) return;
    const R = SIM.route, a = R.dep, C = a.comps[0];
    AI.crossing(0);
    AI.finAI = finalAI(C, R.de, 16000);
    AI.holdAI = holderAI(C, R.de);
    const C2 = a.comps[1];
    if (C2) { const e2 = sameDir(C2, R.de.hdg); departAI(C2, e2, 900, 45); finalAI(C2, e2, 9000); holderAI(C2, e2); a.aiT = 40; }
  };

  // un avion arrive par le taxiway, passe devant vous, s'aligne et décolle : vous le suivez
  AI.crossing = function (ahead) {
    const R = SIM.route, a = R.dep, C = a.comps[0], { s, L } = endInfo(C, R.de), hz = s * (a.len / 2 - 70 - (ahead || 0)), p0 = W(C, L.TX, hz - s * 320);
    AI.depAI = spawn({ ap: a, C, end: R.de, mode: 'taxi', next: 'rollNow', x: p0.x, z: p0.z, y: a.elev + 0.15, psi: Math.atan2(W(C, L.TX, hz).x - p0.x, -(W(C, L.TX, hz).z - p0.z)), V: 8, n1: 0.32, flap: 0.25,
      path: [W(C, L.TX, hz), W(C, a.wid / 2 + 30, hz - s * 10), W(C, 0, hz - s * 70), W(C, 0, hz - s * 150)] });
    say('SOL', `${AI.depAI.cs}, roulez point d'arrêt piste ${R.de.id}, traversez devant le trafic aligné.`);
    return AI.depAI;
  };
  const sameDir = (C, hdg) => C.ends.reduce((b, e) => Math.abs(wrap(e.hdg - hdg)) < Math.abs(wrap(b.hdg - hdg)) ? e : b);
  // ---------- Mouvement ----------
  function follow(ai, dt, air) {
    const tp = ai.path[ai.pi]; if (!tp) return true;
    const brg = Math.atan2(tp.x - ai.x, -(tp.z - ai.z)), err = wrap((brg - ai.psi) * R2D) * D2R;
    const rate = (air ? 3 : ai.V < 15 ? 22 : 3) * D2R;
    const turn = clamp(err, -rate * dt, rate * dt); ai.psi += turn;
    ai.phi = air ? clamp(err * 1.2, -0.45, 0.45) : 0;
    const hv = ai.V * Math.cos(ai.gamma);
    ai.x += Math.sin(ai.psi) * hv * dt; ai.z -= Math.cos(ai.psi) * hv * dt;
    if (Math.hypot(tp.x - ai.x, tp.z - ai.z) < Math.max(7, ai.V * 1.3)) ai.pi++;
    return ai.pi >= ai.path.length;
  }
  function exitPath(ai) {
    const a = ai.ap, C = ai.C, { s, L } = endInfo(C, ai.end), cur = C.toL(ai.x, ai.z).lz;
    const CN = [-(a.len / 2 - 70), a.len / 2 - 70, 0, -a.len / 4, a.len / 4].filter(c => (cur - c) * s > 120).sort((p, q) => (cur - q) * s - (cur - p) * s);
    const c = CN.length ? CN[CN.length - 1] : -s * (a.len / 2 - 70);
    const ca = Math.abs(c - L.APL * 0.5) < Math.abs(c + L.APL * 0.5) ? L.APL * 0.5 : -L.APL * 0.5;
    const st = C.stands.filter(x => !x.busy).sort((p, q) => Math.abs(p.lz - ca) - Math.abs(q.lz - ca))[0];
    const pts = [W(C, 0, c), W(C, a.wid / 2 + 30, c), W(C, L.TX, c), W(C, L.TX, ca), W(C, L.AX0 + 15, ca)];
    if (st) { st.busy = true; ai.stand = st; pts.push(W(C, L.AX0 + 30, st.lz), W(C, st.lx - 6, st.lz)); }
    ai.path = pts; ai.pi = 0;
  }
  function runwayBusy(C, except) {
    return AI.list.some(o => o !== except && o.C === C && (o.mode === 'roll' || o.mode === 'rollout' || o.mode === 'flare' || (o.mode === 'final' && Math.hypot(o.x - o.end.x, o.z - o.end.z) < 4000) || o.mode === 'lineup'));
  }
  function playerBlocks(C) {
    if (runwayOccupiedByPlayer(C)) return true;
    if (C.second) return false;
    const a = C.a;
    const R = SIM.route;
    if (R.dep === a && !P.onGround && P.airTime < 60) return true;
    if (R.dep === a && P.onGround && !P.landed && P.tSim < 600 && !P.parked) return true;   // vous êtes en attente de départ
    if (R.dest === a && !P.onGround) { const il = SIM.ils(); if (il.along > -500 && il.along < 18000) return true; }
    return false;
  }
  function step(ai, dt) {
    ai.t += dt; const a = ai.ap, g = a ? a.elev + 0.15 : 0;
    switch (ai.mode) {
      case 'roll':
        ai.V = Math.min(ai.V + 2.1 * dt, 95); follow(ai, dt, false); ai.n1 = 1;
        if (ai.V > 72) ai.theta = Math.min(ai.theta + 3 * D2R * dt, 9 * D2R);
        if (ai.V > 79 && ai.theta > 7 * D2R) { ai.mode = 'climb'; ai.air = 0; }
        ai.y = g; break;
      case 'climb': case 'goaround':
        ai.air += dt; ai.gamma = Math.min(ai.gamma + 2 * D2R * dt, 7 * D2R); ai.V = Math.min(ai.V + 1.1 * dt, 130);
        ai.theta += clamp(ai.gamma + 5 * D2R - ai.theta, -2 * D2R * dt, 2 * D2R * dt); ai.n1 = 0.92;
        if (ai.air > 6) ai.gearDown = false; if (ai.air > 25) ai.flap = 0;
        if (follow(ai, dt, true)) { const h = ai.psi + (Math.random() - 0.5) * 1.2; ai.path = [{ x: ai.x + Math.sin(h) * 80000, z: ai.z - Math.cos(h) * 80000 }]; ai.pi = 0; }
        ai.y += ai.V * Math.sin(ai.gamma) * dt;
        if (ai.y - g > 6000) { ai.gamma = 0; ai.theta = 2 * D2R; }
        break;
      case 'final': {
        follow(ai, dt, true); ai.gearDown = true; ai.flap = 1; ai.n1 = 0.5;
        const eh = ai.end.hdg * D2R, d = (ai.end.x - ai.x) * Math.sin(eh) - (ai.end.z - ai.z) * Math.cos(eh), tgt = a.elev + 15 + d * Math.tan(3 * D2R);
        ai.gamma = -3 * D2R; ai.y += (tgt - ai.y) * Math.min(1, dt * 0.8); ai.theta = 2.5 * D2R; ai.V += (70 - ai.V) * dt * 0.2;
        if (d < 3000 && !ai.landClr) { ai.landClr = true; if (!runwayOccupiedByPlayer(ai.C)) say('TOUR', `${ai.cs}, piste ${ai.end.id}, autorisé atterrissage.`); }
        if (d < 1800 && runwayOccupiedByPlayer(ai.C)) { ai.mode = 'goaround'; ai.air = 0; ai.gamma = 0; ai.path = [{ x: ai.x + Math.sin(ai.psi) * 30000, z: ai.z - Math.cos(ai.psi) * 30000 }]; ai.pi = 0; say('TOUR', `${ai.cs}, remettez les gaz, je répète, remettez les gaz, piste occupée.`); }
        else if (ai.y - g < 12) ai.mode = 'flare';
        break;
      }
      case 'flare':
        follow(ai, dt, true); ai.theta += clamp(5.5 * D2R - ai.theta, -3 * D2R * dt, 3 * D2R * dt); ai.n1 = 0.22; ai.phi = 0;
        ai.y -= (0.8 + (ai.y - g) * 0.08) * dt; ai.V -= 0.6 * dt;
        if (ai.y <= g) { ai.y = g; ai.mode = 'rollout'; } break;
      case 'rollout':
        ai.V = Math.max(ai.V - 2.4 * dt, 12); ai.theta = Math.max(0, ai.theta - 2 * D2R * dt); ai.n1 = ai.V > 40 ? 0.7 : 0.25; ai.rev = ai.V > 40;
        follow(ai, dt, false); ai.y = g;
        if (ai.V <= 12.5) { ai.rev = false; exitPath(ai); ai.mode = 'taxi'; ai.next = 'park'; ai.flap = 0; say('TOUR', `${ai.cs}, dégagez à la prochaine bretelle, contactez le sol.`); }
        break;
      case 'taxi': case 'lineup': {
        const tp = ai.path[ai.pi], nxt = ai.path[ai.pi + 1];
        const sharp = tp && nxt ? Math.abs(wrap((Math.atan2(nxt.x - tp.x, -(nxt.z - tp.z)) - Math.atan2(tp.x - ai.x, -(tp.z - ai.z))) * R2D)) : 0;
        const dTp = tp ? Math.hypot(tp.x - ai.x, tp.z - ai.z) : 0, vt = sharp > 40 && dTp < 60 ? 4 : ai.mode === 'lineup' ? 5 : 9;
        ai.V += clamp(vt - ai.V, -2 * dt, 1 * dt); ai.n1 = 0.3; ai.y = g; ai.theta = 0;
        if (follow(ai, dt, false)) {
          if (ai.next === 'rollNow') { ai.next = null; ai.mode = 'roll'; ai.path = [W(ai.C, 0, -endInfo(ai.C, ai.end).s * (a.len / 2 + 25000))]; ai.pi = 0; say('TOUR', `${ai.cs}, piste ${ai.end.id}, vent calme, autorisé décollage.`); }
          else if (ai.mode === 'lineup') { ai.mode = 'roll'; ai.path = [W(ai.C, 0, -endInfo(ai.C, ai.end).s * (a.len / 2 + 25000))]; ai.pi = 0; }
          else if (ai.next === 'hold') { ai.mode = 'hold'; ai.V = 0; }
          else { ai.mode = 'parked'; ai.V = 0; ai.psi = (a.hdg + 90) * D2R; }
        }
        break;
      }
      case 'hold':
        ai.V = 0; ai.y = g; ai.n1 = 0.24;
        if (!runwayBusy(ai.C, ai) && !playerBlocks(ai.C)) {
          ai.holdT = (ai.holdT || 0) + dt;
          if (ai.holdT > 8) { const { s } = endInfo(ai.C, ai.end), hz = s * (a.len / 2 - 70); ai.mode = 'lineup'; ai.path = [W(ai.C, 0, hz), W(ai.C, 0, hz - s * 60)]; ai.pi = 0; say('TOUR', `${ai.cs}, piste ${ai.end.id}, autorisé décollage.`); }
        } else ai.holdT = 0;
        break;
      case 'parked': ai.V = 0; ai.n1 = Math.max(0, ai.n1 - dt * 0.02); ai.y = g; ai.parkT = (ai.parkT || 0) + dt; break;
      case 'cruise': follow(ai, dt, true); ai.n1 = 0.8; ai.gearDown = false; ai.flap = 0; ai.theta = 2 * D2R; break;
    }
    ai.gearPos += clamp((ai.gearDown ? 1 : 0) - ai.gearPos, -dt / 8, dt / 8);
  }

  // ---------- Croisière (trafic en route) ----------
  function cruiser() {
    const ang = P.psi + (Math.random() - 0.5) * 2.2, d = 18000 + Math.random() * 22000;
    const x = P.x + Math.sin(ang) * d, z = P.z - Math.cos(ang) * d, hd = Math.random() * Math.PI * 2;
    const lvl = Math.max(4000, Math.round((P.y / FT + (Math.random() < 0.5 ? -1 : 1) * (1000 + Math.floor(Math.random() * 4) * 1000)) / 1000) * 1000);
    const ai = spawn({ ap: null, mode: 'cruise', x, z, y: lvl * FT, psi: hd, V: 210 + Math.random() * 30, gearDown: false, gearPos: 0, flap: 0, path: [{ x: x + Math.sin(hd) * 200000, z: z - Math.cos(hd) * 200000 }] });
    ai.trail = { pts: [], line: new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })), tt: 0 };
    ai.trail.line.frustumCulled = false; scene.add(ai.trail.line);
  }

  // ---------- Mise à jour ----------
  AI.update = function (dt, t, night) {
    if (!scene) return;
    const R = SIM.route;
    // trafic à destination quand vous approchez
    if (!AI.destDone && !P.onGround && SIM.routeRemaining() < 55000 && R.dest !== R.dep) {
      AI.destDone = true; const il = SIM.ils();
      if (il.along > 26000) { AI.destFin = finalAI(R.dest.comps[0], R.ae, 17000); }
      AI.destHold = holderAI(R.dest.comps[0], R.ae);
      const C2 = R.dest.comps[1]; if (C2) { const e2 = sameDir(C2, R.ae.hdg); finalAI(C2, e2, 12000); holderAI(C2, e2); R.dest.aiT = 60; }
    }
    // trafic en croisière
    AI.cruiseT -= dt;
    const cr = AI.list.filter(a => a.mode === 'cruise');
    if (!P.onGround && P.agl > 2500 && cr.length < 3 && AI.cruiseT <= 0) { cruiser(); AI.cruiseT = 25; }
    // trafic continu sur la seconde piste des grands aéroports proches
    SIM.AIRPORTS.forEach(a => {
      const C2 = a.comps[1]; if (!C2 || Math.hypot(a.x - P.x, a.z - P.z) > 30000) return;
      a.aiT = (a.aiT == null ? 20 : a.aiT) - dt; if (a.aiT > 0) return; a.aiT = 45 + Math.random() * 45;
      const act = AI.list.filter(o => o.C === C2 && o.mode !== 'parked').length; if (act >= 3 || AI.list.length > 16) return;
      const h = R.dep === a ? R.de.hdg : R.dest === a ? R.ae.hdg : a.hdg, e2 = sameDir(C2, h);
      if (Math.random() < 0.5) holderAI(C2, e2); else finalAI(C2, e2, 14000);
    });
    AI.list.slice().forEach(ai => {
      if (ai.mode === 'parked' && ai.parkT > 150 && Math.hypot(ai.x - P.x, ai.z - P.z) > 1500) { remove(ai); return; }
      step(ai, dt);
      const far = Math.hypot(ai.x - P.x, ai.z - P.z);
      if ((ai.mode === 'cruise' || ai.mode === 'climb' || ai.mode === 'goaround') && far > 70000) { remove(ai); return; }
      const r = ai.m.root; r.visible = far < (ai.mode === 'cruise' || ai.mode === 'climb' ? 40000 : 9000); r.position.set(ai.x, ai.y, ai.z); r.rotation.set(ai.theta, -ai.psi, -ai.phi, 'YXZ');
      const agl = ai.y - (ai.ap ? ai.ap.elev : 0), air = ai.mode === 'climb' || ai.mode === 'goaround' || ai.mode === 'final' || ai.mode === 'flare' || ai.mode === 'cruise';
      const onRwy = ai.mode === 'roll' || ai.mode === 'rollout' || ai.mode === 'lineup';
      ai.m.update({ flapPos: ai.flap, ail: 0, elev: 0, rud: 0, spoil: ai.mode === 'rollout' ? 1 : 0, gearPos: ai.gearPos, n1: [ai.n1, ai.n1], wheelV: air ? 0 : ai.V, steer: 0, dt, t: t + ai.id * 0.37, night,
        lights: { nav: 1, beacon: ai.mode !== 'parked' || ai.n1 > 0.05, strobe: air || onRwy, landing: (air && agl < 3000) || onRwy, taxi: ai.mode === 'taxi' || ai.mode === 'lineup', logo: night > 0.4, cabin: 1, wing: 0 } });
      if (ai.trail) {
        const T = ai.trail; T.tt -= dt;
        if (T.tt <= 0) { T.tt = 0.5; if (ai.y > 7500) { T.pts.push(new THREE.Vector3(ai.x, ai.y, ai.z).addScaledVector(new THREE.Vector3(Math.sin(ai.psi), 0, -Math.cos(ai.psi)), -30)); if (T.pts.length > 90) T.pts.shift(); T.line.geometry.setFromPoints(T.pts); } }
      }
    });
    // navires
    AI.ships.forEach(s => {
      const vis = Math.hypot(s.x - P.x, s.z - P.z) < 70000; s.g.visible = vis; if (!vis) return;
      if (s.v) { s.x += Math.sin(s.h) * s.v * dt; s.z -= Math.cos(s.h) * s.v * dt; if (!SIM.isSea(s.x + Math.sin(s.h) * 600, s.z - Math.cos(s.h) * 600)) s.h += Math.PI; }
      s.g.position.set(s.x, 0.4 + Math.sin(t * 0.6 + s.ph) * (s.small ? 0.15 : 0.3), s.z); s.g.rotation.y = -s.h; s.g.rotation.z = Math.sin(t * 0.5 + s.ph) * (s.small ? 0.05 : 0.015);
      if (s.lights) s.lights.visible = night > 0.3;
    });
  };
  const STATE = { roll: 'au décollage', climb: 'en montée', goaround: 'en remise des gaz', cruise: 'en croisière', final: 'en finale', flare: "à l'atterrissage", rollout: 'au freinage', taxi: 'au roulage', lineup: "à l'alignement", hold: "au point d'arrêt", parked: 'garé au poste' };
  AI.choices = () => AI.list.map(a => ({ id: a.id, cs: a.cs, liv: a.liv, type: a.type, state: STATE[a.mode] || a.mode, ap: a.ap ? a.ap.city : '', d: Math.hypot(a.x - P.x, a.z - P.z) })).sort((p, q) => p.d - q.d);
  AI.take = function (id) { const a = AI.list.find(o => o.id === id); if (!a) return null; const info = Object.assign({}, a); remove(a); return info; };
  AI.traffic = () => AI.list.filter(a => a.mode !== 'parked').map(a => ({ x: a.x, z: a.z, y: a.y, cs: a.cs, vs: a.mode === 'climb' || a.mode === 'goaround' ? 1 : a.mode === 'final' ? -1 : 0, ground: !(a.mode === 'climb' || a.mode === 'goaround' || a.mode === 'final' || a.mode === 'flare' || a.mode === 'cruise') }));
  AI.landingAhead = a => AI.list.find(o => o.C === a.comps[0] && (o.mode === 'final' || o.mode === 'flare' || o.mode === 'rollout'));
  AI.runwayBusy = a => runwayBusy(a.comps[0], null);

  // ---------- Navires ----------
  function makeShip(kind) {
    const g = new THREE.Group(), L = kind === 'cargo' ? 190 : kind === 'tanker' ? 230 : kind === 'ferry' ? 120 : 14;
    const M = c => new THREE.MeshLambertMaterial({ color: c });
    if (kind === 'pirogue') {
      const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, L), M([0xc23b22, 0x1f6fb2, 0xe8c547][Math.floor(Math.random() * 3)])); hull.position.y = 0.3; g.add(hull);
      const bow = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3, 4).rotateX(-Math.PI / 2), hull.material); bow.position.set(0, 0.3, -L / 2 - 1.4); g.add(bow);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.8), M(0x333333)); m.position.set(0, 0.9, L / 2 - 1); g.add(m);
      g.userData.small = true; return g;
    }
    const B = L * 0.15, hullC = kind === 'tanker' ? 0x7a1f1f : kind === 'ferry' ? 0xf2f2f2 : 0x23384f;
    const hull = new THREE.Mesh(new THREE.BoxGeometry(B, 12, L * 0.86), M(hullC)); hull.position.y = 2; g.add(hull);
    const bow = new THREE.Mesh(new THREE.CylinderGeometry(B / 2, B / 2, 12, 16, 1, false, 0, Math.PI), hull.material); bow.rotation.y = Math.PI / 2; bow.position.set(0, 2, -L * 0.43); bow.scale.set(1, 1, 2.4); g.add(bow);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(B * 0.96, 0.6, L * 0.9), M(kind === 'tanker' ? 0x6d7a5a : 0x8a3b2a)); deck.position.y = 8.2; g.add(deck);
    const sup = new THREE.Mesh(new THREE.BoxGeometry(B * 0.9, kind === 'ferry' ? 14 : 18, kind === 'ferry' ? L * 0.6 : 16), M(0xf0f0f0)); sup.position.set(0, kind === 'ferry' ? 15 : 17, kind === 'ferry' ? 0 : L * 0.36); g.add(sup);
    const fun = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 10, 10), M(0xd23b2a)); fun.position.set(0, kind === 'ferry' ? 26 : 30, kind === 'ferry' ? L * 0.15 : L * 0.38); g.add(fun);
    if (kind === 'cargo') {
      const cols = [0xd23b2a, 0x2a6fd2, 0x2a9d5a, 0xe8b02a, 0xeeeeee, 0x7a4fd2], cg = new THREE.BoxGeometry(2.4, 2.5, 12);
      for (let r = 0; r < 9; r++) for (let c = 0; c < 6; c++) for (let h = 0; h < 2 + (r * 7 + c) % 3; h++) {
        const ct = new THREE.Mesh(cg, M(cols[(r * 3 + c * 5 + h) % cols.length])); ct.position.set((c - 2.5) * 2.6 * (B / 28), 9.8 + h * 2.6, -L * 0.38 + r * 13.5); g.add(ct);
      }
    }
    const wake = new THREE.Mesh(new THREE.PlaneGeometry(B * 2.2, L * 1.8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: SIM.glowTex('rgba(255,255,255,0.5)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false }));
    wake.position.set(0, 0.25, L * 1.2); g.add(wake);
    const lp = []; for (const p of [[0, 36, L * 0.36], [B / 2, 10, -L * 0.2], [-B / 2, 10, -L * 0.2], [0, 10, L * 0.45]]) lp.push(...p);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    const lights = new THREE.Points(lg, new THREE.PointsMaterial({ color: 0xfff2c0, size: 4, sizeAttenuation: false, transparent: true, depthWrite: false })); g.add(lights);
    g.userData.lights = lights; return g;
  }
  function makeShips() {
    const spots = [
      ['cargo', 3.82, 9.32, 0], ['cargo', 3.78, 9.40, 0], ['tanker', 3.86, 9.28, 0], ['cargo', 3.70, 9.44, 5.5],
      ['cargo', 2.73, 9.85, 0], ['tanker', 2.80, 9.78, 0], ['cargo', 2.95, 9.70, 6], ['ferry', 3.75, 9.05, 7],
      ['tanker', 3.4, 9.2, 6.5], ['cargo', 41.5, 3.2, 8], ['ferry', 40.3, 2.6, 9], ['tanker', 38.4, 3.8, 7],
    ];
    for (let i = 0; i < 26; i++) spots.push(['pirogue', 2.85 + Math.random() * 1.0, 9.5 + Math.random() * 0.36, Math.random() < 0.6 ? 2.5 : 0]);
    spots.forEach(([kind, lat, lon, v]) => {
      const p = SIM.geo.toXZ(lat, lon); if (!SIM.isSea(p.x, p.z)) return;
      const g = makeShip(kind); g.position.set(p.x, 0.4, p.z); scene.add(g);
      AI.ships.push({ g, x: p.x, z: p.z, h: Math.random() * 6.28, v, ph: Math.random() * 6, small: kind === 'pirogue', lights: g.userData.lights });
    });
  }
})();
