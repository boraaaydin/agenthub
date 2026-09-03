# Show task status in a table and set it to "Plan created" after a plan is registered

## Description

Two connected changes to task status handling:

1. **Status column in a real table** — render the `/tasks` list as an HTML `<table>` with a
   dedicated **Status** column, instead of today's card-style `<ul>` rows. Columns:
   Project, `#` (task id), Title, Status, Created, Actions. The detail preview line is dropped
   from the list (the title still links to the task detail page, which shows the full detail).
2. **A new `plan_created` task status** — add a fifth value to `TASK_STATUSES` labeled
   `Plan created`, and set a task to it automatically when a plan is registered for that task
   through `POST /api/plans`.

Today `/tasks` already shows a status badge inside a card row, and `TASK_STATUSES` is
`["open", "in_progress", "completed", "cancelled"]`. Registering a plan (the last step of every
planning session, and the manual `/plans/new` form) leaves the task's status untouched, so a
task that has been planned is indistinguishable from one that has not.

## Application

Root application (`agenthub`)

## Dependencies

None - This task is independent

## Context

Relevant existing pieces:

- `src/lib/task-filters.ts` — client-safe status source of truth: `TASK_STATUSES`,
  `TaskStatus`, `TaskFilterStatus` (`TaskStatus | "all"`), `DEFAULT_TASK_STATUS` (`"open"`),
  `TASK_STATUS_LABELS`, `isTaskStatus`, `taskStatusLabel`, `taskFilterStatus`, and the
  `tasksHref` / `newTaskHref` URL helpers. Everything status-related derives from this file.
- `src/lib/tasks-store.ts` — server-only persisted store over `data/tasks.json`. Re-exports
  `TaskStatus` / `TASK_STATUSES` from `task-filters.ts`; `isTask` validates a stored record with
  `isTaskStatus`; `normalizeTask` defaults a missing status to `DEFAULT_TASK_STATUS`;
  `taskPatch` accepts a `status` field validated with `isTaskStatus`; `updateTask` writes the
  status and sets `completedAt` to `new Date().toISOString()` for `"completed"` and `null`
  otherwise; `listAllTasks` / `listProjectTasks` paginate with an optional `status` filter;
  `getTask(projectId, taskId)` returns a single task. All writes go through `serializeWrite`.
- `src/app/tasks/page.tsx` — the single cross-project task list (server component,
  `export const dynamic = "force-dynamic"`). Contains `taskPreview`, `taskDate`,
  `statusBadgeClass` (a per-status Tailwind class map), and the `TaskRows` component that
  renders a `<ul className="divide-y …">` of `<li>` cards: project chip, status badge, `#id`,
  title, created date, detail preview, plus an absolutely positioned action cluster
  (`TaskStatusButton` and a **Create plan** link) overlaid on a full-row `Link` using
  `after:absolute after:inset-0`. Rows whose project no longer exists render as a plain
  non-interactive `div` with no actions. Below the list are the project/status filters, an
  empty state, and Previous/Next pagination.
- `src/app/tasks/task-status-button.tsx` — client component; PATCHes
  `/api/projects/{projectId}/tasks/{taskId}` with `{ status: nextStatus }` and calls
  `router.refresh()`. It toggles `open ⇄ completed` and **returns `null` for any other
  status**, so a `plan_created` task would otherwise lose its action button.
- `src/app/tasks/status-filter.tsx` — client `<select>` over `TASK_STATUSES` plus an `All`
  option; a new status appears there automatically.
- `src/app/projects/[id]/tasks/[taskId]/task-detail.tsx` — client task detail; shows
  `taskStatusLabel(taskStatus)` (line ~151) and has `changeTaskStatus` toggling
  `completed ⇄ open` with the message `"Task completed."` / `"Task reopened."`.
