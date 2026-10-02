/* ---------- optional on-device narrator (WebLLM) ---------- */
const MODELS = {
  tiny: { label: 'Tiny: Llama 3.2 1B', id: 'Llama-3.2-1B-Instruct', size: '~0.7 GB', note: 'Fastest, plainest prose.' },
  small: { label: 'Small: Qwen2.5 1.5B', id: 'Qwen2.5-1.5B-Instruct', size: '~1 GB', note: 'Recommended balance.' },
  better: { label: 'Better: Qwen2.5 3B', id: 'Qwen2.5-3B-Instruct', size: '~2 GB', note: 'Best prose, needs a newer phone.' },
};
const WEBLLM_URL = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm';

const AI = {
  lib: null, engine: null, status: 'off', modelKey: null, modelId: null, progress: 0, msg: '', err: '', f16: false,
  async support() {
    if (window.__mockLLM) return { ok: true, f16: true };
    if (!navigator.gpu) return { ok: false, why: 'This browser has no WebGPU. Try Chrome on a recent Android phone.' };
    try {
      const ad = await navigator.gpu.requestAdapter();
      if (!ad) return { ok: false, why: 'No WebGPU adapter was found on this device.' };
      return { ok: true, f16: !!(ad.features && ad.features.has('shader-f16')) };
    } catch (e) { return { ok: false, why: String((e && e.message) || e) }; }
  },
  fullId(key, f16) { return MODELS[key].id + (f16 ? '-q4f16_1-MLC' : '-q4f32_1-MLC'); },
  async cached(key) {
    if (window.__mockLLM) return true;
    try {
      const sup = await this.support();
      if (!sup.ok) return false;
      if (!this.lib) this.lib = await import(WEBLLM_URL);
      return !!(await this.lib.hasModelInCache(this.fullId(key, sup.f16)));
    } catch (e) { return false; }
  },
  async load(key, cb) {
    this.err = '';
    if (window.__mockLLM) { this.engine = window.__mockLLM; this.status = 'ready'; this.modelKey = key; return true; }
    this.status = 'loading';
    this.progress = 0;
    const sup = await this.support();
    if (!sup.ok) { this.status = 'error'; this.err = sup.why; return false; }
    this.f16 = sup.f16;
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      if (!this.lib) this.lib = await import(WEBLLM_URL);
      const id = this.fullId(key, sup.f16);
      this.engine = await this.lib.CreateMLCEngine(id, {
        initProgressCallback: (r) => { this.progress = r.progress || 0; this.msg = r.text || ''; if (cb) cb(this.progress, this.msg); },
      });
      this.modelKey = key; this.modelId = id; this.status = 'ready';
      return true;
    } catch (e) {
      this.status = 'error';
      this.err = String((e && e.message) || e);
      this.engine = null;
      return false;
    }
  },
  interrupt() { try { if (this.engine && this.engine.interruptGenerate) this.engine.interruptGenerate(); } catch (e) { /* ignore */ } },
  async chat(messages, o) {
    o = o || {};
    const eng = this.engine;
    if (o.json) {
      const r = await eng.chat.completions.create({ messages, max_tokens: o.max || 60, temperature: o.temp !== undefined ? o.temp : 0.1, response_format: { type: 'json_object', schema: JSON.stringify(o.json) } });
      return r.choices[0].message.content;
    }
    const stream = await eng.chat.completions.create({ messages, max_tokens: o.max || 130, temperature: o.temp || 0.8, top_p: 0.9, stream: true });
    let out = '';
    for await (const chunk of stream) {
      const t = (chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) || '';
      out += t;
      if (o.onToken) o.onToken(out);
    }
    return out;
  },
};
const aiOn = () => S && S.settings.narrator === 'ai' && AI.status === 'ready' && !!AI.engine;

