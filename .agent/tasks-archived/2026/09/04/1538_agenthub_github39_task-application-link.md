# Every task belongs to an application: planning per application, execution in the application directory

---
**Execution Guidelines**: Before starting this task, ensure you've read `.agent/commands/tasks/do-task.md` (if not already read in this session). This file contains essential guidelines on how to properly execute tasks, including dependency checking, verification steps, and archival procedures.

**Application-specific documentation**: This repository is a single application; there is no `apps/{APP_NAME}/` directory. Read `.agent/PROJECT_DOCUMENT.md` before starting the task — it contains the tech stack, conventions, and verification steps.

When this task file is read standalone, the agent should:
1. Check if `do-task.md` has been read in the current session
2. If not, read it first to understand the execution workflow
3. Read `.agent/PROJECT_DOCUMENT.md` before starting the task
4. Then proceed with this specific task
---

## Description

A **Task** (a registered task file) is bound to exactly one **Application** of its project. A
**Workitem** stays bound to the project only — it is not linked to an application.

The reason: when a workitem is planned, the planning agent produces **one task file per
application** of that project. Each of those registrations carries the `applicationId` it was
written for.

This changes four things:

1. **Data** — `Task` gains a required `applicationId`. Existing task records that have none are
   deleted by a one-time migration.
2. **Planning** — the planning session keeps running in the **project** directory, but its composed
   prompt now lists the project's applications and instructs the agent to create and register one
   task per application. A project with **no** applications cannot start task creation at all.
3. **Execution** — a task-execution session runs in its **application's** directory, not the project
   directory.
4. **Display** — the application name is visible in the task list, on the task detail page, and in
   the console while a task session is running.

## Application

agenthub (repository root — this project has no `apps/` directory)

## GitHub Issue

- Issue #39

## Dependencies

None - This task is independent

## Context

### Clarified decisions (already agreed with the user — do not re-ask)

| Question | Decision |
| --- | --- |
| Which record links to an application | **Task only.** Workitems stay project-bound; they get no application field and no application column. |
| Why | Planning a workitem produces **one task per application**, so the link belongs to the task. |
| Planning session directory | **Project path**, unchanged. |
| Task-execution session directory | **The task's application path.** |
| Existing records without an application | **Deleted** by a one-time migration. |
| Projects with no applications | Workitem creation stays allowed. **Task creation is blocked** until the project has at least one application. |

### Relevant existing files

- `src/lib/tasks-store.ts` — server-only persisted task store (`data/tasks.json`): `Task`,
  `StoredTask`, `isTask`, `normalizeTask`, `taskDetails`, `taskPatch`, `createTask`, `updateTask`,
  `deleteTask`, `getTask`, `listAllTasks`, `listTasksForWorkitem`, `listLatestTasksByWorkitem`,
  `deleteTasksForWorkitem`. Every write goes through `serializeWrite`.
- `src/lib/applications-store.ts` — `Application { id, projectId, name, path, createdAt, updatedAt }`,
  `listApplications`, `listProjectApplications`, `getApplication`, `createApplication`,
  `updateApplication`, `deleteApplication`, `deleteProjectApplications`.
- `src/lib/data-migration.ts` — idempotent one-time migrations, run from `ensureDataMigrated()` at
  the top of every store `readDocument()`.
- `src/lib/plan-prompt.ts` — `composePlanPrompt` (code-defined sections: workitem section, plan
  language rule, `## Register the plan in AgentHub`) and `planConsoleHref`.
- `src/app/api/projects/[id]/workitems/[workitemId]/plan-prompt/route.ts` — composes the planning
  prompt and is the server-side gate for **Create task**.
- `src/lib/task-execution.ts` — `composeTaskPrompt` (`## Task file` section and the
  `PATCH /api/tasks/{id}` reporting section) and `taskConsoleHref(taskId)`.
- `src/app/api/tasks/[taskId]/execution-prompt/route.ts` — composes the execution prompt and returns
  `agent`, `taskId`, `projectId`, `projectName`, `projectPath`, `workitemId`, `filePath`, `prompt`.
