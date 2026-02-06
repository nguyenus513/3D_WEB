---
name: git-auto-workflow
description: Automate git workflows with a plan-first, file-discovery approach. Use when the user asks for auto commit/push, initialize git for a new project, or wants an automatic plan + relevant-file search before making changes (e.g., "tu dong commit", "git push", "tao project moi", "tao git", "auto plan", "tim file lien quan").
---

# Git Auto Workflow

## Overview
Enable a plan-first workflow with fast file discovery, plus automated git init/commit/push actions when requested.

## Plan First
- Create a short plan for non-trivial tasks using the plan tool.
- Keep plans to 2-4 steps and update the plan after each completed step.
- Skip the plan only for trivial one-liners.

## Find Relevant Files
- Use `rg --files` and `rg -n "keyword"` to locate files quickly.
- Start from filenames/keywords in the request, then check README/config files if the structure is unclear.
- Open only the most relevant files before editing.

## Initialize Git for New Projects
- If the task creates a new project and the directory is not a git repo (`git rev-parse --is-inside-work-tree` fails), run `git init`.
- Add a minimal `.gitignore` based on detected stack. If the stack is unclear, ask one focused question.
- Optionally create a short `README.md` with the project name and goal.
- If the user requested auto commit, stage and commit the initial files.

## Auto Commit
- Only auto commit when explicitly requested.
- Check `git status --porcelain`; if empty, report and stop.
- Stage changes with `git add -A` (or `git add <paths>` if there are unrelated changes to avoid).
- Use the user-provided commit message if given; otherwise propose a concise message and ask for confirmation if conventions are unknown.
- Commit with `git commit -m "..."`
- Never use `git commit --amend` unless explicitly requested.

## Auto Push
- Only push when explicitly requested.
- Determine branch (`git branch --show-current`) and remotes (`git remote -v`).
- If no upstream exists, confirm the remote and set upstream with `git push -u origin <branch>`.
- If no remote exists, ask for the remote URL.

## Trigger Examples
- "Tu dong commit va git push giup minh"
- "Tao project moi va tu tao git"
- "Auto plan truoc khi lam va tim file lien quan"
