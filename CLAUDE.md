# OpenDoor – instructions for Claude

OpenDoor is a PWD job-matching platform built for the SIA 1 and IPT final projects (React · Node/Express gateway · Laravel + MySQL Core Service · Node Insights mashup · PHP SOAP registry). The design is fixed by the SIA documentation; the development rules are in the `opendoor-dev` skill (`.claude/skills/opendoor-dev/`) — load it for any coding task.

## Progress protocol (mandatory — sessions can stop at any time)

Work may be cut off by usage limits, so progress must always be recoverable from the repo alone.

**At the start of every session or task:**
1. Read `PROGRESS.md` ("Now", "Pending decisions", "Decisions", the current phase checklist).
2. Run `git status` and `git log --oneline -10`.
3. If "In progress" names a step or there are uncommitted changes, **inspect them first** (`git diff`, check the files exist and run). Finish or fix that step — do not start it over and do not overwrite work that is already there.
4. Never redo items marked `[x]`. Never re-ask anything listed under "Decisions".

**While working:**
5. Before starting a step, write it to "Now → In progress" with the concrete next action (write-ahead), so an interrupted step can be found.
6. Work in small steps (one checklist item or less). Check whether a file/folder/project already exists before generating it; make commands idempotent (e.g. only run `composer create-project` if the folder does not exist).
7. After each completed step: tick it in `PROGRESS.md`, update "Next step", then commit (code + PROGRESS.md together) with a Conventional Commit message. `wip(scope): ...` is fine for a partial but working state.
8. Record any new decision in "Decisions" (dated) and any deferred problem in "Known issues".

**Before stopping** (or when the context is getting long): make sure `PROGRESS.md` says exactly what the next action is, add a one-line entry to the "Session log", and commit.

## Environment

- Windows 11, PowerShell in the VS Code terminal; Claude Code CLI started from this folder.
- PHP 8.4 + Composer via Herd Lite, Node 22, MySQL 8.0 local. Docker is **not** installed on the main machine — run services natively for local development.
- Never commit `.env` files or print secret values.
