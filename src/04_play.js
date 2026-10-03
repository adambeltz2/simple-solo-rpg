/* ---------- play engine: state, rolls, effects, scenes ---------- */
let S = null;          // whole save: { settings, heroes, run, fallen }
let run = null;        // current adventure run (S.run)
let hero = null;       // hero in the current run
const ui = { dirty: true, onChange: null, onNarrate: null };
function changed() { if (Dice.hold) { Dice.def.changed = true; return; } if (ui.onChange) ui.onChange(); }

let entryId = 1;
function say(kind, text, extra) {
  const e = Object.assign({ id: entryId++, k: kind, t: text }, extra || {});
  run.log.push(e);
  if (run.log.length > 600) run.log.splice(0, run.log.length - 600);
  return e;
}
function narr(text, facts) {
  const e = say('narr', text, { tpl: text });
  if (facts && ui.onNarrate) { if (Dice.hold) Dice.def.narr.push([e, facts]); else ui.onNarrate(e, facts); }
  return e;
}

/* ---------- dice with context ---------- */
function d20roll(mode, label) {
  const lab = label && (mode > 0 ? label + ' — advantage: roll two, the higher counts' : mode < 0 ? label + ' — disadvantage: roll two, the lower counts' : label);
  const all = heroDice(mode ? 2 : 1, 20, lab);
  let lucky = false;
  if (hero.species === 'halfling') {
    for (let i = 0; i < all.length; i++) if (all[i] === 1) { all[i] = heroDice(1, 20, label && label + ' — halfling luck: roll again for the 1')[0]; lucky = true; }
  }
  if (!mode) return { r: all[0], all: [all[0]], lucky, mode: 0 };
  const r = mode > 0 ? Math.max(all[0], all[1]) : Math.min(all[0], all[1]);
  return { r, all: [all[0], all[1]], lucky, mode };
}
function modeStr(m) { return m > 0 ? ' (advantage)' : m < 0 ? ' (disadvantage)' : ''; }

function doCheck(skill, dc, mode) {
  const m = skillMod(hero, skill);
  const x = d20roll(mode || 0, SKILLS[skill].n + ' check (' + sgn(m) + ' added for you)');
  const total = x.r + m;
  const crit = x.r === 20, fumble = x.r === 1;
  const ok = crit || (!fumble && total >= dc);
  return { skill, dc, m, x, total, ok, crit, fumble };
}
function doSave(abil, dc, mode) {
  const m = saveMod(hero, abil);
  const x = d20roll(mode || 0, ABIL_N[abil] + ' save (' + sgn(m) + ' added for you)');
  const total = x.r + m;
  const ok = x.r === 20 || (x.r !== 1 && total >= dc);
  return { abil, dc, m, x, total, ok };
}
function rollChip(c) {
  const nm = c.skill ? SKILLS[c.skill].n : ABIL_N[c.abil] + ' save';
  const dice = c.x.all.length > 1 ? 'd20 [' + c.x.all.join(', ') + '→' + c.x.r + ']' : 'd20 [' + c.x.r + ']';
  return nm + ': ' + dice + ' ' + sgn(c.m) + ' = ' + c.total + ' vs DC ' + c.dc + ' — ' + (c.crit ? 'critical success' : c.fumble ? 'critical failure' : c.ok ? 'success' : 'failure');
}

/* ---------- ledger helpers ---------- */
const led = () => run.led;
const flag = (k) => !!run.led.flags[k];
function setFlag(k, v) { run.led.flags[k] = v === undefined ? true : v; }
function npcOf(id) { return run.adv.npcs[id]; }
function allyNow() { const a = run.adv.npcs.ally; return a && a.active && a.alive && !a.betrayer ? a : null; }
function deed(text) { led().deeds.push(text); }

