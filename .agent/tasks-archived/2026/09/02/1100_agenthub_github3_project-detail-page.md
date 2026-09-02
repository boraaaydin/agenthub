# Project detail page with editable name and path

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

Clicking a project on the home page (`/`) opens a **project detail page** at `/projects/{id}`
where the project's settings can be changed.

The detail page must:

1. Show the project as an **inline editable form** — `name` and `path` are pre-filled input
   fields with **Save changes** / **Cancel** controls on the page itself (no separate edit
   route).
2. Show the project's **read-only metadata** — its `id` and `createdAt`.
3. Offer a **Delete project** control, wired to the already-existing
   `DELETE /api/projects/{id}` endpoint, behind an explicit confirmation step.
4. Carry an **"Open console"** link to `/console`.

Supporting this requires two new pieces on the server side: a `getProject(id)` read and an
`updateProject(id, input)` write in `src/lib/projects-store.ts`, plus a `PATCH` handler in the
existing `src/app/api/projects/[id]/route.ts`.

**Scope boundary:** the "Open console" link is a **plain link to `/console`** — it must *not*
pre-fill the console's working directory or start a session for the project. Wiring a project
to an agent session stays deliberately out of scope, as it was in the previous task. No agent
selector, no session settings, no other project fields.

## Application

Root application (`agenthub`) — single Next.js app in `src/`. No `apps/` subdirectory exists.

## GitHub Issue

- Issue #3 ("proje detay sayfası")

Original request (Turkish): when one of the projects on the home page is clicked, a project
detail page should open; some settings will be made there; every project's name and project
path should be changeable.

## Dependencies

None - This task is independent

## Context

### Decisions confirmed with the user before planning

| Question | Decision |
| --- | --- |
| Edit UX | **Inline form on the detail page** (`/projects/{id}`) with Save changes / Cancel. No separate `/projects/{id}/edit` route. |
| Delete | **Included** — a delete control on the detail page, with confirmation, using the existing `DELETE` endpoint that currently has no UI. |
| Metadata | **Included** — display `id` and `createdAt` read-only. |
| Open console link | **Included**, but as a plain link to `/console`. **No path pre-fill, no session wiring** — that stays out of scope. |

### Current state of the repository

- `src/app/page.tsx` (88 lines, Server Component, `export const dynamic = "force-dynamic"`)
  renders the project list. Each `<li>` currently shows the name and path as **plain text —
  the rows are not links yet**. This task makes each row link to `/projects/{project.id}`.
- `src/lib/projects-store.ts` (161 lines) is the only module that touches the filesystem for
  project data. It already exports `Project`, `PROJECTS_FILE_PATH`, `ProjectValidationError`,
  `ProjectStoreError`, `listProjects`, `createProject`, `deleteProject`, and holds the internal
  helpers `readDocument`, `writeDocument`, `serializeWrite` (write mutex), `projectDetails`
  (input validation + `path.resolve`) and `validateDirectory` (must exist and be a directory).
  **It has no single-project read and no update function** — both are added here.
- `src/app/api/projects/route.ts` handles `GET` (list) and `POST` (create).
- `src/app/api/projects/[id]/route.ts` (24 lines) handles `DELETE` only, and uses the
  `RouteContext<"/api/projects/[id]">` typed-route helper with `await context.params`. **Follow
  that exact existing signature style** when adding `PATCH` — do not invent a different one.
- `src/app/projects/new/page.tsx` (124 lines, `"use client"`) is the closest reference for the
  new page: form state, inline `role="alert"` error box, `isSubmitting` disabling, `fetch` to
  the API, then `router.replace("/")`.
- `src/app/console/page.tsx` renders `<AgentConsole />`; nothing in this task touches the
  console, the WebSocket server, or `server/`.

### Why the store gains `getProject` and `updateProject`

Every filesystem access for project data lives in `src/lib/projects-store.ts`. The page and the
Route Handler must not read or write `data/projects.json` directly, so both the single-project
read and the update belong in the store, sharing its existing validation helpers and its write
mutex.

### Next.js version caution

The installed Next.js is **16.3.4** — newer than most agents' training data, with breaking
changes around dynamic route `params`, Route Handler signatures and caching. **Before writing
any Next.js code, read**:

- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` — dynamic
  segments and how `params` is typed/awaited on a page
- `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md` — for the
  not-found path

Do not write these from memory. The `<!-- BEGIN:nextjs-agent-rules -->` block in `AGENTS.md` is
tool-managed by `next dev` — leave it in place.

## Acceptance Criteria

### Store

- [ ] `getProject(id)` returns the matching `Project` or `null` when no project has that id.
- [ ] `updateProject(id, input)` validates `name` and `path` exactly as create does (both
      required and non-empty, `path` resolved to an absolute path and required to be an
      existing directory), updates the record in place, persists it, and returns the updated
      project; it returns `null` for an unknown id.
- [ ] `updateProject` preserves the project's `id` and `createdAt` — neither can be changed by
      the request body.
- [ ] `updateProject` runs through the same `serializeWrite` mutex as `createProject` and
      `deleteProject`, so concurrent writes cannot lose a record.
- [ ] `src/lib/projects-store.ts` remains the only module performing filesystem access for
      project data.

### API

- [ ] `PATCH /api/projects/{id}` accepts `{ name, path }`, returns the updated project on
      success (200), `400` with a readable message on validation failure, `404` for an unknown
      id, and `500` on an unexpected store error.
- [ ] The `PATCH` handler validates server-side; invalid input is never written to the JSON
      file, and no raw stack trace is returned to the client.
- [ ] The existing `GET`, `POST` and `DELETE` behaviour is unchanged.

### Home page

- [ ] Each project row on `/` links to `/projects/{id}`; the whole row is clickable and
      keyboard-reachable, with a visible focus style consistent with the rest of the app.
- [ ] The empty state and error state on `/` are unchanged.

### Detail page

- [ ] `/projects/{id}` shows the project's name as the page heading and an inline form
      pre-filled with the current `name` and `path`.
- [ ] The form has **Save changes** and **Cancel** controls; Cancel restores the originally
      loaded values (or returns to `/`) without saving.
- [ ] Saving `PATCH`es the API and, on success, shows the saved state; the home page shows the
      updated values when navigated back to (no stale cached list).
- [ ] Validation errors from the server (empty name, empty path, nonexistent path, path that is
      not a directory) are shown inline on the page, the user is not navigated away, and the
      typed values are not lost.
- [ ] The submit control is disabled while a request is in flight, so a double click cannot
      send two updates.
- [ ] The page shows the project's `id` and `createdAt` read-only, clearly separated from the
      editable fields.
- [ ] A **Delete project** control exists; it requires an explicit confirmation step in the UI
      before calling `DELETE /api/projects/{id}`, and on success navigates back to `/`, where
      the project is gone.
- [ ] An **"Open console"** link navigates to `/console`.
- [ ] A link back to the projects list (`/`) exists.
- [ ] Visiting `/projects/{unknown-id}` renders Next.js's not-found response rather than
      crashing or rendering an empty form.
- [ ] `pnpm build` passes.
- [ ] `pnpm lint` passes with no errors.

## Technical Notes

### File layout

```
src/lib/projects-store.ts             # + getProject, updateProject
src/app/api/projects/[id]/route.ts    # + PATCH (DELETE stays)
src/app/projects/[id]/page.tsx        # new: server component, loads the project
src/app/projects/[id]/project-detail.tsx  # new: "use client" form + delete
src/app/page.tsx                      # rows become links to /projects/{id}
```

Splitting the detail route into a server `page.tsx` (data load, not-found handling) and a
client child (form state, fetch, delete) keeps the store import server-only and each file well
under the 600-line rule.

### Store implementation

- Reuse the existing `projectDetails()` and `validateDirectory()` helpers for `updateProject` —
  do not write a second copy of the validation rules. Validate *before* entering
  `serializeWrite`, the way `createProject` does, so a rejected request never touches the file.
- Update the record in place (mutate the found entry or replace it at the same index) so the
  list order is stable; do not push a new entry and remove the old one.
- `getProject` is a read — it goes through `readDocument()` and needs no mutex.
- Keep throwing `ProjectValidationError` for bad input and `ProjectStoreError` for file
  problems; the route layer already distinguishes them.

### Route Handler

- Add `PATCH` to the existing `src/app/api/projects/[id]/route.ts`, matching the file's current
  `RouteContext<"/api/projects/[id]">` + `await context.params` style and its
  `export const dynamic = "force-dynamic"`.
- Parse the body inside a `try` and return `400` for non-JSON, exactly as `POST` in
  `src/app/api/projects/route.ts` does.
- Distinguish `404` (store returned `null`) from `400` (`ProjectValidationError`) from `500`
  (`ProjectStoreError` / unexpected). Log server-side with `console.error`; return a readable
  message to the client.

### Pages

- The detail page is a **Server Component** that awaits `params`, calls `getProject`, and calls
  `notFound()` when the project does not exist. Check the bundled docs for how `params` is typed
  and awaited on a page in this Next.js version — do not guess.
- Wrap the `getProject` call in a `try`/`catch` and surface a readable error the same way
  `src/app/page.tsx` does for `ProjectStoreError`, instead of letting the page throw.
- Add `export const dynamic = "force-dynamic"` to the detail page — this data is read from disk
  per request and must never be cached or prerendered at build time.
- The client child receives the loaded project as a prop and owns the form state, the `PATCH`
  fetch and the delete flow. Give the client component a `key` derived from the project id if
  you keep state across navigations.
- After a successful save, make sure `/` shows the updated values rather than a stale cached
  page — check `04-linking-and-navigating.md` for the current refresh API (the create form uses
  `router.replace("/")`; a router refresh may also be needed here since the user stays on the
  detail page).
- Delete confirmation: use an inline two-step confirmation in the page (a "Delete project"
  button that reveals "Confirm delete" / "Cancel"). **Do not use `window.confirm`** — a blocking
  browser dialog is both a poor fit for the design and hostile to automated checks.
- Keep the existing visual language: light `#f4f6fa` background, centred `max-w-*` column,
  rounded-xl controls, `h-11` inputs and buttons, sky accent, `role="alert"` error box, mono
  font for paths. The detail page should look like `/projects/new`, not a different product.

