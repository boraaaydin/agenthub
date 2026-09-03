# Rename Task to Workitem and Plan to Task across the application

---
**Execution Guidelines**: Before starting this task, ensure you've read `.agent/commands/tasks/do-task.md` (if not already read in this session). This file contains essential guidelines on how to properly execute tasks, including dependency checking, verification steps, and archival procedures.

**Application-specific documentation**: This task targets the root application. Read `.agent/PROJECT_DOCUMENT.md` before starting — it contains the technology, conventions, and verification steps for this application.

When this task file is read standalone, the agent should:
1. Check if `do-task.md` has been read in the current session
2. If not, read it first to understand the execution workflow
3. Read `.agent/PROJECT_DOCUMENT.md` before starting the task
4. Then proceed with this specific task
---

## Description

Rename the two core domain concepts throughout the codebase — data stores, API routes, page
routes, components, types, and UI copy:

- Today's **Task** (a per-project unit of work, `data/tasks.json`, `/tasks`) becomes a
  **Workitem**.
- Today's **Plan** (a registered task-file record, `data/plans.json`, `/plans`) becomes a
  **Task**.
- The word **plan** survives only as the name of the *step* that produces a Task from a
  Workitem: the Plan agent, the planning prompts, the `Create plan` action, and the planning
  console session. It is no longer a persisted entity name.

The resulting model: a project has many workitems; a workitem has many tasks; each task points
at one Markdown task file on disk. This is the same relational shape the code already has
(a plan carries `projectId` + `taskId`), so no schema restructuring is required — the work is a
disciplined rename plus a one-time data migration and a set of legacy route redirects.

## Application

Root application (`agenthub`)

## GitHub Issue

- Issue #25

## Dependencies

None - This task is independent

## Context

### Current shape

| Concept | Store | Data file | Pages | API |
| --- | --- | --- | --- | --- |
| Task (per-project work) | `src/lib/tasks-store.ts` | `data/tasks.json` | `/tasks`, `/tasks/new`, `/projects/[id]/tasks/[taskId]` | `/api/projects/[id]/tasks`, `/api/projects/[id]/tasks/[taskId]`, `.../plan-prompt` |
| Plan (registered task file) | `src/lib/plans-store.ts` | `data/plans.json` | `/plans`, `/plans/new`, `/plans/[planId]` | `/api/plans`, `/api/plans/[planId]`, `.../task-prompt` |

Supporting modules: `src/lib/task-filters.ts` (task statuses + `/tasks` hrefs),
`src/lib/plan-filters.ts` (plan statuses + `/plans` hrefs), `src/lib/task-events.ts`
(in-process task-change pub/sub feeding the `task-changed` WebSocket message),
`src/lib/plan-file.ts` (safe reader/deleter for the Markdown file),
`src/lib/task-plan.ts` (`composePlanPrompt`, `planConsoleHref`),
`src/lib/task-run.ts` (`composeTaskPrompt`, `taskConsoleHref`),
`src/lib/lifecycle-log-store.ts` (events with `entityType: "task" | "plan"`),
`src/lib/settings-store.ts` + `src/lib/settings-prompts.ts` (agent and prompt settings),
`src/lib/agent-protocol.ts` (`SessionContext = { projectId, taskId, planId? }`),
`server/session-registry.ts` (carries `execution?: SessionContext` per session).

Console flow files: `src/app/console/agent-console.tsx`, `use-plan-run.ts` (starts a planning
session from `?planProjectId=…&planTaskId=…`), `use-task-run.ts` (starts an execution session
from `?taskPlanId=…`), `use-plan-creation.ts` (tracks planning sessions), `use-plan-execution.ts`
(tracks execution + close-out), `plan-close-prompt.tsx`, `plan-completion-action.tsx`,
`session-info.tsx`, `session-sidebar.tsx`.

### Decisions already made (do not re-open)

