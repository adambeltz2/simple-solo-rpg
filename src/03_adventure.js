/* ---------- adventure generator (the story spine) ---------- */
function genSeed() { return pickR(SEED_W1) + '-' + pickR(SEED_W2) + '-' + (10 + Math.floor(rnd() * 90)); }

function tierFor(L, rng) {
  if (L <= 1) return 1;
  if (L === 2) return rng.chance(0.3) ? 2 : 1;
  if (L === 3) return 2;
  if (L === 4) return rng.chance(0.35) ? 3 : 2;
  return 3;
}
const budgetFor = (L) => Math.max(3, Math.round((2 + 2 * L) * 0.8));
function pickEnemies(T, L, budget, rng, mul) {
  const keys = [];
  let left = Math.max(2, Math.round(budget * mul));
  const pool = T.mon[tierFor(L, rng)];
  let guard = 0;
  while (left > 0 && keys.length < 5 && guard++ < 24) {
    const cand = pool.filter((k) => MON[k].thr <= left);
    if (!cand.length) break;
    const k = rng.pick(cand);
    keys.push(k);
    left -= MON[k].thr;
    if (keys.length >= 2 && rng.chance(0.25)) break;
  }
  if (!keys.length) keys.push(pool.slice().sort((a, b) => MON[a].thr - MON[b].thr)[0]);
  return keys;
}
function enemyNames(keys) {
  const counts = {};
  keys.forEach((k) => { counts[k] = (counts[k] || 0) + 1; });
  const parts = Object.keys(counts).map((k) => {
    const m = MON[k] || BOSS[k];
    const c = counts[k];
    return c === 1 ? an(m.n.toLowerCase()) : numWord(c) + ' ' + (m.pl || m.n + 's').toLowerCase();
  });
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
}
function numWord(n) { return ['no', 'one', 'two', 'three', 'four', 'five', 'six'][n] || String(n); }

const DOOR_HINT = {
  combat: ['voices and the scrape of steel', 'a low, rumbling growl', 'shuffling feet, more than one pair', 'the smell of smoke and sweat'],
  trap: ['a faint metallic click', 'a draft smelling of oil', 'scratch marks on the floor', 'dust disturbed in straight lines'],
  puzzle: ['a pale glow under the door', 'a hum like a struck bell', 'carved symbols around the frame'],
  hazard: ['the sound of running water', 'groaning timber', 'a damp, sour draft'],
  lore: ['scraps of old paper on the floor', 'faded paint on the stones'],
  treasure: ['a glint in the dark', 'a coin shining on the floor'],
  rest: ['a still, warm quiet', 'a steady light, small as a candle'],
  social: ['a human voice, low and tired', 'the clink of a lantern'],
};
const TYPE_LABEL = { combat: 'Danger', trap: 'Trap', puzzle: 'Puzzle', hazard: 'Hazard', lore: 'Secrets', treasure: 'Treasure', rest: 'Shelter', social: 'Someone is here' };

