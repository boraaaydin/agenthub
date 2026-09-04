# Remote access settings with a Tailscale method and console-driven setup

---
**Execution Guidelines**: Before starting this task, ensure you've read `.agent/commands/tasks/do-task.md` (if not already read in this session). This file contains essential guidelines on how to properly execute tasks, including dependency checking, verification steps, and archival procedures.

**Application-specific documentation**: This task targets the root application, so read `.agent/PROJECT_DOCUMENT.md` before starting. There is no `apps/` directory in this repository; the project document at `.agent/PROJECT_DOCUMENT.md` is the application document for this task.

When this task file is read standalone, the agent should:
1. Check if `do-task.md` has been read in the current session
2. If not, read it first to understand the execution workflow
3. Read `.agent/PROJECT_DOCUMENT.md` before starting the task
4. Then proceed with this specific task
---

## Description

From GitHub issue #32: AgentHub should be reachable from outside the home network. Remote access
methods are configured under **Settings**, the model is built so more methods can be added later,
and exactly one method is implemented now: **Tailscale**.

Three parts:

1. **An extensible remote-access method model.** A code-defined catalog of methods
   (`tailscale` only for now) plus a per-method `enabled` flag persisted in `data/settings.json`
   under a new `remoteAccess` key. Adding a second method later (Cloudflare Tunnel, ngrok, …) must
   not require a schema change or a data migration.
2. **A `Settings → Remote access` page.** It detects whether the Tailscale CLI is installed and
   whether the machine is connected to a tailnet, and — when connected — shows the copyable URLs
   this AgentHub instance can be reached at from another device on the tailnet.
3. **Console-driven setup.** When Tailscale is missing or not connected, the page offers
   **Install Tailscale** / **Connect** actions. Each opens a real PTY session in `/console` running
   an allowlisted setup command, so the user watches installation output live, can answer `sudo`
   password prompts, and can click the `tailscale up` authentication URL from the terminal.

Access control is deliberately **out of scope**: the tailnet is private, so no login, token, or IP
allowlist is added. The page states this explicitly instead.

## Application

Root application (`agenthub`)

## GitHub Issue

- Issue #32

Decisions confirmed with the user while planning:

- **Scope**: status detection + guidance **plus** console/PTY-driven install and connect actions.
  Not a server-side "full management" toggle that runs `tailscale up/down` behind an API call.
- **Auth**: none. The existing "localhost-only, no auth" stance is kept and the tailnet is trusted.
  No middleware, no IP range check, no `tailscale whois` identity check.
- **Settings model**: a generic, extensible method list — not a bare `tailscale` config block.

Planning findings (verified in the code, no need to re-investigate):

- **No server binding change is needed.** `server.ts:70` calls `httpServer.listen(port)` with no
  host argument, so Node already listens on every interface (including the `100.x.y.z` Tailscale
  address). Remote access works as soon as Tailscale is up. Do **not** add a `HOST` option; just
  surface the fact on the page.
- The custom server and the Next.js server components run in the **same process**, so a server
  component can read `process.env.PORT` to build the remote URL.

## Dependencies

None - This task is independent

## Context

### Where the pieces live

- `src/lib/settings-store.ts` (159 lines) — `Settings`, `defaultSettings()`, `parseDocument()`,
  `settingsDetails()` (the `PUT` validator), `readSettings()`, `saveSettings()`, plus
  `SettingsValidationError` / `SettingsStoreError`. All four are the pattern to extend; note the
  `writeQueue` serialization and the "missing key falls back to the default" behaviour in
  `parseDocument`.
- `src/lib/settings-prompts.ts`, `src/lib/agents.ts` — the two existing **client-safe code-defined
  catalogs** (`as const` array + derived id union + `is…Id()` guard + `get…()` lookup). The new
  remote-access catalog must follow this exact shape.
- `src/app/settings/layout.tsx`, `src/app/settings/settings-nav.tsx` — the settings shell and its
  left navigation, built from a `destinations` array.
- `src/app/settings/page.tsx` + `settings-form.tsx` — a `force-dynamic` server page that reads the
  store and hands it to a client form which `PUT`s `/api/settings`; the closest precedent for the
  new page.
