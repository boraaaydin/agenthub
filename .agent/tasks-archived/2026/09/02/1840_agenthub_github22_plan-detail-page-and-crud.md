# Add a plan detail page with full CRUD over plan records

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

`github21_plans-api-and-list.md` gives AgentHub a plans store (`data/plans.json`), a global
`POST`/`GET /api/plans` endpoint and a read-only `/plans` list. That task deliberately stopped
short of a detail page: plans could only be created by a planning session and only read as list
rows.

This task adds the rest of the CRUD surface:

- **Read** — `/plans/{id}` shows one plan record and renders the Markdown plan file it points at,
  read from disk under the project's directory.
- **Create** — `/plans/new` lets the user register a plan by hand (project, task, title, file
  path, summary), so a plan file written outside a planning session can still be tracked.
- **Update** — the detail page edits every field, **including the project/task the plan is
  attached to**.
- **Delete** — the detail page deletes the record, with an opt-in checkbox that also removes the
  Markdown file from disk.

Decisions already made with the user (do not re-litigate them):

- **Full CRUD, including manual creation.** `/plans/new` exists and `/plans` gets a "New plan"
  action, alongside the automatic registration a planning session performs.
- **The file is shown, not edited.** The detail page reads `filePath` from disk and renders it
  read-only. The plan Markdown is never written back from the UI, and its content is never
  copied into `data/plans.json`.
- **Deleting a plan leaves the file alone by default.** Removing the Markdown file happens only
  when the user ticks a checkbox in the delete confirmation.
- **Every field is editable, relinking included.** `title`, `summary`, `filePath`, and also
  `projectId` + `taskId`, with the new project/task validated to exist before the change is
  stored.

## Application

Root application (this repository is a single Next.js app; there is no `apps/` directory).

## GitHub Issue

- Issue #22

The issue is written in Turkish: "plan detay sayfasını oluştur" / "plan için crud işlemleri
yapılabilecek" — create the plan detail page; CRUD operations should be possible for a plan.

Related but separate: issue #21, planned in `.agent/tasks/github21_plans-api-and-list.md`.

## Dependencies

**Prerequisites:**
- `github21_plans-api-and-list.md` — Required: it creates `src/lib/plans-store.ts`,
  `data/plans.json`, `src/app/api/plans/route.ts`, the `/plans` list, `src/lib/plan-filters.ts`
  and the shared header nav that this task extends. If `src/lib/plans-store.ts` does not exist
  when this task starts, run that task first; do not re-invent the store here.

**Dependent Tasks:** None

## Context

Everything below already exists (or is created by the prerequisite task) and should be copied
rather than reinvented:

