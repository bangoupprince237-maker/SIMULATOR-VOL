// Forêts et arbres autour de la caméra : forêt tropicale, palmiers sur la côte, savane, conifères en France
(function () {
  const clamp = SIM.clamp, CELL = 55, RAD = 3600, CAP = 7000;
  const N = SIM.nature = { cx: 1e12, cz: 1e12 };
  function hash(i, j, k) { let h = Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ Math.imul(k, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }

  N.init = function (scene) {
    const mk = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, CAP); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3).fill(1), 3); m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); return m; };
    const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
    // texture de feuillage : des centaines de feuilles et de petites branches
    const [lc, lx] = cv(256, 256);
    lx.strokeStyle = 'rgba(90,70,50,1)'; lx.lineWidth = 3;
    for (let i = 0; i < 9; i++) { const a = Math.random() * 6.28; lx.beginPath(); lx.moveTo(128, 128); lx.lineTo(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110); lx.stroke(); }
    for (let i = 0; i < 520; i++) {
      const a = Math.random() * 6.28, r = Math.pow(Math.random(), 0.6) * 112, x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r * 0.92, l = 70 + Math.random() * 60;
      lx.fillStyle = `rgb(${l * 0.75 | 0},${(l + 50) | 0},${l * 0.55 | 0})`; lx.save(); lx.translate(x, y); lx.rotate(Math.random() * 6.28);
      lx.beginPath(); lx.ellipse(0, 0, 3 + Math.random() * 3, 7 + Math.random() * 4, 0, 0, 7); lx.fill();
      lx.strokeStyle = 'rgba(0,40,0,0.35)'; lx.lineWidth = 0.6; lx.beginPath(); lx.moveTo(0, -7); lx.lineTo(0, 7); lx.stroke(); lx.restore();
    }
    const leafT = new THREE.CanvasTexture(lc);
    // écorce
    const [bc, bx] = cv(64, 256); bx.fillStyle = '#5b4632'; bx.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 70; i++) { bx.fillStyle = `rgba(${Math.random() < 0.5 ? '30,22,15' : '120,100,80'},0.35)`; bx.fillRect(Math.random() * 64, Math.random() * 256, 1 + Math.random() * 3, 20 + Math.random() * 60); }
    const barkT = new THREE.CanvasTexture(bc); barkT.wrapS = barkT.wrapT = THREE.RepeatWrapping; barkT.repeat.set(2, 3);
    // palme : nervure centrale et folioles
    const [pc, px] = cv(64, 256); px.strokeStyle = '#d8e6b0'; px.lineWidth = 3; px.beginPath(); px.moveTo(32, 0); px.lineTo(32, 256); px.stroke();
    for (let y = 6; y < 250; y += 5) { const w = 30 * Math.sin(y / 256 * Math.PI) + 3, l = 120 + Math.random() * 60; px.strokeStyle = `rgb(${l * 0.7 | 0},${l | 0},${l * 0.5 | 0})`; px.lineWidth = 2.2; for (const s of [-1, 1]) { px.beginPath(); px.moveTo(32, y); px.lineTo(32 + s * w, y + 12); px.stroke(); } }
    const frondT = new THREE.CanvasTexture(pc);
    // aiguilles de conifère
    const [nc, nx] = cv(128, 128); nx.fillStyle = '#6d8a5a'; nx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) { nx.strokeStyle = `rgba(${Math.random() < 0.5 ? '20,45,20' : '140,170,110'},0.6)`; nx.lineWidth = 1; const x = Math.random() * 128, y = Math.random() * 128; nx.beginPath(); nx.moveTo(x, y); nx.lineTo(x + (Math.random() - 0.5) * 8, y + 6); nx.stroke(); }
    const needT = new THREE.CanvasTexture(nc); needT.wrapS = needT.wrapT = THREE.RepeatWrapping; needT.repeat.set(4, 2);
    const leafMat = N.leafMat = new THREE.MeshBasicMaterial({ map: leafT, alphaTest: 0.45, side: THREE.DoubleSide });   // feuillage éclairé uniformément (pas de faces noires)
    // couronne : grappe de 9 plans de feuillage croisés (volume de feuilles)
    const cards = (n, tilt) => {
      const pos = [], uv = [], idx = [];
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * (k < 3 ? 1 : 2) + (k >= 3 ? 0.4 : 0), t = k < 3 ? 0 : tilt * (k % 2 ? 1 : -1), off = k < 3 ? 0 : 0.35;
        const ux = Math.cos(a), uz = Math.sin(a), cx = -uz * off * (k % 2 ? 1 : -1), cz = ux * off * (k % 2 ? 1 : -1), cy = (k % 3 - 1) * 0.25;
        const b = pos.length / 3;
        for (const [s, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pos.push(cx + ux * s, cy + v * Math.cos(t), cz + uz * s + v * Math.sin(t)); uv.push((s + 1) / 2, (v + 1) / 2); }
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      // normales vers l'extérieur pour un éclairage doux de la couronne
      const p = g.attributes.position, nr = g.attributes.normal; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3(p.getX(i), p.getY(i) + 0.3, p.getZ(i)).normalize(); nr.setXYZ(i, v.x, v.y, v.z); }
      return g;
    };
    // palmier : 10 palmes courbées
    const fronds = () => {
      const pos = [], uv = [], idx = [], SEG = 7;
      for (let f = 0; f < 10; f++) {
        const a = f / 10 * Math.PI * 2 + (f % 2) * 0.2, ca = Math.cos(a), sa = Math.sin(a), up = f % 3 === 0 ? 0.35 : 0;
        const b = pos.length / 3;
        for (let i = 0; i <= SEG; i++) {
          const t = i / SEG, r = t, y = up * t - 0.75 * t * t, w = 0.16 * Math.sin(Math.PI * Math.min(t * 1.1 + 0.08, 1));
          for (const s of [-1, 1]) { pos.push(ca * r - sa * w * s, y, sa * r + ca * w * s); uv.push((s + 1) / 2, t); }
          if (i) { const k = b + i * 2; idx.push(k - 2, k - 1, k + 1, k - 2, k + 1, k); }
        }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
    };
    const coniG = (() => { const parts = []; for (let k = 0; k < 4; k++) { const c = new THREE.ConeGeometry(1 - k * 0.2, 0.42, 9, 1, true); c.translate(0, 0.3 + k * 0.2, 0); parts.push(c); }
      const pos = [], uv = [], idx = []; parts.forEach(c => { const b = pos.length / 3; pos.push(...c.attributes.position.array); uv.push(...c.attributes.uv.array); c.index.array.forEach(i => idx.push(i + b)); });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; })();
    N.trunk = mk(new THREE.CylinderGeometry(0.1, 0.2, 1, 7).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ map: barkT }));
    N.crown = mk(cards(9, 0.9), leafMat);
    N.crown2 = mk(cards(6, 0.7), leafMat);
    N.palmT = mk(new THREE.CylinderGeometry(0.07, 0.13, 1, 7).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ map: barkT, color: 0xb8a284 }));
    N.palmC = mk(fronds(), N.frondMat = new THREE.MeshBasicMaterial({ map: frondT, alphaTest: 0.4, side: THREE.DoubleSide }));
    N.conif = mk(coniG, new THREE.MeshLambertMaterial({ map: needT, side: THREE.DoubleSide }));
    N.all = [N.trunk, N.crown, N.crown2, N.palmT, N.palmC, N.conif];
    N.on = true;
  };
  // zone dégagée autour des pistes, taxiways et aérogares
  // forêt dense au point (x, z) ? (même règle que la pousse des arbres)
  function density(x, z) {
    const ll = SIM.geo.toLL(x, z), forest = SIM.vnoise(x / 900, z / 900);
    return ll.lat < 7 ? 0.25 + forest * 0.6 : ll.lat < 13 ? 0.08 + forest * 0.12 : ll.lat < 31 ? 0.004 : ll.lat < 43 ? 0.1 : forest > 0.55 ? 0.65 : 0.06;
  }
  N.isForest = function (x, z) {
    if (density(x, z) < 0.45 || SIM.isSea(x, z) || SIM.waterAt(x, z) !== null || cleared(x, z)) return false;
    return SIM.groundH(x, z) < 2700;
  };
  // arbres couchés par un avion : ils disparaissent (et ne repoussent pas)
  const flat = new Map();
  const fkey = (x, z) => Math.floor(x / 60) + ',' + Math.floor(z / 60);
  function flattened(x, z) { const l = flat.get(fkey(x, z)); return !!l && l.some(f => Math.hypot(f.x - x, f.z - z) < f.r); }
  N.flatten = function (x, z, r) {
    const f = { x, z, r };
    for (let i = Math.floor((x - r) / 60); i <= Math.floor((x + r) / 60); i++) for (let j = Math.floor((z - r) / 60); j <= Math.floor((z + r) / 60); j++) { const k = i + ',' + j; if (!flat.has(k)) flat.set(k, []); flat.get(k).push(f); }
    let n = 0;
    (N.all || []).forEach(M => {
      const a = M.instanceMatrix.array; let ch = false;
      for (let i = 0; i < M.count; i++) { const o = i * 16; if (a[o + 13] > -5000 && Math.hypot(a[o + 12] - x, a[o + 14] - z) < r) { a[o + 13] -= 9000; ch = true; n++; } }
      if (ch) M.instanceMatrix.needsUpdate = true;
    });
    return n;
  };
  function cleared(x, z) {
    if (SIM.city && SIM.city.inside && SIM.city.inside(x, z, 80)) return true;
    if (SIM.roads && SIM.roads.near && SIM.roads.near(x, z, 9)) return true;
    if (flat.size && flattened(x, z)) return true;
    for (const a of SIM.AIRPORTS) {
      if (Math.abs(x - a.x) > 7000 || Math.abs(z - a.z) > 7000) continue;
      for (const C of a.comps) { const { lx, lz } = C.toL(x, z); if (lx > -230 && lx < (C.layout.TERM + 140) && Math.abs(lz) < a.len / 2 + 700) return true; }
      if (a.comps.length > 1) { const { lx, lz } = a.comps[0].toL(x, z); if (lx < 0 && lx > -400 && Math.abs(lz) < a.len / 2 + 700) return true; }
    }
    return false;
  }
  const o = new THREE.Object3D(), col = new THREE.Color();
  const KEYS = ['trunk', 'crown', 'crown2', 'palmT', 'palmC', 'conif'];
  let job = null;
  N.rebuild = function (px, pz, sync) {
    const st = {}; KEYS.forEach(k => st[k] = { m: new Float32Array(CAP * 16), c: new Float32Array(CAP * 3).fill(1), n: 0 });
    job = { px, pz, st, i: Math.floor((px - RAD) / CELL), i1: Math.floor((px + RAD) / CELL), j0: Math.floor((pz - RAD) / CELL), j1: Math.floor((pz + RAD) / CELL) };
    N.cx = px; N.cz = pz;
    if (sync) while (job) N.step(1e9);
  };
  N.step = function (cols) {
    if (!job) return;
    const { px, pz, st } = job;
    const put = (m, key, x, y, z, sx, sy, sz, color, ry) => {
      const b = st[key]; if (b.n >= CAP) return; o.position.set(x, y, z); o.rotation.set(0, ry || 0, 0); o.scale.set(sx, sy, sz); o.updateMatrix();
      o.matrix.toArray(b.m, b.n * 16); if (color) color.toArray(b.c, b.n * 3); b.n++;
    };
    const iEnd = Math.min(job.i1, job.i + cols - 1), j0 = job.j0, j1 = job.j1;
    for (let i = job.i; i <= iEnd; i++) for (let j = j0; j <= j1; j++) {
      const r1 = hash(i, j, 1);
      const x = (i + hash(i, j, 2)) * CELL, z = (j + hash(i, j, 3)) * CELL, d = Math.hypot(x - px, z - pz);
      if (d > RAD) continue;
      const ll = SIM.geo.toLL(x, z);
      let dens = density(x, z);
      dens *= clamp(1 - d / RAD * 0.5, 0.4, 1);
      if (r1 > dens) continue;
      if (SIM.isSea(x, z) || SIM.waterAt(x, z) !== null || cleared(x, z)) continue;
      const h = SIM.groundH(x, z); if (h > 2700) continue;
      const r2 = hash(i, j, 4), r3 = hash(i, j, 5), coast = ll.lat < 6.5 && (h < 25);
      if (coast && r2 < 0.75) {                                    // palmier
        const H = 11 + r3 * 9; put(null, 'palmT', x, h, z, 1 + r3 * 0.4, H, 1 + r3 * 0.4, null, 0);
        col.setHSL(0.2 + r2 * 0.05, 0.35, 0.7 + r3 * 0.15); put(null, 'palmC', x, h + H, z, 5 + r3 * 2, 4 + r3 * 2, 5 + r3 * 2, col, r2 * 6);
      } else if (ll.lat > 43 && r2 < 0.5) {                        // conifère
        const H = 14 + r3 * 12; col.setHSL(0.3, 0.3, 0.5 + r2 * 0.2); put(null, 'conif', x, h, z, 3 + r3 * 1.5, H, 3 + r3 * 1.5, col);
      } else {                                                     // feuillu / arbre de forêt tropicale
        const trop = ll.lat < 7, H = trop ? 16 + r3 * 22 : ll.lat < 13 ? 6 + r3 * 6 : 10 + r3 * 10, R = trop ? 5 + r2 * 6 : ll.lat < 13 ? 3.5 + r2 * 2 : 4 + r2 * 3;
        put(null, 'trunk', x, h, z, 1 + H / 25, H * 0.75, 1 + H / 25);
        const hue = trop ? 0.25 + r2 * 0.08 : ll.lat < 13 ? 0.17 + r2 * 0.06 : 0.23 + r2 * 0.07;
        col.setHSL(hue, 0.35, 0.62 + r3 * 0.2); put(null, 'crown', x, h + H * 0.8, z, R, R * 0.75, R, col, r2 * 6);
        if (trop && r3 > 0.4) { col.offsetHSL(0.02, 0, 0.04); put(null, 'crown2', x + R * 0.5, h + H * 0.92, z - R * 0.3, R * 0.7, R * 0.55, R * 0.7, col, r3 * 6); }
      }
    }
    job.i = iEnd + 1;
    if (job.i > job.i1) {
      KEYS.forEach(k => { const b = st[k], M = N[k]; M.instanceMatrix.array.set(b.m.subarray(0, b.n * 16)); M.instanceColor.array.set(b.c.subarray(0, b.n * 3)); M.count = b.n; M.instanceMatrix.needsUpdate = true; M.instanceColor.needsUpdate = true; });
      job = null;
    }
  };
  N.update = function (cam) {
    const W = SIM.world, lit = (0.28 + 0.72 * (1 - W.night)) * (1 - (SIM.WX ? SIM.WX[W.weather].grey : 0) * 0.45) * (0.85 + 0.15 * Math.max(0, W.sunDir ? W.sunDir.y : 1));
    N.leafMat.color.setScalar(lit * 0.92); N.frondMat.color.setScalar(lit * 0.95);
    const agl = cam.position.y - SIM.groundH(cam.position.x, cam.position.z), show = N.on && agl < 3500;
    N.all.forEach(m => m.visible = show);
    if (job) N.step(10);
    else if (show) { const d = Math.hypot(cam.position.x - N.cx, cam.position.z - N.cz); if (d > 700) N.rebuild(cam.position.x, cam.position.z, d > 20000); }
  };
})();
