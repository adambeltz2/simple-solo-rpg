# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.6.1] - 2026-10-03

### Added

- A "thinking" indicator: while the on-device narrator is working on a passage, the story shows three pulsing dots (instead of an empty line with a cursor) until its first words arrive.

### Changed

- Scenes with someone to talk to now resolve after one action, like every other scene. Before, the same menu came back after your first choice and asked again; now you get the result and "Continue deeper".

## [1.6.0] - 2026-10-02

### Added

- More things your hero remembers: an ally falling in battle (Loss), leaving a captive ally bound, sparing the villain, or killing one whose story you learned (Hard choice), and finishing an adventure after being left for dead (Triumph). They appear in the Journal's Memories tab, the markdown export, and as "Think over…" options at rest stops.
- More ways the story brings memories back: an ally you left bound can turn up in a later adventure, thin and wary, and you can apologise, make it right with coin, ask them to fight beside you, or walk on (making amends settles the memory). A rest stop in a later adventure can recall an ally you lost.

## [1.5.0] - 2026-10-02

### Added

- Rest stops let you sit with a memory: "Think over …" (an Insight check) turns a hard memory into steadier nerves (+1 Fortune and a little rest), and each memory can be worked through once. A failure just costs time.
- Your memories now suggest ideas for "Think of something else": remembering at a rest stop, looking for the signs of a betrayal at a twist, and guarding against how you fell last time at a boss. With the on-device AI on, it also sees your relevant memories when it writes ideas.
- With the on-device narrator on, a memory in the Journal can be retold in your hero's voice. You see the retelling next to your original and choose Keep this or Discard; the retelling is refused if it loses a betrayer's name.

## [1.4.0] - 2026-10-02

### Added

- Tap-to-roll dice: Settings → Dice now picks which rolls are yours (just the d20s, or everything) and, separately, how you roll them. "Tap to roll" shows the die; you tap it, it tumbles and lands on its number (a natural 20 or 1 is called out), and the game carries on. "Type my own dice" is the earlier behaviour for physical dice, and every roll can still switch to typing with "Enter my own roll instead". The game rolling everything instantly is still the default.

### Changed

- Anyone who had already chosen "I roll d20s" or "I roll everything" now gets tap-to-roll by default; switch "How you roll" to "Type my own dice" to keep entering physical dice.

## [1.3.0] - 2026-10-02

### Added

- Hero memories: the game now remembers the moments that mark your hero. Being struck down or left for dead, and an ally's betrayal, are saved to the hero as short first-person memories (written by the game, so they work with no AI). They persist between adventures and are listed in a new "Memories" tab in the Journal, where you can edit the wording or let one go. They are included in the hero's markdown export, and a "Memories" count shows on the Heroes screen.
- The story uses them: a betrayer who got away can return in your next adventure (a new scene where you can make them answer for it, demand to know why, offer a second chance, or walk away, and what you choose is recorded), the adventure opens with a "you have not forgotten" line, and with the on-device narrator on, the most relevant memories are passed along so it can echo them.
- `tools/memory.js`: a targeted test for the betrayal, defeat, return and settle flow.

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