1. **Data files are renamed with automatic one-time migration.** `data/tasks.json` →
   `data/workitems.json`, `data/plans.json` → `data/tasks.json`; lifecycle-log entity types are
   normalized in place.
2. **Routes are renamed, and the old `/plans*` and `/projects/[id]/tasks*` paths permanently
   redirect** to their new equivalents. Old API paths are *not* kept.
3. **Workitem lifecycle statuses become `task_creating` / `task_created`** (values *and* labels),
   with legacy `plan_creating` / `plan_created` normalized on read.
4. **Task (former plan) status `registered` becomes `created`**, with the legacy value normalized
   on read. `executing`, `executed`, `completed`, `cancelled` are unchanged.
5. **Settings keys are unchanged**: `planAgent` / `planPrompt` / `planPostPrompt` describe the
   plan step (workitem → task), `taskAgent` / `taskPrompt` / `taskPostPrompt` describe running a
   task. Only labels and descriptions are re-worded.

### Naming map

Types and stores:

| Old | New |
| --- | --- |
| `src/lib/tasks-store.ts` (`Task`, `TaskStatus`, `TASKS_FILE_PATH`, `TASKS_PAGE_SIZE`, `PaginatedTasks`, `TaskValidationError`, `TaskStoreError`, `getTask`, `listTasks`, `createTask`, `updateTask`, `deleteProjectTasks`, …) | `src/lib/workitems-store.ts` (`Workitem`, `WorkitemStatus`, `WORKITEMS_FILE_PATH`, `WORKITEMS_PAGE_SIZE`, `PaginatedWorkitems`, `WorkitemValidationError`, `WorkitemStoreError`, `getWorkitem`, `listWorkitems`, `createWorkitem`, `updateWorkitem`, `deleteProjectWorkitems`, …) |
| `src/lib/task-filters.ts` (`TASK_STATUSES`, `TaskFilterStatus`, `taskStatusLabel`, `taskStatusBadgeClass`, `taskFilterStatus`, `tasksHref`, `newTaskHref`) | `src/lib/workitem-filters.ts` (`WORKITEM_STATUSES`, `WorkitemFilterStatus`, `workitemStatusLabel`, `workitemStatusBadgeClass`, `workitemFilterStatus`, `workitemsHref`, `newWorkitemHref`) |
| `src/lib/plans-store.ts` (`Plan`, `PlanStatus`, `PLANS_FILE_PATH`, `getPlan`, `listPlans`, `createPlan`, `updatePlan`, `deletePlan`, `LatestPlansByTask`, …) | `src/lib/tasks-store.ts` (`Task`, `TaskStatus`, `TASKS_FILE_PATH`, `getTask`, `listTasks`, `createTask`, `updateTask`, `deleteTask`, `LatestTasksByWorkitem`, …) |
| `src/lib/plan-filters.ts` (`PLAN_STATUSES`, `planStatusLabel`, `planDetailHref`, `newPlanHref`, `plansHref`, …) | `src/lib/task-filters.ts` (`TASK_STATUSES`, `taskStatusLabel`, `taskDetailHref`, `newTaskHref`, `tasksHref`, …) |
| `src/lib/task-events.ts` (`TaskChange`, `publishTaskChange`, `subscribeToTaskChanges`) | `src/lib/workitem-events.ts` (`WorkitemChange`, `publishWorkitemChange`, `subscribeToWorkitemChanges`) |
| `src/lib/plan-file.ts` (`readPlanFile`, `deletePlanFile`, `resolvePlanFilePath`) | `src/lib/task-file.ts` (`readTaskFile`, `deleteTaskFile`, `resolveTaskFilePath`) |
| `src/lib/task-plan.ts` (`composePlanPrompt`, `planConsoleHref`) | `src/lib/plan-prompt.ts` (`composePlanPrompt`, `planConsoleHref`) — still the plan step, now keyed by workitem |
| `src/lib/task-run.ts` (`composeTaskPrompt`, `taskConsoleHref`) | `src/lib/task-execution.ts` (`composeTaskPrompt`, `taskConsoleHref`) |

