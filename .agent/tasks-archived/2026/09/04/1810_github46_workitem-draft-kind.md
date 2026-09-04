# Save workitems as drafts and ask to create a task when a draft is promoted

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

A workitem can be saved as a **draft** — a rough note that is deliberately not ready to be
planned. A draft is stored as an ordinary workitem record carrying a new `kind` field; its
`status` keeps its existing meaning and is untouched by this feature.

The new workitem form gets a second submit button so the user chooses at save time whether the
record is a draft or a real workitem. Drafts appear in the workitem list with a **Draft** badge
and can be reached through a dedicated filter, but they stay out of every planning flow: no
**Create task**, no **Execute task**, no **Complete**, and they cannot be picked as a dependency
of another workitem.

A draft is promoted with a **Convert to workitem** action. Right after a successful promotion an
accessible modal asks whether a task should be created now; confirming opens the planning console
for that workitem, dismissing leaves the workitem as a plain open workitem.

## Application

agenthub (repository root — this project has no `apps/` directory)

## GitHub Issue

- Issue #46

## Dependencies

None - This task is independent

## Context

### Clarified decisions (already agreed with the user — do not re-ask, do not re-litigate)

| Question from the issue | Decision |
| --- | --- |
| `isDraft` boolean or a separate enum? | **A separate enum field** `kind: "draft" \| "workitem"` on `Workitem`. Chosen over a boolean so future kinds (template, idea, …) fit without a second flag. |
| Is draft part of `status`? | **No.** `status` keeps its six existing values; `kind` is orthogonal to it. |
| How does the user pick draft at creation time? | **Two buttons** on `/workitems/new`: `Save as draft` and `Create workitem`. No checkbox, no "everything starts as a draft". |
| Are drafts visible in the list? | **Yes**, with a `Draft` badge, and the status filter gains a `Draft` option. They are excluded from actions and from the dependency picker. |
| How is "run the plan?" asked after promotion? | **A modal dialog**, modelled on `src/app/console/session-completion-modal.tsx`. |

### Existing code that matters

| File | Why it matters |
| --- | --- |
| `src/lib/workitem-filters.ts` | Client-safe status catalog, labels, badge classes, filter parsing, and the `workitemsHref` / `newWorkitemHref` URL builders. The `kind` catalog belongs here too. |
| `src/lib/workitems-store.ts` | Server-only JSON store. `StoredWorkitem` + `normalizeWorkitem` already lazily migrate older records (legacy `plan_creating` statuses, missing `completedAt`, missing `dependencyIds`) — `kind` follows the same pattern. |
| `src/lib/data-migration.ts` | One-time file migration. **Do not touch it**: lazy normalization in `normalizeWorkitem` is how this store handles new optional fields. |
| `src/app/workitems/page.tsx` | Cross-project workitem table, its filters, action column, and empty states. |
| `src/app/workitems/new/new-workitem-form.tsx` | The creation form (client component) that POSTs to `/api/projects/{id}/workitems`. |
| `src/app/projects/[id]/workitems/[workitemId]/page.tsx` + `workitem-detail.tsx` | Server page and client detail form for a single workitem. |
| `src/app/workitems/workitem-dependency-picker.tsx` | Searches `/api/projects/{id}/workitems?q=…&excludeStatus=…` for dependency candidates. |
| `src/app/api/projects/[id]/workitems/[workitemId]/plan-prompt/route.ts` | Server-side gate for planning; already returns 409 for blocked dependencies and for projects without applications. |
| `src/app/workitems/action-button-styles.ts` | The shared `WORKITEM_ACTION_*` class constants used by every action-row control. |
| `src/app/console/session-completion-modal.tsx` | The accessible modal pattern to copy (role/aria, Escape, focus, backdrop click). |

## Acceptance Criteria

### Data model

- [ ] `Workitem` carries `kind: WorkitemKind` where `WorkitemKind = "workitem" | "draft"`.
- [ ] Existing records in `data/workitems.json` without a `kind` field load as `"workitem"`; no
      file migration and no change to `src/lib/data-migration.ts` is required.
- [ ] `POST /api/projects/{id}/workitems` accepts an optional `kind` in the body, validates it,
      and defaults to `"workitem"` when absent.
- [ ] `PATCH /api/projects/{id}/workitems/{workitemId}` accepts `kind` and persists it.
- [ ] Setting `kind: "draft"` on a workitem whose status is not `open` is rejected with a
      `WorkitemValidationError`.
- [ ] A draft cannot be selected as another workitem's dependency: `validateDependencies` rejects
      a dependency id whose record is a draft, and `searchProjectWorkitems` never returns drafts.

### Creating

