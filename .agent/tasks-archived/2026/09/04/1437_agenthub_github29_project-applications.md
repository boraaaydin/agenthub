# Applications under a project, with per-application paths and console session selection

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

From GitHub issue #29: a project should own one or more **applications**. Each application has its
own name and its own absolute working-directory path, so a single project can hold several code
bases (for example a monorepo with `apps/api` and `apps/ui`).

Three parts:

1. **An `Application` record and its store.** A new persisted entity `{ id, projectId, name, path,
   createdAt, updatedAt }` kept in a git-ignored `data/applications.json` through a new
   `src/lib/applications-store.ts`, modelled on `src/lib/projects-store.ts`.
2. **Project screens manage applications.** Creating a project also creates one default application,
   pre-filled with the project's own name and path but editable in the create form before submit.
   The project detail page gains an **Applications** section that lists the project's applications
   and can add, edit, and delete them.
3. **The console picks an application for a new session.** The new-session form gains an application
   selector next to the project selector, and the started PTY session runs with
   `cwd = application.path` instead of `project.path`.

Workitems and tasks are deliberately **not** given an application field in this task. Planning and
task-execution sessions keep running in `project.path` exactly as they do today.

## Application

Root application (`agenthub`)

## GitHub Issue

- Issue #29

Decisions confirmed with the user while planning:

- **Scope**: application CRUD **plus** console new-session application selection only. Workitem and
  task records get **no** `applicationId`; `/api/projects/[id]/workitems/[workitemId]/plan-prompt`
  and `/api/tasks/[taskId]/execution-prompt` keep returning and using `project.path`.
- **Existing data**: **no migration.** The four projects already in `data/projects.json` stay without
  applications; the UI shows an empty state and the user adds applications by hand.
- **Storage**: a separate `data/applications.json` store, not an array nested in `data/projects.json`.
- **Deletion**: a project may not be left with zero applications by a delete — deleting a project's
  **last remaining** application is rejected. Deleting a project deletes its applications.

Assumption made while writing this task (flagged, not asked): because existing projects legitimately
have zero applications, the console must **not** be blocked for them. When the selected project has
no applications, the console falls back to `project.path`, labels the choice clearly, and shows an
inline hint linking to the project page so the user can add one. Starting a session stays possible.

## Dependencies

None - This task is independent.

Note: the working tree may still contain in-progress work for issue #32 (remote access / Tailscale),
which touches `server.ts`, `server/session-registry.ts`, `src/lib/agent-protocol.ts`, and
`src/app/console/session-sidebar.tsx`. Rebase or merge carefully; this task does not depend on it.

## Context

Files that matter for this work:

- `src/lib/projects-store.ts` — the template for the new store: `server-only` import, JSON document
  parse/normalize with a dedicated `*StoreError`, `*ValidationError`, a serialized write queue
  (`serializeWrite`), `path.resolve` on input paths, and `validateDirectory` via `fs.stat`.
- `src/app/api/projects/route.ts` and `src/app/api/projects/[id]/route.ts` — the Route Handler style
  to copy: `export const dynamic = "force-dynamic"`, `Response.json`, 400 for validation errors,
  404 for a missing record, 500 with a store-specific message logged through `console.error`.
  `DELETE /api/projects/[id]` already cascades to workitems when `?deleteTasks=true`.
- `src/app/projects/new/page.tsx` (142 lines) — client form posting `{ name, path, color }` to
  `/api/projects`.
- `src/app/projects/[id]/project-detail.tsx` (296 lines) and `src/app/projects/[id]/page.tsx` — the
  editable project detail screen and its server component.
- `src/app/console/agent-console.tsx` (**589 lines** — see the 600-line rule below) — holds
  `ConsoleProject`, the project `<select>`, and `startSession`, which currently sends
  `cwd: project.path`. `activeProject` is derived with `projects.find((p) => p.path === session.cwd)`.
- `src/app/console/session-sidebar.tsx` — `sessionProject(cwd, projects)` matches a session to a
  project the same way, by `project.path === cwd`.
