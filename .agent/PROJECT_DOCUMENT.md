# PROJECT_DOCUMENT.md

Project-wide context for AI agents. Read this first, before any other file.

## Purpose

**AgentHub** is a locally-run web application that acts as a single control panel for
terminal-based AI coding agents (Claude Code, Codex, and similar CLIs).

The user picks an agent from the web UI, sends it a prompt, and watches the agent's output
stream back into the browser live — exactly as it would appear in a terminal. Sessions stay
alive between prompts, so a conversation with an agent continues across multiple messages.

It runs only on the developer's own machine; it is not intended to be deployed publicly.

## Core Requirements

1. **Agent selection** — choose which CLI agent a session runs (Claude Code, Codex, …).
2. **Live streaming** — agent output appears in the browser token-by-token, with no buffering.
3. **Persistent sessions** — the agent process stays running; follow-up prompts go into the
   same session rather than starting a new one.
4. **Multiple sessions** — several agent sessions can exist side by side and be switched
   between.

## Architecture

The whole reason this needs more than a plain HTTP API route: these CLIs assume they are
attached to a real terminal (TTY). Run through plain `child_process`, they detect no TTY,
buffer their output, and may refuse interactive mode entirely.

```
Browser (Next.js + xterm.js)
      ↕  WebSocket  (prompts down, output up)
Node server  ──  node-pty  ──  claude / codex CLI process
```

- **node-pty** — spawns each agent CLI inside a pseudo-terminal so the process believes it is
  in a real terminal and emits output unbuffered, in real time. One PTY process per session,
  kept alive across prompts.
- **WebSocket** (`ws` or Socket.IO) — bidirectional channel between browser and server.
  Input from the browser is written to the PTY's stdin; PTY output is pushed to the browser as
  it arrives. Plain HTTP request/response cannot hold an interactive session open, so a custom
  Node server process hosts both Next.js and the WebSocket endpoint.
- **xterm.js** — renders the raw stream in the browser. Agent output contains ANSI escape
  codes (colors, cursor movement, spinners); xterm.js interprets them instead of showing them
  as garbage characters.
- **Session registry** — server-side map of `sessionId → { pty, agent, cwd, buffer }`. The
  buffer holds recent output so a reconnecting or newly-opened browser tab can replay
  scrollback instead of seeing an empty screen. It is in-memory only; a server restart ends
  active sessions.

Project metadata is persisted separately in a git-ignored `data/projects.json` file. Per-project
tasks are persisted in git-ignored `data/tasks.json`, carry globally sequential integer ids
starting at `1`, include a lifecycle status and optional completion timestamp, are listed with
server-side URL pagination and status filtering, and can be retained or removed when their
project is deleted. Plan registrations are stored in git-ignored `data/plans.json`, with an id,
projectId, taskId, title, filePath, summary, createdAt, and updatedAt; they can be created,
edited (including project/task relinking), or deleted. A plan's Markdown file is read from
`{project.path}/{plan.filePath}` for display only and is removed only when explicitly requested;
the composed planning prompt ends by registering the finished task file through `POST /api/plans`.
Global Task and Plan agent defaults plus the four global task-flow prompts are
persisted in git-ignored `data/settings.json`. When a prompt has no saved value, settings displays
the matching built-in prompt from `src/lib/default-prompts/` in muted text; these defaults are read
by the server-only `src/lib/default-settings-prompts.ts` module. The code-defined agent catalog lives in
`src/lib/agents.ts` and the prompt descriptors live in `src/lib/settings-prompts.ts`. The console selects a saved project and its agent per new session (Codex
by default), while the settings remain available for future task and plan flows. These files
survive server restarts; agent sessions remain in-memory only and end when the server restarts.
Project records can be edited or deleted from their detail page. Creating a plan from a task composes the effective Task planning and After planning prompts (saved text when present, otherwise the built-in Markdown defaults) with that task's title and detail, then starts the configured Plan agent in the task's project directory through the console.

### Open decisions

- Session persistence across a server restart (in-memory only vs. on disk).
- Console sessions run in the directory of a selected saved project.
- Auth: none (localhost-only) vs. a shared token.

## Tech Stack

Read from `package.json`; keep in sync when dependencies change.

- **Next.js** 16.3.4 (App Router — `src/app/`)
- **React** 19.2.8, with `babel-plugin-react-compiler` 1.0.0
- **TypeScript** ^5, **Tailwind CSS** ^4 (via `@tailwindcss/postcss`)
- **ESLint** ^9 with `eslint-config-next`
- **node-pty** 1.1.0, **ws** 8.21.3, and `@types/ws` 8.18.1
- **xterm.js** (`@xterm/xterm` 6.0.0, `@xterm/addon-fit` 0.11.0)
- **tsx** 4.23.13 runs the TypeScript custom server locally
- **pnpm** 10.6.5

### Commands

```bash
pnpm dev      # tsx watch server.ts (Next.js + WebSocket custom server)
pnpm build    # next build
pnpm start    # production custom server (NODE_ENV=production tsx server.ts)
pnpm lint     # eslint
```

