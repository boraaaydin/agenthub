# Projects home page, JSON data store, and moving the console to its own page

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

Turn the single-screen MVP into a small multi-page app with a persisted list of projects:

1. Add a **`data/` folder at the repository root**, git-ignored, holding a plain **JSON file**
   that acts as the database.
2. **Move the existing Codex console screen off the home page** onto its own route,
   `/console`, unchanged in behaviour.
3. Make the **home page (`/`) a projects screen**: a **"New project" button** and a **list of
   the stored projects**.
4. Add a **`/projects/new` form page** that creates a project (name + working directory path)
   and returns to the home page.

Project records are read and written through **Next.js Route Handlers** under
`/api/projects`, which persist to the JSON file in `data/`.

**Scope boundary:** the projects list and the console are **not wired together yet**. The
console keeps its own manual working-directory input, and clicking a project does not start a
session. Connecting a project to a Codex session is deliberately left to a later task.

## Application

Root application (`agenthub`) — single Next.js app in `src/`. No `apps/` subdirectory exists.

## GitHub Issue

- Issue #2 ("ana sayfa değişsin")

Original request (Turkish): a `data` folder at the project root, added to `.gitignore`; a
simple JSON file as the database; move the current main screen to a separate page; the home
page should for now hold a "create new project" button and a list of projects.

## Dependencies

None - This task is independent

## Context

### Decisions confirmed with the user before planning

| Question | Decision |
| --- | --- |
| Project record shape | `{ id, name, path, createdAt }` — a display name plus the working directory path. No `agent` field yet. |
| Console page | The existing screen moves to **`/console` unchanged**, keeping its manual path input. The home list is **display-only** for now — no link from a project into a session. |
| Data access | **Next.js Route Handlers** (`src/app/api/projects/…`) on top of a small `src/lib/projects-store.ts` that does the `fs` read/write. Not Server Actions, not the WebSocket protocol. |
| Create UX | A **separate `/projects/new` page** with a form; on success it navigates back to `/`. No modal. |

### Current state of the repository

- `src/app/page.tsx` is a 5-line wrapper that renders `<AgentConsole />`.
- `src/app/agent-console.tsx` (310 lines, `"use client"`) is the whole existing screen: path
  input, prompt textarea, submit/stop buttons, xterm.js terminal, WebSocket wiring.
- `src/lib/agent-protocol.ts` holds the WebSocket message types shared by client and server.
- `server.ts` + `server/session-registry.ts` are the custom Node server and PTY session
  registry. **This task does not need to change either of them.**
- There is **no `src/app/api/` directory yet** — this task creates the first Route Handlers.
- No `data/` directory exists yet, and `.gitignore` has no entry for one.

### Why the store is a separate module

`src/lib/projects-store.ts` isolates every `fs` call and the file's shape in one place, so the
Route Handlers stay thin and the JSON file can later be swapped for a real database without
touching the routes.

### Next.js version caution

The installed Next.js (16.3.4) is newer than most agents' training data and contains breaking
changes — notably around Route Handler signatures and `params` in dynamic routes. **Before
writing any Next.js code, read**:

- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — the current
  Route Handler API
- `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md` — the
  current `Link` / navigation API

Do not write these from memory. The `<!-- BEGIN:nextjs-agent-rules -->` block in `AGENTS.md`
is tool-managed by `next dev` — leave it in place.

## Acceptance Criteria

### Data store

- [ ] A root-level `data/` directory is used for the JSON database, and `/data/` is added to
      `.gitignore` so neither the folder nor the JSON file is committed.
- [ ] The application creates `data/` and the JSON file on demand if they do not exist, and
      starts from an empty project list instead of crashing.
- [ ] `src/lib/projects-store.ts` exposes typed helpers (e.g. `listProjects`, `createProject`,
      `deleteProject`) and is the only module that touches the filesystem for project data.
- [ ] A malformed or truncated JSON file produces a clear error rather than an unhandled crash.

### API

- [ ] `GET /api/projects` returns the stored projects.
- [ ] `POST /api/projects` creates a project from `{ name, path }`, assigns an `id` and
      `createdAt`, persists it, and returns the created record.
- [ ] `POST` validates its input server-side: both fields required and non-empty, and the
      `path` must resolve to an existing directory (`fs.promises.stat`). Invalid input returns
      a 400 with a readable message; it is never written to the file.
- [ ] `DELETE /api/projects/{id}` removes a project; an unknown id returns 404.

### Pages

- [ ] `/` shows the project list and a **"New project"** button linking to `/projects/new`.
- [ ] Each list row shows the project name and its path; a project with no projects yet shows
      an empty state explaining what to do.
- [ ] `/projects/new` shows a form with **name** and **path** fields, a submit and a cancel
      control; on success it navigates back to `/` and the new project appears in the list.
- [ ] Form errors (empty fields, nonexistent path) are shown inline on the form page; the user
      is not navigated away and the typed values are not lost.
- [ ] `/console` renders the previously-existing console screen with **unchanged behaviour** —
      path input, prompt textarea, start/send, stop & reset, live xterm.js output, reconnect
      with scrollback replay.
- [ ] Navigation exists between the two areas (at minimum a link from `/` to `/console` and
      back), so `/console` is reachable without typing the URL.
- [ ] `pnpm build` passes.
- [ ] `pnpm lint` passes with no errors.

