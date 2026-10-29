// Monde : géographie, relief, ciel, nuages, oiseaux, lumières des villes
window.SIM = window.SIM || {};
(function () {
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const LAT0 = 3.85, LON0 = 10.6, MLAT = 111320, COS0 = Math.cos(LAT0 * D2R);
  const geo = {
    toXZ(lat, lon) { return { x: (lon - LON0) * MLAT * COS0, z: -(lat - LAT0) * MLAT }; },
    toLL(x, z) { return { lat: LAT0 - z / MLAT, lon: LON0 + x / (MLAT * COS0) }; },
    bearing(x1, z1, x2, z2) { let b = Math.atan2(x2 - x1, -(z2 - z1)) * R2D; return (b + 360) % 360; },
  };
  SIM.geo = geo;
  // repère local d'une ville : z le long du boulevard (de a vers b = −z… +z), x en travers
  SIM.cityL = (c, x, z) => { const dx = x - c.x, dz = z - c.z; return { x: dx * c.cr + dz * c.sr, z: -dx * c.sr + dz * c.cr }; };
  SIM.cityW = (c, lx, lz) => ({ x: c.x + lx * c.cr - lz * c.sr, z: c.z + lx * c.sr + lz * c.cr }); SIM.D2R = D2R; SIM.R2D = R2D;

  // Aéroports (coordonnées et altitudes réelles ; pistes simplifiées)
  const AIRPORTS = [
    { id: 'NSI', icao: 'FKYS', name: 'Yaoundé-Nsimalen', city: 'Yaoundé', lat: 3.7226, lon: 11.5533, elev: 694, hdg: 7, len: 3400, wid: 45, ids: ['01', '19'], gulls: false },
    { id: 'DLA', icao: 'FKKD', name: 'Douala International', city: 'Douala', lat: 4.0061, lon: 9.7195, elev: 10, hdg: 121, len: 2850, wid: 45, ids: ['12', '30'], gulls: true },
    { id: 'KBI', icao: 'FKKB', name: 'Kribi', city: 'Kribi', lat: 2.8740, lon: 9.9778, elev: 15, hdg: 130, len: 1900, wid: 30, ids: ['13', '31'], gulls: true },
    { id: 'CDG', icao: 'LFPG', name: 'Paris-Charles de Gaulle', city: 'Paris', lat: 49.0097, lon: 2.5479, elev: 119, hdg: 85, len: 4200, wid: 45, ids: ['08', '26'], gulls: false },
    { id: 'ABJ', icao: 'DIAP', name: 'Abidjan Félix-Houphouët-Boigny', city: 'Abidjan', lat: 5.2614, lon: -3.9263, elev: 6, hdg: 28, len: 3000, wid: 45, ids: ['03', '21'], gulls: true, twin: false },
    { id: 'JFK', icao: 'KJFK', name: 'New York John F. Kennedy', city: 'New York', lat: 40.6413, lon: -73.7781, elev: 4, hdg: 31, len: 3682, wid: 61, ids: ['04', '22'], gulls: true },
    { id: 'BRU', icao: 'EBBR', name: 'Bruxelles-Zaventem', city: 'Bruxelles', lat: 50.9010, lon: 4.4844, elev: 56, hdg: 65, len: 3600, wid: 45, ids: ['07', '25'], gulls: false },
    { id: 'FIH', icao: 'FZAA', name: 'Kinshasa N\'djili', city: 'Kinshasa', lat: -4.3858, lon: 15.4446, elev: 313, hdg: 63, len: 4700, wid: 60, ids: ['06', '24'], gulls: false },
    { id: 'DSS', icao: 'GOBD', name: 'Dakar Blaise-Diagne', city: 'Dakar', lat: 14.6700, lon: -17.0733, elev: 89, hdg: 6, len: 3500, wid: 45, ids: ['01', '19'], gulls: true },
  ];
  AIRPORTS.forEach(a => {
    const p = geo.toXZ(a.lat, a.lon); a.x = p.x; a.z = p.z;
    const h = a.hdg * D2R;
    a.dx = Math.sin(h); a.dz = -Math.cos(h);        // axe de piste (sens ids[0])
    a.rx = Math.cos(h); a.rz = Math.sin(h);         // droite de l'axe
  });
  SIM.AIRPORTS = AIRPORTS;
  const CITIES = [
    { lat: 3.866, lon: 11.516, r: 7000, n: 2600 }, { lat: 4.05, lon: 9.70, r: 7500, n: 2600 },
    { lat: 2.94, lon: 9.91, r: 2500, n: 500 }, { lat: 48.86, lon: 2.35, r: 11000, n: 3200 },
    { lat: 5.33, lon: -4.03, r: 9000, n: 2800 }, { lat: 40.73, lon: -73.95, r: 16000, n: 4500 },
    { lat: 50.85, lon: 4.35, r: 9000, n: 2800 }, { lat: -4.33, lon: 15.31, r: 12000, n: 3200 }, { lat: 14.69, lon: -17.45, r: 8000, n: 2400 },
  ];

  // ---------- Bruit et relief ----------
  function hash(i, j) {
    let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function vnoise(x, y) {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, z) { return vnoise(x / 9000, z / 9000) * 0.6 + vnoise(x / 3300 + 7, z / 3300) * 0.28 + vnoise(x / 1100, z / 1100 + 3) * 0.12; }
  SIM.vnoise = vnoise;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  SIM.clamp = clamp; SIM.sstep = sstep;

  // ---------- Côtes, îles, montagnes, fleuves, lacs ----------
  function coastLon(lat) {
    if (lat < 3.9) return 9.5 + (3.9 - lat) * 0.36;
    if (lat < 4.05) return 9.5 - (lat - 3.9) / 0.15 * 0.5;
    if (lat < 4.3) return 9.0 - (lat - 4.05) * 0.4;
    return 8.9 - (lat - 4.3) * 0.5;
  }
  const ISLANDS = [{ lat: 3.55, lon: 8.73, rl: 0.32, rn: 0.17 }];      // Bioko
  const ESTUARY = { lat: 3.93, lon: 9.55, rl: 0.07, rn: 0.12 };         // estuaire du Wouri
  const ell = (ll, e) => { const a = (ll.lat - e.lat) / e.rl, b = (ll.lon - e.lon) / e.rn; return a * a + b * b; };
  function islandCoast(ll) { for (const i of ISLANDS) { const e = ell(ll, i); if (e < 1) return (1 - Math.sqrt(e)) * 19; } return -1; }
  const WAFR = [[-17.5, 14.7], [-16.8, 12.5], [-15, 11], [-13.6, 9.5], [-13, 8.3], [-11.5, 7], [-10.8, 6.3], [-9, 5.2], [-7.5, 4.4], [-6, 4.9], [-4.6, 5.15], [-3.5, 5.15], [-2, 4.9], [-0.2, 5.5], [1.2, 6.1], [2.4, 6.35], [3.4, 6.4], [4.5, 6.0], [5.5, 4.6], [6.4, 4.3], [7.5, 4.45], [8.5, 4.6]];
  function wafrLat(lon) { for (let i = 0; i < WAFR.length - 1; i++) { const [a, la] = WAFR[i], [b, lb] = WAFR[i + 1]; if (lon >= a && lon <= b) return la + (lb - la) * (lon - a) / (b - a); } return null; }
  const amCoast = lat => lat < 25 ? -80 : lat < 45 ? -80.1 + (lat - 25.8) * 0.43 : -66;
  const euWest = lat => lat < 21 ? -17.5 : lat < 36 ? -17 + (lat - 21) * 0.75 : lat < 43.5 ? -9 : lat < 48 ? -1.5 : -4.6;
  function worldCoast(ll) { // distance à l'océan Atlantique (km), ou null si hors zone
    const cl = Math.cos(ll.lat * D2R);
    if (ll.lon < amCoast(ll.lat) + 0.0001) return (amCoast(ll.lat) - ll.lon) * 111 * cl;            // Amériques
    if (ll.lon < euWest(ll.lat)) return -(euWest(ll.lat) - ll.lon) * 111 * cl;                       // océan
    if (ll.lon < 8.5 && ll.lat < 16) { const w = wafrLat(ll.lon); if (w !== null) return (ll.lat - w) * 111; }   // golfe de Guinée
    if (ll.lat >= 21 && ll.lon < 0) return (ll.lon - euWest(ll.lat)) * 111 * cl;
    return null;
  }
  function nearAirport(x, z) { for (const a of AIRPORTS) if (Math.abs(x - a.x) < 6500 && Math.abs(z - a.z) < 6500) return true; return false; }
  function region(ll) {
    // retourne [altitude de base, amplitude du relief, distance à la mer en km, montagneux 0..1]
    let coast = 999;
    if (ll.lat < 6.5 && ll.lon >= 8.5) {
      coast = (ll.lon - coastLon(ll.lat)) * 111;
      const ic = islandCoast(ll); if (ic >= 0) coast = ic;
      const ee = ell(ll, ESTUARY); coast = Math.min(coast, (Math.sqrt(ee) - 1) * 9);
    } else if (ll.lat > 35.5 && ll.lat < 44.5 && ll.lon > -1 && ll.lon < 9) coast = ll.lat < 40 ? (36.9 - ll.lat) * 111 : (ll.lat - 43.3) * 111;
    if (ll.lon < 8.5) { const wc = worldCoast(ll); if (wc !== null) coast = Math.min(coast, wc); }
    // régions de relief, raccordées en douceur (plus de « murs » de terrain aux frontières des régions)
    if (ll.lon < -60) return [60, 110, coast, 0];                                                 // plaine côtière américaine
    const box = (v, a, b, w) => sstep(a - w, a + w, v) * (1 - sstep(b - w, b + w, v));
    let v = [400, 260, 0];
    const mix = (t, q) => { if (t > 0) v = [v[0] + (q[0] - v[0]) * t, v[1] + (q[1] - v[1]) * t, v[2] + (q[2] - v[2]) * t]; };
    mix((1 - sstep(8.2, 8.8, ll.lon)) * (1 - sstep(9.6, 10.4, ll.lat)), [120, 140, 0]);             // Côte d'Ivoire, Ghana…
    mix(box(ll.lat, 6, 13, 0.4), [350, 160, 0]);
    mix(box(ll.lat, 13, 31, 0.5), [450, 220, 0.3]);
    mix(box(ll.lat, 31, 36.9, 0.5), [700, 1100, 1]);
    mix(sstep(42.6, 43.4, ll.lat), [160, 180, 0.3]);
    mix(box(ll.lat, 4.8, 7.5, 0.3) * box(ll.lon, 9.4, 11.5, 0.3), [1100, 650, 1]);                 // hauts plateaux de l'Ouest
    const base = v[0], amp = v[1], mt = v[2];
    return [base, amp, coast, mt];
  }
  function isSea(x, z) {
    if (nearAirport(x, z)) return false;
    const ll = geo.toLL(x, z);
    if (ll.lon < 8.5) { const wc = worldCoast(ll); if (wc !== null) return wc < 0; }
    if (ll.lat < 6.5) {
      if (islandCoast(ll) >= 0) return false;
      if (ll.lon < coastLon(ll.lat) || ell(ll, ESTUARY) < 1) return true;
    }
    if (ll.lat > 36.9 && ll.lat < 43.3 && ll.lon > -1 && ll.lon < 9) return true;
    return false;
  }
  SIM.isSea = isSea;
  // sommets réels (lat, lon, hauteur ajoutée m, rayon km)
  let RELIEF = 1.5; SIM.getRelief = () => RELIEF;
  const PEAKS = [
    ['Mont Cameroun', 4.203, 9.170, 4040, 13], ['Pico Basilé', 3.58, 8.76, 3011, 8], ['Mont Manengouba', 4.98, 9.85, 2411, 9],
    ['Monts Bamboutos', 5.62, 10.08, 2740, 12], ['Mont Oku', 6.2, 10.52, 3011, 14], ['Mont Mbankolo', 3.89, 11.45, 1100, 3.5],
    ['Mont Messa', 3.95, 11.41, 1000, 3], ['Mont Eloundem', 3.81, 11.44, 1159, 3], ['Mont Mbam Minkom', 3.98, 11.33, 1295, 4],
    ['Massif de Ngovayang', 3.25, 10.6, 1100, 12], ['Tahat (Hoggar)', 23.29, 5.53, 2918, 40], ['Djurdjura', 36.45, 4.1, 2308, 20],
    ['Ouarsenis', 35.88, 1.65, 1985, 22], ['Puy de Sancy', 45.53, 2.81, 1886, 28],
  ].map(([n, lat, lon, real, R]) => { const p = geo.toXZ(lat, lon); return { n, x: p.x, z: p.z, real, H: 0, R: R * 1000 }; });
  SIM.PEAKS = PEAKS;
  function ridged(x, z, s) { let v = 0, a = 0.6, f = 1; for (let i = 0; i < 3; i++) { const n = 1 - Math.abs(2 * vnoise(x / (s / f) + i * 13, z / (s / f)) - 1); v += n * n * a; a *= 0.5; f *= 2.1; } return v; }
  function rawH(x, z) {
    const ll = geo.toLL(x, z);
    let ws = 0, hs = 0, dmin = Infinity, near = null;
    for (const a of AIRPORTS) {
      const dx = x - a.x, dz = z - a.z, d2 = dx * dx + dz * dz, w = 1 / (d2 + 9e6);
      ws += w; hs += w * a.elev; if (d2 < dmin) { dmin = d2; near = a; }
    }
    dmin = Math.sqrt(dmin);
    const [base, amp, coast, mt] = region(ll);
    let h = hs / ws;
    h = h + (base - h) * clamp((dmin - 60000) / 200000, 0, 1);
    const far = clamp((dmin - 4000) / 9000, 0, 1);
    h += (fbm(x, z) - 0.45) * amp * far * RELIEF;
    if (mt > 0) h += ridged(x, z, 14000) * amp * 0.9 * mt * far * RELIEF;
    h *= clamp(coast / 22, 0, 1);
    for (const p of PEAKS) {
      const dx = x - p.x, dz = z - p.z; if (Math.abs(dx) > p.R * 3 || Math.abs(dz) > p.R * 3) continue;
      const d = Math.sqrt(dx * dx + dz * dz) / p.R;
      const g = Math.exp(-d * d * 1.3) + 0.22 * Math.max(0, 1 - d / 2.6);
      h += p.H * g * (0.72 + 0.45 * ridged(x, z, p.R * 0.6)) * clamp(coast / 2, 0, 1) * far;
    }
    h = near.elev + (h - near.elev) * sstep(3800, 7500, dmin);
    return { h: Math.max(h, 0.6), dmin, coast };
  }
  function calibratePeaks() {
    PEAKS.forEach(p => p.H = 0);
    for (let it = 0; it < 2; it++) PEAKS.forEach(p => {
      const cur = rawH(p.x, p.z).h, ll = geo.toLL(p.x, p.z), coast = region(ll)[2];
      const unit = 1.22 * (0.72 + 0.45 * ridged(p.x, p.z, p.R * 0.6)) * clamp(coast / 2, 0, 1);
      if (unit > 0.01) p.H = Math.max(0, p.H + (p.real - cur) / unit);
    });
  }
  calibratePeaks();
  // fleuves et lacs
  const RIVERS = [
    // rivières des villes 3D (niveau d'eau fixé sous le sol de la ville)
    { n: 'La Seine', w: 140, lv0: 219, pts: [[48.8420, 2.2500], [48.8520, 2.2740], [48.8600, 2.2895], [48.8642, 2.3010], [48.8640, 2.3150], [48.8592, 2.3350], [48.8530, 2.3480], [48.8460, 2.3640], [48.8380, 2.3780]] },
    { n: 'Hudson', w: 1000, lv0: 0.6, pts: [[40.8800, -73.9450], [40.8200, -73.9700], [40.7700, -74.0050], [40.7300, -74.0250], [40.7000, -74.0350], [40.6800, -74.0450]] },
    { n: 'East River', w: 480, lv0: 0.6, pts: [[40.8000, -73.9280], [40.7750, -73.9400], [40.7550, -73.9600], [40.7350, -73.9720], [40.7100, -73.9850], [40.6990, -74.0060]] },
    { n: 'Mfoundi', w: 45, lv0: 693, pts: [[3.9300, 11.5428], [3.9100, 11.5425], [3.8950, 11.5432], [3.8800, 11.5428], [3.8600, 11.5440], [3.8300, 11.5460]] },
    { n: 'Sanaga', w: 650, pts: [[5.0, 12.2], [4.65, 11.75], [4.45, 11.3], [4.35, 10.95], [4.1, 10.55], [3.85, 10.25], [3.79, 10.12], [3.7, 9.95], [3.6, 9.75], [3.53, 9.6]] },
    { n: 'Nyong', w: 280, pts: [[3.75, 12.6], [3.6, 12.0], [3.52, 11.52], [3.45, 11.1], [3.42, 10.7], [3.38, 10.3], [3.3, 10.05], [3.27, 9.85], [3.27, 9.68]] },
    { n: 'Wouri', w: 500, pts: [[4.8, 10.0], [4.4, 9.85], [4.15, 9.76], [4.06, 9.66], [3.98, 9.6], [3.93, 9.55]] },
  ];
  const LAKES = [{ n: 'Lac Ossa', lat: 3.80, lon: 10.03, r: 3200 }, { n: 'Lac de la Mefou', lat: 3.62, lon: 11.53, r: 1300 }, { n: 'Lac municipal', lat: 3.862, lon: 11.505, r: 450 }, { n: 'Baie de New York', lat: 40.676, lon: -74.046, r: 2600 }];
  const CELL = 5000, rgrid = new Map(), segs = [];
  RIVERS.forEach(r => {
    const P = r.pts.map(([la, lo]) => geo.toXZ(la, lo)), S = [];
    for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (r.lv0 != null ? 120 : 900))); for (let k = 0; k < n; k++) S.push({ x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n }); }
    S.push(P[P.length - 1]);
    let lv = 1e9;
    S.forEach(p => { if (r.lv0 != null) { p.lv = r.lv0; return; } const s = isSea(p.x, p.z) ? 0 : rawH(p.x, p.z).h - 5; lv = Math.max(0.5, Math.min(lv, s)); p.lv = lv; });
    r.S = S;
    for (let i = 0; i < S.length - 1; i++) {
      const sg = { a: S[i], b: S[i + 1], w: r.w }; segs.push(sg);
      const band = Math.max(r.w * 3, 1500);
      const x0 = Math.floor((Math.min(sg.a.x, sg.b.x) - band) / CELL), x1 = Math.floor((Math.max(sg.a.x, sg.b.x) + band) / CELL);
      const z0 = Math.floor((Math.min(sg.a.z, sg.b.z) - band) / CELL), z1 = Math.floor((Math.max(sg.a.z, sg.b.z) + band) / CELL);
      for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) { const k = gx + ',' + gz; if (!rgrid.has(k)) rgrid.set(k, []); rgrid.get(k).push(sg); }
    }
  });
  LAKES.forEach(l => { const p = geo.toXZ(l.lat, l.lon); l.x = p.x; l.z = p.z; l.lv = Math.max(0.5, rawH(p.x, p.z).h - 3); });
  SIM.RIVERS = RIVERS; SIM.LAKES = LAKES;
  // eau intérieure au point (x,z) : { lv, d (0 = au centre, 1 = au bord), band }
  function inland(x, z) {
    let best = null;
    const list = rgrid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL));
    if (list) for (const s of list) {
      const ax = s.b.x - s.a.x, az = s.b.z - s.a.z, L2 = ax * ax + az * az;
      const t = clamp(((x - s.a.x) * ax + (z - s.a.z) * az) / L2, 0, 1);
      const d = Math.hypot(x - s.a.x - ax * t, z - s.a.z - az * t), half = s.w / 2, band = Math.max(s.w * 3, 1500);
      if (d < half + band && (!best || d / half < best.d)) best = { lv: s.a.lv + (s.b.lv - s.a.lv) * t, d: d / half, half, band, dist: d };
    }
    for (const l of LAKES) {
      const d = Math.hypot(x - l.x, z - l.z), band = 1500;
      if (d < l.r + band && (!best || d / l.r < best.d)) best = { lv: l.lv, d: d / l.r, half: l.r, band, dist: d };
    }
    return best;
  }
  // villes 3D : le terrain y est aplani (rues, grand boulevard sur lequel on peut se poser)
  // a → b : axe du boulevard (point de départ, point d'arrivée) ; hx : demi-largeur de la ville ; ext : marge au-delà des deux bouts
  const CITY3D = SIM.CITY3D = [
    { name: 'Yaoundé — centre-ville', av: 'Boulevard du 20 Mai', a: [3.9125, 11.535], b: [3.8775, 11.535], hx: 1150, ext: 0, style: 'afr' },
    { name: 'Paris', av: 'avenue des Champs-Élysées', a: [48.8732, 2.2966], b: [48.8656, 2.3212], hx: 1800, ext: 450, style: 'paris' },
    { name: 'New York — Manhattan', av: 'Park Avenue (élargie)', a: [40.7250, -73.9950], b: [40.7760, -73.9620], hx: 1250, ext: 200, style: 'ny' },
  ];
  CITY3D.forEach(c => {
    const A = geo.toXZ(c.a[0], c.a[1]), B = geo.toXZ(c.b[0], c.b[1]);
    c.x = (A.x + B.x) / 2; c.z = (A.z + B.z) / 2; c.rot = Math.atan2(B.x - A.x, -(B.z - A.z)); c.cr = Math.cos(c.rot); c.sr = Math.sin(c.rot);
    c.len = Math.hypot(B.x - A.x, B.z - A.z); c.hz = c.len / 2 + c.ext;
    let s = 0, n = 0; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const w = SIM.cityW(c, i * c.hx / 2, j * c.hz / 2); s += rawH(w.x, w.z).h; n++; } c.base = Math.max(4, Math.round(s / n));
  });
  function cityFlat(x, z, h) {
    for (const c of CITY3D) {
      if (Math.abs(x - c.x) > c.hx + c.hz + 1600 || Math.abs(z - c.z) > c.hx + c.hz + 1600) continue;
      const L = SIM.cityL(c, x, z), dx = Math.abs(L.x) - c.hx - 250, dz = Math.abs(L.z) - c.hz - 250, d = Math.max(dx, dz);
      if (d > 1200) continue;
      if (d <= 0) return c.base;
      const t = d / 1200, k = t * t * (3 - 2 * t); return c.base + (h - c.base) * k;
    }
    for (const m of SIM.FLATS || []) { const d = Math.hypot(x - m.x, z - m.z); if (d < m.r + 600) { if (d <= m.r) return m.base; const t = (d - m.r) / 600, k = t * t * (3 - 2 * t); return m.base + (h - m.base) * k; } }
    return h;
  }
  function groundH(x, z) {
    if (isSea(x, z)) return 0;
    const r = rawH(x, z);
    let h = cityFlat(x, z, r.h), wet = false;
    if (r.dmin > 3000) {
      const w = inland(x, z);
      if (w) { wet = true;
        if (w.d < 1) h = w.lv - 4;
        else { const t = clamp((w.dist - w.half) / w.band, 0, 1), bank = w.lv + 1.5; h = h > bank ? bank + (h - bank) * t : bank; if (t < 0.15) h = w.lv - 4 + (bank - w.lv + 4) * (t / 0.15); }
      }
    }
    return wet ? Math.max(h, 0.6) : Math.max(h, 2.2);
  }
  SIM.groundH = groundH; SIM._inland = inland; SIM._rawH = rawH;
  SIM.waterAt = function (x, z) { if (isSea(x, z)) return 0.4; const w = inland(x, z); return w && w.d < 1 ? w.lv : null; };

  function groundColor(x, z, h, sea) {
    if (sea) return [0.07, 0.22, 0.32];
    const ll = geo.toLL(x, z), n = vnoise(x / 1500, z / 1500), n2 = vnoise(x / 260, z / 260);
    let c;
    if (ll.lat < 7) c = [0.13 + n * 0.08, 0.30 + n * 0.12, 0.10 + n2 * 0.04];          // forêt tropicale
    else if (ll.lat < 13) c = [0.42 + n * 0.1, 0.42 + n * 0.08, 0.20];                 // savane
    else if (ll.lat < 31) c = [0.80 + n * 0.08, 0.64 + n * 0.08, 0.42 + n2 * 0.06];     // désert
    else if (ll.lat < 37) c = [0.55 + n * 0.1, 0.45 + n * 0.06, 0.30];                 // Atlas
    else c = n2 > 0.5 ? [0.40 + n * 0.15, 0.48 + n * 0.1, 0.22] : [0.30, 0.42 + n * 0.1, 0.18]; // champs
    const mix = (t, k) => { c = [c[0] + (k[0] - c[0]) * t, c[1] + (k[1] - c[1]) * t, c[2] + (k[2] - c[2]) * t]; };
    let dmin = 1e12;
    for (const a of AIRPORTS) dmin = Math.min(dmin, Math.hypot(x - a.x, z - a.z));
    mix(1 - sstep(2500, 4500, dmin), [0.32, 0.50, 0.20]);                            // herbe tondue près des pistes
    mix(sstep(1600, 2600, h + n * 300), [0.36, 0.40, 0.24]);                        // prairies d'altitude
    mix(sstep(2500, 3300, h + n2 * 250), [0.40, 0.35, 0.31]);                       // roche volcanique
    mix(sstep(3500, 3900, h + n2 * 150), [0.93, 0.94, 0.96]);                       // neige des sommets
    const [, , coast] = region(ll);
    if (coast < 1.4 && h < 30) mix(1 - coast / 1.4, [0.86, 0.79, 0.60]);            // plage
    else if (h < 6 && ll.lat < 6.5) mix(0.4, [0.2, 0.25, 0.12]);                    // mangrove
    const w = dmin > 3000 && ll.lat < 6 ? inland(x, z) : null;
    if (w && w.d < 1.6) mix(0.6, [0.48, 0.42, 0.30]);                               // berges
    return c;
  }

  // ---------- Construction du monde ----------
  const W = SIM.world = { night: 0, hour: 9, weather: 0, flash: 0 };
  const WX = [{ n: 'Beau temps', grey: 0, fog: 1, clouds: 1 }, { n: 'Nuageux', grey: 0.3, fog: 1.4, clouds: 3 }, { n: 'Pluie', grey: 0.6, fog: 2.6, clouds: 3, rain: 0.6 }, { n: 'Orage', grey: 0.8, fog: 3.4, clouds: 3, rain: 1 }];
  SIM.WX = WX;

  function makeTerrain(scene) {
    const N = 200, HALF = 320000, n1 = N + 1;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n1 * n1 * 3), col = new Float32Array(n1 * n1 * 3), idx = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * n1 + i, b = a + 1, c = a + n1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.frustumCulled = false;
    scene.add(m);
    const off = []; for (let i = 0; i <= N; i++) { const t = i / N * 2 - 1; off.push(Math.sign(t) * t * t * HALF); }
    const pos2 = new Float32Array(pos.length), col2 = new Float32Array(col.length);
    W.terrain = { mesh: m, cx: 1e12, cz: 1e12, job: null,
      rebuild(px, pz) { this.start(px, pz); this.step(1e9); },
      start(px, pz) { const step = 400; this.job = { cx: Math.round(px / step) * step, cz: Math.round(pz / step) * step, j: 0 }; },
      step(rows) {
        const J = this.job; if (!J) return;
        const jEnd = Math.min(N, J.j + rows - 1);
        let k = J.j * n1 * 3;
        for (let j = J.j; j <= jEnd; j++) for (let i = 0; i <= N; i++) {
          const wx = J.cx + off[i], wz = J.cz + off[j], sea = isSea(wx, wz);
          const h = sea ? -9 : groundH(wx, wz);
          pos2[k] = off[i]; pos2[k + 1] = h; pos2[k + 2] = off[j];
          const c = groundColor(wx, wz, h, sea);
          col2[k] = c[0]; col2[k + 1] = c[1]; col2[k + 2] = c[2]; k += 3;
        }
        J.j = jEnd + 1; if (J.j <= N) return;
        // terminé : on bascule d'un coup vers le nouveau relief
        pos.set(pos2); col.set(col2); this.cx = J.cx; this.cz = J.cz; m.position.set(J.cx, 0, J.cz); this.job = null;
        g.attributes.position.needsUpdate = true;
        g.computeVertexNormals(); g.computeBoundingSphere();
        const nr = g.attributes.normal.array;
        for (let v = 0; v < col.length; v += 3) {
          if (pos[v + 1] < 1) continue;
          const ny = nr[v + 1], kk = clamp((0.93 - ny) * 4, 0, 0.85), hi = clamp((pos[v + 1] - 900) / 1500, 0, 0.5);
          const t = Math.max(kk, hi * 0.5);
          col[v] += (0.44 - col[v]) * t; col[v + 1] += (0.40 - col[v + 1]) * t; col[v + 2] += (0.34 - col[v + 2]) * t;
          const sh = 0.82 + 0.18 * ny; col[v] *= sh; col[v + 1] *= sh; col[v + 2] *= sh;
        }
        g.attributes.color.needsUpdate = true;
      } };
    // eau : mer, fleuves et lacs avec vagues animées (carte de normales générée)
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const cx2 = cv.getContext('2d'), img = cx2.createImageData(S, S), hm = new Float32Array(S * S), P = 16;
    const pn = (x, y, p) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), m = k => ((k % p) + p) % p;
      const a = hash(m(i), m(j)), b = hash(m(i + 1), m(j)), c = hash(m(i), m(j + 1)), d = hash(m(i + 1), m(j + 1)); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) hm[y * S + x] = pn(x / S * P, y / S * P, P) * 0.6 + pn(x / S * P * 2, y / S * P * 2, P * 2) * 0.3 + pn(x / S * P * 4, y / S * P * 4, P * 4) * 0.1;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (hm[y * S + (x + 1) % S] - hm[y * S + (x + S - 1) % S]) * 6, dy = (hm[((y + 1) % S) * S + x] - hm[((y + S - 1) % S) * S + x]) * 6, l = Math.hypot(dx, dy, 1), k = (y * S + x) * 4;
      img.data[k] = (-dx / l * 0.5 + 0.5) * 255; img.data[k + 1] = (-dy / l * 0.5 + 0.5) * 255; img.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
    }
    cx2.putImageData(img, 0, 0);
    const mkN = rep => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t; };
    W.seaN = mkN(1400000 / 260); W.inN = mkN(1);
    W.seaMat = new THREE.MeshPhongMaterial({ color: 0x0b3a57, specular: 0xe8f2ff, shininess: 140, normalMap: W.seaN, normalScale: new THREE.Vector2(0.55, 0.55) });
    W.inMat = new THREE.MeshPhongMaterial({ color: 0x2a5560, specular: 0xd0e4f0, shininess: 120, normalMap: W.inN, normalScale: new THREE.Vector2(0.35, 0.35) });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(1400000, 1400000), W.seaMat);
    water.rotation.x = -Math.PI / 2; water.position.y = 0.4; scene.add(water); W.water = water;
    // rubans des fleuves
    SIM.RIVERS.forEach(r => {
      const pos = [], uv = [], idx = [], S2 = r.S;
      S2.forEach((p, i) => {
        const a = S2[Math.max(0, i - 1)], b = S2[Math.min(S2.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l, hw = r.w / 2 + 40;
        for (const s of [-1, 1]) { const x = p.x + nx * hw * s, z = p.z + nz * hw * s; pos.push(x, p.lv + 0.3, z); uv.push(x / 220, -z / 220); }
        if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
      });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, W.inMat); m.material.side = THREE.DoubleSide; scene.add(m);
    });
    SIM.LAKES.forEach(l => {
      const g = new THREE.CircleGeometry(l.r + 60, 48).rotateX(-Math.PI / 2), p = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + l.x) / 220, -(p.getZ(i) + l.z) / 220);
      const m = new THREE.Mesh(g, W.inMat); m.position.set(l.x, l.lv + 0.3, l.z); scene.add(m);
    });
  }

  function makeSky(scene) {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, low: { value: new THREE.Color() },
        sun: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, night: { value: 0 } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top,hor,low,sunCol,sun; uniform float night; varying vec3 vD;
        void main(){ vec3 d=normalize(vD); float y=d.y; vec3 c = y>0.0 ? mix(hor, top, pow(clamp(y,0.0,1.0),0.45)) : mix(hor, low, clamp(-y*6.0,0.0,1.0));
          float s=max(dot(d,normalize(sun)),0.0);
          c += sunCol*(pow(s,8.0)*0.35 + pow(s,64.0)*0.5) * (1.0-night*0.9);
          c += sunCol*smoothstep(0.9994,0.9997,s)*3.0*step(-0.02,sun.y);
          float m=max(dot(d,normalize(-sun)),0.0); c += vec3(0.85,0.88,0.95)*smoothstep(0.99955,0.9998,m)*night;
          gl_FragColor=vec4(c,1.0); }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), mat);
    sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky); W.sky = sky;
    const sg = new THREE.BufferGeometry(), sp = [];
    for (let i = 0; i < 1800; i++) {
      const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, y = Math.abs(u) * 0.95 + 0.03, r = Math.sqrt(1 - y * y);
      sp.push(Math.cos(t) * r * 8000, y * 8000, Math.sin(t) * r * 8000);
    }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, depthTest: false, depthWrite: false, fog: false }));
    stars.renderOrder = -9; stars.frustumCulled = false; scene.add(stars); W.stars = stars;

    W.sunLight = new THREE.DirectionalLight(0xffffff, 1); scene.add(W.sunLight); scene.add(W.sunLight.target);
    W.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a4a2a, 0.6); scene.add(W.hemi);
    scene.fog = new THREE.FogExp2(0xa9cdf0, 0.00002);
  }

  function glowTex(inner, outer) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, inner); gr.addColorStop(0.25, inner); gr.addColorStop(1, outer);
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  SIM.glowTex = glowTex;

  function puffTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    for (let i = 0; i < 26; i++) {
      const px = 64 + (Math.random() - 0.5) * 50, py = 64 + (Math.random() - 0.5) * 40, r = 18 + Math.random() * 26;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(255,255,255,0.42)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
    }
    return new THREE.CanvasTexture(c);
  }

  function makeClouds(scene) {
    const tex = puffTex();
    W.cloudMats = [0.97, 0.86, 0.74].map(s => new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(s, s, s), transparent: true, depthWrite: false, fog: true }));
    W.cloudShade = [0.97, 0.86, 0.74];
    W.clouds = []; W.cloudLevel = 2;
    for (let i = 0; i < 90; i++) {
      const g = new THREE.Group(), R = 350 + Math.random() * 600, n = 7 + (Math.random() * 8 | 0);
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, rr = Math.random() * R;
        const y = Math.pow(Math.random(), 1.4) * R * 0.9;
        const layer = y > R * 0.45 ? 0 : y > R * 0.15 ? 1 : 2;
        const s = new THREE.Sprite(W.cloudMats[layer]);
        const sc = (300 + Math.random() * 420) * (1 - y / (R * 2.2));
        s.scale.set(sc * 1.25, sc, 1); s.position.set(Math.cos(a) * rr, y + sc * 0.3, Math.sin(a) * rr * 0.7);
        g.add(s);
      }
      g.userData.slot = i; scene.add(g); W.clouds.push(g);
    }
    W.cloudsInit = false;
  }
  function placeCloud(g, cx, cz, near) {
    const a = Math.random() * Math.PI * 2, d = near ? Math.random() * 38000 : 30000 + Math.random() * 9000;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    const gh = isSea(x, z) ? 0 : groundH(x, z);
    const wx = W.weather >= 2;
    g.position.set(x, gh + (wx ? 650 : 1300) + Math.random() * 700, z);
    g.rotation.y = Math.random() * 6;
    const s = (0.8 + Math.random() * 0.7) * (W.weather === 3 ? 1.9 : wx ? 1.5 : 1); g.scale.set(s, s * (0.8 + Math.random() * 0.5), s);
  }

  function makeBird(dark) {
    const g = new THREE.Group();
    const m = new THREE.MeshLambertMaterial({ color: dark ? 0x26221e : 0xe7e9ea, side: THREE.DoubleSide });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 5), m); body.rotation.x = -Math.PI / 2; g.add(body);
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.12, 0.85, 0, 0.05, 0, 0, 0.2], 3)); wg.computeVertexNormals();
    const wl = new THREE.Mesh(wg, m), wr = new THREE.Mesh(wg, m); wr.scale.x = -1;
    g.add(wl); g.add(wr); g.userData.w = [wl, wr]; g.scale.setScalar(1.6);
    return g;
  }
  function makeBirds(scene) {
    W.flocks = []; W.roam = [];
    AIRPORTS.forEach(a => {
      for (let f = 0; f < 6; f++) {
        const fl = { ap: a, r: 600 + Math.random() * 1800, ang: Math.random() * 6.28, sp: (0.03 + Math.random() * 0.035) * (Math.random() < 0.5 ? 1 : -1),
          y: a.elev + 35 + Math.random() * 300, ox: (Math.random() - 0.5) * 4500, oz: (Math.random() - 0.5) * 4500, birds: [], grp: new THREE.Group() };
        const n = 10 + (Math.random() * 15 | 0);
        for (let i = 0; i < n; i++) {
          const b = makeBird(!a.gulls || Math.random() < 0.3); b.scale.setScalar(2.1); b.userData.o = new THREE.Vector3((Math.random() - 0.5) * 55, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 55);
          b.userData.ph = Math.random() * 6; fl.grp.add(b); fl.birds.push(b);
        }
        scene.add(fl.grp); W.flocks.push(fl);
      }
    });
    // volées en V et rapaces qui tournent dans les thermiques, autour de l'avion partout sur la route
    for (let f = 0; f < 14; f++) {
      const soar = f % 3 === 0, fl = { soar, birds: [], grp: new THREE.Group(), x: 1e12, z: 1e12, y: 0, hd: 0, sp: soar ? 0 : 11 + Math.random() * 6, cx: 0, cz: 0, r: 60 + Math.random() * 90, ang: 0 };
      const n = soar ? 3 + (Math.random() * 4 | 0) : 9 + (Math.random() * 12 | 0);
      for (let i = 0; i < n; i++) {
        const b = makeBird(true); b.scale.setScalar(soar ? 4.2 : 2.3);
        const k = Math.ceil(i / 2), sd = i % 2 ? 1 : -1;
        b.userData.o = soar ? new THREE.Vector3(Math.random() * 6.28, (Math.random() - 0.5) * 40, 0.7 + Math.random() * 0.6) : new THREE.Vector3(sd * k * 6.5, (Math.random() - 0.5) * 2, k * 7);
        b.userData.ph = Math.random() * 6; fl.grp.add(b); fl.birds.push(b);
      }
      scene.add(fl.grp); W.roam.push(fl);
    }
  }
  function spawnRoam(fl, cam, psi, first) {
    const a = psi + (Math.random() - 0.5) * (first ? 6.28 : 2.4), d = (first ? 400 : 900) + Math.random() * 2600;
    fl.x = cam.position.x + Math.sin(a) * d; fl.z = cam.position.z - Math.cos(a) * d;
    const gh = groundH(fl.x, fl.z);
    fl.y = clamp(cam.position.y + (Math.random() * 200 - 130), gh + 30, gh + 1100);
    fl.hd = Math.random() * 6.28; fl.cx = fl.x; fl.cz = fl.z;
  }

  function makeCities(scene) {
    const mat = new THREE.PointsMaterial({ color: 0xffb35a, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
    const g = new THREE.BufferGeometry(), p = [];
    CITIES.forEach(c => {
      const o = geo.toXZ(c.lat, c.lon);
      for (let i = 0; i < c.n; i++) {
        const a = Math.random() * 6.283, r = Math.pow(Math.random(), 0.7) * c.r;
        const x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r;
        if (isSea(x, z)) continue;
        let skip = false; for (const ap of AIRPORTS) if (Math.hypot(x - ap.x, z - ap.z) < 3500) skip = true;
        if (!skip) p.push(x, groundH(x, z) + 4, z);
      }
    });
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts); W.cityLights = pts;
  }

  // ---------- Heure de la journée ----------
  const C = (h) => new THREE.Color(h);
  const PAL = [ // [élévation du soleil, haut, horizon, sol, lumière soleil, intensité]
    [-18, C(0x03060d), C(0x0a1222), C(0x020305), C(0x223355), 0.0],
    [-6, C(0x0d1730), C(0x3a3550), C(0x05070a), C(0x5a4a70), 0.05],
    [0, C(0x2a3c68), C(0xf08a4e), C(0x1a1410), C(0xff9a50), 0.35],
    [8, C(0x3d6cb8), C(0xf3c08a), C(0x3a3a30), C(0xffd2a0), 0.8],
    [25, C(0x2f69c8), C(0xaecdee), C(0x5a6650), C(0xfff4e0), 1.05],
    [90, C(0x2457b8), C(0xa6c8ec), C(0x5a6650), C(0xffffff), 1.15],
  ];
  function palAt(e) {
    let i = 0; while (i < PAL.length - 2 && e > PAL[i + 1][0]) i++;
    const A = PAL[i], B = PAL[i + 1], t = clamp((e - A[0]) / (B[0] - A[0]), 0, 1);
    return [1, 2, 3, 4].map(k => A[k].clone().lerp(B[k], t)).concat([A[5] + (B[5] - A[5]) * t]);
  }
  SIM.setHour = function (h) {
    W.hour = ((h % 24) + 24) % 24;
    const ang = (W.hour - 6) / 12 * Math.PI;           // 6h lever, 18h coucher
    const elev = Math.sin(ang) * 72, az = (90 + (W.hour - 6) / 12 * 180) * D2R;
    const e = elev * D2R;
    W.sunDir = new THREE.Vector3(Math.sin(az) * Math.cos(e), Math.sin(e), -Math.cos(az) * Math.cos(e) * 0.35 + 0.12).normalize();
    const [top, hor, low, sunC, I] = palAt(elev);
    const gk = WX[W.weather].grey, grey = C(0x5d6670).multiplyScalar(0.25 + 0.75 * clamp((elev + 6) / 20, 0, 1));
    top.lerp(grey, gk); hor.lerp(grey.clone().multiplyScalar(1.15), gk); low.lerp(grey.clone().multiplyScalar(0.6), gk);
    W.night = clamp((2 - elev) / 10, 0, 1);
    const u = W.sky.material.uniforms;
    u.top.value.copy(top); u.hor.value.copy(hor); u.low.value.copy(low); u.sun.value.copy(W.sunDir); u.sunCol.value.copy(sunC); u.night.value = W.night;
    W.horizon = hor;
    W.sunLight.color.copy(sunC); W.sunLight.intensity = I * (1 - gk * 0.8); u.sunCol.value.multiplyScalar(1 - gk * 0.9);
    W.hemi.intensity = W.hemiBase = (0.12 + 0.55 * (1 - W.night)) * (1 - gk * 0.25); W.hemi.color.copy(top).lerp(C(0xffffff), 0.5);
    W.stars.material.opacity = W.night * (1 - gk);
    W.cityLights.material.opacity = clamp((W.night - 0.2) * 1.4, 0, 1);
    const lit = (0.25 + 0.75 * (1 - W.night)) * (1 - gk * 0.45);
    W.cloudMats.forEach((m, i) => { m.color.setRGB(W.cloudShade[i] * lit, W.cloudShade[i] * lit, W.cloudShade[i] * lit).lerp(sunC, 0.18 * (1 - W.night)); });
    SIM.onHour && SIM.onHour(W.night);
  };

  SIM.setClouds = function (lvl) { W.cloudLevel = lvl; };
  SIM.setWeather = function (w) {
    W.weather = w; W.cloudLevel = Math.max(WX[w].clouds, w ? W.cloudLevel : 1); W.cloudsInit = false; SIM.setHour(W.hour);
  };
  function makeRain(scene) {
    const N = 7000, pos = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) { const x = (Math.random() - 0.5) * 360, y = (Math.random() - 0.5) * 260, z = (Math.random() - 0.5) * 360; pos.set([x, y, z, x, y + 3, z], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb8c6d4, transparent: true, opacity: 0.38, depthWrite: false }));
    m.frustumCulled = false; m.visible = false; scene.add(m); W.rain = { m, pos, N, ox: 0, oy: 0, oz: 0 };
  }

  function makePeakLabels(scene) {
    W.peakLabels = PEAKS.map(p => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
      const top = p.real;
      x.font = '600 38px "B612",sans-serif'; x.textAlign = 'center'; x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(40, 8, 432, 80);
      x.fillStyle = '#fff'; x.fillText('▲ ' + p.n, 256, 44); x.font = '30px "B612 Mono",monospace'; x.fillStyle = '#ffd9a0'; x.fillText(top + ' m', 256, 80);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), sizeAttenuation: false, transparent: true, depthWrite: false, fog: false }));
      sp.scale.set(0.16, 0.03, 1); sp.position.set(p.x, groundH(p.x, p.z) + 250, p.z); sp.renderOrder = 4; scene.add(sp); return { sp, p };
    });
    W.labelsOn = true;
  }
  SIM.setRelief = function (k) {
    RELIEF = k; calibratePeaks(); W.terrain.rebuild(W.terrain.cx, W.terrain.cz);
    W.peakLabels.forEach(l => { l.sp.position.y = groundH(l.p.x, l.p.z) + 250; });
  };
  SIM.initWorld = function (scene) {
    makeTerrain(scene); makeSky(scene); makeClouds(scene); makeBirds(scene); makeCities(scene); makeRain(scene); makePeakLabels(scene);
  };

  const tmp = new THREE.Vector3();
  SIM.updateWorld = function (dt, t, cam, plane) {
    const T = W.terrain, mv = Math.hypot(plane.x - T.cx, plane.z - T.cz);
    if (T.job) T.step(14);
    else if (mv > (plane.agl < 1500 ? 500 : Math.max(1500, plane.agl * 0.25))) { if (mv > 30000) T.rebuild(plane.x, plane.z); else T.start(plane.x, plane.z); }
    W.peakLabels.forEach(l => { const d = Math.hypot(l.p.x - cam.position.x, l.p.z - cam.position.z); l.sp.visible = W.labelsOn && d < 160000 && d > 2500; });
    W.sky.position.copy(cam.position); W.stars.position.copy(cam.position);
    W.water.position.x = cam.position.x; W.water.position.z = cam.position.z;
    W.seaN.offset.set(((cam.position.x / 260 + t * 0.012) % 1), ((-cam.position.z / 260 + t * 0.007) % 1));
    W.inN.offset.set((t * 0.01) % 1, (t * 0.006) % 1);
    W.sunLight.position.copy(cam.position).addScaledVector(W.sunDir, 20000); W.sunLight.target.position.copy(cam.position);
    const alt = cam.position.y, f = SIM.scene.fog;
    f.color.copy(W.horizon); f.density = (W.night > 0.5 ? 0.000018 : 0.0000088) * (alt > 3000 ? clamp(1 - (alt - 3000) / 12000, 0.35, 1) : 1);
    const wx = WX[W.weather], camAgl = alt - groundH(cam.position.x, cam.position.z), under = camAgl < (W.weather >= 2 ? 1500 : 2500);
    if (under) f.density *= wx.fog;
    const rn = W.rain; W.raining = !!wx.rain && under; rn.m.visible = W.raining;
    if (W.raining) {
      const B = 170, H = 120, p = rn.pos, d = rn.dp || (rn.dp = new Float64Array(rn.N * 3).map((_, i) => (Math.random() - 0.5) * (i % 3 === 1 ? 2 * H : 2 * B)));
      if (!rn.init) { rn.init = true; for (let i = 0; i < rn.N; i++) { d[i * 3] += cam.position.x; d[i * 3 + 1] += cam.position.y; d[i * 3 + 2] += cam.position.z; } }
      rn.m.material.opacity = 0.22 + wx.rain * 0.25;
      const hv = plane.V * Math.cos(plane.gamma || 0), vx = Math.sin(plane.psi) * hv, vz = -Math.cos(plane.psi) * hv, vy = plane.vs || 0;
      let sx = -vx * 0.035, sy = (-11 - vy) * 0.035 - 1.6, sz = -vz * 0.035; const sl = Math.hypot(sx, sy, sz); if (sl > 14) { sx *= 14 / sl; sy *= 14 / sl; sz *= 14 / sl; }
      const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z, w = (v, c, h) => c + ((((v - c + h) % (2 * h)) + 2 * h) % (2 * h)) - h;
      for (let i = 0; i < rn.N; i++) {
        const k = i * 3; d[k + 1] -= 11 * dt;
        const x = w(d[k], cx, B), y = w(d[k + 1], cy, H), z = w(d[k + 2], cz, B); d[k] = x; d[k + 1] = y; d[k + 2] = z;
        const j = i * 6; p[j] = x; p[j + 1] = y; p[j + 2] = z; p[j + 3] = x + sx; p[j + 4] = y + sy; p[j + 5] = z + sz;
      }
      rn.m.position.set(0, 0, 0); rn.m.geometry.attributes.position.needsUpdate = true;
    }
    // éclairs
    if (W.weather === 3) {
      W.nextFlash = (W.nextFlash == null ? 3 : W.nextFlash) - dt;
      if (W.nextFlash < 0) { W.flash = 1; W.nextFlash = 3 + Math.random() * 9; SIM.onThunder && SIM.onThunder(); }
    }
    if (W.flash > 0) { W.flash = Math.max(0, W.flash - dt * 5); const k = W.flash * (Math.random() < 0.6 ? 1 : 0.3); W.hemi.intensity = W.hemiBase + k * 2.5; f.color.lerp(C(0xdde4ff), k * 0.8); }
    else W.hemi.intensity = W.hemiBase;
    // nuages
    const counts = [0, 25, 55, 90], cnt = counts[W.cloudLevel];
    if (!W.cloudsInit) { W.clouds.forEach(g => placeCloud(g, cam.position.x, cam.position.z, true)); W.cloudsInit = true; }
    W.clouds.forEach((g, i) => {
      g.visible = i < cnt;
      if (Math.hypot(g.position.x - cam.position.x, g.position.z - cam.position.z) > 40000) placeCloud(g, cam.position.x, cam.position.z, false);
    });
    // oiseaux
    let strike = false;
    const showB = W.birdsOn !== false && W.weather < 3;
    tmp.set(plane.x, plane.y + 3.5, plane.z);
    const flap = (b, k) => { const fw = Math.sin(t * k + b.userData.ph * 3) * 0.7; b.userData.w[0].rotation.z = fw; b.userData.w[1].rotation.z = -fw; };
    W.flocks.forEach(fl => {
      const near = Math.hypot(fl.ap.x - cam.position.x, fl.ap.z - cam.position.z) < 30000;
      fl.grp.visible = showB && near; if (!fl.grp.visible) return;
      fl.ang += fl.sp * dt;
      const cx = fl.ap.x + fl.ox + Math.cos(fl.ang) * fl.r, cz = fl.ap.z + fl.oz + Math.sin(fl.ang) * fl.r, hd = fl.ang + (fl.sp > 0 ? Math.PI / 2 : -Math.PI / 2);
      fl.birds.forEach(b => {
        const o = b.userData.o, ph = b.userData.ph;
        b.position.set(cx + o.x + Math.sin(t * 0.3 + ph) * 8, fl.y + o.y + Math.sin(t * 0.5 + ph) * 4, cz + o.z);
        b.rotation.y = -hd + Math.PI / 2; flap(b, 9);
        if (b.position.distanceTo(tmp) < 9) strike = true;
      });
    });
    const low = cam.position.y - groundH(cam.position.x, cam.position.z) < 1800;
    W.roam.forEach(fl => {
      fl.grp.visible = showB && low; if (!fl.grp.visible) return;
      if (fl.x > 1e11) spawnRoam(fl, cam, plane.psi, true);
      if (Math.hypot(fl.x - cam.position.x, fl.z - cam.position.z) > 4500) spawnRoam(fl, cam, plane.psi, false);
      if (fl.soar) {
        fl.cx += Math.sin(fl.hd) * 1.5 * dt; fl.cz -= Math.cos(fl.hd) * 1.5 * dt; fl.x = fl.cx; fl.z = fl.cz; fl.y += dt * 0.6;
        fl.birds.forEach(b => {
          const o = b.userData.o, a = o.x + t * 0.25 * o.z;
          b.position.set(fl.cx + Math.cos(a) * fl.r * o.z, fl.y + o.y, fl.cz + Math.sin(a) * fl.r * o.z);
          b.rotation.set(0, a, 0.35); const g = (t + b.userData.ph) % 9 < 1.2; if (g) flap(b, 7); else { b.userData.w[0].rotation.z = 0.08; b.userData.w[1].rotation.z = -0.08; }
          if (b.position.distanceTo(tmp) < 12) strike = true;
        });
      } else {
        fl.x += Math.sin(fl.hd) * fl.sp * dt; fl.z -= Math.cos(fl.hd) * fl.sp * dt;
        const s1 = Math.sin(fl.hd), c1 = Math.cos(fl.hd);
        fl.birds.forEach(b => {
          const o = b.userData.o;
          b.position.set(fl.x + o.x * c1 - o.z * s1, fl.y + o.y + Math.sin(t * 0.7 + b.userData.ph) * 1.5, fl.z + o.x * s1 + o.z * c1);
          b.rotation.set(0, -fl.hd, 0); flap(b, 8);
          if (b.position.distanceTo(tmp) < 9) strike = true;
        });
      }
    });
    return strike;
  };
})();
