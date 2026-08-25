# Lone Wanderer — a solo D&D 2024-rules toolkit

A browser-based toolkit for playing Dungeons & Dragons (2024 rules, "5.5e") solo. You
build a character, then act as both player and DM using an in-app dice roller, a
homebrew Yes/No oracle for improvised storytelling, a combat tracker, and a searchable
System Reference Document (SRD) compendium. Everything runs client-side and saves to
your browser's local storage — no account or server required.

## Features

- **Character creation wizard** — species/lineage, class, subclass (for planning),
  background with the 2024 ability-score-bonus rules, standard array / point buy /
  manual ability scores, class skill choices, and starting equipment resolved from the
  SRD's class and background tables.
- **Character sheet** — ability scores, saving throws, skills (with an
  expertise-aware proficiency toggle), HP/temp HP/death saves, hit dice, AC
  (auto-calculated from equipped armor, or overridable), spellcasting info and a
  prepared-spells picker for casters, inventory, feature/trait log, short/long rest,
  and a simple level-up flow that adds average hit points and logs new class features.
- **Dice** — d20 rolls with advantage/disadvantage, arbitrary dice pools, and a
  persistent roll log per character.
- **Oracle & solo toolkit** — a homebrew Yes/No oracle with a Chaos Factor that
  escalates random events, a fail-forward complication roller, an NPC generator, and an
  approximate XP budget calculator for building solo-safe encounters.
- **Combat tracker** — initiative order (your character rolls individually; a single
  roll covers each enemy group, per common solo-play convention), HP/condition
  tracking, and one-click monster lookup from the compendium.
- **Adventure journal** — a freeform, timestamped session log for the story you're
  narrating.
- **Compendium** — a searchable browser across the bundled SRD data: spells, monsters,
  equipment, magic items, feats, conditions, species, classes, and backgrounds.
- **Local save/export** — characters persist in `localStorage`; export/import them as
  JSON to back up or move between browsers.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL. To build a production bundle:

```bash
npm run build
npm run preview
```

## Content sources & attribution

Rules content is drawn from Wizards of the Coast's System Reference Documents:

- Species, classes, subclasses, backgrounds, feats, equipment, and magic items come
  from **SRD 5.2** (the 2024 rules), via the JSON dataset maintained by the
  [5e-bits/5e-database](https://github.com/5e-bits/5e-database) project (MIT-licensed
  code; SRD content © Wizards of the Coast, released under **CC-BY-4.0**).
- Spells and monster stat blocks are drawn from **SRD 5.1** (the 2014 rules) from the
  same dataset, since a full 2024 spell/monster list is not yet published in the free
  SRD. The two rule sets are mechanically compatible for the large majority of entries;
  treat these two sections as a reference rather than a verbatim 2024 rules text.
- The Oracle, complication tables, NPC generator, and encounter XP budget are original
  homebrew mechanics written for this project — not a reproduction of any commercial
  solo-RPG system.

This is an unofficial, fan-made project and is not affiliated with or endorsed by
Wizards of the Coast.

## Tech

React + TypeScript + Vite, React Router, Zustand (with `localStorage` persistence). No
backend — all state lives in the browser.
