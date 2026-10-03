/* ---------- combat ---------- */
function rawD20(mode) {
  const a = d(20), b = mode ? d(20) : null;
  if (!mode) return { r: a, all: [a] };
  return { r: mode > 0 ? Math.max(a, b) : Math.min(a, b), all: [a, b] };
}
function modeOf(adv, dis) { return adv && !dis ? 1 : dis && !adv ? -1 : 0; }

function makeMon(key) {
  const m = MON[key];
  const e = { key, n: m.n, role: m.n, ac: m.ac, hp: m.hp, max: m.hp, atk: m.atk, dmg: m.dmg.slice(), multi: m.multi || 1, fl: m.fl.slice(), kind: m.kind, thr: m.thr, cond: {}, boss: false };
  if (key === 'traitor' && run.adv.npcs.ally) e.n = run.adv.npcs.ally.name;
  return e;
}
function makeBoss(key, mods) {
  const b = BOSS[key];
  const L = hero.level;
  const dm = { story: 0.8, standard: 1, grim: 1.2 }[run.adv.difficulty] || 1;
  const hp = Math.max(16, Math.round(b.hp * (0.35 + 0.13 * L) * (mods.hpMul || 1) * dm));
  let ac = b.ac + Math.floor((L - 3) / 2) - 1 - (mods.weak ? 2 : 0);
  const bonus = b.dmg[2] - 1 + Math.floor((L - 3) / 2) + (mods.dmg || 0) + (run.adv.villain.kin ? 1 : 0);
  return {
    key, n: run.adv.villain.name, role: b.n, ac: Math.max(9, ac), hp: mods.weak ? Math.round(hp * 0.85) : hp, max: hp, atk: Math.max(3, b.atk + (L - 3)),
    dmg: [b.dmg[0], b.dmg[1], Math.max(0, bonus)], multi: L >= 4 ? (b.multi || 1) : 1, fl: b.fl.slice(), kind: b.kind, thr: 10, cond: {}, boss: true,
    sp: b.sp ? Object.assign({}, b.sp, b.sp.k === 'summon' ? { n: L >= 4 ? b.sp.n : 1 } : { dice: [L >= 3 ? b.sp.dice[0] : 2, b.sp.dice[1]] }) : null,
  };
}
function livingEnemies() { return run.combat.enemies.filter((e) => e.hp > 0); }
function enemyById(id) { return run.combat.enemies.find((e) => e.id === id && e.hp > 0); }

function startCombat(spec, room) {
  const adv = run.adv;
  const enemies = [];
  const cb = run.combat = {
    enemies, n: 0, round: 1, boss: !!spec.boss, roomId: room ? room.id : run.roomId, acted: { action: false, bonus: false }, menu: null,
    pc: { poisoned: 0, restrained: false, frightened: 0, shield: false, defending: false, hidden: false, firstAdv: spec.surprise === 'player' || !!spec.weak, sneakUsed: false },
    skip: spec.surprise === 'player', weak: !!spec.weak, startThr: 0, allyHealed: false,
  };
  const add = (e) => { e.id = 'e' + cb.n++; enemies.push(e); cb.startThr += e.thr || 3; return e; };
  if (spec.boss) {
    const prep = run.cur && run.cur.prep ? run.cur.prep : bossPrep();
    const mods = Object.assign({}, prep.mods, spec.weak ? { weak: true } : {});
    add(makeBoss(adv.villain.bossKey, mods));
    (mods.extra || []).forEach((k) => add(makeMon(k)));
    if (mods.traitor && adv.npcs.ally) { const t = add(makeMon('traitor')); t.traitor = true; if (flag('twist_watching')) t.hp = Math.ceil(t.hp * 0.6); }
  } else {
    spec.enemies.forEach((k) => {
      const e = add(makeMon(k));
      const r = spec.ret && k === 'traitor' ? adv.npcs[spec.ret] : null;
      if (r) { e.n = r.name; e.retId = spec.ret; }
    });
  }
  run.phase = 'combat';
  say('head', '⚔ Combat');
  say('sys', 'Foes: ' + enemies.map((e) => e.n + ' (AC ' + e.ac + ', ' + e.hp + ' HP)').join(', ') + '.');
  narr(spec.boss ? 'Steel and spell-light fill the chamber. There is no more room for words.' : 'The moment breaks. Weapons are drawn.', factsFor('combat_start', 'Combat begins against ' + enemyNames(enemies.map((e) => e.key)) + '.', { enemies: enemyNames(enemies.map((e) => e.key)) }));
  let first = 'player';
  if (spec.surprise === 'enemy') { first = 'enemy'; say('sys', 'They strike first!'); }
  else if (spec.surprise === 'player') say('sys', 'You have the drop on them. You act first, with advantage.');
  else {
    const mine = heroDice(1, 20, 'Initiative (' + sgn(aMod(hero, 'dex')) + ' added for you)')[0] + aMod(hero, 'dex');
    const theirs = d(20) + 1 + (led().alert >= 4 ? 3 : 0);
    first = mine >= theirs ? 'player' : 'enemy';
    say('roll', 'Initiative: ' + mine + ' vs ' + theirs + ' — ' + (first === 'player' ? 'you go first' : 'they go first'), { ok: first === 'player' });
  }
  if (cb.weak) say('sys', 'You know where it is weak: your first strike has advantage.');
  if (first === 'enemy') {
    enemyPhase();
    if (!run.combat) return;
    endRound(true);
  }
  save();
  changed();
}

