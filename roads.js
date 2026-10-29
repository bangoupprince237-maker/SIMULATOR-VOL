// Routes : plusieurs routes relient chaque aéroport à sa ville et aux villes voisines (ponts sur l'eau, voitures, atterrissage possible)
(function () {
  const clamp = SIM.clamp, geo = SIM.geo;
  const RD = SIM.roads = { list: [], built: false };
  // [aéroport, destination (lat, lon) ou ville 3D, largeur, nom]
  const DEF = {
    NSI: [['city:Yaoundé', 16, 'Autoroute Nsimalen – Yaoundé'], [[3.52, 11.50], 9, 'Route de Mbalmayo'], [[3.80, 11.76], 9, 'Route de Nkolafamba']],
    DLA: [[[4.050, 9.700], 16, 'Boulevard de l\'aéroport – Douala'], [[4.075, 9.660], 12, 'Pont du Wouri – Bonabéri'], [[3.940, 9.820], 9, 'Route de Japoma']],
    KBI: [[[2.940, 9.910], 12, 'Route de Kribi'], [[2.800, 10.050], 9, 'Route de Lolodorf']],
    CDG: [['city:Paris', 18, 'Autoroute A1 – Paris'], [[49.060, 2.330], 10, 'Route de Goussainville'], [[48.950, 2.700], 10, 'Route de Meaux']],
    ABJ: [[[5.330, -4.030], 16, 'Boulevard VGE – Abidjan'], [[5.300, -3.800], 9, 'Route de Bassam']],
    JFK: [['city:New York', 18, 'Van Wyck Expressway – Manhattan'], [[40.730, -73.700], 10, 'Long Island'], [[40.600, -73.900], 10, 'Brooklyn Sud']],
    BRU: [[[50.850, 4.350], 18, 'Autoroute A201 – Bruxelles'], [[50.880, 4.650], 10, 'Route de Louvain'], [[50.960, 4.400], 9, 'Route de Malines']],
    FIH: [[[-4.330, 15.310], 16, 'Boulevard Lumumba – Kinshasa'], [[-4.470, 15.520], 9, 'Route de Maluku']],
    DSS: [[[14.690, -17.420], 16, 'Autoroute à péage – Dakar'], [[14.780, -16.950], 9, 'Route de Thiès']],
  };
  function hash(i, j) { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
  const CELL = 400, grid = new Map();
  function makeRoad(a, start0, end, w, name, seed, via) {
    // tracé : passe d'abord par les points de contournement de l'aéroport (jamais à travers les pistes), puis ligne déformée par quelques virages (sans entrer dans la mer)
    via = via || []; const start = via.length ? via[via.length - 1] : start0;
    const dx = end.x - start.x, dz = end.z - start.z, Ln = Math.hypot(dx, dz) || 1, nx = -dz / Ln, nz = dx / Ln, K = Math.max(3, Math.round(Ln / 4000));
    const ctrl = [start0].concat(via);
    for (let i = 1; i < K; i++) {
      const t = i / K; let off = (hash(seed, i) - 0.5) * Ln * 0.12 * Math.sin(Math.PI * t);
      let p = { x: start.x + dx * t + nx * off, z: start.z + dz * t + nz * off };
      if (SIM.isSea(p.x, p.z)) p = { x: start.x + dx * t, z: start.z + dz * t };
      ctrl.push(p);
    }
    ctrl.push(end);
    const pts = [], cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)], seg = Math.hypot(p2.x - p1.x, p2.z - p1.z), n = Math.max(2, Math.ceil(seg / 25));
      for (let k = 0; k < n; k++) { const t = k / n; pts.push({ x: cr(p0.x, p1.x, p2.x, p3.x, t), z: cr(p0.z, p1.z, p2.z, p3.z, t) }); }
    }
    pts.push({ x: end.x, z: end.z });
    // hauteur : posée sur le terrain, en pont au-dessus de l'eau, lissée
    const raw = pts.map(p => { const g = SIM.groundH(p.x, p.z), wl = SIM.waterAt(p.x, p.z); p.water = wl !== null || SIM.isSea(p.x, p.z); return p.water ? Math.max(g, (wl === null ? 0.4 : wl) + 8) : g; });
    pts.forEach((p, i) => { let s = 0, n = 0; for (let k = -3; k <= 3; k++) { const q = raw[clamp(i + k, 0, raw.length - 1)]; s += q; n++; } p.y = Math.max(raw[i], s / n) + 0.35; });
    let acc = 0; pts.forEach((p, i) => { if (i) acc += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z); p.s = acc; });
    const r = { name, w, pts, len: acc, a, minX: Math.min(...pts.map(p => p.x)), maxX: Math.max(...pts.map(p => p.x)), minZ: Math.min(...pts.map(p => p.z)), maxZ: Math.max(...pts.map(p => p.z)) };
    const id = RD.list.length; RD.list.push(r);
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1], x0 = Math.floor((Math.min(p.x, q.x) - w) / CELL), x1 = Math.floor((Math.max(p.x, q.x) + w) / CELL), z0 = Math.floor((Math.min(p.z, q.z) - w) / CELL), z1 = Math.floor((Math.max(p.z, q.z) + w) / CELL);
      for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) { const kk = gx + ',' + gz; if (!grid.has(kk)) grid.set(kk, []); grid.get(kk).push([id, i]); }
    }
  }
  // route la plus proche du point (x, z) si on est dessus (marge m)
  RD.at = function (x, z, m) {
    const list = grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)); if (!list) return null;
    for (const [id, i] of list) {
      const r = RD.list[id], a = r.pts[i], b = r.pts[i + 1], ax = b.x - a.x, az = b.z - a.z, L2 = ax * ax + az * az || 1, t = clamp(((x - a.x) * ax + (z - a.z) * az) / L2, 0, 1);
      const d = Math.hypot(x - a.x - ax * t, z - a.z - az * t);
      if (d < r.w / 2 + (m || 0)) return { r, y: a.y + (b.y - a.y) * t, d, i, t, bridge: a.water || b.water };
    }
    return null;
  };
  RD.near = (x, z, m) => !!RD.at(x, z, m);
  RD.init = function (scene) {
    RD.scene = scene;
    SIM.AIRPORTS.forEach((a, ai) => {
      const C = a.comps && a.comps[0]; if (!C) return;
      const start = C.toW(C.layout.TERM + 130, 0);
      // zone interdite aux routes : pistes, taxiways, tarmac et aérogares des deux complexes (+ marge)
      const twin = a.comps.length > 1, Lo = twin ? -(C.layout.TERM + 400 + 120) : -(a.wid / 2 + 160), Hi = C.layout.TERM + 90, Zh = a.len / 2 + 260;
      (DEF[a.id] || []).forEach((d, k) => {
        let end;
        if (typeof d[0] === 'string') {
          const c = (SIM.CITY3D || []).find(cc => cc.name.startsWith(d[0].slice(5))); if (!c) return;
          const e1 = SIM.cityW(c, 0, c.hz + 40), e2 = SIM.cityW(c, 0, -c.hz - 40);
          end = Math.hypot(e1.x - start.x, e1.z - start.z) < Math.hypot(e2.x - start.x, e2.z - start.z) ? e1 : e2;
        } else end = geo.toXZ(d[0][0], d[0][1]);
        // contournement : si la destination est de l'autre côté des pistes, la route longe l'aérogare puis passe au-delà du bout des pistes
        const e = C.toL(end.x, end.z), via = [];
        if (e.lx < Hi) { const sz = (e.lz >= 0 ? 1 : -1) * (Math.abs(e.lz) < 1 ? 1 : 1), zz = sz * (Zh + 120);
          via.push(C.toW(Hi + 40, sz * Zh * 0.5), C.toW(Hi + 40, zz));
          if (e.lx < Lo + 200) via.push(C.toW((Lo + Hi) / 2, zz + sz * 60), C.toW(Lo - 120, zz)); }
        makeRoad(a, start, end, d[1], d[2], ai * 10 + k + 1, via);
      });
    });
  };
  // ---------- dessin ----------
  function roadTex(main) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#3b3d40'; x.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.06)`; x.fillRect(Math.random() * 128, Math.random() * 256, 2, 2); }
    x.fillStyle = '#e9e9e2'; x.fillRect(4, 0, 4, 256); x.fillRect(120, 0, 4, 256);
    if (main) { x.fillStyle = '#e8c547'; x.fillRect(61, 0, 2.5, 256); x.fillRect(65, 0, 2.5, 256); x.fillStyle = '#e9e9e2'; x.fillRect(33, 0, 3, 120); x.fillRect(92, 0, 3, 120); }
    else { x.fillStyle = '#e9e9e2'; x.fillRect(62, 0, 4, 130); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
  }
  function build(r) {
    const pos = [], uv = [], idx = [], pts = r.pts, hw = r.w / 2;
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      pos.push(p.x - nx * hw, p.y, p.z - nz * hw, p.x + nx * hw, p.y, p.z + nz * hw); uv.push(0, p.s / 24, 1, p.s / 24);
      if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: roadTex(r.w >= 14), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })); m.frustumCulled = false;
    RD.scene.add(m); r.mesh = m;
    // piles des ponts au-dessus de l'eau
    const pil = []; pts.forEach((p, i) => { if (p.water && i % 3 === 0) pil.push(p); });
    if (pil.length) { const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.4, 1.8, 1, 8).translate(0, -0.5, 0), new THREE.MeshLambertMaterial({ color: 0x9a968c }), pil.length), o = new THREE.Object3D();
      pil.forEach((p, i) => { o.position.set(p.x, p.y - 0.4, p.z); o.scale.set(1, Math.max(2, p.y - 0.4), 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); RD.scene.add(im); r.piles = im; }
    // lampadaires la nuit le long des grandes routes
    if (r.w >= 14 && SIM.glowTex) { const lp = []; pts.forEach((p, i) => { if (i % 2 === 0) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; lp.push(p.x - dz / l * (hw + 2), p.y + 9, p.z + dx / l * (hw + 2)); } });
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
      r.lamps = new THREE.Points(lg, new THREE.PointsMaterial({ map: SIM.glowTex('rgba(255,220,160,1)', 'rgba(255,170,80,0)'), size: 6, color: 0xffd28a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); RD.scene.add(r.lamps); }
  }
  // ---------- voitures sur les routes ----------
  const CARS = [], COLS = [0xe8e8e8, 0x1a1a1a, 0xb3261e, 0x1e4fa8, 0x8a8f94, 0xf0c419, 0x2f6b3a, 0xd9d2c0, 0xffffff];
  function posAt(r, s) {
    s = clamp(s, 0, r.len); let lo = 0, hi = r.pts.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (r.pts[m].s < s) lo = m; else hi = m; }
    const a = r.pts[lo], b = r.pts[hi], t = (s - a.s) / Math.max(1e-6, b.s - a.s);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, h: Math.atan2(b.x - a.x, -(b.z - a.z)) };
  }
  function nearestS(r, x, z) { let bs = 0, bd = 1e18; for (let i = 0; i < r.pts.length; i += 4) { const p = r.pts[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; bs = p.s; } } return { s: bs, d: Math.sqrt(bd) }; }
  function spawn(car, r, sc) { car.r = r; car.dir = Math.random() < 0.5 ? 1 : -1; car.s = clamp(sc + (Math.random() - 0.5) * 3600, 0, r.len); car.sp = (r.w >= 14 ? 22 : 14) + Math.random() * 8; car.lane = (r.w >= 14 ? (Math.random() < 0.5 ? 2.2 : 5.6) : 2.3); car.dead = 0; }
  RD.update = function (cam) {
    if (!RD.scene || !RD.list.length) return;
    const cx = cam.position.x, cz = cam.position.z, n = SIM.world ? SIM.world.night || 0 : 0;
    RD.list.forEach(r => {
      const near = cx > r.minX - 60000 && cx < r.maxX + 60000 && cz > r.minZ - 60000 && cz < r.maxZ + 60000;
      if (near && !r.mesh) build(r);
      if (r.mesh) r.mesh.visible = near;
      if (r.lamps) r.lamps.material.opacity = clamp((n - 0.3) * 1.8, 0, 1);
    });
    // la route la plus proche de la caméra reçoit la circulation
    const T = (RD.t = RD.t || performance.now()), now = performance.now(), dt = Math.min(0.1, (now - T) / 1000) * (SIM.timeScale || 1); RD.t = now;
    RD.scanT = (RD.scanT || 0) - dt;
    if (RD.scanT <= 0) { RD.scanT = 1.5; let best = null; RD.list.forEach(r => { if (!r.mesh || !r.mesh.visible) return; const q = nearestS(r, cx, cz); if (!best || q.d < best.d) best = { r, s: q.s, d: q.d }; }); RD.focus = best; }
    const F = RD.focus, agl = cam.position.y - SIM.groundH(cx, cz), on = F && F.d < 7000 && agl < 3000;
    if (!on) { CARS.forEach(c => c.m.visible = false); return; }
    if (!CARS.length && SIM.city && SIM.city.carModel) for (let i = 0; i < 28; i++) { const m = SIM.city.carModel(COLS[i % COLS.length]); RD.scene.add(m); const c = { m }; spawn(c, F.r, F.s); CARS.push(c); }
    const P = SIM.P;
    CARS.forEach(c => {
      if (c.r !== F.r) spawn(c, F.r, F.s);
      if (c.dead > 0) { c.dead -= dt; c.m.visible = false; if (c.dead <= 0) spawn(c, F.r, F.s); return; }
      c.s += c.dir * c.sp * dt;
      if (c.s < 0 || c.s > c.r.len || Math.abs(c.s - F.s) > 2600) spawn(c, F.r, F.s);
      const p = posAt(c.r, c.s), h = p.h + (c.dir > 0 ? 0 : Math.PI), ox = Math.cos(p.h) * c.lane * c.dir, oz = Math.sin(p.h) * c.lane * c.dir;
      c.m.visible = true; c.m.position.set(p.x + ox, p.y, p.z + oz); c.m.rotation.y = -h + Math.PI;
      if (!P.crashed && Math.abs(c.m.position.x - P.x) < 25 && Math.abs(c.m.position.z - P.z) < 25 && P.y - p.y < 6) {
        const half = SIM.tyx ? SIM.tyx().half : 17, fx = Math.sin(P.psi), fz = -Math.cos(P.psi), dx = c.m.position.x - P.x, dz = c.m.position.z - P.z, along = dx * fx + dz * fz, side = Math.abs(-dx * fz + dz * fx);
        if (Math.abs(along) < 20 && (side < 3 || (side < half && Math.abs(along) < 4))) { c.dead = 25; SIM.boom.small(c.m.position.x, p.y + 1, c.m.position.z, 0.5, true); if (SIM.damageEngine) SIM.damageEngine(null, 0.08, null); SIM.onEvent && SIM.onEvent('toast', 'Vous avez percuté une voiture sur la route !'); }
      }
    });
  };
  // surface : sur une route = goudron (on peut s'y poser et rouler)
  const baseSurface = SIM.surface;
  SIM.surface = function (x, z) {
    const s = baseSurface(x, z);
    if (s.type === 'herbe' || s.type === 'foret') { const r = RD.at(x, z, 0); if (r) return { type: 'route', ap: s.ap || null, road: r.r.name, bridge: r.bridge }; }
    return s;
  };
})();
