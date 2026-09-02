# Add Claude Code as a selectable agent and support multiple concurrent sessions

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

Make **Claude Code** a runnable agent alongside Codex, and let the console hold **several
sessions at once**.

Today AgentHub can only ever run `codex`: the binary is hardcoded in
`server/session-registry.ts`, the registry holds exactly one session under the literal key
`"default"`, and the WebSocket protocol has no notion of *which* agent or *which* session a
message belongs to.

After this task, `/console` lets the user:

1. pick an agent (**Codex** or **Claude Code**) from a dropdown next to the working-directory
   input, before starting a session,
2. run **any number of sessions concurrently** — any agent, any directory, and several
   sessions for the same (agent, directory) pair,
3. see every live session in a **left sidebar** and switch between them; the selected
   session's terminal, scrollback and prompt box are shown on the right.

This delivers core requirements **#1 (agent selection)** and **#4 (multiple sessions)** from
`.agent/PROJECT_DOCUMENT.md`, both deferred out of the MVP.

## Application

Root application (`agenthub`) — single Next.js app in `src/` plus the custom server in
`server.ts` / `server/`. No `apps/` subdirectory exists.

## GitHub Issue

- Issue #6 ("claude agent")

Original request (Turkish): "claude code için agent ekle" — add an agent for Claude Code.

## Dependencies

None - This task is independent

## Context

### Decisions confirmed with the user before planning

| Question | Decision |
| --- | --- |
| Where the agent is chosen | A **dropdown on `/console`**, next to the working-directory input, locked once that session has started |
| Default selection | **Codex** — today's behaviour is preserved for anyone who ignores the dropdown |
| Concurrency | **Multiple concurrent sessions**: any number, any agent, any directory, several per (agent, directory) pair |
| Session scope | **Path-based**, from the console's existing path input. `data/projects.json` stays unwired — that belongs to issue #3 (project detail page) |
| Session UI | **Left sidebar** listing sessions (agent label + directory) with a "New session" button; clicking one shows its terminal |

### Assumptions to work from

- Both CLIs are installed and on `PATH` — verified during planning: `claude` 2.1.258,
  `codex-cli` 0.151.0. Both are spawned **bare** (`claude` / `codex`, no extra flags), exactly
  as `codex` is spawned today.
- A session whose process exits **stays in the sidebar** marked `exited`, keeping its
  scrollback readable, until the user dismisses it with an `×`.
- Sessions stay **in-memory only** — already a settled decision in `PROJECT_DOCUMENT.md`.
  A server restart ends them.

### Current state of the code

- `src/lib/agent-protocol.ts` — single-session message union; no session id, no agent field.
  `{ type: "status"; state }` carries the one session's state.
- `server/session-registry.ts` — `Map<string, TerminalSession>` keyed by the literal
  `"default"`, a boolean `starting` flag, `agent: "codex"` as a literal type, and
  `spawn("codex", [], …)`.
- `server.ts` — routes messages against `sessions.getActiveSession()`; on connect it replays
  the single buffer and sends one `status`.
- `src/app/agent-console.tsx` — 319 lines: one xterm terminal, path input, prompt textarea,
  stop button; hardcoded "Codex" copy throughout.
- `src/app/console/page.tsx` — thin route entry importing `../agent-console`.

### Next.js version caution

The installed Next.js (16.3.4) is newer than most agents' training data. Before writing or
changing Next.js code, read the relevant guide under `node_modules/next/dist/docs/`. Leave the
tool-managed `<!-- BEGIN:nextjs-agent-rules -->` block in `AGENTS.md` in place.

## Acceptance Criteria

- [ ] `/console` shows an **agent dropdown** with `Codex` and `Claude Code`, defaulting to
      `Codex`, next to the working-directory input.
- [ ] Starting a session with `Claude Code` selected spawns the `claude` CLI in a PTY rooted at
      the given directory; output streams live with ANSI colours intact.
- [ ] **Several sessions run at the same time**: a Codex session and a Claude Code session in
      different directories are both alive, both listed, both streaming.
