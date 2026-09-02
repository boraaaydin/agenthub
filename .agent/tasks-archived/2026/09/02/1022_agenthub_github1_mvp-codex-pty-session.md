# MVP: Run the Codex CLI in a chosen directory from the browser

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

Build the first working MVP of AgentHub: a single-page web UI that lets the user

1. type a **working directory path** into an input field,
2. type a prompt into a **textarea** and submit it with a **button**,
3. watch the **Codex CLI's output stream live below the textarea**.

The Codex CLI process is spawned inside a pseudo-terminal (`node-pty`) rooted at the given
path and **stays alive between prompts**, so follow-up prompts continue the same
conversation rather than starting a new one. Output is streamed to the browser over a
WebSocket and rendered with **xterm.js**, so ANSI colors, spinners and cursor movement
appear exactly as they would in a terminal.

Scope for this MVP is deliberately narrow: **only the `codex` CLI** (agent selection for
Claude Code and others comes later) and **one session at a time** (the multi-session
registry comes later, but the server-side data structures should not make it hard to add).

## Application

Root application (`agenthub`) — single Next.js app in `src/`. No `apps/` subdirectory exists.

## GitHub Issue

- Issue #1 ("mvp")

Original request (Turkish): a path input; the AI agent runs in that path; a textarea and a
button; what is typed in the textarea is run through the Codex CLI; the CLI's replies are
visible below the textarea.

## Dependencies

None - This task is independent

## Context

### Decisions confirmed with the user before planning

| Question | Decision |
| --- | --- |
| Architecture | `node-pty` + WebSocket, via a custom Node server hosting Next.js — the target architecture from `PROJECT_DOCUMENT.md`, not a one-shot `codex exec` + SSE shortcut |
| Session continuity | Persistent — the PTY process stays alive; follow-up prompts are written into the same running session |
| Output rendering | `xterm.js` terminal (`@xterm/xterm` + `@xterm/addon-fit`), not a plain `<pre>` with ANSI stripped |

### Why a PTY is required

The Codex CLI detects whether it is attached to a real terminal. Spawned through plain
`child_process`, it buffers its output and may refuse interactive mode entirely. `node-pty`
gives it a pseudo-terminal, so output arrives unbuffered and in real time.

A plain Next.js Route Handler cannot hold a long-lived bidirectional connection open, which
is why a custom Node server process hosts both Next.js and the WebSocket endpoint.

### Current state of the repository

- `src/app/` holds the untouched `create-next-app` starter: `layout.tsx`, `page.tsx`,
  `globals.css`.
- `package.json` has only `next` 16.3.4, `react` / `react-dom` 19.2.8 plus dev tooling.
  **None** of `node-pty`, a WebSocket library, or `@xterm/*` is installed yet.
- Package manager is **pnpm 10.6.5** — use `pnpm add`, never `npm install`.
- The `codex` CLI is installed and on `PATH` (verified: `codex-cli 0.151.0`).

### Next.js version caution

The installed Next.js (16.3.4) is newer than most agents' training data and contains
breaking changes. **Before writing any Next.js code or the custom server, read**:

- `node_modules/next/dist/docs/01-app/02-guides/custom-server.md` — the current, correct way
  to host Next.js inside your own Node server
- `node_modules/next/dist/docs/01-app/02-guides/self-hosting.md` — for how `next build` /
  `next start` interact with a custom server

Do not write the custom server from memory. The `<!-- BEGIN:nextjs-agent-rules -->` block in
`AGENTS.md` is tool-managed by `next dev` — leave it in place.

## Acceptance Criteria

- [ ] `node-pty`, a WebSocket library (`ws`), and `@xterm/xterm` + `@xterm/addon-fit` are
      installed with `pnpm add` (plus `@types/ws` as a dev dependency).
- [ ] A custom Node server hosts both the Next.js app and a WebSocket endpoint; `pnpm dev`
      and `pnpm start` run through it, and the app is reachable in the browser as before.
- [ ] The UI (a single page) shows: a **working directory path input**, a **prompt
      textarea**, a **submit button**, and a **terminal output area directly below the
      textarea**.
- [ ] Submitting a prompt while no session exists starts a `codex` process inside a PTY whose
      working directory is the path from the input, then writes the prompt into it.
- [ ] Submitting a **follow-up** prompt writes into the **same** running process — the
      conversation continues; no second process is spawned and the path input is ignored (and
      visibly locked/disabled) while a session is running.
- [ ] Output from the PTY appears in the browser **live, token by token**, with ANSI colors
      and spinners rendered correctly by xterm.js — not as escape-code garbage.
- [ ] An invalid path (does not exist, or is not a directory) is rejected with a clear error
      message in the UI instead of crashing the server.
- [ ] A visible **stop/reset** control kills the PTY process and lets the user start a new
      session with a different path.