const NARR_SYS = 'You are the narrator of a solo fantasy dungeon-crawl tabletop game. Rewrite the DRAFT as vivid prose in second person, present tense. Keep every fact, name, number and outcome exactly as written. Never add new characters, items, monsters or events. Never offer choices or ask questions. Output only the rewritten passage, 2 to 4 sentences.';
function cleanNarration(t, draft) {
  t = String(t || '').replace(/^\s*(narrator|passage|rewritten passage)\s*:\s*/i, '').replace(/[*_#`>]/g, '').replace(/\s+\n/g, '\n').trim();
  if (t.length < 25) return null;
  if (/^(draft|sure|certainly|here)/i.test(t)) return null;
  const m = t.match(/^[\s\S]*[.!?]["')]?/);
  if (m && m[0].length > 40) t = m[0];
  if (t.length > 900) return null;
  return t;
}
const Narrator = {
  queue: [], running: null,
  request(entry, facts) {
    if (!aiOn()) return;
    this.queue.push({ entry, facts });
    if (this.queue.length > 3) this.queue.shift();
    this.pump();
  },
  userMoved() {
    this.queue.length = 0;
    if (this.running) { this.running.aborted = true; AI.interrupt(); }
  },
  async pump() {
    if (this.running) return;
    const job = this.queue.shift();
    if (!job) return;
    this.running = job;
    try { await this.runJob(job); } catch (e) { job.entry.t = job.entry.tpl; job.entry.live = false; if (ui.onEntry) ui.onEntry(job.entry); }
    this.running = null;
    this.pump();
  },
  async runJob(job) {
    const e = job.entry, f = job.facts;
    const lines = [];
    lines.push('Setting: ' + f.setting + '. Story: ' + f.story + '.');
    lines.push('Hero: ' + f.hero + '.');
    if (f.backstory) lines.push('Hero backstory: ' + String(f.backstory).slice(0, 240));
    if (f.recent && f.recent.length) lines.push('Recent events: ' + f.recent.join('; ') + '.');
    if (f.action) lines.push('The hero just chose to: ' + f.action + ' (' + f.result + ').');
    lines.push('DRAFT: ' + f.draft);
    const long = f.kind === 'twist' || f.kind === 'boss' || f.kind === 'epilogue';
    e.live = true;
    if (ui.onEntry) ui.onEntry(e);
    let last = '';
    const text = await AI.chat([{ role: 'system', content: NARR_SYS }, { role: 'user', content: lines.join('\n') }], {
      max: long ? 170 : 120,
      onToken: (t) => { last = t; if (!job.aborted) { e.t = t; if (ui.onEntry) ui.onEntry(e); } },
    });
    e.live = false;
    const cleaned = cleanNarration(job.aborted ? last : text, f.draft);
    if (cleaned && (!job.aborted || cleaned.length > 70)) { e.t = cleaned; e.ai = true; } else e.t = e.tpl;
    if (ui.onEntry) ui.onEntry(e);
    save();
  },
};

/* ---------- free-text actions ---------- */
const APPROACHES = Object.keys(SKILLS).concat(['attack']);
const KEYWORDS = [
  [/\b(sneak|hide|creep|quiet|shadow|stealth|tiptoe)/i, 'stealth'],
  [/\b(pick|lock|disarm|tinker|steal|pocket|jimmy|unlatch)/i, 'sleight'],
  [/\b(persuade|talk|ask|negotiate|convince|plead|bargain|charm|reason|befriend|appeal)/i, 'persuasion'],
  [/\b(lie|trick|bluff|deceive|pretend|disguise|fake|con)\b/i, 'deception'],
  [/\b(threat|intimidat|scare|menace|growl|demand|bully|terrif)/i, 'intimidation'],
  [/\b(search|examine|inspect|study|investigate|check|look closely|analy|probe|poke)/i, 'investigation'],
  [/\b(listen|watch|scout|notice|look|peek|spot|observe)/i, 'perception'],
  [/\b(climb|jump|push|break|lift|bash|force|smash|shove|kick|heave|ram|drag|wedge)/i, 'athletics'],
  [/\b(dodge|roll|leap|swing|vault|balance|duck|dash|tumble|slide)/i, 'acrobatics'],
  [/\b(spell|magic|arcane|cast|dispel|rune|glyph|enchant|ward|fire|lightning)/i, 'arcana'],
  [/\b(pray|holy|bless|faith|divine|god|sacred|incense|altar)/i, 'religion'],
  [/\b(heal|bandage|treat|cure|medic|tend|poultice)/i, 'medicine'],
  [/\b(recall|lore|remember|history|read|legend|scholar|translate)/i, 'history'],
  [/\b(track|forage|survive|navigate|trail|follow)/i, 'survival'],
  [/\b(nature|beast|animal|plant|herb|calm|tame|mushroom)/i, 'nature'],
  [/\b(sense|insight|motive|read them|mood|truth)/i, 'insight'],
  [/\b(attack|kill|stab|slash|fight|strike|charge|slay|hit|shoot)/i, 'attack'],
];
function keywordIntent(text) {
  for (let i = 0; i < KEYWORDS.length; i++) if (KEYWORDS[i][0].test(text)) return KEYWORDS[i][1];
  /* no keyword: use whatever the hero is best at among broad skills */
  const pool = ['investigation', 'perception', 'persuasion', 'athletics', 'insight'];
  return pool.slice().sort((a, b) => skillMod(hero, b) - skillMod(hero, a))[0];
}
async function parseIntent(text) {
  if (aiOn()) {
    try {
      const schema = { type: 'object', properties: { approach: { type: 'string', enum: APPROACHES } }, required: ['approach'] };
      const out = await AI.chat([
        { role: 'system', content: 'Classify a fantasy tabletop RPG player action into one approach. Reply as JSON. Skills: ' + APPROACHES.join(', ') + '. "attack" means starting violence.' },
        { role: 'user', content: 'Action: "' + String(text).slice(0, 200).replace(/"/g, "'") + '"' },
      ], { json: schema, max: 40 });
      const j = JSON.parse(out);
      if (j && APPROACHES.includes(j.approach)) return j.approach;
    } catch (e) { /* fall back to keywords */ }
  }
  return keywordIntent(text);
}
const FREE_TYPES = ['combat', 'trap', 'puzzle', 'hazard', 'lore', 'treasure', 'social', 'entrance'];
function canFreeAct() {
  if (!run || run.phase !== 'room' || !run.cur) return false;
  const room = run.adv.rooms[run.roomId];
  if (!FREE_TYPES.includes(room.type)) return false;
  if (room.type === 'social') return run.cur.acts < 2;
  return !run.cur.resolved;
}
async function freeAction(text) {
  text = String(text || '').trim().slice(0, 140);
  if (!text || !canFreeAct()) return;
  const roomId = run.roomId;
  const skillKey = await parseIntent(text);
  if (!run || run.roomId !== roomId || !canFreeAct()) return;
  withDice(() => resolveFree(text, skillKey, roomId));
}
function buildFreeChoice(label, skillKey, room) {
  const L = hero.level;
  let skill = skillKey === 'attack' ? 'athletics' : skillKey;
  let dc = room.dc || room.ambushDC || room.dcTalk || dcFor(L, 0);
  const g = genericFx(room);
  let s = g.s, f = g.f;
  if (room.type === 'combat') {
    dc = skill === 'stealth' ? room.ambushDC : room.talkDC + 1;
    if (skillKey === 'attack') return C(label, { kind: 'combat', fx: { combat: { enemies: room.enemies, surprise: null } } });
    s = { combat: { enemies: room.enemies, surprise: 'player' } };
    f = { combat: { enemies: room.enemies, surprise: 'enemy' } };
  } else if (room.type === 'social') {
    const id = room.npc;
    dc = room.dcTalk;
    s = { att: { [id]: 1 }, clue: 1 };
    f = { att: { [id]: -1 } };
  } else if (room.type === 'entrance') {
    s = { flags: ['quiet_start'], clue: 0 };
    f = { alert: 1 };
  } else {
    if (room.good && room.good.includes(skill)) dc -= 2;
    else if (skill !== room.skill && skill !== room.alt) dc += 2;
  }
  const ok = fill(pickR(TPL.succ[skill]), { obj: room.obj || 'it', Obj: cap(room.obj || 'it') });
  const no = fill(pickR(TPL.fail[skill]), { obj: room.obj || 'it', Obj: cap(room.obj || 'it') });
  return C(label, { kind: 'check', skill, dc, s, f, ok, no, drive: 'curiosity' });
}
function resolveFree(text, skillKey, roomId) {
  const room = run.adv.rooms[roomId];
  const c = buildFreeChoice('✎ ' + text, skillKey, room);
  run.cur.choices.push(c);
  pickChoice(c.id);
}

/* ---------- other ideas: the way out of a fixed menu ----------
   Offline, ideas come from a built-in pool. With the on-device model ready it writes them instead, fitted to the scene.
   Either way the model only proposes a label and an approach (a skill); the code sets the difficulty and the outcome. */
const IDEA_POOL = {
  combat: [['Shout a challenge and draw them out one at a time', 'intimidation'], ['Hurl a stone to pull them away from their post', 'acrobatics'], ['Bluff that reinforcements are right behind you', 'deception'], ['Look for something in the room to turn against them', 'investigation'], ['Offer them a way out before blades are drawn', 'persuasion'], ['Read how they stand and find the weak link', 'insight']],
  trap: [['Trigger it from a distance with a thrown stone', 'acrobatics'], ['Wedge something into the mechanism', 'sleight'], ['Work out who built it, and how they would cross', 'investigation'], ['Test the floor with your weapon, inch by inch', 'perception'], ['Recall how traps like this are usually made', 'history']],
  puzzle: [['Look for wear on the mechanism to see what is used most', 'perception'], ['Search for a second trigger the makers hid', 'investigation'], ['Recall similar devices from old stories', 'history'], ['Trace the pattern with a steady hand', 'sleight'], ['Ask what the makers would want protected', 'insight']],
  hazard: [['Test the way with a thrown pebble first', 'survival'], ['Watch how it shifts and time your crossing', 'perception'], ['Improvise a bridge from your pack', 'athletics'], ['Look for how animals get across', 'nature'], ['Leap from the safest footing you can see', 'acrobatics']],
  lore: [['Copy the key lines to study later', 'investigation'], ['Set it beside what you already know of this place', 'history'], ['Look for what was scratched out', 'perception'], ['Read it aloud, softly, and listen', 'religion'], ['Ask who wanted this kept, and why', 'insight']],
  treasure: [['Check the lid and hinges for tricks', 'investigation'], ['Listen at the lock', 'perception'], ['Take only what will not be missed', 'sleight'], ['Look for who has been here before you', 'survival'], ['Test it for old magic first', 'arcana']],
  social: [['Offer something small before asking anything', 'persuasion'], ['Ask what they are most afraid of', 'insight'], ['Tell them a careful half-truth', 'deception'], ['Find common ground over a shared enemy', 'persuasion'], ['Stand your ground and name your terms', 'intimidation']],
  entrance: [['Scout the walls for guard routines', 'perception'], ['Wait, then follow someone inside', 'stealth'], ['Make a distraction at the far side', 'deception'], ['Read the tracks around the entrance', 'survival'], ['Climb to a ledge and look down on the place', 'athletics']],
};
let ideasBusy = false;
function cleanIdea(s) {
  s = String(s || '').replace(/["“”`*_#]/g, '').replace(/\s+/g, ' ').replace(/[.!\s]+$/, '').trim();
  if (s.length < 5 || s.length > 70 || /undefined|null|\{|\}/.test(s)) return null;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function poolIdeas(room, n, avoid) {
  const pool = (IDEA_POOL[room.type] || IDEA_POOL.lore).filter((p) => !avoid.has(p[0].toLowerCase()));
  /* favour what this hero is good at, with some chance of the unexpected */
  const scored = pool.map((p) => ({ p, k: skillMod(hero, p[1]) + rnd() * 4 })).sort((a, b) => b.k - a.k);
  const out = [], seen = new Set();
  scored.forEach((x) => { if (out.length < n && !seen.has(x.p[1])) { seen.add(x.p[1]); out.push({ label: x.p[0], approach: x.p[1] }); } });
  scored.forEach((x) => { if (out.length < n && !out.some((o) => o.label === x.p[0])) out.push({ label: x.p[0], approach: x.p[1] }); });
  return out;
}
function sceneText() {
  for (let i = run.log.length - 1; i >= 0; i--) { const e = run.log[i]; if (e.k === 'narr' && e.tpl) return e.tpl; }
  return '';
}
async function aiIdeas(room, avoid) {
  const schema = { type: 'object', properties: { ideas: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'object', properties: { action: { type: 'string' }, approach: { type: 'string', enum: APPROACHES } }, required: ['action', 'approach'] } } }, required: ['ideas'] };
  const lines = [];
  lines.push('Place: ' + room.name + ' (' + themeOf().n + ').');
  lines.push('Scene: ' + sceneText().slice(0, 420));
  if (room.enemies && room.enemies.length) lines.push('Foes here: ' + enemyNames(room.enemies) + '.');
  lines.push('Hero: ' + hero.name + ', ' + SPECIES[hero.species].n + ' ' + CLASSES[hero.cls].n + ', ' + BACKGROUNDS[hero.bg].n + '.');
  if (hero.story) lines.push('Hero backstory: ' + String(hero.story).slice(0, 200));
  lines.push('Goal of the quest: ' + run.adv.goal + '.');
  lines.push('Options the player already has (do not repeat them): ' + run.cur.choices.filter((c) => c.id !== 'continue' && c.id !== 'search').map((c) => c.label).join('; ') + '.');
  const out = await AI.chat([
    { role: 'system', content: 'You help a solo fantasy tabletop player who feels the menu is too narrow. Suggest 3 different, creative things the hero could try right now. Use only what the scene mentions; never invent new monsters, people or magic items. Each action is a short imperative phrase of at most 9 words, written for the hero (no "you"). Make the three clearly different from each other, and pick the approach (skill) that fits each. "attack" means starting violence. Reply as JSON.' },
    { role: 'user', content: lines.join('\n') },
  ], { json: schema, max: 260, temp: 0.85 });
  const j = JSON.parse(out);
  const res = [], seen = new Set(avoid);
  (j.ideas || []).forEach((x) => {
    const label = cleanIdea(x && x.action);
    if (!label || seen.has(label.toLowerCase())) return;
    seen.add(label.toLowerCase());
    res.push({ label, approach: x && APPROACHES.includes(x.approach) ? x.approach : keywordIntent(label) });
  });
  return res.slice(0, 3);
}
async function makeIdeas() {
  if (ideasBusy || !canFreeAct()) return;
  const roomId = run.roomId, curRef = run.cur;
  const room = run.adv.rooms[roomId];
  const avoid = new Set(run.cur.choices.map((c) => String(c.label).replace(/^[✎💡]\s*/, '').toLowerCase()));
  let ideas = [];
  let via = 'built-in';
  if (aiOn()) {
    ideasBusy = true;
    changed();
    try { ideas = await aiIdeas(room, avoid); via = 'ai'; } catch (e) { ideas = []; }
    ideasBusy = false;
    if (!run || run.roomId !== roomId || run.cur !== curRef || !canFreeAct()) { if (run) changed(); return; }
  }
  if (ideas.length < 3) {
    const have = new Set(Array.from(avoid).concat(ideas.map((x) => x.label.toLowerCase())));
    poolIdeas(room, 3 - ideas.length, have).forEach((x) => ideas.push(x));
  }
  run.cur.choices = run.cur.choices.filter((c) => !c.idea || run.cur.used.includes(c.id));
  const at = run.cur.choices.findIndex((c) => c.id === 'continue' || c.id === 'search');
  const made = ideas.slice(0, 3).map((x) => { const c = buildFreeChoice('💡 ' + x.label, x.approach, room); c.idea = via; return c; });
  if (at >= 0) run.cur.choices.splice(at, 0, ...made); else run.cur.choices.push(...made);
  save();
  changed();
}
