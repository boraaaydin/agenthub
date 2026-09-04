# Restrict agent sessions to defined paths and lock path management to local access

---
**Execution Guidelines**: Before starting this task, ensure you've read `.agent/commands/tasks/do-task.md` (if not already read in this session). This file contains essential guidelines on how to properly execute tasks, including dependency checking, verification steps, and archival procedures.

**Application-specific documentation**: This repository is a single application; there is no `apps/{APP_NAME}/` directory. Read `.agent/PROJECT_DOCUMENT.md` before starting the task — it contains the tech stack, conventions, and verification steps.

When this task file is read standalone, the agent should:
1. Check if `do-task.md` has been read in the current session
2. If not, read it first to understand the execution workflow
3. Read `.agent/PROJECT_DOCUMENT.md` before starting the task
4. Then proceed with this specific task
---

## Description

AgentHub is now reachable over a Tailscale tailnet with no authentication — the tailnet is the only
boundary. Two gaps follow from that:

1. **Commands can be started anywhere on the filesystem.** The WebSocket `start` message carries an
   arbitrary `cwd`, and the server only checks that the directory exists. Any connected client can
   spawn an agent CLI in `$HOME`, `/`, or any other directory.
2. **A remote client has the same write powers as the local user.** It can create projects and
   applications, edit their paths, change the default project directory, probe arbitrary directories
   through `inspect-directory`, and start the Tailscale setup session, which runs
   `/bin/sh -lc "curl … | sh"`.

This task closes both:

- An agent session may only start in a directory that equals — or lives inside — a **saved project
  path or a saved application path**. This applies to every client, local or remote.
- A **remote** (non-loopback) client may not create, edit, or delete projects and applications, edit
  path-related settings, inspect directories, or start remote-access setup sessions. Remote clients
  keep full read access and can still run console, planning, and task-execution sessions, and can
  still change agent and prompt settings.

## Application

agenthub (repository root — this project has no `apps/` directory)

## GitHub Issue

- Issue #34

## Dependencies

None - This task is independent

## Context

### Where the gaps are today

- `server.ts` handles the WebSocket `start` message and passes `message.cwd` straight into
  `SessionRegistry.create()` (`server/session-registry.ts`).
- `validateDirectory()` at the bottom of `server/session-registry.ts` resolves the path and checks
  `stat().isDirectory()` — nothing else.
- `start-setup` (`server.ts`) calls `SessionRegistry.createSetup()`, which runs the command from
  `server/setup-commands.ts` in `os.homedir()`. On macOS that is
  `brew install --cask tailscale-app` through `/bin/sh -lc`; elsewhere `curl -fsSL … | sh`.
- `POST /api/projects/inspect-directory` (`src/app/api/projects/inspect-directory/route.ts`) accepts
  any absolute path and reports existence plus git repository details for it.
- The project, application, and settings write routes accept path strings from any client.

### Important constraint: `server-only` cannot be imported by the custom server

`server.ts` and everything under `server/` run through `tsx`, not the Next.js bundler. The
`server-only` package is a Next webpack alias and is **not installed in `node_modules`** —
`require.resolve("server-only")` fails. So the custom server must not import
`src/lib/projects-store.ts`, `src/lib/applications-store.ts`, or any other module whose first line is
`import "server-only"`.

Two consequences, both already reflected in the design below:

- The new shared modules (`src/lib/request-origin.ts`, `src/lib/session-paths.ts`) must **not** import
  `server-only`.
- The custom server obtains the allowed roots by fetching its own loopback HTTP API rather than by
  reading the stores directly. `server.ts` already uses this pattern in
  `markExitedExecutionTaskExecuted()`.

### Related existing code to reuse

- `safeProjectPath()` in `src/app/api/projects/route.ts` already implements the
  "target must stay inside root" check with `startsWith(`${root}${path.sep}`)`. Generalise it into the
  new `session-paths.ts` helper and have the route call the helper instead of keeping its own copy.
- `GET /api/projects` (`src/app/api/projects/route.ts`) already returns every project with its
  applications embedded — exactly the shape needed to build the allowed-roots list.
- `httpServer.on("upgrade")` in `server.ts` already forwards the raw request into the `connection`
  event via `socketServer.emit("connection", webSocket, request)`; the handler simply ignores the
  second argument today.

## Acceptance Criteria

- [ ] Starting a session with a `cwd` outside every saved project and application path fails with a
      clear error and spawns no PTY, even when the directory exists.
- [ ] Starting a session whose `cwd` is a saved project path, a saved application path, or a
      subdirectory of one still works.