Record fields: `Plan.taskId` → `Task.workitemId`. The task record keeps `id`, `projectId`,
`title`, `filePath`, `summary`, `status`, `createdAt`, `updatedAt`.

Page routes:

| Old | New |
| --- | --- |
| `/tasks`, `/tasks/new` (`src/app/tasks/*`) | `/workitems`, `/workitems/new` (`src/app/workitems/*`) |
| `/projects/[id]/tasks`, `/projects/[id]/tasks/new` (redirect stubs) | `/projects/[id]/workitems`, `/projects/[id]/workitems/new` (redirect to `/workitems*`) |
| `/projects/[id]/tasks/[taskId]` (`task-detail.tsx`) | `/projects/[id]/workitems/[workitemId]` (`workitem-detail.tsx`) |
| `/plans`, `/plans/new`, `/plans/[planId]` (`src/app/plans/*`) | `/tasks`, `/tasks/new`, `/tasks/[taskId]` (`src/app/tasks/*`) |

Component files under the moved directories are renamed to match: `new-task-form.tsx` →
`new-workitem-form.tsx`, `task-live-updates.tsx` → `workitem-live-updates.tsx`,
`task-status-button.tsx` → `workitem-status-button.tsx`, `plan-detail.tsx` → `task-detail.tsx`,
`plan-file-preview.tsx` → `task-file-preview.tsx`, `delete-plan-section.tsx` →
`delete-task-section.tsx`, `new-plan-form.tsx` → `new-task-form.tsx`.

API routes:

| Old | New |
| --- | --- |
| `GET/POST /api/projects/[id]/tasks` | `GET/POST /api/projects/[id]/workitems` |
| `GET/PATCH/DELETE /api/projects/[id]/tasks/[taskId]` | `GET/PATCH/DELETE /api/projects/[id]/workitems/[workitemId]` |
| `GET /api/projects/[id]/tasks/[taskId]/plan-prompt` | `GET /api/projects/[id]/workitems/[workitemId]/plan-prompt` (name kept — it is the plan step) |
| `GET/POST /api/plans` | `GET/POST /api/tasks` |
| `GET/PATCH/DELETE /api/plans/[planId]` | `GET/PATCH/DELETE /api/tasks/[taskId]` |
| `GET /api/plans/[planId]/task-prompt` | `GET /api/tasks/[taskId]/execution-prompt` |
| `DELETE /api/projects/[id]?deleteTasks=true` | `DELETE /api/projects/[id]?deleteWorkitems=true` |

Request/response payload keys follow the same rename: `POST /api/tasks` accepts
`{ projectId, workitemId, title, filePath, summary }`; the plan-prompt response returns
`{ agent, projectId, projectName, projectPath, workitemId, prompt }`; the execution-prompt
response returns `{ agent, taskId, projectId, projectName, projectPath, workitemId, filePath, prompt }`.

Console query parameters and session context:

| Old | New |
| --- | --- |
| `/console?planProjectId=…&planTaskId=…` | `/console?planProjectId=…&planWorkitemId=…` |
| `/console?taskPlanId=…` | `/console?runTaskId=…` |
| `SessionContext = { projectId, taskId, planId? }` | `SessionContext = { projectId, workitemId, taskId? }` |
| `ServerMessage` `{ type: "task-changed", projectId, taskId, status }` | `{ type: "workitem-changed", projectId, workitemId, status }` |

Console hook/component renames: `use-plan-execution.ts` → `use-task-execution.ts`
(`usePlanExecution` → `useTaskExecution`, `updatePlanStatus` → `updateTaskStatus`),
`plan-close-prompt.tsx` → `task-close-prompt.tsx`, `plan-completion-action.tsx` →
`task-completion-action.tsx`. `use-plan-run.ts` and `use-plan-creation.ts` keep their names —
they drive the plan step — but their identifiers move to workitem/task vocabulary
(`planTaskIdRef` → `planWorkitemIdRef`). `use-task-run.ts` keeps its name and now reads
`runTaskId`.

