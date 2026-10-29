// Mécanique du vol (loi normale type Airbus), moteurs, freins, pilote automatique, plan de vol et consignes
(function () {
  const D2R = SIM.D2R, R2D = SIM.R2D, clamp = SIM.clamp, G = 9.81, KT = 0.514444, FT = 0.3048;
  let MASS = 64000, S = 122.6, TMAX = 120000;
  const lerpA = (arr, f) => { const i = Math.min(Math.floor(f), arr.length - 2), t = f - i; return arr[i] + (arr[i + 1] - arr[i]) * t; };
  const wrap = a => ((a + 540) % 360) - 180;
  const CL0 = [0.25, 0.55, 0.7, 0.82, 1.0], CLMAX = [1.5, 2.0, 2.2, 2.4, 2.6], CDF = [0, 0.012, 0.022, 0.035, 0.06];
  const VFE = [999, 230, 200, 185, 177], FLAPSPD = [210, 190, 170, 155, 138];
  const VFE0 = VFE.slice(), FS0 = FLAPSPD.slice();
  // performances par type d'appareil (masse kg, surface alaire m², poussée max par paire de réacteurs N, vitesses kt)
  const PERF = {
    A320: { name: 'Airbus A320', m: 64000, S: 122.6, T: 120000, v1: 140, vr: 145, vapp: 138, roll: 1, pitch: 1, mmo: 0.82, ceil: 39000, mach: 0.78, bank: 35 },
    A319: { name: 'Airbus A319', m: 58000, S: 122.6, T: 115000, v1: 135, vr: 140, vapp: 133, roll: 1.05, pitch: 1, mmo: 0.82, ceil: 39000, mach: 0.78, bank: 35 },
    A321: { name: 'Airbus A321', m: 80000, S: 126, T: 147000, v1: 145, vr: 150, vapp: 142, roll: 0.95, pitch: 0.95, mmo: 0.82, ceil: 39000, mach: 0.78, bank: 35 },
    militaire: { name: 'Transport militaire', m: 80000, S: 126, T: 150000, v1: 145, vr: 150, vapp: 140, roll: 0.95, pitch: 0.95, mmo: 0.8, ceil: 37000, mach: 0.76, bank: 35 },
    gros: { name: 'Gros porteur biréacteur', m: 220000, S: 360, T: 400000, v1: 150, vr: 158, vapp: 145, roll: 0.75, pitch: 0.8, mmo: 0.86, ceil: 41000, mach: 0.84, bank: 30 },
    jumbo: { name: 'Jumbo 4 réacteurs (type 747)', m: 330000, S: 511, T: 560000, v1: 155, vr: 165, vapp: 152, roll: 0.65, pitch: 0.7, mmo: 0.9, ceil: 41000, mach: 0.85, bank: 30 },
    super: { name: 'Super-jumbo double pont (type A380)', m: 450000, S: 845, T: 700000, v1: 150, vr: 160, vapp: 140, roll: 0.6, pitch: 0.65, mmo: 0.89, ceil: 41000, mach: 0.85, bank: 30 },
    geant: { name: 'Géant An-225 « Mriya » (6 réacteurs, le plus gros avion de tous les temps)', m: 600000, S: 905, T: 1150000, v1: 150, vr: 165, vapp: 150, roll: 0.5, pitch: 0.6, mmo: 0.8, ceil: 36000, mach: 0.72, bank: 28 },
    leviathan: { name: 'LÉVIATHAN 4 ponts (12 réacteurs · 158 m de long · 154 m d\'envergure, le plus géant)', m: 1600000, S: 3000, T: 3000000, v1: 150, vr: 165, vapp: 150, roll: 0.36, pitch: 0.45, mmo: 0.84, ceil: 37000, mach: 0.8, bank: 25 },
    hyperion: { name: 'HYPÉRION (8 réacteurs · 211 m de long, le plus long de tous)', m: 1400000, S: 2600, T: 2600000, v1: 150, vr: 165, vapp: 150, roll: 0.38, pitch: 0.42, mmo: 0.85, ceil: 39000, mach: 0.81, bank: 25 },
    titan: { name: 'Titan triple pont (8 réacteurs, avion de ligne titanesque · 110 m)', m: 900000, S: 1450, T: 1700000, v1: 150, vr: 162, vapp: 148, roll: 0.45, pitch: 0.55, mmo: 0.86, ceil: 39000, mach: 0.82, bank: 27 },
    colosse: { name: 'Colosse tri-fuselage (8 réacteurs, le plus grand de tous · 110 m d\'envergure)', m: 1150000, S: 1900, T: 2150000, v1: 150, vr: 165, vapp: 150, roll: 0.4, pitch: 0.5, mmo: 0.84, ceil: 37000, mach: 0.8, bank: 25 },
    jet: { name: 'Jet privé', m: 9500, S: 31, T: 17000, v1: 105, vr: 110, vapp: 115, roll: 1.8, pitch: 1.5, mmo: 0.81, ceil: 45000, mach: 0.78, bank: 40 },
    chasseur: { name: 'Chasseur Rafale (delta-canard)', m: 15000, S: 46, T: 50000, ab: 1.55, v1: 130, vr: 140, vapp: 145, roll: 18, pitch: 4, mmo: 1.8, ceil: 50000, mach: 0.9, bank: 85 },
  };
  // empattement (m), demi-envergure (m), réservoir (kg), débit carburant par réacteur à pleine poussée (kg/s)
  const TYX = { A320: { wb: 12.6, half: 17, cap: 18700, ff: 1.25 }, A319: { wb: 11.0, half: 17, cap: 18700, ff: 1.2 }, A321: { wb: 16.9, half: 17, cap: 18900, ff: 1.4 },
    militaire: { wb: 13, half: 20, cap: 20000, ff: 1.4 }, gros: { wb: 30, half: 30, cap: 110000, ff: 3.6 }, jumbo: { wb: 25.6, half: 32, cap: 170000, ff: 5.0 },
    super: { wb: 31, half: 40, cap: 250000, ff: 6.0 }, geant: { wb: 30, half: 44, cap: 300000, ff: 9.0 }, leviathan: { wb: 46, half: 77, cap: 700000, ff: 15 }, hyperion: { wb: 62, half: 71, cap: 650000, ff: 14 }, titan: { wb: 33, half: 53, cap: 420000, ff: 11.5 }, colosse: { wb: 28, half: 54, cap: 520000, ff: 13 }, jet: { wb: 6, half: 8, cap: 5500, ff: 0.35 }, chasseur: { wb: 5.3, half: 6, cap: 9000, ff: 1.1 } };
  SIM.TYX = TYX; SIM.tyx = () => TYX[P.type] || TYX.A320;
  let PF = PERF.A320;
  SIM.PERF = PERF;
  SIM.setPerf = function (type) {
    PF = PERF[type] || PERF.A320; P.type = PERF[type] ? type : 'A320';
    MASS = PF.m; S = PF.S; TMAX = PF.T;
    const k = PF.vapp / 138; for (let i = 0; i < 5; i++) { FLAPSPD[i] = Math.round(FS0[i] * k); VFE[i] = i ? Math.round(VFE0[i] * Math.max(k, 0.85)) : 999; }
  };
  SIM.perf = () => PF;
  // vitesse d'atterrissage conseillée : 165 kt (marge confortable au-dessus du décrochage), jamais plus de 170 kt
  SIM.landSpd = () => PF.ab ? PF.vapp : Math.min(170, Math.max(PF.vapp + 15, 165));
  SIM.FLAPNAME = ['0', '1+F', '2', '3', 'FULL'];

  const P = SIM.P = { lights: { nav: 1, beacon: 1, cabin: 1, landing: 0, taxi: 0, strobe: 0, logo: 0, wing: 0 },
    ap: { on: false, athr: false, lat: 'HDG', vert: 'VS', spd: 250, hdg: 0, alt: 20000, vs: 1800, appr: false, full: false, assist: true, spdMng: true }, manualCtl: true };
  let emit = (t, d) => SIM.onEvent && SIM.onEvent(t, d);

  function rho(h) { return h < 11000 ? 1.225 * Math.pow(1 - 2.2558e-5 * h, 4.2559) : 0.3639 * Math.exp(-(h - 11000) / 6341.6); }
  function sound(h) { return 340.3 * Math.sqrt(Math.max(216.65, 288.15 - 0.0065 * h) / 288.15); }
  SIM.rho = rho;

  // ---------- Plan de vol ----------
  SIM.makeRoute = function (dep, dest) {
    const pick = (a, brg) => SIM.airportEnds(a).reduce((b, e) => Math.abs(wrap(e.hdg - brg)) < Math.abs(wrap(b.hdg - brg)) ? e : b);
    const brg = SIM.geo.bearing(dep.x, dep.z, dest.x, dest.z);
    const de = pick(dep, brg), ae = pick(dest, brg);
    const dd = [Math.sin(de.hdg * D2R), -Math.cos(de.hdg * D2R)], ad = [Math.sin(ae.hdg * D2R), -Math.cos(ae.hdg * D2R)];
    const dist = Math.hypot(dest.x - dep.x, dest.z - dep.z);
    const cruise = clamp(Math.round(dist / 1000 * 90 / 1000) * 1000, 8000, 37000);
    const ifAlt = dest.elev + 3000 * FT;
    const wps = [
      { n: 'DEP', x: de.x + dd[0] * (dep.len + 6000), z: de.z + dd[1] * (dep.len + 6000) },
      { n: 'IF', x: ae.x - ad[0] * 30000, z: ae.z - ad[1] * 30000, alt: ifAlt },
      { n: 'FAF', x: ae.x - ad[0] * 12000, z: ae.z - ad[1] * 12000, alt: dest.elev + 2100 * FT },
      { n: ae.id, x: ae.x, z: ae.z, rwy: true },
    ];
    return { dep, dest, de, ae, ad, wps, cruise, dist, active: 0 };
  };
  SIM.routeRemaining = function () {
    const R = SIM.route; let d = 0, px = P.x, pz = P.z;
    for (let i = R.active; i < R.wps.length; i++) { d += Math.hypot(R.wps[i].x - px, R.wps[i].z - pz); px = R.wps[i].x; pz = R.wps[i].z; }
    return d;
  };

  // ---------- Réinitialisation ----------
  SIM.reset = function (depId, destId) {
    const A = id => SIM.AIRPORTS.find(a => a.id === id);
    const R = SIM.route = SIM.makeRoute(A(depId), A(destId));
    const e = R.de, h = e.hdg * D2R;
    Object.assign(P, { x: e.x + Math.sin(h) * 25, z: e.z - Math.cos(h) * 25, y: R.dep.elev + 0.15, psi: h, theta: 0, phi: 0, gamma: 0, V: 0, onGround: true,
      thr: 0, rev: false, n1: [0.2, 0.2], eng: [true, true], flapSel: 1, flapPos: 0.25, gearDown: true, gearPos: 1, spoilSel: 0, spoilArm: true, spoilPos: 0,
      pbrk: true, boarding: false, doorsClosed: false, belly: false, autoTaxi: null, brake: false, brakeConst: false, brakeLevel: 0.6, landAid: P.landAid !== false, aidRev: false, lift: 0, liftOn: false, crashKind: null, autobrake: 2, stickX: 0, stickY: 0, rudder: 0, trim: 0, crashed: false, landed: false, airTime: 0, lawB: 0, phase: 'park',
      steer: 0, vs: 0, agl: 0, ias: 0, mach: 0, alpha: 0, stall: false, abActive: false, parked: false, ci: {}, tdRate: 0, tSim: 0, birdCD: 0, alphaFloor: false, maxAlt: 0 });
    Object.assign(P.ap, { on: false, athr: false, lat: 'HDG', vert: 'VS', spd: 160, hdg: Math.round(e.hdg), alt: R.cruise, vs: 1800, appr: false, full: false, gs: false, desc: false, ii: 0, loc: false, flare: false, rollout: false, srs: false });
    P.lights.landing = 1; P.lights.strobe = 1; P.lights.taxi = 1;
    SIM.newWind(R.de && R.de.hdg != null ? R.de.hdg : null);
    P.dmg = [0, 0]; P.wd = [0, 0]; P.finD = 0; P.fuelCap = (TYX[P.type] || TYX.A320).cap; P.fuel = SIM.planFuel(R.dist); P.ff = 0; P.gTh = 0; P.gPhi = 0; P.gLean = 0; P.nw = 0;
    emit('reset');
  };
  // ---------- Vent réel : direction / force au sol (rafales près du sol), renforcé et tourné en altitude (courant-jet) ----------
  SIM.wind = { dir: 0, spd: 0, gust: 0 };
  SIM.newWind = function (rwyHdg) {
    const wx = SIM.world ? SIM.world.weather || 0 : 0;
    SIM.wind.dir = Math.round(((rwyHdg != null ? rwyHdg : Math.random() * 360) + (Math.random() - 0.5) * 70 + 360) % 360 / 10) * 10 || 360;
    SIM.wind.spd = Math.round(3 + Math.random() * 9 + wx * 4); SIM.wind.gust = wx >= 2 || Math.random() < 0.3 ? Math.round(SIM.wind.spd + 5 + Math.random() * 8 + wx * 3) : 0;
  };
  // vent à l'altitude h (m) : renvoie la vitesse de l'air (m/s, vers où il souffle), la direction d'où il vient et sa force en kt
  SIM.windAt = function (h, t) {
    const W = SIM.wind, hf = Math.max(0, h) / FT, k = Math.min(hf / 1000, 35);
    let spd = W.spd + k * 2.1 + (hf > 25000 ? (Math.min(hf, 38000) - 25000) / 1000 * 1.6 : 0), dir = W.dir + Math.min(hf / 1000, 10) * 3;
    if (W.gust && hf < 3000 && SIM.vnoise) spd += (W.gust - W.spd) * Math.max(0, SIM.vnoise((t || 0) * 0.35, 3.7) * 1.6 - 0.6) * (1 - hf / 3000);
    const r = dir * D2R, ms = spd * KT; return { vx: -Math.sin(r) * ms, vz: Math.cos(r) * ms, dir: ((dir % 360) + 360) % 360, kt: spd };
  };
  // correction de dérive : cap à tenir pour suivre la route crs (degrés) malgré le vent
  function wca(crs) { const w = SIM.windAt(P.y, P.tSim), c = crs * D2R, cross = w.vx * Math.cos(c) + w.vz * Math.sin(c); return Math.asin(clamp(cross / Math.max(P.V, 40), -0.5, 0.5)) * R2D; }
  // carburant embarqué : trajet + 45 min de réserve, sans dépasser la capacité du réservoir
  SIM.fuelNeed = function (dist) { const t = TYX[P.type] || TYX.A320; return Math.round(1.1 * 2 * t.ff * 0.27 * (dist / 230 + 1800) + 2 * t.ff * 0.3 * 2700); };
  SIM.planFuel = function (dist) { const t = TYX[P.type] || TYX.A320; return Math.min(t.cap, Math.max(SIM.fuelNeed(dist), t.cap * 0.2)); };
  // nouvelle étape (escale) sans déplacer l'avion
  SIM.setLeg = function (depId, destId) {
    const A = id => SIM.AIRPORTS.find(a => a.id === id);
    SIM.route = SIM.makeRoute(A(depId), A(destId)); P.ap.alt = SIM.route.cruise; P.ap.appr = false; P.ap.loc = false; P.ap.gs = false;
  };
  // faire le plein (au sol, arrêté, sur un aéroport)
  SIM.refuel = function (full) {
    if (!P.onGround || P.V > 1) return 'Le plein se fait au sol, avion arrêté.';
    const s = SIM.surface(P.x, P.z), near = SIM.AIRPORTS.some(a => Math.hypot(a.x - P.x, a.z - P.z) < 4500);
    if (!s.ap && !near) return 'Pas de camion-citerne ici : posez-vous sur un aéroport.';
    const t = TYX[P.type] || TYX.A320; P.fuelCap = t.cap;
    P.fuel = full ? t.cap : Math.max(P.fuel, SIM.planFuel(SIM.route.dist));
    if (P.eng.every(e => !e) && !P.crashed) P.eng = [P.dmg[0] < 1, P.dmg[1] < 1];
    return null;
  };
  // panne / dégâts sur un réacteur : il fume, perd de la poussée, puis s'arrête s'il est trop abîmé
  SIM.damageEngine = function (i, amt, why) {
    if (!P.dmg) P.dmg = [0, 0];
    if (i == null) i = Math.random() < 0.5 ? 0 : 1;
    const was = P.dmg[i]; P.dmg[i] = clamp(P.dmg[i] + amt, 0, 1);
    if (P.dmg[i] >= 1 && P.eng[i]) { P.eng[i] = false; emit('call', 'Moteur ' + (i + 1) + ' en panne'); }
    if (why) emit('engDmg', { i, d: P.dmg[i], was, why });
  };
  SIM.repair = function () { P.dmg = [0, 0]; P.wd = [0, 0]; if (SIM.view && SIM.view.plane && SIM.view.plane.repair) SIM.view.plane.repair(); if (!P.crashed) P.eng = [true, true]; };
  function crashNow(why, kind) {
    if (P.crashed) return;
    P.crashed = true; P.crashKind = kind || 'sol'; P.crashV = P.V; P.crashVs = P.vs; P.V = 0; P.eng = [false, false]; P.crashPhi = P.phi + (Math.random() - 0.5) * 0.6; P.crashY = P.y;
    emit('crash', why);
  }

  function engage(full) {
    const ap = P.ap; ap.full = full;
    if (full) { ap.on = true; ap.athr = true; ap.lat = P.onGround ? 'RWY' : 'NAV'; ap.vert = P.onGround ? 'SRS' : 'CLB'; ap.appr = true; ap.spdMng = true; ap.alt = SIM.route.cruise;
      if (P.onGround) { P.pbrk = false; P.thr = 1; P.flapSel = Math.max(P.flapSel, 1); ap.srs = true; } }
  }
  SIM.engageFull = engage;

  // ---------- Pilote automatique ----------
  function autopilot(dt, gh) {
    const ap = P.ap, R = SIM.route, ias = P.ias / KT, agl = P.y - gh - 0.15, out = { gam: null, phi: null, n1: null, rud: null, theta: null };
    const ae = R.ae, ad = R.ad, assist = ap.full && ap.assist;
    const dThr = Math.hypot(ae.x - P.x, ae.z - P.z);
    // séquencement
    if (R.active < R.wps.length - 1) {
      const w = R.wps[R.active], prev = R.active ? R.wps[R.active - 1] : { x: R.de.x, z: R.de.z };
      const lx = w.x - prev.x, lz = w.z - prev.z, past = (w.x - P.x) * lx + (w.z - P.z) * lz < 0;
      if (!P.onGround && (Math.hypot(w.x - P.x, w.z - P.z) < Math.max(1500, P.V * 10) || past)) { R.active++; emit('wp', R.wps[R.active]); }
    }
    // vitesse visée (gérée)
    if (ap.spdMng) {
      let s = P.y - R.dep.elev < 1500 * FT && P.airTime < 200 && R.active === 0 ? 160 : P.y < 10000 * FT ? 250 : 290;
      if (R.active >= 1 && !P.onGround) {
        const fs = FLAPSPD[Math.round(P.flapPos * 4)]; const desc = P.vs < -2 || P.y < R.cruise * FT - 300;
        if (desc && SIM.routeRemaining() < 60000) s = Math.min(s, 220);
        if (R.active >= 2 || ap.loc) s = Math.min(s, fs);
      }
      const mIas = 0.78 * sound(Math.max(P.y, 0)) * Math.sqrt(rho(Math.max(P.y, 0)) / 1.225) / KT;
      ap.spd = Math.round(Math.min(s, mIas));
    }
    // latéral
    if (ap.lat === 'RWY' || ap.rollout) {
      const end = ap.rollout ? ae : R.de, h = end.hdg * D2R, dx = Math.sin(h), dz = -Math.cos(h);
      const e = (P.x - end.x) * (-dz) + (P.z - end.z) * dx;   // écart à droite de l'axe
      const he = wrap(end.hdg - P.psi * R2D);
      out.rud = clamp(-e * 0.08 + he * 0.12, -1, 1);
      if (!P.onGround) { out.phi = 0; if (!ap.rollout && agl > 30) ap.lat = ap.full ? 'NAV' : 'HDG'; }
    } else {
      let hc = ap.hdg;
      if (ap.lat === 'NAV' || ap.lat === 'LOC') {
        const w = R.wps[Math.min(R.active, R.wps.length - 1)];
        hc = SIM.geo.bearing(P.x, P.z, w.x, w.z); hc -= wca(hc);
        const crs = ae.hdg, e = (P.x - ae.x) * (-ad[1]) + (P.z - ae.z) * ad[0];
        if (ap.appr && !ap.loc && R.active >= 2 && Math.abs(e) < 2500 && Math.abs(wrap(crs - P.psi * R2D)) < 70) { ap.loc = true; ap.lat = 'LOC'; emit('mode', 'LOC capturé'); }
        if (ap.loc) hc = crs - clamp(e * 0.045, -30, 30) - wca(crs);   // nez dans le vent (crabe) pour rester sur l'axe
        ap.hdg = Math.round((hc + 360) % 360);
      }
      const err = wrap(hc - P.psi * R2D);
      out.phi = clamp(err * 2.2, -25, 25) * D2R;
    }
    // vertical
    let vsCmd = null;
    if (ap.srs) {
      if (P.onGround) { if (SIM.atc && !SIM.atc.cleared && !P.autoTaxi) { out.n1 = 0.2; P.pbrk = true; ap.waitClr = true; return out; } if (ap.waitClr) { ap.waitClr = false; P.pbrk = false; } if (ias > PF.vr) out.theta = 15 * D2R; }
      else { out.gam = clamp(8 + (ias - ap.spd) * 0.35, 3, 13) * D2R; if (agl > 1500 * FT) { ap.srs = false; ap.vert = 'CLB'; if (assist) P.thr = 0.8; emit('mode', 'Montée (CLB)'); } }
    } else if (ap.flare || (ap.gs && agl < 16)) {
      if (!ap.flare) { ap.flare = true; emit('mode', 'Arrondi (FLARE)'); }
      out.gam = -(0.5 + clamp(agl / 16, 0, 1) * 2.5) * D2R;
    } else if (ap.gs) {
      const gsAlt = R.dest.elev + 15 + dThr * Math.tan(3 * D2R);
      out.gam = (-3 + clamp((gsAlt - P.y) * 0.025, -2.5, 2.5)) * D2R;
    } else {
      // profil géré : montée, croisière, descente
      if (ap.full) {
        const toIF = R.active <= 1 ? Math.hypot(R.wps[1].x - P.x, R.wps[1].z - P.z) : 0;
        const ifAlt = R.wps[1].alt, need = (P.y - ifAlt) / Math.tan(3 * D2R) + 8000;
        if ((R.active === 1 && toIF < need) || R.active >= 2) ap.desc = true;
        if (ap.desc) {
          ap.alt = Math.round(ifAlt / FT / 100) * 100;
          if (R.active <= 1 && P.y > ifAlt + 60) { ap.vert = 'DES'; vsCmd = clamp(-(P.V * (P.y - ifAlt)) / Math.max(toIF - 3000, 4000), -22, -3); }
        } else ap.alt = R.cruise;
      }
      const tgt = ap.alt * FT, d = tgt - P.y;
      if (ap.vert === 'ALT' || Math.abs(d) < 60) { if (ap.vert !== 'ALT' && Math.abs(d) < 60) { ap.vert = 'ALT'; emit('mode', 'Altitude capturée'); } vsCmd = clamp(d * 0.1, -8, 8); }
      else if (vsCmd === null) {
        const lim = ap.vert === 'VS' ? Math.abs(ap.vs) * FT / 60 : (d > 0 ? clamp(9 + (ias - ap.spd) * 0.4, 2, 18) : 12);
        vsCmd = clamp(d * 0.08, -lim, lim);
        if (ap.vert !== 'VS') ap.vert = d > 0 ? 'CLB' : 'DES';
      }
      if (ias < ap.spd - 20 && vsCmd > 0) vsCmd *= 0.4;
      if (ias > ap.spd + 20 && vsCmd < 0) vsCmd *= 0.5;
      out.gam = Math.asin(clamp(vsCmd / Math.max(P.V, 30), -0.25, 0.25));
      // glide
      if (ap.appr && ap.loc && !ap.gs) {
        const gsAlt = R.dest.elev + 15 + dThr * Math.tan(3 * D2R);
        if (dThr < 26000 && P.y > gsAlt - 25) { ap.gs = true; ap.vert = 'G/S'; emit('mode', 'Glide capturé'); }
      }
    }
    // auto-poussée
    if (ap.athr) {
      let cap = P.thr >= 0.99 ? 1 : 0.9;
      if (ap.srs) out.n1 = 1;
      else if (P.onGround && P.landed) out.n1 = 0.2;
      else if (ap.flare && agl < 10) { out.n1 = 0.2; if (!P.ci.retard) { P.ci.retard = 1; emit('call', 'Retard'); } }
      else {
        const err = ap.spd - ias; P.ap.ii = clamp((P.ap.ii || 0) + err * dt * 0.004, -0.3, 0.3);
        out.n1 = clamp(0.62 + err * 0.02 + P.ap.ii + (P.vs > 3 ? 0.12 : P.vs < -3 ? -0.15 : 0), 0.2, cap);
      }
      if (P.alphaFloor) out.n1 = 1;
    }
    // assistance train / volets / aérofreins
    if (assist && !P.onGround) {
      if (P.gearDown && P.vs > 2 && agl > 12 && R.active === 0) { P.gearDown = false; emit('call', 'Train rentré'); }
      if (R.active === 0 && P.flapSel > 0 && agl > 1500 * FT && ias > 195) { P.flapSel = 0; emit('call', 'Volets rentrés'); }
      if (R.active >= 1) {
        const want = dThr < 9000 ? 4 : ap.gs ? 3 : dThr < 24000 ? 2 : dThr < 34000 ? 1 : 0;
        if (want > P.flapSel && ias < VFE[want] - 5) { P.flapSel = want; emit('call', 'Volets ' + SIM.FLAPNAME[want]); }
        if ((ap.gs || dThr < 14000) && !P.gearDown) { P.gearDown = true; emit('call', 'Train sorti'); }
        P.spoilSel = ias > ap.spd + 15 && P.vs < -2 ? 0.5 : 0;
        if (P.y < 10000 * FT && !P.lights.landing) P.lights.landing = 1;
      }
    }
    return out;
  }

  // ---------- Pas d'intégration ----------
  // ---------- Hélicoptère (commandes assistées) ----------
  function heliStep(dt) {
    const gh = SIM.groundH(P.x, P.z), wl = SIM.waterAt(P.x, P.z), cont = (wl !== null ? Math.max(gh, wl) : gh) + 0.15;
    const sens = P.sensitive ? 2 : 1, eng = P.eng[0] || P.eng[1];
    // collectif : levier MONTÉE (W/S) ou manette des gaz ; levier de secours = montée/descente rapide
    let vcmd = P.liftOn ? P.lift * 9 : (P.thr - 0.5) * 18;
    if (Math.abs(P.emY || 0) > 0.03) vcmd = P.emY * 16;
    // coussin près du sol : la descente ralentit toute seule pour un toucher doux
    if (vcmd < 0 && eng) vcmd = Math.max(vcmd, -(1.3 + Math.max(0, P.y - cont) * 0.3));
    if (!eng) vcmd = -12;
    // cycliques : manche avant = accélérer, arrière = freiner / reculer ; latéral = virer ou glisser
    const uT = clamp(-P.stickY, -0.25, 1) * (P.turbo ? 140 : 72), wT = P.slide ? P.slide * 10 : 0;
    P.u = (P.u || 0) + clamp(uT - (P.u || 0), -4.5 * sens * dt, 3.5 * sens * dt);
    P.w = (P.w || 0) + clamp(wT - (P.w || 0), -4 * dt, 4 * dt);
    const vy0 = P.hvy || 0; P.hvy = vy0 + clamp(vcmd - vy0, -5 * dt, 4.5 * dt);
    // lacet : palonnier (Q/D) ou les flèches ← → et levier de secours ; en vol rapide, l'inclinaison fait tourner
    // ← → : à basse vitesse l'hélico pivote (lacet), en vol rapide il s'incline et vire ; Q/D (palonnier) pivotent toujours
    const fast = clamp((Math.abs(P.u) - 8) / 14, 0, 1);
    let yawCmd = Math.abs(P.emX || 0) > 0.03 ? P.emX * 1.6 : P.rudder * 0.9 * sens + P.stickX * 0.75 * sens * (1 - fast);
    const bankT = P.stickX * 30 * D2R * sens * fast;
    P.phi += clamp(bankT + P.w * 0.012 - P.phi, -40 * D2R * dt, 40 * D2R * dt);
    if (P.onGround) yawCmd *= 0.6;
    P.psi += (yawCmd + (Math.abs(P.u) >= 12 ? G * Math.tan(P.phi) / Math.max(Math.abs(P.u), 15) * Math.sign(P.u) : 0)) * dt;
    const acc = (uT - P.u) * 0.4;
    P.theta += clamp(-clamp(acc / G, -0.35, 0.35) - P.u * 0.0018 + 0.03 - P.theta, -0.6 * dt, 0.6 * dt);
    // position
    const fx = Math.sin(P.psi), fz = -Math.cos(P.psi), rx = Math.cos(P.psi), rz = Math.sin(P.psi);
    if (P.onGround) {
      P.u *= Math.max(0, 1 - 3 * dt); P.w *= Math.max(0, 1 - 3 * dt); P.phi = 0; P.theta = 0.03;
      if (vcmd > 0.6 && eng) { P.onGround = false; P.hvy = Math.max(P.hvy, 0.5); emit('call', 'Décollage'); } else P.hvy = 0;
    }
    P.x += (fx * P.u + rx * P.w) * dt; P.z += (fz * P.u + rz * P.w) * dt; P.y += P.hvy * dt;
    if (!P.onGround && P.y <= cont) {
      const vsf = P.hvy / FT * 60, bank = Math.abs(P.phi) / D2R;
      P.y = cont; P.crashKind = 'sol';
      let why = null;
      if (wl !== null && (vsf < -500 || Math.abs(P.u) > 15)) { why = 'L\'hélicoptère s\'est abîmé dans l\'eau (trop vite).'; P.crashKind = 'eau'; }
      else if (vsf < -1100) why = `Impact trop violent (${Math.round(vsf)} ft/min).`;
      else if (bank > 25) why = 'Les pales ont touché le sol (inclinaison trop forte).';
      else if (Math.abs(P.u) > 30) why = 'Atterrissage trop rapide : les patins ont cassé.';
      if (why) { P.crashKind = P.crashKind || 'sol'; P.crashed = true; P.crashV = Math.abs(P.u); P.V = 0; P.eng = [false, false]; emit('crash', why); return; }
      P.onGround = true; P.hvy = 0; P.landed = true; P.tdRate = vsf; P.phi = 0;
      const pad = (SIM.AIRPORTS.flatMap(a => a.helipads || [])).find(pd => Math.hypot(pd.x - P.x, pd.z - P.z) < 15);
      emit('touchdown', { vs: vsf, surf: { type: pad ? 'piste' : 'herbe' }, heli: true, pad: !!pad });
    }
    if (P.onGround) P.y = cont;
    P.V = Math.hypot(P.u, P.w); P.vs = P.hvy; P.gamma = 0; P.agl = Math.max(0, P.y - cont);
    const r = rho(Math.max(P.y, 0)); P.ias = P.V * Math.sqrt(r / 1.225); P.mach = P.V / sound(Math.max(P.y, 0));
    const tgtN = eng ? 0.62 + 0.38 * clamp(0.5 + vcmd / 18, 0, 1) : 0; P.n1 = P.n1.map(n => n + clamp(tgtN - n, -0.2 * dt, 0.25 * dt));
    P.alpha = 0; P.stall = false; P.alphaFloor = false; P.flapPos = 0; P.gearPos = 1; P.spoilPos = 0; P.steer = 0;
    P.maxAlt = Math.max(P.maxAlt || 0, P.y);
  }
  SIM.startHeli = function (h) {
    const a = h.a || SIM.route.dep, pad = h.pad || (SIM.life && SIM.life.freePad(a));
    Object.assign(P, { heli: true, x: h.x != null ? h.x : pad.x, z: h.z != null ? h.z : pad.z, y: h.y != null ? h.y : a.elev + 0.15, psi: h.psi || 0, theta: 0.03, phi: 0, gamma: 0,
      onGround: !(h.mode && h.mode !== 'ground'), u: h.mode === 'circuit' || h.mode === 'approach' ? (h.V || 40) : 0, w: 0, hvy: 0, V: 0, thr: 0.5, liftOn: true, lift: 0, emX: 0, emY: 0, eng: [true, true], n1: [0.62, 0.62],
      crashed: false, landed: false, parked: false, boarding: false, doorsClosed: true, autoTaxi: null, pbrk: false, rev: false, gearDown: true, gearPos: 1, flapSel: 0, flapPos: 0, spoilSel: 0, airTime: 100, ci: {}, tSim: 0, visY: null, turbo: false });
    if (pad) pad.busy = true;
    Object.assign(P.ap, { on: false, athr: false, full: false, srs: false, flare: false, gs: false, loc: false, rollout: false });
    P.lights.landing = 1; P.lights.strobe = 1; P.lights.beacon = 1;
    if (SIM.atc) { SIM.atc.q.length = 0; SIM.atc.st = 99; }
  };

  // ---------- Roulage automatique du poste jusqu'à la piste (repoussage, taxiway, alignement) ----------
  // mode 'push' : repoussage par le tracteur seulement (le pilote roule ensuite lui-même)
  // mode 'full' : repoussage (si besoin) + roulage automatique jusqu'à l'alignement
  SIM.taxiPlan = function () {
    const R = SIM.route, a = R.dep, C = a.comps[0], L = C.layout, s = R.de.id === C.ids[0] ? 1 : -1, hz = s * (a.len / 2 - 70), cA = s * L.APL * 0.5;
    const W = (lx, lz, extra) => Object.assign(C.toW(lx, lz), extra || {});
    return { C, L, s, hz, cA, W, hold: W(L.TX, hz + s * 25), fwd: [W(L.AX0 + 20, cA), W(L.TX, cA), W(L.TX, hz + s * 25), W(a.wid / 2 + 22, hz - s * 5), W(0, hz - s * 45), W(0, hz - s * 75)] };
  };
  SIM.startTaxi = function (mode) {
    mode = mode || 'full';
    const T = SIM.taxiPlan(), st = P.parkInfo && P.parkInfo.s, atStand = st && Math.hypot(st.x - P.x, st.z - P.z) < 12;
    if (!P.onGround || P.heli || P.landed) return false;
    let pts = [];
    if (atStand) {
      const back = T.W(st.lx - 38, st.lz, { back: true }), tgt = T.fwd[0];
      pts.push(back, { rot: true, x: tgt.x, z: tgt.z, ox: back.x, oz: back.z });
    } else if (mode === 'push') return false;
    if (mode === 'full') {
      // reprend au point du trajet le plus proche
      let i0 = 0;
      if (!atStand) { let bd = 1e12; T.fwd.forEach((p, i) => { const d = Math.hypot(p.x - P.x, p.z - P.z); if (d < bd) { bd = d; i0 = i; } }); }
      pts = pts.concat(T.fwd.slice(i0));
    }
    P.autoTaxi = { i: 0, pts, s: T.s, hz: T.hz, mode }; P.taxiK = 0;
    P.holdPt = T.hold;
    P.parked = false; P.boarding = false; P.doorsClosed = false; P.pbrk = false; P.thr = 0.2; P.lights.taxi = 1; P.lights.beacon = 1; P.lights.nav = 1;
    return true;
  };
  function taxiStep(dt) {
    const T = P.autoTaxi, tp = T.pts[T.i], gh = SIM.groundH(P.x, P.z) + 0.15;
    if (!tp) {
      P.V = 0; P.pbrk = true; P.autoTaxi = null; P.thr = 0;
      if (T.mode === 'push') { emit('pushDone'); return; }
      const e = SIM.route.de; P.psi = e.hdg * D2R; P.lights.landing = 1; P.lights.strobe = 1;
      emit('taxiDone', { hz: T.hz, s: T.s }); return;
    }
    const dx = tp.x - P.x, dz = tp.z - P.z, d = Math.hypot(dx, dz), fx = Math.sin(P.psi), fz = -Math.cos(P.psi);
    if (tp.rot) {
      // le tracteur fait pivoter l'avion sur place vers le taxiway
      P.V += clamp(0 - P.V, -1 * dt, 1 * dt);
      const err = wrap((Math.atan2(tp.x - tp.ox, -(tp.z - tp.oz)) - P.psi) * R2D);
      P.psi += clamp(err * D2R, -9 * D2R * dt, 9 * D2R * dt); P.steer = clamp(err / 40, -1, 1) * 0.8;
      P.x += fx * P.V * dt; P.z += fz * P.V * dt;
      if (Math.abs(err) < 1.5 && Math.abs(P.V) < 0.2) T.i++;
    }
    else if (tp.back) { P.V += clamp(-1.8 - P.V, -0.6 * dt, 0.6 * dt); P.x += fx * P.V * dt; P.z += fz * P.V * dt; if (dx * fx + dz * fz > -1) T.i++; }
    else {
      const brg = Math.atan2(dx, -dz), err = wrap((brg - P.psi) * R2D), nxt = T.pts[T.i + 1];
      const vt = Math.abs(err) > 25 ? 3 : clamp(d * 0.3 + 2, 3, 13);
      P.V += clamp(vt - P.V, -1.5 * dt, 0.8 * dt);
      P.psi += clamp(err * D2R * 1.5, -(P.V < 5 ? 25 : 12) * D2R * dt, (P.V < 5 ? 25 : 12) * D2R * dt);
      P.steer = clamp(err / 40, -1, 1) * 0.6;
      P.x += Math.sin(P.psi) * P.V * dt; P.z -= Math.cos(P.psi) * P.V * dt;
      if (d < Math.max(5, P.V * 1.4)) T.i++;
    }
    P.psi = (P.psi + Math.PI * 2) % (Math.PI * 2);
    P.y = gh; P.onGround = true; P.theta = 0; P.phi = 0; P.gamma = 0; P.vs = 0; P.agl = 0; P.ias = Math.abs(P.V);
    P.n1 = P.n1.map(n => n + clamp(0.32 - n, -0.1 * dt, 0.1 * dt)); P.gearPos = 1; P.flapPos += clamp(P.flapSel / 4 - P.flapPos, -dt / 24, dt / 24);
  }

  function step(dt) {
    if (P.crashed) return;
    P.tSim += dt;
    if (P.heli) { heliStep(dt); return; }
    // masse réelle : le kérosène pèse (avion plus lourd au départ, plus léger à l'arrivée) → décrochage, montée et freinage changent
    if (P.fuelCap) MASS = PF.m * (0.86 + 0.14 * clamp((P.fuel || 0) / P.fuelCap, 0, 1));
    if (P.autoTaxi) { taxiStep(dt); return; }
    // remise des gaz : dès que le pilote veut remonter, l'aide à l'atterrissage lui rend la main
    if (P.goAround > 0) P.goAround -= dt;
    if (P.onGround || P.agl >= 700) { P.thrUser = 0; P.liftUser = false; }
    if (!P.onGround && !P.ap.on && P.agl < 700 && (P.thrUser >= 0.85 || P.liftUser || (P.stickY > 0.85 && P.agl > 20) || (P.emY || 0) > 0.3) && !(P.goAround > 0) && P.vs < 3) {
      P.goAround = 30; P.thrUser = 0; P.liftUser = false;
      if (!P.manualCtl) { if (P.thr < 0.95) P.thr = 1; P.rev = false; P.spoilSel = 0; if (P.landAid && P.flapSel > 2) P.flapSel = P.flapSel - 1; }
      emit('call', 'Remise des gaz');
    }
    if (P.goAround > 0 && P.landAid && !P.manualCtl && P.gearDown && P.vs > 2 && P.agl > 20) { P.gearDown = false; emit('call', 'Train rentré'); }
    const ap = P.ap, gh = SIM.groundH(P.x, P.z), wl = SIM.waterAt(P.x, P.z), onWater = wl !== null && wl > gh + 0.3;
    // hauteur de contact : sol, eau (l'avion flotte, à moitié enfoncé), ou sol sans train (sur le ventre)
    const SINK = { chasseur: 0.9, jet: 0.8, gros: 2.4, jumbo: 2.7, super: 3.0, geant: 3.3, titan: 3.4, colosse: 3.5, leviathan: 3.7, hyperion: 3.7 }[P.type] || 1.8;
    let cont = onWater ? wl : gh + 0.15;
    if (P.onGround) { if (onWater) cont = wl - SINK * (P.gearPos > 0.5 ? 1.7 : 1.55); else if (P.belly) cont = gh + 0.15 - SINK * 1.05; }
    // gouvernes lentes
    // limiteur de charge des volets (comme sur Airbus) : trop vite pour le cran choisi → les volets se rétractent d'un cran, puis ressortent en ralentissant
    let fEff = P.flapSel; if (!P.onGround && !P.manualCtl) { const iasK = P.ias / KT; while (fEff > 0 && iasK > VFE[fEff] + 4) fEff--; }
    if (P.manualCtl && !P.onGround && P.flapSel > 0) { const ov = P.ias / KT > VFE[P.flapSel] + 4; if (ov && !P.flapOv) emit('call', 'Survitesse volets : ralentissez ou rentrez les volets'); P.flapOv = ov; }
    if (fEff !== P.flapSel && !P.flapRelief) { P.flapRelief = true; emit('call', 'Volets : survitesse, rétraction automatique'); } else if (fEff === P.flapSel) P.flapRelief = false;
    P.flapPos += clamp(fEff / 4 - P.flapPos, -dt / 24, dt / 24);
    // train sorti au-dessus de 280 kt : traînée énorme et avertissement
    if (!P.onGround && P.gearPos > 0.05 && P.ias / KT > 280 && !P.gearOvsp) { P.gearOvsp = true; emit('call', 'Survitesse train : réduisez sous 250 nœuds'); } else if (P.ias / KT < 260) P.gearOvsp = false;
    P.gearPos += clamp((P.gearDown ? 1 : 0) - P.gearPos, -dt / 8, dt / 8);
    const spT = P.brakeMax || (P.onGround && P.spoilArm && P.landed && P.thr <= 0.02) ? 1 : P.spoilSel;
    P.spoilPos += clamp(spT - P.spoilPos, -dt * 0.8, dt * 0.8);
    const h = Math.max(P.y, 0), r = rho(h), q = 0.5 * r * P.V * P.V;
    P.ias = P.V * Math.sqrt(r / 1.225); P.mach = P.V / sound(h);
    // AP
    const A = ap.on || ap.athr ? autopilot(dt, gh) : {};
    // aide à l'atterrissage : vitesse d'approche tenue automatiquement en courte finale
    if (P.landAid && !P.manualCtl && !ap.on && !ap.athr && !P.onGround && P.gearDown && P.vs < -0.5 && !P.turbo && !(P.goAround > 0)) {
      const aglA = P.y - cont;
      if (aglA > 12 && aglA < 500) {
        const tgt = Math.max(FLAPSPD[Math.round(P.flapPos * 4)], SIM.landSpd()), ias0 = P.ias / KT;
        P.thr = clamp(0.42 + (tgt - ias0) * 0.035, 0, 0.85); P.rev = false;
        if (ias0 > tgt + 25) P.spoilSel = 0.5; else if (P.spoilSel === 0.5 && ias0 < tgt + 8) P.spoilSel = 0;
        P.aidSpd = true;
      } else P.aidSpd = false;
    } else P.aidSpd = false;
    // moteurs
    if (!P.dmg) P.dmg = [0, 0];
    if (P.fuel == null) { P.fuelCap = (TYX[P.type] || TYX.A320).cap; P.fuel = P.fuelCap * 0.6; }
    if (P.fuel <= 0 && P.eng.some(e => e)) { P.fuel = 0; P.eng = [false, false]; emit('call', 'Panne sèche : plus de carburant'); emit('noFuel'); }
    for (let i = 0; i < 2; i++) {
      if (P.dmg[i] >= 1) P.eng[i] = false;
      let tgt = P.eng[i] && P.fuel > 0 ? (A.n1 != null && ap.athr ? A.n1 : 0.2 + 0.8 * clamp(P.thr, 0, 1)) : 0;
      if (P.rev && P.onGround && P.eng[i]) tgt = 0.2 + 0.6 * (P.revAmt == null ? 1 : P.revAmt);
      const rate = P.n1[i] < 0.2 ? 0.012 : P.n1[i] < 0.55 ? 0.12 : 0.35;
      P.n1[i] += clamp(tgt - P.n1[i], -rate * 2 * dt, rate * dt * (tgt > P.n1[i] ? 1 : 2));
    }
    let T = 0, ffT = 0; const tx = TYX[P.type] || TYX.A320;
    for (let i = 0; i < 2; i++) {
      const k = clamp((P.n1[i] - 0.2) / 0.8, 0, 1);
      T += P.n1[i] >= 0.19 ? TMAX * (0.03 + 0.97 * k) * Math.pow(r / 1.225, 0.62) * (1 - P.V / (PF.ab ? 1400 : 600)) * (1 - 0.55 * P.dmg[i]) : 0;
      if (P.eng[i] && P.n1[i] > 0.1) ffT += tx.ff * (0.07 + 0.93 * Math.pow(k, 1.2)) * Math.pow(r / 1.225, 0.75) * (PF.ab && P.thr > 0.95 ? 3.5 : 1) * (1 + 0.25 * P.dmg[i]);
    }
    P.ff = ffT; P.fuel = Math.max(0, P.fuel - ffT * dt * (P.turbo ? 3 : 1));
    if (P.wd && (P.wd[0] + P.wd[1]) > 0.05) P.fuel = Math.max(0, P.fuel - (P.wd[0] + P.wd[1]) * 4 * dt);   // fuite de carburant (réservoirs d'aile percés)
    if (ap.on && !P.onGround && (P.eng.every(e => !e) || P.fuel <= 0)) { ap.on = false; ap.athr = false; ap.full = false; emit('call', 'Pilote automatique déconnecté'); }
    // pannes aléatoires (option) : environ une toutes les 15 minutes de vol
    if (P.randFail && !P.onGround && Math.random() < dt / 900) SIM.damageEngine(null, 0.3 + Math.random() * 0.4, 'random');
    P.ab = !!PF.ab && P.thr > 0.95 && !P.rev; if (P.ab) T *= PF.ab;
    if (P.rev && P.onGround) T = -T * 0.45;
    else if (P.turbo && P.thr > 0.2 && P.eng.some(e => e)) T = T * 4 + 420000 * P.thr;   // hypervitesse
    // aérodynamique
    const fi = P.flapPos * 4, cl0 = lerpA(CL0, fi), clm = lerpA(CLMAX, fi), aS = (clm - cl0) / 5;
    const alpha = P.theta - P.gamma; P.alpha = alpha;
    let CL = alpha <= aS ? cl0 + 5 * alpha : Math.max(0.3, clm - (alpha - aS) * 6);
    const agl = P.y - cont, ge = agl < 20 ? 1 + 0.12 * (1 - agl / 20) : 1;
    CL *= ge; CL *= 1 - P.spoilPos * 0.45; const wdS = P.wd ? P.wd[0] + P.wd[1] : 0; CL *= 1 - 0.16 * wdS;
    let CD = 0.024 + 0.042 * CL * CL / ge + lerpA(CDF, fi) + P.gearPos * 0.018 + P.spoilPos * 0.12 + 0.012 * wdS + (P.onGround ? 0 : 0.014 * ((P.eng[0] ? (P.dmg ? P.dmg[0] : 0) : 1) + (P.eng[1] ? (P.dmg ? P.dmg[1] : 0) : 1)));   // réacteur arrêté : il freine l'avion (moulinet + dérapage compensé)
    if (P.mach > PF.mmo - 0.04) CD += (P.mach - PF.mmo + 0.04) * (P.turbo ? 0.04 : PF.ab ? 0.12 : 0.6);
    const L = q * S * CL, D = q * S * CD, W = MASS * G;
    P.stall = !P.onGround && alpha > aS - 1.5 * D2R;
    P.nz = W > 0 ? L / W : 1; P.aMargin = aS - alpha;   // facteur de charge et marge avant décrochage (vibrations, condensation)
    P.alphaFloor = !P.onGround && ap.athr && alpha > aS - 3 * D2R;
    const fx = Math.sin(P.psi), fz = -Math.cos(P.psi);
    if (P.onGround) {
      const surf = onWater ? { type: 'eau', ap: null } : SIM.surface(P.x, P.z), paved = !['herbe', 'mer', 'eau', 'foret'].includes(surf.type), forest = surf.type === 'foret';
      P.surf = surf;
      if (surf.type === 'immeuble') { crashNow('L\'avion a percuté un immeuble.'); return; }
      const N = Math.max(0, W - L), mu = onWater ? (P.thr > 0.85 ? 0.06 : 0.15) : P.belly ? 0.55 : paved ? 0.015 : forest ? (P.thr > 0.85 ? 0.06 : 0.2) : 0.07;
      let bf = 0;
      const grip = onWater ? 0 : SIM.world.weather >= 2 ? 0.62 : 1; P.wet = grip < 1;
      // embarquement en cours : l'avion reste au poste
      if (P.boarding) { if (P.thr > 0.25 && !P.ci.boardHold) { P.ci.boardHold = 1; emit('toast', 'Embarquement en cours : attendez la fermeture des portes (ou « Fermer les portes »).'); } P.thr = Math.min(P.thr, 0.2); P.pbrk = true; }
      // gaz avancés par le pilote : le frein de parc se relâche tout seul
      else if (P.pbrk && P.thr > 0.25 && !P.rev && !(ap.on && ap.waitClr)) { P.pbrk = false; emit('toast', 'Frein de parc relâché.'); }
      if (P.pbrk || P.brake) bf = 0.8 * N * grip;                              // freins renforcés
      // FREIN D'URGENCE : gaz coupés, aérofreins sortis, inverseurs à fond et freinage maximal (antiblocage)
      if (P.brakeMax && !P.boarding) {
        P.thr = 0; P.turbo = false; if (P.V > 12 && !P.rev) { P.rev = true; P.revAmt = 1; P.ebRev = true; }
        bf = Math.max(bf, 1.25 * N * grip + MASS * 2.5);
      } else if (P.ebRev) { P.rev = false; P.ebRev = false; }
      if (P.rev && P.V < 6 && P.ebRev) { P.rev = false; P.ebRev = false; }
      if (P.thr > 0.5 && (P.landed || P.parked)) { P.landed = false; P.parked = false; P.ci = {}; }
      if (P.brakeConst && P.thr < 0.05 && !P.rev || (P.brakeConst && P.rev && P.landed)) bf = Math.max(bf, P.brakeLevel * 0.5 * N * grip);
      if (P.landed && P.autobrake && P.thr <= 0.02 && P.V > 0.3) { const tgtD = [0, 1.7, 3.0, 6.0][P.autobrake]; P.abActive = true; bf = Math.max(bf, clamp(MASS * tgtD - D + T, 0, 0.5 * N * grip)); } else P.abActive = false;
      let a = (T - D - mu * N * Math.sign(P.V || 1)) / MASS;
      if (onWater) a -= (P.thr > 0.85 ? 0.00022 : 0.0025) * P.V * P.V;          // traînée de l'eau (moins forte quand l'avion déjauge à pleine puissance)
      if (forest && P.V > 0.5) { a -= (P.thr > 0.85 ? 0.00008 : 0.0008) * P.V * P.V; P.forestT = (P.forestT || 0) - dt; if (P.forestT <= 0) { P.forestT = 0.25; emit('forest', { x: P.x, z: P.z, v: P.V }); } }
      // pente du terrain : l'avion accélère en descente et ralentit en montée
      const gA = SIM.groundH(P.x + fx * 10, P.z + fz * 10), gB = SIM.groundH(P.x - fx * 10, P.z - fz * 10);
      const gR = SIM.groundH(P.x - fz * 10, P.z + fx * 10), gL = SIM.groundH(P.x + fz * 10, P.z - fx * 10);
      const sAl = onWater ? 0 : (gA - gB) / 20, sLat = onWater ? 0 : (gR - gL) / 20;
      if (!onWater && P.V > 0.05) a -= G * sAl * Math.sign(P.V);
      if (!onWater && sAl > 1.3 && P.V > 1) { crashNow(sAl > 0 ? 'L\'avion a percuté un talus (pente de ' + Math.round(Math.atan(sAl) * R2D) + '°).' : 'L\'avion a basculé dans un ravin.'); return; }
      // limiteur de roulage : gaz réduits (< 45 %), l'avion ne dépasse pas ~28 kt sur les taxiways
      if (!P.landed && P.thr < 0.45 && !P.rev && P.V > 13) a -= (P.V - 13) * 1.2;
      if (P.V < 0.05 && a <= 0 || (P.V < 0.05 && (P.pbrk || P.brake))) { P.V = 0; a = 0; }
      else a -= bf / MASS;
      P.V = Math.max(0, P.V + a * dt);
      // marche arrière (touche Alt maintenue) : l'avion recule doucement, jusqu'à ~6 kt
      if (P.backHold && P.V < 0.6 && !P.belly && !P.boarding && P.thr < 0.3 && !P.rev) {
        if (P.pbrk) { P.pbrk = false; emit('toast', 'Frein de parc relâché : marche arrière.'); }
        P.bV = Math.max(-3.2, (P.bV || 0) - (P.brake ? -3 : 0.7) * dt); P.V = 0;
      } else if (P.bV) { P.bV = Math.min(0, P.bV + (P.brake || P.pbrk ? 3 : 1.6) * dt); }
      if (P.bV && sAl && !onWater) P.bV = Math.min(0, P.bV - G * sAl * 0.3 * dt);
      P.gTh += (Math.atan(sAl) + clamp(a * 0.004, -0.03, 0.015) - P.gTh) * Math.min(1, dt * 5);
      // direction
      // au sol : palonnier (Q/D/E) ET flèches ← → commandent la roulette de nez
      let rud = A.rud != null ? A.rud : clamp(P.rudder + P.stickX, -1, 1); let aidAxis = false;
      const em = Math.abs(P.emX || 0) > 0.03; if (em) rud = P.emX;
      // aide à l'atterrissage : inverseurs puis maintien de l'axe pendant le roulage
      if (P.landAid && P.landed && !ap.on && surf.type === 'piste' && surf.ap) {
        if (!P.manualCtl) { if (P.V / KT > 70 && P.thr < 0.05) { P.rev = true; P.revAmt = 1; P.aidRev = true; } else if (P.aidRev) { P.rev = false; P.aidRev = false; } }
        if (Math.abs(P.rudder) < 0.1 && Math.abs(P.stickX) < 0.1 && !em && P.V > 8) {
          const a = surf.ap, end = SIM.airportEnds(a).reduce((b, e) => Math.abs(wrap(e.hdg - P.psi * R2D)) < Math.abs(wrap(b.hdg - P.psi * R2D)) ? e : b);
          const h = end.hdg * D2R, dx = Math.sin(h), dz = -Math.cos(h), e = (P.x - end.x) * (-dz) + (P.z - end.z) * dx;
          rud = clamp(-e * 0.08 + wrap(end.hdg - P.psi * R2D) * 0.12, -1, 1); aidAxis = true;
        }
      }
      let yawR;
      if (A.rud != null || aidAxis) {
        // pilote automatique / aide au roulage : comme avant
        const st = (60 * (1 - clamp(P.V / 30, 0, 1)) + 3) * D2R;
        P.nw = rud * st; yawR = rud * Math.min(P.V * Math.tan(st) / tx.wb, (0.06 + 0.3 * (1 - clamp(P.V / 30, 0, 1)))) ;
      } else {
        // roulette de nez réelle : le volant (← →) braque jusqu'à 72° à basse vitesse, les pédales (Q/D) ±7°
        // à grande vitesse, les flèches agissent comme les pédales : on peut toujours guider l'avion
        const kt = P.V / KT, tiller = em ? P.emX : P.stickX, maxT = 72 * clamp(1 - (kt - 10) / 30, 0, 1), hi = 1 - maxT / 72;
        const pedal = clamp(P.rudder + tiller * hi, -1, 1);
        const cmd = clamp(tiller * maxT + pedal * 8 * clamp(1 - (kt - 40) / 110, 0.35, 1) * (P.sensitive ? 2 : 1), -75, 75) * D2R;
        P.nw = (P.nw || 0) + clamp(cmd - (P.nw || 0), -32 * D2R * dt, 32 * D2R * dt);   // vérin de direction : environ 32°/s
        yawR = (P.V + (P.bV || 0)) * Math.tan(P.nw) / tx.wb + pedal * q * 2.2e-5;                      // virage selon l'empattement + effet de la gouverne de direction
      }
      // adhérence des pneus : au-delà, l'avion dérape (et ralentit)
      const muLat = onWater ? 0.12 : P.belly ? 0.2 : forest ? 0.3 : paved ? 0.55 * grip : 0.35, aMax = muLat * G;
      if (P.V > 2 && Math.abs(yawR * P.V) > aMax) {
        const over = Math.abs(yawR * P.V) - aMax; yawR = Math.sign(yawR) * aMax / P.V;
        P.V = Math.max(0, P.V - Math.min(over, 4) * 0.6 * dt);
        P.skidT = (P.skidT || 0) - dt; if (P.skidT <= 0) { P.skidT = 0.12; emit('skid', { x: P.x, z: P.z, y: P.y, v: P.V }); }
      }
      P.steer = P.nw; P.psi += yawR * dt;
      P.gLean += (clamp(yawR * P.V * 0.011, -0.07, 0.07) - P.gLean) * Math.min(1, dt * 4);
      P.gPhi = -Math.atan(sLat) - P.gLean;
      // rotation
      const auth = clamp((P.V - 40) / 30, 0, 1);
      if (A.theta != null) P.theta += clamp(A.theta - P.theta, -3 * D2R * dt, 3 * D2R * dt) * auth;
      else if (P.liftOn && P.lift > 0.15 && P.stickY <= 0.05) P.theta += clamp(Math.min(P.lift * 15, 10) * D2R - P.theta, -3 * D2R * dt, 3 * D2R * dt) * clamp((P.V - 65) / 10, 0, 1);
      else if ((P.emY || 0) > 0.05) P.theta += P.emY * 5 * D2R * auth * dt;
      else if (P.stickY > 0.05) P.theta += P.stickY * 3.5 * D2R * auth * dt;
      else if (P.theta > 0 && !(P.liftOn && P.lift > 0.15)) P.theta -= (P.landed || P.V < 50 ? 2.2 : 1.0) * D2R * dt;
      P.theta = clamp(P.theta, 0, 16 * D2R);
      P.phi = 0; P.gamma = 0; P.vs = 0;
      P.x += fx * (P.V + (P.bV || 0)) * dt; P.z += fz * (P.V + (P.bV || 0)) * dt; P.y = cont;
      if (SIM.city && SIM.city.hit && SIM.city.hit(P.x, P.y + 1.5, P.z, P.psi, tx.half)) { crashNow('L\'avion a percuté un immeuble.'); return; }
      if (P.theta > 11.5 * D2R) emit('warn', 'tail');
      if (!paved && P.V > 20 && !P.ci.offrwy && !P.landed) { P.ci.offrwy = 1; emit('toast', onWater ? 'Sur l\'eau : pleine puissance pour déjauger et redécoller.' : 'Roulage hors piste : freinage moins efficace.'); }
      if (L > W && P.theta > 2 * D2R && P.V > 55 && !P.belly) { P.onGround = false; P.airTime = 0; P.lawB = 0; P.landed = false; P.ci = {}; emit('liftoff'); }
    } else {
      P.airTime += dt;
      const nearAp = P.landAid && !ap.on && P.vs < -1 && !(P.goAround > 0) && SIM.AIRPORTS.some(a => Math.hypot(a.x - P.x, a.z - P.z) < 16000);
      if (P.manualCtl) { if (nearAp && agl < 260 && !P.gearDown && !P.heli && !P.ci.gearWarn) { P.ci.gearWarn = 1; emit('call', 'Train non sorti ! Sortez le train (G)'); } }   // seulement une alarme : c'est vous qui sortez le train
      else {
      if (P.landAid && !ap.on && P.vs < -1 && !(P.goAround > 0) && agl < 260 && !P.gearDown && !P.heli) { P.gearDown = true; emit('call', 'Train sorti automatiquement'); }
      if (nearAp && agl < 200 && P.flapSel < 3 && P.ias / KT < VFE[3]) { P.flapSel = 3; emit('call', 'Volets 3'); }
      if (nearAp && agl < 120 && P.spoilSel > 0) P.spoilSel = 0; }
      if (nearAp && agl < 150 && Math.abs(P.phi) > 3 * D2R && Math.abs(P.stickX) < 0.3) P.phi -= Math.sign(P.phi) * Math.min(Math.abs(P.phi), 4 * D2R * dt);   // ailes à plat avant le toucher
      // vent de travers en courte finale : l'aide met le nez dans le vent (en crabe) pour garder l'axe de piste
      if (nearAp && agl < 450 && Math.abs(P.stickX) < 0.1 && Math.abs(P.rudder) < 0.1 && !(Math.abs(P.emX || 0) > 0.03)) {
        const ap0 = SIM.AIRPORTS.find(a => Math.hypot(a.x - P.x, a.z - P.z) < 16000);
        const ends = ap0 ? ap0.comps.flatMap(C => C.ends || []) : [];
        let best = null; ends.forEach(en => { const dh = Math.abs(wrap(en.hdg - P.psi * R2D)); if (dh < 20 && (!best || dh < best.dh)) best = { en, dh }; });
        if (best) { const en = best.en, h = en.hdg * D2R, dx = Math.sin(h), dz = -Math.cos(h), e = (P.x - en.x) * (-dz) + (P.z - en.z) * dx;
          if (Math.abs(e) < 160) { const want = en.hdg - wca(en.hdg) - clamp(e * 0.05, -8, 8); P.psi += clamp(wrap(want - P.psi * R2D), -2.5 * dt, 2.5 * dt) * D2R; } }
      }
      const flareH = clamp(-P.vs * 3.8, 14, 55);
      const aidFlare = P.landAid && !ap.on && !(P.goAround > 0) && (P.gearDown || onWater) && agl < flareH && P.vs < 0 && P.stickY < 0.3;
      if (aidFlare) { if (!P.ci.aflare) { P.ci.aflare = 1; emit('call', 'Arrondi'); } if (agl < 9 && !ap.athr && P.thr > 0 && !P.ci.retard) { P.ci.retard = 1; if (!P.manualCtl) { P.thr = 0; P.rev = false; } emit('call', 'Retard : réduisez les gaz'); } }
      const lawT = agl < 15 && P.gearDown && P.flapPos > 0.2 && P.vs < 0 && !ap.on && !P.liftOn && !aidFlare ? 0 : 1;
      P.lawB += clamp(lawT - P.lawB, -dt, dt / 5);
      // commande de tangage (C*) : le manche commande la variation de pente
      let gdc;
      const LIFTK = PF.ab ? [50, 45] : [15, 10], GR = 3 * Math.max(1, PF.pitch) * D2R, THMAX = PF.ab ? 75 : 30, THMIN = PF.ab ? -70 : -15;
      if (A.gam != null && ap.on) gdc = clamp((A.gam - P.gamma) * 0.8, -3 * D2R, 3 * D2R);
      else {
        const tp = clamp(P.trimPending || 0, -dt, dt); P.trimPending = (P.trimPending || 0) - tp;
        if (aidFlare) { const gt = -(0.4 + clamp(agl / flareH, 0, 1) * 2.6) * D2R; gdc = clamp((gt - P.gamma) * 1.8, -3 * D2R, 6 * D2R); }
        else if (P.liftOn && Math.abs(P.stickY) < 0.05) { let gt = (P.lift >= 0 ? P.lift * LIFTK[0] : P.lift * LIFTK[1]) * D2R; if (PF.ab && gt > 0) gt = Math.min(gt, clamp((P.ias / KT - 170) / 3.5, 3, 50) * D2R); gdc = clamp((gt - P.gamma) * (PF.ab ? 1.6 : 0.8), -GR, GR) + tp * D2R / dt; }
        else gdc = P.stickY * 4 * PF.pitch * D2R + tp * D2R / dt;
        if (Math.abs(P.emY || 0) > 0.03) gdc = P.emY * 7 * Math.max(1, PF.pitch * 0.8) * D2R;
      }
      // moteurs en panne / poussée insuffisante : l'avion ne peut plus tenir son altitude, il plane en descendant
      // (vitesse de plané tenue : environ vapp + 45 kt) — c'est l'aile qui porte, mais sans poussée on perd de la hauteur
      const engOut = P.eng.filter(e => e).length < 2 || (P.dmg && Math.max(P.dmg[0], P.dmg[1]) > 0.25) || P.fuel <= 0;
      if (engOut && !P.turbo && T < D * 0.98 && Math.abs(P.stickY) < 0.15 && !(P.liftOn && P.lift > 0.15) && !(Math.abs(P.emY || 0) > 0.03)) {
        const vg = Math.max(PF.vapp + 45, 185), err = P.ias / KT - vg, gt = clamp(-3 + err * 0.06, -8, -0.8) * D2R;
        gdc = clamp((gt - P.gamma) * 0.8, -2.5 * D2R, 2 * D2R);
        if (!P.ci.glide) { P.ci.glide = 1; emit('call', P.eng.every(e => !e) ? 'Moteurs arrêtés : l\'avion plane et descend' : 'Poussée insuffisante : l\'avion descend'); }
      } else if (P.ci.glide && !engOut) P.ci.glide = 0;
      if (nearAp && agl < 160 && P.gamma < -5 * D2R && P.stickY < 0.3) gdc = Math.max(gdc, clamp((-5 * D2R - P.gamma) * 1.2, 0, 4 * D2R));   // protection de pente en courte finale
      // protection de vitesse réelle : sans assez de poussée (panne, réacteur abîmé, panne sèche), l'avion ne peut pas tenir sa pente :
      // le nez s'abaisse tout seul et l'avion plane en perdant de l'altitude (il ne reste jamais suspendu en l'air)
      if (!P.turbo && (P.eng.filter(e => e).length < 2 || P.fuel <= 0 || (P.dmg && Math.max(P.dmg[0], P.dmg[1]) > 0.25)) && agl > 40) {
        const vs1 = Math.sqrt(2 * W / Math.max(r * S * clm, 1e-3)), vmin = vs1 * (PF.ab ? 1.08 : 1.12);
        if (P.V < vmin) { const lim = clamp((P.V - vmin) / vmin * 9, -4, 0) * D2R; gdc = Math.min(gdc, lim); P.glideProt = true; } else P.glideProt = false;
      }
      const nz = Math.cos(P.gamma) + P.V * gdc / G;
      const clReq = nz * W / Math.max(q * S * Math.cos(P.phi) * ge * (1 - P.spoilPos * 0.45), 1);
      const aReq = clamp((clReq - cl0) / 5, (PF.ab ? -16 : -6) * D2R, aS - 2 * D2R);
      const thLaw = clamp(P.gamma + aReq, THMIN * D2R, THMAX * D2R);
      const heavy = P.gearDown && P.agl < 400 ? 0.55 : 1, qMax = (P.sensitive ? 6 : 6 * heavy) * PF.pitch * D2R;
      const qLaw = clamp((thLaw - P.theta) * 2 * heavy, -qMax, qMax);
      const qDir = (P.stickY * 3.5 - (lawT === 0 ? 0.4 : 0)) * D2R;
      P.theta += (qLaw * P.lawB + qDir * (1 - P.lawB)) * dt;
      P.theta = clamp(P.theta, THMIN * D2R, THMAX * D2R);
      // roulis
      if (A.phi != null && ap.on) P.phi += clamp((A.phi - P.phi) * 0.8, -3 * D2R, 3 * D2R) * dt;
      else if (Math.abs(P.emX || 0) > 0.03) P.phi += P.emX * 16 * D2R * dt;
      else if (Math.abs(P.stickX) > 0.04 && (Math.abs(P.phi) < (P.sensitive ? 67 : PF.bank) * D2R || Math.sign(P.stickX) !== Math.sign(P.phi))) P.phi += P.stickX * (P.sensitive ? 24 : 8) * PF.roll * (P.rollK || 1) * D2R * dt;
      else if (Math.abs(P.phi) > 0.5 * D2R) P.phi -= Math.sign(P.phi) * Math.min(Math.abs(P.phi), 1.5 * D2R * dt);
      if (P.wd && (P.wd[0] || P.wd[1])) P.phi += (P.wd[1] - P.wd[0]) * 9 * D2R * dt;           // aile abîmée : l'avion penche de ce côté
      const bl = ap.on ? 30 : Math.max(P.sensitive ? 67 : 55, PF.bank); P.phi = clamp(P.phi, -bl * D2R, bl * D2R);
      // équations du mouvement
      const ca = Math.cos(alpha), sa = Math.sin(alpha);
      P.V += ((T * ca - D) / MASS - G * Math.sin(P.gamma)) * dt;
      P.V = clamp(P.V, 20, 720);
      P.gamma += ((L * Math.cos(P.phi) + T * sa - W * Math.cos(P.gamma)) / (MASS * P.V)) * dt;
      P.psi += (L * Math.sin(P.phi) / (MASS * P.V * Math.cos(P.gamma)) + P.rudder * (P.sensitive ? 0.14 : 0.03)) * dt;
      // turbulence (nuages, pluie, orage)
      const tb = [0, 0.25, 0.7, 1.8][SIM.world.weather] * (P.agl < 4000 ? 1 : 0.4) * clamp((P.agl - 20) / 300, 0, 1);
      if (tb) { const n = SIM.vnoise, tt = P.tSim; P.gamma += (n(tt * 0.9, 1.3) - 0.5) * tb * 0.9 * D2R * dt * 6; P.phi += (n(tt * 0.7, 7.1) - 0.5) * tb * 2.2 * D2R * dt * 6; P.V += (n(tt * 0.5, 11.7) - 0.5) * tb * 1.2 * dt * 6; }
      P.steer = 0; P.nw = 0; P.gTh *= 1 - Math.min(1, dt * 3); P.gPhi *= 1 - Math.min(1, dt * 3); P.gLean = 0;
      const hv = P.V * Math.cos(P.gamma);
      const wnd = SIM.windAt(P.y, P.tSim), wk = clamp((P.y - cont) / 3, 0, 1);   // le vent pousse l'avion (dérive), sauf collé au sol
      P.x += (fx * hv + wnd.vx * wk) * dt; P.z += (fz * hv + wnd.vz * wk) * dt; P.y += P.V * Math.sin(P.gamma) * dt;
      P.gs = Math.hypot(fx * hv + wnd.vx * wk, fz * hv + wnd.vz * wk); P.trk = (Math.atan2(fx * hv + wnd.vx * wk, -(fz * hv + wnd.vz * wk)) * R2D + 360) % 360;
      if (P.y - cont < 400 && SIM.city && SIM.city.hit) { const b = SIM.city.hit(P.x, P.y, P.z, P.psi, tx.half); if (b) { crashNow('Collision avec un immeuble de ' + b.h + ' m.'); return; } }
      P.vs = P.V * Math.sin(P.gamma);
      P.maxAlt = Math.max(P.maxAlt, P.y);
      if (P.y <= cont) touchdown(cont);
    }
    P.psi = (P.psi + Math.PI * 2) % (Math.PI * 2);
    P.agl = Math.max(0, P.y - cont);
    // roulage final automatique
    if (ap.on && P.onGround && P.landed && ap.full) { if (P.V * 1.94 > 70) P.rev = true; else { P.rev = false; } if (P.V < 0.5) { ap.on = false; ap.athr = false; ap.full = false; ap.rollout = false; P.rev = false; P.ci.stopped = 1; emit('stopped'); } }
    if (!ap.on && P.onGround && P.landed && P.V < 0.3 && !P.ci.stopped && !P.parked) { P.ci.stopped = 1; emit('stopped'); }
  }

  function touchdown(cont) {
    const vsf = P.vs / FT * 60, surf = SIM.surface(P.x, P.z), bank = Math.abs(P.phi) / D2R, gh = SIM.groundH(P.x, P.z);
    const wl = SIM.waterAt(P.x, P.z), onWater = wl !== null && wl > gh + 0.3; P.crashKind = 'sol';
    const paved = !onWater && ['piste', 'taxiway', 'tarmac', 'avenue', 'route'].includes(surf.type);
    let why = null, belly = false;
    if (onWater) {
      // amerrissage : possible partout (mer, fleuve, lac) s'il est doux, ailes à plat et pas trop rapide
      const lim = P.gearPos > 0.5 ? -700 : -1000, kt = P.V / KT;
      if (vsf < lim) why = `Amerrissage trop brutal (${Math.round(vsf)} ft/min) : l'avion s'est disloqué sur l'eau.`;
      else if (bank > 15) why = `Une aile a accroché l'eau (inclinaison ${Math.round(bank)}°).`;
      else if (kt > Math.max(PF.vr + 45, 185)) why = `Trop rapide pour amerrir (${Math.round(kt)} kt).`;
      if (why) P.crashKind = 'eau';
    } else {
      // atterrissage sur piste, herbe, terre, champ… partout où le terrain n'est pas trop pentu
      const sl = Math.max(Math.abs(SIM.groundH(P.x + 20, P.z) - SIM.groundH(P.x - 20, P.z)), Math.abs(SIM.groundH(P.x, P.z + 20) - SIM.groundH(P.x, P.z - 20))) / 40;
      if (P.gamma < -20 * D2R) why = 'Impact avec le relief (piqué trop fort).';
      else if (surf.type === 'immeuble') why = 'L\'avion s\'est posé sur un immeuble.';
      else if (!paved && sl > 0.95) why = `Terrain trop pentu (${Math.round(Math.atan(sl) * R2D)}°) : l'avion a capoté.`;
      else if (vsf < (paved ? -1800 : -1600)) why = `Impact trop violent (${Math.round(vsf)} ft/min).`;
      else if (bank > 22) why = `Une aile a touché le sol (inclinaison ${Math.round(bank)}°).`;
      else if (P.theta < -8 * D2R && vsf < -1500) why = 'Le train avant a touché en premier et s\'est rompu.';
      else if (P.gearPos < 0.95) { if (vsf < -1200) why = 'Atterrissage sur le ventre trop dur : l\'avion s\'est disloqué.'; else belly = true; }
    }
    P.y = cont;
    if (why) { P.crashed = true; P.crashV = P.V; P.crashVs = P.vs; P.V = 0; P.eng = [false, false]; P.crashPhi = P.phi + (Math.random() - 0.5) * 0.6; P.crashY = P.y; emit('crash', why); return; }
    P.onGround = true; P.gamma = 0; P.phi = 0;
    if (belly) { P.belly = true; P.gearDown = false; emit('toast', 'Atterrissage sur le ventre réussi ! L\'avion glisse et s\'arrête vite (redécollage impossible : « Aligner en bout de piste » pour repartir).'); }
    if (onWater) emit('splash', { x: P.x, y: wl, z: P.z, v: P.V });
    if (P.airTime < 6 && !P.ap.flare) return;                     // simple rebond juste après le décollage
    P.landed = true; P.tdRate = vsf;
    if (P.ap.on) { P.ap.rollout = true; P.ap.flare = false; P.ap.gs = false; }
    if (P.ap.athr || P.ap.full || (P.landAid && !P.manualCtl)) P.thr = 0;
    emit('touchdown', { vs: vsf, surf: onWater ? { type: 'eau' } : surf, grass: !paved, water: onWater, belly, hard: vsf < -700 });
    // un toucher brutal ou dans les arbres abîme un réacteur : il se met à fumer
    if (surf.type === 'foret' && !onWater) { SIM.damageEngine(0, 0.15 + Math.random() * 0.3, 'forest'); SIM.damageEngine(1, 0.1 + Math.random() * 0.25, null); }
    else if (vsf < -620) SIM.damageEngine(null, clamp((-vsf - 600) / 1500, 0.12, 0.6), 'hard');
  }

  SIM.stepSim = function (dt) {
    const n = Math.max(1, Math.ceil(dt / 0.01)), h = dt / n;
    for (let i = 0; i < n; i++) step(h);
  };

  // ---------- Garer au poste ----------
  SIM.park = function (force) {
    if (!force && (!P.onGround || P.V > 15)) return 'Il faut être au sol et presque arrêté pour aller au poste.';
    let best = null, bd = 1e12;
    (force ? [SIM.route.dep] : SIM.AIRPORTS).forEach(a => (force ? [a.comps[0]] : a.comps).flatMap(C => C.stands).forEach(s => { if (s.busy) return; const d = Math.hypot(s.x - P.x, s.z - P.z); if (d < bd) { bd = d; best = { s, a }; } }));
    if (!best || (!force && bd > 6000)) return 'Aucun poste libre à proximité.';
    const { s: s0, a } = best;
    // l'avion s'arrête AVANT l'aérogare : les gros porteurs (nez très long) sont garés plus en arrière sur le tarmac
    const TSZ = { A319: 0.88, A321: 1.18, militaire: 1.1, gros: 1.45, jumbo: 1.9, super: 1.95, geant: 2.3, titan: 2.95, colosse: 2.5, leviathan: 4.2, hyperion: 5.6, jet: 0.46 }[P.type] || 1;
    const off = Math.max(0, 18.6 * TSZ - 30), H0 = s0.hdg * D2R, s = off ? Object.assign({}, s0, { x: s0.x - Math.sin(H0) * off, z: s0.z + Math.cos(H0) * off, lx: s0.lx - off, orig: s0 }) : s0;
    Object.assign(P, { x: s.x, z: s.z, y: a.elev + 0.15, psi: s.hdg * D2R, V: 0, theta: 0, pbrk: true, thr: 0, rev: false, parked: true, boarding: !!force, doorsClosed: false, belly: false, onGround: true, landed: false, crashed: false, gamma: 0, phi: 0, phase: 'parked', parkInfo: { a, n: s.n, s } });
    Object.assign(P.ap, { on: false, athr: false, full: false, rollout: false });
    P.lights.landing = 0; P.lights.taxi = 0; P.lights.strobe = 0;
    // très grands avions : les avions garés aux postes voisins sont déplacés pour laisser la place aux ailes
    const hf = (TYX[P.type] || {}).half || 17; if (hf > 45) (a.statics || []).forEach(st => { if (!st.gone && Math.hypot(st.x - s.x, st.z - s.z) < hf + 45) { st.gone = true; st.o.visible = false; } });
    emit('parked', { a, n: s.n, s, board: force });
    return null;
  };

  // ---------- Phases et consignes ----------
  SIM.guidance = function () {
    if (P.heli) {
      if (P.crashed) return { ph: 'Accident', t: 'Appuyez sur « Recommencer ».', n: '' };
      if (P.onGround) return { ph: 'Hélicoptère posé', t: 'Maintenez W (ou Z) pour monter, relâchez pour rester en stationnaire. Q/D ou ← → pour pivoter.', n: 'En vol : ↑ avancer, ↓ freiner, ← → virer. S pour descendre (le toucher est amorti près du sol).' };
      const pad = SIM.AIRPORTS.flatMap(a => a.helipads || []).reduce((b, p) => Math.hypot(p.x - P.x, p.z - P.z) < Math.hypot(b.x - P.x, b.z - P.z) ? p : b);
      const d = Math.hypot(pad.x - P.x, pad.z - P.z), brg = Math.round(SIM.geo.bearing(P.x, P.z, pad.x, pad.z));
      return { ph: 'Hélicoptère en vol', t: `Héliport de ${pad.a.city} : ${d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1) + ' km'} au cap ${String(brg).padStart(3, '0')}°. Pour se poser : arrêtez-vous au-dessus du « H », puis descendez doucement avec S.`, n: 'Moins de 1 100 ft/min et moins de 60 kt au toucher.' };
    }
    const R = SIM.route, ias = P.ias / KT, ft = P.agl / FT, ap = P.ap, ae = R.ae, dest = R.dest;
    const dThr = Math.hypot(ae.x - P.x, ae.z - P.z) / 1000, rem = SIM.routeRemaining() / 1000;
    const hdgTo = Math.round(SIM.geo.bearing(P.x, P.z, R.wps[Math.min(R.active, 3)].x, R.wps[Math.min(R.active, 3)].z));
    const auto = ap.full ? ' (le pilote automatique s\'en charge)' : '';
    let ph, t, n = '';
    if (P.crashed) return { ph: 'Accident', t: 'Appuyez sur « Recommencer ».', n: '' };
    if (P.parked && P.boarding) return { ph: 'Embarquement', t: `Poste ${P.parkInfo.n} à ${P.parkInfo.a.city} : les passagers montent par la porte avant avec leurs valises.`, n: 'Ensuite : le tracteur repousse l\'avion et vous roulez vous-même jusqu\'à la piste. Touche I = roulage automatique. « Fermer les portes » pour partir tout de suite.' };
    if (P.parked && P.doorsClosed) return { ph: 'Portes fermées', t: 'Le tracteur arrive pour le repoussage.', n: 'Ensuite vous roulez vous-même jusqu\'à la piste (touche I = roulage automatique).' };
    if (P.autoTaxi) return { ph: P.autoTaxi.i < 2 && P.autoTaxi.pts[0] && (P.autoTaxi.pts[0].back || P.autoTaxi.pts[1] && P.autoTaxi.pts[1].rot) ? 'Repoussage' : 'Roulage automatique', t: P.autoTaxi.mode === 'push' ? 'Le tracteur repousse et fait pivoter l\'avion. Vous prendrez ensuite les commandes pour rouler.' : `Roulage automatique vers le point d'arrêt piste ${SIM.route.de.id}.`, n: 'Phares de roulage allumés. Préparez volets 1+F.' };
    if (P.onGround && !P.landed && SIM.view && SIM.view.awaitRwy && P.holdPt) {
      const TP = SIM.taxiPlan().fwd.slice(0, 3); P.taxiK = P.taxiK || 0;
      while (P.taxiK < 2 && Math.hypot(TP[P.taxiK].x - P.x, TP[P.taxiK].z - P.z) < 45) P.taxiK++;
      const tg = TP[P.taxiK], d = Math.hypot(P.holdPt.x - P.x, P.holdPt.z - P.z), brg = Math.round(SIM.geo.bearing(P.x, P.z, tg.x, tg.z));
      const rel = Math.round(wrap(brg - P.psi * R2D));
      return { ph: 'Roulage vers la piste ' + R.de.id, t: `${['Sortez du parking', 'Rejoignez le taxiway Alpha', 'Suivez Alpha'][P.taxiK]} — point d'arrêt à ${Math.round(d)} m. ${Math.abs(rel) < 12 ? 'droit devant' : rel > 0 ? 'tournez à DROITE (→ ou D) de ' + rel + '°' : 'tournez à GAUCHE (← ou Q) de ' + (-rel) + '°'}. Vitesse ${Math.round(P.V * 1.944)} kt (max 25).`, n: P.V < 0.5 ? 'Avancez : gaz 30 % (touche + ou =, ou faites glisser la manette). Le frein de parc se relâche tout seul.' : 'B pour freiner · touche I = roulage automatique.' };
    }
    if (P.parked) return { ph: 'Vol terminé', t: `Garé au poste ${P.parkInfo.n} à ${P.parkInfo.a.city}. Moteurs au ralenti, frein de parc serré.`, n: 'Choisissez un nouveau départ dans « Vol » pour repartir.' };
    if (P.onGround && P.surf && P.surf.type === 'eau') { ph = 'Sur l\'eau (amerri)'; t = P.V > 1 ? `L'avion glisse sur l'eau à ${Math.round(ias)} kt. Pour redécoller : pleine puissance (T), volets 1+F, et à ${PF.vr} kt montez le levier MONTÉE (W).` : 'L\'avion flotte. Pleine puissance (T) pour déjauger, puis rotation à ' + PF.vr + ' kt avec W ou flèche ↓.'; n = 'Train rentré conseillé sur l\'eau. Gardez les ailes à plat.'; return { ph, t, n }; }
    if (P.onGround && P.belly) return { ph: 'Posé sur le ventre', t: 'L\'avion est immobilisé sur son fuselage : redécollage impossible.', n: '« Aligner en bout de piste » pour repartir, ou E pour sortir (Rafale).' };
    if (P.onGround && !P.landed) {
      if (P.V < 1 && P.thr < 0.5) { ph = 'Alignement piste ' + R.de.id; t = SIM.atc && !SIM.atc.cleared ? 'Attendez l\'autorisation de la tour : un avion décolle devant vous. Préparez volets 1+F et phares.' : 'Autorisé décollage ! Relâchez le frein de parc (P) puis poussée TOGA (T).'; n = 'Ou appuyez sur « Vol automatique complet » pour un décollage automatique.'; }
      else if (ias < PF.vr - 3) { ph = 'Course au décollage'; t = `Vitesse ${Math.round(ias)} kt. Gardez l'axe avec le palonnier (Q/D) ou les flèches ← →. V1 = ${PF.v1} kt, VR = ${PF.vr} kt.`; n = `À ${PF.vr} kt : montez le levier MONTÉE (ou flèche ↓).`; }
      else { ph = 'Rotation !'; t = 'Montez le levier MONTÉE vers le haut (ou flèche ↓) : l\'avion se soulève.' + auto; n = 'L\'avion décolle vers 150–160 kt.'; }
    } else if (!P.onGround && R.active === 0 && P.y - R.dep.elev < 3000 * FT) {
      ph = 'Montée initiale';
      if (P.gearDown && P.vs > 1) t = 'Taux de montée positif : rentrez le train (G).' + auto;
      else if (P.thr > 0.9 && ft > 1500 && !ap.athr) t = 'Altitude de réduction : ramenez la poussée sur CL.';
      else t = 'Gardez environ 15° d\'assiette et 160 kt. Rentrez les volets (F) au-dessus de 200 kt.' + auto;
      n = ap.on ? '' : 'Engagez ensuite le pilote automatique (A) ou « Vol automatique complet » (Maj+A).';
    } else if (!P.onGround && R.active <= 1 && dThr > 40) {
      const desc = ap.vert === 'DES' || P.vs < -3;
      ph = desc ? 'Descente' : 'Croisière vers ' + dest.city;
      t = desc ? `Descendez vers ${Math.round(R.wps[1].alt / FT / 100) * 100} ft, vitesse 250 kt sous le FL100. Aérofreins si la vitesse monte.`
        : `Cap ${String(hdgTo).padStart(3, '0')}° vers ${dest.city}, niveau visé FL${Math.round(R.cruise / 100)}. Reste ${Math.round(rem)} km.`;
      n = desc ? 'Point d\'interception (IF) : ' + Math.round(Math.hypot(R.wps[1].x - P.x, R.wps[1].z - P.z) / 1000) + ' km.' : `Début de descente vers ${Math.round((R.cruise * FT) / Math.tan(3 * D2R) / 1000 + 40)} km de l'arrivée.`;
    } else if (!P.onGround && !P.landed) {
      if (ft < 60 && dThr < 4) { ph = 'Arrondi'; t = 'Poussée IDLE (RETARD), tirez légèrement le manche pour adoucir le toucher.' + auto; n = 'Visez moins de 300 ft/min au toucher.'; }
      else if (dThr < 12) { ph = 'Finale piste ' + ae.id; t = `Suivez le PAPI : 2 blancs et 2 rouges. Vitesse ${FLAPSPD[4]} kt, volets FULL, train sorti.`; n = P.gearDown ? (P.flapSel < 4 ? 'Volets FULL (F).' : 'Stabilisé : continuez.') : 'TRAIN ! Sortez le train (G).'; }
      else { ph = 'Approche ' + dest.city; t = `Interceptez l'axe de la piste ${ae.id} (cap ${String(ae.hdg).padStart(3, '0')}°). Réduisez à 210 kt puis sortez les volets un cran à la fois.`; n = `Seuil à ${dThr.toFixed(1)} km. Armez APPR pour un atterrissage automatique.`; }
    } else {
      if (P.V > 1) { ph = 'Roulage à l\'atterrissage'; t = 'Inverseurs (R) puis freinage (B). Gardez l\'axe.' + auto; n = 'Relâchez les inverseurs sous 70 kt.'; }
      else { ph = 'Arrêté'; t = `Bien joué ! Vous êtes à ${P.surf && P.surf.ap ? P.surf.ap.city : 'l\'arrêt'}. Roulez jusqu'à un poste jaune ou touchez « Garer au poste ».`; n = ''; }
    }
    return { ph, t, n };
  };
  SIM.landingConfig = function () {
    const ias = P.ias / KT, done = [];
    if (!P.gearDown) { P.gearDown = true; done.push('train sorti'); }
    let f = P.flapSel; for (let k = 4; k > P.flapSel; k--) if (ias < VFE[k] + 3) { f = k; break; }
    if (f !== P.flapSel) { P.flapSel = f; done.push('volets ' + SIM.FLAPNAME[f]); }
    P.spoilArm = true; P.spoilSel = 0; P.autobrake = Math.max(P.autobrake, 2); P.brakeConst = true; P.landAid = true;
    P.lights.landing = 1; P.lights.taxi = 1;
    if (P.ap.athr) { P.ap.spdMng = false; P.ap.spd = FLAPSPD[Math.max(f, 3)]; }
    done.push('aérofreins armés', 'freinage auto MED', 'frein constant', 'aide à l\'arrondi', 'phares');
    return f < 4 ? done.join(', ') + ' — ralentissez pour les volets FULL (' + VFE[4] + ' kt)' : done.join(', ');
  };
  SIM.autoLand = function () {
    if (P.onGround) return 'Disponible en vol seulement.';
    const R = SIM.route, ae = R.ae, ad = R.ad;
    const along = (ae.x - P.x) * ad[0] + (ae.z - P.z) * ad[1], lat = Math.abs((P.x - ae.x) * (-ad[1]) + (P.z - ae.z) * ad[0]);
    R.active = along > 30000 || lat > 6000 || along < 2000 ? 1 : along > 12000 ? 2 : 3;
    engage(true); P.ap.desc = true; P.liftOn = false; SIM.landingConfig(); P.brakeConst = false;
    return null;
  };
  SIM.ils = function () {
    const R = SIM.route, ae = R.ae, ad = R.ad;
    const along = (ae.x - P.x) * ad[0] + (ae.z - P.z) * ad[1], lat = (P.x - ae.x) * (-ad[1]) + (P.z - ae.z) * ad[0];
    const gsAlt = R.dest.elev + 15 + Math.max(along, 0) * Math.tan(3 * D2R);
    return { along, lat, dev: P.y - gsAlt, vsTgt: -(P.V * Math.cos(P.gamma) / KT) * 5.3, ok: along > -300 && along < 45000 && Math.abs(lat) < 8000 };
  };
  // prendre les commandes d'un autre avion (état copié depuis le trafic)
  SIM.takeOver = function (a) {
    const air = ['climb', 'goaround', 'cruise', 'final', 'flare'].includes(a.mode), ground = !air;
    const near = SIM.AIRPORTS.reduce((b, x) => Math.hypot(x.x - a.x, x.z - a.z) < Math.hypot(b.x - a.x, b.z - a.z) ? x : b);
    const old = SIM.route, dep = a.ap || near;
    let dest = air && a.mode !== 'final' && a.mode !== 'flare' ? (old.dest !== dep ? old.dest : old.dep) : (old.dest !== dep ? old.dest : old.dep);
    if (dest === dep) dest = SIM.AIRPORTS.find(x => x !== dep && x.id !== 'CDG') || SIM.AIRPORTS[1];
    if (a.mode === 'final' || a.mode === 'flare') { SIM.route = SIM.makeRoute(SIM.AIRPORTS.find(x => x !== a.ap) || dep, a.ap); SIM.route.active = 3; }
    else { SIM.route = SIM.makeRoute(dep, dest); SIM.route.active = air ? 1 : 0; }
    const g = (a.ap ? a.ap.elev : SIM.groundH(a.x, a.z)) + 0.15;
    Object.assign(P, { x: a.x, z: a.z, y: ground ? g : a.y, psi: a.psi, theta: a.theta || 0, phi: ground ? 0 : a.phi || 0, gamma: ground ? 0 : a.gamma || 0, V: a.V || 0,
      onGround: ground, gearDown: a.gearDown, gearPos: a.gearPos, flapSel: Math.round((a.flap || 0) * 4), flapPos: a.flap || 0,
      thr: a.mode === 'roll' ? 1 : a.mode === 'final' ? 0.45 : air ? 0.8 : a.mode === 'parked' || a.mode === 'hold' ? 0 : 0.22, rev: false,
      n1: [Math.max(a.n1, 0.2), Math.max(a.n1, 0.2)], eng: [true, true], pbrk: a.mode === 'parked' || a.mode === 'hold', brake: false, crashed: false,
      landed: ['rollout', 'taxi'].includes(a.mode) && !a.next, parked: a.mode === 'parked', belly: false, airTime: air ? 100 : 0, lawB: 1, liftOn: false, emX: 0, emY: 0, ci: {}, tSim: 0, maxAlt: a.y, visY: null });
    Object.assign(P.ap, { on: false, athr: false, full: false, srs: false, flare: false, gs: false, loc: false, rollout: false, desc: false, alt: SIM.route.cruise, hdg: Math.round(a.psi * R2D + 360) % 360, spd: Math.round((a.V || 80) / KT) });
    P.lights.landing = air || a.mode === 'roll' ? 1 : 0; P.lights.strobe = air || a.mode === 'roll' ? 1 : 0; P.lights.taxi = ground && a.mode !== 'parked' ? 1 : 0;
    const A = SIM.atc; if (A) { A.setCS(a.cs); A.q.length = 0; A.t = 0; A.warned = {}; A.cleared = air || a.mode === 'roll' || a.mode === 'lineup'; A.st = air ? (a.mode === 'final' || a.mode === 'flare' ? 6 : 3) : A.cleared ? 2 : a.mode === 'hold' ? 0 : 9; A.landClr = a.mode === 'final' || a.mode === 'flare'; }
  };
  SIM.KT = KT; SIM.FT = FT; SIM.VFE = VFE; SIM.FLAPSPD = FLAPSPD; SIM.wrap = wrap;
})();
