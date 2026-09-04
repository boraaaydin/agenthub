# Add an "Execute task" action to workitems and drop the Plan column

---
**Execution Guidelines**: Before starting this task, ensure you've read `.agent/commands/tasks/do-task.md` (if not already read in this session). This file contains essential guidelines on how to properly execute tasks, including dependency checking, verification steps, and archival procedures.

**Application-specific documentation**: This task targets the root application, so read `.agent/PROJECT_DOCUMENT.md` before starting. There is no `apps/` directory in this repository; the project document at `.agent/PROJECT_DOCUMENT.md` is the application document for this task.
---

## Description

Two changes to the Workitems screens, both from GitHub issue #26:

1. **Remove the `Plan` column** from the `/workitems` table. That column currently shows the
   latest registered task's status as a badge linking to `/tasks/{taskId}`, plus a `+N` hint when
   the workitem has more than one task. The whole column (header cell and body cell) goes away.
2. **Add an "Execute task" action** to the workitem `Actions` column and to the workitem detail
   page. It does exactly what the `Execute task` link on `/tasks` does today: navigate to
   `taskConsoleHref(taskId)` (`/console?runTaskId={taskId}`), which the console picks up through
   `useTaskRun` to start the configured Task agent with the composed execution prompt. The action
   is rendered **only when the workitem's status is `task_created`** and a registered task exists
   for that workitem; in every other status it is not rendered at all.

The task the action runs is the **latest registered task** for the workitem — the same record the
removed `Plan` column pointed at (`listLatestTasksByWorkitem()` picks the task with the greatest
`createdAt` per `projectId:workitemId` key).

Note the consequence of change 1: after the column is removed, the workitems list no longer links
to a workitem's task record. The link in the other direction stays (`/tasks` rows link back to
`Workitem #{id}`), and the new **Execute task** action is the workitem list's only remaining task
affordance. This is the behaviour requested in the issue.

## Application

Root application (`agenthub`)

## GitHub Issue

- Issue #26

Note: the issue title ("Workitems ekranında plans sütununu kaldır") and the issue body (execute
task button) describe two different changes. The user confirmed that **both** are in scope for
this task, and that "task detay sayfası" in the body means the **workitem** detail page
(`/projects/[id]/workitems/[workitemId]`), not the registered-task detail page (`/tasks/[taskId]`).

## Dependencies

None - This task is independent

## Context

### Where the pieces live

- `src/app/workitems/page.tsx` (290 lines) — server-rendered workitems table.
  - `WorkitemRows` receives `projectNames`, `workitems`, and `tasksByWorkitem`.
  - Columns today: `Project`, `#`, `Title`, `Status`, `Plan`, `Created`, `Actions`.
  - The `Plan` cell reads `tasksByWorkitem.get(taskWorkitemKey(workitem.projectId, workitem.id))`
    and renders a `taskStatusBadgeClass` badge linking to `taskDetailHref(taskInfo.task.id)`, with
    `+{taskCount - 1}` when there is more than one task, else an em dash.
  - The `Actions` cell renders, only when the project is known, a `WorkitemStatusButton` and a
    `Create plan` link to `planConsoleHref(workitem.projectId, workitem.id)`, inside
    `<div className="flex flex-wrap gap-2">`.
  - `WorkitemsPage` already loads `tasksByWorkitem` in its own `try`/`catch`
    (`listLatestTasksByWorkitem()`, failure logged and degraded to an empty map) — that call must
    stay, because the new action needs the task id.
- `src/lib/tasks-store.ts` (395 lines) — `listLatestTasksByWorkitem()`, `taskWorkitemKey()`,
  `getTask()`, `LatestTasksByWorkitem = Map<string, { task: Task; taskCount: number }>`.
- `src/lib/task-execution.ts` (5 lines, dense one-line style) — exports
  `taskConsoleHref(taskId: number)` → `/console?runTaskId={taskId}`. Client-safe; already imported
  by `src/app/tasks/page.tsx`.