- `src/app/api/plans/route.ts` — `POST /api/plans` validates the body, resolves the project
  (`getProject`), verifies the task exists via `getTask` when the task id parses as a positive
  integer, then calls `createPlan({ ...input, projectId: project.id })` and returns the plan
  with `201`. This is the single entry point used by both the planning agent's closing `curl`
  and the manual `/plans/new` form, so the status update belongs here.
- `src/lib/plans-store.ts` — `planDetails` always requires a positive integer `taskId`, so a
  successfully created plan always references a real task of that project.
- `src/app/api/projects/[id]/tasks/[taskId]/route.ts` — `PATCH` handler backing the status
  buttons; it already accepts any valid `TaskStatus`.
- `.agent/PROJECT_DOCUMENT.md` — describes the task lifecycle status and the plan registration
  flow; it must be updated to describe the new status and the automatic transition.

Decisions already made for this task (do not re-open them):

- The new status is a distinct `plan_created` value, not a reuse of `in_progress`.
- A plan registration sets `plan_created` for tasks currently `open` or `in_progress`, and
  leaves `completed` and `cancelled` tasks untouched.
- The list becomes a table and the per-row detail preview is dropped.

## Acceptance Criteria

- [ ] `TASK_STATUSES` in `src/lib/task-filters.ts` is
      `["open", "plan_created", "in_progress", "completed", "cancelled"]`, and
      `TASK_STATUS_LABELS.plan_created` is `"Plan created"`. `DEFAULT_TASK_STATUS` stays `"open"`.
- [ ] The `/tasks` status filter offers **Plan created** and filtering by it returns exactly the
      tasks in that status; existing `?status=…`, `?all=true`, `?project=…`, and `?page=…`
      URL behavior is unchanged.
- [ ] Existing `data/tasks.json` records keep loading unchanged: a record with no `status` still
      normalizes to `open`, and every previously valid status remains valid.
- [ ] `/tasks` renders the list as a `<table>` with a `<thead>` whose header cells are
      Project, `#`, Title, Status, Created, and an actions column, and one `<tr>` per task.
