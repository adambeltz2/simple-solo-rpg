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
  for (const [forgiving, fixed] of [[true, 0.99], [false, 0.99], [false, 0.6]]) {
    console.log('--- forgiving=' + forgiving + ' rolls=' + fixed);
    const { w, errs } = await boot();
    const D = w.__delve;
    D.setRand(() => fixed); /* fixed dice: nat 20s revive, 13s stabilise; nobody dies by chance */
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
    /* the foe may have struck first and already felled the hero inside startCombat */
    if (D.run.combat) {
      ok(D.run.combat.enemies.some((e) => e.traitor), 'the traitor is in the fight');
      A.down();
    } else ok(h.memories.length >= 1, 'hero was felled before the first turn');
    ok(h.memories.length === 1, 'defeat by the traitor upgrades the same memory (no duplicate)');
    ok(/struck me down/.test(h.memories[0].text) && h.memories[0].text !== m0, 'memory text upgraded to the stronger version: ' + h.memories[0].text);
    ok(!/\bhim said|\bher said|\bhim ran|\bher ran/.test(m0), 'pronouns read correctly: ' + m0);
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
  /* rest-scene dwelling, memory-born ideas and the AI retelling */
  console.log('--- dwell / ideas / retell');
  {
    const { w, errs } = await boot();
    const D = w.__delve;
    const A = D.api;
    const h = mkHero(w, 'Brenna');
    h.memories = [
      { id: 'm1', kind: 'betrayal', text: 'Dunmore turned on me at the worst moment, in the Hollow Vault.', src: 'x', who: 'Dunmore', tags: ['dunmore'], adv: 'The Old Oath', seed: 'old', used: 1, resolved: '', edited: false },
      { id: 'm2', kind: 'left_for_dead', text: 'A goblin beat me down in the mossy crypt. I woke later, alone.', src: 'crypt', who: '', tags: [], adv: 'The Old Oath', seed: 'old', used: 0, resolved: '', edited: false },
    ];
    h.memSeq = 2;
    A.beginRun(h, 'mem-test-3', 'random');
    const adv = D.run.adv;
    const rid = Object.keys(adv.rooms).find((k) => adv.rooms[k].type === 'combat');
    adv.rooms[rid].type = 'rest'; adv.rooms[rid].kind = 'camp';
    A.enterRoom(rid);
    const dc = D.run.cur.choices.find((c) => /^Think over/.test(c.label));
    ok(!!dc && /left for dead/.test(dc.label), 'rest scene offers to think over the latest memory: ' + (dc && dc.label));
    const f0 = h.fortune;
    A.applyFx(dc.s);
    ok(h.memories[1].dwelt === true, 'dwelling marks the memory');
    A.enterRoom(rid);
    const dc2 = D.run.cur.choices.find((c) => /^Think over/.test(c.label));
    ok(dc2 && /Dunmore/.test(dc2.label), 'next rest offers the other memory: ' + (dc2 && dc2.label));
    A.applyFx(dc2.s);
    A.enterRoom(rid);
    ok(!D.run.cur.choices.some((c) => /^Think over/.test(c.label)), 'no more to think over once both are dwelt on');
    ok(A.memoryIdeas({ type: 'rest' }).length === 1 && A.memoryIdeas({ type: 'twist' }).length === 1 && A.memoryIdeas({ type: 'boss' }).length === 1, 'memories suggest ideas for rest, twist and boss scenes');
    ok(A.memoryIdeas({ type: 'treasure' }).length === 0, 'no memory ideas elsewhere');

    /* retell with a mock model */
    w.__mockLLM = { chat: { completions: { async create(o) {
      if (o.stream) return (async function* () { for (const x of 'I trusted Dunmore once, and Dunmore left me bleeding in the dark of the Hollow Vault.'.split(' ')) yield { choices: [{ delta: { content: x + ' ' } }] }; })();
      return { choices: [{ message: { content: '{}' } }] };
    } } }, interruptGenerate() {} };
    await D.AI.load('small');
    D.S.settings.narrator = 'ai';
    D.onAct('journal'); D.onAct('jt:mem');
    ok(/Retell in my voice/.test(w.document.getElementById('modal').innerHTML), 'Retell button shows when the narrator is on');
    D.onAct('mem:retell:m1');
    await new Promise((r) => setTimeout(r, 200));
    ok(D.V.memDraft && D.V.memDraft.id === 'm1' && /Dunmore/.test(D.V.memDraft.text), 'a retold draft is offered, not saved: ' + (D.V.memDraft && D.V.memDraft.text));
    ok(h.memories[0].text.startsWith('Dunmore turned on me'), 'original text unchanged until accepted');
    D.onAct('mem:keep:m1');
    ok(h.memories[0].text.startsWith('I trusted Dunmore') && h.memories[0].edited && !D.V.memDraft, 'keeping the draft replaces the memory text');
    /* a retelling that loses the betrayer's name is refused */
    h.memories.push({ id: 'm3', kind: 'betrayal', text: 'Dunmore betrayed me in the Hollow Vault, again and again.', src: 'x', who: 'Dunmore', tags: [], adv: 'x', seed: 'old2', used: 0, resolved: '', edited: false });
    w.__mockLLM.chat.completions.create = async (o) => (async function* () { for (const x of 'Someone I trusted left me bleeding in the dark, long ago.'.split(' ')) yield { choices: [{ delta: { content: x + ' ' } }] }; })();
    D.onAct('mem:retell:m3');
    await new Promise((r) => setTimeout(r, 200));
    ok(!D.V.memDraft, 'a retelling that drops the betrayer name is refused');
    ok(h.memories.find((m) => m.id === 'm3').text.startsWith('Dunmore betrayed'), 'and the memory is untouched');
    ok(errs.length === 0, 'no script errors' + (errs.length ? ': ' + errs.slice(0, 3).join('; ') : ''));
  }
  /* new memory kinds and their callbacks */
  console.log('--- loss / abandoned ally / endings');
  {
    const { w, errs } = await boot();
    const D = w.__delve;
    const A = D.api;
    const h = mkHero(w, 'Ingrid');
    A.beginRun(h, 'mem-test-4', 'random');
    const adv = D.run.adv;
    adv.npcs.ally = { id: 'ally', name: 'Tilda', role: 'scout', pr: { o: 'her', p: 'her' }, att: 1, met: true, alive: true, active: true, captive: false, betrayer: false, hp: 14, hpMax: 14 };
    A.rememberLoss(adv.npcs.ally);
    ok(h.memories.some((m) => m.kind === 'loss' && m.who === 'Tilda'), 'an ally falling is remembered as a loss');
    A.rememberLoss(adv.npcs.ally);
    ok(h.memories.filter((m) => m.kind === 'loss').length === 1, 'the same loss is not recorded twice');
    A.applyFx({ mem: 'abandoned', flags: ['ally_abandoned'] });
    const ab = h.memories.find((m) => m.kind === 'choice');
    ok(ab && ab.ret === 'abandoned' && ab.who === 'Tilda', 'leaving a captive ally bound is remembered as a hard choice');
    D.run.led.flags.defeated = true;
    A.rememberEnding('spared', true);
    ok(h.memories.some((m) => m.kind === 'choice' && /let .* walk away/.test(m.text)), 'sparing the villain is remembered');
    ok(h.memories.some((m) => m.kind === 'triumph'), 'winning after being left for dead is a triumph');
    ok(h.memories.length <= 12, 'memory list stays capped');
    A.leaveRun();
    const md = A.heroMarkdown(h);
    ok(/\(loss, Tilda\)/.test(md) && /\(triumph\)/.test(md) && /\(hard choice, Tilda\)/.test(md), 'markdown names each kind');

    A.beginRun(h, 'mem-test-5', 'random');
    const a2 = D.run.adv;
    ok(a2.npcs.ret && a2.npcs.ret.from === 'abandoned' && a2.npcs.ret.name === 'Tilda', 'the ally you left bound returns');
    const rid = Object.keys(a2.rooms).find((k) => a2.rooms[k].npc === 'ret');
    A.enterRoom(rid);
    const labels = D.run.cur.choices.map((c) => c.label);
    ok(labels.some((l) => /Apologise/.test(l)) && labels.some((l) => /coin/.test(l)) && labels.some((l) => /Walk on/.test(l)), 'abandoned-ally scene offers amends: ' + labels.join(' | '));
    const ap = D.run.cur.choices.find((c) => /Apologise/.test(c.label));
    A.applyFx(ap.s);
    ok(h.memories.find((m) => m.id === ab.id).resolved === 'atoned' && /made it right/.test(h.memories.find((m) => m.id === ab.id).text), 'making amends settles the memory');

    const rid2 = Object.keys(a2.rooms).find((k) => a2.rooms[k].type === 'combat');
    a2.rooms[rid2].type = 'rest'; a2.rooms[rid2].kind = 'camp';
    A.enterRoom(rid2);
    ok(D.run.log.some((e) => /thinking of Tilda/.test((e.t || '') + (e.tpl || ''))), 'a rest stop recalls the fallen ally');
    const lab = D.run.cur.choices.map((c) => c.label);
    ok(lab.some((l) => /Remember Tilda|Remember getting up again|Think over/.test(l)), 'rest offers to dwell on a memory: ' + lab.join(' | '));
    ok(errs.length === 0, 'no script errors' + (errs.length ? ': ' + errs.slice(0, 3).join('; ') : ''));
  }
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();
