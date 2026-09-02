# Replace GUID task ids with per-project integers and show the number in the UI

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

Today every task gets `id: randomUUID()` in `src/lib/tasks-store.ts`, so task URLs look like
`/projects/{projectUuid}/tasks/35169b68-3342-4bff-9751-89bf9bc09ef9` and the id is unusable as
a human reference. Tasks should instead carry a **small integer id, numbered independently
within each project** (project A has tasks 1, 2, 3; project B also starts at 1), and that
number must be visible in the UI — in the project task list and on the task detail page.

Project ids stay UUID strings; only `Task.id` changes.

Decisions already made with the user (do not re-litigate them):

- **Per-project numbering.** Each project's tasks start at `1`. A task is therefore identified
  by the pair (`projectId`, `id`) — which is exactly how every route, store function and API
  handler already looks tasks up, so no lookup signature changes shape.
- **Existing task records are wiped, not migrated.** `data/tasks.json` currently holds one
  throwaway test task. Reset it to an empty list as part of this task and write **no**
  migration code: the store accepts integer ids only and treats a UUID-id record as invalid
  data.

## Application

Root application (`agenthub`) — single Next.js app in `src/`. No `apps/` subdirectory exists.

## GitHub Issue

- Issue #11 — "her task ın id si integer olsun" (every task's id should be an integer; a GUID
  is not needed; the number should be visible in the task list and on the detail page)

## Dependencies

None - This task is independent.

## Context

### Files that carry a task id

| File | Current | Required change |
| --- | --- | --- |
| `src/lib/tasks-store.ts` | `Task.id: string`, `randomUUID()`, `isTask` checks `typeof task.id === "string"`, `getTask`/`updateTask`/`deleteTask` take `taskId: string` | `Task.id: number`, next-id-per-project assignment, integer validation, `taskId: number` params, drop the `randomUUID` import |
| `src/app/api/projects/[id]/tasks/[taskId]/route.ts` | Passes the raw `taskId` route param straight into `updateTask` / `deleteTask` | Parse the param to an integer first; respond `404` when it is not a positive integer |
| `src/app/projects/[id]/tasks/[taskId]/page.tsx` | Passes the raw `taskId` param to `getTask` | Parse to an integer; `notFound()` when it is not a positive integer |
| `src/app/projects/[id]/tasks/[taskId]/task-detail.tsx` | Local `Task` type with `id: string`; builds `taskApiPath` from `task.id` | `id: number`; show the number in the header |
| `src/app/projects/[id]/tasks/page.tsx` | Renders each row with `key={task.id}` and `href=.../tasks/${task.id}` | Unchanged mechanically (a number interpolates fine), plus render the number in each row |
| `data/tasks.json` | One task with a UUID id | Reset to `{ "tasks": [] }` |

`countProjectTasks`, `deleteProjectTasks`, `listProjectTasks`, the collection route
`src/app/api/projects/[id]/tasks/route.ts`, `src/app/projects/[id]/tasks/new/page.tsx`,
`src/app/projects/[id]/page.tsx` and `src/app/projects/[id]/project-detail.tsx` never read a
task id and need no changes.

### Assigning the next number

Inside the existing `serializeWrite` critical section in `createTask`, derive the new id from
the tasks already stored for that project:

```ts
const nextId = document.tasks
  .filter((task) => task.projectId === projectId)
  .reduce((highest, task) => Math.max(highest, task.id), 0) + 1;
```

`serializeWrite` already funnels every write through one promise chain, so two concurrent
creates cannot compute the same `nextId`. Known and accepted behaviour: deleting the
highest-numbered task frees that number for the next create. That is fine for a local tool —
do not add a persisted per-project counter to avoid it.

### Where the number is shown

- **Task list** (`src/app/projects/[id]/tasks/page.tsx`, the `TaskRows` component): show `#1`
  immediately before the task title inside the existing title/date row, as a non-shrinking
  slate-500 label — e.g. wrap the `<h2>` and the number in a `flex items-baseline gap-2`
  container, with the number as `<span className="shrink-0 text-sm font-medium tabular-nums
  text-slate-500">#{task.id}</span>`. Keep the title's `min-w-0 break-words` so long titles
  still wrap.
