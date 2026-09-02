# Add a global task list page with a project filter and a Tasks button in the header

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

Today a task list only exists per project, at `/projects/{projectId}/tasks`. There is no way to
see the work queued across every project at once.

Add a **global task list page at `/tasks`** that lists the tasks of all projects on one screen:

- a **project dropdown at the top** filters the list down to a single project (default: all
  projects),
- every row shows **which project the task belongs to**,
- a **"Tasks" button is added to the header** button group on the home page and the projects
  list page, linking to `/tasks`.

Decisions already made with the user (do not re-litigate them):

- **Header button scope**: the "Tasks" link is added to the existing nav button group on the
  home page (`src/app/page.tsx`) and the projects list page (`src/app/projects/page.tsx`) only.
  Do **not** introduce a shared header nav component and do **not** add the link to the other
  page headers (project detail, task detail, settings, console).
- **URL-param, server-rendered filter**: `/tasks` is a server component that reads `?project=`
  and `?page=` from the URL, exactly like the existing paginated project task list. The
  dropdown is a small `"use client"` component that navigates on change. Do **not** build a
  client-side fetch-and-filter screen and do **not** add a new API route.
- **Row content**: reuse the existing row layout from the project task list (`#id`, title,
  created date, detail preview) and add the project name to the row. The whole row links to
  `/projects/{projectId}/tasks/{taskId}` — the project name is part of that same link, not a
  separate link.

## Application

Root application (`agenthub`) — single Next.js app in `src/`. No `apps/` subdirectory exists.

## GitHub Issue

- Issue #13 — "task listesi genel" (a screen that lists the tasks of all projects; a projects
  dropdown as a filter at the top; the list should show which project each task belongs to; add
  a tasks button to the header)

## Dependencies

None - This task is independent.

## Context

### Existing pieces to build on

| File | What it already provides |
| --- | --- |
| `src/lib/tasks-store.ts` | `Task` (`id: number`, `projectId`, `title`, `detail`, `createdAt`, `updatedAt`), `PaginatedTasks`, `listProjectTasks(projectId, { page, pageSize })`, `TASKS_PAGE_SIZE = 10`, `normalizePage` / `normalizePageSize` helpers, `TaskStoreError` |
| `src/lib/projects-store.ts` | `listProjects(): Promise<Project[]>`, `Project` (`id`, `name`, `path`, `createdAt`), `ProjectStoreError` |
| `src/app/projects/[id]/tasks/page.tsx` | The row layout (`TaskRows`), `taskPreview()`, `taskDate()`, the empty state, the Previous/Next pagination nav, and the store-error handling to copy from |
| `src/app/page.tsx`, `src/app/projects/page.tsx` | The header nav button group the "Tasks" link joins |
| `src/app/settings/settings-form.tsx`, `src/app/console/agent-console.tsx` | The `<select>` styling used across the app |

Task ids are **globally** sequential (`createTask` takes `max(id) + 1` across all tasks), so
`#{task.id}` is unambiguous on a cross-project list — no project prefix is needed on the number.

### 1. Store: list tasks across all projects

Add to `src/lib/tasks-store.ts`:

```ts
export async function listAllTasks(
  { page, pageSize, projectId }: PaginationInput & { projectId?: string },
): Promise<PaginatedTasks>
```

- Reads the document once, filters by `projectId` when one is given, sorts by `createdAt`
  descending (same comparator as `listProjectTasks`), then paginates with the existing
  `normalizePage` / `normalizePageSize` helpers.
- To avoid two near-identical bodies, factor the shared "filter → sort → slice" logic into one
  private helper and have both `listProjectTasks` and `listAllTasks` call it.
  `listProjectTasks` must keep its current signature and behaviour — nothing else in the app
  changes.

### 2. Route: `src/app/tasks/page.tsx` (server component)

- `export const dynamic = "force-dynamic";` like the other data pages.
- Read `props.searchParams`; both params may arrive as `string | string[] | undefined`, so take
  `Array.isArray(x) ? x[0] : x` the way the project task page already does.
  - `page` → `Number.parseInt(..., 10)`, fall back to `1` when it is not a positive integer.
  - `project` → the project id to filter by.
- Load `listProjects()` first. Validate the requested `project` against that list: if it does
  not match a saved project, **ignore the filter** and render the unfiltered list with the
  dropdown back on "All projects". Do not 404.
