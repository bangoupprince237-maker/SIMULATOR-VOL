// Vie autour des aéroports : hélicoptères, personnes (personnel au sol, passagers) et animaux (zébus, antilopes, éléphants, vaches)
(function () {
  const D2R = SIM.D2R, clamp = SIM.clamp;
  const L = SIM.life = { helis: [], people: [], herds: [] };
  const S = (c, r) => new THREE.MeshStandardMaterial({ color: c, roughness: r == null ? 0.7 : r });
  const sph = (r, m, sx, sy, sz, x, y, z) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); return o; };
  const cyl = (r1, r2, h, m, x, y, z) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 12), m); o.position.set(x, y, z); return o; };
  let scene;

  // ---------- Hélicoptères ----------
  // boîte aux arêtes arrondies
  const RBC = {};
  function rbox(w, h, d, r) {
    const k = [w, h, d, r].join(); if (RBC[k]) return RBC[k];
    const g = new THREE.BoxGeometry(w, h, d, 8, 8, 8), p = g.attributes.position, ix = w / 2 - r, iy = h / 2 - r, iz = d / 2 - r, v = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.set(p.getX(i), p.getY(i), p.getZ(i)); c.set(clamp(v.x, -ix, ix), clamp(v.y, -iy, iy), clamp(v.z, -iz, iz)); const dv = v.clone().sub(c); if (dv.lengthSq() > 1e-12) v.copy(c).addScaledVector(dv.normalize(), r); p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals(); return (RBC[k] = g);
  }
  const HPAL = {
    armee: { body: 0x4b5320, acc: 0x3a4119, belly: 0x434a1e, txt: 'ARMÉE' }, attaque: { body: 0x3d4630, acc: 0x2c3323, belly: 0x353c29, txt: '' },
    samu: { body: 0xf3f4f6, acc: 0xd42a2a, belly: 0xd9dadc, txt: 'SAMU' }, police: { body: 0x1d3f8a, acc: 0xf2f2f2, belly: 0x15306b, txt: 'POLICE' },
  };
  // Hélicoptères réalistes : utilitaire militaire à 4 pales (type Black Hawk / NH90) et hélicoptère d'attaque biplace en tandem (type Tigre / Apache)
  // peau : camouflage militaire (taches) ou peinture civile, avec lignes de panneaux et rivets
  const skinCache = {};
  function heliSkin(kind, pal) {
    if (skinCache[kind]) return skinCache[kind];
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
    const hex = n => '#' + n.toString(16).padStart(6, '0');
    x.fillStyle = hex(pal.body); x.fillRect(0, 0, 512, 512);
    let seed = kind.length * 977; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    if (kind === 'armee' || kind === 'attaque') {
      const cols = kind === 'armee' ? ['#3b4219', '#5d5a33', '#2a2e16', '#57612a'] : ['#2f3627', '#454d39', '#262b20', '#3a412f'];
      for (let i = 0; i < 70; i++) {
        x.fillStyle = cols[i % cols.length]; x.beginPath();
        const cx = rnd() * 512, cy = rnd() * 512, r = 18 + rnd() * 46, n = 9;
        for (let k = 0; k <= n; k++) { const a = k / n * Math.PI * 2, rr = r * (0.55 + rnd() * 0.6); x[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr * 1.6, cy + Math.sin(a) * rr); }
        x.fill();
      }
    }
    // lignes de panneaux et rivets
    x.strokeStyle = 'rgba(0,0,0,0.28)'; x.lineWidth = 1.4;
    for (let i = 0; i < 512; i += 64) { x.beginPath(); x.moveTo(i + 0.5, 0); x.lineTo(i + 0.5, 512); x.stroke(); }
    for (let j = 0; j < 512; j += 96) { x.beginPath(); x.moveTo(0, j + 0.5); x.lineTo(512, j + 0.5); x.stroke(); }
    x.fillStyle = 'rgba(0,0,0,0.22)'; for (let i = 0; i < 512; i += 64) for (let j = 4; j < 512; j += 8) x.fillRect(i + 3, j, 1.2, 1.2);
    // usure / salissures
    for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${rnd() > 0.5 ? '0,0,0' : '255,255,255'},${0.03 + rnd() * 0.04})`; x.fillRect(rnd() * 512, rnd() * 512, 2 + rnd() * 14, 1 + rnd() * 4); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
    return (skinCache[kind] = t);
  }
  function heliModel(kind) {
    kind = HPAL[kind] ? kind : 'armee';
    const pal = HPAL[kind], attack = kind === 'attaque', civil = kind === 'samu' || kind === 'police';
    const g = new THREE.Group(), M = (c, r, m) => new THREE.MeshStandardMaterial({ color: c, roughness: r == null ? 0.75 : r, metalness: m || 0.05 });
    const body = M(0xffffff, civil ? 0.35 : 0.85), acc = M(pal.acc, 0.6), belly = M(pal.belly, 0.8), dark = M(0x1b1d20, 0.5, 0.3), metal = M(0x8c9196, 0.35, 0.7), rubber = M(0x111111, 0.9);
    body.map = heliSkin(kind, pal);
    const glass = new THREE.MeshPhongMaterial({ color: 0x1e3140, specular: 0xbfd8ff, shininess: 120, transparent: true, opacity: 0.55, depthWrite: false });
    const add = (geo, mat, x, y, z, rx, ry, rz, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); if (sx) m.scale.set(sx, sy, sz); g.add(m); return m; };
    const ell = (mat, x, y, z, sx, sy, sz, seg) => add(new THREE.SphereGeometry(1, seg || 28, 20), mat, x, y, z, 0, 0, 0, sx, sy, sz);
    const cylZ = (r1, r2, len, mat, x, y, z, seg) => add(new THREE.CylinderGeometry(r1, r2, len, seg || 18), mat, x, y, z, Math.PI / 2, 0, 0);
    const suit = M(civil ? (kind === 'samu' ? 0xd04a2a : 0x22324f) : 0x4d5233, 0.9), helm = M(civil ? 0xe8e8e8 : 0x3d4230, 0.45), visor = M(0x101215, 0.15, 0.6), skin = M(0xa8785a, 0.7);
    function pilot(x, y, z) {
      ell(suit, x, y, z + 0.15, 0.26, 0.32, 0.2, 12);                            // buste
      ell(skin, x, y + 0.45, z, 0.13, 0.15, 0.14, 12);                           // visage
      ell(helm, x, y + 0.53, z + 0.02, 0.17, 0.17, 0.18, 14);                    // casque
      ell(visor, x, y + 0.5, z - 0.11, 0.14, 0.07, 0.07, 12);                    // visière
    }
    let rotorR, mastY, eye, trPos, trSide, nBl = 4, trN = 4, trLen = 1.65, trCant = 0, trScissor = false, fen = false;
    // dérive profilée : contour latéral (z, y) extrudé en épaisseur, bords arrondis ; trous possibles (carénage Fenestron)
    const finShape = (pts, thick, mat, hole) => { const sh = new THREE.Shape(); pts.forEach(([z, y], i) => sh[i ? 'lineTo' : 'moveTo'](z, y)); sh.closePath();
      if (hole) { const h = new THREE.Path(); h.absarc(hole[0], hole[1], hole[2], 0, Math.PI * 2, true); sh.holes.push(h); }
      const geo = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.35, bevelSize: thick * 0.35, bevelSegments: 2, curveSegments: 24 });
      geo.translate(0, 0, -thick / 2); geo.rotateY(-Math.PI / 2); const m = new THREE.Mesh(geo, mat); g.add(m); return m; };
    if (civil) {
      // --- hélicoptère civil bimoteur léger (type H145 / EC145) : cellule arrondie, grande verrière, patins, portes arrière en coquille, Fenestron ---
      add(rbox(1.86, 1.62, 3.5, 0.55), body, 0, 1.72, -0.55);                    // cabine
      add(rbox(1.8, 0.42, 3.4, 0.2), belly, 0, 0.98, -0.55);                     // ventre
      ell(body, 0, 1.62, -2.45, 0.93, 0.84, 1.3);                                // nez
      ell(glass, 0, 2.02, -2.55, 0.9, 0.66, 1.2);                                // grande verrière bombée
      ell(glass, 0, 1.18, -3.0, 0.62, 0.32, 0.62, 18);                           // vitres de plancher (vue vers le bas)
      ell(body, 0, 1.78, 1.25, 0.92, 0.82, 1.15);                                // arrière en coquille (portes de chargement)
      add(new THREE.BoxGeometry(0.03, 1.2, 0.03), dark, 0, 1.8, 2.36);           // joint des portes coquille
      add(new THREE.BoxGeometry(0.05, 0.75, 0.05), dark, 0, 2.3, -3.55).rotation.x = -0.75;   // montant central du pare-brise
      pilot(-0.42, 1.72, -2.15); pilot(0.42, 1.72, -2.15);
      for (const s of [-1, 1]) {
        add(new THREE.PlaneGeometry(0.95, 0.68), glass, s * 0.945, 2.0, -1.25, 0, s * Math.PI / 2, 0);    // porte coulissante vitrée
        add(new THREE.PlaneGeometry(0.75, 0.6), glass, s * 0.945, 2.0, 0.05, 0, s * Math.PI / 2, 0);
        add(new THREE.BoxGeometry(0.03, 0.04, 2.0), dark, s * 0.95, 2.42, -0.6); add(new THREE.BoxGeometry(0.03, 1.4, 0.04), dark, s * 0.95, 1.75, -1.8);   // rails et cadre de porte
        const sk = cylZ(0.06, 0.06, 3.9, metal, s * 1.08, 0.1, -0.55); ell(metal, s * 1.08, 0.18, -2.5, 0.06, 0.12, 0.2, 8);        // patins relevés à l'avant
        for (const z of [-1.6, 0.5]) add(new THREE.CylinderGeometry(0.055, 0.055, 1.05, 8), metal, s * 1.0, 0.55, z, 0, 0, s * 0.32);
        const ex = cylZ(0.17, 0.22, 0.7, dark, s * 0.55, 2.78, 1.15); ex.rotation.y = s * 0.5;                                   // tuyères des 2 turbines
        add(new THREE.CircleGeometry(0.22, 14), dark, s * 0.45, 2.75, -1.35, 0, Math.PI, 0);                                       // entrées d'air
      }
      add(rbox(1.25, 0.55, 2.9, 0.24), body, 0, 2.72, -0.15);                    // capot moteurs
      const tb = cylZ(0.2, 0.42, 4.9, body, 0, 2.05, 3.95); tb.rotation.x = Math.PI / 2 - 0.06;    // poutre de queue fine
      add(new THREE.BoxGeometry(2.3, 0.07, 0.62), body, 0, 2.2, 5.45);           // stabilisateur
      for (const s of [-1, 1]) finShape([[5.2, 1.95], [5.9, 1.95], [5.85, 2.75], [5.35, 2.6]], 0.06, acc).position.x = s * 1.15;     // dérivettes en bout
      finShape([[5.95, 1.6], [7.15, 1.75], [7.55, 3.55], [7.05, 3.6], [6.35, 2.75], [5.95, 2.55]], 0.36, body, [6.75, 2.3, 0.44]);   // dérive à Fenestron
      const ring = add(new THREE.TorusGeometry(0.44, 0.05, 8, 28), dark, 0, 2.3, 6.75, 0, Math.PI / 2, 0);
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 12).rotateZ(Math.PI / 2), dark, 0, 2.3, 6.75);
      if (kind === 'samu') { add(new THREE.BoxGeometry(0.28, 0.3, 0.5), metal, 1.0, 2.62, -1.0); add(new THREE.BoxGeometry(0.7, 0.06, 0.06), metal, 1.25, 2.68, -1.0); }   // treuil de sauvetage
      if (kind === 'police') { ell(dark, 0, 0.85, -2.5, 0.2, 0.2, 0.2, 14); ell(glass, 0, 0.82, -2.68, 0.12, 0.12, 0.05, 10); add(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 14), metal, -0.6, 0.78, -1.9).rotation.x = Math.PI / 2; }   // caméra thermique + projecteur
      rotorR = 5.5; mastY = 3.05; nBl = 5; eye = [-0.42, 2.2, -2.3]; trPos = [0, 2.3, 6.75]; trSide = 0; trN = 10; trLen = 0.36; fen = true;
    } else if (!attack) {
      // --- cellule utilitaire ---
      add(rbox(2.4, 1.95, 5.0, 0.5), body, 0, 1.78, -0.55);                     // cabine
      add(rbox(2.3, 0.5, 4.6, 0.22), belly, 0, 0.92, -0.5);                     // plancher / ventre
      ell(body, 0, 1.72, -3.15, 1.2, 1.0, 1.75);                               // nez
      ell(belly, 0, 1.15, -3.85, 1.0, 0.58, 1.25);                             // bas du nez
      ell(glass, 0, 2.08, -3.62, 1.13, 0.66, 1.28);                            // verrière du cockpit
      for (const s of [-1, 1]) { const f = add(new THREE.BoxGeometry(0.05, 0.75, 0.05), dark, s * 0.62, 2.2, -4.35); f.rotation.x = -0.6; f.rotation.z = s * 0.25; }   // montants de verrière
      { const cp = add(new THREE.BoxGeometry(0.06, 0.8, 0.06), dark, 0, 2.25, -4.42); cp.rotation.x = -0.75; }      // montant central du pare-brise
      add(new THREE.BoxGeometry(1.9, 0.06, 0.06), dark, 0, 2.62, -3.95);                                         // traverse haute
      pilot(-0.48, 1.95, -3.35); pilot(0.48, 1.95, -3.35);                                                        // pilotes casqués
      if (!civil) {
        // coupe-câbles (haut et bas du nez), boule optronique, antennes
        const wc1 = add(new THREE.BoxGeometry(0.05, 0.75, 0.16), metal, 0, 2.75, -3.85); wc1.rotation.x = -0.5;
        const wc2 = add(new THREE.BoxGeometry(0.05, 0.6, 0.14), metal, 0, 0.62, -4.0); wc2.rotation.x = 0.55;
        ell(dark, 0, 0.72, -4.25, 0.3, 0.3, 0.3, 16); ell(glass, 0, 0.7, -4.5, 0.17, 0.17, 0.08, 12);
        add(new THREE.BoxGeometry(0.04, 0.5, 0.25), dark, 0, 3.55, 1.6, -0.3, 0, 0);
        // mitrailleuses de sabord dans les portes de cabine
        for (const s of [-1, 1]) {
          add(new THREE.BoxGeometry(0.22, 0.24, 0.6), dark, s * 1.32, 1.85, -1.05);
          for (let b = 0; b < 6; b++) { const a = b / 6 * Math.PI * 2; cylZ(0.025, 0.025, 1.1, dark, s * 1.32 + Math.cos(a) * 0.06, 1.85 + Math.sin(a) * 0.06, -1.75, 6); }
          add(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), metal, s * 1.25, 1.6, -1.05);
        }
      }
      add(rbox(1.7, 0.62, 3.7, 0.26), body, 0, 2.95, -0.25);                   // carénage moteurs
      for (const s of [-1, 1]) {
        cylZ(0.4, 0.4, 2.7, body, s * 0.62, 2.98, -0.15);                       // nacelles
        add(new THREE.CircleGeometry(0.33, 18), dark, s * 0.62, 2.98, -1.51, 0, Math.PI, 0);          // entrées d'air
        const ex = cylZ(0.24, 0.3, 1.0, dark, s * 0.95, 3.0, 1.55); ex.rotation.y = s * 0.45;          // tuyères
        // vitres et portes latérales
        add(new THREE.PlaneGeometry(0.85, 0.55), glass, s * 1.205, 2.2, -2.05, 0, s * Math.PI / 2, 0);
        add(new THREE.PlaneGeometry(1.0, 0.55), glass, s * 1.205, 2.2, -0.3, 0, s * Math.PI / 2, 0);
        add(new THREE.BoxGeometry(0.04, 0.05, 2.6), dark, s * 1.21, 2.75, -0.35); add(new THREE.BoxGeometry(0.04, 0.05, 2.6), dark, s * 1.21, 0.98, -0.35);
        add(new THREE.BoxGeometry(0.04, 1.75, 0.05), dark, s * 1.21, 1.85, -1.65); add(new THREE.BoxGeometry(0.04, 1.75, 0.05), dark, s * 1.21, 1.85, 0.95);
        if (!civil) {                                                          // ailettes d'emport avec réservoirs
          add(new THREE.BoxGeometry(1.9, 0.1, 0.75), acc, s * 2.1, 2.55, -0.5, 0, 0, -s * 0.12);
          cylZ(0.28, 0.28, 2.2, M(0x6b6f55, 0.6), s * 2.55, 2.12, -0.4); ell(M(0x6b6f55, 0.6), s * 2.55, 2.12, -1.5, 0.28, 0.28, 0.45);
        }
        // train : roues principales sous les flancs avant
        add(new THREE.CylinderGeometry(0.07, 0.07, 1.05, 8), metal, s * 1.3, 0.62, -2.0, 0, 0, s * 0.35);
        const wh = add(new THREE.CylinderGeometry(0.4, 0.4, 0.28, 18), rubber, s * 1.5, 0.4, -2.0, 0, 0, Math.PI / 2);
        add(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 12), metal, s * 1.5, 0.4, -2.0, 0, 0, Math.PI / 2);
      }
      if (civil) for (const s of [-1, 1]) { const sk = cylZ(0.07, 0.07, 4.2, metal, s * 1.15, 0.12, -0.6); for (const z of [-1.8, 0.6]) add(new THREE.CylinderGeometry(0.06, 0.06, 0.95, 8), metal, s * 1.1, 0.55, z, 0, 0, s * 0.15); }
      // poutre de queue effilée
      const tb = cylZ(0.34, 0.78, 7.0, body, 0, 2.05, 5.2); tb.rotation.x = Math.PI / 2 - 0.05;
      finShape([[7.6, 2.05], [8.9, 2.1], [9.75, 4.35], [9.0, 4.4], [8.15, 2.6]], 0.2, body);                // dérive en flèche profilée
      add(new THREE.BoxGeometry(4.2, 0.08, 1.05), body, 0, 2.2, 8.9);                                       // stabilateur bas
      for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.06, 0.35, 0.95), body, s * 2.1, 2.3, 8.9);
      add(new THREE.CylinderGeometry(0.07, 0.07, 1.75, 8), metal, 0, 1.12, 7.75, 0.3, 0, 0);                    // jambe de roulette de queue
      add(new THREE.BoxGeometry(0.12, 0.3, 0.3), metal, 0, 0.3, 7.5);
      add(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 14), rubber, 0, 0.22, 7.5, 0, 0, Math.PI / 2);
      rotorR = 8.1; mastY = 3.55; eye = [-0.5, 2.3, -3.6]; trPos = [0.28, 4.05, 9.3]; trSide = 1; trCant = 0.35;
    } else {
      // --- hélicoptère d'attaque en tandem ---
      add(rbox(1.25, 1.55, 5.6, 0.45), body, 0, 1.95, -0.4);
      ell(body, 0, 1.75, -3.2, 0.66, 0.85, 1.5);
      ell(glass, 0, 2.4, -2.75, 0.58, 0.52, 1.05);                             // poste avant (tireur)
      ell(glass, 0, 2.8, -1.45, 0.6, 0.56, 1.0);                               // poste arrière (pilote), surélevé
      ell(dark, 0, 1.55, -4.45, 0.36, 0.36, 0.36);                             // boule de visée
      ell(glass, -0.14, 1.55, -4.75, 0.12, 0.12, 0.06, 10); ell(glass, 0.14, 1.55, -4.75, 0.12, 0.12, 0.06, 10);   // optiques jour / nuit
      for (const z of [-2.8, -1.85, -0.75]) add(new THREE.BoxGeometry(1.0, 0.04, 0.04), dark, 0, z < -2 ? 2.86 : 3.3, z);   // arceaux de verrière
      pilot(0, 2.25, -2.7); pilot(0, 2.65, -1.4);                                                                     // tireur devant, pilote derrière
      { const wc = add(new THREE.BoxGeometry(0.05, 0.6, 0.14), metal, 0, 2.95, -3.15); wc.rotation.x = -0.45; }       // coupe-câble
      for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.5, 0.75, 1.9), body, s * 0.72, 1.85, -0.9);              // flancs blindés (caissons avionique)
      cylZ(0.06, 0.06, 1.2, dark, 0, 0.95, -3.0); add(new THREE.BoxGeometry(0.35, 0.3, 0.4), dark, 0, 1.1, -2.45);   // canon sous le nez
      for (const s of [-1, 1]) {
        cylZ(0.4, 0.38, 2.4, body, s * 0.88, 2.55, 0.1); add(new THREE.CircleGeometry(0.33, 16), dark, s * 0.88, 2.55, -1.11, 0, Math.PI, 0);
        const ex = cylZ(0.26, 0.3, 0.9, dark, s * 1.05, 2.65, 1.5); ex.rotation.y = s * 0.6;
        add(new THREE.BoxGeometry(1.55, 0.13, 0.95), acc, s * 1.35, 1.95, -0.2, 0, 0, -s * 0.06);      // ailettes
        for (const px of [1.25, 1.85]) {                                                           // paniers de roquettes et missiles
          add(new THREE.BoxGeometry(0.06, 0.3, 0.4), dark, s * px, 1.75, -0.2);
          if (px < 1.5) { cylZ(0.24, 0.24, 1.5, M(0x55593f, 0.7), s * px, 1.45, -0.2); add(new THREE.CircleGeometry(0.22, 12), dark, s * px, 1.45, -0.96, 0, Math.PI, 0); }
          else for (const dy of [-0.15, 0.15]) for (const dz of [-0.13, 0.13]) { cylZ(0.07, 0.07, 1.5, M(0x8c8f80, 0.5), s * px + dz, 1.45 + dy, -0.15); ell(M(0x8c8f80, 0.5), s * px + dz, 1.45 + dy, -0.92, 0.07, 0.07, 0.14, 10); }
        }
        add(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 8), metal, s * 0.85, 0.65, -1.4, 0, 0, s * 0.45);
        add(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 16), rubber, s * 1.1, 0.36, -1.4, 0, 0, Math.PI / 2);
      }
      const tb = cylZ(0.28, 0.6, 6.4, body, 0, 2.15, 5.3); tb.rotation.x = Math.PI / 2 - 0.04;
      finShape([[7.4, 2.1], [8.5, 2.15], [9.25, 4.1], [8.6, 4.15], [7.9, 2.6]], 0.18, body);
      add(new THREE.BoxGeometry(2.9, 0.08, 0.8), body, 0, 2.3, 8.55);
      add(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 12), rubber, 0, 0.2, 7.9, 0, 0, Math.PI / 2); add(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8), metal, 0, 1.1, 8.0, 0.25, 0, 0);
      rotorR = 7.3; mastY = 3.35; eye = [0, 3.05, -1.4]; trPos = [-0.22, 3.8, 9.0]; trSide = -1; trScissor = true;
    }
    // inscription (sauf attaque)
    if (pal.txt) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = civil ? (kind === 'samu' ? '#d42a2a' : '#f2f2f2') : '#1d2012'; x.font = 'bold 44px Arial'; x.textAlign = 'center'; x.fillText(pal.txt, 128, 48);
      const t = new THREE.CanvasTexture(c);
      for (const s of [-1, 1]) add(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: t, transparent: true }), s * (attack ? 0.32 : civil ? 0.96 : 0.6), civil ? 1.38 : 2.2, civil ? -0.4 : 4.0, 0, s * Math.PI / 2, 0).scale.x = -s;
    }
    if (civil) { add(rbox(1.9, 0.16, 3.55, 0.07), acc, 0, 1.12, -0.55); add(new THREE.BoxGeometry(0.4, 0.14, 4.6), acc, 0, 2.05, 3.9).visible = false; }   // bande de couleur basse
    // rotor principal : mât, moyeu, 4 pales en vrillage avec léger fléchissement
    add(new THREE.CylinderGeometry(0.17, 0.2, 0.8, 14), dark, 0, mastY, -0.2);
    const rot = new THREE.Group(); rot.position.set(0, mastY + 0.42, -0.2); g.add(rot);
    if (attack) { add(new THREE.CylinderGeometry(0.1, 0.1, 0.55, 10), dark, 0, mastY + 0.85, -0.2); ell(M(0x3a3f33, 0.7), 0, mastY + 1.25, -0.2, 0.62, 0.36, 0.62, 20); }   // radar de mât
    rot.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 0.28, 18), metal));
    const bladeG = new THREE.BoxGeometry(civil ? 0.36 : 0.55, 0.06, rotorR - 0.5); bladeG.translate(0, 0, (rotorR - 0.5) / 2 + 0.5);
    { const pa = bladeG.attributes.position; for (let i = 0; i < pa.count; i++) { const z = pa.getZ(i), f = 1 - 0.25 * (z / rotorR); pa.setX(i, pa.getX(i) * f + (z > rotorR - 1.2 ? (z - rotorR + 1.2) * 0.18 : 0)); } pa.needsUpdate = true; bladeG.computeVertexNormals(); }   // pales effilées à bout en flèche
    const tipG = new THREE.BoxGeometry(civil ? 0.37 : 0.56, 0.065, 0.45); tipG.translate(0, 0, rotorR - 0.2);
    const blades = [];
    for (let i = 0; i < nBl; i++) { const p = new THREE.Group(); p.rotation.y = i * Math.PI * 2 / nBl; const fl = new THREE.Group(); fl.rotation.x = 0.06; p.add(fl); const b = new THREE.Mesh(bladeG, M(0x23262a, 0.6)); b.rotation.z = 0.08; fl.add(b); const tp = new THREE.Mesh(tipG, M(0xd9c33a, 0.5)); fl.add(tp); rot.add(p); blades.push(fl); }   // pales articulées : affaissées à l'arrêt, conicité en vol
    const disc = new THREE.Mesh(new THREE.CircleGeometry(rotorR, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0, depthWrite: false })); rot.add(disc);
    // rotor de queue à 4 pales
    const trW = new THREE.Group(); trW.position.set(trPos[0], trPos[1], trPos[2]); trW.rotation.z = trCant * trSide; g.add(trW);   // rotor de queue incliné (Black Hawk)
    const tr = new THREE.Group(); trW.add(tr);
    tr.add(new THREE.Mesh(new THREE.CylinderGeometry(fen ? 0.09 : 0.16, fen ? 0.09 : 0.16, 0.2, 12).rotateZ(Math.PI / 2), metal));
    for (let i = 0; i < trN; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, trLen, fen ? 0.1 : 0.22), M(0x23262a, 0.6)); b.position.y = trLen / 2 + (fen ? 0.07 : 0); b.rotation.y = fen ? 0.35 : 0;
      const p = new THREE.Group(); p.rotation.x = trScissor ? [0, 0.96, Math.PI, Math.PI + 0.96][i] : i * Math.PI * 2 / trN; p.add(b); tr.add(p); }   // Apache : pales en ciseaux (55°)
    // feux
    const glow = c => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: SIM.glowTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.setScalar(1.3); return sp; };
    const bea = glow(0xff2020); bea.position.set(0, attack ? 2.8 : civil ? 2.62 : 3.3, civil ? 3.4 : 1.9); bea.scale.setScalar(0.8); g.add(bea);
    const nl = glow(0xff2020), nr = glow(0x20ff40); const nx = civil ? 1.17 : 1.25, nz = civil ? 5.45 : -0.9, ny = civil ? 2.2 : 2.4; nl.position.set(-nx, ny, nz); nr.position.set(nx, ny, nz); nl.scale.setScalar(0.45); nr.scale.setScalar(0.45); g.add(nl, nr);
    g.userData = { rot, tr, bea, disc, eye, rotorR, blades }; return g;
  }
  function helipad(C, lx, lz, elev) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#3b3f43'; x.beginPath(); x.arc(64, 64, 62, 0, 7); x.fill(); x.strokeStyle = '#f2c018'; x.lineWidth = 6; x.beginPath(); x.arc(64, 64, 52, 0, 7); x.stroke();
    x.fillStyle = '#fff'; x.font = 'bold 72px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', 64, 68);
    const w = C.toW(lx, lz), m = new THREE.Mesh(new THREE.CircleGeometry(14, 40).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c) }));
    m.position.set(w.x, elev + 0.26, w.z); scene.add(m); return { x: w.x, z: w.z, y: elev };
  }

  // ---------- Personnes ----------
  const CLOTH = [0xc23b22, 0x2563b0, 0x1f7a4a, 0xe8b53a, 0x6b3fa0, 0xf2f2f2, 0x222831, 0xd9772b, 0x2aa198];
  const SKIN = [0x3e2418, 0x5a3624, 0x7b4f33, 0x9a6a48, 0xc89a78, 0xe0b896];
  // fusion de plusieurs formes colorées en un seul maillage (bien moins d'appels de dessin)
  const PMAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72 });
  const GEO = { cyl: (r1, r2, h) => new THREE.CylinderGeometry(r1, r2, h, 10), sph: r => new THREE.SphereGeometry(r, 12, 9) };
  function merged(parts) {
    const pos = [], nor = [], col = [], m = new THREE.Matrix4(), c = new THREE.Color(), nm = new THREE.Matrix3();
    parts.forEach(([g0, hex, x, y, z, sx, sy, sz]) => {
      const g = g0.index ? g0.toNonIndexed() : g0; m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx || 1, sy || 1, sz || 1)); nm.getNormalMatrix(m);
      const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3(); c.setHex(hex);
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z); v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z); col.push(c.r, c.g, c.b); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return new THREE.Mesh(g, PMAT);
  }
  function person(vest) {
    const g = new THREE.Group(), top = vest ? 0xff7a1a : CLOTH[Math.random() * CLOTH.length | 0], pants = [0x1f2a3a, 0x3a3a3a, 0x5a4632, 0x2b4a6b][Math.random() * 4 | 0], skin = SKIN[Math.random() * SKIN.length | 0];
    const body = [[GEO.cyl(0.17, 0.14, 0.62), top, 0, 1.18, 0], [GEO.sph(0.18), top, 0, 1.47, 0, 1, 0.55, 0.75], [GEO.cyl(0.05, 0.05, 0.1), skin, 0, 1.6, 0], [GEO.sph(0.11), skin, 0, 1.73, 0, 0.9, 1.1, 1], [GEO.sph(0.11), 0x111111, 0, 1.79, 0.01, 0.95, 0.6, 1]];
    if (vest) body.push([GEO.sph(0.12), 0xffffff, 0, 1.82, 0, 1, 0.6, 1.1]);
    g.add(merged(body));
    const legs = [], arms = [];
    for (const s of [-1, 1]) {
      const lg = new THREE.Group(); lg.position.set(s * 0.09, 0.88, 0); lg.add(merged([[GEO.cyl(0.07, 0.06, 0.86), pants, 0, -0.43, 0], [GEO.sph(0.07), 0x151515, 0, -0.86, -0.04, 1, 0.6, 1.6]])); g.add(lg); legs.push(lg);
      const am = new THREE.Group(); am.position.set(s * 0.22, 1.42, 0); am.add(merged([[GEO.cyl(0.05, 0.045, 0.62), top, 0, -0.3, 0], [GEO.sph(0.05), skin, 0, -0.63, 0]])); g.add(am); arms.push(am);
    }
    g.userData = { legs, arms, ph: Math.random() * 6 }; return g;
  }

  // passager détaillé : vraies proportions, genoux et coudes articulés, visage, coiffure, robe ou pantalon, valise à roulettes ou sac à dos
  const HAIR = [0x111111, 0x1e140c, 0x3b2616, 0x6b4a2b, 0x8a8a8a];
  function traveler() {
    const g = new THREE.Group(), woman = Math.random() < 0.45, top = CLOTH[Math.random() * CLOTH.length | 0], pants = [0x1f2a3a, 0x3a3a3a, 0x5a4632, 0x2b4a6b, 0xd8d2c0][Math.random() * 5 | 0];
    const skin = SKIN[Math.random() * SKIN.length | 0], hair = HAIR[Math.random() * HAIR.length | 0], shoe = [0x151515, 0x3a2414, 0xeeeeee][Math.random() * 3 | 0], dress = woman && Math.random() < 0.6;
    const short = Math.random() < 0.5, jacket = !woman && Math.random() < 0.35 ? [0x1d2433, 0x3b3b3b, 0x5b4630][Math.random() * 3 | 0] : null, upper = jacket || top;
    const H = 0.92 + Math.random() * 0.12;
    const body = [
      [GEO.sph(0.16), dress ? top : pants, 0, 0.95, 0, 1.05, 0.62, 0.72],                     // bassin
      [new THREE.CylinderGeometry(0.175, 0.15, 0.5, 12), upper, 0, 1.2, 0],                    // buste
      [GEO.sph(0.19), upper, 0, 1.44, 0, 1.05, 0.42, 0.62],                                    // épaules
      [GEO.cyl(0.05, 0.055, 0.1), skin, 0, 1.54, 0],                                           // cou
      [GEO.sph(0.105), skin, 0, 1.665, 0.005, 0.9, 1.1, 1],                                    // tête
      [GEO.sph(0.11), hair, 0, 1.715, -0.012, 0.96, 0.72, 1.02],                               // cheveux
      [GEO.sph(0.022), skin, 0, 1.655, 0.1, 1, 1, 1],                                          // nez
      [GEO.sph(0.013), 0x101010, -0.036, 1.685, 0.092], [GEO.sph(0.013), 0x101010, 0.036, 1.685, 0.092],   // yeux
      [GEO.sph(0.02), skin, -0.1, 1.665, 0, 0.5, 1, 1], [GEO.sph(0.02), skin, 0.1, 1.665, 0, 0.5, 1, 1],   // oreilles
    ];
    if (woman) body.push([GEO.sph(0.1), hair, 0, 1.6, -0.06, 1.05, 1.3, 0.7]);                 // cheveux longs
    if (dress) body.push([new THREE.CylinderGeometry(0.16, 0.29, 0.5, 14), top, 0, 0.78, 0]);  // robe
    if (jacket) body.push([new THREE.BoxGeometry(0.06, 0.4, 0.02), top, 0, 1.25, 0.17]);       // chemise sous la veste
    g.add(merged(body));
    const legs = [], knees = [], arms = [], elbows = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(s * 0.095, 0.93, 0); g.add(hip);
      hip.add(merged([[GEO.cyl(0.085, 0.068, 0.45), dress ? skin : pants, 0, -0.225, 0]]));
      const kn = new THREE.Group(); kn.position.y = -0.45; hip.add(kn);
      kn.add(merged([[GEO.cyl(0.066, 0.05, 0.42), dress || (short && !woman && Math.random() < 0) ? skin : pants, 0, -0.21, 0], [GEO.sph(0.07), shoe, 0, -0.44, 0.05, 1, 0.55, 1.9]]));
      legs.push(hip); knees.push(kn);
      const sh = new THREE.Group(); sh.position.set(s * 0.215, 1.43, 0); g.add(sh);
      sh.add(merged([[GEO.cyl(0.052, 0.045, 0.3), upper, 0, -0.15, 0]]));
      const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
      el.add(merged([[GEO.cyl(0.044, 0.036, 0.27), short && !jacket ? skin : upper, 0, -0.135, 0], [GEO.sph(0.045), skin, 0, -0.3, 0.01, 0.8, 1.25, 0.6]]));
      arms.push(sh); elbows.push(el);
    }
    // valise à roulettes tirée par la main droite, ou sac à dos
    const r = Math.random();
    if (r < 0.55) {
      const col = [0x1c1c1c, 0x2b4a8b, 0x8b2b2b, 0x6b5a3a, 0x4a6b3a, 0xc0c0c8][Math.random() * 6 | 0], bag = new THREE.Group();
      bag.add(merged([[new THREE.BoxGeometry(0.36, 0.52, 0.22), col, 0, 0.3, 0], [GEO.cyl(0.012, 0.012, 0.42), 0x999999, 0.07, 0.75, 0], [GEO.cyl(0.012, 0.012, 0.42), 0x999999, -0.07, 0.75, 0], [new THREE.BoxGeometry(0.17, 0.03, 0.03), 0x222222, 0, 0.96, 0], [GEO.sph(0.03), 0x111111, 0.13, 0.03, -0.08], [GEO.sph(0.03), 0x111111, -0.13, 0.03, -0.08]]));
      bag.position.set(0.3, 0, -0.42); bag.rotation.x = -0.42; g.add(bag); g.userData.trolley = true;
    } else if (r < 0.8) g.add(merged([[new THREE.BoxGeometry(0.3, 0.4, 0.16), [0x20303f, 0x5a2a2a, 0x2a4a2a, 0x333333][Math.random() * 4 | 0], 0, 1.2, -0.25]]));
    g.scale.setScalar(H);
    g.userData = { legs, arms, knees, elbows, ph: Math.random() * 6, detailed: true }; return g;
  }
  // marche naturelle : hanches, genoux, bras opposés, léger rebond
  function walkAnim(m, t, speed) {
    const u = m.userData, ph = t * (speed || 6) + u.ph, s = Math.sin(ph);
    if (!u.detailed) { const sw = s * 0.5; u.legs[0].rotation.x = sw; u.legs[1].rotation.x = -sw; u.arms[0].rotation.x = -sw * 0.7; u.arms[1].rotation.x = sw * 0.7; return 0; }
    u.legs[0].rotation.x = -s * 0.42; u.legs[1].rotation.x = s * 0.42;
    u.knees[0].rotation.x = 0.08 + 0.65 * Math.max(0, Math.sin(ph + 1.3)); u.knees[1].rotation.x = 0.08 + 0.65 * Math.max(0, Math.sin(ph + 1.3 + Math.PI));
    u.arms[0].rotation.x = s * 0.38; u.arms[1].rotation.x = u.trolley ? 0.55 : -s * 0.38; u.arms[1].rotation.z = u.trolley ? 0.18 : 0;
    u.elbows[0].rotation.x = -0.25 - Math.max(0, s) * 0.3; u.elbows[1].rotation.x = u.trolley ? -0.05 : -0.25 - Math.max(0, -s) * 0.3;
    return Math.abs(Math.cos(ph)) * 0.03;
  }
  L.traveler = traveler; L.walkAnim = walkAnim;

  // ---------- Animaux ----------
  function animal(kind) {
    const g = new THREE.Group(), legs = [];
    const P = { zebu: { c: 0xa89a84, b: [1.0, 0.75, 1.9], h: 1.35, leg: 1.05, neck: 0.5 }, vache: { c: 0x3a2a20, b: [0.95, 0.8, 1.9], h: 1.3, leg: 0.95, neck: 0.45 },
      antilope: { c: 0xb07a42, b: [0.45, 0.45, 1.05], h: 1.0, leg: 0.85, neck: 0.55 }, elephant: { c: 0x7a7470, b: [1.7, 1.6, 2.9], h: 2.5, leg: 1.6, neck: 0.3 } }[kind];
    const m = S(P.c, 0.85), dark = S(0x1c1814, 0.6);
    g.add(sph(1, m, P.b[0] * 0.6, P.b[1] * 0.6, P.b[2] * 0.55, 0, P.h, 0));
    if (kind === 'vache') { g.add(sph(1, S(0xf2f2f2, 0.9), P.b[0] * 0.45, P.b[1] * 0.4, P.b[2] * 0.25, 0.25, P.h + 0.15, 0.2)); }
    if (kind === 'zebu') g.add(sph(0.3, m, 1, 1.2, 1.2, 0, P.h + 0.45, -P.b[2] * 0.35));          // bosse
    const head = new THREE.Group(); head.position.set(0, P.h + P.neck * 0.6, -P.b[2] * 0.6); g.add(head);
    if (kind === 'elephant') {
      head.add(sph(0.85, m, 1, 1, 1, 0, 0.3, -0.3));
      for (const s of [-1, 1]) { const ear = sph(0.8, m, 0.15, 1, 0.8, s * 0.85, 0.3, -0.1); head.add(ear); const tusk = cyl(0.06, 0.02, 0.9, S(0xf2ead8, 0.4), s * 0.28, -0.35, -0.95); tusk.rotation.x = 1.1; head.add(tusk); }
      let p = new THREE.Vector3(0, 0.0, -1.0); for (let i = 0; i < 5; i++) { const s2 = cyl(0.2 - i * 0.03, 0.17 - i * 0.03, 0.42, m, p.x, p.y - 0.18, p.z - 0.05 * i); s2.rotation.x = 0.25 * i; head.add(s2); p.y -= 0.38; p.z -= 0.08 * i; }
    } else {
      const nk = cyl(0.14 * (kind === 'antilope' ? 0.6 : 1.4), 0.2 * (kind === 'antilope' ? 0.6 : 1.4), P.neck + 0.3, m, 0, -0.1, 0.15); nk.rotation.x = -0.7; head.add(nk);
      head.add(sph(0.22 * (kind === 'antilope' ? 0.6 : 1.2), m, 0.8, 0.8, 1.5, 0, 0.12, -0.22));
      for (const s of [-1, 1]) {
        if (kind === 'antilope') { const hn = cyl(0.02, 0.01, 0.45, dark, s * 0.06, 0.4, 0.0); hn.rotation.x = -0.4; head.add(hn); }
        else { const hn = cyl(0.04, 0.015, 0.35, S(0xe8dcc4, 0.5), s * 0.2, 0.3, -0.05); hn.rotation.z = -s * 0.9; head.add(hn); }
      }
    }
    const lx = P.b[0] * 0.33, lz = P.b[2] * 0.36;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const lg = new THREE.Group(); lg.position.set(sx * lx, P.leg, sz * lz); lg.add(cyl(kind === 'elephant' ? 0.32 : 0.07, kind === 'elephant' ? 0.3 : 0.05, P.leg, kind === 'elephant' ? m : dark, 0, -P.leg / 2, 0)); g.add(lg); legs.push(lg);
    }
    const tail = cyl(0.03, 0.02, 0.6, dark, 0, P.h - 0.1, P.b[2] * 0.58); tail.rotation.x = 0.3; g.add(tail);
    g.userData = { legs, head, ph: Math.random() * 6, kind }; return g;
  }

  L.init = function (sc) {
    scene = sc;
    const kinds = ['armee', 'attaque', 'samu', 'police', 'armee'];
    SIM.AIRPORTS.forEach((a, ai) => {
      const C = a.comps[0], Lay = C.layout, pads = [];
      // héliport : dalle, 4 plateformes « H », manche à air, balises, panneau
      const hx0 = Lay.AX0 + 75, hz = -(Lay.APL + 70), slab = new THREE.Mesh(new THREE.PlaneGeometry(190, 70).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x9a9b97 }));
      const cw = C.toW(hx0 + 60, hz); slab.position.set(cw.x, a.elev + 0.2, cw.z); slab.rotation.y = -C.hdg * D2R + Math.PI / 2; scene.add(slab);
      for (let k = 0; k < 4; k++) pads.push(helipad(C, hx0 + k * 42, hz, a.elev));
      const sc = document.createElement('canvas'); sc.width = 512; sc.height = 96; const sx = sc.getContext('2d'); sx.fillStyle = '#123a5a'; sx.fillRect(0, 0, 512, 96); sx.fillStyle = '#fff'; sx.font = 'bold 60px Arial'; sx.textAlign = 'center'; sx.fillText('HÉLIPORT · ' + a.city.toUpperCase(), 256, 68);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(26, 4.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), side: THREE.DoubleSide })); const sw = C.toW(hx0 + 60, hz - 40); sign.position.set(sw.x, a.elev + 5, sw.z); sign.rotation.y = -C.hdg * D2R; scene.add(sign);
      const posts = [C.toW(hx0 + 50, hz - 40), C.toW(hx0 + 70, hz - 40)]; posts.forEach(pp => scene.add(cyl(0.2, 0.2, 5, S(0x555555), pp.x, a.elev + 2.5, pp.z)));
      const sock = new THREE.Mesh(new THREE.ConeGeometry(0.7, 4.5, 12, 1, true), new THREE.MeshLambertMaterial({ color: 0xff6a1a, side: THREE.DoubleSide })); const ws = C.toW(hx0 - 30, hz + 25); scene.add(cyl(0.1, 0.1, 7, S(0xdddddd), ws.x, a.elev + 3.5, ws.z)); sock.position.set(ws.x + 2, a.elev + 6.6, ws.z); sock.rotation.z = Math.PI / 2.2; scene.add(sock);
      const bl = []; for (let k = 0; k < 4; k++) for (let q = 0; q < 12; q++) { const ang = q / 12 * Math.PI * 2, w = C.toW(hx0 + k * 42 + Math.cos(ang) * 15, hz + Math.sin(ang) * 15); bl.push(w.x, a.elev + 0.5, w.z); }
      const blg = new THREE.BufferGeometry(); blg.setAttribute('position', new THREE.Float32BufferAttribute(bl, 3));
      const bp = new THREE.Points(blg, new THREE.PointsMaterial({ color: 0x40ff70, size: 4, sizeAttenuation: false, map: SIM.glowTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      bp.frustumCulled = false; scene.add(bp); L.padLights = L.padLights || []; L.padLights.push(bp);
      a.helipads = pads; pads.forEach(pd => pd.a = a);
      // hélicoptères : un posé, un en tour de piste
      for (let k = 0; k < (a.id === 'KBI' ? 2 : 3); k++) {
        const m = heliModel(kinds[(ai + k) % 4]), pad = pads[k];
        pad.busy = true; const h = { m, kind: kinds[(ai + k) % 4], a, pad, x: pad.x, z: pad.z, y: a.elev + 0.15, psi: Math.random() * 6, V: 0, mode: k ? 'circuit' : 'ground', t: k ? 0 : 10 + Math.random() * 30, ang: Math.random() * 6, R: 1800 + Math.random() * 1500, alt: 180 + Math.random() * 200, rotor: 0 };
        if (k) { h.y = a.elev + h.alt; h.x = a.x + Math.cos(h.ang) * h.R; h.z = a.z + Math.sin(h.ang) * h.R; }
        scene.add(m); L.helis.push(h);
      }
      // personnes : personnel au sol près des postes, passagers dans l'aérogare
      a.comps.forEach(Cx => {
        const Ly = Cx.layout;
        Cx.stands.forEach((st, i) => {
          for (let k = 0; k < 3; k++) {
            const p = person(true), A = Cx.toW(st.lx - 10 - k * 6, st.lz + 12 - k * 8), B = Cx.toW(st.lx - 30 + k * 4, st.lz - 15 + k * 6);
            scene.add(p); L.people.push({ m: p, a, A, B, f: Math.random(), sp: 0.035 + Math.random() * 0.03, y: a.elev + 0.15 });
          }
        });
        for (let k = 0; k < (a.id === 'KBI' ? 14 : 34); k++) {
          const p = person(false), z0 = (Math.random() - 0.5) * (a.id === 'KBI' ? 220 : 600), x0 = Ly.TERM + 5 + Math.random() * 30;
          const A = Cx.toW(x0, z0), B = Cx.toW(x0 + (Math.random() - 0.5) * 6, z0 + (Math.random() - 0.5) * 80);
          scene.add(p); L.people.push({ m: p, a, A, B, f: Math.random(), sp: 0.01 + Math.random() * 0.012, y: a.elev + 1.0 });
        }
      });
      // escaliers et passagers aux avions garés (un sur deux débarque, l'autre embarque)
      a.comps.forEach(Cx => Cx.stands.forEach((st, i) => { if (st.busy && i % 2 === 0) L.addBoarding(st, a.elev, st.planeScale || 1, 'both', 10); }));
      // animaux : troupeaux dans les herbes autour de l'aéroport
      const herdKinds = { NSI: ['zebu', 'zebu', 'antilope'], DLA: ['antilope', 'zebu'], KBI: ['elephant', 'antilope'], CDG: ['vache', 'vache'], ABJ: ['antilope', 'zebu'], JFK: ['vache'] }[a.id] || [];
      herdKinds.forEach((kind, hi) => {
        const cl = Lay.TERM + 700 + hi * 350, cz = (hi % 2 ? 1 : -1) * (500 + hi * 400), n = kind === 'elephant' ? 5 : kind === 'antilope' ? 9 : 10;
        const herd = { a, kind, members: [] };
        for (let k = 0; k < n; k++) {
          const m = animal(kind), w = C.toW(cl + (Math.random() - 0.5) * 120, cz + (Math.random() - 0.5) * 120);
          scene.add(m); herd.members.push({ m, x: w.x, z: w.z, psi: Math.random() * 6, V: 0, t: Math.random() * 10, cx: w.x, cz: w.z });
        }
        L.herds.push(herd);
      });
    });
  };

  // ---------- Passagers qui descendent et qui montent (escalier arrière) ----------
  L.boards = [];
  function stairs(door, bottom, H) {
    const g = new THREE.Group(), truck = S(0xf2c018, 0.6), steel = S(0xb8bec4, 0.4);
    const dx = bottom.x - door.x, dz = bottom.z - door.z, len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
    g.position.set(door.x, 0, door.z); g.rotation.y = ang;
    const n = 12; for (let i = 0; i < n; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, len / n + 0.05), steel); st.position.set(0, H - H * (i + 0.5) / n + door.y0, len * (i + 0.5) / n); g.add(st); }
    for (const sd of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, Math.hypot(len, H)), steel); rail.position.set(sd * 0.72, H / 2 + door.y0 + 0.9, len / 2); rail.rotation.x = Math.atan2(H, len); g.add(rail); }
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, len * 0.9), truck); base.position.set(0, door.y0 + 0.6, len * 0.55); g.add(base);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 1.8), truck); cab.position.set(0, door.y0 + 1.1, len + 0.9); g.add(cab);
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 1.2), steel); top.position.set(0, H + door.y0, -0.4); g.add(top);
    scene.add(g); return g;
  }
  // H : poste (x,z, cap en degrés), elev, échelle de l'avion, mode 'both' | 'off' (débarquement) | 'on' (embarquement)
  L.addBoarding = function (st, elev, scale, mode, n) {
    const H = st.hdg * D2R, f = [Math.sin(H), -Math.cos(H)], l = [-Math.cos(H), -Math.sin(H)], sv = typeof scale === 'object' && scale ? scale : { x: scale || 1, y: scale || 1, z: scale || 1 }, sc = sv.z;
    const P0 = (a, b) => ({ x: st.x + f[0] * a + l[0] * b, z: st.z + f[1] * a + l[1] * b });
    // porte AVANT gauche : les passagers montent et descendent par l'avant de l'avion
    const door = P0(14.7 * sc, 2.25 * sv.x), bot = P0(14.7 * sc, 8.8 + sv.x), term = P0(38, 8.8 + sv.x);
    if (st.plane && st.plane.setDoor) st.plane.setDoor(1);
    door.y0 = elev; const g = stairs(door, bot, 3.0 * sv.y);
    const B = { st, g, mode, people: [], path: [{ x: door.x, z: door.z, y: elev + 3.05 * sv.y }, { x: bot.x, z: bot.z, y: elev + 0.15 }, { x: term.x, z: term.z, y: elev + 0.15 }], done: 0, total: n || 26 };
    for (let i = 0; i < Math.min(B.total, 26); i++) {
      const p = traveler(); scene.add(p);
      const out = mode === 'off' || (mode === 'both' && i % 2 === 0);
      B.people.push({ m: p, out, f: -i * 0.05, sp: 0.022 + Math.random() * 0.01 });
    }
    L.boards.push(B); return B;
  };
  L.removeBoarding = function (B) { if (!B) return; if (B.st && B.st.plane && B.st.plane.setDoor) B.st.plane.setDoor(0); scene.remove(B.g); B.people.forEach(p => scene.remove(p.m)); L.boards.splice(L.boards.indexOf(B), 1); };
  function posOn(path, k) { // k ∈ [0,1] le long du trajet porte → bas de l'escalier → aérogare
    const L1 = Math.hypot(path[1].x - path[0].x, path[1].z - path[0].z) + 3, L2 = Math.hypot(path[2].x - path[1].x, path[2].z - path[1].z), T = L1 + L2, d = k * T;
    const [a, b, u] = d < L1 ? [path[0], path[1], d / L1] : [path[1], path[2], (d - L1) / L2];
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u, dir: Math.atan2(b.x - a.x, b.z - a.z) };
  }
  function updBoard(B, dt, t, cx, cz) {
    const vis = Math.abs(B.st.x - cx) < 2500 && Math.abs(B.st.z - cz) < 2500; B.g.visible = vis;
    B.people.forEach(p => {
      p.f += p.sp * dt; let k = p.f;
      if (k >= 1) { if (B.mode === 'both') { p.f = -Math.random() * 0.4; k = 0; } else { p.m.visible = false; if (!p.done) { p.done = true; B.done++; } return; } }
      if (k < 0 || !vis) { p.m.visible = false; return; }
      p.m.visible = true; const q = posOn(B.path, p.out ? k : 1 - k);
      const bob = walkAnim(p.m, t, 6.5);
      p.m.position.set(q.x, q.y + bob, q.z); p.m.rotation.y = q.dir + (p.out ? 0 : Math.PI);
    });
  }
  // ---------- Hélicoptères pilotables ----------
  L.heliModel = heliModel;
  L.HNAME = { samu: 'Hélico SAMU', police: 'Hélico Police', armee: 'Hélico militaire', attaque: 'Hélico d\'attaque' };
  L.choices = () => L.helis.map((h, i) => ({ id: 'h' + i, h, cs: L.HNAME[h.kind] + ' ' + (h.a.id), state: { ground: 'posé sur l\'héliport', up: 'au décollage', circuit: 'en vol', approach: 'en approche', down: 'à l\'atterrissage' }[h.mode], ap: h.a.city, d: 0, heli: true }));
  L.take = function (id) { const i = +String(id).slice(1), h = L.helis[i]; if (!h) return null; scene.remove(h.m); L.helis.splice(i, 1); if (h.pad) h.pad.busy = false; return h; };
  L.freePad = a => (a.helipads || []).find(p => !p.busy) || (a.helipads || [])[0];

  L.update = function (dt, t, cam) {
    if (!scene) return;
    const cx = cam.position.x, cz = cam.position.z, near = (x, z, r) => Math.abs(x - cx) < r && Math.abs(z - cz) < r;
    // hélicoptères
    L.helis.forEach(h => {
      const a = h.a, ge = a.elev + 0.15; h.t -= dt;
      if (h.mode === 'ground') { h.V = 0; h.y = ge; h.rotor = Math.max(0, h.rotor - dt * 0.3); if (h.t < 8) h.rotor = Math.min(1, h.rotor + dt * 0.25); if (h.t < 0) { h.mode = 'up'; } }
      else if (h.mode === 'up') { h.rotor = 1; h.y += 5 * dt; if (h.y > ge + 60) { h.mode = 'circuit'; h.ang = Math.atan2(h.z - a.z, h.x - a.x); } }
      else if (h.mode === 'circuit') {
        h.rotor = 1; h.V = 45; h.ang += h.V / h.R * dt; const tx = a.x + Math.cos(h.ang) * h.R, tz = a.z + Math.sin(h.ang) * h.R;
        const brg = Math.atan2(tx - h.x, -(tz - h.z)); h.psi += clamp(((brg - h.psi + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -0.5 * dt, 0.5 * dt);
        h.x += Math.sin(h.psi) * h.V * dt; h.z -= Math.cos(h.psi) * h.V * dt; h.y += (ge + h.alt - h.y) * dt * 0.3;
        if (h.t < -120) { h.mode = 'approach'; }
      } else if (h.mode === 'approach') {
        h.rotor = 1; const d = Math.hypot(h.pad.x - h.x, h.pad.z - h.z), brg = Math.atan2(h.pad.x - h.x, -(h.pad.z - h.z));
        h.psi += clamp(((brg - h.psi + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -0.6 * dt, 0.6 * dt); h.V = clamp(d * 0.05, 2, 40);
        h.x += Math.sin(h.psi) * h.V * dt; h.z -= Math.cos(h.psi) * h.V * dt; h.y += (ge + clamp(d * 0.08, 25, h.alt) - h.y) * dt * 0.5;
        if (d < 6) h.mode = 'down';
      } else if (h.mode === 'down') { h.V = 0; h.x += (h.pad.x - h.x) * dt; h.z += (h.pad.z - h.z) * dt; h.y -= 3 * dt; if (h.y <= ge) { h.y = ge; h.mode = 'ground'; h.t = 30 + Math.random() * 40; } }
      const m = h.m; m.visible = near(h.x, h.z, h.mode === 'ground' ? 7000 : 15000); if (!m.visible) return;
      m.position.set(h.x, h.y, h.z); m.rotation.set(-h.V * 0.004, -h.psi, 0, 'YXZ');
      m.userData.rot.rotation.y += h.rotor * 28 * dt; m.userData.tr.rotation.x += h.rotor * 60 * dt; m.userData.disc.material.opacity = h.rotor * 0.13; m.userData.bea.visible = (t % 1) < 0.15;
    });
    L.boards.forEach(B => updBoard(B, dt, t, cx, cz));
    // personnes
    L.people.forEach(p => {
      const vis = near(p.A.x, p.A.z, 2500); p.m.visible = vis; if (!vis) return;
      p.f += p.sp * dt; const k = Math.abs(((p.f % 2) + 2) % 2 - 1), dir = Math.floor(p.f) % 2 ? -1 : 1;
      const x = p.A.x + (p.B.x - p.A.x) * k, z = p.A.z + (p.B.z - p.A.z) * k;
      p.m.position.set(x, p.y, z); p.m.rotation.y = Math.atan2(-(p.B.x - p.A.x) * dir, -(p.B.z - p.A.z) * dir);
      const u = p.m.userData, sw = Math.sin(t * 6 + u.ph) * 0.5; u.legs[0].rotation.x = sw; u.legs[1].rotation.x = -sw; u.arms[0].rotation.x = -sw * 0.8; u.arms[1].rotation.x = sw * 0.8;
    });
    // animaux : pâturage et petits déplacements
    L.herds.forEach(hd => hd.members.forEach(an => {
      const vis = near(an.x, an.z, 4000); an.m.visible = vis; if (!vis) return;
      an.t -= dt; if (an.t < 0) { an.t = 4 + Math.random() * 10; an.V = Math.random() < 0.5 ? 0 : (hd.kind === 'antilope' ? 2.5 : 0.8) * (0.5 + Math.random()); const back = Math.hypot(an.x - an.cx, an.z - an.cz) > 90; an.psi = back ? Math.atan2(an.cx - an.x, -(an.cz - an.z)) : an.psi + (Math.random() - 0.5) * 2; }
      an.x += Math.sin(an.psi) * an.V * dt; an.z -= Math.cos(an.psi) * an.V * dt;
      an.m.position.set(an.x, SIM.groundH(an.x, an.z), an.z); an.m.rotation.y = -an.psi;
      const u = an.m.userData, sw = an.V > 0 ? Math.sin(t * (3 + an.V * 2) + u.ph) * 0.45 : 0;
      u.legs.forEach((l, i) => l.rotation.x = (i === 0 || i === 3) ? sw : -sw);
      u.head.rotation.x = an.V > 0 ? 0 : 0.55 + Math.sin(t * 0.8 + u.ph) * 0.15;     // tête baissée pour brouter
    }));
  };
})();