### Pitfalls

- Never import `node-pty`, `ws`, or anything under `server/` into a page or Route Handler.
- `src/lib/projects-store.ts` is `import "server-only"` — it must not be imported from any
  `"use client"` file, directly or transitively.
- Do not touch `src/app/agent-console.tsx`, `server.ts`, `server/session-registry.ts` or
  `src/lib/agent-protocol.ts`.
- Do not create, move, rename or delete anything inside a project's working directory — the
  store only records the path string.
- Changing a project's path must not attempt to migrate, copy or validate anything beyond "this
  directory exists".
- Do not add project→session wiring, an agent selector, or any project field beyond
  `name`/`path`. Out of scope.
- Keep every touched file under the 600-line rule enforced by `do-task-post.md`.

### Follow-up documentation

After the implementation works, update `.agent/PROJECT_DOCUMENT.md`: add the
`src/app/projects/[id]/` route to the Repository Structure section and note that project
records can be edited and deleted from the detail page.

## Verification

- `pnpm build` completes with no errors (this also type-checks the app).
- `pnpm lint` passes; fix any reported errors rather than suppressing them.
- `git status` still shows no `data/` entry.
- Manual check with `pnpm dev`:
  1. From `/`, click a project row and confirm `/projects/{id}` opens with the name and path
     pre-filled and the id / createdAt shown.
  2. Change the name and save; go back to `/` and confirm the list shows the new name, and that
     `data/projects.json` contains it.
  3. Change the path to another existing directory and save; confirm the stored value is the
     resolved absolute path.
  4. Try saving with an empty name, and with a nonexistent path; confirm both are rejected with
     an inline message, the page does not navigate, the typed values remain, and
     `data/projects.json` is unchanged.
  5. Press Cancel after editing and confirm nothing was saved.
  6. Delete a project through the confirmation step; confirm it disappears from `/` and from
     `data/projects.json`.
  7. Visit `/projects/does-not-exist` and confirm a not-found page renders.
  8. Click "Open console" and confirm `/console` still works as before (path input, prompt,
     live output), then navigate back to `/`.
  9. Restart the dev server and confirm the edited values persisted.