- [ ] `/workitems/new` shows both `Save as draft` and `Create workitem`; both require a project
      and a non-empty title, and both post the same title, detail, and dependency ids.
- [ ] `Create workitem` posts `kind: "workitem"`; `Save as draft` posts `kind: "draft"`.
- [ ] Both buttons are disabled while a submission is in flight, and the in-flight label makes it
      clear which one was pressed.

### Listing

- [ ] A draft row on `/workitems` shows a `Draft` badge alongside its status badge.
- [ ] A draft row's actions are only `Convert to workitem` (plus the existing delete/blocked
      affordances that already self-hide). No `Complete`, no `Create task`, no `Execute task`.
- [ ] The status filter has a `Draft` option; picking it lists only drafts, at `?kind=draft`.
- [ ] `Active` and `All` keep listing drafts inline with their badge.
- [ ] The empty state for the draft filter reads sensibly (for example "No drafts").
- [ ] The `New workitem` link keeps the current filter, including `?kind=draft`.

### Detail page

- [ ] `/projects/{id}/workitems/{workitemId}` shows the `Draft` badge in the header for a draft.
- [ ] For a draft, the status `<select>`, `Create task`, and `Execute task` are not rendered; a
      `Convert to workitem` action is rendered instead.
- [ ] Title, detail, dependency editing, and deletion keep working for a draft.

### Promotion + the modal

- [ ] `Convert to workitem` sends `PATCH { kind: "workitem" }` and, on success, opens a modal
      asking whether a task should be created now.
- [ ] The modal's confirm action navigates to `planConsoleHref(projectId, workitemId)`; its
      dismiss action closes the modal and refreshes the page.
- [ ] When the promoted workitem cannot be planned (the project has no applications, or a
      dependency still blocks it), the modal explains why and offers only a close action.
- [ ] The modal is accessible: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus
      moves into it on open, `Escape` closes it, and a backdrop click closes it.
- [ ] The same button and modal work identically from the list and from the detail page.

### Planning gate

- [ ] `GET /api/projects/{id}/workitems/{workitemId}/plan-prompt` returns `409` with a clear
      message for a draft, so hitting `/console?planWorkitemId=…` by hand cannot plan a draft.

### Housekeeping

- [ ] `.agent/PROJECT_DOCUMENT.md` describes the `kind` field, the draft rules, and the
      promotion modal in its workitem paragraph.
- [ ] `pnpm build` succeeds and `pnpm lint` is clean.

## Technical Notes

### 1. `src/lib/workitem-filters.ts` — the client-safe `kind` catalog

Add next to the existing status catalog:

```ts
export const WORKITEM_KINDS = ["workitem", "draft"] as const;
export type WorkitemKind = (typeof WORKITEM_KINDS)[number];
export const DEFAULT_WORKITEM_KIND: WorkitemKind = "workitem";

export function isWorkitemKind(value: unknown): value is WorkitemKind { … }
export function workitemKindLabel(kind: WorkitemKind): string { … }   // "Draft" / "Workitem"
```

Give the draft badge a look that reads as "not a real workitem yet" and does not collide with an
existing status badge colour — a dashed outline chip works well:

```
border border-dashed border-slate-300 bg-white text-slate-600
```

The filter is a single dropdown, so `Draft` joins the existing filter union rather than becoming a
second `<select>`:

```ts
export type WorkitemFilterStatus = WorkitemStatus | "all" | "active" | "draft";
```

`"draft"` is a **kind** filter, not a status, so it travels in its own query parameter:

- `workitemsHref` / `newWorkitemHref`: when `status === "draft"`, set `kind=draft` and set neither
  `status` nor `all`.
- `workitemFilterStatus(value, showAll, kind)`: gains a third argument; return `"draft"` when
  `kind === "draft"` — check it before `showAll`, so `?kind=draft` wins over a stray `?all=true`.

Leave the `WorkitemDependency` type alone: drafts can never become dependencies, so it never needs
to carry a kind.

### 2. `src/lib/workitems-store.ts`

- `Workitem` gains `kind: WorkitemKind`; `StoredWorkitem` makes it optional (`kind?: WorkitemKind`)
  exactly like `status` / `completedAt` / `dependencyIds`.
- `isWorkitem` accepts `workitem.kind === undefined || isWorkitemKind(workitem.kind)`.
- `normalizeWorkitem` fills `kind: workitem.kind ?? DEFAULT_WORKITEM_KIND`.
- `createWorkitem`: read an optional `kind` from the input the same way `dependencyIds` is read
  (`Object.hasOwn(input, "kind")`), validate with `isWorkitemKind`, throw
  `new WorkitemValidationError("Select a valid workitem kind.")` on a bad value, default to
  `"workitem"`, and store it on the new record. Keep appending the existing lifecycle event with
  `toStatus: "open"` — a draft's status really is `open`, and this feature introduces **no** new
  lifecycle entity or event type.
