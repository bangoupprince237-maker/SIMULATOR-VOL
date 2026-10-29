// Villes 3D : immeubles, tours, rues et grand boulevard (on peut s'y poser) — Yaoundé, Paris, New York — collisions avec les immeubles
(function () {
  const clamp = SIM.clamp;
  const C = SIM.city = { built: false };
  const BLK = 140, ST = 22, AV = 80, LOT = (BLK - ST) / 2;
  function hash(i, j, k) { let h = Math.imul(i + 1000, 73856093) ^ Math.imul(j + 1000, 19349663) ^ Math.imul(k, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
  const cities = () => SIM.CITY3D || [];
  const L = (c, x, z) => SIM.cityL(c, x, z), Wp = (c, lx, lz) => SIM.cityW(c, lx, lz);
  // zones sans immeubles (parcs autour des monuments), en coordonnées locales
  C.clearZones = [];
  const cleared = (c, lx, lz) => (c.clearL || []).some(q => Math.hypot(lx - q.x, lz - q.z) < q.r);

  // immeuble d'un lot (coordonnées locales) : toujours le même (déterministe)
  function lotBuilding(c, side, k, j, a, b) {
    const ci = c.idx || 0, r = hash(side * 100 + k + ci * 7, j, a * 2 + b + 7);
    if (r < 0.07) return null;                                        // petite place / parking
    const x0 = side * (AV / 2 + ST + k * BLK) + (side > 0 ? 0 : -(BLK - ST)), z0 = -c.hz + j * BLK + ST / 2;
    const lx = x0 + a * LOT, lz = z0 + b * LOT;
    const fw = LOT * (0.62 + 0.3 * hash(k, j, a + 31 + ci)), fd = LOT * (0.62 + 0.3 * hash(j, k, b + 53 + ci));
    const bx = lx + (LOT - fw) / 2, bz = lz + (LOT - fd) / 2;
    if (cleared(c, bx + fw / 2, bz + fd / 2)) return null;
    { const wc = Wp(c, bx + fw / 2, bz + fd / 2); if (SIM.waterAt && SIM.waterAt(wc.x, wc.z) !== null) return null; }   // pas d'immeuble dans la rivière
    const cx = (bx + fw / 2) / c.hx, cz = (bz + fd / 2) / c.hz, f = clamp(1 - Math.hypot(cx * 0.9, cz * 0.75), 0, 1);
    const tall = hash(k, j, a + b * 3 + 91 + ci);
    let h, style;
    if (c.style === 'paris') {           // immeubles haussmanniens : 6–8 étages, tous presque à la même hauteur, toits de zinc
      h = 18 + hash(j, k, a * 7 + b) * 9; style = r < 0.85 ? 3 : 1;
    } else if (c.style === 'ny') {       // Manhattan : gratte-ciel partout, très hauts au centre
      h = 30 + hash(j, k, a * 7 + b) * 50 + f * (tall > 0.35 ? 60 + tall * 260 : 40); style = tall > 0.6 ? 0 : r < 0.55 ? 4 : 2;
      if (Math.abs(cz) > 0.95) h = Math.min(h, 60);
    } else {
      h = 9 + hash(j, k, a * 7 + b) * 22 + f * f * (tall > 0.55 ? 40 + tall * 150 : 20);
      if (Math.abs(cz) > 0.92 || Math.abs(cx) > 0.9) h = Math.min(h, 14 + tall * 8);
      style = tall > 0.55 && h > 60 ? 0 : r < 0.5 ? 1 : 2;
    }
    return { x0: bx, x1: bx + fw, z0: bz, z1: bz + fd, h: Math.round(h / 3) * 3, y0: c.base, style, local: true };
  }
  function lotAtL(c, lx, lz) {
    if (Math.abs(lx) > c.hx || Math.abs(lz) > c.hz) return null;
    const side = lx >= 0 ? 1 : -1, ax = Math.abs(lx) - AV / 2 - ST; if (ax < 0) return null;
    const k = Math.floor(ax / BLK), inX = ax - k * BLK; if (inX > BLK - ST) return null;
    const lz2 = lz + c.hz - ST / 2; if (lz2 < 0) return null;
    const j = Math.floor(lz2 / BLK), inZ = lz2 - j * BLK; if (inZ > BLK - ST) return null;
    const aRaw = side > 0 ? inX : (BLK - ST) - inX, a = Math.min(1, Math.floor(aRaw / LOT)), b = Math.min(1, Math.floor(inZ / LOT));
    const bd = lotBuilding(c, side, k, j, a, b);
    return bd && lx >= bd.x0 && lx <= bd.x1 && lz >= bd.z0 && lz <= bd.z1 ? bd : null;
  }
  function cityAt(x, z, m) {
    for (const c of cities()) {
      if (Math.abs(x - c.x) > c.hx + c.hz + (m || 0) || Math.abs(z - c.z) > c.hx + c.hz + (m || 0)) continue;
      const p = L(c, x, z); if (Math.abs(p.x) < c.hx + (m || 0) && Math.abs(p.z) < c.hz + (m || 0)) return [c, p];
    }
    return null;
  }
  function buildingAt(x, z) { const r = cityAt(x, z); return r ? lotAtL(r[0], r[1].x, r[1].z) : null; }
  C.buildingAt = buildingAt;
  C.inside = (x, z, m) => !!cityAt(x, z, m);
  // monuments (tour Eiffel, statue de la Liberté…) : profil rayon / hauteur pour les collisions
  C.marks = [];
  function markHit(x, y, z, half) {
    for (const m of C.marks) {
      const d = Math.hypot(x - m.x, z - m.z); if (d > m.R + half) continue;
      const h = y - m.base; if (h < 0 || h > m.H) continue;
      let r = m.prof[0][1]; for (let i = 0; i < m.prof.length - 1; i++) { const [h0, r0] = m.prof[i], [h1, r1] = m.prof[i + 1]; if (h >= h0 && h <= h1) { r = r0 + (r1 - r0) * (h - h0) / (h1 - h0); break; } }
      if (d < r + half * 0.6) return { h: m.H, name: m.name };
    }
    return null;
  }
  // l'avion touche-t-il un immeuble ou un monument ? (centre et bouts d'ailes)
  C.hit = function (x, y, z, psi, half) {
    const mk = C.marks.length ? markHit(x, y, z, half) : null; if (mk) return mk;
    if (!C.inside(x, z, 60)) return null;
    const rx = Math.cos(psi), rz = Math.sin(psi);
    for (const s of [0, 1, -1, 0.5, -0.5]) { const b = buildingAt(x + rx * half * s, z + rz * half * s); if (b && y < b.y0 + b.h) return b; }
    return null;
  };
  // surface au sol dans la ville
  C.surface = function (x, z) {
    const r = cityAt(x, z); if (!r) return null;
    const [c, p] = r;
    if (Math.abs(p.x) < AV / 2) return { type: 'avenue', ap: null, city: c };
    return { type: lotAtL(c, p.x, p.z) ? 'immeuble' : 'route', ap: null, city: c };
  };
  C.avenues = () => cities().map(c => ({ name: c.av, city: c.name, a: Wp(c, 0, c.hz), b: Wp(c, 0, -c.hz), w: AV, base: c.base, len: c.len + (c.style === 'paris' ? 0 : 2 * c.ext) }));

  // ---------- Construction des maillages ----------
  // styles : 0 tour de verre, 1 béton clair, 2 bureaux gris, 3 haussmannien (pierre de taille, balcons), 4 brique new-yorkaise
  function facadeTex(style) {
    const cv = document.createElement('canvas'), em = document.createElement('canvas'); cv.width = em.width = 128; cv.height = em.height = 256;
    const x = cv.getContext('2d'), e = em.getContext('2d');
    const wall = ['#5d7f93', '#d8cfbd', '#a9adb2', '#e2d6bd', '#8a4b3a'][style], win = ['#1d3442', '#2b3a46', '#26323c', '#3a4048', '#22262c'][style];
    x.fillStyle = wall; x.fillRect(0, 0, 128, 256); e.fillStyle = '#000'; e.fillRect(0, 0, 128, 256);
    for (let fl = 0; fl < 8; fl++) for (let w = 0; w < 4; w++) {
      const tall = style === 3, X = w * 32 + (style === 0 ? 2 : tall ? 9 : 6), Y = fl * 32 + (style === 0 ? 3 : tall ? 5 : 8), W = style === 0 ? 28 : tall ? 14 : 20, H = style === 0 ? 26 : tall ? 22 : 16;
      x.fillStyle = win; x.fillRect(X, Y, W, H);
      x.fillStyle = 'rgba(255,255,255,0.10)'; x.fillRect(X, Y, W, H * 0.35);
      if (tall) { x.fillStyle = '#2c2f33'; x.fillRect(X - 3, Y + H, W + 6, 3); if (fl % 3 === 1) x.fillRect(0, Y + H + 1, 128, 2); }   // balcons en fer forgé
      if (Math.random() < 0.38) { e.fillStyle = Math.random() < 0.7 ? '#ffd9a0' : '#cfe4ff'; e.fillRect(X, Y, W, H); }
    }
    if (style !== 0) { x.fillStyle = 'rgba(0,0,0,0.12)'; for (let fl = 0; fl < 8; fl++) x.fillRect(0, fl * 32 + 28, 128, 3); }
    const t = new THREE.CanvasTexture(cv), te = new THREE.CanvasTexture(em);
    [t, te].forEach(q => { q.wrapS = q.wrapT = THREE.RepeatWrapping; q.anisotropy = 4; });
    return [t, te];
  }
  let MATS = null, SHOP = null;
  // devantures : vitrines éclairées, enseignes colorées, portes
  function shopMat() {
    if (SHOP) return SHOP;
    const c = document.createElement('canvas'), e = document.createElement('canvas'); c.width = e.width = 256; c.height = e.height = 64; const x = c.getContext('2d'), y = e.getContext('2d');
    const signs = ['#b3261e', '#1e5fb3', '#1f8a4c', '#d68b18', '#6a2d91', '#222222', '#c2185b'], names = ['CAFÉ', 'PHARMACIE', 'BOULANGERIE', 'MARKET', 'BANK', 'SHOP', 'DELI', 'RESTO', 'MODE', 'HÔTEL'];
    y.fillStyle = '#000'; y.fillRect(0, 0, 256, 64);
    for (let k = 0; k < 4; k++) {
      const X = k * 64, col = signs[(k * 3 + 1) % signs.length];
      x.fillStyle = '#4a4440'; x.fillRect(X, 0, 64, 64);
      x.fillStyle = col; x.fillRect(X + 2, 2, 60, 14); x.fillStyle = '#fff'; x.font = 'bold 10px sans-serif'; x.textAlign = 'center'; x.fillText(names[(k * 7 + 3) % names.length], X + 32, 13);
      const gr = x.createLinearGradient(0, 18, 0, 62); gr.addColorStop(0, '#9fb6c4'); gr.addColorStop(1, '#3b4a55'); x.fillStyle = gr; x.fillRect(X + 4, 19, 38, 43); x.fillStyle = '#2a2420'; x.fillRect(X + 46, 22, 14, 42);
      y.fillStyle = '#ffd9a0'; y.fillRect(X + 4, 19, 38, 43); y.fillStyle = col; y.fillRect(X + 2, 2, 60, 14);
    }
    const t = new THREE.CanvasTexture(c), te = new THREE.CanvasTexture(e); [t, te].forEach(q => { q.wrapS = THREE.RepeatWrapping; });
    SHOP = new THREE.MeshLambertMaterial({ map: t, emissiveMap: te, emissive: 0x000000, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    return SHOP;
  }
  function mats() {
    if (MATS) return MATS;
    MATS = [0, 1, 2, 3, 4].map(s => { const [t, te] = facadeTex(s); return new THREE.MeshLambertMaterial({ map: t, emissiveMap: te, emissive: 0x000000 }); });
    return MATS;
  }
  function build(scene, c) {
    const G = [0, 1, 2, 3, 4].map(() => ({ p: [], n: [], uv: [], i: [] })), R = { p: [], n: [], i: [] }, Z = { p: [], n: [], i: [] };
    const toW = (lx, y, lz) => { const w = Wp(c, lx, lz); return [w.x, y, w.z]; };
    const nW = (nx, ny, nz) => [nx * c.cr - nz * c.sr, ny, nx * c.sr + nz * c.cr];
    const quad = (g, a, b, cc, d, nx, ny, nz, us, vs) => {
      const o = g.p.length / 3, n = nW(nx, ny, nz); [a, b, cc, d].forEach(v => { const w = toW(v[0], v[1], v[2]); g.p.push(w[0], w[1], w[2]); }); for (let k = 0; k < 4; k++) g.n.push(n[0], n[1], n[2]);
      if (g.uv) g.uv.push(0, 0, us, 0, us, vs, 0, vs); g.i.push(o, o + 1, o + 2, o, o + 2, o + 3);
    };
    let count = 0; const SH = { p: [], n: [], uv: [], i: [] }, props = { ac: [], tank: [], chim: [] };
    const ncol = Math.floor((c.hx - AV / 2 - ST) / BLK), nrow = Math.floor((2 * c.hz - ST) / BLK);
    for (const side of [-1, 1]) {
      for (let k = 0; k < ncol; k++) for (let j = 0; j < nrow; j++) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
        const bd = lotBuilding(c, side, k, j, a, b); if (!bd) continue; count++;
        const g = G[bd.style], y0 = bd.y0 - 2, { x0, x1, z0, z1 } = bd;
        const walls = (X0, X1, Z0, Z1, ya, yb) => {
          const wx = (X1 - X0) / 12, wz = (Z1 - Z0) / 12, vh = (yb - ya) / 24;
          quad(g, [X0, ya, Z1], [X1, ya, Z1], [X1, yb, Z1], [X0, yb, Z1], 0, 0, 1, wx, vh);
          quad(g, [X1, ya, Z0], [X0, ya, Z0], [X0, yb, Z0], [X1, yb, Z0], 0, 0, -1, wx, vh);
          quad(g, [X1, ya, Z1], [X1, ya, Z0], [X1, yb, Z0], [X1, yb, Z1], 1, 0, 0, wz, vh);
          quad(g, [X0, ya, Z0], [X0, ya, Z1], [X0, yb, Z1], [X0, yb, Z0], -1, 0, 0, wz, vh);
        };
        let y1 = bd.y0 + bd.h, rx0 = x0, rx1 = x1, rz0 = z0, rz1 = z1;
        if (bd.style !== 3 && bd.h > 110) {
          // gratte-ciel à retraits (comme à Manhattan) : socle large puis tour plus fine
          const ym = bd.y0 + Math.round(bd.h * 0.55 / 3) * 3, ix = (x1 - x0) * 0.17, iz = (z1 - z0) * 0.17;
          walls(x0, x1, z0, z1, y0, ym); quad(R, [x0, ym, z1], [x1, ym, z1], [x1, ym, z0], [x0, ym, z0], 0, 1, 0);
          rx0 = x0 + ix; rx1 = x1 - ix; rz0 = z0 + iz; rz1 = z1 - iz; walls(rx0, rx1, rz0, rz1, ym, y1);
        } else walls(x0, x1, z0, z1, y0, y1);
        // rez-de-chaussée : vitrines et enseignes des magasins
        if (bd.style !== 0 || bd.h < 60) {
          const o = 0.14, ys = bd.y0, ye = bd.y0 + 4.6, S = SH;
          quad(S, [x0, ys, z1 + o], [x1, ys, z1 + o], [x1, ye, z1 + o], [x0, ye, z1 + o], 0, 0, 1, (x1 - x0) / 9, 1);
          quad(S, [x1, ys, z0 - o], [x0, ys, z0 - o], [x0, ye, z0 - o], [x1, ye, z0 - o], 0, 0, -1, (x1 - x0) / 9, 1);
          quad(S, [x1 + o, ys, z1], [x1 + o, ys, z0], [x1 + o, ye, z0], [x1 + o, ye, z1], 1, 0, 0, (z1 - z0) / 9, 1);
          quad(S, [x0 - o, ys, z0], [x0 - o, ys, z1], [x0 - o, ye, z1], [x0 - o, ye, z0], -1, 0, 0, (z1 - z0) / 9, 1);
        }
        // éléments de toit : climatiseurs, réservoirs d'eau en bois (New York), cheminées (Paris)
        const rh = hash(k, j, a * 5 + b + 211), top = bd.style === 3 ? y1 + 4.5 : y1;
        if (bd.style === 3) { for (let q = 0; q < 3; q++) props.chim.push([rx0 + 4 + (rx1 - rx0 - 8) * hash(k, j, q + 300), top + 0.9, rz0 + 4 + (rz1 - rz0 - 8) * hash(j, k, q + 310)]); }
        else {
          props.ac.push([rx0 + (rx1 - rx0) * (0.25 + 0.5 * rh), top + 0.7, rz0 + (rz1 - rz0) * (0.3 + 0.4 * hash(j, k, 77))]);
          if (rh > 0.5) props.ac.push([rx0 + (rx1 - rx0) * 0.7, top + 0.7, rz0 + (rz1 - rz0) * 0.7]);
          if ((c.style === 'ny' && bd.style !== 0 && bd.h < 130 && rh < 0.45) || (c.style === 'afr' && rh < 0.2)) props.tank.push([rx0 + (rx1 - rx0) * 0.3, top, rz0 + (rz1 - rz0) * 0.35]);
        }
        if (bd.style === 3) {
          // toit mansardé en zinc : pans inclinés gris-bleu
          const ins = 3.2, yt = y1 + 4.5; const T = Z;
          quad(T, [x0, y1, z1], [x1, y1, z1], [x1 - ins, yt, z1 - ins], [x0 + ins, yt, z1 - ins], 0, 0.6, 0.8);
          quad(T, [x1, y1, z0], [x0, y1, z0], [x0 + ins, yt, z0 + ins], [x1 - ins, yt, z0 + ins], 0, 0.6, -0.8);
          quad(T, [x1, y1, z1], [x1, y1, z0], [x1 - ins, yt, z0 + ins], [x1 - ins, yt, z1 - ins], 0.8, 0.6, 0);
          quad(T, [x0, y1, z0], [x0, y1, z1], [x0 + ins, yt, z1 - ins], [x0 + ins, yt, z0 + ins], -0.8, 0.6, 0);
          quad(T, [x0 + ins, yt, z1 - ins], [x1 - ins, yt, z1 - ins], [x1 - ins, yt, z0 + ins], [x0 + ins, yt, z0 + ins], 0, 1, 0);
        } else quad(R, [rx0, y1, rz1], [rx1, y1, rz1], [rx1, y1, rz0], [rx0, y1, rz0], 0, 1, 0);
      }
    }
    const meshes = [];
    const mk = (g, mat) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3)); if (g.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2)); geo.setIndex(g.i); const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; scene.add(m); meshes.push(m); return m; };
    const M = mats();
    G.forEach((g, s) => { if (g.p.length) mk(g, M[s]); });
    if (R.p.length) mk(R, new THREE.MeshLambertMaterial({ color: 0x6f7378 }));
    if (Z.p.length) mk(Z, new THREE.MeshLambertMaterial({ color: 0x5d6873 }));
    if (SH.p.length) mk(SH, shopMat());
    // éléments de toit (instanciés)
    const inst = (list, geo, mat) => { if (!list.length) return; const im = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D(); list.forEach((p, i) => { const w = Wp(c, p[0], p[2]); o.position.set(w.x, p[1], w.z); o.rotation.set(0, -c.rot, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); scene.add(im); meshes.push(im); };
    inst(props.ac, new THREE.BoxGeometry(2.4, 1.4, 1.8), new THREE.MeshLambertMaterial({ color: 0x9a9fa3 }));
    inst(props.chim, new THREE.BoxGeometry(0.9, 1.8, 2.2), new THREE.MeshLambertMaterial({ color: 0xb4744f }));
    if (props.tank.length) {
      const tg = new THREE.CylinderGeometry(2.3, 2.3, 4.2, 12); tg.translate(0, 4.6, 0); const cg = new THREE.ConeGeometry(2.6, 1.6, 12); cg.translate(0, 7.5, 0);
      const lg = new THREE.CylinderGeometry(0.15, 0.15, 2.5, 4); lg.translate(0, 1.25, 0);
      inst(props.tank, tg, new THREE.MeshLambertMaterial({ color: 0x7a5636 })); inst(props.tank, cg, new THREE.MeshLambertMaterial({ color: 0x3b3b3b })); inst(props.tank, lg, new THREE.MeshLambertMaterial({ color: 0x2b2b2b }));
    }
    // sol de la ville : trottoirs, rues et boulevard
    // sol de la ville (trottoirs, places) : il s'arrête au bord de l'eau pour laisser voir la rivière
    const GR = { p: [], n: [], i: [] }, cell = 25;
    for (let lx = -c.hx - 150; lx < c.hx + 150; lx += cell) for (let lz = -c.hz - 150; lz < c.hz + 150; lz += cell) {
      const w = Wp(c, lx + cell / 2, lz + cell / 2); if (SIM.waterAt(w.x, w.z) !== null) continue;
      quad(GR, [lx, c.base + 0.05, lz + cell], [lx + cell, c.base + 0.05, lz + cell], [lx + cell, c.base + 0.05, lz], [lx, c.base + 0.05, lz], 0, 1, 0);
    }
    mk(GR, new THREE.MeshLambertMaterial({ color: c.style === 'paris' ? 0xa79f8e : 0x8d8c86, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    const road = { p: [], n: [], i: [] }, Y = c.base + 0.09;
    const strip = (xa, xb, za, zb) => quad(road, [xa, Y, zb], [xb, Y, zb], [xb, Y, za], [xa, Y, za], 0, 1, 0);
    for (const side of [-1, 1]) for (let k = 0; k <= ncol; k++) { const xs = side * (AV / 2 + k * BLK); strip(Math.min(xs, xs + side * ST), Math.max(xs, xs + side * ST), -c.hz, c.hz); }
    for (let j = 0; j <= nrow; j++) { const zs = -c.hz + j * BLK; strip(-c.hx, c.hx, zs - ST / 2, zs + ST / 2); }
    mk(road, new THREE.MeshLambertMaterial({ color: 0x3a3c40, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    // boulevard : marquages blancs (lignes de bord, tirets au centre)
    const tc = document.createElement('canvas'); tc.width = 256; tc.height = 512; const t = tc.getContext('2d');
    t.fillStyle = c.style === 'paris' ? '#6d6a64' : '#34363a'; t.fillRect(0, 0, 256, 512); for (let i = 0; i < 900; i++) { t.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.05)`; t.fillRect(Math.random() * 256, Math.random() * 512, 2, 2); }
    t.fillStyle = '#e8e8e2'; t.fillRect(8, 0, 5, 512); t.fillRect(243, 0, 5, 512); t.fillRect(125, 0, 6, 300);
    const at = new THREE.CanvasTexture(tc); at.wrapS = at.wrapT = THREE.RepeatWrapping; at.repeat.set(1, 2 * c.hz / 160); at.anisotropy = 8;
    const av = new THREE.Mesh(new THREE.PlaneGeometry(AV, 2 * c.hz).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: at, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
    av.position.set(c.x, c.base + 0.12, c.z); av.rotation.y = -c.rot; scene.add(av); meshes.push(av);
    // arbres d'alignement à Paris (le long des trottoirs, hors de la chaussée)
    if (c.style === 'paris') {
      const tg = new THREE.SphereGeometry(3.2, 8, 6), tm = new THREE.MeshLambertMaterial({ color: 0x4e7a3a }), n = Math.floor(2 * c.hz / 14) * 2, im = new THREE.InstancedMesh(tg, tm, n), o = new THREE.Object3D(); let q = 0;
      for (let lz = -c.hz + 10; lz < c.hz - 10 && q < n - 1; lz += 14) for (const s of [-1, 1]) { const w = Wp(c, s * (AV / 2 + 9), lz); o.position.set(w.x, c.base + 7, w.z); o.scale.set(1, 1.15, 1); o.updateMatrix(); im.setMatrixAt(q++, o.matrix); }
      im.count = q; scene.add(im); meshes.push(im);
    }
    // lampadaires lumineux de chaque côté du boulevard (en retrait, hors de la chaussée)
    const lg = SIM.glowTex ? SIM.glowTex('rgba(255,220,160,1)', 'rgba(255,180,90,0)') : null;
    if (lg) { const pts = []; for (let lz = -c.hz; lz <= c.hz; lz += 60) for (const s of [-1, 1]) { const w = Wp(c, s * (AV / 2 + ST - 3), lz); pts.push(w.x, c.base + 9, w.z); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      c.lamps = new THREE.Points(g, new THREE.PointsMaterial({ map: lg, size: 7, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd9a0 })); scene.add(c.lamps); }
    c.count = count; c.meshes = meshes;
  }
  // ---------- Habitants : piétons sur les trottoirs et voitures dans les rues (autour de la caméra) ----------
  const PED = [], CARS = []; let carGeo = null;
  function carModel(col) {
    if (!carGeo) carGeo = { body: new THREE.BoxGeometry(1.8, 0.75, 4.3).translate(0, 0.62, 0), cab: new THREE.BoxGeometry(1.6, 0.6, 2.2).translate(0, 1.28, -0.2), wh: new THREE.CylinderGeometry(0.34, 0.34, 1.86, 10).rotateZ(Math.PI / 2), lf: new THREE.BoxGeometry(1.5, 0.16, 0.05) };
    const g = new THREE.Group();
    g.add(new THREE.Mesh(carGeo.body, new THREE.MeshPhongMaterial({ color: col, shininess: 80 })));
    g.add(new THREE.Mesh(carGeo.cab, new THREE.MeshPhongMaterial({ color: 0x1d2a33, shininess: 120 })));
    for (const z of [-1.35, 1.35]) { const w = new THREE.Mesh(carGeo.wh, new THREE.MeshLambertMaterial({ color: 0x111111 })); w.position.set(0, 0.34, z); g.add(w); }
    const hl = new THREE.Mesh(carGeo.lf, new THREE.MeshBasicMaterial({ color: 0xfff4d0 })); hl.position.set(0, 0.7, -2.16); g.add(hl);
    const tl = new THREE.Mesh(carGeo.lf, new THREE.MeshBasicMaterial({ color: 0xd01010 })); tl.position.set(0, 0.75, 2.16); g.add(tl);
    return g;
  }
  C.carModel = carModel;
  C.lifeInfo = () => ({ ped: PED.filter(p => p.m.visible).length, cars: CARS.filter(c => c.m.visible).length, first: CARS[0] && CARS[0].m.position.toArray().map(v => Math.round(v)) });
  const CARC = [0xe8e8e8, 0x1a1a1a, 0xb3261e, 0x1e4fa8, 0x8a8f94, 0xf0c419, 0x2f6b3a, 0xd9d2c0];
  function spawnPed(c, pl, p) {
    const ncol = Math.floor((c.hx - AV / 2 - ST) / BLK), k = Math.floor(Math.random() * (ncol + 1)), side = Math.random() < 0.5 ? -1 : 1, edge = Math.random() < 0.5 ? -2.5 : ST + 2.5;
    p.lx = side * (AV / 2 + k * BLK) + side * edge; p.lz = clamp(pl.z + (Math.random() - 0.5) * 900, -c.hz + 5, c.hz - 5); p.dir = Math.random() < 0.5 ? -1 : 1; p.sp = 1.1 + Math.random() * 0.6; p.c = c;
  }
  function spawnCar(c, pl, car) {
    const ncol = Math.floor((c.hx - AV / 2 - ST) / BLK), k = Math.floor(Math.random() * (ncol + 1)), side = Math.random() < 0.5 ? -1 : 1, dir = Math.random() < 0.5 ? -1 : 1;
    car.lx = side * (AV / 2 + k * BLK + ST / 2) + dir * side * 2.8; car.lz = clamp(pl.z + (Math.random() - 0.5) * 1200, -c.hz + 5, c.hz - 5); car.dir = dir; car.sp = 8 + Math.random() * 7; car.c = c; car.dead = 0;
  }
  function life(cam) {
    const ci = cities().find(c => c.built && Math.hypot(cam.position.x - c.x, cam.position.z - c.z) < c.hz + c.hx + 800);
    const agl = ci ? cam.position.y - ci.base : 1e9, on = ci && agl < 2200;
    const dt = Math.min(0.1, (performance.now() - (life.t || performance.now())) / 1000) * (SIM.timeScale || 1); life.t = performance.now();
    if (!on) { PED.forEach(p => p.m.visible = false); CARS.forEach(c => c.m.visible = false); return; }
    const pl = L(ci, cam.position.x, cam.position.z);
    if (!PED.length && SIM.life && SIM.life.traveler) for (let i = 0; i < 46; i++) { const m = SIM.life.traveler(); C.scene.add(m); const p = { m }; spawnPed(ci, pl, p); PED.push(p); }
    if (!CARS.length) for (let i = 0; i < 44; i++) { const m = carModel(CARC[i % CARC.length]); C.scene.add(m); const car = { m }; spawnCar(ci, pl, car); CARS.push(car); }
    const t = performance.now() / 1000, P = SIM.P;
    PED.forEach(p => {
      if (p.c !== ci) spawnPed(ci, pl, p);
      p.lz += p.dir * p.sp * dt; if (Math.abs(p.lz - pl.z) > 700 || Math.abs(p.lz) > ci.hz) spawnPed(ci, pl, p);
      const w = Wp(ci, p.lx, p.lz); p.m.visible = true; p.m.position.set(w.x, ci.base + 0.06, w.z); p.m.rotation.y = -ci.rot + (p.dir > 0 ? 0 : Math.PI) + Math.PI;
      if (SIM.life.walkAnim) SIM.life.walkAnim(p.m, t, 6);
    });
    CARS.forEach(car => {
      if (car.c !== ci) spawnCar(ci, pl, car);
      if (car.dead > 0) { car.dead -= dt; car.m.visible = false; if (car.dead <= 0) spawnCar(ci, pl, car); return; }
      car.lz += car.dir * car.sp * dt; if (Math.abs(car.lz - pl.z) > 900 || Math.abs(car.lz) > ci.hz) spawnCar(ci, pl, car);
      const w = Wp(ci, car.lx, car.lz); car.m.visible = true; car.m.position.set(w.x, ci.base + 0.08, w.z); car.m.rotation.y = -ci.rot + (car.dir > 0 ? Math.PI : 0);
      // l'avion qui roule ou se pose dans la rue percute la voiture
      if (!P.crashed && Math.abs(w.x - P.x) < 25 && Math.abs(w.z - P.z) < 25 && P.y - ci.base < 6) {
        const half = SIM.tyx ? SIM.tyx().half : 17, fx = Math.sin(P.psi), fz = -Math.cos(P.psi), dx = w.x - P.x, dz = w.z - P.z, along = dx * fx + dz * fz, side = Math.abs(-dx * fz + dz * fx);
        if (Math.abs(along) < 20 && (side < 3 || (side < half && Math.abs(along) < 4))) { car.dead = 20; SIM.boom.small(w.x, ci.base + 1, w.z, 0.5, true); if (SIM.damageEngine) SIM.damageEngine(null, 0.08, null); SIM.onEvent && SIM.onEvent('toast', 'Vous avez percuté une voiture ! (rien de grave pour l\'avion)'); }
      }
    });
  }
  C.init = function (scene) { C.scene = scene; cities().forEach((c, i) => { c.idx = i; c.clearL = (c.clear || []).map(q => { const p = L(c, q.x, q.z); return { x: p.x, z: p.z, r: q.r }; }); }); };
  C.addClear = function (x, z, r) { cities().forEach(c => { (c.clear = c.clear || []).push({ x, z, r }); const p = L(c, x, z); (c.clearL = c.clearL || []).push({ x: p.x, z: p.z, r }); }); };
  // surface sous l'avion : ville, puis forêt dense, sinon la surface habituelle (piste, herbe, mer…)
  const baseSurface = SIM.surface;
  SIM.surface = function (x, z) {
    const cs = C.surface(x, z); if (cs) return cs;
    const s = baseSurface(x, z);
    if (s.type === 'herbe' && !s.ap && SIM.nature && SIM.nature.isForest && SIM.nature.isForest(x, z)) return { type: 'foret', ap: null };
    return s;
  };
  C.update = function (cam) {
    if (!C.scene) return;
    cities().forEach(c => { if (!c.built && Math.hypot(cam.position.x - c.x, cam.position.z - c.z) < 60000) { build(C.scene, c); c.built = true; C.built = true; C.count = (C.count || 0) + c.count; } });
    const n = SIM.world ? SIM.world.night || 0 : 0;
    if (MATS) MATS.forEach(m => m.emissive.setScalar(clamp((n - 0.25) * 1.6, 0, 1)));
    if (SHOP) SHOP.emissive.setScalar(clamp((n - 0.2) * 1.8, 0, 0.9));
    life(cam);
    cities().forEach(c => { if (c.lamps) c.lamps.material.opacity = clamp((n - 0.3) * 1.8, 0, 1); });
  };
})();
