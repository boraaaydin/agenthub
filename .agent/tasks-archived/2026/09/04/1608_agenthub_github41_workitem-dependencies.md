# Workitem dependencies with searchable picker and task-creation blocking

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

A workitem can declare that it depends on other workitems of the **same project**. Dependencies are
chosen through a searchable, select2-style dropdown that matches on both the workitem title and its
numeric id, allows multiple selections, and is available both when creating a workitem and when
editing it on its detail page.

A workitem whose dependencies are not all finished is **blocked**: the **Create task** action must be
hidden/disabled for it, and the server must refuse to compose its planning prompt. A dependency
counts as finished when its status is `completed` or `cancelled`; every other status
(`open`, `task_creating`, `task_created`, `in_progress`) blocks.

## Application

agenthub (repository root — this project has no `apps/` directory)

## GitHub Issue

- Issue #41

## Dependencies

None - This task is independent

## Context

### Clarified decisions (already agreed with the user — do not re-ask)

| Question | Decision |
| --- | --- |
| Dependency scope | **Same project only.** The picker searches only workitems of the workitem's own project. |
| Where editable | **Both** the new-workitem form and the workitem detail page. |
| "Finished" statuses | **`completed` or `cancelled`.** A cancelled dependency no longer blocks. |
| Enforcement | **UI + server.** The action is hidden/disabled in the UI *and* the plan-prompt API rejects blocked workitems. |

### Relevant existing files

- `src/lib/workitems-store.ts` — server-only persisted workitem store (`data/workitems.json`).
  Holds `Workitem`, `StoredWorkitem`, `isWorkitem`, `normalizeWorkitem`, `workitemDetails`,
  `workitemPatch`, `createWorkitem`, `updateWorkitem`, `deleteWorkitem`, `getWorkitem`,
  `listProjectWorkitems`, `listAllWorkitems`, `deleteProjectWorkitems`. All writes go through
  `serializeWrite`.
- `src/lib/workitem-filters.ts` — client-safe status catalog: `WORKITEM_STATUSES`,
  `TERMINAL_WORKITEM_STATUSES` (`completed`, `cancelled`), `ACTIVE_WORKITEM_STATUSES`, labels,
  badge classes, and href builders.
- `src/app/api/projects/[id]/workitems/route.ts` — `GET` (paginated list, optional `status`)
  and `POST` (create).
- `src/app/api/projects/[id]/workitems/[workitemId]/route.ts` — `GET`, `PATCH`, `DELETE`.
- `src/app/api/projects/[id]/workitems/[workitemId]/plan-prompt/route.ts` — composes the planning
  prompt; this is the server-side gate for **Create task**.
- `src/lib/plan-prompt.ts` — `composePlanPrompt` and `planConsoleHref(projectId, workitemId)`.
- `src/app/workitems/new/new-workitem-form.tsx` — client creation form (project select, title,
  detail). Posts to `/api/projects/{id}/workitems`.
- `src/app/projects/[id]/workitems/[workitemId]/workitem-detail.tsx` — client detail/edit page.
  Owns the `canCreateTask` calculation and renders the **Create task** / **Execute task** links.
- `src/app/workitems/page.tsx` — server-rendered cross-project workitem table; computes
  `canCreateTask` per row and renders the same action links.
- `src/app/projects/[id]/workitems/page.tsx` — per-project workitem list (check whether it renders
  its own action links; keep it consistent if it does).
- `src/app/workitems/action-button-styles.ts` — `WORKITEM_ACTION_LINK_CLASS`, shared action styling.
- `src/lib/data-migration.ts` — idempotent one-time data migrations.

### Existing behaviour that must not regress

- `canCreateTask` today means: the workitem has **no registered tasks** *and* its status is neither
  `task_creating` nor `task_created`. Dependency blocking is an **additional** condition, not a
  replacement.
- Legacy workitems in `data/workitems.json` have no dependency field; they must keep loading and
  must behave as having no dependencies.