- `workitemPatch`: accept `kind` with the same validation. In `updateWorkitem`, before assigning,
  reject a demotion of a started workitem:

  ```ts
  if (patch.kind === "draft" && (patch.status ?? workitem.status ?? DEFAULT_WORKITEM_STATUS) !== "open") {
    throw new WorkitemValidationError("Only an open workitem can be turned back into a draft.");
  }
  ```

  `updateWorkitem` already calls `publishWorkitemChange` on every successful write, so a kind
  change reaches `WorkitemLiveUpdates` with no change to `src/lib/workitem-events.ts`.
- `validateDependencies`: a draft must not become a dependency. The function already has the
  project's `StoredWorkitem` records in `workitemsById`, so check the resolved record's kind and
  throw `new WorkitemValidationError("Workitem dependency #N is a draft; convert it to a workitem first.")`.
  Note the records there are `StoredWorkitem`, so compare against `dependency.kind ?? DEFAULT_WORKITEM_KIND`
  rather than assuming the field exists.
- `searchProjectWorkitems`: add a `.filter((workitem) => workitem.kind !== "draft")` after the
  `normalizeWorkitem` map. This function backs only the dependency picker, so excluding drafts
  there is the whole fix for dependency selection.
- `paginateWorkitems` and its two callers (`listProjectWorkitems`, `listAllWorkitems`) gain an
  optional `kind?: WorkitemKind` filter alongside the existing `projectId` / `statuses` filters.
  Only the `Draft` filter passes it; `Active`, `All`, and single-status filters pass nothing so
  drafts stay visible inline.

### 3. API routes

`POST` and `PATCH` on `/api/projects/[id]/workitems…` forward the parsed body straight to the
store, so they need no change once the store validates `kind`. The one route that needs a new
guard is `plan-prompt/route.ts` — put it next to the existing 409 checks, after the workitem is
loaded:

```ts
if (workitem.kind === "draft") {
  return Response.json(
    { error: "This workitem is a draft. Convert it to a workitem before creating a task." },
    { status: 409 },
  );
}
```

### 4. `src/app/workitems/new/new-workitem-form.tsx`

Refactor `createWorkitem(event)` into a `submitWorkitem(kind: WorkitemKind)` that the form's
`onSubmit` calls with `"workitem"`, and give the draft button `type="button"` with
`onClick={() => void submitWorkitem("draft")}`. Track which button is in flight so the labels are
honest — a single `isSubmitting` boolean plus a `submittingKind` state is enough:

```
[ Create workitem ]  [ Save as draft ]  Cancel
```

Use `WORKITEM_ACTION_*`-free styling here: this form already has its own full-height button
classes (primary sky button + bordered secondary). Give `Save as draft` the same bordered
secondary look the existing `Cancel` link uses, so the primary action stays visually dominant.

### 5. New component — `src/app/workitems/promote-workitem-button.tsx`

A `"use client"` component used by **both** the list row and the detail page:

```ts
type PromoteWorkitemButtonProps = {
  projectId: string;
  workitemId: number;
  canCreateTask: boolean;      // no blocking dependencies
  hasApplications: boolean;    // project has at least one application
  onPromoted?: () => void;     // detail page updates its local state
};
```

- Renders a `Convert to workitem` button using `WORKITEM_ACTION_NEUTRAL_CLASS`.
- `PATCH /api/projects/{projectId}/workitems/{workitemId}` with `{ kind: "workitem" }`.
- On failure, render the error the same way the other action buttons do
  (`<p role="alert" className="mt-2 text-xs text-red-700">`).
- On success, call `onPromoted?.()` and open the modal.
- Modal dismiss → `router.refresh()` so the row re-renders as a plain workitem.
- Modal confirm → `router.push(planConsoleHref(projectId, workitemId))`.
- When `!canCreateTask || !hasApplications`, the modal shows the reason instead of the confirm
  action and offers only `Close`.

### 6. New component — `src/app/workitems/create-task-prompt-modal.tsx`

Copy the structure of `src/app/console/session-completion-modal.tsx`: fixed backdrop with
`onMouseDown` target check, a focused `div` with `role="dialog" aria-modal="true"` and
`aria-labelledby={useId()}`, and an `Escape` key listener registered in a `useEffect` that is
cleaned up on unmount. Keep it a separate file rather than reusing the console modal — that one is
typed around `SessionOutcomeNotice` and `exitCode` and does not fit here.

### 7. `src/app/workitems/page.tsx`

- Read `searchParams.kind` the same way `status` / `all` are read and pass it to
  `workitemFilterStatus`.