- `src/app/api/settings/route.ts` — `GET` / `PUT`; `PUT` delegates all validation to
  `saveSettings` → `settingsDetails`. Reuse it; do **not** add a second settings route.
- `src/lib/task-file.ts` — the `import "server-only";` precedent for a module that must never reach
  the browser bundle.
- `src/lib/agent-protocol.ts` (~120 lines) — `SessionSummary`, `ClientMessage`, `ServerMessage`,
  and the `isClientMessage()` runtime validator shared by client and server. Every field arriving
  over the socket is validated here.
- `server/session-registry.ts` (~160 lines) — `SessionRegistry.create(agent, cwdInput, cols, rows, autoClose?, initialPrompt?, execution?)`:
  `MAX_SESSIONS = 12`, `validateDirectory()`, `spawn()` from `node-pty`, the `onData` →
  `keepRecentOutput` buffer, and the `onExit` → `autoClose` handling. `list()` projects sessions to
  `SessionSummary`.
- `server/agents.ts` — `getAgentCommand()`, the server-only agent-id → `{ command, args }` map. The
  new setup-command map is its sibling.
- `server.ts` (~200 lines) — `handleClientMessage()` switch, `toSummary()`, `broadcastSessions()`.
- `src/app/console/agent-console.tsx` (**548 lines — the 600-line limit is close**) — owns
  `startSession()`, the `initial…Ref` search-param refs (`useRef(searchParams.get("…"))`), the
  `usePlanRun` / `useTaskRun` hook calls, and `const activeAgent = activeSession ? getAgent(activeSession.agent) : null;`
  at line 225.
- `src/app/console/use-plan-run.ts` — the template for "read a `/console?…` search param, start a
  session once the socket and terminal are ready, then `router.replace('/console')`".
- `src/app/console/session-sidebar.tsx` — reads `getAgent(session.agent)`,
  `AGENT_ACCENT_CLASSES[session.agent]`, and `<AgentLogo agent={session.agent} />` per row.
- `src/app/console/agent-logo.tsx` — a `switch (agent)` with an exhaustiveness `never` check at the
  end; adding a non-agent session kind must not break that check.

### Documentation

`.agent/PROJECT_DOCUMENT.md` describes the settings store contents, the repository structure, and
the delivered session capabilities. All three need the remote-access additions. Its **Open
decisions** section still lists `Auth: none (localhost-only) vs. a shared token.` — that decision is
now resolved for this feature and should be recorded.

## Acceptance Criteria

### Method catalog and persisted settings

- [ ] A new client-safe `src/lib/remote-access.ts` defines the method catalog in the style of
      `src/lib/agents.ts`: a `REMOTE_ACCESS_METHODS` `as const` array holding exactly one entry
      today (`{ id: "tailscale", label: "Tailscale", … }`), the derived `RemoteAccessMethodId`
      union, an `isRemoteAccessMethodId()` guard, and a `getRemoteAccessMethod()` lookup.
- [ ] The same module defines the setup-action catalog: `tailscale-install` and
      `tailscale-connect`, each carrying its `methodId` and a user-facing label, with a
      `RemoteAccessActionId` union and an `isRemoteAccessActionId()` guard.
- [ ] `Settings` gains `remoteAccess: { methods: { id: RemoteAccessMethodId; enabled: boolean }[] }`.
      `defaultSettings()` returns every catalog method with `enabled: false`.
- [ ] `parseDocument()` tolerates every shape a `data/settings.json` written before this task can
      have: a missing `remoteAccess` key, a missing `methods` array, and entries for methods that
      are not in the catalog (silently dropped). Catalog methods missing from the file are filled in
      as `enabled: false`. A `remoteAccess` value of the wrong **type** still throws
      `SettingsStoreError`, matching how the other keys behave.
- [ ] `settingsDetails()` validates a `remoteAccess` update: it must be an object with a `methods`
      array of `{ id, enabled }` entries, every `id` a known method with no duplicates and every
      `enabled` a boolean, otherwise `SettingsValidationError` with a readable message. `PUT
      /api/settings` accepts a body carrying only `remoteAccess` and leaves the agent and prompt
      settings untouched.
- [ ] No data migration and no new JSON file: existing `data/settings.json` files keep working
      unchanged.

### Tailscale status detection

