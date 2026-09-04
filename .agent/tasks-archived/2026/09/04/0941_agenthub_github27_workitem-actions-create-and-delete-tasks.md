# Rework the workitem Actions: Create task, Delete tasks, and smaller buttons

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

Four changes to the workitem action controls, from GitHub issue #27. They apply to **both** the
`/workitems` list `Actions` cell and the workitem detail page
(`/projects/[id]/workitems/[workitemId]`), which today carry the same pair of controls.

1. **Rename `Create plan` to `Create task`.** Label only — the link still points at
   `planConsoleHref(projectId, workitemId)` and the plan-creation flow behind it is unchanged.
2. **Hide `Create task` once a task is being or has been created.** It is not rendered when the
   workitem status is `task_creating` or `task_created`, and it is not rendered when the workitem
   already has at least one registered task, whatever its status.
3. **Add a `Delete tasks` action.** It deletes *every* registered task for that workitem —
   the `data/tasks.json` records **and** each task's Markdown file on disk — then resets the
   workitem status back to `open` so `Create task` becomes available again. It is rendered only
   when the workitem has at least one registered task. It asks for confirmation inline in place
   (the button swaps for `Confirm` / `Cancel`); no browser `confirm()` dialog.
4. **Shrink the action buttons.** Smaller text and less padding on every control in the workitem
   `Actions` cell and in the detail page's action row.

The `Execute task` action added by issue #26 keeps its current visibility rule
(status `task_created` **and** a registered task exists) and only picks up the new smaller sizing.

## Application

Root application (`agenthub`)

## GitHub Issue

- Issue #27

Decisions confirmed with the user while planning:

