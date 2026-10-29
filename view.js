// Rendu : scène, vues caméra, ombre, effets, instruments (PFD, FMA, ECAM, radar) et son
(function () {
  const D2R = SIM.D2R, R2D = SIM.R2D, clamp = SIM.clamp, P = SIM.P;
  const V = SIM.view = {};
  const $ = id => document.getElementById(id);

  V.init = function () {
    const canvas = $('gl');
    const r = V.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = SIM.scene = new THREE.Scene();
    V.cam = new THREE.PerspectiveCamera(60, 1, 0.3, 450000);
    SIM.initWorld(scene); SIM.initAirports(scene); SIM.ai.init(scene); SIM.nature.init(scene); SIM.city.init(scene); SIM.landmarks.init(scene); SIM.roads.init(scene); SIM.life.init(scene); SIM.boom.init(scene);
    V.plane = SIM.buildAircraft('sanaga'); scene.add(V.plane.root);
    V.plane.root.rotation.order = 'YXZ'; V.cockpit = SIM.buildCockpit(V.plane);
    V.myLiv = 'sanaga'; V.myType = 'A320';
    // ombre portée (silhouette)
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = 'rgba(0,0,0,1)'; x.filter = 'blur(3px)';
    x.beginPath(); x.ellipse(128, 128, 14, 124, 0, 0, 7); x.fill();
    x.beginPath(); x.moveTo(118, 112); x.lineTo(14, 160); x.lineTo(14, 172); x.lineTo(118, 148); x.lineTo(138, 148); x.lineTo(242, 172); x.lineTo(242, 160); x.lineTo(138, 112); x.fill();
    x.beginPath(); x.moveTo(122, 212); x.lineTo(84, 234); x.lineTo(84, 240); x.lineTo(172, 240); x.lineTo(172, 234); x.lineTo(134, 212); x.fill();
    V.shadow = new THREE.Mesh(new THREE.PlaneGeometry(38, 38).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.45, depthWrite: false }));
    scene.add(V.shadow);
    V.fx = [];
    V.resize(); window.addEventListener('resize', V.resize);
  };
  // changer l'avion du joueur (livrée et taille) : le cockpit garde des dimensions humaines
  function heliPlayer(kind) {
    const m = SIM.life.heliModel(kind), root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.add(m); root.rotation.order = 'YXZ';
    const u = m.userData;
    return { root, body, mats: {}, engs: [], gear: {}, lt: {}, simple: false, heli: true, flames: [],
      eye: u.eye, update(s) { const n = (s.n1[0] + s.n1[1]) / 2; u.rot.rotation.y += n * 30 * s.dt; u.tr.rotation.x += n * 65 * s.dt; u.bea.visible = (s.t % 1) < 0.15; u.disc.material.opacity = n * 0.13;
        // réalisme : pales qui s'affaissent à l'arrêt et se relèvent (conicité) sous la charge ; disque rotor qui s'incline dans le sens du cyclique
        const load = P.onGround ? Math.max(0, (P.lift || 0)) * 0.6 : 1 + clamp(P.hvy || 0, -4, 6) * 0.06, spin = clamp(n / 0.6, 0, 1);
        const flap = 0.07 * (1 - spin) - 0.045 * spin * load + Math.sin(s.t * 4.6) * 0.004 * spin;
        if (u.blades) u.blades.forEach((b, i) => { b.rotation.x += (flap + (i % 2 ? 0.003 : -0.003) * spin - b.rotation.x) * Math.min(1, s.dt * 4); });
        u.rot.rotation.x += (clamp(P.stickY || 0, -1, 1) * 0.07 - u.rot.rotation.x) * Math.min(1, s.dt * 3);
        u.rot.rotation.z += (-clamp(P.stickX || 0, -1, 1) * 0.06 - u.rot.rotation.z) * Math.min(1, s.dt * 3);
        // souffle du rotor : poussière ou embruns soulevés près du sol
        const wl = SIM.waterAt(P.x, P.z), gh = SIM.groundH(P.x, P.z), base = wl !== null ? Math.max(gh, wl) : gh, agl = P.y - base;
        u.dw = (u.dw || 0) - s.dt;
        if (n > 0.5 && agl < 28 && u.dw <= 0 && SIM.boom) { u.dw = 0.08 + agl * 0.006; const k = 1 - agl / 28;
          for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28, r = 4 + Math.random() * 9 * (0.6 + k);
            SIM.boom.puff(P.x + Math.cos(a) * r, base + 0.6, P.z + Math.sin(a) * r, (2.5 + Math.random() * 3) * (0.5 + k), 1.6 + Math.random(), wl !== null && wl >= gh ? 'spray' : 'dust'); } }
      } };
  }
  V.rebuildPlayer = function (liv, type) {
    const wasIn = V.cockpit.g.visible;
    SIM.scene.remove(V.plane.root);
    if (type === 'heli') {
      V.plane = heliPlayer(liv); SIM.scene.add(V.plane.root);
      V.cockpit = { g: new THREE.Group(), cap: {}, fo: {}, update() { } }; V.cockpit.g.visible = false; V.plane.body.add(V.cockpit.g);
      V.myLiv = liv; V.myType = type; P.heli = true; return;
    }
    P.heli = false;
    if (type === 'chasseur') {
      V.plane = SIM.buildFighter({ style: (SIM.war && SIM.war.paint) || 'gris' }); V.plane.root.rotation.order = 'YXZ'; SIM.scene.add(V.plane.root);
      V.cockpit = { g: new THREE.Group(), cap: {}, fo: {}, update() { } }; V.cockpit.g.visible = false; V.plane.body.add(V.cockpit.g);
      V.myLiv = liv; V.myType = type; SIM.setPerf(type); return;
    }
    SIM.setPerf(type);
    V.plane = SIM.buildAircraft(liv, false, type); V.plane.root.rotation.order = 'YXZ'; SIM.scene.add(V.plane.root);
    V.cockpit = SIM.buildCockpit(V.plane);
    const s = V.plane.body.scale, ref = new THREE.Vector3(0, 4.2, -16);
    V.cockpit.g.scale.set(1 / s.x, 1 / s.y, 1 / s.z);
    V.cockpit.g.position.set(ref.x * (s.x - 1) / s.x, ref.y * (s.y - 1) / s.y, ref.z * (s.z - 1) / s.z);
    V.cockpit.g.visible = wasIn; V.myLiv = liv; V.myType = type;
  };
  V.resize = function () {
    const w = window.innerWidth, h = window.innerHeight;
    V.renderer.setSize(w, h, false); V.cam.aspect = w / h; V.cam.updateProjectionMatrix();
  };

  // ---------- Vues ----------
  V.VIEWS = [
    ['chase', 'Poursuite'], ['cockpit', 'Cockpit 3D (pilotes)'], ['commandant', 'Commandant de bord'], ['cockpitLarge', 'Cockpit grand angle'], ['near', 'Arrière proche'], ['front', 'De face'], ['left', 'Côté gauche'], ['right', 'Côté droit'],
    ['below', 'Dessous'], ['top', 'Dessus'], ['tower', 'Tour de contrôle'], ['flyby', 'Passage (loin)'], ['wheel', 'Train d\'atterrissage'], ['wing', 'Hublot passager'], ['orbit', 'Orbite libre'],
  ];
  V.view = 'chase'; V.orb = { yaw: 0, pitch: 0, zoom: 1 }; V.camYaw = 0;
  const q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function localPt(x, y, z) { return v1.set(x, y, z).applyMatrix4(V.plane.body.matrixWorld).clone(); }
  function cpPt(x, y, z) { return v1.set(x, y, z).applyMatrix4(V.cockpit.g.matrixWorld).clone(); }
  V.inside = () => V.view === 'cockpit' || V.view === 'commandant' || V.view === 'cockpitLarge';
  V.setView = function (id) {
    V.view = id; V.orb = { yaw: 0, pitch: 0, zoom: 1 }; V.flyPt = null; $('cockpit').hidden = true;
    const ins = V.inside(); V.cockpit.g.visible = ins; V.cockpit.cap.visible = true; if (id === 'commandant') V.orb.yaw = 0;
    V.cam.near = ins ? 0.04 : 0.3; V.cam.updateProjectionMatrix();
  };
  V.updateCamera = function (dt) {
    const cam = V.cam, root = V.plane.root, pos = root.position, o = V.orb;
    let fov = 60;
    V.camYaw += SIM.wrap((P.psi - V.camYaw) * R2D) * D2R * Math.min(1, dt * 2.5);
    const yaw = V.camYaw + o.yaw, z = o.zoom;
    const aroundAt = (back, hgt, side, look) => {
      if (P.heli && V.view !== 'commandant' && V.view !== 'cockpitLarge') { back *= 0.36; hgt *= 0.36; side *= 0.36; }
      else if (!V.inside() && SIM.tyx) { const k = clamp((SIM.tyx().half || 17) / 30, 1, 3.2); back *= k; hgt *= k; side *= k; look = (look || 4) * k; }   // gros avions : caméra plus loin pour voir toute la queue
      const sy = Math.sin(yaw), cy = Math.cos(yaw);
      const dir = new THREE.Vector3(sy, 0, -cy), right = new THREE.Vector3(cy, 0, sy);
      const p = pos.clone().addScaledVector(dir, -back * z).addScaledVector(right, side * z); p.y += hgt * z + Math.sin(o.pitch) * back * z;
      cam.position.copy(p); cam.up.copy(up); cam.lookAt(pos.x, pos.y + (look || 4), pos.z);
    };
    switch (V.view) {
      case 'cockpit': {
        if (P.heli || V.plane.fighter) { const ey = V.plane.eye || [0, 2, -1]; cam.position.copy(localPt(ey[0], ey[1], ey[2])); e.set(-8 * D2R + o.pitch, o.yaw, 0); q.setFromEuler(e); cam.quaternion.copy(root.quaternion).multiply(q); cam.up.set(0, 1, 0).applyQuaternion(root.quaternion); fov = 80; break; }
        cam.position.copy(cpPt(0, 4.8, -14.5));
        e.set(-6 * D2R + o.pitch, o.yaw, 0); q.setFromEuler(e); cam.quaternion.copy(root.quaternion).multiply(q); cam.up.set(0, 1, 0).applyQuaternion(root.quaternion); fov = 74; break;
      }
      case 'commandant': case 'cockpitLarge': {
        if (P.heli || V.plane.fighter) { aroundAt(V.plane.fighter ? 20 : 16, 4, 7, 2); break; }
        // caméra tournée vers le commandant : on le voit de face, avec la planche de bord, les fenêtres et l'extérieur derrière lui
        const large = V.view === 'cockpitLarge';
        const tg = large ? { x: -0.35, y: 4.15, z: -15.2 } : { x: -0.55, y: 4.35, z: -15.05 };
        const yaw = (large ? 0.95 : 0.85) + o.yaw, pit = clamp((large ? 0.12 : 0.05) + o.pitch * 0.5, -0.35, 0.6), r = (large ? 1.55 : 1.1) * clamp(z, 0.6, 1.5);
        let lx = tg.x + Math.sin(yaw) * r * Math.cos(pit), ly = tg.y + Math.sin(pit) * r, lz = tg.z - Math.cos(yaw) * r * Math.cos(pit);
        lx = clamp(lx, -1.15, 1.15); ly = clamp(ly, 3.3, 5.05); lz = clamp(lz, -16.25, -13.9);
        cam.position.copy(cpPt(lx, ly, lz)); cam.up.set(0, 1, 0).applyQuaternion(root.quaternion); cam.lookAt(cpPt(tg.x, tg.y, tg.z)); fov = large ? 80 : 68; break;
      }
      case 'old-cockpit': {
        cam.position.copy(localPt(-0.55, 4.55, -15.7));
        e.set(-4 * D2R + o.pitch, o.yaw, 0); q.setFromEuler(e); cam.quaternion.copy(root.quaternion).multiply(q); cam.up.set(0, 1, 0).applyQuaternion(root.quaternion); fov = 70; break;
      }
      case 'chase': aroundAt(62, 13, 0); break;
      case 'near': aroundAt(32, 6, 0, 4.5); break;
      case 'front': { const sy = Math.sin(yaw), cy = Math.cos(yaw); aroundAt(-58, 6, 0); break; }
      case 'left': aroundAt(0.01, 4, -58); break;
      case 'right': aroundAt(0.01, 4, 58); break;
      case 'orbit': aroundAt(70 * Math.cos(o.pitch), 6 + 70 * Math.sin(Math.max(o.pitch, -0.3)), 0); break;
      case 'top': cam.position.set(pos.x + 0.01, pos.y + 95 * z, pos.z + 0.01); cam.up.set(Math.sin(P.psi), 0, -Math.cos(P.psi)); cam.lookAt(pos); break;
      case 'below': {
        if (P.agl > 20) { cam.position.copy(localPt(14 * z, -26 * z, -18 * z)); cam.up.set(0, 1, 0); cam.lookAt(localPt(0, 2, 0)); }
        else { cam.position.copy(localPt(10 * z, 0, -26 * z)); cam.position.y = Math.max(cam.position.y, SIM.groundH(cam.position.x, cam.position.z) + 0.6); cam.up.set(0, 1, 0); cam.lookAt(localPt(0, 1.5, -4)); }
        break;
      }
      case 'wheel': cam.position.copy(localPt(1.4, 1.25, -5.5)); cam.up.set(0, 1, 0).applyQuaternion(root.quaternion); cam.lookAt(localPt(3.8 + o.yaw * 10, 0.8, 1)); fov = 75; break;
      case 'wing': cam.position.copy(localPt(-1.85, 4.25, 1.2)); cam.up.set(0, 1, 0).applyQuaternion(root.quaternion); cam.lookAt(localPt(-12, 2.6 + o.pitch * 10, -2 + o.yaw * 15)); fov = 65; break;
      case 'tower': {
        let best = null, bd = 1e12;
        SIM.allTowers().forEach(tw => { const d = Math.hypot(tw.x - pos.x, tw.z - pos.z); if (d < bd) { bd = d; best = tw; } });
        cam.position.copy(best); cam.up.set(0, 1, 0); cam.lookAt(pos.x, pos.y + 3, pos.z);
        const d = cam.position.distanceTo(pos); fov = clamp(2 * Math.atan(70 / d) * R2D / z, 1.2, 60); break;
      }
      case 'flyby': {
        const f = new THREE.Vector3(Math.sin(P.psi), 0, -Math.cos(P.psi));
        if (!V.flyPt || V.flyPt.distanceTo(pos) > 1400 || f.dot(v2.copy(V.flyPt).sub(pos)) < -700) {
          const sp = Math.max(P.V, 30), r = new THREE.Vector3(Math.cos(P.psi), 0, Math.sin(P.psi));
          V.flyPt = pos.clone().addScaledVector(f, Math.min(sp * 8, 900)).addScaledVector(r, (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 60));
          V.flyPt.y = Math.max(pos.y + (Math.random() * 30 - 8), SIM.groundH(V.flyPt.x, V.flyPt.z) + 2);
        }
        cam.position.copy(V.flyPt); cam.up.set(0, 1, 0); cam.lookAt(pos.x, pos.y + 3, pos.z);
        fov = clamp(2 * Math.atan(45 / cam.position.distanceTo(pos)) * R2D, 8, 60); break;
      }
    }
    const gh = SIM.groundH(cam.position.x, cam.position.z);
    if (V.view !== 'cockpit' && V.view !== 'wheel' && V.view !== 'wing' && cam.position.y < gh + 1.2) cam.position.y = gh + 1.2;
    if (SIM.boom.shake > 0) { const k = SIM.boom.shake * (V.inside() ? 0.05 : 1.2); cam.position.x += (Math.random() - 0.5) * k; cam.position.y += (Math.random() - 0.5) * k; cam.position.z += (Math.random() - 0.5) * k; }
    if (P.onGround && P.V > 8 && !P.crashed) { const r = Math.min(P.V / 70, 1) * (V.inside() ? 0.012 : 0.05); cam.position.x += (Math.random() - 0.5) * r; cam.position.y += (Math.random() - 0.5) * r; }
    if (V.shakeT > 0) { V.shakeT -= dt; const k = V.shakeT * (V.inside() ? 0.12 : 1.8); cam.position.x += (Math.random() - 0.5) * k; cam.position.y += (Math.random() - 0.5) * k; cam.position.z += (Math.random() - 0.5) * k; }
    if (P.turbo && !V.inside()) fov = Math.min(fov * (1 + clamp(P.mach - 0.6, 0, 1.2) * 0.25), 85);
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
  };

  // ---------- Avion visuel ----------
  V.syncPlane = function (dt, t) {
    const R = V.plane.root;
    // avions très longs : près du sol, l'assiette affichée est limitée pour que la queue ne s'enfonce pas dans la piste (comme un vrai pilote qui évite de « frotter la queue »)
    let thV = P.theta + (P.onGround && !P.heli ? P.gTh || 0 : 0);
    if (!P.heli && V.plane.body && thV > 0) { const sc = V.plane.body.scale, arm = 18 * sc.z, clr = 3.3 * sc.y, agl = Math.max(0, P.y - SIM.groundH(P.x, P.z)); thV = Math.min(thV, Math.atan((clr + agl) / arm)); }
    R.position.set(P.x, P.y, P.z); R.rotation.set(thV, -P.psi, -(P.phi + (P.onGround && !P.heli ? P.gPhi || 0 : 0)), 'YXZ');
    // poids de l'avion : écrasement des amortisseurs au toucher puis rebonds amortis, vibrations au roulage
    if (V.td) { V.td.t += dt; const k = Math.exp(-V.td.t * 3.2); R.position.y -= V.td.amp * k * Math.cos(V.td.t * 13); R.rotation.x += V.td.amp * 0.05 * k * Math.sin(V.td.t * 11); R.rotation.z += V.td.amp * 0.03 * k * Math.sin(V.td.t * 9); if (V.td.t > 2.5) V.td = null; }
    if (P.onGround && P.V > 3 && !P.crashed) { const st = P.surf ? P.surf.type : 'piste', r = Math.min(P.V / 70, 1) * (st === 'foret' ? 8 : st === 'herbe' ? 3 : st === 'route' ? 1.6 : 1); R.position.y += (Math.random() - 0.5) * 0.035 * r; R.rotation.x += (Math.random() - 0.5) * 0.0025 * r; }
    if (P.crashed) {
      if (P.crashKind === 'eau') { P.crashY -= dt * 0.12; R.position.y = Math.max(P.crashY, P.y - 9); }
      else { if (P.visY == null) P.visY = V.visGround(P.x, P.z); R.position.y = P.visY - 0.6; }
      R.rotation.set(-0.12, -P.psi, -(P.crashPhi || 0.3), 'YXZ');
    }
    // porte avant : elle s'ouvre pendant l'embarquement / le débarquement, puis se referme
    if (V.plane.setDoor) {
      const want = V.myBoard && !V.myBoard.fin && P.onGround && P.V < 1 ? 1 : 0;
      V.plane.cabinK = (V.plane.cabinK || 0) + clamp(want - (V.plane.cabinK || 0), -dt * 0.4, dt * 0.4);
      V.plane.setDoor(V.plane.cabinK);
    }
    R.updateMatrixWorld(true);
    const ap = P.ap, aerr = ap.on && !P.onGround ? clamp((P.apPhiErr || 0) * 3, -1, 1) : P.stickX;
    V.wheelV = P.onGround ? P.V + (P.bV || 0) : (V.wheelV || 0) * Math.max(0, 1 - dt * 0.3);
    V.cockpit.update(dt, t, P);
    // flammes de postcombustion en hypervitesse
    if (!V.plane.flames) V.plane.flames = V.plane.engs.map(e => { const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: SIM.glowTex('rgba(255,240,200,1)', 'rgba(255,90,20,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); f.position.set(0, 0, 4.2); e.add(f); const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: SIM.glowTex('rgba(150,200,255,1)', 'rgba(60,120,255,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); c.position.set(0, 0, 3.1); e.add(c); return [f, c]; });
    const fl = P.turbo && P.thr > 0.2 && !P.crashed; V.plane.flames.forEach(([f, c]) => { f.visible = c.visible = fl; if (fl) { const k = 0.85 + Math.random() * 0.3; f.scale.set(3.2 * k * (0.6 + P.thr), 3.2 * k * (0.6 + P.thr), 1); f.position.z = 3.6 + P.thr * 1.6 * k; c.scale.setScalar(1.8 * k); } });
    V.plane.update({ flapPos: P.flapPos, ail: aerr, elev: P.stickY, rud: P.onGround ? P.steer / (60 * D2R) : P.rudder, spoil: P.spoilPos,
      gearPos: P.crashed ? Math.min(P.gearPos, 0.25) : P.gearPos, n1: P.n1, wheelV: V.wheelV, steer: P.steer, ab: P.ab || P.turbo, rev: P.rev && P.onGround ? (P.revAmt == null ? 1 : P.revAmt) : 0, dt, t, night: SIM.world.night, lights: P.lights });
    const gh = SIM.groundH(P.x, P.z), agl = P.y - gh;
    V.shadow.visible = agl < 400 && !SIM.isSea(P.x, P.z) && !P.crashed && V.plane.root.visible;
    if (V.shadow.visible) {
      const s = SIM.world.sunDir, off = Math.min(agl / Math.max(s.y, 0.25), 400);
      V.shadow.position.set(P.x - s.x * off, gh + 0.3, P.z - s.z * off); V.shadow.rotation.y = -P.psi; if (V.plane.body && !P.heli) V.shadow.scale.set(Math.max(0.4, (SIM.tyx().half || 17) / 17), 1, V.plane.body.scale.z); else V.shadow.scale.set(1, 1, 1);   // l'ombre a la taille réelle de l'avion
      V.shadow.material.opacity = 0.42 * (1 - agl / 400) * (1 - SIM.world.night);
    }
  };

  // ---------- Feu en cas d'accident ----------
  V.visGround = function (x, z) {
    const rc = V.rc || (V.rc = new THREE.Raycaster());
    rc.set(new THREE.Vector3(x, 12000, z), new THREE.Vector3(0, -1, 0));
    const hit = rc.intersectObject(SIM.world.terrain.mesh, false)[0];
    const g = SIM.groundH(x, z);
    return hit && Math.abs(hit.point.y - g) < 400 ? Math.max(hit.point.y, SIM.isSea(x, z) ? 0.4 : -1e9) : g;
  };
  V.crashFx = function () {
    if (V.cockpit) V.cockpit.g.userData.noDebris = true;
    SIM.boom.explode(V.plane, P, P.crashKind === 'eau');
    if (V.inside() || V.view === 'wheel' || V.view === 'wing') { V.setView('orbit'); }
    V.orb.zoom = 1.7; V.orb.pitch = 0.3;
    V.boomSound(1.4);
  };
  V.touchdown = function (vs) {
    const amp = clamp(-vs / 500 * 0.32, 0.12, 0.8);
    V.td = { t: 0, amp }; V.shakeT = 0.35 + amp * 0.9; V.boomSound(0.18 + amp * 0.5);
    V.chirp(0.7 + amp); V.markT = 0.6;                                                  // crissement et traces de gomme au toucher
    if (P.surf && !['eau', 'mer'].includes(P.surf.type)) { const c = Math.cos(P.psi), s = Math.sin(P.psi); for (const sx of [-1, 1]) SIM.boom.puff(P.x + c * sx * 3.8, P.y + 0.5, P.z + s * sx * 3.8, 3 + amp * 3, 1.8, 'tire'); }
    // atterrissage trop dur : l'écran et l'avion rougissent un instant (plus c'est dur, plus c'est rouge)
    const k = clamp((-vs - 350) / 900, 0, 1);
    if (k > 0) {
      V.redK = 0.3 + 0.7 * k; V.redT = 0;
      const el = document.getElementById('tdFlash'); if (el) { el.style.transition = 'none'; el.style.opacity = (0.25 + 0.55 * k).toFixed(2); void el.offsetWidth; el.style.transition = 'opacity 1.6s ease-out'; el.style.opacity = '0'; }
    }
  };
  // teinte rouge de l'avion qui s'estompe après un toucher brutal
  const redCol = new THREE.Color(0xff1a00);
  V.updateRed = function (dt) {
    if (!V.redK || !V.plane) return;
    V.redT += dt; const a = V.redK * Math.max(0, 1 - V.redT / 1.8) * (0.75 + 0.25 * Math.cos(V.redT * 14));
    V.plane.root.traverse(o => {
      if (!o.isMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(m => { if (!m || !m.emissive) return; if (!m.userData.em0) m.userData.em0 = m.emissive.clone(); m.emissive.copy(m.userData.em0).lerp(redCol, a * 0.55); });
    });
    if (V.redT > 1.8) { V.redK = 0; V.plane.root.traverse(o => { if (!o.isMesh) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m && m.userData.em0) { m.emissive.copy(m.userData.em0); delete m.userData.em0; } }); }); }
  };
  V.clearFx = function () { SIM.boom.clear(); if (V.plane) V.plane.root.visible = true; };
  // fumée des réacteurs abîmés : légère et grise au début, noire et épaisse quand c'est grave
  const ev3 = new THREE.Vector3();
  V.engSmoke = function (dt) {
    if (!P.dmg || P.crashed || !V.plane) return;
    V.smT = V.smT || [0, 0];
    for (let i = 0; i < 2; i++) {
      const d = P.dmg[i]; if (d < 0.02) continue;
      V.smT[i] -= dt; if (V.smT[i] > 0) continue; V.smT[i] = 0.09 / (0.35 + d);
      const E = V.plane.engs || [], list = E.length >= 4 ? (i === 0 ? [E[1], E[3]] : [E[0], E[2]]) : E.length === 2 ? [E[i === 0 ? 1 : 0]] : [];
      const pts = list.length ? list.map(e => { e.getWorldPosition(ev3); return ev3.clone(); }) : [new THREE.Vector3(P.x, P.y + 3, P.z)];
      pts.forEach(p => {
        const back = 4 + Math.random() * 3, fx = Math.sin(P.psi), fz = -Math.cos(P.psi);
        SIM.boom.puff(p.x - fx * back, p.y + 0.3, p.z - fz * back, 2.2 + d * 6 + Math.random() * 1.5, 2.2 + d * 4, d > 0.6 ? 'smoke' : 'grey');
        if (d > 0.75 && P.eng[i] && Math.random() < 0.4) SIM.boom.puff(p.x - fx * 2.5, p.y, p.z - fz * 2.5, 1.6 + Math.random(), 0.25, 'fire');
      });
    }
  };
  // ---------- Traces de pneus (freinage, dérapage, toucher) ----------
  const MK = 1500; let mkGeo = null, mkN = 0, mkLast = [null, null];
  function markInit() {
    mkGeo = new THREE.BufferGeometry(); mkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MK * 18), 3)); mkGeo.setDrawRange(0, 0);
    const m = new THREE.Mesh(mkGeo, new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 }));
    m.frustumCulled = false; m.renderOrder = 2; SIM.scene.add(m);
  }
  function markSeg(a, b, w) {
    if (!mkGeo) markInit();
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, nx = -dz / L * w / 2, nz = dx / L * w / 2, ya = a.y + 0.06, yb = b.y + 0.06;
    const arr = mkGeo.attributes.position.array, o = (mkN % MK) * 18;
    arr.set([a.x - nx, ya, a.z - nz, b.x - nx, yb, b.z - nz, b.x + nx, yb, b.z + nz, a.x - nx, ya, a.z - nz, b.x + nx, yb, b.z + nz, a.x + nx, ya, a.z + nz], o);
    mkN++; mkGeo.setDrawRange(0, Math.min(mkN, MK) * 6); mkGeo.attributes.position.needsUpdate = true;
  }
  V.markCount = () => mkN;
  V.marks = function (dt) {
    if (V.markT > 0) V.markT -= dt;
    const surf = P.surf ? P.surf.type : 'piste', hard = !['eau', 'mer'].includes(surf);
    const braking = P.onGround && P.V > 6 && !P.crashed && hard && ((P.brake || P.brakeMax || P.abActive) && P.V > 12 || V.skidOn > 0 || V.markT > 0);
    if (V.skidOn > 0) V.skidOn -= dt;
    if (!braking) { mkLast = [null, null]; return; }
    const tx = SIM.tyx ? SIM.tyx() : { half: 17 }, sxw = tx.half > 25 ? 5.5 : P.type === 'jet' ? 1.6 : P.type === 'chasseur' ? 1.4 : 3.8, c = Math.cos(P.psi), s = Math.sin(P.psi);
    [-1, 1].forEach((sd, i) => {
      const p = { x: P.x + c * sd * sxw - Math.sin(P.psi) * 0.5, z: P.z + s * sd * sxw + Math.cos(P.psi) * 0.5 }; p.y = SIM.groundH(p.x, p.z);
      p.y = Math.max(p.y + 0.12, P.y + 0.04);
      const l = mkLast[i]; if (!l) { mkLast[i] = p; return; }
      if (Math.hypot(p.x - l.x, p.z - l.z) > 1.2) { markSeg(l, p, P.brakeMax ? 1.3 : 1.0); mkLast[i] = p; }
    });
  };
  // ---------- Bruit des pneus et crissements ----------
  V.chirp = function (k) { V.chirpK = Math.max(V.chirpK || 0, k); };
  V.tireSound = function (dt) {
    const A = V.audio; if (!A) return;
    if (!A.tire) {
      const ctx = A.ctx, buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const mk = (f, type, q) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(ctx.destination); s.start(); return { g, fl }; };
      A.tire = mk(160, 'lowpass'); A.screech = mk(1900, 'bandpass', 9); A.rough = mk(420, 'bandpass', 1.2);
    }
    const t = A.ctx.currentTime, inside = V.inside(), st = P.surf ? P.surf.type : 'piste', on = P.onGround && !P.crashed, sp = Math.abs(P.V + (P.bV || 0));
    const rough = st === 'foret' ? 1 : st === 'herbe' ? 0.6 : st === 'route' ? 0.25 : 0;
    // roulement : grondement qui monte avec la vitesse, coups réguliers des joints de piste
    V.jointT = (V.jointT || 0) + sp * dt; let thump = 0; if (V.jointT > 7.5 && sp > 3) { V.jointT = 0; thump = 0.25; }
    A.tire.g.gain.setTargetAtTime(on ? clamp(sp / 60, 0, 1) * (inside ? 0.35 : 0.6) + thump * (inside ? 0.5 : 0.8) : 0, t, thump ? 0.01 : 0.12);
    A.tire.fl.frequency.setTargetAtTime(90 + sp * 4, t, 0.2);
    A.rough.g.gain.setTargetAtTime(on ? rough * clamp(sp / 25, 0, 1) * 0.55 : 0, t, 0.1);
    // crissement : toucher, dérapage, freinage d'urgence
    const brk = on && sp > 8 && (P.brakeMax ? 0.5 : 0) + (V.skidOn > 0 ? 0.6 : 0);
    V.chirpK = Math.max(0, (V.chirpK || 0) - dt * 2.2);
    A.screech.g.gain.setTargetAtTime((brk + V.chirpK) * 0.22 * (rough ? 0.3 : 1), t, 0.03);
    A.screech.fl.frequency.setTargetAtTime(1500 + Math.random() * 700, t, 0.05);
  };
  // ---------- Hypervitesse : longue traînée de feu et de fumée · traînées de condensation en altitude ----------
  const tv = new THREE.Vector3();
  V.trails = function (dt) {
    if (!V.plane || P.crashed || P.heli) return;
    const E = (V.plane.engs || []).length ? V.plane.engs : [V.plane.body], fx = Math.sin(P.psi), fz = -Math.cos(P.psi);
    if (P.turbo && P.thr > 0.2 && P.eng.some(e => e)) {
      V.hyT = (V.hyT || 0) - dt; if (V.hyT <= 0) { V.hyT = 0.03;
        E.forEach(e => { e.getWorldPosition(tv); const b = 6 + Math.random() * 3; SIM.boom.puff(tv.x - fx * b, tv.y, tv.z - fz * b, 3 + Math.random() * 2.5, 0.5 + Math.random() * 0.3, 'fire'); SIM.boom.puff(tv.x - fx * (b + 10), tv.y + 0.5, tv.z - fz * (b + 10), 4 + Math.random() * 3, 3.5, 'smoke'); });
      }
    } else if (P.y > 7800 && !P.onGround && SIM.world.weather < 3) {
      V.ctT = (V.ctT || 0) - dt; if (V.ctT <= 0) { V.ctT = 0.14;
        E.forEach(e => { e.getWorldPosition(tv); SIM.boom.puff(tv.x - fx * 30, tv.y, tv.z - fz * 30, 3.5, 14, 'tire'); });
      }
    }
  };
  V.updateFx = function (dt) { SIM.boom.update(dt); V.updateRed(dt); V.engSmoke(dt); V.marks(dt); V.tireSound(dt); V.trails(dt); V.realFx(dt); };
  // réalisme : tremblement avant le décrochage (buffeting), condensation sur l'extrados en virage serré / grande incidence / air humide
  const _wp = new THREE.Vector3();
  V.realFx = function (dt) {
    if (!V.plane || P.crashed || P.heli || P.onGround) return;
    const m = P.aMargin == null ? 1 : P.aMargin / D2R;
    if (m < 3 && P.V > 30) V.shakeT = Math.max(V.shakeT || 0, 0.12 * (3 - m) / 3 + 0.03);
    const humid = (SIM.world.weather || 0) >= 1, vap = (P.nz || 1) > 1.7 || (m < 4 && P.V > 60) || (humid && P.flapPos > 0.4 && P.agl < 1500 && P.V > 55);
    V.vapT = (V.vapT || 0) - dt;
    if (vap && V.vapT <= 0 && V.plane.body) {
      V.vapT = 0.05; const sc = V.plane.body.scale, k = clamp(((P.nz || 1) - 1.4) / 1.5 + (4 - m) / 6, 0.3, 1.2);
      for (const sx of [-1, 1]) for (const xx of [4.5, 8.5, 12.5]) { _wp.set(sx * xx, 3.0 + xx * 0.05, -1.5 + xx * 0.4); V.plane.body.localToWorld(_wp);
        SIM.boom.puff(_wp.x, _wp.y + 0.8 * sc.y, _wp.z, (1.6 + Math.random()) * sc.x * k, 0.35, 'spray'); }
    }
  };
  V.boomSound = function (k) {
    const A = V.audio; if (!A) return; const c = A.ctx, t = c.currentTime, n = c.createBufferSource(), len = c.sampleRate * 3;
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    n.buffer = buf; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; const g = c.createGain(); g.gain.setValueAtTime(Math.min(3, 2 * k), t); g.gain.exponentialRampToValueAtTime(0.001, t + 3);
    n.connect(f); f.connect(g); g.connect(c.destination); n.start(t);
  };
  SIM.onBoom = k => V.boomSound(k);

  // ---------- Instruments ----------
  const adi = $('adi').getContext('2d'), set = (el, v) => { if (el._v !== v) { el._v = v; el.textContent = v; } };
  const cls = (el, c) => { if (el._c !== c) { el._c = c; el.className = c; } };
  function drawADI() {
    const c = adi, W = 200, ppd = 4;
    c.save(); c.clearRect(0, 0, W, W); c.beginPath(); c.arc(100, 100, 99, 0, 7); c.clip();
    c.translate(100, 100); c.rotate(-P.phi); c.translate(0, P.theta * R2D * ppd);
    c.fillStyle = '#1e7ed6'; c.fillRect(-300, -600, 600, 600); c.fillStyle = '#8a5a2b'; c.fillRect(-300, 0, 600, 600);
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(-300, 0); c.lineTo(300, 0); c.stroke();
    c.font = '13px "B612 Mono",monospace'; c.fillStyle = '#fff'; c.textAlign = 'right';
    for (let d = -30; d <= 30; d += 5) { if (!d) continue; const y = -d * ppd, w = d % 10 ? 14 : 28; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-w, y); c.lineTo(w, y); c.stroke(); if (!(d % 10)) c.fillText(Math.abs(d), -w - 4, y + 4); }
    c.restore();
    c.save(); c.translate(100, 100); c.strokeStyle = '#ffd22e'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(-62, 0); c.lineTo(-24, 0); c.lineTo(-24, 9); c.moveTo(62, 0); c.lineTo(24, 0); c.lineTo(24, 9); c.stroke();
    c.fillStyle = '#ffd22e'; c.fillRect(-4, -4, 8, 8);
    c.rotate(-P.phi); c.strokeStyle = '#fff'; c.lineWidth = 2;
    for (const b of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) { c.save(); c.rotate(b * D2R); c.beginPath(); c.moveTo(0, -92); c.lineTo(0, b % 30 ? -86 : -80); c.stroke(); c.restore(); }
    c.restore();
    c.fillStyle = '#ffd22e'; c.beginPath(); c.moveTo(100, 18); c.lineTo(94, 30); c.lineTo(106, 30); c.fill();
    if (Math.abs(P.phi) > 67 * D2R - 0.01) { c.strokeStyle = '#38e08a'; }
  }
  V.updateHUD = function () {
    const KT = SIM.KT, FT = SIM.FT, ap = P.ap, R = SIM.route;
    const ias = P.ias / KT, alt = P.y / FT, vsf = P.vs / FT * 60;
    set($('hSpd'), Math.round(ias)); set($('hAlt'), Math.round(alt / 10) * 10); set($('hHdg'), String(Math.round(P.psi * R2D) % 360).padStart(3, '0'));
    set($('hVs'), (vsf >= 0 ? '+' : '') + Math.round(vsf / 50) * 50 + ' ft/min');
    set($('hAgl'), P.crashed ? 'AU SOL' : 'SOL ' + Math.round(P.agl / FT) + ' ft');
    // cadre ILS
    const il = SIM.ils(), ib = $('ils'), showI = il.ok && !P.onGround && !P.crashed && V.showILS !== false;
    ib.hidden = !showI;
    if (showI) {
      const along = Math.max(il.along, 200), locDeg = Math.atan2(il.lat, along) * R2D, gsDeg = Math.atan2(il.dev, along) * R2D;
      $('ilsLoc').style.left = (50 - clamp(locDeg / 2.5, -1, 1) * 45) + '%';
      $('ilsGs').style.left = (50 - clamp(gsDeg / 0.7, -1, 1) * 45) + '%';
      set($('ilsT'), 'ILS ' + R.ae.id + ' · ' + R.dest.city); set($('ilsD'), (il.along / 1000).toFixed(1) + ' km');
      const lt = Math.abs(locDeg) < 0.3 ? '<b>Axe OK</b>' : locDeg > 0 ? 'Virez à <b>gauche</b>' : 'Virez à <b>droite</b>';
      const gt = Math.abs(gsDeg) < 0.15 ? '<b>Pente OK</b>' : gsDeg > 0 ? 'Trop <b>haut</b> : descendez' : 'Trop <b>bas</b> : remontez';
      const h = lt + ' · ' + gt + '<br>V/S cible ' + Math.round(il.vsTgt / 50) * 50 + ' ft/min · ' + SIM.FLAPSPD[4] + ' kt' + (P.gearDown ? '' : ' · <b style="color:var(--red)">TRAIN !</b>') + (ias > SIM.FLAPSPD[4] + 25 ? ' · <b style="color:var(--amber)">TROP VITE : réduisez les gaz</b>' : '');
      if (ib._h !== h) { ib._h = h; $('ilsTxt').innerHTML = h; }
    }
    set($('hSpdTgt'), ap.athr || ap.on ? (ap.spdMng ? '● ' : '') + ap.spd + ' kt' : 'M ' + P.mach.toFixed(2));
    set($('hHdgTgt'), ap.on ? (ap.lat === 'NAV' || ap.lat === 'LOC' ? R.wps[Math.min(R.active, 3)].n : String(ap.hdg).padStart(3, '0') + '°') : '');
    drawADI();
    // FMA
    const thrTxt = ap.athr ? (ap.srs || P.thr >= 0.99 ? 'MAN TOGA' : P.ap.flare && P.agl < 10 ? 'THR IDLE' : 'SPEED') : P.thr >= 0.99 ? 'MAN TOGA' : P.rev ? 'REV' : 'MAN';
    set($('fmaThr'), thrTxt); cls($('fmaThr'), ap.athr ? '' : 'off');
    const vert = !ap.on ? '—' : ap.srs ? 'SRS' : ap.flare ? 'FLARE' : ap.gs ? 'G/S' : ap.vert === 'VS' ? 'V/S ' + (ap.vs > 0 ? '+' : '') + ap.vs : ap.vert === 'ALT' ? 'ALT ' + ap.alt : ap.vert + ' ' + ap.alt;
    set($('fmaVert'), vert); cls($('fmaVert'), ap.on ? '' : 'off');
    const lat = !ap.on ? '—' : ap.rollout ? 'ROLL OUT' : ap.lat === 'RWY' ? 'RWY' : ap.lat === 'LOC' ? 'LOC' : ap.lat === 'NAV' ? 'NAV' : 'HDG ' + String(ap.hdg).padStart(3, '0');
    set($('fmaLat'), lat); cls($('fmaLat'), ap.on ? '' : 'off');
    set($('fmaAppr'), ap.appr ? (ap.gs ? 'LAND' : 'APPR ARM') : ap.full ? 'MANAGED' : '—'); cls($('fmaAppr'), ap.appr ? (ap.gs ? '' : 'arm') : ap.full ? '' : 'off');
    set($('fmaEng'), (ap.on ? 'AP1 ' : 'AP OFF ') + (ap.athr ? 'A/THR' : '')); cls($('fmaEng'), ap.on ? '' : 'off');
    // ECAM
    const n1 = P.n1.map(n => (n * 100).toFixed(1)), dist = SIM.routeRemaining() / 1000, gs = !P.onGround && P.gs != null && !P.heli ? P.gs : P.V * Math.cos(P.gamma), wnd = SIM.windAt ? SIM.windAt(P.y, P.tSim) : null;
    const eta = gs > 20 ? dist * 1000 / gs / 60 : 0;
    const g = (k, v, c) => `<span class="k">${k}</span> <span class="${c || 'g'}">${v}</span><br>`;
    const ec = g('N1', n1.join('  '), P.n1.some(n => n > 1.001) ? 'a' : 'g') + g('MOTEURS', P.eng.map(x => x ? 'ON' : 'OFF').join(' '), P.eng.every(x => x) ? 'g' : 'a')
      + g('VOLETS', SIM.FLAPNAME[P.flapSel] + (Math.abs(P.flapPos - P.flapSel / 4) > 0.01 ? ' ⟳' : ''), 'c')
      + g('TRAIN', P.gearPos > 0.99 ? '▼ ▼ ▼' : P.gearPos < 0.01 ? 'RENTRÉ' : 'EN TRANSIT', P.gearPos > 0.99 ? 'g' : P.gearPos < 0.01 ? 'c' : 'r')
      + g('AÉROFREINS', P.spoilPos > 0.02 ? Math.round(P.spoilPos * 100) + ' %' : P.spoilArm ? 'ARM' : '—', P.spoilPos > 0.02 ? 'a' : 'c')
      + g('FREINS', P.pbrk ? 'PARC' : P.brake ? 'MAN' : P.abActive ? 'AUTO ACTIF' : 'AUTO ' + ['OFF', 'LO', 'MED', 'MAX'][P.autobrake], P.pbrk ? 'a' : 'g')
      + (P.agl < 760 && !P.onGround ? g('RADIO ALT', Math.round(P.agl / FT) + ' ft', 'g') : '')
      + g('CARBURANT', P.fuel != null ? (P.fuel / 1000).toFixed(1) + ' t · ' + Math.round((P.ff || 0) * 3600) + ' kg/h' : '—', P.fuel != null && P.fuelCap && P.fuel / P.fuelCap < 0.1 ? 'r' : 'g')
      + (P.dmg && (P.dmg[0] > 0.01 || P.dmg[1] > 0.01) ? g('PANNE', P.dmg.map((d, i) => d > 0.01 ? 'M' + (i + 1) + (d >= 1 ? ' ARRÊT' : ' FUMÉE') : '').filter(x => x).join(' · '), 'r') : '')
      + (wnd ? g('VENT', String(Math.round(wnd.dir / 10) * 10 || 360).padStart(3, '0') + '° / ' + Math.round(wnd.kt) + ' kt' + (SIM.wind.gust && P.agl < 900 ? ' raf. ' + SIM.wind.gust : ''), 'c') : '') + g('MACH', P.mach.toFixed(2)) + g('GS / TAS', Math.round(gs / KT) + ' / ' + Math.round(P.V / KT) + ' kt')
      + g('VERS ' + R.dest.id, Math.round(dist) + ' km' + (eta ? ' · ' + Math.round(eta) + ' min' : ''), 'c')
      + (SIM.timeScale > 1 ? g('TEMPS', '×' + SIM.timeScale, 'a') : '');
    if ($('ecam')._v !== ec) { $('ecam')._v = ec; $('ecam').innerHTML = ec; }
    // alertes
    let a = null, k = '';
    const flapsVfe = ias > SIM.VFE[P.flapSel] + 5;
    if (P.crashed) a = null;
    else if (P.stall) { a = 'DÉCROCHAGE'; k = 'warn'; }
    else if (!P.onGround && P.agl < 300 && P.vs < -15) { a = 'TERRAIN — TIREZ !'; k = 'warn'; }
    else if (!P.onGround && P.agl < 230 && P.gearPos < 0.99 && P.flapSel >= 3 && P.vs < 0) { a = 'TRAIN ! SORTEZ LE TRAIN'; k = 'warn'; }
    else if (P.turbo) { a = 'HYPERVITESSE · MACH ' + P.mach.toFixed(2); k = 'info'; }
    else if (!P.turbo && (P.type === 'chasseur' ? (ias > 800 || P.mach > 1.85) : (ias > 350 || P.mach > SIM.perf().mmo))) { a = 'SURVITESSE'; k = 'warn'; }
    else if (flapsVfe && P.flapPos > 0.05) { a = 'VITESSE MAX VOLETS'; k = 'caut'; }
    else if (P.pbrk && P.n1.some(n => n > 0.6)) { a = 'FREIN DE PARC SERRÉ'; k = 'caut'; }
    else if (P.alphaFloor) { a = 'ALPHA FLOOR'; k = 'caut'; }
    else if (V.tailT > 0) { a = 'TAILSTRIKE'; k = 'caut'; }
    else if (P.rev && P.onGround) { a = 'INVERSEURS'; k = 'info'; }
    const al = $('alert'); al.hidden = !a; if (a) { set(al, a); cls(al, k); }
    V.tailT = Math.max(0, (V.tailT || 0) - 0.1);
    // panneau
    set($('thrInfo'), 'N1 ' + n1.join(' / ') + ' %');
    set($('trimVal'), (P.theta * R2D).toFixed(1) + '°');
  };

  // ---------- Radar / ND ----------
  const nd = $('ndc').getContext('2d'); V.ndMode = 'ROSE'; V.ndRange = 40; V.trail = [];
  const RNG = [5, 10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5500];
  V.ndStep = function (d) { const i = clamp(RNG.indexOf(V.ndRange) + d, 0, RNG.length - 1); V.ndRange = RNG[i]; $('ndRng').textContent = V.ndRange; };
  V.drawND = function () {
    const c = nd, Wd = 600, R = SIM.route, ap = P.ap, rose = V.ndMode === 'ROSE';
    const cx = 300, cy = rose ? 420 : 300, rad = rose ? 330 : 270, s = rad / (V.ndRange * 1000), ps = P.psi;
    const S = (x, z) => { const dx = x - P.x, dn = -(z - P.z); if (!rose) return [cx + dx * s, cy - dn * s]; const r = dx * Math.cos(ps) - dn * Math.sin(ps), f = dx * Math.sin(ps) + dn * Math.cos(ps); return [cx + r * s, cy - f * s]; };
    c.fillStyle = '#000'; c.fillRect(0, 0, Wd, Wd);
    c.save(); c.beginPath(); c.rect(0, 0, Wd, Wd); c.clip();
    // anneaux
    c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1.5; c.setLineDash([6, 8]);
    for (const f of [0.5, 1]) { c.beginPath(); c.arc(cx, cy, rad * f, 0, 7); c.stroke(); }
    c.setLineDash([]);
    c.font = '20px "B612 Mono",monospace'; c.fillStyle = 'rgba(255,255,255,.6)'; c.textAlign = 'left'; c.fillText(V.ndRange / 2 + '', cx + rad * 0.5 * 0.7 + 4, cy - rad * 0.5 * 0.7);
    // traînée
    c.strokeStyle = 'rgba(56,224,138,.55)'; c.lineWidth = 3; c.beginPath();
    V.trail.forEach((p, i) => { const [x, y] = S(p[0], p[1]); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
    // pistes et aéroports
    SIM.AIRPORTS.forEach(a => {
      const e = SIM.airportEnds(a), [x1, y1] = S(e[0].x, e[0].z), [x2, y2] = S(e[1].x, e[1].z), [ax, ay] = S(a.x, a.z);
      if (ax < -200 || ax > 800 || ay < -200 || ay > 800) return;
      c.strokeStyle = '#fff'; c.lineWidth = 5; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.strokeStyle = '#3fd0ff'; c.lineWidth = 2.5; c.beginPath(); c.arc(ax, ay, 10, 0, 7); c.stroke();
      c.fillStyle = '#3fd0ff'; c.font = '20px "B612",sans-serif'; c.fillText(a.icao + ' ' + a.city, ax + 14, ay - 10);
    });
    // sommets
    c.font = '17px "B612",sans-serif';
    SIM.PEAKS.forEach(p => {
      const [x, y] = S(p.x, p.z); if (x < -20 || x > 620 || y < -20 || y > 620) return;
      c.fillStyle = '#c98b4a'; c.beginPath(); c.moveTo(x, y - 10); c.lineTo(x + 9, y + 6); c.lineTo(x - 9, y + 6); c.fill();
      if (V.ndRange <= 320) { c.fillStyle = '#e0b07a'; c.fillText(p.n + ' ' + p.real, x + 12, y + 6); }
    });
    // trafic (TCAS) : altitude relative en centaines de pieds
    SIM.ai.traffic().forEach(o => {
      const [x, y] = S(o.x, o.z); if (x < 0 || x > 600 || y < 0 || y > 600) return;
      const rel = Math.round((o.y - P.y) / SIM.FT / 100), close = Math.hypot(o.x - P.x, o.z - P.z) < 11000 && Math.abs(rel) < 12 && !o.ground;
      c.fillStyle = close ? '#ffb21e' : '#ffffff'; c.strokeStyle = c.fillStyle; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, y - 8); c.lineTo(x + 8, y); c.lineTo(x, y + 8); c.lineTo(x - 8, y); c.closePath(); o.ground ? c.stroke() : c.fill();
      c.font = '16px "B612 Mono",monospace'; c.fillText((rel > 0 ? '+' : rel < 0 ? '−' : '') + String(Math.abs(rel)).padStart(2, '0') + (o.vs > 0 ? '↑' : o.vs < 0 ? '↓' : ''), x + 11, y - 6);
    });
    // route
    const pts = [[R.de.x, R.de.z]].concat(R.wps.map(w => [w.x, w.z]));
    c.strokeStyle = '#ff5ad9'; c.lineWidth = 3; c.beginPath();
    pts.forEach((p, i) => { const [x, y] = S(p[0], p[1]); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
    R.wps.forEach((w, i) => {
      const [x, y] = S(w.x, w.z); c.fillStyle = i === R.active ? '#fff' : '#ff5ad9';
      c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x + 9, y); c.lineTo(x, y + 9); c.lineTo(x - 9, y); c.fill();
      c.font = '18px "B612 Mono",monospace'; c.fillText(w.n, x + 12, y + 18);
    });
    // axe d'approche
    const [fx, fy] = S(R.ae.x - R.ad[0] * 20000, R.ae.z - R.ad[1] * 20000), [tx, ty] = S(R.ae.x, R.ae.z);
    c.strokeStyle = 'rgba(63,208,255,.6)'; c.setLineDash([10, 10]); c.lineWidth = 2; c.beginPath(); c.moveTo(fx, fy); c.lineTo(tx, ty); c.stroke(); c.setLineDash([]);
    c.restore();
    // rose des caps
    c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineWidth = 2; c.textAlign = 'center';
    if (rose) {
      c.beginPath(); c.arc(cx, cy, rad, 0, 7); c.stroke();
      for (let d = 0; d < 360; d += 5) {
        const a = (d - ps * R2D) * D2R, sx = Math.sin(a), sy = -Math.cos(a), l = d % 10 ? 10 : 18;
        c.beginPath(); c.moveTo(cx + sx * rad, cy + sy * rad); c.lineTo(cx + sx * (rad - l), cy + sy * (rad - l)); c.stroke();
        if (!(d % 30)) { c.font = '22px "B612 Mono",monospace'; c.fillText(d / 10, cx + sx * (rad - 38), cy + sy * (rad - 38) + 8); }
      }
      if (ap.on || ap.athr) { const a = (ap.hdg - ps * R2D) * D2R; c.fillStyle = '#3fd0ff'; c.save(); c.translate(cx + Math.sin(a) * rad, cy - Math.cos(a) * rad); c.rotate(a); c.fillRect(-9, -4, 18, 14); c.restore(); }
      c.fillStyle = '#ffd22e'; c.beginPath(); c.moveTo(cx, cy - rad - 4); c.lineTo(cx - 10, cy - rad - 22); c.lineTo(cx + 10, cy - rad - 22); c.fill();
    } else {
      c.font = '22px "B612 Mono",monospace'; c.fillText('N', 300, 24);
    }
    // avion
    c.save(); c.translate(cx, cy); if (!rose) c.rotate(ps);
    c.strokeStyle = '#ffd22e'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, -24); c.lineTo(0, 26); c.moveTo(-22, -2); c.lineTo(22, -2); c.moveTo(-9, 20); c.lineTo(9, 20); c.stroke(); c.restore();
    // textes
    const gs = P.V * Math.cos(P.gamma) / SIM.KT, w = R.wps[Math.min(R.active, 3)], dw = Math.hypot(w.x - P.x, w.z - P.z) / 1000;
    c.textAlign = 'left'; c.font = '20px "B612 Mono",monospace'; c.fillStyle = '#fff';
    c.fillText('GS ' + Math.round(gs) + '  TAS ' + Math.round(P.V / SIM.KT), 12, 28);
    c.textAlign = 'right'; c.fillStyle = '#ff5ad9'; c.fillText(w.n + '  ' + dw.toFixed(dw < 10 ? 1 : 0) + ' km', 588, 28);
    c.fillStyle = '#3fd0ff'; c.fillText('HDG ' + String(Math.round(ps * R2D) % 360).padStart(3, '0'), 588, 54);
  };

  // ---------- Son ----------
  V.audio = null;
  V.toggleSound = function () {
    if (V.audio) { V.audio.ctx.close(); V.audio = null; return false; }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0); let l = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; }
    const mk = (f, type) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(ctx.destination); s.start(); return { fl, g }; };
    const roar = mk(300, 'lowpass'), wind = mk(900, 'bandpass'), rain = mk(2500, 'highpass'), thun = mk(120, 'lowpass');
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; const ob = ctx.createBiquadFilter(); ob.type = 'bandpass'; ob.Q.value = 6; const og = ctx.createGain(); og.gain.value = 0;
    osc.connect(ob); ob.connect(og); og.connect(ctx.destination); osc.start();
    V.audio = { ctx, roar, wind, rain, thun, osc, ob, og }; return true;
  };
  V.updateSound = function () {
    const A = V.audio; if (!A) return; const n = (P.n1[0] + P.n1[1]) / 2, t = A.ctx.currentTime, inside = V.inside() || V.view === 'wing';
    A.roar.g.gain.setTargetAtTime(P.crashed ? 0 : n * n * (inside ? 0.45 : 0.9), t, 0.2); A.roar.fl.frequency.setTargetAtTime(150 + n * 900, t, 0.2);
    A.og.gain.setTargetAtTime(P.crashed || n < 0.05 ? 0 : 0.012 + n * 0.02, t, 0.2); A.osc.frequency.setTargetAtTime(500 + n * 2600, t, 0.2); A.ob.frequency.setTargetAtTime(500 + n * 2600, t, 0.2);
    A.rain.g.gain.setTargetAtTime(SIM.world.raining ? (SIM.world.weather === 3 ? 0.5 : 0.3) * (inside ? 1 : 0.6) : 0, t, 0.5);
    A.wind.g.gain.setTargetAtTime(clamp(P.ias / 160, 0, 1) * (inside ? 0.25 : 0.12), t, 0.3);
  };
  V.thunder = function () {
    const A = V.audio; if (!A) return; const t = A.ctx.currentTime, d = 0.6 + Math.random() * 1.5;
    A.thun.g.gain.cancelScheduledValues(t); A.thun.g.gain.setValueAtTime(0, t + d); A.thun.g.gain.linearRampToValueAtTime(2.2, t + d + 0.15); A.thun.g.gain.exponentialRampToValueAtTime(0.001, t + d + 3.5);
  };
  // gouttes de pluie sur le pare-brise (vue cockpit)
  const wc = document.getElementById('wet'), wx2 = wc.getContext('2d'), drops = [];
  V.drawWet = function (dt) {
    const on = V.inside() && SIM.world.raining && !P.crashed; wc.hidden = !on; if (!on) { drops.length = 0; return; }
    if (wc.width !== wc.clientWidth) wc.width = wc.clientWidth; if (wc.height !== wc.clientHeight) wc.height = wc.clientHeight;
    const W = wc.width, H = wc.height, sp = P.ias / 60;
    const rate = (SIM.world.weather === 3 ? 90 : 45) * dt;
    for (let i = 0; i < rate; i++) drops.push({ x: Math.random() * W, y: Math.random() * H * 0.72, r: 1.5 + Math.random() * 3.5, life: 1 });
    wx2.clearRect(0, 0, W, H);
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]; d.life -= dt * (0.25 + sp * 0.4);
      const dx = (d.x - W / 2) / W; d.x += dx * sp * 260 * dt; d.y -= sp * 120 * dt * (0.3 + Math.random() * 0.4); d.y += (sp < 0.3 ? 30 : 0) * dt;
      if (d.life <= 0 || d.y < 0 || d.x < 0 || d.x > W) { drops.splice(i, 1); continue; }
      wx2.fillStyle = `rgba(210,225,240,${0.35 * d.life})`; wx2.beginPath(); wx2.ellipse(d.x, d.y, d.r, d.r * (1 + sp * 2), Math.atan2(-sp, dx * sp + 0.0001) + Math.PI / 2, 0, 7); wx2.fill();
      wx2.fillStyle = `rgba(255,255,255,${0.5 * d.life})`; wx2.fillRect(d.x - d.r * 0.3, d.y - d.r * 0.4, 1.2, 1.2);
    }
    if (drops.length > 600) drops.splice(0, drops.length - 600);
  };
  // voix : on choisit explicitement une vraie voix anglaise pour l'anglais et une voix française pour le français
  // (sinon certains navigateurs lisent l'anglais avec la voix française)
  let VOICES = [];
  const loadVoices = () => { try { VOICES = speechSynthesis.getVoices() || []; } catch (e) { VOICES = []; } };
  if (window.speechSynthesis) { loadVoices(); try { speechSynthesis.onvoiceschanged = loadVoices; } catch (e) { } }
  function pickVoice(lang) {
    if (!VOICES.length) loadVoices();
    const pre = lang.slice(0, 2).toLowerCase(), list = VOICES.filter(v => (v.lang || '').toLowerCase().replace('_', '-').startsWith(pre));
    if (!list.length) return null;
    const pref = pre === 'en' ? [/en-us/i, /en-gb/i, /google us english/i, /zira|david|mark|aria|jenny|guy/i] : [/fr-fr/i, /google fran/i, /hortense|julie|paul|denise|henri/i];
    for (const r of pref) { const v = list.find(v => r.test(v.lang) || r.test(v.name)); if (v) return v; }
    return list[0];
  }
  V.hasEnglishVoice = () => !!pickVoice('en-US');
  V.say = function (txt, lang, pitch, rate) {
    if (!V.audio || !window.speechSynthesis) return;
    try {
      const L = lang || 'fr-FR', u = new SpeechSynthesisUtterance(txt), v = pickVoice(L);
      u.lang = v ? v.lang : L; if (v) u.voice = v; u.rate = rate || 1.1; u.pitch = pitch || 1; speechSynthesis.speak(u);
    } catch (e) { }
  };
})();