- `src/app/console/session-info.tsx` — shows the session's `cwd` through the ⓘ control.
- `src/app/console/use-plan-run.ts` and `use-task-run.ts` — call `startSession` for planning and
  execution sessions and match a project with `candidate.path === result.projectPath`. These flows
  must keep using `project.path`.
- `src/lib/agent-protocol.ts` — `ClientMessage["start"]` carries `cwd`; the server validates it and
  `server/session-registry.ts` resolves and stats it in `validateDirectory`. Sending an application
  path needs no protocol change.
- `.gitignore` already ignores all of `/data/`, so `data/applications.json` is ignored automatically.

## Acceptance Criteria

**Store**

- [ ] `src/lib/applications-store.ts` exists and persists to `data/applications.json` with the
      document shape `{ "applications": [...] }`.
- [ ] `Application` is `{ id: string; projectId: string; name: string; path: string; createdAt: string; updatedAt: string }`.
- [ ] Reading a missing `data/applications.json` yields an empty list; malformed JSON or a malformed
      document throws `ApplicationStoreError` naming the file path.
- [ ] Exposes at least: `listApplications()`, `listProjectApplications(projectId)`,
      `getApplication(id)`, `createApplication(projectId, input)`, `updateApplication(id, input)`,
      `deleteApplication(id)`, `deleteProjectApplications(projectId)`.
- [ ] Validation mirrors projects: name required and trimmed, path required, `path.resolve`d, and
      verified to be an existing directory; failures throw `ApplicationValidationError`.
- [ ] All writes go through a serialized write queue, as in `projects-store.ts`.
- [ ] `deleteApplication` refuses to remove a project's last remaining application and throws
      `ApplicationValidationError` with a clear message.
- [ ] `deleteProjectApplications(projectId)` removes every application of that project regardless of
      the last-application rule.

**API**

- [ ] `GET /api/projects/[id]/applications` returns the project's applications, or 404 when the
      project does not exist.
- [ ] `POST /api/projects/[id]/applications` creates one (201) and validates the body.
- [ ] `PATCH /api/projects/[id]/applications/[applicationId]` updates name and path.
- [ ] `DELETE /api/projects/[id]/applications/[applicationId]` deletes one, and returns **409** with
      the store's message when it is the project's last application.
- [ ] `GET /api/projects` includes each project's applications so the console can populate its
      selector from a single request; the shape stays backward compatible for the other consumer
      (`src/app/projects/new/page.tsx`).
- [ ] `POST /api/projects` accepts an optional `application: { name, path }`. It creates the project
      and then its default application (falling back to the project's own name and path when the key
      is absent). If the application cannot be created, the just-created project is deleted again so
      no half-created project is left behind, and the error is returned to the client.
- [ ] `DELETE /api/projects/[id]` also removes that project's applications.

**Project screens**

- [ ] `/projects/new` shows a **Default application** section with name and path inputs, pre-filled
      from the project name and path fields and kept in sync until the user edits them; after that
      the application inputs keep their own value.
- [ ] The project detail page lists the project's applications with name and path, and supports
      adding, editing, and deleting one.
- [ ] Deleting the last application shows the server's 409 message inline and does not remove it.
- [ ] A project with no applications shows an empty state that explains one should be added.

**Console**

- [ ] The new-session form has an application selector beside the project selector; changing the
      project resets the selection to that project's first application.
- [ ] Starting a session sends `cwd = selected application.path`.
- [ ] For a project with no applications, the selector offers a single clearly labelled fallback
      entry that uses the project path, an inline hint points at the project page, and starting a
      session still works.
- [ ] Planning sessions (`use-plan-run.ts`) and task-execution sessions (`use-task-run.ts`) still
      start with `cwd = project.path`.
- [ ] The console header and the session sidebar still show the correct project for a running
      session whose `cwd` is an application path, and the session's application name is visible
      alongside the project name.
- [ ] `src/app/console/agent-console.tsx` stays under 600 lines.

## Technical Notes

- **Do not touch the workitem or task stores.** No `applicationId`, no `data-migration.ts` change, no
  lifecycle-log change. Keeping this task inside projects, applications, and the console is what
  makes it safe to ship on its own.
