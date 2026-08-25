# Repo conventions

This project is maintained solo (by Claude, on behalf of the repo owner). Keep it in a
state where anyone landing on the repo can understand what it is and what's next without
digging through commit history.

## On every change

- **README.md** must stay accurate: feature list, setup steps, and data sources should
  always reflect what's actually in the code. Update it in the same commit as the
  feature/fix it describes, not as a follow-up.
- **CHANGELOG.md** gets a new dated entry (or an addition under `[Unreleased]`) for any
  user-facing change: new feature, behavior change, bug fix, or data update. Follow the
  existing Keep-a-Changelog-style format.
- **BACKLOG.md** is the source of truth for planned work:
  - When you complete something that was listed, check it off (`[ ] -> [x]`) and move it
    under a "Shipped" section if the file distinguishes shipped vs. planned.
  - When you notice new work worth doing (a gap, a follow-up, a rough edge), add it as a
    new unchecked item in the relevant section instead of letting it live only in
    conversation.
  - Don't delete backlog items just because priorities shifted — leave them unchecked
    for later, or note why they were dropped if truly abandoned.

## Data pipeline

SRD data in `src/data/srd/*.json` is generated, not hand-edited. Regenerate it with:

```bash
git clone --depth 1 https://github.com/5e-bits/5e-database /tmp/5e-database
node scripts/extract-srd.cjs /tmp/5e-database
```

If that upstream dataset publishes a fuller 2024 spell or monster list (see
`BACKLOG.md`), regenerate the corresponding JSON files rather than hand-patching them,
update `src/data/srdTypes.ts` if the shape changed, and note the change in
`CHANGELOG.md`.

## Architecture notes

- `src/domain/` holds pure game-logic functions (character math, dice, oracle tables) —
  no React, no store access. Keep it that way so it stays easy to test.
- `src/store/useCharacterStore.ts` is the single source of truth for character state,
  persisted to `localStorage` via zustand's `persist` middleware.
- `src/data/srd.ts` is the typed accessor layer over the bundled JSON; add new lookups
  there rather than importing the raw JSON files directly in feature code.
