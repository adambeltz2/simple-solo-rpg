# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.0] - 2026-10-02

### Added

- Version and build date in the footer of the title screen, menu and settings, so you can tell which build is loaded.
- "💡 Think of something else" in every room: three extra approaches beyond the fixed
  choices. With the on-device narrator ready, the AI writes them from the scene, the hero
  and the quest; otherwise a built-in pool (favouring what your hero is good at) provides
  them, so the option always works offline. The model only proposes the action and a skill;
  the code sets the difficulty and outcome. Tap again for more.

- Reading back through the story: new text now starts at its beginning instead of
  jumping to the end, a "↓ Latest" button appears when you scroll up, the Journal has a
  "Full story so far" tab with the whole adventure log, and the log keeps up to 600 entries.

- Manual dice: Settings → Dice offers "Roll for me" (default), "I roll d20s" and
  "I roll everything". In the manual modes the game asks for each of your hero's rolls
  (checks, saves, attacks, initiative, death saves and, with the last option, damage and
  healing). Enter your physical dice or tap "Roll for me"; invalid numbers are refused.
- `DICE=d20|all node tools/test.js ...` exercises the prompt in the bot tests.

### Changed

- Magic Missile now rolls 3d4+3 in one go (same odds as three 1d4+1).

## [1.0.0] - 2026-10-02

### Changed

- The repository now contains Delve, an offline single-file PWA solo dungeon
  generator, replacing the earlier React/Vite "Lone Wanderer" toolkit (still available
  in git history before this release).
- GitHub Pages workflow now publishes the static files directly, with no build step.

### Added

- Generated adventures with a story spine, consequence ledger, twists, clock/alert,
  legacy threads between adventures and persistent heroes.
- Turn-based combat with ASCII portraits, four classes, five species, backgrounds and drives.
- Optional on-device narrator (WebLLM) with template fallback; JSON and markdown export.
- Service worker and manifest for offline install.
- `tools/test.js` and `tools/sim.js` for bot playthroughs and balance checks.