function dmgEnemy(e, amt, label) {
  e.hp -= amt;
  if (e.cond.asleep) e.cond.asleep = 0;
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  const cb = run.combat;
  say('sys', fill(pickR(TPL.die), { T: cap(e.n) }));
  led().kills++;
  if (e.traitor) { setFlag('ally_slain'); const a = run.adv.npcs.ally; if (a) a.alive = false; deed('Killed the traitor ' + e.n); }
  if (e.retId) { const r = run.adv.npcs[e.retId]; if (r) r.alive = false; setFlag('ret_slain'); deed('Settled the score with ' + e.n); }
  if (e.key === 'traitor') settleBetrayer(e.n, 'slain');
  if (e.boss) {
    cb.enemies.forEach((x) => { if (x !== e && x.hp > 0) { x.hp = 0; } });
  }
  cb.enemies = cb.enemies.filter((x) => x.hp > 0);
}
function checkWin() {
  const cb = run.combat;
  if (!cb) return true;
  if (cb.enemies.filter((e) => e.hp > 0).length === 0) { winCombat(); return true; }
  return false;
}

/* ----- hero strikes ----- */
function strike(e, o) {
  const cb = run.combat, pc = cb.pc;
  let adv = 0, dis = 0;
  if (pc.hidden || pc.firstAdv || (e.cond.asleep > 0)) adv = 1;
  if (pc.poisoned > 0 || pc.frightened > 0 || pc.restrained) dis = 1;
  const mode = modeOf(adv, dis);
  const x = d20roll(mode, (o.name === 'Attack' ? 'Weapon' : o.name) + ' attack (' + sgn(o.bonus) + ' added for you)');
  const total = x.r + o.bonus;
  const crit = x.r === 20;
  const hit = crit || (x.r !== 1 && total >= e.ac);
  const dice = x.all.length > 1 ? 'd20 [' + x.all.join(', ') + '→' + x.r + ']' : 'd20 [' + x.r + ']';
  const chip = o.name + ': ' + dice + ' ' + sgn(o.bonus) + ' = ' + total + ' vs AC ' + e.ac + (crit ? ' — CRITICAL HIT' : hit ? ' — hit' : ' — miss');
  say('roll', chip, { ok: hit });
  if (!hit) { say('sys', fill(pickR(TPL.miss), { t: e.n, T: cap(e.n) })); return false; }
  let dm = rollDice(o.dice[0] * (crit ? 2 : 1), o.dice[1], o.dice[2] || 0, (o.name === 'Attack' ? 'Weapon' : o.name) + ' damage' + (crit ? ' (critical: dice doubled)' : '')).total;
  let sneak = 0;
  if (o.sneakOk && hero.cls === 'rogue' && !pc.sneakUsed && (mode > 0 || allyNow())) {
    sneak = rollDice(Math.ceil(hero.level / 2) * (crit ? 2 : 1), 6, 0, 'Sneak Attack damage').total;
    pc.sneakUsed = true;
  }
  const total2 = dm + sneak;
  say('sys', fill(pickR(TPL.hit), { t: e.n }) + ' ' + total2 + ' damage' + (sneak ? ' (including ' + sneak + ' Sneak Attack)' : '') + '.');
  dmgEnemy(e, total2);
  return true;
}
function weaponStrike(e) {
  const w = CLASSES[hero.cls].wpn;
  const bonusDmg = hero.cls === 'fighter' ? 2 : hero.cls === 'cleric' ? 1 : 0;
  return strike(e, { name: 'Attack', bonus: atkBonus(hero), dice: [1, w.die, aMod(hero, w.abil) + bonusDmg], sneakOk: true });
}
function pickAlive(prefId) {
  const cb = run.combat;
  return enemyById(prefId) || cb.enemies.find((e) => e.hp > 0) || null;
}
function afterAttackFlags() {
  const pc = run.combat && run.combat.pc;
  if (pc) { pc.hidden = false; pc.firstAdv = false; }
}

