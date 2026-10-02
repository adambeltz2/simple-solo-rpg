# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
