# Workspace Rules

## Auto Commit & Push Diagrams to GitHub

This local workspace is used for managing project diagrams (`diagrams/`). The full application source code (for web/Render deployment) lives on `origin/main` (`https://github.com/truong2903/Coursebot.git`) and must **never** be modified or deleted from this workspace.

Whenever you create, edit, or delete files inside `diagrams/` (or update this rule):

1. Stage **only** `diagrams/` (and `AGENTS.md` if modified), e.g. `git add diagrams/`.
   - **NEVER** run `git add .`, `git add -A`, or `git commit -a` (the local directory does not hold all files from `origin/main`, so staging everything would accidentally delete application code on GitHub).
2. Run `git diff --cached --name-status` and verify that **every** staged entry is under `diagrams/` (or `AGENTS.md`) and that there are **zero** changes or deletions (`D`) to any other files.
3. Commit with a clear message describing the diagram changes.
4. Push to `origin main` (`git push origin main`). Never use `--force`. If `origin/main` has newer commits, stop and safely sync without touching or deleting remote application files, or report to the user if manual intervention is needed.
5. In your final response, report the exact commit hash, staged files, and push result.