- `src/app/api/tasks/route.ts` — `GET` (paginated list) and `POST` (registration used by the planning
  agent; also advances the workitem to `task_created`).
- `src/app/tasks/page.tsx` — cross-project task list (a `ul` of rows, not a `<table>`).
- `src/app/tasks/[taskId]/page.tsx` + `task-detail.tsx` + `task-file-preview.tsx` — read-only task
  detail with status actions and file preview.
- `src/app/tasks/new/new-task-form.tsx` + `src/app/tasks/new/page.tsx` — manual task registration.
- `src/app/workitems/page.tsx` and
  `src/app/projects/[id]/workitems/[workitemId]/workitem-detail.tsx` — compute `canCreateTask` and
  render the **Create task** / **Execute task** links (shared style:
  `src/app/workitems/action-button-styles.ts`).
- `src/lib/agent-protocol.ts` — `SessionContext { projectId, workitemId, taskId? }`,
  `isSessionContext`, and the `start` client message.
- `server/session-registry.ts` — keeps `execution` context on the in-memory session summary.
- `src/app/console/agent-console.tsx` — `startSession(agent, project, prompt, completion, context, cwd)`;
  `cwd` already defaults to `project.path` and is overridable.
- `src/app/console/use-task-run.ts` / `use-plan-run.ts` — start execution / planning sessions from URL
  parameters.
- `src/app/console/session-project.ts` — `resolveSessionProject(cwd, projects)` already resolves a
  session's application from its `cwd`; `session-sidebar.tsx` already prints `· {application.name}`.
- `src/app/console/session-info.tsx` — contextual line under the session header
  (`Task 12 (Workitem 5) - title`).
- `src/app/project-chip.tsx` — `ProjectChip` / `UnknownProjectChip`, the existing chip pattern.

### Existing behaviour that must not regress

- `GET /api/projects` already returns each project with its `applications` array; the console loads
  projects from there. Reuse it rather than adding a parallel endpoint.
- Task file paths stay **project-relative** (`resolveTaskFilePath(project.path, task.filePath)` in
  `src/lib/task-file.ts`), because the detail page reads and the delete flow removes
  `{project.path}/{task.filePath}`. Only the execution session's working directory changes.
- `canCreateTask` today means: the workitem has no registered tasks **and** its status is neither
  `task_creating` nor `task_created`. One planning session now registers several tasks (one per
  application); that rule still holds — do not weaken it.
- `DeleteWorkitemTasksButton` deletes every task of a workitem plus its Markdown file and returns a
  `task_creating` / `task_created` workitem to `open`. It must keep working with multiple tasks.
- Legacy `data/plans.json` → `data/tasks.json` migration and the lifecycle-log v2 migration must keep
  running before the new step.

## Acceptance Criteria

### Data model

- [ ] `Task` carries a required `applicationId: string` persisted in `data/tasks.json`.
- [ ] `isTask` rejects a record whose `applicationId` is missing, not a string, or blank.
- [ ] `taskDetails` requires `applicationId` and raises `TaskValidationError` with a clear message
      when it is absent or blank.
- [ ] `taskPatch` accepts `applicationId` as an optional patch field with the same validation.
- [ ] `Workitem` is **not** changed: no application field, no application column, no application
      select on the workitem forms.

### One-time migration

- [ ] `src/lib/data-migration.ts` gains an idempotent step that removes every record in
      `data/tasks.json` without a usable `applicationId`, running **before** the store's schema
      validation can reject the file (the existing `ensureDataMigrated()` call at the top of
      `readDocument()` already provides that ordering).
- [ ] The step only removes **records**; it must not delete any Markdown file from disk.
- [ ] Workitems left in `task_creating` or `task_created` with zero remaining tasks are returned to
      `open`, mirroring the existing **Delete tasks** behaviour. Other statuses are left alone.
- [ ] Running the migration twice changes nothing the second time, and a `data/tasks.json` that is
      already fully migrated is not rewritten.
- [ ] Lifecycle-log entries for removed tasks are left in place; `/logs` already handles records that
      no longer exist.