- **Session → project resolution must change.** Both `agent-console.tsx` (`activeProject`) and
  `session-sidebar.tsx` (`sessionProject`) currently assume `session.cwd === project.path`. Resolve
  in this order instead: match an application whose `path === cwd` and take its project; otherwise
  match a project whose `path === cwd`; otherwise fall back to the existing last-path-segment label.
  Put that resolution in one shared helper (for example `src/app/console/session-project.ts`) rather
  than duplicating it in both components.
- **`startSession` needs an explicit cwd.** It currently derives `cwd` from its `project` argument.
  Give it the chosen working directory explicitly (an extra parameter defaulting to `project.path`,
  or a `{ project, cwd }` argument) so `use-plan-run.ts` and `use-task-run.ts` keep their current
  behaviour untouched while the manual new-session path passes the application path.
- **Keep `agent-console.tsx` under 600 lines.** It is already at 589. Extract the project +
  application selection block into a colocated client component (for example
  `src/app/console/session-launcher-fields.tsx`) instead of growing the file. See the 600-line rule
  in `.agent/commands/tasks/do-task-post.md`.
- **`ConsoleProject` gains `applications`.** Extend the type in the console with
  `applications: { id: string; name: string; path: string }[]` and default it to `[]` when the API
  response omits it, so an older `data/` directory cannot crash the screen.
- **The project detail page is a server component wrapping a client component**
  (`page.tsx` → `project-detail.tsx`). Load the project's applications server-side in `page.tsx` and
  pass them in as a prop for the first render; the client component then mutates them through the
  API and refreshes with `router.refresh()`, matching how the existing project form behaves.
- **Uniqueness.** Two applications of the same project must not share a name; reject a duplicate with
  `ApplicationValidationError`. Two applications sharing a path is allowed (a monorepo root and a
  sub-app can legitimately overlap), but note that path-based session resolution then picks the first
  match — acceptable, and the reason the fallback chain above ends at the project.
- **Language.** All code, identifiers, UI strings, and this file's prose stay in English; the GitHub
  issue comment written during close-out is in Turkish, matching the issue.
- **Readability.** `src/app/console/*.ts(x)` contains several deliberately dense one-line functions.
  Do not imitate that style in new code; follow the Code Readability section of
  `.agent/PROJECT_DOCUMENT.md` and, where you edit such a line, reformat it into readable multi-line
  code as long as behaviour does not change.
- **Next.js version caution.** The installed Next.js is newer than most training data. Before writing
  Route Handler or App Router code, read the relevant guide under `node_modules/next/dist/docs/`.
  Note the typed `RouteContext<"/api/projects/[id]">` helper used by the existing handlers; the new
  nested routes use the same pattern with their own path literal.
- **Update `.agent/PROJECT_DOCUMENT.md`** when the work is done: the applications entity, the new
  store and data file, the console's application selection, and the new repository-structure entries.

## Verification

- [ ] `pnpm build` completes with no TypeScript or compilation errors.
- [ ] `pnpm lint` passes with no errors (fix anything it reports).
- [ ] Manually, with `pnpm dev`:
  - [ ] Create a project and confirm a default application appears on its detail page with the same
        name and path, and that editing the application fields before submit is respected.
  - [ ] Add a second application with a different path, edit it, then delete it.
  - [ ] Try to delete the last remaining application and confirm the request is rejected with the
        409 message shown inline.
  - [ ] Open `/console`, pick that project, pick each application in turn, start a session, and
        confirm the agent starts in the chosen directory (`pwd`) and that the sidebar and header
        show the right project and application.
  - [ ] Pick one of the pre-existing applicationless projects and confirm the fallback entry, the
        hint, and that a session still starts in the project path.
  - [ ] Start a planning session from a workitem and a task-execution session from a task, and
        confirm both still run in the project directory.
  - [ ] Delete a project and confirm `data/applications.json` no longer holds its applications.
- [ ] No migration is written and `data/workitems.json`, `data/tasks.json`, and
      `data/lifecycle-log.json` are untouched by the change.