UI copy: main navigation becomes `Projects | Workitems | Tasks | Logs | Console | Settings`.
The workitem detail action stays **Create plan** (it names the step); the task list action stays
**Execute task**. The console close-out copy reads "Task #N and workitem #M were marked
completed." Log entity labels become `Workitem #N` and `Task #N`.

### Data migration

Add a server-only, idempotent migration module (e.g. `src/lib/data-migration.ts`) exposing a
single promise-cached `ensureDataMigrated()` that both stores and the lifecycle-log store await
before their first read or write. Ordering matters, because `data/tasks.json` changes meaning:

1. **Workitems** — if `data/workitems.json` does not exist and `data/tasks.json` exists and its
   entries have no `filePath` (i.e. it is still the old task document), read it, map each entry's
   status (`plan_creating` → `task_creating`, `plan_created` → `task_created`), write
   `{ "workitems": [...] }` to `data/workitems.json`, then remove `data/tasks.json`.
2. **Tasks** — if `data/tasks.json` does not exist and `data/plans.json` exists, read it, rename
   each entry's `taskId` → `workitemId`, map status `registered` → `created` (and the existing
   legacy terminal status handling in `plans-store.ts` → `completed`), write `{ "tasks": [...] }`
   to `data/tasks.json`, then remove `data/plans.json`.
3. **Lifecycle log** — version-gate this one: if `data/lifecycle-log.json` has no `version` field,
   rewrite every event (`entityType: "task"` → `"workitem"` with `plan_creating`/`plan_created`
   status mapping; `entityType: "plan"` → `"task"` with `registered` → `created`) and save the
   document as `{ "version": 2, "events": [...] }`. New writes always carry `version: 2`, so the
   migration never runs twice and never mistakes a new task event for an old workitem event.

Independently of the migration, both stores normalize legacy status values on read (the existing
`LEGACY_COMPLETED_STATUS` handling in `plans-store.ts` is the precedent to follow), so a
hand-edited or partially migrated file still loads. Migration failures must surface as the
store's existing `*StoreError` with a message naming the file to check; a missing source file is
not an error. Do not delete a source file until its replacement has been written successfully.

## Acceptance Criteria

### Domain and storage

- [ ] `src/lib/workitems-store.ts` persists workitems in `data/workitems.json` under a
      `workitems` key, with statuses `open`, `task_creating`, `task_created`, `in_progress`,
      `completed`, `cancelled`, and no remaining `Task`-named export.
- [ ] `src/lib/tasks-store.ts` persists tasks in `data/tasks.json` under a `tasks` key, each with
      `id`, `projectId`, `workitemId`, `title`, `filePath`, `summary`, `status`
      (`created`, `executing`, `executed`, `completed`, `cancelled`), `createdAt`, `updatedAt`.
- [ ] `ensureDataMigrated()` performs the three migration steps above exactly once per data
      directory, in order, is safe to call concurrently from multiple store entry points, and is a
      no-op when the new files already exist.
- [ ] Reading a workitem whose stored status is `plan_creating`/`plan_created`, or a task whose
      stored status is `registered`, yields `task_creating`/`task_created`/`created`.
- [ ] `data/lifecycle-log.json` gains `"version": 2`; events written after the change use
      `entityType: "workitem" | "task"` and the new status values, and the un-versioned legacy
      document is converted on first read.
- [ ] No file under `src/` or `server/` still imports `plans-store`, `plan-filters`,
      `plan-file`, `task-plan`, `task-run`, or `task-events`; `grep -rn "Plan" src server`
      returns only plan-*step* usages (plan agent, planning prompts, `planConsoleHref`,
      `plan-prompt` route, `Create plan` copy).

