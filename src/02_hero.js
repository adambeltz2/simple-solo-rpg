/* ---------- hero ---------- */
const RES_N = { wind: 'Second Wind', surge: 'Action Surge', dodge: 'Uncanny Dodge', slots: 'Spell slots', turn: 'Turn Undead', breath: 'Breath weapon' };

const prof = (h) => 2 + Math.floor((h.level - 1) / 4);
const aMod = (h, a) => mod(h.abil[a]);
const gearList = (h) => (h.gear || []).map((id) => GEAR.find((g) => g.id === id)).filter(Boolean);

function heroSkills(h) {
  const s = new Set(CLASSES[h.cls].skills.slice(0, h.cls === 'rogue' ? 4 : 3));
  BACKGROUNDS[h.bg].skills.forEach((k) => s.add(k));
  if (h.species === 'elf') s.add('perception');
  return s;
}
function skillMod(h, sk) {
  let m = aMod(h, SKILLS[sk].a);
  if (heroSkills(h).has(sk)) m += prof(h);
  gearList(h).forEach((g) => { if (g.skill && g.skill[sk]) m += g.skill[sk]; });
  return m;
}
function saveMod(h, ab) {
  let m = aMod(h, ab);
  if (CLASSES[h.cls].saves.includes(ab)) m += prof(h);
  return m;
}
function heroAC(h) {
  let ac = CLASSES[h.cls].ac(h);
  gearList(h).forEach((g) => { if (g.ac) ac += g.ac; });
  return ac;
}
function atkBonus(h) { return aMod(h, CLASSES[h.cls].wpn.abil) + prof(h) + gearList(h).reduce((s, g) => s + (g.atk || 0), 0); }
function spellMod(h) { return aMod(h, CLASSES[h.cls].main) + prof(h); }
function spellDC(h) { return 8 + spellMod(h); }
function calcMaxHP(h) {
  const c = CLASSES[h.cls];
  const con = aMod(h, 'con');
  let hp = c.hd + con + 6;
  for (let l = 2; l <= h.level; l++) hp += Math.max(4, Math.floor(c.hd / 2) + 1 + con + 3);
  if (h.species === 'dwarf') hp += h.level;
  gearList(h).forEach((g) => { if (g.hp) hp += g.hp; });
  return Math.max(hp, 8);
}
function fortuneMax(h) { return 3 + (h.species === 'human' ? 1 : 0) + gearList(h).reduce((s, g) => s + (g.fort || 0), 0); }
function resMax(h) {
  const L = h.level, c = h.cls, r = {};
  if (c === 'fighter') { r.wind = 1; if (L >= 2) r.surge = 1; }
  if (c === 'rogue' && L >= 5) r.dodge = 1;
  if (c === 'wizard' || c === 'cleric') r.slots = L + 2;
  if (c === 'cleric' && L >= 2) r.turn = 1;
  if (h.species === 'dragonborn') r.breath = 1;
  return r;
}
function recalc(h) {
  const before = h.hpMax || 0;
  h.hpMax = calcMaxHP(h);
  if (!before) h.hp = h.hpMax;
  h.hp = clamp(h.hp, 0, h.hpMax);
}
function newHero(o) {
  const c = CLASSES[o.cls];
  const h = {
    id: 'h' + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36),
    name: o.name || pickR(HERO_NAMES), species: o.species, cls: o.cls, bg: o.bg, drive: o.drive,
    level: 1, abil: Object.assign({}, c.stats), gold: 0, inv: { potion: 2 }, gear: [], res: {}, fortune: 2,
    legacy: [], chronicle: [], memories: [], alive: true, adventures: 0, hp: 0, hpMax: 0,
  };
  recalc(h);
  h.hp = h.hpMax;
  h.res = resMax(h);
  h.fortune = 2 + (h.species === 'human' ? 1 : 0);
  return h;
}
function readyHero(h) {
  recalc(h);
  h.hp = h.hpMax;
  h.res = resMax(h);
  h.fortune = Math.min(fortuneMax(h), 2 + (h.species === 'human' ? 1 : 0) + gearList(h).reduce((s, g) => s + (g.fort || 0), 0));
  h.inv.potion = Math.max(h.inv.potion || 0, 2);
}
function restHero(h, frac) {
  h.res = resMax(h);
  const heal = Math.ceil(h.hpMax * frac);
  const before = h.hp;
  h.hp = clamp(h.hp + heal, 0, h.hpMax);
  return h.hp - before;
}
const LEVEL_NOTES = {
  fighter: { 2: 'Action Surge: take an extra action once per rest.', 3: 'Your training pays off: more HP and a surer hand.', 4: 'STR +2.', 5: 'Extra Attack: you strike twice when you attack.' },
  rogue: { 2: 'Cunning Hide as a bonus action.', 3: 'Sneak Attack grows to 2d6.', 4: 'DEX +2.', 5: 'Uncanny Dodge: halve one hit per rest. Sneak Attack 3d6.' },
  wizard: { 2: 'More spell slots.', 3: 'Scorching Ray learned.', 4: 'INT +2.', 5: 'Fire Bolt grows to 2d10.' },
  cleric: { 2: 'Turn Undead learned.', 3: 'More spell slots.', 4: 'WIS +2.', 5: 'Sacred Flame 2d8, Cure Wounds heals more.' },
};
function levelUp(h) {
  if (h.level >= 5) return null;
  h.level++;
  const c = CLASSES[h.cls];
  if (h.level === 4) h.abil[c.main] = Math.min(20, h.abil[c.main] + 2);
  const old = h.hpMax;
  h.hpMax = calcMaxHP(h);
  h.hp = Math.min(h.hpMax, h.hp + (h.hpMax - old));
  h.res = resMax(h);
  return { gain: h.hpMax - old, note: (LEVEL_NOTES[h.cls] || {})[h.level] || '' };
}

