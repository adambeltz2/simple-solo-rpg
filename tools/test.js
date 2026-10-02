const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');

const N = parseInt(process.argv[2] || '40', 10);
const SEEDBASE = parseInt(process.argv[3] || '1', 10);
const AI_MOCK = process.argv[4] === 'ai';
const SMART = process.argv[5] === 'smart';
const DUMP = process.argv[6] === 'dump';
const DICE = process.env.DICE || 'auto'; // auto | d20 | all: exercise the manual-dice prompt

const SKILLS_OK = new Set(['acrobatics','arcana','athletics','deception','history','insight','intimidation','investigation','medicine','nature','perception','persuasion','religion','sleight','stealth','survival']);
const stats = { runs: 0, endings: {}, errors: [], badText: [], steps: 0, stuck: 0, levels: {}, deaths: 0, prompts: 0, promptKinds: {}, rejected: 0, byClass: {}, byTheme: {}, twists: {}, hooks: {} };

function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const tick = () => new Promise((r) => setTimeout(r, 0));

async function playOne(i) {
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errs.push('jsdomError: ' + (e.detail && e.detail.stack ? e.detail.stack : e.message)));
  vc.on('error', (e) => errs.push('console.error: ' + e));
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: vc, beforeParse(w) {
    w.confirm = () => true;
    w.scrollTo = () => {};
    w.Element.prototype.scrollIntoView = () => {};
    if (AI_MOCK) {
      w.__mockLLM = {
        chat: { completions: { async create(o) {
          if (o.stream) {
            return (async function* () { const words = 'You step softly into the dark, and the stones whisper of what came before you here.'.split(' '); for (const x of words) yield { choices: [{ delta: { content: x + ' ' } }] }; })();
          }
          if (o.response_format && /ideas/.test(String(o.response_format.schema))) {
            stats.ideaCalls = (stats.ideaCalls || 0) + 1;
            const k = stats.ideaCalls % 4;
            const body = k === 0 ? 'not json at all' : k === 1 ? JSON.stringify({ ideas: [{ action: 'Check the hinges for a hidden catch.', approach: 'investigation' }, { action: '"Whisper to the dark"', approach: 'bogus' }, { action: 'x', approach: 'stealth' }] }) : JSON.stringify({ ideas: [{ action: 'Pry loose a stone and listen behind it', approach: 'perception' }, { action: 'Bluff your way past, loudly', approach: 'deception' }, { action: 'Rush the nearest foe', approach: 'attack' }] });
            return { choices: [{ message: { content: body } }] };
          }
          return { choices: [{ message: { content: JSON.stringify({ approach: 'perception' }) } }] };
        } } },
        interruptGenerate() {},
      };
    }
  } });
  const w = dom.window;
  await tick();
  await tick();
  const D = w.__delve;
  const rnd = lcg(SEEDBASE * 1000 + i);
  w.Math.random = rnd; // drive game dice deterministically
  D.setRand(rnd);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const classes = ['fighter', 'rogue', 'wizard', 'cleric'];
  const species = ['human', 'elf', 'dwarf', 'halfling', 'dragonborn'];
  const bgs = ['soldier', 'criminal', 'sage', 'acolyte', 'outlander', 'charlatan'];
  const drives = ['glory', 'greed', 'mercy', 'curiosity', 'vengeance'];
  const cls = classes[i % 4];
  D.V.create = { species: pick(species), cls, bg: pick(bgs), drive: pick(drives), name: 'Bot' + i, story: 'A test hero.' };
  if (rnd() < 0.5) D.S.settings.forgiving = false;
  D.S.settings.difficulty = pick(['story', 'standard', 'standard', 'grim']);
  D.S.settings.dice = DICE;
  if (AI_MOCK) { await D.AI.load('small'); D.S.settings.narrator = 'ai'; }
  D.onAct('c:make');
  const heroRef = D.S.heroes[0];

  /* answer any manual-dice prompts raised by the last click; pre = JSON of the save before that click */
  const answerDice = async (pre) => {
    let guard = 0;
    while (D.Dice.need && guard++ < 60) {
      const need = D.Dice.need;
      stats.prompts++;
      const kind = need.n + 'd' + need.sides;
      stats.promptKinds[kind] = (stats.promptKinds[kind] || 0) + 1;
      if (JSON.stringify(D.S) !== pre) errs.push('state not restored at dice prompt (' + need.label + ')');
      if (DICE === 'd20' && need.sides !== 20) errs.push('non-d20 prompt in d20 mode: ' + need.label);
      const modal = w.document.getElementById('modal');
      if (!modal || !/Roll \d+d\d+/.test(modal.textContent)) errs.push('no dice modal shown');
      if (D.Dice.hold) errs.push('hold left on during prompt');
      const inputs = [...w.document.querySelectorAll('#modal input.dv')];
      if (inputs.length !== need.n) errs.push('wrong number of dice inputs');
      if (rnd() < 0.15) { /* a bad entry must be refused and keep the prompt open */
        inputs.forEach((el) => { el.value = rnd() < 0.5 ? '0' : String(need.sides + 1); });
        w.document.querySelector('[data-a="dice:ok"]').click();
        if (!D.Dice.need) errs.push('invalid dice entry was accepted');
        stats.rejected++;
      }
      if (rnd() < 0.3) { w.document.querySelector('[data-a="dice:auto"]').click(); }
      else {
        inputs.forEach((el) => { el.value = String(1 + Math.floor(rnd() * need.sides)); });
        w.document.querySelector('[data-a="dice:ok"]').click();
      }
      await tick();
    }
    if (D.Dice.need) errs.push('dice prompt never cleared');
    if (D.Dice.tape || D.Dice.hold) errs.push('dice tape/hold left after action');
    if (w.document.getElementById('modal') && D.V.modal === 'dice') errs.push('dice modal left open');
  };
  const adventures = 1 + Math.floor(rnd() * 3); // chain adventures to test levelling + legacy
  let result = null;
  for (let adv = 0; adv < adventures; adv++) {
    if (!D.S.heroes.length) break;
    D.V.newAdv.heroId = D.S.heroes[0].id;
    D.V.newAdv.theme = pick(['random', 'crypt', 'warren', 'sanctum', 'delve', 'keep']);
    D.V.newAdv.seed = 'seed-' + SEEDBASE + '-' + i + '-' + adv;
    D.onAct('n:begin');
    let steps = 0;
    while (D.S.run && steps < 700) {
      steps++;
      stats.steps++;
      await tick();
      const run = D.run;
      const hero = D.hero;
      /* invariants */
      if (!(hero.hp >= 0 && hero.hp <= hero.hpMax)) errs.push('hp out of range ' + hero.hp + '/' + hero.hpMax);
      if ([hero.hp, hero.hpMax, hero.gold, hero.fortune].some((x) => typeof x !== 'number' || Number.isNaN(x))) errs.push('NaN stat');
      const txt = w.document.getElementById('app').textContent;
      const bad = txt.match(/undefined|NaN|\[object|\{[a-z]+\}/);
      if (bad) { stats.badText.push(`run ${i} adv ${adv} step ${steps} phase ${run.phase}: "${bad[0]}" near "${txt.slice(Math.max(0, txt.indexOf(bad[0]) - 60), txt.indexOf(bad[0]) + 40).replace(/\s+/g, ' ')}"`); }
      if (run.phase === 'epilogue' || run.phase === 'dead') {
        const fin = w.document.querySelector('[data-a="finish"]');
        result = run.epilogue ? run.epilogue.kind : run.phase;
        stats.endings[result] = (stats.endings[result] || 0) + 1;
        stats.twists[run.adv.twist.type] = (stats.twists[run.adv.twist.type] || 0) + 1;
        stats.hooks[run.adv.hook] = (stats.hooks[run.adv.hook] || 0) + 1;
        stats.byTheme[run.adv.theme] = (stats.byTheme[run.adv.theme] || 0) + 1;
        const key = hero.cls + ':' + result;
        stats.byClass[key] = (stats.byClass[key] || 0) + 1;
        if (result === 'death') stats.deaths++;
        stats.levels[hero.level] = (stats.levels[hero.level] || 0) + 1;
        if (DUMP) console.log(run.log.slice(-40).map((e) => e.k + ': ' + e.t).join('\n'));
        fin.click();
        break;
      }
      const btns = [...w.document.querySelectorAll('#actsin [data-a]')].filter((b) => !b.disabled);
      if (!btns.length) { errs.push('no buttons in phase ' + run.phase); stats.stuck++; break; }
      const by = (pre) => btns.filter((b) => b.getAttribute('data-a').startsWith(pre));
      let target;
      if (run.phase === 'combat' && SMART) {
        const cb = run.combat;
        const hpf = hero.hp / hero.hpMax;
        const has = (p) => btns.find((b) => b.getAttribute('data-a') === p);
        const pot = hero.inv.potion > 0 && !cb.acted.bonus;
        const inItems = cb.menu === 'items', inPow = cb.menu === 'powers';
        if (hpf < 0.4 && pot && !inItems && !inPow && has('cm:items')) target = has('cm:items');
        else if (inItems) target = has('ca:i:potion') && hpf < 0.5 ? has('ca:i:potion') : has('cm:main');
        else if (inPow) {
          const order = ['ca:p:second_wind', 'ca:p:action_surge', 'ca:p:shield', 'ca:p:guiding_bolt', 'ca:p:scorching_ray', 'ca:p:magic_missile', 'ca:p:firebolt', 'ca:p:sacred_flame', 'ca:p:hide', 'ca:p:breath', 'ca:p:cure_wounds'];
          const want = hpf < 0.5 && has('ca:p:cure_wounds') ? has('ca:p:cure_wounds') : hpf < 0.5 && has('ca:p:second_wind') ? has('ca:p:second_wind') : order.map(has).find((x) => x && !/second_wind|cure_wounds|shield|action_surge|hide/.test(x.getAttribute('data-a')));
          target = want || has('cm:main');
        } else if ((hero.cls === 'wizard' || hero.cls === 'cleric') && has('cm:powers')) target = has('cm:powers');
        else if (hero.cls === 'rogue' && hero.level >= 2 && has('cm:powers') && !cb.pc.hidden && !cb.acted.bonus && rnd() < 0.5) target = has('cm:powers');
        else target = has('ca:attack') || btns[0];
        if (inPow && hero.cls === 'rogue') target = has('ca:p:hide') && !cb.pc.hidden ? has('ca:p:hide') : has('cm:main');
      } else if (run.phase === 'combat') {
        const r = rnd();
        const atk = by('ca:attack'), pw = by('ca:p:'), cm = by('cm:powers'), items = by('ca:i:'), itm = by('cm:items');
        if (pw.length) target = pick(pw);
        else if (r < 0.15 && cm.length) target = cm[0];
        else if (r < 0.2 && itm.length) target = itm[0];
        else if (items.length) target = pick(items);
        else if (r < 0.27 && by('ca:flee').length) target = by('ca:flee')[0];
        else if (r < 0.32 && by('ca:defend').length) target = by('ca:defend')[0];
        else if (r < 0.34 && by('free-web').length) target = by('free-web')[0];
        else if (atk.length) target = atk[0];
        else target = pick(btns.filter((b) => b.getAttribute('data-a') !== 'cm:main').concat(by('cm:main')));
        if (rnd() < 0.2) { const foes = by('sel:'); if (foes.length) foes[Math.floor(rnd() * foes.length)].click(); }
      } else if (run.phase === 'room' && rnd() < 0.2 && w.document.querySelector('#actsin [data-a="ideas"]:not([disabled])')) {
        const before = run.cur.choices.length;
        w.document.querySelector('#actsin [data-a="ideas"]').click();
        for (let t = 0; t < 8 && w.document.querySelector('#actsin [data-a="ideas"][disabled]'); t++) await tick();
        await tick(); await tick();
        const ideas = run.cur.choices.filter((c) => c.idea);
        stats.ideas = (stats.ideas || 0) + ideas.length;
        if (ideas.length !== 3) errs.push('expected 3 idea choices, got ' + ideas.length);
        ideas.forEach((c) => { if (!c.label || /undefined|null|\{/.test(c.label) || (c.kind === 'check' && (!c.skill || !SKILLS_OK.has(c.skill)))) errs.push('bad idea choice ' + JSON.stringify(c.label)); });
        if (w.document.querySelectorAll('#actsin .opt.ideas').length !== 1) errs.push('ideas button missing');
        if (rnd() < 0.7 && ideas.length) {
          const pre = JSON.stringify(D.S);
          w.document.querySelector('#actsin [data-a="pick:' + ideas[Math.floor(rnd() * ideas.length)].id + '"]').click();
          await answerDice(pre);
        }
        continue;
      } else if (run.phase === 'room' && rnd() < 0.12 && w.document.getElementById('free')) {
        const inp = w.document.getElementById('free');
        inp.value = pick(['I search the walls for hidden levers', 'sneak past quietly', 'talk to them calmly', 'smash it with my shoulder', 'cast a spell to dispel the wards', 'dance wildly', 'attack!']);
        const preF = JSON.stringify(D.S);
        w.document.querySelector('[data-a="free"]').click();
        await tick(); await tick(); await tick();
        await answerDice(preF);
        continue;
      } else {
        const good = btns.filter((b) => !/^(sheet|journal|menu|pot)$/.test(b.getAttribute('data-a')) && b.getAttribute('data-a') !== 'free');
        target = pick(good.length ? good : btns);
        const cont = by('pick:continue');
        if (cont.length && rnd() < 0.5) target = cont[0];
        const fort = by('fort');
        if (fort.length && rnd() < 0.6) target = fort[0];
      }
      const pre = JSON.stringify(D.S);
      target.click();
      await answerDice(pre);
    }
    if (D.S.run) { errs.push('run did not finish in 700 steps; phase ' + D.run.phase); stats.stuck++; break; }
  }
  stats.runs++;
  if (heroRef) { const lv = heroRef.level; }
  if (errs.length) stats.errors.push({ i, cls, errs: errs.slice(0, 4) });
  w.close();
}

(async () => {
  for (let i = 0; i < N; i++) await playOne(i);
  console.log(JSON.stringify({ ideas: stats.ideas || 0, ideaCalls: stats.ideaCalls || 0, dice: DICE, prompts: stats.prompts, promptKinds: stats.promptKinds, rejected: stats.rejected, runs: stats.runs, steps: stats.steps, endings: stats.endings, deaths: stats.deaths, levels: stats.levels, twists: stats.twists, hooks: stats.hooks, themes: stats.byTheme, byClass: stats.byClass, stuck: stats.stuck }, null, 1));
  console.log('ERRORS', stats.errors.length);
  stats.errors.slice(0, 6).forEach((e) => console.log(JSON.stringify(e)));
  console.log('BADTEXT', stats.badText.length);
  [...new Set(stats.badText)].slice(0, 10).forEach((t) => console.log(t));
})();
