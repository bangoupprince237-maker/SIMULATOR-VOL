// Aéroports : pistes, marquages, balisage lumineux, PAPI, taxiways, aérogare, tour de contrôle, avions garés
(function () {
  const D2R = SIM.D2R;
  const M = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  function noiseTex(base, var_, rx, ry) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) { const v = (Math.random() - 0.5) * var_; x.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v)})`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(0,0,0,0.08)'; x.fillRect(Math.random() * 256, 0, 3 + Math.random() * 8, 256); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t;
  }
  function textTex(txt, w, h, font, color, bg) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
    x.fillStyle = color; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 + 4);
    return new THREE.CanvasTexture(c);
  }
  function flat(w, l, mat, x, y, z) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); return m; }
  function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
  function instStripes(list, w, l, mat, y) {
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2), mat, list.length), o = new THREE.Object3D();
    list.forEach((p, i) => { o.position.set(p[0], y, p[1]); o.rotation.y = p[2] || 0; o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    return im;
  }
  function lightPts(list, color, size) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(list.flat(), 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color, size, sizeAttenuation: false, map: SIM.glowTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    p.frustumCulled = false; return p;
  }

  const mats = {};
  function initMats() {
    mats.asph = M(0x5a5d61, { map: noiseTex('#6a6d70', 0.25, 2, 40) });
    mats.taxi = M(0x63666a, { map: noiseTex('#707275', 0.22, 2, 30) });
    mats.conc = M(0xa3a49f, { map: noiseTex('#b3b3ad', 0.15, 20, 20) });
    mats.white = M(0xf0f0ec); mats.yellow = M(0xf2c018); mats.shoulder = M(0x8b8c88);
    mats.glass = new THREE.MeshPhongMaterial({ color: 0x5d8fb0, specular: 0xffffff, shininess: 90, transparent: true, opacity: 0.42, side: THREE.DoubleSide });
    mats.towerGlass = new THREE.MeshPhongMaterial({ color: 0x24465e, specular: 0xffffff, shininess: 100, transparent: true, opacity: 0.7 });
    mats.roof = M(0xd8dadc); mats.wall = M(0xc9c3b8); mats.dark = M(0x2a2f36); mats.seat = M(0x1f4e8c);
    mats.ceiling = new THREE.MeshBasicMaterial({ color: 0x8a8a84 });
    mats.hangar = M(0x9aa4ad, { side: THREE.DoubleSide });
  }

  function buildComplex(a, C, g) {
    const L = a.len, Wd = a.wid, big = a.id !== 'KBI', TX = Wd / 2 + 150, AX0 = TX + 40, AX1 = AX0 + 190, TERM = AX1 + 15;
    const APL = big ? 450 : 220;
    C.layout = { TX, AX0, AX1, TERM, APL };
    // piste et accotements
    const rw = flat(Wd, L, mats.asph, 0, 0.15, 0); mats.asph.map.repeat.set(1, L / 60); g.add(rw);
    g.add(flat(Wd + 16, L + 60, mats.shoulder, 0, 0.1, 0));
    // marquages
    const dashes = []; for (let z = -L / 2 + 120; z < L / 2 - 120; z += 50) dashes.push([0, z]);
    g.add(instStripes(dashes, 0.9, 30, mats.white, 0.24));
    const keys = [], nk = Wd > 40 ? 8 : 6;
    for (const s of [1, -1]) for (let i = 0; i < nk; i++) { const x = (i - (nk - 1) / 2) * (Wd / (nk + 1)) * 1.05; keys.push([x + (x > 0 ? 1.6 : -1.6), s * (L / 2 - 26)]); }
    g.add(instStripes(keys, 1.8, 30, mats.white, 0.24));
    const tdz = [];
    for (const s of [1, -1]) {
      tdz.push([-Wd * 0.28, s * (L / 2 - 400)], [Wd * 0.28, s * (L / 2 - 400)]);
      for (const d of [150, 300, 500, 600]) if (d < L / 3) for (const x of [-Wd * 0.3, -Wd * 0.22, Wd * 0.22, Wd * 0.3]) tdz.push([x, s * (L / 2 - d - 30)]);
    }
    g.add(instStripes(tdz.slice(0, 4), 9, 45, mats.white, 0.24));
    g.add(instStripes(tdz.slice(4), 1.8, 22, mats.white, 0.24));
    g.add(instStripes([[-Wd / 2 + 0.6, 0], [Wd / 2 - 0.6, 0]], 0.9, L - 10, mats.white, 0.23));
    C.ids.forEach((id, k) => {
      const t = textTex(id, 128, 256, 'bold 200px "Saira Condensed",Arial Narrow,sans-serif', '#f4f4ef');
      const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 20).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: t, transparent: true }));
      m.position.set(0, 0.25, (k ? -1 : 1) * (L / 2 - 75)); if (k) m.rotation.y = Math.PI; g.add(m);
    });
    // taxiways
    g.add(flat(23, L * 0.94, mats.taxi, TX, 0.12, 0));
    g.add(flat(0.4, L * 0.94, mats.yellow, TX, 0.2, 0));
    const conns = [-(L / 2 - 70), L / 2 - 70, 0, -L / 4, L / 4];
    conns.forEach(z => { g.add(flat(TX, 23, mats.taxi, TX / 2, 0.13, z)); g.add(flat(TX - Wd / 2, 0.4, mats.yellow, (TX + Wd / 2) / 2, 0.21, z)); });
    [-APL * 0.5, APL * 0.5].forEach(z => g.add(flat(AX0 - TX, 23, mats.taxi, (TX + AX0) / 2, 0.13, z)));
    // tarmac et postes de stationnement
    g.add(flat(AX1 - AX0 + 20, APL * 2, mats.conc, (AX0 + AX1) / 2 + 5, 0.11, 0));
    C.stands = [];
    const nst = big ? 7 : 3, sp = big ? 95 : 110;
    for (let i = 0; i < nst; i++) {
      const lz = (i - (nst - 1) / 2) * sp, lx = AX1 - 25;
      g.add(flat(AX1 - AX0, 0.35, mats.yellow, (AX0 + AX1) / 2 - 10, 0.19, lz));
      g.add(flat(0.35, 8, mats.yellow, lx, 0.19, lz));
      const w = C.toW(lx, lz);
      C.stands.push({ lx, lz, x: w.x, z: w.z, hdg: (C.hdg + 90) % 360, n: i + 1, busy: false });
    }
    // aérogare (salle d'attente vitrée)
    const TL = big ? 660 : 260, TD = 48, TH = 16;
    g.add(box(TD, 1, TL, mats.conc, TERM + TD / 2, 0.5, 0));
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(TL, TH), mats.glass); gl.rotation.y = -Math.PI / 2; gl.position.set(TERM, TH / 2 + 1, 0); g.add(gl);
    const mull = []; for (let z = -TL / 2; z <= TL / 2; z += 6) mull.push([TERM, z]);
    const mi = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, TH, 0.35), mats.dark, mull.length), o = new THREE.Object3D();
    mull.forEach((p, i) => { o.position.set(p[0], TH / 2 + 1, p[1]); o.updateMatrix(); mi.setMatrixAt(i, o.matrix); }); g.add(mi);
    g.add(box(TD + 10, 1.4, TL + 12, mats.roof, TERM + TD / 2 - 3, TH + 1.7, 0));
    g.add(box(1, TH, TL, mats.wall, TERM + TD, TH / 2 + 1, 0));
    g.add(box(TD, TH, 1, mats.wall, TERM + TD / 2, TH / 2 + 1, TL / 2)); g.add(box(TD, TH, 1, mats.wall, TERM + TD / 2, TH / 2 + 1, -TL / 2));
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(TD, TL), mats.ceiling); ceil.rotation.x = Math.PI / 2; ceil.position.set(TERM + TD / 2, TH + 0.9, 0); g.add(ceil);
    const seats = []; for (let z = -TL / 2 + 12; z < TL / 2 - 12; z += 9) for (let x = TERM + 6; x < TERM + 28; x += 3.2) seats.push([x, z]);
    const si = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 1, 6), mats.seat, seats.length);
    seats.forEach((p, i) => { o.position.set(p[0], 1.5, p[1]); o.updateMatrix(); si.setMatrixAt(i, o.matrix); }); g.add(si);
    const signT = textTex((C.second ? 'TERMINAL 2 · ' : 'AÉROPORT DE ') + a.city.toUpperCase(), 1024, 96, 'bold 64px "Saira Condensed",Arial Narrow,sans-serif', '#ffffff', '#123a5a');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(big ? 120 : 70, (big ? 120 : 70) * 96 / 1024), new THREE.MeshBasicMaterial({ map: signT }));
    sign.rotation.y = -Math.PI / 2; sign.position.set(TERM - 3.2, TH + 4.6, 0); g.add(sign);
    // passerelles
    C.stands.forEach(s => {
      if (!big && s.n === 2) return;
      const dz = s.lz - 2.6 - 3, dx = s.lx + 14.5;
      const len = Math.hypot(TERM - 4 - dx, 8);
      const jb = box(len, 3, 3.2, mats.wall, (TERM - 4 + dx) / 2, 5, dz - 4); jb.rotation.y = Math.atan2(8, TERM - 4 - dx); g.add(jb);
      g.add(box(1, 5, 1, mats.dark, dx + 3, 2.5, dz));
    });
    // tour de contrôle
    const T = new THREE.Group(); const tx = AX0 + 40, tz = -(APL + 140); T.position.set(tx, 0, tz);
    T.add(box(14, 6, 14, mats.wall, 0, 3, 0));
    if (C.second) T.scale.set(1.15, 1.3, 1.15);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.4, 42, 18), C.second ? mats.roof : mats.wall); shaft.position.y = 21; T.add(shaft);
    const cabB = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 5, 2, 8), mats.dark); cabB.position.y = 43; T.add(cabB);
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 6.5, 5, 8, 1, true), mats.towerGlass); cab.position.y = 46.5; T.add(cab);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 7.6, 1.2, 8), mats.roof); roof.position.y = 49.6; T.add(roof);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8), mats.dark); ant.position.y = 54; T.add(ant);
    const radar = new THREE.Group(); radar.position.set(0, 51, 0);
    const dish = box(6, 1.4, 0.4, mats.white, 0, 0.9, 0); radar.add(dish); T.add(radar); C.radar = radar;
    const bea = lightPts([[0, 58, 0]], 0x40ff60, 9); T.add(bea); C.beacon = bea;
    g.add(T); C.towerLocal = new THREE.Vector3(tx, C.second ? 61 : 47, tz);
    // hangars
    for (let i = 0; i < (big ? 2 : 1); i++) {
      const hz = APL + 90 + i * 95, hx = AX0 + 60;
      const h = new THREE.Mesh(new THREE.CylinderGeometry(36, 36, 70, 24, 1, true, 0, Math.PI), mats.hangar);
      h.rotation.z = Math.PI / 2; h.rotation.y = Math.PI / 2; h.position.set(hx, 0, hz); h.scale.set(1, 1, 0.55); g.add(h);
      g.add(flat(90, 80, mats.conc, hx, 0.11, hz));
    }
    // véhicules
    const vcol = [0xf2c018, 0xffffff, 0xe0441c, 0x2e6fd8];
    C.stands.forEach((s, i) => { g.add(box(3, 2.8, 9, M(vcol[i % 4]), s.lx - 8, 1.5, s.lz + 22)); g.add(box(2.4, 2, 4, M(0xdedede), s.lx + 5, 1.1, s.lz - 20)); });
    // manche à air
    const ws = new THREE.Group(); ws.position.set(-Wd / 2 - 60, 0, L / 2 - 250);
    ws.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6), mats.white).translateY(3));
    const sock = new THREE.Mesh(new THREE.ConeGeometry(0.6, 4, 12, 1, true), M(0xff6a1a, { side: THREE.DoubleSide })); sock.rotation.z = Math.PI / 2.3; sock.position.set(2, 5.6, 0); ws.add(sock); g.add(ws);
    // balisage lumineux
    const edge = [], cl = [], thr = [], end = [], appr = [], txl = [];
    for (let z = -L / 2; z <= L / 2; z += 60) { edge.push([-Wd / 2 - 1, 0.6, z], [Wd / 2 + 1, 0.6, z]); }
    for (let z = -L / 2 + 15; z < L / 2; z += 30) cl.push([0, 0.35, z]);
    for (let x = -Wd / 2; x <= Wd / 2; x += 3) { thr.push([x, 0.5, L / 2 - 1], [x, 0.5, -L / 2 + 1]); end.push([x, 0.5, L / 2 + 3], [x, 0.5, -L / 2 - 3]); }
    for (const s of [1, -1]) {
      for (let d = 60; d <= 900; d += 30) for (let k = -2; k <= 2; k++) appr.push([k * 1.1, 1.2 + d * 0.001, s * (L / 2 + d)]);
      for (let k = -15; k <= 15; k++) appr.push([k * 1.3, 1.5, s * (L / 2 + 300)]);
    }
    for (let z = -L * 0.47; z <= L * 0.47; z += 50) txl.push([TX - 12.5, 0.5, z], [TX + 12.5, 0.5, z]);
    C.nightLights = [lightPts(edge, 0xfff3d6, 5), lightPts(cl, 0xffffff, 3.5), lightPts(thr, 0x30ff70, 6), lightPts(end, 0xff3030, 6), lightPts(appr, 0xfff6dd, 5), lightPts(txl, 0x3c6bff, 4)];
    C.nightLights.forEach(p => g.add(p));
    // feux à éclats séquentiels ("lapin")
    const rab = []; for (const s of [1, -1]) for (let d = 900; d >= 330; d -= 30) rab.push([0, 2.5, s * (L / 2 + d)]);
    C.rabbit = lightPts(rab, 0xffffff, 12); C.rabbit.geometry.setDrawRange(0, 1); g.add(C.rabbit); C.rabbitN = rab.length / 2;
    // PAPI (4 boîtiers par sens d'atterrissage)
    C.papi = [];
    [[1, -1], [-1, 1]].forEach(([zs, xs], k) => {
      const pts = [], cols = [];
      for (let i = 0; i < 4; i++) { const x = xs * (Wd / 2 + 15 + i * 9), z = zs * (L / 2 - 300); g.add(box(2.4, 1, 1.2, mats.dark, x, 0.6, z)); pts.push(x, 1.4, z); cols.push(1, 1, 1); }
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); pg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      const pp = new THREE.Points(pg, new THREE.PointsMaterial({ size: 9, sizeAttenuation: false, vertexColors: true, map: SIM.glowTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      pp.frustumCulled = false; g.add(pp);
      const w = C.toW(xs * (Wd / 2 + 28), zs * (L / 2 - 300));
      C.papi.push({ pts: pp, x: w.x, z: w.z, end: k });
    });
    // avions garés (livrées fictives)
    const liv = ['mungo', 'atlas', 'kivu', 'lagune', 'sablon', 'prive', 'sahel', 'armee', 'kribi', 'seine', 'essai'], typ = ['A320', 'jumbo', 'A321', 'super', 'A319', 'jet', 'gros', 'militaire', 'A320'];
    C.stands.forEach((s, i) => {
      if (i === 3 || i === 5) return;   // postes laissés libres pour vous et le trafic
      if (i === 0 && !big) return;
      const ty = typ[(i + (C.second ? 2 : 0) + a.id.length) % typ.length], lv = ty === 'jet' ? 'prive' : ty === 'militaire' ? 'armee' : liv[(i + a.id.length + (C.second ? 3 : 0)) % liv.length];
      const p = SIM.buildAircraft(lv, true, ty); s.planeScale = p.body.scale.z;
      p.root.position.set(s.lx, 0.15, s.lz); p.root.rotation.y = -Math.PI / 2; g.add(p.root); s.busy = true; (a.statics = a.statics || []).push({ o: p.root, x: s.x, z: s.z });
    });
    C.group = g; a.comps.push(C);
  }

  function buildAirport(a, scene) {
    const g = new THREE.Group(); g.position.set(a.x, a.elev, a.z); g.rotation.y = -a.hdg * D2R; scene.add(g);
    const big = a.id !== 'KBI' && a.twin !== false, S2 = 400, base = a.ids.slice();
    a.comps = [];
    const C1 = { ids: big ? [base[0] + 'R', base[1] + 'L'] : base, hdg: a.hdg, toW: (lx, lz) => SIM.apToWorld(a, lx, lz), toL: (x, z) => SIM.apToLocal(a, x, z) };
    const g1 = new THREE.Group(); g.add(g1); buildComplex(a, C1, g1);
    if (big) {
      const C2 = { second: true, ids: [base[1] + 'R', base[0] + 'L'], hdg: (a.hdg + 180) % 360, toW: (lx, lz) => SIM.apToWorld(a, -lx - S2, -lz), toL: (x, z) => { const l = SIM.apToLocal(a, x, z); return { lx: -l.lx - S2, lz: -l.lz }; } };
      const g2 = new THREE.Group(); g2.position.x = -S2; g2.rotation.y = Math.PI; g.add(g2); buildComplex(a, C2, g2);
      // taxiway de liaison entre les deux pistes
      g.add(flat(S2 - a.wid - 40, 23, mats.taxi, -S2 / 2, 0.12, 0));
    }
    g.updateMatrixWorld(true);
    a.comps.forEach(C => {
      C.a = a; C.towerWorld = C.towerLocal.clone().applyMatrix4(C.group.matrixWorld);
      const e0 = C.toW(0, a.len / 2), e1 = C.toW(0, -a.len / 2);
      C.ends = [{ id: C.ids[0], hdg: C.hdg, x: e0.x, z: e0.z }, { id: C.ids[1], hdg: (C.hdg + 180) % 360, x: e1.x, z: e1.z }];
    });
    a.ids = C1.ids; a.layout = C1.layout; a.stands = C1.stands; a.towerWorld = C1.towerWorld; a.group = g;
  }

  SIM.apToLocal = (a, x, z) => { const dx = x - a.x, dz = z - a.z; return { lx: dx * a.rx + dz * a.rz, lz: -(dx * a.dx + dz * a.dz) }; };
  SIM.apToWorld = (a, lx, lz) => ({ x: a.x + a.rx * lx - a.dx * lz, z: a.z + a.rz * lx - a.dz * lz });
  SIM.airportEnds = (a) => [
    { id: a.ids[0], hdg: a.hdg, x: a.x - a.dx * a.len / 2, z: a.z - a.dz * a.len / 2 },
    { id: a.ids[1], hdg: (a.hdg + 180) % 360, x: a.x + a.dx * a.len / 2, z: a.z + a.dz * a.len / 2 },
  ];
  // Surface sous l'avion : piste, taxiway, tarmac ou herbe
  SIM.surface = function (x, z) {
    for (const a of SIM.AIRPORTS) {
      if (Math.abs(x - a.x) > 6000 || Math.abs(z - a.z) > 6000) continue;
      let best = null;
      for (const C of a.comps) {
        const { lx, lz } = C.toL(x, z), L = C.layout, r = t => ({ type: t, ap: a, comp: C, lx, lz });
        if (Math.abs(lx) < a.wid / 2 + 8 && Math.abs(lz) < a.len / 2 + 30) return r('piste');
        if (Math.abs(lx - L.TX) < 15 && Math.abs(lz) < a.len * 0.47) return r('taxiway');
        if (lx > a.wid / 2 && lx < L.TX && [-(a.len / 2 - 70), a.len / 2 - 70, 0, -a.len / 4, a.len / 4].some(c => Math.abs(lz - c) < 15)) return r('taxiway');
        if (lx > L.TX && lx < L.AX0 && Math.abs(Math.abs(lz) - L.APL * 0.5) < 15) return r('taxiway');
        if (lx > L.AX0 - 5 && lx < L.AX1 + 12 && Math.abs(lz) < L.APL) return r('tarmac');
        if (C.second && lx < -a.wid / 2 && lx > -400 + a.wid / 2 && Math.abs(lz) < 15) return r('taxiway');
        if (!best) best = r('herbe');
      }
      return best;
    }
    return { type: SIM.isSea(x, z) ? 'mer' : 'herbe', ap: null };
  };
  SIM.isPaved = (x, z) => { const s = SIM.surface(x, z); return s.type !== 'herbe' && s.type !== 'mer'; };
  SIM.allTowers = () => SIM.AIRPORTS.flatMap(a => a.comps.map(C => C.towerWorld));

  SIM.initAirports = function (scene) { initMats(); SIM.AIRPORTS.forEach(a => buildAirport(a, scene)); };

  SIM.updateAirports = function (t, night, eye) {
    mats.ceiling.color.setHex(night > 0.4 ? 0xffe2a8 : 0x8a8a84);
    SIM.AIRPORTS.forEach(a => {
      const d = Math.hypot(eye.x - a.x, eye.z - a.z), vis = d < 90000;
      a.group.visible = vis; if (!vis) return;
      (a.statics || []).forEach(st => st.o.visible = Math.abs(st.x - eye.x) < 6000 && Math.abs(st.z - eye.z) < 6000);
      a.comps.forEach(C => {
        C.radar.rotation.y = t * 1.6 + (C.second ? 1 : 0);
        C.beacon.visible = (t * 0.8 % 1) < 0.5;
        const on = night > 0.25;
        C.nightLights.forEach(p => p.visible = on);
        C.rabbit.visible = on;
        if (on) { const k = Math.floor(t * 2 * C.rabbitN) % C.rabbitN; C.rabbit.geometry.setDrawRange(k, 1); }
        C.papi.forEach(p => {
          const hd = Math.hypot(eye.x - p.x, eye.z - p.z), ang = Math.atan2(eye.y - a.elev - 1, hd) / D2R;
          const c = p.pts.geometry.attributes.color, th = [3.5, 3.17, 2.83, 2.5];
          for (let i = 0; i < 4; i++) { const w = ang > th[i]; c.setXYZ(i, 1, w ? 1 : 0.1, w ? 1 : 0.08); }
          c.needsUpdate = true;
        });
      });
    });
  };
})();