- [ ] A new server-only `src/lib/tailscale.ts` (with `import "server-only";`) exports a
      `readTailscaleStatus()` returning a discriminated union covering, at minimum:
      `{ state: "not-installed" }`, `{ state: "needs-login" }`, `{ state: "stopped" }`,
      `{ state: "connected"; hostname; dnsName; ipv4 }`, and `{ state: "unknown"; message }`.
- [ ] The CLI binary is located by trying, in order: `process.env.TAILSCALE_CLI` when set,
      `tailscale` on `PATH`, `/opt/homebrew/bin/tailscale`, `/usr/local/bin/tailscale`, and
      `/Applications/Tailscale.app/Contents/MacOS/Tailscale`. None found ⇒ `not-installed`.
- [ ] Status comes from `tailscale status --json`, mapping `BackendState` (`Running`, `Stopped`,
      `NeedsLogin`, `NeedsMachineAuth`, `Starting`, `NoState`) to the union above and reading
      `Self.HostName`, `Self.DNSName` (trailing dot stripped), and the first IPv4 entry of
      `Self.TailscaleIPs`.
- [ ] The subprocess call has a timeout (~5s) and every failure path — spawn error, non-zero exit,
      timeout, unparsable JSON — resolves to `not-installed` or `unknown` with a message. It never
      throws out of `readTailscaleStatus()` and never hangs the page render.
- [ ] The module is never imported from a client component; `pnpm build` proves it.

### Settings → Remote access page

- [ ] `/settings/remote-access` exists, is `force-dynamic`, and appears in the settings left
      navigation as **Remote access** (after `Agents`, before or after the prompt entries — pick one
      and keep the nav's existing active-state styling).
- [ ] The page lists the catalog methods, each with an **Enabled** toggle saved through
      `PUT /api/settings` by a client component modelled on `settings-form.tsx` (submitting state,
      success message, error message, no full page reload).
- [ ] The Tailscale card shows the detected state in plain language, with a distinct rendering for
      each of: not installed, installed but stopped / needs login, connected, and unknown/error.
- [ ] When connected, the card shows the reachable URLs built from `process.env.PORT ?? "3000"` —
      `http://{dnsName}:{port}` and `http://{ipv4}:{port}` — each with a copy-to-clipboard control
      that reports success, and the tailnet hostname.
- [ ] When not installed, the card shows an **Install Tailscale** action; when installed but not
      connected, a **Connect** action. Both are links into the console (see below) and are hidden in
      the states where they make no sense (no `Connect` when already connected).
- [ ] The card carries a short security note: AgentHub has **no authentication**, so anyone who can
      reach the port can drive the agents — the tailnet is the only boundary, and the server listens
      on every network interface, not only on the Tailscale one.
- [ ] A **Refresh status** control re-runs detection (a client button calling `router.refresh()` is
      enough) so the user can return from a console session and see the new state.
- [ ] The page renders without crashing when `data/settings.json` is unreadable and when the
      Tailscale probe fails, degrading to an inline error like `settings/page.tsx` does.

### Console setup sessions

- [ ] The browser can start a setup session **only by action id**. A raw command string from the
      client is never accepted or executed anywhere.
- [ ] `ClientMessage` gains `{ type: "start-setup"; action: RemoteAccessActionId; cols; rows }` and
      `isClientMessage()` validates `action` with `isRemoteAccessActionId()` and the dimensions with
      the existing `isDimension()` helper.
- [ ] `SessionSummary` distinguishes the two kinds — e.g. a `kind: "agent" | "setup"` discriminant
      where an agent session carries `agent: AgentId` and a setup session carries
      `action: RemoteAccessActionId` — and every existing reader (`session-sidebar.tsx`,
      `agent-console.tsx:225`, `toSummary()` in `server.ts`, `SessionRegistry.list()`) narrows
      correctly with no `as` casts and no fake agent id.
- [ ] A new server-only `server/setup-commands.ts` maps each action id to `{ command, args }`,
      resolved per `process.platform`:
      - `tailscale-install` on darwin: `brew install --cask tailscale-app`
      - `tailscale-install` elsewhere: the official `curl -fsSL https://tailscale.com/install.sh | sh`
      - `tailscale-connect`: `tailscale up` using the binary path resolved the same way the status
        module resolves it
      Commands that need a shell run through `/bin/sh -lc "…"` so `sudo` prompts and pipes behave.
- [ ] `SessionRegistry` grows a `createSetup(action, cols, rows)` that shares the existing spawn /
      buffer / `onExit` plumbing with `create()` (extract a private helper — do not copy the body),
      honours `MAX_SESSIONS`, and runs in the user's home directory (`os.homedir()`), bypassing
      `validateDirectory` since no project is involved.
- [ ] Setup sessions do **not** auto-close: after the command exits, the session stays in the list
      with its scrollback until dismissed, so the user can read the result.
- [ ] `server.ts` handles `start-setup` exactly like `start` — `started` reply on success, `error`
      reply with the thrown message on failure, then `broadcastSessions()`.
- [ ] The console sidebar renders a setup session with its action label (e.g. `Install Tailscale`)
      and a neutral icon and accent, never an agent logo, and its `Dismiss` label is still
      meaningful. The terminal header and any other place that shows the agent name handles a setup
      session without rendering `undefined`.
- [ ] A setup session's prompt form is not offered: typing goes to the terminal (the existing
      xterm input path already writes to the PTY, which is what `sudo` and `tailscale up` need), and
      the "send prompt" control is hidden or disabled for `kind: "setup"`.
