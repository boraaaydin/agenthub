# Global agent settings page (Task / Plan defaults) and console wiring

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

Add an application-wide **settings** screen that holds the default agent used across *all*
projects. The settings are global, not per project.

1. Define the **agent catalog in code** — a single exported array that is the only source of
   selectable agents. Today it holds exactly one entry: **Codex**.
2. Persist two global settings in a new git-ignored **`data/settings.json`**:
   - **Task agent** (`taskAgent`) — the agent used to run work.
   - **Plan agent** (`planAgent`) — the agent used for planning.
   Both currently default to `codex` and can only be set to `codex`, because that is the only
   entry in the catalog.
3. Add a **`/settings` page** with two select fields (Task and Plan), populated from the code
   catalog, and an explicit **Save** button with inline success/error feedback.
4. Expose the settings through **Route Handlers** at `/api/settings` (`GET` + `PUT`).
5. **Wire the Task agent into the console**: when a session starts, the server reads the
   current Task agent from the settings store and spawns *that* agent's command, instead of
   the currently hard-coded `codex` binary. The console screen also shows which agent it will
   start.

**Scope boundary:** the **Plan** agent is stored and editable but is not consumed anywhere yet
— no planning flow exists. Per-project agent overrides are **out of scope**; these settings
apply to every project. Do not add new agents to the catalog beyond Codex.

## Application

Root application (`agenthub`) — single Next.js app in `src/` plus the custom Node server
(`server.ts`, `server/`). No `apps/` subdirectory exists.

## GitHub Issue

- Issue #5 ("genel ayarlar sayfası")

Original request (Turkish): the user should have a settings page covering all projects; a
default agent is entered for all projects; there are two fields, one for Task (Görev) and one
for Plan; for now `codex` is selectable for both fields; the agent list is defined in code.

## Dependencies

None - This task is independent

## Context

### Decisions confirmed with the user before planning

| Question | Decision |
| --- | --- |
| Where the settings live | A **new git-ignored `data/settings.json`**, with its own `src/lib/settings-store.ts` mirroring the existing `projects-store.ts`. Do **not** add a `settings` key to `data/projects.json`. |
| Whether the defaults are used yet | **Wire the Task agent into the console now** — session start spawns the configured agent instead of a hard-coded `codex`. This touches `server.ts` and `server/session-registry.ts`. |
| Save UX | A dedicated **`/settings` route with an explicit Save button**, reachable from the home page header. No auto-save on change. |

### Current state of the repository

- `src/lib/projects-store.ts` (161 lines) is the model to follow: typed helpers, a serialized
  write queue, `ProjectValidationError` / `ProjectStoreError`, missing file → empty document,
  malformed file → descriptive error.
- `src/app/api/projects/route.ts` and `src/app/api/projects/[id]/route.ts` show the current
  Route Handler conventions in this repo: `export const dynamic = "force-dynamic"`,
  `Response.json(...)`, `RouteContext<"/api/projects/[id]">` for dynamic params, no stack
  traces returned to the client.
- `src/app/page.tsx` (88 lines) is the projects home; its header already holds
  **Open console** and **New project** links — the **Settings** link belongs next to them.
- `src/app/projects/new/page.tsx` (124 lines) is the reference client form: local state,
  inline error paragraph, submit disabled while in flight, `router.replace` on success.
- `src/app/console/page.tsx` is a 5-line server component rendering `<AgentConsole />`.
- `src/app/agent-console.tsx` (319 lines, `"use client"`) owns the console UI and the
  WebSocket wiring. It currently takes **no props**.
- `server/session-registry.ts` (128 lines) hard-codes the agent:
  `spawn("codex", [], { … })`, `agent: "codex"` on `TerminalSession`, and error strings that
  name Codex ("Enter a working directory before starting Codex.").
- `server.ts` handles the `start` client message and calls `sessions.start(message.cwd,
  message.cols, message.rows)`; several of its user-facing strings also name Codex.
- `.gitignore` already ignores the whole `/data/` directory, so `data/settings.json` needs
  **no new ignore rule** — verify, do not add a duplicate.

### Verified constraint: `server-only` must not appear in the settings store

`projects-store.ts` starts with `import "server-only";`. That works only because Next.js
aliases the `server-only` package internally — it is **not** an installed dependency
(`require.resolve("server-only")` fails with `MODULE_NOT_FOUND` from the repo root).

`server.ts` runs under `tsx`, outside the Next.js bundler. If `settings-store.ts` imports
`server-only`, the custom server will **crash at startup**. So:

- `src/lib/settings-store.ts` must **not** import `server-only`.
- `server.ts` must import it with a **relative** path (`./src/lib/settings-store`), the same
  way it already imports `./src/lib/agent-protocol` — do not rely on the `@/*` tsconfig alias
  from the custom server.

