/* ---------- manual dice ----------
   Every action handler is a plain synchronous function, so a die the player must enter by hand works by replay:
   run the action on the live state; when it reaches a hero die that has not been entered yet, abort, restore the
   snapshot taken before the action, ask the player for the value, then run the whole action again. Every random
   draw (and every entered value) is kept on a tape, so the second run goes exactly the same way up to that die. */
function syncInto(dst, src) {
  if (Array.isArray(dst)) {
    dst.length = src.length;
    for (let i = 0; i < src.length; i++) dst[i] = mergeVal(dst[i], src[i]);
  } else {
    Object.keys(dst).forEach((k) => { if (!(k in src)) delete dst[k]; });
    Object.keys(src).forEach((k) => { dst[k] = mergeVal(dst[k], src[k]); });
  }
}
function mergeVal(a, b) {
  if (b && typeof b === 'object' && a && typeof a === 'object' && Array.isArray(a) === Array.isArray(b)) { syncInto(a, b); return a; }
  return b;
}
function dicePrompt() { return S && S.settings && S.settings.dice; }
function withDice(fn) {
  const mode = dicePrompt();
  if (Dice.hold || Dice.need || !mode || mode === 'auto') { fn(); return; }
  Dice.mode = mode;
  Dice.tape = [];
  diceAttempt(fn, false);
}
function diceAttempt(fn, again) {
  const snap = JSON.stringify(S), eid = entryId, cd = cid;
  Dice.pos = 0;
  Dice.hold = true;
  Dice.def = { changed: false, narr: [] };
  try {
    fn();
  } catch (e) {
    Dice.hold = false;
    if (e && e.needRoll) {
      syncInto(S, JSON.parse(snap));
      entryId = eid; cid = cd;
      run = S.run;
      hero = run ? S.heroes.find((x) => x.id === run.heroId) : hero;
      Dice.need = e.needRoll;
      Dice.retry = () => diceAttempt(fn, true);
      if (ui.onNeedDice) ui.onNeedDice(Dice.need);
      return;
    }
    diceReset();
    throw e;
  }
  Dice.hold = false;
  const def = Dice.def;
  diceReset();
  def.narr.forEach((p) => { if (ui.onNarrate) ui.onNarrate(p[0], p[1]); });
  if (def.changed || again) changed();
}
function diceReset() {
  Dice.tape = null; Dice.pos = 0; Dice.hold = false; Dice.def = null; Dice.need = null; Dice.retry = null; Dice.mode = 'auto';
}
/* the player's entered values for the die that was asked for */
function diceSupply(values) {
  if (!Dice.need || !Dice.retry) return;
  const retry = Dice.retry;
  Dice.tape.push(values);
  Dice.need = null;
  retry();
}
