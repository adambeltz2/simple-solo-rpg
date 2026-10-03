# Backlog

Working list of planned improvements. Check items off as they ship; see `CHANGELOG.md`
for what shipped and `README.md` for current scope.

- [ ] [FEATURE] Dropbox/markdown sync: read hero backstory and campaign notes from
      markdown files and write the chronicle back (OAuth PKCE + fetch, local copy for
      offline). Affected: `src/08_ai.js`, `src/09_ui.js`, `src/07_end.js`.
- [ ] [FEATURE] Feed the backstory markdown to the narrator prompt. Affected: `src/08_ai.js`.
- [ ] [FEATURE] Wider content pool: more room types, monsters, twists and hooks to delay
      repetition. Affected: `src/01_data.js`, `src/03_adventure.js`.
- [ ] [DEBT] Tune bot defeat rate (about 29% of smart-bot runs end in defeat). Affected:
      `src/06_combat.js`, `src/07_end.js`.
- [ ] [DEBT] Template room text sometimes mismatches the room name (e.g. stolen goods in
      a mushroom garden). Affected: `src/01_data.js`.
- [ ] [DEBT] Test the narrator on real Android hardware (WebGPU, model download).
- [ ] [FEATURE] Show combat status on the Attack button before rolling (e.g. "advantage · Sneak Attack ready") so surprise, hidden and ally bonuses are visible. Affected: `src/09_ui.js` (renderActs), `src/06_combat.js` (strike).
- [ ] [FEATURE] AI-written scenarios at adventure level: let the on-device model propose alternate hooks, twists or rooms at adventure start (validated against the same story-spine schema). Affected: `src/03_adventure.js`, `src/08_ai.js`, `src/09_ui.js`.
- [ ] [DEBT] Free-text and idea outcomes use neutral template lines in built-in mode; richer per-room outcome text would help. Affected: `src/01_data.js` (freeOk/freeNo), `src/08_ai.js`.
- [ ] [FEATURE] Offer a Fortune reroll on the scouting check at forks (it currently has none). Affected: `src/08_ai.js` (doorIdea).
- [ ] [FEATURE] Hero memories: persist what the hero remembers from defining moments (near-death, left for dead, betrayal, a loss) as `hero.memories` entries (id, kind, text, source, tags, adventure, used). Code writes a short factual line at the event; the narrator may offer a first-person rewrite the player can accept or edit. Feed the top few relevant memories to `factsFor`, use them as story hooks (callbacks, legacy threads, flavour in rest/twist scenes), and include them in `heroMarkdown` for the future markdown/Dropbox sync. Affected: `src/06_combat.js` (down), `src/05_flow.js` (twist outcomes), `src/07_end.js`, `src/08_ai.js` (factsFor), `src/09_ui.js` (sheet/journal), `src/02_hero.js`.
