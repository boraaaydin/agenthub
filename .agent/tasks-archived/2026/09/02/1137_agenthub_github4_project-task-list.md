# Per-project task list, task detail, and paginated listing

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

Give every project its own **task list**, reachable from a tasks icon on the right of each row
in the projects home list.

1. Persist task records in a new git-ignored **`data/tasks.json`**, owned by a new
   `src/lib/tasks-store.ts` that mirrors `src/lib/projects-store.ts`. Each task carries a
   `projectId`, a **title** and a **detail**.
2. Add a **tasks icon** to the right of each project row on `/`. It links to that project's
   task list; the rest of the row still opens the project detail page.
3. Add a **paginated task list** at `/projects/[id]/tasks`. Pagination is **server-side via the
   URL** (`?page=2`), 10 tasks per page, newest first, with Previous / Next controls and a
   "Page X of Y" indicator.
4. Add a **separate create screen** at `/projects/[id]/tasks/new` with a title input and a
   multi-line detail textarea, plus a **New task** button on the list screen.
5. Add a **task detail screen** at `/projects/[id]/tasks/[taskId]` with editable title and
   detail, Save, and a two-step delete — modelled on the existing project detail page.
6. Expose all of it through Route Handlers under `/api/projects/[id]/tasks`.
7. When a project that has tasks is deleted, the delete confirmation **asks** whether to delete
   its tasks too. The API takes an explicit `deleteTasks` flag; declining deletes the project
   record only.

**Scope boundary:** no task status/completion, no assigning a task to an agent, no running a
task through the console, no reordering, no search and no filters. Per-project agent overrides
remain out of scope.

## Application

Root application (`agenthub`) — single Next.js app in `src/` plus the custom Node server
(`server.ts`, `server/`). No `apps/` subdirectory exists. This task touches only `src/`; the
custom server is not involved.

## GitHub Issue

- Issue #4 ("her projenin kendi task listesi olsun")

Original request (Turkish): there should be a tasks icon on the right side of the project list;
after clicking it, that project's task list is displayed; add a new-task button as well; task
creation should be a separate screen; a task title and detail will be entered; the listing will
be paginated.

## Dependencies

None - This task is independent

## Context

### Decisions confirmed with the user before planning

| Question | Decision |
| --- | --- |
| Where tasks live | A **new git-ignored `data/tasks.json`** with its own `src/lib/tasks-store.ts`, mirroring `projects-store.ts`. Each task carries a `projectId`. Do **not** nest tasks inside `data/projects.json`. |
| Pagination | **Server-side via the URL** — `/projects/[id]/tasks?page=2`. The server component reads `searchParams`; the store returns one slice plus a total count. No client-side fetching for the list. |
| Scope | List + create **plus a task detail screen** with edit and delete, modelled on the existing project detail page. No status field. |
| Project deletion | The delete confirmation **asks** whether to delete the project's tasks. Choosing "keep" deletes the project only and leaves its tasks in `data/tasks.json` as orphans. The API takes an explicit `deleteTasks` flag. |

### Current state of the repository

- `src/lib/projects-store.ts` (184 lines) is the model to follow: typed helpers, a serialized
  write queue (`serializeWrite`), `ProjectValidationError` / `ProjectStoreError`, missing file →
  empty document, malformed file → descriptive error naming the file. It starts with
  `import "server-only";`.
- `src/lib/settings-store.ts` (112 lines) follows the same shape but deliberately **omits**
  `server-only` because `server.ts` imports it under `tsx`. That reason does not apply to the
  tasks store.
- `src/app/api/projects/route.ts` and `src/app/api/projects/[id]/route.ts` show the Route
  Handler conventions: `export const dynamic = "force-dynamic"`, `Response.json(...)`,
  `RouteContext<"/api/projects/[id]">` for dynamic params, JSON parse inside `try`/`catch` →
  400, validation error → 400, store error → 500, no stack traces returned to the client.
- `src/app/page.tsx` (99 lines) is the projects home. Each row is a **full-row `<Link>`**
  wrapping the `<li>` contents (lines 29–38) — this is what must be restructured for the icon.
  The empty state at lines 8–23 is the dashed-border pattern to reuse.
- `src/app/projects/[id]/page.tsx` (43 lines) is the server component that loads a project,
  handles a store error inline and calls `notFound()` for an unknown id.
- `src/app/projects/[id]/project-detail.tsx` (230 lines, `"use client"`) is the reference
  detail/edit/delete component: local state per field, `router.refresh()` after save,
  `router.replace("/")` after delete, two-step delete confirmation (`isDeleteConfirming`),
  inline `role="alert"` error and `role="status"` success messages.