- Call `listAllTasks({ page, pageSize: TASKS_PAGE_SIZE, projectId })`.
- Build a `Map<string, string>` of project id → name for the row labels.
- Wrap the loads in `try/catch` and reuse the error copy already used elsewhere:
  `ProjectStoreError` → "Project data could not be read. Check data/projects.json and reload
  this page."; `TaskStoreError` → "Task data could not be read. Check data/tasks.json and reload
  this page."; anything else → "Tasks could not be loaded. Reload this page and try again."
  Render it in the same `role="alert"` red panel.
- Page shell matches the other pages: `<main className="min-h-screen bg-[#f4f6fa] px-4 py-6
  text-slate-900 sm:px-6 sm:py-10">`, inner `mx-auto flex w-full max-w-5xl flex-col gap-8`,
  header with `<BrandLink />` (import from `../brand-link`), an `<h1>` reading `Tasks`
  (exactly one `<h1>` on the page) and a one-line description such as "Every task across your
  saved projects."

### 3. Project filter dropdown — `src/app/tasks/project-filter.tsx`

A `"use client"` component that receives `projects: { id: string; name: string }[]` and
`selectedProjectId: string` (empty string = all).

- A labelled `<select>` (`<label htmlFor="project-filter">Project</label>`) whose first option
  is `<option value="">All projects</option>` followed by one option per project.
- Styling: the same classes the app already uses —
  `h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition
  focus:border-sky-600 focus:ring-3 focus:ring-sky-100`.
- On change, navigate with `useRouter()` from `next/navigation`: build the target with
  `URLSearchParams`, set `project` when a project is chosen and delete it for "All projects",
  and **always drop `page`** so the filtered list starts at page 1. Use `router.push(...)` so
  Back returns to the previous filter.
- Place it above the list, in its own row under the header, capped in width (e.g. a `sm:max-w-xs`
  wrapper) so it does not stretch across the whole page.

### 4. Rows

Copy `TaskRows`, `taskPreview()` and `taskDate()` from `src/app/projects/[id]/tasks/page.tsx`
into the new page and add the project name. Keep the whole row a single `<Link>` to
`/projects/${task.projectId}/tasks/${task.id}`.

- Project name goes on the row as a badge before the `#id`, e.g.
  `<span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium
  text-slate-600">{projectName}</span>` inside the existing
  `flex min-w-0 items-baseline gap-2` container. Keep `#{task.id}` in `tabular-nums` and keep
  the title's `min-w-0 break-words`.
- Rows are `<h2>` titles today — keep that; the new page has one `<h1>` and many `<h2>`s.
- **Orphaned tasks**: a project can be deleted while its tasks are kept, so a task's
  `projectId` may match no project. Label those rows `Unknown project` and render them as a
  plain `<div>` row (same markup, no `<Link>`, no hover/focus classes), since the target task
  detail route would 404. They appear only under "All projects" — the dropdown lists saved
  projects only.

### 5. Empty states and pagination

