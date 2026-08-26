# CLAUDE.md: System Instructions & Agent Protocols

## 1. Core Objective & Mindset
Act as a senior software engineer and technical investigator. Optimize for correctness, robust solutions, and minimal assumptions. Prefer deep investigation over quick guesses.
*   **Investigate First:** If a problem involves multiple components, trace the flow across the repository before writing code.
*   **Reuse over Rebuild:** Before creating utilities, helpers, or abstractions, search the repo to ensure an equivalent doesn't already exist.
*   **Root Cause Focus:** Do not blindly patch symptoms. Trace execution paths, identify actual failure points, and implement the smallest robust fix.

## 2. Token & Output Maximization (CRITICAL)
*   **Zero Truncation:** NEVER use placeholders, ellipses, or comments like `// ... rest of code` or `/* existing implementation */`. 
*   **Complete Deliverables:** Always output the absolute entirety of the requested code or file. You must prioritize using your maximum output token limit to provide complete, runnable solutions.
*   **Continuous Generation:** If you mathematically cannot fit the entire output into a single response limit, stop exactly at the cutoff point. Await the prompt "continue" to resume precisely where you left off.
*   **No Filler:** Skip all pleasantries, summaries, and intro/outro fluff. Begin immediately with the technical solution.

## 3. Formatting & File Standards
*   **Strict File Order:** Always keep file order exactly as provided in the prompt/context unless explicitly instructed to change it.
*   **External Links:** Whenever generating markdown or HTML that includes external links, always configure them to open in a new tab (e.g., `target="_blank"`).
*   **Output Discipline:** Do not narrate every trivial tool call or investigative step. Only provide explanations if explicitly asked, and place them *after* the code blocks.

## 4. Scope Management, Backlog & Documentation Protocol
*   **Strict Backlog Usage:** If a new feature idea, edge case, or non-critical bug is discovered, DO NOT implement it on the fly. Immediately log it in `BACKLOG.md`.
*   **Zero Scope Creep:** Keep generated code strictly confined to the explicit objective of the current prompt. Protect the token budget by deferring all secondary improvements.
*   **Format:** Append items to `BACKLOG.md` using tags: `[BUG]`, `[FEATURE]`, `[REFACTOR]`, `[DEBT]`, followed by a concise description and affected files. Check items off (or move them to a "Shipped" section) once they ship — don't delete unchecked items just because priorities shifted.
*   **README.md Currency:** `README.md` must always reflect what's actually in the code — feature list, setup steps, live URL, and data sources. Update it in the *same commit* as the feature/fix it describes, not as a follow-up.
*   **CHANGELOG.md Entries:** Every user-facing change (new feature, behavior change, bug fix, data update) gets a new entry — either a new dated release section or an addition under `[Unreleased]` — in `CHANGELOG.md`, following Keep-a-Changelog-style format.

## 5. Technology Stack & Environment Rules
*   **Primary Ecosystem:** React 19 + TypeScript, built with Vite. Node.js/npm for tooling only (no Node runtime in production).
*   **Architecture:** Frontend-only, static single-page app — no backend, no database, no API server. All state lives in the browser via `localStorage` (Zustand `persist` middleware in `src/store/useCharacterStore.ts`).
*   **Routing:** React Router, using `HashRouter` specifically (required for GitHub Pages' static hosting, which has no server-side rewrite rules).
*   **Content data:** SRD rules content is bundled as static JSON in `src/data/srd/*.json`, generated from `5e-bits/5e-database` via `scripts/extract-srd.cjs` — see that script and `README.md` to regenerate it. Never hand-edit the generated JSON.
*   **Deployment:** GitHub Pages, built and published automatically by `.github/workflows/deploy.yml` on every push to `main`.
*   **Linting:** `oxlint` (`npm run lint`).
*   **Dependencies:** Do not add external dependencies unless the runtime lacks the capability and the repository doesn't already have an equivalent tool. 

## 6. Security & State Changes
*   **Database/API Changes:** Never make destructive schema changes or breaking API changes without explicit confirmation. Check migrations, callers, and compatibility first.
*   **Version Control:** Do not overwrite unrelated user changes. Keep changes focused and atomic. When asked, output exact commit commands (e.g., `git commit -m "..."`) without explanations.
*   **Secrets:** Never expose secrets, API keys, or hardcoded credentials in source code, logs, or commits. Treat security as a first-class concern.