## Technical Notes

### File layout to create

```
data/                              # git-ignored, created at runtime
└── projects.json                  # { "projects": [...] }

src/lib/projects-store.ts          # fs read/write + types, the only fs touch point
src/app/api/projects/route.ts      # GET (list), POST (create)
src/app/api/projects/[id]/route.ts # DELETE
src/app/page.tsx                   # projects list + "New project" button
src/app/projects/new/page.tsx      # create form
src/app/console/page.tsx           # renders <AgentConsole />
```

`src/app/agent-console.tsx` moves under the console route (e.g.
`src/app/console/agent-console.tsx`) or stays where it is and is imported by the new page —
either is fine, but **do not rewrite its logic**; this is a move, not a refactor.

### Store implementation

- Resolve the data directory from the process working directory, e.g.
  `path.join(process.cwd(), "data", "projects.json")`. Keep that path in one exported constant.
- On read: if the file is missing, return an empty list (and do not fail); if it exists but
  does not parse, throw a descriptive error naming the file.
- On write: ensure `data/` exists (`fs.promises.mkdir(dir, { recursive: true })`), then write
  the whole document back with `JSON.stringify(doc, null, 2)`.
- **Serialize writes.** Two concurrent `POST`s that both read-modify-write the same file will
  lose one record. Guard writes with a module-level promise chain (a simple mutex), or write
  to a temp file and `rename` it into place. The single-process localhost server makes an
  in-process lock sufficient.
- Generate ids with `crypto.randomUUID()`; store `createdAt` as an ISO string.
- Store the **resolved absolute path** (`path.resolve(input.trim())`), not the raw input, so
  the list shows a canonical path.

### Route Handlers

- Read the bundled Route Handler doc first — the signature for dynamic-segment handlers has
  changed in recent Next.js versions; do not guess how `params` is typed or awaited.
- Route Handlers must be treated as dynamic — this data is read from disk per request and must
  never be cached or statically evaluated at build time. Ensure the handlers opt out of any
  caching / prerendering (e.g. `export const dynamic = "force-dynamic"`), and check the doc for
  the current, correct way to express that.
- Return JSON with proper status codes: 200/201 on success, 400 on validation failure, 404 for
  an unknown id, 500 for an unexpected store error. Never leak a raw stack trace to the client.
- Validate on the server even though the form also validates on the client. Never trust the
  request body.

### Pages

- Keep the existing visual language of `agent-console.tsx` — light `#f4f6fa` background,
  `max-w-5xl` centred column, rounded-xl controls, sky accent, Tailwind v4 utilities. The new
  pages should look like the same product, not a different one.
- The home page may be a Server Component that calls the store directly, **or** a client
  component that fetches `/api/projects`. Prefer the Server Component read for the initial
  list; the create form is a client component that `POST`s and then navigates.
- After a successful create, navigate with the App Router's client navigation and make sure the
  list on `/` reflects the new project immediately rather than showing a stale cached page —
  check the linking/navigating doc for the current refresh API.
- Disable the submit button while the request is in flight so a double click cannot create two
  projects.
- Use `Link` for navigation between `/`, `/projects/new` and `/console`.

### Pitfalls

- Never import `node-pty`, `ws`, or anything from `server/` into a page or Route Handler —
  those belong to the custom server process only. The projects store is plain `node:fs` and is
  safe in a Route Handler.
- `src/lib/projects-store.ts` must not be imported from a `"use client"` component; it is
  server-only. Consider marking it with `import "server-only"` if the package is available, or
  just keep the import graph clean.
- The console page must stay client-side: `agent-console.tsx` keeps its `"use client"`
  directive and the xterm.js dynamic import. Do not let the new server-side pages pull it into
  a server-rendered path.
- Do not delete the project's working directory or write anything into it — the store only
  records the path.
- Do not add project→session wiring, editing/renaming, an agent selector, or multi-session
  support. All explicitly out of scope.
- Keep every touched file under the 600-line rule enforced by `do-task-post.md`.

### Follow-up documentation

After the implementation works, update `.agent/PROJECT_DOCUMENT.md`:
- add `data/` and the new `src/app/api/`, `src/app/console/`, `src/app/projects/` entries to
  the Repository Structure section,
- record that project metadata is persisted to a git-ignored JSON file under `data/`, while
  agent sessions remain in-memory only.

## Verification

- `pnpm build` completes with no errors (this also type-checks the app).
- `pnpm lint` passes; fix any reported errors rather than suppressing them.
- `git status` shows no `data/` entry — confirm the `.gitignore` rule works.
- Manual check with `pnpm dev`:
  1. Open `/` with no `data/projects.json` present and confirm the empty state renders and
     nothing crashes.
  2. Create a project with a valid path; confirm it appears in the list and that
     `data/projects.json` now contains it.
  3. Restart the dev server and confirm the project is still listed (persistence works).
  4. Try to create a project with an empty name, and with a nonexistent path; confirm both are
     rejected with an inline message and nothing is written to the JSON file.
  5. Open `/console` and run through the MVP flow: enter a valid path, send a prompt, see live
     Codex output, send a follow-up prompt in the same session, reload the tab and confirm
     scrollback replays, then stop the session.
  6. Confirm you can navigate `/` → `/console` → `/` without typing URLs by hand.
