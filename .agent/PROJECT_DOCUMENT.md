# PROJECT_DOCUMENT.md

This file provides guidance to AI agents working with code in this repository. Read it first,
before any other file.

## Purpose

> **Not yet specified.** The repository README is still the unmodified `create-next-app`
> template, so the project's purpose has not been recorded anywhere. Fill this in with one
> paragraph describing what this project does before the next task is planned — every agent
> session starts from this section.

## Repository Structure

This is the workspace (root) repository. Applications are managed as **git submodules** under
`apps/`.

- **Root** — a Next.js application (`src/app/`), plus the workspace's own agent
  configuration in `.agent/`. Whether this app eventually moves under `apps/` is an open
  decision; for now it lives at the root.
- **apps/** — *empty for now.* No submodules have been added yet. Each application added here
  gets its own `apps/{APP_NAME}/.agent/APP_DOCUMENT.md` and `apps/{APP_NAME}/.agent/tasks/`.

```
.agent/
├── PROJECT_DOCUMENT.md          # this file — project-wide context
├── commands/tasks/              # plan, do-task, do-task-post, common-plan-doc
├── scripts/archive-task.sh      # moves a finished task into tasks-archived/
├── tasks/                       # repo-wide active tasks (not app-specific)
└── tasks-archived/              # completed tasks, kept as a decision log
```

## Application Inventory

| App | Path | Repository | Responsibility |
| --- | --- | --- | --- |
| _(none yet)_ | | | |

When an app is added, register it here and add it with:

```bash
git submodule add {url} apps/{appname}
```

## Root Application — Tech Stack

Read from `package.json`; keep in sync when dependencies change.

- **Next.js** 16.3.4 (App Router — `src/app/`)
- **React** 19.2.8 / React DOM 19.2.8, with `babel-plugin-react-compiler` 1.0.0
- **TypeScript** ^5
- **Tailwind CSS** ^4 via `@tailwindcss/postcss`
- **ESLint** ^9 with `eslint-config-next` 16.3.4
- **Package manager**: pnpm 10.6.5 (`packageManager` field; `pnpm-workspace.yaml` present)

### Commands

```bash
pnpm dev      # next dev
pnpm build    # next build
pnpm start    # next start
pnpm lint     # eslint
```

### Next.js version caution

The installed Next.js is newer than most agents' training data and has breaking changes. Before
writing Next.js code, read the relevant guide under `node_modules/next/dist/docs/`. This rule is
also carried in the tool-managed `<!-- BEGIN:nextjs-agent-rules -->` block in the root
`AGENTS.md`, which `next dev` rewrites automatically — leave that block in place.

## Working with Submodules

Once apps exist under `apps/`, each one is a **separate git repository**.

```bash
git submodule update --init --recursive   # first-time checkout
git submodule update --remote             # pull latest on tracked branches
git submodule status                      # check state
```

- Git commands (log, diff, commit) must be run **from inside** the submodule directory — the
  commits do not exist in the parent repository.
- Commit and push inside the submodule first, then commit the updated submodule reference in
  this repository.
- Avoid duplicating code across apps; shared code belongs in whichever shared package each
  app's `APP_DOCUMENT.md` designates.

## Task Workflow

Work is planned into task files before it is implemented — spec first, then code.

1. **Plan** — `.agent/commands/tasks/plan.md` creates one self-contained task file per
   application under `apps/{APP_NAME}/.agent/tasks/` (or `.agent/tasks/` for repo-wide work).
   Planning writes task files only; it never changes source code.
2. **Execute** — `.agent/commands/tasks/do-task.md` runs a task file, a GitHub issue number, or
   a direct prompt, verifying against the app's build/lint/test commands.
3. **Close out** — `.agent/commands/tasks/do-task-post.md` archives the task, comments on the
   related GitHub issue, audits touched files against the 600-line rule, and suggests commit
   messages.

Task files are always written in English. Archival:

```bash
sh ./.agent/scripts/archive-task.sh apps/{APP_NAME}/.agent/tasks/{FILENAME}.md
# → .agent/tasks-archived/{YYYY}/{MM}/{DD}/{HHMM}_{APP_NAME}_{FILENAME}.md
```

Note: `archive-task.sh` derives the app name from an `apps/{APP_NAME}/...` path and will refuse
a path that isn't in that shape — repo-wide tasks in `.agent/tasks/` cannot be archived with it
as written.

## Agent Harness Configuration

Commands are defined **once** in `.agent/commands/tasks/`. Each harness directory holds only a
thin pointer to them — never a second copy of a command.

| Harness | Pointer files |
| --- | --- |
| Claude Code | `.claude/commands/tasks/plan.md`, `.claude/commands/tasks/do-task.md` |
| Codex | `.agents/skills/plan/SKILL.md`, `.agents/skills/do-task/SKILL.md` |

Root pointer files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`) do one thing: send the agent here.
Project knowledge belongs in this file, not in them.

### Symlinked files

The command files, the archive script, and most pointer files are **symlinks** into
`/Users/bora/.claude/skills/agent-agnostic-development/assets/`, so improvements to that shared
source apply to every project at once.

Consequences to be aware of:

- **Do not edit a symlinked file in place** — the edit lands in the shared skill and changes
  every other project that uses it. To make a project-specific change, replace the symlink with
  a real file first.
- A fresh clone of this repository on another machine will have broken links unless that path
  exists there.
- `common-plan-doc.md` is shared, so its "Application Identification" section cannot be
  customized here. The app inventory above is the authoritative list for this project.

Files that are **not** symlinks, and can be edited normally: this document, `AGENTS.md` (kept
local because `next dev` writes through to it), `.claude/commands/tasks/do-task.md`, and
`.agents/skills/do-task/SKILL.md`.
