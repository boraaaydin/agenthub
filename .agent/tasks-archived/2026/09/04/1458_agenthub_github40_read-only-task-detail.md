# Make the task detail page read-only

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

From GitHub issue #40: the task detail page (`/tasks/[taskId]`) must stop being an edit form.

Two parts:

1. **No editable fields.** The whole "save changes" form — Project, Workitem, Task title, Task file
   path, Summary, plus the Save/Cancel buttons — is removed. The task's data is presented as
   read-only content instead.
2. **No duplicate file path at the top.** The task file path must not be shown in the upper part of
   the page any more; it is already displayed in the **Task file** section at the bottom
   (`TaskFilePreview` renders `{projectPath}/{filePath}` under its heading). Today the only place the
   path appears "above" is the *Task file path* input, so removing the form satisfies this — the
   requirement here is that the read-only replacement must **not** reintroduce the path in the
   header or anywhere above the Task file section.

Decisions confirmed with the user while planning:

- **Task status stays editable.** The status `<select>` in the header is the single interactive
  control that remains; it keeps working exactly as it does now.
- **The Delete task section stays.** Deleting is not field editing, so `DeleteTaskSection` keeps its
  current behaviour and position.
- **API is untouched.** `PATCH /api/tasks/[taskId]` keeps accepting the same body; only the UI
  changes. The console already PATCHes this endpoint (`src/app/console/use-task-execution.ts`), and
  restricting it is explicitly out of scope.

## Application

Root application (`agenthub`)

## GitHub Issue

- Issue #40

## Dependencies

None - This task is independent.

Note: the working tree may still contain in-progress work for issue #29 (project applications),
which touches the project/console files but not `src/app/tasks/[taskId]/*`. Rebase or merge carefully;
this task does not depend on it.

## Context

Files that matter for this work:

- `src/app/tasks/[taskId]/task-detail.tsx` (293 lines) — the client component to change. It holds:
  - a header (lines ~216-249) with the breadcrumb, `Task #id`, status badge, title, project chip,
    workitem link, created/updated timestamps, and the **Task status** select;
  - the edit `<form onSubmit={saveTask}>` (lines ~251-286) that is being removed;
  - `<TaskFilePreview />` and `<DeleteTaskSection />` at the bottom.
- `src/app/tasks/[taskId]/page.tsx` (80 lines) — the server component that loads the task, all
  projects (`listProjects()`), all tasks (`listAllTasks({ page: 1, pageSize: 500 })`), the project
  path, and the file preview, then passes them to `TaskDetail`.
- `src/app/tasks/[taskId]/task-file-preview.tsx` — the read-only Task file section, already showing
  the full repository path. **Do not change this file.**
- `src/app/tasks/[taskId]/delete-task-section.tsx` — unchanged, but its `disabled` prop is currently
  fed from `isSubmitting`, which disappears with the form.
- `src/app/project-chip.tsx` — `ProjectChip` / `UnknownProjectChip` used in the header.
- `src/lib/task-filters.ts` — `TASK_STATUSES`, `TASK_STATUS_LABELS`, `taskStatusBadgeClass`,
  `taskStatusLabel`.

State that becomes dead once the form is gone: `projectId`, `workitemId`, `title`, `filePath`,
`summary`, `isSubmitting`, `resetForm`, `changeProject`, `saveTask`, `availableTasks`, and the
`tasksByProject` prop. `currentTask`, `error`, `statusMessage`, `isUpdatingStatus`, `pendingStatus`,
`mountedRef`, `statusControllerRef`, `apiPath`, and `updateTaskStatus` all stay.

Prop simplification (verify before applying): `currentTaskExists` only ever differs from `taskExists`
when the form has changed `currentTask.projectId` / `currentTask.workitemId`. With the form gone
`currentTask` only ever changes its `status` and `updatedAt`, so `currentTaskExists === taskExists`
and `tasksByProject` is unused. Likewise `projects` is only used for
`projects.find((p) => p.id === currentTask.projectId)`, so a single resolved project object is
enough.

## Acceptance Criteria

**Read-only detail page**

- [ ] `/tasks/[taskId]` no longer renders the Project select, the Workitem select, the Task title
      input, the Task file path input, or the Summary textarea.
- [ ] The **Save changes** and **Cancel** buttons are gone, and no `PATCH` request carrying
      `title` / `filePath` / `summary` / `projectId` / `workitemId` can be issued from this page.
- [ ] The task's **summary** is still visible, rendered as read-only text (preserving line breaks,
      e.g. `whitespace-pre-wrap`), with a clear "Summary" heading and an empty state when the task
      has no summary.
- [ ] The task file path appears **only** inside the Task file section at the bottom; nothing above
      that section prints `task.filePath`.
- [ ] The header keeps: breadcrumb link to `/tasks`, `Task #id` chip, status badge, task title,
      project chip (or `UnknownProjectChip`), the workitem link, and the created/updated line.
