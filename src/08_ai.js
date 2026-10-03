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
    if (!navigator.gpu) return { ok: false, why: 'This browser has no WebGPU, which the on-device AI needs. Open the game in Chrome (version 121 or newer, on Android 12 or newer). Firefox and some other browsers do not support it. Built-in text still works.' };
    try {
      const ad = await navigator.gpu.requestAdapter();
      if (!ad) return { ok: false, why: 'WebGPU is on, but no usable graphics adapter was found on this device. Some phones cannot run it. Built-in text still works.' };
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
    let lock = null;
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      /* a long download dies if the screen sleeps, so ask the browser to keep it awake */
      try { if (navigator.wakeLock) lock = await navigator.wakeLock.request('screen'); } catch (e) { lock = null; }
      if (!this.lib) this.lib = await import(WEBLLM_URL);
      const id = this.fullId(key, sup.f16);
      const tries = 5;
      for (let n = 1; ; n++) {
        try {
          this.engine = await this.lib.CreateMLCEngine(id, {
            initProgressCallback: (r) => { this.progress = r.progress || 0; this.msg = r.text || ''; if (cb) cb(this.progress, this.msg); },
          });
          break;
        } catch (e) {
          const m = String((e && e.message) || e);
          /* files already fetched stay in the cache, so a retry picks up where the download stopped */
          if (n >= tries || !/cache|network|fetch|load failed|timeout|abort/i.test(m)) throw e;
          this.msg = 'Connection hiccup. Resuming (try ' + (n + 1) + ' of ' + tries + ')…';
          if (cb) cb(this.progress, this.msg);
          await new Promise((r) => setTimeout(r, window.__fastRetry ? 5 : 2000 * n));
        }
      }
      this.modelKey = key; this.modelId = id; this.status = 'ready';
      return true;
    } catch (e) {
      this.status = 'error';
      const m = String((e && e.message) || e);
      this.err = /cache|network|fetch|load failed|timeout|abort/i.test(m)
        ? 'The download was interrupted (network or storage). Check your connection and that you have about 1 GB free, keep this screen open, then tap Download again. It resumes where it stopped. Details: ' + m
        : m;
      this.engine = null;
      return false;
    } finally {
      try { if (lock) lock.release(); } catch (e) { /* ignore */ }
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

const NARR_SYS = 'You are the narrator of a solo fantasy dungeon-crawl tabletop game. Rewrite the DRAFT as vivid prose in second person, present tense. Keep every fact, name, number and outcome exactly as written. Never add new characters, items, monsters or events. Never offer choices or ask questions. If hero memories are listed, you may echo one in a few words as a flicker of memory when it fits the draft, but never change or add facts because of it. Output only the rewritten passage, 2 to 4 sentences.';
const NARR_FREE = 'You are the narrator of a solo fantasy dungeon-crawl tabletop game. The hero tried the ACTION below, and it ended in the stated RESULT. In 2 to 3 sentences, second person, present tense, describe how that attempt plays out so it clearly answers what the hero tried. If the hero asked what writing, symbols or speech say, give a short, modest answer that fits the scene and the quest without changing the plot. Keep the RESULT exactly (success or failure). Never add new monsters, named characters or magic items. Treat the DRAFT only as mood and ignore any detail in it that does not fit the ACTION. Output only the passage.';
function cleanNarration(t, draft) {
  t = String(t || '').replace(/^\s*(narrator|passage|rewritten passage)\s*:\s*/i, '').replace(/[*_#`>]/g, '').replace(/\s+\n/g, '\n').trim();
  if (t.length < 25) return null;
  if (/^(draft|sure|certainly|here)/i.test(t)) return null;
  const m = t.match(/^[\s\S]*[.!?]["')]?/);
  if (m && m[0].length > 40) t = m[0];
  if (t.length > 900) return null;
  return t;
}
/* The narrator works at the reader's pace: one passage per beat (a beat ends when the player taps something), the
   passage stays blank with a cursor until its first words arrive instead of showing the draft and then replacing it,
   and nothing further is written until the player moves on. */
const Narrator = {
  queue: [], running: null, beatUsed: false,
  request(entry, facts) {
    if (!aiOn() || this.beatUsed) return;
    this.beatUsed = true;
    entry.wait = true;
    this.queue.push({ entry, facts });
    this.pump();
  },
  userMoved() {
    this.beatUsed = false;
    this.queue.forEach((j) => { j.entry.wait = false; if (ui.onEntry) ui.onEntry(j.entry); });
    this.queue.length = 0;
    if (this.running) { this.running.aborted = true; AI.interrupt(); }
  },
  /* the player gave up waiting: show the built-in text now and ignore whatever the model still produces */
  skip() {
    if (this.running) this.running.skipped = true;
    this.userMoved();
    const log = run ? run.log : [];
    log.forEach((e) => {
      if (e.k === 'narr' && (e.wait || e.live)) { e.wait = false; e.live = false; e.t = e.tpl || e.t; e.ai = false; if (ui.onEntry) ui.onEntry(e); }
      if (e.gate) e.gate = false;
    });
  },
  async pump() {
    if (this.running) return;
    const job = this.queue.shift();
    if (!job) return;
    this.running = job;
    try { await this.runJob(job); } catch (e) { job.entry.t = job.entry.tpl; job.entry.live = false; job.entry.wait = false; if (ui.onEntry) ui.onEntry(job.entry); }
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
    if (f.memories && f.memories.length) lines.push('Hero memories (may be echoed in a few words, never replacing the draft): ' + f.memories.join(' | '));
    if (f.free) {
      lines.push('Scene: ' + String(f.scene || '').slice(0, 400));
      lines.push('ACTION: ' + String(f.action).replace(/^[✎💡]\s*/, '') + '\nRESULT: ' + f.result);
    } else if (f.action) lines.push('The hero just chose to: ' + f.action + ' (' + f.result + ').');
    lines.push('DRAFT: ' + f.draft);
    const long = f.kind === 'twist' || f.kind === 'boss' || f.kind === 'epilogue';
    e.live = true;
    if (ui.onEntry) ui.onEntry(e);
    let last = '';
    const text = await AI.chat([{ role: 'system', content: f.free ? NARR_FREE : NARR_SYS }, { role: 'user', content: lines.join('\n') }], {
      max: long ? 170 : 120,
      onToken: (t) => { last = t; if (!job.aborted) { e.wait = false; e.t = t; if (ui.onEntry) ui.onEntry(e); } },
    });
    e.live = false;
    e.wait = false;
    if (job.skipped) { e.t = e.tpl; e.ai = false; e.gate = false; if (ui.onEntry) ui.onEntry(e); return; }
    const cleaned = cleanNarration(job.aborted ? last : text, f.draft);
    if (cleaned && (!job.aborted || cleaned.length > 70)) { e.t = cleaned; e.ai = true; e.gate = !job.aborted; } else e.t = e.tpl;
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
const INQUIRY = /\?\s*$|^\s*(what|who|why|how|where|when|does|do|is|are|can|could|tell|show|which)\b|\b(say|says|said|written|writing|inscription|inscribed|text|words|mean|means|meaning|decipher|symbol|symbols|sign|signs|carving|carvings|mural|label)\b/i;
function bestOf(list) {
  const u = Array.from(new Set(list.filter((k) => SKILLS[k])));
  return u.sort((a, b) => skillMod(hero, b) - skillMod(hero, a))[0];
}
/* a question or "what does it say": the player wants to find out, so pick a skill of the mind that fits this scene */
function inquireSkill() {
  const room = run && run.roomId != null ? run.adv.rooms[run.roomId] : null;
  const own = room ? [room.skill, room.alt].concat(room.good || []) : [];
  const mindOnly = own.filter((k) => SKILL_CAT[k] === 'mind');
  return bestOf(mindOnly.length ? mindOnly : ['investigation', 'history', 'religion', 'insight', 'perception']);
}
function keywordIntent(text) {
  for (let i = 0; i < KEYWORDS.length; i++) if (KEYWORDS[i][0].test(text)) return KEYWORDS[i][1];
  if (INQUIRY.test(text)) return inquireSkill();
  /* no keyword: use whatever the hero is best at among skills that rarely misfire */
  return bestOf(['investigation', 'perception', 'persuasion', 'insight']);
}
async function parseIntent(text) {
  if (aiOn()) {
    try {
      const schema = { type: 'object', properties: { approach: { type: 'string', enum: APPROACHES } }, required: ['approach'] };
      const out = await AI.chat([
        { role: 'system', content: 'Classify a fantasy tabletop RPG player action into the one skill the hero would really use. Reply as JSON. Skills: ' + APPROACHES.join(', ') + '. Guide: asking what writing, symbols or carvings say, or recalling lore = history, religion or arcana; studying or searching = investigation; noticing or listening = perception; reading a person = insight; talking = persuasion, deception or intimidation; sneaking = stealth; force, climbing or breaking = athletics; "attack" means starting violence. A question is never athletics or attack.' },
        { role: 'user', content: 'Scene: ' + sceneText().slice(0, 300).replace(/"/g, "'") + '\nAction: "' + String(text).slice(0, 200).replace(/"/g, "'") + '"' },
      ], { json: schema, max: 40 });
      const j = JSON.parse(out);
      if (j && APPROACHES.includes(j.approach)) {
        /* small models sometimes answer a question with a physical skill: keep questions to the mind */
        if (INQUIRY.test(text) && ['athletics', 'acrobatics', 'attack', 'stealth', 'sleight', 'intimidation'].includes(j.approach) && !KEYWORDS.some((k) => k[0].test(text) && k[1] === j.approach)) return keywordIntent(text);
        return j.approach;
      }
    } catch (e) { /* fall back to keywords */ }
  }
  return keywordIntent(text);
}
const FREE_TYPES = ['combat', 'trap', 'puzzle', 'hazard', 'lore', 'treasure', 'social', 'entrance', 'rest', 'twist', 'boss'];
const PROBE_TYPES = ['twist', 'boss']; // improvised actions here prepare you; they never skip the scene itself
function canFreeAct() {
  if (!run || run.phase !== 'room' || !run.cur) return false;
  const room = run.adv.rooms[run.roomId];
  if (!FREE_TYPES.includes(room.type)) return false;
  if (room.type === 'social') return run.cur.acts < 2;
  if (PROBE_TYPES.includes(room.type)) return !run.cur.resolved && !run.cur.probed;
  return !run.cur.resolved;
}
const canDoorIdeas = () => !!run && run.phase === 'doors' && !flag('scoutTried_' + run.slot);
const canIdeas = () => canFreeAct() || canDoorIdeas();
async function freeAction(text) {
  text = String(text || '').trim().slice(0, 140);
  if (!text || !canFreeAct()) return;
  const roomId = run.roomId;
  const skillKey = await parseIntent(text);
  if (!run || run.roomId !== roomId || !canFreeAct()) return;
  withDice(() => resolveFree(text, skillKey, roomId));
}
function buildFreeChoice(label, skillKey, room) {
  const c = buildFreeChoice0(label, skillKey, room);
  c.free = true;
  return c;
}
function buildFreeChoice0(label, skillKey, room) {
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
  } else if (room.type === 'rest') {
    dc = dcFor(L, 0);
    s = { rest: 0.4, clock: 1 };
    f = { rest: 0.15, clock: 1 };
    return C(label, { kind: 'check', skill, dc, s, f, ok: 'The quiet does you good.', no: 'Sleep comes thin and restless, but it is something.', drive: 'curiosity' });
  } else if (room.type === 'twist') {
    return C(label, { kind: 'check', skill, dc: dcFor(L, 1), s: { clue: 1 }, f: { clock: 1 }, ok: 'You watch closely, and a small detail clicks into place.', no: 'You miss what mattered, and the moment slips past.', drive: 'curiosity', probe: true });
  } else if (room.type === 'boss') {
    if (skillKey === 'attack') return C(label, { kind: 'combat', fx: { combat: { boss: true, surprise: null } } });
    return C(label, { kind: 'check', skill, dc: dcFor(L, 1), s: { clue: 1 }, f: { alert: 1 }, ok: 'You watch and wait, and the lair begins to make sense. You will know better where to strike.', no: 'You linger too long. A flicker of movement says you were seen.', drive: 'curiosity', probe: true });
  } else {
    if (room.good && room.good.includes(skill)) dc -= 2;
    else if (skill !== room.skill && skill !== room.alt) dc += 2;
  }
  const cat = SKILL_CAT[skill] || 'mind';
  return C(label, { kind: 'check', skill, dc, s, f, ok: pickR(TPL.freeOk[cat]), no: pickR(TPL.freeNo[cat]), drive: 'curiosity' });
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
  rest: [['Share a quiet watch and trade stories', 'insight'], ['Treat old injuries properly', 'medicine'], ['Mend and sharpen your gear', 'sleight'], ['Find a safer corner to bed down', 'survival'], ['Say a quiet prayer for the road ahead', 'religion']],
  twist: [['Watch how everyone reacts before you speak', 'insight'], ['Compare what you were told with what you see', 'investigation'], ['Recall how betrayals like this usually unfold', 'history'], ['Look around the room for evidence', 'perception']],
  boss: [['Study the lair from the shadows first', 'perception'], ['Look for the weak point in their guard', 'insight'], ['Search the lair for something to use against them', 'investigation'], ['Recall what lore says of such foes', 'arcana'], ['Listen to what they tell their followers', 'stealth']],
  doors: [['Listen at each way before choosing', 'perception'], ['Read the tracks and dust at both thresholds', 'survival'], ['Study the carvings for hints about what lies beyond', 'history'], ['Smell the air drifting from each way', 'nature'], ['Send a small noise down one way and wait', 'stealth'], ['Work out which way the guards would least expect', 'insight']],
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
  const mine = memoryIdeas(room).filter((p) => !avoid.has(p[0].toLowerCase()));
  const pool = (IDEA_POOL[room.type] || IDEA_POOL.lore).filter((p) => !avoid.has(p[0].toLowerCase()));
  /* favour what this hero is good at, with some chance of the unexpected; a memory-born idea gets a lift */
  const scored = mine.map((p) => ({ p, k: 10 + rnd() })).concat(pool.map((p) => ({ p, k: skillMod(hero, p[1]) + rnd() * 4 }))).sort((a, b) => b.k - a.k);
  const out = [], seen = new Set();
  scored.forEach((x) => { if (out.length < n && !seen.has(x.p[1])) { seen.add(x.p[1]); out.push({ label: x.p[0], approach: x.p[1] }); } });
  scored.forEach((x) => { if (out.length < n && !out.some((o) => o.label === x.p[0])) out.push({ label: x.p[0], approach: x.p[1] }); });
  return out;
}
function sceneText() {
  for (let i = run.log.length - 1; i >= 0; i--) { const e = run.log[i]; if (e.k === 'narr' && e.tpl) return e.tpl; }
  return '';
}
function doorsContext() {
  const ids = run.adv.slots[run.slot].opts;
  return ids.map((id) => { const r = run.adv.rooms[id]; return cap(r.name) + ' (' + r.hint + ')'; });
}
async function aiIdeas(room, avoid) {
  const schema = { type: 'object', properties: { ideas: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'object', properties: { action: { type: 'string' }, approach: { type: 'string', enum: APPROACHES } }, required: ['action', 'approach'] } } }, required: ['ideas'] };
  const lines = [];
  if (!room) {
    lines.push('Place: a fork in the passage (' + themeOf().n + '). Two ways lead on: ' + doorsContext().join(' or ') + '.');
    lines.push('The hero wants to learn something about the two ways before choosing.');
  } else {
    lines.push('Place: ' + room.name + ' (' + themeOf().n + ').');
    lines.push('Scene: ' + sceneText().slice(0, 420));
    if (room.enemies && room.enemies.length) lines.push('Foes here: ' + enemyNames(room.enemies) + '.');
  }
  lines.push('Hero: ' + hero.name + ', ' + SPECIES[hero.species].n + ' ' + CLASSES[hero.cls].n + ', ' + BACKGROUNDS[hero.bg].n + '.');
  if (hero.story) lines.push('Hero backstory: ' + String(hero.story).slice(0, 200));
  const mems = memoriesFor(room && ['rest', 'twist', 'boss'].includes(room.type) ? 'twist' : 'room', room);
  if (mems.length) lines.push('Hero memories (may inspire one idea): ' + mems.join(' | '));
  lines.push('Goal of the quest: ' + run.adv.goal + '.');
  lines.push('Options the player already has (do not repeat them): ' + (room ? run.cur.choices.filter((c) => c.id !== 'continue' && c.id !== 'search').map((c) => c.label) : doorsContext()).join('; ') + '.');
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
  if (ideasBusy || !canIdeas()) return;
  const atDoors = run.phase === 'doors';
  const roomId = run.roomId, slot = run.slot, curRef = run.cur;
  const room = atDoors ? null : run.adv.rooms[roomId];
  const avoid = new Set(atDoors ? [] : run.cur.choices.map((c) => String(c.label).replace(/^[✎💡]\s*/, '').toLowerCase()));
  const stale = () => !run || (atDoors ? !canDoorIdeas() || run.slot !== slot : run.roomId !== roomId || run.cur !== curRef || !canFreeAct());
  let ideas = [];
  let via = 'built-in';
  if (aiOn()) {
    ideasBusy = true;
    changed();
    try { ideas = await aiIdeas(room, avoid); via = 'ai'; } catch (e) { ideas = []; }
    ideasBusy = false;
    if (stale()) { if (run) changed(); return; }
  }
  if (ideas.length < 3) {
    const have = new Set(Array.from(avoid).concat(ideas.map((x) => x.label.toLowerCase())));
    poolIdeas(room || { type: 'doors' }, 3 - ideas.length, have).forEach((x) => ideas.push(x));
  }
  ideas = ideas.slice(0, 3);
  if (atDoors) {
    const dc = dcFor(hero.level, 0);
    run.doorIdeas = ideas.map((x, i) => ({ id: 'd' + i, label: '💡 ' + x.label, skill: x.approach === 'attack' ? 'perception' : x.approach, dc, idea: via }));
  } else {
    run.cur.choices = run.cur.choices.filter((c) => !c.idea || run.cur.used.includes(c.id));
    const at = run.cur.choices.findIndex((c) => c.id === 'continue' || c.id === 'search');
    const made = ideas.map((x) => { const c = buildFreeChoice('💡 ' + x.label, x.approach, room); c.idea = via; return c; });
    if (at >= 0) run.cur.choices.splice(at, 0, ...made); else run.cur.choices.push(...made);
  }
  save();
  changed();
}
/* an idea at a fork: a scouting check. Success shows what waits behind each way; failure costs time. */
function doorIdea(i) {
  if (!run || run.phase !== 'doors') return;
  const c = (run.doorIdeas || [])[i];
  if (!c) return;
  say('choice', c.label);
  const res = doCheck(c.skill, c.dc, 0);
  say('roll', rollChip(res), { ok: res.ok });
  led().flags['scoutTried_' + run.slot] = true;
  run.doorIdeas = null;
  let text;
  if (res.ok) { setFlag('scouted_' + run.slot); text = 'You take your time, and it pays off. You can now tell what waits behind each way.'; }
  else { tickClock(1); text = 'You spend precious time and learn little. The dark feels a little closer.'; }
  if (res.crit && gainFortune(1) > 0) text += ' A flawless effort. (+1 Fortune)';
  narr(text, factsFor('outcome', text, { action: c.label, result: res.ok ? 'success' : 'failure', place: 'a fork in the passage' }));
  save();
  changed();
}

/* ---------- retell a memory in the hero's voice (the player accepts, edits or discards it) ---------- */
const MEM_SYS = 'You rewrite a short memory for a fantasy hero as one or two sentences in the first person, past tense, in a plain, haunted voice. Keep every name, place and fact exactly as written and add nothing new. Output only the memory.';
async function retellMemory(id) {
  const m = (hero.memories || []).find((x) => x.id === id);
  if (!m || !aiOn() || V.memBusy) return;
  if (Narrator.running) { toast('The narrator is still writing. Try again in a moment.'); return; }
  V.memBusy = id;
  V.memDraft = null;
  renderModal();
  try {
    const out = await AI.chat([{ role: 'system', content: MEM_SYS }, { role: 'user', content: 'Hero: ' + hero.name + ', ' + SPECIES[hero.species].n + ' ' + CLASSES[hero.cls].n + '.\nMemory: ' + m.text }], { max: 90, temp: 0.8 });
    let t = cleanNarration(out, m.text);
    if (t && t.length > 240) t = null;
    if (t && m.who && t.indexOf(m.who) < 0) t = null;
    if (t) V.memDraft = { id, text: t }; else toast('The narrator could not find the words. Your memory is unchanged.');
  } catch (e) { toast('The narrator could not retell it. Your memory is unchanged.'); }
  V.memBusy = null;
  renderModal();
}