/* ---------- hero memories: what the hero carries between adventures ---------- */
const MEM_KIND = { betrayal: 'Betrayal', left_for_dead: 'Left for dead' };
function addMemory(kind, text, o) {
  o = o || {};
  const list = hero.memories = hero.memories || [];
  const seed = run.adv.seed;
  const dupe = list.find((m) => m.kind === kind && m.seed === seed && (m.who || '') === (o.who || '') && (m.src || '') === (o.src || ''));
  if (dupe) { if (o.upgrade && !dupe.edited) dupe.text = text; return dupe; }
  hero.memSeq = (hero.memSeq || 0) + 1;
  const m = {
    id: 'm' + hero.memSeq, kind, text, src: o.src || '', who: o.who || '', tags: (o.tags || []).map((t) => String(t).toLowerCase()),
    adv: run.adv.titleFull || run.adv.title, seed, used: 0, resolved: '', edited: false,
  };
  list.push(m);
  while (list.length > 12) { const i = list.findIndex((x) => x.resolved); list.splice(i >= 0 ? i : 0, 1); }
  say('sys', '✎ A memory takes hold: “' + text + '”');
  return m;
}
function rememberBetrayal(a, how) {
  const adv = run.adv;
  const t = {
    reveal: a.name + ' turned on me at the worst moment, in ' + adv.site + '. "Nothing personal," ' + a.pr.o + ' said.',
    fled: a.name + ' was working for the enemy all along. When I called it out, ' + a.pr.o + ' ran.',
    caught: a.name + ' was working for the enemy all along. I struck first.',
  }[how];
  if (!t) return null;
  return addMemory('betrayal', t, { who: a.name, src: adv.site, tags: [a.name, 'betrayal', 'ally'] });
}
function rememberDefeat(room, foes, how) {
  const adv = run.adv;
  const tail = how === 'revived' ? ' Something in me refused to die.' : how === 'stable' ? ' I clung to life until the pain let go.' : ' I woke later, alone.';
  const tr = foes.find((e) => e.traitor || e.retId);
  if (tr) {
    addMemory('betrayal', tr.n + ', who I trusted, struck me down in the ' + room.name + '.' + tail, { who: tr.n, src: adv.site, tags: [tr.n, 'betrayal', room.name], upgrade: true });
    return;
  }
  const boss = foes.find((e) => e.boss);
  let text;
  if (!foes.length) text = 'I collapsed in the ' + room.name + ', and no one was there to catch me.' + tail;
  else {
    const foe = boss ? boss.n : an(foes[0].n.toLowerCase()) + (foes.length > 1 ? ' and its fellows' : '');
    text = cap(foe) + ' beat me down in the ' + room.name + '.' + tail;
  }
  addMemory('left_for_dead', text, { src: room.name, tags: [boss ? boss.n : '', room.name, 'defeat'].filter(Boolean) });
}
/* a betrayer was dealt with: stop them coming back */
function settleBetrayer(name, how) {
  (hero.memories || []).forEach((m) => {
    if (m.kind !== 'betrayal' || m.who !== name || m.resolved) return;
    m.resolved = how;
    if (!m.edited) m.text += { slain: ' I ended it with steel.', forgiven: ' Later, I chose to give them another chance.', answered: ' Later, I made them tell me why.' }[how] || '';
  });
}
/* the few memories worth handing to the narrator for this moment */
function memoriesFor(kind, room) {
  const ms = hero.memories || [];
  if (!ms.length) return [];
  const names = [];
  const adv = run.adv;
  if (adv.villain) names.push(adv.villain.name.toLowerCase());
  Object.keys(adv.npcs || {}).forEach((k) => { const n = adv.npcs[k]; if (n && n.name && (n.met || n.active)) names.push(n.name.toLowerCase()); });
  if (room && room.name) names.push(String(room.name).toLowerCase());
  const always = ['hook', 'twist', 'boss', 'defeat', 'epilogue'].includes(kind);
  const scored = ms.map((m, i) => {
    const hit = (m.tags || []).some((t) => t && names.includes(t));
    return { m, s: (hit ? 3 : 0) + (m.seed === adv.seed ? 1 : 0) + i / 100, hit };
  }).filter((x) => x.hit || always);
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, 2).map((x) => x.m.text.slice(0, 160));
}
function queueCb(text) { led().cbs.push(text); if (led().cbs.length > 6) led().cbs.shift(); }
function addAtt(id, n) {
  const p = npcOf(id);
  if (!p) return;
  p.att = clamp(p.att + n, -3, 3);
  p.met = true;
}
function gainFortune(n) {
  const before = hero.fortune;
  hero.fortune = clamp(hero.fortune + n, 0, fortuneMax(hero));
  return hero.fortune - before;
}
function addItem(id, n) { hero.inv[id] = (hero.inv[id] || 0) + (n || 1); }
function hurt(n, type, quiet) {
  if (type === 'poison' && hero.species === 'dwarf') n = Math.ceil(n / 2);
  n = Math.max(0, n);
  hero.hp = Math.max(0, hero.hp - n);
  if (!quiet) say('dmg', 'You take ' + n + (type ? ' ' + type : '') + ' damage. (' + hero.hp + '/' + hero.hpMax + ' HP)');
  return n;
}
function mend(n) {
  const before = hero.hp;
  hero.hp = clamp(hero.hp + n, 0, hero.hpMax);
  return hero.hp - before;
}
function tickClock(n) {
  const c = run.adv.clock;
  c.at = clamp(c.at + n, 0, c.max);
  if (c.at >= c.max && !flag('clock_done')) {
    setFlag('clock_done');
    say('sys', '⏳ ' + c.label + ': time has run out. Whatever you were racing against has come to pass.');
    deed('Ran out the clock (' + c.label.toLowerCase() + ')');
  }
}
function bumpAlert(n) {
  const before = led().alert;
  led().alert = clamp(before + n, 0, 5);
  if (n > 0 && led().alert > before && led().alert >= 3 && before < 3) say('sys', '⚠ The defenders are awake. Alarm is spreading.');
}