- [ ] Two sessions for the **same agent and the same directory** can coexist and are listed
      separately.
- [ ] A **left sidebar** lists every session with its agent label, working directory and a
      live/exited indicator, plus a **"New session"** button that returns to the start form.
- [ ] Selecting a session in the sidebar shows **that session's** terminal scrollback; a prompt
      submitted while it is selected is written to **that** PTY only.
- [ ] Stopping a session leaves the others untouched; the stopped one becomes `exited`, keeps
      its scrollback readable, and is removed from the list by its `×` control.
- [ ] Reloading the browser tab repopulates the sidebar from the server and replays the
      selected session's scrollback.
- [ ] An invalid path is still rejected with a clear message and leaves no session entry
      behind.
- [ ] Every user-facing "Codex" string is replaced by the selected agent's label — no message
      says "Codex" while a Claude Code session is running.
- [ ] No orphaned `codex` / `claude` processes survive server shutdown.
- [ ] Every touched file stays under the 600-line rule.
- [ ] `pnpm build` passes.
- [ ] `pnpm lint` passes with no errors.

## Technical Notes

### 1. Agent definitions — two new files

- **`src/lib/agents.ts`** (client-safe, **no node imports**): `AgentId = "codex" | "claude"`,
  an ordered `AGENTS` list of `{ id, label }` (`Codex`, `Claude Code`) used by the dropdown,
  the sidebar and every user-facing message, plus `DEFAULT_AGENT_ID = "codex"` and an
  `isAgentId()` guard for protocol validation.
- **`server/agents.ts`** (server-only): maps `AgentId → { command, args }`. Keeps binary names
  out of the client bundle and makes a third agent a one-line addition.

Replace every hardcoded "Codex" in error text and UI copy with the relevant agent's label —
`server.ts` (lines ~91, ~107, ~164), `server/session-registry.ts` (~36, ~104),
`src/app/agent-console.tsx` (~153, ~189, ~224, ~266–267, ~280, ~285, ~292, ~305).

### 2. Protocol — `src/lib/agent-protocol.ts`

Every message gains a session identity. Extend `isClientMessage` to validate the new fields;
reuse the existing `isDimension` helper and add a simple id-shape check.

```ts
type SessionState = "starting" | "running" | "exited";
type SessionSummary = {
  id: string; agent: AgentId; cwd: string; state: SessionState; createdAt: string;
};

// client → server
| { type: "start";   agent: AgentId; cwd: string; cols: number; rows: number }
| { type: "attach";  sessionId: string; cols: number; rows: number }
| { type: "input";   sessionId: string; data: string }
| { type: "resize";  sessionId: string; cols: number; rows: number }
| { type: "stop";    sessionId: string }
| { type: "dismiss"; sessionId: string }   // remove an exited session

// server → client
| { type: "sessions";   sessions: SessionSummary[] }        // full list: on connect + every change
| { type: "started";    session: SessionSummary }           // so the opener can select it
| { type: "scrollback"; sessionId: string; data: string }   // answer to "attach"
| { type: "output";     sessionId: string; data: string }
| { type: "exit";       sessionId: string; code: number }
| { type: "error";      message: string; sessionId?: string }
```

**Delete** the old `{ type: "status"; state }` message — session state now travels inside
`SessionSummary`. Do not keep it alongside the new messages.

### 3. `server/session-registry.ts`

- Key the map by `randomUUID()` instead of the literal `"default"`. Drop `getActiveSession()`
  and the single `starting` flag in favour of: `get(id)`, `list(): SessionSummary[]`,
  `create(agent, cwd, cols, rows)`, `stop(id)`, `dismiss(id)`, `stopAll()`.
- `TerminalSession` gains `agent: AgentId`, `state`, `createdAt`; `agent` is no longer the
  literal type `"codex"`. Spawn through `server/agents.ts`, not a hardcoded `spawn("codex")`.
- `onExit` marks the session `exited` and **keeps** it (with its buffer). `dismiss(id)` is what
  actually deletes an entry.
- Keep `validateDirectory()` and `keepRecentOutput()` as they are — the 200 KB cap now applies
  per session.