- **Task detail** (`src/app/projects/[id]/tasks/[taskId]/task-detail.tsx`): the `<h1>` stays
  the task title. Put the number in the header's eyebrow line, next to the existing
  "{projectName} tasks" back-link — e.g. `<span className="text-sm text-slate-500">Task
  #{task.id}</span>` after the link, in a `flex flex-wrap items-center gap-2` row. Do not put
  the number inside the `<h1>`.

## Acceptance Criteria

- [ ] `Task.id` is typed `number` in `src/lib/tasks-store.ts` and in the local `Task` type in
      `task-detail.tsx`; `randomUUID` is no longer imported anywhere in the store.
- [ ] `isTask` accepts a record only when `Number.isInteger(task.id) && task.id > 0`, so a
      leftover UUID-id record makes `readDocument` throw `TaskStoreError` (surfaced as the
      existing "Task data could not be read…" message) rather than rendering broken rows.
- [ ] `getTask`, `updateTask` and `deleteTask` take `taskId: number`.
- [ ] The first task created in a project gets id `1`; the second gets `2`.
- [ ] A task created in a **second** project also starts at `1` — numbering is per project,
      not global.
- [ ] `data/tasks.json` is reset to `{ "tasks": [] }` (with the store's trailing newline).
- [ ] `/projects/{id}/tasks/abc` and `/projects/{id}/tasks/0` render the 404 page instead of
      throwing.
- [ ] `PATCH`/`DELETE` on `/api/projects/{id}/tasks/abc` return `404` with a JSON `error`, not
      a 500.
- [ ] The task list shows `#1`, `#2`, … next to each task title.
- [ ] The task detail page shows `Task #{n}` in its header, and the `<h1>` is still just the
      task title (exactly one `<h1>` per page).
- [ ] Creating, opening, editing and deleting a task all work end to end with integer ids.
- [ ] `.agent/PROJECT_DOCUMENT.md` is updated to state that tasks carry per-project sequential
      integer ids (the paragraph about `data/tasks.json` under "Architecture").

## Technical Notes

- Parse route params with `Number.parseInt(taskId, 10)` and guard with `Number.isInteger(...)
  && parsed > 0`. Note that `Number.parseInt("1abc", 10)` returns `1`; if you want to reject
  that, compare `String(parsed) === taskId`. Either is acceptable — be consistent between the
  page and the API route.
- `taskDetails()` in the store validates only `title`/`detail` and must keep ignoring `id`;
  clients must never be able to choose a task's id. Do not read `id` from the request body.
- The API route `src/app/api/projects/[id]/tasks/[taskId]/route.ts` currently returns 404 only
  when the store returns `null`. An unparsable id should take the same 404 path — reuse the
  existing `{ error: "Task not found." }` body.
- `href={`/projects/${projectId}/tasks/${task.id}`}` and `key={task.id}` work unchanged with a
  numeric id; do not add `String(...)` conversions.
- Use `tabular-nums` on the number so the list's `#9` / `#10` column does not jitter.
- Keep the list sorted by `createdAt` descending as it is today; do not switch the sort to the
  new id.
- These are the project's existing type-safety conventions — no `any`, no non-null assertions
  on parsed params.
- `src/app/projects/[id]/tasks/[taskId]/task-detail.tsx` and `.../tasks/new/page.tsx` are
  `"use client"` components; do not convert anything between server and client.
- Do not touch the WebSocket protocol, `server/`, `src/lib/projects-store.ts`,
  `src/lib/settings-store.ts`, or the project API routes.
- Respect the project's 600-line-per-file guideline; all touched files stay well under it.
- The installed Next.js is newer than most training data — consult
  `node_modules/next/dist/docs/` before writing any Next.js-specific code (see AGENTS.md).

## Verification

- Ensure the verification steps in `.agent/PROJECT_DOCUMENT.md` are performed.
- `pnpm build` completes with no compilation or type errors.
- `pnpm lint` passes; fix any errors it reports.
- Run `pnpm dev` and walk the flow manually:
  - Create two tasks in one project → they are numbered `#1` and `#2` in the list.
  - Create a task in a **different** project → it is `#1`, not `#3`.
  - Open a task → the detail page shows `Task #{n}` and the URL ends in that integer.
  - Edit and save a task → the change persists and the number does not change.
  - Delete a task → it disappears from the list and the redirect back to the list works.
  - Visit `/projects/{id}/tasks/abc` → the 404 page renders, no server crash.
  - Confirm `data/tasks.json` holds integer `"id"` values after these steps.
- There are no automated tests in this project; the manual walkthrough above is the test.
