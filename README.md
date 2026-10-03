# Delve — a solo 5.5e dungeon generator

An offline, phone-first game where you play one hero through short, generated
dungeon adventures (about 15–25 minutes each) using D&D 2024-style ("5.5e") rules.
It is a single `index.html` PWA: no account, no server, no build step needed to play.

Live: https://adambeltz2.github.io/simple-solo-rpg/

## How it plays

- Each adventure is a story spine: a hook, a villain and boss, a twist, a clock and an
  alert meter, clues, NPC attitudes and about seven rooms ending in a boss.
- Pick one of the offered choices (each shows its skill and difficulty), tap
  "Think of something else" for three more ideas (written by the on-device AI when it is
  on, from a built-in pool otherwise), or type a free-text action. Your choices are recorded in a ledger that changes later rooms,
  the boss fight and the ending.
- Turn-based combat with initiative, surprise, conditions, class powers, potions,
  allies and original ASCII portraits.
- Heroes persist between adventures: milestone leveling to 5, a chronicle, and
  consequences (a spared villain can return in a later adventure).
- Heroes remember: being left for dead or betrayed is saved as a memory (Journal →
  Memories, editable) that the story can bring back, such as a betrayer who returns
  in your next adventure.
- Read back at any time: scroll up in the story (a "↓ Latest" button returns you), or
  open the Journal's "Full story so far" tab.
- Dice are yours if you want them: Settings → Dice lets the game roll for you, or
  stop at each d20 (or every die your hero rolls, damage and healing too). Then tap the
  die to roll it and watch it land, or type the number from your physical dice. Enemy
  and world rolls always stay automatic.
- Four classes (fighter, rogue, wizard, cleric), five species, backgrounds, and a
  "drive" that earns Fortune rerolls when you play in character. Difficulty:
  story, standard, grim. Defeat is either "Left for dead" or real death.

## Narration

- Built-in template narration works with no network at all.
- Optional on-device narrator (WebLLM, Qwen2.5 1.5B by default, 3B or Llama 3.2 1B
  optional). It needs Chrome (121 or newer, Android 12 or newer) with WebGPU; Firefox does not support WebGPU, so the narrator stays off there and the built-in text is used. The first use downloads the model
  (about 0.7–2 GB) and the WebLLM library from the jsdelivr CDN; after that it runs
  offline. The model only rewrites narration and parses free-text intent; code decides
  every outcome.

## Install on Android

Open the live URL in Chrome while online, then "Add to Home screen". It then works
offline. Saves live in the browser's local storage; use Export in Settings for backups.

## Repository layout

- `index.html` — the built app (generated; do not hand-edit).
- `sw.js`, `manifest.webmanifest`, `icon*` — PWA shell.
- `src/` — the sources (`00_util.js` … `09_ui.js`, including `04b_dice.js` for manual dice, `style.css`, `template.html`) and
  `build.py`, which assembles them into `index.html`.
- `tools/test.js` — jsdom bot that plays full adventures through the real UI
  (`node tools/test.js N seedbase [ai] [smart] [dump]`; set `DICE=d20|all` and `DICEHOW=tap|type` to test the dice prompts).
- `tools/memory.js` — targeted test of hero memories and the returning betrayer (`node tools/memory.js`).
- `tools/sim.js` — combat balance simulator (`node tools/sim.js N kinds`).

## Develop

```
npm install      # jsdom, for the tools only
npm run build    # python3 src/build.py -> index.html
npm test         # 12 bot playthroughs
```

Edit files in `src/`, rebuild, and commit both `src/` and the regenerated `index.html`.
The version number (from `package.json`) and build date appear at the bottom of the title screen, menu and settings, which shows whether your phone has picked up the latest build. Deployment is GitHub Pages via `.github/workflows/deploy.yml` on every push to `main`.
