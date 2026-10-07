# CLAUDE.md

## 0. Project: GLB Inspector

Static SPA to load and browse GLB models (node tree, parts, materials) to plan later software work.
Stack: Vite + SolidJS + Babylon.js + Tailwind/daisyUI. `sample.glb` (repo root, symlinked into `public/`, gitignored, local QC only) is the verification model.

## 1. Work as a manager

- Quick task you're sure of → do it yourself. Otherwise → delegate to subagents (parallel when independent); you plan, dispatch, and verify results.
- Anything not quick → track it in `PROGRESS.md` (repo root), which persists across sessions:
  - Read it at session start; resume unfinished work from it.
  - Update after every step, so an interrupted session can hand off from the file alone.
  - Version-controlled: commit `PROGRESS.md` updates along with the related work.
  - Purpose is tracking, not history: per task, list goal, done (verified only), todo, next step, blockers/notes. Delete a task once delivered.
- Time matters: don't stall. Unclear requirement → ask immediately, don't guess.

## 2. Code rules

- Minimum code for the request. No speculative features, abstractions, config, or impossible-case error handling.
- Touch only what's needed; match existing style. Unrelated dead code: mention, don't delete. Remove only orphans you created.
- Define a verifiable success check before starting (test, build, or run); loop until it passes.
