// Collisions entre avions : votre appareil contre le trafic, les avions garés et les autres joueurs en ligne
(function () {
  const P = SIM.P, clamp = SIM.clamp;
  const CO = SIM.collide = { cd: 0 };
  const TS = { leviathan: [3.5, 3.4, 4.2], hyperion: [3.0, 2.9, 5.6], titan: [2.9, 3.0, 2.95], colosse: [3.0, 2.4, 2.5], geant: [2.25, 2.0, 2.3], A319: [1, 1, 0.88], A321: [1, 1, 1.18], militaire: [1.05, 1.05, 1.1], gros: [1.45, 1.45, 1.45], jumbo: [1.55, 1.6, 1.9], super: [1.75, 2.1, 1.95], jet: [0.42, 0.42, 0.46] };
  // forme simplifiée d'un avion : fuselage + deux demi-ailes en flèche (segments épais)
  function shape(type, k) {
    if (type === 'heli') return { segs: [[[0, 2, -6], [0, 2, 7], 3.2]], R: 9 };
    if (type === 'chasseur') { k = k || 1.3; return { segs: [[[0, 2.2 * k, -8 * k], [0, 2.2 * k, 7 * k], 1.3 * k], [[0, 2 * k, 1 * k], [-5.4 * k, 2 * k, 5 * k], 0.5 * k], [[0, 2 * k, 1 * k], [5.4 * k, 2 * k, 5 * k], 0.5 * k]], R: 10 * k }; }
    const [sx, sy, sz] = TS[type] || [1, 1, 1], hw = 17.6 * sx * ({ leviathan: 1.226, hyperion: 1.317 }[type] || 1);
    return { segs: [[[0, 3.9 * sy, -18.6 * sz], [0, 3.9 * sy, 18.8 * sz], 2.0 * sy], [[0, 2.5 * sy, -3 * sz], [-hw, 3.6 * sy, 6 * sz], 0.8 * sy], [[0, 2.5 * sy, -3 * sz], [hw, 3.6 * sy, 6 * sz], 0.8 * sy], [[0, 6 * sy, 14 * sz], [0, 11.5 * sy, 18.5 * sz], 0.6 * sy]], R: Math.max(19 * sz, hw) + 3 };
  }
  function world(sh, x, y, z, psi) {
    const c = Math.cos(psi), s = Math.sin(psi), tr = p => [x + c * p[0] - s * p[2], y + p[1], z + s * p[0] + c * p[2]];
    return sh.segs.map(([a, b, r]) => [tr(a), tr(b), r]);
  }
  // distance minimale entre deux segments 3D
  function segDist(p1, q1, p2, q2) {
    const d1 = [q1[0] - p1[0], q1[1] - p1[1], q1[2] - p1[2]], d2 = [q2[0] - p2[0], q2[1] - p2[1], q2[2] - p2[2]], r = [p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]];
    const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r); let s = 0, t = 0;
    if (a < 1e-9 && e < 1e-9) return { d: Math.sqrt(dot(r, r)), p: p1 };
    if (a < 1e-9) t = clamp(f / e, 0, 1);
    else { const c = dot(d1, r); if (e < 1e-9) s = clamp(-c / a, 0, 1); else { const b = dot(d1, d2), den = a * e - b * b; s = den !== 0 ? clamp((b * f - c * e) / den, 0, 1) : 0; t = (b * s + f) / e; if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); } } }
    const c1 = [p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s], c2 = [p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t];
    return { d: Math.hypot(c1[0] - c2[0], c1[1] - c2[1], c1[2] - c2[2]), p: [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2, (c1[2] + c2[2]) / 2] };
  }
  function touch(A, B) {
    let best = null;
    A.forEach(([a1, a2, ra], ia) => B.forEach(([b1, b2, rb], ib) => { const r = segDist(a1, a2, b1, b2); if (r.d < ra + rb && (!best || r.d - ra - rb < best.pen)) best = { pen: r.d - ra - rb, p: r.p, ia, ib }; }));
    return best;
  }
  function myType() { return P.heli ? 'heli' : P.type; }
  function myVel() { const hv = P.V * Math.cos(P.gamma || 0) + (P.bV || 0); return [Math.sin(P.psi) * hv, P.V * Math.sin(P.gamma || 0), -Math.cos(P.psi) * hv]; }
  // liste des autres appareils proches
  function others() {
    const out = [];
    (SIM.ai ? SIM.ai.list : []).forEach(ai => out.push({ kind: 'ai', ref: ai, x: ai.x, y: ai.y, z: ai.z, psi: ai.psi, type: ai.type, name: ai.cs, v: [Math.sin(ai.psi) * ai.V, 0, -Math.cos(ai.psi) * ai.V] }));
    SIM.AIRPORTS.forEach(a => (a.statics || []).forEach(st => { if (!st.gone && Math.abs(st.x - P.x) < 400 && Math.abs(st.z - P.z) < 400) out.push({ kind: 'static', ref: st, x: st.x, y: st.y + 0.15, z: st.z, psi: st.psi, type: st.type, name: st.name, v: [0, 0, 0] }); }));
    if (SIM.net && SIM.net.peers) for (const g of SIM.net.peers.values()) if (g.s && g.s.m === 'v' && !g.dead) out.push({ kind: 'net', ref: g, x: g.x, y: g.y, z: g.z, psi: g.psi, type: g.s.t === 'heli' ? 'heli' : g.s.t, k: g.s.k, name: g.name, v: [g.vx || 0, g.vy || 0, g.vz || 0] });
    return out;
  }
  CO.update = function (dt) {
    CO.cd -= dt; stepDebris(dt);
    if (P.crashed || CO.cd > 0 || SIM.troops && SIM.troops.active || SIM.war && SIM.war.truckMode) return;
    const mine = shape(myType(), SIM.war && SIM.war.SIZES && SIM.war.SIZES[SIM.war.size] ? SIM.war.SIZES[SIM.war.size].k : 1.3), my = world(mine, P.x, P.y, P.z, P.psi), mv = myVel();
    for (const o of others()) {
      if (o.kind === 'net' && (P.parked || P.boarding || (o.ref.s.gr && Math.hypot(o.x - P.x, o.z - P.z) < 10))) continue;
      const sh = shape(o.type, o.k), lim = mine.R + sh.R;
      if (Math.abs(o.x - P.x) > lim || Math.abs(o.z - P.z) > lim || Math.abs(o.y - P.y) > lim) continue;
      const hit = touch(my, world(sh, o.x, o.y, o.z, o.psi)); if (!hit) continue;
      const rel = Math.hypot(mv[0] - o.v[0], mv[1] - o.v[1], mv[2] - o.v[2]);
      impact(o, hit, rel); return;
    }
  };
  // ---------- débris qui tombent (morceaux d'aile, de dérive, de tôle) ----------
  const DEB = [];
  function debris(x, y, z, vx, vy, vz, n, big, col) {
    for (let i = 0; i < n; i++) {
      const w = big ? 2 + Math.random() * 3 : 0.4 + Math.random() * 1.2, m = new THREE.Mesh(new THREE.BoxGeometry(w, big ? 0.25 : 0.12, w * (0.4 + Math.random() * 0.6)), new THREE.MeshLambertMaterial({ color: i % 3 === 2 ? 0x2a2a2a : (col || 0xdfe3e7) }));
      m.position.set(x, y, z); SIM.scene.add(m);
      DEB.push({ m, vx: vx + (Math.random() - 0.5) * 8, vy: vy + Math.random() * 5, vz: vz + (Math.random() - 0.5) * 8, rx: (Math.random() - 0.5) * 8, rz: (Math.random() - 0.5) * 8, rest: false });
    }
    while (DEB.length > 90) { const d = DEB.shift(); SIM.scene.remove(d.m); }
  }
  function stepDebris(dt) {
    DEB.forEach(d => {
      if (d.rest) return;
      d.vy -= 9.81 * dt; d.vx *= 1 - 0.4 * dt; d.vz *= 1 - 0.4 * dt;
      d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt; d.m.rotation.x += d.rx * dt; d.m.rotation.z += d.rz * dt;
      const g = SIM.groundH(d.m.position.x, d.m.position.z), wl = SIM.waterAt(d.m.position.x, d.m.position.z), floor = wl !== null ? wl - 2 : g + 0.12;
      if (d.m.position.y <= floor) { d.m.position.y = floor; if (Math.abs(d.vy) < 3 || wl !== null) { d.rest = true; d.m.rotation.x = 0; d.m.rotation.z = (Math.random() - 0.5) * 0.3; if (wl !== null) SIM.boom.puff(d.m.position.x, wl + 0.5, d.m.position.z, 3, 1.5, 'spray'); } else { d.vy = -d.vy * 0.3; d.vx *= 0.5; d.vz *= 0.5; } }
    });
  }
  const PART = ['fuselage', 'wingL', 'wingR', 'fin'];
  const PNAME = { fuselage: 'le fuselage', wingL: 'l\'aile gauche', wingR: 'l\'aile droite', fin: 'la dérive' };
  function impact(o, hit, rel) {
    const [x, y, z] = hit.p, kt = Math.round(rel / 0.514444), mv = myVel();
    if (rel < 4 && P.onGround) {
      // accrochage au sol à faible vitesse : tôle froissée, étincelles, les deux avions s'arrêtent
      CO.cd = 3; P.V = 0; P.bV = 0;
      const back = 2.5; P.x -= Math.sin(P.psi) * back; P.z += Math.cos(P.psi) * back;
      if (o.kind === 'ai') o.ref.blocked = 25;
      for (let i = 0; i < 14; i++) SIM.boom.puff(x + (Math.random() - 0.5) * 3, y + Math.random() * 2, z + (Math.random() - 0.5) * 3, 0.6 + Math.random(), 0.35, 'fire');
      SIM.boom.puff(x, y + 1, z, 3, 2, 'grey'); debris(x, y + 1, z, 0, 1, 0, 3, false);
      // tôle froissée : le bout d'aile ou la dérive touchés se plient légèrement (des deux côtés)
      { const mine = PART[hit.ia] || 'fuselage', theirs = PART[hit.ib] || 'fuselage', kk = 0.08 + Math.random() * 0.07;
        if (mine !== 'fuselage' && SIM.view.plane.damage) { SIM.view.plane.damage(mine, kk); if (mine.startsWith('wing')) { P.wd = P.wd || [0, 0]; P.wd[mine === 'wingL' ? 0 : 1] = Math.max(P.wd[mine === 'wingL' ? 0 : 1], kk * 0.5); } }
        const om = o.kind === 'ai' ? o.ref.m : o.kind === 'static' ? o.ref.model : null; if (om && om.damage && theirs !== 'fuselage') om.damage(theirs, kk); }
      if (SIM.damageEngine) SIM.damageEngine(null, 0.12, null);
      if (SIM.view && SIM.view.boomSound) SIM.view.boomSound(0.35);
      SIM.view.shakeT = 0.6;
      SIM.onEvent && SIM.onEvent('toast', `Accrochage avec ${o.name} ! Tôle froissée — l'avion est immobilisé. Reculez (Alt) ou contournez.`);
      return;
    }
    if (rel < 102.9) {
      // choc sous 200 kt : la zone touchée est arrachée et tombe au sol, l'avion reste entier mais abîmé
      CO.cd = 2.5;
      const mine = PART[hit.ia] || 'fuselage', theirs = PART[hit.ib] || 'fuselage', k = clamp(rel / 60, 0.15, 1);
      if (mine === 'wingL' || mine === 'wingR') { const i = mine === 'wingL' ? 0 : 1; P.wd = P.wd || [0, 0]; P.wd[i] = Math.max(P.wd[i], k); if (SIM.view.plane.damage) SIM.view.plane.damage(mine, k); SIM.damageEngine && SIM.damageEngine(i, 0.25 + 0.4 * k, null); }
      else if (mine === 'fin') { if (SIM.view.plane.damage) SIM.view.plane.damage('fin', k); }
      else { SIM.damageEngine && SIM.damageEngine(null, 0.2 * k, null); }
      if (P.onGround) P.V *= 0.45; else P.V *= 0.93;
      // l'autre appareil
      const om = o.kind === 'ai' ? o.ref.m : o.kind === 'static' ? o.ref.model : null;
      if (om && om.damage && theirs !== 'fuselage') om.damage(theirs, k);
      if (o.kind === 'ai') o.ref.blocked = o.ref.mode === 'cruise' || o.ref.mode === 'climb' || o.ref.mode === 'final' ? 0 : 60;
      // morceaux arrachés qui tombent, étincelles, fumée, kérosène qui fuit
      debris(x, y, z, mv[0] * 0.5, mv[1] * 0.5 + 2, mv[2] * 0.5, mine === 'fuselage' ? 4 : 6, mine !== 'fuselage');
      for (let i = 0; i < 24; i++) SIM.boom.puff(x + (Math.random() - 0.5) * 5, y + Math.random() * 3, z + (Math.random() - 0.5) * 5, 0.8 + Math.random() * 1.5, 0.45, 'fire');
      SIM.boom.puff(x, y + 1, z, 5, 3, 'grey'); SIM.boom.puff(x, y + 1, z, 4, 4, 'smoke');
      if (SIM.view.boomSound) SIM.view.boomSound(0.7); SIM.view.shakeT = 1.2; SIM.view.chirp && SIM.view.chirp(1);
      SIM.onEvent && SIM.onEvent('toast', `Choc avec ${o.name} à ${kt} kt : ${PNAME[mine]} est arraché${mine.startsWith('wing') ? 'e' : mine === 'fin' ? 'e' : ''} et tombe ! ${mine.startsWith('wing') ? 'L\'avion penche de ce côté et perd du carburant.' : ''} Pas d'explosion (moins de 200 kt).`);
      return;
    }
    // choc violent (plus de 200 kt) : les deux appareils sont détruits
    CO.cd = 5;
    SIM.boom.real(x, y, z, clamp(rel / 40, 0.8, 2.2), SIM.view.cam);
    if (o.kind === 'ai') { SIM.boom.real(o.x, o.y + 2, o.z, 1.4, SIM.view.cam); SIM.ai.destroy(o.ref); }
    else if (o.kind === 'static') { o.ref.gone = true; o.ref.o.visible = false; o.ref.o.scale.setScalar(0.001); SIM.boom.real(o.x, o.y + 2, o.z, 1.4, SIM.view.cam); }
    const why = `Collision avec ${o.name} à ${kt} kt (plus de 200 kt) : les deux avions sont détruits.`;
    if (!P.crashed) { P.crashed = true; P.crashKind = 'sol'; P.crashV = P.V; P.crashVs = P.vs; P.V = 0; P.eng = [false, false]; P.crashPhi = P.phi + 0.5; P.crashY = P.y; SIM.onEvent && SIM.onEvent('crash', why); }
  };
  CO.shape = shape; CO.world = world; CO.touch = touch;
})();
