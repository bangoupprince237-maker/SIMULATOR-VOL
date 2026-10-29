// Crash : explosion extrême, l'avion part en mille morceaux (débris physiques, boule de feu, onde de choc, étincelles, fumée, incendies)
(function () {
  const clamp = SIM.clamp, V3 = THREE.Vector3;
  const B = SIM.boom = { debris: [], sprites: [], rings: [], active: false };
  let scene, tex = {}, shardMesh = null, shards = [], sparks = null, sparkData = null;
  const MAXS = 900, MAXP = 1600;

  B.init = function (sc) {
    scene = sc;
    tex.fire = SIM.glowTex('rgba(255,250,220,1)', 'rgba(255,80,0,0)');
    tex.core = SIM.glowTex('rgba(255,255,255,1)', 'rgba(255,200,80,0)');
    tex.smoke = SIM.glowTex('rgba(40,36,34,0.9)', 'rgba(30,30,30,0)');
    tex.spray = SIM.glowTex('rgba(240,248,255,0.95)', 'rgba(220,235,245,0)');
    tex.dust = SIM.glowTex('rgba(120,98,72,0.85)', 'rgba(110,90,70,0)');
    tex.grey = SIM.glowTex('rgba(150,150,150,0.75)', 'rgba(140,140,140,0)');
    tex.leaf = SIM.glowTex('rgba(70,110,40,0.95)', 'rgba(60,90,30,0)');
    tex.tire = SIM.glowTex('rgba(215,215,215,0.8)', 'rgba(200,200,200,0)');
    // éclair lumineux des explosions au sol, mottes de terre et éclats, traces de brûlure
    B.light = new THREE.PointLight(0xffa850, 0, 140, 2); scene.add(B.light);
    B.chunkGeo = new THREE.DodecahedronGeometry(0.25, 0); B.chunkMat = [new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 1 }), new THREE.MeshStandardMaterial({ color: 0x2b2622, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0x5a5a52, roughness: 0.6, metalness: 0.4 })];
    B.chunks = []; B.scorches = [];
    // éclats : une seule géométrie instanciée (plaques de tôle triangulaires)
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.4, 0.6, 0.05, -0.2, -0.1, -0.02, 0.6, -0.5, 0, -0.4, -0.1, -0.02, 0.6, 0.6, 0.05, -0.2], 3)); g.computeVertexNormals();
    shardMesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }), MAXS);
    shardMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXS * 3), 3);
    shardMesh.count = 0; shardMesh.frustumCulled = false; scene.add(shardMesh);
    // étincelles
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXP * 3), 3));
    sparks = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffd27a, size: 3.2, sizeAttenuation: false, map: tex.core, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sparks.frustumCulled = false; sparks.visible = false; scene.add(sparks);
    sparkData = new Float32Array(MAXP * 7);
    B.flash = document.createElement('div');
    Object.assign(B.flash.style, { position: 'fixed', inset: '0', background: 'radial-gradient(circle,#fff 0,#ffd68a 35%,#ff7a1a 70%,rgba(255,80,0,0) 100%)', opacity: '0', pointerEvents: 'none', zIndex: '4', transition: 'none' });
    document.body.appendChild(B.flash);
  };

  function sprite(t, x, y, z, size, life, o) {
    if (B.sprites.length > 650 && (t === 'smoke' || t === 'spray' || t === 'dust' || t === 'grey' || t === 'leaf' || t === 'tire')) return null;
    if (B.sprites.length > 900) return null;
    const m = new THREE.SpriteMaterial({ map: tex[t], transparent: true, depthWrite: false, blending: ['smoke', 'spray', 'dust', 'grey', 'leaf', 'tire'].includes(t) ? THREE.NormalBlending : THREE.AdditiveBlending });
    const s = new THREE.Sprite(m); s.position.set(x, y, z); s.scale.setScalar(size); scene.add(s);
    B.sprites.push(Object.assign({ s, t, life, age: 0, size, grow: 1, vy: 0, vx: 0, vz: 0, fade: 1, delay: 0 }, o || {})); return s;
  }
  function fireball(p, scale, delay) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * 6.28, r = Math.random() * 14 * scale;
      sprite('fire', p.x + Math.cos(a) * r, p.y + Math.random() * 8 * scale, p.z + Math.sin(a) * r, (8 + Math.random() * 14) * scale, 1.4 + Math.random() * 1.2, { grow: 3.2, vy: 5 + Math.random() * 10, delay: delay + Math.random() * 0.25 });
    }
    for (let i = 0; i < 6; i++) sprite('core', p.x + (Math.random() - 0.5) * 10 * scale, p.y + 3, p.z + (Math.random() - 0.5) * 10 * scale, 20 * scale, 0.5, { grow: 3, delay });
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * 6.28, r = Math.random() * 18 * scale;
      sprite('smoke', p.x + Math.cos(a) * r, p.y + 4, p.z + Math.sin(a) * r, (12 + Math.random() * 10) * scale, 14 + Math.random() * 10, { grow: 4, vy: 4 + Math.random() * 6, vx: 1.5, fade: 0.75, delay: delay + 0.4 + Math.random() * 1.5 });
    }
  }
  function ring(p, maxR, life, color) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.set(p.x, p.y + 0.6, p.z); scene.add(m); B.rings.push({ m, maxR, life, age: 0 });
  }
  function burstSparks(p, n, speed) {
    let k = 0;
    for (let i = 0; i < MAXP && k < n; i++) {
      if (sparkData[i * 7 + 6] > 0) continue;
      const a = Math.random() * 6.28, e = Math.random() * 1.3 + 0.05, v = speed * (0.4 + Math.random());
      sparkData.set([p.x, p.y + 1, p.z, Math.cos(a) * Math.cos(e) * v, Math.sin(e) * v, Math.sin(a) * Math.cos(e) * v, 1.2 + Math.random() * 1.8], i * 7); k++;
    }
    sparks.visible = true;
  }

  // ---------- Explosion ----------
  B.explode = function (plane, P, wet) {
    B.clear(); B.active = true; B.t = 0; B.wet = wet; B.at = new V3(P.x, P.y, P.z);
    const fwd = new V3(Math.sin(P.psi), 0, -Math.cos(P.psi)), Vh = Math.min(P.crashV || 70, 120), mom = fwd.clone().multiplyScalar(Vh * 0.45);
    plane.root.updateMatrixWorld(true);
    // gros morceaux : on détache les vraies pièces de l'avion (ailes, moteurs, empennage, gouvernes, train)
    const parts = [];
    plane.body.children.slice().forEach(ch => { if (ch.isMesh || ch.isGroup) parts.push(ch); });
    const mats = plane.mats, wq = new THREE.Quaternion(), wp = new V3(), ws = new V3();
    parts.forEach(ch => {
      if (ch.isSprite || ch.isLight || ch.userData.noDebris || ch === plane.cone || (ch.isGroup && ch.children.length === 0)) return;
      ch.updateMatrixWorld(true); ch.matrixWorld.decompose(wp, wq, ws);
      const geo = mats.fus && ch.isMesh && ch.geometry && ch.geometry.type === 'LatheGeometry' && ch.material === mats.fus;
      if (geo) return;                              // le fuselage est remplacé par des tronçons ci-dessous
      const clone = ch.clone(true); clone.position.copy(wp); clone.quaternion.copy(wq); clone.scale.copy(ws); scene.add(clone);
      const out = wp.clone().sub(B.at); out.y = Math.abs(out.y) + 2; out.normalize();
      const sp = 14 + Math.random() * 26;
      B.debris.push({ o: clone, v: out.multiplyScalar(sp).add(mom).add(new V3(0, 10 + Math.random() * 22, 0)), w: new V3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6), r: 2, burn: Math.random() < 0.45 });
    });
    // tronçons de fuselage arrachés
    const fusMat = mats.fus;
    for (let i = 0; fusMat && i < 7; i++) {
      const L = 3.5 + Math.random() * 2.5, arc = Math.PI * (0.6 + Math.random() * 1.1);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 1.95, L, 18, 1, true, Math.random() * 6, arc), new THREE.MeshPhongMaterial({ map: fusMat.map, side: THREE.DoubleSide, shininess: 60 }));
      const local = new V3((Math.random() - 0.5) * 0.6, 3.9, -15 + i * 4.6), w0 = local.applyMatrix4(plane.body.matrixWorld);
      seg.position.copy(w0); seg.quaternion.copy(plane.root.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2)); scene.add(seg);
      const out = new V3(Math.random() - 0.5, 0.8, Math.random() - 0.5).normalize();
      B.debris.push({ o: seg, v: out.multiplyScalar(10 + Math.random() * 22).add(mom), w: new V3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4), r: 1.9, burn: i % 2 === 0 });
    }
    plane.root.visible = false;
    // mille éclats
    const cols = [[0.95, 0.96, 0.97], [0.75, 0.78, 0.8], [0.3, 0.32, 0.35], [0.05, 0.45, 0.3], [0.95, 0.72, 0.05], [0.8, 0.1, 0.15], [0.12, 0.12, 0.12]];
    shards = [];
    for (let i = 0; i < MAXS; i++) {
      const a = Math.random() * 6.28, e = Math.random() * 1.4, v = 12 + Math.random() * 60;
      const c = cols[i % cols.length];
      shardMesh.instanceColor.setXYZ(i, c[0], c[1], c[2]);
      shards.push({ p: B.at.clone().add(new V3((Math.random() - 0.5) * 30, 2 + Math.random() * 4, (Math.random() - 0.5) * 30).applyAxisAngle(new V3(0, 1, 0), -P.psi)),
        v: new V3(Math.cos(a) * Math.cos(e) * v, Math.sin(e) * v * 0.9 + 6, Math.sin(a) * Math.cos(e) * v).add(mom), r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6), w: (Math.random() - 0.5) * 20, s: 0.4 + Math.random() * 1.6, rest: false });
    }
    shardMesh.count = MAXS; shardMesh.instanceColor.needsUpdate = true; shardMesh.visible = true;
    // feu, onde de choc, étincelles, flash
    const g0 = B.at.clone();
    if (wet) {
      for (let i = 0; i < 40; i++) sprite('spray', g0.x + (Math.random() - 0.5) * 30, g0.y + Math.random() * 6, g0.z + (Math.random() - 0.5) * 30, 10 + Math.random() * 16, 3 + Math.random() * 3, { grow: 3, vy: 12 + Math.random() * 25, fade: 0.9 });
      ring(g0, 140, 2.5, 0xbfe4ff); fireball(g0, 0.6, 0.2);
    } else {
      fireball(g0, 1.6, 0); ring(g0, 180, 1.2, 0xffb060); ring(g0, 90, 0.7, 0xffffff);
      B.secondary = [[0.5, 1.0], [1.1, 0.8], [1.8, 1.1], [2.7, 0.7], [3.6, 0.6]];
      // trace de brûlure au sol
      const sc = new THREE.Mesh(new THREE.CircleGeometry(30, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex.smoke, transparent: true, opacity: 0.9, depthWrite: false }));
      sc.position.set(g0.x, SIM.groundH(g0.x, g0.z) + 0.35, g0.z); scene.add(sc); B.scorch = sc;
    }
    burstSparks(g0, 1200, 55);
    B.flash.style.opacity = '1'; B.flashT = 0.6; B.shake = 3;
  };

  // explosion ponctuelle (missile, cible détruite) sans effacer les autres effets
  B.small = function (x, y, z, sc, ground, light) {
    const p = new V3(x, y, z); B.active = true; if (B.t == null) B.t = 0;
    if (light) {                                    // explosion courte (roquette) : boule de feu brève, peu de fumée
      for (let i = 0; i < 12; i++) sprite('fire', x + (Math.random() - 0.5) * 6 * sc, y + Math.random() * 4 * sc, z + (Math.random() - 0.5) * 6 * sc, (6 + Math.random() * 8) * sc, 0.7 + Math.random() * 0.4, { grow: 2.5, vy: 4 });
      for (let i = 0; i < 5; i++) sprite('smoke', x + (Math.random() - 0.5) * 6, y + 2, z + (Math.random() - 0.5) * 6, (6 + Math.random() * 5) * sc, 4 + Math.random() * 2, { grow: 2.5, vy: 2, fade: 0.6 });
      burstSparks(p, 80, 25); if (ground) ring(p, 40 * sc, 0.6, 0xffb060); return;
    }
    fireball(p, sc, 0); burstSparks(p, Math.round(160 * sc), 30 * sc + 10);
    if (ground) { ring(p, 70 * sc, 0.9, 0xffb060); }
    else ring(p, 40 * sc, 0.5, 0xffffff);
  };
  // explosion réaliste au sol : flash lumineux, boule de feu, colonne de poussière, mottes de terre et éclats, onde de choc, trace de brûlure
  B.real = function (x, y, z, sc, cam) {
    B.active = true; if (B.t == null) B.t = 0; sc = sc || 1;
    const p = new V3(x, y, z);
    B.light.position.set(x, y + 3, z); B.light.intensity = 9 * sc; B.light.distance = 120 * sc;
    for (let i = 0; i < 6; i++) sprite('core', x + (Math.random() - 0.5) * 2 * sc, y + 1 + Math.random() * 2 * sc, z + (Math.random() - 0.5) * 2 * sc, (5 + Math.random() * 4) * sc, 0.25, { grow: 2.4 });
    for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28, r = Math.random() * 3 * sc; sprite('fire', x + Math.cos(a) * r, y + 0.5 + Math.random() * 3 * sc, z + Math.sin(a) * r, (3.5 + Math.random() * 5) * sc, 0.6 + Math.random() * 0.6, { grow: 2.6, vy: 3 + Math.random() * 7, vx: Math.cos(a) * 3, vz: Math.sin(a) * 3 }); }
    for (let i = 0; i < 12; i++) { const a = Math.random() * 6.28, r = Math.random() * 4 * sc; sprite('dust', x + Math.cos(a) * r, y + 0.5, z + Math.sin(a) * r, (5 + Math.random() * 5) * sc, 5 + Math.random() * 4, { grow: 3, vy: 2 + Math.random() * 5, vx: Math.cos(a) * 2.5, vz: Math.sin(a) * 2.5, fade: 0.8, delay: Math.random() * 0.2 }); }
    for (let i = 0; i < 7; i++) sprite('smoke', x + (Math.random() - 0.5) * 4, y + 3 + Math.random() * 3, z + (Math.random() - 0.5) * 4, (5 + Math.random() * 4) * sc, 7 + Math.random() * 4, { grow: 3, vy: 3.5, vx: 0.8, fade: 0.55, delay: 0.3 + Math.random() * 0.6 });
    for (let i = 0; i < 18 * sc; i++) {                                              // mottes de terre et éclats métalliques
      const o = new THREE.Mesh(B.chunkGeo, B.chunkMat[i % 3]); o.position.set(x, y + 0.5, z); o.scale.setScalar((0.4 + Math.random() * 0.9) * sc); scene.add(o);
      const a = Math.random() * 6.28, e = 0.4 + Math.random() * 1.0, v = 8 + Math.random() * 18;
      B.chunks.push({ o, v: new V3(Math.cos(a) * Math.cos(e) * v, Math.sin(e) * v, Math.sin(a) * Math.cos(e) * v), w: (Math.random() - 0.5) * 18, life: 12 + Math.random() * 6 });
    }
    while (B.chunks.length > 260) { const c = B.chunks.shift(); scene.remove(c.o); }
    burstSparks(p, 160, 28 * sc); ring(p, 26 * sc, 0.5, 0xffd0a0); ring(p, 14 * sc, 0.35, 0xffffff);
    const gh = SIM.groundH(x, z), m = new THREE.Mesh(new THREE.CircleGeometry(3.5 * sc, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex.smoke, transparent: true, opacity: 0.85, depthWrite: false }));
    m.position.set(x, gh + 0.06, z); scene.add(m); B.scorches.push({ m, t: 60 }); if (B.scorches.length > 14) scene.remove(B.scorches.shift().m);
    if (cam) { const d = cam.position.distanceTo(p); B.shake = Math.max(B.shake || 0, clamp(2.2 * sc - d / 40, 0, 1.6)); if (d < 25) { B.flash.style.opacity = String(clamp(0.6 - d / 45, 0, 0.5)); B.flashT = 0.25; } }
    SIM.onBoom && SIM.onBoom(0.35 * sc);
  };
  B.puff = function (x, y, z, size, life, t) { B.active = true; return sprite(t || 'smoke', x, y, z, size, life, { grow: 2.2, fade: 0.55 }); };
  B.clear = function () {
    B.debris.forEach(d => scene.remove(d.o)); B.debris = [];
    B.sprites.forEach(s => scene.remove(s.s)); B.sprites = [];
    B.rings.forEach(r => scene.remove(r.m)); B.rings = [];
    if (B.scorch) { scene.remove(B.scorch); B.scorch = null; }
    if (B.chunks) { B.chunks.forEach(c => scene.remove(c.o)); B.chunks = []; } if (B.light) B.light.intensity = 0;
    if (shardMesh) { shardMesh.count = 0; shardMesh.visible = false; }
    if (sparkData) sparkData.fill(0); if (sparks) sparks.visible = false;
    if (B.flash) B.flash.style.opacity = '0';
    B.active = false; B.secondary = null; B.shake = 0;
  };

  const o3 = new THREE.Object3D(), G = 9.81;
  B.update = function (dt) {
    if (B.light && B.light.intensity > 0) B.light.intensity = Math.max(0, B.light.intensity - dt * 14);
    if (B.chunks && B.chunks.length) B.chunks = B.chunks.filter(c => {
      c.life -= dt; if (c.life <= 0) { scene.remove(c.o); return false; }
      if (!c.rest) { c.v.y -= G * dt; c.o.position.addScaledVector(c.v, dt); c.o.rotation.x += c.w * dt; c.o.rotation.z += c.w * 0.7 * dt;
        const gh = SIM.groundH(c.o.position.x, c.o.position.z); if (c.o.position.y < gh + 0.1) { c.o.position.y = gh + 0.1; c.v.y *= -0.3; c.v.x *= 0.5; c.v.z *= 0.5; if (Math.abs(c.v.y) < 1) c.rest = true; } }
      return true; });
    if (B.scorches && B.scorches.length) B.scorches = B.scorches.filter(sc => { sc.t -= dt; sc.m.material.opacity = Math.min(0.85, sc.t / 20); if (sc.t <= 0) { scene.remove(sc.m); return false; } return true; });
    if (!B.active) return;
    B.t += dt;
    if (B.flashT > 0) { B.flashT -= dt; B.flash.style.opacity = String(clamp(B.flashT / 0.6, 0, 1) * 0.9); }
    B.shake = Math.max(0, B.shake - dt * 1.1);
    // explosions secondaires sur les débris en feu
    if (B.secondary && B.secondary.length && B.t > B.secondary[0][0]) {
      const [, sc] = B.secondary.shift(), d = B.debris[Math.floor(Math.random() * B.debris.length)];
      const p = d ? d.o.position.clone() : B.at; fireball(p, sc, 0); burstSparks(p, 300, 35); ring(p, 90 * sc, 0.8, 0xffa040); B.shake = Math.max(B.shake, 1.5 * sc);
      SIM.onBoom && SIM.onBoom(sc);
    }
    // gros débris
    B.debris.forEach(d => {
      const o = d.o, gh = B.wet ? 0.2 : SIM.groundH(o.position.x, o.position.z);
      if (!d.rest) {
        d.v.y -= G * dt; o.position.addScaledVector(d.v, dt);
        o.rotateX(d.w.x * dt); o.rotateY(d.w.y * dt); o.rotateZ(d.w.z * dt);
        if (o.position.y < gh + d.r * 0.3) {
          o.position.y = gh + d.r * 0.3;
          if (B.wet) { d.v.multiplyScalar(0.3); d.v.y = -0.6; d.w.multiplyScalar(0.3); d.sink = true; }
          else { d.v.y = Math.abs(d.v.y) * 0.32; d.v.x *= 0.55; d.v.z *= 0.55; d.w.multiplyScalar(0.6); if (Math.abs(d.v.y) < 1.5 && Math.hypot(d.v.x, d.v.z) < 2) d.rest = true; }
        }
      } else if (d.sink) o.position.y -= dt * 0.25;
      if (d.burn && !B.wet) {
        d.ft = (d.ft || 0) - dt;
        if (d.ft <= 0 && B.t < 40) { d.ft = 0.12 + Math.random() * 0.12; sprite('fire', o.position.x + (Math.random() - 0.5) * 2, o.position.y + 1, o.position.z + (Math.random() - 0.5) * 2, 4 + Math.random() * 4, 0.8, { grow: 1.6, vy: 6 }); if (Math.random() < 0.35) sprite('smoke', o.position.x, o.position.y + 3, o.position.z, 6, 9, { grow: 4, vy: 5, vx: 1, fade: 0.6 }); }
      }
    });
    // éclats
    for (let i = 0; i < shards.length; i++) {
      const s = shards[i];
      if (!s.rest) {
        s.v.y -= G * dt; s.v.multiplyScalar(1 - 0.25 * dt); s.p.addScaledVector(s.v, dt); s.r.x += s.w * dt; s.r.y += s.w * 0.7 * dt;
        const gh = B.wet ? 0.3 : SIM.groundH(s.p.x, s.p.z);
        if (s.p.y < gh + 0.1) { s.p.y = gh + 0.1; s.v.y = -s.v.y * 0.25; s.v.x *= 0.5; s.v.z *= 0.5; s.w *= 0.5; if (Math.abs(s.v.y) < 1) { s.rest = true; s.r.x = (Math.random() - 0.5) * 0.3; } }
      } else if (B.wet) s.p.y -= dt * 0.15;
      o3.position.copy(s.p); o3.rotation.copy(s.r); o3.scale.setScalar(s.s); o3.updateMatrix(); shardMesh.setMatrixAt(i, o3.matrix);
    }
    shardMesh.instanceMatrix.needsUpdate = true;
    // étincelles
    if (sparks.visible) {
      const pa = sparks.geometry.attributes.position.array; let alive = 0;
      for (let i = 0; i < MAXP; i++) {
        const k = i * 7; if (sparkData[k + 6] <= 0) { pa[i * 3 + 1] = -1e5; continue; }
        alive++; sparkData[k + 4] -= G * dt; for (let j = 0; j < 3; j++) sparkData[k + j] += sparkData[k + 3 + j] * dt; sparkData[k + 6] -= dt;
        pa[i * 3] = sparkData[k]; pa[i * 3 + 1] = sparkData[k + 1]; pa[i * 3 + 2] = sparkData[k + 2];
      }
      sparks.geometry.attributes.position.needsUpdate = true; if (!alive) sparks.visible = false;
    }
    // feu et fumée
    for (let i = B.sprites.length - 1; i >= 0; i--) {
      const p = B.sprites[i];
      if (p.delay > 0) { p.delay -= dt; p.s.visible = false; continue; }
      p.s.visible = true; p.age += dt; const k = p.age / p.life;
      if (k >= 1) { scene.remove(p.s); B.sprites.splice(i, 1); continue; }
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt * (1 - k * 0.6); p.s.position.z += p.vz * dt;
      const sz = p.size * (1 + p.grow * Math.sqrt(k)); p.s.scale.set(sz, sz, 1);
      p.s.material.opacity = p.t === 'smoke' || p.t === 'dust' ? Math.min(k * 6, 1) * (1 - k) * p.fade : (1 - k) * p.fade;
      if (p.t === 'fire') p.s.material.color.setRGB(1, 1 - k * 0.5, 1 - k * 0.9);
    }
    // ondes de choc
    for (let i = B.rings.length - 1; i >= 0; i--) {
      const r = B.rings[i]; r.age += dt; const k = r.age / r.life;
      if (k >= 1) { scene.remove(r.m); B.rings.splice(i, 1); continue; }
      const rr = r.maxR * (1 - Math.pow(1 - k, 3)); r.m.scale.set(rr, 1, rr); r.m.material.opacity = 0.6 * (1 - k);
    }
  };
})();
