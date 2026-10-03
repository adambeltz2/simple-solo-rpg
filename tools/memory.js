/* Targeted test for hero memories: betrayal -> defeat -> returning betrayer -> settle. Run: node tools/memory.js */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const tick = () => new Promise((r) => setTimeout(r, 0));
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL: ' + m); } else console.log('ok:   ' + m); };

async function boot() {
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errs.push(e.message));
  vc.on('error', (e) => errs.push(String(e)));
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: vc, beforeParse(w) { w.confirm = () => true; w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {}; } });
  await tick(); await tick();
  return { w: dom.window, errs };
}
function mkHero(w, name) {
  const D = w.__delve;
  D.V.create = { species: 'human', cls: 'fighter', bg: 'soldier', drive: 'glory', name, story: '' };
  D.onAct('c:make');
  return D.S.heroes[D.S.heroes.length - 1];
}

(async () => {
  for (const forgiving of [true, false]) {
    console.log('--- forgiving=' + forgiving);
    const { w, errs } = await boot();
    const D = w.__delve;
    const A = D.api;
    D.S.settings.forgiving = forgiving;
    const h = mkHero(w, 'Gunnar');
    ok(Array.isArray(h.memories) && h.memories.length === 0, 'new hero has an empty memories list');
    A.beginRun(h, 'mem-test-1', 'random');
    const adv = D.run.adv;
    adv.twist.type = 'ally_betrays';
    adv.npcs.ally = { id: 'ally', name: 'Dunmore', role: 'scout', pr: { o: 'him', p: 'his' }, att: 1, met: true, alive: true, active: true, captive: false, betrayer: false, hp: 14, hpMax: 14 };
    const bossId = Object.keys(adv.rooms).find((k) => adv.rooms[k].type === 'boss');
    A.enterRoom(bossId);
    ok(h.memories.length === 1 && h.memories[0].kind === 'betrayal' && h.memories[0].who === 'Dunmore', 'boss reveal records a betrayal memory');
    const m0 = h.memories[0].text;
    A.startCombat({ boss: true, surprise: null }, adv.rooms[bossId]);
    ok(D.run.combat && D.run.combat.enemies.some((e) => e.traitor), 'the traitor is in the fight');
    A.down();
    ok(h.memories.length === 1, 'defeat by the traitor upgrades the same memory (no duplicate)');
    ok(/struck me down/.test(h.memories[0].text) && h.memories[0].text !== m0, 'memory text upgraded to the stronger version: ' + h.memories[0].text);
    ok(D.run.phase === 'epilogue' || D.run.phase === 'dead', 'boss defeat ends the adventure (' + D.run.phase + ')');
    if (D.run.phase === 'dead') { console.log('(hero died; skipping return test)'); continue; }
    ok(D.run.log.some((e) => /memory takes hold/.test(e.t)), 'a memory note appears in the log');
    A.leaveRun();
    const md = D.S.heroes.length ? A.heroMarkdown(h) : '';
    ok(/## Memories/.test(md) && /Dunmore/.test(md), 'hero markdown lists the memory');

    /* next adventure: the betrayer returns */
    A.beginRun(h, 'mem-test-2', 'random');
    const a2 = D.run.adv;
    ok(a2.npcs.ret && a2.npcs.ret.from === 'betrayer' && a2.npcs.ret.name === 'Dunmore', 'the betrayer returns in the next adventure');
    ok(h.memories[0].used === 1, 'memory marked as used');
    ok(D.run.log.some((e) => /not forgotten/.test(e.t)), 'adventure opens with the remembered line');
    const rid = Object.keys(a2.rooms).find((k) => a2.rooms[k].npc === 'ret');
    A.enterRoom(rid);
    const labels = D.run.cur.choices.map((c) => c.label);
    ok(labels.some((l) => /answer for it/.test(l)) && labels.some((l) => /second chance/.test(l)), 'betrayer scene offers confront / second chance: ' + labels.join(' | '));
    ok(D.run.log.some((e) => /who betrayed you/.test(e.t) || (e.tpl && /who betrayed you/.test(e.tpl))), 'scene intro names the betrayal');

    /* path 1: settle through a second chance */
    const c2 = D.run.cur.choices.find((c) => /second chance/.test(c.label));
    const snap = JSON.stringify(h.memories);
    A.applyFx(Object.assign({}, c2.s));
    ok(h.memories[0].resolved === 'forgiven', 'second chance settles the memory');
    ok(JSON.stringify(h.memories) !== snap && /another chance/.test(h.memories[0].text), 'memory text records how it ended');

    /* path 2: fight and kill */
    h.memories[0].resolved = ''; 
    const c1 = D.run.cur.choices.find((c) => /answer for it/.test(c.label));
    const out = A.applyFx(c1.fx);
    A.startCombat(out.combat, a2.rooms[rid]);
    const foe = D.run.combat.enemies[0];
    ok(foe.retId === 'ret' && foe.n === 'Dunmore', 'combat foe is the returning betrayer');
    A.killEnemy(foe);
    ok(a2.npcs.ret.alive === false && h.memories[0].resolved === 'slain', 'killing the betrayer settles the memory');

    /* edit / delete through the UI handlers */
    D.V.jtab = 'mem';
    D.onAct('journal');
    D.onAct('jt:mem');
    ok(/Let it go/.test(w.document.getElementById('modal').innerHTML), 'journal Memories tab renders');
    const id = h.memories[0].id;
    D.onAct('mem:del:' + id);
    ok(h.memories.length === 0, 'Let it go deletes the memory');
    ok(errs.length === 0, 'no script errors' + (errs.length ? ': ' + errs.slice(0, 3).join('; ') : ''));
  }
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();
