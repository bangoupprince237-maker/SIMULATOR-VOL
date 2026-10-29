// Contrôle aérien : messages radio en français ET en anglais, briefings de départ et d'approche selon l'appareil
(function () {
  const P = SIM.P, FT = 0.3048, KT = 0.514444, D2R = SIM.D2R;
  let CS = 'Air Sanaga 241';
  const FREQ = { NSI: ['118,10', '119,70', '121,90'], DLA: ['118,90', '124,10', '121,80'], KBI: ['118,30', '124,10', '121,70'], CDG: ['119,25', '125,82', '121,60'], ABJ: ['118,10', '120,30', '121,90'], JFK: ['119,10', '127,40', '121,90'] };
  const FIRS_N = [[7, 'Douala Contrôle', '124,10', 'Douala Control'], [13, 'Kano Contrôle', '127,10', 'Kano Control'], [23, 'Niamey Contrôle', '126,30', 'Niamey Control'], [37, 'Alger Contrôle', '125,50', 'Algiers Control'], [46, 'Marseille Contrôle', '132,40', 'Marseille Control'], [99, 'Paris Contrôle', '128,10', 'Paris Control']];
  const FIRS_W = [[-2, 'Accra Contrôle', '120,70', 'Accra Control'], [-20, 'Dakar Océanique', '132,70', 'Dakar Oceanic'], [-40, 'Sal Océanique', '127,30', 'Sal Oceanic'], [-60, 'Piarco Océanique', '126,90', 'Piarco Oceanic'], [-70, 'New York Océanique', '128,20', 'New York Oceanic'], [-999, 'New York Centre', '125,32', 'New York Center']];
  const A = SIM.atc = { st: 0, q: [], log: [], cleared: false, landClr: false };
  const greet = () => SIM.world.hour >= 18 || SIM.world.hour < 5 ? ['bonsoir', 'good evening'] : ['bonjour', 'good morning'];
  const wind = () => { const W = SIM.wind || {}, d = String(W.dir || 360).padStart(3, '0'), s = Math.round(W.spd || 0), gu = W.gust || 0;   // vent réel du simulateur (le même qui pousse l'avion et oriente la manche à air)
    return s < 3 ? ['vent calme', 'wind calm'] : [`vent ${d} degrés ${s} nœuds${gu ? ', rafales ' + gu : ''}`, `wind ${d} degrees ${s} knots${gu ? ', gusting ' + gu : ''}`]; };
  const FL = ft => 'niveau ' + Math.round(ft / 100), FLe = ft => 'flight level ' + Math.round(ft / 100);
  const enRwy = id => id.replace('R', ' right').replace('L', ' left');

  // file de messages : texte français + traduction anglaise (affichés, et lus à voix haute si le son est activé)
  SIM.radio = function (spk, txt, traffic, en) { A.q.push({ spk, txt, traffic, en, delay: A.q.length ? 2.4 : 0.4 }); };
  A.update = function (dt) {
    if (A.q.length) { const m = A.q[0]; m.delay -= dt; if (m.delay <= 0) { A.q.shift(); A.log.push(m); if (A.log.length > 40) A.log.shift(); SIM.onRadio && SIM.onRadio(m); } }
    A.flow(dt);
  };
  const say = (s, fr, en) => SIM.radio(s, fr, false, en), me = (fr, en) => SIM.radio('VOUS', fr, false, en);

  // ---------- Briefings selon l'appareil ----------
  A.brief = function () {
    const pf = SIM.perf(), R = SIM.route, heli = P.heli, cruise = Math.min(R.cruise, pf.ceil || 39000), vls = Math.round(pf.vapp * 0.93), vs = Math.round(pf.vapp / 1.3);
    if (heli) return {
      dep: ['Briefing hélicoptère : décollage vertical en maintenant W ou Z jusqu\'à 100 pieds, puis flèche avant pour accélérer. Vitesse de croisière 130 nœuds, maximum 150. Altitude de croisière 1 000 à 1 500 pieds.', 'Helicopter briefing: vertical take-off holding W or Z up to 100 feet, then push forward to accelerate. Cruise speed 130 knots, maximum 150. Cruise altitude 1,000 to 1,500 feet.'],
      app: ['Briefing atterrissage hélicoptère : ralentissez sous 40 nœuds à 1 kilomètre de l\'héliport, stationnaire à 30 pieds au-dessus du H, puis descente lente avec S, moins de 500 pieds par minute au toucher.', 'Helicopter landing briefing: slow below 40 knots one kilometre from the heliport, hover at 30 feet above the H, then descend slowly with S, less than 500 feet per minute at touchdown.'],
      rows: [['Décollage', 'vertical, W'], ['Croisière', '130 kt · 1 000–1 500 ft'], ['Vitesse max', '150 kt'], ['Approche', '< 40 kt à 1 km'], ['Toucher', '< 500 ft/min, < 10 kt']] };
    const fighter = P.type === 'chasseur';
    const dep = fighter
      ? [`Briefing départ ${pf.name} : postcombustion pleine (gaz à fond), rotation à ${pf.vr} nœuds, rentrez le train avant 250 nœuds. Montée à 400 nœuds, croisière ${FL(cruise)} à Mach ${pf.mach}, supersonique jusqu'à Mach 1,8. Vitesse minimale ${vs} nœuds.`,
        `Departure briefing ${pf.name}: full afterburner, rotate at ${pf.vr} knots, gear up before 250 knots. Climb at 400 knots, cruise ${FLe(cruise)} at Mach ${pf.mach}, supersonic up to Mach 1.8. Minimum speed ${vs} knots.`]
      : [`Briefing départ ${pf.name} : volets 1+F, poussée TOGA, V1 ${pf.v1}, rotation à ${pf.vr} nœuds, V2 ${pf.vr + 10}. Montée à 250 nœuds jusqu'au niveau 100, puis 290 nœuds. Croisière ${FL(cruise)} à Mach ${pf.mach}. Vitesse minimale ${vls} nœuds en approche, décrochage vers ${vs} nœuds.`,
        `Departure briefing ${pf.name}: flaps 1+F, TOGA thrust, V1 ${pf.v1}, rotate ${pf.vr} knots, V2 ${pf.vr + 10}. Climb 250 knots to flight level 100, then 290 knots. Cruise ${FLe(cruise)} at Mach ${pf.mach}. Minimum approach speed ${vls} knots, stall around ${vs} knots.`];
    const td = Math.round(((cruise * FT - R.dest.elev) / Math.tan(3 * D2R)) / 1852 + 10);
    const app = [`Briefing approche ${R.dest.city} piste ${R.ae.id} : début de descente à environ ${td} milles nautiques, 250 nœuds sous le niveau 100. Interception ILS à 3 000 pieds, 210 puis 180 nœuds. Train sorti à 2 000 pieds, volets FULL, vitesse d'approche ${pf.vapp} nœuds, jamais sous ${vls}. Pente 3 degrés : 2 PAPI blancs et 2 rouges, environ ${Math.round(pf.vapp * 5.3 / 50) * 50} pieds par minute. Arrondi à 30 pieds, gaz réduits, toucher sous 300 pieds par minute, puis inverseurs et freins.`,
      `Approach briefing ${R.dest.city} runway ${enRwy(R.ae.id)}: start descent about ${td} nautical miles out, 250 knots below flight level 100. Intercept the ILS at 3,000 feet, 210 then 180 knots. Gear down at 2,000 feet, flaps full, approach speed ${pf.vapp} knots, never below ${vls}. Three-degree slope: two white and two red PAPI lights, about ${Math.round(pf.vapp * 5.3 / 50) * 50} feet per minute. Flare at 30 feet, thrust idle, touch down below 300 feet per minute, then reversers and brakes.`];
    return { dep, app, rows: [['Appareil', pf.name], ['V1 / VR / V2', fighter ? `— / ${pf.vr} / —` : `${pf.v1} / ${pf.vr} / ${pf.vr + 10} kt`], ['Montée', fighter ? '400 kt' : '250 kt < FL100, puis 290 kt'], ['Croisière', `${FL(cruise).replace('niveau ', 'FL')} · Mach ${pf.mach}`], ['Début de descente', `≈ ${td} NM de l'arrivée`],
      ['Interception ILS', '3 000 ft · 210 → 180 kt'], ['Train / volets', '2 000 ft · FULL'], ['Vitesse d\'approche', `${pf.vapp} kt`], ['Vitesse minimale', `${vls} kt (décrochage ≈ ${vs})`], ['Pente', `3° · ≈ ${Math.round(pf.vapp * 5.3 / 50) * 50} ft/min`], ['Arrondi / toucher', '30 ft · < 300 ft/min']] };
  };

  A.reset = function () {
    A.q.length = 0; A.st = 0; A.cleared = false; A.landClr = false; A.t = 0; A.fir = null; A.warned = {}; A.ctl = 0; A.briefDone = false; A.appBrief = false; A.cruiseSaid = 0;
    A.wd = String(Math.round((SIM.route.de.hdg + (Math.random() * 40 - 20) + 360) % 360 / 10) * 10).padStart(3, '0');
    A.ws = Math.floor(Math.random() * 8); A.qnh = 1008 + Math.floor(Math.random() * 9);
  };
  A.sayBrief = function (which) { const b = A.brief(); const m = b[which]; if (m) say('BRIEFING', m[0], m[1]); };

  A.flow = function (dt) {
    if (P.crashed) { if (A.st !== 99) { A.st = 99; A.q.length = 0; say('TOUR', 'Mayday reçu ! Tous les services de secours sont déclenchés.', 'Mayday received! All emergency services are on their way.'); } return; }
    A.t = (A.t || 0) + dt;
    if (!A.briefDone && A.t > 1) { A.briefDone = true; A.sayBrief('dep'); }
    if (P.heli) { const near = SIM.AIRPORTS.flatMap(a => a.helipads || []).some(p => Math.hypot(p.x - P.x, p.z - P.z) < 2500); if (!P.onGround && near && P.V < 40 * KT && !A.appBrief) { A.appBrief = true; A.sayBrief('app'); } if (P.onGround) A.appBrief = false; return; }
    if (P.boarding || P.autoTaxi) return;
    const R = SIM.route, dep = R.dep, dest = R.dest, fd = FREQ[dep.id] || FREQ.NSI, fa = FREQ[dest.id] || FREQ.NSI, il = SIM.ils(), rem = SIM.routeRemaining();
    const surf = P.onGround ? SIM.surface(P.x, P.z) : null, rw = R.de.id, rwE = enRwy(rw), ra = R.ae.id, raE = enRwy(ra), [g, gE] = greet(), [w, wE] = wind();
    if (!A.cleared && P.onGround && !P.landed && P.V > 18 && surf && surf.type === 'piste' && !A.warned.stop) { A.warned.stop = 1; say('TOUR', `${CS}, stop, stop, stop ! Vous n'êtes pas autorisé au décollage.`, `${CS}, stop immediately, I say again, stop immediately! You are not cleared for take-off.`); }
    switch (A.st) {
      case 0: if (A.t > 2.5) {
        me(`${dep.city} Tour, ${CS}, au point d'arrêt piste ${rw}, prêt au départ.`, `${dep.city} Tower, ${CS}, holding point runway ${rwE}, ready for departure.`);
        say('TOUR', `${CS}, ${dep.city} Tour, ${g}. Alignez-vous et attendez piste ${rw}, un départ devant vous.`, `${CS}, ${dep.city} Tower, ${gE}. Line up and wait runway ${rwE}, one departure ahead.`);
        me(`Alignement et attente piste ${rw}, ${CS}.`, `Lining up and waiting runway ${rwE}, ${CS}.`); A.st = 1; } break;
      case 1: {
        const d = SIM.ai.depAI, gone = !d || SIM.ai.list.indexOf(d) < 0 || (d.mode === 'climb' && d.y - dep.elev > 120);
        if (gone && A.t > 12) { say('TOUR', `${CS}, suivez le trafic qui vient de décoller, ${w}, piste ${rw}, autorisé décollage.`, `${CS}, follow the departing traffic, ${wE}, runway ${rwE}, cleared for take-off.`); me(`Autorisé décollage piste ${rw}, ${CS}.`, `Cleared for take-off runway ${rwE}, ${CS}.`); A.cleared = true; A.st = 2; }
        break;
      }
      case 2: if (!P.onGround && P.agl > 1500 * FT) {
        say('TOUR', `${CS}, contactez ${dep.city} Approche ${fd[1]}, au revoir.`, `${CS}, contact ${dep.city} Approach ${fd[1].replace(',', '.')}, goodbye.`);
        me(`${dep.city} Approche, ${CS}, en montée vers ${Math.round(P.y / FT / 100) * 100} pieds.`, `${dep.city} Approach, ${CS}, climbing through ${Math.round(P.y / FT / 100) * 100} feet.`);
        say('APPROCHE', `${CS}, identifié radar. Montez au ${FL(R.cruise)}, direct ${dest.city}, vitesse 250 nœuds jusqu'au niveau 100.`, `${CS}, radar contact. Climb ${FLe(R.cruise)}, proceed direct ${dest.city}, speed 250 knots until flight level 100.`);
        me(`Montée ${FL(R.cruise)}, direct ${dest.city}, ${CS}.`, `Climbing ${FLe(R.cruise)}, direct ${dest.city}, ${CS}.`); A.st = 3; } break;
      case 3: {
        const ll = SIM.geo.toLL(P.x, P.z), west = Math.min(dep.lon, dest.lon) < -30, far = R.dist > 1500000;
        const fir = far ? (west ? FIRS_W.find(f => ll.lon > f[0]) : FIRS_N.find(f => ll.lat < f[0])) : null;
        if (fir && A.fir !== fir[1] && P.agl > 3000) { const prev = A.fir; A.fir = fir[1]; if (prev) say('CONTRÔLE', `${CS}, contactez ${fir[1]} ${fir[2]}.`, `${CS}, contact ${fir[3]} ${fir[2].replace(',', '.')}.`); me(`${fir[1]}, ${CS}, ${FL(P.y / FT)}.`, `${fir[3]}, ${CS}, ${FLe(P.y / FT)}.`); say('CONTRÔLE', `${CS}, ${fir[1]}, identifié radar, ${g}.`, `${CS}, ${fir[3]}, radar contact, ${gE}.`); }
        if (!A.cruiseSaid && Math.abs(P.y / FT - R.cruise) < 400 && !P.onGround) { A.cruiseSaid = 1; const pf = SIM.perf(); say('CONTRÔLE', `${CS}, maintenez ${FL(R.cruise)}, vitesse de croisière Mach ${pf.mach}.`, `${CS}, maintain ${FLe(R.cruise)}, cruise speed Mach ${pf.mach}.`); }
        const desc = P.ap.desc || P.vs < -6 || rem < (P.y - dest.elev) / Math.tan(3 * D2R) + 30000;
        if (rem < R.dist / 2 && !A.ctl && !far) { A.ctl = 1; say('APPROCHE', `${CS}, contactez ${dest.city} Contrôle ${fa[1]}.`, `${CS}, contact ${dest.city} Control ${fa[1].replace(',', '.')}.`); }
        if (desc && !P.onGround) {
          say('CONTRÔLE', `${CS}, descendez 3 000 pieds, QNH ${A.qnh}, prévoyez approche ILS piste ${ra}.`, `${CS}, descend 3,000 feet, QNH ${A.qnh}, expect ILS approach runway ${raE}.`);
          me(`Descente 3 000 pieds, QNH ${A.qnh}, ILS piste ${ra}, ${CS}.`, `Descending 3,000 feet, QNH ${A.qnh}, ILS runway ${raE}, ${CS}.`); A.sayBrief('app'); A.st = 4; }
        break;
      }
      case 4: if (rem < 38000 && !P.onGround) { say('APPROCHE', `${CS}, ${dest.city} Approche, réduisez 210 nœuds, autorisé approche ILS piste ${ra}, rappelez établi.`, `${CS}, ${dest.city} Approach, reduce speed 210 knots, cleared ILS approach runway ${raE}, report established.`); me(`210 nœuds, autorisé ILS piste ${ra}, ${CS}.`, `Speed 210, cleared ILS runway ${raE}, ${CS}.`); A.st = 5; } break;
      case 5: if (il.ok && Math.abs(il.lat) < 300 && il.along < 26000 && !P.onGround) {
        me(`Établi ILS piste ${ra}, ${CS}.`, `Established ILS runway ${raE}, ${CS}.`);
        const ahead = SIM.ai.landingAhead(dest), pf = SIM.perf();
        say('TOUR', `${CS}, ${dest.city} Tour, ${g}, continuez l'approche${ahead ? ', numéro deux derrière ' + ahead.cs : ''}. Réduisez à ${pf.vapp} nœuds, train sorti, volets FULL.`, `${CS}, ${dest.city} Tower, ${gE}, continue approach${ahead ? ', number two behind ' + ahead.cs : ''}. Reduce to ${pf.vapp} knots, gear down, flaps full.`); A.st = 6; } break;
      case 6: if (il.along < 9000 && !SIM.ai.runwayBusy(dest)) { say('TOUR', `${CS}, ${w}, piste ${ra}, autorisé atterrissage.`, `${CS}, ${wE}, runway ${raE}, cleared to land.`); me(`Autorisé atterrissage piste ${ra}, ${CS}.`, `Cleared to land runway ${raE}, ${CS}.`); A.landClr = true; A.st = 7; }
        else if (il.along < 1500 && !P.onGround && !A.warned.ga) { A.warned.ga = 1; say('TOUR', `${CS}, remettez les gaz, je répète, remettez les gaz, piste occupée.`, `${CS}, go around, I say again, go around, runway occupied.`); }
        if (P.landed && P.onGround) A.st = 7; break;
      case 7:
        if (!P.onGround && il.along < 4000 && il.along > 0 && P.ias / KT < SIM.perf().vapp * 0.9 && !A.warned.spd) { A.warned.spd = 1; say('TOUR', `${CS}, vitesse faible, vérifiez votre vitesse !`, `${CS}, low speed, check your airspeed!`); }
        if (P.landed && P.onGround && P.V < 25) {
          const st = dest.stands.filter(s => !s.busy).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0];
          say('TOUR', `${CS}, dégagez à droite par la prochaine bretelle, contactez Sol ${fa[2]}.`, `${CS}, vacate right at the next taxiway, contact Ground ${fa[2].replace(',', '.')}.`);
          say('SOL', `${CS}, ${dest.city} Sol, roulez poste ${st ? st.n : 1} via Alpha.`, `${CS}, ${dest.city} Ground, taxi to stand ${st ? st.n : 1} via Alpha.`); A.st = 8; } break;
      case 8: if (P.parked) { me(`${CS}, au poste, moteurs coupés.`, `${CS}, on stand, engines shut down.`); say('SOL', `${CS}, bien reçu, bonne journée.`, `${CS}, roger, have a nice day.`); A.st = 9; } break;
    }
  };
  A.status = () => !A.cleared && P.onGround && !P.landed ? 'attente' : A.cleared ? 'autorisé' : '';
  A.setCS = c => { CS = c; A.CS = c; }; A.CS = CS;
})();
