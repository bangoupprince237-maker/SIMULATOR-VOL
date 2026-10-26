// Mode à pied (exercice fictif) : le pilote du Rafale sort avec son escouade.
// Personnages articulés (corps arrondis, visage, yeux, mains), armes (revolver, magnum, carabine, précision),
// déplacements, tir, couverture, ordres à l'escouade, ennemis au sol.
(function () {
  const P = SIM.P, D2R = SIM.D2R, R2D = SIM.R2D, clamp = SIM.clamp, V3 = THREE.Vector3;
  const T = SIM.troops = { active: false, me: null, squad: [], foes: [], covers: [], fx: [], unit: 'mil', squadN: 6, weapon: 'carabine', order: 'suivre', kills: 0, keys: {}, camMode: 'orbite', camYaw: 0, camDist: 4.2, aimPitch: 0, crouch: false, aiming: false };
  let scene, gTex = {};
  const UNITS = {
    mil: { name: 'Unité militaire', cmdName: 'Commandant' },
    agent: { name: 'Agents en costume noir (unité spéciale)', cmdName: 'Chef d\'unité' },
    veste: { name: 'Hommes en veste', cmdName: 'Chef' },
    bir: { name: 'Bataillon d\'intervention rapide (tout en noir)', cmdName: 'Chef de groupe' },
  };
  // armes autorisées : tous les corps ont revolver, pistolet, magnum et carabine ; militaires et intervention ont en plus le fusil de précision et le lance-roquettes
  const HAND = ['revolver', 'pistolet', 'magnum', 'lourd', 'dore', 'carabine', 'smg', 'micro'];
  const ALLOW = { mil: HAND.concat(['sniper', 'roquette']), bir: HAND.concat(['sniper', 'roquette']), agent: HAND, veste: HAND, ennemi: ['revolver', 'carabine', 'sniper', 'smg'] };
  const unitOf = u => u.kind === 'cmdMil' ? 'mil' : u.kind;
  T.allowed = k => ALLOW[k === 'cmdMil' ? 'mil' : k] || ALLOW.veste;
  T.UNITS = UNITS;
  const WEAPONS = {
    revolver: { name: 'Revolver', mag: 6, rate: 0.42, dmg: 38, range: 60, spread: 0.018, reload: 2.2, auto: false, pistol: true },
    magnum: { name: 'Magnum', mag: 6, rate: 0.62, dmg: 70, range: 80, spread: 0.016, reload: 2.4, auto: false, pistol: true },
    carabine: { name: 'Carabine', mag: 30, rate: 0.11, dmg: 30, range: 280, spread: 0.012, reload: 2.0, auto: true },
    sniper: { name: 'Fusil de précision', mag: 5, rate: 1.3, dmg: 120, range: 1500, spread: 0.0015, reload: 2.8, auto: false, scope: true },
    pistolet: { name: 'Pistolet', mag: 15, rate: 0.25, dmg: 30, range: 55, spread: 0.02, reload: 1.6, auto: false, pistol: true },
    lourd: { name: 'Pistolet lourd .50', mag: 7, rate: 0.5, dmg: 85, range: 90, spread: 0.014, reload: 2.0, auto: false, pistol: true },
    dore: { name: 'Pistolet doré', mag: 12, rate: 0.28, dmg: 45, range: 65, spread: 0.016, reload: 1.7, auto: false, pistol: true },
    smg: { name: 'Mitraillette tactique', mag: 30, rate: 0.075, dmg: 22, range: 140, spread: 0.02, reload: 2.0, auto: true },
    micro: { name: 'Mitraillette compacte', mag: 32, rate: 0.06, dmg: 18, range: 90, spread: 0.028, reload: 1.8, auto: true, pistol: true },
    roquette: { name: 'Lance-roquettes', mag: 1, rate: 1.0, dmg: 260, range: 650, spread: 0.004, reload: 3.6, auto: false, rocket: true },
  };
  T.WEAPONS = WEAPONS;

  // ---------- Textures ----------
  function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
  function camo(cols, seed) {
    return canvasTex(256, 256, (x, w, h) => {
      let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
      x.fillStyle = cols[0]; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) { x.fillStyle = cols[1 + i % (cols.length - 1)]; x.beginPath(); const cx = r() * w, cy = r() * h, rr = 6 + r() * 16; for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28, q = rr * (0.5 + r() * 0.7); x[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * q * 1.4, cy + Math.sin(a) * q); } x.fill(); }
      x.strokeStyle = 'rgba(0,0,0,0.18)'; for (let i = 0; i < 40; i++) { x.beginPath(); const yy = r() * h; x.moveTo(0, yy); x.lineTo(w, yy + r() * 4); x.stroke(); }
    });
  }
  function suitTex(base, shirt, tie, jacket) {
    // tissu du torse : chemise et cravate au centre (avant = milieu de la texture), boutons, couture
    return canvasTex(256, 256, (x, w, h) => {
      x.fillStyle = base; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 1800; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.035)`; x.fillRect(Math.random() * w, Math.random() * h, 1, 2); }
      if (shirt) {
        x.fillStyle = shirt; x.beginPath(); x.moveTo(w * 0.5 - 22, h); x.lineTo(w * 0.5 - 30, 0); x.lineTo(w * 0.5 + 30, 0); x.lineTo(w * 0.5 + 22, h); x.closePath();
        x.beginPath(); x.moveTo(w * 0.5, h * 0.95); x.lineTo(w * 0.5 - 34, 0); x.lineTo(w * 0.5 + 34, 0); x.closePath(); x.fill();
        if (tie) { x.fillStyle = tie; x.beginPath(); x.moveTo(w * 0.5 - 7, 6); x.lineTo(w * 0.5 + 7, 6); x.lineTo(w * 0.5 + 11, h * 0.62); x.lineTo(w * 0.5, h * 0.72); x.lineTo(w * 0.5 - 11, h * 0.62); x.closePath(); x.fill(); }
        x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 3; x.beginPath(); x.moveTo(w * 0.5 - 34, 0); x.lineTo(w * 0.5, h * 0.95); x.lineTo(w * 0.5 + 34, 0); x.stroke();
      }
      if (jacket) { x.strokeStyle = 'rgba(200,200,190,0.8)'; x.lineWidth = 2; x.beginPath(); x.moveTo(w * 0.5, 0); x.lineTo(w * 0.5, h); x.stroke(); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(w * 0.18, h * 0.45, 26, 30); x.fillRect(w * 0.82 - 26, h * 0.45, 26, 30); }
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, h * 0.86, w, 4);
    });
  }
  function faceTex(skin, beard) {
    return canvasTex(512, 256, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, skin); g.addColorStop(1, shade(skin, -18)); x.fillStyle = g; x.fillRect(0, 0, w, h);
      const fx = w * 0.75;                                   // le visage est centré sur u = 0,75 (direction -Z)
      // modelé : joues, orbites, ombre du nez
      const rg = (cx, cy, r, c) => { const q = x.createRadialGradient(cx, cy, 0, cx, cy, r); q.addColorStop(0, c); q.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = q; x.fillRect(cx - r, cy - r, 2 * r, 2 * r); };
      rg(fx - 26, h * 0.48, 18, 'rgba(60,30,20,0.35)'); rg(fx + 26, h * 0.48, 18, 'rgba(60,30,20,0.35)');
      rg(fx - 34, h * 0.55, 26, 'rgba(200,90,80,0.18)'); rg(fx + 34, h * 0.55, 26, 'rgba(200,90,80,0.18)');
      // sourcils
      x.fillStyle = 'rgba(22,15,10,0.95)'; x.save(); x.translate(fx - 24, h * 0.432); x.rotate(0.1); x.fillRect(-17, -4, 34, 7); x.restore(); x.save(); x.translate(fx + 24, h * 0.432); x.rotate(-0.1); x.fillRect(-17, -4, 34, 7); x.restore();
      rg(fx - 24, h * 0.48, 12, 'rgba(30,15,10,0.35)'); rg(fx + 24, h * 0.48, 12, 'rgba(30,15,10,0.35)');
      // bouche et lèvres
      x.fillStyle = 'rgba(150,70,60,0.85)'; x.beginPath(); x.ellipse(fx, h * 0.62, 17, 6, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = 'rgba(40,15,10,0.8)'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(fx - 16, h * 0.62); x.quadraticCurveTo(fx, h * 0.635, fx + 16, h * 0.62); x.stroke();
      if (beard) { x.fillStyle = 'rgba(25,18,12,0.45)'; for (let i = 0; i < 900; i++) { const a = Math.random() * Math.PI, r = 30 + Math.random() * 30; x.fillRect(fx + Math.cos(a) * r * 1.2 - 1, h * 0.6 + Math.sin(a) * r * 0.5, 1.4, 1.4); } }
    });
  }
  function shade(hex, d) { const n = parseInt(hex.slice(1), 16); const c = k => clamp(((n >> k) & 255) + d, 0, 255); return `rgb(${c(16)},${c(8)},${c(0)})`; }

  // ---------- Géométries arrondies ----------
  const geoCache = {};
  function limb(r1, r2, len) {         // membre arrondi qui pend sous son pivot (de y=0 à y=-len)
    const key = [r1, r2, len].join(); if (geoCache[key]) return geoCache[key];
    const P2 = [new THREE.Vector2(0.0001, r1 * 0.6)];
    for (let i = 1; i <= 5; i++) { const a = i / 5 * Math.PI / 2; P2.push(new THREE.Vector2(Math.sin(a) * r1, r1 * 0.6 * Math.cos(a))); }
    P2.push(new THREE.Vector2(r1 * 1.04, -len * 0.25)); P2.push(new THREE.Vector2((r1 + r2) * 0.5 * 1.02, -len * 0.6));
    for (let i = 0; i <= 5; i++) { const a = i / 5 * Math.PI / 2; P2.push(new THREE.Vector2(Math.cos(a) * r2 + 0.0001, -len - Math.sin(a) * r2 * 0.6)); }
    P2.reverse();                          // de bas en haut : faces tournées vers l'extérieur
    return (geoCache[key] = new THREE.LatheGeometry(P2, 14));
  }
  function torsoGeo(k) {
    const key = 'torso' + k; if (geoCache[key]) return geoCache[key];
    // du bassin (y=0) aux épaules (y=0.56) : taille fine, poitrine large
    const prof = [[0.0001, -0.02], [0.15, 0.0], [0.155, 0.08], [0.145, 0.18], [0.16, 0.3], [0.185, 0.4], [0.195, 0.47], [0.185, 0.53], [0.13, 0.575], [0.065, 0.6], [0.0001, 0.605]];
    const g = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0] * k, p[1])), 22); g.scale(1.22, 1, 0.72);
    return (geoCache[key] = g);
  }
  // tête sculptée : crâne, front, arcades, pommettes, nez, mâchoire et menton
  function headGeo() {
    if (geoCache.head) return geoCache.head;
    const g = new THREE.SphereGeometry(1, 40, 32), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const front = Math.max(0, -z);                       // le visage regarde vers -Z
      y *= 1.16;
      if (y < -0.15) { const k = clamp((-y - 0.15) / 1.0, 0, 1); x *= 1 - 0.32 * k; z = z * (1 - 0.18 * k) - 0.12 * k * front; }   // mâchoire affinée, menton
      if (y > 0.2) z += 0.08 * (y - 0.2) * Math.max(0, z);  // arrière du crâne
      x *= 0.86 + 0.06 * Math.cos(y * 2);                  // tempes
      const fy = y, fx = Math.abs(x);
      if (front > 0.6) {
        if (fy > 0.05 && fy < 0.32) z -= 0.06 * Math.exp(-((fy - 0.22) ** 2) / 0.004) * front;                          // arcades sourcilières
        if (fx > 0.18 && fx < 0.5 && fy > -0.05 && fy < 0.16) z += 0.05 * front * Math.exp(-((fx - 0.33) ** 2) / 0.01) * Math.exp(-((fy - 0.06) ** 2) / 0.006);   // orbites
        if (fx < 0.16 && fy > -0.32 && fy < 0.12) z -= 0.2 * front * Math.exp(-(fx * fx) / 0.006) * Math.exp(-((fy + 0.12) ** 2) / 0.02);                      // nez
        if (fx > 0.35 && fy > -0.3 && fy < 0.05) z -= 0.04 * front * Math.exp(-((fy + 0.12) ** 2) / 0.01);                                                   // pommettes
        if (fx < 0.3 && fy > -0.5 && fy < -0.36) z -= 0.03 * front * Math.exp(-((fy + 0.43) ** 2) / 0.002);                                                  // lèvres
      }
      p.setXYZ(i, x * 0.094, y * 0.1, z * 0.1);
    }
    g.computeVertexNormals();
    return (geoCache.head = g);
  }
  const sph = (r, ws, hs, tl) => { const key = 's' + [r, ws, hs, tl].join(); return geoCache[key] || (geoCache[key] = new THREE.SphereGeometry(r, ws || 18, hs || 14, 0, Math.PI * 2, 0, tl || Math.PI)); };
  const box = (a, b, c) => { const key = 'b' + [a, b, c].join(); return geoCache[key] || (geoCache[key] = new THREE.BoxGeometry(a, b, c)); };
  const cyl = (r1, r2, h, n) => { const key = 'c' + [r1, r2, h, n].join(); return geoCache[key] || (geoCache[key] = new THREE.CylinderGeometry(r1, r2, h, n || 12)); };

  // ---------- Matériaux par type de personnage ----------
  const matCache = {};
  const SKINS = ['#c68a64', '#8d5a3b', '#5b3a26', '#e0b190', '#a8714c', '#6e4630'];
  function mats(kind, skinI) {
    const key = kind + skinI; if (matCache[key]) return matCache[key];
    const S = (c, r, m) => new THREE.MeshStandardMaterial({ color: c, roughness: r == null ? 0.8 : r, metalness: m || 0 });
    const skin = SKINS[skinI % SKINS.length], m = { skin: S(skin, 0.6), face: new THREE.MeshStandardMaterial({ map: faceTex(skin, skinI % 3 === 0), roughness: 0.6 }) };
    m.eyeW = S(0xf4f1ea, 0.3); m.iris = S(skinI % 4 === 3 ? 0x3d6b8a : 0x2a1a10, 0.2); m.hair = S(skinI % 5 === 4 ? 0x6a4a2a : 0x15110e, 0.9); m.lips = S(shade(skin, -40), 0.6);
    m.boot = S(0x1a1714, 0.6); m.black = S(0x111214, 0.5, 0.2); m.metal = S(0x2b2d30, 0.35, 0.7);
    if (kind === 'bir') {
      gTex.bir = gTex.bir || canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#121315'; x.fillRect(0, 0, w, h); for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; x.fillRect(Math.random() * w, Math.random() * h, 1, 1); } x.strokeStyle = 'rgba(0,0,0,0.6)'; for (let i = 0; i < 128; i += 32) { x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); } });
      gTex.knit = gTex.knit || canvasTex(256, 128, (x, w, h) => { x.fillStyle = '#0d0e10'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,255,0.06)'; for (let i = 0; i < h; i += 3) { x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); } });
      m.top = new THREE.MeshStandardMaterial({ map: gTex.bir, roughness: 0.85 }); m.legs = m.top; m.arm = m.top; m.vest = S(0x16171a, 0.7, 0.1); m.helm = S(0x1a1b1e, 0.5, 0.2); m.glove = S(0x0c0c0d, 0.7);
      m.mask = new THREE.MeshStandardMaterial({ map: gTex.knit, roughness: 1 }); m.lens = S(0x3d5866, 0.05, 0.85); m.boot = S(0x0b0b0c, 0.35, 0.2); m.ranger = true;
    } else if (kind === 'mil' || kind === 'cmdMil') {
      gTex.camo = gTex.camo || camo(['#5a5f3c', '#3f4429', '#7a7350', '#2c2f1e'], 11);
      m.top = new THREE.MeshStandardMaterial({ map: gTex.camo, roughness: 0.95 }); m.legs = m.top; m.arm = m.top;
      m.vest = S(0x4c5134, 0.9); m.helm = S(0x4a5033, 0.7); m.beret = S(0x2d5a2d, 0.9); m.glove = S(0x2a2620, 0.8); m.boot = S(0x0e0d0c, 0.35, 0.2); m.ranger = true;
    } else if (kind === 'agent') {
      gTex.suit = gTex.suit || suitTex('#141518', '#f2f2f0', '#0b0b0d');
      m.top = new THREE.MeshStandardMaterial({ map: gTex.suit, roughness: 0.55 }); m.arm = S(0x141518, 0.55); m.legs = S(0x17181b, 0.55); m.glove = m.skin; m.boot = S(0x0a0a0a, 0.25, 0.3); m.glass = S(0x050505, 0.1, 0.8);
    } else if (kind === 'veste') {
      const jk = ['#4a2f1e', '#2b3240', '#3a3a36'][skinI % 3];
      gTex['jk' + jk] = gTex['jk' + jk] || suitTex(jk, '#d8d4c8', null, true);
      m.top = new THREE.MeshStandardMaterial({ map: gTex['jk' + jk], roughness: 0.5, metalness: 0.05 }); m.arm = S(jk, 0.5); m.legs = S(0x2f4058, 0.85); m.glove = m.skin; m.boot = S(0x2a1d14, 0.6);
    } else {   // ennemi : tenue sable, foulard rouge bien visible
      gTex.desert = gTex.desert || camo(['#b39b72', '#9a8460', '#c9b48e', '#806c4c'], 23);
      m.top = new THREE.MeshStandardMaterial({ map: gTex.desert, roughness: 0.95 }); m.legs = m.top; m.arm = m.top; m.vest = S(0x6b5a3e, 0.9); m.helm = S(0x8c7b58, 0.8); m.red = S(0xc0201a, 0.8); m.glove = S(0x3a3025, 0.8); m.boot = S(0x3a2a1a, 0.6); m.ranger = true;
    }
    return (matCache[key] = m);
  }

  // ---------- Armes ----------
  function weaponModel(type) {
    const w = new THREE.Group(), inner = new THREE.Group(); w.add(inner);   // modèle construit le long de -Z (canon vers l'avant)
    const blk = new THREE.MeshStandardMaterial({ color: 0x2c2e33, roughness: 0.35, metalness: 0.45 }), wood = new THREE.MeshStandardMaterial({ color: 0x6a4428, roughness: 0.55 }), steel = new THREE.MeshStandardMaterial({ color: 0xd3d7dc, roughness: 0.28, metalness: 0.5 });
    const dkm = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.5, metalness: 0.4 }), steelm = steel;
    const add = (g, m, x, y, z, rx) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); if (rx) o.rotation.x = rx; inner.add(o); return o; };
    let muzzle = -0.3;
    if (type === 'revolver' || type === 'magnum') {
      // revolver / magnum détaillé : carcasse à pontet, barillet cannelé, canon à bande ventilée et tenon d'éjecteur, chien, détente, organes de visée, crosse ergonomique
      const mag = type === 'magnum', L = mag ? 0.16 : 0.1, mt = mag ? steel : blk, dk = new THREE.MeshStandardMaterial({ color: 0x3a3c42, roughness: 0.3, metalness: 0.5 });
      const grip = new THREE.MeshStandardMaterial({ color: mag ? 0x1b1b1c : 0x5a3a22, roughness: mag ? 0.85 : 0.55 });
      add(box(0.03, 0.045, 0.085), mt, 0, 0.03, 0.005);                                   // carcasse
      add(box(0.03, 0.012, 0.1), mt, 0, 0.058, -0.005);                                   // pont supérieur
      const cy = add(cyl(0.025, 0.025, 0.048, 18).rotateX(Math.PI / 2), mt, 0, 0.032, -0.012); // barillet
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.5; add(cyl(0.005, 0.005, 0.04, 6).rotateX(Math.PI / 2), dk, Math.cos(a) * 0.024, 0.032 + Math.sin(a) * 0.024, -0.012); }   // cannelures
      add(cyl(0.0105, 0.0105, L, 14).rotateX(Math.PI / 2), mt, 0, 0.047, -0.04 - L / 2);   // canon
      add(box(0.016, 0.02, L), mt, 0, 0.026, -0.04 - L / 2);                              // tenon d'éjecteur pleine longueur
      if (mag) { add(box(0.012, 0.008, L), mt, 0, 0.062, -0.04 - L / 2); for (let k = 1; k < 6; k++) add(box(0.013, 0.003, 0.004), dk, 0, 0.064, -0.04 - k * L / 6); }   // bande ventilée
      add(box(0.004, 0.012, 0.012), dk, 0, 0.07, -0.035 - L);                             // guidon
      add(box(0.016, 0.008, 0.01), dk, 0, 0.068, 0.04);                                   // hausse réglable
      add(box(0.008, 0.02, 0.016), dk, 0, 0.064, 0.055, -0.6);                             // chien
      add(new THREE.TorusGeometry(0.019, 0.0035, 6, 18).rotateY(Math.PI / 2), mt, 0, 0.004, 0.004);   // pontet
      add(box(0.005, 0.02, 0.006), dk, 0, 0.002, 0.006, 0.3);                              // détente
      add(box(0.004, 0.012, 0.01), dk, 0.016, 0.04, 0.02);                                // poussoir de barillet
      const g1 = add(sph(0.022, 12, 10), grip, 0, -0.028, 0.045); g1.scale.set(0.75, 1.9, 1.05); g1.rotation.x = -0.32;   // crosse
      add(box(0.024, 0.012, 0.03), mt, 0, -0.062, 0.058);                                  // talon
      muzzle = -0.045 - L;
    } else if (type === 'pistolet') {
      add(box(0.028, 0.03, 0.17), blk, 0, 0.045, -0.04);                           // culasse
      for (let k = 0; k < 6; k++) add(box(0.029, 0.022, 0.003), steel, 0, 0.046, 0.025 + k * 0.008);   // stries de culasse
      add(box(0.026, 0.02, 0.12), blk, 0, 0.022, -0.05);                           // carcasse
      add(box(0.026, 0.09, 0.042), blk, 0, -0.025, 0.035, -0.22);                  // poignée
      add(new THREE.TorusGeometry(0.017, 0.0035, 6, 16).rotateY(Math.PI / 2), blk, 0, 0.008, -0.004);   // pontet
      add(box(0.004, 0.012, 0.006), steel, 0, 0.066, -0.12);                        // guidon
      add(box(0.014, 0.008, 0.008), steel, 0, 0.064, 0.035);                        // hausse
      muzzle = -0.13;
    } else if (type === 'roquette') {
      // lance-roquettes : tube, roquette visible, viseur gradué en distance, poignées, appui-épaule
      const ol = new THREE.MeshStandardMaterial({ color: 0x4d5536, roughness: 0.8 }), dk = new THREE.MeshStandardMaterial({ color: 0x23251f, roughness: 0.6, metalness: 0.3 });
      add(cyl(0.047, 0.047, 1.05, 18).rotateX(Math.PI / 2), ol, 0, 0, -0.1);                       // tube
      add(cyl(0.055, 0.055, 0.06, 18).rotateX(Math.PI / 2), dk, 0, 0, -0.6);                       // bague avant
      add(cyl(0.07, 0.05, 0.16, 18).rotateX(Math.PI / 2), dk, 0, 0, 0.5);                          // tuyère arrière évasée
      add(cyl(0.04, 0.045, 0.12, 14).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6a6f5a, roughness: 0.6 }), 0, 0, -0.69);   // ogive (corps)
      add(new THREE.ConeGeometry(0.06, 0.2, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5f6649, roughness: 0.6 }), 0, 0, -0.85);   // ogive
      add(box(0.04, 0.05, 0.12), dk, -0.055, 0.06, -0.05);                         // viseur optique
      add(cyl(0.018, 0.018, 0.13, 12).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1b2a30, roughness: 0.1, metalness: 0.8 }), -0.055, 0.075, -0.05);
      add(box(0.004, 0.06, 0.004), dk, 0, 0.075, -0.45);                            // hausse graduée
      for (let k = 0; k < 4; k++) add(box(0.016, 0.003, 0.003), steel, 0, 0.055 + k * 0.012, -0.45);
      add(box(0.03, 0.1, 0.04), dk, 0, -0.08, 0.04, -0.2);                          // poignée pistolet
      add(box(0.03, 0.09, 0.035), dk, 0, -0.075, -0.28, 0.15);                      // poignée avant
      add(box(0.06, 0.03, 0.14), dk, 0, -0.05, 0.28);                               // appui-épaule
      muzzle = -0.95;
    } else if (type === 'lourd') {
      // pistolet lourd .50 : grosse culasse à profil triangulaire, finition noire et acier poli, détails dorés
      const pol = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.18, metalness: 0.6 }), gold = new THREE.MeshStandardMaterial({ color: 0xd9a933, roughness: 0.25, metalness: 0.7 });
      add(box(0.034, 0.042, 0.24), pol, 0, 0.05, -0.05);                            // culasse massive
      add(box(0.02, 0.012, 0.24), pol, 0, 0.076, -0.05);                            // arête supérieure (profil triangulaire)
      for (let k = 0; k < 7; k++) add(box(0.036, 0.03, 0.004), blk, 0, 0.05, 0.03 + k * 0.008);   // stries
      add(box(0.006, 0.02, 0.07), blk, 0.018, 0.05, -0.06);                         // fenêtre d'éjection
      add(cyl(0.012, 0.012, 0.02, 10).rotateX(Math.PI / 2), blk, 0, 0.05, -0.175);  // bouche
      add(box(0.03, 0.026, 0.17), blk, 0, 0.018, -0.06);                            // carcasse
      add(box(0.03, 0.1, 0.05), blk, 0, -0.03, 0.04, -0.2);                         // poignée
      for (let k = 0; k < 5; k++) add(box(0.032, 0.004, 0.04), dkm, 0, -0.005 - k * 0.016, 0.042 + k * 0.003, -0.2);   // quadrillage
      add(new THREE.TorusGeometry(0.02, 0.004, 6, 16).rotateY(Math.PI / 2), blk, 0, 0.0, -0.01);   // pontet
      add(box(0.006, 0.022, 0.008), gold, 0, 0.0, -0.005, 0.3);                     // détente dorée
      add(box(0.01, 0.02, 0.016), gold, 0, 0.07, 0.075, -0.6);                      // chien doré
      add(box(0.006, 0.014, 0.008), gold, 0, 0.085, -0.16);                          // guidon
      muzzle = -0.19;
    } else if (type === 'dore') {
      // pistolet doré : finition or gravée, plaquettes ivoire
      const gold = new THREE.MeshStandardMaterial({ color: 0xe0b23a, roughness: 0.2, metalness: 0.75, emissive: 0x241800 }), ivory = new THREE.MeshStandardMaterial({ color: 0xf0e8d2, roughness: 0.4 }), eng = new THREE.MeshStandardMaterial({ color: 0x8a6418, roughness: 0.4, metalness: 0.6 });
      add(box(0.029, 0.032, 0.18), gold, 0, 0.046, -0.045);                          // culasse
      for (let k = 0; k < 6; k++) add(box(0.0295, 0.003, 0.012), eng, 0, 0.04 + (k % 2) * 0.012, -0.11 + k * 0.022);   // gravures
      for (let k = 0; k < 5; k++) add(box(0.03, 0.022, 0.003), eng, 0, 0.046, 0.025 + k * 0.008);
      add(box(0.026, 0.02, 0.13), gold, 0, 0.02, -0.05);                            // carcasse
      add(box(0.028, 0.092, 0.044), ivory, 0, -0.026, 0.036, -0.22);                // plaquettes ivoire
      add(sph(0.006, 8, 6), gold, 0.015, -0.02, 0.035);                              // vis de plaquette
      add(new THREE.TorusGeometry(0.017, 0.0035, 6, 16).rotateY(Math.PI / 2), gold, 0, 0.008, -0.004);
      add(box(0.004, 0.012, 0.006), blk, 0, 0.066, -0.125); add(box(0.014, 0.008, 0.008), blk, 0, 0.064, 0.035);
      muzzle = -0.14;
    } else if (type === 'smg') {
      // mitraillette tactique : boîtier rond, chargeur courbe, garde-main, guidon à tunnel, crosse rétractable
      add(cyl(0.024, 0.024, 0.3, 14).rotateX(Math.PI / 2), blk, 0, 0.03, -0.06);   // boîtier
      add(box(0.04, 0.04, 0.18), blk, 0, 0.02, 0.0);
      add(cyl(0.022, 0.026, 0.13, 12).rotateX(Math.PI / 2), dkm, 0, 0.02, -0.22);  // garde-main
      add(cyl(0.01, 0.01, 0.07, 8).rotateX(Math.PI / 2), blk, 0, 0.03, -0.32);     // canon
      add(new THREE.TorusGeometry(0.014, 0.004, 6, 12), blk, 0, 0.065, -0.24);       // tunnel de guidon
      add(cyl(0.012, 0.012, 0.02, 10).rotateZ(Math.PI / 2), blk, 0, 0.065, 0.06);   // hausse à tambour
      add(cyl(0.006, 0.006, 0.14, 6).rotateX(Math.PI / 2), blk, -0.022, 0.055, -0.17);   // tube d'armement
      add(box(0.028, 0.08, 0.04), blk, 0, -0.035, -0.06, 0.25); add(box(0.027, 0.07, 0.038), blk, 0, -0.095, -0.08, 0.5);   // chargeur courbe
      add(box(0.034, 0.08, 0.042), blk, 0, -0.04, 0.045, -0.3);                      // poignée
      add(new THREE.TorusGeometry(0.018, 0.004, 6, 14).rotateY(Math.PI / 2), blk, 0, -0.005, 0.015);
      for (const sx of [-1, 1]) add(cyl(0.005, 0.005, 0.2, 6).rotateX(Math.PI / 2), steel, sx * 0.02, 0.03, 0.18);   // crosse rétractable
      add(box(0.05, 0.07, 0.02), blk, 0, 0.02, 0.28);
      muzzle = -0.36;
    } else if (type === 'micro') {
      // mitraillette compacte : boîtier carré, chargeur dans la poignée, crosse repliée, poignée avant
      add(box(0.042, 0.06, 0.26), blk, 0, 0.035, -0.03);                             // boîtier
      add(box(0.044, 0.012, 0.2), dkm, 0, 0.068, -0.03);                             // capot à nervures
      for (let k = 0; k < 6; k++) add(box(0.046, 0.004, 0.006), blk, 0, 0.075, -0.1 + k * 0.03);
      add(cyl(0.009, 0.009, 0.06, 8).rotateX(Math.PI / 2), blk, 0, 0.035, -0.19);   // canon
      add(box(0.03, 0.09, 0.042), blk, 0, -0.03, 0.02, -0.12);                        // poignée
      add(box(0.024, 0.09, 0.03), dkm, 0, -0.11, 0.014, -0.12);                       // chargeur long sous la poignée
      add(new THREE.TorusGeometry(0.018, 0.004, 6, 14).rotateY(Math.PI / 2), blk, 0, 0.0, -0.02);
      add(box(0.02, 0.05, 0.025), blk, 0, -0.01, -0.13);                              // poignée avant
      for (const sx of [-1, 1]) add(box(0.004, 0.012, 0.2), steel, sx * 0.024, -0.005, 0.0);   // crosse repliée
      add(box(0.05, 0.03, 0.012), steel, 0, -0.005, -0.1);
      muzzle = -0.22;
    } else if (type === 'carabine') {
      // carabine d'assaut : rail, viseur point rouge, chargeur courbe, garde-main ajouré, cache-flamme, crosse télescopique
      const lens = new THREE.MeshStandardMaterial({ color: 0xff3a2a, emissive: 0x661008, roughness: 0.1, metalness: 0.3 }), tan = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.8 });
      add(box(0.05, 0.065, 0.3), blk, 0, 0.02, -0.04);                             // boîte de culasse
      add(box(0.052, 0.012, 0.42), blk, 0, 0.058, -0.12);                          // rail Picatinny
      for (let k = 0; k < 14; k++) add(box(0.054, 0.006, 0.006), dkm, 0, 0.066, 0.06 - k * 0.028);   // crans du rail
      add(box(0.058, 0.058, 0.24), tan, 0, 0.025, -0.3);                           // garde-main
      for (let k = 0; k < 5; k++) for (const sx of [-1, 1]) add(box(0.004, 0.02, 0.02), dkm, sx * 0.03, 0.022, -0.22 - k * 0.04);   // ajours
      add(cyl(0.011, 0.011, 0.2, 10).rotateX(Math.PI / 2), blk, 0, 0.03, -0.52);  // canon
      add(cyl(0.016, 0.014, 0.05, 8).rotateX(Math.PI / 2), dkm, 0, 0.03, -0.64);  // cache-flamme
      add(box(0.008, 0.03, 0.01), blk, 0, 0.075, -0.4);                            // guidon rabattable
      const m1 = add(box(0.033, 0.075, 0.055), blk, 0, -0.042, -0.06, 0.12); const m2 = add(box(0.033, 0.07, 0.052), blk, 0, -0.1, -0.075, 0.32);   // chargeur courbe
      add(box(0.036, 0.085, 0.045), blk, 0, -0.04, 0.055, -0.35);                  // poignée pistolet
      add(new THREE.TorusGeometry(0.02, 0.004, 6, 14).rotateY(Math.PI / 2), blk, 0, -0.015, 0.02);   // pontet
      add(cyl(0.014, 0.014, 0.2, 10).rotateX(Math.PI / 2), blk, 0, 0.015, 0.2);   // tube de crosse
      add(box(0.042, 0.075, 0.13), tan, 0, -0.005, 0.27);                          // crosse
      add(box(0.044, 0.08, 0.015), blk, 0, -0.005, 0.34);                          // plaque de couche
      add(box(0.04, 0.045, 0.07), blk, 0, 0.09, -0.06);                            // viseur point rouge
      add(cyl(0.017, 0.017, 0.012, 14).rotateX(Math.PI / 2), lens, 0, 0.095, -0.098);
      add(box(0.01, 0.012, 0.03), blk, 0.026, 0.035, 0.03);                         // levier d'armement
      muzzle = -0.67;
    } else {
      // fusil de précision : lunette avec optiques, culasse à verrou, appui-joue, frein de bouche, bipied
      const glass = new THREE.MeshStandardMaterial({ color: 0x5aa0c8, emissive: 0x0a2030, roughness: 0.05, metalness: 0.6 }), od = new THREE.MeshStandardMaterial({ color: 0x3b4030, roughness: 0.8 });
      add(box(0.05, 0.065, 0.36), blk, 0, 0.02, -0.02);                            // boîtier
      add(cyl(0.013, 0.016, 0.72, 10).rotateX(Math.PI / 2), blk, 0, 0.03, -0.56);  // canon lourd
      add(cyl(0.02, 0.02, 0.07, 8).rotateX(Math.PI / 2), dkm, 0, 0.03, -0.95);    // frein de bouche
      for (let k = 0; k < 3; k++) add(box(0.042, 0.006, 0.012), blk, 0, 0.03, -0.93 - k * 0.018);
      add(cyl(0.024, 0.024, 0.28, 16).rotateX(Math.PI / 2), blk, 0, 0.105, -0.04);  // corps de lunette
      add(cyl(0.034, 0.026, 0.07, 16).rotateX(Math.PI / 2), blk, 0, 0.105, -0.21);  // objectif
      add(cyl(0.03, 0.026, 0.05, 16).rotateX(Math.PI / 2), blk, 0, 0.105, 0.12);    // oculaire
      add(cyl(0.031, 0.031, 0.004, 16).rotateX(Math.PI / 2), glass, 0, 0.105, -0.247);
      add(cyl(0.025, 0.025, 0.004, 16).rotateX(Math.PI / 2), glass, 0, 0.105, 0.146);
      add(cyl(0.012, 0.012, 0.03, 10), dkm, 0, 0.135, -0.04); add(cyl(0.012, 0.012, 0.03, 10).rotateZ(Math.PI / 2), dkm, 0.03, 0.105, -0.04);   // tourelles
      for (const z of [-0.12, 0.04]) add(box(0.03, 0.04, 0.02), blk, 0, 0.07, z);  // colliers
      add(cyl(0.007, 0.007, 0.07, 8).rotateZ(Math.PI / 2), steelm, 0.045, 0.03, 0.08); add(sph(0.012, 8, 6), steelm, 0.08, 0.03, 0.08);   // levier de culasse
      add(box(0.045, 0.1, 0.32), od, 0, -0.012, 0.3);                               // crosse
      add(box(0.04, 0.03, 0.12), od, 0, 0.055, 0.28);                               // appui-joue
      add(box(0.036, 0.08, 0.04), od, 0, -0.06, 0.08, -0.35);                       // poignée
      add(box(0.006, 0.2, 0.006), blk, 0.03, -0.1, -0.7, 0.4); add(box(0.006, 0.2, 0.006), blk, -0.03, -0.1, -0.7, 0.4);   // bipied
      add(box(0.04, 0.02, 0.03), blk, 0, -0.01, -0.68);
      muzzle = -0.99;
    }
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: gTex.flash, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); fl.position.set(0, 0.035, muzzle); fl.scale.setScalar(type === 'sniper' ? 0.9 : type === 'carabine' ? 0.7 : 0.55); fl.visible = false; inner.add(fl);
    const G = { lourd: [[0, -0.04, 0.05], [-0.005, -0.05, 0.035]], dore: [[0, -0.035, 0.045], [-0.005, -0.045, 0.03]], smg: [[0, -0.05, 0.04], [0, -0.015, -0.19]], micro: [[0, -0.045, 0.03], [0, -0.05, -0.1]], pistolet: [[0, -0.035, 0.045], [-0.005, -0.045, 0.03]], roquette: [[0, -0.12, 0.05], [0, -0.11, -0.28]], revolver: [[0, -0.035, 0.045], [-0.005, -0.045, 0.03]], magnum: [[0, -0.035, 0.045], [-0.005, -0.045, 0.03]], carabine: [[0, -0.05, 0.065], [0, -0.005, -0.3]], sniper: [[0, -0.05, 0.09], [0, -0.01, -0.28]] }[type];
    if (['revolver', 'magnum', 'pistolet', 'lourd', 'dore', 'micro'].includes(type)) inner.scale.setScalar(1.18);   // arme de poing bien visible
    const k = inner.scale.x; w.userData = { fl, type, gripR: new V3(...G[0]).multiplyScalar(k), gripL: new V3(...G[1]).multiplyScalar(k) };
    return w;
  }

  // ---------- Personnage articulé ----------
  function human(kind, skinI, opt) {
    opt = opt || {};
    const m = mats(kind === 'cmdMil' ? 'mil' : kind, skinI), root = new THREE.Group(), J = {};
    const mesh = (g, mat, parent, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(g, mat); o.position.set(x || 0, y || 0, z || 0); if (sx) o.scale.set(sx, sy, sz); parent.add(o); return o; };
    const grp = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
    const bulk = kind === 'mil' || kind === 'cmdMil' || kind === 'ennemi' || kind === 'bir' ? 1.06 : 1;
    J.hips = grp(root, 0, 0.95, 0);
    // bassin et torse
    mesh(sph(0.16, 18, 12), m.legs, J.hips, 0, -0.01, 0, 1.12 * bulk, 0.55, 0.75);
    mesh(cyl(0.165 * bulk, 0.165 * bulk, 0.05, 20), m.black, J.hips, 0, 0.05, 0, 1.2, 1, 0.78);   // ceinture
    mesh(box(0.06, 0.04, 0.012), m.metal, J.hips, 0, 0.05, -0.13);                                   // boucle
    J.spine = grp(J.hips, 0, 0.02, 0);
    mesh(torsoGeo(bulk), m.top, J.spine, 0, 0, 0);
    if (m.vest && kind !== 'cmdMil') {
      if (kind === 'bir') { mesh(box(0.11, 0.035, 0.012), new THREE.MeshBasicMaterial({ color: 0xbfc4c8 }), J.spine, 0, 0.36, -0.155); }   // plaque « intervention »                                       // gilet tactique avec poches
      const vs = mesh(torsoGeo(bulk), m.vest, J.spine, 0, 0.13, 0, 1.1, 0.68, 1.22);                  // gilet galbé
      for (let i = 0; i < 3; i++) { const pc = mesh(sph(0.045, 10, 8), m.vest, J.spine, (i - 1) * 0.095, 0.24, -0.15, 0.95, 1.2, 0.55); }   // poches à chargeurs
      mesh(cyl(0.012, 0.012, 0.16, 6), m.black, J.spine, 0.1, 0.46, -0.13).rotation.z = 0.9;           // radio
    }
    if (kind === 'ennemi') { mesh(cyl(0.085, 0.1, 0.07, 14), m.red, J.spine, 0, 0.6, 0); for (const s2 of [-1, 1]) mesh(cyl(0.066, 0.066, 0.05, 12), m.red, J.spine, s2 * 0.21, 0.42, 0); }   // foulard et brassards rouges
    mesh(new THREE.TorusGeometry(0.058, 0.016, 6, 18).rotateX(Math.PI / 2), m.top, J.spine, 0, 0.585, 0.004);   // col
    if (kind === 'mil' || kind === 'ennemi') {                               // sac à dos et gourde
      mesh(box(0.3, 0.34, 0.13), m.vest, J.spine, 0, 0.32, 0.18); mesh(cyl(0.05, 0.05, 0.3, 12).rotateZ(Math.PI / 2), m.vest, J.spine, 0, 0.51, 0.18);
      mesh(cyl(0.035, 0.035, 0.12, 10), m.black, J.spine, 0.17, 0.22, 0.12);
    }
    if (kind === 'agent') { mesh(box(0.07, 0.06, 0.02), m.top, J.spine, -0.1, 0.5, -0.12); }
    // cou et tête
    J.neck = grp(J.spine, 0, 0.6, 0);
    const masked = kind === 'bir';
    mesh(cyl(0.044, 0.052, 0.09, 12), masked ? m.mask : m.skin, J.neck, 0, 0.03, 0.005);
    J.head = grp(J.neck, 0, 0.055, 0);
    mesh(headGeo(), masked ? m.mask : m.face, J.head, 0, 0.1, 0);
    for (const s of [-1, 1]) {
      mesh(sph(0.024, 10, 8), masked ? m.mask : m.skin, J.head, s * 0.088, 0.1, 0.008, 0.42, 1, 0.75);         // oreilles
      if (masked) continue;
      mesh(sph(0.0125, 12, 10), m.eyeW, J.head, s * 0.031, 0.106, -0.085, 1.25, 0.72, 0.5);  // yeux
      mesh(sph(0.0062, 10, 8), m.iris, J.head, s * 0.031, 0.106, -0.0903, 1, 1, 0.4);
      const lid = mesh(sph(0.0135, 12, 10), m.skin, J.head, s * 0.031, 0.106, -0.0848, 1.25, 0.06, 0.52); (J.lids = J.lids || []).push(lid);   // paupières (clignement)
      const br = mesh(box(0.028, 0.006, 0.008), m.hair, J.head, s * 0.031, 0.126, -0.091); br.rotation.z = s * -0.12;   // sourcils
    }
    if (masked) {                                                            // cagoule, masque fermé et lunettes balistiques : visage invisible
      mesh(sph(0.075, 16, 12), m.vest, J.head, 0, 0.045, -0.055, 1.05, 0.75, 0.75);                         // masque de protection du bas du visage
      const gg = mesh(box(0.15, 0.04, 0.03), m.helm, J.head, 0, 0.11, -0.085); gg.rotation.x = 0.05;
      for (const s of [-1, 1]) mesh(sph(0.026, 14, 10), m.lens, J.head, s * 0.034, 0.11, -0.1, 1.1, 0.75, 0.45);
      mesh(box(0.2, 0.012, 0.012), m.black, J.head, 0, 0.11, -0.03);                                          // sangle
      const h = mesh(sph(0.124, 22, 12, Math.PI * 0.5), m.helm, J.head, 0, 0.122, 0.008, 1, 0.98, 1.1); h.rotation.x = -0.25;
      mesh(box(0.05, 0.04, 0.03), m.black, J.head, 0, 0.215, -0.085);                                         // support de vision nocturne
      for (const s of [-1, 1]) mesh(box(0.012, 0.03, 0.12), m.black, J.head, s * 0.118, 0.16, 0.0);            // rails
    }
    // coiffes selon l'unité
    if (kind === 'bir') { }
    else if (kind === 'mil') { const h = mesh(sph(0.122, 22, 12, Math.PI * 0.5), m.helm, J.head, 0, 0.12, 0.008, 1, 0.98, 1.1); h.rotation.x = -0.25; mesh(box(0.2, 0.012, 0.014), m.black, J.head, 0, 0.13, -0.1).rotation.x = 0.2; }
    else if (kind === 'cmdMil') { const hc = mesh(sph(0.104, 20, 12, Math.PI * 0.42), m.hair, J.head, 0, 0.115, 0.012, 0.97, 1, 1.08); hc.rotation.x = -0.3; const b = mesh(sph(0.112, 18, 10), m.beret, J.head, 0.025, 0.2, 0.005, 1.02, 0.3, 1.02); b.rotation.z = -0.28; b.rotation.x = -0.1; }
    else if (kind === 'ennemi') { const h = mesh(sph(0.12, 20, 12, Math.PI * 0.5), m.helm, J.head, 0, 0.12, 0.008, 1, 0.95, 1.08); h.rotation.x = -0.25; }
    else if (kind !== 'bir') { const hc = mesh(sph(0.104, 20, 12, Math.PI * 0.42), m.hair, J.head, 0, 0.115, 0.012, 0.97, 1, 1.08); hc.rotation.x = -0.3; }
    if (kind === 'agent') { for (const s of [-1, 1]) mesh(box(0.036, 0.022, 0.006), m.glass, J.head, s * 0.032, 0.107, -0.097); mesh(box(0.085, 0.006, 0.006), m.glass, J.head, 0, 0.112, -0.099); }
    // bras : épaule → coude → poignet → main
    for (const s of [-1, 1]) {
      const sh = grp(J.spine, s * 0.205 * bulk, 0.5, 0); J[s < 0 ? 'shL' : 'shR'] = sh;
      mesh(sph(0.075, 14, 10), m.arm, sh, 0, -0.01, 0, 1.15, 1, 1.05);
      mesh(limb(0.062 * bulk, 0.05, 0.28), m.arm, sh, 0, 0, 0);
      const el = grp(sh, 0, -0.28, 0); J[s < 0 ? 'elL' : 'elR'] = el;
      mesh(limb(0.05, 0.036, 0.25), m.arm, el, 0, 0, 0);
      const wr = grp(el, 0, -0.255, 0); J[s < 0 ? 'hL' : 'hR'] = wr;
      mesh(sph(0.04, 12, 10), m.glove, wr, 0, -0.045, 0, 0.75, 1.0, 0.45);                  // paume
      for (let k = 0; k < 4; k++) { const fg = mesh(limb(0.0085, 0.0072, 0.045), m.glove, wr, (k - 1.5) * 0.0115 * s, -0.078, -0.004); fg.rotation.x = 1.15 + k * 0.05; }   // doigts refermés sur l'arme
      const th = mesh(limb(0.012, 0.01, 0.045), m.glove, wr, s * -0.025, -0.02, -0.018); th.rotation.z = s * 0.6; th.rotation.x = 0.4;   // pouce
    }
    // jambes : hanche → genou → cheville → chaussure
    for (const s of [-1, 1]) {
      const hp = grp(J.hips, s * 0.095, -0.03, 0); J[s < 0 ? 'hipL' : 'hipR'] = hp;
      mesh(limb(0.09 * bulk, 0.064, 0.43), m.legs, hp, 0, 0, 0);
      if (s > 0 && (m.vest || kind === 'cmdMil')) { mesh(box(0.05, 0.16, 0.1), m.black, hp, 0.085, -0.16, 0); mesh(box(0.03, 0.06, 0.04), m.black, hp, 0.085, -0.05, 0.01); }   // holster de cuisse
      if (m.vest || kind === 'cmdMil') mesh(box(0.055, 0.09, 0.06), m.vest || m.top, hp, s * 0.085, -0.22, -0.02);   // poche cargo
      const kn = grp(hp, 0, -0.43, 0); J[s < 0 ? 'knL' : 'knR'] = kn;
      mesh(limb(0.064, 0.05, 0.42), m.legs, kn, 0, 0, 0);
      const an = grp(kn, 0, -0.43, 0); J[s < 0 ? 'anL' : 'anR'] = an;
      mesh(sph(0.06, 12, 10), m.boot, an, 0, -0.035, -0.05, 0.95, 0.7, 2.0);
      mesh(box(0.11, 0.035, 0.27), m.boot, an, 0, -0.07, -0.045);
      if (m.ranger) {                                                        // rangers montantes lacées
        mesh(cyl(0.06, 0.064, 0.21, 14), m.boot, an, 0, 0.065, -0.004);
        mesh(box(0.118, 0.028, 0.29), m.black, an, 0, -0.088, -0.045);                                          // semelle crantée
        for (let k = 0; k < 6; k++) mesh(box(0.05, 0.007, 0.01), m.black, an, 0, 0.0 + k * 0.03, -0.062 - (k < 2 ? 0.02 : 0));   // lacets
        mesh(sph(0.07, 12, 8), m.vest || m.boot, kn, 0, 0.0, -0.035, 1, 1.1, 0.6);                             // genouillère
      }
    }
    root.userData.J = J;
    return root;
  }
  T.human = human; T._pose = (u, dt) => pose(u, dt); T._attach = u => attachWeapon(u); T._W = WEAPONS;
  T._make = (kind, wp, x, z) => makeUnit(kind, 1, wp, x, z, 'net', ''); T._setW = (u, wp) => { u.weapon = wp; attachWeapon(u); };

  // ---------- IK à deux os (épaule → coude → main) ----------
  const vA = new V3(), vT = new V3(), vS = new V3(), vD = new V3(), vE = new V3(), vP = new V3(), DOWN = new V3(0, -1, 0), qA = new THREE.Quaternion(), qB = new THREE.Quaternion();
  const L1 = 0.28, L2 = 0.3;
  function ikArm(J, side, tgt, sgn) {
    const sh = J['sh' + side], el = J['el' + side];
    tgt = vT.copy(tgt);
    vS.copy(sh.position); vD.copy(tgt).sub(vS); let d = vD.length(); d = clamp(d, 0.05, (L1 + L2) * 0.995); vD.normalize();
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    vP.set(sgn * 0.75, -0.6, 0.15); vP.addScaledVector(vD, -vP.dot(vD)).normalize();          // coude vers le bas et l'extérieur
    vE.copy(vS).addScaledVector(vD, a).addScaledVector(vP, h);
    qA.setFromUnitVectors(DOWN, vA.copy(vE).sub(vS).normalize()); sh.quaternion.copy(qA);
    vA.copy(tgt).sub(vE).normalize().applyQuaternion(qB.copy(qA).invert()); el.quaternion.setFromUnitVectors(DOWN, vA);
  }
  // ---------- Animation ----------
  function pose(u, dt) {
    const J = u.o.userData.J, w = WEAPONS[u.weapon], speed = u.spd || 0;
    u.ph = (u.ph || 0) + dt * (speed > 6 ? 12 : speed > 3 ? 9.5 : u.prone ? 4 : 6.5) * Math.min(1, speed / (u.prone ? 0.5 : 1.4) + 0.001);
    const mv = Math.min(1, speed / 1.5), sw = Math.sin(u.ph), run = speed > 3 ? 1 : 0;
    if (u.dead) {
      if (u.fling) { const f = u.fling; f.vy -= 9.81 * dt; u.x += f.vx * dt; u.z += f.vz * dt; u.flyY = (u.flyY || 0) + f.vy * dt; if (u.flyY <= 0) { u.flyY = 0; u.fling = null; } u.o.position.set(u.x, SIM.groundH(u.x, u.z) + u.flyY, u.z); u.y = SIM.groundH(u.x, u.z) + u.flyY; }
      u.fall = Math.min(1, (u.fall || 0) + dt * 2.2);
      u.o.rotation.x = -u.fall * Math.PI / 2 * 0.95; u.o.position.y = u.y + u.fall * 0.15;
      J.hipL.rotation.x = J.hipR.rotation.x = 0.2; J.knL.rotation.x = J.knR.rotation.x = -0.3; J.shL.rotation.z = -0.6; J.shR.rotation.z = 0.6;
      return;
    }
    const cr = u.crouch ? 1 : 0;
    u.crK = (u.crK || 0) + (cr - (u.crK || 0)) * Math.min(1, dt * 8); const ck = u.crK;
    J.hips.position.y = 0.95 - ck * 0.45 - (run ? Math.abs(sw) * 0.03 : 0);
    // jambes : marche / course, ou genou gauche à terre quand il se cache
    const legA = mv * (run ? 0.75 : 0.5), wk = 1 - ck;
    J.hipL.rotation.x = sw * legA * wk - ck * 0.12; J.hipR.rotation.x = -sw * legA * wk + ck * 1.45;
    J.knL.rotation.x = -Math.max(0, -Math.cos(u.ph)) * mv * (run ? 1.3 : 0.8) * wk - ck * 1.62; J.knR.rotation.x = -Math.max(0, Math.cos(u.ph)) * mv * (run ? 1.3 : 0.8) * wk - ck * 1.45;
    J.anL.rotation.x = ck * 0.9; J.anR.rotation.x = ck * 0.05;
    J.spine.rotation.x = run ? 0.18 : ck * 0.15;
    J.hips.rotation.y = sw * 0.12 * mv * wk; J.hips.rotation.z = Math.cos(u.ph) * 0.035 * mv * wk; J.spine.rotation.z = -Math.cos(u.ph) * 0.03 * mv * wk;   // balancement naturel des hanches et des épaules
    if (speed > 6) { J.spine.rotation.x = 0.32; J.hipL.rotation.x = sw * 0.95; J.hipR.rotation.x = -sw * 0.95; J.knL.rotation.x = -Math.max(0, -Math.cos(u.ph)) * 1.6; J.knR.rotation.x = -Math.max(0, Math.cos(u.ph)) * 1.6; }   // sprint
    // saut : jambes repliées en l'air
    if (u.air) { J.hipL.rotation.x = 0.7; J.hipR.rotation.x = 0.35; J.knL.rotation.x = -1.2; J.knR.rotation.x = -0.7; J.spine.rotation.x = 0.15; }
    // à plat ventre : corps allongé face au sol, reptation
    u.prK = (u.prK || 0) + ((u.prone ? 1 : 0) - (u.prK || 0)) * Math.min(1, dt * 6); const pk = u.prK;
    if (pk > 0.01) {
      J.hips.position.y = J.hips.position.y * (1 - pk) + 0.17 * pk; J.hips.rotation.x = -Math.PI / 2 * pk; J.hips.rotation.y *= 1 - pk; J.hips.rotation.z *= 1 - pk;
      const cr = Math.sin(u.ph) * mv;
      J.hipL.rotation.x = J.hipL.rotation.x * (1 - pk) + (0.05 + cr * 0.25) * pk; J.hipR.rotation.x = J.hipR.rotation.x * (1 - pk) + (0.05 - cr * 0.25) * pk;
      J.hipL.rotation.z = -0.15 * pk; J.hipR.rotation.z = 0.15 * pk;
      J.knL.rotation.x *= 1 - pk; J.knR.rotation.x *= 1 - pk; J.anL.rotation.x = 0.6 * pk; J.anR.rotation.x = 0.6 * pk;
      J.spine.rotation.x *= 1 - pk; J.spine.rotation.z = 0;
    } else { J.hipL.rotation.z = 0; J.hipR.rotation.z = 0; }
    // bras selon l'arme et l'état (visée ou marche)
    const ap = u.aimP || 0, aim = u.aimK = (u.aimK || 0) + (((u.aiming || u.firing || !mv) ? 1 : 0.4) - (u.aimK || 0)) * Math.min(1, dt * 6);
    // l'arme est placée contre l'épaule (ou tendue pour un pistolet), puis les mains vont sur l'arme (IK à 2 os)
    if (J.aim && u.wm) {
      const ready = aim, low = w.pistol ? -0.45 : w.rocket ? -0.35 : -0.6;
      J.spine.rotation.y = w.pistol ? 0 : w.rocket ? -0.12 : -0.2;
      if (w.pistol) J.aim.position.set(0.02, 0.47 - (1 - ready) * 0.22, -0.22 - ready * 0.26);
      else if (w.rocket) J.aim.position.set(0.14, 0.56, 0.02);                     // tube posé sur l'épaule
      else J.aim.position.set(0.11, 0.42 - (1 - ready) * 0.06, -0.13 - (w.scope ? 0.02 : 0));
      const pk2 = u.prK || 0; if (pk2 > 0.01) { J.aim.position.y -= 0.1 * pk2; J.aim.position.z -= 0.1 * pk2; }
      J.aim.rotation.set(low * (1 - ready) + ap * ready + Math.PI / 2 * pk2, w.pistol ? 0 : w.rocket ? 0.12 : 0.2, 0, 'YXZ');
      J.aim.updateMatrix(); u.wm.updateMatrix();
      ikArm(J, 'R', vA.copy(u.wm.userData.gripR).applyMatrix4(u.wm.matrix).applyMatrix4(J.aim.matrix), 1);
      ikArm(J, 'L', vA.copy(u.wm.userData.gripL).applyMatrix4(u.wm.matrix).applyMatrix4(J.aim.matrix), -1);
    }
    J.head.rotation.x = -ap * 0.6 - J.spine.rotation.x * 0.6 + (u.prK || 0) * 1.25; J.head.rotation.y = w.pistol ? 0 : 0.2;
    // vie : respiration, regard qui balaie quand il est au repos, clignement des yeux, sursaut quand il est touché
    u.life = (u.life || Math.random() * 100) + dt; const lt = u.life;
    J.spine.rotation.x += Math.sin(lt * 1.7) * 0.018; J.neck.rotation.x = Math.sin(lt * 1.7 + 0.5) * 0.02;
    if (!u.aiming && !u.firing && mv < 0.2) { J.head.rotation.y += Math.sin(lt * 0.37) * 0.45 + Math.sin(lt * 1.3) * 0.05; J.head.rotation.x += Math.sin(lt * 0.23) * 0.08; }
    if (J.lids) { u.blink = (u.blink == null ? 2 + Math.random() * 3 : u.blink) - dt; const cl = u.blink < 0.12 && u.blink > 0 ? 1 : 0; if (u.blink <= 0) u.blink = 2.5 + Math.random() * 3.5; J.lids.forEach(l => l.scale.y = cl ? 0.8 : 0.06); }
    if (u.hitT > 0) { u.hitT -= dt; J.spine.rotation.x -= u.hitT * 1.4; J.head.rotation.x -= u.hitT * 1.0; }
    if (u.recoil > 0 && J.aim) { J.aim.position.z += u.recoil * 0.07; J.aim.rotation.x += u.recoil * 0.2; J.spine.rotation.x -= u.recoil * 0.05; u.recoil = Math.max(0, u.recoil - dt * 7); }
    // éclair de bouche
    if (u.wm) { const f = u.wm.userData.fl; f.visible = u.flashT > 0; if (f.visible) f.material.rotation = Math.random() * 6; }
    if (u.flashT > 0) u.flashT -= dt;
  }

  // ---------- Unités ----------
  function makeUnit(kind, skinI, weapon, x, z, team, cs) {
    const o = human(kind, skinI); scene.add(o);
    const u = { o, kind, team, weapon, x, z, y: SIM.groundH(x, z), psi: 0, hp: 100, dead: false, ammo: WEAPONS[weapon].mag, cd: Math.random(), reloadT: 0, crouch: false, aiming: false, cs, state: 'idle', think: Math.random() * 2 };
    attachWeapon(u); return u;
  }
  function attachWeapon(u) {
    const J = u.o.userData.J; if (u.wm) u.wm.parent.remove(u.wm);
    if (!J.aim) { J.aim = new THREE.Group(); J.spine.add(J.aim); }
    u.wm = weaponModel(u.weapon); J.aim.add(u.wm);
  }

  // ---------- Décor de couverture : caisses, murets, sacs de sable ----------
  function addCover(x, z, r, h, obj) { T.covers.push({ x, z, r, h, obj }); }
  function crate(x, z, s) { const m = new THREE.Mesh(box(1.4 * s, 1.2 * s, 1.4 * s), new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 0.9 })); const y = SIM.groundH(x, z); m.position.set(x, y + 0.6 * s, z); m.rotation.y = Math.random() * 3; scene.add(m); addCover(x, z, 0.9 * s, 1.2 * s, m); return m; }
  function wall(x, z, len, psi) {
    const m = new THREE.Mesh(box(len, 1.25, 0.9), new THREE.MeshStandardMaterial({ color: 0x8a7a55, roughness: 1 })); const y = SIM.groundH(x, z); m.position.set(x, y + 0.6, z); m.rotation.y = -psi; scene.add(m);
    const n = Math.ceil(len / 1.6); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n - 0.5; addCover(x + Math.cos(psi) * t * len, z + Math.sin(psi) * t * len, 0.9, 1.25, i ? null : m); }
    return m;
  }
  function buildArena() {
    if (T.arena) return; T.arena = [];
    const W = SIM.war, st = W.strip; if (!st) return;
    // poste avancé ennemi entre la piste et la base
    const dx = W.zc.x - st.x, dz = W.zc.z - st.z, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d, rx = -uz, rz = ux;
    const at = (a, b) => ({ x: st.x + ux * a + rx * b, z: st.z + uz * a + rz * b });
    T.outpost = at(80, 75); T.camp = at(520, 60); T.patrol = at(-250, 90);
    for (let i = -3; i <= 3; i++) { const p = at(80 + Math.abs(i) * 6, 60 + i * 9); T.arena.push(wall(p.x, p.z, 7, Math.atan2(rz, rx))); }
    for (let i = 0; i < 22; i++) { const p = at(-420 + Math.random() * 1000, 50 + Math.random() * 160); T.arena.push(crate(p.x, p.z, 0.9 + Math.random() * 0.5)); }
    for (let i = 0; i < 8; i++) { const p = at(460 + Math.random() * 160, 60 + (Math.random() - 0.5) * 120); T.arena.push(wall(p.x, p.z, 5 + Math.random() * 4, Math.random() * 3)); }
    for (let i = 0; i < 4; i++) { const p = at(-250 + (i - 1.5) * 9, 75); T.arena.push(wall(p.x, p.z, 5, Math.atan2(rz, rx))); }
    // véhicules et bâtiments de la zone servent aussi de couverture
    [...W.ground, ...W.sams].forEach(g => addCover(g.x, g.z, g.r * 0.5, 2.5, null));
  }

  // ---------- Entrée / sortie ----------
  T.init = function (sc) {
    scene = sc;
    gTex.flash = SIM.glowTex('rgba(255,250,210,1)', 'rgba(255,150,40,0)');
    T.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 });
  };
  T.canExit = () => P.type === 'chasseur' && !P.heli && P.onGround && P.V < 0.8 && !P.crashed && !P.autoTaxi;
  T.exit = function () {
    if (T.active) return;
    if (!T.canExit()) { T.msg('Pour sortir : Rafale posé et arrêté (vitesse nulle).'); return; }
    T.active = true; T.dead = false; T.hp = 100; T.crouch = false; T.aimPitch = 0;
    const c = Math.cos(P.psi), s = Math.sin(P.psi);
    const kind = T.unit === 'mil' ? 'cmdMil' : T.unit;
    if (!ALLOW[T.unit].includes(T.weapon)) T.weapon = 'carabine';
    const kS = (SIM.war.SIZES[SIM.war.size] || { k: 1 }).k, fx = Math.sin(P.psi), fz = -Math.cos(P.psi), ex = P.x + fx * (13 * kS) + c * 3, ez = P.z + fz * (13 * kS) + s * 3;   // sortie devant le nez de l'appareil
    T.me = makeUnit(kind, 0, T.weapon, ex, ez, 'blue', 'Commandant');
    T.me.psi = P.psi; T.me.isMe = true; T.me.isCmd = true; T.cmd = T.me; T.me.hp = 100;
    // escouade : chacun sort de l'avion puis rejoint sa place
    const wpn = { mil: ['carabine', 'roquette', 'sniper', 'smg', 'pistolet', 'carabine', 'roquette', 'lourd'], bir: ['smg', 'carabine', 'roquette', 'lourd', 'carabine', 'micro', 'roquette', 'sniper'], agent: ['dore', 'smg', 'magnum', 'carabine', 'lourd', 'revolver', 'micro', 'pistolet'], veste: ['revolver', 'micro', 'lourd', 'dore', 'pistolet', 'magnum', 'smg', 'revolver'] }[T.unit];
    for (let i = 0; i < T.squadN; i++) { const u = makeUnit(T.unit, (i * 3 + 1) % 6, wpn[i % wpn.length], P.x + c * 2.5, P.z + s * 2.5, 'blue', ({ mil: 'Soldat ', bir: 'Opérateur ', agent: 'Agent ', veste: 'Homme ' }[T.unit]) + (i + 1)); u.x = ex - c * 2 + fx * (i % 3) * 1.5; u.z = ez - s * 2 + fz * (i % 3) * 1.5; u.hp = 160; u.slot = i; u.psi = P.psi; u.delay = i * 0.5; T.squad.push(u); }
    // ennemis au sol autour du poste avancé et du camp
    if (Math.hypot(P.x - SIM.war.zc.x, P.z - SIM.war.zc.z) < 20000) SIM.war.ensureZone();
    if (SIM.war.loaded && SIM.war.strip && Math.hypot(P.x - SIM.war.strip.x, P.z - SIM.war.strip.z) < 4000) spawnFoes();
    else spawnLocal();
    T.camYaw = P.psi; SIM.view.orb.pitch = 0.15; SIM.view.orb.zoom = 1;
    SIM.view.setView('chase'); document.body.classList.add('foot'); T.renderList();
    T.msg(`${UNITS[T.unit].cmdName} au sol avec ${T.squadN} hommes. Z/↑ avancer · Maj courir · Espace tirer · C se cacher · 1-6 armes · T prendre un autre soldat · G revenir au chef · Y changer l'arme d'un coéquipier · E remonter.`, 7000);
    SIM.radio('VOUS', `Commandant à toutes les unités : sortie de l'appareil, escouade de ${T.squadN} au sol.`, false, `Commander to all units: leaving the aircraft, squad of ${T.squadN} on the ground.`);
  };
  T.enter = function (force) {
    if (!T.active) return;
    if (!force && !T.dead && Math.hypot(T.cmd.x - P.x, T.cmd.z - P.z) > 18) { T.msg('Rapprochez-vous du Rafale (moins de 18 m) pour remonter.'); return; }
    [T.me, ...T.squad].forEach(u => scene.remove(u.o)); T.squad = []; T.me = null; T.cmd = null; T.active = false; document.body.classList.remove('foot');
    T.rockets.forEach(r => scene.remove(r.o)); T.rockets = []; T.renderList();
    T.fx.forEach(f => scene.remove(f.o)); T.fx = [];
    SIM.view.setView('chase'); T.msg('De retour dans le Rafale.');
  };
  function spawnFoes() {
    buildArena(); if (T.foes.some(f => !f.dead)) return;
    T.foes.forEach(f => scene.remove(f.o)); T.foes = [];
    const pts = [[T.patrol, 4, 15], [T.outpost, 8, 30], [T.camp, 9, 60]];
    pts.forEach(([c, n, r]) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, rr = Math.random() * r; const u = makeUnit('ennemi', i % 6, i % 5 === 4 ? 'sniper' : i % 3 === 2 ? 'revolver' : 'carabine', c.x + Math.cos(a) * rr, c.z + Math.sin(a) * rr, 'red', 'Ennemi'); u.hp = 70; u.home = { x: u.x, z: u.z }; u.psi = Math.random() * 6; T.foes.push(u); } });
    // marqueur rouge au-dessus de chaque ennemi
    T.foes.forEach(f => { f.mk = new THREE.Sprite(new THREE.SpriteMaterial({ map: SIM.war.diaTex(), transparent: true, depthTest: false, sizeAttenuation: false })); f.mk.scale.setScalar(0.014); f.mk.renderOrder = 997; scene.add(f.mk); });
  }
  // adversaires partout : où que vous sortiez, une section ennemie s'installe à 160-260 m avec des abris
  function spawnLocal() {
    if (T.foes.some(f => !f.dead && Math.hypot(f.x - P.x, f.z - P.z) < 1500)) return;
    T.foes.forEach(f => { scene.remove(f.o); if (f.mk) scene.remove(f.mk); }); T.foes = [];
    const a0 = P.psi + (Math.random() - 0.5) * 1.2, R = 160 + Math.random() * 100, cx = P.x + Math.sin(a0) * R, cz = P.z - Math.cos(a0) * R;
    T.localArena = T.localArena || [];
    for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28, r = 10 + Math.random() * 45; T.localArena.push(crate(cx + Math.cos(a) * r, cz + Math.sin(a) * r, 1 + Math.random() * 0.4)); }
    for (let i = 0; i < 4; i++) { const a = a0 + Math.PI + (i - 1.5) * 0.35; T.localArena.push(wall(cx + Math.sin(a) * 22, cz - Math.cos(a) * 22, 6, a + Math.PI / 2)); }
    for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28, r = 60 + Math.random() * 60; T.localArena.push(crate(P.x + Math.sin(a0) * r + Math.cos(a) * 25, P.z - Math.cos(a0) * r + Math.sin(a) * 25, 1.1)); }   // abris sur le chemin
    for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28, rr = Math.random() * 30; const u = makeUnit('ennemi', i % 6, i % 5 === 4 ? 'sniper' : i % 3 === 2 ? 'revolver' : 'carabine', cx + Math.cos(a) * rr, cz + Math.sin(a) * rr, 'red', 'Ennemi'); u.hp = 70; u.home = { x: u.x, z: u.z }; u.psi = a0 + Math.PI; T.foes.push(u); }
    T.foes.forEach(f => { f.mk = new THREE.Sprite(new THREE.SpriteMaterial({ map: SIM.war.diaTex(), transparent: true, depthTest: false, sizeAttenuation: false })); f.mk.scale.setScalar(0.016); f.mk.renderOrder = 997; scene.add(f.mk); });
    T.msg('Contact ! Section ennemie à ' + Math.round(R) + ' m devant vous (losanges rouges).', 4000);
  }
  T.respawnFoes = function () { T.foes.forEach(f => { scene.remove(f.o); if (f.mk) scene.remove(f.mk); }); T.foes = []; if (T.active) { if (SIM.war.strip && Math.hypot(T.me.x - SIM.war.strip.x, T.me.z - SIM.war.strip.z) < 4000) spawnFoes(); else spawnLocal(); } };

  // ---------- Tir ----------
  const ray = new V3(), tmpA = new V3(), tmpB = new V3();
  function blocked(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz; if (L2 < 1) return false;
    for (const c of T.covers) {
      let t = ((c.x - ax) * dx + (c.z - az) * dz) / L2; if (t <= 0.02 || t >= 0.98) continue;
      const px = ax + dx * t, pz = az + dz * t; if ((px - c.x) ** 2 + (pz - c.z) ** 2 > c.r * c.r) continue;
      const y = ay + (by - ay) * t, gy = SIM.groundH(c.x, c.z); if (y < gy + c.h) return true;
    }
    return false;
  }
  function nearCover(u) { return T.covers.some(c => Math.hypot(c.x - u.x, c.z - u.z) < c.r + 1.6); }
  function tracer(a, b) {
    const g = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]); const l = new THREE.Line(g, T.tracerMat.clone()); scene.add(l); T.fx.push({ o: l, t: 0.07 });
  }
  function gunSound(w, dist) {
    const A = SIM.view.audio; if (!A) return; const c = A.ctx, t = c.currentTime, len = c.sampleRate * 0.25;
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, w === 'sniper' || w === 'magnum' ? 3 : 5);
    const n = c.createBufferSource(); n.buffer = buf; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = w === 'sniper' ? 1500 : w === 'magnum' ? 1800 : 2600;
    const g = c.createGain(); g.gain.value = clamp(0.9 / (1 + (dist || 0) / 60), 0.03, 0.9) * (w === 'sniper' || w === 'magnum' ? 1.3 : 1); n.connect(f); f.connect(g); g.connect(c.destination); n.start(t);
  }
  function muzzlePos(u) { const f = u.wm.userData.fl; f.updateMatrixWorld(true); return new V3().setFromMatrixPosition(f.matrixWorld); }
  function damage(u, dmg, by) {
    if (u.dead) return; u.hp -= dmg; u.hitT = 0.3;
    if (u.team === 'red' && u.weak) u.hp -= dmg * 0.6;
    if (u.isMe) { T.hp = u.hp; T.hurtT = 0.4; if (u.hp <= 0) { if (u.isCmd) { u.dead = true; T.dead = true; T.deadT = 5; T.msg('Vous êtes touché ! Retour au Rafale dans 5 secondes…'); } else { u.dead = true; T.msg(u.cs + ' est tombé — vous reprenez votre chef.', 2500); T.switchT = 1.5; } T.renderList(); } return; }
    if (u.hp <= 0) { u.dead = true; u.deadT = 40; if (u.mk) scene.remove(u.mk); if (u.team === 'red') { T.kills++; if (by === T.me) T.msg('✔ Ennemi neutralisé (' + T.kills + ')'); } else { T.msg(u.cs + ' est tombé !'); T.renderList(); } }
  }
  // tir du joueur : du centre de l'écran (réticule) vers l'avant
  function playerShoot() {
    const u = T.me, w = WEAPONS[u.weapon];
    if (u.reloadT > 0 || u.cd > 0 || u.dead) return;
    if (u.ammo <= 0) { reload(u); return; }
    u.cd = w.rate; u.ammo--; u.flashT = 0.06; u.firing = 0.4; u.recoil = w.rocket ? 0.9 : w.scope ? 1 : w.pistol ? 0.8 : 0.45; ejectShell(u);
    const cam = SIM.view.cam; cam.getWorldDirection(ray);
    if (T.lock && !T.lock.dead) { ray.set(T.lock.x - cam.position.x, T.lock.y + (w.rocket ? 0.6 : T.lock.crouch ? 0.75 : 1.25) - cam.position.y, T.lock.z - cam.position.z).normalize(); }   // cadrage : tir droit sur la cible
    if (w.rocket) { ray.x += (Math.random() - 0.5) * w.spread; ray.y += (Math.random() - 0.5) * w.spread + 0.012; ray.normalize(); launchRocket(u, ray); if (u.ammo <= 0) reload(u); return; }
    const sp = w.spread * (T.lock ? 0.3 : T.aiming ? 0.35 : 1) * (T.crouch ? 0.7 : 1) * (u.spd > 3 ? 2.5 : 1);
    ray.x += (Math.random() - 0.5) * sp * 2; ray.y += (Math.random() - 0.5) * sp * 2; ray.z += (Math.random() - 0.5) * sp * 2; ray.normalize();
    const o = cam.position;
    let best = null, bt = w.range;
    for (const f of T.foes) {
      if (f.dead) continue;
      for (const [hy, rad, head] of [[f.crouch ? 0.6 : 1.0, 0.3, false], [f.crouch ? 1.05 : 1.62, 0.13, true]]) {
        tmpA.set(f.x - o.x, f.y + hy - o.y, f.z - o.z); const t = tmpA.dot(ray); if (t < 0 || t > bt) continue;
        const dd = tmpA.addScaledVector(ray, -t).length(); if (dd < rad) { best = { f, head, t }; bt = t; }
      }
    }
    const end = o.clone().addScaledVector(ray, best ? best.t : Math.min(w.range, 400));
    { const mp = muzzlePos(u); if (best && blocked(mp.x, mp.y, mp.z, end.x, end.y, end.z)) best = null; }
    tracer(muzzlePos(u), end); gunSound(u.weapon, 0);
    if (best) { damage(best.f, w.dmg * 1.4 * (best.head ? 2.2 : 1), u); best.f.alert = 1; hitMark(best.f.dead); SIM.boom.puff(end.x, end.y, end.z, 0.6, 0.4, 'dust'); if (best.head) T.msg('Tir à la tête !', 900); }
    else { SIM.boom.puff(end.x, Math.max(end.y, SIM.groundH(end.x, end.z) + 0.1), end.z, 0.8, 0.6, 'dust'); alertNear(end, 60); }
    if (u.ammo <= 0) reload(u);
  }
  function hitMark(kill) { const h = document.getElementById('hitm'); if (!h) return; h.className = kill ? 'kill' : 'hit'; void h.offsetWidth; h.classList.add('on'); clearTimeout(T.hmT); T.hmT = setTimeout(() => h.classList.remove('on'), kill ? 450 : 180); }
  function reload(u) { if (u.reloadT > 0 || u.ammo === WEAPONS[u.weapon].mag) return; u.reloadT = WEAPONS[u.weapon].reload; if (u.isMe) T.msg('Rechargement…', 1000); }
  function alertNear(p, r) { T.foes.forEach(f => { if (!f.dead && Math.hypot(f.x - p.x, f.z - p.z) < r) f.alert = 1; }); }
  // tir des IA (escouade et ennemis) avec probabilité de toucher
  function aiShoot(u, tg, d) {
    const w = WEAPONS[u.weapon];
    if (w.rocket) {
      if (d < 40 || d > 450) { u.cd = 1; return; }
      u.cd = 13 + Math.random() * 6; u.ammo--; u.firing = 1;
      const a = muzzlePos(u), tof = d / 135, dir = new V3(tg.x - a.x + (Math.random() - 0.5) * d * 0.03, tg.y + 0.8 - a.y + 9.81 * 0.35 * tof * tof / 2, tg.z - a.z + (Math.random() - 0.5) * d * 0.03).normalize();
      launchRocket(u, dir); if (u.ammo <= 0) reload(u); return;
    } u.cd = w.rate * (w.auto ? 3 : 1.6) + Math.random() * 0.8; u.ammo--; u.flashT = 0.06; u.firing = 0.6; u.recoil = w.pistol ? 0.7 : 0.4; if (Math.hypot(u.x - (T.me ? T.me.x : 0), u.z - (T.me ? T.me.z : 0)) < 60) ejectShell(u);
    const a = muzzlePos(u), b = new V3(tg.x, tg.y + (tg.crouch ? 0.7 : 1.3), tg.z);
    let p = clamp(0.62 - d / (w.scope ? 900 : w.pistol ? 70 : 260), 0.05, 0.6);
    if (tg.crouch) p *= 0.45; if (tg.prone) p *= 0.3; if (tg.air) p *= 0.6; if (nearCover(tg)) p *= 0.35; if (u.team === 'red') p *= (tg.isMe ? 0.6 : 0.7) * (u.weak ? 0.55 : 1); else p = Math.min(0.75, p * 1.5);
    const hit = Math.random() < p;
    if (!hit) { b.x += (Math.random() - 0.5) * 3; b.y += Math.random() * 1.5; b.z += (Math.random() - 0.5) * 3; }
    tracer(a, b); gunSound(u.weapon, Math.hypot(u.x - (T.me ? T.me.x : 0), u.z - (T.me ? T.me.z : 0)));
    if (hit) damage(tg, w.dmg * (u.team === 'red' ? 0.38 : 1.0), u);
    if (u.ammo <= 0) reload(u);
  }

  // ---------- Roquettes ----------
  T.rockets = [];
  function launchRocket(u, dir) {
    const p = muzzlePos(u), g = new THREE.Group();
    const body = new THREE.Mesh(cyl(0.04, 0.04, 0.5, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5f6649, roughness: 0.6 })); g.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 12).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4b5038 })); nose.position.z = -0.33; g.add(nose);
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: gTex.flash, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); fl.position.z = 0.35; fl.scale.setScalar(0.9); g.add(fl);
    g.position.copy(p); scene.add(g);
    T.rockets.push({ o: g, x: p.x, y: p.y, z: p.z, v: dir.clone().multiplyScalar(135), owner: u, team: u.team, t: 0, pt: 0 });
    SIM.boom.puff(p.x, p.y, p.z, 3, 1.2, 'smoke');
    const back = p.clone().addScaledVector(dir, -2.6); SIM.boom.puff(back.x, back.y, back.z, 2.2, 0.8, 'smoke');   // souffle arrière
    gunSound('magnum', Math.hypot(u.x - (T.me ? T.me.x : 0), u.z - (T.me ? T.me.z : 0)));
  }
  function stepRockets(dt) {
    T.rockets = T.rockets.filter(r => {
      r.t += dt; r.v.y -= 9.81 * 0.35 * dt;
      const nx = r.x + r.v.x * dt, ny = r.y + r.v.y * dt, nz = r.z + r.v.z * dt;
      let boom = r.t > 6 || ny < SIM.groundH(nx, nz) + 0.2;
      if (!boom && r.t > 0.18) for (const c of T.covers) { if ((nx - c.x) ** 2 + (nz - c.z) ** 2 < c.r * c.r && ny < SIM.groundH(c.x, c.z) + c.h) { boom = true; break; } }
      if (!boom) for (const u of r.team === 'blue' ? T.foes : [T.me, ...T.squad]) { if (u && !u.dead && Math.abs(nx - u.x) < 0.7 && Math.abs(nz - u.z) < 0.7 && ny > u.y && ny < u.y + 1.9) { boom = true; break; } }
      if (!boom && r.team === 'blue') for (const g of [...SIM.war.ground, ...SIM.war.sams]) { if (g.alive && Math.hypot(nx - g.x, nz - g.z) < g.r * 0.45 && ny < g.y + 6) { boom = true; break; } }
      r.x = nx; r.y = ny; r.z = nz; r.o.position.set(nx, ny, nz); r.o.lookAt(nx + r.v.x, ny + r.v.y, nz + r.v.z); r.o.rotateY(Math.PI);
      r.pt -= dt; if (r.pt <= 0) { r.pt = 0.07; SIM.boom.puff(nx, ny, nz, 1.4, 0.9, 'smoke'); }
      if (boom) { rocketBlast(r); scene.remove(r.o); return false; }
      return true;
    });
  }
  function rocketBlast(r) {
    SIM.boom.real(r.x, Math.max(r.y, SIM.groundH(r.x, r.z)) + 0.2, r.z, 1, SIM.view.cam);
    const by = r.owner;
    for (const u of r.team === 'blue' ? T.foes : [T.me, ...T.squad]) { if (!u || u.dead) continue; const d = Math.hypot(u.x - r.x, u.y + 1 - r.y, u.z - r.z); if (d < 8) { damage(u, WEAPONS.roquette.dmg * (1 - d / 8) * (r.team === 'red' ? 0.4 : 1), by); if (u.dead && !u.isMe) { const dx = u.x - r.x, dz = u.z - r.z, l = Math.hypot(dx, dz) || 1, k = (1 - d / 8) * 14; u.fling = { vx: dx / l * k, vy: 4 + k * 0.6, vz: dz / l * k }; } } }
    if (r.team === 'blue' && SIM.war.blastAt) SIM.war.blastAt(r.x, r.y, r.z, by && by.isMe ? 'player' : 'wing');
    alertNear(r, 120);
  }

  // ---------- Douilles éjectées ----------
  T.shells = [];
  function ejectShell(u) {
    const w = WEAPONS[u.weapon]; if (!u.wm || u.weapon === 'revolver' || u.weapon === 'magnum' || w.rocket) return;
    if (!gTex.brass) { gTex.brass = new THREE.MeshStandardMaterial({ color: 0xc9a043, roughness: 0.3, metalness: 0.8 }); gTex.shellG = new THREE.CylinderGeometry(0.0045, 0.0045, 0.03, 6); }
    const o = new THREE.Mesh(gTex.shellG, gTex.brass); u.wm.updateMatrixWorld(true);
    const p = new V3(0.03, 0.04, 0).applyMatrix4(u.wm.matrixWorld), r = new V3(1, 0.7, 0.3).transformDirection(u.wm.matrixWorld);
    o.position.copy(p); scene.add(o);
    T.shells.push({ o, v: r.multiplyScalar(2.5 + Math.random()), w: 20 + Math.random() * 20, t: 1.6 });
    while (T.shells.length > 90) scene.remove(T.shells.shift().o);
  }
  function stepShells(dt) {
    T.shells = T.shells.filter(s => {
      s.t -= dt; if (s.t <= 0) { scene.remove(s.o); return false; }
      if (!s.rest) {
        s.v.y -= 9.81 * dt; s.o.position.addScaledVector(s.v, dt); s.o.rotation.x += s.w * dt; s.o.rotation.z += s.w * 0.6 * dt;
        const g = SIM.groundH(s.o.position.x, s.o.position.z);
        if (s.o.position.y < g + 0.01) { s.o.position.y = g + 0.01; s.v.multiplyScalar(0.3); s.v.y = Math.abs(s.v.y); if (s.v.length() < 0.3) s.rest = true; }
      }
      return true;
    });
  }
  // ---------- Cadrage (verrouillage automatique d'un ennemi) ----------
  T.lock = null;
  function bestLockTarget(exclude) {
    const cam = SIM.view.cam, fw = new V3(); cam.getWorldDirection(fw); let best = null, bs = 1e9;
    for (const f of T.foes) {
      if (f.dead || f === exclude) continue; const d = Math.hypot(f.x - T.me.x, f.z - T.me.z); if (d > 260) continue;
      if (blocked(T.me.x, T.me.y + 1.5, T.me.z, f.x, f.y + 1.2, f.z)) continue;
      const v = new V3(f.x - cam.position.x, f.y + 1.2 - cam.position.y, f.z - cam.position.z).normalize(), ang = Math.acos(clamp(v.dot(fw), -1, 1));
      const sc = ang * 3 + d / 120; if (sc < bs) { bs = sc; best = f; }
    }
    return best;
  }
  T.toggleLock = function () {
    if (!T.active) return;
    if (T.lock) { T.lock = null; T.msg('Cadrage désactivé.', 1000); return; }
    T.lock = bestLockTarget();
    if (T.lock) { T.aiming = true; T.msg('Cible cadrée à ' + Math.round(Math.hypot(T.lock.x - T.me.x, T.lock.z - T.me.z)) + ' m. Espace pour tirer · L pour libérer · Tab : cible suivante.', 2200); }
    else T.msg('Aucun ennemi visible à moins de 260 m.', 1500);
  };
  T.nextLock = function () { if (!T.active) return; const n = bestLockTarget(T.lock); if (n) T.lock = n; };
  function updateLock(dt) {
    const el = document.getElementById('lockBox');
    if (T.lock && (T.lock.dead || Math.hypot(T.lock.x - T.me.x, T.lock.z - T.me.z) > 300)) { const nx = T.lock.dead ? bestLockTarget(T.lock) : null; T.lock = nx; if (nx) T.msg('Cible suivante cadrée.', 900); }
    if (!T.lock) { if (el) el.hidden = true; return; }
    const f = T.lock, me = T.me, want = Math.atan2(f.x - me.x, -(f.z - me.z)), d = Math.hypot(f.x - me.x, f.z - me.z);
    me.psi += SIM.wrap((want - me.psi) * R2D) * D2R * Math.min(1, dt * 12);
    if (T.camMode === 'orbite') T.camYaw += SIM.wrap((want - T.camYaw) * R2D) * D2R * Math.min(1, dt * 6);
    T.aimPitch = Math.atan2(f.y + 1.2 - (me.y + 1.5), d);
    if (el) {
      const cam = SIM.view.cam; cam.updateMatrixWorld();
      const v = new V3(f.x, f.y + (f.crouch ? 0.75 : 1.05), f.z).applyMatrix4(cam.matrixWorldInverse);
      if (v.z > -0.5) { el.hidden = true; return; }
      v.applyMatrix4(cam.projectionMatrix);
      const sz = clamp(1400 / Math.max(d, 4), 26, 160);
      el.hidden = false; el.style.width = (sz * 0.7) + 'px'; el.style.height = sz + 'px';
      el.style.transform = `translate(${((v.x + 1) / 2 * innerWidth).toFixed(0)}px,${((1 - v.y) / 2 * innerHeight).toFixed(0)}px) translate(-50%,-50%)`;
      el.querySelector('i').style.width = clamp(f.hp, 0, 100) + '%'; el.querySelector('b').textContent = Math.round(d) + ' m';
    }
  }
  // ---------- Vagues d'ennemis qui montent au front (faibles, faciles à abattre) ----------
  T.waveT = 20;
  function spawnWave() {
    const me = T.me, alive = T.foes.filter(f => !f.dead).length; if (alive > 22) return;
    const base = (T.camMode === 'orbite' ? T.camYaw : me.psi) + (Math.random() - 0.5) * 1.4, R = 240 + Math.random() * 80;
    const cx = me.x + Math.sin(base) * R, cz = me.z - Math.cos(base) * R; if (SIM.isSea(cx, cz)) return;
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const u = makeUnit('ennemi', (i + 2) % 6, i % 3 === 2 ? 'revolver' : 'carabine', cx + (i - n / 2) * 5, cz + (Math.random() - 0.5) * 8, 'red', 'Assaillant');
      u.hp = 45; u.weak = true; u.assault = true; u.alert = 1; u.home = { x: me.x, z: me.z }; u.psi = base + Math.PI;
      u.mk = new THREE.Sprite(new THREE.SpriteMaterial({ map: SIM.war.diaTex(), transparent: true, depthTest: false, sizeAttenuation: false })); u.mk.scale.setScalar(0.016); u.mk.renderOrder = 997; scene.add(u.mk);
      T.foes.push(u);
    }
    T.msg(`⚠ ${n} soldats ennemis montent au front à ${Math.round(R)} m ! Ils sont faibles : L pour les cadrer, Espace pour tirer.`, 4500);
    SIM.radio('ÉCLAIREUR', `Contact ! ${n} ennemis à pied à ${Math.round(R)} mètres, ils avancent vers nous.`, false, `Contact! ${n} enemy infantry at ${Math.round(R)} metres, advancing.`);
  }
  T.spawnWave = () => spawnWave();

  // ---------- Déplacements ----------
  function moveTo(u, tx, tz, spd, dt) {
    const dx = tx - u.x, dz = tz - u.z, d = Math.hypot(dx, dz);
    if (d < 0.6) { u.spd = 0; return true; }
    const want = Math.atan2(dx, -dz); u.psi += SIM.wrap((want - u.psi) * R2D) * D2R * Math.min(1, dt * 6);
    const v = Math.min(spd, d * 2); u.x += Math.sin(u.psi) * v * dt; u.z -= Math.cos(u.psi) * v * dt; u.spd = v; return false;
  }
  function collide(u) {
    for (const c of T.covers) { const dx = u.x - c.x, dz = u.z - c.z, d = Math.hypot(dx, dz), m = c.r + 0.35; if (d < m && d > 0.01) { u.x = c.x + dx / d * m; u.z = c.z + dz / d * m; } }
  }
  function coverSpot(u, enemy) {
    // couverture la plus proche, côté opposé à l'ennemi
    let best = null, bd = 30;
    for (const c of T.covers) { const d = Math.hypot(c.x - u.x, c.z - u.z); if (d < bd) { bd = d; best = c; } }
    if (!best) return null;
    const ex = best.x - enemy.x, ez = best.z - enemy.z, el = Math.hypot(ex, ez) || 1;
    return { x: best.x + ex / el * (best.r + 0.8), z: best.z + ez / el * (best.r + 0.8) };
  }
  function nearestVisible(u, list, range) {
    let best = null, bd = range;
    for (const t of list) { if (t.dead) continue; const d = Math.hypot(t.x - u.x, t.z - u.z); if (d < bd && !blocked(u.x, u.y + 1.5, u.z, t.x, t.y + 1.2, t.z)) { bd = d; best = t; } }
    return best ? { t: best, d: bd } : null;
  }

  // ---------- Boucle ----------
  T.update = function (dt, t) {
    // effets
    T.fx = T.fx.filter(f => { f.t -= dt; f.o.material.opacity = Math.max(0, f.t / 0.07); if (f.t <= 0) { scene.remove(f.o); f.o.geometry.dispose(); return false; } return true; });
    stepRockets(dt); stepShells(dt);
    if (!T.active) { const lb = document.getElementById('lockBox'); if (lb) lb.hidden = true; T.lock = null; T.foes.forEach(f => { if (f.mk) f.mk.visible = false; }); return; }
    if (T.switchT > 0) { T.switchT -= dt; if (T.switchT <= 0) T.takeCmd(); }
    T.waveT -= dt; if (T.waveT <= 0) { T.waveT = 35 + Math.random() * 20; spawnWave(); }
    if (!T.foes.length && SIM.war.loaded && SIM.war.strip && Math.hypot(T.me.x - SIM.war.strip.x, T.me.z - SIM.war.strip.z) < 4000) spawnFoes();
    const me = T.me, K = T.keys;
    // joueur
    if (me.dead && !T.dead) { pose(me, dt); }
    else if (T.dead) { T.deadT -= dt; pose(me, dt); if (T.deadT <= 0) { const c = Math.cos(P.psi), s = Math.sin(P.psi); me.dead = false; me.fall = 0; me.o.rotation.x = 0; me.hp = T.hp = 100; T.dead = false; me.x = P.x + Math.sin(P.psi) * 14 + c * 3; me.z = P.z - Math.cos(P.psi) * 14 + s * 3; T.msg('De retour près du Rafale.'); } }
    else {
      const run = (K.shift || T.sprint) && !T.crouch && !me.prone, sp = me.prone ? 0.8 : T.crouch ? 1.2 : run ? 8.2 : 2.6;   // Maj = sprint très rapide
      const orbit = T.camMode === 'orbite', turn = ((K.arrowright ? 1 : 0) - (K.arrowleft ? 1 : 0)) * 2.0;
      const fw = (K.z || K.w || K.arrowup ? 1 : 0) - (K.s || K.arrowdown ? 1 : 0), st = (K.d || K.e ? 1 : 0) - (K.q || K.a ? 1 : 0);
      if (orbit) {
        // caméra libre : on tourne autour du personnage ; Z avance dans la direction regardée, le personnage se tourne vers sa marche
        if (SIM.view.orb.yaw) { T.camYaw -= SIM.view.orb.yaw; SIM.view.orb.yaw = 0; }
        T.camYaw += turn * dt;
        T.aimPitch = clamp(-(SIM.view.orb.pitch - 0.15) * 0.9, -0.8, 0.9);
        const cy = T.camYaw, n = Math.hypot(fw, st) || 1, mx = (Math.sin(cy) * fw + Math.cos(cy) * st) / n, mz = (-Math.cos(cy) * fw + Math.sin(cy) * st) / n;
        const engaged = T.aiming || T.fireHeld || (me.firing > 0);
        if (fw || st) { me.x += mx * sp * dt; me.z += mz * sp * dt; me.spd = sp; if (!engaged) me.psi += SIM.wrap((Math.atan2(mx, -mz) - me.psi) * R2D) * D2R * Math.min(1, dt * 9); } else me.spd = 0;
        if (engaged) me.psi += SIM.wrap((cy - me.psi) * R2D) * D2R * Math.min(1, dt * 14);
      } else {
        if (SIM.view.orb.yaw) { me.psi -= SIM.view.orb.yaw; SIM.view.orb.yaw = 0; }
        T.aimPitch = clamp(-SIM.view.orb.pitch * 0.9, -0.8, 0.9);
        me.psi += turn * dt;
        const c = Math.cos(me.psi), s = Math.sin(me.psi), n = Math.hypot(fw, st) || 1;
        const vx = (Math.sin(me.psi) * fw + c * st) / n * sp, vz = (-Math.cos(me.psi) * fw + s * st) / n * sp;
        if (fw || st) { me.x += vx * dt; me.z += vz * dt; me.spd = sp; } else me.spd = 0;
      }
      // plongeon et saut : élan vers l'avant, gravité, réception
      if (me.diveT > 0) { me.diveT -= dt; me.x += Math.sin(me.psi) * me.diveV * dt; me.z -= Math.cos(me.psi) * me.diveV * dt; me.diveV *= Math.max(0, 1 - dt * 2.5); }
      if (me.air) { me.vy -= 9.81 * dt; me.jy += me.vy * dt; if (me.jy <= 0) { me.jy = 0; me.air = false; me.vy = 0; if (me.diving) { me.diving = false; me.prone = true; T.crouch = false; SIM.boom.puff(me.x, me.y + 0.2, me.z, 1.5, 0.8, 'dust'); } } }
      if (T.crouch && me.prone) T.crouch = false;
      collide(me); me.crouch = T.crouch; me.aiming = T.aiming; me.aimP = T.aimPitch;
      me.cd -= dt; if (me.reloadT > 0) { me.reloadT -= dt; if (me.reloadT <= 0) me.ammo = WEAPONS[me.weapon].mag; }
      if (me.firing > 0) me.firing -= dt;
      if (T.fireHeld && (WEAPONS[me.weapon].auto || !T.fired)) { playerShoot(); T.fired = true; }
      if (me.hitT > 0) me.hitT -= dt;
      if (!T.hurtT || T.hurtT <= 0) T.hp = me.hp = Math.min(100, me.hp + dt * 2.5); else T.hurtT -= dt;
      pose(me, dt);
    }
    if (!me.dead) updateLock(dt);
    me.y = SIM.groundH(me.x, me.z); me.o.position.set(me.x, me.y + (me.jy || 0), me.z); if (!me.dead) me.o.rotation.set(0, -me.psi, 0, 'YXZ');
    // escouade
    const reds = T.foes;
    T.squad.forEach(u => {
      if (u.dead) { pose(u, dt); return; }
      if (u.delay > 0) { u.delay -= dt; u.o.visible = false; return; } u.o.visible = true;
      u.cd -= dt; if (u.reloadT > 0) { u.reloadT -= dt; if (u.reloadT <= 0) u.ammo = WEAPONS[u.weapon].mag; } if (u.firing > 0) u.firing -= dt;
      const en = nearestVisible(u, reds, WEAPONS[u.weapon].scope ? 600 : 170);
      // place en formation en V derrière le commandant
      const row = Math.floor(u.slot / 2) + 1, side = u.slot % 2 ? 1 : -1, cps = Math.cos(me.psi), sps = Math.sin(me.psi);
      const fx = me.x + cps * side * row * 3.2 + sps * row * 3.5, fz = me.z + sps * side * row * 3.2 - cps * row * 3.5;
      if (en && T.order !== 'suivre-strict') {
        u.state = 'combat';
        if (T.order === 'assaut' && en.d > 40) { u.crouch = false; moveTo(u, en.t.x, en.t.z, 4.5, dt); }
        else {
          if (!u.cover || u.coverFor !== en.t) { u.cover = coverSpot(u, en.t); u.coverFor = en.t; }
          if (u.cover && Math.hypot(u.cover.x - u.x, u.cover.z - u.z) > 0.8 && T.order !== 'tenir') { u.crouch = false; moveTo(u, u.cover.x, u.cover.z, 5, dt); }
          else { u.spd = 0; u.crouch = u.cd > 0.5; u.psi += SIM.wrap((Math.atan2(en.t.x - u.x, -(en.t.z - u.z)) - u.psi) * R2D) * D2R * Math.min(1, dt * 8); if (u.cd <= 0 && u.reloadT <= 0) aiShoot(u, en.t, en.d); }
        }
      } else {
        u.state = 'suivre'; u.crouch = T.crouch; u.cover = null;
        if (T.order === 'tenir') u.spd = 0;
        else { const d = Math.hypot(fx - u.x, fz - u.z); moveTo(u, fx, fz, d > 8 ? 5.8 : 2.6, dt); if (d < 1) u.psi += SIM.wrap((me.psi - u.psi) * R2D) * D2R * Math.min(1, dt * 3); }
      }
      collide(u); u.aiming = !!en; u.aimP = 0; pose(u, dt);
      u.y = SIM.groundH(u.x, u.z); u.o.position.set(u.x, u.y, u.z); u.o.rotation.set(0, -u.psi, 0, 'YXZ');
    });
    // ennemis
    const blues = [me, ...T.squad.filter(u => !u.delay || u.delay <= 0)];
    T.foes.forEach(f => {
      if (f.dead) { pose(f, dt); f.o.position.set(f.x, f.y + (f.fall || 0) * 0.15, f.z); return; }
      f.cd -= dt; if (f.reloadT > 0) { f.reloadT -= dt; if (f.reloadT <= 0) f.ammo = WEAPONS[f.weapon].mag; } if (f.firing > 0) f.firing -= dt;
      const en = nearestVisible(f, blues, f.alert ? 220 : WEAPONS[f.weapon].scope ? 380 : 160);
      if (en) {
        f.alert = 1;
        if (!f.cover || f.coverFor !== en.t || Math.random() < dt * 0.05) { f.cover = coverSpot(f, en.t); f.coverFor = en.t; }
        if (f.assault && en.d > 70) { f.crouch = false; moveTo(f, en.t.x, en.t.z, 3.2, dt); if (f.cd <= 0 && f.reloadT <= 0 && Math.random() < 0.5) aiShoot(f, en.t, en.d); }
        else if (en.d > 150 && !WEAPONS[f.weapon].scope && Math.random() < 0.5) { f.crouch = false; moveTo(f, en.t.x, en.t.z, 3.5, dt); }
        else if (f.cover && Math.hypot(f.cover.x - f.x, f.cover.z - f.z) > 0.8) { f.crouch = false; moveTo(f, f.cover.x, f.cover.z, 4.8, dt); }
        else { f.spd = 0; f.crouch = f.cd > 0.6; f.psi += SIM.wrap((Math.atan2(en.t.x - f.x, -(en.t.z - f.z)) - f.psi) * R2D) * D2R * Math.min(1, dt * 6); if (f.cd <= 0 && f.reloadT <= 0) aiShoot(f, en.t, en.d); }
        f.aiming = true;
      } else if (f.assault) {
        f.aiming = false; f.crouch = false; moveTo(f, T.me.x + (f.x % 7), T.me.z + (f.z % 7), 3.6, dt);   // marche vers le front
      } else {
        f.aiming = false; f.crouch = false;
        f.think -= dt; if (f.think <= 0) { f.think = 4 + Math.random() * 6; f.wp = { x: f.home.x + (Math.random() - 0.5) * 40, z: f.home.z + (Math.random() - 0.5) * 40 }; }
        if (f.wp) moveTo(f, f.wp.x, f.wp.z, 1.2, dt); else f.spd = 0;
      }
      collide(f); pose(f, dt); f.y = SIM.groundH(f.x, f.z); f.o.position.set(f.x, f.y, f.z); f.o.rotation.set(0, -f.psi, 0, 'YXZ');
      if (f.mk) { f.mk.visible = true; f.mk.position.set(f.x, f.y + 2.4, f.z); }
    });
    T.hud();
  };

  // ---------- Caméra à l'épaule ----------
  T.camera = function (cam) {
    if (!T.active || !T.me) return false;
    const me0 = T.me, w0 = WEAPONS[me0.weapon];
    if (T.camMode === 'orbite' && !(T.aiming && (w0.scope || w0.rocket)) && !T.dead) {
      // caméra libre 360° autour du personnage (souris / ← → pour tourner, molette pour zoomer)
      const pitch = clamp(SIM.view.orb.pitch, -0.45, 1.2), dist = clamp(T.camDist * SIM.view.orb.zoom, 1.4, 16) * (T.aiming ? 0.6 : 1);
      const tx = me0.x, ty = me0.y + (me0.jy || 0) + (me0.prone ? 0.45 : T.crouch ? 1.0 : 1.45), tz = me0.z, yaw = T.camYaw;
      const side = T.aiming ? 0.6 : 0.35, rx = Math.cos(yaw), rz = Math.sin(yaw);
      cam.position.set(tx - Math.sin(yaw) * dist * Math.cos(pitch) + rx * side, ty + Math.sin(pitch) * dist + 0.2, tz + Math.cos(yaw) * dist * Math.cos(pitch) + rz * side);
      const gh = SIM.groundH(cam.position.x, cam.position.z); if (cam.position.y < gh + 0.35) cam.position.y = gh + 0.35;
      cam.lookAt(tx + rx * side + Math.sin(yaw) * 2, ty - Math.sin(pitch) * 0.6, tz + rz * side - Math.cos(yaw) * 2);
      const fov = T.aiming ? 50 : 62; if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
      cam.near = 0.05; return true;
    }
    const me = T.me, w = WEAPONS[me.weapon], scope = T.aiming && w.scope;
    const c = Math.cos(me.psi), s = Math.sin(me.psi), fwd = new V3(Math.sin(me.psi), 0, -Math.cos(me.psi)), right = new V3(c, 0, s);
    const h = (me.prone ? 0.55 : T.crouch ? 1.15 : 1.68) + (me.jy || 0), back = T.aiming ? 1.3 : 3.4, side = T.aiming ? 0.55 : 0.75;
    const pitch = T.aimPitch;
    if (T.dead) { cam.position.set(me.x + 5, me.y + 4, me.z + 5); cam.lookAt(me.x, me.y + 0.5, me.z); }
    else if (scope) { cam.position.set(me.x, me.y + h + 0.05, me.z).addScaledVector(fwd, 0.4); cam.lookAt(cam.position.clone().add(fwd.clone().multiplyScalar(Math.cos(pitch))).add(new V3(0, Math.sin(pitch), 0))); }
    else {
      cam.position.set(me.x, me.y + h, me.z).addScaledVector(fwd, -back * Math.cos(pitch)).addScaledVector(right, side); cam.position.y += -Math.sin(pitch) * back * 0.6 + 0.25;
      const look = new V3(me.x, me.y + h, me.z).addScaledVector(fwd, 30 * Math.cos(pitch)).addScaledVector(right, side); look.y += Math.sin(pitch) * 30;
      cam.lookAt(look);
    }
    const gh = SIM.groundH(cam.position.x, cam.position.z); if (cam.position.y < gh + 0.4) cam.position.y = gh + 0.4;
    const fov = scope ? 9 : T.aiming ? (w.rocket ? 34 : 48) : 68; if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.near = 0.05; return true;
  };

  // ---------- Clavier ----------
  T.key = function (lk, ev, down) {
    if (lk === 'shift') { T.keys.shift = down; return; }
    T.keys[lk] = down;
    const WL = ['revolver', 'magnum', 'carabine', 'sniper', 'pistolet', 'roquette', 'lourd', 'dore', 'smg', 'micro'], dm = /^(Digit|Numpad)([0-9])$/.exec(ev.code || ''), DIG = dm ? { [ev.code]: WL[(+dm[2] + 9) % 10] } : {};
    if (down && DIG[ev.code]) { T.setWeapon(DIG[ev.code]); return; }
    if (lk === ' ' || lk === 'enter') { T.fireHeld = down; if (!down) T.fired = false; return; }
    if (!down || ev.repeat) return;
    if (lk === 'c') { T.crouch = !T.crouch; T.msg(T.crouch ? 'À couvert (accroupi) : moins visible, tir plus précis.' : 'Debout.', 1300); }
    else if (lk === 'r') reload(T.me);
    else if (lk === 'v' || lk === 'x') { T.aiming = !T.aiming; }
    else if (lk === 'f') T.cycleOrder();
    else if (lk === 'e' && !ev.shiftKey) T.enter();
    else if (lk === 't') T.takeNext();
    else if (lk === 'o') T.toggleCam();
    else if (lk === 'l') T.toggleLock();
    else if (lk === 'j') T.jump();
    else if (lk === 'p') T.goProne();
    else if (lk === 'tab') T.nextLock();
    else if (lk === 'k') T.faceView();
    else if (lk === 'g') T.takeCmd();
    else if (lk === 'y') T.giveNearest();
  };
  function setUnitWeapon(u, wp) {
    if (!u || u.dead) return false;
    if (!T.allowed(u.kind).includes(wp)) { T.msg(WEAPONS[wp].name + ' : réservé aux militaires et au bataillon d\'intervention.', 2200); return false; }
    u.weapon = wp; u.ammo = WEAPONS[wp].mag; u.reloadT = 0; attachWeapon(u); return true;
  }
  T.setWeapon = function (wp) { if (!T.me || T.me.weapon === wp) return; if (setUnitWeapon(T.me, wp)) { if (T.me.isCmd) T.weapon = wp; T.msg((T.me.isCmd ? 'Arme : ' : T.me.cs + ' : ') + WEAPONS[wp].name, 1200); T.renderList(); } };
  T.setUnitWeapon = function (i, wp) { const u = T.allUnits()[i]; if (setUnitWeapon(u, wp)) { T.msg(u.cs + ' prend : ' + WEAPONS[wp].name, 1500); T.renderList(); } };
  // tous les hommes de l'escouade, chef compris (ordre fixe pour la liste)
  T.allUnits = () => [T.cmd, ...[T.me, ...T.squad].filter(u => u && u !== T.cmd).sort((a, b) => (a.cs > b.cs ? 1 : -1))];
  // prendre le contrôle d'un autre soldat
  T.takeUnit = function (u) {
    if (!u || u.dead || u === T.me) return;
    const old = T.me; old.isMe = false; T.squad = T.squad.filter(x => x !== u); T.squad.push(old);
    u.isMe = true; T.me = u; u.delay = 0; u.o.visible = true; T.hp = u.hp; T.crouch = false; T.aiming = false; T.fireHeld = false;
    T.squad.forEach((x, i) => { x.slot = i; x.cover = null; });
    SIM.view.orb.yaw = 0; SIM.view.orb.pitch = 0;
    T.msg('Vous contrôlez maintenant : ' + u.cs + ' (' + WEAPONS[u.weapon].name + ')', 2200); T.renderList();
  };
  T.takeNext = function () { const L = T.allUnits().filter(u => !u.dead), i = L.indexOf(T.me); T.takeUnit(L[(i + 1) % L.length]); };
  T.takeCmd = function () { if (T.cmd && !T.cmd.dead) T.takeUnit(T.cmd); else T.takeNext(); };
  // changer l'arme du coéquipier le plus proche devant vous
  T.giveNearest = function () {
    const me = T.me; let best = null, bd = 10;
    T.squad.forEach(u => { if (u.dead) return; const d = Math.hypot(u.x - me.x, u.z - me.z); if (d < bd) { bd = d; best = u; } });
    if (!best) return T.msg('Aucun coéquipier à moins de 10 m.', 1500);
    const L = T.allowed(best.kind), wp = L[(L.indexOf(best.weapon) + 1) % L.length];
    if (setUnitWeapon(best, wp)) { T.msg(best.cs + ' prend : ' + WEAPONS[wp].name, 1500); T.renderList(); }
  };
  T.renderList = function () {
    const el = document.getElementById('squadList'); if (!el) return;
    if (!T.active) { el.innerHTML = '<p class="hint" style="font-size:12px;opacity:.75;margin:4px 0">Sortez du Rafale pour voir l\'escouade.</p>'; return; }
    el.innerHTML = T.allUnits().map((u, i) => `<div class="sqr${u.dead ? ' dead' : ''}${u === T.me ? ' me' : ''}"><span>${u === T.me ? '▶ ' : ''}${u.cs}${u.dead ? ' (à terre)' : ''}</span><select data-i="${i}" ${u.dead ? 'disabled' : ''}>${T.allowed(u.kind).map(w => `<option value="${w}"${w === u.weapon ? ' selected' : ''}>${WEAPONS[w].name}</option>`).join('')}</select><button data-take="${i}" ${u.dead || u === T.me ? 'disabled' : ''}>Prendre</button></div>`).join('');
    el.querySelectorAll('select').forEach(sl => sl.onchange = () => { T.setUnitWeapon(+sl.dataset.i, sl.value); sl.blur(); });
    el.querySelectorAll('button[data-take]').forEach(b => b.onclick = () => { T.takeUnit(T.allUnits()[+b.dataset.take]); b.blur(); });
  };
  T.cycleOrder = function () {
    const O = ['suivre', 'tenir', 'assaut'], N = { suivre: 'Suivez-moi !', tenir: 'Tenez la position !', assaut: 'À l\'assaut !' };
    T.order = O[(O.indexOf(T.order) + 1) % 3]; T.msg('Ordre à l\'escouade : ' + N[T.order], 1800);
    SIM.radio('VOUS', N[T.order], false, { suivre: 'Follow me!', tenir: 'Hold position!', assaut: 'Assault!' }[T.order]);
  };
  T.jump = function () {
    const me = T.me; if (!me || me.dead || me.air) return;
    if (me.prone) { me.prone = false; T.msg('Debout.', 800); return; }
    me.air = true; me.vy = 4.6; me.jy = 0.001; T.crouch = false;
  };
  T.goProne = function () {
    const me = T.me; if (!me || me.dead) return;
    if (me.prone) { me.prone = false; T.msg('Debout.', 800); return; }
    if ((me.spd || 0) > 4 && !me.air) { me.diving = true; me.air = true; me.vy = 2.6; me.jy = 0.001; me.diveT = 0.7; me.diveV = 7; T.msg('Plongeon !', 900); }   // en courant : plongeon vers l'avant
    else { me.prone = true; T.crouch = false; T.msg('À terre (à plat ventre) : très difficile à toucher, déplacement en rampant. P ou J pour se relever.', 2500); }
  };
  T.toggleSprint = function () { T.sprint = !T.sprint; T.msg(T.sprint ? 'Course rapide activée.' : 'Course rapide coupée.', 1200); };
  T.lockHold = function (on) { if (!T.active) return; if (on) { if (!T.lock) { T.lock = bestLockTarget(); if (T.lock) T.aiming = true; } } else { T.lock = null; T.aiming = false; } };
  T.toggleCam = function () { T.camMode = T.camMode === 'orbite' ? 'epaule' : 'orbite'; if (T.camMode === 'orbite') T.camYaw = T.me ? T.me.psi : 0; SIM.view.orb.pitch = 0.15; T.msg(T.camMode === 'orbite' ? 'Caméra 360° : glissez la souris (ou ← →) pour tourner autour, molette pour zoomer, K = vue de face.' : 'Caméra à l\'épaule.', 3000); };
  T.faceView = function () { if (!T.me) return; T.camMode = 'orbite'; T.camYaw = T.me.psi + Math.PI; SIM.view.orb.pitch = 0.05; SIM.view.orb.zoom = 0.6; };
  T.fireBtn = function (down) { T.fireHeld = down; if (!down) T.fired = false; };

  // ---------- Interface ----------
  T.msg = function (m, ms) { if (T.toast) T.toast(m, ms); };
  T.hud = function () {
    const el = document.getElementById('footHud'); if (!el) return;
    const me = T.me, w = WEAPONS[me.weapon], alive = T.squad.filter(u => !u.dead).length, foes = T.foes.filter(f => !f.dead).length;
    const h = `<div><b>${(me.isCmd ? UNITS[T.unit].cmdName : me.cs).toUpperCase()}</b> · santé <b style="color:${T.hp > 50 ? '#9f9' : T.hp > 25 ? '#fd4' : '#f66'}">${Math.max(0, Math.round(T.hp))}</b> · escouade <b>${alive}/${T.squad.length}</b> · ordre <b>${T.order}</b></div>
      <div>${w.name} <b>${me.reloadT > 0 ? 'recharge…' : me.ammo + '/' + w.mag}</b> · ${me.prone ? 'à terre' : me.air ? 'saut' : T.crouch ? 'accroupi' : (T.keys.shift || T.sprint) ? 'sprint' : 'debout'}${T.aiming ? ' · visée' : ''} · ennemis <b>${foes}</b> · neutralisés <b>${T.kills}</b></div>`;
    if (el._h !== h) { el.innerHTML = h; el._h = h; }
    document.getElementById('scope').hidden = !(T.aiming && w.scope && !T.dead);
    const rg = document.getElementById('rgScope'); if (rg) rg.hidden = !(T.aiming && w.rocket && !T.dead);
    document.getElementById('hurt').style.opacity = String(clamp((T.hurtT || 0) * 1.5, 0, 0.6) + (T.hp < 30 ? 0.25 : 0));
  };
})();
