# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0] - 2026-08-25

Initial release: a frontend-only, browser-based toolkit for playing D&D (2024 rules)
solo.

### Added

- Character creation wizard: species/lineage, class, subclass (for planning), background
  with the 2024 ability-score-bonus rules, standard array / point buy / manual ability
  scores, class skill choices, and starting equipment resolved automatically from the
  SRD's class and background equipment tables.
- Character sheet: ability scores, saving throws, skills with an expertise-aware
  proficiency toggle, HP/temp HP/death saves, hit dice, AC auto-calculated from equipped
  armor (or manually overridable), spellcasting info with a prepared-spells picker,
  inventory management, a feature/trait log, short/long rest, XP tracking, and a
  level-up flow that adds average hit points and logs new class features automatically.
- Dice roller: d20 rolls with advantage/disadvantage, arbitrary dice pools (d4-d100),
  and a persistent per-character roll log.
- Oracle & solo toolkit: a homebrew Yes/No oracle with a Chaos Factor that escalates
  random events, a fail-forward complication roller, an NPC generator, and an
  approximate XP budget calculator for solo-safe encounters.
- Combat tracker: initiative order (PC rolls individually, one roll covers each enemy
  group), HP/condition tracking per combatant, and one-click monster lookup from the
  compendium.
- Adventure journal: a freeform, timestamped session log.
- Compendium: a searchable browser across the bundled SRD data — spells, monsters,
  equipment, magic items, feats, conditions, species, classes, and backgrounds.
- Local persistence: characters saved to `localStorage`; JSON export/import for backup
  or moving between browsers.
- SRD data bundled from the `5e-bits/5e-database` dataset: 2024 rules (SRD 5.2) for
  character-building content, 2014 rules (SRD 5.1) for spells and monsters pending a
  full 2024 dataset.
