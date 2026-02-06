---
description: Plan-first git automation (init, commit, push)
auto_execution_mode: 3
---

# Git Auto Workflow

Plan first, then find relevant files, then run git init/commit/push only when requested.

## Step 1: Plan
- If the task is non-trivial, create a short 2-4 step plan.
- Update the plan after each step.

## Step 2: Find Relevant Files
- Use `rg --files` and `rg -n "keyword"` to locate files quickly.
- Open only the most relevant files before editing.

## Step 3: Git Init (When Requested)
- If not inside a git repo: `git rev-parse --is-inside-work-tree`.
- Run `git init` when the user wants a new repo.
- Add a minimal `.gitignore` based on the stack if needed.

## Step 4: Auto Commit (When Requested)
- Check status: `git status --porcelain`.
- Stage: `git add -A` (or specific paths if unrelated changes exist).
- Commit: `git commit -m "<message>"`.
- Do not amend unless explicitly requested.

## Step 5: Auto Push (When Requested)
- Check branch: `git branch --show-current`.
- Check remotes: `git remote -v`.
- If no upstream: `git push -u origin <branch>` (confirm remote).
- If no remote exists, ask for the URL.

## Trigger Examples
- "Tu dong commit va git push"
- "Tao project moi va tao git"
- "Auto plan truoc khi lam va tim file lien quan"