- [ ] Each row shows: the project chip (or the unknown-project chip), the task id, the task
      title as a link to `/projects/{projectId}/tasks/{id}`, a status badge with the status
      label, the created date via the existing `taskDate` formatting, and the row actions
      (**Complete**/**Reopen** and **Create plan**).
- [ ] The per-row detail preview is removed from the list; `taskPreview` is deleted if it has
      no remaining caller.
- [ ] A task whose project no longer exists still renders as a row with the unknown-project
      chip and no action controls or title link, matching today's degraded behavior.
- [ ] `statusBadgeClass` returns a distinct, readable Tailwind class pair for `plan_created`
      (visually separate from `open`, `in_progress`, `completed`, and `cancelled`) and every
      status is covered without a `default` branch that silently hides a new status.
- [ ] `TaskStatusButton` renders a **Complete** action for a `plan_created` task (it must not
      return `null`); completing it still sets `completed`, and reopening still sets `open`.
- [ ] The table is usable on a narrow viewport: it either scrolls horizontally inside its own
      container or collapses to a stacked layout, and the page body never scrolls horizontally.
- [ ] Rows and controls stay keyboard reachable with a visible focus ring, and the table has an
      accessible name (e.g. `aria-label="All tasks"` or a caption).
- [ ] `POST /api/plans` sets the referenced task's status to `plan_created` after the plan record
      is created successfully, when that task's current status is `open` or `in_progress`.
- [ ] `POST /api/plans` leaves the task's status unchanged when it is already `plan_created`,
      `completed`, or `cancelled`.
- [ ] The status update never changes the endpoint's contract: the response is still `201` with
      the created plan JSON, and a failure to update the task status is logged server-side but
      does not fail the request or roll back the plan record.
- [ ] The transition applies to every caller of `POST /api/plans` — the planning session's
      closing `curl` and the manual `/plans/new` form alike.
- [ ] Editing a plan (`PATCH /api/plans/[planId]`), deleting a plan, and every other task or
      plan endpoint keep their current status behavior; no status is reverted when a plan is
      deleted or relinked.
- [ ] `.agent/PROJECT_DOCUMENT.md` records the new `plan_created` status, the automatic
      transition on plan registration (including which statuses are left untouched), and the
      table rendering of the `/tasks` list.

## Technical Notes

- Read `.agent/PROJECT_DOCUMENT.md` before implementing.
- Add the status in `src/lib/task-filters.ts` only; `tasks-store.ts` re-exports from there, and
  `isTaskStatus` already drives store validation, the `PATCH` body check, and the filter, so no
  parallel status list should be introduced.
- Order matters in `TASK_STATUSES`: it drives the `<option>` order in the status filter, so put
  `plan_created` between `open` and `in_progress`.
- Suggested badge colors, consistent with the existing palette (`emerald` completed, `sky`
  in progress, `slate` cancelled/open): `bg-violet-100 text-violet-800` for `plan_created`.
  Typing `statusBadgeClass` as `Record<TaskStatus, string>` (or an exhaustive `switch`) makes a
  future status a compile error rather than a silent fallback.
- Keep the table markup semantic (`<table>/<thead>/<tbody>/<tr>/<th scope="col">/<td>`). The
  current full-row overlay `Link` trick (`after:absolute after:inset-0`) does not translate to
  table rows — link the title cell instead of making the whole row clickable, which also keeps
  the action buttons simple.
- Wrap the table in an `overflow-x-auto` container so wide content scrolls inside the card
  rather than the page.
- In `src/app/api/plans/route.ts`, perform the status update after `createPlan` resolves, using
  the already-resolved `project.id` and the plan's `taskId`, and reuse the store's existing
  `getTask` + `updateTask(projectId, taskId, { status: "plan_created" })` rather than adding a
  new store function. Guard it in its own `try`/`catch` that logs (e.g.
  `console.error("Unable to mark the task as planned", error)`) and falls through to the `201`
  response, so a task-store failure cannot lose an already-persisted plan.
- `updateTask` already clears `completedAt` for any non-`completed` status, so no extra
  handling is needed for the new status.
- `TaskStatusButton`'s early `return null` guard must be relaxed to include `plan_created`
  (mapping it to the **Complete** action, i.e. `nextStatus = "completed"`); keep it returning
  `null` for `cancelled`.
- Do not change the task detail page's `completed ⇄ open` toggle semantics; it only needs to
  keep displaying whatever label the status resolves to.
- No data migration is needed: the new status only ever appears on records written after this
  change.
- Next.js 16 is newer than most training data — check `node_modules/next/dist/docs/` before
  writing new Next.js APIs.
- Keep every touched file under 600 lines; if `src/app/tasks/page.tsx` grows past that, extract
  the table into a colocated `src/app/tasks/task-table.tsx`.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Manual: open `http://localhost:3000/tasks` and confirm the list renders as a table with the
      Project, `#`, Title, Status, Created, and actions columns, and that the status filter now
      lists **Plan created** and filters correctly.
- [ ] Manual: narrow the browser window and confirm the table scrolls inside its container while
      the page itself does not scroll horizontally.
- [ ] Manual: with a saved project id and an `open` task id, run
      `curl -s -X POST http://localhost:3000/api/plans -H "Content-Type: application/json" -d '{"projectId":"…","taskId":…,"title":"Status check","filePath":".agent/tasks/example.md","summary":"Manual check."}'`,
      confirm a `201` response, and confirm the task now shows **Plan created** in `/tasks` and on
      its detail page.
- [ ] Manual: repeat the same `POST` against a `completed` task and confirm the response is still
      `201` while the task stays **Completed**.
- [ ] Manual: click **Complete** on a `plan_created` row and confirm it becomes **Completed**, and
      that **Reopen** returns it to **Open**.
- [ ] Manual: run a full planning session from a task's **Create plan** button and confirm that
      after the agent registers the plan, the task's status is **Plan created** in `/tasks`.