function spendRes(res) {
  if (!res) return true;
  if ((hero.res[res] || 0) < 1) return false;
  hero.res[res]--;
  return true;
}

function cAct(name, targetId) {
  const cb = run.combat;
  if (!cb || run.phase !== 'combat') return;
  cb.menu = null;
  const acted = cb.acted;
  const L = hero.level;
  if (name === 'attack') {
    if (acted.action) return;
    let e = pickAlive(targetId);
    if (!e) return;
    weaponStrike(e);
    if (run.combat && hero.cls === 'fighter' && L >= 5 && run.combat.enemies.length) { const e2 = pickAlive(targetId); if (e2) { say('sys', 'Extra Attack!'); weaponStrike(e2); } }
    if (!run.combat) return;
    afterAttackFlags();
    acted.action = true;
    if (checkWin()) return;
    endPlayerTurn();
    return;
  }
  if (name === 'defend') {
    if (acted.action) return;
    acted.action = true;
    cb.pc.defending = true;
    say('sys', 'You take a defensive stance. Attacks against you have disadvantage until your next turn.');
    endPlayerTurn();
    return;
  }
  if (name === 'flee') {
    if (acted.action) return;
    if (cb.boss) { say('sys', 'There is nowhere to run. Not from this.'); changed(); return; }
    acted.action = true;
    const dc = 10 + Math.min(4, livingEnemies().length);
    const res = doCheck('acrobatics', dc, 0);
    say('roll', rollChip(res), { ok: res.ok });
    if (res.ok) { fled('You break away and escape.'); return; }
    say('sys', 'They cut you off.');
    endPlayerTurn();
    return;
  }
  if (name.startsWith('i:')) { useCombatItem(name.slice(2), targetId); return; }
  if (name.startsWith('p:')) { usePower(name.slice(2), targetId); return; }
}
function fled(msg) {
  const cb = run.combat;
  const room = run.adv.rooms[cb.roomId];
  run.combat = null;
  run.phase = 'room';
  say('sys', msg);
  bumpAlert(1);
  deed('Fled from ' + (room ? room.name : 'a fight'));
  setFlag('fled_' + cb.roomId);
  narr('You scramble clear, lungs burning, leaving the fight behind.', factsFor('flee', 'You escape the fight and leave your foes behind.'));
  run.cur.resolved = true;
  run.cur.choices = [C('Continue deeper', { id: 'continue', kind: 'next' })];
  save();
  changed();
}