- Add a `MAX_SESSIONS` guard (12) so the registry cannot grow without bound; `create` throws a
  clear error past the limit.
- `stopAll()` already iterates every entry, so shutdown cleanup needs no change.

### 4. `server.ts`

- Route each message through `sessions.get(message.sessionId)`; answer with
  `{ type: "error", sessionId }` when the id is unknown or the session has exited.
- Stamp `sessionId` on the `onOutput` / `onExit` broadcasts.
- After **any** registry mutation (create / stop / dismiss / process exit) broadcast the full
  `{ type: "sessions" }` list so every open tab stays in sync.
- On a new WebSocket connection send the session list only. Scrollback is pulled per session by
  `attach`, replacing the current "replay the one buffer on connect" logic (lines 37–47).

### 5. Console UI

`src/app/agent-console.tsx` is already 319 lines and would blow past the 600-line rule, so split
it into colocated files under the route folder (the App Router allows non-`page` files there):

- `src/app/console/page.tsx` — unchanged entry point, import path updated.
- `src/app/console/agent-console.tsx` — layout + orchestration (moved from `src/app/`).
- `src/app/console/session-sidebar.tsx` — session list, live/exited dot, `×` dismiss,
  "New session" button.
- `src/app/console/session-terminal.tsx` — the xterm host.
- `src/app/console/use-agent-socket.ts` — socket lifecycle, reconnect, message dispatch and
  session-list state, lifted out of the two large `useEffect`s at lines 53–174.

Delete the old `src/app/agent-console.tsx` once it has moved — do not leave a duplicate.

**Terminal strategy:** keep **one** xterm `Terminal` instance. On switching sessions, clear it
and replay that session's buffer via `attach` → `scrollback`. This reuses the replay mechanism
already proven for tab reload and avoids the `FitAddon` breakage that hidden (`display:none`)
terminal hosts cause. Background sessions keep streaming into the server-side buffer, so
nothing is lost: `output` messages are written to the terminal only when their `sessionId`
matches the active session.

The start form keeps today's controls (path input, prompt textarea, submit) and adds the agent
`<select>`. The existing `queuedPromptRef` trick — the first prompt is sent once the PTY is up
(`agent-console.tsx:143–146`) — is keyed by the id returned in `started`.

### Pitfalls

- Next.js **cannot** bundle `node-pty` or `ws`. `server/agents.ts` and the registry belong to
  the custom server process only — never import them from anything under `src/app/`.
- `src/lib/agents.ts` is imported by both sides, so it must stay free of node built-ins and of
  `server-only`.
- Do not send raw PTY output through anything that mangles control characters; pass chunks
  through as-is and let xterm.js interpret them.
- Do not wire `data/projects.json` into the console, add per-project task lists, a settings
  page, on-disk session persistence, or auth. Those are issues #3, #4 and #5, and explicitly
  out of scope here.

### Follow-up documentation

After the implementation works, update `.agent/PROJECT_DOCUMENT.md`:
- record that agent selection and multiple concurrent sessions are delivered,
- resolve the open decision "whether the working directory per session is user-selectable" —
  it is, per session,
- add the new files to the Repository Structure block.

## Verification

- `pnpm build` completes with no errors (this also type-checks the app).
- `pnpm lint` passes; fix reported errors rather than suppressing them.
- Manual check with `pnpm dev`:
  1. Start a **Codex** session in a valid path; confirm output streams live with colours.
  2. Without stopping it, start a **Claude Code** session in a different path; both appear in
     the sidebar and both stream.
  3. Start a **second Codex** session in the same path as (1); it is listed separately.
  4. Switch between sessions: each shows its own scrollback, and a follow-up prompt reaches the
     right process only.
  5. Reload the tab: the sidebar repopulates and the selected session replays scrollback.
  6. Enter a nonexistent path: a clear error appears, no crash, no stray session entry.
  7. Stop one session: it turns `exited` with its scrollback intact, `×` removes it, and the
     other sessions keep running.
  8. Stop the server and confirm `pgrep -fl "codex|claude"` shows no orphaned processes.
