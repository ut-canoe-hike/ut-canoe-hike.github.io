# AGENTS.md

## Apps Script workflow (clasp)
- Apps Script source of truth is **`Code.js`** and **`appsscript.json`** in the repo root.
- `.claspignore` is configured to prevent pushing website files. Do not remove it.
- Typical update flow:
  1) Edit `Code.js` / `appsscript.json`
  2) `clasp status`
  3) `clasp push`
  4) `clasp deploy` (or `clasp deployments` then `clasp deploy -i <deploymentId>`)