- [ ] The **Task status** select still updates the status through `PATCH /api/tasks/[taskId]`,
      shows "Updating status…", reports success and errors, and calls `router.refresh()` — behaviour
      identical to today.
- [ ] The **Task file** section and the **Delete task** section are unchanged in behaviour and
      position; `DeleteTaskSection` is disabled while a status update is in flight
      (`disabled={isUpdatingStatus}` replacing the removed `isSubmitting`).
- [ ] Error and success messages (`role="alert"` / `role="status"`) are still rendered somewhere
      sensible on the page, since both status updates and delete failures use them.

**Cleanup**

- [ ] No unused state, handler, import, or prop is left behind in `task-detail.tsx`
      (`pnpm lint` must be clean).
- [ ] The `tasksByProject` prop is removed from `TaskDetail`, and `page.tsx` no longer calls
      `listAllTasks(...)` for it.
- [ ] The `projects` array prop is replaced by the single resolved project
      (`project: { id: string; name: string; color?: string } | null`), and `page.tsx` no longer
      calls `listProjects()`.
- [ ] `page.tsx` still resolves the project (for `projectPath`, the chip, and the workitem link) and
      still returns the existing "Task unavailable" error screen for `TaskStoreError` /
      `ProjectStoreError`.

**Out of scope (must not change)**

- [ ] `src/app/api/tasks/[taskId]/route.ts` is untouched.
- [ ] `src/app/tasks/[taskId]/task-file-preview.tsx` and `delete-task-section.tsx` keep their current
      logic (only the `disabled` value passed in may change).
- [ ] No other page gains or loses task editing; `/tasks/new` still creates tasks.

## Technical Notes

- **Removing `listProjects()` also removes the dead `ProjectStoreError` catch?** No — `getProject`
  can still throw it, so keep the existing error-mapping branch in `page.tsx`. Note that the current
  `catch` block has a duplicated `TaskStoreError` branch (the third ternary arm is unreachable);
  drop the duplicate while you are in the file, but do not otherwise restructure the error handling.
- **Read-only layout.** Follow the existing visual language of the page rather than inventing a new
  one: reuse the card style of the Task file section (`rounded-xl border border-slate-200 bg-white
  p-5 shadow-sm`) for the Summary block, and the `text-sm font-medium text-slate-800` label style for
  its heading. Do not render a disabled `<input>` / `<textarea>` as the "read-only" presentation —
  disabled form controls still read as an editable form to users and screen readers.
- **Do not turn the header into a data grid.** The issue asks for less on screen, not more; project
  and workitem are already shown as chips/links, so the read-only replacement is essentially just the
  summary plus what the header already has.
- **Keep the status select's abort/mount handling intact.** `mountedRef` and `statusControllerRef`
  guard against updates after unmount and against overlapping requests; do not simplify them away
  along with the form state.
- **`key={task.id}`** on `<TaskDetail>` in `page.tsx` stays — it still resets status state when
  navigating between tasks.
- **Readability.** `src/app/tasks/[taskId]/*` contains long single-line JSX elements. Follow the
  Code Readability section of `.agent/PROJECT_DOCUMENT.md` for the new code, and where you edit such
  a line, reformat it into readable multi-line code as long as behaviour does not change.
- **Next.js version caution.** The installed Next.js is newer than most training data. Before
  changing the server component, read the relevant guide under `node_modules/next/dist/docs/`. Note
  the typed `PageProps<"/tasks/[taskId]">` helper the page already uses.
- **Language.** All code, identifiers, UI strings, and this file's prose stay in English; the GitHub
  issue comment written during close-out is in Turkish, matching the issue.
- **Update `.agent/PROJECT_DOCUMENT.md`** if it describes the task detail page as editable.

## Verification

- [ ] `pnpm build` completes with no TypeScript or compilation errors.
- [ ] `pnpm lint` passes with no errors (fix anything it reports).
- [ ] Manually, with `pnpm dev`:
  - [ ] Open an existing task at `/tasks/{id}` and confirm no input, textarea, or select other than
        **Task status** is present, and that Save/Cancel are gone.
  - [ ] Confirm the summary is readable, with its line breaks preserved, and that a task with an
        empty summary shows the empty state instead of a blank area.
  - [ ] Confirm the task file path is visible only in the Task file section at the bottom.
  - [ ] Change the status through the select and confirm it persists after a reload, that the header
        badge updates, and that the success message appears.
  - [ ] Trigger a status-update failure (for example stop the server mid-request) and confirm the
        error message is shown.
  - [ ] Delete a task from the page (with and without "also delete the file") and confirm the
        redirect to `/tasks` still works.
  - [ ] Open a task whose project record is missing and confirm the page still renders with
        `UnknownProjectChip` and the missing-project file-preview message.
- [ ] `data/tasks.json`, `data/workitems.json`, and `data/lifecycle-log.json` are only changed by the
      normal status updates performed during manual testing.