- Pass `kind: selectedStatus === "draft" ? "draft" : undefined` to `listAllWorkitems`, and keep
  `statuses: undefined` for that filter (a draft filter is not a status filter).
- In `WorkitemRows`, compute `const isDraft = workitem.kind === "draft";` and:
  - render the `Draft` badge before the status badge;
  - fold `!isDraft` into `canCreateTask`;
  - render `WorkitemStatusButton`, `Execute task`, `Create task`, and the blocked-dependency hint
    only when `!isDraft`;
  - render `PromoteWorkitemButton` when `isDraft`.
- Extend the `emptyWorkitemLabel` chain with the draft case; `WORKITEM_STATUS_LABELS[selectedStatus]`
  would be `undefined` for `"draft"`, so handle it explicitly before that lookup.

### 8. `src/app/projects/[id]/workitems/[workitemId]/workitem-detail.tsx`

- Add `kind` to the local `Workitem` type in this file (it mirrors the store type by hand).
- Hold the kind in state (`const [workitemKind, setWorkitemKind] = useState(workitem.kind)`) so the
  header updates in place after a promotion, and pass
  `onPromoted={() => setWorkitemKind("workitem")}` to the button.
- For a draft: render the `Draft` badge next to the status badge, and skip the status `<select>`,
  `Create task`, and `Execute task`; render `PromoteWorkitemButton` in that action row instead.
- `DeleteWorkitemTasksButton` already renders nothing at `taskCount === 0`, which is always the case
  for a draft — leave it as it is.
- The server page (`page.tsx`) already forwards the whole workitem plus `hasApplications` and
  `blockingDependencies`, so it needs no new props.

### Conventions to follow

- Read the relevant guide under `node_modules/next/dist/docs/` before writing Next.js code; the
  installed Next.js is newer than most training data (see `AGENTS.md`).
- Keep code multi-line and readable per the **Code Readability** section of
  `.agent/PROJECT_DOCUMENT.md`; do not compress the new handlers onto single lines.
- Match the existing file conventions: `"use client"` only where interaction requires it, store
  errors surfaced through the existing `Workitem*Error` classes, and action buttons built from the
  `WORKITEM_ACTION_*` constants.
- All user-facing strings in the UI stay in English, like the rest of the app.

### Pitfalls to avoid

- **Do not add `draft` to `WORKITEM_STATUSES`.** The user explicitly rejected modelling this as a
  status; the status filter option is a presentation detail carried by `?kind=draft`.
- `WORKITEM_STATUS_LABELS` and `workitemStatusBadgeClass` are `Record<WorkitemStatus, …>` lookups.
  Anywhere `WorkitemFilterStatus` can now be `"draft"`, guard the lookup or you will index them
  with a key they do not have.
- `getWorkitemsByIds` and `blockingDependencies` feed the "Blocked by" hints. Since a draft can no
  longer be a dependency, no blocking logic changes — resist the temptation to teach
  `isDependencyFinished` about kinds.
- The status-filter `<select>` renders `WORKITEM_STATUSES.map(...)`; add the `Draft` option
  explicitly next to `Active` / `All` rather than folding it into that map.
- Older records genuinely have no `kind` key. Read it through `normalizeWorkitem` everywhere;
  never compare `workitem.kind === "workitem"` against a raw `StoredWorkitem`.
- `updateWorkitem` writes `completedAt` only when the **status** changed. A kind-only patch must
  not clear `completedAt` — the existing `statusChanged` guard already ensures this, so do not
  restructure it.
- A promotion happens through the same `PATCH` endpoint as an edit. Send only `{ kind: "workitem" }`
  so the request cannot overwrite a title or detail the user is editing in another tab.

## Verification

- Run `pnpm build` and confirm it succeeds with no compilation or type errors.
- Run `pnpm lint` and fix every reported error.
- Start the app with `pnpm dev` and walk the flow:
  1. `/workitems/new` → `Save as draft` creates a workitem that appears in the list with a `Draft`
     badge and only a `Convert to workitem` action.
  2. The status filter's `Draft` option lists only drafts and the URL shows `?kind=draft`.
  3. The draft is not offered as a dependency candidate in the dependency picker of another
     workitem in the same project.
  4. `Convert to workitem` opens the modal; `Escape`, the backdrop, and the dismiss action all
     close it, and the row becomes a normal open workitem with `Complete` and `Create task` back.
  5. The modal's confirm action lands on the planning console for that workitem.
  6. Repeat 4–5 from the workitem detail page.
  7. `curl` the plan-prompt endpoint for a draft and confirm it answers `409`.
- Confirm existing workitems in `data/workitems.json` (no `kind` key) still render and behave
  exactly as before.
