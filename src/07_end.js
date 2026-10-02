/* ---------- epilogue ---------- */
function finishAdventure(kind) {
  const adv = run.adv, v = adv.villain, T = themeOf();
  const a = adv.npcs.ally;
  run.phase = 'epilogue';
  run.combat = null;
  const win = ['slain', 'spared', 'bound', 'parley', 'snatch', 'victory'].includes(kind);
  run.ending = kind;
  const paras = [];
  say('head', 'Epilogue');
  const core = {
    slain: v.name + ' falls, and ' + adv.site + ' goes quiet.',
    spared: 'You lower your blade. ' + v.name + ' watches you go, unsure whether to thank you or curse you.',
    bound: 'You bind ' + v.name + ' and march them out into the daylight to face judgment.',
    parley: 'Words do what steel could not. ' + v.name + ' agrees to end what began here, on terms you both can live with.',
    snatch: 'You escape with ' + adv.mcg + ', and ' + v.name + "'s curses follow you out of " + adv.site + '.',
    victory: v.name + ' is finished.',
    defeat: 'You wake outside ' + adv.site + ', bruised and alone. ' + v.name + "'s plan goes on without you.",
    death: 'Your story ends in the dark of ' + adv.site + '. The stones keep your name.',
  }[kind];
  paras.push(core);

  /* hook consequences */
  const h = adv.hook;
  if (win || kind === 'defeat') {
    if (h === 'rescue' && a) {
      if (flag('ally_slain')) paras.push(a.name + ' betrayed you, and paid for it. It is not a victory anyone will sing about.');
      else if (a.betrayer && a.alive) paras.push(a.name + ' vanished into the dark after the betrayal. You may meet again.');
      else if (!a.alive) paras.push(a.name + ' did not make it out. You carry that, and so does ' + adv.patron.name + '.');
      else if (flag('ally_abandoned') && !a.active) paras.push('You left ' + a.name + ' behind. When you returned, there was nothing but ropes.');
      else if (a.captive) paras.push('You never found ' + a.name + ' in time.');
      else if (flag('ally_left_safe')) paras.push(a.name + ' was waiting at the door when you came out, grinning like it was a game.');
      else paras.push(a.name + ' walks home beside you, tired and alive.');
    } else if (h === 'recover') {
      if (flag('relic_destroyed')) paras.push(adv.mcg + ' is gone for good. ' + adv.patron.name + ' will have to take your word for it.');
      else if (flag('relic_kept')) paras.push('You kept ' + adv.mcg + '. Its whispers follow you down the road.');
      else if (win && kind !== 'defeat') paras.push('You carry ' + adv.mcg + ' back to ' + adv.place + '.');
      else paras.push(adv.mcg + ' is still down there.');
    } else if (h === 'ritual') {
      paras.push(flag('clock_done') ? 'The rite finished before you could stop it, and ' + adv.place + ' will feel it.' : 'The rite died with ' + v.name + "'s plans.");
    } else if (h === 'hunt') {
      paras.push(kind === 'slain' || kind === 'bound' ? 'The hunting stops, and ' + adv.place + ' sleeps without fear.' : kind === 'defeat' ? 'The hunting goes on.' : 'The hunting stops, for now.');
    } else if (h === 'investigate') {
      paras.push(kind === 'defeat' ? 'People are still vanishing, and now you know why.' : 'You bring the truth back to ' + adv.place + '. People stop vanishing.');
    }
  }
  /* twist consequences */
  const t = adv.twist.type;
  let reward = adv.reward;
  if (win) {
    if (t === 'patron_lied') {
      if (flag('sided_villain') && !flag('sided_patron')) { paras.push('You tell the village the truth. ' + adv.patron.name + ' is gone by morning, and no payment comes.'); reward = 0; }
      else if (flag('patron_truth')) paras.push('With the letter in hand, you make sure ' + adv.patron.name + ' answers for it.');
      else paras.push('You deliver the news. ' + adv.patron.name + ' pays, smiling thinly. You do not quite trust that smile.');
    } else if (t === 'villain_sympathetic') {
      if (kind === 'parley' || kind === 'spared') paras.push(v.name + "'s grief finds a better outlet than blood.");
      else if (kind === 'slain') paras.push('You think, sometimes, about what was written in that ledger.');
    } else if (t === 'ally_betrays' && flag('ally_redeemed')) {
      paras.push(a.name + ' gets a chance to start over, because you offered one.');
    }
  }
  if (flag('clock_done') && win) reward = Math.round(reward * 0.7);
  if (flag('relic_kept')) reward = Math.round(reward * 0.5);
  if (win && reward > 0) {
    hero.gold += reward;
    paras.push(adv.patron.name + ' pays you ' + reward + ' gold.');
  }
  /* what the story remembers */
  if (a && a.alive && !a.betrayer && !a.captive && h === 'rescue' && !flag('ally_abandoned') && win) hero.legacy.push({ t: 'ally_saved', name: a.name });
  Object.keys(adv.npcs).forEach((id) => {
    const n = adv.npcs[id];
    if (id !== 'ally' && n.met && n.alive && n.att >= 2 && !hero.legacy.some((l) => l.name === n.name)) hero.legacy.push({ t: 'npc_helped', name: n.name });
  });
  hero.legacy = hero.legacy.slice(-4);
  /* leveling */
  let lv = null;
  if (win && hero.level < 5) lv = levelUp(hero);
  if (win) hero.adventures++;
  if (kind === 'death') { hero.alive = false; }
  const deeds = led().deeds.slice(-6);
  hero.chronicle.push({ title: adv.titleFull, end: kind, level: hero.level, deeds, seed: adv.seed });
  hero.chronicle = hero.chronicle.slice(-12);
  if (kind === 'death') {
    S.heroes = S.heroes.filter((x) => x.id !== hero.id);
    S.fallen.push({ name: hero.name, cls: hero.cls, species: hero.species, level: hero.level, adventures: hero.adventures, title: adv.titleFull, deeds });
  }
  paras.forEach((p, i) => narr(p, factsFor('epilogue', p)));
  if (deeds.length) say('sys', 'Deeds: ' + deeds.join(' • '));
  if (lv) say('sys', '⬆ You reach level ' + hero.level + '! +' + lv.gain + ' max HP. ' + lv.note);
  else if (win && hero.level >= 5) say('sys', 'You are at the height of your power for now.');
  run.epilogue = { kind, win, title: adv.titleFull, reward, level: lv };
  save();
  changed();
}
function leaveRun() {
  S.run = null;
  run = null;
  if (hero && hero.alive) { recalc(hero); hero.hp = hero.hpMax; }
  save();
  changed();
}
function abandonRun() {
  S.run = null;
  run = null;
  save();
  changed();
}
function save() {
  if (S && !Dice.hold) Store.save(S);
}
