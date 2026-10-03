---
name: opendoor-sia-docs
description: Update, regenerate or check the OpenDoor SIA 1 Final Project Documentation (Word .docx) and its diagrams. Use when the user wants to edit a section of the SIA documentation, fill in placeholders (test results, JMeter numbers, screenshots, team details, URLs), redraw the architecture/sequence/deployment/AS-IS diagrams, keep the document in sync after code changes, or check the document against the SIA template requirements.
---

# OpenDoor SIA documentation

The SIA 1 final documentation is **generated from code**, so edits go into the generator scripts, not into the .docx by hand. A hand edit in Word is overwritten the next time the build runs.

| File | Purpose |
|---|---|
| `docs/diagrams/build.js` | Builds `OpenDoor_SIA1_Final_Project_Documentation.docx` (all text, tables, code samples) with the `docx` npm package |
| `docs/diagrams/diagrams.py` | Draws the 5 figures with matplotlib into `diagrams/` |
| `docs/diagrams/fig1_as_is.png` … `fig5_deployment.png` | AS-IS, final architecture, two sequence diagrams, deployment |

Paths are relative: the .docx is written to the parent folder of `diagrams/`, i.e. `docs/OpenDoor_SIA1_Final_Project_Documentation.docx`.

## Regenerate

```
cd docs/diagrams
python diagrams.py            # only if a diagram changed (needs matplotlib)
npm install docx              # first time only (creates docs/diagrams/node_modules — already git-ignored)
node build.js
```

Then check the output visually. On Windows with Word installed, convert to PDF with Word COM (PowerShell `Word.Application` → `SaveAs` format 17) and look at the pages; otherwise open it in Word. Fix overlaps, empty pages or broken tables before telling the user it is done.

## Rules for content (strict)

1. **Follow the SIA template exactly**: title page; Project Information, Group Members, Document Control; Executive Summary; sections 1–12 with the same numbered headings (1.1 … 12) in the same order; Appendices A–F. Do not rename, reorder, add or remove template sections. Extra detail goes inside the matching section or appendix.
2. **Style**: Arial; gold headings `#BF9000`; dark table headers `#434343` with white bold text; key/value tables with a light-grey bold first column; US Letter, 0.75" margins.
3. **Placeholders** are written `[[like this]]` in `build.js` and appear yellow-highlighted. Replace them only with information the user gives you or that exists in the repo (URLs, real test output, real screenshots). When all are filled, the document should contain no yellow text.
4. **Never invent results.** Test outcomes (7.1 Actual/Status), Newman totals (7.2), JMeter numbers (7.3), defects (7.4), objective results (10.1), lessons learned (10.4) and contribution percentages (11) must come from the team's actual runs. If the user asks you to "fill them in" without data, ask for the data or read it from the repo (`tests/postman` reports, JMeter `report/`, CI logs).
5. **Keep it consistent with the code.** The development skill `opendoor-dev` holds the same contract. When an endpoint, field, error code, port, rule or technology changes, update every affected place in `build.js`: section 3.4 (inventory), 4.1 (endpoints), 4.2–4.5 (samples), 5.2–5.3 (integrations, errors), 6 (security), 7.1 (tests), 8 (deployment), Appendix A (full endpoint list), and the diagrams if the structure changed. Also update `.claude/skills/opendoor-dev/references/*.md` so both stay identical.
6. **Screenshots (9.1)**: the `screenshotSlot(caption, fn)` calls create the boxes. To insert a real screenshot, save it under `docs/diagrams/screens/`, replace that slot with a `fig()`-style image call using the image's real pixel size, and keep the caption and business-function sentence.
7. **Honesty about limitations**: the Business Registry is a simulation, and OpenStreetMap coverage is incomplete. Keep these statements unless the implementation really changes.
8. **References (12)**: consistent APA-style entries, alphabetical; add any new library, API or standard the team actually used.

## Helpers inside build.js

`H1`, `H2`, `P(text)` (supports `**bold**`, `` `code` ``, `[[placeholder]]`), `bullets([...])`, `numbered([...])`, `table(headers, rows, widths, {kv, size})` (widths in DXA, scaled to 10080), `code(text)`, `fig(file, wPx, hPx, caption)` (auto-numbers figures), `note(text)`, `brk()` (page break).

## IPT documents

The same system is also documented for IPT (`OpenDoor_Proposal_IPT.pdf`, `OpenDoor_Modules_and_Features_IPT.pdf`, kept outside this repo). The SIA design added fields that the IPT database section lacks: `address`/`location_psgc` on postings, profiles and employers; `registry_type`; and the `registry_checks` table. When the user edits either course's documents, remind them to keep the two consistent.