- `src/app/tasks/page.tsx` — the reference implementation of the action (`Execute task` link at
  lines 63-74): a plain `Link` to `taskConsoleHref(task.id)` when the project is known, and a
  muted `aria-disabled` span when it is not.
- `src/app/projects/[id]/workitems/[workitemId]/page.tsx` — server component; validates the
  workitem id, loads `getProject(id)` and `getWorkitem(id, parsedWorkitemId)`, renders the error
  screen on store failures, and returns
  `<WorkitemDetail key={workitem.id} projectName={...} projectColor={...} workitem={workitem} />`.
- `src/app/projects/[id]/workitems/[workitemId]/workitem-detail.tsx` (287 lines) — client
  component. Its header holds a `Status` `<select>` bound to the `workitemStatus` state and, beside
  it, a `Create plan` link (`h-10 rounded-xl border border-sky-200 …`) inside
  `<div className="mt-4 flex flex-wrap items-end gap-3">`. `changeWorkitemStatus` updates
  `workitemStatus` locally and calls `router.refresh()`.
- `src/lib/workitem-filters.ts` — `WORKITEM_STATUSES` = `open`, `task_creating`, `task_created`,
  `in_progress`, `completed`, `cancelled`.
- `src/app/workitems/workitem-live-updates.tsx` + `src/lib/workitem-events.ts` — workitem changes
  are broadcast over the agent WebSocket and refresh the open list.
- `src/app/console/use-task-run.ts` — consumes `runTaskId`, fetches
  `/api/tasks/{taskId}/execution-prompt`, starts the session, and `router.replace("/console")`.
  Nothing here changes.

### Documentation

`.agent/PROJECT_DOCUMENT.md` line 204 (in **Delivered session capabilities**) still describes this
screen in pre-rename wording and claims "Its Plan column links to the latest registered plan for
each task and indicates any additional plans." That sentence describes the column being removed and
must be replaced by a description of the new action.

## Acceptance Criteria

- [ ] The `/workitems` table no longer has a `Plan` column: neither the `<th>` header cell nor the
      matching `<td>` body cell exists, and the table header order becomes
      `Project`, `#`, `Title`, `Status`, `Created`, `Actions`.
- [ ] Imports that the column removal leaves unused are deleted from `src/app/workitems/page.tsx`
      (`taskDetailHref`, `taskStatusBadgeClass`, and `taskStatusLabel` from `@/lib/task-filters`),
      and `pnpm lint` reports no unused-import or unused-variable errors.
- [ ] `listLatestTasksByWorkitem()` is still called by `WorkitemsPage` and its result is still
      passed into `WorkitemRows`, because the new action resolves the task id from it.
- [ ] Each `/workitems` row whose workitem status is `task_created` **and** which has a registered
      task shows an `Execute task` action in the `Actions` cell, linking to
      `taskConsoleHref(latestTask.id)`.
- [ ] Rows in any other workitem status (`open`, `task_creating`, `in_progress`, `completed`,
      `cancelled`) show no `Execute task` action, and neither do `task_created` rows that have no
      registered task.
- [ ] The list action sits alongside the existing `WorkitemStatusButton` and `Create plan` controls
      in the same `flex flex-wrap gap-2` container and matches the `Create plan` link's sizing and
      styling (`inline-flex h-9 items-center rounded-lg … px-3 text-sm font-medium`).
- [ ] The workitem detail page (`/projects/[id]/workitems/[workitemId]`) shows the same
      `Execute task` action beside its `Create plan` link, styled to match that link
      (`inline-flex h-10 items-center rounded-xl … px-4 text-sm font-medium`).
- [ ] The detail-page action follows the component's live `workitemStatus` state, not just the
      server-rendered value: switching the `Status` select to `Task created` reveals it (when a task
      exists) and switching away hides it, without a full page reload.
- [ ] The detail page renders no `Execute task` action when the workitem has no registered task,
      whatever its status.
- [ ] The workitem detail server page resolves the latest task for that workitem and passes its id
      to `WorkitemDetail` through a new optional prop; a failure while reading task data is caught
      and logged, leaves the rest of the page working, and simply omits the action (it must not
      turn the page into the error screen or a 404).
