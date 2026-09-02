# Add task completion status, a close/reopen button, and a status filter

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

Tasks currently have no lifecycle state: `data/tasks.json` records carry only `id`,
`projectId`, `title`, `detail`, `createdAt` and `updatedAt`. A task stays on `/tasks`
forever, and the only way to remove it from the list is to delete it.

After this task:

- Every task carries a **`status`** field with a fixed set of values, plus a
  **`completedAt`** timestamp.
- The **task list rows** (`/tasks`) and the **task detail page**
  (`/projects/[id]/tasks/[taskId]`) each get a button that closes an open task
  ("Complete") and reopens a completed one ("Reopen").
- `/tasks` gets a **status dropdown** next to the existing project filter. It defaults to
  **Open**, so uncompleted tasks are what a visitor sees without touching anything, and it
  offers an **All** option plus one option per status.
- The status filter lives in the URL (like the existing `project` filter) and survives
  pagination.

Decisions already made with the user (do not re-litigate them):

- **Status is an enum, not a boolean.** `TaskStatus = "open" | "in_progress" | "completed" | "cancelled"`.
  Only `open` and `completed` are reachable from the UI in this task; the other two exist so
  further states can be added later without another data migration.
- **Existing records are not rewritten.** The store's validator treats `status` and
  `completedAt` as optional on read and normalizes a missing `status` to `"open"` and a
  missing `completedAt` to `null`. `data/tasks.json` is left untouched until each record is
  next written. No backfill pass, no migration script.
- **The filter defaults to Open**, and an explicit **All** option exists.
- **The button toggles.** "Complete" on an open task, "Reopen" on a completed one, in both
  places. No one-way close.

## Application

Root application (this repository is a single Next.js app; there is no `apps/` directory).

## GitHub Issue

- Issue #20

## Dependencies

None - This task is independent

## Context

Files that matter here:

- `src/lib/tasks-store.ts` (244 lines) — the `Task` type, the `isTask` validator,
  `paginateTasks`, `listAllTasks`, `listProjectTasks`, `createTask`, `updateTask`.
  Writes go through `serializeWrite` and the whole document is rewritten each time.
- `src/app/tasks/page.tsx` (228 lines) — server component for `/tasks`. Reads
  `searchParams.project` / `searchParams.page`, calls `listAllTasks`, renders `TaskRows`,
  the empty state and the pagination nav (`paginationHref`).
- `src/app/tasks/project-filter.tsx` — client component; a `<select>` that pushes
  `/tasks?project=…` and drops `page`.
- `src/app/projects/[id]/tasks/[taskId]/task-detail.tsx` (215 lines) — client component for
  the detail page. Already does `fetch(taskApiPath, { method: "PATCH", body: { title, detail } })`
  followed by `router.refresh()`, and holds the delete-confirm section.
- `src/app/api/projects/[id]/tasks/[taskId]/route.ts` — `PATCH` and `DELETE` handlers.
- `src/app/projects/[id]/tasks/page.tsx` — redirects `/projects/[id]/tasks` to
  `/tasks?project=…`; it forwards `page` and must now forward `status` too.

Important constraint on the API: `updateTask` currently calls `taskDetails(input)`, which
**requires** both `title` and `detail`. A status-only `PATCH` would fail validation today,
so the update path has to accept a partial patch before the buttons can work.

Next.js here is 16.3.4 — newer than most training data. Read the relevant guide under
`node_modules/next/dist/docs/` before touching routing, `searchParams`, or Route Handler
signatures. Keep the existing typed `PageProps<…>` / `RouteContext<…>` helpers.

## Acceptance Criteria

### Store (`src/lib/tasks-store.ts`)

- [ ] Export `TaskStatus` (`"open" | "in_progress" | "completed" | "cancelled"`) and a
      `TASK_STATUSES` array holding the four values in display order, so the UI can render
      the dropdown from a single source.
- [ ] `Task` gains `status: TaskStatus` and `completedAt: string | null`.
- [ ] `isTask` accepts records where `status` / `completedAt` are absent, and rejects a
      `status` that is present but not one of the four values.
- [ ] Reading normalizes every record: missing/absent `status` → `"open"`, missing
      `completedAt` → `null`. Nothing downstream ever sees an undefined status.
- [ ] `createTask` writes `status: "open"` and `completedAt: null`.
- [ ] The update path accepts a **partial** patch: `{ title, detail }`, `{ status }`, or all
      three. Validate only the fields present; reject an empty patch and an unknown status
      with `TaskValidationError`. Existing title/detail validation messages stay as they are
      ("Enter a task title." / "Enter task details.").
- [ ] Setting `status` to `"completed"` stamps `completedAt` with the current ISO timestamp;
      moving to any other status clears it back to `null`. `updatedAt` is refreshed as today.
- [ ] `paginateTasks` / `listAllTasks` / `listProjectTasks` accept an optional `status`
      filter and apply it alongside the existing `projectId` filter, before pagination — so
      `total` and `totalPages` reflect the filtered set.