function useCombatItem(id, targetId) {
  const cb = run.combat;
  const acted = cb.acted;
  if ((hero.inv[id] || 0) < 1) return;
  if (id === 'potion') {
    if (acted.bonus) return;
    hero.inv.potion--;
    const r = rollDice(2, 4, 2, 'Healing potion');
    const g = mend(r.total);
    acted.bonus = true;
    say('sys', 'You drink a potion: +' + g + ' HP (' + hero.hp + '/' + hero.hpMax + ').');
    changed();
    return;
  }
  if (acted.action) return;
  if (id === 'smoke') {
    hero.inv.smoke--;
    acted.action = true;
    if (cb.boss) { say('sys', 'The smoke billows. You vanish from view, and the fight eases for a moment.'); cb.pc.hidden = true; endPlayerTurn(); return; }
    fled('You smash the smoke bomb and slip away in the haze.');
    return;
  }
  const e = pickAlive(targetId);
  if (!e) return;
  hero.inv[id]--;
  acted.action = true;
  if (id === 'oil') {
    strike(e, { name: 'Oil flask', bonus: aMod(hero, 'dex') + prof(hero), dice: [2, 6, 0], sneakOk: false });
  } else if (id === 'scroll') {
    const dm = rollDice(3, 6, 0, 'Scroll of fire').total;
    say('sys', 'The scroll bursts into flame: ' + dm + ' fire damage to ' + e.n + '.');
    dmgEnemy(e, dm);
  }
  afterAttackFlags();
  if (checkWin()) return;
  endPlayerTurn();
}

