# Add the Pi coding agent as a selectable agent

---
**Execution Guidelines**: Before starting this task, ensure you've read `.agent/commands/tasks/do-task.md` (if not already read in this session). This file contains essential guidelines on how to properly execute tasks, including dependency checking, verification steps, and archival procedures.

**Application-specific documentation**: This repository is a single application; there is no `apps/{APP_NAME}/` directory. Read `.agent/PROJECT_DOCUMENT.md` before starting — it carries the project's purpose, target architecture, tech stack and verification commands.

When this task file is read standalone, the agent should:
1. Check if `do-task.md` has been read in the current session
2. If not, read it first to understand the execution workflow
3. Read `.agent/PROJECT_DOCUMENT.md` before starting the task
4. Then proceed with this specific task
---

## Description

AgentHub currently offers two selectable CLI agents: Codex and Claude Code. Add a third one — the
**Pi coding agent** (`pi`, npm package `@earendil-works/pi-coding-agent`) — so it can be chosen for
a new console session and as the global Task or Plan agent in settings.

This is a catalog extension only. No new dependency, no store migration, no protocol change: the
agent catalog is code-defined, and everything downstream (PTY spawn, WebSocket protocol, settings
validation, plan flow) is already driven by the `AgentId` union.

## Application

Root application (`agenthub`)

## Dependencies

None - This task is independent

## Context

The agent catalog is defined in exactly two places and consumed everywhere else through the
`AgentId` type:

- `src/lib/agents.ts` — client-safe `AGENTS` array (`{ id, label }`), `AgentId`, `DEFAULT_AGENT_ID`,
  `isAgentId()`, `getAgent()`.
- `server/agents.ts` — server-only `AGENT_COMMANDS: Record<AgentId, { command, args }>`, consumed by
  `getAgentCommand()`, which appends a non-empty initial prompt as the last CLI argument.

Because `AGENT_COMMANDS` is a `Record<AgentId, …>` and `AgentLogo` ends with a `never` exhaustiveness
check, adding an id to `AGENTS` makes both files fail to compile until they are updated — that is the
intended safety net, not an obstacle.

Consumers that need no change (they already iterate `AGENTS` or accept any `AgentId`):

- `src/app/console/agent-console.tsx` — the new-session agent `<select>` maps over `AGENTS`.
- `src/app/settings/settings-form.tsx` — both Task agent and Plan agent `<select>`s map over `AGENTS`.
- `src/lib/settings-store.ts`, `src/lib/agent-protocol.ts`, `src/app/console/use-plan-run.ts` — all
  validate via `isAgentId()`.
- `server/session-registry.ts`, `server.ts` — spawn whatever `getAgentCommand()` returns.

Consumers that **do** need a change:

- `src/app/console/agent-logo.tsx` — a `switch` over `AgentId` returning an inline 16×16 SVG per
  agent, ending in a `never` exhaustiveness check that throws for unhandled ids.
- `src/app/console/session-sidebar.tsx:59` — the per-session accent color is a two-way ternary:
  `session.agent === "claude" ? "text-orange-700" : "text-emerald-700"`. With three agents this
  silently gives Pi the Codex accent, so it must become a per-agent lookup.

The `pi` CLI is installed on the development machine (`/opt/homebrew/bin/pi`, v0.84.4). Its usage is
`pi [options] [--] [@files...] [messages...]`: it starts an interactive TUI by default and treats
trailing arguments as the first message, which is the same invocation shape as `codex` and `claude`
already use for the plan flow's composed startup prompt.

Assumptions recorded during planning (confirm only if they turn out to be wrong):

- Pi is **added alongside** Codex and Claude Code; Codex stays `DEFAULT_AGENT_ID`.
- Pi is spawned as a bare `pi` on `PATH` with **no extra flags** — no `--provider`, `--model`, or
  `--thinking` defaults. Model and provider selection stays Pi's own concern (its settings/env).
- The displayed label is `Pi`.

## Acceptance Criteria

- [ ] `src/lib/agents.ts` lists a third agent `{ id: "pi", label: "Pi" }`; `DEFAULT_AGENT_ID` remains
      `"codex"`.
- [ ] `server/agents.ts` maps `pi` to `{ command: "pi", args: [] }`, so `getAgentCommand("pi", prompt)`
      returns `{ command: "pi", args: [prompt] }` for a non-empty prompt and `{ command: "pi", args: [] }`
      without one.
- [ ] `src/app/console/agent-logo.tsx` renders a distinct inline SVG for `pi`, in the same style as the
      existing marks (16×16 `viewBox`, `currentColor`, `aria-hidden`, `className` passthrough), and the
      file still ends with the `never` exhaustiveness check.
- [ ] `src/app/console/session-sidebar.tsx` resolves the accent class from the session's agent id
      through a lookup that covers all three agents (Claude keeps `text-orange-700`, Codex keeps
      `text-emerald-700`, Pi gets its own distinct Tailwind class such as `text-violet-700`), with no
      dynamically composed class names.
- [ ] The console new-session agent dropdown offers Codex, Claude Code, and Pi; selecting Pi and
      submitting a first prompt starts a live PTY session whose sidebar entry shows the Pi label and
      Pi logo.
- [ ] Settings' Task agent and Plan agent dropdowns offer Pi, and saving Pi persists
      `"pi"` in `data/settings.json` and reloads without a validation error.
- [ ] With Pi saved as the Plan agent, starting a plan from a task launches a `pi` session in the
      task's project directory with the composed planning prompt as its first message.
- [ ] `.agent/PROJECT_DOCUMENT.md` is updated so the agent enumerations reflect three agents — at least
      the Purpose paragraph, Core Requirement 1, the architecture diagram's `claude / codex CLI process`
      line, and the "Agent selection (Codex or Claude Code)" bullet under *Delivered session
      capabilities*.
- [ ] No existing agent's id, label, command, logo, or accent color changes, and no stored settings or
      project/task/plan data needs migrating.

## Technical Notes

- Keep the catalog additions minimal and in the two source-of-truth files; do not introduce a second
  agent list or per-agent branching outside the logo and accent lookups.
- Tailwind v4 requires static class strings. Write the accent lookup as a literal
  `Record<AgentId, string>` (or a `switch`) with full class names — never `text-${color}-700`.
- For the Pi mark, a simple geometric π glyph (two stems under a horizontal bar) drawn with
  `stroke="currentColor"` at `strokeWidth="1.5"` matches the weight of the existing Codex mark; keep it
  inside the same 16×16 `viewBox` so it lines up with the `h-4 w-4` sidebar usage.
- `getAgentCommand()` appends the prompt as a trailing argument without a `--` separator, exactly as it
  does for Codex and Claude Code. Pi parses trailing arguments as the message, so no separator is
  needed for the prompts AgentHub composes; do not add one just for Pi, and do not special-case the
  helper.
- If `pi` is not on the server process's `PATH`, the session fails the same way a missing `codex` or
  `claude` binary does today. That is existing behaviour and is out of scope for this task.
- Watch the 600-line-per-file rule during close-out; all touched files are far below it.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Manual: `pnpm dev`, open `/console`, pick **Pi** with a saved project, send a first prompt, and
      confirm the Pi session streams output live and appears in the sidebar with the Pi label, Pi logo,
      and its own accent color, distinct from a Codex session running beside it.
- [ ] Manual: open `/settings`, set both Task agent and Plan agent to **Pi**, save, reload, and confirm
      the selection persists and `data/settings.json` contains `"pi"`.
- [ ] Manual: with Pi as the Plan agent, start a plan from a task in `/tasks` and confirm a `pi` session
      opens in the project directory with the planning prompt already submitted.