### API (`src/app/api/projects/[id]/tasks/[taskId]/route.ts`)

- [ ] `PATCH` accepts a body carrying only `status` and returns the updated task.
- [ ] `PATCH` still accepts the existing `{ title, detail }` body from the edit form, with
      unchanged behaviour and status codes (400 on validation error, 404 on unknown task).

### Task list (`/tasks`)

- [ ] A status `<select>` sits beside the project filter: **All** plus one option per value
      of `TASK_STATUSES` ("Open", "In progress", "Completed", "Cancelled").
- [ ] With no `status` search param the page shows **open** tasks only, and the dropdown
      shows "Open" as selected.
- [ ] Selecting a status pushes `/tasks?status=…` (keeping the current `project` value and
      dropping `page`); selecting **All** removes the `status` param.
- [ ] An unrecognized `status` param falls back to the default (open) rather than erroring.
- [ ] Pagination links, the "New task" link and the empty-state links all preserve both the
      `project` and the `status` params.
- [ ] Each row shows its status — a small badge alongside the existing project/#id chips.
      Completed rows are visually distinct (e.g. muted title / emerald badge).
- [ ] Each row carries a button next to "Create plan": **Complete** for an open task,
      **Reopen** for a completed one. It `PATCH`es the task and refreshes the list, so with
      the default filter a completed task disappears from the list.
- [ ] The button is a client component (`/tasks` stays a server component), disables itself
      while the request is in flight, and surfaces a failure instead of silently doing
      nothing.
- [ ] Clicking the button must not navigate to the task detail page — the row's full-bleed
      `after:absolute after:inset-0` overlay link currently covers the row, so the button
      needs to sit above it the way the "Create plan" link already does.
- [ ] The empty state still reads sensibly when a filter hides everything (e.g. "No open
      tasks" / a hint to switch the filter), and the "no tasks at all" copy is unchanged.

### Task detail page

- [ ] The header shows the task's current status.
- [ ] A **Complete** / **Reopen** button sits in the header area next to "Create plan",
      separate from the title/detail form so it does not submit unsaved edits.
- [ ] Pressing it `PATCH`es `{ status }`, updates the visible state, and reports errors
      through the same error/status message elements the form already uses.
- [ ] When a task is completed, its completion date is visible on the page.
- [ ] Saving the title/detail form does not change the status.

### Redirect route

- [ ] `/projects/[id]/tasks` forwards a `status` search param to `/tasks` alongside `page`.

### Documentation

- [ ] `.agent/PROJECT_DOCUMENT.md` is updated: the tasks paragraph under "Architecture"
      mentions the status field and status filtering, and "Delivered session capabilities"
      records that tasks can be completed and reopened and that the list defaults to open
      tasks.

## Technical Notes

- Keep the URL-building logic in one place. A small client-safe helper (e.g.
  `src/lib/task-filters.ts` exporting `tasksHref({ projectId, status, page })` plus the
  status labels) used by `page.tsx`, `project-filter.tsx` and the new status filter avoids
  three copies of `URLSearchParams` juggling drifting apart. `project-filter.tsx` stays —
  extend it to preserve the active status rather than replacing it.
- Follow the existing visual language: `h-11 rounded-xl` controls, `border-slate-300`,
  `focus:ring-3 focus:ring-sky-100`, sky-700 primaries, emerald for success-ish states.
  Status badges should look like the existing `rounded-md bg-slate-100 px-2 py-0.5 text-xs`
  project chip.
- The status button on a list row is the only interactive element inside a row that is
  otherwise one big link. Mirror the "Create plan" wrapper (`relative z-10` block, absolutely
  positioned on `sm:`) and widen the link's `sm:pr-36` padding so the two controls fit
  without overlapping the row text.
- `serializeWrite` exists because the whole JSON document is rewritten per mutation — route
  every new write through it; never write `data/tasks.json` directly.
- Do not introduce a status-specific API route. Extend the existing `PATCH`; the store owns
  the `completedAt` bookkeeping so no caller can set an inconsistent pair.
- Server components on these routes are `export const dynamic = "force-dynamic"` — keep that.
- Do not touch `data/tasks.json` by hand. Existing records must keep working untouched; the
  first write to a given task is what adds its fields.
- Keep files under the project's 600-line rule; `page.tsx` and `task-detail.tsx` are the two
  that will grow, so extract the new pieces into their own components rather than inlining
  them.

## Verification

- `pnpm build` completes with no compilation or type errors.
- `pnpm lint` passes with no new errors or warnings.
- Manual check at `http://localhost:3000/tasks` (`pnpm dev`):
  - existing tasks — written before this change and still lacking `status` in
    `data/tasks.json` — appear as Open;
  - completing a task from a list row removes it from the default view and its record in
    `data/tasks.json` gains `status: "completed"` and a `completedAt` timestamp;
  - the Completed filter shows it, the Reopen button there returns it to Open and clears
    `completedAt`;
  - the filter survives paging forward and back, and combines with the project filter;
  - the detail page's Complete/Reopen button works and the title/detail form still saves.