- `src/lib/plans-store.ts` (from #21) — `Plan` = `{ id, projectId, taskId, title, filePath,
  summary, createdAt }`, persisted as `{ "plans": [...] }` in `data/plans.json`, with
  `readDocument` / `writeDocument` / `serializeWrite`, `PlanValidationError`, `PlanStoreError`,
  `createPlan`, `listAllPlans`, `PLANS_FILE_PATH`, `PLANS_PAGE_SIZE`.
- `src/lib/tasks-store.ts` (319 lines) — the shape every store follows, and the model for the
  new mutators: `getTask`, `updateTask` (patch object built by a `taskPatch(input: unknown)`
  validator, returns `null` when the record is missing, stamps `updatedAt`), `deleteTask`
  (splice + rewrite, returns the removed record or `null`), `listAllTasks({ page, pageSize,
  projectId, status })`.
- `src/lib/projects-store.ts` — `Project` = `{ id, name, path, createdAt }`; `getProject(id)`,
  `listProjects()`, `ProjectStoreError`. **`project.path` is the absolute directory a plan's
  `filePath` is relative to.**
- `src/app/api/projects/[id]/tasks/[taskId]/route.ts` — the PATCH/DELETE Route Handler to mirror:
  id parsing with `String(parsed) !== raw` rejection, `request.json()` wrapped for a 400,
  `null` → 404, `ValidationError` → 400, `StoreError` → 500 with a message naming the JSON file,
  `console.error` on the 500 path.
- `src/app/projects/[id]/tasks/[taskId]/page.tsx` (52 lines) — server component that resolves the
  record, `notFound()`s on a bad id, renders a red `role="alert"` panel on a store error, and
  hands a plain object to a `"use client"` detail component with `key={record.id}`.
- `src/app/projects/[id]/tasks/[taskId]/task-detail.tsx` — the detail UI to mirror: local state
  seeded from props, `PATCH` on submit, `statusMessage` / `error` panels, `router.refresh()`
  after a save, a "Delete …" section with a two-step confirm and `router.replace(listPath)`
  afterwards.
- `src/app/tasks/new/page.tsx` + `new-task-form.tsx` — the creation pair to mirror: the server
  page loads the project list and preselects a project from `searchParams`, the client form POSTs
  and redirects back to the list.
- `src/app/tasks/project-filter.tsx` — the `<select>` filter pattern.
- `src/lib/plan-filters.ts` (from #21) — client-safe `plansHref({ projectId, page })`. Any new
  href helper (`planDetailHref`, `newPlanHref`) belongs here, next to it; this module must never
  import the store.
- The shared header nav / `BrandBar` (from #21) — the new pages use it like every other page.

Next.js here is 16.3.4 — newer than most training data. Read the relevant guide under
`node_modules/next/dist/docs/` before touching routing, `searchParams`, or Route Handler
signatures, and keep the existing typed `PageProps<…>` / `RouteContext<…>` helpers.

## Acceptance Criteria

### Store additions (`src/lib/plans-store.ts`)

- [ ] `Plan` gains `updatedAt: string`. The stored shape treats it as optional and normalizes a
      record without it to its `createdAt`, so plan records written before this task keep
      loading (same `StoredTask` / `normalizeTask` trick as `tasks-store.ts`).
- [ ] `createPlan` stamps `updatedAt` alongside `createdAt`.
- [ ] `getPlan(planId: number): Promise<Plan | null>`.
- [ ] `updatePlan(planId: number, input: unknown): Promise<Plan | null>` — accepts a partial
      patch of `title`, `summary`, `filePath`, `projectId`, `taskId`; ignores unknown keys;
      throws `PlanValidationError` when no known field is present or a present field is invalid;
      returns `null` when the plan does not exist; stamps `updatedAt`; writes through
      `serializeWrite`.
- [ ] Patch validation matches creation: `title` and `filePath` non-empty strings (trimmed),
      `summary` a string (may be empty), `projectId` a non-empty string, `taskId` a positive
      integer accepted as a number or as a numeric string that round-trips.
- [ ] `deletePlan(planId: number): Promise<Plan | null>` — removes the record and returns it, or
      `null` when it does not exist.
- [ ] `deleteProjectPlans(projectId: string)` and `countProjectPlans(projectId: string)` are
      **not** added — project deletion is out of scope for this task.
- [ ] The store still never reads or writes the Markdown plan file; file access lives in the new
      plan-file module below.

### Plan file access (`src/lib/plan-file.ts`, new, server-only)

- [ ] `import "server-only";` at the top.
- [ ] `resolvePlanFilePath(projectPath: string, filePath: string): string | null` — joins and
      resolves the two, and returns `null` when the result escapes `projectPath` (`..`
      segments) or when `filePath` is absolute. Every read and delete goes through it; a `null`
      result is treated as "file unavailable", never as a path to touch.
- [ ] `readPlanFile(projectPath, filePath): Promise<{ status: "ok"; content: string } |
      { status: "not-found" } | { status: "too-large" } | { status: "invalid-path" } |
      { status: "error"; message: string }>` — `ENOENT`/`EISDIR` map to `not-found`, a file over
      a stated cap (use 512 KB) maps to `too-large` without reading it into memory, any other
      failure maps to `error` and is `console.error`-logged.
- [ ] `deletePlanFile(projectPath, filePath): Promise<{ status: "deleted" | "not-found" |
      "invalid-path" | "error"; message?: string }>` — `ENOENT` counts as `not-found`, not a
      failure. It only ever unlinks a single file, never a directory, and never recurses.

### Detail API (`src/app/api/plans/[planId]/route.ts`, new)

- [ ] `export const dynamic = "force-dynamic"`.
- [ ] A `planId` that is not a positive integer (or does not round-trip through
      `String(parsed) !== raw`) returns **404** `{ error: "Plan not found." }` for every method.
- [ ] `GET` returns the stored plan, or 404.
- [ ] `PATCH` accepts any subset of `{ title, summary, filePath, projectId, taskId }`:
      - non-JSON body → **400** `{ error: "Request body must be valid JSON." }`;
      - `PlanValidationError` → **400** with its message;
      - unknown plan → **404** `{ error: "Plan not found." }`;
      - when `projectId` and/or `taskId` are present, the **effective** pair after the patch is
        checked against the stores: unknown project → **404** `{ error: "Project not found." }`,
        unknown task in that project → **404** `{ error: "Task not found." }`. Checking happens
        *before* the record is written, so a rejected relink leaves the plan untouched;
      - success → **200** with the updated plan.
- [ ] `DELETE` removes the record and returns **200** with the deleted plan plus a
      `fileDeleted: boolean` field.
      - The Markdown file is removed only when the request asks for it — `?file=delete` on the
        URL (the client sends it explicitly; the default deletes the record alone).
      - When file deletion is requested, the project is resolved first for its `path`; a
        `not-found` file, a missing project, or an unresolvable path is **not** an error: the
        record is still deleted and `fileDeleted` is `false`.
      - A real unlink failure returns 200 with `fileDeleted: false` and a `fileError` message,
        and is `console.error`-logged. The record deletion is never rolled back.
- [ ] Store failures return **500** with a message naming the offending JSON file, matching the
      wording used by the task routes, and are logged.

### Detail page (`/plans/[planId]`)

- [ ] `src/app/plans/[planId]/page.tsx` is a server component with `export const dynamic =
      "force-dynamic"`. A malformed id `notFound()`s; a missing plan `notFound()`s; a store read
      failure renders the red `role="alert"` panel used by the task detail page.
- [ ] The page resolves, server-side: the plan, its project (may be missing), its task (may be
      missing), the project list and each project's tasks for the relink selects, and the plan
      file read result. It passes plain objects to a `"use client"` `PlanDetail` component with
      `key={plan.id}`.
- [ ] Task options for the relink select come from `listAllTasks` with an explicit large
      `pageSize` (e.g. 500) grouped by project id — do **not** add a new API route for this and
      do **not** fetch page by page from the client.
- [ ] The header shows the shared brand bar/nav, a back link to `/plans`, a `Plan #{id}` chip,
      the plan title as `<h1>`, the project name (or "Unknown project"), a `Task #{taskId}` link
      to `/projects/{projectId}/tasks/{taskId}` (rendered as plain text when the task or project
      is gone), and the created/updated dates.