### Routes

- [ ] `/workitems`, `/workitems/new`, and `/projects/[id]/workitems/[workitemId]` render the
      former task list, creation form, and detail page with workitem vocabulary; the list keeps
      pagination, project and status filters, live updates, and status buttons.
- [ ] `/tasks`, `/tasks/new`, and `/tasks/[taskId]` render the former plan list, manual
      registration form, and detail page with task vocabulary; the list keeps pagination, project
      and status filters, and the **Execute task** action, and the detail page keeps the file
      preview, status control, editing, and deletion with optional file removal.
- [ ] `/plans`, `/plans/new`, and `/plans/[planId]` permanently redirect to `/tasks`,
      `/tasks/new`, and `/tasks/[taskId]`, preserving the query string.
- [ ] `/projects/[id]/tasks`, `/projects/[id]/tasks/new`, and `/projects/[id]/tasks/[taskId]`
      permanently redirect to the matching `/projects/[id]/workitems…` paths (which themselves
      redirect the list and creation URLs to `/workitems` and `/workitems/new`).
- [ ] The old `/tasks` workitem-list URL is **not** redirected — that path now belongs to the task
      list. This is called out in `PROJECT_DOCUMENT.md` as an intentional break.
- [ ] Main navigation shows `Projects, Workitems, Tasks, Logs, Console, Settings`, and every
      internal link is produced by the href helpers (`workitemsHref`, `newWorkitemHref`,
      `tasksHref`, `taskDetailHref`, `newTaskHref`, `planConsoleHref`, `taskConsoleHref`) rather
      than hand-written strings.

### API

- [ ] All API routes match the naming map, including the renamed
      `/api/tasks/[taskId]/execution-prompt` and the kept
      `/api/projects/[id]/workitems/[workitemId]/plan-prompt`; no route file remains under
      `src/app/api/plans/` or `src/app/api/projects/[id]/tasks/`.
- [ ] `POST /api/tasks` validates `workitemId` (rejecting a body that only carries `taskId`) and
      returns 201 with the created task; error wording keeps the existing "check the data file"
      style with the new file names.
- [ ] `DELETE /api/projects/[id]?deleteWorkitems=true` removes the project's workitems, and the
      project detail page's delete dialog uses the new parameter and workitem wording.
- [ ] Registering a task still advances its workitem from `open`, `task_creating`, or
      `in_progress` to `task_created`, and leaves `task_created`, `completed`, and `cancelled`
      workitems unchanged.

### Console and prompts

- [ ] `SessionContext` is `{ projectId, workitemId, taskId? }`, `isSessionContext` validates the
      new shape, and the server broadcasts `workitem-changed` with `workitemId`; the workitem list
      still refreshes live.
- [ ] `/console?planProjectId=…&planWorkitemId=…` starts a planning session with the Plan agent
      and the composed plan prompt; `/console?runTaskId=…` starts an execution session with the
      Task agent and the composed execution prompt, advancing the task to `executing`.
- [ ] After an execution session's agent exits, the task is marked `executed`, the close-out
      prompt offers to complete the task and its workitem, and completing both removes the
      session — same behavior as today, with the new wording.
- [ ] `composePlanPrompt` names the workitem (`## Workitem #{id}: {title}`) and instructs the
      agent to register the finished task file with `POST /api/tasks` using a `workitemId` field;
      the registration `curl` example and the plan-language section are updated to the same
      vocabulary. `composeTaskPrompt` names `Task #{id}` and `Workitem #{workitemId}` and still
      does not inline the file contents.
- [ ] Built-in prompt Markdown in `src/lib/default-prompts/` is re-worded where it names the old
      concepts; settings prompt labels/descriptions in `src/lib/settings-prompts.ts` describe the
      plan step as producing a task from a workitem. Setting keys and slugs (`planPrompt`,
      `planPostPrompt`, `taskPrompt`, `taskPostPrompt`, `plan`, `plan-post`, `task`, `task-post`)
      and `data/settings.json` are unchanged, so saved prompts survive.

