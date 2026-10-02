const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');

const N = parseInt(process.argv[2] || '40', 10);
const SEEDBASE = parseInt(process.argv[3] || '1', 10);
const AI_MOCK = process.argv[4] === 'ai';
const SMART = process.argv[5] === 'smart';
const DUMP = process.argv[6] === 'dump';

const stats = { runs: 0, endings: {}, errors: [], badText: [], steps: 0, stuck: 0, levels: {}, deaths: 0, byClass: {}, byTheme: {}, twists: {}, hooks: {} };

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
  if (AI_MOCK) { await D.AI.load('small'); D.S.settings.narrator = 'ai'; }
  D.onAct('c:make');
  const heroRef = D.S.heroes[0];
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
      } else if (run.phase === 'room' && rnd() < 0.12 && w.document.getElementById('free')) {
        const inp = w.document.getElementById('free');
        inp.value = pick(['I search the walls for hidden levers', 'sneak past quietly', 'talk to them calmly', 'smash it with my shoulder', 'cast a spell to dispel the wards', 'dance wildly', 'attack!']);
        w.document.querySelector('[data-a="free"]').click();
        await tick(); await tick(); await tick();
        continue;
      } else {
        const good = btns.filter((b) => !/^(sheet|journal|menu|pot)$/.test(b.getAttribute('data-a')) && b.getAttribute('data-a') !== 'free');
        target = pick(good.length ? good : btns);
        const cont = by('pick:continue');
        if (cont.length && rnd() < 0.5) target = cont[0];
        const fort = by('fort');
        if (fort.length && rnd() < 0.6) target = fort[0];
      }
      target.click();
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
  console.log(JSON.stringify({ runs: stats.runs, steps: stats.steps, endings: stats.endings, deaths: stats.deaths, levels: stats.levels, twists: stats.twists, hooks: stats.hooks, themes: stats.byTheme, byClass: stats.byClass, stuck: stats.stuck }, null, 1));
  console.log('ERRORS', stats.errors.length);
  stats.errors.slice(0, 6).forEach((e) => console.log(JSON.stringify(e)));
  console.log('BADTEXT', stats.badText.length);
  [...new Set(stats.badText)].slice(0, 10).forEach((t) => console.log(t));
})();