- [ ] The allowed-roots lookup failing causes the session start to fail (fail closed), not to succeed.
- [ ] A remote (non-loopback) client receives `403` from: `POST /api/projects`;
      `PATCH` and `DELETE /api/projects/{id}`; `POST /api/projects/{id}/applications`;
      `PATCH` and `DELETE /api/projects/{id}/applications/{applicationId}`;
      `POST /api/projects/inspect-directory`; and `PUT /api/settings` when the body contains
      `defaultProjectPath` or `initializeGitInNewProjects`.
- [ ] A remote client cannot start a `start-setup` session; it receives an error message instead.
- [ ] A remote client can still browse every screen, start console / planning / task-execution
      sessions in allowed directories, type into them, and save agent and prompt settings.
- [ ] A client-supplied `x-agenthub-client-origin: local` request header does not bypass any check.
- [ ] On a remote client the blocked controls are not rendered and a short notice explains why; on a
      loopback client every screen is unchanged.
- [ ] `.agent/PROJECT_DOCUMENT.md` describes the new rules.
- [ ] `pnpm build` and `pnpm lint` pass.

## Technical Notes

### 1. `src/lib/request-origin.ts` (new)

No `server-only` import — the custom server imports this module too. Exports:

- `export const CLIENT_ORIGIN_HEADER = "x-agenthub-client-origin";`
- `isLoopbackAddress(address: string | undefined): boolean` — true for `127.0.0.0/8`, `::1`, and
  `::ffff:127.x.x.x`. Every other address, including the machine's own LAN and tailnet addresses, is
  remote.
- `isLocalClient(headers: Headers): boolean` — reads `CLIENT_ORIGIN_HEADER` and returns true only for
  the exact value `"local"`. A missing or unexpected value means **remote** (fail closed).
- `requireLocalClient(request: Request): Response | null` — returns `null` when local, otherwise a
  `403` `Response.json({ error: … })`. Keeps each guarded route to a two-line edit.

### 2. Stamping the header in `server.ts`

Inside the `createServer` callback, before `handle(request, response)`:

- `delete request.headers[CLIENT_ORIGIN_HEADER]` — Node lower-cases incoming header names, so
  deleting the lower-case key removes any spoofed value.
- Set it to `"local"` or `"remote"` from `isLoopbackAddress(request.socket.remoteAddress)`.

Route handlers then read it from their `Request`; server components read it with
`await headers()` from `next/headers`.

`markExitedExecutionTaskExecuted()` and the new allowed-roots fetch both call `127.0.0.1`, so they
are stamped `local` and are unaffected.

### 3. WebSocket origin

Widen the `socketServer.on("connection", …)` handler to accept the second `request` argument and
record whether that socket is local (for example a `Map<WebSocket, boolean>` replacing, or sitting
next to, the existing `clients` set — keep `broadcast()` working over the same collection). In
`handleClientMessage`, reject `start-setup` from a non-local socket with
`send(socket, { type: "error", message: … })` and return before touching the registry.

Leave `start`, `attach`, `input`, `resize`, `stop`, and `dismiss` available to remote clients — the
path allowlist is what constrains them.

### 4. `src/lib/session-paths.ts` (new)

Pure module, `node:path` only, no `server-only`:

- `isPathWithin(root: string, candidate: string): boolean` — resolve both, then true when they are
  equal or when `candidate` starts with `root + path.sep`.
- `findAllowedRoot(cwd: string, roots: string[]): string | null`.

Refactor `safeProjectPath()` in `src/app/api/projects/route.ts` to use `isPathWithin` rather than its
own `startsWith` check.

### 5. Session registry allowlist

`SessionRegistryOptions` gains `listAllowedRoots: () => Promise<string[]>`. In `create()`, after the
existing `validateDirectory()` call:

- `const roots = await this.options.listAllowedRoots();` — let a thrown error propagate, so the
  `start` handler reports it and no session is created.
- If `findAllowedRoot(cwd, roots)` is `null`, throw
  `new Error("Sessions can only run in a saved project or application directory.")`.

`createSetup()` keeps `os.homedir()` and is not subject to the allowlist — it is gated by the
local-only rule in step 3 instead.

In `server.ts`, implement `listAllowedRoots` by `fetch`ing `http://127.0.0.1:${port}/api/projects`,
throwing on a non-OK response, and flattening each project's `path` plus every embedded
`application.path`. No caching — session starts are rare.

`settings.defaultProjectPath` is deliberately **not** an allowed root; only saved project and
application paths count.