- `Delete tasks` removes **all** task records for the workitem **and** their `.md` files from disk
  (the equivalent of the `/tasks/[taskId]` delete section with "Also delete the task file from
  disk" ticked), not just the latest task and not records only.
- After the delete, the workitem status is **reset to `open`**, so the row does not end up stranded
  in `task_created` with no tasks and no available action.
- The delete confirms **inline in the row** before running.
- All four changes apply to the **workitems list and the workitem detail page**.

Planning assumption (not asked): the status reset only fires when the workitem is currently
`task_creating` or `task_created`. Deleting the tasks of a `completed`, `cancelled`, or
`in_progress` workitem leaves its status alone — reopening a completed workitem as a side effect of
a task cleanup would be surprising. This mirrors the guarded promotion in
`src/app/api/tasks/route.ts:54-56`, which only moves `open`, `task_creating`, and `in_progress`
workitems to `task_created`.

## Dependencies

None - This task is independent

## Context

### Current visibility rules (before this task)

| Control | Rendered when |
| --- | --- |
| `WorkitemStatusButton` (Complete/Reopen) | status is `open`, `task_created`, or `completed` (list only) |
| `Execute task` | status is `task_created` **and** a registered task exists |
| `Create plan` | always (list: whenever the project is known; detail: always) |

### Where the pieces live

- `src/app/workitems/page.tsx` (~290 lines) — server-rendered workitems table.
  - `WorkitemRows({ projectNames, workitems, tasksByWorkitem })` renders the rows. Columns:
    `Project`, `#`, `Title`, `Status`, `Created`, `Actions`.
  - Per row it already resolves `const taskInfo = tasksByWorkitem.get(taskWorkitemKey(workitem.projectId, workitem.id))`,
    which is `{ task, taskCount } | undefined` — this is the "has a task" signal and the task count
    for the new rules.
  - The `Actions` cell is a `<div className="flex flex-wrap gap-2">` holding `WorkitemStatusButton`,
    the conditional `Execute task` link, and the `Create plan` link. Both links use
    `inline-flex h-9 items-center rounded-lg border border-sky-200 bg-white px-3 text-sm font-medium text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-3 focus:ring-sky-100`.
  - `WorkitemsPage` loads `tasksByWorkitem` via `listLatestTasksByWorkitem()` inside its own
    `try`/`catch` (failure logged, degraded to an empty map) — keep that shape.
- `src/app/workitems/workitem-status-button.tsx` — client `Complete`/`Reopen` button, same
  `h-9 … px-3 text-sm` sizing with slate borders; PATCHes the workitem then `router.refresh()`.
  Returns `null` for statuses outside `open` / `task_created` / `completed`. It is the closest
  precedent for the new delete button (local `isSubmitting`, local `error` under the button).
- `src/app/projects/[id]/workitems/[workitemId]/page.tsx` — server component. Already resolves
  `executableTaskId` from `listLatestTasksByWorkitem()` in an isolated `try`/`catch` after the
  project/workitem load, and passes it to `WorkitemDetail`.
- `src/app/projects/[id]/workitems/[workitemId]/workitem-detail.tsx` (~287 lines) — client
  component. Props today: `projectName`, `projectColor`, `workitem`, `executableTaskId?`. Its
  header holds `<div className="mt-4 flex flex-wrap items-end gap-3">` with the `Status` `<select>`
  (`h-10`), the `Create plan` link, and the `Execute task` link, both
  `inline-flex h-10 items-center rounded-xl … px-4 text-sm font-medium`. Local state
  `workitemStatus` drives the badge, the select, and the `Execute task` visibility;
  `changeWorkitemStatus` PATCHes, updates `workitemStatus`, and calls `router.refresh()`.
- `src/lib/tasks-store.ts` (~395 lines) — `Task`, `taskWorkitemKey()`, `listLatestTasksByWorkitem()`
  (`Map<"projectId:workitemId", { task, taskCount }>`), `deleteTask(taskId)`, `listAllTasks()`,
  and the internal `readDocument()` / `writeDocument()` / `normalizeTask()` / `serializeWrite()`
  helpers that every mutation goes through.
- `src/lib/task-file.ts` — `deleteTaskFile(projectPath, filePath)` →
  `{ status: "deleted" | "not-found" | "invalid-path" | "error"; message?: string }`. It is
  `server-only` and path-traversal guarded by `resolveTaskFilePath`.
- `src/app/api/tasks/[taskId]/route.ts` — the single-task `DELETE`, and the reference for the
  delete-file-then-delete-record order and the error mapping (`failure(error, "delete")`).
- `src/app/tasks/[taskId]/delete-task-section.tsx` — the existing inline confirm pattern
  (`isConfirming` state swapping the button for `Confirm delete` / `Cancel`).
- `src/app/api/projects/[id]/workitems/[workitemId]/route.ts` — `PATCH` accepts `{ status }` and
  goes through `updateWorkitem`, which writes the lifecycle event and publishes the workitem change
  that `WorkitemLiveUpdates` listens to. Reuse it (or `updateWorkitem` directly on the server) for
  the status reset so live updates and lifecycle logging keep working.
- `src/lib/workitem-filters.ts` — `WORKITEM_STATUSES`: `open`, `task_creating`, `task_created`,
  `in_progress`, `completed`, `cancelled`.
- `src/lib/plan-prompt.ts` — `planConsoleHref(projectId, workitemId)`; `src/lib/task-execution.ts` —
  `taskConsoleHref(taskId)`. Neither changes.

### Documentation

`.agent/PROJECT_DOCUMENT.md` line 204 describes the workitem/task screen behaviour, including the
`Execute task` action. It must be extended with the new `Create task` naming and visibility rule and
the `Delete tasks` action with its status reset.

## Acceptance Criteria

### Naming and visibility

- [ ] The `Create plan` control is labelled **`Create task`** on both `/workitems` rows and the
      workitem detail page. Its target (`planConsoleHref`) and the plan-creation flow are unchanged.
- [ ] `Create task` is **not rendered** when the workitem status is `task_creating` or
      `task_created`.
- [ ] `Create task` is **not rendered** when the workitem has at least one registered task, in any
      status.
- [ ] `Create task` is rendered for a workitem with no registered task whose status is `open`,
      `in_progress`, `completed`, or `cancelled`.
- [ ] On the detail page this visibility follows the component's live `workitemStatus` state:
      switching the `Status` select to `Task creating` or `Task created` hides `Create task` without
      a full page reload, and switching back reveals it (when the workitem has no task).
- [ ] `Execute task` keeps exactly its current rule — status `task_created` **and** a registered
      task exists — on both screens.

### Delete tasks

- [ ] A `Delete tasks` action appears in the `/workitems` `Actions` cell and in the detail page
      action row **only** when the workitem has at least one registered task.
- [ ] The first click does not delete: it swaps the control for an inline `Confirm` / `Cancel`
      pair in the same place. `Cancel` restores the `Delete tasks` button and deletes nothing.
- [ ] Confirming deletes **every** task record for that `projectId` + `workitemId` from
      `data/tasks.json` — not only the latest one.
- [ ] Confirming also deletes each deleted task's Markdown file from disk, resolved against the
      project path exactly as `/api/tasks/[taskId]?file=delete` does (`deleteTaskFile`). A file that
      is already missing, is outside the project path, or fails to delete does **not** fail the
      operation: the records are still removed and the problem is surfaced to the user as a
      non-blocking message.
- [ ] After a successful delete, a workitem whose status was `task_creating` or `task_created` is
      set back to `open`; a workitem in any other status keeps its status.
- [ ] The status reset goes through `updateWorkitem` (directly or via the workitem `PATCH` route)
      so the lifecycle event is written and the workitem change is published to
      `WorkitemLiveUpdates`.
- [ ] After the delete the view reflects the new state without a manual reload: the list row shows
      `Create task` again and no longer shows `Execute task` / `Delete tasks`, and the detail page's
      status badge and select show `Open`.
- [ ] While the delete is in flight the confirm control is disabled and shows progress text; a
      failure leaves the tasks in place and shows the server's error message near the control,
      matching how `WorkitemStatusButton` renders its error.
- [ ] Deleting the tasks of one workitem never touches another workitem's tasks or any workitem
      record other than the status reset described above.

### Sizing

- [ ] Every control in the `/workitems` `Actions` cell — `Complete`/`Reopen`, `Execute task`,
      `Create task`, `Delete tasks` — is visibly smaller than today: `text-xs`, horizontal padding
      no larger than `px-2.5`, and height no larger than `h-8`, applied consistently so the buttons
      line up on one row.
- [ ] The detail page's action row uses the same reduced scale for `Create task`, `Execute task`,
      and `Delete tasks`; the buttons stay bottom-aligned with the `Status` select
      (`items-end` on the container) and the select itself is unchanged.
- [ ] Focus rings, hover states, and disabled styling survive the resize; the delete control keeps
      a red accent distinct from the sky-blue link buttons.

### General

- [ ] No unused imports or variables are left behind; `pnpm lint` is clean.
- [ ] No change to `/tasks`, `/tasks/[taskId]`, `taskConsoleHref`, `planConsoleHref`,
      `useTaskRun`, `usePlanRun`, or `/api/tasks/[taskId]`.
- [ ] No change to the workitems table columns, filters, pagination, live updates, the workitem
      save/cancel form, or the workitem delete section.
- [ ] No `data/*.json` schema change.
- [ ] Every touched file stays under 600 lines.
- [ ] `.agent/PROJECT_DOCUMENT.md` line 204 is updated: the action is called `Create task`, it is
      hidden once a task exists or is being created, and a workitem with registered tasks offers a
      `Delete tasks` action that removes its task records and files and returns the workitem to
      `Open`.

## Technical Notes

- Read `.agent/PROJECT_DOCUMENT.md` first and heed its Next.js caution: the installed Next.js
  (16.3.4) is newer than most training data — check `node_modules/next/dist/docs/` before writing
  framework-level code. This task needs only ordinary server/client components and one route
  handler.

- **Server side.** Add to `src/lib/tasks-store.ts`, beside `listLatestTasksByWorkitem`:

  ```ts
  export async function listTasksForWorkitem(projectId: string, workitemId: number): Promise<Task[]>;
  export async function deleteTasksForWorkitem(projectId: string, workitemId: number): Promise<Task[]>;
  ```

  `listTasksForWorkitem` filters `readDocument()` through `normalizeTask`;
  `deleteTasksForWorkitem` runs inside `serializeWrite`, removes every matching entry in one
  `writeDocument`, and returns the removed tasks. Do not loop `deleteTask()` per id — that would
  read and write the document once per task and race with other writers.

- **New route.** `DELETE /api/projects/[id]/workitems/[workitemId]/tasks` in
  `src/app/api/projects/[id]/workitems/[workitemId]/tasks/route.ts`. Order of operations:
  1. Validate the workitem id the way the sibling route does; `getProject(id)` and
     `getWorkitem(id, workitemId)`, 404 if either is missing.
  2. `listTasksForWorkitem` — if it is empty, return a success response with `deletedCount: 0`
     rather than a 404, so a double-click is harmless.
  3. Delete each task's file with `deleteTaskFile(project.path, task.filePath)`, collecting
     messages for `status === "error"`; never let one file failure abort the rest.
  4. `deleteTasksForWorkitem` to remove the records.
  5. If the workitem status is `task_creating` or `task_created`, `updateWorkitem(id, workitemId, { status: "open" })`.
  6. Respond with something like
     `{ deletedCount, fileDeletedCount, fileErrors?: string[], status }`.

  Reuse the error mapping style of `src/app/api/tasks/[taskId]/route.ts` (`ProjectStoreError`,
  `WorkitemStoreError`, `TaskStoreError`, `LifecycleLogStoreError` → specific messages, 500
  otherwise). Add `export const dynamic = "force-dynamic";` like every sibling route.

- **Client side.** One new client component, e.g.
  `src/app/workitems/delete-workitem-tasks-button.tsx`, used by both screens:

  ```tsx
  type DeleteWorkitemTasksButtonProps = {
    projectId: string;
    workitemId: number;
    taskCount: number;
    size?: "list" | "detail";      // or pass the className in, if that reads cleaner
    onDeleted?: () => void;        // detail page uses it to sync local workitemStatus
  };
  ```

  Model it on `WorkitemStatusButton` (local `isSubmitting`, local `error`, `router.refresh()` on
  success) plus the `isConfirming` swap from `DeleteTaskSection`. Surface `fileErrors` from the
  response as a non-blocking warning — the records are gone at that point, so it must not read as a
  failure. Keep it under the 600-line rule (it will be far under).

- On the detail page the component must keep the header in sync without a reload: pass an
  `onDeleted` callback that sets `workitemStatus` to `"open"` when the response says the status was
  reset, in addition to `router.refresh()`. `WorkitemDetail` already owns that state.

- The detail page (`page.tsx`) needs the task count as well as the id. It already has the
  `LatestTasksByWorkitem` entry in hand — read `?.taskCount ?? 0` from the same lookup and pass it
  down as a new prop (e.g. `taskCount?: number`, defaulting to `0`). Do not add a second store call.

- Derive both new rules from data already on the row — `taskInfo` in `WorkitemRows`, the new
  `taskCount` prop in `WorkitemDetail`. No extra fetch, no new store call in the list.

- Suggested sizing (adjust only if it breaks the layout): links and buttons become
  `inline-flex h-8 items-center rounded-lg border … px-2.5 text-xs font-medium`, with the delete
  control on `border-red-300 text-red-800 hover:border-red-400 hover:bg-red-50` and its focus ring
  `focus:ring-red-100`. Apply the same scale to `WorkitemStatusButton`. On the detail page use the
  same values so the two screens match; the `Status` select stays `h-10` and `items-end` keeps the
  baseline tidy.

- The confirm state lives in the row: render `Confirm` and `Cancel` where the `Delete tasks` button
  was, inside the same `flex flex-wrap gap-2` container, so the layout does not jump. Do not use
  `window.confirm`.

- Do not change how tasks are registered, how plan creation sets `task_creating`, or the
  `Execute task` rule. Do not touch the `/tasks` list or the single-task delete flow.

- Do not comment on or close GitHub issue #27 as part of implementation; close-out is handled by
  `.agent/commands/tasks/do-task-post.md`.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Manual: with `pnpm dev` running, open `/workitems`. A workitem with no task and status `Open`
      shows a small `Create task` button; the row's buttons are visibly smaller than before.
- [ ] Manual: a workitem in `Task created` with a registered task shows `Execute task` and
      `Delete tasks` and **no** `Create task`.
- [ ] Manual: a workitem in `Task creating` shows no `Create task`.
- [ ] Manual: click `Delete tasks`, confirm the button swaps to `Confirm` / `Cancel`, click
      `Cancel`, and confirm nothing was deleted (`data/tasks.json` unchanged, `/tasks` still lists
      the task).
- [ ] Manual: for a workitem with **two or more** registered tasks, click `Delete tasks` →
      `Confirm`, then verify: both task records are gone from `data/tasks.json` and from `/tasks`,
      both `.md` files are gone from the project directory, the workitem status reads `Open`, and
      the row now shows `Create task` again — all without reloading the page.
- [ ] Manual: repeat on the workitem detail page and confirm the status badge and `Status` select
      both switch to `Open` without a reload.
- [ ] Manual: delete the tasks of a `Completed` workitem and confirm its status stays `Completed`.
- [ ] Manual: delete a task's `.md` file from disk by hand, then run `Delete tasks` — the records
      are still removed and the missing file is not reported as an error.
- [ ] Manual: with a second browser tab open on `/workitems`, run the delete in the first tab and
      confirm the second tab's list refreshes through `WorkitemLiveUpdates`.
- [ ] Manual: confirm `/tasks` and its own `Execute task` link still work.