- `src/app/projects/new/page.tsx` (124 lines) is the reference create form.
- `.gitignore` already ignores the whole `/data/` directory, so `data/tasks.json` needs **no
  new ignore rule** — verify, do not add a duplicate.

### Next.js version caution

The installed Next.js (16.3.4) is newer than most agents' training data. Before writing
Next.js code, read:

- `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` — the
  `searchParams` prop (it is a **Promise** in this version) and the `PageProps` helper.
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — current Route
  Handler API, `RouteContext`, and how to opt out of caching.
- `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md` —
  current `Link` / `useRouter` / `router.refresh` APIs.

Do not write these from memory. Leave the tool-managed `<!-- BEGIN:nextjs-agent-rules -->`
block in `AGENTS.md` untouched.

## Acceptance Criteria

### Store (`src/lib/tasks-store.ts`)

- [ ] Owns `data/tasks.json` and is the only module that reads or writes it. The document shape
      is `{ "tasks": Task[] }` — one flat array filtered by `projectId`.
- [ ] A task record is `{ id, projectId, title, detail, createdAt, updatedAt }`; `id` comes from
      `randomUUID()`, the timestamps are ISO strings, `updatedAt` is set on create and on every
      edit, and `detail` may be an empty string.
- [ ] Exports `listProjectTasks(projectId, { page, pageSize })` returning
      `{ tasks, page, pageSize, total, totalPages }`, plus `getTask`, `createTask`,
      `updateTask`, `deleteTask`, `countProjectTasks(projectId)` and
      `deleteProjectTasks(projectId)`.
- [ ] Tasks are returned newest first (`createdAt` descending), so a newly created task lands at
      the top of page 1.
- [ ] A missing `data/tasks.json` yields an empty list without an error and without creating the
      file on read.
- [ ] A malformed or truncated file raises a descriptive error naming the file — it does not
      silently reset the user's data.
- [ ] `page` is clamped to `>= 1`; a page past the end returns an empty slice with the real
      `total`, not an error.
- [ ] Writes create `data/` if needed and are serialized through the same promise-chain pattern
      used by `projects-store.ts`, so concurrent saves cannot lose an update.
- [ ] The module imports `server-only`, exactly like `projects-store.ts`.

### API

- [ ] `GET /api/projects/[id]/tasks?page=N` returns the paginated payload; an invalid or missing
      `page` falls back to 1.
- [ ] `POST /api/projects/[id]/tasks` validates a non-empty title and that the project exists,
      then returns **201** with the created task.
- [ ] A blank or missing title returns **400** with a readable message and writes nothing; an
      unknown project id returns **404**.
- [ ] `PATCH /api/projects/[id]/tasks/[taskId]` updates title and detail and returns the saved
      task; **404** when the task does not exist or belongs to another project.
- [ ] `DELETE /api/projects/[id]/tasks/[taskId]` removes the task; **404** when it is not found.
- [ ] `DELETE /api/projects/[id]` accepts `?deleteTasks=true`; when set it also removes that
      project's tasks, when absent it deletes only the project record. All other existing
      project-delete behaviour is unchanged.
- [ ] A store failure returns **500** with a readable message; no stack trace reaches the
      client.

### Projects home (`/`)

- [ ] Each project row shows a tasks icon link on the right, linking to
      `/projects/{id}/tasks`.
- [ ] Clicking the icon opens the task list; clicking anywhere else on the row still opens the
      project detail page.
- [ ] The markup contains **no nested anchors** — the current full-row `<Link>` is restructured
      into sibling links (see Technical Notes), and both targets are reachable by keyboard with
      a visible focus ring.
- [ ] The icon link has an accessible name (e.g. `aria-label={`Tasks for ${project.name}`}`)
      and the SVG itself is `aria-hidden`.
- [ ] The existing hover styling of the row is preserved.

### Task list (`/projects/[id]/tasks`)

- [ ] Renders the project name, a back link to `/projects/{id}`, and a **New task** button
      linking to `/projects/{id}/tasks/new`.
- [ ] Lists at most `TASKS_PAGE_SIZE` (10) tasks per page, newest first; each row shows the
      title, a truncated detail preview and the created date, and links to the task detail page.
- [ ] Previous / Next controls plus a "Page X of Y" indicator; Previous is inert on page 1 and
      Next on the last page.
- [ ] Paging changes the `?page=` URL, so the page is bookmarkable, survives a reload, and the
      browser back button returns to the previous page.
- [ ] An empty list shows the dashed-border empty state used on the projects home, with a
      **New task** call to action and no pagination controls.
