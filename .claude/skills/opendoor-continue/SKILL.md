---
name: opendoor-continue
description: Resume OpenDoor development exactly where the last session stopped (after a usage limit, crash, or a teammate taking over) without repeating finished work. Use when the user says continue, resume, pick up where we left off, what's next, or starts a new session on this project.
disable-model-invocation: false
---

# Continue OpenDoor development

Follow these steps in order. Do not skip the inspection steps even if the previous summary looks clear.

## 1. Rebuild the picture from the repo (not from memory)

- Read `PROGRESS.md` completely.
- Run `git status`, `git log --oneline -15`, and `git stash list`.
- If there are uncommitted changes, run `git diff --stat` and read the changed files that belong to the "In progress" step.

## 2. Decide where to resume

- **Uncommitted changes match "In progress"** → that step was interrupted. Check what is already done (files exist? code compiles? tests run?) and complete only the missing part. Do not regenerate or overwrite existing files.
- **Clean tree, "In progress" set** → the step may be done but not ticked. Check the evidence (files, migrations, routes, tests, last commit message). If done, tick it and commit `PROGRESS.md`; otherwise continue it.
- **Clean tree, nothing in progress** → take "Next step", or the first unticked item of the current phase.
- **Changes that do not match any step** → stop and ask the user what they are before touching them.
- Items under "Pending decisions" that block the next step → ask the user once, record the answer under "Decisions", then continue.

## 3. Report briefly, then work

Tell the user in 3–5 lines: last completed item, what you found (e.g. "migration written but not run"), and what you will do now. Then continue immediately. Do not wait for confirmation unless a decision is needed.

## 4. Keep working by the progress protocol

Use the `opendoor-dev` skill for the actual work. Follow `CLAUDE.md` → "Progress protocol": write-ahead "In progress", small steps, tick + update "Next step" + commit after each step, session-log line before stopping.