### 6. Guarded HTTP routes

Add `requireLocalClient` at the top of each handler:

| File | Methods |
| --- | --- |
| `src/app/api/projects/route.ts` | `POST` |
| `src/app/api/projects/[id]/route.ts` | `PATCH`, `DELETE` |
| `src/app/api/projects/[id]/applications/route.ts` | `POST` |
| `src/app/api/projects/[id]/applications/[applicationId]/route.ts` | `PATCH`, `DELETE` |
| `src/app/api/projects/inspect-directory/route.ts` | `POST` |

`PUT /api/settings` (`src/app/api/settings/route.ts`) is conditional: parse the JSON body first, and
return `403` only when it contains `defaultProjectPath` or `initializeGitInNewProjects`. Agent,
prompt, and `remoteAccess` updates stay available remotely.

Every `GET` route, and the task, workitem, and plan routes, are untouched.

### 7. UI

Add `src/app/local-only-notice.tsx` — a small muted banner component, wording along the lines of
*"Adding projects and applications and editing their paths is only available on the machine running
AgentHub."* Match the existing notice styling used elsewhere in the app.

Each server page reads `isLocalClient(await headers())` and passes a `canManage` boolean into its
existing client component. These pages already declare `export const dynamic = "force-dynamic"`, and
`headers()` forces dynamic rendering in any case.

- `src/app/projects/page.tsx` — hide the "New project" link when `!canManage`.
- `src/app/projects/new/page.tsx` — render the notice instead of `NewProjectForm`.
- `src/app/projects/[id]/page.tsx` → `ProjectDetail` (`project-detail.tsx`) and, through it,
  `ProjectApplications` (`project-applications.tsx`): when `!canManage`, render project details and
  the application list read-only — no edit form, no delete control, no add row — plus the notice.
- `src/app/settings/projects/page.tsx` → `ProjectsSettingsForm`: when `!canManage`, show the current
  default project path and git flag as read-only text plus the notice.
- `src/app/settings/remote-access/page.tsx` → `RemoteAccessForm`: when `!canManage`, hide the
  **Install Tailscale** and **Connect** buttons (they start `start-setup` sessions) and show the
  notice. The Tailscale status display stays visible.

Hiding controls is a convenience only; the server-side checks are the actual boundary.

### 8. Documentation

In `.agent/PROJECT_DOCUMENT.md`, replace the "Open decisions" bullet that reads *"Remote access ships
with no authentication: the private tailnet is the boundary…"* with a description of the new rules:
sessions run only inside saved project or application paths, and non-loopback clients cannot create or
edit projects and applications, change path settings, inspect directories, or start setup sessions.

### Explicit non-goal

A remote user can still type arbitrary shell input into a **running** agent session inside an allowed
directory. That is inherent to how the console works and is out of scope for this issue.

### Pitfalls

- Do not import any `server-only` module from `server.ts` or `server/*.ts` — it will crash at startup
  under `tsx`.
- Delete the incoming origin header before setting it; otherwise a remote client can forge `local`.
- Treat a missing origin header as remote, not local.
- `resolve()` the cwd before comparing, and compare with `path.sep` appended, so `/Users/x/proj-evil`
  is not accepted as being inside `/Users/x/proj`.
- Keep the WebSocket `broadcast()` behaviour intact when changing how connected clients are tracked.

## Verification

- Run `pnpm build` — the project must compile with no TypeScript errors.
- Run `pnpm lint` and fix every reported error.
- Run `pnpm dev` and, over `http://localhost:3000`:
  - create and edit a project and an application, change the default project path, and start a console
    session — all still work.
- Reach the app over its tailnet address (or `http://<LAN-IP>:3000`) and confirm the "New project"
  link, project edit/delete, application add/edit/delete, the default project path form, and the
  Tailscale Install/Connect buttons are hidden with the notice shown.
- `curl -X POST http://<tailnet-ip>:3000/api/projects/inspect-directory -H 'Content-Type: application/json' -d '{"path":"/etc"}'`
  returns `403`; repeating it with `-H 'x-agenthub-client-origin: local'` still returns `403`; the same
  request against `http://127.0.0.1:3000/...` returns a normal response.
- Send a WebSocket `start` message with `"cwd": "/tmp"` (a WebSocket client, or by temporarily editing
  the cwd the console sends) — the session must be refused with an error and no PTY spawned. Repeat
  with a saved application path — the session must start.
- No automated test suite exists in this repository; verification is the build, the linter, and the
  manual checks above.
