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
      const r = await eng.chat.completions.create({ messages, max_tokens: o.max || 60, temperature: 0.1, response_format: { type: 'json_object', schema: JSON.stringify(o.json) } });
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
  const room = run.adv.rooms[roomId];
  const L = hero.level;
  let skill = skillKey === 'attack' ? 'athletics' : skillKey;
  let dc = room.dc || room.ambushDC || room.dcTalk || dcFor(L, 0);
  const g = genericFx(room);
  let s = g.s, f = g.f;
  if (room.type === 'combat') {
    dc = skill === 'stealth' ? room.ambushDC : room.talkDC + 1;
    if (skillKey === 'attack') { run.cur.choices.push(C('✎ ' + text, { kind: 'combat', fx: { combat: { enemies: room.enemies, surprise: null } } })); pickChoice(run.cur.choices[run.cur.choices.length - 1].id); return; }
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
  const c = C('✎ ' + text, { kind: 'check', skill, dc, s, f, ok, no, drive: 'curiosity' });
  run.cur.choices.push(c);
  pickChoice(c.id);
}