function generateAdventure(seed, hero, opts) {
  opts = opts || {};
  const rng = RNG(seed);
  const L = hero.level;
  const diffMul = { story: 0.75, standard: 1, grim: 1.3 }[opts.difficulty || 'standard'] || 1;
  const themeKey = opts.theme && opts.theme !== 'random' ? opts.theme : rng.pick(Object.keys(THEMES));
  const T = THEMES[themeKey];
  const hookKey = rng.pick(Object.keys(HOOKS));
  const H = HOOKS[hookKey];
  const used = new Set();
  const nm = (pool) => {
    let n, g = 0;
    do { n = rng.pick(pool); } while (used.has(n) && g++ < 30);
    used.add(n);
    return n;
  };
  const place = rng.pick(PLACES);
  const site = rng.pick(T.site);
  const patron = { name: nm(FIRST), role: rng.pick(PATRON_ROLE), friend: false };
  const villain = { name: nm(DARK) + ' ' + rng.pick(T.villainTitle), bossKey: rng.pick(T.bosses), motive: rng.pick(T.motive), kin: null };
  villain.name = villain.name.replace(' the the ', ' the ');
  const mcg = rng.pick(T.mcg);
  const ritual = rng.pick(T.ritual);
  const prs = [{ o: 'her', p: 'her' }, { o: 'him', p: 'his' }, { o: 'them', p: 'their' }];
  const reward = 30 + L * 20 + rng.int(0, 20);
  const advj = rng.pick(['Hollow', 'Silent', 'Black', 'Sunken', 'Burning', 'Forsaken', 'Pale', 'Weeping']);
  const noun = rng.pick(['Oath', 'Crown', 'Lantern', 'Vigil', 'Bargain', 'Choir', 'Debt', 'Hunger']);
  const adv = {
    seed: String(seed), title: 'The ' + advj + ' ' + noun, theme: themeKey, hook: hookKey, place, site, difficulty: opts.difficulty || 'standard',
    patron, villain, mcg, ritual, reward, npcs: {}, allyId: null, rooms: {}, slots: [],
    clock: { label: H.clock, max: H.clockMax, at: 0 }, twist: { type: null, revealed: false, outcome: null }, legacyUsed: [], pr: null,
  };

  /* legacy threads from earlier adventures */
  const legacy = (hero.legacy || []).slice();
  let returning = null;
  const lg = legacy.length ? legacy[0] : null;
  if (lg) {
    if (lg.t === 'ally_saved') {
      patron.name = lg.name; patron.role = 'old friend'; patron.friend = true; adv.reward = Math.round(adv.reward * 1.25);
      adv.legacyUsed.push(lg);
    } else if (lg.t === 'villain_slain') {
      villain.kin = lg.name;
      villain.motive = 'is hunting the one who killed ' + lg.name + ', and everyone who stands near them';
      adv.legacyUsed.push(lg);
    } else if (lg.t === 'villain_spared' || lg.t === 'npc_helped') {
      returning = { name: lg.name, t: lg.t };
      adv.legacyUsed.push(lg);
    }
  }
  /* a betrayer who got away can come back (hero memories) */
  if (!returning) {
    const bm = (hero.memories || []).find((m) => m.kind === 'betrayal' && m.who && !m.resolved && !m.used && m.who !== patron.name);
    if (bm) { returning = { name: bm.who, t: 'betrayer' }; adv.memUsed = [bm.id]; used.add(bm.who); }
  }
  const prLine = (s) => fill(s, { patron: patron.name, prole: patron.role, place, site, villain: villain.name, mcg, ritual, reward: adv.reward, ally: '{ally}', opr: '{opr}' });

  /* ally */
  const roles = ['scout', 'sellsword', 'priest'];
  function makeAlly(captive) {
    const pr = rng.pick(prs);
    adv.pr = pr;
    adv.allyId = 'ally';
    adv.npcs.ally = { id: 'ally', name: nm(FIRST), role: rng.pick(roles), pr, att: captive ? 0 : 1, met: !captive, alive: true, active: !captive, captive: !!captive, betrayer: false, hp: 10 + 3 * L, hpMax: 10 + 3 * L };
    return adv.npcs.ally;
  }
  if (hookKey === 'rescue') makeAlly(true);
  else if (rng.chance(0.4)) makeAlly(false);
  adv.twist.type = rng.pick(H.twists);
  if (adv.twist.type === 'ally_betrays' && !adv.allyId) makeAlly(false);
  const ally = adv.npcs.ally;
  const swap = (s) => s.split('{ally}').join(ally ? ally.name : 'someone').split('{opr}').join(ally ? ally.pr.o : 'them');
  const pitch = swap(prLine(H.pitch));
  adv.pitch = patron.friend ? 'Your old friend ' + patron.name + ' finds you first. ' + pitch : pitch;
  adv.goal = swap(prLine(H.goal));

  /* rooms */
  const roomNames = rng.shuffle(T.rooms);
  let rcount = 0;
  const lair = rng.pick(['inner sanctum', 'deep chamber', 'lair', 'throne room', 'sunken heart']);
  const diff = (d0) => dcFor(L, d0);
  const budget = budgetFor(L);
  function mk(type, o) {
    const id = 'r' + rcount++;
    const room = Object.assign({ id, type, name: roomNames[rcount % roomNames.length], hint: rng.pick(DOOR_HINT[type] || ['a quiet doorway']) }, o || {});
    adv.rooms[id] = room;
    return room;
  }
  function combatRoom(elite) {
    const keys = pickEnemies(T, L, budget + (elite ? 1 : 0), rng, diffMul);
    const intelligent = keys.every((k) => MON[k].kind === 'humanoid');
    const undead = keys.every((k) => MON[k].fl.includes('undead'));
    return mk('combat', { enemies: keys, elite: !!elite, intelligent, undead, ambushDC: diff(0), talkDC: diff(1), slipDC: diff(1), searchDC: diff(0) });
  }
  function trapRoom() {
    const o = rng.pick(ROOM_OBJ.trap);
    return mk('trap', { obj: o.obj, tkind: o.kind, dmgType: o.dmg, good: o.good, alarm: rng.chance(0.4), dc: diff(rng.pick([0, 1])), dice: [1 + Math.floor((L - 1) / 2), 8] });
  }
  function puzzleRoom() {
    const o = rng.pick(ROOM_OBJ.puzzle);
    return mk('puzzle', { obj: o.obj, skill: o.skill, alt: o.alt, good: o.good, dc: diff(rng.pick([0, 1])), dice: [1 + Math.floor((L - 1) / 2), 6] });
  }
  function hazardRoom() {
    const o = rng.pick(ROOM_OBJ.hazard);
    return mk('hazard', { obj: o.obj, skill: o.skill, alt: o.alt, good: o.good, dc: diff(0), dice: [1 + Math.floor((L - 1) / 2), 6] });
  }
  function loreRoom() {
    const o = rng.pick(ROOM_OBJ.lore);
    return mk('lore', { obj: o.obj, good: o.good, dc: diff(0) });
  }
  function treasureRoom() {
    const o = rng.pick(ROOM_OBJ.treasure);
    const owned = new Set(hero.gear || []);
    const gearPool = GEAR.filter((g) => !owned.has(g.id));
    const loot = { gold: rng.int(8, 16) * (L + 1), items: [rng.pick(['potion', 'oil', 'smoke', 'scroll'])], gear: gearPool.length && rng.chance(0.2) ? rng.pick(gearPool).id : null, key: rng.chance(0.45) };
    return mk('treasure', { obj: o.obj, good: o.good, dc: diff(0), trapped: rng.chance(0.4), dice: [1 + Math.floor((L - 1) / 2), 6], loot });
  }
  function restRoom() { return mk('rest', { kind: rng.pick(['shrine', 'camp']), name: rng.pick(['quiet alcove', 'forgotten shrine', 'dry side-chamber', 'old guardroom']) }); }
  function socialRoom(role, o) {
    const id = role === 'prisoner' ? 'ally' : 'n' + rcount;
    if (role !== 'prisoner' || !adv.npcs.ally) adv.npcs[id] = Object.assign({ id, name: nm(FIRST), role, att: 0, met: false, alive: true }, o || {});
    const r = mk('social', { npc: id, role, dcHelp: diff(0), dcTalk: diff(1), dcLie: diff(1), dcThreat: diff(1) });
    return r;
  }

  const entrance = mk('entrance', { name: 'threshold', hint: 'the way in', dc: diff(0) });
  const s1a = combatRoom(false);
  const s1b = (function () { return { trap: trapRoom, puzzle: puzzleRoom, hazard: hazardRoom, lore: loreRoom }[rng.pick(['trap', 'puzzle', 'hazard', 'lore'])](); })();
  let s2a;
  if (returning) {
    adv.npcs.ret = { id: 'ret', name: returning.name, role: 'returning', att: returning.t === 'betrayer' ? -2 : 1, met: false, alive: true, from: returning.t };
    s2a = mk('social', { npc: 'ret', role: 'returning', dcHelp: diff(0), dcTalk: diff(1), dcLie: diff(1), dcThreat: diff(1) });
  } else if (hookKey === 'rescue' && ally && ally.captive) s2a = socialRoom('prisoner');
  else s2a = socialRoom(rng.pick(['deserter', 'scholar', 'rival', 'trader']));
  const s2b = (function () { const t = rng.pick(['combat', 'treasure', 'lore']); return t === 'combat' ? combatRoom(false) : t === 'treasure' ? treasureRoom() : loreRoom(); })();
  const twist = mk('twist', { name: 'turning point', hint: 'something is wrong here', twist: adv.twist.type });
  const s4a = combatRoom(true);
  const s4b = (function () { const t = rng.pick(['puzzle', 'trap', 'hazard', 'lore'].filter((x) => x !== s1b.type)); return { trap: trapRoom, puzzle: puzzleRoom, hazard: hazardRoom, lore: loreRoom }[t](); })();
  const s5a = restRoom();
  const s5b = (function () { const t = rng.pick(['treasure', 'combat', 'lore']); return t === 'combat' ? combatRoom(false) : t === 'treasure' ? treasureRoom() : loreRoom(); })();
  const boss = mk('boss', { name: lair, hint: 'the heart of it', bossKey: villain.bossKey });
  const order = [[entrance], [s1a, s1b], [s2a, s2b], [twist], [s4a, s4b], [s5a, s5b], [boss]];
  adv.slots = order.map((pair) => ({ opts: rng.shuffle(pair.map((r) => r.id)) }));
  adv.titleFull = adv.title + ' of ' + site.replace(/^the /i, '');
  return adv;
}
