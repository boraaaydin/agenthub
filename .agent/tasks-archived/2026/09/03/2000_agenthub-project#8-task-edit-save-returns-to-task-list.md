# Return to the Task List After Saving a Task Edit

## Description

On the task detail page (`/projects/[id]/tasks/[taskId]`), clicking **Save changes** currently
keeps the user on the same page and only shows a "Changes saved." message. Change this so a
successful save navigates back to the task list, matching what already happens after a task is
deleted and after a task is created.

## Application

Root application (`agenthub`)

## Dependencies

None - This task is independent

## Context

- `src/app/projects/[id]/tasks/[taskId]/task-detail.tsx` is the client component that renders the
  edit form. Its `saveTask` handler (around lines 80-116) `PATCH`es
  `/api/projects/{projectId}/tasks/{taskId}`, then re-syncs local state from the response, sets
  `statusMessage` to `"Changes saved."`, and calls `router.refresh()` — the user stays on the page.
- The same component already defines `taskListPath` (`/tasks?project={projectId}`), used by the
  header back-link and by `deleteTask`, which navigates with `router.replace(taskListPath)` after a
  successful delete.
- `src/app/tasks/new/new-task-form.tsx` follows the same pattern for creation: on success it calls
  `router.replace(tasksHref({ projectId, status: initialStatus }))` and never shows an inline
  success message.
- `tasksHref` lives in `src/lib/task-filters.ts` and builds `/tasks` URLs from an optional
  `projectId`, `status`, and `page`.
- `/tasks` (`src/app/tasks/page.tsx`) is `export const dynamic = "force-dynamic"`, so it re-reads
  tasks from `data/tasks.json` on each request.
- The detail page does not receive the list's status/page filter context, so the only list URL it
  can build is the project-scoped default one it already uses.

## Acceptance Criteria

- [ ] Submitting the task edit form with a successful `PATCH` response navigates the user to the
      task list at `taskListPath` (`/tasks?project={projectId}`), the same destination as the
      header back-link and the post-delete redirect.
- [ ] The task list shown after the redirect reflects the just-saved title and detail (no stale
      cached list content).
- [ ] The inline "Changes saved." success message is no longer shown on the edit form, since the
      user leaves the page on success.
- [ ] A failed save (non-OK response or network failure) keeps the user on the detail page and
      still shows the existing error message, with the form re-enabled.
- [ ] Client-side validation still blocks an empty title with "Enter a task title." and does not
      navigate.
- [ ] The **Complete** / **Reopen** status button still stays on the detail page and keeps showing
      "Task completed." / "Task reopened." — its behaviour is unchanged.
- [ ] The **Cancel** button still resets the form in place and does not navigate.
- [ ] Delete behaviour is unchanged.

## Technical Notes

- Confine the change to `saveTask` in `src/app/projects/[id]/tasks/[taskId]/task-detail.tsx`.
- On success, drop the now-unreachable local re-sync (`setTitle` / `setDetail` / `setTaskStatus` /
  `setCompletedAt`) and the `setStatusMessage("Changes saved.")` call, and navigate instead.
  Keep the `try` / `catch` / `finally` shape and the `isSubmitting` handling as they are.
- Use `router.replace(taskListPath)` (not `push`) so the edit page is not left on the back stack,
  matching `deleteTask` and `new-task-form.tsx`.
- Call `router.refresh()` before the navigation so the freshly re-rendered list is not served from
  the client router cache.
- Optional consistency cleanup, only if it stays a one-line change: build `taskListPath` with
  `tasksHref({ projectId: task.projectId })` from `@/lib/task-filters` instead of the hand-built
  template string. It produces the identical URL, so it must not change any behaviour.
- If `statusMessage` ends up with no remaining producer, remove the unused state; if
  `changeTaskStatus` still sets it, leave the state and its rendering in place.
- Read `.agent/PROJECT_DOCUMENT.md` before implementing.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Manual: with `pnpm dev` running, open a task from `/tasks`, change its title and detail, click
      **Save changes**, and confirm the browser lands on `/tasks?project={projectId}` with the
      updated values visible in the row.
- [ ] Manual: clear the title and submit — confirm the page stays put and shows
      "Enter a task title."
- [ ] Manual: on the detail page, click **Complete** / **Reopen** and confirm the page does not
      navigate away.