### Logs and documentation

- [ ] `/logs` labels events `Workitem #N` / `Task #N`, links them to
      `/projects/[id]/workitems/[workitemId]` and `/tasks/[taskId]`, still detects deleted
      records, and still reports malformed lifecycle data safely.
- [ ] `.agent/PROJECT_DOCUMENT.md` is updated: the data files, entity vocabulary, statuses,
      route table, repository structure, and "Delivered session capabilities" section describe
      workitems and tasks, and record both the migration and the non-redirected `/tasks` break.

## Technical Notes

- **Do the rename in dependency order** to avoid a half-renamed tree that does not type-check:
  (1) workitem side (`task-filters` → `workitem-filters`, `tasks-store` → `workitems-store`,
  `task-events` → `workitem-events`, `/tasks` pages → `/workitems`, task API → workitem API);
  (2) only then the task side (`plan-filters` → `task-filters`, `plans-store` → `tasks-store`,
  `plan-file` → `task-file`, `/plans` pages → `/tasks`, plan API → task API); (3) console,
  protocol, prompts; (4) migration module; (5) redirects; (6) docs. Steps 1 and 2 both want the
  names `task-filters.ts` and `tasks-store.ts`, so the old files must be gone before the new ones
  land there.
- Use `git mv` for file moves so history follows the rename, and prefer editing identifiers over
  re-typing files wholesale.
- A blind global find-and-replace will corrupt the plan-step names that must survive
  (`planAgent`, `planPrompt`, `planPostPrompt`, `plan-prompt` route, `composePlanPrompt`,
  `planConsoleHref`, `usePlanRun`, `usePlanCreation`, `Create plan`, `.agent/tasks/` paths in
  prompts). Review every `plan`/`Plan` occurrence individually.
- `src/lib/plan-file.ts` guards against absolute paths and paths escaping the project directory —
  keep that logic identical when it becomes `task-file.ts`; it is a security boundary.
- The workitems store is `"server-only"` while `workitem-filters.ts` must stay client-safe (it is
  imported by client filter components). Keep the same split for the task side: store server-only,
  `task-filters.ts` client-safe, and never import a store from a client component.
- `src/lib/agent-protocol.ts` is shared by browser and server; changing `SessionContext` and the
  `workitem-changed` message means the server and any open browser tab must agree. In-memory
  sessions do not survive a restart, so no compatibility shim is needed — but state the break in
  the commit body.
- Keep every file under the repository's 600-line rule; if `agent-console.tsx` (560 lines) grows
  past it during the rename, extract the affected block rather than letting it swell.
- Saved user prompts in `data/settings.json` may still mention `/api/plans` or "plan"; do not
  rewrite user data. Only built-in defaults are updated.
- Existing task files under `.agent/tasks/` (for example
  `agenthub-project#10-plan-list-execute-task-button.md`) describe the old vocabulary. Do not
  rewrite them; this task supersedes their naming.

## Verification

- [ ] `pnpm build` completes with no type errors.
- [ ] `pnpm lint` passes with no errors.
- [ ] With a populated `data/` directory, start `pnpm dev` once and confirm the migration
      produced `data/workitems.json` and a task-shaped `data/tasks.json`, removed `data/plans.json`,
      and versioned `data/lifecycle-log.json` — and that a second start changes nothing.
- [ ] Manually walk the flow: create a workitem at `/workitems/new` → **Create plan** starts a
      planning session → registering a task through `POST /api/tasks` moves the workitem to
      `Task created` and shows the task at `/tasks` → **Execute task** starts an execution
      session and moves the task to `Executing` → after exit, complete the task and workitem from
      the console.
- [ ] Confirm `/plans`, `/plans/12`, and `/projects/{id}/tasks/3` redirect to their new paths, and
      that `/logs` renders workitem and task events with working links.