- [ ] An unknown project id 404s via `notFound()`, as `/projects/[id]` already does.
- [ ] A store error renders the inline error panel used by the other pages rather than
      crashing.

### Create screen (`/projects/[id]/tasks/new`)

- [ ] A separate screen — not a modal and not an inline form — with a title input and a
      multi-line detail textarea.
- [ ] The submit button is disabled while the request is in flight so a double click cannot
      create two tasks.
- [ ] A failure shows the server's message inline and what the user typed is not lost.
- [ ] On success the user returns to the task list, where the new task is visible at the top of
      page 1.
- [ ] A Cancel link returns to the task list without creating anything.

### Task detail (`/projects/[id]/tasks/[taskId]`)

- [ ] Shows the task with editable title and detail, Save and Cancel, and a two-step delete
      confirmation, matching `project-detail.tsx`.
- [ ] Save shows an inline confirmation and the change survives a reload.
- [ ] Delete returns to the task list and the task is gone from `data/tasks.json`.
- [ ] A task id that does not exist, or one that belongs to a different project, 404s.

### Project delete confirmation

- [ ] When the project has tasks, the confirmation states the count and offers two explicit
      choices: delete the project **and** its N tasks, or delete the project only and keep the
      tasks.
- [ ] With zero tasks the confirmation is unchanged from today.
- [ ] The chosen option is sent to the API as the `deleteTasks` flag; the tasks are removed only
      when that option was picked.

### Build

- [ ] `pnpm build` passes.
- [ ] `pnpm lint` passes with no errors.
- [ ] Every touched file stays under the 600-line rule enforced by `do-task-post.md`.

## Technical Notes

### File layout

```
data/tasks.json                                        # git-ignored, created on first save
src/lib/tasks-store.ts                                 # fs read/write + pagination helpers
src/app/api/projects/[id]/tasks/route.ts               # GET (paginated), POST
src/app/api/projects/[id]/tasks/[taskId]/route.ts      # PATCH, DELETE
src/app/projects/[id]/tasks/page.tsx                   # server component: paginated list
src/app/projects/[id]/tasks/new/page.tsx               # "use client" create form
src/app/projects/[id]/tasks/[taskId]/page.tsx          # server component: loads one task
src/app/projects/[id]/tasks/[taskId]/task-detail.tsx   # "use client" edit + delete
```

Changed files: `src/app/page.tsx` (tasks icon), `src/app/projects/[id]/page.tsx` (pass the task
count down), `src/app/projects/[id]/project-detail.tsx` (Tasks link + task-aware delete
confirmation), `src/app/api/projects/[id]/route.ts` (`deleteTasks` flag).

### Store

- Follow `projects-store.ts` closely: one exported constant for the file path
  (`path.join(process.cwd(), "data", "tasks.json")`), `readDocument` / `writeDocument`, a
  dedicated `TaskValidationError` / `TaskStoreError` pair, and the module-level write queue.
- Write the whole document with `JSON.stringify(doc, null, 2)` and a trailing newline, matching
  the projects file.
- Export the page size as a constant (`TASKS_PAGE_SIZE = 10`) used by both the store and the
  list page — do not hardcode 10 in the UI.
- Sorting and slicing belong in the store, not in the page, so the page never loads the whole
  array to display ten rows.
- `updateTask` and `deleteTask` take both `projectId` and `taskId` and return `null` when the
  task does not belong to that project, so the Route Handler can answer 404 without a second
  lookup.

### Route Handlers

- `export const dynamic = "force-dynamic"` — this data is read from disk per request and must
  never be cached or prerendered. Confirm the current syntax in the bundled Route Handler doc.
- Parse the JSON body inside a `try`/`catch` and return 400 on invalid JSON, as
  `api/projects/route.ts` does.
- Read the page number from `new URL(request.url).searchParams`; parse with `Number.parseInt`
  and fall back to 1 for anything not a positive integer.
- Use `RouteContext<"/api/projects/[id]/tasks/[taskId]">` for the nested dynamic params; both
  params come from a single `await context.params`.
- **Cascade is opt-in and lives in the Route Handler**: `deleteProject` in `projects-store.ts`
  stays exactly as it is; the handler calls `deleteProjectTasks(id)` only when the flag is set.
  Do **not** import `tasks-store.ts` into `projects-store.ts`.

### Pages

- `src/app/projects/[id]/tasks/page.tsx` stays a **server component**: it awaits both
  `props.params` and `props.searchParams`, loads the project (404 when missing) and the page
  slice, and renders the rows itself. Reading `searchParams` opts the page into dynamic
  rendering; keep `export const dynamic = "force-dynamic"` for consistency with the other pages.
