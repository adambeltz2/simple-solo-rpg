/* ---------- run lifecycle, rooms, choices ---------- */
function factsFor(kind, draft, extra) {
  const adv = run.adv;
  return Object.assign({
    kind, draft, hero: hero.name + ', ' + SPECIES[hero.species].n + ' ' + CLASSES[hero.cls].n,
    setting: themeOf().n + ' (' + adv.site + ')', story: adv.title, backstory: hero.story || '',
    recent: led().deeds.slice(-2),
  }, extra || {});
}

function beginRun(h, seed, themeKey) {
  hero = h;
  readyHero(h);
  const adv = generateAdventure(seed, h, { theme: themeKey, difficulty: S.settings.difficulty });
  adv.legacyUsed.forEach((l) => {
    const i = h.legacy.findIndex((x) => x.t === l.t && x.name === l.name);
    if (i >= 0) h.legacy.splice(i, 1);
  });
  run = S.run = {
    v: 1, heroId: h.id, adv, slot: 0, phase: 'doors', roomId: null, cur: null,
    led: { flags: {}, clues: 0, alert: 0, gold: 0, deeds: [], cbs: [], kills: 0, spared: 0, visited: [] },
    log: [], combat: null, ending: null, pending: null, epilogue: null,
  };
  say('head', adv.titleFull);
  narr(adv.pitch, factsFor('hook', adv.pitch));
  say('sys', 'Your task: ' + adv.goal);
  const a = adv.npcs.ally;
  if (a && a.active) say('sys', a.name + ', a ' + a.role + ' sent along by ' + adv.patron.name + ', travels with you.');
  if (adv.legacyUsed.length) {
    const l = adv.legacyUsed[0];
    const t = { ally_saved: l.name + ' has not forgotten what you did.', villain_slain: 'This is not the first dark errand like this. The one you slew left kin behind.', villain_spared: 'The mercy you showed ' + l.name + ' has not been forgotten.', npc_helped: l.name + ' remembers you kindly.' }[l.t];
    if (t) say('sys', '↪ ' + t);
  }
  save();
  enterSlot(0);
}

function enterSlot(i) {
  run.slot = i;
  const s = run.adv.slots[i];
  if (s.opts.length === 1) { enterRoom(s.opts[0]); return; }
  run.phase = 'doors';
  run.cur = null;
  run.doorIdeas = null;
  say('head', 'Two ways onward');
  changed();
}

function doorInfo(id) {
  const room = run.adv.rooms[id];
  const passive = 10 + skillMod(hero, 'perception');
  const exact = passive >= 13 || flag('scouted') || flag('scouted_' + run.slot);
  return { id, label: cap(room.name), hint: cap(room.hint), exact, kind: exact ? TYPE_LABEL[room.type] || '' : '' };
}
function chooseDoor(id) {
  const info = doorInfo(id);
  say('choice', '→ ' + info.label);
  enterRoom(id);
}

function bossPrep() {
  const adv = run.adv;
  const lines = [], mods = { extra: [], hpMul: 1, atk: 0, dmg: 0, weak: false, allyWith: false };
  const bad = [], good = [];
  if (led().alert >= 4) { mods.extra.push(adv.villain.bossKey === 'necromancer' ? 'skeleton' : MON_FOR_THEME(adv.theme)); mods.extra.push(MON_FOR_THEME(adv.theme)); bad.push('The defenders have been warned. Guards stand ready beside ' + adv.villain.name + '.'); }
  else if (led().alert === 3) { mods.extra.push(MON_FOR_THEME(adv.theme)); bad.push('One guard has been called to the lair.'); }
  if (flag('clock_done')) { mods.hpMul = 1.25; mods.dmg = 2; bad.push('It is too late. ' + adv.clock_text + ' ' + adv.villain.name + ' has been empowered.'); }
  if (led().clues >= 3) { mods.weak = true; good.push('Everything you learned shows you where ' + adv.villain.name + ' is vulnerable.'); }
  else if (led().clues >= 2) good.push('You have a clue to ' + adv.villain.name + "'s weakness, if you can use it.");
  if (flag('sidedoor')) good.push('You have a way in by the side door.');
  const a = adv.npcs.ally;
  if (a && a.alive && a.active) { if (a.att >= 2) good.push(a.name + ' stands beside you, steady.'); }
  Object.keys(adv.npcs).forEach((id) => {
    const n = adv.npcs[id];
    if (id === 'ally') return;
    if (!n.met || !n.alive) return;
    if (n.att >= 2) { mods.weak = true; good.push(n.name + ' has slipped ahead and sown confusion in the lair.'); }
    else if (n.att <= -2) { mods.extra.push(MON_FOR_THEME(adv.theme)); bad.push(n.name + ' ran ahead to warn ' + adv.villain.name + '.'); }
  });
  /* ally betrayal */
  if (adv.twist.type === 'ally_betrays' && a && a.alive && !flag('ally_redeemed') && !flag('ally_slain') && (a.betrayer || a.att < 3)) {
    a.betrayer = true; a.active = false;
    mods.traitor = true;
    bad.push(a.name + ' steps out from behind ' + adv.villain.name + ", weapon drawn. \"Nothing personal.\"");
  }
  return { lines: bad.concat(good), mods };
}
function MON_FOR_THEME(themeKey) {
  const T = THEMES[themeKey];
  const pool = T.mon[tierFor(hero.level, { chance: () => false })];
  return pool.slice().sort((a, b) => MON[a].thr - MON[b].thr)[0];
}

