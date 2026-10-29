// Avion de ligne biréacteur type A320 (modèle procédural) : fuselage, ailes, gouvernes mobiles, réacteurs, train rétractable, feux
(function () {
  const D2R = SIM.D2R, V3 = THREE.Vector3, clamp = SIM.clamp;
  const LIV = {
    sanaga: { s: ['#0a7d4f', '#f2b705', '#c8102e'], fin: 0x0a7d4f, acc: 0xf2b705, eng: 0x0a7d4f },
    sahel: { s: ['#b85a14', '#e9a23b', '#b85a14'], fin: 0xb85a14, acc: 0xffffff, eng: 0xf3f5f7 },
    kribi: { s: ['#0b6ea8', '#59c3e8', '#0b6ea8'], fin: 0x0b6ea8, acc: 0x59c3e8, eng: 0x0b6ea8 },
    seine: { s: ['#1b2a5a', '#d4213d', '#1b2a5a'], fin: 0x1b2a5a, acc: 0xd4213d, eng: 0xf3f5f7 },
    mungo: { s: ['#0f6b5c', '#c2562b', '#0f6b5c'], fin: 0xc2562b, acc: 0x0f6b5c, eng: 0x0f6b5c },
    kivu: { s: ['#5b3f8f', '#7cc36b', '#5b3f8f'], fin: 0x5b3f8f, acc: 0x7cc36b, eng: 0xf3f5f7 },
    sablon: { s: ['#14402e', '#c9a227', '#14402e'], fin: 0x14402e, acc: 0xc9a227, eng: 0x14402e },
    essai: { s: ['#f07a1a', '#3d4752', '#f07a1a'], fin: 0xf3f5f7, acc: 0xf07a1a, eng: 0x3d4752 },
    armee: { s: ['#3f4636', '#3f4636', '#3f4636'], fin: 0x4d5544, acc: 0x2f3528, eng: 0x5b6151, base: '#6b7263', belly: '#5d6456', noWin: true },
    atlas: { s: ['#0b2545', '#e0a526', '#0b2545'], fin: 0x0b2545, acc: 0xe0a526, eng: 0xf3f5f7 },
    lagune: { s: ['#f08a24', '#1b9b6f', '#f08a24'], fin: 0xf08a24, acc: 0x1b9b6f, eng: 0xf3f5f7 },
    prive: { s: ['#1a1a1a', '#b8975a', '#1a1a1a'], fin: 0x1a1a1a, acc: 0xb8975a, eng: 0x1a1a1a },
    // livrées couleur intégrale (fuselage entièrement peint, sans blanc)
    saphir: { s: ['#d4af37', '#f2d675', '#d4af37'], fin: 0x0a2460, acc: 0xd4af37, eng: 0x123a8c, base: '#123a8c', belly: '#0a2460' },
    emeraude: { s: ['#d4af37', '#f2d675', '#d4af37'], fin: 0x075239, acc: 0xd4af37, eng: 0x0c7a55, base: '#0c7a55', belly: '#075239' },
    rubis: { s: ['#c0c6cc', '#e6e9ec', '#c0c6cc'], fin: 0x6e0b1b, acc: 0xc0c6cc, eng: 0xa3132a, base: '#a3132a', belly: '#6e0b1b' },
    champagne: { s: ['#1a1a1a', '#3a3a3a', '#1a1a1a'], fin: 0x1a1a1a, acc: 0x1a1a1a, eng: 0xc9a45a, base: '#c9a45a', belly: '#9c7c3e' },
    nuit: { s: ['#e0338a', '#ff7ab8', '#e0338a'], fin: 0x1f133a, acc: 0xe0338a, eng: 0x33205c, base: '#33205c', belly: '#1f133a' },
    corail: { s: ['#13284f', '#2b4c8a', '#13284f'], fin: 0x13284f, acc: 0x13284f, eng: 0xe8653f, base: '#e8653f', belly: '#b84a2b' },
    lagon: { s: ['#ffc928', '#ffe17a', '#ffc928'], fin: 0x0b706f, acc: 0xffc928, eng: 0x119e9c, base: '#119e9c', belly: '#0b706f' },
    graphite: { s: ['#ff7a1a', '#ffa95e', '#ff7a1a'], fin: 0x262a31, acc: 0xff7a1a, eng: 0x3a4049, base: '#3a4049', belly: '#262a31' },
    bordeaux: { s: ['#d4af37', '#f2d675', '#d4af37'], fin: 0x3c0c1e, acc: 0xd4af37, eng: 0x5e1530, base: '#5e1530', belly: '#3c0c1e' },
    azur: { s: ['#0d2350', '#1d3d7a', '#0d2350'], fin: 0x0d2350, acc: 0x0d2350, eng: 0x3d9be0, base: '#3d9be0', belly: '#2a74ad' },
    mangue: { s: ['#0f6b3a', '#1f9a57', '#0f6b3a'], fin: 0x0f6b3a, acc: 0x0f6b3a, eng: 0xf2a516, base: '#f2a516', belly: '#c98407' },
    lavande: { s: ['#1b1f4f', '#353b80', '#1b1f4f'], fin: 0x1b1f4f, acc: 0x1b1f4f, eng: 0x8b7fd0, base: '#8b7fd0', belly: '#6a5eaf' },
    // livrées « inspirées » des couleurs de grandes compagnies (sans logo ni nom)
    belge: { s: ['#0b1f4a', '#d71e2b', '#0b1f4a'], fin: 0x0b1f4a, acc: 0xd71e2b, eng: 0x0b1f4a, noLine: true, sw: ['#0b1f4a', '#d71e2b'], belly: '#0b1f4a' },
    tricolore: { s: ['#002157', '#ffffff', '#e4002b'], fin: 0x002157, acc: 0xe4002b, eng: 0xf3f5f7, noLine: true, sw: ['#002157', '#e4002b'], thin: true },
    constructeur: { s: ['#00205b', '#4fb3e6', '#00205b'], fin: 0x00205b, acc: 0x4fb3e6, eng: 0xf3f5f7, noLine: true, sw: ['#00205b', '#4fb3e6'] },
    lion: { s: ['#007a3d', '#ce1126', '#fcd116'], fin: 0x007a3d, acc: 0xfcd116, eng: 0x007a3d, noLine: true, sw: ['#007a3d', '#ce1126', '#fcd116'] },
  };
  const ZN = -18.62, FL = 37.67;
  const PROF = [[19.05, 0], [18.9, 0.25], [18.3, 0.5], [16.8, 0.95], [14.5, 1.45], [12, 1.8], [9.5, 1.96], [8, 1.98], [-12, 1.98], [-14.2, 1.95], [-15.6, 1.82], [-16.6, 1.6], [-17.4, 1.3], [-18, 0.95], [-18.4, 0.55], [-18.62, 0]];
  function rAt(z) { for (let i = 0; i < PROF.length - 1; i++) { const a = PROF[i], b = PROF[i + 1]; if (z <= a[0] && z >= b[0]) return a[1] + (b[1] - a[1]) * (a[0] - z) / (a[0] - b[0]); } return 0; }
  function yOff(z) { return z > 8 ? (1.98 - rAt(z)) * 0.9 : z < -14 ? -Math.pow((-14 - z) / 4.62, 1.6) * 0.5 : 0; }
  const CY = 3.9;
  const cache = {};

  function fuselageGeom() {
    if (cache.fus) return cache.fus;
    const pts = PROF.map(p => new THREE.Vector2(Math.max(p[1], 0.001), -p[0]));
    const g = new THREE.LatheGeometry(pts, 48); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setY(i, p.getY(i) + CY + yOff(z)); uv.setY(i, (z - ZN) / FL); }
    g.computeVertexNormals(); return (cache.fus = g);
  }
  function liveryTex(L, rows) {
    rows = rows || 1; const key = 'r' + rows + 'liv' + L.s.join() + (L.sw ? 'w' + L.sw.join() : '') + (L.noLine ? 'n' : ''); if (cache[key]) return cache[key];
    const W = 512, H = 2048, c = document.createElement('canvas'), e = document.createElement('canvas');
    c.width = e.width = W; c.height = e.height = H;
    const x = c.getContext('2d'), y = e.getContext('2d');
    const Y = z => (1 - (z - ZN) / FL) * H, X = u => u * W;
    const both = (u0, u1, z0, z1, col, ctx) => { ctx = ctx || x; ctx.fillStyle = col; ctx.fillRect(X(u0), Y(z1), X(u1 - u0), Y(z0) - Y(z1)); ctx.fillRect(X(1 - u1), Y(z1), X(u1 - u0), Y(z0) - Y(z1)); };
    x.fillStyle = L.base || '#f3f5f7'; x.fillRect(0, 0, W, H); y.fillStyle = '#000'; y.fillRect(0, 0, W, H);
    x.fillStyle = L.sw ? '#cdd2d8' : (L.belly || '#cdd2d8'); x.fillRect(X(0.36), 0, X(0.28), H);
    if (!L.noLine) { both(0.262, 0.284, -15.4, 16.5, L.s[0]); both(0.284, 0.296, -15.4, 16.5, L.s[1]); both(0.296, 0.303, -15.4, 16.5, L.s[2]); }
    if (L.sw) {   // grande vague colorée qui monte de l'arrière du fuselage vers la dérive
      L.sw.forEach((col, i) => { const off = i * (L.thin ? 0.022 : 0.04), z0 = 2 + i * 2.2;
        x.fillStyle = col;
        for (const side of [0, 1]) { const U = u => X(side ? 1 - u : u); x.beginPath(); x.moveTo(U(0), Y(z0));
          for (let z = z0; z <= 19.1; z += 0.25) { const q = (z - z0) / (19.1 - z0); x.lineTo(U(Math.min(0.5, (L.thin ? 0.05 : 0.02) + Math.pow(q, 0.7) * 0.36 - off)), Y(z)); }
          x.lineTo(U(0), Y(19.1)); x.closePath(); x.fill(); } });
      if (L.belly) { x.fillStyle = L.belly; for (const side of [0, 1]) { const U = u => X(side ? 1 - u : u); x.beginPath(); x.moveTo(U(0.5), Y(-15)); for (let z = -15; z <= 19.1; z += 0.5) x.lineTo(U(0.5 - 0.1 * Math.max(0, Math.min(1, (z + 15) / 10))), Y(z)); x.lineTo(U(0.5), Y(19.1)); x.closePath(); x.fill(); } }
    }
    x.fillStyle = L.s[0];
    for (const side of [0, 1]) { x.beginPath(); for (let z = 10; z <= 19.1; z += 0.2) { const u = 0.27 * Math.pow((z - 10) / 9, 0.8); x.lineTo(X(side ? 1 - u : u), Y(z)); } x.lineTo(X(side ? 1 : 0), Y(19.1)); x.lineTo(X(side ? 1 : 0), Y(10)); x.fill(); }
    for (let z = -12.6; z < 12.6; z += 0.533) {
      if ((z > -1.1 && z < 0.9) || L.noWin) continue;
      // hublots : certains stores sont baissés (plastique clair), les autres laissent voir la cabine éclairée la nuit
      const shade = ((Math.sin(z * 12.9898 + L.s[0].length * 3.1) * 43758.5453) % 1 + 1) % 1 < 0.18;
      both(0.202, 0.228, z - 0.12, z + 0.12, shade ? '#c3c8cf' : '#1c2733'); if (!shade) both(0.204, 0.212, z - 0.08, z + 0.08, '#3d5568');
      both(0.202, 0.228, z - 0.12, z + 0.12, shade ? '#3a3122' : '#ffd9a0', y);
    }
    // ponts supérieurs (super-jumbo, Titan) : rangées de hublots en plus
    for (let r = 1; r < rows; r++) { const u0 = 0.202 - r * 0.042, zA = -12.6 + r * 3.2, zB = 12.6 - r * 3.4;
      for (let z = zA; z < zB; z += 0.533) { both(u0, u0 + 0.024, z - 0.11, z + 0.11, '#1c2733'); both(u0, u0 + 0.024, z - 0.11, z + 0.11, '#ffd9a0', y); } }
    x.strokeStyle = "#9aa3ad"; x.lineWidth = 2;
    [[-14.7, 0.82, 0.16, 0.31], [14.0, 0.82, 0.16, 0.31], [-0.8, 0.5, 0.19, 0.25], [0.35, 0.5, 0.19, 0.25], [-9.2, 1.8, 0.312, 0.362], [7.6, 1.7, 0.312, 0.362]].forEach(([z, w, u0, u1]) => {
      for (const u of [[u0, u1], [1 - u1, 1 - u0]]) x.strokeRect(X(u[0]), Y(z + w / 2), X(u[1] - u[0]), Y(z - w / 2) - Y(z + w / 2));
    });
    // masque noir autour du pare-brise (comme sur les Airbus), puis 4 vitres de chaque côté avec cadres et reflets
    for (const side of [0, 1]) {
      const U = u => X(side ? 1 - u : u);
      x.fillStyle = '#0b0f14'; x.beginPath();
      x.moveTo(U(0), Y(-17.36)); x.lineTo(U(0.064), Y(-17.32)); x.lineTo(U(0.13), Y(-17.27)); x.lineTo(U(0.205), Y(-16.5)); x.lineTo(U(0.262), Y(-16.08));
      x.lineTo(U(0.262), Y(-15.45)); x.lineTo(U(0.2), Y(-15.62)); x.lineTo(U(0.128), Y(-15.66)); x.lineTo(U(0.06), Y(-16.36)); x.lineTo(U(0), Y(-16.42)); x.closePath(); x.fill();
    }
    const pane = (u0, u1, z0, z1, skew) => {
      for (const side of [0, 1]) {
        const U = u => X(side ? 1 - u : u), gr = x.createLinearGradient(0, Y(z0), 0, Y(z1));
        gr.addColorStop(0, '#26394b'); gr.addColorStop(0.55, '#101a24'); gr.addColorStop(1, '#3e5a72');
        x.fillStyle = gr; x.beginPath(); x.moveTo(U(u0), Y(z0)); x.lineTo(U(u1), Y(z0 + skew)); x.lineTo(U(u1), Y(z1 + skew)); x.lineTo(U(u0), Y(z1)); x.closePath(); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.18)'; x.beginPath(); x.moveTo(U(u0 + (u1 - u0) * 0.15), Y(z1 - 0.05)); x.lineTo(U(u0 + (u1 - u0) * 0.45), Y(z1 - 0.05 + skew * 0.5)); x.lineTo(U(u0 + (u1 - u0) * 0.3), Y(z0 + 0.1)); x.closePath(); x.fill();
        y.fillStyle = '#2a3a48'; y.beginPath(); y.moveTo(U(u0), Y(z0)); y.lineTo(U(u1), Y(z0 + skew)); y.lineTo(U(u1), Y(z1 + skew)); y.lineTo(U(u0), Y(z1)); y.closePath(); y.fill();
      }
    };
    pane(0.006, 0.058, -17.25, -16.47, 0.02); pane(0.07, 0.124, -17.2, -16.42, 0.03); pane(0.136, 0.198, -16.45, -15.74, 0.08); pane(0.21, 0.254, -16.05, -15.55, 0.05);
    const t = new THREE.CanvasTexture(c), te = new THREE.CanvasTexture(e);
    t.anisotropy = te.anisotropy = 4;
    return (cache[key] = [t, te]);
  }

  // Aile générique (profil NACA, conicité, flèche, dièdre)
  function wingPt(P, s, c, side) {
    const d = P.dih * D2R, ch = P.rc + (P.tc - P.rc) * s, sw = Math.tan(P.sweep * D2R) * s * P.span;
    const t = side ? side * 5 * P.th * (0.2969 * Math.sqrt(c) - 0.126 * c - 0.3516 * c * c + 0.2843 * c * c * c - 0.1015 * c * c * c * c) * ch : 0;
    return new V3(P.x0 + Math.cos(d) * s * P.span - Math.sin(d) * t, P.y0 + Math.sin(d) * s * P.span + Math.cos(d) * t - (P.bend || 0) * s * s * P.span, P.z0 + sw + c * ch);
  }
  function wingGeom(P, trunc) {
    const cs = [0, 0.015, 0.05, 0.1, 0.18, 0.28, 0.4, 0.52, 0.64].filter(c => c < trunc).concat([trunc]);
    const loop = []; for (let i = cs.length - 1; i >= 0; i--) loop.push([cs[i], 1]); for (let i = 1; i < cs.length; i++) loop.push([cs[i], -1]);
    const pos = [], M = loop.length;
    const st = [0, 1].map(s => loop.map(([c, sd]) => wingPt(P, s, c, sd)));
    const tri = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < M; i++) { const j = (i + 1) % M; tri(st[0][i], st[1][i], st[1][j]); tri(st[0][i], st[1][j], st[0][j]); }
    for (let i = 1; i < M - 1; i++) { tri(st[0][0], st[0][i + 1], st[0][i]); tri(st[1][0], st[1][i], st[1][i + 1]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
  }
  function plate(P, s0, s1, c0, c1, lift) {
    const n = new V3(-Math.sin(P.dih * D2R), Math.cos(D2R * P.dih), 0);
    const mid = (s, c) => { const a = wingPt(P, s, c, 1), b = wingPt(P, s, c, -1); return lift ? a.addScaledVector(n, 0.03) : a.add(b).multiplyScalar(0.5); };
    const th = (s, c) => lift ? 0.06 : Math.max(wingPt(P, s, c, 1).distanceTo(wingPt(P, s, c, -1)), 0.02);
    const q = [[s0, c0], [s1, c0], [s1, c1], [s0, c1]].map(([s, c]) => ({ m: mid(s, c), t: th(s, c) }));
    const T = q.map(v => v.m.clone().addScaledVector(n, v.t / 2)), B = q.map(v => v.m.clone().addScaledVector(n, -v.t / 2));
    const pos = [], tri = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z), quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
    quad(T[0], T[1], T[2], T[3]); quad(B[3], B[2], B[1], B[0]);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(T[i], B[i], B[j], T[j]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    return { g, hinge: q[0].m.clone(), axis: q[1].m.clone().sub(q[0].m).normalize() };
  }
  function mirrorG(g) { const m = g.clone(); m.scale(-1, 1, 1); m.computeVertexNormals(); return m; }
  function surface(parent, pl, mat, mirror) {
    const piv = new THREE.Group(), h = pl.hinge.clone(), ax = pl.axis.clone();
    const geo = mirror ? mirrorG(pl.g) : pl.g;
    if (mirror) { h.x = -h.x; ax.set(ax.x, -ax.y, -ax.z); }
    const m = new THREE.Mesh(geo, mat); m.position.copy(h).negate(); piv.add(m); piv.position.copy(h);
    piv.userData = { h, ax }; parent.add(piv); return piv;
  }
  function setSurf(p, ang, aft, down) {
    p.quaternion.setFromAxisAngle(p.userData.ax, ang);
    p.position.copy(p.userData.h); if (aft) { p.position.z += aft; p.position.y -= down || 0; }
  }

  const WING = { span: 16.2, rc: 6.4, tc: 1.55, sweep: 27, dih: 5.5, th: 0.13, x0: 1.7, y0: 2.35, z0: -4.2 };
  const HSTAB = { span: 6.1, rc: 3.7, tc: 1.45, sweep: 32, dih: 6, th: 0.1, x0: 0.3, y0: 4.65, z0: 13.4 };
  const FIN = { span: 6.0, rc: 5.8, tc: 1.9, sweep: 36, dih: 90, th: 0.11, x0: 0, y0: 5.5, z0: 12.0 };

  function engine(mats, simple) {
    const g = new THREE.Group();
    const prof = [[0.5, -2.3], [0.62, -1.9], [0.86, -1.2], [1.04, -0.3], [1.08, 0.8], [1.05, 1.7], [0.98, 2.1], [0.9, 2.2], [0.84, 2.1], [0.82, 1.6], [0.8, 1.1]].map(p => new THREE.Vector2(p[0], p[1]));
    const nac = new THREE.Mesh(new THREE.LatheGeometry(prof, 32).rotateX(-Math.PI / 2), mats.nac); g.add(nac);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.91, 0.07, 8, 32), mats.metal); lip.position.z = -2.18; g.add(lip);
    const plug = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 20).rotateX(Math.PI / 2), mats.metal); plug.position.z = 2.75; g.add(plug);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 20, 1, true).rotateX(Math.PI / 2), mats.dark); core.position.z = 2.25; g.add(core);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.8, 28).rotateY(Math.PI), mats.dark); face.position.z = -1.05; g.add(face);
    const fan = new THREE.Group(); fan.position.z = -1.12;
    // cône d'entrée avec la spirale peinte (elle montre au personnel au sol que le réacteur tourne)
    if (!cache.spinM) { const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#f2f3f5'; x.fillRect(0, 0, 128, 128);
      x.strokeStyle = '#111'; x.lineWidth = 14; x.lineCap = 'round'; x.beginPath(); for (let t = 0; t <= 1.001; t += 0.02) { const u = (0.15 + t * 0.55) * 128, v = (0.05 + t * 0.9) * 128; t ? x.lineTo(u, v) : x.moveTo(u, v); } x.stroke();
      cache.spinM = new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(c), shininess: 90, specular: 0x666666 }); }
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.55, 20).rotateX(-Math.PI / 2), cache.spinM); sp.position.z = -0.22; fan.add(sp);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.3), mats.dark); mark.position.set(0, 0.09, -0.2); fan.add(mark);
    if (!simple) {
      const bg = new THREE.BoxGeometry(0.11, 0.56, 0.03);
      for (let i = 0; i < 24; i++) { const b = new THREE.Mesh(bg, mats.blade); const a = i / 24 * Math.PI * 2; b.position.set(Math.sin(a) * 0.52, Math.cos(a) * 0.52, 0); b.rotation.z = -a; b.rotation.y = 0.5; fan.add(b); }
    }
    g.add(fan); g.userData.fan = fan;
    // inverseur de poussée : le capot arrière recule et découvre les grilles (cascades) quand on inverse
    if (!simple) {
      const casc = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.6, 28, 1, true).rotateX(Math.PI / 2), new THREE.MeshPhongMaterial({ color: 0x1a1c20, shininess: 10, side: THREE.DoubleSide })); casc.position.z = 1.0; casc.visible = false; g.add(casc);
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.07, 0.95, 32, 1, true).rotateX(Math.PI / 2), mats.nac); sl.position.z = 1.18; sl.visible = false; g.add(sl);
      const seamR = new THREE.Mesh(new THREE.TorusGeometry(1.075, 0.012, 6, 32), mats.rimDark); seamR.position.z = 0.71; g.add(seamR);
      g.userData.sleeve = sl; g.userData.casc = casc; g.userData.revK = 0;
    }
    const pyl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.9, 4.2), mats.nac); pyl.position.set(0, 1.25, 0.6); pyl.rotation.x = -0.06; g.add(pyl);
    return g;
  }
  // pneu d'avion : flancs arrondis, rainures de la bande de roulement, jante, freins et boulons
  function treadTex() {
    if (cache.tread) return cache.tread;
    const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#1e1e1f'; x.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '70,70,70'},0.25)`; x.fillRect(Math.random() * 64, Math.random() * 256, 2, 2); }
    // rainures longitudinales sur la bande de roulement (milieu du profil)
    x.fillStyle = '#060606'; [0.36, 0.45, 0.55, 0.64].forEach(v => x.fillRect(0, v * 256 - 2, 64, 4));
    // inscriptions grises sur les flancs
    x.fillStyle = 'rgba(160,160,160,0.25)'; for (let k = 0; k < 4; k++) { x.fillRect(k * 16 + 3, 18, 9, 3); x.fillRect(k * 16 + 3, 235, 9, 3); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 1); return (cache.tread = t);
  }
  function tireGeom(r, w) {
    const key = 'tire' + r + '_' + w; if (cache[key]) return cache[key];
    const ri = r * 0.6, prof = [[ri, -w / 2], [r * 0.86, -w / 2], [r * 0.95, -w * 0.46], [r * 0.99, -w * 0.36], [r, -w * 0.22], [r, w * 0.22], [r * 0.99, w * 0.36], [r * 0.95, w * 0.46], [r * 0.86, w / 2], [ri, w / 2]];
    const g = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 28); g.rotateZ(Math.PI / 2); g.computeVertexNormals();
    return (cache[key] = g);
  }
  function wheel(r, w, mats, simple, brake) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(tireGeom(r, w), mats.tire));
    const ri = r * 0.6;
    const rimG = cache['rim' + r + w] || (cache['rim' + r + w] = new THREE.CylinderGeometry(ri, ri, w * 0.92, 20).rotateZ(Math.PI / 2));
    g.add(new THREE.Mesh(rimG, mats.rim));
    if (!simple) {
      // moyeu, capot et boulons du côté extérieur
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(ri * 0.42, ri * 0.5, w * 0.98, 14).rotateZ(Math.PI / 2), mats.metal); g.add(hub);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(ri * 0.22, 10, 6), mats.metal); cap.scale.set(0.5, 1, 1); cap.position.x = w * 0.5; g.add(cap);
      const bg = cache.bolt || (cache.bolt = new THREE.CylinderGeometry(0.022, 0.022, 0.03, 6).rotateZ(Math.PI / 2));
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, b = new THREE.Mesh(bg, mats.dark); b.position.set(w * 0.47, Math.cos(a) * ri * 0.33, Math.sin(a) * ri * 0.33); g.add(b); }
      // rayons de jante
      for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.02, ri * 0.75, 0.05), mats.rimDark); sp.rotation.x = i / 6 * Math.PI; sp.position.x = w * 0.45; g.add(sp); }
      if (brake) { const bd = new THREE.Mesh(new THREE.CylinderGeometry(ri * 0.85, ri * 0.85, 0.06, 18).rotateZ(Math.PI / 2), mats.brake); bd.position.x = -w * 0.38; g.add(bd); }
    }
    return g;
  }
  // jambe de train réaliste : fût, tige chromée de l'amortisseur, compas, contrefiche
  function oleo(piv, len, rTop, mats, sx, simple) {
    const up = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rTop * 1.05, len * 0.62, 12), mats.strut); up.position.y = -len * 0.31; piv.add(up);
    const lo = new THREE.Mesh(new THREE.CylinderGeometry(rTop * 0.72, rTop * 0.72, len * 0.42, 12), mats.chrome); lo.position.y = -len * 0.78; piv.add(lo);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(rTop * 1.25, rTop * 1.25, 0.08, 12), mats.strut); col.position.y = -len * 0.6; piv.add(col);
    if (simple) return;
    // compas (bras articulés devant la jambe)
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.05, len * 0.24, 0.06), mats.metal); tl.position.set(0, -len * 0.66, -rTop * 1.6); tl.rotation.x = 0.55; piv.add(tl);
    const tl2 = tl.clone(); tl2.position.y = -len * 0.84; tl2.rotation.x = -0.55; piv.add(tl2);
    // contrefiche latérale vers l'intérieur
    if (sx) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, len * 0.7, 6), mats.strut); br.position.set(-sx * len * 0.22, -len * 0.3, 0); br.rotation.z = sx * 0.62; piv.add(br); }
    // flexible hydraulique de frein
    const hy = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, len * 0.8, 5), mats.dark); hy.position.set(rTop * 1.2, -len * 0.45, rTop * 0.6); piv.add(hy);
  }
  function glowSprite(color, size) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cache.glow || (cache.glow = SIM.glowTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)')), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(size);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const p = new THREE.Points(pg, new THREE.PointsMaterial({ color, size: 5, sizeAttenuation: false, map: cache.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.add(p); return s;
  }

  SIM.fuselageGeom = fuselageGeom; SIM.fusYOff = yOff;
  SIM.buildAircraft = function (livName, simple, type) {
    const L = LIV[livName] || LIV.sanaga, [tex, emi] = liveryTex(L, type === 'leviathan' ? 4 : type === 'titan' ? 3 : type === 'super' || type === 'hyperion' ? 2 : 1);
    const mats = {
      fus: new THREE.MeshPhongMaterial({ map: tex, emissiveMap: emi, emissive: 0x000000, shininess: 70, specular: 0x777777 }),
      wing: new THREE.MeshPhongMaterial({ color: 0xc9ced4, shininess: 50, specular: 0x666666, side: THREE.DoubleSide }),
      surf: new THREE.MeshPhongMaterial({ color: 0xb8bec5, shininess: 40, side: THREE.DoubleSide }),
      fin: new THREE.MeshPhongMaterial({ color: L.fin, shininess: 60, specular: 0x555555, side: THREE.DoubleSide, emissive: 0x000000 }),
      acc: new THREE.MeshPhongMaterial({ color: L.acc, shininess: 60, side: THREE.DoubleSide, emissive: 0x000000 }),
      nac: new THREE.MeshPhongMaterial({ color: L.eng, shininess: 80, specular: 0x888888, side: THREE.DoubleSide }),
      white: new THREE.MeshPhongMaterial({ color: 0xf3f5f7, shininess: 80 }),
      metal: new THREE.MeshPhongMaterial({ color: 0x9aa1a8, shininess: 100, specular: 0xaaaaaa }),
      dark: new THREE.MeshLambertMaterial({ color: 0x16191d }), blade: new THREE.MeshPhongMaterial({ color: 0x3a3f45, shininess: 80 }),
      tire: new THREE.MeshPhongMaterial({ map: treadTex(), color: 0xffffff, shininess: 12, specular: 0x222222 }), strut: new THREE.MeshPhongMaterial({ color: 0xd8dbde, shininess: 90 }),
      chrome: new THREE.MeshPhongMaterial({ color: 0xe8edf2, shininess: 160, specular: 0xffffff }), rim: new THREE.MeshPhongMaterial({ color: 0xb9bfc6, shininess: 110, specular: 0xbbbbbb }),
      rimDark: new THREE.MeshPhongMaterial({ color: 0x6b7178, shininess: 60 }), brake: new THREE.MeshPhongMaterial({ color: 0x3b3430, shininess: 30 }),
    };
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const TS = { leviathan: [3.5, 3.4, 4.2], hyperion: [3.0, 2.9, 5.6], titan: [2.9, 3.0, 2.95], colosse: [3.0, 2.4, 2.5], geant: [2.25, 2.0, 2.3], A319: [1, 1, 0.88], A321: [1, 1, 1.18], militaire: [1.05, 1.05, 1.1], gros: [1.45, 1.45, 1.45], jumbo: [1.55, 1.6, 1.9], super: [1.75, 2.1, 1.95], jet: [0.42, 0.42, 0.46] }[type];
    if (TS) body.scale.set(TS[0], TS[1], TS[2]);
    body.add(new THREE.Mesh(fuselageGeom(), mats.fus));
    const fair = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), mats.wing); fair.scale.set(2.05, 0.95, 8.2); fair.position.set(0, 2.55, -0.6); body.add(fair);
    // ailes : les très grands avions ont des ailes plus longues qui s'affaissent légèrement vers le bas sous leur propre poids
    const BEND = { jumbo: 0.012, super: 0.018, geant: 0.03, titan: 0.035, colosse: 0.04, leviathan: 0.05, hyperion: 0.055 }, SPANK = { leviathan: 1.25, hyperion: 1.35 };
    const WINGt = BEND[type] || SPANK[type] ? Object.assign({}, WING, { bend: BEND[type] || 0, span: WING.span * (SPANK[type] || 1) }) : WING, wk = WINGt === WING ? '' : type;
    const droop = x => { const sp = (Math.abs(x) - WINGt.x0) / (WINGt.span * Math.cos(WINGt.dih * D2R)); return sp > 0 ? (WINGt.bend || 0) * sp * sp * WINGt.span : 0; };
    const wg = cache['wg' + wk] || (cache['wg' + wk] = wingGeom(WINGt, 0.75)), wgm = cache['wgm' + wk] || (cache['wgm' + wk] = mirrorG(wg)), wingR = new THREE.Mesh(wg, mats.wing), wingL = new THREE.Mesh(wgm, mats.wing); body.add(wingR); body.add(wingL);
    const hg = cache.hg || (cache.hg = wingGeom(HSTAB, 0.7)), hsR = new THREE.Mesh(hg, mats.wing), hsL = new THREE.Mesh(mirrorG(hg), mats.wing); body.add(hsR); body.add(hsL);
    const fg = cache.fg || (cache.fg = wingGeom(FIN, 0.68)), finM = new THREE.Mesh(fg, mats.fin); body.add(finM);
    // empennage double (An-225) : deux dérives au bout du stabilisateur, pas de dérive centrale
    // Titan triple pont : grand ventre et seconde quille ventrale ; Colosse : deux fuselages latéraux posés sur l'aile
    if (type === 'titan') { const hump = new THREE.Mesh(new THREE.SphereGeometry(1, 30, 16), mats.fus); hump.scale.set(1.6, 1.0, 13.5); hump.position.set(0, CY + 1.25, -1.5); body.add(hump); }
    if (type === 'leviathan') { const hump = new THREE.Mesh(new THREE.SphereGeometry(1, 30, 16), mats.fus); hump.scale.set(1.7, 1.25, 15.5); hump.position.set(0, CY + 1.35, -0.5); body.add(hump); }
    if (type === 'hyperion') { const hump = new THREE.Mesh(new THREE.SphereGeometry(1, 30, 16), mats.fus); hump.scale.set(1.35, 0.9, 10); hump.position.set(0, CY + 1.3, -7); body.add(hump);
      const cg = cache.cang || (cache.cang = wingGeom({ span: 4.2, rc: 2.6, tc: 1.0, sweep: 35, dih: 3, th: 0.1, x0: 1.4, y0: 3.4, z0: -13.5 }, 1)); body.add(new THREE.Mesh(cg, mats.wing), new THREE.Mesh(cache.cangm || (cache.cangm = mirrorG(cg)), mats.wing)); }   // plans canard à l'avant (fuselage très long)
    const pods = [];
    if (type === 'colosse') for (const sx of [1, -1]) {
      const pod = new THREE.Mesh(fuselageGeom(), mats.fus); pod.scale.set(0.5, 0.72, 0.78); pod.position.set(sx * 8.6, 0.55 - droop(8.6), 1.4); body.add(pod); pods.push(pod);
      const pf2 = new THREE.Mesh(fg, mats.fin); pf2.scale.set(1, 0.6, 0.62); pf2.position.set(sx * 8.6, 0.9 - droop(8.6), 6.2); body.add(pf2);
    }
    const tip = wingPt(WINGt, 1, 0, 0), SH = { span: 2.3, rc: 1.5, tc: 0.55, sweep: 38, dih: 80, th: 0.08, x0: tip.x - 0.05, y0: tip.y, z0: tip.z + 0.05 };
    const sg = cache['sg' + wk] || (cache['sg' + wk] = wingGeom(SH, 1)), tipR = new THREE.Mesh(sg, mats.fin), tipL = new THREE.Mesh(cache['sgm' + wk] || (cache['sgm' + wk] = mirrorG(sg)), mats.fin); body.add(tipR); body.add(tipL);
    if (type !== 'geant') for (const sx of [1, -1]) { const d = new THREE.Mesh(new THREE.CircleGeometry(1.0, 28), mats.acc); d.position.set(sx * 0.33, 8.3, 16.6); d.rotation.y = sx * Math.PI / 2; body.add(d); }
    // gouvernes
    const S = {};
    const pf = plate(WINGt, 0.0, 0.6, 0.75, 1.0), pa = plate(WINGt, 0.6, 0.985, 0.75, 1.0), pe = plate(HSTAB, 0.02, 0.98, 0.7, 1.0), pr = plate(FIN, 0.04, 0.96, 0.68, 1.0);
    S.flapR = surface(body, pf, mats.surf); S.flapL = surface(body, pf, mats.surf, true);
    S.ailR = surface(body, pa, mats.surf); S.ailL = surface(body, pa, mats.surf, true);
    S.elevR = surface(body, pe, mats.surf); S.elevL = surface(body, pe, mats.surf, true);
    S.rud = surface(body, pr, mats.fin);
    // An-225 « Mriya » : grand empennage horizontal à fort dièdre, deux grandes dérives ovales en bout avec gouvernes de direction, pas de dérive centrale
    if (type === 'geant') {
      finM.visible = false; S.rud.visible = false; hsR.visible = hsL.visible = false; S.elevR.visible = S.elevL.visible = false;
      const HT = { span: 8.8, rc: 4.8, tc: 2.5, sweep: 24, dih: 9.5, th: 0.1, x0: 0.25, y0: 4.75, z0: 13.0 };
      const htg = cache.ht225 || (cache.ht225 = wingGeom(HT, 0.7)); body.add(new THREE.Mesh(htg, mats.wing), new THREE.Mesh(cache.ht225m || (cache.ht225m = mirrorG(htg)), mats.wing));
      const pe2 = plate(HT, 0.03, 0.95, 0.7, 1.0); S.elevR = surface(body, pe2, mats.surf); S.elevL = surface(body, pe2, mats.surf, true);
      const tp = wingPt(HT, 0.97, 0.5, 0), ch = 3.9;
      const FU = { span: 5.4, rc: ch + 0.6, tc: 2.6, sweep: 30, dih: 90, th: 0.1, x0: tp.x, y0: tp.y - 0.1, z0: tp.z - ch / 2 - 0.3 };
      const FD = { span: 1.7, rc: ch, tc: 2.2, sweep: -18, dih: -90, th: 0.1, x0: tp.x, y0: tp.y + 0.1, z0: tp.z - ch / 2 };
      for (const sx of [1, -1]) {
        const fu = sx > 0 ? FU : Object.assign({}, FU, { x0: -FU.x0 }), fd = sx > 0 ? FD : Object.assign({}, FD, { x0: -FD.x0 });
        body.add(new THREE.Mesh(wingGeom(fu, 0.7), mats.fin), new THREE.Mesh(wingGeom(fd, 0.7), mats.fin));
        const r = surface(body, plate(fu, 0.05, 0.95, 0.7, 1.0), mats.acc); if (sx > 0) S.rud = r; else S.rud2 = r;
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), mats.fin); cap.scale.set(1, 0.6, 3.2); cap.position.set(sx * tp.x, tp.y, tp.z + 0.4); body.add(cap);   // carénage à la jonction
      }
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.4, 14), mats.fus); cone.rotation.x = Math.PI / 2; cone.position.set(0, CY + 0.2, 19.6); body.add(cone);
    }
    // jet privé : empennage en T
    if (type === 'jet') { const sh = new V3(0, 6.6, 3.0); [hsR, hsL].forEach(m => m.position.add(sh)); [S.elevR, S.elevL].forEach(p => p.userData.h.add(sh)); }
    // bosse du pont supérieur (type 747)
    if (type === 'jumbo') { const hump = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16), mats.white); hump.scale.set(1.25, 1.05, 7.2); hump.position.set(0, CY + 1.45, -10.0); body.add(hump);
      const hw = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.18, 7.5), mats.dark); hw.position.set(0, CY + 2.0, -10.5); body.add(hw); }
    S.spR = []; S.spL = [];
    for (let i = 0; i < 5; i++) { const s0 = 0.08 + i * 0.1, p = plate(WINGt, s0, s0 + 0.095, 0.58, 0.745, true); S.spR.push(surface(body, p, mats.surf)); S.spL.push(surface(body, p, mats.surf, true)); }
    // slats (bord d'attaque)
    // réacteurs
    const engs = [];
    if (type === 'jet') for (const sx of [1, -1]) { const e = engine(mats, simple); e.position.set(sx * 3.05, 4.55, 12.0); e.rotation.z = sx * Math.PI / 2; e.scale.setScalar(0.9); body.add(e); engs.push(e); }
    else for (const sx of [1, -1]) { const e = engine(mats, simple); e.position.set(sx * 5.75, 1.55, -2.0); body.add(e); engs.push(e); }
    if (type === 'geant') for (const sx of [1, -1]) for (const [ex, ez] of [[9.4, 0.9], [13.0, 2.6]]) { const e = engine(mats, simple); e.position.set(sx * ex, 1.85 + ex * 0.06 - droop(ex), ez); e.scale.setScalar(0.92); body.add(e); engs.push(e); }
    if (type === 'titan') for (const sx of [1, -1]) for (const ex of [9.0, 12.0, 14.8]) { const e = engine(mats, simple); e.position.set(sx * ex, 1.55 + (ex - 5.75) * 0.096 - droop(ex), -2.0 + (ex - 5.75) * 0.5); e.scale.setScalar(0.92); body.add(e); engs.push(e); }
    if (type === 'colosse') for (const sx of [1, -1]) for (const ex of [11.0, 13.2, 15.4]) { const e = engine(mats, simple); e.position.set(sx * ex, 1.55 + (ex - 5.75) * 0.096 - droop(ex), -2.0 + (ex - 5.75) * 0.5); e.scale.set(0.62, 0.8, 0.8); body.add(e); engs.push(e); }
    if (type === 'leviathan' || type === 'hyperion') for (const sx of [1, -1]) for (const ex of type === 'leviathan' ? [8.6, 11.4, 14.2, 17.0, 19.8] : [9.2, 12.6, 16.0]) { const e = engine(mats, simple); e.position.set(sx * ex, 1.55 + (ex - 5.75) * 0.096 - droop(ex), -2.0 + (ex - 5.75) * 0.5); e.scale.set(type === 'leviathan' ? 0.62 : 0.72, 0.85, 0.85); body.add(e); engs.push(e); }
    if (type === 'jumbo' || type === 'super') for (const sx of [1, -1]) { const e = engine(mats, simple); e.position.set(sx * 10.6, 2.15 - droop(10.6), 0.6); e.scale.setScalar(0.92); body.add(e); engs.push(e); }
    // train d'atterrissage
    const gear = { main: [], nose: null, wheels: [] };
    const axles = ['geant', 'titan', 'colosse', 'leviathan', 'hyperion'].includes(type) ? [-2.1, -1.05, 0, 1.05, 2.1] : type === 'super' ? [-1.05, 0, 1.05] : ['gros', 'jumbo'].includes(type) ? [-0.72, 0.72] : [0];
    const legs = [[3.8, 0]]; if (type === 'jumbo' || type === 'super' || type === 'geant' || type === 'titan') legs.push([1.9, 2.6]); if (type === 'titan' || type === 'leviathan') legs.push([1.9, -2.6]); if (type === 'leviathan') legs.push([1.9, 5.2], [3.8, 2.6]); if (type === 'hyperion') legs.push([1.9, 2.6], [1.9, -5.5], [1.9, -8]); if (type === 'colosse') legs.push([8.6, 0.6]);
    legs.forEach(([lx, lz]) => {
      for (const sx of [1, -1]) {
        const piv = new THREE.Group(); piv.position.set(sx * lx, 2.45, lz);
        oleo(piv, 1.87, 0.14, mats, lx > 3 ? sx : 0, simple);
        if (axles.length > 1) {
          // bogie : poutre à plusieurs essieux
          const beam = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, (axles[axles.length - 1] - axles[0]) + 0.35), mats.strut); beam.position.y = -1.87; piv.add(beam);
        }
        axles.forEach(az => {
          const ax = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 8).rotateZ(Math.PI / 2), mats.metal); ax.position.set(0, -1.87, az); piv.add(ax);
          for (const wx of [-0.47, 0.47]) { const w = wheel(0.58, 0.4, mats, simple, true); w.position.set(wx, -1.87, az); if (wx * sx < 0) w.rotation.y = Math.PI; piv.add(w); gear.wheels.push({ w, r: 0.58 }); }
        });
        body.add(piv); gear.main.push({ piv, sx });
      }
    });
    { const piv = new THREE.Group(); piv.position.set(0, 2.3, -11.0);
      oleo(piv, 1.55, 0.1, mats, 0, simple);
      const low = new THREE.Group(); low.position.y = -1.9; piv.add(low);
      const ax = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.62, 8).rotateZ(Math.PI / 2), mats.metal); low.add(ax);
      if (!simple) { const fk = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.14), mats.strut); fk.position.set(0, 0.22, 0.05); low.add(fk); }
      for (const wx of [-0.27, 0.27]) { const w = wheel(0.38, 0.26, mats, simple, false); w.position.x = wx; if (wx < 0) w.rotation.y = Math.PI; low.add(w); gear.wheels.push({ w, r: 0.38 }); }
      body.add(piv); gear.nose = { piv, low }; }
    // trappes de train (se ferment quand les roues sont rentrées dans le fuselage)
    gear.doors = [];
    for (const sx of [1, -1]) {
      const dp = new THREE.Group(); dp.position.set(sx * 2.25, 1.98, 0.1);
      const d = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.06, 2.3), mats.wing); d.position.x = -sx * 0.88; dp.add(d); body.add(dp);
      gear.doors.push({ p: dp, ax: 'z', open: sx * 1.45 });
    }
    for (const sx of [1, -1]) {
      const dp = new THREE.Group(); dp.position.set(sx * 0.52, 1.93, -12.0);
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 2.3), mats.white); d.position.x = -sx * 0.25; dp.add(d); body.add(dp);
      gear.doors.push({ p: dp, ax: 'z', open: sx * 1.4 });
    }
    // nez : joint du radôme, sondes pitot, sondes d'incidence, essuie-glaces, antennes
    if (!simple) {
      const rz = -17.85, seam = new THREE.Mesh(new THREE.TorusGeometry(rAt(rz) + 0.004, 0.012, 6, 40), mats.rimDark); seam.position.set(0, CY + yOff(rz), rz); body.add(seam);
      for (const sx of [1, -1]) {
        for (const [pz, ang] of [[-15.9, -18], [-15.5, -28]]) {
          const rr = rAt(pz), a = ang * D2R, base = new THREE.Vector3(sx * rr * Math.cos(a), CY + yOff(pz) + rr * Math.sin(a), pz);
          const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.42, 6).rotateX(Math.PI / 2), mats.chrome); pit.position.copy(base).add(new THREE.Vector3(sx * 0.07, 0, -0.18)); body.add(pit);
          const mt = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.14), mats.metal); mt.position.copy(base).add(new THREE.Vector3(sx * 0.03, 0, 0.02)); body.add(mt);
        }
        const aoa = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.09, 0.14), mats.dark); const az = -14.9, rr = rAt(az); aoa.position.set(sx * (rr + 0.02), CY + yOff(az) + 0.25, az); body.add(aoa);
        const wz = -16.95, wr = rAt(wz), wip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.55), mats.dark);
        wip.position.set(sx * 0.42, CY + yOff(wz) + wr * 0.88, wz + 0.1); wip.rotation.set(-0.95, sx * 0.25, 0); body.add(wip);
      }
      const ant = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.3), mats.white); ant.position.set(0, CY + 2.12, -6); ant.rotation.x = 0.25; body.add(ant);
      const ant2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.22), mats.white); ant2.position.set(0, CY - 2.1, -9); body.add(ant2);
      // antennes VHF / GPS supplémentaires, dôme satellite sur les long-courriers
      [[CY + 2.0, 3.5, 0.2], [CY + 2.02, -11.5, 0.12], [CY - 2.05, 4.5, 0.16]].forEach(([y, z, h]) => { const a2 = new THREE.Mesh(new THREE.BoxGeometry(0.035, h, 0.18), mats.white); a2.position.set(0, y + (y > CY ? h / 2 : -h / 2), z); a2.rotation.x = y > CY ? 0.3 : -0.3; body.add(a2); });
      if (['gros', 'jumbo', 'super', 'titan', 'leviathan', 'hyperion', 'colosse'].includes(type)) { const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.white); dome.scale.set(0.5, 0.2, 1.4); dome.position.set(0, CY + 1.96, 1.5); body.add(dome); }
      // carénages des rails de volets (« canoës ») sous l'aile
      const canoe = new THREE.SphereGeometry(1, 14, 8);
      for (const sp of [0.18, 0.4, 0.62]) for (const sx of [1, -1]) {
        const pB = wingPt(WINGt, sp, 0.78, -1), c = new THREE.Mesh(canoe, mats.wing); c.scale.set(0.16, 0.2, 1.35); c.position.set(sx * pB.x, pB.y - 0.12, pB.z + 0.55); body.add(c);
      }
      // déchargeurs d'électricité statique au bord de fuite (ailes, stabilisateurs, dérive)
      const wick = new THREE.CylinderGeometry(0.008, 0.008, 0.32, 4).rotateX(Math.PI / 2), wm = mats.dark;
      for (const sp of [0.8, 0.88, 0.95, 1.0]) for (const sx of [1, -1]) { const pT = wingPt(WINGt, sp, 1, 0), w = new THREE.Mesh(wick, wm); w.position.set(sx * pT.x, pT.y, pT.z + 0.15); body.add(w); }
      if (type !== 'geant' && type !== 'jet') { for (const sp of [0.85, 1.0]) for (const sx of [1, -1]) { const pT = wingPt(HSTAB, sp, 1, 0), w = new THREE.Mesh(wick, wm); w.position.set(sx * pT.x, pT.y, pT.z + 0.15); body.add(w); }
        for (const sp of [0.7, 0.85, 1.0]) { const pT = wingPt(FIN, sp, 1, 0), w = new THREE.Mesh(wick, wm); w.position.set(pT.x, pT.y, pT.z + 0.15); body.add(w); } }
      // sortie d'échappement de l'APU (petit réacteur auxiliaire) au bout de la queue
      const apu = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.35, 14, 1, true).rotateX(Math.PI / 2), mats.rimDark); apu.position.set(0, CY + yOff(18.9) + 0.03, 18.95); body.add(apu);
    }
    // feux
    const lt = {};
    lt.navL = glowSprite(0xff2020, 1.6); lt.navL.position.copy(tip).setX(-tip.x - 0.3); body.add(lt.navL);
    lt.navR = glowSprite(0x20ff50, 1.6); lt.navR.position.copy(tip).setX(tip.x + 0.3); body.add(lt.navR);
    lt.tail = glowSprite(0xffffff, 1.2); lt.tail.position.set(0, CY + yOff(19) + 0.1, 19.1); body.add(lt.tail);
    lt.strL = glowSprite(0xffffff, 4); lt.strL.position.copy(lt.navL.position).add(new V3(0, 0, 0.6)); body.add(lt.strL);
    lt.strR = glowSprite(0xffffff, 4); lt.strR.position.copy(lt.navR.position).add(new V3(0, 0, 0.6)); body.add(lt.strR);
    lt.beaT = glowSprite(0xff2a10, 2.2); lt.beaT.position.set(0, CY + 2.02, 0.5); body.add(lt.beaT);
    lt.beaB = glowSprite(0xff2a10, 2.2); lt.beaB.position.set(0, 1.62, 3.5); body.add(lt.beaB);
    lt.landL = glowSprite(0xfff6e0, 3); lt.landL.position.set(-2.6, 2.3, -3.8); body.add(lt.landL);
    lt.landR = glowSprite(0xfff6e0, 3); lt.landR.position.set(2.6, 2.3, -3.8); body.add(lt.landR);
    lt.taxi = glowSprite(0xfff6e0, 2); lt.taxi.position.set(0, 0.9, -11.3); gear.nose.piv.add(lt.taxi); lt.taxi.position.set(0, -1.0, -0.3);
    lt.wingL = glowSprite(0xdfe8ff, 1.2); lt.wingL.position.set(-1.9, 4.2, -5.5); body.add(lt.wingL);
    lt.wingR = glowSprite(0xdfe8ff, 1.2); lt.wingR.position.set(1.9, 4.2, -5.5); body.add(lt.wingR);
    // porte avant gauche (L1) : elle sort un peu du fuselage puis pivote vers l'avant, comme sur un Airbus
    const dz = -14.7, dr = rAt(dz), dH = 1.86, dW = 0.84, dy = CY + yOff(dz) + 0.08;
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(dW, dH), new THREE.MeshBasicMaterial({ color: 0x1a1c20 })); hole.rotation.y = -Math.PI / 2; hole.position.set(-dr + 0.012, dy, dz); body.add(hole);
    const dpiv = new THREE.Group(); dpiv.position.set(-dr - 0.03, dy, dz - dW / 2); body.add(dpiv);
    const dslide = new THREE.Group(); dpiv.add(dslide);
    const dpan = new THREE.Mesh(new THREE.BoxGeometry(0.07, dH, dW), mats.white); dpan.position.set(0, 0, dW / 2); dslide.add(dpan);
    const dwin = new THREE.Mesh(new THREE.CircleGeometry(0.11, 14), mats.dark); dwin.rotation.y = -Math.PI / 2; dwin.position.set(-0.037, 0.38, dW / 2); dslide.add(dwin);
    const dhan = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.3), mats.metal); dhan.position.set(-0.045, 0.02, dW / 2 + 0.12); dslide.add(dhan);
    const dfr = new THREE.Mesh(new THREE.BoxGeometry(0.02, dH + 0.08, dW + 0.08), mats.dark); dfr.position.set(0.035, 0, dW / 2); dslide.add(dfr);
    const setDoor = k => { const a = clamp(k / 0.3, 0, 1), b = clamp((k - 0.3) / 0.7, 0, 1); dpiv.position.x = -dr - 0.03 - 0.26 * a; dpiv.rotation.y = -b * 2.85; };
    setDoor(0);
    const out = { root, body, mats, S, engs, gear, lt, simple, setDoor };
    // dégâts visibles après un choc : le bout d'aile ou le haut de la dérive est arraché (il tombe)
    out.dmg = { wingL: 0, wingR: 0, fin: 0 };
    out.damage = function (part, k) {
      k = clamp(k, 0, 1); out.dmg[part] = Math.max(out.dmg[part] || 0, k); const d = out.dmg[part];
      if (part === 'wingL' || part === 'wingR') {
        const L = part === 'wingL', w = L ? wingL : wingR, tip = L ? tipL : tipR, nav = L ? lt.navL : lt.navR, str = L ? lt.strL : lt.strR, ail = L ? S.ailL : S.ailR;
        // l'aile se tord et se froisse : la partie extérieure plie vers le bas et vers l'arrière, la tôle est cabossée, le bout arraché est coupé en dents de scie
        const base = L ? wgm : wg, g2 = base.clone(), pa = g2.attributes.position, xr = WINGt.x0, spn = WINGt.span, cut = 1 - 0.42 * d, s0 = Math.max(0.25, cut - 0.35), seed = (out.dmgSeed = out.dmgSeed || Math.random() * 10);
        for (let i = 0; i < pa.count; i++) {
          const x = pa.getX(i), ax = Math.abs(x), sg = Math.sign(x) || 1; let sp = (ax - xr) / spn, y = pa.getY(i), z = pa.getZ(i);
          if (sp > cut) { const jag = 0.025 * Math.sin(z * 9 + seed) * d; sp = cut + jag; }
          if (sp > s0) { const t = (sp - s0) / Math.max(0.05, 1 - s0);
            y -= t * t * d * 1.6 + Math.sin(sp * 37 + seed) * Math.sin(z * 5.3 + seed * 2) * 0.09 * d * t;      // pliure vers le bas + bosses
            z += t * t * d * 0.7;                                                                               // l'aile recule en se tordant
            y += (z - (WINGt.z0 + Math.tan(WINGt.sweep * D2R) * sp * spn)) * -0.05 * d * t;                    // vrillage
          }
          pa.setXYZ(i, sg * (xr + sp * spn), y, z);
        }
        g2.computeVertexNormals(); if (w.geometry !== wg && w.geometry !== wgm) w.geometry.dispose(); w.geometry = g2;
        tip.visible = d < 0.12; if (nav) nav.visible = d < 0.12; if (str) str.visible = d < 0.12; if (ail) ail.visible = d < 0.3; const fl = L ? S.flapL : S.flapR; if (fl) fl.visible = d < 0.6;
        out.navOff = out.navOff || {}; out.navOff[part] = d >= 0.12;
      } else if (part === 'fin') { finM.scale.y = 1 - 0.5 * d; if (S.rud) S.rud.visible = d < 0.3; if (S.rud2) S.rud2.visible = d < 0.3; }
    };
    out.repair = function () { out.dmg = { wingL: 0, wingR: 0, fin: 0 }; out.dmgSeed = 0; out.navOff = {}; if (wingL.geometry !== wgm) { wingL.geometry.dispose(); wingL.geometry = wgm; } if (wingR.geometry !== wg) { wingR.geometry.dispose(); wingR.geometry = wg; } tipL.visible = tipR.visible = true; [lt.navL, lt.navR, lt.strL, lt.strR, S.ailL, S.ailR, S.flapL, S.flapR, S.rud].forEach(o => { if (o) o.visible = true; }); finM.scale.y = 1; if (type === 'geant') finM.visible = false; out.navOff = {}; };
    if (!simple) {
      const spot = new THREE.SpotLight(0xfff4e0, 0, 2200, 0.32, 0.55, 1.2); spot.position.set(0, 2.4, -12);
      const tgt = new THREE.Object3D(); tgt.position.set(0, -40, -400); body.add(tgt); spot.target = tgt; body.add(spot); out.spot = spot;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(55, 420, 24, 1, true).translate(0, -210, 0).rotateX(Math.PI / 2 - 0.1),
        new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true }));
      cone.position.set(0, 2.3, -6); body.add(cone); out.cone = cone;
    }
    out.update = function (s) {
      const fl = s.flapPos, fa = [0, 10, 15, 20, 35][0] + fl * 35 * D2R;
      setSurf(S.flapR, fl * 32 * D2R, fl * 1.1, fl * 0.15); setSurf(S.flapL, fl * 32 * D2R, fl * 1.1, fl * 0.15);
      const ai = s.ail * 20 * D2R; setSurf(S.ailR, -ai + fl * 5 * D2R); setSurf(S.ailL, ai + fl * 5 * D2R);
      const ev = -s.elev * 25 * D2R; setSurf(S.elevR, ev); setSurf(S.elevL, ev);
      setSurf(S.rud, s.rud * 25 * D2R); if (S.rud2) setSurf(S.rud2, s.rud * 25 * D2R);
      S.spR.forEach(p => setSurf(p, -(s.spoil * 45 + Math.max(0, s.ail) * 25) * D2R));
      S.spL.forEach(p => setSurf(p, -(s.spoil * 45 + Math.max(0, -s.ail) * 25) * D2R));
      const gk = 1 - s.gearPos;
      gear.main.forEach(m => m.piv.rotation.z = -m.sx * gk * 1.45);
      gear.nose.piv.rotation.x = gk * 1.55; gear.nose.low.rotation.y = s.steer || 0;
      const shown = s.gearPos > 0.015; gear.main.forEach(m => m.piv.visible = shown); gear.nose.piv.visible = shown;
      const dOpen = s.gearPos > 0.015 && s.gearPos < 0.985 ? 1 : 0; out.doorK = (out.doorK || 0) + clamp(dOpen - (out.doorK || 0), -s.dt * 1.5, s.dt * 1.5);
      gear.doors.forEach(d => d.p.rotation.z = d.open * out.doorK);
      gear.wheels.forEach(w => { w.w.rotation.x -= (s.wheelV || 0) * s.dt / w.r; });
      engs.forEach((e, i) => { e.userData.fan.rotation.z += (s.n1[i % 2] || 0) * 60 * s.dt;
        const u = e.userData; if (u.sleeve) { u.revK += clamp((s.rev ? 1 : 0) - u.revK, -s.dt * 0.6, s.dt * 0.6); u.sleeve.position.z = 1.18 + 0.62 * u.revK; u.casc.visible = u.sleeve.visible = u.revK > 0.02; } });
      const t = s.t, N = s.night, L = s.lights;
      const no = out.navOff || {};
      lt.navL.visible = !!L.nav && !no.wingL; lt.navR.visible = !!L.nav && !no.wingR; lt.tail.visible = !!L.nav;
      const sf = (t % 1.2), sOn = !!L.strobe && (sf < 0.05 || (sf > 0.12 && sf < 0.17)); lt.strL.visible = sOn && !no.wingL; lt.strR.visible = sOn && !no.wingR;
      const bf = (t % 1.0) < 0.1; lt.beaT.visible = lt.beaB.visible = !!L.beacon && bf;
      lt.landL.visible = lt.landR.visible = !!L.landing; lt.taxi.visible = !!L.taxi && s.gearPos > 0.9;
      lt.wingL.visible = lt.wingR.visible = !!L.wing;
      mats.fus.emissive.setHex(L.cabin ? 0xffcf8a : 0x000000); mats.fus.emissiveIntensity = 0.35 + N * 0.9;
      const lg = L.logo && N > 0.3 ? 0x2a2a2a : 0x000000; mats.fin.emissive.setHex(lg); mats.acc.emissive.setHex(lg);
      if (out.spot) {
        const on = (L.landing ? 1 : 0) + (L.taxi && s.gearPos > 0.9 ? 0.5 : 0);
        out.spot.intensity = on * (0.4 + N * 2.4); out.cone.visible = on > 0 && N > 0.35;
      }
    };
    out.update({ flapPos: 0, ail: 0, elev: 0, rud: 0, spoil: 0, gearPos: 1, n1: [0, 0], dt: 0, t: 0, night: 0, lights: {} });
    return out;
  };
  // Avion de chasse delta-canard (type Rafale) : aile delta, plans canard, deux réacteurs avec postcombustion, verrière bulle, missiles
  // peinture du Rafale : panneaux, rivets, trappes, salissures et marquages (fictifs) — 3 schémas
  const fSkinCache = {};
  function fighterSkin(style) {
    if (fSkinCache[style]) return fSkinCache[style];
    const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
    let seed = 99; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const base = { gris: ['#59626b', '#4f5861', '#636c75'], desert: ['#a89272', '#8f7a5c', '#bba887'], noir: ['#24272b', '#1c1f22', '#2d3136'], rouge: ['#8a3a30', '#74302a', '#9c4a3c'] }[style] || ['#59626b', '#4f5861', '#636c75'];
    x.fillStyle = base[0]; x.fillRect(0, 0, N, N);
    // grands panneaux légèrement différents de teinte
    for (let i = 0; i < 90; i++) { x.fillStyle = base[1 + (i % 2)]; x.globalAlpha = 0.35 + rnd() * 0.3; x.fillRect(Math.floor(rnd() * 16) * 64, Math.floor(rnd() * 16) * 64, 64 * (1 + Math.floor(rnd() * 3)), 64 * (1 + Math.floor(rnd() * 2))); }
    if (style === 'desert') { x.globalAlpha = 0.55; for (let i = 0; i < 40; i++) { x.fillStyle = i % 2 ? '#6f5f45' : '#c9b48e'; x.beginPath(); const cx = rnd() * N, cy = rnd() * N; for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28, r = 40 + rnd() * 70; x[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r); } x.fill(); } }
    x.globalAlpha = 1;
    // lignes de panneaux
    x.strokeStyle = 'rgba(0,0,0,0.45)'; x.lineWidth = 2;
    for (let i = 0; i <= N; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, N); x.stroke(); }
    for (let j = 0; j <= N; j += 128) { x.beginPath(); x.moveTo(0, j); x.lineTo(N, j); x.stroke(); }
    x.strokeStyle = 'rgba(255,255,255,0.07)'; x.lineWidth = 1;
    for (let i = 2; i <= N; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, N); x.stroke(); }
    // trappes d'accès et rivets
    for (let i = 0; i < 60; i++) { const w = 16 + rnd() * 40, h = 12 + rnd() * 30, px = rnd() * N, py = rnd() * N; x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 1.5; x.strokeRect(px, py, w, h); x.fillStyle = 'rgba(0,0,0,0.55)'; for (const [qx, qy] of [[2, 2], [w - 4, 2], [2, h - 4], [w - 4, h - 4]]) x.fillRect(px + qx, py + qy, 2, 2); }
    x.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 0; i < N; i += 64) for (let j = 5; j < N; j += 9) { x.fillRect(i + 4, j, 1.6, 1.6); x.fillRect(i + 59, j, 1.6, 1.6); }
    // salissures et coulures d'huile
    for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(${rnd() < 0.7 ? '0,0,0' : '255,255,255'},${0.025 + rnd() * 0.05})`; const px = rnd() * N, py = rnd() * N; x.fillRect(px, py, 1 + rnd() * 3, 6 + rnd() * 40); }
    // marquages fictifs : numéro d'escadron et bandes de sécurité
    x.font = 'bold 54px Arial'; x.fillStyle = style === 'noir' ? 'rgba(180,186,192,0.55)' : 'rgba(25,28,32,0.6)'; x.fillText('4-GX', 140, 300); x.fillText('118', 660, 820);
    x.fillStyle = 'rgba(200,40,30,0.75)'; x.fillRect(420, 520, 90, 10); x.font = 'bold 18px Arial'; x.fillText('DANGER', 425, 550);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    return (fSkinCache[style] = t);
  }
  SIM.fighterSkin = fighterSkin;
  function planarUV(g, k) {
    if (g.attributes.uv) return;
    const p = g.attributes.position, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) + p.getY(i) * 0.3) * k; uv[i * 2 + 1] = p.getZ(i) * k; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  SIM.buildFighter = function (opt) {
    opt = opt || {};
    const M = (c, r, m) => new THREE.MeshStandardMaterial({ color: c, roughness: r == null ? 0.55 : r, metalness: m == null ? 0.25 : m, side: THREE.DoubleSide });
    const mats = { skin: M(0xffffff, 0.48, 0.42), dark: M(0x3d4349, 0.5), radome: M(0x5f666c, 0.45), metal: M(0x9aa0a6, 0.3, 0.8), nozzle: M(0x4a4440, 0.35, 0.8), tire: new THREE.MeshLambertMaterial({ color: 0x141414 }), strut: M(0xd8dbde, 0.3, 0.7), white: M(0xe8eaec, 0.4), red: M(0xb02020, 0.5) };
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const CYF = 2.05;
    // fuselage effilé
    const prof = [[8.6, 0], [8.2, 0.18], [7.2, 0.42], [6.0, 0.6], [4.6, 0.78], [3.2, 0.9], [1.5, 1.02], [0, 1.08], [-3, 1.05], [-5.5, 0.92], [-6.6, 0.78], [-6.9, 0.62]];
    const fg = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[1], -p[0])), 32); fg.rotateX(-Math.PI / 2);
    const fus = new THREE.Mesh(fg, mats.skin); fus.scale.set(1.12, 1, 1); fus.position.y = CYF; body.add(fus);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.6, 24).rotateX(-Math.PI / 2), mats.radome); nose.position.set(0, CYF, -9.2); body.add(nose);
    const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 6).rotateX(Math.PI / 2), mats.metal); pitot.position.set(0, CYF, -10.4); body.add(pitot);
    // dos et épine dorsale
    const spine = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), mats.skin); spine.scale.set(0.62, 0.42, 4.8); spine.position.set(0, CYF + 0.75, 1.2); body.add(spine);
    // verrière bulle
    const can = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhongMaterial({ color: 0x8a6a2a, specular: 0xffe7a0, shininess: 140, transparent: true, opacity: 0.55 }));
    can.scale.set(0.58, 0.62, 1.9); can.position.set(0, CYF + 0.72, -4.3); body.add(can);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.035, 6, 24, Math.PI), mats.dark); frame.position.set(0, CYF + 0.72, -3.6); body.add(frame);
    // entrées d'air sous les emplantures
    for (const sx of [1, -1]) {
      const inl = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 3.2), mats.skin); inl.position.set(sx * 0.95, CYF - 0.45, -0.6); body.add(inl);
      const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.72), mats.dark); mouth.position.set(sx * 0.95, CYF - 0.45, -2.21); mouth.rotation.y = Math.PI; body.add(mouth);
    }
    // aile delta, plans canard, dérive
    const WD = { span: 4.75, rc: 7.6, tc: 1.05, sweep: 52, dih: -2.5, th: 0.06, x0: 0.85, y0: CYF - 0.25, z0: -1.4 };
    const CN = { span: 1.75, rc: 1.7, tc: 0.45, sweep: 50, dih: 4, th: 0.05, x0: 0.75, y0: CYF + 0.38, z0: -4.7 };
    const FN = { span: 3.1, rc: 4.0, tc: 1.0, sweep: 50, dih: 90, th: 0.06, x0: 0, y0: CYF + 0.8, z0: 2.9 };
    const wg = wingGeom(WD, 0.82); body.add(new THREE.Mesh(wg, mats.skin)); body.add(new THREE.Mesh(mirrorG(wg), mats.skin));
    body.add(new THREE.Mesh(wingGeom(FN, 0.8), mats.skin));
    const S = {};
    const pe = plate(WD, 0.05, 0.95, 0.82, 1.0); S.evR = surface(body, pe, mats.dark); S.evL = surface(body, pe, mats.dark, true);
    S.rud = surface(body, plate(FN, 0.05, 0.85, 0.8, 1.0), mats.dark);
    // plans canard mobiles (pivot à leur emplanture)
    const cg = wingGeom(CN, 1);
    S.cnR = new THREE.Group(); S.cnL = new THREE.Group(); [S.cnR, S.cnL].forEach((p, i) => { p.position.set(0, CN.y0, CN.z0 + 0.8); const m = new THREE.Mesh(i ? mirrorG(cg) : cg, mats.skin); m.position.set(0, -CN.y0, -(CN.z0 + 0.8)); p.add(m); body.add(p); });
    // tuyères et postcombustion
    const engs = [], flames = [];
    for (const sx of [1, -1]) {
      const n = new THREE.Group(); n.position.set(sx * 0.46, CYF - 0.05, 6.9); body.add(n); engs.push(n);
      n.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.9, 20, 1, true).rotateX(Math.PI / 2), mats.nozzle));
      const inner = new THREE.Mesh(new THREE.CircleGeometry(0.36, 18), new THREE.MeshBasicMaterial({ color: 0x331a10 })); inner.position.z = 0.1; n.add(inner);
      const f1 = new THREE.Sprite(new THREE.SpriteMaterial({ map: SIM.glowTex('rgba(255,245,210,1)', 'rgba(255,110,30,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      const f2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: SIM.glowTex('rgba(170,210,255,1)', 'rgba(60,110,255,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      n.add(f1, f2); flames.push([f1, f2, inner]);
    }
    // missiles sous les ailes et en bout d'aile
    const missile = (x, y, z, len) => { const g = new THREE.Group(); g.position.set(x, y, z); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len, 10).rotateX(Math.PI / 2), mats.white); g.add(b); const t = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.35, 10).rotateX(-Math.PI / 2), mats.dark); t.position.z = -len / 2 - 0.17; g.add(t); for (let i = 0; i < 4; i++) { const fn = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.32, 0.3), mats.white); fn.position.z = len / 2 - 0.15; fn.rotation.z = i * Math.PI / 2; g.add(fn); } body.add(g); };
    for (const sx of [1, -1]) {
      const tip = wingPt(WD, 1, 0.4, 0); missile(sx * (tip.x + 0.12), tip.y, tip.z, 2.9);
      missile(sx * 2.6, CYF - 0.75, 2.6, 3.2); const py = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 1.4), mats.skin); py.position.set(sx * 2.6, CYF - 0.5, 2.6); body.add(py);
    }
    const tank = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), mats.skin); tank.scale.set(0.42, 0.42, 2.4); tank.position.set(0, CYF - 1.15, 0.6); body.add(tank);
    // emports lourds : missiles supplémentaires et réservoirs sous voilure (configuration « Rafale lourd »)
    for (const sx of [1, -1]) {
      for (const [px, pz] of [[1.75, 1.2], [3.45, 3.3]]) { missile(sx * px, CYF - 0.78, pz, 3.0); const py = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 1.2), mats.skin); py.position.set(sx * px, CYF - 0.52, pz); body.add(py); }
      const wt = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10), mats.skin); wt.scale.set(0.36, 0.36, 2.0); wt.position.set(sx * 2.15, CYF - 0.95, 0.4); body.add(wt);
      const wp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 1.0), mats.skin); wp.position.set(sx * 2.15, CYF - 0.6, 0.4); body.add(wp);
    }
    // peinture : texture de panneaux sur toute la cellule
    mats.skin.map = fighterSkin(opt.style || 'gris'); mats.skin.needsUpdate = true;
    body.traverse(o => { if (o.isMesh && o.material === mats.skin) planarUV(o.geometry, 0.16); });
    mats.dark.color.setHex(opt.style === 'noir' ? 0x15171a : 0x2e3338);
    // train tricycle rétractable
    const gear = { legs: [] };
    const leg = (x, z, len, r, steer) => { const p = new THREE.Group(); p.position.set(x, CYF - 0.55, z); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 8), mats.strut); st.position.y = -len / 2; p.add(st); const w = wheel(r, r * 0.6, { tire: mats.tire, metal: mats.metal, dark: mats.dark }); w.position.y = -len; p.add(w); body.add(p); gear.legs.push({ p, steer }); return p; };
    leg(0, -5.0, 1.12, 0.3, true); leg(1.45, 1.2, 1.1, 0.4); leg(-1.45, 1.2, 1.1, 0.4);
    // feux de navigation
    const lt = {};
    const tipL = wingPt(WD, 1, 0.1, 0);
    lt.navL = glowSprite(0xff2020, 1.2); lt.navL.position.set(-tipL.x - 0.2, tipL.y, tipL.z); body.add(lt.navL);
    lt.navR = glowSprite(0x20ff50, 1.2); lt.navR.position.set(tipL.x + 0.2, tipL.y, tipL.z); body.add(lt.navR);
    lt.land = glowSprite(0xfff6e0, 2); lt.land.position.set(0, CYF - 1.4, -4.8); body.add(lt.land);
    const out = { root, body, mats, S, engs, gear, lt, simple: false, fighter: true, flames: [], eye: [0, CYF + 0.95, -4.3] };
    out.update = function (s) {
      const pitch = -s.elev * 22 * D2R, roll = s.ail * 18 * D2R;
      setSurf(S.evR, pitch - roll); setSurf(S.evL, pitch + roll); setSurf(S.rud, s.rud * 25 * D2R);
      S.cnR.rotation.x = S.cnL.rotation.x = s.elev * 0.35;
      const gk = 1 - s.gearPos; gear.legs.forEach((l, i) => { l.p.rotation.x = i === 0 ? gk * 1.5 : -gk * 1.45; l.p.visible = s.gearPos > 0.02; if (l.steer) l.p.children[1].rotation.y = s.steer || 0; });
      const n = (s.n1[0] + s.n1[1]) / 2, ab = (s.ab || n > 0.97) ? 1 : 0;
      flames.forEach(([f1, f2, inner]) => { const k = 0.85 + Math.random() * 0.3; f1.visible = f2.visible = ab > 0 || n > 0.6; const sc = ab ? 4.2 * k : 1.2 * n; f1.scale.set(sc, sc, 1); f1.position.z = 0.6 + (ab ? 1.6 * k : 0.2); f2.scale.setScalar(ab ? 1.6 * k : 0.6); f2.position.z = 0.35; inner.material.color.setHex(n > 0.5 ? 0xff7a2a : 0x331a10); });
      lt.navL.visible = lt.navR.visible = !!s.lights.nav; lt.land.visible = !!s.lights.landing && s.gearPos > 0.9;
    };
    out.update({ elev: 0, ail: 0, rud: 0, gearPos: 1, n1: [0.2, 0.2], lights: {} });
    return out;
  };
})();