- Status changes broadcast over the agent WebSocket (`publishWorkitemChange`) so open `/workitems`
  lists refresh live. Completing a dependency should therefore unblock dependents on the next list
  refresh — no new socket message type is required, but verify the existing refresh path still works.

## Acceptance Criteria

### Data model

- [ ] `Workitem` carries `dependencyIds: number[]` (ids of workitems in the same project), stored in
      `data/workitems.json`.
- [ ] `StoredWorkitem` treats the field as optional and `normalizeWorkitem` defaults a missing or
      `undefined` value to `[]`, so existing files load unchanged with **no** entry added to
      `src/lib/data-migration.ts`.
- [ ] `isWorkitem` accepts a missing field, and rejects anything that is not an array of positive
      integers.
- [ ] `createWorkitem` and `updateWorkitem` accept, validate, and persist `dependencyIds`.
- [ ] Validation rules, each raising `WorkitemValidationError` with a clear message:
      - every id must be an existing workitem **in the same project**;
      - a workitem may not depend on itself;
      - duplicate ids are de-duplicated (or rejected — pick one and be consistent);
      - the dependency graph must stay acyclic: adding a dependency that (transitively) depends on
        the workitem being edited is rejected.
- [ ] `deleteWorkitem` removes the deleted id from every other workitem's `dependencyIds` in the same
      write, so no dangling references remain. `deleteProjectWorkitems` needs no extra handling
      (whole-project removal), but confirm it leaves no cross-references behind.

### Blocking rule

- [ ] A single shared, client-safe helper decides whether a workitem is blocked — for example
      `isDependencyFinished(status)` / `blockingDependencies(workitem, byId)` in
      `src/lib/workitem-filters.ts` (or a new `src/lib/workitem-dependencies.ts`). Both the server
      routes and the UI use this one helper; the rule must not be duplicated.
- [ ] Finished means `completed` or `cancelled` — derive this from the existing
      `TERMINAL_WORKITEM_STATUSES` constant rather than hardcoding the two strings again.
- [ ] A workitem with no dependencies is never blocked.

### Picker UI

- [ ] A reusable client component (e.g. `src/app/workitems/workitem-dependency-picker.tsx`) provides
      a select2-style multi-select:
      - typing filters candidate workitems by title **and** by id (typing `12` or `#12` matches
        workitem 12);
      - matches appear in a dropdown below the input showing `#id · title · status badge`;
      - selecting adds a removable chip; multiple dependencies are supported;
      - the current workitem, already-selected workitems, and workitems of other projects are
        excluded from the candidate list.
- [ ] Keyboard accessible: arrow keys move the active option, `Enter` selects, `Escape` closes,
      `Backspace` on an empty input removes the last chip. Use `role="combobox"` with
      `aria-expanded`, `aria-controls`, `aria-activedescendant`, and a `role="listbox"` popup.
      Each chip has an accessible remove button labelled with the workitem it removes.
- [ ] The picker is present on `new-workitem-form.tsx`. Changing the selected project **clears** the
      current dependency selection (dependencies are project-scoped).
- [ ] The picker is present on `workitem-detail.tsx` and is saved with the existing **Save changes**
      submit (same `PATCH` request as title/detail). **Cancel** restores the originally loaded
      dependency set together with the title and detail.
- [ ] Candidate lookup uses the server. Extend `GET /api/projects/[id]/workitems` with an optional
      `q` search parameter (matching title case-insensitively or the id) and a small result cap,
      or add a dedicated endpoint — either is acceptable, but it must not load the whole table into
      the browser. Debounce the request and handle the in-flight/no-results/error states visibly.

### Blocking in the UI

- [ ] On `/workitems` (`src/app/workitems/page.tsx`) a blocked workitem does **not** render the
      **Create task** link. It shows a clear indication that it is blocked — a badge or a short
      label naming the blocking workitem ids (e.g. "Blocked by #3, #7") — with the ids linking to
      those workitems.
