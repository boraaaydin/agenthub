# Fix and finish the task detail / update page at /projects/[id]/tasks/[taskId]

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

The route `/projects/[id]/tasks/[taskId]` already exists (added in commit `9264cec`) and renders
a working task detail + edit form. **But its two mutations are broken**: the client component
sends `PATCH` and `DELETE` to the *page* route instead of the API route, so saving and deleting a
task never reach a Route Handler.

In `src/app/projects/[id]/tasks/[taskId]/task-detail.tsx`:

```ts
const taskListPath = `/projects/${task.projectId}/tasks`;
...
await fetch(`${taskListPath}/${task.id}`, { method: "PATCH", ... }); // → /projects/{id}/tasks/{taskId}
await fetch(`${taskListPath}/${task.id}`, { method: "DELETE" });     // → /projects/{id}/tasks/{taskId}
```

Both must target `/api/projects/${task.projectId}/tasks/${task.id}`, where the real `PATCH` and
`DELETE` handlers live (`src/app/api/projects/[id]/tasks/[taskId]/route.ts`). The page path is
still the correct value for the "back to task list" `Link` and for the post-delete
`router.replace()` — so the single `taskListPath` constant is currently doing double duty for two
different things and must be split.

Scope decided with the user (do not re-litigate):

- **Fix and finish the existing files.** Do not rewrite the page or the client component from
  scratch, and do not restructure the UI.
- **No new metadata display.** `createdAt` / `updatedAt` are deliberately *not* added to the page
  in this task.
- After the code works, **post a comment on GitHub issue #9 in Turkish** (see
  "GitHub issue comment" below).

## Application

Root application (`agenthub`) — single Next.js app in `src/`. No `apps/` subdirectory exists.

## GitHub Issue

- Issue #9 — "task edit page": `/projects/[id]/tasks/[taskId]` task detay ve güncelleme sayfası yap
  (build the task detail and update page at that route).

## Dependencies

None - This task is independent.

## Context

### Files involved

| File | Role | Change needed |
| --- | --- | --- |
| `src/app/projects/[id]/tasks/[taskId]/task-detail.tsx` | Client component: edit form, save, delete-with-confirm | **Fix both fetch URLs**; separate the API path from the page path |
| `src/app/projects/[id]/tasks/[taskId]/page.tsx` | Server page: loads project + task, `notFound()` on miss, renders error state | Verify only — no change expected |
| `src/app/api/projects/[id]/tasks/[taskId]/route.ts` | `PATCH` + `DELETE` Route Handlers | No change — already correct |
| `src/lib/tasks-store.ts` | `getTask`, `updateTask`, `deleteTask` against `data/tasks.json` | No change |
| `src/app/projects/[id]/tasks/page.tsx` | Task list; each row links to `/projects/{id}/tasks/{task.id}` | No change |

### How the rest of the app calls its APIs

Every other client component in this repo uses the `/api/...` prefix — see
`src/app/projects/[id]/project-detail.tsx:51` (`fetch(\`/api/projects/${project.id}\`, …)`) and
`src/app/projects/[id]/tasks/new/page.tsx:30` (`fetch(\`/api/projects/${id}/tasks\`, …)`).
Follow that convention exactly; the broken calls in `task-detail.tsx` are the only outliers.

### Server-side behaviour that already works

- `updateTask(projectId, taskId, input)` validates the body, updates `title` + `detail`, bumps
  `updatedAt`, and returns `null` when the task does not belong to the project → the handler
  answers `404 {"error": "Task not found."}`.
- `TaskValidationError` → `400` with the validation message; store failures → `500`.
- `deleteTask` returns the removed task, or `null` → `404`.
- The page uses `export const dynamic = "force-dynamic"`, so `router.refresh()` after a save
  re-reads `data/tasks.json`.

### Client behaviour that already works and must keep working

- Title/detail state seeded from the server-rendered task; `key={task.id}` on `<TaskDetail>`
  remounts on navigation.