- [ ] `/console?setup={actionId}` starts the matching setup session once, through a new
      `src/app/console/use-setup-run.ts` modelled on `use-plan-run.ts` — it waits for `connected`
      and `terminalReady`, guards with a `started` ref, rejects an unknown action id with an inline
      error, and `router.replace("/console")` afterwards so a reload does not re-run it. Unlike the
      plan/task hooks it must **not** require a saved project.
- [ ] The Remote access page's actions link to those URLs, so the whole flow is: Settings → click
      **Install Tailscale** → console opens with the install running live → user watches it, enters
      the `sudo` password if asked → returns to Settings → **Refresh status** → **Connect** → clicks
      the auth URL printed in the terminal → **Refresh status** shows the tailnet URLs.

### General

- [ ] No authentication, middleware, or request-origin check is added anywhere.
- [ ] `server.ts` still calls `httpServer.listen(port)` unchanged.
- [ ] No change to the plan/task flows, workitems, tasks, projects, logs, lifecycle log, or the
      existing prompt settings pages.
- [ ] No new runtime dependency in `package.json`.
- [ ] No unused imports or variables; `pnpm lint` is clean.
- [ ] Every touched file stays under 600 lines. `agent-console.tsx` is already at 548 — keep the new
      logic in `use-setup-run.ts` and in the sidebar, and if the file still crosses 600, extract an
      existing block (the new-session controls are the obvious candidate) rather than shrinking the
      feature.
- [ ] `.agent/PROJECT_DOCUMENT.md` is updated: the `data/settings.json` description gains the
      `remoteAccess` method list; the repository-structure block gains
      `src/lib/remote-access.ts`, `src/lib/tailscale.ts`, `server/setup-commands.ts`,
      `src/app/settings/remote-access/`, and `src/app/console/use-setup-run.ts`; the delivered
      capabilities gain the Remote access page and console setup sessions; and the **Open
      decisions** auth line records that remote access ships with no authentication, relying on the
      tailnet.

## Technical Notes

- Read `.agent/PROJECT_DOCUMENT.md` first and heed its Next.js caution: the installed Next.js
  (16.3.4) is newer than most training data — check `node_modules/next/dist/docs/` before writing
  framework-level code. This task needs only ordinary server/client components, one `PUT` on an
  existing route handler, and custom-server code.

- **Settings shape.** Prefer storing the array in full rather than a partial record, so the file
  stays readable:

  ```jsonc
  {
    "taskAgent": "codex",
    "planAgent": "codex",
    "remoteAccess": { "methods": [{ "id": "tailscale", "enabled": true }] }
  }
  ```

  Normalize on read: start from `defaultSettings().remoteAccess`, then overlay the entries from the
  file whose `id` passes `isRemoteAccessMethodId`. That single rule delivers all three tolerance
  requirements (missing key, missing entries, unknown entries) at once.