/* ---------- effects ---------- */
function applyFx(fx, opts) {
  opts = opts || {};
  if (!fx) return { combat: null };
  const out = { combat: null, lines: [] };
  const note = (t) => { out.lines.push(t); say('sys', t); };
  if (fx.hp) {
    if (fx.hp < 0) hurt(-fx.hp, fx.dmgType); else { const g = mend(fx.hp); if (g) note('You recover ' + g + ' HP.'); }
  }
  if (fx.gold) { hero.gold += fx.gold; led().gold += fx.gold; note('+' + fx.gold + ' gold.'); }
  (fx.items || []).forEach((it) => { addItem(it, 1); note('You gain: ' + ITEMS[it].n + '.'); });
  if (fx.gear) {
    if (!hero.gear.includes(fx.gear)) {
      hero.gear.push(fx.gear);
      const g = GEAR.find((x) => x.id === fx.gear);
      recalc(hero);
      if (g && g.hp) hero.hp += g.hp;
      note('Treasure: ' + g.n + ' (' + g.d + ').');
    }
  }
  if (fx.flags) fx.flags.forEach((f) => setFlag(f));
  if (fx.clue) { led().clues += fx.clue; note('🔍 Clue found (' + led().clues + ').'); }
  if (fx.alert) bumpAlert(fx.alert);
  if (fx.clock) tickClock(fx.clock);
  if (fx.fortune) { const g = gainFortune(fx.fortune); if (g > 0) note('✦ +' + g + ' Fortune.'); }
  if (fx.att) Object.keys(fx.att).forEach((id) => addAtt(id, fx.att[id]));
  if (fx.deed) deed(fx.deed);
  if (fx.cb) queueCb(fx.cb);
  if (fx.rest) {
    const frac = fx.rest;
    const g = restHero(hero, frac);
    note('You rest. +' + g + ' HP, and your abilities return.');
  }
  if (fx.legacy) hero.legacy.push(fx.legacy);
  if (fx.ally === 'join') {
    const a = run.adv.npcs.ally;
    if (a && a.alive) { a.active = true; a.captive = false; a.met = true; note(a.name + ' joins you.'); }
  }
  if (fx.ally === 'leave') {
    const a = run.adv.npcs.ally;
    if (a) { a.active = false; a.captive = false; note(a.name + ' heads for safety.'); }
  }
  if (fx.ally === 'betray') {
    const a = run.adv.npcs.ally;
    if (a) { a.betrayer = true; a.active = false; rememberBetrayal(a, fx.combat ? 'caught' : 'fled'); }
  }
  if (fx.settle) {
    const r = run.adv.npcs.ret;
    if (r) settleBetrayer(r.name, fx.settle);
  }
  if (fx.curse) { hero.hpMax = Math.max(8, hero.hpMax - fx.curse); hero.hp = Math.min(hero.hp, hero.hpMax); setFlag('cursed'); note('A creeping curse takes ' + fx.curse + ' max HP until you can be cleansed.'); }
  if (fx.combat) out.combat = fx.combat;
  if (fx.setEnd) run.ending = fx.setEnd;
  return out;
}

/* ---------- callbacks (the story remembering you) ---------- */
function callbackLine() {
  const parts = [];
  const a = led().alert;
  if (a >= 4) parts.push('Shouts and the clatter of arms echo behind you. The defenders are hunting.');
  else if (a === 3) parts.push('Somewhere, an alarm bell has been struck. You can feel the place tightening around you.');
  const c = run.adv.clock;
  if (c.at >= c.max - 2 && c.at < c.max) parts.push('The air hums. Whatever is coming is nearly here.');
  const al = allyNow();
  if (al && rnd() < 0.5) parts.push(al.name + ' keeps close, ' + (al.att >= 2 ? 'steady and loyal.' : 'quiet, watching you.'));
  if (led().cbs.length) parts.push(led().cbs.shift());
  return parts.slice(0, 2).join(' ');
}

/* ---------- scene text ---------- */
function themeOf() { return THEMES[run.adv.theme]; }
function atmosphere() {
  const T = themeOf();
  return cap(pickR(T.sight)) + '. ' + pickR(T.sound) + ' The air smells of ' + pickR(T.smell) + '.';
}
function roomIntro(room) {
  const T = themeOf();
  const lead = pickR(TPL.arrive);
  let body = '';
  if (room.type === 'combat') {
    const keys = room.enemies;
    const m = MON[keys[0]];
    const act = pickR(COMBAT_ACT[m.kind] || COMBAT_ACT.humanoid);
    body = fill(pickR(TPL.lead.combat), { count: '', names: cap(enemyNames(keys)), act }).replace(/^\s+/, '').replace('  ', ' ');
  } else if (room.type === 'social') {
    const npc = npcOf(room.npc);
    const role = SOCIAL_ROLES[room.role] || null;
    if (room.role === 'returning' && npc.from === 'betrayer') body = 'A figure you hoped never to see again steps from the shadows: ' + npc.name + ', who betrayed you. ' + cap(npc.name) + ' has seen you too, and does not run.';
    else if (room.role === 'returning') body = 'A familiar figure steps from the shadows: ' + npc.name + ', whom you met before. ' + (npc.from === 'villain_spared' ? 'They look wary, but not hostile.' : 'They look glad to see you.');
    else body = fill(pickR(TPL.lead.social), { role: role.n, d: role.d, act: NPC_ACT[room.role] });
  } else if (TPL.lead[room.type]) {
    body = fill(pickR(TPL.lead[room.type]), { obj: room.obj || '', Obj: cap(room.obj || '') });
  }
  return lead + ' ' + atmosphere() + ' ' + body;
}

/* ---------- choices: built as plain data so the run can be saved ---------- */
let cid = 0;
function C(label, o) { return Object.assign({ id: 'c' + cid++, label }, o || {}); }
function stat(skill, dc) { return skill ? { skill, dc } : {}; }