- [ ] An edit form covers `title` (input), `summary` (textarea), `filePath` (input, monospace),
      `projectId` (select of saved projects) and `taskId` (select of that project's tasks,
      re-filtered when the project changes and cleared when the current task does not belong to
      the newly chosen project). Saving PATCHes the detail endpoint, shows "Changes saved.",
      updates local state from the response and calls `router.refresh()`.
- [ ] Client-side guards before submitting: a title is required, a file path is required, a
      project and a task must be selected. Server messages are shown verbatim in the red panel.
- [ ] A "Cancel" button restores the values the page was loaded with, exactly like the task
      detail form.
- [ ] The plan file is rendered read-only below the form, inside a bordered section, in a
      monospace `whitespace-pre-wrap break-words` block that scrolls rather than stretching the
      page. It is **not** parsed as Markdown — no new dependency is added for rendering.
- [ ] Each non-`ok` read status has its own message: file not found (naming the resolved
      repository-relative path), file too large to preview, path outside the project directory,
      project record missing so the file cannot be located, and a generic read failure. None of
      them break the rest of the page.
- [ ] A "Delete plan" section uses the two-step confirm pattern, and its confirmation step
      carries a checkbox labelled so it is unmistakable — e.g. "Also delete the plan file from
      disk (`{filePath}`)" — unchecked by default. Confirming calls `DELETE`, appending
      `?file=delete` only when the box is ticked, then `router.replace("/plans")`.
- [ ] When the response reports `fileDeleted: false` together with a `fileError`, the user is
      told the record was deleted but the file was not — the redirect still happens.
- [ ] `PlanDetail` stays under the project's 600-line rule; split the file preview and/or the
      delete section into sibling components under `src/app/plans/[planId]/` if it grows.

### Manual creation (`/plans/new`)

- [ ] `src/app/plans/new/page.tsx` is a server component (`force-dynamic`) that loads projects
      and their tasks the same way the detail page does, preselects a project from
      `?project=`, and renders a `"use client"` `NewPlanForm`.
- [ ] The form has project select, task select (filtered by the chosen project), title, file
      path and summary, and POSTs to the existing `/api/plans` with `{ projectId, taskId, title,
      filePath, summary }`.
- [ ] On success it navigates to the new plan's detail page (`/plans/{id}`) using the created
      record returned by the endpoint; on failure it shows the server's message.
