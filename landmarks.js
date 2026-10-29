// Monuments réels : tour Eiffel, Arc de Triomphe (Paris) · statue de la Liberté, Empire State Building, One World Trade Center (New York)
(function () {
  const D2R = SIM.D2R, clamp = SIM.clamp, geo = SIM.geo;
  const LM = SIM.landmarks = { list: [] };
  const city = name => (SIM.CITY3D || []).find(c => c.name.startsWith(name));
  // positions réelles, profil de collision [hauteur, rayon]
  const DEF = [
    { id: 'eiffel', name: 'Tour Eiffel · 330 m', lat: 48.8584, lon: 2.2945, H: 330, prof: [[0, 88], [57, 52], [64, 48], [115, 30], [120, 28], [180, 18], [276, 7], [330, 2]], clear: 280, city: 'Paris' },
    { id: 'arc', name: 'Arc de Triomphe · 50 m', lat: 48.8738, lon: 2.2950, H: 50, prof: [[0, 26], [50, 26]], clear: 170, city: 'Paris' },
    { id: 'liberty', name: 'Statue de la Liberté · 93 m', lat: 40.6892, lon: -74.0445, H: 93, prof: [[0, 58], [11, 55], [11.1, 20], [47, 15], [47.1, 8], [80, 5], [93, 2]], island: true },
    { id: 'esb', name: 'Empire State Building · 443 m', lat: 40.7484, lon: -73.9857, H: 443, prof: [[0, 46], [25, 38], [85, 31], [320, 23], [350, 16], [381, 11], [443, 2]], clear: 95, city: 'New York' },
    { id: 'wtc', name: 'One World Trade Center · 541 m', lat: 40.7127, lon: -74.0134, H: 541, prof: [[0, 46], [20, 46], [417, 24], [430, 4], [541, 1.5]], clear: 110, city: 'New York' },
  ];
  // ---------- outils de géométrie ----------
  function hexa(bot, top, uvs) {   // tronc de pyramide à base carrée : bot/top = [cx, y, cz, demi-côté]
    const B = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [bot[0] + a * bot[3], bot[1], bot[2] + b * bot[3]]);
    const T = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [top[0] + a * top[3], top[1], top[2] + b * top[3]]);
    const pos = [], uv = [], h = top[1] - bot[1];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, w = Math.hypot(B[j][0] - B[i][0], B[j][2] - B[i][2]) / (uvs || 10), vh = h / (uvs || 10);
      [[B[i], 0, 0], [B[j], w, 0], [T[j], w, vh], [B[i], 0, 0], [T[j], w, vh], [T[i], 0, vh]].forEach(([p, u, v]) => { pos.push(p[0], p[1], p[2]); uv.push(u, v); }); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
  }
  function latticeTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.strokeStyle = '#ffffff'; x.lineWidth = 7; x.strokeRect(0, 0, 128, 128);
    x.lineWidth = 3; x.beginPath(); x.moveTo(0, 0); x.lineTo(128, 128); x.moveTo(128, 0); x.lineTo(0, 128); x.moveTo(64, 0); x.lineTo(64, 128); x.moveTo(0, 64); x.lineTo(128, 64); x.stroke();
    x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, 64); x.lineTo(64, 0); x.lineTo(128, 64); x.lineTo(64, 128); x.closePath(); x.stroke();
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function windowsTex(wall, glass, cols, rows) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d');
    x.fillStyle = wall; x.fillRect(0, 0, 128, 256);
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) { x.fillStyle = glass; x.fillRect(k * 128 / cols + 3, r * 256 / rows + 4, 128 / cols - 6, 256 / rows - 9); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  const M = (color, o) => new THREE.MeshLambertMaterial(Object.assign({ color }, o || {}));

  // ---------- tour Eiffel ----------
  function eiffel() {
    // silhouette réelle : 125 m de côté au pied, courbe exponentielle, 4 piliers qui se rejoignent vers 180 m,
    // plateformes à 57 m, 115 m et 276 m, arcs décoratifs entre les piliers, antenne jusqu'à 330 m
    const g = new THREE.Group(), lt = latticeTex(), brown = 0x6e5139;
    const mat = M(brown, { map: lt, alphaTest: 0.35, side: THREE.DoubleSide }), solid = M(0x6a4e36), deck = M(0x6a4f37), core = M(0x5a4231);
    const hw = h => 62.5 * Math.exp(-0.0094 * h), lw = h => 2 + 12 * Math.exp(-0.009 * h);
    const lev = [0, 15, 30, 45, 57, 70, 85, 100, 115, 135, 155, 180];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let i = 0; i < lev.length - 1; i++) {
      const a = lev[i], b = lev[i + 1], ca = hw(a) - lw(a) / 2, cb = hw(b) - lw(b) / 2;
      g.add(new THREE.Mesh(hexa([sx * ca, a, sz * ca, lw(a) / 2], [sx * cb, b, sz * cb, lw(b) / 2], 4), mat));
      g.add(new THREE.Mesh(hexa([sx * ca, a, sz * ca, lw(a) * 0.3], [sx * cb, b, sz * cb, lw(b) * 0.3], 4), core));   // âme pleine : silhouette dense vue de loin
    }
    // fût unique au-dessus de 180 m
    const top = [180, 205, 230, 255, 276];
    for (let i = 0; i < top.length - 1; i++) { g.add(new THREE.Mesh(hexa([0, top[i], 0, hw(top[i])], [0, top[i + 1], 0, hw(top[i + 1])], 5), mat)); g.add(new THREE.Mesh(hexa([0, top[i], 0, hw(top[i]) * 0.55], [0, top[i + 1], 0, hw(top[i + 1]) * 0.55], 5), core)); }
    // treillis horizontaux reliant les piliers entre les étages
    for (const h of [57, 85, 115, 150]) for (let k = 0; k < 4; k++) {
      const w = hw(h) * 2, beam = new THREE.Mesh(new THREE.BoxGeometry(w, h === 57 || h === 115 ? 6 : 3, 1.2), mat); beam.position.y = h + (h === 57 ? 3 : 1.5);
      beam.rotation.y = k * Math.PI / 2; beam.position.x = Math.sin(k * Math.PI / 2) * hw(h); beam.position.z = Math.cos(k * Math.PI / 2) * hw(h); g.add(beam);
    }
    // arcs décoratifs sous le premier étage (un par face)
    for (let k = 0; k < 4; k++) {   // grands arcs dans le plan de chaque face, sous la première plateforme
      const a = new THREE.Mesh(new THREE.TorusGeometry(46, 1.3, 6, 40, Math.PI), solid); a.scale.y = 0.78;
      const d = hw(22) - lw(22) * 0.4; a.position.set(Math.sin(k * Math.PI / 2) * d, 8, Math.cos(k * Math.PI / 2) * d); a.rotation.y = k * Math.PI / 2; a.rotation.x = 0; g.add(a);
    }
    // plateformes : planchers, garde-corps, restaurants vitrés
    const floor = (h, w, th) => { const f = new THREE.Mesh(new THREE.BoxGeometry(w, th, w), deck); f.position.y = h + th / 2; g.add(f);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 1.2, w + 1), M(0x3e2e20, { transparent: true, opacity: 0.55 })); rail.position.y = h + th + 0.6; g.add(rail); };
    floor(57, hw(57) * 2 + 4, 2.5); floor(115, hw(115) * 2 + 3, 2);
    const resto = new THREE.Mesh(new THREE.BoxGeometry(hw(60) * 1.4, 4, hw(60) * 1.4), M(0x9fb3bf, { transparent: true, opacity: 0.75 })); resto.position.y = 61.5; g.add(resto);
    floor(276, 18, 1.5);
    const camp = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 6.5, 12, 8), solid); camp.position.y = 283.5; g.add(camp);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(4.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), solid); dome.position.y = 289.5; g.add(dome);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.4, 40, 8), M(0xdcdcdc)); ant.position.y = 310; g.add(ant);
    for (let k = 0; k < 3; k++) { const dish = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.6, 12), M(0xeeeeee)); dish.position.y = 298 + k * 7; g.add(dish); }
    // socle en pierre des quatre piliers
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 18), M(0xbdb39d)); b.position.set(sx * (hw(0) - 8), 2, sz * (hw(0) - 8)); g.add(b); }
    // illumination dorée et scintillement la nuit, phare au sommet
    const pts = [];
    for (let h = 0; h <= 276; h += 6) { const c = h < 180 ? hw(h) - lw(h) / 2 : 0, w = h < 180 ? lw(h) / 2 : hw(h);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) pts.push(sx * (c + w), h, sz * (c + w)); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const glow = SIM.glowTex('rgba(255,230,160,1)', 'rgba(255,190,80,0)');
    g.userData.lights = new THREE.Points(pg, new THREE.PointsMaterial({ map: glow, size: 7, color: 0xffd27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); g.add(g.userData.lights);
    const bea = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); bea.scale.setScalar(40); bea.position.y = 292; g.add(bea); g.userData.beacon = bea;
    return g;
  }
  // ---------- Arc de Triomphe ----------
  function arc() {
    const g = new THREE.Group(), st = M(0xd9cfb6), dark = M(0xb9ad92);
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(15, 36, 22), st); p.position.set(sx * 15, 18, 0); g.add(p); }
    const att = new THREE.Mesh(new THREE.BoxGeometry(45, 14, 22), st); att.position.y = 43; g.add(att);
    const cor = new THREE.Mesh(new THREE.BoxGeometry(46.5, 1.6, 23.5), dark); cor.position.y = 36.5; g.add(cor);
    const top = new THREE.Mesh(new THREE.BoxGeometry(46, 1.2, 23), dark); top.position.y = 50.4; g.add(top);
    const ar = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.4, 22, 20, 1, false, 0, Math.PI), st); ar.rotation.z = Math.PI / 2; ar.rotation.y = Math.PI / 2; ar.position.y = 29; g.add(ar);
    const fill = new THREE.Mesh(new THREE.BoxGeometry(15, 7, 22), st); fill.position.y = 32.5; g.add(fill);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const rel = new THREE.Mesh(new THREE.BoxGeometry(6, 11, 0.6), dark); rel.position.set(sx * 15, 15, sz * 11.2); g.add(rel); }
    // place de l'Étoile : grand rond-point pavé
    const pl = new THREE.Mesh(new THREE.CircleGeometry(120, 40).rotateX(-Math.PI / 2), M(0x8f8a80, { polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7 })); pl.position.y = 0.15; g.add(pl);
    return g;
  }
  // ---------- statue de la Liberté ----------
  function liberty() {
    const g = new THREE.Group(), cu = M(0x7fae96), stone = M(0xb9b09c), gran = M(0xa89e88);
    const isl = new THREE.Mesh(new THREE.CylinderGeometry(150, 165, 6, 32), M(0x6f8f4a)); isl.position.y = -3; g.add(isl);
    const fort = new THREE.Mesh(new THREE.CylinderGeometry(55, 58, 11, 11), stone); fort.position.y = 5.5; g.add(fort);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(13, 19, 33, 4), gran); ped.rotation.y = Math.PI / 4; ped.position.y = 27.5; g.add(ped);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(21, 3, 21), gran); cap.position.y = 45.5; g.add(cap);
    const robe = new THREE.Mesh(new THREE.LatheGeometry([[0.1, 0], [7.5, 0], [7, 3], [5.4, 12], [4.6, 20], [4.8, 26], [5.2, 29], [3.6, 31.5], [1.4, 32.5], [0.1, 33]].map(p => new THREE.Vector2(p[0], p[1])), 18), cu); robe.position.y = 47; g.add(robe);
    const head = new THREE.Mesh(new THREE.SphereGeometry(2.7, 14, 10), cu); head.scale.set(0.9, 1.1, 0.95); head.position.y = 82.5; g.add(head);
    for (let k = 0; k < 7; k++) { const a = (-0.65 + k * 0.22) * Math.PI, sp = new THREE.Mesh(new THREE.ConeGeometry(0.45, 3.4, 5), cu); sp.position.set(Math.sin(a) * 2.6, 84.8, -Math.cos(a) * 2.6 * -1); sp.rotation.set(Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9); g.add(sp); }
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.3, 13, 10), cu); arm.position.set(4.2, 84.5, 0); arm.rotation.z = -0.22; g.add(arm);
    const torch = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.8, 3, 10), M(0xc9a24a)); torch.position.set(5.7, 92, 0); g.add(torch);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(1.3, 3, 10), new THREE.MeshBasicMaterial({ color: 0xffcf5a })); flame.position.set(5.7, 94.5, 0); g.add(flame);
    const tab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 7, 4.2), cu); tab.position.set(-4.6, 69, 1.5); tab.rotation.z = 0.25; g.add(tab);
    const glow = SIM.glowTex('rgba(255,220,140,1)', 'rgba(255,160,60,0)'), fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); fl.scale.setScalar(14); fl.position.set(5.7, 95, 0); g.add(fl);
    return g;
  }
  // ---------- Empire State Building ----------
  function empire() {
    const g = new THREE.Group(), t = windowsTex('#9ea19f', '#2a3036', 6, 12), m = (w, h, d, y) => { const tt = t.clone(); tt.needsUpdate = true; tt.repeat.set(w / 14, h / 28); const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(0xffffff, { map: tt })); b.position.y = y + h / 2; g.add(b); };
    m(70, 25, 58, 0); m(56, 60, 46, 25); m(42, 235, 36, 85); m(30, 30, 26, 320); m(20, 31, 18, 350);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 3.2, 62, 10), M(0xcfd3d6)); mast.position.y = 412; g.add(mast);
    const glow = SIM.glowTex('rgba(255,255,255,1)', 'rgba(255,60,60,0)'), b = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff3030, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); b.scale.setScalar(25); b.position.y = 445; g.add(b); g.userData.beacon = b;
    return g;
  }
  // ---------- One World Trade Center ----------
  function wtc() {
    const g = new THREE.Group(), t = windowsTex('#7d9db5', '#3b5a75', 8, 16); t.repeat.set(5, 26);
    const podium = new THREE.Mesh(new THREE.BoxGeometry(62, 56, 62), M(0xb9c4cc, { map: windowsTex('#aab4bc', '#7c8c99', 6, 8) })); podium.position.y = 28; g.add(podium);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(23, 44, 361, 4, 1), M(0xffffff, { map: t })); tower.rotation.y = Math.PI / 4; tower.position.y = 56 + 180.5; g.add(tower);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(20, 22, 12, 8), M(0xdfe6ea)); crown.position.y = 423; g.add(crown);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 2.2, 112, 8), M(0xe8ecef)); spire.position.y = 485; g.add(spire);
    const glow = SIM.glowTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), b = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); b.scale.setScalar(26); b.position.y = 542; g.add(b); g.userData.beacon = b;
    return g;
  }
  const BUILD = { eiffel, arc, liberty, esb: empire, wtc };

  // positions et zones dégagées : calculées tout de suite (avant la construction du terrain)
  DEF.forEach(d => {
    const p = geo.toXZ(d.lat, d.lon); d.x = p.x; d.z = p.z;
    const c = d.city ? city(d.city) : null; d.c = c;
    if (c) SIM.city.addClear(d.x, d.z, d.clear || 100);
  });
  const flats = [];
  DEF.forEach(d => { if (!d.island && !(SIM.city && SIM.city.inside(d.x, d.z, 0))) flats.push({ x: d.x, z: d.z, r: Math.max(d.prof[0][1] + 60, 120), base: Math.round(SIM.groundH(d.x, d.z)) }); });
  SIM.FLATS = flats;

  function label(text) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
    x.font = '600 36px "B612",sans-serif'; x.textAlign = 'center'; x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(20, 10, 472, 76); x.fillStyle = '#ffe9a8'; x.fillText('★ ' + text, 256, 60);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, sizeAttenuation: false })); sp.scale.set(0.2, 0.0375, 1); sp.renderOrder = 4; return sp;
  }
  LM.init = function (scene) { LM.scene = scene; };
  LM.update = function (cam) {
    if (!LM.scene) return;
    const n = SIM.world ? SIM.world.night || 0 : 0, t = performance.now() / 1000;
    DEF.forEach(d => {
      const dist = Math.hypot(cam.position.x - d.x, cam.position.z - d.z);
      if (!d.g && dist < 70000) {
        // hauteur du socle : terrain (aplani) ; la statue se dresse sur son île au milieu de la baie
        const wl = SIM.waterAt(d.x, d.z), base = d.island && wl !== null ? wl + 3 : SIM.groundH(d.x, d.z);
        d.base = base; d.g = BUILD[d.id](); d.g.position.set(d.x, base, d.z);
        if (d.c) d.g.rotation.y = -d.c.rot;
        LM.scene.add(d.g); d.lbl = label(d.name); d.lbl.position.set(d.x, base + d.H + 60, d.z); LM.scene.add(d.lbl);
        SIM.city.marks.push({ x: d.x, z: d.z, base, H: d.H, R: d.prof[0][1] + 5, prof: d.prof, name: d.name });
      }
      if (!d.g) return;
      d.g.visible = dist < 90000; d.lbl.visible = SIM.world.labelsOn !== false && dist < 60000 && dist > 800;
      const u = d.g.userData;
      if (u.lights) u.lights.material.opacity = clamp((n - 0.3) * 1.8, 0, 1) * ((t % 3600) % 60 < 5 ? 0.5 + 0.5 * Math.sin(t * 40) : 1);
      if (u.beacon) u.beacon.material.opacity = (n > 0.3 ? 1 : 0.35) * (Math.sin(t * 2.5) > 0 ? 1 : 0.15);
    });
  };
  LM.list = DEF;
})();