### Planning: one task per application

- [ ] `GET /api/projects/[id]/workitems/[workitemId]/plan-prompt` loads the project's applications
      and returns `409` with an actionable message when the project has none, for example:
      "Add an application to this project before creating tasks." No prompt is composed in that case.
- [ ] The response includes the project's applications (id, name, path) so the console can surface
      them if needed.
- [ ] `composePlanPrompt` gains a code-defined `## Applications` section listing every application as
      `- {name} — id: {applicationId} — directory: {absolute path}`, and instructing the agent to:
      - write **one task file per application**, each scoped to that application's codebase;
      - register **one task per application** with `POST /api/tasks`, each including
        `"applicationId":"<that application's id>"`;
      - keep every registered `filePath` **relative to the project directory**, not to the
        application directory.
- [ ] The `## Register the plan in AgentHub` section's `curl` example includes `applicationId` and
      states that the call is repeated once per application.
- [ ] The built-in Markdown prompts under `src/lib/default-prompts/` are **not** edited; the new rule
      lives in the code-composed section, like the existing plan-language and registration sections.
- [ ] The planning session's working directory is still the **project** path.
- [ ] **Create task** is hidden (or rendered disabled with a reason) on `/workitems` and on the
      workitem detail page when the workitem's project has no applications, with a short message
      linking to `/projects/{id}` to add one. Existing conditions still apply on top of this.
- [ ] `use-plan-run.ts` surfaces the `409` message in the console error area instead of failing
      silently.

### Task registration API

- [ ] `POST /api/tasks` requires `applicationId`, and returns `404` with a clear message when the
      application does not exist, or `400` when it exists but belongs to a different project.
- [ ] A successful registration stores `applicationId` and keeps the existing workitem status
      transition to `task_created`.
- [ ] `PATCH /api/tasks/[taskId]` validates `applicationId` the same way when it is supplied.

### Execution in the application directory

- [ ] `GET /api/tasks/[taskId]/execution-prompt` resolves the task's application and returns
      `applicationId`, `applicationName`, and `applicationPath` alongside the existing fields.
- [ ] It returns `409` (or `404`) with an actionable message when the application no longer exists,
      instead of falling back to the project directory.
- [ ] `composeTaskPrompt` gains an `## Application` line in its task-file section naming the
      application and its absolute working directory, and states the task file's **absolute** path
      (`{project.path}/{task.filePath}`) as well as the project-relative one — the session's `cwd` is
      the application directory, so a project-relative path alone is not resolvable from there.
- [ ] `use-task-run.ts` passes `applicationPath` as the session `cwd` and selects the matching
      application in the launcher state (`setSelectedApplicationId`), so the console reflects where
      the session is running.
- [ ] The task file path validation in the route still resolves against the **project** path.

### Console display

- [ ] `SessionContext` gains an optional `applicationId: string`, validated by `isSessionContext`
      (non-empty string, length capped like `projectId`), and execution sessions pass it. The
      in-memory session registry keeps it in the summary, so it survives a reload of `/console`.
- [ ] While a task session is selected, the console shows the application name — extend
      `session-info.tsx` so the contextual line reads e.g.
      `Task 12 (Workitem 5) · {application name} - {task title}`. Resolve the name from the loaded
      projects' applications by `applicationId`, falling back to the existing `cwd` resolution
      (`resolveSessionProject`) when the id is absent.
- [ ] The session sidebar keeps showing `ProjectChip · {application name}`; verify it now resolves for
      execution sessions because their `cwd` is the application path.

### Task list and task detail

- [ ] `/tasks` shows the application name for every task, next to the existing project chip in the
      row's first line (the list is not a `<table>`; the chip position is the column equivalent).
      Use the same chip/label vocabulary as `ProjectChip` rather than inventing a new style.
- [ ] A task whose application no longer exists shows an "Unknown application" chip, mirroring
      `UnknownProjectChip`; the page must not error.
- [ ] The task detail page (`/tasks/[taskId]`) shows the application name and its absolute path in
      the read-only detail area. The page stays read-only — do not reintroduce editable fields.