- [ ] Empty-state guard: with no saved projects, the form explains that a project is needed and
      links to `/projects/new` instead of rendering an unusable select.
- [ ] `/plans` gains a "New plan" primary action in its header (same styling as the "New task"
      action on `/tasks`), preserving the active project filter in the link.

### List page wiring (`/plans`)

- [ ] Each row's title links to `/plans/{id}`; the `Task #{taskId}` link to the task detail page
      stays as a separate link, so both destinations remain reachable.
- [ ] The empty state mentions that a plan can also be registered by hand, linking to
      `/plans/new`.

### Documentation

- [ ] `.agent/PROJECT_DOCUMENT.md` is updated:
      - the Architecture persistence paragraph notes that plan records are fully editable, carry
        `updatedAt`, and that the plan's Markdown file is read from
        `{project.path}/{plan.filePath}` for display only and removed only on explicit request;
      - Repository Structure gains `src/app/api/plans/[planId]/`, `src/app/plans/[planId]/`,
        `src/app/plans/new/` and `src/lib/plan-file.ts`;
      - "Delivered session capabilities" records the plan detail page, manual plan registration,
        and plan deletion with the optional file removal.

## Technical Notes

- Extend `plans-store.ts` in place; do not create a second module for plan mutations. Keep the
  `serializeWrite` queue as the only writer of `data/plans.json`.
- Validation for the PATCH body belongs in the store (a `planPatch(input: unknown)` function
  mirroring `taskPatch`), not in the Route Handler. The Route Handler only maps error types to
  status codes and performs the project/task existence checks the store cannot do without
  importing other stores.
- Resolve the effective relink target as `{ projectId: patch.projectId ?? plan.projectId,
  taskId: patch.taskId ?? plan.taskId }` and validate that pair — patching only `projectId` must
  not leave the plan pointing at a task id that does not exist in the new project.
- Path safety is the sharpest edge in this task: `filePath` is user-editable text and the DELETE
  path unlinks a real file. Resolve with `path.resolve(projectPath, filePath)` and require the
  result to be inside `path.resolve(projectPath)` (compare against `projectPath + path.sep`, and
  reject when `path.isAbsolute(filePath)`). Never `rm -rf`, never delete directories, never
  follow the path when the guard returns `null`.
- Read the file with `fs.stat` first so the size cap can reject a huge file before it is loaded.
- The detail page renders the file content as plain text. Do not introduce a Markdown renderer,
  a syntax highlighter, or `dangerouslySetInnerHTML`.
- Keep `src/lib/plan-file.ts` server-only and the href helpers in `src/lib/plan-filters.ts`
  client-safe, exactly as `tasks-store.ts` and `task-filters.ts` are split today.
- Follow the existing visual language: `h-11 rounded-xl` controls, `border-slate-300`,
  `focus:ring-3 focus:ring-sky-100`, sky-700 primaries, red-700 destructive buttons,
  `rounded-md bg-slate-100 px-2 py-0.5 text-xs` chips, `rounded-xl border border-slate-200
  bg-white shadow-sm` sections.
- Server components on these routes are `export const dynamic = "force-dynamic"` — keep that.
- Do not touch the settings store, the prompt pages, `src/lib/default-prompts/`, or the composed
  planning prompt. The registration step added by the prerequisite task keeps working unchanged
  because `POST /api/plans` is not modified here.

## Verification

- `pnpm build` completes with no compilation or type errors.
- `pnpm lint` passes with no new errors or warnings.
- Manual checks with `pnpm dev` at `http://localhost:3000`:
  - `/plans/new` creates a plan for a chosen project and task and lands on its detail page;
  - the detail page renders the Markdown file from `{project.path}/{filePath}`, and shows the
    "file not found" message when `filePath` is edited to something that does not exist;
  - editing title, summary and file path saves and survives a reload;
  - relinking the plan to a different project re-filters the task select, saves, and the header
    task link points at the new task; relinking to a task id that is not in the chosen project
    returns a 404 message and leaves the record unchanged;
  - `PATCH /api/plans/{id}` with `{}` returns 400, with an unknown id returns 404;
  - deleting without the checkbox removes the row from `/plans` and leaves the Markdown file on
    disk; deleting with the checkbox removes both;
  - a `filePath` such as `../../etc/hosts` is refused by the preview and never deleted;
  - the `/plans` list rows link to the detail page and the Plans nav entry still highlights.