### Next.js version caution

The installed Next.js is newer than most agents' training data and has breaking changes.
Before writing Next.js code, read the relevant guide under `node_modules/next/dist/docs/`.
The same rule is carried in the tool-managed `<!-- BEGIN:nextjs-agent-rules -->` block in
`AGENTS.md`, which `next dev` rewrites automatically — leave that block in place.

## Repository Structure

```
src/app/                         # Next.js application
├── api/projects/                 # Route Handlers for persisted project metadata
│   └── [id]/tasks/               # Route Handlers for per-project tasks, including plan-prompt
├── api/settings/                 # Route Handler for global agent defaults
├── api/plans/                    # Route Handlers for plan registrations and detail CRUD
│   └── [planId]/                 # Single-plan read, update, and delete handler
├── console/                      # Multi-session console route and colocated client components
│   └── use-plan-run.ts           # Starts a plan session from task URL parameters
├── projects/                     # Projects list, creation, and detail routes
│   ├── page.tsx                  # Projects list page
│   └── [id]/                     # Editable project detail and task-detail routes
│       └── tasks/                # Detail routes; list and creation redirect to /tasks
├── settings/                     # Global agent defaults and task-flow prompt settings
├── tasks/                        # Global task list, project filter, and unified task creation
├── plans/                        # Global plan list, creation, and detail routes
│   ├── [planId]/                 # Editable plan detail and read-only file preview
│   └── new/                      # Manual plan registration form
├── agent-console.tsx             # Client console UI
└── page.tsx                      # Header-only home page
src/lib/
├── agents.ts                     # Client-safe selectable agent catalog
├── agent-protocol.ts             # WebSocket session protocol shared by client and server
├── default-prompts/              # Built-in task-flow prompt Markdown files
├── default-settings-prompts.ts   # Server-only built-in prompt reader
├── plans-store.ts                # Persisted editable plan records
├── plan-file.ts                  # Server-only safe plan file reader/deleter
└── settings-store.ts             # Persisted global settings store
server/
├── agents.ts                     # Server-only CLI command definitions
└── session-registry.ts           # In-memory concurrent PTY session registry
data/                             # Runtime JSON database (git-ignored: projects.json, tasks.json, plans.json, settings.json)
.agent/
├── PROJECT_DOCUMENT.md          # this file
├── commands/tasks/              # plan, do-task, do-task-post, common-plan-doc
├── scripts/archive-task.sh      # moves a finished task into tasks-archived/
├── tasks/                       # active task files
└── tasks-archived/              # completed tasks, kept as a decision log
```

## Task Workflow

Work is planned into task files before it is implemented — spec first, then code.

1. **Plan** — `.agent/commands/tasks/plan.md` writes a self-contained task file under
   `.agent/tasks/`. Planning never changes source code.
2. **Execute** — `.agent/commands/tasks/do-task.md` runs a task file, a GitHub issue number,
   or a direct prompt, verifying against `pnpm build` / `pnpm lint`.
3. **Close out** — `.agent/commands/tasks/do-task-post.md` archives the task, comments on the
   related GitHub issue, audits touched files against the 600-line rule, and suggests commit
   messages.

Task files are always written in English.

Note: `archive-task.sh` expects an `apps/{APP_NAME}/...` path and refuses anything else, so
tasks in `.agent/tasks/` are archived by hand into
`.agent/tasks-archived/{YYYY}/{MM}/{DD}/`.

## Delivered session capabilities

- Agent selection (Codex or Claude Code) is available per new console session.
- Multiple concurrent sessions can run, be selected from the console sidebar, and retain their
  individual in-memory scrollback until dismissed after exit.
- Every project has a persisted task list with server-side URL pagination; project deletion can
  explicitly remove its tasks or leave them in place.
- Tasks can start a new console session for planning; the session uses the configured Plan agent
  and effective planning/after-planning prompts, with the composed multi-line first prompt passed
  to the agent CLI as a startup argument. Follow-up prompts are pasted into the running session.
  When its agent exits, the plan session closes and is removed automatically.
- A single `/tasks` screen provides server-rendered, cross-project task pagination and optional project and status filters; it defaults to open tasks, which can be completed and reopened from the list or detail page. `/tasks/new` creates tasks for any saved project. Per-project list and creation URLs redirect to these unified screens.
- The `/plans` screen lists registered plans across projects with pagination and a project filter. Plans can be registered by hand, viewed and edited on a detail page, and deleted with optional removal of the plan file from disk. Every completed planning session automatically registers its final task file through `POST /api/plans` before its agent exits.

## Agent Harness Configuration

Commands are defined **once** in `.agent/commands/tasks/`. Each harness directory holds only a
thin pointer to them — never a second copy of a command.

| Harness | Pointer files |
| --- | --- |
| Claude Code | `.claude/commands/tasks/plan.md`, `.claude/commands/tasks/do-task.md` |
| Codex | `.agents/skills/plan/SKILL.md`, `.agents/skills/do-task/SKILL.md` |

Root pointer files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`) do one thing: send the agent here.
Project knowledge belongs in this file, not in them.
