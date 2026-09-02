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

Project metadata is persisted separately in a git-ignored `data/projects.json` file. This
survives server restarts; agent sessions remain in-memory only and end when the server restarts.

### Open decisions

- Session persistence across a server restart (in-memory only vs. on disk).
- Whether the working directory per session is user-selectable.
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
├── console/                      # Codex console route
├── projects/                     # Project creation route
└── page.tsx                      # Projects home page
data/                             # Runtime JSON database (git-ignored)
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

## Agent Harness Configuration

Commands are defined **once** in `.agent/commands/tasks/`. Each harness directory holds only a
thin pointer to them — never a second copy of a command.

| Harness | Pointer files |
| --- | --- |
| Claude Code | `.claude/commands/tasks/plan.md`, `.claude/commands/tasks/do-task.md` |
| Codex | `.agents/skills/plan/SKILL.md`, `.agents/skills/do-task/SKILL.md` |

Root pointer files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`) do one thing: send the agent here.
Project knowledge belongs in this file, not in them.
