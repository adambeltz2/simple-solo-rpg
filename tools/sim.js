const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const N = parseInt(process.argv[2] || '150', 10);
(async () => {
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window;
  await new Promise((r) => setTimeout(r, 10));
  const D = w.__delve, A = D.api;
  D.S.settings.forgiving = true;
  const results = {};
  const classes = ['fighter', 'rogue', 'wizard', 'cleric'];
  function policy(cb, hero) {
    const hpf = hero.hp / hero.hpMax;
    const L = hero.level;
    const run = D.run;
    const alive = A.livingEnemies();
    const act = (n) => { A.cAct(n, null); };
    if (hpf < 0.4 && (hero.inv.potion || 0) > 0 && !cb.acted.bonus) { A.cAct('i:potion'); return; }
    const res = hero.res;
    if (hero.cls === 'fighter') {
      if (hpf < 0.5 && res.wind > 0 && !cb.acted.bonus) { A.cAct('p:second_wind'); return; }
      if (L >= 2 && res.surge > 0 && !cb.acted.action) { A.cAct('p:action_surge'); }
      A.cAct('attack'); return;
    }
    if (hero.cls === 'rogue') {
      if (!cb.pc.hidden && !cb.acted.bonus && L >= 2) { A.cAct('p:hide'); }
      if (!cb.pc.hidden && L < 2 && !cb.acted.action && Math.random() < 0.5) { A.cAct('p:hide'); return; }
      A.cAct('attack'); return;
    }
    if (hero.cls === 'wizard') {
      if (res.slots > 0 && alive.length >= 2 && alive.every((e) => e.hp <= 14) && !alive.some((e) => e.fl.includes('undead')) && !cb.sleptOnce) { cb.sleptOnce = true; A.cAct('p:sleep'); return; }
      if (hpf < 0.6 && res.slots > 1 && !cb.acted.bonus && !cb.pc.shield) { A.cAct('p:shield'); }
      if (res.slots > 0) { A.cAct(L >= 3 && Math.random() < 0.5 ? 'p:scorching_ray' : 'p:magic_missile'); return; }
      A.cAct('p:firebolt'); return;
    }
    if (hero.cls === 'cleric') {
      if (hpf < 0.45 && res.slots > 0) { A.cAct('p:cure_wounds'); return; }
      if (L >= 2 && res.turn > 0 && alive.some((e) => e.fl.includes('undead'))) { A.cAct('p:turn_undead'); return; }
      if (res.slots > 0 && Math.random() < 0.7) { A.cAct('p:guiding_bolt'); return; }
      A.cAct(Math.random() < 0.5 ? 'p:sacred_flame' : 'attack'); return;
    }
  }
  function one(cls, level, kind, species) {
    const h = A.newHero({ name: 'S', species, cls, bg: 'soldier', drive: 'glory' });
    for (let l = 1; l < level; l++) A.levelUp(h);
    D.S.heroes = [h];
    A.beginRun(h, 'sim-' + Math.random().toString(36).slice(2), 'random');
    const run = D.run;
    let room;
    if (kind === 'boss') room = Object.values(run.adv.rooms).find((r) => r.type === 'boss');
    else if (kind === 'elite') room = Object.values(run.adv.rooms).find((r) => r.type === 'combat' && r.elite);
    else room = Object.values(run.adv.rooms).find((r) => r.type === 'combat' && !r.elite);
    A.enterRoom(room.id);
    const start = h.hp;
    A.startCombat(kind === 'boss' ? { boss: true, surprise: null } : { enemies: room.enemies, surprise: null }, room);
    let guard = 0;
    while (D.run && D.run.combat && guard++ < 80) policy(D.run.combat, D.hero);
    const lost = !!(D.run && D.run.led.flags.defeated);
    return { lost, hp: D.hero.hp / D.hero.hpMax, potions: D.hero.inv.potion, rounds: guard };
  }
  const species = ['human', 'elf', 'dwarf', 'halfling', 'dragonborn'];
  const rows = [];
  for (const kind of (process.argv[3] || 'normal,elite,boss').split(',')) for (const level of [1, 2, 3, 4, 5]) for (const cls of classes) {
    let win = 0, hp = 0, pot = 0;
    for (let i = 0; i < N; i++) { const r = one(cls, level, kind, species[i % 5]); if (!r.lost) { win++; hp += r.hp; } pot += r.potions; }
    rows.push(`${kind.padEnd(6)} L${level} ${cls.padEnd(8)} win ${(100 * win / N).toFixed(0).padStart(3)}%  avgHP% of winners ${win ? (100 * hp / win).toFixed(0) : '-'}`);
  }
  console.log(rows.join('\n'));
})();