/* powers usable in combat */
function powerList(h) {
  const L = h.level, c = h.cls, P = [];
  if (c === 'fighter') {
    P.push({ id: 'second_wind', n: 'Second Wind', t: 'bonus', res: 'wind', d: 'Heal 1d10 + level.' });
    if (L >= 2) P.push({ id: 'action_surge', n: 'Action Surge', t: 'free', res: 'surge', d: 'Take an extra action right now.' });
  }
  if (c === 'rogue') P.push({ id: 'hide', n: 'Hide', t: 'bonus', d: 'Stealth check. If you vanish, your next attack has advantage and Sneak Attack.' });
  if (c === 'wizard') {
    P.push({ id: 'firebolt', n: 'Fire Bolt', t: 'action', tgt: true, d: 'Cantrip. Ranged spell attack, ' + (L >= 5 ? '2d10' : '1d10') + ' fire.' });
    P.push({ id: 'magic_missile', n: 'Magic Missile', t: 'action', res: 'slots', tgt: true, d: 'Three darts that never miss, 1d4+1 each.' });
    P.push({ id: 'shield', n: 'Shield', t: 'bonus', res: 'slots', d: '+5 AC until your next turn.' });
    P.push({ id: 'sleep', n: 'Sleep', t: 'action', res: 'slots', d: 'Roll 5d8 HP of foes to sleep, weakest first.' });
    if (L >= 3) P.push({ id: 'scorching_ray', n: 'Scorching Ray', t: 'action', res: 'slots', tgt: true, d: 'Three fire rays, 2d6 each (a spell attack for each).' });
  }
  if (c === 'cleric') {
    P.push({ id: 'sacred_flame', n: 'Sacred Flame', t: 'action', tgt: true, d: 'Cantrip. DEX save or ' + (L >= 5 ? '2d8' : '1d8') + ' radiant.' });
    P.push({ id: 'cure_wounds', n: 'Cure Wounds', t: 'action', res: 'slots', d: 'Heal 1d8 + WIS' + (L >= 5 ? ' + 1d8' : '') + '.' });
    P.push({ id: 'guiding_bolt', n: 'Guiding Bolt', t: 'action', res: 'slots', tgt: true, d: 'Spell attack, 4d6 radiant.' });
    if (L >= 2) P.push({ id: 'turn_undead', n: 'Turn Undead', t: 'action', res: 'turn', d: 'Undead make a WIS save or flee for two rounds.' });
  }
  if (h.species === 'dragonborn') P.push({ id: 'breath', n: 'Breath Weapon', t: 'action', res: 'breath', d: 'DEX save, ' + (L >= 5 ? '3d6' : '2d6') + ' to every foe.' });
  return P;
}
function passiveLines(h) {
  const out = [];
  if (h.cls === 'rogue') out.push('Sneak Attack: +' + Math.ceil(h.level / 2) + 'd6 once per turn when you have advantage or a hidden strike.');
  if (h.cls === 'fighter' && h.level >= 5) out.push('Extra Attack: you attack twice with the Attack action.');
  if (h.cls === 'rogue' && h.level >= 5) out.push('Uncanny Dodge: halve the first hit you take in a fight.');
  out.push(SPECIES[h.species].perk);
  return out;
}
function needWord(m, dc) {
  const need = dc - m;
  if (need <= 4) return 'Easy';
  if (need <= 9) return 'Fair';
  if (need <= 13) return 'Tough';
  return 'Long shot';
}
function dcFor(level, diff) { return 11 + diff * 2 + Math.floor((level - 1) / 2); }