- [ ] Application data is loaded server-side on both pages (one `listApplications()` call for the
      list page, `getApplication()` for the detail page); do not fetch per row from the client.

### Manual task registration form

- [ ] `/tasks/new` gains a required **Application** select, populated from the selected project's
      applications and cleared when the project changes. When the chosen project has no
      applications, the form blocks submission with a message linking to that project's page.
- [ ] The same form currently posts `taskId` while `POST /api/tasks` requires `workitemId`, and its
      second select is populated from registered **tasks** instead of the project's **workitems** —
      so manual registration cannot succeed today. Fix both as part of this task: list the project's
      workitems and send `workitemId`. (`src/app/tasks/new/page.tsx` must load workitems, e.g. via
      `listAllWorkitems`, instead of `listAllTasks`.)

### Project document

- [ ] `.agent/PROJECT_DOCUMENT.md` is updated to state that a task carries a required
      `applicationId`, that planning produces one task per application while the planning session
      runs in the project directory, that a task-execution session runs in its application's
      directory, that task creation is blocked for projects without applications, and that the
      one-time migration deleted application-less task records.

## Technical Notes

- **Read the Next.js docs first.** The installed Next.js (16.3.4) is newer than most training data.
  Before writing route or page code, read the relevant guide under `node_modules/next/dist/docs/`.
  Route handlers use the typed `RouteContext<"...">` / `PageProps<"...">` helpers with
  `export const dynamic = "force-dynamic"` — follow the existing shape.
- Keep every `data/tasks.json` write inside `serializeWrite` so concurrent registrations cannot
  interleave a read-modify-write. The planning agent now issues **several** `POST /api/tasks` calls
  in a row for one workitem, so this matters more than before.
- The migration must not import the task store (that would recurse through `ensureDataMigrated`);
  follow the existing pattern in `data-migration.ts` of reading and writing the JSON files directly.
  It needs to touch `data/workitems.json` too for the status reset — do the same there.
- Deleting an application is **not** cascaded to its tasks. Those tasks render "Unknown application"
  and refuse to start an execution session with a clear message. Do not add a cascade delete and do
  not block application deletion in this task.
- Do not add an application filter to `/tasks` in this task; only display is requested.
- Validation and error messages follow the existing tone — full sentences ending in a period, e.g.
  "The selected application does not belong to this task's project."
- Reuse `WORKITEM_ACTION_LINK_CLASS` (and add a disabled/blocked variant there if needed) instead of
  inlining one-off classes for the blocked **Create task** state in two files.
- **Code readability rule** from `PROJECT_DOCUMENT.md`: no dense one-liners for multi-step logic, and
  honour the 600-line-per-file guideline. `src/app/console/agent-console.tsx` is already ~627 lines —
  do not grow it; put new console logic in the existing hook/component files.
- `src/app/api/tasks/route.ts` is written in a very compressed style; when you touch it, reformat the
  lines you modify into readable multi-line code as the project document requires.

## Verification

- [ ] `pnpm build` succeeds with no type errors.
- [ ] `pnpm lint` passes; fix any error introduced by this work.
- [ ] Manual check, with `pnpm dev` running:
      - a project with two applications: **Create task** on a workitem opens a planning session in
        the project directory, and the composed prompt lists both applications with their ids;
      - a project with no applications: **Create task** is unavailable, and calling the plan-prompt
        endpoint directly returns `409` with the actionable message;
      - `POST /api/tasks` without `applicationId`, with an unknown one, and with one from another
        project all fail with the right status and message; a valid registration succeeds;
      - `/tasks` and `/tasks/[taskId]` show the application name, and a task whose application was
        deleted shows "Unknown application" without erroring;
      - **Execute task** starts the session in the application's directory (confirm via the session
        information control / sidebar) and the console shows the application name while it runs;
      - `/tasks/new` registers a task end to end with project, workitem, and application selected.
- [ ] Migration check: with a `data/tasks.json` containing records without `applicationId`, starting
      the app removes those records, leaves their Markdown files on disk, and returns affected
      workitems to `open`; a second start changes nothing.
