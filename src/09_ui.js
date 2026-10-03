/* ---------- UI ---------- */
const V = { screen: 'title', modal: null, create: { species: 'human', cls: 'fighter', bg: 'soldier', drive: 'glory', name: '', story: '' }, newAdv: { heroId: null, theme: 'random', seed: '' }, els: new Map(), lastId: 0, sel: null, installEvt: null, aiLoading: false, toastT: null };
const defaultSettings = () => ({ narrator: 'templates', model: 'small', difficulty: 'standard', forgiving: true, textSize: 1, dice: 'auto' });
const app = () => document.getElementById('app');

function btn(a, label, cls, extra) { return '<button class="btn ' + (cls || '') + '" data-a="' + a + '" ' + (extra || '') + '>' + label + '</button>'; }
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(V.toastT);
  V.toastT = setTimeout(() => { t.style.display = 'none'; }, 2600);
}
function download(name, text, type) {
  try {
    const b = new Blob([text], { type: type || 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  } catch (e) { toast('Could not export on this browser.'); }
}
function heroMarkdown(h) {
  const L = [];
  L.push('---', 'name: ' + h.name, 'species: ' + SPECIES[h.species].n, 'class: ' + CLASSES[h.cls].n, 'level: ' + h.level, 'drive: ' + DRIVES[h.drive].n, 'background: ' + BACKGROUNDS[h.bg].n, 'adventures: ' + h.adventures, '---', '', '# ' + h.name, '', '## Backstory', h.story ? h.story : '_Nothing written yet._', '', '## Threads');
  if (h.legacy.length) h.legacy.forEach((l) => L.push('- ' + l.t.replace('_', ' ') + ': ' + l.name)); else L.push('- none yet');
  L.push('', '## Memories');
  if (!(h.memories || []).length) L.push('_None yet._');
  (h.memories || []).forEach((m) => L.push('- (' + (MEM_KIND[m.kind] || m.kind).toLowerCase() + (m.who ? ', ' + m.who : '') + (m.resolved ? ', ' + m.resolved : '') + ') ' + m.text + (m.adv ? ' [' + m.adv + ']' : '')));
  L.push('', '## Chronicle');
  if (!h.chronicle.length) L.push('_No adventures yet._');
  h.chronicle.forEach((c) => { L.push('### ' + c.title + ' (' + c.end + ', level ' + c.level + ')'); c.deeds.forEach((d0) => L.push('- ' + d0)); L.push(''); });
  return L.join('\n');
}

/* ----- screens ----- */
function setScreen(s) { V.screen = s; V.modal = null; render(); }
function render() {
  document.documentElement.style.setProperty('--fs', S.settings.textSize);
  const a = app();
  if (V.screen === 'play' && run) { renderPlay(true); renderModal(); return; }
  if (V.screen === 'title') a.innerHTML = viewTitle();
  else if (V.screen === 'heroes') a.innerHTML = viewHeroes();
  else if (V.screen === 'create') a.innerHTML = viewCreate();
  else if (V.screen === 'new') a.innerHTML = viewNew();
  else a.innerHTML = viewTitle();
  renderModal();
}
function aiStatusText() {
  if (S.settings.narrator !== 'ai') return 'Narrator: built-in text (works fully offline)';
  if (AI.status === 'ready') return 'Narrator: on-device AI ready (' + MODELS[S.settings.model].label + ')';
  if (AI.status === 'loading') return 'Narrator: loading on-device model… ' + Math.round(AI.progress * 100) + '%';
  if (AI.status === 'error') return 'Narrator: AI unavailable, using built-in text';
  return 'Narrator: on-device AI (not loaded yet)';
}
function viewTitle() {
  const cont = S.run && S.heroes.find((h) => h.id === S.run.heroId);
  return '<div class="scr"><div class="logo">DELVE</div><p class="tag">Solo dungeon crawls. Plays offline.</p>' +
    (cont ? btn('continue', 'Continue: ' + esc(S.run.adv.title) + '<br><span class="small">' + esc(cont.name) + ', level ' + cont.level + '</span>', 'primary') : '') +
    btn('go:new', 'New adventure', cont ? '' : 'primary') +
    btn('go:heroes', 'Heroes (' + S.heroes.length + ')') +
    btn('go:settings', 'Narrator &amp; settings') +
    (V.installEvt ? btn('install', 'Install app', 'ghost') : '') +
    '<p class="small dim" style="text-align:center">' + esc(aiStatusText()) + '</p><p class="ver">' + esc(verLine()) + '</p></div>';
}
function viewHeroes() {
  let h = '<div class="scr"><div class="row" style="align-items:center"><h2>Heroes</h2><div style="flex:none;width:100px">' + btn('go:title', 'Back', 'ghost') + '</div></div>';
  if (!S.heroes.length) h += '<p class="dim">No heroes yet. Create one to begin.</p>';
  S.heroes.forEach((x) => {
    h += '<div class="card"><h3>' + esc(x.name) + '</h3><div class="dim small">' + SPECIES[x.species].n + ' ' + CLASSES[x.cls].n + ', level ' + x.level + ' &middot; ' + x.adventures + ' adventure' + (x.adventures === 1 ? '' : 's') + ' &middot; ' + x.gold + ' gold</div>' +
      ((x.memories || []).length ? '<div class="small dim" style="margin-top:4px">Memories: ' + x.memories.length + '</div>' : '') +
      (x.legacy.length ? '<div class="small" style="margin-top:4px">Threads: ' + x.legacy.map((l) => esc(l.name + ' (' + l.t.replace('_', ' ') + ')')).join(', ') + '</div>' : '') +
      '<div class="row" style="margin-top:8px"><button class="btn" data-a="n:hero:' + x.id + '" style="margin:0">Play</button><button class="btn ghost" data-a="hero:md:' + x.id + '" style="margin:0">Export .md</button><button class="btn danger" data-a="hero:del:' + x.id + '" style="margin:0">Retire</button></div></div>';
  });
  h += btn('go:create', 'Create a hero', 'primary');
  if (S.fallen.length) {
    h += '<h3 style="margin-top:20px">Hall of the Fallen</h3>';
    S.fallen.slice(-8).forEach((f) => { h += '<div class="card small"><b>' + esc(f.name) + '</b>, ' + SPECIES[f.species].n + ' ' + CLASSES[f.cls].n + ', level ' + f.level + '<br><span class="dim">Fell in ' + esc(f.title) + '</span></div>'; });
  }
  return h + '</div>';
}
function viewCreate() {
  const c = V.create;
  let h = '<div class="scr"><div class="row" style="align-items:center"><h2>New hero</h2><div style="flex:none;width:100px">' + btn(S.heroes.length ? 'go:heroes' : 'go:title', 'Back', 'ghost') + '</div></div>';
  h += '<label class="f">Name</label><div class="row"><input type="text" id="nm" maxlength="24" value="' + esc(c.name) + '" placeholder="Name your hero"><button class="btn" data-a="c:rname" style="flex:none;width:90px;margin:0">Roll</button></div>';
  h += '<label class="f">Class</label>';
  Object.keys(CLASSES).forEach((k) => { const x = CLASSES[k]; h += '<button class="cls ' + (c.cls === k ? 'on' : '') + '" data-a="c:cls:' + k + '"><b>' + x.n + '</b> <span class="dim small">d' + x.hd + ' hit die</span><br><span class="small dim">' + x.blurb + '</span></button>'; });
  h += '<label class="f">Species</label><div class="chips">' + Object.keys(SPECIES).map((k) => '<button class="chip ' + (c.species === k ? 'on' : '') + '" data-a="c:species:' + k + '">' + SPECIES[k].n + '</button>').join('') + '</div><div class="small dim">' + SPECIES[c.species].perk + '</div>';
  h += '<label class="f">Background</label><div class="chips">' + Object.keys(BACKGROUNDS).map((k) => '<button class="chip ' + (c.bg === k ? 'on' : '') + '" data-a="c:bg:' + k + '">' + BACKGROUNDS[k].n + '</button>').join('') + '</div><div class="small dim">' + BACKGROUNDS[c.bg].d + ' Skills: ' + BACKGROUNDS[c.bg].skills.map((s) => SKILLS[s].n).join(', ') + '.</div>';
  h += '<label class="f">Drive</label><div class="chips">' + Object.keys(DRIVES).map((k) => '<button class="chip ' + (c.drive === k ? 'on' : '') + '" data-a="c:drive:' + k + '">' + DRIVES[k].n + '</button>').join('') + '</div><div class="small dim">' + DRIVES[c.drive].d + ' Choices that match your drive earn Fortune, a reroll for failed checks.</div>';
  h += '<label class="f">Backstory (optional)</label><textarea id="bs" maxlength="400" placeholder="Who are you, and what do you want? The narrator can use this.">' + esc(c.story) + '</textarea>';
  h += '<div style="height:12px"></div>' + btn('c:make', 'Begin as this hero', 'primary');
  return h + '</div>';
}
function viewNew() {
  let h = '<div class="scr"><div class="row" style="align-items:center"><h2>New adventure</h2><div style="flex:none;width:100px">' + btn('go:title', 'Back', 'ghost') + '</div></div>';
  if (!S.heroes.length) return h + '<p class="dim">You need a hero first.</p>' + btn('go:create', 'Create a hero', 'primary') + '</div>';
  if (!S.heroes.find((x) => x.id === V.newAdv.heroId)) V.newAdv.heroId = S.heroes[0].id;
  h += '<label class="f">Hero</label>';
  S.heroes.forEach((x) => { h += '<button class="cls ' + (V.newAdv.heroId === x.id ? 'on' : '') + '" data-a="n:hero:' + x.id + ':pick"><b>' + esc(x.name) + '</b> <span class="dim small">' + SPECIES[x.species].n + ' ' + CLASSES[x.cls].n + ', level ' + x.level + '</span></button>'; });
  const sel = S.heroes.find((x) => x.id === V.newAdv.heroId);
  if (sel.legacy.length) h += '<div class="card small"><b>The story remembers:</b><br>' + sel.legacy.map((l) => esc(l.name) + ' (' + l.t.replace('_', ' ') + ')').join('<br>') + '</div>';
  h += '<label class="f">Setting</label><div class="chips"><button class="chip ' + (V.newAdv.theme === 'random' ? 'on' : '') + '" data-a="n:theme:random">Surprise me</button>' + Object.keys(THEMES).map((k) => '<button class="chip ' + (V.newAdv.theme === k ? 'on' : '') + '" data-a="n:theme:' + k + '">' + THEMES[k].n + '</button>').join('') + '</div>';
  h += '<label class="f">Seed (optional, same seed = same dungeon)</label><div class="row"><input type="text" id="sd" maxlength="30" value="' + esc(V.newAdv.seed) + '" placeholder="e.g. ember-vault-42"><button class="btn" data-a="n:rseed" style="flex:none;width:90px;margin:0">Roll</button></div>';
  h += '<div style="height:12px"></div>' + btn('n:begin', 'Enter the dungeon', 'primary');
  return h + '</div>';
}

/* ----- play screen ----- */
function renderPlay(full) {
  if (!run) return;
  if (full || !document.getElementById('log')) {
    app().innerHTML = '<div class="hud" id="hud"></div><div class="log" id="log"><div class="latestwrap" id="latestwrap"><button class="latest" data-a="latest" id="latest" hidden>↓ Latest</button></div></div><div class="acts" id="acts"><div class="in" id="actsin"></div></div>';
    V.els = new Map();
    V.lastId = 0;
  }
  renderHud();
  appendLog();
  renderActs();
  const lg = document.getElementById('log');
  if (lg && !lg.dataset.wired) { lg.dataset.wired = '1'; lg.addEventListener('scroll', syncLatest, { passive: true }); }
}
function syncLatest() {
  const lg = document.getElementById('log'), b = document.getElementById('latest');
  if (!lg || !b) return;
  b.hidden = lg.scrollHeight - lg.scrollTop - lg.clientHeight < 90;
}
function renderHud() {
  const c = run.adv.clock;
  const pips = (n, m, on) => Array.from({ length: m }, (_, i) => '<span class="' + (i < n ? on : '') + '">' + (i < n ? '●' : '○') + '</span>').join('');
  const slots = hero.res.slots !== undefined ? ' &middot; ✨ <b>' + hero.res.slots + '</b>' : '';
  document.getElementById('hud').innerHTML =
    '<div class="l1"><span class="nm">' + esc(hero.name) + ' <span class="dim small">Lv ' + hero.level + ' ' + CLASSES[hero.cls].n + '</span></span>' +
    '<button class="ib" data-a="sheet" aria-label="Character sheet">👤</button><button class="ib" data-a="journal" aria-label="Journal">📖</button><button class="ib" data-a="menu" aria-label="Menu">⋯</button></div>' +
    '<div class="bar"><i style="width:' + Math.round(100 * hero.hp / hero.hpMax) + '%"></i><span>' + hero.hp + ' / ' + hero.hpMax + ' HP</span></div>' +
    '<div class="stats"><span>AC <b>' + (heroAC(hero) + (run.combat && run.combat.pc.shield ? 5 : 0)) + '</b></span><span>✦ <b>' + hero.fortune + '</b></span><span>🧪 <b>' + (hero.inv.potion || 0) + '</b></span><span>🪙 <b>' + hero.gold + '</b></span>' + slots +
    '<span title="' + esc(c.label) + '">⏳ <span class="pips">' + pips(c.at, c.max, 'on') + '</span></span><span title="Alert">⚠ <span class="pips">' + pips(led().alert, 5, 'al') + '</span></span></div>';
}
function mkEntry(e) {
  const el = document.createElement('div');
  setEntry(el, e);
  return el;
}
function entryCls(e) {
  const map = { head: 'head', narr: 'narr', sys: 'sys', roll: 'roll', dmg: 'dmg', choice: 'choice' };
  let cls = map[e.k] || 'sys';
  if (e.k === 'roll') cls += e.ok ? ' ok' : ' bad';
  if (e.k === 'narr' && (e.live || e.wait)) cls += ' live';
  return cls;
}
function setEntry(el, e) {
  el.className = entryCls(e);
  el.textContent = e.wait ? '' : e.t;
}
function appendLog() {
  const log = document.getElementById('log');
  if (!log) return;
  const first = V.lastId === 0;
  const wrap = document.getElementById('latestwrap');
  let firstNew = null;
  run.log.forEach((e) => {
    if (e.id <= V.lastId) return;
    const el = mkEntry(e);
    log.insertBefore(el, wrap);
    V.els.set(e.id, el);
    V.lastId = e.id;
    if (!firstNew) firstNew = el;
  });
  if (!firstNew) return;
  if (first && run.log.length > 8) {
    /* opening an adventure in progress: jump straight to the latest text */
    log.style.scrollBehavior = 'auto';
    log.scrollTop = log.scrollHeight;
    log.style.scrollBehavior = '';
  } else {
    /* new text after a tap: if it fits, show it with the text above for context; if it is long, start reading at its beginning */
    const top = firstNew.getBoundingClientRect().top - log.getBoundingClientRect().top + log.scrollTop;
    const fresh = log.scrollHeight - top - 10;
    log.scrollTop = fresh <= log.clientHeight - 24 ? log.scrollHeight : Math.max(0, top - 12);
  }
  syncLatest();
}
ui.onEntry = (e) => {
  const el = V.els.get(e.id);
  if (el) { setEntry(el, e); const log = document.getElementById('log'); if (log && log.scrollHeight - log.scrollTop - log.clientHeight < 40) log.scrollTop = log.scrollHeight; }
};
function optHtml(c) {
  let sub = '';
  if (c.kind === 'check' && c.skill) sub = SKILLS[c.skill].n + ' &middot; ' + needWord(skillMod(hero, c.skill), c.dc);
  else if (c.kind === 'combat') sub = 'Fight';
  else if (c.kind === 'trade') sub = 'Costs ' + c.cost + ' gold';
  if (c.idea) sub += (sub ? ' &middot; ' : '') + (c.idea === 'ai' ? 'AI idea' : 'idea');
  if (c.drive && c.drive === hero.drive) sub += (sub ? ' &middot; ' : '') + '★ fits your drive';
  const cont = c.id === 'continue' || c.id === 'search';
  return '<button class="opt ' + (c.id === 'continue' ? 'cont' : '') + ' ' + (c.drive === hero.drive ? 'hot' : '') + '" data-a="pick:' + c.id + '">' + esc(c.label) + (sub && !cont ? '<small>' + sub + '</small>' : '') + '</button>';
}
function renderActs() {
  const box = document.getElementById('actsin');
  if (!box || !run) return;
  let h = '';
  const ph = run.phase;
  if (ph === 'doors') {
    h += run.adv.slots[run.slot].opts.map((id) => {
      const d0 = doorInfo(id);
      return '<button class="opt door" data-a="door:' + id + '"><b>' + esc(d0.label) + '</b>' + esc(d0.hint) + (d0.kind ? '<br><span class="k">' + esc(d0.kind) + '</span>' : '') + '</button>';
    }).join('');
    if (canDoorIdeas()) {
      (run.doorIdeas || []).forEach((c, i) => { h += '<button class="opt" data-a="didea:' + i + '">' + esc(c.label) + '<small>' + SKILLS[c.skill].n + ' &middot; ' + needWord(skillMod(hero, c.skill), c.dc) + ' &middot; ' + (c.idea === 'ai' ? 'AI idea' : 'idea') + ' &middot; learn what each way holds</small></button>'; });
      h += '<button class="opt ideas" data-a="ideas" ' + (ideasBusy ? 'disabled' : '') + '>' + (ideasBusy ? '💡 Thinking…' : run.doorIdeas ? '💡 More ideas' : '💡 Think of something else') + '<small>' + (aiOn() ? 'The on-device AI suggests ways to scout' : 'Built-in ideas · turn on the narrator for AI-written ones') + '</small></button>';
    }
    h += miniRow();
  } else if (ph === 'room') {
    h += run.cur.choices.map(optHtml).join('');
    if (canFreeAct()) {
      const has = run.cur.choices.some((c) => c.idea);
      h += '<button class="opt ideas" data-a="ideas" ' + (ideasBusy ? 'disabled' : '') + '>' + (ideasBusy ? '💡 Thinking…' : has ? '💡 More ideas' : '💡 Think of something else') + '<small>' + (aiOn() ? 'The on-device AI suggests new approaches' : 'Built-in ideas · turn on the narrator for AI-written ones') + '</small></button>';
    }
    if (canFreeAct()) h += '<div class="free"><input id="free" type="text" maxlength="140" placeholder="✎ Or try something else…" enterkeyhint="go"><button data-a="free">Try</button></div>';
    h += miniRow();
  } else if (ph === 'check') {
    h += '<div class="fort"><b>That did not go well.</b><br><span class="small dim">Spend a point of Fortune to roll again, or accept the result.</span></div>';
    h += '<button class="opt" data-a="fort" ' + (hero.fortune < 1 ? 'disabled' : '') + '>✦ Spend Fortune and reroll (' + hero.fortune + ' left)</button><button class="opt" data-a="accept">Accept the result</button>';
  } else if (ph === 'combat') {
    h += viewCombat();
  } else if (ph === 'epilogue' || ph === 'dead') {
    h += '<button class="opt cont" data-a="finish">' + (run.epilogue && run.epilogue.kind === 'death' ? 'Close the book' : 'Finish adventure') + '</button>';
  }
  box.innerHTML = h;
}
function miniRow() {
  return '<div class="mini">' + ((hero.inv.potion || 0) > 0 && hero.hp < hero.hpMax ? '<button data-a="pot">🧪 Drink potion (' + hero.inv.potion + ')</button>' : '') + '<button data-a="sheet">Sheet</button><button data-a="journal">Journal</button></div>';
}
function condText(e) {
  const t = [];
  if (e.boss) t.push('boss');
  if (e.cond.asleep > 0) t.push('asleep');
  if (e.cond.turned > 0) t.push('turned');
  return t.join(' · ');
}
function viewCombat() {
  const cb = run.combat;
  const alive = livingEnemies();
  if (!alive.length) return '';
  if (!V.sel || !alive.find((e) => e.id === V.sel)) V.sel = alive[0].id;
  const sel = alive.find((e) => e.id === V.sel);
  let h = '<div class="foebox"><pre class="art">' + esc(artFor(sel)) + '</pre><div class="foes">' + alive.map((e) =>
    '<button class="foe ' + (e.id === V.sel ? 'sel' : '') + '" data-a="sel:' + e.id + '"><div class="row"><b>' + esc(e.n) + '</b><span class="small dim" style="text-align:right">' + e.hp + '/' + e.max + ' &middot; AC ' + e.ac + '</span></div><div class="fb"><i style="width:' + Math.max(2, Math.round(100 * e.hp / e.max)) + '%"></i></div>' + (condText(e) ? '<div class="cd">' + condText(e) + '</div>' : '') + '</button>').join('') + '</div></div>';
  const pc = cb.pc;
  const cs = [];
  if (pc.poisoned > 0) cs.push('sickened');
  if (pc.frightened > 0) cs.push('frightened');
  if (pc.restrained) cs.push('webbed');
  if (pc.hidden) cs.push('hidden');
  if (pc.shield) cs.push('shielded');
  if (pc.defending) cs.push('defending');
  if (cs.length) h += '<div class="cond">You: ' + cs.join(', ') + '</div>';
  if (cb.menu === 'powers') {
    h += powerList(hero).map((p) => {
      const used = p.t === 'bonus' ? cb.acted.bonus : p.t === 'action' ? cb.acted.action : false;
      const none = p.res && (hero.res[p.res] || 0) < 1;
      return '<button class="opt" data-a="ca:p:' + p.id + '" ' + (used || none ? 'disabled' : '') + '>' + esc(p.n) + ' <span class="dim small">(' + (p.t === 'bonus' ? 'bonus' : p.t === 'free' ? 'free' : 'action') + (p.res ? ', ' + RES_N[p.res].toLowerCase() + ': ' + (hero.res[p.res] || 0) : ', at will') + ')</span><small>' + esc(p.d) + (p.tgt ? ' Target: ' + esc(sel.n) + '.' : '') + '</small></button>';
    }).join('') + '<button class="opt" data-a="cm:main">Back</button>';
  } else if (cb.menu === 'items') {
    h += Object.keys(ITEMS).filter((k) => (hero.inv[k] || 0) > 0).map((k) => '<button class="opt" data-a="ca:i:' + k + '" ' + (k === 'potion' ? (cb.acted.bonus ? 'disabled' : '') : (cb.acted.action ? 'disabled' : '')) + '>' + ITEMS[k].n + ' &times;' + hero.inv[k] + '<small>' + ITEMS[k].d + (k === 'oil' || k === 'scroll' ? ' Target: ' + esc(sel.n) + '.' : '') + '</small></button>').join('') + '<button class="opt" data-a="cm:main">Back</button>';
  } else {
    const w = CLASSES[hero.cls].wpn;
    const hasItems = Object.keys(ITEMS).some((k) => (hero.inv[k] || 0) > 0);
    h += '<div class="grid"><button class="opt" data-a="ca:attack" ' + (cb.acted.action ? 'disabled' : '') + '>⚔ Attack<small>' + w.n + ' &middot; ' + sgn(atkBonus(hero)) + '</small></button>' +
      '<button class="opt" data-a="cm:powers">✨ Abilities</button>' +
      '<button class="opt" data-a="cm:items" ' + (hasItems ? '' : 'disabled') + '>🧪 Items</button>' +
      '<button class="opt" data-a="ca:defend" ' + (cb.acted.action ? 'disabled' : '') + '>🛡 Defend</button>' +
      (pc.restrained ? '<button class="opt" data-a="free-web">Break free</button>' : '<button class="opt" data-a="ca:flee" ' + (cb.acted.action || cb.boss ? 'disabled' : '') + '>🏃 Flee</button>') + '</div>';
  }
  return h;
}

/* ----- modals ----- */
function openModal(m) { V.modal = m; renderModal(); }
function closeModal() { V.modal = null; renderModal(); }
function renderModal() {
  let root = document.getElementById('modal');
  if (!V.modal) { if (root) root.remove(); return; }
  if (!root) { root = document.createElement('div'); root.id = 'modal'; root.className = 'modal'; document.body.appendChild(root); }
  let body = '';
  if (V.modal === 'sheet') body = viewSheet();
  else if (V.modal === 'journal') body = viewJournal();
  else if (V.modal === 'menu') body = viewMenu();
  else if (V.modal === 'settings') body = viewSettings();
  else if (V.modal === 'dice') body = viewDice();
  const st = root.firstElementChild ? root.firstElementChild.scrollTop : 0;
  root.innerHTML = '<div class="sheet" data-modal="' + V.modal + '">' + body + '</div>';
  if (root.firstElementChild) root.firstElementChild.scrollTop = V.histJump ? root.firstElementChild.scrollHeight : st;
  V.histJump = false;
}
function viewDice() {
  const n = Dice.need;
  if (!n) return '<p class="dim">No roll needed.</p>';
  let o = '<div class="top"><h2 style="margin:0">Your roll</h2></div>';
  o += '<div class="dicehead">Roll ' + n.n + 'd' + n.sides + '</div><div class="dim">' + esc(n.label) + '</div>';
  o += '<div class="dvrow">';
  for (let i = 0; i < n.n; i++) o += '<input class="dv" id="dv' + i + '" type="number" inputmode="numeric" min="1" max="' + n.sides + '" step="1" placeholder="' + (n.n > 1 ? 'Die ' + (i + 1) : 'd' + n.sides) + '" aria-label="d' + n.sides + ' result ' + (i + 1) + '">';
  o += '</div>';
  o += btn('dice:ok', 'Use my roll', 'primary') + btn('dice:auto', 'Roll for me', 'ghost');
  return o;
}
function topbar(title) { return '<div class="top"><h2 style="margin:0">' + title + '</h2><button class="x" data-a="close" aria-label="Close">✕</button></div>'; }
function viewSheet() {
  const h = hero;
  let o = topbar(esc(h.name));
  o += '<div class="dim small">' + SPECIES[h.species].n + ' ' + CLASSES[h.cls].n + ', level ' + h.level + ' &middot; ' + BACKGROUNDS[h.bg].n + ' &middot; Drive: ' + DRIVES[h.drive].n + '</div>';
  o += '<div class="bar"><i style="width:' + Math.round(100 * h.hp / h.hpMax) + '%"></i><span>' + h.hp + ' / ' + h.hpMax + ' HP</span></div>';
  o += '<div class="stats" style="margin-bottom:8px"><span>AC <b>' + heroAC(h) + '</b></span><span>Proficiency <b>+' + prof(h) + '</b></span><span>Attack <b>' + sgn(atkBonus(h)) + '</b></span>' + (h.cls === 'wizard' || h.cls === 'cleric' ? '<span>Spell DC <b>' + spellDC(h) + '</b></span>' : '') + '<span>✦ Fortune <b>' + h.fortune + '/' + fortuneMax(h) + '</b></span><span>Gold <b>' + h.gold + '</b></span></div>';
  o += '<div class="abil">' + ABIL_ORDER.map((a) => '<div>' + ABIL_N[a] + '<b>' + h.abil[a] + '</b>' + sgn(mod(h.abil[a])) + '</div>').join('') + '</div>';
  if (run && run.phase !== 'combat' && (h.inv.potion || 0) > 0 && h.hp < h.hpMax) o += btn('pot', '🧪 Drink a potion (' + h.inv.potion + ')');
  o += '<h3>Abilities</h3><ul class="tight small">' + powerList(h).map((p) => '<li><b>' + esc(p.n) + '</b>: ' + esc(p.d) + '</li>').join('') + passiveLines(h).map((p) => '<li>' + esc(p) + '</li>').join('') + '</ul>';
  const rs = Object.keys(h.res);
  if (rs.length) o += '<div class="small dim">Resources: ' + rs.map((k) => RES_N[k] + ' ' + h.res[k] + '/' + resMax(h)[k]).join(', ') + '. A proper rest restores them.</div>';
  o += '<h3 style="margin-top:12px">Skills</h3>' + Object.keys(SKILLS).map((s) => '<div class="sk ' + (heroSkills(h).has(s) ? 'pf' : '') + '"><span>' + SKILLS[s].n + ' <span class="dim">(' + ABIL_N[SKILLS[s].a] + ')</span></span><b>' + sgn(skillMod(h, s)) + '</b></div>').join('');
  o += '<h3 style="margin-top:12px">Pack</h3><ul class="tight small">' + Object.keys(ITEMS).filter((k) => (h.inv[k] || 0) > 0).map((k) => '<li>' + ITEMS[k].n + ' &times;' + h.inv[k] + ': ' + ITEMS[k].d + '</li>').join('') + (gearList(h).length ? gearList(h).map((g) => '<li><b>' + g.n + '</b>: ' + g.d + '</li>').join('') : '') + '</ul>';
  o += '<label class="f">Backstory</label><textarea data-bind="story" maxlength="400" placeholder="Who are you? The narrator can use this.">' + esc(h.story || '') + '</textarea>';
  o += '<div style="height:8px"></div>' + btn('hero:md:' + h.id, 'Export hero as markdown', 'ghost');
  return o;
}
function attWord(a) { return a >= 2 ? 'devoted' : a === 1 ? 'friendly' : a === 0 ? 'neutral' : a === -1 ? 'wary' : 'hostile'; }
function journalTabs() {
  const t = V.jtab || 'sum';
  return '<div class="chips"><button class="chip ' + (t === 'sum' ? 'on' : '') + '" data-a="jt:sum">Summary</button><button class="chip ' + (t === 'log' ? 'on' : '') + '" data-a="jt:log">Full story so far</button><button class="chip ' + (t === 'mem' ? 'on' : '') + '" data-a="jt:mem">Memories' + ((hero.memories || []).length ? ' (' + hero.memories.length + ')' : '') + '</button></div>';
}
function viewHistory() {
  const parts = run.log.map((e) => '<div class="' + entryCls(e).replace(' live', '') + '">' + esc(e.t) + '</div>');
  return '<div class="log hist">' + parts.join('') + '</div>';
}
function viewMemories() {
  const ms = hero.memories || [];
  let o = '<div class="small dim" style="margin:8px 0">What ' + esc(hero.name) + ' carries between adventures. The story can bring these back. Edit the wording, or let one go.</div>';
  if (!ms.length) return o + '<p class="dim">Nothing yet. Betrayals and the moments you are left for dead are remembered here.</p>';
  ms.slice().reverse().forEach((m) => {
    o += '<div class="card mem"><div class="small dim">' + esc(MEM_KIND[m.kind] || m.kind) + (m.who ? ' &middot; ' + esc(m.who) : '') + (m.adv ? ' &middot; ' + esc(m.adv) : '') + (m.resolved ? ' &middot; settled' : '') + '</div>' +
      '<textarea data-bind="mem:' + m.id + '" maxlength="240" aria-label="Memory">' + esc(m.text) + '</textarea>' +
      '<button class="btn danger" data-a="mem:del:' + m.id + '" style="margin:6px 0 0">Let it go</button></div>';
  });
  return o;
}
function viewJournal() {
  if (!run) return topbar('Journal') + '<p class="dim">No adventure in progress.</p>';
  const adv = run.adv, c = adv.clock;
  if (V.jtab === 'log') return topbar(esc(adv.titleFull)) + journalTabs() + viewHistory();
  if (V.jtab === 'mem') return topbar(esc(adv.titleFull)) + journalTabs() + viewMemories();
  let o = topbar(esc(adv.titleFull)) + journalTabs();
  o += '<div class="card small">' + esc(adv.pitch) + '</div>';
  o += '<dl class="kv"><dt>Task</dt><dd>' + esc(adv.goal) + '</dd><dt>Clock</dt><dd>' + esc(c.label) + ': ' + c.at + ' / ' + c.max + '</dd><dt>Alert</dt><dd>' + led().alert + ' / 5</dd><dt>Clues</dt><dd>' + led().clues + '</dd><dt>Seed</dt><dd>' + esc(adv.seed) + '</dd></dl>';
  const met = Object.keys(adv.npcs).map((k) => adv.npcs[k]).filter((n) => n.met);
  if (met.length) o += '<h3 style="margin-top:12px">People</h3><ul class="tight">' + met.map((n) => '<li>' + esc(n.name) + ' <span class="dim small">(' + attWord(n.att) + (n.alive ? '' : ', fallen') + ')</span></li>').join('') + '</ul>';
  if (led().deeds.length) o += '<h3 style="margin-top:12px">What you have done</h3><ul class="tight">' + led().deeds.map((d0) => '<li>' + esc(d0) + '</li>').join('') + '</ul>';
  return o;
}
function viewMenu() {
  return topbar('Menu') + btn('sheet', 'Character sheet') + btn('journal', 'Journal') + btn('go:settings', 'Narrator &amp; settings') + btn('exit', 'Save and return to title') + btn('abandon', 'Abandon this adventure', 'danger') + '<p class="ver">' + esc(verLine()) + '</p>';
}
function viewSettings() {
  const s = S.settings;
  const m = MODELS[s.model];
  let o = topbar('Narrator &amp; settings');
  o += '<h3>Narrator</h3><div class="small dim">The game is fully playable offline with built-in text. An on-device model can rewrite the narration in richer prose, and read your free-text actions. It never decides rules or outcomes.</div>';
  o += '<div class="chips"><button class="chip ' + (s.narrator === 'templates' ? 'on' : '') + '" data-a="set:narrator:templates">Built-in text</button><button class="chip ' + (s.narrator === 'ai' ? 'on' : '') + '" data-a="set:narrator:ai">On-device AI</button></div>';
  o += '<label class="f">Model</label><div class="chips">' + Object.keys(MODELS).map((k) => '<button class="chip ' + (s.model === k ? 'on' : '') + '" data-a="set:model:' + k + '">' + MODELS[k].label + '</button>').join('') + '</div><div class="small dim">' + m.size + ' one-time download. ' + m.note + ' Needs WebGPU (Chrome on a recent Android phone works well).</div>';
  o += '<div class="prog"><i id="aiBar" style="width:' + Math.round(AI.progress * 100) + '%"></i></div><div class="small dim" id="aiMsg">' + esc(AI.status === 'error' ? AI.err : aiStatusText()) + '</div>';
  o += '<div style="height:8px"></div>' + btn('ai:go', AI.status === 'ready' && AI.modelKey === s.model ? 'Narrator is ready' : 'Download &amp; enable narrator', 'primary', V.aiLoading || (AI.status === 'ready' && AI.modelKey === s.model) ? 'disabled' : '');
  o += '<h3 style="margin-top:14px">Game</h3><label class="f">Difficulty (applies to new adventures)</label><div class="chips">' + [['story', 'Story'], ['standard', 'Standard'], ['grim', 'Grim']].map((x) => '<button class="chip ' + (s.difficulty === x[0] ? 'on' : '') + '" data-a="set:difficulty:' + x[0] + '">' + x[1] + '</button>').join('') + '</div>';
  o += '<label class="f">When you fall</label><div class="chips"><button class="chip ' + (s.forgiving ? 'on' : '') + '" data-a="set:forgiving:1">Left for dead (story goes on)</button><button class="chip ' + (!s.forgiving ? 'on' : '') + '" data-a="set:forgiving:0">Death saves (can die)</button></div>';
  o += '<label class="f">Dice</label><div class="chips">' + [['auto', 'Roll for me'], ['d20', 'I roll d20s'], ['all', 'I roll everything']].map((x) => '<button class="chip ' + ((s.dice || 'auto') === x[0] ? 'on' : '') + '" data-a="set:dice:' + x[0] + '">' + x[1] + '</button>').join('') + '</div><div class="small dim">Use your own physical dice: the game asks for each roll of your hero (checks, attacks' + ', and with the last option damage and healing too). Enemy and world rolls stay automatic. Every prompt has a Roll for me button.</div>';
  o += '<label class="f">Text size</label><div class="chips">' + [[0.9, 'Small'], [1, 'Medium'], [1.15, 'Large'], [1.3, 'Huge']].map((x) => '<button class="chip ' + (s.textSize === x[0] ? 'on' : '') + '" data-a="set:text:' + x[0] + '">' + x[1] + '</button>').join('') + '</div>';
  o += '<h3 style="margin-top:14px">Data</h3><div class="small dim">Everything is stored on this device. Export a backup now and then.</div><div style="height:6px"></div>' + btn('data:export', 'Export backup (.json)', 'ghost') + '<label class="btn ghost" style="cursor:pointer">Import backup<input type="file" id="imp" accept=".json,application/json" style="display:none"></label>' + btn('data:wipe', 'Erase everything', 'danger') + '<p class="ver">' + esc(verLine()) + '</p>';
  return o;
}

/* ----- actions ----- */
function say0() { Narrator.userMoved(); }
async function enableNarrator() {
  const s = S.settings;
  s.narrator = 'ai';
  save();
  V.aiLoading = true;
  renderModal();
  const ok = await AI.load(s.model, (p, msg) => {
    const bar = document.getElementById('aiBar'), t = document.getElementById('aiMsg');
    if (bar) bar.style.width = Math.round(p * 100) + '%';
    if (t) t.textContent = (msg || '').slice(0, 90);
  });
  V.aiLoading = false;
  if (!ok) { s.narrator = 'templates'; toast('Narrator unavailable. Using built-in text.'); } else toast('Narrator ready.');
  save();
  renderModal();
  if (V.screen === 'title') render();
}
function actionMd(id) {
  const h = S.heroes.find((x) => x.id === id) || hero;
  if (h) download(h.name.replace(/\W+/g, '_') + '.md', heroMarkdown(h), 'text/markdown');
}
function onAct(a, el) {
  const p = a.split(':');
  const k = p[0];
  if (k === 'go') {
    if (p[1] === 'settings') { openModal('settings'); return; }
    if (p[1] === 'title') { setScreen('title'); return; }
    setScreen(p[1]); return;
  }
  if (k === 'close') { closeModal(); return; }
  if (k === 'dice') {
    const need = Dice.need;
    if (!need) return;
    const vals = [];
    for (let i = 0; i < need.n; i++) {
      if (p[1] === 'auto') { vals.push(1 + Math.floor(dRand.f() * need.sides)); continue; }
      const el = document.getElementById('dv' + i);
      const v = el ? Number(el.value) : NaN;
      if (!el || el.value.trim() === '' || !Number.isInteger(v) || v < 1 || v > need.sides) { toast('Enter a whole number from 1 to ' + need.sides + '.'); if (el) el.focus(); return; }
      vals.push(v);
    }
    V.modal = V.prevModal || null;
    V.prevModal = null;
    renderModal();
    diceSupply(vals);
    return;
  }
  if (k === 'install') { if (V.installEvt) { V.installEvt.prompt(); V.installEvt = null; render(); } return; }
  if (k === 'continue') { if (S.run) { run = S.run; hero = S.heroes.find((x) => x.id === run.heroId); V.screen = 'play'; render(); } return; }
  if (k === 'hero') {
    if (p[1] === 'md') { actionMd(p[2]); return; }
    if (p[1] === 'del') { if (confirm('Retire this hero for good?')) { S.heroes = S.heroes.filter((x) => x.id !== p[2]); if (S.run && S.run.heroId === p[2]) { S.run = null; run = null; } save(); render(); } return; }
  }
  if (k === 'c') {
    syncInputs();
    if (p[1] === 'rname') { V.create.name = pickR(HERO_NAMES); render(); return; }
    if (p[1] === 'make') {
      const c = V.create;
      const nh = newHero({ name: (c.name || '').trim() || pickR(HERO_NAMES), species: c.species, cls: c.cls, bg: c.bg, drive: c.drive });
      nh.story = (c.story || '').trim();
      S.heroes.push(nh);
      V.create = { species: 'human', cls: 'fighter', bg: 'soldier', drive: 'glory', name: '', story: '' };
      V.newAdv.heroId = nh.id;
      save();
      setScreen('new');
      return;
    }
    V.create[p[1]] = p[2];
    render();
    return;
  }
  if (k === 'n') {
    if (p[1] === 'hero') { V.newAdv.heroId = p[2]; if (p[3] === 'pick') render(); else setScreen('new'); return; }
    syncInputs();
    if (p[1] === 'theme') { V.newAdv.theme = p[2]; render(); return; }
    if (p[1] === 'rseed') { V.newAdv.seed = genSeed(); render(); return; }
    if (p[1] === 'begin') {
      const h0 = S.heroes.find((x) => x.id === V.newAdv.heroId);
      if (!h0) return;
      const seed = (V.newAdv.seed || '').trim() || genSeed();
      V.newAdv.seed = '';
      beginRun(h0, seed, V.newAdv.theme);
      V.screen = 'play';
      V.sel = null;
      render();
    }
    return;
  }
  if (k === 'set') {
    const s = S.settings;
    if (p[1] === 'narrator') {
      if (p[2] === 'ai') { enableNarrator(); return; }
      s.narrator = 'templates';
    } else if (p[1] === 'model') { s.model = p[2]; if (AI.status === 'ready' && AI.modelKey !== p[2]) { AI.status = 'off'; AI.engine = null; } }
    else if (p[1] === 'difficulty') s.difficulty = p[2];
    else if (p[1] === 'forgiving') s.forgiving = p[2] === '1';
    else if (p[1] === 'dice') s.dice = p[2];
    else if (p[1] === 'text') { s.textSize = parseFloat(p[2]); document.documentElement.style.setProperty('--fs', s.textSize); }
    save();
    renderModal();
    return;
  }
  if (k === 'ai') { enableNarrator(); return; }
  if (k === 'data') {
    if (p[1] === 'export') { download('delve-backup.json', JSON.stringify(S, null, 1), 'application/json'); return; }
    if (p[1] === 'wipe') { if (confirm('Erase all heroes and progress on this device?')) { Store.wipe(); S = freshState(); run = null; hero = null; V.screen = 'title'; V.modal = null; save(); render(); } return; }
  }
  if (!run) return;
  /* play */
  if (k === 'sheet') { openModal('sheet'); return; }
  if (k === 'journal') { V.jtab = 'sum'; openModal('journal'); return; }
  if (k === 'mem' && p[1] === 'del') { if (confirm('Let this memory go? The story will no longer bring it back.')) { hero.memories = (hero.memories || []).filter((m) => m.id !== p[2]); save(); renderModal(); } return; }
  if (k === 'jt') { V.jtab = p[1]; V.histJump = p[1] === 'log'; renderModal(); return; }
  if (k === 'ideas') { makeIdeas(); return; }
  if (k === 'didea') { say0(); withDice(() => doorIdea(Number(p[1]))); return; }
  if (k === 'latest') { const lg = document.getElementById('log'); if (lg) lg.scrollTop = lg.scrollHeight; return; }
  if (k === 'menu') { openModal('menu'); return; }
  if (k === 'exit') { V.modal = null; save(); setScreen('title'); return; }
  if (k === 'abandon') { if (confirm('Abandon this adventure? Progress in it will be lost.')) { abandonRun(); V.modal = null; setScreen('title'); } return; }
  if (k === 'pot') { say0(); withDice(() => drinkPotion()); return; }
  if (k === 'door') { say0(); withDice(() => chooseDoor(p[1])); return; }
  if (k === 'pick') { say0(); withDice(() => pickChoice(p[1])); return; }
  if (k === 'fort') { say0(); withDice(() => spendFortune()); return; }
  if (k === 'accept') { say0(); withDice(() => acceptResult()); return; }
  if (k === 'free') { const i = document.getElementById('free'); if (i && i.value.trim()) { say0(); const t = i.value; i.value = ''; freeAction(t); } return; }
  if (k === 'finish') { leaveRun(); V.screen = 'title'; render(); return; }
  if (k === 'sel') { V.sel = p[1]; renderActs(); return; }
  if (k === 'cm') { run.combat.menu = p[1] === 'main' ? null : p[1]; renderActs(); return; }
  if (k === 'free-web') { say0(); withDice(() => breakFree()); return; }
  if (k === 'ca') {
    say0();
    const name = p.slice(1).join(':');
    const sel = V.sel;
    withDice(() => { cAct(name, sel); if (run && run.phase === 'combat') renderActs(); });
    return;
  }
}
function syncInputs() {
  const nm = document.getElementById('nm'), bs = document.getElementById('bs'), sd = document.getElementById('sd');
  if (nm) V.create.name = nm.value;
  if (bs) V.create.story = bs.value;
  if (sd) V.newAdv.seed = sd.value;
}

/* ----- state + boot ----- */
function freshState() { return { v: 1, settings: defaultSettings(), heroes: [], run: null, fallen: [] }; }
function loadState() {
  let s = Store.load();
  if (!s || typeof s !== 'object' || !Array.isArray(s.heroes)) s = freshState();
  s.settings = Object.assign(defaultSettings(), s.settings || {});
  s.fallen = s.fallen || [];
  if (s.run && Array.isArray(s.run.log)) s.run.log.forEach((e) => { e.wait = false; e.live = false; });
  s.heroes.forEach((h) => { h.inv = h.inv || { potion: 2 }; h.gear = h.gear || []; h.legacy = h.legacy || []; h.chronicle = h.chronicle || []; h.memories = h.memories || []; h.res = h.res || resMax(h); });
  return s;
}
ui.onChange = () => {
  save();
  if (!run) return;
  if (V.screen === 'play') renderPlay(false);
  if (V.modal) renderModal();
};
ui.onNarrate = (e, f) => { Narrator.request(e, f); };
ui.onNeedDice = () => {
  if (V.modal !== 'dice') V.prevModal = V.modal;
  V.modal = 'dice';
  renderModal();
  const first = document.getElementById('dv0');
  if (first) setTimeout(() => { try { first.focus(); } catch (e) { /* ignore */ } }, 50);
};

function wire() {
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-a]');
    if (!t || t.disabled) return;
    ev.preventDefault();
    onAct(t.getAttribute('data-a'), t);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.target && ev.target.id === 'free') { ev.preventDefault(); onAct('free'); }
    if (ev.key === 'Enter' && ev.target && ev.target.classList && ev.target.classList.contains('dv')) { ev.preventDefault(); onAct('dice:ok'); }
  });
  document.addEventListener('change', (ev) => {
    const t = ev.target;
    const bind = t && t.getAttribute ? t.getAttribute('data-bind') : null;
    if (bind && bind.indexOf('mem:') === 0 && hero) {
      const m = (hero.memories || []).find((x) => x.id === bind.slice(4));
      const v = t.value.trim().slice(0, 240);
      if (m && v) { m.text = v; m.edited = true; save(); toast('Memory saved.'); }
    }
    if (t && t.getAttribute && t.getAttribute('data-bind') === 'story' && hero) { hero.story = t.value.slice(0, 400); save(); toast('Backstory saved.'); }
    if (t && t.id === 'imp' && t.files && t.files[0]) {
      const r = new FileReader();
      r.onload = () => {
        try {
          const j = JSON.parse(r.result);
          if (!j || !Array.isArray(j.heroes)) throw new Error('bad');
          Store.save(j);
          S = loadState(); run = S.run; hero = run ? S.heroes.find((x) => x.id === run.heroId) : null;
          if (!hero) { S.run = null; run = null; }
          V.screen = 'title'; V.modal = null; render(); toast('Backup imported.');
        } catch (e) { toast('That file is not a Delve backup.'); }
      };
      r.readAsText(t.files[0]);
    }
  });
  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (!t) return;
    if (t.id === 'nm') V.create.name = t.value;
    if (t.id === 'bs') V.create.story = t.value;
    if (t.id === 'sd') V.newAdv.seed = t.value;
  });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); V.installEvt = e; if (V.screen === 'title') render(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
}
async function boot() {
  S = loadState();
  run = S.run;
  hero = run ? S.heroes.find((h) => h.id === run.heroId) : null;
  if (run && !hero) { S.run = null; run = null; }
  if (run) entryId = run.log.reduce((m, e) => Math.max(m, e.id), 0) + 1;
  wire();
  render();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (S.settings.narrator === 'ai') {
    if (await AI.cached(S.settings.model)) { AI.load(S.settings.model).then(() => { if (V.screen === 'title') render(); }); }
    else { S.settings.narrator = 'templates'; save(); }
  }
}
window.__delve = { get S() { return S; }, get run() { return run; }, get hero() { return hero; }, V, Dice, onAct, boot, AI, Narrator, freeAction, keywordIntent, parseIntent, setRand: (f) => { dRand.f = f; },
  api: { generateAdventure, beginRun, enterRoom, startCombat, cAct, livingEnemies, powerList, heroAC, readyHero, levelUp, newHero, bossPrep, down, applyFx, killEnemy, leaveRun, heroMarkdown, setHero: (h) => { hero = h; }, rollDice, MON, BOSS, THEMES, CLASSES } };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
