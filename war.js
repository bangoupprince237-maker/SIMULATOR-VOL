// Mode combat (exercice fictif) : patrouille de Rafale alliés, zone de guerre loin des aéroports,
// missiles à tête chercheuse, défense sol-air avec radar, chasseurs ennemis, leurres.
(function () {
  const P = SIM.P, D2R = SIM.D2R, R2D = SIM.R2D, clamp = SIM.clamp, V3 = THREE.Vector3;
  const W = SIM.war = { missiles: [], foes: [], sams: [], ground: [], wing: [], flareL: [], kills: 0, ammo: 6, flares: 30, size: 'moyen', wingN: 3, target: null, lockT: 0, loaded: false, rwr: '', on: true };
  const SIZES = { geant: { k: 2.3, roll: 0.75, name: 'Géant' }, grand: { k: 1.75, roll: 0.85, name: 'Grand' }, moyen: { k: 1.3, roll: 1, name: 'Moyen' }, petit: { k: 0.9, roll: 1.25, name: 'Petit' } };
  W.maxAmmo = 50; W.paint = 'gris';
  const FULL = () => W.maxAmmo;
  W.SIZES = SIZES;
  // zone de combat : plateau de l'Adamaoua, à plus de 300 km de tout aéroport du simulateur (scénario fictif « forces rouges »)
  const ZONE = { lat: 6.05, lon: 14.1, name: 'Zone de combat ALPHA' };
  let scene, zc, tex = {}, retY, retR, say = () => { }, toast = () => { };
  const OFFS = [[-20, 6], [20, 6], [-40, 13], [40, 13], [0, 28]];
  const isFighter = () => P.type === 'chasseur' && !P.heli;
  const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const playerVel = () => { const hv = P.V * Math.cos(P.gamma || 0); return { x: Math.sin(P.psi) * hv, y: P.V * Math.sin(P.gamma || 0), z: -Math.cos(P.psi) * hv }; };
  const M = (c, r, m) => new THREE.MeshStandardMaterial({ color: c, roughness: r == null ? 0.8 : r, metalness: m || 0.1 });

  W.init = function (sc, hooks) {
    scene = sc; zc = SIM.geo.toXZ(ZONE.lat, ZONE.lon); W.zc = zc; ZONE.x = zc.x; ZONE.z = zc.z; W.ZONE = ZONE;
    if (hooks) { say = hooks.say || say; toast = hooks.toast || toast; }
    tex.smoke = SIM.glowTex('rgba(235,235,232,0.85)', 'rgba(210,210,210,0)');
    tex.flame = SIM.glowTex('rgba(255,250,220,1)', 'rgba(255,120,20,0)');
    tex.flare = SIM.glowTex('rgba(255,255,240,1)', 'rgba(255,170,60,0)');
    const ret = col => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.strokeStyle = col; x.lineWidth = 7;
      x.strokeRect(14, 14, 100, 100); x.beginPath(); x.moveTo(64, 0); x.lineTo(64, 26); x.moveTo(64, 102); x.lineTo(64, 128); x.moveTo(0, 64); x.lineTo(26, 64); x.moveTo(102, 64); x.lineTo(128, 64); x.stroke(); return new THREE.CanvasTexture(c); };
    const mk = (t, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false })); sp.scale.setScalar(s); sp.visible = false; sp.renderOrder = 999; scene.add(sp); return sp; };
    retY = mk(ret('#ffd24a'), 0.07); retR = mk(ret('#ff3030'), 0.07);
    const dia = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#ff3b30'; x.beginPath(); x.moveTo(32, 6); x.lineTo(58, 32); x.lineTo(32, 58); x.lineTo(6, 32); x.closePath(); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 4; x.stroke(); return new THREE.CanvasTexture(c); })();
    tex.dia = dia;
  };
  W.diaTex = () => tex.dia;
  function marker() { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.dia, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false })); sp.scale.setScalar(0.028); sp.renderOrder = 998; scene.add(sp); return sp; }

  // ---------- Modèles ----------
  function fighter(color, k) {
    const f = SIM.buildFighter({ style: color === 'rouge' ? 'rouge' : W.paint }); f.root.rotation.order = 'YXZ';
    f.root.scale.setScalar(k || 1); scene.add(f.root); return f;
  }
  function tank() {
    const g = new THREE.Group(), m = M(0x5a5a3a), d = M(0x2b2b20);
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.6, 7), m); hull.position.y = 1.2; g.add(hull);
    for (const s of [-1, 1]) { const tr = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 7.4), d); tr.position.set(s * 1.9, 0.7, 0); g.add(tr); }
    const tu = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.0, 3.2), m); tu.position.set(0, 2.5, 0.4); g.add(tu);
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 5.5, 8).rotateX(Math.PI / 2), d); br.position.set(0, 2.55, -3.6); g.add(br);
    return g;
  }
  function truck(cargo) {
    const g = new THREE.Group(), m = M(0x55583a), d = M(0x222222);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.2, 2.2), m); cab.position.set(0, 1.9, -3); g.add(cab);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.6, cargo ? 2.4 : 0.5, 5.4), cargo ? M(0x6a6544) : m); bed.position.set(0, cargo ? 2.2 : 1.2, 1); g.add(bed);
    for (const z of [-3, 0.2, 2.4]) for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12).rotateZ(Math.PI / 2), d); w.position.set(s * 1.25, 0.55, z); g.add(w); }
    return g;
  }
  function samLauncher() {
    const g = truck(false), m = M(0x5d6040);
    const rack = new THREE.Group(); rack.position.set(0, 1.8, 1.5); rack.rotation.x = 0.75; g.add(rack);
    for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 6.5), m); t.position.set((i % 2 - 0.5) * 0.85, Math.floor(i / 2) * 0.85, -2.2); rack.add(t); }
    g.userData.rack = rack; return g;
  }
  function samRadar() {
    const g = truck(false), m = M(0x5d6040);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 3.5, 8), M(0x444444)); mast.position.set(0, 3.2, 1.5); g.add(mast);
    const ant = new THREE.Group(); ant.position.set(0, 5.0, 1.5); g.add(ant);
    const a = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.6, 0.3), m); a.rotation.x = -0.3; ant.add(a);
    g.userData.ant = ant; return g;
  }
  function hangar() {
    const g = new THREE.Group();
    const h = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 32, 20, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), M(0x6b6a5c, 0.9));
    h.position.y = 0; g.add(h);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), M(0x222222)); door.position.set(0, 3.5, -16.05); door.rotation.y = Math.PI; g.add(door);
    return g;
  }
  function sandbags(r) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.9, 6, 24).rotateX(Math.PI / 2), M(0x8a7a55)); t.position.y = 0.5; return t; }
  function missileModel(big) {
    const g = new THREE.Group(), k = big ? 1.5 : 1, w = M(0xe8e8e8, 0.4, 0.3), d = M(0x333333);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * k, 0.11 * k, 3.4 * k, 10).rotateX(Math.PI / 2), w); g.add(b);
    const n = new THREE.Mesh(new THREE.ConeGeometry(0.11 * k, 0.5 * k, 10).rotateX(-Math.PI / 2), d); n.position.z = -1.95 * k; g.add(n);
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.45 * k, 0.5 * k), d); f.position.z = 1.4 * k; const p = new THREE.Group(); p.rotation.z = i * Math.PI / 2 + Math.PI / 4; f.position.y = 0.2 * k; p.add(f); g.add(p); }
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.flame, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); fl.position.z = 2.2 * k; fl.scale.setScalar(2.4 * k); g.add(fl);
    g.userData.fl = fl; scene.add(g); return g;
  }
  function place(o, x, z, psi) { const y = SIM.groundH(x, z); o.position.set(x, y, z); o.rotation.y = -(psi || 0); if (!o.userData.noScale) o.scale.setScalar(1.6); scene.add(o); return y; }

  // ---------- Zone de combat ----------
  function loadZone() {
    W.loaded = true; const cx = zc.x, cz = zc.z;
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // base ennemie : hangars, chars, camions, station radar
    for (let i = 0; i < 3; i++) { const o = hangar(), x = cx + (i - 1) * 60, z = cz - 120; const y = place(o, x, z, 0); W.ground.push({ o, x, y: y + 6, z, r: 26, kind: 'hangar', name: 'Hangar ennemi', alive: true, mk: marker() }); }
    for (let i = 0; i < 6; i++) { const o = tank(), x = cx - 150 + i * 55 + rnd() * 20, z = cz + 60 + rnd() * 80; const y = place(o, x, z, rnd() * 6); W.ground.push({ o, x, y: y + 2, z, r: 14, kind: 'char', name: 'Char ennemi', alive: true, mk: marker() }); }
    for (let i = 0; i < 4; i++) { const o = truck(true), x = cx + 180 + rnd() * 60, z = cz - 40 + i * 30; const y = place(o, x, z, 1.4); W.ground.push({ o, x, y: y + 2, z, r: 12, kind: 'camion', name: 'Camion de munitions', alive: true, mk: marker() }); }
    // batteries sol-air (radar + lanceur), réparties autour de la base
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 + 0.4, r = i === 0 ? 1500 : 6000 + rnd() * 6000, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const rad = samRadar(), lan = samLauncher(), y = place(rad, x, z, a); place(lan, x + 30, z + 12, a + 0.6);
      const sb = sandbags(22); sb.position.set(x + 15, y + 0.5, z + 6); scene.add(sb);
      W.sams.push({ o: rad, o2: lan, sb, x, y: y + 3, z, r: 30, kind: 'sam', name: 'Batterie sol-air', alive: true, lock: 0, cd: 4 + i * 2, ammo: 3, mk: marker() });
    }
    // chasseurs ennemis en patrouille
    for (let i = 0; i < 4; i++) {
      const f = fighter('rouge', 1.5), a = i / 4 * Math.PI * 2;
      W.foes.push({ f, o: f.root, a, R: 9000 + i * 1500, x: cx + Math.cos(a) * 9000, z: cz + Math.sin(a) * 9000, y: SIM.groundH(cx, cz) + 3500 + i * 300, psi: a + Math.PI / 2, gamma: 0, phi: 0, V: 230, alive: true, cd: 12 + i * 5, r: 18, kind: 'chasseur', name: 'Chasseur ennemi', mk: marker() });
    }
  }
  function unloadZone() {
    [...W.ground, ...W.sams].forEach(t => { scene.remove(t.o); if (t.o2) scene.remove(t.o2); if (t.sb) scene.remove(t.sb); scene.remove(t.mk); });
    W.foes.forEach(t => { scene.remove(t.o); scene.remove(t.mk); });
    W.ground = []; W.sams = []; W.foes = []; W.loaded = false; W.target = null;
  }
  W.respawn = function () { unloadZone(); W.missiles.forEach(m => killMissile(m)); W.missiles = []; toast('Zone de combat réinitialisée : toutes les cibles sont de retour.'); };

  // ---------- Patrouille de Rafale alliés ----------
  W.setWing = function () {
    W.wing.forEach(w => scene.remove(w.o)); W.wing = [];
    if (!isFighter()) return;
    const k = SIZES[W.size].k;
    for (let i = 0; i < W.wingN; i++) { const f = fighter(null, k); W.wing.push({ f, o: f.root, off: OFFS[i], alive: true, cd: 6 + i * 3, x: P.x, y: P.y, z: P.z, cs: 'Rafale 0' + (i + 2) }); }
    W.placeWing(true);
  };
  W.placeWing = function (snap) {
    const c = Math.cos(P.psi), s = Math.sin(P.psi), k = SIZES[W.size].k;
    W.wing.forEach(w => {
      if (!w.alive) return;
      if (P.crashed && !w.loose) { w.loose = true; w.V = Math.max(w.V || 0, 160); }
      if (w.loose) { w.x += Math.sin(w.psi) * w.V * W.dt; w.z -= Math.cos(w.psi) * w.V * W.dt; }
      else {
        // position tenue dans le repère du leader (droite / arrière), avec un léger flottement naturel
        const tt = (W.t || 0) + w.off[0], wob = P.onGround ? 0 : 1;
        const ox = w.off[0] * k + Math.sin(tt * 0.7) * 1.5 * wob, oz = w.off[1] * k + Math.sin(tt * 0.45) * 2 * wob;
        w.x = P.x + c * ox - s * oz; w.z = P.z + s * ox + c * oz;
        const ty = P.onGround ? SIM.groundH(w.x, w.z) + 0.15 : P.y + (w.off[1] > 20 ? -7 : w.off[1] > 10 ? -3 : -1) + Math.sin(tt * 0.9) * 0.8;
        w.y = snap || P.onGround ? ty : w.y + (ty - w.y) * Math.min(1, W.dt * 4); w.psi = P.psi; w.V = P.V;
      }
      w.o.position.set(w.x, w.y, w.z); w.o.rotation.set(w.loose ? 0 : P.theta, -w.psi, w.loose ? 0 : -P.phi * 0.9, 'YXZ');
      w.f.update({ elev: P.stickY * 0.5, ail: P.stickX * 0.5, rud: 0, gearPos: P.gearPos, n1: P.n1, ab: P.ab || P.turbo, lights: P.lights, steer: 0 });
    });
  };
  W.applySize = function () {
    const S = SIZES[W.size];
    if (SIM.view.plane && SIM.view.plane.fighter) SIM.view.plane.root.scale.setScalar(S.k);
    P.rollK = isFighter() ? S.roll : 1; W.ammo = FULL(); W.flares = 60;
    W.setWing();
  };

  // ---------- Missiles ----------
  function launch(owner, x, y, z, vel, target, opt) {
    const big = owner === 'sam', o = missileModel(big);
    const v = new V3(vel.x, vel.y, vel.z); let spd = v.length(); if (spd < 1) { v.set(0, 1, 0); spd = 30; }
    const m = Object.assign({ o, owner, target, x, y, z, dir: v.normalize(), spd, maxSpd: 900, turn: 24 * D2R, t: 0, life: 38, trail: [], tt: 0, decoyRolled: 0 }, opt || {});
    W.missiles.push(m); return m;
  }
  function killMissile(m) { scene.remove(m.o); m.trail.forEach(s => scene.remove(s)); m.dead = true; }
  function tpos(t) {
    if (t === 'player') return P.crashed ? null : { x: P.x, y: P.y, z: P.z, v: playerVel() };
    if (!t || !t.alive && !t.isFlare) return null;
    const v = t.isFlare ? { x: t.vx, y: t.vy, z: t.vz } : t.V ? { x: Math.sin(t.psi) * t.V, y: Math.sin(t.gamma || 0) * t.V, z: -Math.cos(t.psi) * t.V } : { x: 0, y: 0, z: 0 };
    return { x: t.x, y: t.y, z: t.z, v };
  }
  const tmp = new V3(), want = new V3();
  function stepMissile(m, dt) {
    m.t += dt;
    m.spd = m.t < 3.2 ? Math.min(m.maxSpd, m.spd + 330 * dt) : Math.max(250, m.spd - 9 * dt);
    const tp = tpos(m.target);
    if (tp) {
      const d = Math.hypot(tp.x - m.x, tp.y - m.y, tp.z - m.z), tgo = d / Math.max(m.spd, 200);
      want.set(tp.x + tp.v.x * tgo * 0.85 - m.x, tp.y + tp.v.y * tgo * 0.85 - m.y, tp.z + tp.v.z * tgo * 0.85 - m.z).normalize();
      const ang = m.dir.angleTo(want);
      if (m.t > (m.owner === 'sam' ? 1.2 : 0.35)) {
        if (ang > 75 * D2R && d < 2500) { m.target = null; if (m.owner !== 'player') m.missed = true; }   // dépassé : la cible a esquivé
        else { const k = Math.min(1, m.turn * dt / Math.max(ang, 1e-4)); m.dir.lerp(want, k).normalize(); }
      }
      if (d < (m.owner === 'player' || m.owner === 'wing' ? 32 : 24) || (d < 80 && tgo < dt * 1.5)) { hit(m, m.target); return; }
    }
    m.x += m.dir.x * m.spd * dt; m.y += m.dir.y * m.spd * dt; m.z += m.dir.z * m.spd * dt;
    const gh = SIM.groundH(m.x, m.z);
    if (m.y < gh + 1.5) { groundBlast(m.x, gh, m.z, m.owner, m.cs); killMissile(m); return; }
    if (m.t > m.life) { SIM.boom.small(m.x, m.y, m.z, 0.35); killMissile(m); return; }
    // modèle, flamme et traînée de fumée
    m.o.position.set(m.x, m.y, m.z); m.o.rotation.set(Math.asin(clamp(m.dir.y, -1, 1)), -Math.atan2(m.dir.x, -m.dir.z), 0, 'YXZ');
    m.o.userData.fl.visible = m.t < 9; m.o.userData.fl.scale.setScalar((m.owner === 'sam' ? 3.6 : 2.4) * (0.8 + Math.random() * 0.4));
    m.tt -= dt;
    if (m.tt <= 0 && m.t < 14) {
      m.tt = 0.07;
      let s = m.trail.length < 46 ? null : m.trail.shift();
      if (!s) { s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.smoke, transparent: true, depthWrite: false })); scene.add(s); }
      s.position.set(m.x - m.dir.x * 3, m.y - m.dir.y * 3, m.z - m.dir.z * 3); s.userData.age = 0; m.trail.push(s);
    }
    m.trail.forEach(s => { s.userData.age += dt; const a = s.userData.age; s.scale.setScalar(2.5 + a * 3.2); s.material.opacity = Math.max(0, 0.75 - a * 0.2); });
  }
  function groundBlast(x, y, z, by, cs, noFx) {
    if (!noFx) SIM.boom.small(x, y + 2, z, 0.7, true);
    if (W.truckMode && W.truck && W.truck.alive && by !== 'player' && Math.hypot(W.truck.x - x, W.truck.z - z) < 32) truckHit();
    [...W.ground, ...W.sams].forEach(t => { if (t.alive && Math.hypot(t.x - x, t.z - z) < t.r + 25) destroy(t, by, cs); });
  }
  function hit(m, t) {
    killMissile(m);
    if (t === 'player' && m.owner === 'peer') { if (SIM.net) SIM.net.downBy(m.from, m.cs); return; }
    if (t && t.isPeer) { SIM.boom.small(m.x, m.y, m.z, 1); if (m.owner === 'player' && SIM.net) SIM.net.onPeerHit(t); return; }
    if (t === 'player') { shotDown(m.owner === 'sam' ? 'Abattu par un missile sol-air ennemi !' : 'Abattu par le missile d\'un chasseur ennemi !'); return; }
    if (t && t.isFlare) { SIM.boom.small(m.x, m.y, m.z, 0.4); return; }
    if (t && t.alive) {
      if (t.kind === 'chasseur' || t.kind === 'rafale') { SIM.boom.small(t.x, t.y, t.z, 0.9); destroy(t, m.owner, m.cs); }
      else if (t.kind === 'truck') { groundBlast(t.x, t.y, t.z, m.owner); }
      else groundBlast(t.x, t.y, t.z, m.owner, m.cs);
    } else SIM.boom.small(m.x, m.y, m.z, 0.4);
  }
  function destroy(t, by, cs) {
    if (!t.alive) return; t.alive = false; scene.remove(t.mk);
    if (W.target === t) { W.target = null; W.lockT = 0; }
    if (t.kind === 'chasseur' || t.kind === 'rafale') { t.falling = true; t.gamma = -0.5; t.phi = 1.2; }
    else {
      const dark = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 1 });
      [t.o, t.o2].forEach(o => o && o.traverse(c => { if (c.isMesh) c.material = dark; }));
      t.smokeT = 0;
    }
    if (by === 'player') { W.kills++; say('Cible détruite'); toast('✔ ' + t.name + ' détruit ! (' + W.kills + ')', 2200); SIM.radio('VOUS', `${SIM.atc.CS}, ${t.name.toLowerCase()} détruit !`, false, `${SIM.atc.CS}, ${t.kind === 'chasseur' ? 'splash one, enemy fighter down' : 'target destroyed'}!`); }
    else if (by === 'wing') SIM.radio(cs || 'Rafale 02', `${t.name} détruit, je reste en formation.`, true, `${t.kind === 'chasseur' ? 'Splash one' : 'Target destroyed'}, back in formation.`);
  }
  function shotDown(why) {
    if (P.crashed) return;
    Object.assign(P, { crashed: true, crashKind: 'sol', crashV: Math.min(P.V, 120), crashVs: P.vs, crashPhi: P.phi + 0.6, crashY: P.y, eng: [false, false] });
    P.V = 0; SIM.onEvent && SIM.onEvent('crash', why);
  }

  // ---------- Commandes du pilote ----------
  W.fire = function () {
    if (!isFighter()) return toast('Les missiles sont disponibles sur le Rafale (Type : Chasseur).');
    if (P.onGround || P.crashed) return toast('Tir possible en vol seulement.');
    if (W.ammo <= 0) return toast('Plus de missiles ! Posez-vous sur un aéroport pour réarmer.');
    const locked = W.target && W.lockT >= 1.2;
    W.side = -(W.side || 1);
    const c = Math.cos(P.psi), s = Math.sin(P.psi), k = SIZES[W.size].k, ox = W.side * 3.4 * k;
    const v = playerVel(), sp = Math.max(P.V, 150), f = new V3(v.x, v.y, v.z).normalize();
    const mm = launch('player', P.x + c * ox, P.y - 1.2 * k, P.z + s * ox, { x: f.x * sp, y: f.y * sp - 6, z: f.z * sp }, locked ? W.target : null, { turn: 30 * D2R, maxSpd: 1000 });
    if (SIM.net) SIM.net.onLaunch(mm);
    W.ammo--;
    toast(locked ? `Missile parti vers : ${W.target.name} (${(dist3(W.target, P) / 1000).toFixed(1)} km). Reste ${W.ammo}.` : `Missile tiré SANS cible verrouillée (vol droit). Reste ${W.ammo}.`, 2500);
    say('Fox deux'); SIM.radio('VOUS', `${SIM.atc.CS}, missile parti${locked ? ' sur ' + W.target.name.toLowerCase() : ''} !`, false, `${SIM.atc.CS}, fox two!`);
  };
  W.dropFlares = function () {
    if (!isFighter() || P.onGround || P.crashed) return;
    if (W.flares <= 0) return toast('Plus de leurres !');
    W.flares = Math.max(0, W.flares - 4); const v = playerVel();
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.flare, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(6); scene.add(s);
      const a = (i - 1.5) * 0.7;
      W.flareL.push({ s, isFlare: true, x: P.x, y: P.y - 2, z: P.z, vx: v.x * 0.55 + Math.cos(P.psi) * a * 18, vy: v.y * 0.5 - 4, vz: v.z * 0.55 + Math.sin(P.psi) * a * 18, t: 0 });
    }
    // chaque missile qui vous poursuit a de bonnes chances de suivre un leurre
    W.missiles.forEach(m => { if (m.target === 'player' && !m.dead && dist3(m, P) < 9000 && m.decoyRolled < 3) { m.decoyRolled++; if (Math.random() < 0.75) m.target = W.flareL[W.flareL.length - 1 - Math.floor(Math.random() * 4)]; } });
    toast('Leurres largués (' + W.flares + ' restants)', 1200);
  };
  function candidates() {
    const f = playerVel(), fw = new V3(f.x, f.y, f.z).normalize(), out = [];
    [...W.foes, ...W.sams, ...W.ground, ...(SIM.net ? SIM.net.targets() : [])].forEach(t => {
      if (!t.alive) return; const d = dist3(t, P); if (d > 24000 || d < 150) return;
      tmp.set(t.x - P.x, t.y - P.y, t.z - P.z).normalize(); const ang = fw.angleTo(tmp) * R2D;
      if (ang < 38) out.push({ t, d, ang });
    });
    return out.sort((a, b) => a.ang - b.ang);
  }
  W.nextTarget = function () {
    const c = candidates(); if (!c.length) return toast('Aucune cible devant vous (moins de 24 km, dans l\'axe du nez).');
    const i = c.findIndex(e => e.t === W.target); W.target = c[(i + 1) % c.length].t; W.lockT = 0; W.manual = 3;
    toast('Cible : ' + W.target.name + ' — ' + (dist3(W.target, P) / 1000).toFixed(1) + ' km', 1500);
  };
  W.goFront = function () {
    if (!isFighter()) return toast('Choisissez d\'abord le Rafale (Votre avion → Type : Chasseur).');
    const a = Math.atan2(zc.x - SIM.route.dep.x, -(zc.z - SIM.route.dep.z)), r = 32000;
    const x = zc.x - Math.sin(a) * r, z = zc.z + Math.cos(a) * r;
    Object.assign(P, { x, z, y: Math.max(SIM.groundH(x, z), SIM.groundH(zc.x, zc.z)) + 4200, psi: (a + Math.PI * 2) % (Math.PI * 2), theta: 0.04, phi: 0, gamma: 0, V: 260, onGround: false, gearDown: false, gearPos: 0, flapSel: 0, flapPos: 0,
      thr: 0.85, rev: false, pbrk: false, brake: false, parked: false, boarding: false, doorsClosed: false, autoTaxi: null, landed: false, crashed: false, belly: false, airTime: 100, lawB: 1, liftOn: false, lift: 0, n1: [0.85, 0.85], eng: [true, true], ci: {} });
    Object.assign(P.ap, { on: false, athr: false, full: false, srs: false });
    if (SIM.atc) { SIM.atc.q.length = 0; SIM.atc.st = 99; }
    SIM.view.clearFx(); SIM.world.terrain.rebuild(P.x, P.z, true); if (SIM.nature.rebuild) SIM.nature.rebuild(P.x, P.z, true);
    W.placeWing(true); W.ammo = FULL(); W.flares = 60;
    SIM.radio('VOUS', `${SIM.atc.CS}, patrouille de ${W.wingN + 1} Rafale, entrée dans la ${ZONE.name}.`, false, `${SIM.atc.CS}, flight of ${W.wingN + 1}, entering combat zone Alpha.`);
    SIM.radio('AWACS', `${SIM.atc.CS}, AWACS, zone hostile à 30 kilomètres droit devant : défense sol-air active et 4 chasseurs. Volez bas pour échapper aux radars, leurres en cas de missile.`, false, `${SIM.atc.CS}, AWACS, hostile area 30 kilometres ahead: active surface-to-air defence and four fighters. Fly low to stay under radar, flares if a missile is inbound.`);
    toast('Au front ! Entrée = tirer · Y = cible suivante · Retour arrière = leurres · W/S ou ↑↓ pour monter / descendre vite.', 9000);
  };

  // ---------- Boucle ----------
  W.update = function (dt, t) {
    W.dt = dt; W.t = t;
    if (!W.strip && W.gh0 === undefined && Math.hypot(P.x - zc.x, P.z - zc.z) < 160000) buildStrip();
    const dz = Math.hypot(P.x - zc.x, P.z - zc.z);
    if (!W.loaded && dz < 160000) loadZone(); else if (W.loaded && dz > 220000 && !W.missiles.length && !W.truckMode) unloadZone();
    const fighterOn = isFighter() && !P.crashed;
    if (W.wing.length && !isFighter()) W.setWing();
    W.placeWing(false);
    W.rwr = ''; let threat = null;
    const onMe = W.missiles.filter(m => m.target === 'player' && !m.dead).length, canShoot = onMe < 2;
    // batteries sol-air : détection radar, verrouillage, tir
    W.sams.forEach(s => {
      if (s.o.userData.ant && s.alive) s.o.userData.ant.rotation.y += dt * (s.lock > 0 ? 0 : 1.6);
      if (!s.alive) { smoke(s, dt); return; }
      s.cd -= dt;
      // cible : votre Rafale, ou (en mode ennemi) les Rafale du raid
      let tg = null, d = 1e9;
      if (fighterOn && !W.truckMode && !P.onGround && !SIM.troops.active) { const dd = dist3(s, P); if (dd < 20000 && P.agl > 100 && P.y - s.y > 120) { tg = 'player'; d = dd; } }
      else if (W.truckMode) W.raid.forEach(r => { if (r.alive && !r.falling) { const dd = dist3(s, r); if (dd < 18000 && dd < d && r.y - s.y > 150) { tg = r; d = dd; } } });
      if (tg) { const tp = tg === 'player' ? P : tg; s.lock += dt; if (s.o.userData.ant) s.o.userData.ant.rotation.y = Math.atan2(tp.x - s.x, tp.z - s.z); if (tg === 'player') W.rwr = W.rwr || (s.lock > 2.5 ? 'lock' : 'radar'); }
      else s.lock = Math.max(0, s.lock - dt * 2);
      const ok = tg === 'player' ? canShoot && !threat : !!tg;
      if (tg && s.lock > 5 && s.cd <= 0 && s.ammo > 0 && ok) {
        s.cd = tg === 'player' ? 24 + Math.random() * 10 : 14 + Math.random() * 8; if (tg === 'player') s.ammo--;
        const m = launch('sam', s.x + 30, s.y + 4, s.z + 12, { x: 0, y: 40, z: 0 }, tg, { turn: 20 * D2R, maxSpd: 800, life: 32 });
        if (tg === 'player') { say('Missile, missile !'); SIM.radio('AWACS', `${SIM.atc.CS}, MISSILE SOL-AIR tiré sur vous ! Leurres et virage serré !`, false, `${SIM.atc.CS}, SAM launch, SAM launch! Flares and break!`); threat = m; }
      }
    });
    // chasseurs ennemis
    W.foes.forEach(f => {
      if (f.falling) {
        f.gamma = Math.max(-1.2, f.gamma - dt * 0.4); f.phi += dt * 2.5;
        f.x += Math.sin(f.psi) * f.V * dt; f.z -= Math.cos(f.psi) * f.V * dt; f.y += Math.sin(f.gamma) * f.V * dt;
        f.ft = (f.ft || 0) - dt; if (f.ft <= 0) { f.ft = 0.06; SIM.boom.puff(f.x, f.y, f.z, 8, 4, 'smoke'); SIM.boom.puff(f.x, f.y, f.z, 4, 0.5, 'fire'); }
        const gh = SIM.groundH(f.x, f.z); if (f.y < gh + 2) { SIM.boom.small(f.x, gh + 2, f.z, 1.2, true); f.falling = false; scene.remove(f.o); }
        else { f.o.position.set(f.x, f.y, f.z); f.o.rotation.set(f.gamma, -f.psi, -f.phi, 'YXZ'); }
        return;
      }
      if (!f.alive) return;
      f.cd -= dt;
      let tgt = null, d = 1e9;
      if (fighterOn && !W.truckMode && !P.onGround && !SIM.troops.active) { d = dist3(f, P); if (d < 26000) tgt = 'player'; }
      else if (W.truckMode) W.raid.forEach(r => { if (r.alive && !r.falling) { const dd = dist3(f, r); if (dd < 30000 && dd < d) { d = dd; tgt = r; } } });
      const engage = !!tgt, tpp = tgt === 'player' ? P : tgt;
      let tx, ty, tz;
      if (engage) { tx = tpp.x; ty = tpp.y; tz = tpp.z; }
      else { f.a += dt * f.V / f.R * 0.8; tx = zc.x + Math.cos(f.a) * f.R; tz = zc.z + Math.sin(f.a) * f.R; ty = SIM.groundH(zc.x, zc.z) + 3500; }
      const brg = Math.atan2(tx - f.x, -(tz - f.z)), err = SIM.wrap((brg - f.psi) * R2D) * D2R, rate = 10 * D2R;
      const turn = clamp(err, -rate * dt, rate * dt); f.psi += turn; f.phi += (clamp(err * 2, -1.1, 1.1) - f.phi) * Math.min(1, dt * 2);
      const gmin = SIM.groundH(f.x, f.z) + 250;
      f.gamma += (clamp((Math.max(ty, gmin) - f.y) * 0.004, -0.35, 0.35) - f.gamma) * Math.min(1, dt);
      f.V += ((engage ? 290 : 230) - f.V) * dt * 0.2;
      const hv = f.V * Math.cos(f.gamma); f.x += Math.sin(f.psi) * hv * dt; f.z -= Math.cos(f.psi) * hv * dt; f.y += Math.sin(f.gamma) * f.V * dt;
      if (f.y < gmin - 200) f.y = gmin - 200;
      f.o.position.set(f.x, f.y, f.z); f.o.rotation.set(f.gamma, -f.psi, -f.phi, 'YXZ');
      f.f.update({ elev: 0, ail: 0, rud: 0, gearPos: 0, n1: [0.9, 0.9], ab: engage, lights: { nav: 1 }, steer: 0 });
      if (engage && tgt !== 'player' && d < 7000 && Math.abs(err) < 25 * D2R && f.cd <= 0) {
        f.cd = 18 + Math.random() * 10; const sp = f.V;
        launch('foe', f.x, f.y - 1.5, f.z, { x: Math.sin(f.psi) * sp, y: Math.sin(f.gamma) * sp, z: -Math.cos(f.psi) * sp }, tgt, { turn: 18 * D2R, maxSpd: 750, life: 28 });
      }
      if (engage && tgt === 'player' && d < 8000 && Math.abs(err) < 25 * D2R && f.cd <= 0 && canShoot && !threat) {
        f.cd = 28 + Math.random() * 12;
        const sp = f.V, v = { x: Math.sin(f.psi) * sp, y: Math.sin(f.gamma) * sp, z: -Math.cos(f.psi) * sp };
        threat = launch('foe', f.x, f.y - 1.5, f.z, v, 'player', { turn: 18 * D2R, maxSpd: 750, life: 28 });
        say('Missile, missile !'); SIM.radio('AWACS', `${SIM.atc.CS}, un chasseur ennemi vous a tiré dessus ! Leurres !`, false, `${SIM.atc.CS}, enemy fighter, missile launch on you! Flares!`);
      }
      if (engage && tgt === 'player' && d < 30000) W.rwr = W.rwr || 'radar';
    });
    // incendies au sol
    W.ground.forEach(g => { if (!g.alive) smoke(g, dt); });
    // ailiers : tirent sur les ennemis proches
    if (fighterOn && W.loaded && !P.onGround) W.wing.forEach(w => {
      if (!w.alive || w.loose) return; w.cd -= dt; if (w.cd > 0) return;
      const pool = [...W.foes, ...W.sams, ...W.ground].filter(e => e.alive && e !== W.target && Math.hypot(e.x - w.x, e.z - w.z) < 16000);
      if (!pool.length) { w.cd = 2; return; }
      const e = pool[Math.floor(Math.random() * pool.length)]; w.cd = 14 + Math.random() * 10;
      const sp = Math.max(P.V, 150), v = playerVel(), n = new V3(v.x, v.y, v.z).normalize();
      launch('wing', w.x, w.y - 1.2, w.z, { x: n.x * sp, y: n.y * sp - 5, z: n.z * sp }, e, { turn: 28 * D2R, maxSpd: 950, cs: w.cs });
      SIM.radio(w.cs, `Missile parti sur ${e.name.toLowerCase()} !`, true, 'Fox two!');
    });
    // missiles
    const nsub = Math.max(1, Math.ceil(dt / 0.02));
    for (let i = 0; i < nsub; i++) for (const m of W.missiles) if (!m.dead) stepMissile(m, dt / nsub);
    W.missiles = W.missiles.filter(m => !m.dead);
    // leurres
    W.flareL = W.flareL.filter(f => { f.t += dt; f.vy -= 9.81 * dt * 0.6; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; f.vx *= 1 - dt * 0.8; f.vz *= 1 - dt * 0.8; f.s.position.set(f.x, f.y, f.z); f.s.scale.setScalar(6 * (0.7 + Math.random() * 0.6)); if (f.t > 5) { scene.remove(f.s); return false; } return true; });
    // menace la plus proche (alarme)
    let near = null, nd = 1e9;
    W.missiles.forEach(m => { if (m.target === 'player') { const d = dist3(m, P); if (d < nd) { nd = d; near = m; } } });
    W.threat = near ? nd : 0;
    // verrouillage de cible devant le nez
    if (fighterOn && !P.onGround && !W.truckMode) {
      const c = candidates();
      if (W.manual > 0) W.manual -= dt;
      if (W.target && (!W.target.alive || !c.some(e => e.t === W.target))) { W.target = null; W.lockT = 0; }
      if (!W.target && c.length) { W.target = c[0].t; W.lockT = 0; }
      if (W.target) { const was = W.lockT; W.lockT += dt; if (was < 1.2 && W.lockT >= 1.2) say('Verrouillé'); }
    } else { W.target = null; W.lockT = 0; }
    // réticule et marqueurs
    if (W.truckMode && W.truck && W.truck.tgt) { const lk = W.truck.lockT >= 1.5, r = lk ? retR : retY; (lk ? retY : retR).visible = false; r.visible = true; r.position.set(W.truck.tgt.x, W.truck.tgt.y, W.truck.tgt.z); }
    else if (W.target) { const r = W.lockT >= 1.2 ? retR : retY; (r === retR ? retY : retR).visible = false; r.visible = true; r.position.set(W.target.x, W.target.y, W.target.z); }
    else retY.visible = retR.visible = false;
    const showMk = isFighter();
    [...W.foes, ...W.sams, ...W.ground].forEach(e => { if (e.alive) { e.mk.visible = showMk && dist3(e, P) < 60000; e.mk.position.set(e.x, e.y + 25, e.z); } });
    // réarmement au sol sur un aéroport
    if (isFighter() && P.onGround && P.V < 2 && (SIM.surface(P.x, P.z).ap || SIM.surface(P.x, P.z).strip) && (W.ammo < FULL() || W.flares < 60)) { W.ammo = FULL(); W.flares = 60; toast('Réarmement : ' + W.ammo + ' missiles et 60 leurres.'); }
    if (W.truckMode && W.truck) { updateTruck(dt); W.truckHud(); } else W.hud(dz);
  };
  function smoke(e, dt) { e.smokeT = (e.smokeT || 0) - dt; if (e.smokeT <= 0 && dist3(e, P) < 30000) { e.smokeT = 0.5; SIM.boom.puff(e.x + (Math.random() - 0.5) * 8, e.y + 4, e.z + (Math.random() - 0.5) * 8, 14, 9, 'smoke'); if (Math.random() < 0.4) SIM.boom.puff(e.x, e.y + 1, e.z, 7, 0.9, 'fire'); } }

  W.guide = function () {
    if (!isFighter() || P.onGround || P.crashed) return null;
    const dz = Math.hypot(P.x - zc.x, P.z - zc.z); if (dz > 70000) return null;
    const brg = Math.round((Math.atan2(zc.x - P.x, -(zc.z - P.z)) * R2D + 360) % 360);
    if (W.threat) return { ph: 'MISSILE EN APPROCHE !', t: 'Retour arrière = leurres, puis virage serré (← ou →) et descente (S ou ↑). Volez sous 300 ft pour disparaître des radars.', n: `Missile à ${(W.threat / 1000).toFixed(1)} km.` };
    if (W.target) return { ph: 'Combat — cible ' + (W.lockT >= 1.2 ? 'verrouillée' : 'en acquisition'), t: `${W.target.name} à ${(dist3(W.target, P) / 1000).toFixed(1)} km. ${W.lockT >= 1.2 ? 'Appuyez sur ENTRÉE pour tirer.' : 'Gardez le nez dessus 1 seconde.'}`, n: `Missiles ${W.ammo} · leurres ${W.flares} · Y = cible suivante.` };
    return { ph: 'Combat — ' + ZONE.name, t: `Zone à ${(dz / 1000).toFixed(1)} km, cap ${String(brg).padStart(3, '0')}°. Pointez le nez vers un losange rouge pour verrouiller une cible.`, n: 'W/S : montée / descente rapides. Posez-vous sur un aéroport pour réarmer.' };
  };
  // ---------- Affichage tête haute (combat) ----------
  W.hud = function (dz) {
    const el = document.getElementById('warHud'); if (!el) return;
    if (!isFighter()) { el.hidden = true; return; }
    el.hidden = false;
    const brg = Math.round((Math.atan2(zc.x - P.x, -(zc.z - P.z)) * R2D + 360) % 360);
    const aliveN = [...W.foes, ...W.sams, ...W.ground].filter(e => e.alive).length;
    let h = `<div class="wl"><b>RAFALE ${SIZES[W.size].name.toUpperCase()}</b> · missiles <b>${W.ammo}</b> · leurres <b>${W.flares}</b> · abattus <b>${W.kills}</b> · patrouille <b>${W.wing.filter(w => w.alive).length + 1}</b></div>`;
    h += `<div class="wl">${ZONE.name} : ${dz < 1000 ? 'au-dessus' : (dz / 1000).toFixed(0) + ' km, cap ' + String(brg).padStart(3, '0') + '°'}${W.loaded ? ' · ' + aliveN + ' cibles' : ''}</div>`;
    if (W.target) h += `<div class="wl ${W.lockT >= 1.2 ? 'lk' : ''}">${W.lockT >= 1.2 ? '◼ VERROUILLÉ' : '◻ acquisition…'} ${W.target.name} — ${(dist3(W.target, P) / 1000).toFixed(1)} km ${W.lockT >= 1.2 ? '· ENTRÉE = TIRER' : ''}</div>`;
    else if (W.loaded) h += `<div class="wl dim">Pointez le nez vers un losange rouge pour verrouiller (Y = cible suivante)</div>`;
    if (W.threat) h += `<div class="wl al">⚠ MISSILE EN APPROCHE ${(W.threat / 1000).toFixed(1)} km — RETOUR ARRIÈRE = LEURRES, virez serré, descendez</div>`;
    else if (W.rwr === 'lock') h += `<div class="wl al">⚠ RADAR ENNEMI VERROUILLÉ — descendez sous 300 ft ou changez de cap</div>`;
    else if (W.rwr === 'radar') h += `<div class="wl warn">◉ Radar ennemi détecte votre Rafale</div>`;
    if (el._h !== h) { el.innerHTML = h; el._h = h; }
  };

  // ---------- Piste avancée (base alliée) près du front ----------
  function buildStrip() {
    const gh0 = W.gh0 = W.gh0 || SIM.groundH, sf0 = W.sf0 = W.sf0 || SIM.surface;
    let best = null;
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2, cx = zc.x + Math.cos(a) * 4200, cz = zc.z + Math.sin(a) * 4200;
      if (SIM.isSea(cx, cz)) continue;
      const hdg = a + Math.PI / 2, ux = Math.sin(hdg), uz = -Math.cos(hdg); let mn = 1e9, mx = -1e9;
      for (let k = -10; k <= 10; k++) for (const w of [-30, 0, 30]) { const x = cx + ux * k * 105 + uz * -w, z = cz + uz * k * 105 + ux * w, h = gh0(x, z); mn = Math.min(mn, h); mx = Math.max(mx, h); }
      if (!best || mx - mn < best.rng) best = { x: cx, z: cz, hdg, rng: mx - mn, mn, mx };
    }
    const st = W.strip = { x: best.x, z: best.z, hdg: best.hdg, len: 2200, wid: 60, elev: best.mx + 0.6 };
    st.ux = Math.sin(st.hdg); st.uz = -Math.cos(st.hdg);
    st.local = (x, z) => { const dx = x - st.x, dz = z - st.z; return { lz: dx * st.ux + dz * st.uz, lx: dx * -st.uz + dz * st.ux }; };
    st.inside = (x, z, m) => { const L = st.local(x, z); return Math.abs(L.lz) < st.len / 2 + (m || 0) && Math.abs(L.lx) < st.wid / 2 + (m || 0); };
    SIM.groundH = (x, z) => st.inside(x, z) ? st.elev : gh0(x, z);
    SIM.surface = (x, z) => { if (st.inside(x, z)) { const L = st.local(x, z); return { type: 'piste', ap: null, strip: true, lx: L.lx, lz: L.lz }; } return sf0(x, z); };
    // remblai en terre compactée avec marquages
    const thick = best.mx - best.mn + 6;
    const t = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 1024; const x = c.getContext('2d'); x.fillStyle = '#8a7656'; x.fillRect(0, 0, 128, 1024);
      for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '60,45,30' : '170,150,115'},0.25)`; x.fillRect(Math.random() * 128, Math.random() * 1024, 2, 3); }
      x.fillStyle = 'rgba(50,38,25,0.35)'; x.fillRect(44, 0, 10, 1024); x.fillRect(74, 0, 10, 1024);
      x.fillStyle = '#e8e2d0'; for (let j = 0; j < 1024; j += 64) { x.fillRect(4, j, 6, 30); x.fillRect(118, j, 6, 30); } x.fillRect(20, 4, 88, 14); x.fillRect(20, 1006, 88, 14);
      const tx = new THREE.CanvasTexture(c); return tx; })();
    const mat = [new THREE.MeshStandardMaterial({ color: 0x7a6648, roughness: 1 }), new THREE.MeshStandardMaterial({ color: 0x7a6648, roughness: 1 }), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }), new THREE.MeshStandardMaterial({ color: 0x7a6648 }), new THREE.MeshStandardMaterial({ color: 0x7a6648 }), new THREE.MeshStandardMaterial({ color: 0x7a6648 })];
    const slab = new THREE.Mesh(new THREE.BoxGeometry(st.wid + 20, thick, st.len + 40), mat); slab.position.set(st.x, st.elev - thick / 2 + 0.05, st.z); slab.rotation.y = -st.hdg; scene.add(slab);
    // tentes, sacs de sable, mât et camions alliés
    const tentM = new THREE.MeshStandardMaterial({ color: 0x5b6140, roughness: 1 });
    for (let i = 0; i < 6; i++) { const lz = -500 + i * 45, lx = st.wid / 2 + 30; const x = st.x + st.ux * lz - st.uz * lx, z = st.z + st.uz * lz + st.ux * lx; const tn = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 10, 3, 1), tentM); tn.rotation.set(0, -st.hdg, Math.PI / 2); tn.position.set(x, W.gh0(x, z) + 2, z); scene.add(tn); }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 12, 8), new THREE.MeshStandardMaterial({ color: 0xcccccc })); const px = st.x - st.uz * (st.wid / 2 + 15), pz = st.z + st.ux * (st.wid / 2 + 15); pole.position.set(px, W.gh0(px, pz) + 6, pz); scene.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), new THREE.MeshStandardMaterial({ color: 0x2f6b3a, side: THREE.DoubleSide })); flag.position.set(px + 1.6, W.gh0(px, pz) + 11, pz); scene.add(flag);
  }
  W.goStrip = function () {
    if (!isFighter()) return toast('Choisissez d\'abord le Rafale.');
    if (!W.strip) buildStrip();
    const st = W.strip, lz = st.len / 2 - 600;   // bout de piste opposé à la base ennemie
    Object.assign(P, { x: st.x + st.ux * lz, z: st.z + st.uz * lz, y: st.elev + 0.15, psi: (st.hdg + Math.PI * 2) % (Math.PI * 2), theta: 0, phi: 0, gamma: 0, V: 0, onGround: true, gearDown: true, gearPos: 1, flapSel: 0, flapPos: 0,
      thr: 0, rev: false, pbrk: true, brake: false, parked: false, boarding: false, doorsClosed: false, autoTaxi: null, landed: true, crashed: false, belly: false, airTime: 100, lawB: 1, liftOn: false, lift: 0, eng: [true, true], ci: { stopped: 1 } });
    Object.assign(P.ap, { on: false, athr: false, full: false, srs: false });
    if (SIM.atc) { SIM.atc.q.length = 0; SIM.atc.st = 99; }
    SIM.view.clearFx(); SIM.world.terrain.rebuild(P.x, P.z); if (SIM.nature.rebuild) SIM.nature.rebuild(P.x, P.z, true);
    W.placeWing(true); W.ammo = FULL(); W.flares = 60;
    toast('Posé sur la piste avancée, à 4 km de la base ennemie. Touche E (ou bouton « Sortir ») pour sortir avec votre escouade.', 8000);
  };

  // ---------- Mode ennemi : camion lance-missiles contre un raid de Rafale ----------
  W.raid = [];
  function truckHit() {
    const tr = W.truck; if (!tr.alive) return; tr.alive = false; tr.hp = 0;
    SIM.boom.small(tr.x, tr.y + 2, tr.z, 1.3, true); toast('Votre camion a été détruit ! Nouveau camion dans 5 secondes.', 5000); say('Camion détruit');
    setTimeout(() => { if (!W.truckMode) return; tr.alive = true; tr.x = zc.x + 60; tr.z = zc.z + 300; tr.psi = 0; tr.ammo = FULL(); tr.o.traverse(c => { if (c.isMesh && c.userData.m0) c.material = c.userData.m0; }); }, 5000);
  }
  W.truckStart = function () {
    if (!W.strip) buildStrip();
    if (!W.loaded) loadZone();
    if (W.truckMode) return;
    if (SIM.troops.active) SIM.troops.enter(true);
    W.truckMode = true; W.target = null;
    const o = samLauncher(); o.userData.noScale = true; o.scale.setScalar(1.5);
    const rad = new THREE.Group(); rad.position.set(0, 4.2, -3); o.add(rad);
    const dish = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 0.2), M(0x5d6040)); dish.rotation.x = -0.35; rad.add(dish);
    o.traverse(c => { if (c.isMesh) c.userData.m0 = c.material; });
    scene.add(o);
    W.truck = { o, rad, x: zc.x + 60, z: zc.z + 300, y: 0, psi: 0, v: 0, alive: true, ammo: FULL(), auto: true, lockT: 0, tgt: null, cd: 0, kind: 'truck', name: 'Camion lance-missiles' };
    // raid de Rafale (pilotés par l'ordinateur)
    W.raid.forEach(r => scene.remove(r.o)); W.raid = [];
    for (let i = 0; i < 6; i++) {
      const f = fighter(null, 1.3), a = i / 6 * Math.PI * 2;
      W.raid.push({ f, o: f.root, x: zc.x + Math.cos(a) * 28000, z: zc.z + Math.sin(a) * 28000, y: SIM.groundH(zc.x, zc.z) + 2500, psi: a + Math.PI, gamma: 0, phi: 0, V: 250, alive: true, cd: 8 + i * 4, phase: 'in', kind: 'rafale', name: 'Rafale (raid)', r: 18, mk: marker() });
    }
    if (SIM.view.plane) SIM.view.plane.root.visible = false;
    W.wing.forEach(w => w.o.visible = false); document.body.classList.add('truck');
    toast('Vous êtes la défense sol-air ennemie ! Z/↑ avancer, S reculer, Q/D tourner. Radar automatique : A = tir auto ON/OFF, Entrée = tir manuel. Abattez le raid de 6 Rafale.', 10000);
    SIM.radio('RADAR', 'Alerte ! Raid de six Rafale en approche, toutes batteries en alerte.', false, 'Alert! Six-ship Rafale raid inbound, all batteries weapons free.');
  };
  W.truckStop = function () {
    if (!W.truckMode) return; W.truckMode = false; document.body.classList.remove('truck');
    scene.remove(W.truck.o); W.truck = null; W.raid.forEach(r => { scene.remove(r.o); scene.remove(r.mk); }); W.raid = [];
    if (SIM.view.plane) SIM.view.plane.root.visible = true; W.wing.forEach(w => w.o.visible = true);
    if (isFighter()) W.goStrip(); else SIM.onEvent && SIM.onEvent('toast', 'Utilisez « Aligner en bout de piste » pour repartir.');
    toast('Retour aux commandes de votre appareil (posé sur la piste avancée).');
  };
  W.truckKey = function (lk, ev, down) {
    W.tk = W.tk || {}; W.tk[lk] = down; if (!down || ev.repeat) return;
    if (lk === 'enter' || lk === ' ') W.truckFire(true);
    else if (lk === 'a') { W.truck.auto = !W.truck.auto; toast('Tir automatique ' + (W.truck.auto ? 'ACTIVÉ : le radar tire seul sur les avions verrouillés' : 'COUPÉ : tir manuel avec Entrée'), 3000); }
    else if (lk === 'y') { const c = W.raid.filter(r => r.alive && !r.falling && dist3(r, W.truck) < 30000).sort((a, b) => dist3(a, W.truck) - dist3(b, W.truck)); if (c.length) { const i = c.indexOf(W.truck.tgt); W.truck.tgt = c[(i + 1) % c.length]; W.truck.lockT = 0; } }
  };
  W.truckFire = function (manual) {
    const tr = W.truck; if (!tr || !tr.alive) return;
    if (tr.ammo <= 0) { if (manual) toast('Plus de missiles dans le camion !'); return; }
    if (!tr.tgt || tr.lockT < 1.5) { if (manual) toast('Aucun avion verrouillé : attendez que le radar accroche (carré rouge).'); return; }
    if (tr.cd > 0) return;
    tr.cd = 1.2; tr.ammo--;
    launch('player', tr.x, tr.y + 4, tr.z, { x: 0, y: 60, z: 0 }, tr.tgt, { turn: 24 * D2R, maxSpd: 900, life: 34 });
    say('Missile parti'); toast(`Missile sol-air tiré sur ${tr.tgt.name} (${(dist3(tr.tgt, tr) / 1000).toFixed(1)} km). Reste ${tr.ammo}.`, 2000);
  };
  function updateTruck(dt) {
    const tr = W.truck, K = W.tk || {};
    if (tr.alive) {
      const fw = (K.z || K.w || K.arrowup ? 1 : 0) - (K.s || K.arrowdown ? 1 : 0), st = (K.d || K.e || K.arrowright ? 1 : 0) - (K.q || K.arrowleft ? 1 : 0);
      tr.v += ((fw * (fw > 0 ? 16 : 5)) - tr.v) * Math.min(1, dt * (fw ? 0.8 : 2));
      tr.psi += st * clamp(tr.v / 6, -1, 1) * 0.6 * dt;
      tr.x += Math.sin(tr.psi) * tr.v * dt; tr.z -= Math.cos(tr.psi) * tr.v * dt;
    }
    tr.y = SIM.groundH(tr.x, tr.z); tr.o.position.set(tr.x, tr.y, tr.z); tr.o.rotation.y = -tr.psi;
    Object.assign(P, { x: tr.x, z: tr.z, y: tr.y + 0.15, V: 0, onGround: true, pbrk: true, thr: 0 });   // le terrain suit le camion
    tr.cd -= dt;
    // radar : accroche l'avion le plus proche
    if (tr.alive) {
      if (tr.tgt && (!tr.tgt.alive || tr.tgt.falling || dist3(tr.tgt, tr) > 30000)) { tr.tgt = null; tr.lockT = 0; }
      if (!tr.tgt) { let bd = 30000; W.raid.forEach(r => { if (r.alive && !r.falling) { const d = dist3(r, tr); if (d < bd) { bd = d; tr.tgt = r; } } }); tr.lockT = 0; }
      if (tr.tgt) { tr.lockT += dt; tr.rad.rotation.y = Math.atan2(tr.tgt.x - tr.x, tr.tgt.z - tr.z) + tr.psi; if (tr.auto && tr.lockT > 1.5 && tr.cd <= 0 && W.missiles.filter(m => m.owner === 'player' && m.target === tr.tgt).length === 0) W.truckFire(false); }
      else tr.rad.rotation.y += dt * 1.5;
    }
    // raid
    W.raid.forEach(r => {
      if (r.falling) { fallStep(r, dt); return; }
      if (!r.alive) return;
      r.cd -= dt;
      const tgt = tr.alive && Math.random() < 0.5 ? tr : null;
      if (!r.goal || !r.goal.alive) { const pool = [...W.ground, ...W.sams].filter(g => g.alive); r.goal = (tr.alive && Math.random() < 0.55) ? tr : pool[Math.floor(Math.random() * pool.length)] || tr; }
      const g = r.goal, dg = Math.hypot(g.x - r.x, g.z - r.z);
      let tx, tz, ty = SIM.groundH(r.x, r.z) + (r.phase === 'in' ? 1800 : 3000);
      if (r.phase === 'in') { tx = g.x; tz = g.z; if (dg < 9000 && r.cd <= 0) { r.cd = 16 + Math.random() * 10; const sp = r.V; launch('raid', r.x, r.y - 1.5, r.z, { x: Math.sin(r.psi) * sp, y: -20, z: -Math.cos(r.psi) * sp }, g, { turn: 22 * D2R, maxSpd: 800, life: 30 }); r.phase = 'out'; r.outT = 25; } }
      else { r.outT -= dt; tx = r.x + Math.sin(r.psi) * 5000; tz = r.z - Math.cos(r.psi) * 5000; if (r.outT <= 0) { r.phase = 'in'; r.goal = null; } }
      const brg = Math.atan2(tx - r.x, -(tz - r.z)), err = SIM.wrap((brg - r.psi) * R2D) * D2R;
      r.psi += clamp(err, -9 * D2R * dt, 9 * D2R * dt); r.phi += (clamp(err * 2, -1.1, 1.1) - r.phi) * Math.min(1, dt * 2);
      r.gamma += (clamp((ty - r.y) * 0.004, -0.3, 0.3) - r.gamma) * Math.min(1, dt);
      const hv = r.V * Math.cos(r.gamma); r.x += Math.sin(r.psi) * hv * dt; r.z -= Math.cos(r.psi) * hv * dt; r.y += Math.sin(r.gamma) * r.V * dt;
      r.o.position.set(r.x, r.y, r.z); r.o.rotation.set(r.gamma, -r.psi, -r.phi, 'YXZ');
      r.f.update({ elev: 0, ail: 0, rud: 0, gearPos: 0, n1: [0.9, 0.9], ab: r.phase === 'out', lights: { nav: 1 }, steer: 0 });
      r.mk.visible = true; r.mk.position.set(r.x, r.y + 25, r.z);
      // leurres des Rafale du raid
      W.missiles.forEach(m => { if (m.target === r && !m.dead && !m.rRolled && dist3(m, r) < 3000) { m.rRolled = 1; if (Math.random() < 0.3) { m.target = null; for (let i = 0; i < 3; i++) SIM.boom.puff(r.x, r.y - 3, r.z, 5, 1.2, 'fire'); } } });
    });
    if (W.raid.length && W.raid.every(r => !r.alive) && !W.raidDone) { W.raidDone = true; toast('Raid repoussé : tous les Rafale sont abattus ! Nouveau raid dans 20 s.', 6000); setTimeout(() => { if (W.truckMode) { W.raidDone = false; const keep = W.truck; W.truckMode = false; scene.remove(keep.o); W.truck = null; W.truckStart(); } }, 20000); }
  }
  function fallStep(f, dt) {
    f.gamma = Math.max(-1.2, f.gamma - dt * 0.4); f.phi += dt * 2.5;
    f.x += Math.sin(f.psi) * f.V * dt; f.z -= Math.cos(f.psi) * f.V * dt; f.y += Math.sin(f.gamma) * f.V * dt;
    f.ft = (f.ft || 0) - dt; if (f.ft <= 0) { f.ft = 0.06; SIM.boom.puff(f.x, f.y, f.z, 8, 4, 'smoke'); SIM.boom.puff(f.x, f.y, f.z, 4, 0.5, 'fire'); }
    const gh = SIM.groundH(f.x, f.z); if (f.y < gh + 2) { SIM.boom.small(f.x, gh + 2, f.z, 1.2, true); f.falling = false; scene.remove(f.o); }
    else { f.o.position.set(f.x, f.y, f.z); f.o.rotation.set(f.gamma, -f.psi, -f.phi, 'YXZ'); }
  }
  W.truckCamera = function (cam) {
    if (!W.truckMode || !W.truck) return false;
    const tr = W.truck, o = SIM.view.orb, yaw = tr.psi + o.yaw, back = 26 * o.zoom;
    cam.position.set(tr.x - Math.sin(yaw) * back, tr.y + 9 * o.zoom + Math.sin(o.pitch) * back, tr.z + Math.cos(yaw) * back);
    const gh = SIM.groundH(cam.position.x, cam.position.z); if (cam.position.y < gh + 2) cam.position.y = gh + 2;
    // regarde vers l'avion verrouillé si possible
    if (tr.tgt && tr.lockT > 0.3 && !o.free) { const tg = tr.tgt; const lk = new V3(tr.x, tr.y + 3, tr.z).lerp(new V3(tg.x, tg.y, tg.z), 0.12); cam.lookAt(lk); }
    else cam.lookAt(tr.x, tr.y + 3, tr.z);
    if (cam.fov !== 60) { cam.fov = 60; cam.updateProjectionMatrix(); }
    return true;
  };
  W.truckHud = function () {
    const el = document.getElementById('warHud'); if (!el) return; el.hidden = false;
    const tr = W.truck, alive = W.raid.filter(r => r.alive && !r.falling).length;
    let h = `<div class="wl"><b>DÉFENSE SOL-AIR (ENNEMI)</b> · missiles <b>${tr.ammo}</b> · tir <b>${tr.auto ? 'AUTO' : 'MANUEL'}</b> (A) · abattus <b>${W.kills}</b> · Rafale restants <b>${alive}</b></div>`;
    h += tr.tgt ? `<div class="wl ${tr.lockT >= 1.5 ? 'lk' : ''}">${tr.lockT >= 1.5 ? '◼ RADAR VERROUILLÉ' : '◻ accrochage radar…'} ${tr.tgt.name} — ${(dist3(tr.tgt, tr) / 1000).toFixed(1)} km${tr.auto ? '' : ' · ENTRÉE = TIRER'}</div>` : '<div class="wl dim">Radar en veille : aucun avion à moins de 30 km</div>';
    const inc = W.missiles.filter(m => m.owner === 'raid' && m.target === tr && !m.dead).length;
    if (inc) h += '<div class="wl al">⚠ MISSILE AIR-SOL SUR VOTRE CAMION — déplacez-vous (Z + Q/D) !</div>';
    if (!tr.alive) h += '<div class="wl al">CAMION DÉTRUIT</div>';
    if (el._h !== h) { el.innerHTML = h; el._h = h; }
  };

  // ---------- Étiquettes ennemies à l'écran (bien visibles) ----------
  const lblV = new V3();
  W.labels = function (cam) {
    const box = document.getElementById('lbls'); if (!box) return;
    cam.updateMatrixWorld();
    const items = [];
    const me = W.truckMode && W.truck ? W.truck : SIM.troops.active && SIM.troops.me ? SIM.troops.me : P;
    const show = isFighter() || W.truckMode || SIM.troops.active;
    if (show) {
      if (W.truckMode) W.raid.forEach(r => { if (r.alive && !r.falling) items.push([r, 'RAFALE', 40000]); });
      else { W.foes.forEach(f => { if (f.alive) items.push([f, 'CHASSEUR ENNEMI', 60000]); }); W.sams.forEach(f => { if (f.alive) items.push([f, 'SOL-AIR', 40000]); }); W.ground.forEach(f => { if (f.alive) items.push([f, f.kind.toUpperCase(), 25000]); }); }
      SIM.troops.foes.forEach(f => { if (!f.dead && SIM.troops.active) items.push([{ x: f.x, y: f.y + 2, z: f.z }, 'ENNEMI', 700]); });
    }
    const vis = items.map(([e, n, R]) => [e, n, Math.hypot(e.x - me.x, e.y - me.y, e.z - me.z), R]).filter(a => a[2] < a[3]).sort((a, b) => a[2] - b[2]).slice(0, 14);
    while (box.children.length < 14) { const d = document.createElement('div'); d.className = 'lbl'; box.appendChild(d); }
    const w = window.innerWidth, h = window.innerHeight;
    for (let i = 0; i < 14; i++) {
      const d = box.children[i], it = vis[i];
      if (!it) { d.style.display = 'none'; continue; }
      lblV.set(it[0].x, it[0].y + (it[2] < 1000 ? 2 : 6), it[0].z).applyMatrix4(cam.matrixWorldInverse);
      if (lblV.z > -0.5) { d.style.display = 'none'; continue; }
      lblV.applyMatrix4(cam.projectionMatrix);
      if (Math.abs(lblV.x) > 1.05 || Math.abs(lblV.y) > 1.05) { d.style.display = 'none'; continue; }
      d.style.display = ''; d.style.transform = `translate(${((lblV.x + 1) / 2 * w).toFixed(0)}px,${((1 - lblV.y) / 2 * h).toFixed(0)}px) translate(-50%,-100%)`;
      const t = `▼ ${it[1]} ${it[2] < 1000 ? Math.round(it[2]) + ' m' : (it[2] / 1000).toFixed(1) + ' km'}`; if (d.textContent !== t) d.textContent = t;
    }
  };
  W.setPaint = function (p) { W.paint = p; };
  W.launchExt = (owner, x, y, z, vel, target, opt) => launch(owner, x, y, z, vel, target, opt);
  W.shotDownExt = why => shotDown(why);
  W.blastAt = (x, y, z, by) => groundBlast(x, y, z, by, null, true);
  W.ensureZone = () => { if (!W.strip) buildStrip(); if (!W.loaded) loadZone(); };
})();