### Next.js version caution

The installed Next.js (16.3.4) is newer than most agents' training data. Before writing
Next.js code, read:

- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — current
  Route Handler API, including how to opt out of caching.
- `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md` —
  current `Link` / navigation and refresh APIs.

Do not write these from memory. Leave the tool-managed `<!-- BEGIN:nextjs-agent-rules -->`
block in `AGENTS.md` untouched.

## Acceptance Criteria

### Agent catalog

- [ ] A new module (e.g. `src/lib/agents.ts`) exports the agent catalog as the single source of
      truth, with one entry: Codex (id `codex`, a human label, the command to spawn and its
      arguments).
- [ ] The module exports an `AgentId` type derived from the catalog, a type guard for
      validating an unknown id, and the default agent id.
- [ ] The module is pure data plus helpers: **no `fs`, no `node-pty`, no `server-only`**, so it
      can be imported from a client component, a Route Handler, and `server.ts` alike.
- [ ] Adding a second agent requires editing **only** this array — no change to the settings
      page, the API, the store, or the session registry.

### Settings store

- [ ] `src/lib/settings-store.ts` owns `data/settings.json` and is the only module that reads or
      writes it.
- [ ] The settings document holds `taskAgent` and `planAgent`, both agent ids.
- [ ] A missing `data/settings.json` yields the defaults (both `codex`) without an error and
      without creating the file on read.
- [ ] A malformed or truncated file, or an unknown agent id in the file, raises a descriptive
      error naming the file — it does not silently reset the user's settings.
- [ ] Writes create `data/` if needed and are serialized through the same promise-chain pattern
      used by `projects-store.ts`, so concurrent saves cannot lose an update.

### API

- [ ] `GET /api/settings` returns the current settings.
- [ ] `PUT /api/settings` accepts `{ taskAgent, planAgent }`, validates both against the code
      catalog server-side, persists them, and returns the saved settings.
- [ ] An unknown or missing agent id returns **400** with a readable message and writes nothing.
- [ ] A store failure returns **500** with a readable message; no stack trace reaches the
      client.

### Settings page

- [ ] `/settings` renders the current values with two labelled selects — **Task** and **Plan** —
      whose options are generated from the code catalog (today: a single "Codex" option).
- [ ] A **Save** button submits both fields; it is disabled while the request is in flight so a
      double click cannot fire two writes.
- [ ] Success shows an inline confirmation; a failure shows the server's message inline and the
      user's selections are not lost.
- [ ] Reloading `/settings` shows the saved values, and they survive a dev-server restart.
- [ ] The home page header links to `/settings`, and `/settings` links back to `/`.
- [ ] The page matches the existing visual language (`#f4f6fa` background, centred column,
      rounded-xl controls, sky accent).

### Console wiring

- [ ] Starting a session spawns the command of the **Task agent** read from the settings store
      at start time — not a value captured when the server booted, so a settings change takes
      effect on the next session without restarting the server.
- [ ] The session record carries the agent that was actually started, replacing the hard-coded
      `agent: "codex"` literal type.
- [ ] User-facing messages from the server and registry name the configured agent rather than
      hard-coding "Codex".
- [ ] If the settings file is unreadable or malformed, the start attempt fails with that error
      surfaced to the console user; it does not fall back to a guessed agent and does not crash
      the server process.
- [ ] The console screen shows which agent it will start (label from the catalog).
- [ ] All existing console behaviour is unchanged: path input, prompt send, live output, stop &
      reset, reconnect with scrollback replay.

### Build

- [ ] `pnpm build` passes.
- [ ] `pnpm lint` passes with no errors.

## Technical Notes

### File layout

```
data/settings.json                  # git-ignored, created on first save
src/lib/agents.ts                   # code-defined agent catalog (pure)
src/lib/settings-store.ts           # fs read/write for settings, no server-only
src/app/api/settings/route.ts       # GET, PUT
src/app/settings/page.tsx           # server component: reads store, renders the form
src/app/settings/settings-form.tsx  # "use client" form with the two selects + Save
```

Changed files: `src/app/page.tsx` (Settings link), `src/app/console/page.tsx` (pass the task
agent label down), `src/app/agent-console.tsx` (accept and display it),
`server/session-registry.ts` and `server.ts` (spawn the configured agent).

### Agent catalog shape

Keep the catalog `as const` and derive the id union from it, so the type narrows automatically
when a second agent is added. Each entry needs at least: `id`, `label`, `command`, `args`.
Store only the **id** in `data/settings.json`; never persist the command string — the command
must stay editable in code.

### Settings store