- No tasks at all (`total === 0` with no filter): the dashed-border empty panel used on the
  project task list, headed "No tasks yet", body text pointing the user at a project ("Add a
  task from a project to see it here."), plus a link to `/projects`. There is deliberately **no**
  "New task" button on this page — creating a task requires picking a project first.
- No tasks for the selected project (`total === 0` with a filter): the same panel, headed
  "No tasks for this project", with a link that clears the filter (`/tasks`).
- Pagination: reuse the Previous / Next nav and the "Page X of Y" line verbatim, but the hrefs
  **must preserve the `project` param** — build them with `URLSearchParams` (e.g.
  `?project=abc&page=2`) instead of the bare `?page=` used on the project page. Disabled edges
  keep the existing greyed `<span aria-disabled="true">` treatment.

### 6. Header button

Add to the nav button group in both `src/app/page.tsx` and `src/app/projects/page.tsx`:

```tsx
<Link href="/tasks" className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100">
  Tasks
</Link>
```

Place it after "Open console" and before the group's last item, so the primary/last action on
each page keeps its position ("Projects" on the home page, the sky-filled "New project" on the
projects page).

## Acceptance Criteria

- [ ] `listAllTasks({ page, pageSize, projectId? })` exists in `src/lib/tasks-store.ts`,
      returns `PaginatedTasks`, sorts by `createdAt` descending and honours the optional
      `projectId` filter.
- [ ] `listProjectTasks` keeps its signature and behaviour; the shared filter/sort/paginate
      logic is written once, not duplicated.
- [ ] `/tasks` renders a server-rendered list of tasks from **all** projects, newest first,
      paginated at `TASKS_PAGE_SIZE` (10) per page.
- [ ] Each row shows the project name, `#{task.id}`, the title, the created date and the detail
      preview, and the whole row links to `/projects/{projectId}/tasks/{taskId}`.
- [ ] A project dropdown sits above the list with "All projects" selected by default; choosing
      a project sets `?project={id}` in the URL, resets to page 1, and narrows the list to that
      project's tasks.
- [ ] Loading `/tasks?project={id}` directly renders the dropdown with that project already
      selected and the list already filtered (the filter is URL state, not component state).
- [ ] `/tasks?project=does-not-exist` renders the full unfiltered list with "All projects"
      selected — no 404, no crash.
- [ ] Previous / Next links preserve the active `project` filter, and the edges are shown as
      disabled spans on the first and last page.
- [ ] A task whose project has been deleted is labelled "Unknown project" and its row is not a
      link.
- [ ] `/tasks` with no tasks at all shows the "No tasks yet" empty panel; `/tasks?project={id}`
      with no tasks in that project shows the "No tasks for this project" panel with a link
      that clears the filter.
- [ ] Unreadable `data/tasks.json` or `data/projects.json` surfaces the existing red
      `role="alert"` message instead of a crash.
- [ ] The home page and the projects list page both show a "Tasks" button in their header
      button group that navigates to `/tasks`. No other page header is changed.
- [ ] No new API route is added; `/tasks` reads the stores directly on the server.
- [ ] `.agent/PROJECT_DOCUMENT.md` is updated: add `src/app/tasks/` (global task list with a
      project filter) to the "Repository Structure" tree and note the cross-project task list
      under "Delivered session capabilities".

## Technical Notes

- The installed Next.js is newer than most training data — consult
  `node_modules/next/dist/docs/` before writing any Next.js-specific code (see `AGENTS.md`).
  In particular, `params` and `searchParams` are promises in this version and the app uses the
  generated `PageProps<"/route">` helper type (see `src/app/projects/[id]/tasks/page.tsx`);
  follow that for `PageProps<"/tasks">`.
- Keep the page a server component. Only the dropdown is `"use client"` — do not mark the page
  itself as a client component and do not fetch from the page with `fetch`.
- The store is `import "server-only"` — never import `tasks-store` or `projects-store` from the
  client filter component. Pass plain serialisable props (`{ id, name }[]`) into it.
- Sorting uses the existing `second.createdAt.localeCompare(first.createdAt)` comparator; do
  not switch the sort to `id`.
- No `any`, no non-null assertions — match the project's existing type-safety conventions.
- Follow the existing Tailwind vocabulary (`rounded-xl`, `border-slate-200`, `bg-white`,
  `shadow-sm`, `focus:ring-3 focus:ring-sky-100`, `h-11` controls); do not introduce new colour
  or spacing scales.
- Respect the project's 600-line-per-file guideline — if `src/app/tasks/page.tsx` grows past a
  comfortable size, split the rows into a colocated `task-rows.tsx` under `src/app/tasks/`.
- Do not touch the WebSocket protocol, `server/`, `src/lib/settings-store.ts`, the console
  routes, or any existing API route.
- Do not change how tasks are created, edited or deleted; this task is read-only over the
  existing task data.

## Verification

- Ensure the verification steps in `.agent/PROJECT_DOCUMENT.md` are performed.
- `pnpm build` completes with no compilation or type errors.
- `pnpm lint` passes; fix any errors it reports.
- Run `pnpm dev` and walk the flow manually:
  - Create tasks in two different projects, then open `/tasks` → both projects' tasks appear in
    one list, newest first, each row labelled with its project name.
  - Click the "Tasks" button in the home page header and in the projects page header → both
    land on `/tasks`.
  - Pick a project in the dropdown → the URL gains `?project={id}`, the list narrows, and the
    page resets to 1. Switch back to "All projects" → the param disappears and the full list
    returns.
  - Reload the page while a filter is active → the dropdown is still on that project.
  - Create more than 10 tasks (or lower `TASKS_PAGE_SIZE` temporarily) → Next/Previous work and
    keep the `project` param across pages.
  - Click a row → it opens that task's detail page under its own project.
  - Delete a project while keeping its tasks → those rows read "Unknown project" and are not
    clickable; the rest of the list is unaffected.
  - Visit `/tasks?project=does-not-exist` → the unfiltered list renders.
- There are no automated tests in this project; the manual walkthrough above is the test.
