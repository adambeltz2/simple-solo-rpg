# Backlog

Working list of planned improvements. Check items off as they ship, and add new ones as
they come up — see `CHANGELOG.md` for the dated record of what actually shipped, and
`README.md` for current feature scope.

## Shipped (v0.1.0)

- [x] Character creation wizard (species/lineage, class, subclass pick, background,
      ability scores, skills, starting equipment)
- [x] Character sheet with derived stats, HP/death saves, inventory, spellcasting panel
- [x] Dice roller with advantage/disadvantage and roll log
- [x] Yes/No oracle with Chaos Factor and random events
- [x] Fail-forward complication roller
- [x] NPC generator
- [x] Encounter XP budget calculator
- [x] Combat tracker with initiative, HP, and conditions
- [x] Adventure journal
- [x] SRD compendium browser (spells, monsters, equipment, magic items, feats,
      conditions, species, classes, backgrounds)
- [x] Local save/export/import (localStorage + JSON)

## Deployment

- [x] GitHub Pages hosting via a GitHub Actions build-and-deploy workflow, with
      hash-based routing so deep links survive Pages' static hosting

## Data

- [ ] Swap in the full 2024 SRD spell list once `5e-bits/5e-database` publishes one
      (currently using the 2014 SRD spell list as a stand-in)
- [ ] Swap in the full 2024 SRD monster list once published (currently only 3 monsters
      exist in the 2024 dataset; using the 2014 SRD's ~330 monsters as a stand-in)
- [ ] Re-run the extraction script whenever upstream SRD data updates (see the data
      pipeline note in `README.md`)

## Character mechanics

- [ ] Multiclassing support
- [ ] Auto-apply subclass features at the correct level (currently only base class
      features are logged automatically on level-up; subclass features are visible in
      the compendium but not auto-added)
- [ ] Weapon Mastery property selection UI (2024 rule)
- [ ] Class-specific resource tracking (Rage uses, Bardic Inspiration, Channel Divinity,
      etc.) beyond spell slots
- [ ] Encumbrance tracking (carry weight vs. capacity)
- [ ] Condition effects that auto-apply to rolls (e.g., Poisoned imposing disadvantage)
- [ ] Sidekick / companion character support, per the original "solo safety net"
      framework (a controllable second combatant tied to the main character)

## Toolkit / DM tools

- [ ] Saved encounter templates / multiple concurrent encounters
- [ ] Richer random tables (loot, location, weather) alongside the existing oracle
- [ ] Session summary / recap generator from journal entries

## UX / platform

- [ ] Mobile-friendly layout pass (current layout is usable but optimized for desktop)
- [ ] Light theme toggle (currently dark-theme only)
- [ ] Character portrait/avatar upload
- [ ] Export character sheet to PDF
- [ ] Import/export user-defined data (characters, journal entries, etc.) as Markdown,
      rendered through user-editable templates — a human-readable/editable alternative
      to the existing JSON export
- [ ] PWA / offline support
- [ ] Automated test suite (unit tests for domain logic, component tests for key flows)