function usePower(id, targetId) {
  const cb = run.combat, acted = cb.acted, pc = cb.pc;
  const L = hero.level;
  const p = powerList(hero).find((x) => x.id === id);
  if (!p) return;
  if (p.t === 'action' && acted.action) return;
  if (p.t === 'bonus' && acted.bonus) return;
  if (p.res && (hero.res[p.res] || 0) < 1) { say('sys', 'You have none of that left.'); changed(); return; }
  if (p.tgt && !pickAlive(targetId)) return;
  const e = p.tgt ? pickAlive(targetId) : null;
  spendRes(p.res);
  if (p.t === 'action') acted.action = true;
  if (p.t === 'bonus') acted.bonus = true;
  const sm = spellMod(hero);
  let usedAction = p.t === 'action';
  switch (id) {
    case 'second_wind': { const r = rollDice(1, 10, L, 'Second Wind healing'); const g = mend(r.total); say('sys', 'Second Wind: +' + g + ' HP (' + hero.hp + '/' + hero.hpMax + ').'); break; }
    case 'action_surge': { acted.action = false; say('sys', 'Action Surge! You take another action.'); usedAction = false; break; }
    case 'hide': {
      const dc = 12 + Math.floor(L / 2);
      const res = doCheck('stealth', dc, 0);
      say('roll', rollChip(res), { ok: res.ok });
      if (res.ok) { pc.hidden = true; say('sys', 'You vanish from sight. Your next attack has advantage and Sneak Attack.'); }
      else say('sys', 'They see you.');
      break;
    }
    case 'firebolt': { strike(e, { name: 'Fire Bolt', bonus: sm, dice: [L >= 5 ? 2 : 1, 10, 0], sneakOk: false }); afterAttackFlags(); break; }
    case 'magic_missile': {
      const tot = rollDice(3, 4, 3, 'Magic Missile damage (three darts)').total;
      say('sys', 'Three darts of force streak out: ' + tot + ' damage to ' + e.n + '.');
      dmgEnemy(e, tot);
      break;
    }
    case 'shield': pc.shield = true; say('sys', 'A shimmering barrier springs up: +5 AC until your next turn.'); break;
    case 'sleep': {
      let pool = rollDice(5, 8, 0, 'Sleep (hit points of foes it can affect)').total;
      const targets = livingEnemies().filter((x) => !x.fl.includes('undead')).sort((a, b) => a.hp - b.hp);
      let n = 0;
      targets.forEach((x) => { if (x.hp <= pool && !x.boss) { pool -= x.hp; x.cond.asleep = 3; n++; } });
      say('sys', n ? 'Sleep: ' + n + ' foe' + (n > 1 ? 's' : '') + ' slump into slumber (3 rounds, or until hurt).' : 'Sleep: nothing falls asleep.');
      break;
    }
    case 'scorching_ray': {
      for (let i = 0; i < 3; i++) {
        const t = pickAlive(targetId);
        if (!t) break;
        strike(t, { name: 'Ray ' + (i + 1), bonus: sm, dice: [2, 6, 0], sneakOk: false });
        if (!run.combat) return;
      }
      afterAttackFlags();
      break;
    }
    case 'sacred_flame': {
      const dc = spellDC(hero);
      const sv = d(20) + 1;
      if (sv >= dc) say('sys', e.n + ' resists the radiance (' + sv + ' vs DC ' + dc + ').');
      else { const dm = rollDice(L >= 5 ? 2 : 1, 8).total; say('sys', 'Radiant fire falls on ' + e.n + ': ' + dm + ' damage.'); dmgEnemy(e, dm); }
      break;
    }
    case 'cure_wounds': { const r = rollDice(L >= 5 ? 2 : 1, 8, aMod(hero, 'wis'), 'Cure Wounds healing'); const g = mend(Math.max(1, r.total)); say('sys', 'Cure Wounds: +' + g + ' HP (' + hero.hp + '/' + hero.hpMax + ').'); break; }
    case 'guiding_bolt': { strike(e, { name: 'Guiding Bolt', bonus: sm, dice: [4, 6, 0], sneakOk: false }); afterAttackFlags(); break; }
    case 'turn_undead': {
      const dc = spellDC(hero);
      let n = 0;
      livingEnemies().forEach((x) => { if (x.fl.includes('undead')) { const sv = d(20); if (sv + 0 < dc) { x.cond.turned = 2; n++; } } });
      say('sys', n ? 'Turn Undead: ' + n + ' recoil and flee for two rounds.' : 'Turn Undead: nothing here answers to it.');
      break;
    }
    case 'breath': {
      const dc = 8 + prof(hero) + aMod(hero, 'con');
      const dmg = rollDice(L >= 5 ? 3 : 2, 6, 0, 'Breath weapon damage').total;
      say('sys', 'You exhale a cone of fire.');
      livingEnemies().forEach((x) => { const sv = d(20) + 1; const dm = sv >= dc ? Math.floor(dmg / 2) : dmg; say('sys', x.n + (sv >= dc ? ' dodges for half: ' : ' is caught: ') + dm + '.'); dmgEnemy(x, dm); });
      break;
    }
    default: break;
  }
  if (!run.combat) return;
  if (checkWin()) return;
  if (usedAction) { endPlayerTurn(); return; }
  save();
  changed();
}