function fitDC(room, skill, dc) {
  if (room.good && room.good.includes(skill)) return dc - 2;
  return dc;
}
function genericFx(room) {
  /* default success/failure bundles used by choices and free actions */
  const L = hero.level;
  const dmg = (dice) => rollDice(dice[0], dice[1]).total;
  switch (room.type) {
    case 'trap': return { s: { clue: 0, deed: null }, f: { hp: -dmg(room.dice), dmgType: room.dmgType, alert: room.alarm ? 1 : 0 } };
    case 'puzzle': return { s: { clue: 1, items: [pickR(['potion', 'oil', 'smoke', 'scroll'])] }, f: { clock: 1, hp: -Math.max(1, Math.floor(dmg(room.dice) / 2)), dmgType: 'force' } };
    case 'hazard': return { s: { flags: ['cleared_' + room.id] }, f: { hp: -dmg(room.dice), dmgType: 'bludgeoning', clock: 1 } };
    case 'lore': return { s: { clue: 1, fortune: hero.drive === 'curiosity' ? 1 : 0 }, f: { clock: 1 } };
    case 'treasure': return { s: treasureFx(room), f: { alert: 1, hp: room.trapped ? -dmg(room.dice) : 0, dmgType: 'piercing' } };
    default: return { s: {}, f: {} };
  }
}
function treasureFx(room) {
  const l = room.loot;
  const fx = { gold: l.gold, items: l.items.slice(), gear: l.gear || undefined };
  if (l.key) fx.flags = ['sidedoor'];
  return fx;
}
function buildChoices(room) {
  const L = hero.level;
  const ch = [];
  const add = (c) => { ch.push(c); return c; };
  const T = room.type;
  if (T === 'entrance') {
    add(C('Study the entrance for another way in', Object.assign(stat('perception', room.dc), { alt: 'investigation', kind: 'check', style: 'careful', s: { flags: ['sidedoor'], deed: 'Found a side way in', clue: 0 }, f: { alert: 1 }, ok: 'You find a loose grate and a rusted door. Someone has used this before.', no: 'You scuff a stone loose, and the sound carries.' })));
    add(C('Walk in openly', { kind: 'auto', drive: 'glory', s: { alert: 1, deed: 'Marched in through the front' }, ok: 'You step through the front door, boots loud. If anyone is listening, they know you are here.' }));
    add(C('Slip in quietly', Object.assign(stat('stealth', room.dc), { kind: 'check', style: 'stealth', s: { flags: ['quiet_start'] }, f: { alert: 1 }, ok: 'You ghost through the entrance without a sound.', no: 'A loose stone clatters under your foot. Somewhere ahead, a voice goes quiet.' })));
  } else if (T === 'combat') {
    const strong = room.elite ? 0 : 0;
    add(C('Attack!', { kind: 'combat', drive: hero.drive === 'vengeance' ? 'vengeance' : 'glory', fx: { combat: { enemies: room.enemies, surprise: null } } }));
    add(C('Ambush them from the shadows', Object.assign(stat('stealth', room.ambushDC), { kind: 'check', style: 'stealth', s: { combat: { enemies: room.enemies, surprise: 'player' } }, f: { combat: { enemies: room.enemies, surprise: 'enemy' } }, ok: 'You choose your moment, and spring.', no: 'A scrape of your boot gives you away. They are already turning.' })));
    if (room.intelligent) add(C('Talk your way past', Object.assign(stat(hero.cls === 'rogue' || hero.cls === 'wizard' ? 'deception' : 'persuasion', room.talkDC), { kind: 'check', style: 'charm', drive: 'curiosity', s: { clue: 1, flags: ['skipped_' + room.id], deed: 'Talked past a patrol', att: {} }, f: { combat: { enemies: room.enemies, surprise: 'enemy' } }, ok: 'They hesitate, then lower their weapons. You walk past, and learn a little along the way.', no: 'They do not believe a word. Steel clears leather.' })));
    else if (room.undead) add(C('Drive them back with faith or will', Object.assign(stat('religion', room.talkDC), { kind: 'check', style: 'lore', s: { flags: ['skipped_' + room.id], deed: 'Turned aside the restless dead' }, f: { combat: { enemies: room.enemies, surprise: 'enemy' } }, ok: 'You speak a word of binding, and they fall back from you.', no: 'The dead do not care for your words.' })));
    else add(C('Lure them off with a distraction', Object.assign(stat('survival', room.talkDC), { kind: 'check', style: 'careful', s: { flags: ['skipped_' + room.id], deed: 'Lured beasts away' }, f: { combat: { enemies: room.enemies, surprise: 'enemy' } }, ok: 'A thrown stone and a whistle send them chasing shadows.', no: 'They catch your scent and turn as one.' })));
    add(C('Slip past without a fight', Object.assign(stat('stealth', room.slipDC + 1), { kind: 'check', style: 'stealth', s: { flags: ['skipped_' + room.id], deed: 'Slipped past a danger' }, f: { combat: { enemies: room.enemies, surprise: 'enemy' } }, ok: 'You find the edge of the shadows and follow it past.', no: 'Just as you are nearly through, one of them looks right at you.' })));
  } else if (T === 'trap') {
    const base = room.dc;
    add(C('Disarm it carefully', Object.assign(stat('sleight', fitDC(room, 'sleight', base)), { kind: 'check', style: 'finesse', s: { items: [pickR(['oil', 'smoke'])], deed: 'Disarmed a trap' }, f: genericFx(room).f, ok: 'The mechanism clicks into rest. You salvage something useful from the parts.', no: 'The mechanism snaps.' })));
    add(C('Study it, then pass safely', Object.assign(stat('investigation', fitDC(room, 'investigation', base)), { kind: 'check', style: 'careful', drive: 'curiosity', s: { clue: 1 }, f: genericFx(room).f, ok: 'You read the trap like a book and slip by.', no: 'You read it wrong.' })));
    add(C('Dash through', Object.assign(stat('acrobatics', fitDC(room, 'acrobatics', base + 1)), { kind: 'check', style: 'bold', drive: 'glory', s: { deed: 'Dashed past a trap' }, f: genericFx(room).f, ok: 'You bound through before it can react.', no: 'You are half a heartbeat too slow.' })));
    add(C('Force through the pain', { kind: 'auto', drive: 'glory', s: { hp: -Math.max(1, Math.floor(rollDice(room.dice[0], room.dice[1]).total / 2)), dmgType: room.dmgType, alert: 1 }, ok: 'You grit your teeth and take it on the chin. It is not pretty, but it is quick.' }));
  } else if (T === 'puzzle') {
    const g = genericFx(room);
    add(C('Work the mechanism (' + SKILLS[room.skill].n + ')', Object.assign(stat(room.skill, room.dc), { kind: 'check', style: 'lore', drive: 'curiosity', s: g.s, f: g.f, ok: 'The last piece turns, and the way opens with a sigh of old air.', no: 'The mechanism snaps back, hard.' })));
    add(C('Think it through (' + SKILLS[room.alt].n + ')', Object.assign(stat(room.alt, room.dc + 1), { kind: 'check', style: 'careful', s: g.s, f: g.f, ok: 'The solution comes to you sideways, and it fits.', no: 'You are sure you have got it. You have not.' })));
    add(C('Break it open by force', Object.assign(stat('athletics', room.dc + 3), { kind: 'check', style: 'force', drive: 'glory', s: { flags: ['cleared_' + room.id], deed: 'Smashed through a puzzle' }, f: { hp: g.f.hp, dmgType: 'bludgeoning', alert: 1, clock: 1 }, ok: 'With a crack and a shudder, the barrier breaks.', no: 'The barrier holds, and the noise rolls through the halls.' })));
  } else if (T === 'hazard') {
    const g = genericFx(room);
    add(C('Cross carefully (' + SKILLS[room.skill].n + ')', Object.assign(stat(room.skill, fitDC(room, room.skill, room.dc)), { kind: 'check', style: 'careful', s: g.s, f: g.f, ok: 'Slow and steady gets you across.', no: 'It does not go as planned.' })));
    add(C('Find another way (' + SKILLS[room.alt].n + ')', Object.assign(stat(room.alt, fitDC(room, room.alt, room.dc + 1)), { kind: 'check', style: 'careful', s: { flags: ['cleared_' + room.id], clue: 1 }, f: g.f, ok: 'You find a safer path, and a hint of what lies ahead.', no: 'The path you chose was no safer.' })));
    add(C('Charge across', Object.assign(stat('athletics', room.dc + 2), { kind: 'check', style: 'bold', drive: 'glory', s: { flags: ['cleared_' + room.id], deed: 'Charged across a hazard' }, f: g.f, ok: 'You hit the far side at a run.', no: 'You get about halfway before it all goes wrong.' })));
  } else if (T === 'lore') {
    const g = genericFx(room);
    add(C('Study it closely', Object.assign(stat(room.good[0], room.dc), { kind: 'check', style: 'lore', drive: 'curiosity', s: g.s, f: g.f, ok: 'It tells you more than its makers intended.', no: 'It tells you nothing, and the minutes pass.' })));
    add(C('Read between the lines (' + SKILLS[room.good[1] || 'insight'].n + ')', Object.assign(stat(room.good[1] || 'insight', room.dc + 1), { kind: 'check', style: 'careful', s: { clue: 1, flags: ['lore_deep'] }, f: { clock: 1 }, ok: 'You catch what was written between the lines.', no: 'You are chasing shadows.' })));
    add(C('Pocket anything valuable and move on', { kind: 'auto', drive: 'greed', s: { gold: rollDice(1, 6).total * (L + 1) }, ok: 'You do not stay to read. A few coins and trinkets find their way into your pack.' }));
  } else if (T === 'treasure') {
    const base = room.dc;
    const key = flag('silver_key');
    add(C('Open it carefully', Object.assign(stat('sleight', fitDC(room, 'sleight', base)), { kind: 'check', style: 'finesse', drive: 'greed', s: treasureFx(room), f: genericFx(room).f, ok: 'The lid lifts with a satisfied sigh.', no: 'Something goes wrong.' })));
    add(C('Check for traps first', Object.assign(stat('investigation', fitDC(room, 'investigation', base)), { kind: 'check', style: 'careful', s: Object.assign(treasureFx(room), { clue: 0 }), f: { clock: 1 }, ok: 'You spot the trigger and avoid it. Safe, but it took time.', no: 'You find nothing, and spend a long time finding it.' })));
    add(C('Smash it open', Object.assign(stat('athletics', base + 1), { kind: 'check', style: 'force', s: Object.assign(treasureFx(room), { alert: 1 }), f: { alert: 1, hp: room.trapped ? genericFx(room).f.hp : 0, dmgType: 'piercing' }, ok: 'It splits with a crash that rings through the halls.', no: 'The lock holds and your hands sting.' })));
    add(C('Leave it. Not worth the risk', { kind: 'auto', drive: 'mercy', s: {}, ok: 'You leave it where it lies, and the dungeon keeps its secret.' }));
  } else if (T === 'rest') {
    add(C('Rest properly (+60% HP, abilities return)', { kind: 'auto', s: { rest: 0.6, clock: 2 }, ok: 'You settle in and sleep fitfully. The dungeon waits.' }));
    add(C('Rest lightly, keep watch', { kind: 'auto', s: { rest: 0.3, clock: 1, alert: -1 }, ok: 'You doze with one eye open. Not much, but enough.' }));
    if (room.kind === 'shrine') add(C('Pray at the shrine', Object.assign(stat('religion', dcFor(L, 0)), { kind: 'check', style: 'lore', s: { fortune: 2, rest: 0.2 }, f: { clock: 1 }, ok: 'Something old and kind answers. You feel lucky, and a little less alone.', no: 'Silence answers. It is a very large silence.' })));
    else add(C('Tend wounds and tinker with gear', Object.assign(stat('medicine', dcFor(L, 0)), { kind: 'check', style: 'careful', s: { rest: 0.5, clock: 1 }, f: { rest: 0.2, clock: 1 }, ok: 'You patch yourself up properly.', no: 'You do what you can.' })));
    add(C('Press on without resting', { kind: 'auto', s: {}, ok: 'You do not stop. There is not time.' }));
  } else if (T === 'social') {
    buildSocial(room, ch, add);
  } else if (T === 'twist') {
    buildTwist(room, ch, add);
  } else if (T === 'boss') {
    buildBoss(room, ch, add);
  }
  return ch;
}