function enterRoom(id) {
  const adv = run.adv;
  const room = adv.rooms[id];
  run.roomId = id;
  run.phase = 'room';
  adv.clock_text = adv.clock_text || ('The ' + adv.clock.label.toLowerCase() + ' came and went.');
  if (room.type !== 'entrance') tickClock(1);
  led().visited.push(id);
  const cb = callbackLine();
  let text, kind = 'room';
  if (room.type === 'entrance') {
    text = 'You stand before ' + adv.site + '. ' + atmosphere() + ' ' + (cb || '') + ' There is no one to ask the way. You will have to choose how you go in.';
    say('head', 'The Threshold');
  } else if (room.type === 'twist') {
    adv.twist.revealed = true;
    const t = adv.twist.type;
    const body = t === 'ally_betrays' ? TWIST_TEXT[t](adv.npcs.ally) : TWIST_TEXT[t](adv);
    text = pickR(TPL.arrive) + ' ' + atmosphere() + ' ' + body;
    say('head', 'A turning point');
    kind = 'twist';
  } else if (room.type === 'boss') {
    const prep = bossPrep();
    run.cur = { prep };
    const boss = BOSS[adv.villain.bossKey];
    text = pickR(TPL.arrive) + ' ' + atmosphere() + ' At last, the ' + room.name + '. ' + adv.villain.name + ', ' + an(boss.n.toLowerCase()) + ', waits.';
    say('head', 'The ' + cap(room.name));
    kind = 'boss';
  } else {
    text = roomIntro(room);
    if (cb) text += ' ' + cb;
    say('head', cap(room.name) + (room.type === 'social' ? ' — ' + (npcOf(room.npc).name) : ''));
  }
  const keep = run.cur && run.cur.prep ? run.cur.prep : null;
  narr(text, factsFor(kind, text));
  if (keep) keep.lines.forEach((l) => say('sys', '⚡ ' + l));
  if (room.type === 'social') npcOf(room.npc).met = true;
  run.cur = { prep: keep, choices: buildChoices(room), acts: 0, resolved: false, driveGiven: false, used: [] };
  save();
  changed();
}

/* ---------- picking a choice ---------- */
function curChoice(cidv) { return run.cur && run.cur.choices.find((x) => x.id === cidv); }
function pickChoice(cidv) {
  if (!run.cur || (run.phase !== 'room')) return;
  const c = curChoice(cidv);
  if (!c) return;
  if (c.id === 'continue') { continueDeeper(); return; }
  if (c.id === 'search') { doSearch(); return; }
  if (c.kind === 'end') { endChoice(c); return; }
  say('choice', c.label);
  if (c.drive && hero.drive === c.drive && !run.cur.driveGiven) {
    run.cur.driveGiven = true;
    if (gainFortune(1) > 0) say('sys', '✦ Your drive stirs (' + DRIVES[c.drive].n + '): +1 Fortune.');
  }
  if (c.kind === 'trade') {
    if (hero.gold < c.cost) { say('sys', 'You cannot afford that (' + c.cost + ' gold).'); changed(); return; }
    hero.gold -= c.cost;
    say('sys', '−' + c.cost + ' gold.');
  }
  if (c.kind === 'check') {
    const res = doCheck(c.skill, c.dc, c.mode || 0);
    say('roll', rollChip(res), { ok: res.ok });
    if (!res.ok && hero.fortune > 0 && !res.crit) {
      run.phase = 'check';
      run.pending = { cid: c.id, res, label: c.label };
      changed();
      return;
    }
    finishChoice(c, res.ok, res);
    return;
  }
  finishChoice(c, true, null);
}
function spendFortune() {
  if (run.phase !== 'check' || !run.pending || hero.fortune < 1) return;
  const c = curChoice(run.pending.cid);
  hero.fortune--;
  say('sys', '✦ You spend a point of Fortune and roll again.');
  const res = doCheck(c.skill, c.dc, c.mode || 0);
  say('roll', rollChip(res), { ok: res.ok });
  run.pending = null;
  run.phase = 'room';
  finishChoice(c, res.ok, res);
}
function acceptResult() {
  if (run.phase !== 'check' || !run.pending) return;
  const c = curChoice(run.pending.cid);
  const res = run.pending.res;
  run.pending = null;
  run.phase = 'room';
  finishChoice(c, res.ok, res);
}

