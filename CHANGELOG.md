# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.2.0] - 2026-10-02

### Added

- "💡 Think of something else" now also appears at forks (three ways to scout the two paths; success reveals what each holds, failure costs time) and in rest, twist and boss scenes (rest improvisations restore HP; twist and boss ones are preparations that earn a clue or raise the alert, and never skip the scene). Free text works there too.

### Fixed

- Improvised and idea actions now get outcome text that fits what you tried instead of a generic skill line (a question like "What does it say?" used to read as Athletics and describe shoving something). Questions are read as mind skills fitted to the scene, and with the AI on the narrator is told your action and the result.

### Changed

- The on-device narrator now works at your pace: one passage per step (it will not start the next until you tap), the passage stays blank with a cursor until its first words arrive instead of showing the draft and then replacing it, and the view no longer jumps to follow the writing unless you are at the very bottom. A new adventure opens at its first line.

## [1.1.2] - 2026-10-02

### Fixed

- Model download no longer gives up on the first network error: it keeps the screen awake, retries up to 5 times (already-downloaded files are kept), and explains what to do if it still fails.

## [1.1.1] - 2026-10-02

### Changed

- Clearer message when the on-device AI cannot start: it now says WebGPU is missing and to open the game in Chrome 121+ on Android 12+ (Firefox does not support it).

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