function buildSocial(room, ch, add) {
  const npc = npcOf(room.npc);
  const L = hero.level;
  const id = npc.id;
  const role = room.role;
  if (role === 'prisoner') {
    add(C('Free ' + npc.name + ' quietly (Sleight of Hand)', Object.assign(stat('sleight', room.dcHelp), { kind: 'check', style: 'finesse', drive: 'mercy', s: { att: { ally: 2 }, ally: 'join', deed: 'Freed ' + npc.name }, f: { att: { ally: 1 }, alert: 1, ally: 'join', deed: 'Freed ' + npc.name + ' (loudly)' }, ok: 'The ropes fall away. ' + npc.name + ' rubs wrists and grins at you.', no: 'You saw clumsily at the ropes, and the noise carries. But ' + npc.name + ' is free.' })));
    add(C('Cut ' + npc.name + ' loose and ask what ' + npc.pr.o + ' knows', Object.assign(stat('persuasion', room.dcTalk), { kind: 'check', style: 'charm', drive: 'curiosity', s: { att: { ally: 2 }, ally: 'join', clue: 1, deed: 'Freed ' + npc.name + ' and learned the layout' }, f: { att: { ally: 1 }, ally: 'join', deed: 'Freed ' + npc.name }, ok: npc.name + ' tells you what ' + npc.pr.o + ' saw, and which doors to avoid.', no: npc.name + ' is too shaken to talk, but is grateful.' })));
    add(C('Tell ' + npc.name + ' to wait here, safe', { kind: 'auto', drive: 'mercy', s: { att: { ally: 1 }, flags: ['ally_left_safe'], deed: 'Freed ' + npc.name + ' and sent ' + npc.pr.o + ' to safety' }, fx: { ally: 'leave' }, ok: 'You free the captive and send ' + npc.pr.o + ' to the exit. ' + npc.name + ' wants to come but does not argue.' }));
    ch.forEach((c) => { if (c.s && c.s.ally === 'join') { /* ally joins */ } });
    add(C('Leave ' + npc.name + ' for now. You cannot spare the time', { kind: 'auto', drive: 'greed', s: { att: { ally: -1 }, flags: ['ally_abandoned'], deed: 'Left ' + npc.name + ' bound', cb: npc.name + ' will remember you walked away.' }, ok: 'You turn from the pleading eyes and press deeper.' }));
    return;
  }
  const dcH = room.dcHelp, dcT = room.dcTalk, dcL = room.dcLie, dcI = room.dcThreat;
  const nm = npc.name;
  const help = { prisoner: 'Free', deserter: 'Reassure', scholar: 'Lift the shelf off', rival: 'Offer to share the spoils', trader: 'Buy supplies', returning: 'Ask for help' }[role] || 'Help';
  if (role === 'returning' && npc.from === 'betrayer') {
    add(C('Make ' + nm + ' answer for it', { kind: 'combat', drive: 'vengeance', fx: { combat: { enemies: ['traitor'], ret: 'ret' }, att: { ret: -3 }, flags: ['ret_fought'], deed: 'Faced ' + nm + ' at last' }, ok: 'You draw before ' + nm + ' can speak.' }));
    add(C('Demand to know why', Object.assign(stat('intimidation', dcI), { alt: 'insight', kind: 'check', style: 'force', drive: 'curiosity', s: { clue: 2, settle: 'answered', att: { ret: 0 }, deed: 'Made ' + nm + ' explain' }, f: { att: { ret: -2 }, alert: 1 }, ok: nm + ' stammers out the truth: who paid, and what waits ahead.', no: nm + ' spits at your feet and shouts for the others. That carried.' })));
    add(C('Offer ' + nm + ' a second chance', Object.assign(stat('persuasion', dcT + 1), { alt: 'insight', kind: 'check', style: 'charm', drive: 'mercy', s: { clue: 1, settle: 'forgiven', att: { ret: 1 }, deed: 'Gave ' + nm + ' a second chance' }, f: { att: { ret: -1 } }, ok: nm + ' looks at you for a long time. "I owe you more than I can pay. Let me start with what I know."', no: nm + ' flinches from the offer and backs into the dark.' })));
    add(C('Walk away without a word', { kind: 'auto', s: { att: { ret: -1 }, deed: 'Walked away from ' + nm }, ok: 'You turn your back on ' + nm + '. It costs you something to do it.' }));
    return;
  }
  if (role === 'returning') {
    add(C('Ask ' + nm + ' for help', Object.assign(stat('persuasion', dcH - 2), { kind: 'check', style: 'charm', drive: 'mercy', s: { att: { ret: 1 }, clue: 2, items: ['potion'], deed: 'Allied with ' + nm + ' again' }, f: { att: { ret: -1 }, clue: 1 }, ok: nm + ' grins grimly. "You did right by me. Here is what I know."', no: nm + ' hesitates. "I am sorry. Some debts do not wash clean."' })));
    add(C('Ask ' + nm + ' to fight beside you', Object.assign(stat('persuasion', dcT), { kind: 'check', style: 'charm', s: { att: { ret: 1 }, ally: 'join_ret', deed: nm + ' fights beside you' }, f: { att: { ret: 0 } }, ok: nm + ' nods once and falls in at your side.', no: nm + ' shakes their head. "Not this time."' })));
    add(C('Hear what ' + nm + ' has seen', { kind: 'auto', drive: 'curiosity', s: { clue: 1, att: { ret: 1 } }, ok: nm + ' lowers their voice and tells you what they saw.' }));
    add(C('Turn them away', { kind: 'auto', s: { att: { ret: -1 }, cb: nm + ' watches you go.' }, ok: 'You tell them to leave, and they do.' }));
    return;
  }
  add(C(help + ' (' + (role === 'trader' ? 'costs gold' : 'Medicine/Persuasion') + ')', role === 'trader'
    ? { kind: 'trade', drive: 'greed', cost: 20 + 5 * L, s: { att: { [id]: 1 }, items: ['potion', 'potion'], deed: 'Traded with ' + nm }, ok: nm + ' counts your coin and hands over two potions with a wink.', no: 'You do not have the coin.' }
    : Object.assign(stat(role === 'scholar' ? 'athletics' : 'persuasion', dcH), { kind: 'check', style: 'charm', drive: 'mercy', s: { att: { [id]: 2 }, clue: 1, items: ['potion'], deed: 'Helped ' + nm }, f: { att: { [id]: 0 } }, ok: nm + ' is grateful and shares what they know.', no: 'Your help is clumsy. They thank you anyway.' })));
  add(C('Ask what ' + nm + ' knows', Object.assign(stat('insight', dcT), { kind: 'check', style: 'careful', drive: 'curiosity', s: { clue: 1, att: { [id]: 1 } }, f: { att: { [id]: -1 } }, ok: 'You ask the right questions, and the answers come.', no: nm + ' stops talking, wary.' })));
  add(C('Threaten ' + nm + ' for information', Object.assign(stat('intimidation', dcI), { kind: 'check', style: 'force', drive: 'vengeance', s: { clue: 2, att: { [id]: -2 }, alert: 1 }, f: { att: { [id]: -2 }, alert: 1 }, ok: nm + ' pales and talks fast.', no: nm + ' scoffs, then shouts. That carried.' })));
  if (role === 'rival' || role === 'deserter') add(C('Cut them down', { kind: 'combat', drive: 'vengeance', fx: { combat: { enemies: [role === 'rival' ? 'bandit' : 'cultist'], surprise: 'player' }, att: { [id]: -3 }, deed: 'Struck down ' + nm, flags: ['killed_' + id] }, ok: 'You strike without warning.' }));
  add(C('Leave them be', { kind: 'auto', drive: 'mercy', s: { att: { [id]: 0 } }, ok: 'You nod and move on.' }));
}