- Pagination controls are plain `<Link href={`?page=${n}`}>` elements — no client component and
  no `useRouter` needed for paging. Render the disabled edge as a non-interactive `<span>`
  rather than a link to a page that does not exist.
- The create form and the task detail component are small `"use client"` components modelled on
  `projects/new/page.tsx` and `project-detail.tsx`: local state per field, `fetch` on submit,
  inline error/success, disabled button while submitting, `router.replace(...)` to leave the
  page and `router.refresh()` after an in-place save.
- Match the existing visual language: `#f4f6fa` background, centred column (`max-w-2xl` for the
  forms and detail screens, `max-w-5xl` for the list), `h-11 rounded-xl` controls, sky-700
  primary button, red-700 destructive button, dashed-border empty state.

### Nested-link fix on the projects home

The project row is currently a single `<Link>` wrapping the whole `<li>` content
(`src/app/page.tsx:29-38`). Putting the tasks link inside it would nest anchors, which is
invalid HTML and breaks keyboard navigation. Restructure the row as a flex container holding
**two sibling links**: the project link taking the remaining width (`flex-1 min-w-0`), and the
tasks icon link fixed on the right. Keep the existing hover and focus-ring styling — apply the
hover to the row container if the whole row should still highlight.

Use an inline SVG for the icon (a checklist / list glyph), marked `aria-hidden`, with the
accessible name on the link. Do **not** add an icon library dependency.

### Delete confirmation

- `src/app/projects/[id]/page.tsx` reads `countProjectTasks(project.id)` alongside the project
  and passes the count into `ProjectDetail` as a prop. Guard the count with the same
  `try`/`catch` used for the project read; a failed count must not break the page.
- In `project-detail.tsx`, when `taskCount > 0` the confirmation shows the count and two radio
  options (delete with tasks / keep tasks) before the existing Confirm delete + Cancel buttons.
  With `taskCount === 0` the confirmation stays exactly as it is today.
- The component sends `DELETE /api/projects/{id}?deleteTasks=true` only when the user picked
  the cascading option.

### Pitfalls

- Never import `node-pty`, `ws`, or anything under `server/` into a page or Route Handler.
- Never import `tasks-store.ts` (it uses `node:fs` and `server-only`) into a `"use client"`
  component — pass data down as props from the server component.
- Do not touch `data/projects.json`, the projects store's own logic, or the settings store —
  the tasks document is separate.
- Do not add a `.gitignore` entry; `/data/` is already ignored. Confirm with `git status` that
  `data/tasks.json` stays untracked.
- Do not introduce a task status, an agent assignment, a run button, drag reordering, search or
  filters. All out of scope.
- Keep every touched file under 600 lines; `project-detail.tsx` is already 230 lines, so add the
  task-count confirmation with minimal new code.

### Follow-up documentation

After the implementation works, update `.agent/PROJECT_DOCUMENT.md`:
- add `src/app/projects/[id]/tasks/`, `src/app/api/projects/[id]/tasks/` and `data/tasks.json`
  to the Repository Structure section,
- record that per-project tasks are persisted in the git-ignored `data/tasks.json`, listed with
  server-side pagination, and that deleting a project asks whether to delete its tasks.

## Verification

- `pnpm build` completes with no errors (this also type-checks the app).
- `pnpm lint` passes; fix reported errors rather than suppressing them.
- `git status` shows no `data/` entry.
- Manual check with `pnpm dev`:
  1. With `data/tasks.json` absent, open a project's task list — the empty state renders, no
     error, nothing crashes, and no file is created.
  2. Create a task; it appears at the top of the list and `data/tasks.json` now holds it.
  3. Create 12+ tasks; confirm 10 per page, working Next / Previous, "Page 2 of 2", a `?page=2`
     URL that survives a reload, and a browser back button that returns to page 1.
  4. Open a task, edit the title and detail, save, reload, and confirm the change persisted.
  5. Delete a task and confirm it disappears from the list and from `data/tasks.json`.
  6. Visit `/projects/{id}/tasks/{unknown-id}`, and a valid task id under the wrong project id —
     both 404.
  7. `curl` `POST /api/projects/{id}/tasks` with a blank title → 400 with a readable message and
     an unchanged `data/tasks.json`.
  8. Corrupt `data/tasks.json` by hand; confirm the task list reports a clear error instead of
     crashing. Restore the file afterwards.
  9. Delete a project that has tasks choosing **keep the tasks**; confirm the project is gone and
     its tasks remain in `data/tasks.json`. Repeat with **delete the tasks** and confirm they are
     removed.
  10. Navigate `/` → tasks icon → task list → new task → back to `/` using links only, never by
      typing a URL, and confirm the project row itself still opens the project detail page.