/* ----- the rest of the round ----- */
function endPlayerTurn() {
  const cb = run.combat;
  if (!cb) return;
  if (checkWin()) return;
  allyTurn();
  if (!run.combat || checkWin()) return;
  if (cb.skip) { cb.skip = false; say('sys', 'The enemy is still reeling from your ambush.'); }
  else enemyPhase();
  if (!run.combat) return;
  endRound(false);
}
function endRound(initial) {
  const cb = run.combat;
  const pc = cb.pc;
  cb.round++;
  if (pc.poisoned > 0) pc.poisoned--;
  if (pc.frightened > 0) pc.frightened--;
  cb.enemies.forEach((e) => { ['asleep', 'turned'].forEach((k) => { if (e.cond[k] > 0) e.cond[k]--; }); });
  cb.acted = { action: false, bonus: false };
  pc.shield = false; pc.defending = false; pc.sneakUsed = false;
  say('sys', '— Round ' + cb.round + ' —');
  save();
  changed();
}
function allyTurn() {
  const cb = run.combat;
  const a = allyNow();
  if (!a || !cb) return;
  if (a.role === 'priest' && hero.hp < hero.hpMax * 0.5 && !cb.allyHealed) {
    cb.allyHealed = true;
    const g = mend(rollDice(1, 6, 2 + hero.level).total);
    say('sys', a.name + ' lays a hand on you: +' + g + ' HP.');
    return;
  }
  const alive = livingEnemies();
  if (!alive.length) return;
  const t = alive[Math.floor(rnd() * alive.length)];
  const bonus = 3 + Math.floor(hero.level / 2);
  const x = rawD20(0);
  if (x.r !== 1 && (x.r === 20 || x.r + bonus >= t.ac)) {
    const dm = rollDice(1, a.role === 'sellsword' ? 8 : a.role === 'scout' ? 6 : 4, 2 + Math.floor(hero.level / 2)).total * (x.r === 20 ? 2 : 1);
    say('sys', a.name + ' strikes ' + t.n + ': ' + dm + ' damage.');
    dmgEnemy(t, dm);
  } else say('sys', a.name + ' attacks ' + t.n + ' and misses.');
}
function enemyPhase() {
  const cb = run.combat;
  const list = cb.enemies.filter((e) => e.hp > 0);
  for (let k = 0; k < list.length; k++) {
    const e = list[k];
    if (!run.combat) return;
    if (e.hp <= 0) continue;
    if (e.cond.asleep > 0 || e.cond.turned > 0) continue;
    if (e.sp && cb.round >= 2 && (cb.round - 2) % e.sp.every === 0) {
      if (e.sp.k === 'summon' && cb.enemies.length < 6) {
        for (let i = 0; i < e.sp.n; i++) { const m = makeMon(e.sp.key); m.id = 'e' + cb.n++; cb.enemies.push(m); }
        say('sys', '⚠ ' + e.n + ' calls for aid: ' + e.sp.n + ' more ' + (MON[e.sp.key].pl || MON[e.sp.key].n + 's').toLowerCase() + ' join the fight.');
        continue;
      }
      if (e.sp.k === 'breath') {
        const dmg = rollDice(e.sp.dice[0], e.sp.dice[1]).total;
        const sv = doSave('dex', e.sp.dc, 0);
        say('roll', e.n + ' unleashes a gout of ' + e.sp.type + '! ' + rollChip(sv), { ok: sv.ok });
        hurt(sv.ok ? Math.floor(dmg / 2) : dmg, e.sp.type);
        if (hero.hp <= 0) { down(); return; }
        continue;
      }
    }
    for (let i = 0; i < (e.multi || 1); i++) {
      if (!run.combat) return;
      enemyAttack(e);
      if (hero.hp <= 0) { down(); return; }
    }
  }
}
function enemyAttack(e) {
  const cb = run.combat, pc = cb.pc;
  const A = allyNow();
  if (A && rnd() < 0.25) {
    const x = rawD20(0);
    if (x.r !== 1 && x.r + e.atk >= 13 + Math.floor(hero.level / 2)) {
      const dm = rollArr(e.dmg).total;
      A.hp -= dm;
      say('sys', e.n + ' strikes ' + A.name + ' (' + dm + ').');
      if (A.hp <= 0) { A.alive = false; A.active = false; setFlag('ally_dead'); say('dmg', A.name + ' falls!'); deed(A.name + ' fell in battle'); rememberLoss(A); }
    } else say('sys', e.n + ' swings at ' + A.name + ' and misses.');
    return;
  }
  let adv = 0, dis = 0;
  if (e.fl.includes('pack') && cb.enemies.some((x) => x !== e && x.hp > 0)) adv = 1;
  if (pc.restrained) adv = 1;
  if (pc.hidden || pc.defending) dis = 1;
  const mode = modeOf(adv, dis);
  const x = rawD20(mode);
  const ac = heroAC(hero) + (pc.shield ? 5 : 0);
  const crit = x.r === 20;
  const hit = crit || (x.r !== 1 && x.r + e.atk >= ac);
  const dtxt = x.all.length > 1 ? '[' + x.all.join(', ') + '→' + x.r + ']' : '[' + x.r + ']';
  if (!hit) {
    say('sys', fill(pickR(TPL.emiss), { E: cap(e.n) }) + ' (d20 ' + dtxt + ' ' + sgn(e.atk) + ' vs AC ' + ac + ')');
    return;
  }
  let dm = rollDice(e.dmg[0] * (crit ? 2 : 1), e.dmg[1], e.dmg[2]).total;
  if (hero.cls === 'rogue' && hero.level >= 5 && (hero.res.dodge || 0) > 0) { hero.res.dodge--; dm = Math.ceil(dm / 2); say('sys', 'Uncanny Dodge halves the blow.'); }
  say('sys', fill(pickR(TPL.ehit), { E: cap(e.n) }) + (crit ? ' (critical)' : '') + ' (d20 ' + dtxt + ' ' + sgn(e.atk) + ' vs AC ' + ac + ')');
  hurt(dm, null);
  if (e.fl.includes('drain') && dm > 0) { const h = Math.floor(dm / 2); e.hp = Math.min(e.max, e.hp + h); say('sys', e.n + ' drinks in your vitality (+' + h + ').'); }
  if (hero.hp <= 0) return;
  if (e.fl.includes('web') && !pc.restrained && rnd() < 0.5) {
    const sv = doSave('dex', 12, 0);
    say('roll', rollChip(sv), { ok: sv.ok });
    if (!sv.ok) { pc.restrained = true; say('sys', 'Webbing pins you in place: attacks against you have advantage and yours have disadvantage. Use an action to break free.'); }
  }
  if (e.fl.includes('weaken') && pc.poisoned <= 0 && rnd() < 0.5) {
    const sv = doSave('con', 11, 0);
    say('roll', rollChip(sv), { ok: sv.ok });
    if (!sv.ok) { pc.poisoned = 2; say('sys', 'You feel sick and shaky: disadvantage on attacks for 2 rounds.'); }
  }
  if (e.fl.includes('fear') && pc.frightened <= 0 && rnd() < 0.5) {
    const sv = doSave('wis', 12, hero.species === 'elf' ? 1 : 0);
    say('roll', rollChip(sv), { ok: sv.ok });
    if (!sv.ok) { pc.frightened = 2; say('sys', 'Dread grips you: disadvantage on attacks for 2 rounds.'); }
  }
}
function breakFree() {
  const cb = run.combat;
  if (!cb || !cb.pc.restrained || cb.acted.action) return;
  cb.acted.action = true;
  const res = doCheck('athletics', 11, 0);
  say('roll', rollChip(res), { ok: res.ok });
  if (res.ok) { cb.pc.restrained = false; say('sys', 'You tear free of the webbing.'); }
  else say('sys', 'The webbing holds.');
  endPlayerTurn();
}