const TWIST_TEXT = {
  ally_betrays: (a) => 'You catch a low voice up ahead, and stop. It is ' + a.name + ', talking with a hooded figure. "...the hero walks where we want," ' + a.name + ' murmurs. "Soon."',
  patron_lied: (adv) => 'A crumpled letter lies on a dead courier. It bears ' + adv.patron.name + "'s seal. It is addressed to " + adv.villain.name + ": \"Do not fail me. When it is done, I will have what the village never could.\"",
  villain_sympathetic: (adv) => 'A ledger on a table lays it bare. ' + adv.villain.name + ' ' + adv.villain.motive + ', and in the margins of these pages there is no cruelty, only grief and desperation.',
  mcguffin_cursed: (adv) => 'You have found ' + adv.mcg + '. It is warm in your hand, too warm. Faint whispers rise from it, offering you things. You understand now why the villain wanted it.',
};
function buildTwist(room, ch, add) {
  const adv = run.adv;
  const t = adv.twist.type;
  const L = hero.level;
  const a = adv.npcs.ally;
  const dc = dcFor(L, 1);
  if (t === 'ally_betrays' && a) {
    add(C('Confront ' + a.name + ' now', Object.assign(stat('insight', dc), { alt: 'persuasion', kind: 'check', style: 'charm', drive: 'vengeance', s: { att: { ally: 1 }, flags: ['twist_confronted', 'ally_redeemed'], clue: 1, deed: 'Confronted ' + a.name + ' and turned ' + a.pr.o + ' back' }, f: { flags: ['twist_confronted'], ally: 'betray', deed: a.name + ' fled to the enemy', cb: a.name + ' will be waiting for you.' }, ok: a.name + ' breaks down. "They have my family. I did not know how else." You offer another way, and they take it.', no: a.name + ' bolts into the dark.' })));
    add(C('Say nothing, and keep watching', { kind: 'auto', drive: 'curiosity', s: { flags: ['twist_watching'], clue: 1, att: { ally: -1 }, deed: 'Kept quiet about ' + a.name + "'s secret" }, ok: 'You step back and let them finish. You know now. They do not know that you know.' }));
    add(C('Strike first', { kind: 'combat', drive: 'vengeance', fx: { combat: { enemies: ['traitor'], surprise: 'player' }, ally: 'betray', flags: ['twist_confronted', 'ally_slain'], deed: 'Killed ' + a.name + ' for betraying you' }, ok: 'You act before thought catches up.' }));
  } else if (t === 'patron_lied') {
    add(C('Decide to see this through for the village anyway', { kind: 'auto', drive: 'glory', s: { flags: ['sided_patron'], deed: 'Stayed loyal to ' + adv.patron.name + ' despite the letter' }, ok: 'You fold the letter into your pack. Whatever ' + adv.patron.name + ' wants, someone else is more dangerous here.' }));
    add(C('Decide to hear ' + adv.villain.name + ' out', { kind: 'auto', drive: 'curiosity', s: { flags: ['sided_villain', 'parley_open'], clue: 1, deed: 'Doubted ' + adv.patron.name }, ok: 'You tuck the letter away. You have questions, and the one who can answer them is at the end of this hall.' }));
    add(C('Study the letter closely', Object.assign(stat('investigation', dc), { kind: 'check', style: 'lore', drive: 'curiosity', s: { clue: 2, flags: ['patron_truth'], deed: 'Uncovered ' + adv.patron.name + "'s plan" }, f: { clock: 1 }, ok: 'There is more here: a second hand, a hidden line. You now know exactly what ' + adv.patron.name + ' means to do.', no: 'The ink has run, and you cannot make out the rest.' })));
  } else if (t === 'villain_sympathetic') {
    add(C('Seek a parley with ' + adv.villain.name, { kind: 'auto', drive: 'mercy', s: { flags: ['parley_open', 'sided_villain'], clue: 1, deed: 'Resolved to talk to ' + adv.villain.name }, ok: 'You close the ledger, gently. There may be another way to end this.' }));
    add(C('Harden yourself. It does not change what they did', { kind: 'auto', drive: 'vengeance', s: { flags: ['ruthless'], fortune: 1, deed: 'Vowed to end ' + adv.villain.name }, ok: 'Sorrow does not undo a single grave. You set your jaw.' }));
    add(C('Dig deeper into their story', Object.assign(stat('history', dc), { alt: 'investigation', kind: 'check', style: 'lore', drive: 'curiosity', s: { clue: 2, flags: ['villain_truth'], deed: 'Learned the truth about ' + adv.villain.name }, f: { clock: 1 }, ok: 'The pieces come together. You understand them now, and what they truly need.', no: 'The ledger is a tangle of numbers and names, and you cannot follow it.' })));
  } else if (t === 'mcguffin_cursed') {
    add(C('Destroy it', Object.assign(stat('arcana', dc), { alt: 'religion', kind: 'check', style: 'lore', drive: 'mercy', s: { flags: ['relic_destroyed'], clue: 1, deed: 'Destroyed ' + adv.mcg }, f: { curse: 2, flags: ['relic_destroyed'], deed: 'Destroyed ' + adv.mcg + ' at a cost' }, ok: 'The relic cracks, and the whispers shriek and fade.', no: 'The relic dies, but not quietly. Something lashes at you as it goes.' })));
    add(C('Keep it, and use it', { kind: 'auto', drive: 'greed', s: { flags: ['relic_kept'], curse: 2, fortune: 2, deed: 'Kept ' + adv.mcg }, ok: 'Warm power flows into your hands. It will cost you, later.' }));
    add(C('Seal it in cloth and lead', Object.assign(stat('sleight', dc), { kind: 'check', style: 'finesse', s: { flags: ['relic_sealed'], deed: 'Sealed away ' + adv.mcg }, f: { hp: -Math.max(2, L + 1), dmgType: 'necrotic', flags: ['relic_sealed'] }, ok: 'You wrap it tight and bind it with lead-thread. It quiets.', no: 'It bites at your fingers as you bind it.' })));
  }
}