function finishChoice(c, ok, res) {
  const room = run.adv.rooms[run.roomId];
  const cur = run.cur;
  cur.acts++;
  cur.used.push(c.id);
  let text = ok ? c.ok : c.no;
  if (!text) text = fill(pickR((ok ? TPL.succ : TPL.fail)[c.skill] || ['It is done.']), { obj: room.obj || 'it', Obj: cap(room.obj || 'it') });
  if (res && res.crit) { text += ' A flawless effort.'; if (gainFortune(1) > 0) text += ' (+1 Fortune)'; }
  if (res && res.fumble) text += ' Bad luck.';
  const facts = factsFor('outcome', text, { action: c.label, result: ok ? 'success' : 'failure', place: room.name, free: !!c.free, scene: c.free ? sceneText() : '' });
  narr(text, facts);
  if (res && res.fumble) { tickClock(1); }
  let out = { combat: null };
  const fxs = c.kind === 'combat' ? [c.fx] : c.kind === 'check' ? [ok ? c.s : c.f] : [c.s, c.fx];
  fxs.forEach((fx) => {
    if (!fx) return;
    const o = applyFx(fx);
    if (o.combat) out.combat = o.combat;
    if (fx.ally === 'join_ret') promoteReturning();
  });
  if (room.type === 'boss' && run.ending === 'parley') { finishAdventure('parley'); return; }
  if (room.type === 'boss' && run.ending === 'snatch') { finishAdventure('snatch'); return; }
  if (hero.hp <= 0 && !out.combat) { handleDown(); return; }
  if (out.combat) {
    out.combat.roomId = room.id;
    startCombat(out.combat, room);
    return;
  }
  if (c.probe) {
    /* a preparation: the scene itself is still ahead of you */
    cur.probed = true;
    cur.choices = cur.choices.filter((x) => !x.idea && x.id !== c.id);
    save();
    changed();
    return;
  }
  settleRoom();
}
function promoteReturning() {
  const adv = run.adv;
  const r = adv.npcs.ret;
  if (!r || adv.npcs.ally) return;
  adv.allyId = 'ally';
  adv.npcs.ally = { id: 'ally', name: r.name, role: 'sellsword', pr: { o: 'them', p: 'their' }, att: 1, met: true, alive: true, active: true, captive: false, betrayer: false, hp: 10 + 3 * hero.level, hpMax: 10 + 3 * hero.level };
  say('sys', r.name + ' joins you.');
}

/* after any choice: work out what the player may do next in this room */
function settleRoom() {
  const room = run.adv.rooms[run.roomId];
  const cur = run.cur;
  const left = [];
  if (room.type === 'social' && cur.acts < 2) {
    cur.choices.forEach((c) => { if (!cur.used.includes(c.id) && c.kind !== 'combat') left.push(c); });
  }
  cur.resolved = true;
  cur.choices = left.concat([C('Continue deeper', { id: 'continue', kind: 'next' })]);
  save();
  changed();
}
function doSearch() {
  const room = run.adv.rooms[run.roomId];
  const cur = run.cur;
  say('choice', 'Search the area');
  cur.searched = true;
  const res = doCheck('investigation', room.searchDC || dcFor(hero.level, 0), 0);
  say('roll', rollChip(res), { ok: res.ok });
  if (res.ok) {
    const g = rollDice(1, 6).total * (hero.level + 1);
    narr('Behind a fallen shelf and under a loose stone, you find what the previous owners left behind.', factsFor('search', 'You search the area and find hidden valuables.'));
    applyFx({ gold: g, clue: rnd() < 0.5 ? 1 : 0, items: rnd() < 0.35 ? [pickR(['potion', 'oil', 'scroll', 'smoke'])] : [] });
  } else {
    say('sys', 'You find nothing of value.');
  }
  cur.choices = cur.choices.filter((c) => c.id !== 'search');
  save();
  changed();
}
function continueDeeper() {
  say('choice', 'Continue deeper');
  const next = run.slot + 1;
  if (next >= run.adv.slots.length) { finishAdventure(run.ending || 'victory'); return; }
  enterSlot(next);
}