- **Status probing.** Use `execFile` from `node:child_process` wrapped in `promisify`, with
  `{ timeout: 5000, maxBuffer: 1_000_000 }`. Binary discovery: try `execFile(candidate, ["version"])`
  and take the first candidate that exits 0; cache the resolved path in a module-level variable for
  the process lifetime, but re-probe when the cached path stops working so the page updates right
  after an install without a server restart.

- **`tailscale status --json` fields that matter.** `BackendState` is the primary signal.
  `Self.DNSName` looks like `"my-mac.tailnet-name.ts.net."` — strip the trailing dot.
  `Self.TailscaleIPs` is an array holding an IPv4 (`100.x.y.z`) and usually an IPv6; pick the first
  entry containing no `:`. `Self.Online` is *not* a reliable readiness signal on its own; do not
  gate the "connected" state on it. Treat any `BackendState` other than the six listed above as
  `unknown` rather than crashing on it.

- **Homebrew cask name.** `brew install --cask tailscale-app` is the current cask for the macOS GUI
  app; it was previously named `tailscale`. Keep the exact string in **one** place in
  `server/setup-commands.ts` so it is a one-line fix if Homebrew renames it again. The session runs
  in a visible terminal, so a wrong cask name surfaces to the user as ordinary `brew` output rather
  than as a silent failure — do not add fallback-chaining logic.

- **Why a PTY and not a streamed `child_process`.** `sudo` will not read a password without a TTY,
  and `tailscale up` prints an interactive authentication URL. Both are exactly what the existing
  `node-pty` session model already handles — reuse it, do not add a second execution path.

- **Protocol change is the risky part.** Do the `SessionSummary` discriminant first and let the
  type-checker find every reader; `pnpm build` must be clean before the UI work starts. Keep
  `AgentLogo`'s `never` exhaustiveness check intact by never passing it a setup session — branch in
  the sidebar on `session.kind` instead of widening `AgentLogo`'s prop type.

- **Do not** introduce an `agent: "shell"` pseudo-agent in `src/lib/agents.ts`. It would leak into
  the agent picker, the settings defaults, and `server/agents.ts`.

- **Do not** run any Tailscale command from a route handler or server action; every command a user
  triggers goes through a console session so its output is visible.

- Do not comment on or close GitHub issue #32 as part of implementation; close-out is handled by
  `.agent/commands/tasks/do-task-post.md`.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Manual: with `pnpm dev` running, open `/settings` and confirm **Remote access** is in the left
      nav and that the existing Agents and prompt pages are unchanged.
- [ ] Manual: on `/settings/remote-access`, toggle Tailscale **Enabled** on, reload, and confirm the
      state persisted and `data/settings.json` now carries `remoteAccess.methods`.
- [ ] Manual: confirm the agent and prompt settings in `data/settings.json` survived that save
      unchanged.
- [ ] Manual: temporarily point `TAILSCALE_CLI` at a nonexistent path and reload — the card reports
      **not installed** and offers **Install Tailscale**; the page does not error.
- [ ] Manual: with Tailscale actually installed and connected, the card shows the tailnet hostname
      and both URLs, the copy control works, and no **Connect** action is offered.
- [ ] Manual: click **Connect** from a disconnected state, confirm `/console` opens a session
      labelled `Connect` (not an agent name) running `tailscale up`, that its output streams live,
      that typing reaches the process, and that after it exits the session stays listed with its
      scrollback until dismissed.
- [ ] Manual: reload `/console` after the redirect and confirm the setup session is not started a
      second time.
- [ ] Manual: visit `/console?setup=not-a-real-action` and confirm an inline error appears and no
      session starts.
- [ ] Manual: confirm agent sessions (a plan session from a workitem's **Create task** and a task
      execution session) still start, display their agent logo and label, and keep their prompt
      form.
- [ ] Manual: from a second device on the tailnet, open the URL shown on the page and confirm the
      app loads **and** the console terminal connects (the WebSocket upgrade must work over the
      tailnet address, not only over `localhost`).
- [ ] Manual: hand-edit `data/settings.json` to contain `"remoteAccess": { "methods": [{ "id": "ngrok", "enabled": true }] }`
      and confirm the page loads with Tailscale disabled and the unknown entry dropped on the next
      save.