function buildBoss(room, ch, add) {
  const adv = run.adv;
  const L = hero.level;
  const dcB = dcFor(L, 1);
  const boss = BOSS[adv.villain.bossKey];
  const nm = adv.villain.name;
  const parleyOpen = flag('parley_open') || led().clues >= 3;
  add(C('Face them. Draw steel', { kind: 'combat', drive: 'glory', fx: { combat: { boss: true, surprise: null } }, ok: 'You step into the light.' }));
  if (flag('sidedoor')) add(C('Come in by the side door, strike unseen', Object.assign(stat('stealth', dcB - 1), { kind: 'check', style: 'stealth', s: { combat: { boss: true, surprise: 'player' }, deed: 'Ambushed ' + nm }, f: { combat: { boss: true, surprise: null } }, ok: 'The side door yields without a sound. You are inside, and no one has seen you.', no: 'The hinge shrieks. You are in, but so is the alarm.' })));
  add(C('Call out and parley', Object.assign(stat('persuasion', parleyOpen ? dcB - 1 : dcB + 3), { alt: 'insight', kind: 'check', style: 'charm', drive: 'mercy', s: { setEnd: 'parley', flags: ['parley_won'], deed: 'Talked ' + nm + ' down' }, f: { combat: { boss: true, surprise: 'enemy' }, deed: 'Parley with ' + nm + ' failed' }, ok: parleyOpen ? 'You lay out what you know. ' + nm + ' hesitates, and the weapon lowers.' : 'It is a long shot, and you have only words. They are enough.', no: nm + ' laughs once, bitterly. "Too late for words."' })));
  if (led().clues >= 2) add(C('Strike at their weak point', Object.assign(stat('arcana', dcB), { alt: 'investigation', kind: 'check', style: 'lore', drive: 'curiosity', s: { combat: { boss: true, surprise: null, weak: true }, deed: 'Exploited ' + nm + "'s weakness" }, f: { combat: { boss: true, surprise: null } }, ok: 'Everything you learned along the way converges on one mark. You know where it hurts.', no: 'You try to apply what you learned, but the pieces do not fit.' })));
  if (adv.hook === 'recover' && !flag('relic_destroyed')) add(C('Grab ' + adv.mcg + ' and run', Object.assign(stat('sleight', dcB + 1), { kind: 'check', style: 'finesse', drive: 'greed', s: { setEnd: 'snatch', flags: ['relic_taken'], deed: 'Snatched ' + adv.mcg + ' from under ' + nm + "'s nose" }, f: { combat: { boss: true, surprise: 'enemy' } }, ok: 'A distraction, a quick hand, and the prize is yours.', no: 'Your fingers close on the prize, and ' + nm + ' catches your wrist.' })));
}