- [ ] The `Create plan` link, `WorkitemStatusButton`, status select, save/cancel form, delete
      section, pagination, filters, and live updates are unchanged in behaviour.
- [ ] `/tasks` and its own `Execute task` link, `taskConsoleHref`, `useTaskRun`, and
      `/api/tasks/[taskId]/execution-prompt` are unchanged.
- [ ] No route, API response shape, store schema, or `data/*.json` file changes.
- [ ] Every touched file stays under 600 lines.
- [ ] `.agent/PROJECT_DOCUMENT.md` line 204 no longer claims the workitems list has a Plan column;
      it states instead that a workitem in `Task created` offers an `Execute task` action (on both
      the list and the workitem detail page) that runs its latest registered task in the console.

## Technical Notes

- Read `.agent/PROJECT_DOCUMENT.md` before implementing, and heed its Next.js caution: the
  installed Next.js (16.3.4) is newer than most training data — check
  `node_modules/next/dist/docs/` before writing framework-level code. This task only touches
  ordinary server/client components, so no new framework APIs should be needed.
- Suggested shape for resolving the task on the detail page — add to `src/lib/tasks-store.ts`,
  next to `listLatestTasksByWorkitem`:

  ```ts
  export async function getLatestTaskForWorkitem(projectId: string, workitemId: number): Promise<Task | null>;
  ```

  implemented over the same `readDocument()` + `normalizeTask` path, returning the task with the
  greatest `createdAt` for that `projectId`/`workitemId` pair, or `null`. Reusing
  `listLatestTasksByWorkitem()` with `taskWorkitemKey` in the page is an acceptable alternative;
  do not introduce a second, differently-behaving "latest" rule.
- In the detail page, wrap the task lookup in its own `try`/`catch` (mirroring how
  `WorkitemsPage` isolates its `listLatestTasksByWorkitem()` call) so task-store trouble never
  blocks editing a workitem.
- Pass the id down as a nullable prop, e.g. `executableTaskId?: number | null`, and gate rendering
  on `workitemStatus === "task_created" && executableTaskId != null` inside `WorkitemDetail` so the
  visibility tracks the component's state.
- `taskConsoleHref` is client-safe (`src/lib/task-execution.ts` imports only
  `@/lib/prompt-tokens`), so it can be imported from the client `workitem-detail.tsx` as well as
  the server `workitems/page.tsx`.
- Both actions are plain `next/link` navigations — no `fetch`, no client state, no new API call.
  Do not disable them while other controls are submitting; the existing `Create plan` link is the
  precedent.
- Keep the table's `min-w-[860px]` as it is; the removed column is narrow and the remaining six
  columns still need the horizontal scroll container.
- Do not change how a plan/task is registered, how workitem statuses transition, or the
  `Create plan` visibility rules — the issue does not ask for that.
- Do not comment on or close GitHub issue #26 as part of implementation; close-out is handled by
  `.agent/commands/tasks/do-task-post.md`.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Manual: with `pnpm dev` running, open `/workitems` and confirm the table header reads
      `Project`, `#`, `Title`, `Status`, `Created`, `Actions` with no `Plan` column.
- [ ] Manual: for a workitem whose status is `Task created` and which has a registered task,
      confirm the `Actions` cell shows `Execute task`, that it points at
      `/console?runTaskId={taskId}` with the latest task's id, and that following it starts a Task
      agent session in the console.
- [ ] Manual: confirm no `Execute task` action appears for workitems in `Open`, `Task creating`,
      `In progress`, `Completed`, or `Cancelled`, nor for a `Task created` workitem with no task
      record (delete its task from `/tasks` to check).
- [ ] Manual: open that workitem's detail page, confirm `Execute task` appears beside
      `Create plan`, switch the `Status` select to another value and confirm the action disappears
      without a reload, then switch back to `Task created` and confirm it returns.
- [ ] Manual: confirm `/tasks` still shows its own `Execute task` link and that it still works.