/* ----- victory and defeat ----- */
function winCombat() {
  const cb = run.combat;
  const adv = run.adv;
  const room = adv.rooms[cb.roomId];
  const boss = cb.boss;
  run.combat = null;
  run.phase = 'room';
  say('head', 'Victory');
  if (!boss) {
    const g = Math.round(cb.startThr * (1 + hero.level * 0.35)) + d(6);
    hero.gold += g; led().gold += g;
    say('sys', '+' + g + ' gold from the spoils.');
    if (rnd() < 0.3) { const it = pickR(['potion', 'potion', 'oil', 'smoke']); addItem(it, 1); say('sys', 'You find: ' + ITEMS[it].n + '.'); }
    const br = mend(Math.ceil(hero.hpMax * 0.2));
    if (br) say('sys', 'You catch your breath: +' + br + ' HP.');
    narr('The last foe falls. Silence settles, and you can hear your own breathing.', factsFor('victory', 'The last of your foes falls, and silence returns.'));
    run.cur.resolved = true;
    run.cur.choices = [C('Search the area', { id: 'search', kind: 'next' }), C('Continue deeper', { id: 'continue', kind: 'next' })];
    save();
    changed();
    return;
  }
  const nm = adv.villain.name;
  narr(nm + ' sinks to one knee, weapon slipping from their fingers. The fight is over. What happens next is up to you.', factsFor('boss_down', nm + ' is beaten and kneeling. The fight is over.'));
  const L = hero.level;
  run.cur.resolved = true;
  run.cur.choices = [
    C('Strike the final blow', { kind: 'end', end: 'slain', drive: 'vengeance', s: { flags: ['villain_slain'], deed: 'Slew ' + nm, legacy: { t: 'villain_slain', name: nm } } }),
    C('Spare ' + nm, { kind: 'end', end: 'spared', drive: 'mercy', s: { flags: ['villain_spared'], deed: 'Spared ' + nm, legacy: { t: 'villain_spared', name: nm } } }),
    C('Bind ' + nm + ' and drag them to justice', { kind: 'end', end: 'bound', drive: 'glory', s: { flags: ['villain_bound'], deed: 'Took ' + nm + ' alive' } }),
  ];
  save();
  changed();
}
function endChoice(c) {
  say('choice', c.label);
  if (c.drive && hero.drive === c.drive && !run.cur.driveGiven) { run.cur.driveGiven = true; if (gainFortune(1) > 0) say('sys', '✦ Your drive stirs: +1 Fortune.'); }
  applyFx(c.s);
  finishAdventure(c.end);
}
function drinkPotion() {
  if (run.phase === 'combat') return;
  if ((hero.inv.potion || 0) < 1 || hero.hp >= hero.hpMax) return;
  hero.inv.potion--;
  const g = mend(rollDice(2, 4, 2, 'Healing potion').total);
  say('sys', 'You drink a potion: +' + g + ' HP (' + hero.hp + '/' + hero.hpMax + ').');
  save();
  changed();
}
function deathSaves() {
  let s = 0, f = 0;
  const marks = [];
  while (s < 3 && f < 3) {
    const r = heroDice(1, 20, 'Death saving throw')[0];
    if (r === 20) { marks.push('★'); return { out: 'revived', marks }; }
    if (r === 1) { f += 2; marks.push('✗✗'); }
    else if (r < 10) { f++; marks.push('✗'); }
    else { s++; marks.push('✓'); }
  }
  return { out: s >= 3 ? 'stable' : 'dead', marks };
}
function down() {
  const cb = run.combat;
  const boss = cb ? cb.boss : run.adv.rooms[run.roomId].type === 'boss';
  const room = run.adv.rooms[cb ? cb.roomId : run.roomId];
  const foes = cb ? cb.enemies.filter((e) => e.hp > 0) : [];
  let how = '';
  run.combat = null;
  run.phase = 'room';
  say('head', 'You fall');
  hero.hp = 0;
  if (!S.settings.forgiving) {
    const r = deathSaves();
    how = r.out;
    say('sys', 'Death saves: ' + r.marks.join(' ') + ' — ' + (r.out === 'dead' ? 'you do not rise.' : r.out === 'revived' ? 'a surge of will brings you back.' : 'you stabilize.'));
    if (r.out === 'dead') { hero.alive = false; run.phase = 'dead'; finishAdventure('death'); return; }
  }
  hero.hp = 1;
  const lost = Math.floor(led().gold / 2);
  hero.gold = Math.max(0, hero.gold - lost);
  led().gold -= lost;
  if ((hero.inv.potion || 0) > 0) { hero.inv.potion--; }
  bumpAlert(2);
  tickClock(2);
  setFlag('defeated');
  deed('Was left for dead in the ' + room.name);
  say('sys', 'You are left for dead. You wake later with 1 HP, a lighter purse' + (lost ? ' (−' + lost + ' gold)' : '') + ', and a potion fewer.');
  rememberDefeat(room, foes, how);
  if (boss) { finishAdventure('defeat'); return; }
  narr('Darkness, then pain, then a cold floor under your cheek. Whoever beat you did not stay to finish it.', factsFor('defeat', 'You were beaten and left for dead, and wake alone later.'));
  run.cur.resolved = true;
  run.cur.choices = [C('Continue deeper', { id: 'continue', kind: 'next' })];
  save();
  changed();
}
function handleDown() { down(); }
