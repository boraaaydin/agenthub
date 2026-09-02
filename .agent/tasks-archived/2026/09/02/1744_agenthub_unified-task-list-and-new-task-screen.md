# Unify Task List and New Task Screen Across Projects

## Description

Give the global task list at `/tasks` a **New task** button that opens a single, shared
task-creation screen with a project dropdown, and make the per-project task routes reuse
those same screens instead of keeping their own copies.

Concretely:

- `/tasks` gains a **New task** action in its header.
- A new `/tasks/new` route is the only task-creation screen. It contains a project dropdown.
  When exactly one project exists, that project is preselected. `?project=<id>` preselects a
  specific project (used when the user arrives from a project) while the dropdown stays
  editable.
- `/projects/[id]/tasks` no longer renders its own list; it redirects to `/tasks?project=<id>`,
  so the project-scoped list is literally the same component as the global list.
- `/projects/[id]/tasks/new` redirects to `/tasks/new?project=<id>`.
- Every in-app link that previously pointed at the per-project task routes points at the
  unified routes instead.

## Application

Root application (`agenthub`)

## Dependencies

None - This task is independent

## Context

Read `.agent/PROJECT_DOCUMENT.md` before implementing.

Current state:

- `src/app/tasks/page.tsx` — server-rendered global task list. Reads projects with
  `listProjects()` and tasks with `listAllTasks({ page, pageSize, projectId })`, renders a
  project badge per row, a `Create plan` link (`planConsoleHref`), the `ProjectFilter` client
  dropdown (`src/app/tasks/project-filter.tsx`) and `?project=&page=` pagination via its local
  `paginationHref()` helper. It has no creation entry point today.
- `src/app/projects/[id]/tasks/page.tsx` — a near-duplicate list for one project: its own
  `TaskRows`, its own `?page=` pagination, a `New task` button and an empty state. This file is
  replaced by a redirect.
- `src/app/projects/[id]/tasks/new/page.tsx` — the current client-side creation form (title +
  detail, `POST /api/projects/{id}/tasks`, then `router.replace('/projects/{id}/tasks')`). Its
  markup is the starting point for the shared `/tasks/new` screen; the file itself becomes a
  redirect.
- `POST /api/projects/[id]/tasks` already validates the project (404 when unknown) and returns
  the created task with status 201. The project id stays part of the API path, so the shared
  form must post to the route of the project selected in the dropdown. No API change is needed.
- Existing links to the per-project task routes:
  - `src/app/projects/page.tsx:39` — per-row tasks icon link.
  - `src/app/projects/[id]/project-detail.tsx:119` — `Tasks` button.
  - `src/app/projects/[id]/tasks/[taskId]/task-detail.tsx:28` — `taskListPath`, used both for
    the breadcrumb link and for `router.replace(...)` after a task is deleted.
- Task detail pages stay at `/projects/[id]/tasks/[taskId]`; only list and creation routes are
  unified.

Decisions already made with the user:

- The per-project list route is redirected, not kept as a second page.
- There is one creation route, `/tasks/new`; the project variant redirects to it.
- Arriving from a project preselects the project but leaves the dropdown editable.

## Acceptance Criteria

- [ ] `/tasks` shows a **New task** button in its header that links to `/tasks/new`, carrying
      the active filter as `?project=<id>` when a project filter is selected.
- [ ] The `/tasks` empty states link to the same creation screen instead of only telling the
      user to add a task from a project.
- [ ] `/tasks/new` renders title, detail and a **Project** dropdown listing every saved project.
- [ ] On `/tasks/new` with no `project` search param: if exactly one project exists it is
      preselected; if several exist, no project is preselected and the dropdown shows a
      placeholder option.
- [ ] `/tasks/new?project=<id>` preselects that project when the id matches a saved project,
      and the dropdown remains editable; an unknown id falls back to the no-param behaviour.
- [ ] Submitting `/tasks/new` posts to `/api/projects/{selectedProjectId}/tasks` and, on
      success, navigates to `/tasks?project=<selectedProjectId>`.
- [ ] Submitting with no project selected shows an inline validation message and sends no
      request; the existing empty-title validation still applies.
- [ ] When no projects are saved, `/tasks/new` explains that a project is required and links to
      `/projects/new` instead of offering a submittable form.
- [ ] `/projects/{id}/tasks` redirects to `/tasks?project={id}`, preserving a `page` search
      param when present, and still returns a 404 page for an unknown project id.
- [ ] `/projects/{id}/tasks/new` redirects to `/tasks/new?project={id}`.
- [ ] The projects list tasks icon, the project detail **Tasks** button, and the task detail
      breadcrumb and post-delete navigation all target `/tasks?project=<projectId>`.
- [ ] No task-list or task-form markup is duplicated: the per-project routes contain only
      redirect logic.
- [ ] `.agent/PROJECT_DOCUMENT.md` is updated for the new routes (Repository Structure and
      "Delivered session capabilities").

## Technical Notes

- Next.js 16 is newer than most training data: before writing routing code, read the relevant
  guides under `node_modules/next/dist/docs/01-app/` (redirects, `searchParams`, typed
  `PageProps`/`RouteContext` helpers). The codebase already uses `PageProps<"/tasks">`-style
  typed props and `export const dynamic = "force-dynamic"` on data-reading pages — follow both.
- `redirect()` from `next/navigation` works by throwing, so never call it inside a `try` block
  that catches the thrown control-flow error; compute the target inside the `try`, then redirect
  after it.
- Redirect pages should validate the project with `getProject(id)` and call `notFound()` when it
  is missing, matching today's behaviour. If the projects store throws (`ProjectStoreError`),
  redirect anyway — the global list renders its own store-error message.
- `/tasks/new` needs the project list on the server; use a server page (`listProjects()`,
  `force-dynamic`) that passes `{ id, name }[]` plus the requested project id into a
  `"use client"` form component colocated in `src/app/tasks/new/`. Do not fetch projects from
  the client; `listProjects` is `server-only`.
- Reuse the visual language of the existing form and of `ProjectFilter`: same input, select,
  button, error-banner and focus-ring classes, `BrandLink` header, breadcrumb link back to the
  task list, and a Cancel link.
- Keep the existing store/API error copy (`Project data could not be read…`, `Unable to reach
  the server…`) rather than inventing new wording.
- Keep every touched file under the repository's 600-line rule; extract components if a file
  approaches it.
- Do not change `data/*.json` shapes, the task API contract, task ids, or the plan flow
  (`planConsoleHref` / `use-plan-run.ts`).

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Manual: with several projects saved, `/tasks` → **New task** → dropdown has no
      preselection; pick a project, create a task, land on `/tasks?project=<id>` with the new
      task listed.
- [ ] Manual: with exactly one project saved, `/tasks/new` opens with that project preselected.
- [ ] Manual: `/projects/<id>/tasks` redirects to `/tasks?project=<id>`; `/projects/<id>/tasks?page=2`
      keeps the page; an unknown project id still shows the 404 page.
- [ ] Manual: `/projects/<id>/tasks/new` redirects to `/tasks/new?project=<id>` with that project
      preselected and still switchable.
- [ ] Manual: from a task detail page, the breadcrumb and a delete both land on
      `/tasks?project=<projectId>`.