- [ ] Reloading the browser tab reconnects to the still-running session and replays recent
      scrollback rather than showing an empty screen.
- [ ] Killing the browser tab does not leave orphaned `codex` processes when the server exits
      (PTY processes are cleaned up on server shutdown).
- [ ] `pnpm build` passes.
- [ ] `pnpm lint` passes with no errors.

## Technical Notes

### Server

- Create a custom server entry (e.g. `server.ts`, compiled/run per the bundled Next.js
  custom-server guide) that:
  - boots the Next.js request handler,
  - attaches a `ws` WebSocket server on the same HTTP server, on a dedicated path such as
    `/api/agent-socket`,
  - keeps a **session registry** — a `Map<sessionId, { pty, agent, cwd, buffer }>` — even
    though the MVP only ever holds one entry. Shaping it as a map now avoids a rewrite when
    multi-session support lands.
- Spawn with `node-pty`'s `spawn('codex', [], { name: 'xterm-color', cols, rows, cwd, env })`.
  Pass the terminal size reported by the client so xterm.js and the PTY agree; handle
  `resize` messages from the client.
- Keep a **rolling output buffer** per session (cap it — e.g. the last ~200 KB or a fixed
  number of chunks) and replay it to a client that connects to an existing session. Do not
  let the buffer grow unbounded.
- Validate the path server-side before spawning: resolve it, then check it exists and is a
  directory (`fs.promises.stat`). Never trust the client-supplied path. Reject with a typed
  error message over the socket.
- Define a small, explicit message protocol in a shared types file, e.g.
  - client → server: `{ type: 'start', cwd }`, `{ type: 'input', data }`,
    `{ type: 'resize', cols, rows }`, `{ type: 'stop' }`
  - server → client: `{ type: 'output', data }`, `{ type: 'status', state }`,
    `{ type: 'error', message }`, `{ type: 'exit', code }`
- Register cleanup on `SIGINT` / `SIGTERM` and on server close: kill every PTY in the
  registry so no orphaned `codex` process survives.

### Client

- The xterm.js terminal must be created **client-side only** — it touches `window` and
  `document`. Use a `'use client'` component and load the terminal in an effect (or a
  dynamic import with SSR disabled); do not import `@xterm/xterm` at module scope in a
  server-rendered path.
- Import the xterm stylesheet (`@xterm/xterm/css/xterm.css`) so the terminal renders
  correctly; wire `@xterm/addon-fit` and re-fit on container resize, sending a `resize`
  message to the server on each fit.
- Submitting the prompt should write the textarea content followed by a newline into the
  session, then clear the textarea. Prompt submission is what "sends" it to Codex.
- Keep the layout in the order the issue asks for: path input on top, textarea + button, then
  the terminal directly underneath.
- Style with Tailwind CSS v4, matching whatever conventions the existing `globals.css` sets.

### Pitfalls

- **`node-pty` is a native module.** It needs a rebuild against the local Node version; if
  install or runtime fails, that is expected friction — resolve it (correct Node version /
  build toolchain), do not silently fall back to `child_process`, since that defeats the
  entire point of the task.
- Next.js **cannot** bundle `node-pty` or `ws` into a Route Handler or Server Component —
  they belong to the custom server process only. Never import them from anything under
  `src/app/`.
- Do not `JSON.stringify` raw PTY output carelessly — it contains control characters. Send
  output chunks as-is in a string field and let xterm.js interpret them.
- Do not add agent selection (Claude Code etc.), a multi-session sidebar, auth, or on-disk
  session persistence in this task. They are explicitly out of MVP scope.
- Keep every touched file under the 600-line rule enforced by `do-task-post.md`; split the
  server into small modules (`server.ts`, `session-registry.ts`, `protocol.ts`) rather than
  one large file.

### Follow-up documentation

After the implementation works, update `.agent/PROJECT_DOCUMENT.md`:
- move the now-installed dependencies out of the "Not yet installed" note into the tech stack,
- record the new commands / custom-server entry point under "Commands",
- note the resolved open decision (session persistence remains in-memory only).

## Verification

- `pnpm build` completes with no errors (this also type-checks the app).
- `pnpm lint` passes; fix any reported errors rather than suppressing them.
- Manual check with `pnpm dev`:
  1. Enter a valid project path, send a prompt, and confirm Codex output streams live with
     colors intact.
  2. Send a second prompt and confirm it continues the same conversation (no new process,
     the agent remembers the first prompt).
  3. Reload the tab and confirm the session reconnects with scrollback replayed.
  4. Enter a nonexistent path and confirm a clear error appears instead of a crash.
  5. Press stop, then start a new session at a different path.
  6. Stop the server and confirm no `codex` process is left behind (`pgrep -fl codex`).
