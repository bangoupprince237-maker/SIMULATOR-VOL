// Poste de pilotage en 3D : planche de bord avec écrans, piédestal, manettes, mini-manches, plafonnier, sièges et deux pilotes
(function () {
  const D2R = SIM.D2R, clamp = SIM.clamp;
  const M = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  // boîtes aux arêtes arrondies (aucun angle vif dans le cockpit)
  const RB = {};
  function roundBox(w, h, d, r) {
    const k = [w, h, d, r].map(v => v.toFixed(3)).join(); if (RB[k]) return RB[k];
    const g = new THREE.BoxGeometry(w, h, d, 6, 6, 6), p = g.attributes.position, ix = w / 2 - r, iy = h / 2 - r, iz = d / 2 - r, v = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i)); c.set(clamp(v.x, -ix, ix), clamp(v.y, -iy, iy), clamp(v.z, -iz, iz));
      const dv = v.clone().sub(c); if (dv.lengthSq() > 1e-12) v.copy(c).addScaledVector(dv.normalize(), r); p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals(); return (RB[k] = g);
  }
  const box = (w, h, d, m, x, y, z) => { const r = Math.min(Math.min(w, h, d) * 0.3, 0.035); const b = new THREE.Mesh(r > 0.004 ? roundBox(w, h, d, r) : new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); return b; };
  function limb(a, b, r, mat) { // cylindre entre deux points
    const v = new THREE.Vector3().subVectors(b, a), L = v.length(), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, L, 16, 1), mat);
    m.position.copy(a).addScaledVector(v, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); return m;
  }
  function screen(tex, w, h) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); return m; }
  function textCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // Pilote réaliste : visage modelé (mâchoire, nez, lèvres, oreilles), yeux qui clignent et regardent, mains avec doigts
  function pilot(x, captain) {
    const g = new THREE.Group(), V = (a, b, c) => new THREE.Vector3(a, b, c), sx = Math.sign(x);
    const S = (c, r, m) => new THREE.MeshStandardMaterial({ color: c, roughness: r == null ? 0.6 : r, metalness: m || 0 });
    // apparence tirée au hasard à chaque avion : teint, coiffure, barbe/moustache, lunettes
    const rnd = a => a[Math.floor(Math.random() * a.length)];
    const SK = rnd([[0x3b2219, 0x2c1811, 0x3a1f1a], [0x5a3624, 0x452819, 0x4a2a22], [0x6d4229, 0x52301d, 0x5a3229], [0x8a5a3a, 0x6c4229, 0x77443a], [0xb27c55, 0x94613f, 0x96584c], [0xd9a982, 0xbf8c66, 0xb46d62], [0xeec4a4, 0xd6a684, 0xc77f78]]);
    const female = Math.random() < 0.22;
    const style = female ? rnd(['chignon', 'chignon', 'carre']) : rnd(['court', 'court', 'rase', 'chauve', 'degarni', 'frise', 'gris', 'lisse']);
    const beard = female ? 'aucune' : rnd(['aucune', 'aucune', 'moustache', 'bouc', 'courte', 'pleine', 'moustache']);
    const hairC = style === 'gris' ? rnd([0x8d8b87, 0xb9b6b0, 0x6f6d69]) : style === 'frise' ? rnd([0x0e0c0b, 0x1a120d]) : rnd([0x121212, 0x1c130d, 0x2a1a10, 0x4a3020, 0x6b4a2a, 0x9a6d3e, 0x7d7b78]);
    const glasses = Math.random() < 0.3;
    const look = { style, beard, glasses, female };
    const skin = S(SK[0], 0.5), skinD = S(SK[1], 0.55), lip = S(female ? 0x8a3c3e : SK[2], 0.45);
    const shirt = S(0xf3f4f6, 0.85), navy = S(0x17202d, 0.8), gold = S(0xd8ad3c, 0.35, 0.6), hairM = S(hairC, style === 'frise' ? 1 : 0.85), black = S(0x0b0b0c, 0.3), white = S(0xf7f7f2, 0.2), iris = S(0x3a2312, 0.3);
    const sph = (r, m, sx_, sy, sz, px, py, pz, seg) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, seg || 18, seg ? seg * 0.75 : 14), m); o.scale.set(sx_, sy, sz); o.position.set(px, py, pz); return o; };
    const hip = V(x, 3.62, -14.95), chest = V(x, 4.0, -14.99);
    // torse modelé (tour de taille -> épaules), un peu aplati
    const prof = [[0.0, 0], [0.15, 0], [0.16, 0.08], [0.158, 0.2], [0.18, 0.32], [0.205, 0.42], [0.21, 0.48], [0.18, 0.54], [0.1, 0.585], [0.0, 0.59]].map(p => new THREE.Vector2(p[0], p[1]));
    const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), shirt); torso.scale.set(1.05, 1, 0.68); torso.position.set(x, 3.6, -14.97); torso.rotation.x = 0.06; g.add(torso);
    g.add(sph(0.16, navy, 1.05, 0.55, 0.75, x, 3.6, -14.97));                                         // ceinture / bassin
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.014, 6, 16, Math.PI * 1.4), shirt); collar.rotation.set(Math.PI / 2, 0, -Math.PI * 0.2 + Math.PI); collar.position.set(x, 4.19, -14.99); g.add(collar);
    const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.012, 0.32, 4), navy); tie.position.set(x, 4.02, -15.115); tie.rotation.x = 0.1; tie.scale.z = 0.3; g.add(tie);
    g.add(sph(0.018, navy, 1, 0.8, 0.6, x, 4.17, -15.105));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.015, 0.005), gold).translateX(x + sx * -0.09).translateY(4.08).translateZ(-15.105)); // ailes de pilote
    for (const s of [-1, 1]) {                                                                         // épaulettes à galons
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.15), navy).translateX(x + s * 0.15).translateY(4.155).translateZ(-14.98));
      for (let k = 0; k < (captain ? 4 : 3); k++) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.004, 0.01), gold).translateX(x + s * 0.15).translateY(4.163).translateZ(-15.035 + k * 0.026));
    }
    g.add(limb(V(x, 4.14, -14.98), V(x, 4.28, -15.0), 0.058, skin));                                    // cou
    // tête
    const head = new THREE.Group(); head.position.set(x, 4.37, -15.0); head.scale.setScalar(1.14); g.add(head);
    const shape = (geo, k) => { const pa = geo.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        let X = pa.getX(i) / k, Y = pa.getY(i) / k, Z = pa.getZ(i) / k;
        if (Y < 0) { const q = Math.pow(Math.min(1, -Y / 0.1), 1.4); X *= 1 - (female ? 0.36 : 0.3) * q; if (Z < 0) Z *= 1 - 0.12 * q; else Z *= 1 - 0.3 * q; }   // mâchoire et menton
        if (Z < -0.05 && Math.abs(X) < 0.05 && Y > -0.06 && Y < 0.03) Z -= 0.004;                       // relief du visage
        if (Z < 0 && Y > 0.02 && Y < 0.04) Z -= 0.006 * (1 - Math.abs(X) / 0.1);                          // arcades sourcilières
        if (Z < -0.04 && Math.abs(X) > 0.03 && Math.abs(X) < 0.07 && Y < -0.01 && Y > -0.05) Z -= 0.003; // pommettes
        pa.setXYZ(i, X * 0.86 * k, Y * 1.12 * k, Z * 0.98 * k);
      }
      geo.computeVertexNormals(); return geo; };
    // peau du visage : modelé peint (orbites, joues rosées, ombre de barbe, rides légères)
    const fc = document.createElement('canvas'); fc.width = 512; fc.height = 256; const fx2 = fc.getContext('2d'), col = '#' + SK[0].toString(16).padStart(6, '0');
    fx2.fillStyle = col; fx2.fillRect(0, 0, 512, 256);
    const blob = (u, v, rx, ry, c) => { const gx = fx2.createRadialGradient(u * 512, (1 - v) * 256, 0, u * 512, (1 - v) * 256, rx); gx.addColorStop(0, c); gx.addColorStop(1, 'rgba(0,0,0,0)'); fx2.save(); fx2.translate(u * 512, (1 - v) * 256); fx2.scale(1, ry / rx); fx2.translate(-u * 512, -(1 - v) * 256); fx2.fillStyle = gx; fx2.fillRect(u * 512 - rx, (1 - v) * 256 - rx, rx * 2, rx * 2); fx2.restore(); };
    for (const d of [-1, 1]) { blob(0.75 + d * 0.06, 0.53, 26, 16, 'rgba(40,20,15,0.35)'); blob(0.75 + d * 0.085, 0.43, 30, 22, female ? 'rgba(200,80,80,0.28)' : 'rgba(170,70,60,0.16)'); blob(0.75 + d * 0.035, 0.37, 14, 18, 'rgba(40,20,10,0.18)'); }
    blob(0.75, 0.6, 60, 14, 'rgba(255,255,255,0.08)'); blob(0.75, 0.47, 10, 26, 'rgba(255,240,230,0.12)');           // front et arête du nez éclairés
    if (!female && beard !== 'pleine' && Math.random() < 0.6) blob(0.75, 0.3, 80, 34, 'rgba(20,14,10,0.22)');       // ombre de barbe rasée
    if (style === 'gris' || style === 'chauve') { fx2.strokeStyle = 'rgba(40,20,10,0.25)'; fx2.lineWidth = 1.2; for (const d of [-1, 1]) { fx2.beginPath(); fx2.arc((0.75 + d * 0.1) * 512, (1 - 0.53) * 256, 9, -0.6, 0.6); fx2.stroke(); } for (let i = 0; i < 2; i++) { fx2.beginPath(); fx2.moveTo(0.71 * 512, (1 - 0.64 - i * 0.025) * 256); fx2.lineTo(0.79 * 512, (1 - 0.64 - i * 0.025) * 256); fx2.stroke(); } }
    const faceT = new THREE.CanvasTexture(fc), faceM = new THREE.MeshStandardMaterial({ map: faceT, roughness: 0.55 });
    const hg = shape(new THREE.SphereGeometry(0.1, 40, 32), 1); head.add(new THREE.Mesh(hg, faceM));
    // chevelure selon le style
    const cap = (r, ps, pl, ts, tl, m) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 36, 18, ps, pl, ts, tl), m || hairM); o.scale.set(0.89, 1.14, 1.0); o.position.set(0, 0.008, 0.006); head.add(o); return o; };
    if (style === 'court' || style === 'gris' || style === 'lisse') { cap(0.102, 0, Math.PI * 2, 0, Math.PI * (style === 'lisse' ? 0.5 : 0.46)); head.add(sph(0.06, hairM, 1.3, 1.1, 0.7, 0, -0.005, 0.06)); }
    else if (style === 'rase') { const o = cap(0.1012, 0, Math.PI * 2, 0, Math.PI * 0.44, S(hairC, 1)); o.material.transparent = true; o.material.opacity = 0.75; }
    else if (style === 'chauve') { cap(0.1018, Math.PI / 2 - 1.7, 3.4, Math.PI * 0.3, Math.PI * 0.2); }                 // couronne autour du crâne chauve
    else if (style === 'degarni') { cap(0.102, Math.PI / 2 - 2.0, 4.0, 0, Math.PI * 0.46); head.add(sph(0.06, hairM, 1.3, 1.1, 0.7, 0, -0.005, 0.06)); }
    else if (style === 'frise') {                                                                       // cheveux crépus courts : surface bosselée
      const fg = new THREE.SphereGeometry(0.107, 40, 22, 0, Math.PI * 2, 0, Math.PI * 0.5), fa = fg.attributes.position;
      for (let i = 0; i < fa.count; i++) { const n = 1 + 0.035 * Math.sin(fa.getX(i) * 260) * Math.sin(fa.getY(i) * 240) * Math.sin(fa.getZ(i) * 250); fa.setXYZ(i, fa.getX(i) * n, fa.getY(i) * n, fa.getZ(i) * n); }
      fg.computeVertexNormals(); const o = new THREE.Mesh(fg, hairM); o.scale.set(0.9, 1.12, 1.0); o.position.set(0, 0.012, 0.006); head.add(o); head.add(sph(0.064, hairM, 1.3, 1.1, 0.72, 0, -0.005, 0.062));
    } else {                                                                                            // femme : chignon ou carré
      cap(0.103, 0, Math.PI * 2, 0, Math.PI * 0.5); head.add(sph(0.065, hairM, 1.3, 1.2, 0.75, 0, -0.01, 0.062));
      if (style === 'chignon') head.add(sph(0.038, hairM, 1, 0.9, 0.9, 0, 0.0, 0.118));
      else for (const s of [-1, 1]) head.add(sph(0.05, hairM, 0.45, 1.25, 0.95, s * 0.085, -0.035, 0.018));
    }
    // pilosité du visage
    const must = () => head.add(sph(0.034, hairM, 1.05, 0.3, 0.5, 0, -0.04, -0.088));
    if (beard === 'moustache') must();
    else if (beard === 'bouc') { must(); head.add(sph(0.022, hairM, 1, 1.1, 0.8, 0, -0.088, -0.072)); }
    else if (beard === 'courte' || beard === 'pleine') {
      const k = beard === 'pleine' ? 1.07 : 1.035, bg = shape(new THREE.SphereGeometry(0.1 * k, 32, 20, Math.PI - 0.35, Math.PI + 0.7, Math.PI * (beard === 'pleine' ? 0.53 : 0.56), Math.PI * 0.44), k);
      const bm = new THREE.Mesh(bg, beard === 'pleine' ? hairM : S(hairC, 1)); if (beard === 'courte') { bm.material.transparent = true; bm.material.opacity = 0.85; } head.add(bm); must();
    }    for (const s of [-1, 1]) head.add(sph(0.022, skin, 0.45, 1, 0.75, s * 0.086, -0.004, 0.004));      // oreilles
    head.add(sph(0.018, skin, 0.85, 1.25, 1.2, 0, -0.018, -0.094));                                   // nez
    for (const s of [-1, 1]) head.add(sph(0.009, skinD, 1, 0.8, 0.8, s * 0.012, -0.034, -0.098));      // narines
    const lz = beard === 'courte' || beard === 'pleine' ? -0.006 : 0; head.add(sph(0.022, lip, 1.25, 0.32, 0.5, 0, -0.052, -0.088 + lz)); head.add(sph(0.02, lip, 1.2, 0.3, 0.5, 0, -0.06, -0.085 + lz));  // lèvres
    const eyes = [], lids = [];
    for (const s of [-1, 1]) {
      const e = new THREE.Group(); e.position.set(s * 0.032, 0.012, -0.082); head.add(e);
      e.add(sph(0.0135, white, 1, 1, 1, 0, 0, 0, 16));
      const ir = new THREE.Group(); e.add(ir); ir.add(sph(0.0072, iris, 1, 1, 0.5, 0, 0, -0.0115, 12)); ir.add(sph(0.0036, black, 1, 1, 0.5, 0, 0, -0.0135, 10));
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0145, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), skin); lid.position.copy(e.position); lid.rotation.x = 0.45; head.add(lid);
      head.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, female ? 0.0035 : 0.0055, 0.008), style === 'chauve' || style === 'gris' ? S(0x3a3532, 0.9) : hairM).translateX(s * 0.032).translateY(0.034).translateZ(-0.09).rotateZ(-s * 0.12)); // sourcils
      if (glasses) { const fr = S(0x202224, 0.3, 0.6), ring = new THREE.Mesh(new THREE.TorusGeometry(0.0175, 0.0018, 6, 22), fr); ring.position.set(s * 0.033, 0.01, -0.104); head.add(ring);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.0172, 20), new THREE.MeshStandardMaterial({ color: 0x9fb8c8, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.4 })); lens.position.copy(ring.position); lens.rotation.y = Math.PI; head.add(lens);
        head.add(limb(V(s * 0.05, 0.012, -0.1), V(s * 0.088, 0.016, -0.01), 0.0016, fr)); }
      eyes.push(ir); lids.push(lid);
    }
    // casque radio
    const dark = S(0x1d1f22, 0.4);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.008, 6, 24, Math.PI), dark); band.rotation.y = Math.PI / 2; band.position.y = 0.025; head.add(band);
    for (const s of [-1, 1]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.042, 0.03, 18), dark); cup.rotation.z = Math.PI / 2; cup.position.set(s * 0.098, -0.002, 0.003); head.add(cup); }
    if (glasses) head.add(new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.003, 0.003), S(0x202224, 0.3, 0.6)).translateY(0.012).translateZ(-0.105));
    head.add(limb(V(-sx * 0.1, -0.02, 0.0), V(-sx * 0.03, -0.055, -0.1), 0.004, dark)); head.add(sph(0.008, black, 1, 1, 1, -sx * 0.03, -0.055, -0.1));
    // bras articulés (épaule, coude, poignet) : les mains vont réellement chercher les commandes
    const shL = V(x - 0.19, 4.11, -14.98), shR = V(x + 0.19, 4.11, -14.98);
    const unit = (r, m) => { const geo = new THREE.CylinderGeometry(r, r * 0.88, 1, 16, 1); geo.translate(0, 0.5, 0); return new THREE.Mesh(geo, m); };
    const mkHand = dir => {
      const hgp = new THREE.Group(); g.add(hgp);
      hgp.add(sph(0.034, skin, 0.9, 0.55, 1.2, 0, 0, 0));
      for (let f = 0; f < 4; f++) { const fx = (f - 1.5) * 0.016; hgp.add(limb(V(fx, 0, -0.035), V(fx, -0.022, -0.06), 0.0075, skin)); hgp.add(limb(V(fx, -0.022, -0.06), V(fx, -0.045, -0.05), 0.007, skin)); }
      hgp.add(limb(V(dir * 0.03, 0, -0.01), V(dir * 0.045, 0.01, -0.045), 0.009, skin));
      return hgp;
    };
    const arms = [];
    [[shL, -1], [shR, 1]].forEach(([S0, dir]) => {
      g.add(sph(0.058, shirt, 1, 1, 1, S0.x, S0.y, S0.z));
      const up = unit(0.052, shirt), fo = unit(0.036, skin), el = sph(0.046, shirt, 1, 1, 1, 0, 0, 0), cuff = unit(0.041, shirt);
      g.add(up, fo, el, cuff);
      const watch = (captain && dir < 0) || (!captain && dir > 0) ? new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.018, 14), S(0xb8b8b8, 0.3, 0.8)) : null; if (watch) g.add(watch);
      const hand = mkHand(-dir);
      arms.push({ S: S0, dir, up, fo, el, cuff, watch, hand, cur: null, a: 0.30, b: 0.29 });
    });
    // jambes articulées : les pieds reposent sur les palonniers et suivent la direction et les freins
    const legs = [];
    for (const s of [-1, 1]) {
      const h0 = V(x + s * 0.1, 3.6, -14.98), k0 = V(x + s * 0.11, 3.64, -15.45), f0 = V(x + s * 0.12, 2.76, -15.62);
      const thigh = unit(0.066, navy), shin = unit(0.048, navy), knee = sph(0.058, navy, 1, 1, 1, 0, 0, 0), sock = sph(0.04, S(0x111318, 0.7), 1, 1, 1, 0, 0, 0);
      const shoe = new THREE.Group(); shoe.add(sph(0.06, black, 0.85, 0.5, 1.9, 0, -0.04, -0.06)); shoe.add(new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.018, 0.22), S(0x050505, 0.8)).translateY(-0.066).translateZ(-0.06));
      const pedal = new THREE.Group(); pedal.add(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.2, 0.02), S(0x2a2d31, 0.6, 0.3)).translateY(0.02)); pedal.add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.25), S(0x55595e, 0.5, 0.6)).translateY(-0.08).translateZ(0.12));
      g.add(thigh, shin, knee, sock, shoe, pedal);
      legs.push({ s, h0, f0, a: h0.distanceTo(k0), b: k0.distanceTo(f0), thigh, shin, knee, sock, shoe, pedal, cur: 0, br: 0 });
    }
    g.userData = { head, eyes, lids, blink: 2 + Math.random() * 3, arms, legs, captain, x, look };
    return g;
  }

  // bras : cinématique inverse à deux segments (épaule → coude → poignet) vers la commande visée
  const _u = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);
  function setLimb(m, A, B) { _u.subVectors(B, A); const L = _u.length() || 1e-4; m.position.copy(A); m.quaternion.setFromUnitVectors(_Y, _u.multiplyScalar(1 / L)); m.scale.set(1, L, 1); }
  function solveArm(arm, T) {
    const S0 = arm.S, a = arm.a, b = arm.b; _u.subVectors(T, S0); let d = _u.length(); d = clamp(d, Math.abs(a - b) + 0.01, a + b - 0.005); _u.normalize();
    const xA = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - xA * xA));
    _p.set(arm.dir * 0.8, -1, 0.35).normalize(); _p.addScaledVector(_u, -_p.dot(_u)).normalize();
    const E = _e.copy(S0).addScaledVector(_u, xA).addScaledVector(_p, h).clone(), W = S0.clone().addScaledVector(_u, d);
    setLimb(arm.up, S0, E); arm.el.position.copy(E);
    const Wr = W.clone().add(new THREE.Vector3(0, 0.02, 0.04)); setLimb(arm.fo, E, Wr);
    const cuffEnd = E.clone().lerp(Wr, 0.32); setLimb(arm.cuff, E, cuffEnd);
    if (arm.watch) { arm.watch.position.copy(E.clone().lerp(Wr, 0.85)); arm.watch.quaternion.setFromUnitVectors(_Y, Wr.clone().sub(E).normalize()); }
    arm.hand.position.copy(W); arm.hand.rotation.set(0, Math.atan2(-(W.x - E.x), -(W.z - E.z)) * 0.6, 0);
  }
  const _f = new THREE.Vector3(), _k = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Vector3();
  function solveLeg(L, rud, brk) {
    // palonnier : le pied droit avance quand on met du pied à droite, l'autre recule ; le frein bascule la pointe du pied
    L.cur += (rud * L.s - L.cur) * 0.25; L.br += (brk - L.br) * 0.25;
    _f.copy(L.f0); _f.z -= L.cur * 0.07;
    L.pedal.position.set(_f.x, _f.y + 0.02, _f.z - 0.1); L.pedal.rotation.x = -0.35 - L.br * 0.25;
    _d.subVectors(_f, L.h0); let d = _d.length(); d = clamp(d, Math.abs(L.a - L.b) + 0.01, L.a + L.b - 0.005); _d.normalize();
    const xA = (L.a * L.a - L.b * L.b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L.a * L.a - xA * xA));
    _q.set(0, 1, -0.6).normalize(); _q.addScaledVector(_d, -_q.dot(_d)).normalize();
    _k.copy(L.h0).addScaledVector(_d, xA).addScaledVector(_q, h); const F = L.h0.clone().addScaledVector(_d, d);
    setLimb(L.thigh, L.h0, _k); setLimb(L.shin, _k, F); L.knee.position.copy(_k); L.sock.position.copy(F);
    L.shoe.position.copy(F); L.shoe.rotation.x = -0.15 - L.br * 0.3;
  }
  SIM.buildCockpit = function (plane) {
    const g = new THREE.Group(), mats = { panel: M(0x2b3036), dark: M(0x1b1e22), wall: M(0x8d8a83), floor: M(0x2f3236), seat: M(0x30353d), metal: M(0xa9b0b7) };
    // coque intérieure : le fuselage vu de l'intérieur, percé aux fenêtres du cockpit
    const ac = textCanvas(512, 2048), ax = ac.getContext('2d'), ZN = -18.62, FL = 37.67, Y = z => (1 - (z - ZN) / FL) * 2048, X = u => u * 512;
    ax.fillStyle = '#fff'; ax.fillRect(0, 0, 512, 2048); ax.fillStyle = '#000';
    const hole = (u0, u1, z0, z1) => { ax.fillRect(X(u0), Y(z1), X(u1 - u0), Y(z0) - Y(z1)); ax.fillRect(X(1 - u1), Y(z1), X(u1 - u0), Y(z0) - Y(z1)); };
    const WIN = [[0.0, 0.17, -18.25, -16.28], [0.176, 0.258, -16.55, -15.45]];   // pare-brise panoramique d'un seul tenant + grandes vitres latérales
    WIN.forEach(w => hole(...w));
    // habillage intérieur : panneaux beiges, joints noirs et montants épais autour des vitres
    const cc = textCanvas(512, 2048), cx2 = cc.getContext('2d');
    cx2.fillStyle = '#7f7c76'; cx2.fillRect(0, 0, 512, 2048);
    for (let i = 0; i < 40; i++) { cx2.fillStyle = 'rgba(0,0,0,0.05)'; cx2.fillRect(0, i * 52, 512, 2); }
    const frame = (u0, u1, z0, z1) => { for (const [a0, a1] of [[u0, u1], [1 - u1, 1 - u0]]) { cx2.fillStyle = '#2a2c30'; cx2.fillRect(X(a0) - 4, Y(z1) - 6, X(a1 - a0) + 8, Y(z0) - Y(z1) + 12); cx2.fillStyle = '#121315'; cx2.fillRect(X(a0) - 1.5, Y(z1) - 2, X(a1 - a0) + 3, Y(z0) - Y(z1) + 4); } };
    WIN.forEach(w => frame(...w));
    const inG = SIM.fuselageGeom().clone(); { const nn = inG.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, -nn.getX(i), -nn.getY(i), -nn.getZ(i)); }
    const shell = new THREE.Mesh(inG, new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(cc), side: THREE.BackSide, alphaMap: new THREE.CanvasTexture(ac), alphaTest: 0.5 }));
    g.add(shell);
    // vitres : verre légèrement teinté avec reflets
    const gc = textCanvas(512, 2048), gx = gc.getContext('2d'); gx.fillStyle = '#000'; gx.fillRect(0, 0, 512, 2048); gx.fillStyle = '#fff';
    WIN.forEach(([u0, u1, z0, z1]) => { gx.fillRect(X(u0), Y(z1), X(u1 - u0), Y(z0) - Y(z1)); gx.fillRect(X(1 - u1), Y(z1), X(u1 - u0), Y(z0) - Y(z1)); });
    const glass = new THREE.Mesh(SIM.fuselageGeom(), new THREE.MeshPhongMaterial({ color: 0x9cc4dc, specular: 0xffffff, shininess: 120, transparent: true, opacity: 0.16, alphaMap: new THREE.CanvasTexture(gc), side: THREE.BackSide, depthWrite: false }));
    glass.renderOrder = 3; g.add(glass);

    g.add(box(2.4, 0.04, 4.2, mats.floor, 0, 2.66, -15.0));
    g.add(box(2.3, 0.78, 0.08, mats.panel, 0, 3.08, -16.36));   // panneau bas sous la planche de bord
    const gtop = box(2.1, 0.03, 0.75, mats.dark, 0, 4.24, -16.72); gtop.rotation.x = 0.32; g.add(gtop);   // dessus de casquette jusqu'au pare-brise
    // cloison arrière avec porte du cockpit
    g.add(box(3.4, 3.2, 0.06, mats.wall, 0, 4.1, -13.85));
    g.add(box(0.8, 1.95, 0.04, M(0x5d6066), 0, 3.65, -13.88)); g.add(box(0.06, 0.12, 0.06, mats.metal, 0.3, 3.65, -13.92));
    g.add(box(0.5, 0.3, 0.03, mats.dark, -0.95, 4.6, -13.88)); g.add(box(0.5, 0.3, 0.03, mats.dark, 0.95, 4.6, -13.88));
    // planche de bord et casquette
    const panel = new THREE.Group(); panel.position.set(0, 3.78, -16.5); panel.rotation.x = -0.22; g.add(panel);
    panel.add(box(2.5, 0.62, 0.08, mats.panel, 0, 0, 0));
    g.add(box(2.3, 0.1, 0.5, mats.dark, 0, 4.12, -16.4));
    // écrans : PFD et ND (commandant et copilote), ECAM supérieur
    const pfdT = new THREE.CanvasTexture(document.getElementById('adi')), ndT = new THREE.CanvasTexture(document.getElementById('ndc'));
    const ec = textCanvas(256, 256), ecT = new THREE.CanvasTexture(ec), sd = textCanvas(256, 256), sdT = new THREE.CanvasTexture(sd);
    // écran principal de vol (PFD) complet : horizon, bande de vitesse, bande d'ALTITUDE, variomètre, cap
    const pc = textCanvas(512, 512), pcx = pc.getContext('2d'), pcT = new THREE.CanvasTexture(pc);
    [[-1.0, pcT], [-0.58, ndT], [0, ecT], [0.58, ndT], [1.0, pcT]].forEach(([x, t]) => { const s = screen(t, 0.36, 0.36); s.position.set(x, 0.02, 0.045); panel.add(s); const bz = box(0.4, 0.4, 0.02, mats.dark, x, 0.02, 0.035); panel.add(bz); });
    // FCU sur la casquette
    const fc = textCanvas(512, 64), fcT = new THREE.CanvasTexture(fc), fcu = screen(fcT, 0.8, 0.09); fcu.position.set(0, 4.12, -16.142); fcu.rotation.x = 0; g.add(fcu);
    // piédestal, ECAM inférieur, manettes
    g.add(box(0.46, 0.65, 1.3, mats.panel, 0, 3.0, -15.55));
    const sds = screen(sdT, 0.32, 0.32); sds.position.set(0, 3.4, -16.18); sds.rotation.x = -0.9; g.add(sds);
    const lev = [];
    for (const lx of [-0.06, 0.06]) { const p = new THREE.Group(); p.position.set(lx, 3.34, -15.6); const h = box(0.035, 0.24, 0.035, mats.metal, 0, 0.12, 0); const k = box(0.08, 0.04, 0.05, mats.dark, 0, 0.25, 0); p.add(h, k); g.add(p); lev.push(p); }
    const flapL = new THREE.Group(); flapL.position.set(0.17, 3.34, -15.45); flapL.add(box(0.025, 0.16, 0.025, mats.metal, 0, 0.08, 0), box(0.06, 0.03, 0.06, mats.metal, 0, 0.17, 0)); g.add(flapL);
    const spdL = new THREE.Group(); spdL.position.set(-0.17, 3.34, -15.45); spdL.add(box(0.025, 0.16, 0.025, mats.metal, 0, 0.08, 0), box(0.07, 0.025, 0.04, mats.dark, 0, 0.17, 0)); g.add(spdL);
    const md = textCanvas(128, 128), mx = md.getContext('2d'); mx.fillStyle = '#05080a'; mx.fillRect(0, 0, 128, 128); mx.fillStyle = '#3ee08a'; mx.font = '12px monospace'; ['MCDU MENU', 'F-PLN  DLA', 'NSI   FL190', 'PERF  TO', 'V1 140 VR 145'].forEach((t, i) => mx.fillText(t, 8, 20 + i * 20));
    const mdT = new THREE.CanvasTexture(md); for (const lx of [-0.12, 0.12]) { const s = screen(mdT, 0.17, 0.17); s.position.set(lx, 3.36, -15.05); s.rotation.x = -1.2; g.add(s); }
    // consoles latérales et mini-manches
    const sticks = [];
    for (const sx of [-1, 1]) {
      g.add(box(0.3, 0.5, 1.2, mats.panel, sx * 1.05, 3.2, -15.3));
      const p = new THREE.Group(); p.position.set(sx * 1.0, 3.46, -15.3);
      const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.05, 20), mats.dark); boot.position.y = 0.02; p.add(boot);
      const grip = new THREE.Mesh(new THREE.LatheGeometry([[0.0, 0], [0.024, 0], [0.026, 0.05], [0.03, 0.11], [0.034, 0.15], [0.03, 0.18], [0.018, 0.2], [0, 0.205]].map(q => new THREE.Vector2(q[0], q[1])), 24), new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.55 }));
      grip.position.y = 0.04; grip.rotation.x = -0.12; grip.scale.z = 1.25; p.add(grip);
      const trig = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 8), new THREE.MeshStandardMaterial({ color: 0x8b1d1d })); trig.rotation.z = Math.PI / 2; trig.position.set(0, 0.17, -0.035); p.add(trig);
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd23030, emissive: 0x400000 })); btn.position.set(-sx * 0.012, 0.243, 0.0); p.add(btn);
      g.add(p); sticks.push(p);
    }
    // plafonnier avec boutons
    const over = new THREE.Group(); over.position.set(0, 5.5, -14.7); over.rotation.x = 0.18; g.add(over);
    over.add(box(0.95, 0.04, 0.9, mats.panel, 0, 0, 0));
    const btnG = new THREE.BoxGeometry(0.04, 0.02, 0.03), btnN = 12 * 16, btns = new THREE.InstancedMesh(btnG, new THREE.MeshBasicMaterial({ color: 0xffffff }), btnN), o = new THREE.Object3D(), cl = new THREE.Color();
    for (let i = 0; i < 12; i++) for (let j = 0; j < 16; j++) { const k = i * 16 + j; o.position.set(-0.4 + i * 0.072, -0.025, -0.4 + j * 0.052); o.scale.set(0.6, 1, 0.6); o.updateMatrix(); btns.setMatrixAt(k, o.matrix); const r = (i * 7 + j * 13) % 23; btns.setColorAt(k, cl.setHex(r === 0 ? 0xffb21e : r === 7 ? 0x38e08a : r === 15 ? 0x3fd0ff : 0x50565d)); }
    over.add(btns);
    // sièges et pilotes
    for (const sx of [-1, 1]) {
      const x = sx * 0.55;
      const leather = new THREE.MeshStandardMaterial({ color: 0x2a2f37, roughness: 0.62 }), sheep = new THREE.MeshStandardMaterial({ color: 0xd9cfbf, roughness: 1 });
      g.add(box(0.54, 0.13, 0.52, leather, x, 3.52, -15.0));
      const back = box(0.52, 0.86, 0.14, leather, x, 4.0, -14.72); back.rotation.x = -0.1; g.add(back);
      const pad = box(0.44, 0.7, 0.04, sheep, x, 4.0, -14.795); pad.rotation.x = -0.1; g.add(pad);
      g.add(box(0.24, 0.14, 0.08, leather, x, 4.5, -14.7));
      for (const a of [-1, 1]) { g.add(box(0.06, 0.05, 0.38, leather, x + a * 0.29, 3.75, -14.98)); g.add(box(0.03, 0.2, 0.03, mats.metal, x + a * 0.29, 3.64, -14.82)); }
      g.add(box(0.5, 0.04, 0.9, mats.metal, x, 2.7, -15.0));
      g.add(box(0.12, 0.8, 0.12, mats.metal, x, 3.08, -15.0));
    }
    const cap = pilot(-0.55, true), fo = pilot(0.55, false); g.add(cap, fo);
    // levier de train (pommeau en forme de roue), voyants, horloge, instruments de secours
    const gearL = new THREE.Group(); gearL.position.set(-0.32, 3.62, -16.38); g.add(gearL);
    gearL.add(box(0.025, 0.12, 0.025, mats.metal, 0, 0.06, 0)); const wheelK = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.012, 10, 20), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4 })); wheelK.position.y = 0.13; gearL.add(wheelK);
    const lightM = c => new THREE.MeshBasicMaterial({ color: c });
    const gLights = [0, 1, 2].map(i => { const l = new THREE.Mesh(new THREE.CircleGeometry(0.013, 14), lightM(0x1f3d26)); l.position.set(-0.4 + i * 0.035, 3.88, -16.36); g.add(l); return l; });
    for (const sx of [-1, 1]) {
      const mw = new THREE.Mesh(new THREE.CircleGeometry(0.02, 16), lightM(0x5a1010)); mw.position.set(sx * 0.82, 4.17, -16.15); mw.rotation.x = -0.6; g.add(mw);
      const mc = new THREE.Mesh(new THREE.CircleGeometry(0.02, 16), lightM(0x5a4310)); mc.position.set(sx * 0.82 + sx * 0.05, 4.17, -16.15); mc.rotation.x = -0.6; g.add(mc);
    }
    const stby = new THREE.Mesh(new THREE.CircleGeometry(0.055, 28), new THREE.MeshBasicMaterial({ map: pfdT })); stby.position.set(-0.23, 3.72, -16.405); g.add(stby);
    // boutons du FCU (molettes) et volants de trim de part et d'autre du piédestal
    [-0.42, -0.14, 0.14, 0.36].forEach(fx => { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.025, 18), mats.metal); k.rotation.x = Math.PI / 2 - 0.35; k.position.set(fx, 4.0, -16.07); g.add(k); });
    const trims = [-1, 1].map(sx => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 8, 28), mats.dark); w.rotation.y = Math.PI / 2; w.position.set(sx * 0.25, 3.05, -15.5); g.add(w); return w; });
    // touches des MCDU
    const keyG = new THREE.BoxGeometry(0.012, 0.004, 0.01), keys = new THREE.InstancedMesh(keyG, new THREE.MeshLambertMaterial({ color: 0x9aa1a8 }), 80), ko = new THREE.Object3D();
    for (let k = 0; k < 80; k++) { const side = k < 40 ? -1 : 1, i = k % 40; ko.position.set(side * 0.12 + ((i % 6) - 2.5) * 0.02, 3.33, -14.98 + Math.floor(i / 6) * 0.017); ko.rotation.x = -0.35; ko.updateMatrix(); keys.setMatrixAt(k, ko.matrix); }
    g.add(keys);
    // lumière de tableau de bord
    const lamp = new THREE.PointLight(0xffe2b0, 0.5, 4); lamp.position.set(0, 5.0, -15.2); g.add(lamp);
    // afficheur tête haute au-dessus du tableau : ALTITUDE, vitesse, vitesse verticale, cap (bien lisible depuis les sièges)
    const hc = textCanvas(512, 160), hx = hc.getContext('2d'), hT = new THREE.CanvasTexture(hc);
    const hud = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.245), new THREE.MeshBasicMaterial({ map: hT, transparent: true, depthWrite: false }));
    hud.position.set(0, 4.36, -16.12); hud.rotation.x = -0.12; g.add(hud);
    let hudT = 0;
    function drawHUD(P) {
      hudT -= 1; if (hudT > 0) return; hudT = 4;
      const FT = SIM.FT, KT = SIM.KT || 0.514444, alt = Math.round(P.y / FT), agl = Math.round(P.agl / FT), vs = Math.round((P.vs || 0) / FT * 60 / 10) * 10;
      hx.clearRect(0, 0, 512, 160); hx.fillStyle = 'rgba(0,20,10,0.55)'; hx.fillRect(0, 0, 512, 160); hx.strokeStyle = '#38e08a'; hx.lineWidth = 3; hx.strokeRect(2, 2, 508, 156);
      hx.fillStyle = '#5dff9d'; hx.textAlign = 'left'; hx.font = 'bold 30px "B612 Mono",monospace';
      hx.fillText('ALT ' + alt.toLocaleString('fr-FR') + ' ft', 14, 44); hx.textAlign = 'right'; hx.fillText(Math.round(P.ias / KT) + ' kt', 498, 44);
      hx.textAlign = 'left'; hx.font = 'bold 24px "B612 Mono",monospace'; hx.fillStyle = '#9dffd0';
      hx.fillText((P.y / 1000).toFixed(2) + ' km · sol ' + (P.onGround ? 0 : agl.toLocaleString('fr-FR')) + ' ft', 14, 90);
      hx.textAlign = 'right'; hx.fillText('V/S ' + (vs > 0 ? '+' : '') + vs, 498, 90);
      hx.textAlign = 'center'; hx.fillStyle = '#5dff9d'; hx.fillText('CAP ' + String(Math.round(((P.psi * 180 / Math.PI) + 360) % 360) % 360).padStart(3, '0') + '°   ·   CARB ' + ((P.fuel || 0) / 1000).toFixed(1) + ' t', 256, 138);
      hT.needsUpdate = true;
    }
    g.visible = false; plane.body.add(g);
    const fx = fc.getContext('2d'), ex = ec.getContext('2d'), sx2 = sd.getContext('2d');
    let pfdTT = 0;
    function drawPFD(P) {
      pfdTT -= 1; if (pfdTT > 0) return; pfdTT = 3;
      const c = pcx, FT = SIM.FT, KT = SIM.KT || 0.514444, alt = P.y / FT, ias = P.ias / KT, vs = (P.vs || 0) / FT * 60, hdg = ((P.psi * 180 / Math.PI) + 360) % 360;
      c.fillStyle = '#05070a'; c.fillRect(0, 0, 512, 512);
      // horizon artificiel (copie de l'instrument principal)
      const adi = document.getElementById('adi'); if (adi) c.drawImage(adi, 116, 96, 280, 280);
      c.font = 'bold 22px "B612 Mono",monospace'; c.textAlign = 'center';
      // bande de vitesse (gauche)
      c.fillStyle = '#2a3036'; c.fillRect(14, 70, 86, 330); c.save(); c.beginPath(); c.rect(14, 70, 86, 330); c.clip();
      for (let v = Math.floor((ias - 60) / 10) * 10; v <= ias + 60; v += 10) { if (v < 0) continue; const y = 235 - (v - ias) * 2.7; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(84, y); c.lineTo(100, y); c.stroke(); if (v % 20 === 0) { c.fillStyle = '#fff'; c.fillText(v, 48, y + 8); } }
      c.restore(); c.fillStyle = '#000'; c.fillRect(10, 218, 94, 36); c.strokeStyle = '#ffe14d'; c.lineWidth = 3; c.strokeRect(10, 218, 94, 36); c.fillStyle = '#ffe14d'; c.font = 'bold 26px "B612 Mono",monospace'; c.fillText(Math.round(ias), 57, 246);
      // bande d'altitude (droite) avec la valeur en grand
      c.font = 'bold 20px "B612 Mono",monospace'; c.fillStyle = '#2a3036'; c.fillRect(410, 70, 90, 330); c.save(); c.beginPath(); c.rect(410, 70, 90, 330); c.clip();
      for (let a = Math.floor((alt - 700) / 100) * 100; a <= alt + 700; a += 100) { const y = 235 - (a - alt) * 0.24; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(410, y); c.lineTo(424, y); c.stroke(); if (a % 500 === 0) { c.fillStyle = '#fff'; c.fillText(Math.round(a / 100), 458, y + 7); } }
      const tgt = P.ap.alt, ty = 235 - (tgt - alt) * 0.24; if (ty > 70 && ty < 400) { c.fillStyle = '#ff5cf0'; c.fillRect(410, ty - 3, 90, 6); }
      c.restore(); c.fillStyle = '#000'; c.fillRect(404, 214, 104, 42); c.strokeStyle = '#ffe14d'; c.lineWidth = 3; c.strokeRect(404, 214, 104, 42); c.fillStyle = '#38e08a'; c.font = 'bold 26px "B612 Mono",monospace'; c.fillText(Math.round(alt), 456, 245);
      c.font = 'bold 18px "B612 Mono",monospace'; c.fillStyle = '#ff5cf0'; c.fillText(String(tgt), 456, 62); c.fillStyle = '#3fd0ff'; c.fillText('ALT ft', 456, 424);
      // hauteur au-dessus du sol (radio-altimètre) sous 2500 ft
      if (!P.onGround && P.agl / FT < 2500) { c.fillStyle = P.agl / FT < 400 ? '#ffb21e' : '#38e08a'; c.font = 'bold 28px "B612 Mono",monospace'; c.fillText(Math.round(P.agl / FT), 256, 410); }
      // variomètre
      c.fillStyle = '#ffffff'; c.font = 'bold 16px "B612 Mono",monospace'; c.fillText((vs > 0 ? '+' : '') + Math.round(vs / 10) * 10, 456, 470);
      // cap et altitude en mètres
      c.fillStyle = '#2a3036'; c.fillRect(150, 440, 212, 40); c.fillStyle = '#fff'; c.font = 'bold 26px "B612 Mono",monospace'; c.fillText(String(Math.round(hdg) % 360).padStart(3, '0') + '°', 256, 470);
      c.fillStyle = '#3fd0ff'; c.font = 'bold 16px "B612 Mono",monospace'; c.fillText((P.y / 1000).toFixed(2) + ' km', 57, 470); c.fillText('KT', 57, 424);
      c.fillStyle = '#38e08a'; c.font = 'bold 18px "B612 Mono",monospace'; c.fillText(P.ap.on ? 'AP1  ' + (P.ap.athr ? 'A/THR' : '') : 'MAN', 256, 40);
      pcT.needsUpdate = true;
    }
    let tt = 0;
    return {
      g, cap, fo,
      update(dt, t, P) {
        if (!g.visible) return;
        gearL.position.y = P.gearDown ? 3.56 : 3.66; gLights.forEach(l => l.material.color.setHex(P.gearPos > 0.99 ? 0x38e08a : P.gearPos > 0.01 ? 0xff3030 : 0x1f3d26));
        trims.forEach(w => w.rotation.x = (P.trimAngle = (P.trimAngle || 0) + (P.theta * 0.02))); 
        lev.forEach(p => p.rotation.x = -(P.rev ? -0.35 : P.thr * 0.9 - 0.25));
        flapL.rotation.x = P.flapSel / 4 * 0.6; spdL.rotation.x = P.spoilSel * 0.6;
        sticks[0].rotation.set(P.stickY * 0.3, 0, -P.stickX * 0.3); sticks[1].rotation.set(P.stickY * 0.15, 0, -P.stickX * 0.15);
        // les mains des pilotes : manche, manettes des gaz, et gestes vers la commande que vous actionnez
        const W = (o, x, y, z) => { o.updateMatrix(); return new THREE.Vector3(x, y, z).applyMatrix4(o.matrix); };
        const thrK = W(lev[0], 0, 0.25, 0).add(W(lev[1], 0, 0.25, 0)).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.03, 0.035));
        const st0 = W(sticks[0], 0, 0.15, 0.005), st1 = W(sticks[1], 0, 0.15, 0.005);
        const TG = { gear: W(gearL, 0, 0.13, 0.02), flap: W(flapL, 0, 0.17, 0.02), spd: W(spdL, 0, 0.17, 0.02), fcu: new THREE.Vector3(-0.18, 4.09, -16.08), fcu2: new THREE.Vector3(0.2, 4.09, -16.08), over: new THREE.Vector3(0.18, 5.4, -14.95), pbrk: new THREE.Vector3(0.02, 3.4, -15.2), eng: new THREE.Vector3(-0.04, 3.62, -15.62), trim: new THREE.Vector3(0.25, 3.12, -15.42), tiller: new THREE.Vector3(-0.98, 3.86, -15.42), arm: W(spdL, 0, 0.17, 0.02) };
        const prev = this.prev || (this.prev = {});
        const sig = { gear: P.gearDown, flap: P.flapSel, spd: Math.round(P.spoilSel * 4), ap: [P.ap.on, P.ap.athr, P.ap.lat, P.ap.vert, P.ap.appr].join(), lt: [P.lights.landing, P.lights.taxi, P.lights.strobe, P.lights.nav].join(), pbrk: P.pbrk, eng: (P.eng || []).join(), trim: Math.round((P.trim || 0) * 20), arm: P.spoilArm, rev: !!P.rev, brk: !!(P.brake || P.brakeMax) };
        const reach = this.reach || (this.reach = { cap: null, fo: null });
        for (const k in sig) { if (prev[k] !== undefined && prev[k] !== sig[k]) {
          if (k === 'gear') reach.fo = { t: 1.8, p: TG.gear }; else if (k === 'flap') reach.fo = { t: 1.6, p: TG.flap }; else if (k === 'lt') reach.fo = { t: 1.8, p: TG.over };
          else if (k === 'spd') reach.cap = { t: 1.4, p: TG.spd }; else if (k === 'ap') reach.cap = { t: 1.5, p: TG.fcu }; else if (k === 'pbrk') reach.cap = { t: 1.4, p: TG.pbrk };
          else if (k === 'eng') reach.cap = { t: 1.8, p: TG.eng }; else if (k === 'trim') reach.fo = { t: 1.2, p: TG.trim }; else if (k === 'arm') reach.cap = { t: 1.3, p: TG.arm };
        } prev[k] = sig[k]; }
        ['cap', 'fo'].forEach(w => { if (reach[w]) { reach[w].t -= dt; if (reach[w].t <= 0) reach[w] = null; } });
        const drive = (pl, i, T) => { const A = pl.userData.arms[i]; if (!A.cur) A.cur = T.clone(); A.cur.lerp(T, Math.min(1, dt * 5)); solveArm(A, A.cur); };
        const lapC = new THREE.Vector3(cap.userData.x + 0.1, 3.7, -15.28), lapF = new THREE.Vector3(fo.userData.x - 0.1, 3.7, -15.28);
        // au sol, à basse vitesse, le commandant tient le volant de direction (tiller) de la main gauche pendant les virages
        const tillerOn = P.onGround && P.V < 16 && P.V > 0.3 && (Math.abs(P.rudder || 0) > 0.05 || Math.abs(P.emX || 0) > 0.03 || Math.abs(P.stickX || 0) > 0.05);
        if (tillerOn) { const tr = clamp((P.rudder || 0) + (P.stickX || 0) + (P.emX || 0), -1, 1); TG.tiller.x = -0.98 + tr * 0.03; TG.tiller.z = -15.42 - tr * 0.05; }
        drive(cap, 0, tillerOn ? TG.tiller : st0); drive(cap, 1, reach.cap ? reach.cap.p : thrK);
        const rudEff = clamp((P.rudder || 0) + (P.emX || 0), -1, 1), brk = P.brake || P.brakeMax || (P.brakeConst && P.onGround && P.V > 1) ? 1 : 0;
        [cap, fo].forEach(pl => pl.userData.legs.forEach(L => solveLeg(L, rudEff, brk)));
        drive(fo, 1, st1); drive(fo, 0, reach.fo ? reach.fo.p : lapF);
        this.look = { cap: reach.cap ? reach.cap.p : null, fo: reach.fo ? reach.fo.p : null };
        [[cap, 0.21, 0, 0.05, 1], [fo, 0.17, 2, 0.07, -1]].forEach(([pl, f, ph, f2, side]) => {
          const u = pl.userData, look = Math.sin(t * f2 + ph) > 0.9 ? side * 0.6 : 0;
          u.head.rotation.y = Math.sin(t * f + ph) * 0.22 + look; u.head.rotation.x = Math.sin(t * 0.13 + ph) * 0.06 - 0.04;
          const ey = clamp(Math.sin(t * 0.9 + ph) * 0.5 + look * 0.6, -0.5, 0.5); u.eyes.forEach(e => { e.rotation.y = ey; e.rotation.x = Math.sin(t * 0.7 + ph) * 0.15; });
          u.blink -= dt; const b = u.blink < 0.14 && u.blink > 0 ? 1 : 0; if (u.blink < 0) u.blink = 2.5 + Math.random() * 3.5;
          u.lids.forEach(l => { l.rotation.x = b ? -1.25 : 0.45; });
          const lk = this.look && this.look[pl === cap ? 'cap' : 'fo'];
          if (lk) { const hx = pl.userData.x, yaw = Math.atan2(-(lk.x - hx), -(lk.z + 15.0)), pit = Math.atan2(lk.y - 4.37, Math.hypot(lk.x - hx, lk.z + 15.0)); u.lookY = (u.lookY || 0) + (yaw - (u.lookY || 0)) * Math.min(1, dt * 6); u.lookP = (u.lookP || 0) + (pit - (u.lookP || 0)) * Math.min(1, dt * 6); }
          else { u.lookY = (u.lookY || 0) * (1 - Math.min(1, dt * 3)); u.lookP = (u.lookP || 0) * (1 - Math.min(1, dt * 3)); }
          u.head.rotation.y += u.lookY; u.head.rotation.x += u.lookP * 0.8;
        });
        lamp.intensity = 0.15 + SIM.world.night * 0.6;
        pfdT.needsUpdate = true; ndT.needsUpdate = true;
        drawPFD(P); drawHUD(P);
        tt -= dt; if (tt > 0) return; tt = 0.25;
        const ap = P.ap;
        fx.fillStyle = '#0a0c0e'; fx.fillRect(0, 0, 512, 64); fx.font = 'bold 26px "B612 Mono",monospace'; fx.fillStyle = '#ffb21e';
        fx.fillText('SPD ' + ap.spd, 14, 42); fx.fillText('HDG ' + String(ap.hdg).padStart(3, '0'), 150, 42); fx.fillText('ALT ' + ap.alt, 290, 42); fx.fillStyle = ap.on ? '#38e08a' : '#555'; fx.fillText('AP1', 452, 42); fcT.needsUpdate = true;
        ex.fillStyle = '#000'; ex.fillRect(0, 0, 256, 256);
        P.n1.forEach((n, i) => { const cx = 70 + i * 116, cy = 80; ex.strokeStyle = '#fff'; ex.lineWidth = 3; ex.beginPath(); ex.arc(cx, cy, 44, Math.PI * 0.75, Math.PI * 2.25); ex.stroke(); const a = Math.PI * 0.75 + clamp(n, 0, 1.05) * Math.PI * 1.5; ex.strokeStyle = '#38e08a'; ex.lineWidth = 5; ex.beginPath(); ex.moveTo(cx, cy); ex.lineTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40); ex.stroke(); ex.fillStyle = '#38e08a'; ex.font = 'bold 22px monospace'; ex.fillText((n * 100).toFixed(1), cx - 26, cy + 40); });
        ex.fillStyle = '#3fd0ff'; ex.font = '18px monospace'; ex.fillText('N1 %', 104, 150); ex.fillStyle = '#fff'; ex.fillText('VOLETS ' + SIM.FLAPNAME[P.flapSel], 20, 190); ex.fillText('FOB ' + Math.round(P.fuel || 0) + ' KG', 20, 220); ex.fillStyle = P.gearPos > 0.99 ? '#38e08a' : '#888'; ex.fillText(P.gearPos > 0.99 ? 'TRAIN ▼▼▼' : P.gearPos < 0.01 ? 'TRAIN ↑' : 'TRAIN ⟳', 140, 190); ecT.needsUpdate = true;
        sx2.fillStyle = '#000'; sx2.fillRect(0, 0, 256, 256); sx2.fillStyle = '#fff'; sx2.font = '20px monospace'; sx2.fillText('ECAM  STATUS', 40, 30);
        ['CAB PR  OK', 'HYD G B Y', 'ELEC AC1 AC2', 'FUEL  BAL', 'BRK ' + (P.pbrk ? 'PARK' : 'REL'), 'SPLR ' + (P.spoilArm ? 'ARM' : '—')].forEach((l, i) => { sx2.fillStyle = i === 4 && P.pbrk ? '#ffb21e' : '#38e08a'; sx2.fillText(l, 30, 70 + i * 30); }); sdT.needsUpdate = true;
      },
    };
  };
})();