- [ ] The same applies on the workitem detail page, where the blocking dependencies are listed with
      their titles and status badges, and the reason **Create task** is unavailable is stated in
      words.
- [ ] Dependencies are visible on the detail page even when nothing is blocked, so the user can see
      what a workitem depends on.
- [ ] Non-blocked behaviour is unchanged: **Create task** still appears exactly when it did before.
- [ ] The per-project workitem list stays consistent with `/workitems` if it renders action links.

### Blocking on the server

- [ ] `GET /api/projects/[id]/workitems/[workitemId]/plan-prompt` returns `409` with a
      human-readable error naming the unfinished dependencies (ids and titles) when the workitem is
      blocked, before composing any prompt.
- [ ] The console plan-run path surfaces that error to the user instead of silently starting a
      session or failing blank — check `src/app/console/use-plan-run.ts` and its error rendering.

### Project document

- [ ] `.agent/PROJECT_DOCUMENT.md` is updated to describe workitem dependencies: the new field, the
      same-project constraint, the finished-status rule, and that blocked workitems cannot start a
      planning session.

## Technical Notes

- **Read the Next.js docs first.** The installed Next.js (16.3.4) is newer than most training data.
  Before writing route or page code, read the relevant guide under `node_modules/next/dist/docs/`.
  Route handlers here use the typed `RouteContext<"...">` / `PageProps<"...">` helpers and
  `export const dynamic = "force-dynamic"` — follow that existing shape.
- **Do not add a dependency for the picker.** No select2, no react-select. Build it with React state
  and Tailwind, matching the existing visual language (`h-11`, `rounded-xl`, `border-slate-300`,
  `focus:ring-3 focus:ring-sky-100`, `bg-sky-700` for primary actions).
- `WORKITEM_ACTION_LINK_CLASS` in `src/app/workitems/action-button-styles.ts` is the shared style for
  workitem action links; reuse it and add a disabled/blocked variant there rather than inlining
  one-off classes in two files.
- All store writes must stay inside `serializeWrite` so concurrent requests cannot interleave a
  read-modify-write on `data/workitems.json`.
- Cycle detection: do a depth-first walk over `dependencyIds` starting from the proposed dependencies
  and fail if the edited workitem's own id is reached. Keep it readable — a small named helper with
  a visited set, not a compressed one-liner.
- Blocking is computed from **live** dependency statuses at render/request time; do not cache a
  `blocked` flag on the workitem record.
- The `/workitems` page already loads a page of workitems plus `listLatestTasksByWorkitem()`. To
  resolve blocking it needs the statuses of the referenced dependency ids; add a focused store
  helper (e.g. `getWorkitemsByIds(projectId, ids)`) rather than fetching every workitem.
- **Code readability rule** from `PROJECT_DOCUMENT.md`: no dense one-liners for multi-step logic.
  Also honour the 600-line-per-file guideline — `workitem-detail.tsx` is already ~310 lines, so put
  the picker and the blocked-dependency display in their own files.
- Error messages follow the existing tone: full sentences ending in a period, e.g.
  "Workitem #7 must be completed or cancelled before a task can be created."

## Verification

- [ ] `pnpm build` succeeds with no TypeScript errors.
- [ ] `pnpm lint` passes with no new errors or warnings.
- [ ] Manual check with `pnpm dev`:
      - create a workitem with two dependencies chosen by typing a title fragment and by typing an id;
      - confirm **Create task** is hidden and the blocked reason is shown on both `/workitems` and the
        detail page;
      - complete one dependency and cancel the other, then confirm **Create task** reappears;
      - request `/api/projects/{id}/workitems/{workitemId}/plan-prompt` directly for a blocked
        workitem and confirm a `409` with the naming error;
      - edit dependencies from the detail page and confirm they persist in `data/workitems.json`;
      - confirm an attempted self-dependency and an attempted cycle are both rejected with a readable
        message;
      - delete a workitem that others depend on and confirm the references are gone.
- [ ] An existing `data/workitems.json` without the new field still loads, and its workitems behave
      as unblocked.