- Follow `projects-store.ts` closely: one exported constant for the file path
  (`path.join(process.cwd(), "data", "settings.json")`), a `readSettings()` / `saveSettings()`
  pair, a dedicated error class, and the module-level write queue.
- Validate ids on read as well as on write, using the catalog type guard — a file written by an
  older build may reference an agent that no longer exists.
- Write the whole document with `JSON.stringify(doc, null, 2)` and a trailing newline, matching
  the projects file.
- Do **not** import `server-only` (see the verified constraint above).

### Route Handlers

- `export const dynamic = "force-dynamic"` — this data is read from disk per request and must
  never be cached or prerendered. Confirm the current syntax in the bundled Route Handler doc.
- Parse the JSON body inside a `try`/`catch` and return 400 on invalid JSON, as
  `api/projects/route.ts` does.
- Validate server-side even though the select can only offer valid values.

### Pages

- `src/app/settings/page.tsx` stays a **server component** that reads the store directly and
  passes the current values into the client form as props — the same split as the home page.
- The form is a small `"use client"` component modelled on `projects/new/page.tsx`: local state
  per field, `PUT` on submit, inline error/success, disabled button while submitting.
- Render both selects by mapping the catalog. Do not hardcode an `<option value="codex">`.
- With a single agent available the selects show one option; that is expected and correct — do
  not add placeholder or "coming soon" entries.
- After a successful save, refresh the server-rendered values rather than leaving a stale page;
  check the linking/navigating doc for the current refresh API.

### Console wiring

- Prefer reading the settings **in `server.ts`** when the `start` message arrives, then passing
  the resolved agent definition into `SessionRegistry.start(...)`. That keeps the registry free
  of filesystem concerns and matches its current parameter-driven shape.
- Update `TerminalSession.agent` from the `"codex"` literal to the catalog's `AgentId`.
- Replace `spawn("codex", [], …)` with the selected entry's `command` and `args`; keep the
  existing `name`, `cols`, `rows`, `cwd` and `env` handling exactly as it is.
- Surface a failed settings read as a `{ type: "error" }` server message to the requesting
  client and return the session state to `idle`, the same path already used for a bad `cwd`.
- Passing the label to the console is a display concern only: `console/page.tsx` reads the store
  (guard it with `try`/`catch` and fall back to the default label) and hands `AgentConsole` a
  string prop. Do **not** import the settings store into the `"use client"` component.

### Pitfalls

- Never import `node-pty`, `ws`, or anything under `server/` into a page or Route Handler.
- Never import `settings-store.ts` (it uses `node:fs`) into a `"use client"` component.
- Do not touch `data/projects.json`, the projects store, or the projects API — the settings
  document is separate.
- Do not add a `.gitignore` entry; `/data/` is already ignored. Confirm with `git status` that
  `data/settings.json` stays untracked.
- Do not introduce per-project agent fields, an agent picker in the console, or multi-session
  support. All out of scope.
- Keep every touched file under the 600-line rule enforced by `do-task-post.md`;
  `agent-console.tsx` is already 319 lines, so add the agent label with minimal new code.

### Follow-up documentation

After the implementation works, update `.agent/PROJECT_DOCUMENT.md`:
- add `src/app/settings/`, `src/app/api/settings/` and `data/settings.json` to the Repository
  Structure section,
- record that the agent catalog lives in code (`src/lib/agents.ts`) and that the global Task /
  Plan agent defaults are persisted in the git-ignored `data/settings.json`,
- note that the console now spawns the configured Task agent instead of a hard-coded `codex`.

## Verification

- `pnpm build` completes with no errors (this also type-checks the app).
- `pnpm lint` passes; fix reported errors rather than suppressing them.
- `git status` shows no `data/` entry.
- Manual check with `pnpm dev`:
  1. Delete `data/settings.json` if present, open `/settings`, and confirm both fields default
     to Codex with no error and nothing crashes.
  2. Save the form; confirm the inline success message and that `data/settings.json` now holds
     `taskAgent` and `planAgent`.
  3. Restart the dev server and confirm `/settings` still shows the saved values.
  4. `PUT /api/settings` with an unknown agent id (e.g. via `curl`) and confirm a 400 with a
     readable message and an unchanged `data/settings.json`.
  5. Corrupt `data/settings.json` by hand; confirm `/settings` reports a clear error instead of
     crashing, and that starting a console session reports the error rather than launching a
     guessed agent. Restore the file afterwards.
  6. Open `/console` and run the full MVP flow — enter a valid path, send a prompt, see live
     output, send a follow-up in the same session, reload the tab and confirm scrollback
     replays, then stop the session — and confirm the header names the configured agent.
  7. Navigate `/` → `/settings` → `/` and `/` → `/console` → `/` without typing URLs by hand.
