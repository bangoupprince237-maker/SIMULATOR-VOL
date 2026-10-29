// Commandes, événements et boucle principale
(function () {
  const P = SIM.P, V = SIM.view, D2R = SIM.D2R, R2D = SIM.R2D, clamp = SIM.clamp;
  const $ = id => document.getElementById(id), $$ = s => Array.from(document.querySelectorAll(s));
  SIM.timeScale = 1;
  let toastT = 0, fcCalls = {};
  function toast(m, ms) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms || 2600); }

  V.init();
  SIM.war.init(SIM.scene, { say: (m) => V.say(m), toast: (m, ms) => toast(m, ms) });
  SIM.troops.init(SIM.scene); SIM.troops.toast = (m, ms) => toast(m, ms || 2600);
  // ---------- En ligne ----------
  SIM.net.init(SIM.scene, { say: (m) => V.say(m), toast: (m, ms) => toast(m, ms) });
  $('netName').value = SIM.net.name;
  const netName = () => { SIM.net.setName($('netName').value); $('netName').value = SIM.net.name; toast('Votre nom en ligne : ' + SIM.net.name); };
  $('netNameOk').onclick = netName; $('netName').addEventListener('keydown', ev => { if (ev.key === 'Enter') { netName(); ev.target.blur(); } });
  $('netRoomGo').onclick = () => SIM.net.joinRoom($('netRoom').value);
  $('netRoom').addEventListener('keydown', ev => { if (ev.key === 'Enter') { SIM.net.joinRoom($('netRoom').value); ev.target.blur(); } });
  $('netRoomOut').onclick = () => { $('netRoom').value = ''; SIM.net.leaveRoom(); };
  $('netPvp').addEventListener('change', ev => { SIM.net.setPvp(ev.target.checked); ev.target.blur(); });
  const netSend = () => { SIM.net.chat($('netMsg').value); $('netMsg').value = ''; };
  $('netSend').onclick = netSend; $('netMsg').addEventListener('keydown', ev => { if (ev.key === 'Enter') { netSend(); } if (ev.key === 'Escape') ev.target.blur(); });
  // sélecteurs départ / destination
  SIM.AIRPORTS.forEach(a => { for (const s of ['dep', 'dest']) { const o = document.createElement('option'); o.value = a.id; o.textContent = a.city + ' (' + a.icao + ')'; $(s).appendChild(o); } });
  $('dep').value = 'NSI'; $('dest').value = 'DLA';
  SIM.AIRPORTS.forEach(a => { const o = document.createElement('option'); o.value = a.id; o.textContent = 'Escale à ' + a.city + ' (' + a.icao + ')'; $('esc').appendChild(o); });
  // grille des vues
  V.VIEWS.forEach(([id, name]) => { const b = document.createElement('button'); b.className = 'vw' + (id === V.view ? ' on' : ''); b.dataset.v = id; b.textContent = name; $('viewGrid').appendChild(b); });

  // ---------- Événements de simulation ----------
  SIM.onEvent = function (t, d) {
    switch (t) {
      case 'reset': if (V.plane && V.plane.repair) V.plane.repair(); fcCalls = {}; P.visY = null; V.awaitRwy = false; V.wantAuto = false; P.holdPt = null; if (V.myBoard) { SIM.life.removeBoarding(V.myBoard); V.myBoard = null; } if (P.heli) SIM.startHeli({ a: SIM.route.dep }); SIM.ai.reset(); SIM.atc.reset(); $('radioL').innerHTML = ''; V.trail = []; V.clearFx(); $('over').hidden = true; refreshPanel(); updRoute(); break;
      case 'liftoff': toast('Décollage ! Montée positive.'); V.say('Montée positive'); break;
      case 'touchdown': {
        const vs = Math.round(d.vs), q = vs > -120 ? 'Toucher parfait' : vs > -300 ? 'Bon atterrissage' : vs > -600 ? 'Atterrissage ferme' : 'Atterrissage dur';
        const where = d.water ? ' — amerrissage !' : d.belly ? ' — sur le ventre !' : d.surf.type === 'piste' ? '' : d.surf.type === 'avenue' ? ' — sur le boulevard de la ville !' : d.surf.type === 'route' ? ' — dans une rue !' : d.surf.type === 'foret' ? ' — dans la forêt !' : ' — sur l\'herbe / le terrain';
        V.touchdown(d.vs); toast(`${d.water ? 'Amerrissage réussi' : q} : ${vs} ft/min${where}`, 4500); V.say(d.water ? 'Amerrissage' : q); break;
      }
      case 'crash': V.crashFx(); $('overTitle').textContent = 'Accident'; $('overTitle').style.color = 'var(--red)'; $('overText').textContent = d; V.say('Accident'); toast(d, 5000); setTimeout(() => { if (P.crashed) $('over').hidden = false; }, 9000); break;
      case 'parked': {
        if (V.myBoard) SIM.life.removeBoarding(V.myBoard);
        const scl = V.plane.body.scale.clone();
        if (d.board) { V.myBoard = SIM.life.addBoarding(d.s, d.a.elev, scl, 'on', 26); V.myBoard.player = 'on'; toast('Embarquement des passagers au poste ' + d.n + '…', 5000); SIM.radio('VOUS', `${SIM.atc.CS}, au poste ${d.n}, embarquement en cours.`, false, `${SIM.atc.CS}, on stand ${d.n}, boarding in progress.`); break; }
        if (d.a === SIM.route.dest && escaleArrive()) break;
        V.myBoard = SIM.life.addBoarding(d.s, d.a.elev, scl, 'off', 26); V.myBoard.player = 'off'; toast('Débarquement des passagers…', 5000);
        const dest = SIM.route.dest, ok = d.a === dest;
        $('overTitle').textContent = ok ? 'Vol réussi' : 'Avion garé'; $('overTitle').style.color = 'var(--green)';
        $('overText').textContent = `Poste ${d.n} à ${d.a.name}. ${ok ? 'Destination atteinte.' : ''} Altitude max ${Math.round(P.maxAlt / SIM.FT / 100) * 100} ft · toucher ${Math.round(P.tdRate)} ft/min · durée de vol ${Math.round(P.tSim / 60)} min.`;
        $('overBtn').textContent = 'Nouveau vol'; setTimeout(() => { if (P.parked) $('over').hidden = false; }, 22000); break;
      }
      case 'pushDone': {
        V.awaitRwy = true; SIM.atc.st = 10; V.setView('chase');
        const R = SIM.route;
        toast('Repoussage terminé : À VOUS de rouler ! Gaz 30 % (touche + ou =), dirigez avec ← → ou Q/D, freinez avec B. Suivez la consigne en haut jusqu\'au point d\'arrêt piste ' + R.de.id + '. Touche I = roulage automatique.', 10000);
        SIM.radio('SOL', `${SIM.atc.CS}, repoussage terminé, roulez point d'arrêt piste ${R.de.id} via Alpha, rappelez prêt.`, false, `${SIM.atc.CS}, push-back complete, taxi to holding point runway ${R.de.id} via Alpha, report ready.`);
        break;
      }
      case 'taxiDone': {
        V.awaitRwy = false; V.wantAuto = false;
        SIM.ai.crossing(650); SIM.atc.st = 0; SIM.atc.t = 0; SIM.atc.cleared = false; V.setView('chase');
        toast('Aligné au point d\'attente : un avion va passer devant vous et décoller. Attendez l\'autorisation.', 6000); break;
      }
      case 'stopped': if (P.surf && P.surf.ap && P.surf.ap === SIM.route.dest && escaleArrive()) break; toast(P.surf && P.surf.type === 'eau' ? 'Avion arrêté sur l\'eau : il flotte. Pleine puissance (T) et levier MONTÉE pour redécoller.' : P.belly ? 'Avion immobilisé sur le ventre.' : P.surf && P.surf.ap ? 'Avion arrêté. « Garer au poste » pour rejoindre le terminal.' : 'Avion arrêté hors piste. Vous pouvez redécoller (gaz à fond) ou sortir avec E (Rafale).', 5000); break;
      case 'splash': for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, r = Math.random() * 12; SIM.boom.puff(d.x + Math.cos(a) * r, d.y + 0.5, d.z + Math.sin(a) * r, 6 + Math.random() * 8, 2 + Math.random() * 1.5, 'spray'); } V.boomSound(0.25); break;
      case 'wp': toast('Point suivant : ' + d.n); break;
      case 'forest': {
        const half = (SIM.tyx().half || 17) + 6; SIM.nature.flatten(d.x, d.z, half);
        for (let i = 0; i < 4; i++) { const a = Math.random() * 6.28, r = Math.random() * half; SIM.boom.puff(d.x + Math.cos(a) * r, P.y + 2 + Math.random() * 6, d.z + Math.sin(a) * r, 4 + Math.random() * 6, 1.6 + Math.random(), Math.random() < 0.7 ? 'leaf' : 'dust'); }
        V.shakeT = Math.max(V.shakeT || 0, 0.25); break;
      }
      case 'skid': { V.skidOn = 0.3;
        const c = Math.cos(P.psi), s = Math.sin(P.psi);
        for (const sx of [-1, 1]) SIM.boom.puff(d.x + c * sx * 3.8, d.y + 0.6, d.z + s * sx * 3.8, 2.5 + Math.random() * 2, 1.4, 'tire');
        const now = performance.now(); if (!V.skidMsg || now - V.skidMsg > 7000) { V.skidMsg = now; toast('Dérapage ! Trop vite dans le virage : ralentissez (B) avant de tourner.', 3000); } break;
      }
      case 'engDmg': {
        const n = d.i + 1, txt = { hard: `Toucher brutal : le moteur ${n} est abîmé et fume.`, forest: 'Les arbres ont abîmé les réacteurs : ils fument légèrement.', random: `Panne : le moteur ${n} fume et perd de la puissance !`, manual: `Panne simulée : le moteur ${n} fume (${Math.round(d.d * 100)} % de dégâts).` }[d.why] || `Moteur ${n} endommagé.`;
        toast(txt + (d.d >= 1 ? ' Il est ARRÊTÉ.' : ' « Réparer » au sol, ou posez-vous sur un aéroport.'), 5000); V.say(d.d >= 1 ? 'Moteur ' + n + ' arrêté' : 'Moteur ' + n + ' endommagé');
        if (!P.onGround) SIM.radio('VOUS', d.d >= 1 ? `Pan pan, pan pan, ${SIM.atc.CS}, moteur ${n} arrêté, nous poursuivons sur un moteur.` : `${SIM.atc.CS}, fumée sur le moteur ${n}, nous surveillons.`, false, d.d >= 1 ? `Pan pan, ${SIM.atc.CS}, engine ${n} failure.` : `${SIM.atc.CS}, smoke from engine ${n}, monitoring.`);
        break;
      }
      case 'noFuel': toast('PANNE SÈCHE ! Les moteurs s\'arrêtent : planez vers une piste, un champ, une route ou l\'eau.', 8000); SIM.radio('VOUS', `Mayday, mayday, mayday, ${SIM.atc.CS}, panne sèche, moteurs arrêtés, nous planons.`, false, `Mayday mayday mayday, ${SIM.atc.CS}, fuel exhaustion, both engines out.`); break;
      case 'mode': toast(d); break;
      case 'call': toast(d); V.say(d); break;
      case 'warn': V.tailT = 1; break;
      case 'toast': toast(d); break;
    }
  };
  let radioVoice = true;
  $('radioMute').onclick = () => { radioVoice = !radioVoice; $('radioMute').classList.toggle('on', radioVoice); };
  $('radioMute').classList.add('on');
  SIM.onRadio = function (m) {
    const d = document.createElement('div'), v = m.spk === 'VOUS';
    if (m.traffic) d.className = 'tr';
    const s = document.createElement('span'); s.className = 's' + (v ? ' v' : m.spk === 'BRIEFING' ? ' b' : ''); const lang = $('radioLang').value; s.textContent = lang === 'fr' ? m.spk : ({ TOUR: 'TOWER', SOL: 'GROUND', APPROCHE: 'APPROACH', 'CONTRÔLE': 'CONTROL' }[m.spk] || m.spk); d.appendChild(s);
    if (lang !== 'en' || !m.en) d.appendChild(document.createTextNode(m.txt));
    if (m.en && lang !== 'fr') { const e = document.createElement('em'); e.textContent = (lang === 'en' ? '' : ' — ') + m.en; d.appendChild(e); }
    const L = $('radioL'); L.appendChild(d); while (L.children.length > (m.spk === 'BRIEFING' ? 2 : 3)) L.removeChild(L.firstChild);
    $('radioF').textContent = SIM.atc.cleared ? 'décollage autorisé' : '';
    if (radioVoice) {
      if ((lang !== 'en' && lang !== 'enx') || !m.en) V.say(m.txt.replace(/(\d),(\d)/g, '$1 décimale $2'), 'fr-FR', v ? 0.85 : m.traffic ? 1.15 : 1.0, 1.12);
      if (m.en && lang !== 'fr') {
        V.say(m.en, 'en-US', v ? 0.85 : 1.0, 1.1);
        if (!V.enWarn && V.audio && window.speechSynthesis && speechSynthesis.getVoices().length && !V.hasEnglishVoice()) { V.enWarn = true; toast('Aucune voix anglaise n\'est installée sur cet ordinateur : la radio anglaise ne peut pas être lue à voix haute. Windows : Paramètres → Heure et langue → Voix → ajouter « English (United States) ».', 12000); }
      }
    }
    if (m.spk === 'BRIEFING') fillBrief();
  };
  function updRoute() { const R = SIM.route; $('routeInfo').textContent = `${R.dep.id} → ${R.dest.id} · ${Math.round(R.dist / 1000)} km · FL${Math.round(R.cruise / 100)}`; }
  function doReset(gate) {
    if ($('dep').value === $('dest').value) { toast('Choisissez une destination différente du départ.'); return; }
    const esc = $('esc').value;
    if (esc && esc !== $('dep').value && esc !== $('dest').value) { SIM.reset($('dep').value, esc); V.finalDest = $('dest').value; V.escId = esc; }
    else { SIM.reset($('dep').value, $('dest').value); V.finalDest = null; V.escId = null; if (esc) $('esc').value = ''; }
    V.fuelWarn = 0;
    if ((gate == null ? $('gateStart').checked : gate) && !P.heli) {
      const m = SIM.park(true);
      if (!m) { V.setView('orbit'); V.orb.yaw = 2.3; V.orb.pitch = 0.25; V.orb.zoom = 0.8; SIM.radio('VOUS', `${SIM.route.dep.city} Sol, ${SIM.atc.CS}, au poste ${P.parkInfo.n}, embarquement en cours.`, false, `${SIM.route.dep.city} Ground, ${SIM.atc.CS}, on stand ${P.parkInfo.n}, boarding in progress.`); }
    }
    SIM.war.applySize();
    fillBrief();
  }
  function fillBrief() {
    const b = SIM.atc.brief(); $('briefT').innerHTML = b.rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('');
  }
  $('dep').onchange = $('dest').onchange = $('esc').onchange = () => doReset();
  // ---------- Carburant, escales et pannes ----------
  const A_ = id => SIM.AIRPORTS.find(a => a.id === id);
  function escaleArrive() {
    if (!V.finalDest || !SIM.route || P.crashed) return false;
    const here = SIM.route.dest, next = A_(V.finalDest);
    SIM.repair(); SIM.setLeg(here.id, next.id); SIM.refuel(false); P.fuel = Math.max(P.fuel, SIM.planFuel(SIM.route.dist));
    V.finalDest = null; V.escId = null; V.fuelWarn = 0; fillBrief();
    toast(`Escale à ${here.city} : plein fait (${(P.fuel / 1000).toFixed(1)} t) et avion vérifié. Prochaine étape : ${next.city} (${Math.round(SIM.route.dist / 1000)} km). Gaz quand vous voulez !`, 9000);
    SIM.radio('SOL', `${SIM.atc.CS}, bienvenue à ${here.city}. Le camion-citerne a terminé, plein effectué. Étape suivante : ${next.city}.`, false, `${SIM.atc.CS}, welcome to ${here.city}. Refuelling complete. Next leg: ${next.city}.`);
    V.say('Escale à ' + here.city + '. Plein effectué.');
    return true;
  }
  // lieux célèbres : approche des boulevards (atterrissage en ville) et survol des monuments
  const SPOTS = [];
  SIM.city.avenues().forEach(a => SPOTS.push({ n: 'Atterrir sur ' + a.name + ' (' + a.city.split(' —')[0] + ')', av: a }));
  SIM.landmarks.list.forEach(d => SPOTS.push({ n: 'Survoler : ' + d.name.split(' ·')[0], lm: d }));
  SPOTS.forEach((s, i) => { const o = document.createElement('option'); o.value = i; o.textContent = s.n; $('spot').appendChild(o); });
  function placeAir(x, z, y, psi, spd, landing) {
    if (P.heli) return toast('Choisissez un avion (Votre avion → Type) pour cette approche.');
    if (V.myBoard) { SIM.life.removeBoarding(V.myBoard); V.myBoard = null; }
    Object.assign(P, { x, z, y, psi, theta: landing ? 0.02 : 0.03, phi: 0, gamma: landing ? -3 * SIM.D2R : 0, V: spd, onGround: false, gearDown: !!landing, gearPos: landing ? 1 : 0, flapSel: landing ? 4 : 1, flapPos: landing ? 1 : 0.25,
      thr: landing ? 0.4 : 0.65, rev: false, pbrk: false, brake: false, parked: false, boarding: false, doorsClosed: true, autoTaxi: null, landed: false, crashed: false, belly: false, airTime: 100, lawB: 1, liftOn: false, lift: 0, n1: [0.6, 0.6], eng: [true, true], ci: {}, spoilSel: 0, turbo: false });
    Object.assign(P.ap, { on: false, athr: false, full: false, srs: false });
    if (SIM.atc) { SIM.atc.q.length = 0; SIM.atc.st = 99; }
    V.clearFx(); SIM.world.terrain.rebuild(P.x, P.z, true); SIM.nature.rebuild(P.x, P.z, true); $('over').hidden = true; V.setView('chase');
  }
  $('spotGo').onclick = () => {
    const s = SPOTS[+$('spot').value]; if (!s) return;
    if (s.av) {
      const a = s.av, psi = Math.atan2(a.a.x - a.b.x, -(a.a.z - a.b.z)), d = 5500, fx = Math.sin(psi), fz = -Math.cos(psi);
      placeAir(a.b.x - fx * d, a.b.z - fz * d, a.base + 15 + d * Math.tan(3 * SIM.D2R), psi, SIM.perf().vapp * SIM.KT, true);
      toast(`Finale sur ${a.name} : ${Math.round(a.len)} m de chaussée, 80 m de large. Gardez l'axe, réduisez les gaz à 10 m, freinez (B) — attention aux immeubles de chaque côté !`, 9000);
      V.say('Finale sur ' + a.name);
    } else {
      const d = s.lm, base = d.base != null ? d.base : SIM.groundH(d.x, d.z);
      placeAir(d.x - 2600, d.z + 400, base + Math.max(d.H * 0.6, 250), Math.PI / 2 - 0.15, 120, false);
      toast(`Cap sur ${d.name} : il est droit devant vous. Ne le percutez pas !`, 7000);
    }
  };
  $('btnFuel').onclick = () => { const m = SIM.refuel(true); if (m) return toast(m); SIM.repair(); V.fuelWarn = 0; toast(`Plein fait : ${(P.fuel / 1000).toFixed(1)} tonnes de carburant (réservoir plein). Réacteurs vérifiés.`, 4000); V.say('Plein effectué'); };
  $('btnFail').onclick = () => { if (P.crashed) return; const i = P.dmg && P.dmg[0] > P.dmg[1] ? 1 : 0; SIM.damageEngine(i, 0.35, 'manual'); };
  $('btnRepair').onclick = () => { if (!P.onGround || P.V > 1) return toast('Réparation possible au sol, avion arrêté.'); SIM.repair(); toast('Réacteurs réparés : plus de fumée.'); };
  $('randFail').addEventListener('change', ev => { P.randFail = ev.target.checked; toast(P.randFail ? 'Pannes aléatoires activées : surveillez la fumée et l\'écran moteurs.' : 'Pannes aléatoires coupées.'); });
  $('btnReset').onclick = () => doReset(false);
  $('overBtn').onclick = () => { $('overBtn').textContent = 'Recommencer au départ'; doReset(); };
  $('btnBriefDep').onclick = () => SIM.atc.sayBrief('dep'); $('btnBriefApp').onclick = () => SIM.atc.sayBrief('app');
  $('btnSkipBoard').onclick = () => { if (V.myBoard) { V.myBoard.people.forEach(p => { if (!p.done) { p.done = true; V.myBoard.done++; p.m.visible = false; } }); } };
  $('btnPark').onclick = () => { if (P.heli) return toast('L\'hélicoptère se pose sur les « H » de l\'héliport.'); const m = SIM.park(); if (m) toast(m); };
  function footGuide() {
    const T = SIM.troops, W = SIM.war;
    if (W.truckMode) return { ph: 'Défense sol-air (camp ennemi)', t: 'Le radar accroche les Rafale à moins de 30 km. Tir automatique avec A, ou manuel avec Entrée. Déplacez le camion (Z/S + Q/D) quand un missile arrive.', n: 'Y : avion suivant · « Quitter le camion » pour revenir au Rafale.' };
    if (T.active) { const f = T.foes.filter(e => !e.dead); let n = f.length ? 'Ennemi le plus proche : ' + Math.round(Math.min(...f.map(e => Math.hypot(e.x - T.me.x, e.z - T.me.z)))) + ' m.' : 'Aucun ennemi au sol à proximité (ils sont près de la piste avancée).';
      return { ph: 'À pied — ' + T.UNITS[T.unit].cmdName, t: 'Z/↑ avancer, Maj courir, souris ou ← → pour viser, Espace pour tirer, C pour vous cacher derrière un muret ou une caisse.', n: n + ' F : ordres · E : remonter.' }; }
    if (T.canExit() && (P.landed || SIM.surface(P.x, P.z).strip)) return { ph: 'Rafale posé', t: 'Touche E (ou « Sortir du Rafale ») : votre commandant sort avec son escouade.', n: 'Choisissez l\'unité et les armes dans « Troupes au sol ».' };
    return null;
  }
  function autoTaxi() {
    if (P.heli) return toast('Pas de roulage pour l\'hélicoptère : montez avec W ou Z.');
    if (P.autoTaxi) return toast('Roulage automatique déjà en cours.');
    if (V.myBoard && V.myBoard.player === 'on' && !V.myBoard.fin) { V.wantAuto = true; return toast('Roulage automatique programmé : il démarrera à la fermeture des portes.', 4000); }
    if (!P.onGround || P.landed || P.V > 16 || SIM.surface(P.x, P.z).ap !== SIM.route.dep || Math.hypot(P.x - SIM.route.de.x, P.z - SIM.route.de.z) < 160) return toast('Roulage automatique : disponible au sol, avant le décollage, à l\'aéroport de départ.');
    if (!SIM.startTaxi('full')) return toast('Roulage automatique impossible ici.');
    V.awaitRwy = false; SIM.atc.st = 10; toast('Roulage automatique vers la piste ' + SIM.route.de.id + '…', 3500); V.setView('chase');
  }
  $('btnAutoTaxi').onclick = autoTaxi;
  $('rafSize').onchange = () => { SIM.war.size = $('rafSize').value; SIM.war.applySize(); toast('Taille des Rafale : ' + SIM.war.SIZES[SIM.war.size].name); };
  $('ammoN').onchange = () => { SIM.war.maxAmmo = +$('ammoN').value; SIM.war.ammo = SIM.war.maxAmmo; toast(SIM.war.maxAmmo + ' missiles à bord'); };
  $('rafPaint').onchange = () => { SIM.war.setPaint($('rafPaint').value); if (P.type === 'chasseur' && !P.heli) { V.rebuildPlayer($('myLiv').value, 'chasseur'); } SIM.war.applySize(); toast('Peinture : ' + $('rafPaint').selectedOptions[0].textContent); };
  $('btnStrip').onclick = () => SIM.war.goStrip();
  $('btnTruck').onclick = () => { if (SIM.troops.active) SIM.troops.enter(true); SIM.war.truckStart(); V.setView('chase'); };
  $('btnTruckStop').onclick = () => SIM.war.truckStop();
  $('unitSel').onchange = () => { SIM.troops.unit = $('unitSel').value; toast('Unité : ' + SIM.troops.UNITS[SIM.troops.unit].name + (SIM.troops.active ? ' (au prochain débarquement)' : '')); };
  $('squadN').onchange = () => { SIM.troops.squadN = +$('squadN').value; };
  $('wpnSel').onchange = () => { SIM.troops.weapon = $('wpnSel').value; if (SIM.troops.active) SIM.troops.setWeapon($('wpnSel').value); };
  $('btnExit').onclick = () => SIM.troops.exit(); $('btnEnter').onclick = () => SIM.troops.enter();
  $('btnOrder').onclick = () => { if (SIM.troops.active) SIM.troops.cycleOrder(); else toast('Sortez d\'abord du Rafale.'); };
  $('btnTakeNext').onclick = () => { if (SIM.troops.active) SIM.troops.takeNext(); else toast('Sortez d\'abord du Rafale.'); };
  $('btnTakeCmd').onclick = () => { if (SIM.troops.active) SIM.troops.takeCmd(); };
  SIM.troops.renderList();
  $('btnFoes').onclick = () => { SIM.troops.respawnFoes(); toast('Ennemis au sol réinitialisés.'); };
  { const fb = $('fbFire'); fb.addEventListener('pointerdown', e => { e.preventDefault(); SIM.troops.fireBtn(true); }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(k => fb.addEventListener(k, () => SIM.troops.fireBtn(false))); }
  $('fbAim').onclick = () => { SIM.troops.aiming = !SIM.troops.aiming; }; $('fbCrouch').onclick = () => { SIM.troops.crouch = !SIM.troops.crouch; };
  $('fbWpn').onclick = () => { const me = SIM.troops.me; if (!me) return; const L = SIM.troops.allowed(me.kind); SIM.troops.setWeapon(L[(L.indexOf(me.weapon) + 1) % L.length]); };
  $('fbLock').onclick = () => SIM.troops.toggleLock(); $('fbJump').onclick = () => SIM.troops.jump(); $('fbProne').onclick = () => SIM.troops.goProne(); $('fbRun').onclick = () => { SIM.troops.toggleSprint(); $('fbRun').classList.toggle('on', !!SIM.troops.sprint); }; $('fbTake').onclick = () => SIM.troops.takeNext(); $('fbCam').onclick = () => SIM.troops.toggleCam(); $('fbFace').onclick = () => SIM.troops.faceView(); $('fbOrder').onclick = () => SIM.troops.cycleOrder(); $('fbEnter').onclick = () => SIM.troops.enter();
  $('wingN').onchange = () => { SIM.war.wingN = +$('wingN').value; SIM.war.setWing(); toast(SIM.war.wingN ? SIM.war.wingN + ' Rafale alliés vous accompagnent' : 'Vous volez seul'); };
  $('btnRafale').onclick = () => { $('myType').value = 'chasseur'; rebuildMine(); };
  $('btnFront').onclick = () => SIM.war.goFront();
  $('btnFire').onclick = () => SIM.war.fire(); $('btnFlares').onclick = () => SIM.war.dropFlares(); $('btnTgt').onclick = () => SIM.war.nextTarget(); $('btnZone').onclick = () => SIM.war.respawn();
  $('btnBoard').onclick = () => { if (P.heli) return toast('Pas d\'embarquement pour l\'hélicoptère.'); if (!P.onGround) return toast('Posez-vous d\'abord.'); const m = SIM.park(true); if (m) toast(m); };

  // ---------- Panneau ----------
  const panel = $('panel');
  function togglePanel(force) {
    const hide = force != null ? force : !panel.classList.contains('hide');
    panel.classList.toggle('hide', hide); document.body.classList.toggle('panel-open', !hide);
    $('togglePanel').textContent = hide ? 'Afficher les commandes' : 'Masquer les commandes'; $('togglePanel').setAttribute('aria-expanded', String(!hide));
  }
  $('togglePanel').onclick = () => togglePanel();
  document.body.classList.add('panel-open');
  if (window.innerWidth < 760) togglePanel(true);
  $('ndMin').onclick = () => { $('nd').classList.toggle('mini'); $('ndMin').textContent = $('nd').classList.contains('mini') ? '▴' : '▾'; };
  $('ndMode').onclick = () => { V.ndMode = V.ndMode === 'ROSE' ? 'PLAN' : 'ROSE'; $('ndMode').textContent = V.ndMode === 'ROSE' ? 'PLAN' : 'ROSE'; $('ndTitle').textContent = 'RADAR · ' + V.ndMode; };
  $('ndRngDn').onclick = () => V.ndStep(-1); $('ndRngUp').onclick = () => V.ndStep(1);

  // ---------- Manette des gaz ----------
  const thr = $('thr'), DET = [[1, 'TOGA'], [0.9, 'FLX'], [0.8, 'CL'], [0, 'IDLE'], [-0.25, 'REV']], TMIN = -0.25;
  const yOf = p => (1 - (p - TMIN) / (1 - TMIN)) * 100;
  DET.forEach(([p, n]) => { const d = document.createElement('div'); d.className = 'det'; d.style.top = yOf(p) + '%'; d.textContent = n; thr.appendChild(d); });
  function setLever(p) {
    if (p >= 0.85) P.thrUser = p;
    for (const [dp] of DET) if (Math.abs(p - dp) < 0.03) p = dp;
    if (p < -0.02) { if (!P.onGround) { toast('Inverseurs disponibles seulement au sol.'); p = 0; } else { P.rev = true; P.revAmt = clamp(-p / 0.25, 0, 1); P.thr = 0; return; } }
    P.rev = false; P.thr = clamp(p, 0, 1);
    if (P.thr < 0.02 && P.ap.athr && !P.onGround) { P.ap.athr = false; toast('Auto-poussée déconnectée'); }
  }
  // levier d'aérofreins réglable (0 à 100 %) comme la manette des gaz
  const sbLev = $('sbLev');
  const sbFromEv = ev => { const r = sbLev.getBoundingClientRect(); let v = clamp((ev.clientY - r.top) / r.height, 0, 1); if (v < 0.04) v = 0; if (v > 0.96) v = 1; return Math.round(v * 20) / 20; };
  sbLev.addEventListener('pointerdown', ev => { sbLev.setPointerCapture(ev.pointerId); P.spoilSel = sbFromEv(ev); });
  sbLev.addEventListener('pointermove', ev => { if (sbLev.hasPointerCapture(ev.pointerId)) P.spoilSel = sbFromEv(ev); });
  $('sbArm').onclick = () => { P.spoilArm = !P.spoilArm; toast(P.spoilArm ? 'Aérofreins armés pour l\'atterrissage' : 'Aérofreins désarmés', 1300); };
  // marche arrière au bouton (maintenir)
  const back = $('btnBack'), backOn = on => { P.backHold = on; if (on && !P.onGround) toast('Marche arrière : seulement au sol.'); };
  back.addEventListener('pointerdown', ev => { back.setPointerCapture(ev.pointerId); backOn(true); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(e => back.addEventListener(e, () => backOn(false)));
  const leverFromEv = ev => { const r = thr.getBoundingClientRect(); return TMIN + (1 - clamp((ev.clientY - r.top) / r.height, 0, 1)) * (1 - TMIN); };
  thr.addEventListener('pointerdown', ev => { thr.setPointerCapture(ev.pointerId); setLever(leverFromEv(ev)); });
  thr.addEventListener('pointermove', ev => { if (thr.hasPointerCapture(ev.pointerId)) setLever(leverFromEv(ev)); });
  $('thrIdle').onclick = () => setLever(0); $('thrCl').onclick = () => setLever(0.8); $('thrFlx').onclick = () => setLever(0.9); $('thrToga').onclick = () => setLever(1);
  const turbo = () => { P.turbo = !P.turbo; if (P.turbo && P.thr < 0.8 && !P.rev) setLever(1); toast(P.turbo ? 'HYPERVITESSE activée : poussée ×5, jusqu\'à Mach 2 (touche O pour couper)' : 'Hypervitesse coupée'); V.say(P.turbo ? 'Hypervitesse' : 'Vitesse normale'); };
  $('btnTurbo').onclick = turbo;
  const sens = () => { P.sensitive = !P.sensitive; toast(P.sensitive ? 'Direction TRÈS SENSIBLE : roulis ×5, virages serrés, roulette de nez ×3 (Maj+D pour revenir)' : 'Direction normale'); };
  $('btnSens').onclick = sens;
  $('btnRev').onclick = () => { if (!P.onGround) return toast('Inverseurs disponibles seulement au sol.'); if (P.rev) { P.rev = false; } else { P.thr = 0; P.rev = true; P.revAmt = 1; } };
  ['eng1', 'eng2'].forEach((id, i) => $(id).onclick = () => { P.eng[i] = !P.eng[i]; toast('Moteur ' + (i + 1) + (P.eng[i] ? ' : démarrage…' : ' : coupé')); });
  $('trimUp').onclick = () => { P.trimPending = (P.trimPending || 0) + 0.5; };
  $('trimDn').onclick = () => { P.trimPending = (P.trimPending || 0) - 0.5; };
  $('trimZero').onclick = () => { P.trimPending = -P.gamma * R2D; toast('Mise en palier'); };

  // ---------- Levier MONTÉE (soulève l'avion) ----------
  const lift = $('lift');
  function setLift(v) {
    v = clamp(v, -1, 1); if (Math.abs(v) < 0.06) v = 0;
    if (P.ap.on) { Object.assign(P.ap, { on: false, full: false, srs: false, flare: false }); toast('Levier MONTÉE : pilote auto déconnecté'); }
    P.lift = v; P.liftOn = true; P.liftUser = v > 0.15 && !P.onGround;
  }
  const liftFromEv = ev => { const r = lift.getBoundingClientRect(); return 1 - clamp((ev.clientY - r.top) / r.height, 0, 1) * 2; };
  lift.addEventListener('pointerdown', ev => { lift.setPointerCapture(ev.pointerId); inp.liftDrag = true; setLift(liftFromEv(ev)); });
  ['pointerup', 'pointercancel'].forEach(e => lift.addEventListener(e, () => { inp.liftDrag = false; }));
  lift.addEventListener('pointermove', ev => { if (lift.hasPointerCapture(ev.pointerId)) setLift(liftFromEv(ev)); });
  lift.addEventListener('dblclick', () => setLift(0));
  $('liftOff').onclick = () => { P.liftOn = false; P.lift = 0; toast('Levier MONTÉE libéré : commande au mini-manche'); };
  // ---------- Petit levier des volets ----------
  const flev = $('flapLev');
  ['0', '1+F', '2', '3', 'FULL'].forEach((n, i) => { const d = document.createElement('div'); d.className = 'det'; d.style.top = (i / 4 * 100) + '%'; d.textContent = n; flev.appendChild(d); });
  const flapFromEv = ev => { const r = flev.getBoundingClientRect(); return Math.round(clamp((ev.clientY - r.top) / r.height, 0, 1) * 4); };
  flev.addEventListener('pointerdown', ev => { flev.setPointerCapture(ev.pointerId); setFlap(flapFromEv(ev)); });
  flev.addEventListener('pointermove', ev => { if (flev.hasPointerCapture(ev.pointerId)) { const f = flapFromEv(ev); if (f !== P.flapSel) setFlap(f); } });

  // ---------- Levier de secours (virage et montée rapides) ----------
  const emPad = $('emPad'), emKnob = $('emKnob'); let emOn = false;
  const emEv = ev => { const r = emPad.getBoundingClientRect(); P.emX = clamp((ev.clientX - r.left) / r.width * 2 - 1, -1, 1); P.emY = clamp(1 - (ev.clientY - r.top) / r.height * 2, -1, 1); if (Math.abs(P.emX) < 0.12) P.emX = 0; if (Math.abs(P.emY) < 0.12) P.emY = 0; };
  emPad.addEventListener('pointerdown', ev => { emPad.setPointerCapture(ev.pointerId); emOn = true; emEv(ev); if (P.ap.on) { Object.assign(P.ap, { on: false, full: false, srs: false, flare: false }); toast('Levier de secours : pilote auto déconnecté'); } P.liftOn = false; });
  emPad.addEventListener('pointermove', ev => { if (emOn) emEv(ev); });
  const emUp = () => { emOn = false; P.emX = 0; P.emY = 0; }; emPad.addEventListener('pointerup', emUp); emPad.addEventListener('pointercancel', emUp);
  // ---------- Menu Affichage (masquer radar, instruments, etc.) ----------
  const dispEls = { nd: ['nd'], pfd: ['pfd', 'fma'], ecam: ['ecam'], ils: [], radio: ['radio'], emerg: ['emerg'], card: ['fcard'], netnames: ['netLbls'], netchat: ['netChat'], tank: ['tankP'], sig: ['sigP'] };
  let dispPref = {}; try { dispPref = JSON.parse(localStorage.getItem('simDisp') || '{}'); } catch (e) { }
  function applyDisp() {
    $$('#dispMenu input[data-el]').forEach(cb => { const k = cb.dataset.el, on = dispPref[k] !== false; cb.checked = on; dispEls[k].forEach(id => { $(id).style.display = on ? '' : 'none'; }); if (k === 'ils') V.showILS = on; });
    try { localStorage.setItem('simDisp', JSON.stringify(dispPref)); } catch (e) { }
    $('qbTank').classList.toggle('on', dispPref.tank !== false); $('qbSig').classList.toggle('on', dispPref.sig !== false);
  }
  $$('#dispMenu input[data-el]').forEach(cb => cb.addEventListener('change', () => { dispPref[cb.dataset.el] = cb.checked; applyDisp(); }));
  // un bouton « masquer » propre à chaque élément (le menu Affichage permet de le réafficher)
  const names = { nd: 'le radar / GPS', pfd: 'les instruments', ecam: "l'écran moteurs", ils: 'le cadre ILS', radio: 'la radio', emerg: 'le levier de secours', card: 'la fiche de vol', netnames: 'les noms des joueurs', netchat: 'la discussion', tank: 'le réservoir', sig: 'les signaux de vol' };
  Object.entries({ nd: 'nd', pfd: 'pfd', ecam: 'ecam', ils: 'ils', radio: 'radio', emerg: 'emerg', card: 'fcard', netchat: 'netChat', tank: 'tankP', sig: 'sigP' }).forEach(([k, id]) => {
    const b = document.createElement('button'); b.className = 'hideX'; b.textContent = '✕'; b.title = 'Masquer ' + names[k] + ' (réafficher : menu Affichage)'; b.setAttribute('aria-label', b.title);
    b.addEventListener('click', ev => { ev.stopPropagation(); dispPref[k] = false; applyDisp(); toast(names[k].charAt(0).toUpperCase() + names[k].slice(1) + ' masqué — menu « Affichage » pour le réafficher'); });
    $(id).appendChild(b);
  });
  // boutons à l'écran : faire apparaître / disparaître le réservoir et les signaux
  $('qbTank').onclick = () => { dispPref.tank = dispPref.tank === false; applyDisp(); toast(dispPref.tank ? 'Réservoir affiché' : 'Réservoir masqué', 1500); };
  $('qbSig').onclick = () => { dispPref.sig = dispPref.sig === false; applyDisp(); toast(dispPref.sig ? 'Signaux de vol affichés' : 'Signaux de vol masqués', 1500); };
  $('dispBtn').onclick = () => { const m = $('dispMenu'); m.hidden = !m.hidden; $('dispBtn').setAttribute('aria-expanded', String(!m.hidden)); };
  $('dispAll').onclick = () => { const anyOn = Object.keys(dispEls).some(k => dispPref[k] !== false); Object.keys(dispEls).forEach(k => dispPref[k] = !anyOn); $('dispAll').textContent = anyOn ? 'Tout afficher' : 'Tout masquer'; applyDisp(); };
  applyDisp();
  // vue dégagée : tout ce qui gêne la vue disparaît, un petit bouton permet de tout réafficher
  let autoClear = true; try { autoClear = localStorage.getItem('simAutoClear') !== '0'; } catch (e) { }
  $('autoClear').checked = autoClear;
  $('autoClear').onchange = e => { autoClear = e.target.checked; try { localStorage.setItem('simAutoClear', autoClear ? '1' : '0'); } catch (er) { } };
  const setClear = on => { document.body.classList.toggle('clear', on); if (on) $('dispMenu').hidden = true; };
  $('clearBtn').onclick = () => setClear(true); $('clearOff').onclick = () => setClear(false);
  const origSetView = V.setView; V.setView = id => { origSetView(id); if (autoClear) setClear(V.inside()); };

  // ---------- Mini-manche ----------
  const stick = $('stick'), knob = $('stickKnob'), inp = { sx: 0, sy: 0, padActive: false, keys: {} };
  function padEv(ev) { const r = stick.getBoundingClientRect(); inp.sx = clamp((ev.clientX - r.left) / r.width * 2 - 1, -1, 1); inp.sy = clamp((ev.clientY - r.top) / r.height * 2 - 1, -1, 1); }
  stick.addEventListener('pointerdown', ev => { stick.setPointerCapture(ev.pointerId); inp.padActive = true; padEv(ev); });
  stick.addEventListener('pointermove', ev => { if (inp.padActive) padEv(ev); });
  const padUp = () => { inp.padActive = false; inp.sx = 0; inp.sy = 0; };
  stick.addEventListener('pointerup', padUp); stick.addEventListener('pointercancel', padUp);
  const rud = $('rudder'); rud.addEventListener('input', () => P.rudder = +rud.value);
  const rudUp = () => { rud.value = 0; P.rudder = 0; }; rud.addEventListener('pointerup', rudUp); rud.addEventListener('change', () => { if (!inp.rudHeld) rudUp(); });

  // ---------- Volets, train, aérofreins, freins, lumières ----------
  $$('.flap').forEach(b => b.onclick = () => setFlap(+b.dataset.f));
  function setFlap(f) { f = clamp(f, 0, 4); if (P.ias / SIM.KT > SIM.VFE[f] + 5 && f > P.flapSel) toast('Vitesse trop élevée pour ce cran de volets.'); P.flapSel = f; }
  $('btnGear').onclick = toggleGear; $('gearLev').onclick = toggleGear;
  function toggleGear() { if (P.onGround && P.belly) return toast('Train bloqué : l\'avion est posé sur le ventre.'); if (P.onGround && P.gearDown) return toast('Impossible de rentrer le train au sol.'); P.gearDown = !P.gearDown; V.say(P.gearDown ? 'Train sorti' : 'Train rentré'); }
  $$('.spd').forEach(b => b.onclick = () => P.spoilSel = +b.dataset.s);
  $('btnSpdArm').onclick = () => P.spoilArm = !P.spoilArm;
  $('btnPBrk').onclick = () => P.pbrk = !P.pbrk;
  { const eb = $('btnEBrake'); eb.addEventListener('pointerdown', () => { P.brakeMax = true; P.brake = true; }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(e => eb.addEventListener(e, () => { P.brakeMax = false; P.brake = false; })); }
  const br = $('btnBrake');
  br.addEventListener('pointerdown', () => P.brake = true); ['pointerup', 'pointerleave', 'pointercancel'].forEach(e => br.addEventListener(e, () => P.brake = false));
  $$('.abrk').forEach(b => b.onclick = () => P.autobrake = +b.dataset.a);
  // ---------- Changer d'avion ----------
  const AIRNAME = { saphir: 'Saphir', emeraude: 'Emeraude', rubis: 'Rubis', champagne: 'Champagne', nuit: 'Nuit Violette', corail: 'Corail', lagon: 'Lagon', graphite: 'Graphite', bordeaux: 'Bordeaux', azur: 'Azur', mangue: 'Mangue', lavande: 'Lavande', belge: 'Nuit Bleue', tricolore: 'Tricolore', constructeur: 'Demonstrator', lion: 'Lion Vert', sanaga: 'Air Sanaga', mungo: 'Air Mungo', kivu: 'Kivu Airways', sablon: 'Sablon Air', essai: 'Essais Constructeur', sahel: 'Sahel Air', kribi: 'Kribi Express', seine: 'Seine Airways', lagune: 'Lagune Air', atlas: 'Atlantic Star', prive: 'Jet Privé', armee: 'Force Aérienne' };
  function fillAcList() {
    const sel = $('acList'), cur = sel.value, ch = SIM.ai.choices().concat(SIM.life.choices().map(c => Object.assign(c, { d: Math.hypot(c.h.x - P.x, c.h.z - P.z) }))).sort((p, q) => p.d - q.d);
    sel.innerHTML = ''; if (!ch.length) { const o = document.createElement('option'); o.textContent = 'Aucun avion à proximité pour le moment'; o.value = ''; sel.appendChild(o); }
    ch.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = `${c.cs} — ${c.state}${c.ap ? ' (' + c.ap + ')' : ''} · ${c.d < 1000 ? Math.round(c.d) + ' m' : (c.d / 1000).toFixed(1) + ' km'}`; sel.appendChild(o); });
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
    $('acInfo').textContent = ch.length + ' appareil' + (ch.length > 1 ? 's' : '');
  }
  function takeOver(id) {
    fcCalls = {};
    if (String(id).startsWith('h')) {
      const h = SIM.life.take(id); if (!h) return toast('Cet hélicoptère n\'est plus disponible.');
      V.rebuildPlayer(h.kind, 'heli'); SIM.startHeli(h); V.clearFx(); V.trail = []; $('over').hidden = true;
      $('myType').value = 'heli-' + h.kind; SIM.atc.setCS(SIM.life.HNAME[h.kind] + ' 12'); SIM.atc.sayBrief('dep'); fillBrief();
      toast('Vous pilotez l\'hélicoptère ' + h.kind.toUpperCase() + '. Maintenez W ou Z pour monter, S pour descendre, relâchez = stationnaire. ↑ avancer, ← → tourner.', 6000); V.say('Hélicoptère, vous avez les commandes'); fillAcList(); return;
    }
    if (P.heli) P.heli = false;
    const ch = SIM.ai.choices().find(c => c.id === id), info = SIM.ai.take(id); if (!info) return toast('Cet avion n\'est plus disponible.'); info.state = ch ? ch.state : '';
    V.rebuildPlayer(info.liv, info.type); SIM.takeOver(info); V.clearFx(); V.trail = []; $('over').hidden = true;
    $('myLiv').value = info.liv; $('myType').value = info.type;
    toast('Vous pilotez maintenant ' + info.cs + ' (' + info.state + ')', 4500); V.say('Vous avez les commandes');
    SIM.radio('VOUS', `${info.cs}, je reprends les commandes.`, false, `${info.cs}, I have control.`); updRoute(); fillAcList();
  }
  $('btnTake').onclick = () => { const v = $('acList').value; if (v) takeOver(v.startsWith('h') ? v : +v); else toast('Choisissez un appareil dans la liste.'); };
  $('btnNearest').onclick = () => { const c = SIM.ai.choices()[0]; if (c) takeOver(c.id); else toast('Aucun avion à proximité.'); };
  const rebuildMine = () => {
    const ty = $('myType').value, wasHeli = P.heli;
    if (ty.startsWith('heli')) { const kind = ty.slice(5); if (V.myBoard) { SIM.life.removeBoarding(V.myBoard); V.myBoard = null; } V.rebuildPlayer(kind, 'heli'); SIM.startHeli({ a: SIM.route.dep }); SIM.atc.setCS(SIM.life.HNAME[kind] + ' 12'); V.clearFx(); $('over').hidden = true;
      toast('Hélicoptère prêt sur l\'héliport de ' + SIM.route.dep.city + '. Maintenez W ou Z pour monter, S pour descendre, relâchez = stationnaire. ↑ avancer, ↓ freiner, ← → tourner.', 8000); SIM.atc.sayBrief('dep'); fillBrief(); return; }
    let liv = $('myLiv').value; if (ty === 'militaire') { liv = 'armee'; $('myLiv').value = 'armee'; } if (ty === 'jet' && liv === 'sanaga') { liv = 'prive'; $('myLiv').value = 'prive'; }
    const fPct = P.fuelCap ? clamp((P.fuel || 0) / P.fuelCap, 0, 1) : 0.6;
    V.rebuildPlayer(liv, ty); if (wasHeli) doReset(false);
    P.fuelCap = SIM.tyx().cap; P.fuel = P.onGround ? SIM.planFuel(SIM.route.dist) : fPct * P.fuelCap;   // le réservoir change avec l'avion
    SIM.atc.setCS(ty === 'chasseur' ? 'Rafale 01' : ty === 'militaire' ? 'Force Aérienne 401' : AIRNAME[liv] + ' 241');
    const help = ty === 'chasseur' ? ' Gaz à fond (T) = postcombustion, rotation à 140 kt, W/S = montée/descente rapides. Combat : Entrée = missile, Y = cible, Retour ← = leurres, « Aller au front » dans le panneau Combat.' : '';
    toast('Votre appareil : ' + $('myType').selectedOptions[0].textContent + '.' + help, 7000); SIM.atc.sayBrief('dep'); fillBrief(); SIM.war.applySize(); };
  $('myLiv').onchange = rebuildMine; $('myType').onchange = rebuildMine;
  setInterval(() => { if (!panel.classList.contains('hide')) fillAcList(); }, 1500);
  $('btnLandCfg').onclick = () => { const m = SIM.landingConfig(); toast('Configuration : ' + m, 5000); V.say('Configuration atterrissage'); };
  $('btnAutoLand').onclick = () => { if (P.heli) return toast('Pour l\'hélicoptère : arrêtez-vous au-dessus du « H » et descendez avec S.'); const m = SIM.autoLand(); if (m) toast(m); else { toast('Atterrissage automatique engagé vers ' + SIM.route.dest.city, 4000); V.say('Atterrissage automatique'); } };
  $('btnLandAid').onclick = () => { P.landAid = !P.landAid; toast(P.landAid ? 'Aide à l\'arrondi et maintien d\'axe activés' : 'Aide à l\'atterrissage coupée'); };
  $('btnBrakeConst').onclick = () => { P.brakeConst = !P.brakeConst; toast(P.brakeConst ? 'Frein constant activé (agit au sol, gaz réduits)' : 'Frein constant coupé'); };
  $('brakeLvl').oninput = e => { P.brakeLevel = +e.target.value; };
  $$('.rel').forEach(b => b.onclick = () => { SIM.setRelief(+b.dataset.r); toast('Relief ' + b.textContent.toLowerCase()); });
  $('btnPeaks').onclick = () => { SIM.world.labelsOn = !SIM.world.labelsOn; };
  $$('.lt').forEach(b => b.onclick = () => { P.lights[b.dataset.l] = P.lights[b.dataset.l] ? 0 : 1; });

  // ---------- Pilote automatique (FCU) ----------
  const ap = P.ap;
  function hold(id, fn) { const b = $(id); let iv, to; const stop = () => { clearInterval(iv); clearTimeout(to); };
    b.addEventListener('pointerdown', () => { fn(); to = setTimeout(() => iv = setInterval(fn, 70), 380); }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(e => b.addEventListener(e, stop)); }
  hold('spdUp', () => { ap.spdMng = false; ap.spd = Math.min(350, ap.spd + 5); }); hold('spdDn', () => { ap.spdMng = false; ap.spd = Math.max(130, ap.spd - 5); });
  hold('hdgUp', () => { ap.hdg = (ap.hdg + 1) % 360; if (ap.on && !ap.full) ap.lat = 'HDG'; }); hold('hdgDn', () => { ap.hdg = (ap.hdg + 359) % 360; if (ap.on && !ap.full) ap.lat = 'HDG'; });
  hold('altUp', () => { ap.alt = Math.min(41000, ap.alt + 500); if (ap.vert !== 'VS') ap.vert = 'CLB'; }); hold('altDn', () => { ap.alt = Math.max(1000, ap.alt - 500); if (ap.vert !== 'VS') ap.vert = 'DES'; });
  hold('vsUp', () => { ap.vs = Math.min(6000, ap.vs + 100); }); hold('vsDn', () => { ap.vs = Math.max(-6000, ap.vs - 100); });
  $('spdMode').style.cursor = 'pointer'; $('spdMode').onclick = () => { ap.spdMng = !ap.spdMng; };
  function apToggle() {
    if (ap.on) { Object.assign(ap, { on: false, full: false, srs: false, flare: false }); toast('Pilote automatique déconnecté'); V.say('Pilote automatique déconnecté'); return; }
    if (P.onGround) return toast('Au sol, utilisez « Vol automatique complet » pour un décollage automatique.');
    ap.on = true; P.liftOn = false; ap.lat = ap.lat === 'NAV' || ap.lat === 'LOC' ? ap.lat : 'HDG'; if (ap.lat === 'HDG') ap.hdg = Math.round(P.psi * R2D) % 360;
    const vsf = P.vs / SIM.FT * 60; ap.vert = Math.abs(vsf) < 300 ? 'ALT' : 'VS'; if (ap.vert === 'ALT') ap.alt = Math.round(P.y / SIM.FT / 100) * 100; else ap.vs = Math.round(vsf / 100) * 100;
    toast('Pilote automatique engagé');
  }
  $('btnAP').onclick = apToggle;
  $('btnATHR').onclick = () => { ap.athr = !ap.athr; if (ap.athr && P.thr < 0.5) P.thr = 0.8; toast(ap.athr ? 'Auto-poussée active' : 'Auto-poussée déconnectée'); };
  $('btnNAV').onclick = () => { ap.lat = 'NAV'; if (!ap.on && !P.onGround) apToggle(); ap.lat = 'NAV'; };
  $('btnAPPR').onclick = () => { ap.appr = !ap.appr; if (ap.appr) { ap.lat = ap.loc ? 'LOC' : 'NAV'; toast('Approche armée : axe et glide seront capturés'); } else { ap.loc = false; ap.gs = false; } };
  $('btnHDG').onclick = () => { ap.lat = 'HDG'; ap.loc = false; };
  $('btnVS').onclick = () => { ap.vert = 'VS'; ap.gs = false; };
  $('btnALT').onclick = () => { ap.vert = 'ALT'; ap.alt = Math.round(P.y / SIM.FT / 100) * 100; ap.gs = false; };
  function fullToggle() {
    if (P.heli) return toast('Le vol automatique n\'existe pas pour l\'hélicoptère.');
    if (ap.full) { Object.assign(ap, { full: false, on: false, srs: false }); toast('Vol automatique désactivé'); return; }
    if (P.parked) return toast('Choisissez un nouveau vol d\'abord.');
    if (P.onGround && P.landed) return toast('Avion déjà posé : « Garer au poste ».');
    SIM.engageFull(true); P.liftOn = false; P.lights.landing = 1; P.lights.strobe = 1;
    toast(P.onGround ? 'Décollage automatique : poussée TOGA' : 'Vol automatique jusqu\'à l\'atterrissage'); V.say(P.onGround ? 'Décollage automatique' : 'Vol automatique');
  }
  $('btnFull').onclick = fullToggle;
  $('chkAssist').onchange = e => ap.assist = e.target.checked;
  { let mc = true; try { mc = localStorage.getItem('simManual') !== '0'; } catch (e) { } P.manualCtl = mc; $('manualCtl').checked = mc;
    $('manualCtl').onchange = e => { P.manualCtl = e.target.checked; try { localStorage.setItem('simManual', P.manualCtl ? '1' : '0'); } catch (er) { } toast(P.manualCtl ? 'Vous seul commandez le train, les gaz et les volets.' : 'L\'aide peut de nouveau sortir le train, régler les gaz et les volets.'); }; }

  // ---------- Environnement ----------
  const tod = $('tod');
  function setHour(h) { tod.value = h; SIM.setHour(h); const hh = Math.floor(h) % 24, mm = Math.round((h % 1) * 60) % 60; $('todVal').textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); }
  tod.addEventListener('input', () => setHour(+tod.value));
  $$('.todp').forEach(b => b.onclick = () => setHour(+b.dataset.h));
  $$('.cld').forEach(b => b.onclick = () => SIM.setClouds(+b.dataset.c));
  const setWx = w => { SIM.setWeather(w); toast('Météo : ' + SIM.WX[w].n + (w >= 2 ? ' — piste mouillée, freinage réduit' : '')); };
  $$('.wx').forEach(b => b.onclick = () => setWx(+b.dataset.w));
  SIM.onThunder = () => V.thunder();
  $('btnBirds').onclick = () => SIM.world.birdsOn = SIM.world.birdsOn === false;
  $('btnSound').onclick = () => { const on = V.toggleSound(); try { localStorage.setItem('simSound', on ? '1' : '0'); } catch (e) { } toast(on ? 'Son activé (Maj+S pour couper)' : 'Son coupé (Maj+S pour remettre)'); };
  // le son démarre tout seul au premier clic ou à la première touche (les navigateurs l'exigent), sauf si vous l'avez coupé
  const autoSound = ev => {
    window.removeEventListener('pointerdown', autoSound, true); window.removeEventListener('keydown', autoSound, true);
    let pref = '1'; try { pref = localStorage.getItem('simSound') || '1'; } catch (e) { }
    if (pref === '0' || V.audio) return;
    if (ev.target && ev.target.id === 'btnSound') return;
    if (ev.type === 'keydown' && ev.shiftKey && ev.key.toLowerCase() === 's') return;
    V.toggleSound();
  };
  window.addEventListener('pointerdown', autoSound, true); window.addEventListener('keydown', autoSound, true);
  $$('.tacc').forEach(b => b.onclick = () => { SIM.timeScale = +b.dataset.x; });
  $('viewGrid').addEventListener('click', ev => { const b = ev.target.closest('.vw'); if (b) V.setView(b.dataset.v); });

  // ---------- Glisser / zoom sur la vue ----------
  const gl = $('gl'), ptrs = new Map(); let pinch = 0;
  gl.addEventListener('pointerdown', ev => {
    gl.setPointerCapture(ev.pointerId); ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]);
  });
  // à pied (souris) : clic gauche = tirer, clic droit maintenu = cadrer l'ennemi (chaque bouton est suivi séparément)
  gl.addEventListener('mousedown', ev => { if (!SIM.troops.active) return; if (ev.button === 0) SIM.troops.fireBtn(true); else if (ev.button === 2) SIM.troops.lockHold(true); });
  window.addEventListener('mouseup', ev => { if (!SIM.troops.active) return; if (ev.button === 0) SIM.troops.fireBtn(false); else if (ev.button === 2) SIM.troops.lockHold(false); });
  gl.addEventListener('contextmenu', ev => { if (SIM.troops.active) ev.preventDefault(); });
  gl.addEventListener('pointermove', ev => {
    if (!ptrs.has(ev.pointerId)) return; const [x0, y0] = ptrs.get(ev.pointerId); ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) V.orb.zoom = clamp(V.orb.zoom * pinch / d, 0.25, 8); pinch = d; return; }
    V.orb.yaw -= (ev.clientX - x0) * 0.006; V.orb.pitch = clamp(V.orb.pitch + (ev.clientY - y0) * 0.004, -1.2, 1.3);
  });
  const pu = ev => { ptrs.delete(ev.pointerId); pinch = 0; }; gl.addEventListener('pointerup', pu); gl.addEventListener('pointercancel', pu);
  gl.addEventListener('wheel', ev => { ev.preventDefault(); V.orb.zoom = clamp(V.orb.zoom * (ev.deltaY > 0 ? 1.1 : 0.9), 0.25, 8); }, { passive: false });
  gl.addEventListener('dblclick', () => { V.orb.yaw = 0; V.orb.pitch = 0; V.orb.zoom = 1; });

  // ---------- Clavier ----------
  // Un menu déroulant, un curseur ou un bouton cliqué gardait le clavier : les flèches ou la lettre H
  // changeaient alors l'avion choisi au lieu de piloter. Désormais le simulateur reprend toujours le clavier.
  const giveBack = el => { if (el && el.blur && el !== document.body) el.blur(); };
  $$('select').forEach(sl => sl.addEventListener('change', () => setTimeout(() => giveBack(sl), 0)));
  $$('button, input[type=range], input[type=checkbox]').forEach(el => el.addEventListener('pointerup', () => setTimeout(() => giveBack(el), 0)));
  const DIG = { Digit2: '2', Digit4: '4', Digit6: '6', Digit8: '8', Numpad2: '2', Numpad4: '4', Numpad6: '6', Numpad8: '8' };
  const emKeys = new Set();
  window.addEventListener('keydown', ev => {
    const tg = ev.target, tag = tg && tg.tagName;
    if (tag === 'TEXTAREA' || (tag === 'INPUT' && !['range', 'checkbox', 'button', 'radio'].includes(tg.type))) return;
    if (tag === 'SELECT' || tag === 'BUTTON' || tag === 'INPUT') { if (ev.key === 'Tab') return; ev.preventDefault(); giveBack(tg); }
    if ((ev.key === 'Alt' || ev.code === 'AltLeft') && !SIM.troops.active && !SIM.war.truckMode) {
      ev.preventDefault(); if (!ev.repeat) { P.backHold = true; if (P.onGround) toast(P.V > 1 ? 'Marche arrière : arrêtez d\'abord l\'avion (B).' : 'Marche arrière… (relâchez Alt pour arrêter)', 1600); else toast('Marche arrière : seulement au sol.', 1400); }
      return;
    }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    // à pied ou dans le camion : toutes les touches vont au personnage / au camion (H garde le panneau)
    if (SIM.troops.active || SIM.war.truckMode) {
      const lk0 = ev.key.toLowerCase();
      if (lk0 === 'h' && !ev.repeat) { togglePanel(); return; }
      if ([' ', 'enter', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'backspace', 'tab'].includes(lk0) || /^(Digit|Numpad)\d$/.test(ev.code)) ev.preventDefault();
      if (SIM.troops.active) SIM.troops.key(lk0, ev, true); else SIM.war.truckKey(lk0, ev, true);
      return;
    }
    // ---------- Toutes les commandes du panneau au clavier ----------
    // chiffres (rangée du haut ou pavé numérique) : réglages du pilote automatique ; Maj + chiffre : moteurs, trim, embarquement
    const dg = (/^(?:Digit|Numpad)(\d)$/.exec(ev.code) || [])[1];
    if (dg !== undefined && (ev.shiftKey || !DIG[ev.code])) {
      const tip = m => toast(m, 1100); ev.preventDefault();
      if (!ev.shiftKey) {
        if (dg === '1') { ap.hdg = (ap.hdg + 350) % 360; if (ap.on && !ap.full) ap.lat = 'HDG'; tip('Cap sélectionné : ' + String(ap.hdg).padStart(3, '0') + '°'); }
        else if (dg === '3') { ap.hdg = (ap.hdg + 10) % 360; if (ap.on && !ap.full) ap.lat = 'HDG'; tip('Cap sélectionné : ' + String(ap.hdg).padStart(3, '0') + '°'); }
        else if (dg === '7') { ap.spdMng = false; ap.spd = Math.max(130, ap.spd - 5); tip('Vitesse sélectionnée : ' + ap.spd + ' kt'); }
        else if (dg === '9') { ap.spdMng = false; ap.spd = Math.min(350, ap.spd + 5); tip('Vitesse sélectionnée : ' + ap.spd + ' kt'); }
        else if (dg === '5') { ap.alt = Math.max(1000, ap.alt - 1000); if (ap.vert !== 'VS') ap.vert = 'DES'; tip('Altitude sélectionnée : ' + ap.alt + ' ft'); }
        else if (dg === '0') { ap.alt = Math.min(41000, ap.alt + 1000); if (ap.vert !== 'VS') ap.vert = 'CLB'; tip('Altitude sélectionnée : ' + ap.alt + ' ft'); }
        return;
      }
      if (ev.repeat && !['3', '4', '5', '7'].includes(dg)) return;
      switch (dg) {
        case '1': $('eng1').onclick(); break;
        case '2': $('eng2').onclick(); break;
        case '3': ap.vs = Math.max(-6000, ap.vs - 100); tip('Vitesse verticale sélectionnée : ' + ap.vs + ' ft/min'); break;
        case '4': ap.vs = Math.min(6000, ap.vs + 100); tip('Vitesse verticale sélectionnée : ' + ap.vs + ' ft/min'); break;
        case '5': $('trimDn').onclick(); tip('Trim : piquer'); break;
        case '6': $('trimZero').onclick(); break;
        case '7': $('trimUp').onclick(); tip('Trim : cabrer'); break;
        case '8': $('btnBoard').onclick(); break;
        case '9': if (V.myBoard) { $('btnSkipBoard').onclick(); toast('Portes fermées'); } else toast('Pas d\'embarquement en cours.'); break;
        case '0': $('btnReset').onclick(); break;
      }
      return;
    }
    const lkS = ev.key.toLowerCase();
    // < et > : accélération du temps · , et ; : échelle du radar · : noms des sommets
    if ((ev.key === '<' || ev.key === '>' || ev.code === 'NumpadDivide' || ev.code === 'NumpadMultiply') && !ev.repeat) {
      const X = [1, 2, 4, 8, 16, 32], i = Math.max(0, X.indexOf(SIM.timeScale)), up = ev.key === '>' || ev.code === 'NumpadMultiply';
      SIM.timeScale = X[clamp(i + (up ? 1 : -1), 0, X.length - 1)]; toast('Accélération du temps : ×' + SIM.timeScale, 1200); return;
    }
    if (ev.key === ',' && !ev.shiftKey) { V.ndStep(-1); return; }
    if (ev.key === ';' && !ev.shiftKey) { V.ndStep(1); return; }
    if (ev.key === ':' && !ev.repeat) { $('btnPeaks').onclick(); toast(SIM.world.labelsOn ? 'Noms des sommets affichés' : 'Noms des sommets masqués', 1200); return; }
    const SHIFT = {
      s: () => $('btnSound').onclick(),
      r: () => { $('radioMute').onclick(); toast(radioVoice ? 'Voix radio activée' : 'Voix radio coupée', 1300); },
      t: () => $('btnATHR').onclick(),
      n: () => { $('btnNAV').onclick(); toast('Pilote auto : navigation (NAV)', 1300); },
      p: () => $('btnAPPR').onclick(),
      h: () => { $('btnHDG').onclick(); toast('Pilote auto : cap sélectionné (CAP SÉL.)', 1300); },
      w: () => { $('btnVS').onclick(); toast('Pilote auto : vitesse verticale (V/S)', 1300); },
      z: () => { $('btnVS').onclick(); toast('Pilote auto : vitesse verticale (V/S)', 1300); },
      l: () => { $('btnALT').onclick(); toast('Pilote auto : maintien d\'altitude (ALT)', 1300); },
      i: () => { $('thrIdle').onclick(); toast('Manette : ralenti (IDLE)', 1100); },
      c: () => { $('thrCl').onclick(); toast('Manette : montée (CL)', 1100); },
      x: () => { $('thrFlx').onclick(); toast('Manette : décollage réduit (FLX)', 1100); },
      g: () => { $('btnSpdArm').onclick(); toast(P.spoilArm ? 'Aérofreins armés pour l\'atterrissage' : 'Aérofreins désarmés', 1300); },
      k: () => $('btnLandAid').onclick(),
      j: () => $('btnBriefDep').onclick(),
      m: () => $('btnBriefApp').onclick(),
      o: () => $('btnPark').onclick(),
      u: () => { $('ndMode').onclick(); toast('Radar : mode ' + V.ndMode, 1100); },
      y: () => $('liftOff').onclick(),
      e: () => $('btnFuel').onclick(),
      ' ': () => { P.spoilSel = P.spoilSel >= 0.99 ? 0 : Math.min(1, Math.round((P.spoilSel + 0.25) * 4) / 4); toast('Aérofreins : ' + Math.round(P.spoilSel * 100) + ' %', 1000); },
    };
    if (ev.key === 'Delete' && !ev.repeat) { ev.preventDefault(); if (ev.shiftKey) $('btnRepair').onclick(); else $('btnFail').onclick(); return; }
    if (ev.shiftKey && SHIFT[lkS]) { ev.preventDefault(); if (!ev.repeat) SHIFT[lkS](); return; }
    // E : sortir du Rafale quand il est posé et arrêté
    if (ev.key.toLowerCase() === 'e' && !ev.repeat && !ev.shiftKey && SIM.troops.canExit()) { SIM.troops.exit(); return; }
    // levier de secours : chiffres 4 6 8 2 (rangée du haut, même en AZERTY, ou pavé numérique)
    if (DIG[ev.code]) { ev.preventDefault(); emKeys.add(DIG[ev.code]); return; }
    const k = ev.key, lk = k.toLowerCase(); inp.keys[lk] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'PageUp', 'PageDown', 'Enter', 'Backspace'].includes(k)) ev.preventDefault();
    const rep = ['+', '=', '-', 'pageup', 'pagedown', 'w', 'z', 's'].includes(lk);
    if (ev.repeat && !rep) return;
    switch (lk) {
      case '+': case '=': case 'pageup': setLever(Math.min(1, (P.rev ? 0 : P.thr) + 0.05)); break;
      case '-': case 'pagedown': setLever(Math.max(0, P.thr - 0.05)); break;
      case 't': setLever(1); break;
      case 'r': $('btnRev').onclick(); break;
      case 'f': setFlap(P.flapSel + (ev.shiftKey ? -1 : 1)); break;
      case 'g': toggleGear(); break;
      case ' ': P.spoilSel = P.spoilSel > 0 ? 0 : 1; toast(P.spoilSel ? 'Aérofreins sortis' : 'Aérofreins rentrés', 1200); break;
      case 'b': P.brake = true; if (ev.shiftKey) { P.brakeMax = true; toast('FREIN D\'URGENCE !', 1200); } break;
      case 'p': P.pbrk = !P.pbrk; toast(P.pbrk ? 'Frein de parc serré' : 'Frein de parc relâché', 1400); break;
      case 'a': if (ev.shiftKey) fullToggle(); else apToggle(); break;
      case 'l': P.lights.landing = P.lights.landing ? 0 : 1; break;
      case 'n': setHour(SIM.world.night > 0.5 ? 9 : 22); break;
      case 'v': { const i = V.VIEWS.findIndex(v => v[0] === V.view); V.setView(V.VIEWS[(i + (ev.shiftKey ? V.VIEWS.length - 1 : 1)) % V.VIEWS.length][0]); toast('Vue : ' + (V.VIEWS.find(v => v[0] === V.view) || [, ''])[1], 1200); break; }
      case 'h': togglePanel(); break;
      case 'c': setClear(!document.body.classList.contains('clear')); break;
      case 'u': dispPref.nd = dispPref.nd === false; applyDisp(); break;
      case 'o': turbo(); break;
      case 'd': if (ev.shiftKey) sens(); break;                  // D seul = palonnier droit (voir readInputs)
      case 'i': autoTaxi(); break;
      case 'enter': SIM.war.fire(); break;
      case 'backspace': ev.preventDefault(); SIM.war.dropFlares(); break;
      case 'y': SIM.war.nextTarget(); break;
      case 'k': $('btnLandCfg').onclick(); break;
      case 'x': $('btnAutoLand').onclick(); break;
      case 'j': $('btnBrakeConst').onclick(); break;
      case 'm': setWx((SIM.world.weather + 1) % 4); break;
      case 'w': case 'z': if (!P.heli) setLift((P.liftOn ? P.lift : 0) + 0.1); break;
      case 's': if (!P.heli) setLift((P.liftOn ? P.lift : 0) - 0.1); break;
    }
  });
  window.addEventListener('keyup', ev => {
    if (SIM.troops.active) SIM.troops.key(ev.key.toLowerCase(), ev, false);
    if (SIM.war.truckMode) SIM.war.truckKey(ev.key.toLowerCase(), ev, false);
    if (DIG[ev.code]) { emKeys.delete(DIG[ev.code]); return; }
    if (ev.key === 'Alt' || ev.code === 'AltLeft') { ev.preventDefault(); P.backHold = false; }
    inp.keys[ev.key.toLowerCase()] = false; if (ev.key.toLowerCase() === 'b') { P.brake = false; P.brakeMax = false; }
  });
  window.addEventListener('blur', () => { P.backHold = false; inp.keys = {}; emKeys.clear(); P.brake = false; P.brakeMax = false; SIM.troops.keys = {}; SIM.troops.fireHeld = false; SIM.war.tk = {}; });

  function readInputs(dt) {
    if (SIM.troops.active || SIM.war.truckMode) { P.stickX = P.stickY = 0; P.rudder = 0; return; }
    const K = inp.keys;
    let ty = inp.padActive ? inp.sy : (K['arrowdown'] ? 1 : 0) - (K['arrowup'] ? 1 : 0);
    let tx = inp.padActive ? inp.sx : (K['arrowright'] ? 1 : 0) - (K['arrowleft'] ? 1 : 0);
    const r = Math.min(1, dt * (P.sensitive ? 16 : 6));
    P.stickY += (ty - P.stickY) * r; P.stickX += (tx - P.stickX) * r;
    const rR = (K['e'] || K['d']) && !K['shift'], rL = K['q'] && !K['shift'];
    if (rR || rL) { inp.rudHeld = true; P.rudder += (((rR ? 1 : 0) - (rL ? 1 : 0)) - P.rudder) * r; rud.value = P.rudder; }
    else if (inp.rudHeld) { inp.rudHeld = false; rudUp(); }
    if (ap.on && (Math.abs(ty) > 0.5 || Math.abs(tx) > 0.5)) { Object.assign(ap, { on: false, full: false, srs: false, flare: false }); toast('Reprise en manuel : pilote auto déconnecté'); V.say('Pilote automatique déconnecté'); }
    // hélicoptère : collectif tenu (W ou Z = monter, S = descendre, relâché = stationnaire)
    if (P.heli && !inp.liftDrag) { const up = K['w'] || K['z'], dn = K['s']; P.liftOn = true; P.lift += (((up ? 1 : 0) - (dn ? 1 : 0)) - P.lift) * Math.min(1, dt * 5); if (!up && !dn && Math.abs(P.lift) < 0.02) P.lift = 0; }
    if (!emOn) { const ex = (emKeys.has('6') ? 1 : 0) - (emKeys.has('4') ? 1 : 0), ey = (emKeys.has('8') ? 1 : 0) - (emKeys.has('2') ? 1 : 0); if (ex || ey || P.emKey) { P.emX = ex; P.emY = ey; P.emKey = !!(ex || ey); if (P.emKey && P.ap.on) { Object.assign(P.ap, { on: false, full: false, srs: false, flare: false }); toast('Levier de secours : pilote auto déconnecté'); } } }
    knob.style.left = (50 + P.stickX * 42) + '%'; knob.style.top = (50 + P.stickY * 42) + '%';
    emKnob.style.left = (50 + (P.emX || 0) * 40) + '%'; emKnob.style.top = (50 - (P.emY || 0) * 40) + '%';
  }

  // ---------- État du panneau ----------
  const mark = (sel, fn) => $$(sel).forEach(b => b.classList.toggle('on', !!fn(b)));
  function refreshPanel() {
    mark('.flap', b => +b.dataset.f === P.flapSel); $('flapInd').textContent = SIM.FLAPNAME[P.flapSel] + (Math.abs(P.flapPos - P.flapSel / 4) > 0.01 ? ' (en mouvement)' : '');
    const gb = $('btnGear'); gb.classList.toggle('on', P.gearDown); gb.textContent = P.gearDown ? 'TRAIN SORTI · rentrer (G)' : 'TRAIN RENTRÉ · sortir (G)';
    $('gearKnob').style.top = P.gearDown ? 'calc(100% - 36px)' : '36px'; mark('.wx', b => +b.dataset.w === SIM.world.weather);
    const gs = P.gearPos > 0.99 ? 'dn' : P.gearPos < 0.01 ? '' : 'tr'; $('glA').className = gs; ['gl0', 'gl1', 'gl2'].forEach(id => $(id).className = gs);
    mark('.spd', b => Math.abs(+b.dataset.s - P.spoilSel) < 0.13); $('btnSpdArm').classList.toggle('on', P.spoilArm);
    $('btnPBrk').classList.toggle('on', P.pbrk); $('btnBrake').classList.toggle('on', P.brake);
    mark('.abrk', b => +b.dataset.a === P.autobrake); mark('.lt', b => P.lights[b.dataset.l]);
    $('btnRev').classList.toggle('on', P.rev); $('eng1').classList.toggle('on', P.eng[0]); $('eng2').classList.toggle('on', P.eng[1]);
    $('btnAP').classList.toggle('on', ap.on); $('btnATHR').classList.toggle('on', ap.athr); $('btnNAV').classList.toggle('on', ap.on && (ap.lat === 'NAV' || ap.lat === 'LOC'));
    $('btnAPPR').classList.toggle('on', ap.appr); $('btnHDG').classList.toggle('on', ap.on && ap.lat === 'HDG'); $('btnVS').classList.toggle('on', ap.on && ap.vert === 'VS'); $('btnALT').classList.toggle('on', ap.on && ap.vert === 'ALT');
    $('btnFull').classList.toggle('on', ap.full); $('btnSkipBoard').hidden = !(V.myBoard && V.myBoard.player === 'on' && !V.myBoard.fin); $('btnTurbo').classList.toggle('on', !!P.turbo); $('btnSens').classList.toggle('on', !!P.sensitive);
    $('btnBrakeConst').classList.toggle('on', P.brakeConst); $('btnLandAid').classList.toggle('on', P.landAid); $('brkLvlO').textContent = Math.round(P.brakeLevel * 100) + ' %';
    $('btnAutoLand').classList.toggle('on', ap.full && SIM.route.active >= 1 && ap.desc);
    mark('.rel', b => +b.dataset.r === SIM.getRelief()); $('btnPeaks').classList.toggle('on', SIM.world.labelsOn);
    { const il = SIM.ils(); $('landInfo').textContent = il.along > 0 ? (il.along / 1000).toFixed(1) + ' km du seuil ' + SIM.route.ae.id : ''; }
    $('spdVal').textContent = ap.spd; $('spdMode').textContent = ap.spdMng ? 'GÉRÉE ●' : 'SÉLECT.'; $('hdgVal').textContent = String(ap.hdg).padStart(3, '0');
    $('altVal').textContent = ap.alt; $('vsVal').textContent = (ap.vs > 0 ? '+' : '') + ap.vs;
    $('apInfo').textContent = ap.full ? 'VOL GÉRÉ' : ap.on ? 'AP ENGAGÉ' : 'FCU';
    mark('.cld', b => +b.dataset.c === SIM.world.cloudLevel); mark('.tacc', b => +b.dataset.x === SIM.timeScale);
    $('btnBirds').classList.toggle('on', SIM.world.birdsOn !== false); $('btnSound').classList.toggle('on', !!V.audio);
    mark('.vw', b => b.dataset.v === V.view); $('viewName').textContent = (V.VIEWS.find(v => v[0] === V.view) || [, ''])[1];
    const lh = $('liftHandle'), fk = P.type === 'chasseur' && !P.heli, lg = P.lift >= 0 ? P.lift * (fk ? 50 : 15) : P.lift * (fk ? 45 : 10);
    lh.style.top = ((1 - (P.lift + 1) / 2) * 100) + '%'; lh.className = P.liftOn ? '' : 'off';
    lh.textContent = P.liftOn ? (Math.abs(lg) < 0.5 ? 'PALIER' : (lg > 0 ? '+' : '') + lg.toFixed(0) + '°') : 'OFF';
    const fh = $('flapHandle'); fh.style.top = (P.flapSel / 4 * 100) + '%'; fh.textContent = SIM.FLAPNAME[P.flapSel];
    const h = $('thrHandle'), lv = P.rev ? -0.25 * (P.revAmt == null ? 1 : P.revAmt) : P.thr;
    h.style.top = ((1 - (lv - TMIN) / (1 - TMIN)) * 100) + '%';
    const sh = $('sbHandle'); sh.style.top = (P.spoilSel * 100) + '%'; sh.textContent = P.spoilSel > 0 ? Math.round(P.spoilSel * 100) + ' %' : (P.spoilArm ? 'ARM' : '0 %'); $('sbArm').classList.toggle('on', P.spoilArm);
    h.textContent = P.rev ? 'REV' : P.thr >= 0.99 ? 'TOGA' : Math.abs(P.thr - 0.9) < 0.01 ? 'FLX' : Math.abs(P.thr - 0.8) < 0.01 ? 'CL' : P.thr < 0.01 ? 'IDLE' : Math.round(P.thr * 100) + '%';
  }


  // ---------- Fiche de vol : altitude de croisière, vitesses d'atterrissage avec marge, annonces radio ----------
  const fcard = $('fcard'), fcBody = $('fcBody');
  if (window.innerWidth < 760) { fcard.classList.add('mini'); $('fcMin').textContent = '▸'; }
  SIM.updateCard = () => updateCard();
  $('fcMin').onclick = () => { fcard.classList.toggle('mini'); $('fcMin').textContent = fcard.classList.contains('mini') ? '▸' : '▾'; };
  const km1 = m => (m / 1000).toFixed(1).replace('.', ',');
  const ftf = f => Math.round(f).toLocaleString('fr-FR');
  function cardData() {
    const R = SIM.route, pf = SIM.perf(), FT = SIM.FT, KT = SIM.KT;
    if (P.heli) return { ph: 'Hélicoptère', rows: [['Croisière', '300 à 450 m (1 000–1 500 ft)'], ['Vitesse croisière', '130 kt (max 150)'], ['Approche', '< 40 kt à 1 km du H'], ['Toucher', '< 500 ft/min, < 10 kt'], ['Votre altitude', km1(P.agl) + ' km sol']] };
    const cruiseFt = Math.min(R.cruise, pf.ceil || 39000), cruiseM = cruiseFt * FT, altFt = P.y / FT, ias = P.ias / KT;
    const vapp = pf.vapp, vls = Math.round(vapp * 0.93), tgt = SIM.landSpd(), vmax = Math.max(vapp + 15, 175);
    const tdNm = ((cruiseM - R.dest.elev) / Math.tan(3 * SIM.D2R)) / 1852 + 10, tdKm = tdNm * 1.852, rem = SIM.routeRemaining() / 1000;
    const climbLeft = cruiseM - P.y, fpm = Math.round(vapp * 5.3 / 50) * 50;
    const rows = [], cls = {};
    rows.push(['Croisière', `${km1(cruiseM)} km · FL${Math.round(cruiseFt / 100)} (${ftf(cruiseFt)} ft)`]);
    let ph;
    if (P.onGround && !P.landed) ph = 'Au sol';
    else if (P.onGround) ph = 'Posé';
    else if (rem < 60 && !P.onGround) ph = 'Approche';
    else if (climbLeft > 150 && rem > tdKm) ph = 'Montée';
    else if (rem <= tdKm) ph = 'Descente';
    else ph = 'Croisière';
    if (ph === 'Montée' || ph === 'Au sol') rows.push(['À monter', climbLeft > 0 ? `encore ${km1(climbLeft)} km` : 'atteinte ✓']);
    else if (ph === 'Croisière') { rows.push(['Palier', Math.abs(P.y - cruiseM) < 150 ? 'altitude de croisière tenue ✓' : `ajustez de ${km1(cruiseM - P.y)} km`]); cls[rows.length - 1] = Math.abs(P.y - cruiseM) < 150 ? 'ok' : 'warn'; }
    rows.push(['bar', Math.round(Math.max(0, Math.min(1, P.y / Math.max(cruiseM, 1))) * 100)]);
    rows.push(['Vitesse croisière', `Mach ${pf.mach} (≈ ${Math.round(pf.mach * 573)} kt)`]);
    rows.push(['Début descente', `à ${Math.round(tdKm)} km de l'arrivée`]);
    rows.push(['Reste', `${Math.round(rem)} km → ${R.dest.city}`]);
    if (V.finalDest) { rows.push(['Escale', `${R.dest.city}, puis ${(SIM.AIRPORTS.find(a => a.id === V.finalDest) || {}).city}`]); cls[rows.length - 1] = 'ok'; }
    // carburant : quantité, autonomie, suffisant ou non pour finir l'étape
    const ffh = Math.max(P.ff || 0, 0.05), endur = P.fuel / ffh / 60, need = Math.max(0, SIM.fuelNeed(rem * 1000) - SIM.fuelNeed(0) * 0.55);
    const fuelOk = P.fuel >= need, pct = Math.round(P.fuel / Math.max(P.fuelCap || 1, 1) * 100);
    rows.push(['Carburant', `${(P.fuel / 1000).toFixed(1)} t (${pct} %)` + (P.onGround ? '' : ` · autonomie ${endur > 600 ? '+10 h' : Math.round(endur) + ' min'}`)]); cls[rows.length - 1] = P.fuel <= 0 ? 'bad' : fuelOk ? 'ok' : 'warn';
    if (!fuelOk) { rows.push(['Attention', P.onGround ? 'pas assez pour ce vol : choisissez une ESCALE (panneau Vol)' : 'carburant juste : posez-vous pour refaire le plein']); cls[rows.length - 1] = 'bad'; }
    if (P.dmg && (P.dmg[0] > 0.01 || P.dmg[1] > 0.01)) { rows.push(['Réacteurs', P.dmg.map((d, i) => `M${i + 1} ${d >= 1 ? 'ARRÊTÉ' : d > 0.01 ? 'fume ' + Math.round(d * 100) + ' %' : 'OK'}`).join(' · ')]); cls[rows.length - 1] = 'bad'; }
    rows.push(['Atterrissage parfait', `visez ${tgt} kt (jusqu'à ${Math.max(tgt, 170)} kt)`]); cls[rows.length - 1] = 'ok';
    rows.push(['Vitesse min / max', `${vls} kt / ${vmax} kt`]);
    rows.push(['Configuration', 'train 600 m · volets FULL']);
    rows.push(['Pente finale', `3° · ≈ ${fpm} ft/min`]);
    rows.push(['Toucher', '< 300 ft/min · ailes à plat']);
    if (!P.onGround && (ph === 'Approche' || ph === 'Descente')) {
      const ok = ias >= vls && ias <= vmax + 10, txt = ias < vls ? `${Math.round(ias)} kt — TROP LENT, remettez des gaz` : ias > vmax + 10 ? `${Math.round(ias)} kt — trop rapide, réduisez` : `${Math.round(ias)} kt — bonne vitesse ✓`;
      rows.push(['Votre vitesse', txt]); cls[rows.length - 1] = ok ? 'ok' : 'bad';
    } else { rows.push(['Votre altitude', `${km1(P.y)} km (${ftf(altFt)} ft) · ${Math.round(ias)} kt`]); }
    return { ph, rows, cls, cruiseFt, cruiseM, vapp, vls, tgt, vmax, tdKm, rem };
  }
  function fuelCalls() {
    if (P.crashed || P.heli || P.onGround || !P.fuelCap) return;
    const pct = P.fuel / P.fuelCap;
    if (pct < 0.1 && (V.fuelWarn || 0) < 1) { V.fuelWarn = 1; toast('Carburant bas (moins de 10 %) : prévoyez un atterrissage.', 6000); V.say('Carburant bas'); SIM.radio('VOUS', `${SIM.atc.CS}, carburant bas, nous demandons une arrivée directe.`, false, `${SIM.atc.CS}, low fuel, request direct approach.`); }
    if (pct < 0.03 && (V.fuelWarn || 0) < 2) { V.fuelWarn = 2; toast('CARBURANT CRITIQUE : posez-vous tout de suite !', 6000); V.say('Carburant critique'); }
  }
  function updateCard() {
    fuelCalls();
    const on = fcard.style.display !== 'none' && !document.body.classList.contains('clear') && !SIM.troops.active && !SIM.war.truckMode;
    document.body.classList.toggle('card-on', on);
    if (on) document.documentElement.style.setProperty('--fch', fcard.offsetHeight + 'px');
    const d = cardData(); $('fcPh').textContent = d.ph;
    const h = d.rows.map((r, i) => r[0] === 'bar' ? `<div class="bar"><i style="width:${r[1]}%"></i></div>` : `<dt>${r[0]}</dt><dd class="${(d.cls || {})[i] || ''}">${r[1]}</dd>`).join('');
    if (fcBody._h !== h) { fcBody.innerHTML = h; fcBody._h = h; }
    if (P.heli || P.crashed || d.cruiseFt == null) return;
    // annonces radio (français + anglais)
    const say = (k, fr, en) => { if (!fcCalls[k]) { fcCalls[k] = 1; SIM.radio('INSTRUCTEUR', fr, false, en); } };
    const FL = Math.round(d.cruiseFt / 100), km = km1(d.cruiseM);
    if (!P.onGround && P.agl / SIM.FT > 1000 && d.rem > d.tdKm) say('climb', `Montez jusqu'à l'altitude de croisière : niveau ${FL}, soit ${km} kilomètres (${ftf(d.cruiseFt)} pieds).`, `Climb to cruise altitude: flight level ${FL}, that is ${km.replace(',', '.')} kilometres (${d.cruiseFt} feet).`);
    if (!P.onGround && Math.abs(P.y - d.cruiseM) < 120) say('cruise', `Altitude de croisière atteinte : ${km} km. Mettez les gaz en croisière (CL), vitesse Mach ${SIM.perf().mach}.`, `Cruise altitude reached: ${km.replace(',', '.')} km. Set climb thrust, cruise speed Mach ${SIM.perf().mach}.`);
    if (!P.onGround && fcCalls.climb && d.rem <= d.tdKm && d.rem > 20) say('desc', `Commencez la descente maintenant. Pour un atterrissage parfait : vitesse ${d.tgt} nœuds en finale, minimum ${d.vls}, maximum ${d.vmax}.`, `Start your descent now. For a perfect landing: final approach speed ${d.tgt} knots, minimum ${d.vls}, maximum ${d.vmax}.`);
    if (!P.onGround && d.rem < 15 && P.agl / SIM.FT < 3500) say('final', `Approche finale : tenez ${d.tgt} nœuds (marge de 5 nœuds), jamais sous ${d.vls}. Train sorti, volets FULL, environ ${Math.round(SIM.perf().vapp * 5.3 / 50) * 50} pieds par minute.`, `Final approach: hold ${d.tgt} knots including a 5 knot margin, never below ${d.vls}. Gear down, flaps full.`);
    if (!P.onGround && d.rem < 8 && P.agl / SIM.FT < 520 && fcCalls.final) { const ias = Math.round(P.ias / SIM.KT); say('500', `500 pieds, vitesse ${ias} nœuds : ${ias < d.vls ? 'trop lent, ajoutez des gaz !' : ias > d.vmax + 10 ? 'trop rapide, réduisez !' : 'stabilisé, continuez.'}`, `Five hundred, speed ${ias} knots: ${ias < d.vls ? 'too slow, add power!' : ias > d.vmax + 10 ? 'too fast, reduce!' : 'stable, continue.'}`); }
  }
  // ---------- Réservoir et signaux de vol (voyants + bandeau vif à chaque étape) ----------
  const sigPrev = {}; let banT = 0, banQ = [];
  function banner(cls, txt, sub, snd) {
    banQ.push({ cls, txt, sub, snd }); if (banQ.length > 4) banQ.shift();
  }
  function bannerTick(dt) {
    const b = $('sigBanner'); banT -= dt;
    if (banT <= 0 && b.classList.contains('show')) { b.classList.remove('show'); banT = -0.4; return; }
    if (banT <= -0.35 && banQ.length && dispPref.sig !== false) {
      const m = banQ.shift(); b.className = m.cls; b.innerHTML = ''; b.appendChild(document.createTextNode(m.txt)); if (m.sub) { const s = document.createElement('small'); s.textContent = m.sub; b.appendChild(s); }
      void b.offsetWidth; b.classList.add('show'); banT = 4.2; if (m.snd) chime(m.cls === 'r' ? 2 : m.cls === 'a' ? 1 : 0);
    }
  }
  function chime(k) {   // petit carillon (ding-dong) quand une étape est atteinte
    const A = V.audio; if (!A || !A.ctx) return;
    try { const c = A.ctx, t0 = c.currentTime, notes = k === 2 ? [880, 660, 880, 660] : k === 1 ? [740, 587] : [659, 880];
      notes.forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t0 + i * 0.22); g.gain.linearRampToValueAtTime(0.16, t0 + i * 0.22 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.22 + 0.5); o.connect(g); g.connect(c.destination); o.start(t0 + i * 0.22); o.stop(t0 + i * 0.22 + 0.55); });
    } catch (e) { }
  }
  function setSig(id, cls, txt) { const e = $(id); if (e._c !== cls) { e.className = 'sg ' + cls; e._c = cls; } const sp = e.lastElementChild; if (sp.textContent !== txt) sp.textContent = txt; }
  let tankWave = 0;
  function sigUpdate(dt) {
    bannerTick(dt);
    const cap = P.fuelCap || SIM.tyx().cap || 1, fuel = Math.max(0, P.fuel || 0), pct = clamp(fuel / cap, 0, 1);
    // --- réservoir ---
    if (dispPref.tank !== false) {
      const ffKgS = P.heli ? 0.12 : Math.max(P.ff || 0, 0), ffH = ffKgS * 3600;
      tankWave += dt * 3; const y = 10 + 54 * (1 - pct), wv = [];
      for (let x = 10; x <= 190; x += 10) wv.push(`${x},${(y + Math.sin(x * 0.08 + tankWave) * 1.6 + (P.phi || 0) * (x - 100) * 0.12).toFixed(1)}`);
      $('tkLvl').setAttribute('y', y.toFixed(1)); $('tkLvl').setAttribute('height', (64 - y + 1).toFixed(1));
      $('tkWave').setAttribute('d', 'M10,64 L' + wv.join(' L') + ' L190,64 Z');
      const col = pct < 0.1 ? ['#ff8a80', '#b3121b'] : pct < 0.25 ? ['#ffd27a', '#c77a00'] : ['#7cf0b4', '#139c5c'];
      if ($('tkC1')._c !== col[0]) { $('tkC1').setAttribute('stop-color', col[0]); $('tkC2').setAttribute('stop-color', col[1]); $('tkC1')._c = col[0]; }
      $('tkTxt').textContent = Math.round(pct * 100) + ' %';
      $('tkKg').textContent = (fuel >= 10000 ? (fuel / 1000).toFixed(1) + ' t' : Math.round(fuel) + ' kg');
      const end = ffKgS > 0.01 ? fuel / ffKgS / 60 : 0, rem = SIM.routeRemaining ? SIM.routeRemaining() / 1000 : 0, gs = Math.max(P.V * Math.cos(P.gamma || 0), 1), need = rem * 1000 / gs / 60;
      const ok = P.onGround || end > need * 1.1;
      $('tkPct').textContent = ok ? 'OK' : 'JUSTE'; $('tkPct').style.color = pct < 0.1 || !ok ? 'var(--red)' : pct < 0.25 ? 'var(--amber)' : 'var(--green)';
      $('tkFF').textContent = Math.round(ffH).toLocaleString('fr-FR') + ' kg/h';
      $('tkEnd').textContent = P.onGround ? `capacité ${(cap / 1000).toFixed(1)} t · plein : Maj+E` : `autonomie ${Math.floor(end / 60)} h ${String(Math.round(end % 60)).padStart(2, '0')} · arrivée dans ${Math.round(need)} min`;
      $('tankP').classList.toggle('low', pct < 0.1 || !ok);
    }
    // --- signaux ---
    if (P.heli || P.crashed) { if (dispPref.sig !== false) { setSig('sgAlt', '', P.heli ? 'hélicoptère : 300–450 m' : '—'); setSig('sgSpd', '', '—'); setSig('sgDes', '', '—'); setSig('sgFuel', pct < 0.1 ? 'r' : pct < 0.25 ? 'a' : 'g', Math.round(pct * 100) + ' %'); } return; }
    const d = cardData(); if (d.cruiseM == null) return;
    const pf = SIM.perf(), FT = SIM.FT, altFt = P.y / FT, ias = P.ias / SIM.KT, mach = P.mach || 0, FL = Math.round(d.cruiseFt / 100), dAlt = P.y - d.cruiseM;
    // altitude
    let aC, aT;
    if (P.onGround) { aC = ''; aT = `croisière prévue FL${FL}`; }
    else if (d.ph === 'Montée') { aC = 'c'; aT = `↑ FL${Math.round(altFt / 100)} → FL${FL} · ${km1(-dAlt)} km`; }
    else if (d.ph === 'Croisière') { const e = Math.abs(dAlt); aC = e < 100 ? 'g' : e < 300 ? 'a' : 'r'; aT = e < 100 ? `FL${FL} tenu ✓` : `écart ${dAlt > 0 ? '+' : '−'}${Math.round(e / FT)} ft`; }
    else { aC = 'c'; aT = `↓ ${Math.round(altFt).toLocaleString('fr-FR')} ft`; }
    // vitesse
    let sC, sT; const hi = altFt > 25000, tgtKt = altFt < 10000 ? 250 : 290;
    if (P.onGround) { sC = ''; sT = `rotation à ${pf.vr} kt`; }
    else if (P.stall || ias < d.vls * 0.92) { sC = 'r'; sT = `TROP LENT ${Math.round(ias)} kt`; }
    else if (mach > pf.mmo || ias > 350) { sC = 'r'; sT = `SURVITESSE M${mach.toFixed(2)}`; }
    else if (d.ph === 'Approche' || d.ph === 'Descente' && altFt < 6000) { const e = ias - d.tgt; sC = Math.abs(e) < 8 ? 'g' : Math.abs(e) < 20 ? 'a' : 'r'; sT = `${Math.round(ias)} kt · cible ${d.tgt}`; }
    else if (hi) { const e = mach - pf.mach; sC = Math.abs(e) < 0.02 ? 'g' : Math.abs(e) < 0.05 ? 'a' : 'c'; sT = `M${mach.toFixed(2)} · cible M${pf.mach}`; }
    else { const e = ias - tgtKt; sC = Math.abs(e) < 12 ? 'g' : Math.abs(e) < 30 ? 'a' : 'c'; sT = `${Math.round(ias)} kt · cible ${tgtKt}`; }
    // descente
    let dC, dT; const toTd = d.rem - d.tdKm;
    if (P.onGround) { dC = ''; dT = `début à ${Math.round(d.tdKm)} km de l'arrivée`; }
    else if (toTd > 30) { dC = ''; dT = `dans ${Math.round(toTd)} km`; }
    else if (toTd > 0) { dC = 'a'; dT = `préparez-vous : ${Math.round(toTd)} km`; }
    else if (d.ph !== 'Approche' && altFt > 12000 && P.vs > -3) { dC = 'r'; dT = 'DESCENDEZ MAINTENANT'; }
    else { dC = 'c'; dT = `en descente · ${Math.round(d.rem)} km`; }
    // carburant
    const fC = pct < 0.1 ? 'r' : pct < 0.25 ? 'a' : 'g', fT = `${Math.round(pct * 100)} % · ${fuel >= 10000 ? (fuel / 1000).toFixed(1) + ' t' : Math.round(fuel) + ' kg'}`;
    if (dispPref.sig !== false) { setSig('sgAlt', aC, aT); setSig('sgSpd', sC, sT); setSig('sgDes', dC, dT); setSig('sgFuel', fC, fT); }
    // bandeaux vifs à chaque changement important
    const ev = (k, on, cls, txt, sub) => { if (on && !sigPrev[k]) banner(cls, txt, sub, true); sigPrev[k] = on; };
    if (!P.onGround) {
      ev('k1000', d.ph === 'Montée' && -dAlt < 1000 * FT && -dAlt > 200, 'c', `⬆ 1 000 FT AVANT LE PALIER · FL${FL}`, 'Réduisez la montée pour vous stabiliser en douceur');
      ev('cruiseAlt', Math.abs(dAlt) < 100 && d.rem > d.tdKm, 'g', `✈ ALTITUDE DE CROISIÈRE ATTEINTE · FL${FL}`, `${km1(d.cruiseM)} km · visez Mach ${pf.mach}`);
      ev('cruiseSpd', hi && Math.abs(mach - pf.mach) < 0.015 && Math.abs(dAlt) < 300, 'g', `⚡ VITESSE DE CROISIÈRE · MACH ${pf.mach}`, `≈ ${Math.round(pf.mach * 573)} kt · gardez ce régime`);
      ev('altDev', d.ph === 'Croisière' && Math.abs(dAlt) > 300, 'a', `⚠ ÉCART D'ALTITUDE ${dAlt > 0 ? '+' : '−'}${Math.round(Math.abs(dAlt) / FT)} FT`, `Revenez au FL${FL}`);
      ev('tod', toTd <= 0 && d.rem > 20, 'a', '⬇ DÉBUT DE DESCENTE', `Descendez vers ${SIM.route.dest.city} · ${Math.round(d.rem)} km restants`);
      ev('over', sC === 'r' && mach > pf.mmo * 0.98, 'r', '⛔ SURVITESSE · RÉDUISEZ', `Mach ${mach.toFixed(2)} (max ${pf.mmo})`);
      ev('slow', sC === 'r' && (P.stall || ias < d.vls * 0.92), 'r', '⛔ VITESSE TROP FAIBLE', 'Gaz ! Nez légèrement en bas');
      ev('final', d.ph === 'Approche' && P.agl / FT < 3000 && d.rem < 15, 'c', `🛬 FINALE · VISEZ ${d.tgt} KT`, `minimum ${d.vls} kt · train sorti · volets FULL`);
    }
    ev('fuel25', pct < 0.25 && !P.onGround, 'a', '⛽ CARBURANT BAS · 25 %', 'Prévoyez l\'atterrissage ou une escale');
    ev('fuel10', pct < 0.1 && !P.onGround, 'r', '⛽ CARBURANT CRITIQUE · 10 %', 'Posez-vous tout de suite');
  }
  // ---------- Annonces radio-sonde ----------
  let lastRA = 1e9;
  function callouts() {
    if (P.onGround || P.vs > 0) { lastRA = P.agl / SIM.FT; return; }
    const ft = P.agl / SIM.FT;
    for (const c of [2500, 1000, 500, 100, 50, 40, 30, 20, 10]) if (lastRA > c && ft <= c && P.gearDown) { V.say(c === 2500 ? 'Twenty five hundred' : c === 1000 ? 'One thousand' : c === 500 ? 'Five hundred' : c === 100 ? 'One hundred' : String(c), 'en-US'); break; }
    lastRA = ft;
  }
  let v1 = 0;
  function speedCalls() { const ias = P.ias / SIM.KT; if (!P.onGround || P.landed) { v1 = 0; return; } if (v1 < 1 && ias > 100) { v1 = 1; V.say('Cent nœuds'); } else if (v1 < 2 && ias > SIM.perf().v1) { v1 = 2; V.say('V1'); } else if (v1 < 3 && ias > SIM.perf().vr) { v1 = 3; V.say('Rotation'); toast('ROTATION — montez le levier MONTÉE'); } }

  // ---------- Boucle ----------
  setHour(9);
  doReset();
  SIM.world.terrain.rebuild(P.x, P.z);
  let last = performance.now(), t = 0, hudT = 0, sigT = 0, ndT = 0, gT = 0, trailT = 0;
  function frame(now) {
    const rdt = Math.min((now - last) / 1000, 0.1); last = now; t += rdt;
    readInputs(rdt);
    const dt = rdt * (P.crashed ? 1 : SIM.timeScale);
    if (!SIM.war.truckMode) SIM.stepSim(dt);
    SIM.collide.update(rdt);
    V.syncPlane(rdt, t);
    V.updateCamera(rdt); if (!SIM.war.truckCamera(V.cam)) SIM.troops.camera(V.cam); SIM.nature.update(V.cam); SIM.city.update(V.cam); SIM.landmarks.update(V.cam); SIM.roads.update(V.cam);
    const strike = SIM.updateWorld(rdt, t, V.cam, P);
    if (strike && !P.onGround && P.birdCD <= 0) { P.birdCD = 20; toast('Impact aviaire ! Pas de dégâts.'); V.say('Impact aviaire'); }
    P.birdCD -= rdt;
    SIM.updateAirports(t, SIM.world.night, V.cam.position);
    SIM.ai.update(dt, t, SIM.world.night); SIM.life.update(rdt, t, V.cam); SIM.atc.update(rdt); SIM.war.update(dt, t); SIM.troops.update(rdt, t); SIM.war.labels(V.cam); SIM.net.update(rdt, t); SIM.net.labels(V.cam);
    V.updateFx(rdt); V.updateSound(); V.drawWet(rdt);
    // sillage d'écume quand l'avion glisse sur l'eau
    if (P.onGround && P.surf && P.surf.type === 'eau' && P.V > 3 && !P.crashed) { V.sprayT = (V.sprayT || 0) - rdt; if (V.sprayT <= 0) { V.sprayT = 0.06; const wl = SIM.waterAt(P.x, P.z) || 0, b = 6 + Math.random() * 6; SIM.boom.puff(P.x - Math.sin(P.psi) * b + (Math.random() - 0.5) * 8, wl + 0.4, P.z + Math.cos(P.psi) * b + (Math.random() - 0.5) * 8, 2 + P.V * 0.06, 1.4, 'spray'); } }
    trailT += dt; if (trailT > 2) { trailT = 0; V.trail.push([P.x, P.z]); if (V.trail.length > 3000) V.trail.shift(); }
    sigT += rdt; if (sigT > 0.1) { sigUpdate(sigT); sigT = 0; }
    hudT += rdt; if (hudT > 0.08) { hudT = 0; V.updateHUD(); refreshPanel(); callouts(); speedCalls(); }
    ndT += rdt; if (ndT > 0.12) { ndT = 0; V.drawND(); }
    if (V.myBoard && V.myBoard.done >= V.myBoard.people.length && !V.myBoard.fin) {
      V.myBoard.fin = true;
      if (V.myBoard.player === 'on') {
        const R = SIM.route, CS = SIM.atc.CS;
        SIM.radio('VOUS', `${R.dep.city} Sol, ${CS}, embarquement terminé, portes fermées, prêt au repoussage.`, false, `${R.dep.city} Ground, ${CS}, boarding complete, doors closed, ready for push-back.`);
        SIM.radio('SOL', `${CS}, repoussage approuvé, puis roulez point d'arrêt piste ${R.de.id} via Alpha.`, false, `${CS}, push-back approved, then taxi to holding point runway ${R.de.id} via Alpha.`);
        toast('Portes fermées. Le tracteur repousse l\'avion, puis c\'est à vous de rouler jusqu\'à la piste. Touche I : roulage automatique.', 7000);
        P.boarding = false; P.doorsClosed = true; SIM.atc.st = 10;
        setTimeout(() => { if (V.myBoard) { SIM.life.removeBoarding(V.myBoard); V.myBoard = null; } if (P.parked && !P.autoTaxi && !P.heli) { SIM.startTaxi(V.wantAuto ? 'full' : 'push'); V.setView('chase'); } }, 3000);
      }
      else { toast('Tous les passagers sont descendus.', 4000); }
    }
    if (V.awaitRwy && P.onGround && !P.autoTaxi && P.holdPt) {
      const sf = SIM.surface(P.x, P.z);
      if (Math.hypot(P.holdPt.x - P.x, P.holdPt.z - P.z) < 90 || (sf.type === 'piste' && sf.ap === SIM.route.dep)) {
        V.awaitRwy = false; SIM.ai.crossing(650); SIM.atc.st = 0; SIM.atc.t = 0; SIM.atc.cleared = false;
        toast('Point d\'arrêt atteint : arrêtez-vous (B). Un avion passe devant vous et décolle, puis la tour vous autorisera.', 6000);
      }
    }
    gT += rdt; if (gT > 0.4) { gT = 0; updateCard(); const g = footGuide() || SIM.war.guide() || SIM.guidance(); $('instrPhase').textContent = g.ph; $('instrText').textContent = g.t; $('instrNext').textContent = g.n; }
    V.renderer.render(SIM.scene, V.cam);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(t0 => { last = t0; frame(t0); $('boot').hidden = true; });
})();