- Empty-title guard before submitting ("Enter a task title.").
- "Cancel" resets the form to the server values.
- Two-step delete: "Delete task" → "Confirm delete" / "Cancel".
- Error text from the API response body surfaces in the `role="alert"` box; success surfaces
  "Changes saved." in the `role="status"` line.
- Inputs and buttons disable while `isSubmitting`.

## Acceptance Criteria

- [ ] The save (`PATCH`) request from the task detail page goes to
      `/api/projects/{projectId}/tasks/{taskId}` and returns the updated task.
- [ ] The delete (`DELETE`) request goes to the same `/api/...` path and removes the task.
- [ ] `taskListPath` (or its replacement) still points at `/projects/{projectId}/tasks` for the
      header back-link and for the post-delete `router.replace()`.
- [ ] Editing a title and/or detail and pressing "Save changes" persists to `data/tasks.json`,
      shows "Changes saved.", and the new title is visible after a reload and in the task list.
- [ ] Deleting a task navigates back to the project's task list and the task is gone from it.
- [ ] A failed save/delete (e.g. an unknown `taskId`) shows the API's error message in the alert
      box rather than a silent failure or an unhandled exception.
- [ ] Submitting an empty title still shows "Enter a task title." and sends no request.
- [ ] Visiting `/projects/{unknownId}/tasks/{taskId}` or a `taskId` from another project renders
      the 404 page (`notFound()`), unchanged from today.
- [ ] `pnpm build` and `pnpm lint` both pass.
- [ ] A Turkish comment is posted on GitHub issue #9 (see below).

## Technical Notes

- Minimal shape for the fix: keep `taskListPath` for navigation and add a second constant, e.g.
  `const taskApiPath = \`/api/projects/${task.projectId}/tasks/${task.id}\`;`, used by both
  `fetch` calls. Do not derive one from the other by string surgery.
- Do **not** change the API route handlers, `src/lib/tasks-store.ts`, the task list page, or the
  new-task page. This is a client-side path fix plus verification.
- Do not add `createdAt` / `updatedAt` display, status fields, or any other new UI in this task —
  that was explicitly deferred.
- Keep the existing Tailwind classes and layout untouched; there is uncommitted work in these
  files adding `<BrandLink />` to the header and the error state — build on top of it, do not
  revert it.
- The repo runs a Next.js version newer than most training data. Before touching Next.js APIs,
  read the relevant guide under `node_modules/next/dist/docs/`. Note this page already uses the
  newer typed `PageProps<"/projects/[id]/tasks/[taskId]">` / `RouteContext<…>` helpers — keep
  them.
- `data/tasks.json` is git-ignored runtime data. Manual verification will write to it; that is
  expected and must not be committed.

## GitHub issue comment

After the code is verified, post a comment on issue #9 **in Turkish** (matching the language of
the original request) summarising what was found and done: the detail/update page already
existed, its kaydet/sil istekleri sayfa rotasına gidiyordu, `/api/...` rotasına yönlendirildi, ve
düzenleme + silme akışları doğrulandı. Use the `gh` CLI:

```bash
gh issue comment 9 --body "…"
```

## Verification

- `pnpm build` — must complete with no type or compilation errors.
- `pnpm lint` — must pass; fix any errors it reports.
- Manual run with `pnpm dev`:
  1. Create a project and at least one task if none exists.
  2. Open the task from the task list, change the title and detail, press "Save changes" — expect
     "Changes saved.", and the updated title in the header after a reload and in the task list.
  3. Press "Cancel" after editing — the fields revert to the saved values.
  4. Submit with an empty title — expect the inline validation message and no network request.
  5. Delete the task via "Delete task" → "Confirm delete" — expect a redirect to the task list
     with the task removed, and the entry gone from `data/tasks.json`.
  6. Confirm the browser network panel shows both requests hitting `/api/projects/...` and
     returning `200`.
- No new tests are required (the project has no test runner configured).
