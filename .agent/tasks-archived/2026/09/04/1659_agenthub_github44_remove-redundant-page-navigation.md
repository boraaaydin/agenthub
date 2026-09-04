# Remove redundant in-page navigation links duplicated by the main header menu

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

Every page renders `BrandBar` (`src/app/brand-bar.tsx`), which already contains the single main
navigation menu (`src/app/main-nav.tsx`) with **Projects, Workitems, Tasks, Logs, Console,
Settings**. Some pages additionally render a row of header buttons that link to those very same
destinations, so the same menu appears twice on one screen.

Remove those duplicate header links. The main navigation in the header stays as the only
site-wide navigation. Page-specific action buttons (for example **New project**) are not
navigation duplicates and must stay.

## Application

agenthub (repository root — this project has no `apps/` directory)

## GitHub Issue

- Issue #44

## Dependencies

None - This task is independent

## Context

### Clarified decisions (already agreed with the user — do not re-ask)

| Question | Decision |
| --- | --- |
| Scope | **All pages**, not only the two URLs named in the issue. The home page (`/`) carries the same duplicate block and is included. |
| Breadcrumb back-links | **Remove only on `/projects/{id}`**, because the issue names its `Projects` back-link explicitly. Back-links on other detail/form pages stay. |

### Pages that must change

| File | What to remove |
| --- | --- |
| `src/app/page.tsx` | Header button row: **Settings**, **Open console**, **Tasks**, **Plans**, **Projects** (5 links). |
| `src/app/projects/page.tsx` | Header buttons **Settings**, **Open console**, **Tasks**. Keep **New project**. |
| `src/app/projects/[id]/project-detail.tsx` | Header buttons **Tasks** and **Open console**, plus the **Projects** back-link above the `<h1>`. |
| `src/app/projects/[id]/page.tsx` | The **Projects** back-link in the error branch, so the error state matches the detail page. |

### Pages that must NOT change (verified already clean or intentionally kept)

- `src/app/tasks/page.tsx`, `src/app/workitems/page.tsx` — header holds only a page-specific
  **New task** / **New workitem** action.
- `src/app/console/agent-console.tsx` — header holds only the connection-status indicator.
- `src/app/settings/layout.tsx` + `src/app/settings/settings-nav.tsx` — the settings sidebar
  navigates within `/settings/*`; it does not duplicate the main nav.
- Back-links that stay, per the decision above:
  - `src/app/tasks/[taskId]/task-detail.tsx` — **Tasks**
  - `src/app/tasks/new/new-task-form.tsx` — **Tasks**
  - `src/app/projects/new/new-project-form.tsx` — **Projects**
- `src/app/brand-link.tsx` — the `AgentHub` wordmark links to `/`. The main nav has no `Home`
  entry, so this is the only route back to the home page. Leave it alone.

## Acceptance Criteria

- [ ] `/` shows the brand bar, the main nav, the `Home` title and its description — and no
      duplicate button row.
- [ ] `/projects` shows only the **New project** action next to the title; **Settings**,
      **Open console** and **Tasks** buttons are gone.
- [ ] `/projects/{id}` shows no **Tasks** button, no **Open console** button and no **Projects**
      back-link; the project name, description and the edit form are unchanged.
- [ ] The `/projects/{id}` error state (unreadable project data) also has no **Projects**
      back-link.
- [ ] The header main navigation still renders on every one of these pages and its
      `aria-current="page"` highlighting still works.
- [ ] Every page listed under "must NOT change" is byte-identical to before.
- [ ] No unused imports remain; `pnpm lint` is clean.
- [ ] `pnpm build` succeeds.

## Technical Notes

### Unused imports after the removal

Removing the links leaves `import Link from "next/link"` unused in three files — ESLint will
fail the build if they are left behind:

- `src/app/page.tsx` — all 5 `<Link>` uses are removed; drop the import.
- `src/app/projects/[id]/project-detail.tsx` — all 3 `<Link>` uses are in the header and are
  removed; drop the import.
- `src/app/projects/[id]/page.tsx` — its single `<Link>` is the removed back-link; drop the
  import.

`src/app/projects/page.tsx` keeps `Link` (used by `ProjectList` and by **New project**).

### Tidy the header layout after removing a column

Several of these headers are two-column flex rows built for a title block plus a button block.
Once the button block is gone the row wrapper is dead markup — remove the now-empty
`<div className="flex flex-wrap items-center gap-3">` container as well, and simplify the
surrounding classes so the header does not keep layout rules for a column that no longer exists:

- `src/app/page.tsx` — the `<header>` uses
  `flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end`.
  With one child left, reduce it to the single-column form used by `src/app/logs/page.tsx`
  (`border-b border-slate-200 pb-5`) and unwrap the leftover inner `<div>`.
- `src/app/projects/[id]/project-detail.tsx` — same treatment for
  `flex flex-col gap-4 … sm:flex-row sm:items-start sm:justify-between`.
- `src/app/projects/page.tsx` — the header keeps two columns (title + **New project**), so its
  flex classes stay as they are.

### Spacing after removing the back-link

On `/projects/{id}` the `<h1>` currently carries `mt-4` because a back-link sits above it.
With the back-link gone, the `<h1>` follows `BrandBar` directly — use `mt-3`, matching the
`<h1>` spacing on `/projects`, `/workitems` and `/logs`.

### Conventions to follow

- Read `node_modules/next/dist/docs/` before writing Next.js code; the installed Next.js is
  newer than most training data (see `AGENTS.md` and `.agent/PROJECT_DOCUMENT.md`).
- This is deletion-only work. Do not restyle the main nav, do not add a `Home` entry to it, and
  do not touch any route, store or API file.
- Keep the code readable and multi-line, per the **Code Readability** section of
  `.agent/PROJECT_DOCUMENT.md`.

### Pitfalls to avoid

- The home page has **two** links labelled differently but pointing at the same route
  (`Tasks` and `Plans`, both `href="/tasks"`). Both go.
- `src/app/projects/[id]/page.tsx` has two `BrandBar` render paths — the error branch and the
  successful branch, which delegates to `ProjectDetail`. Both need checking; only the error
  branch has a back-link of its own.
- Do not remove the `BrandBar` itself from any page; it carries the main navigation that is
  meant to be the survivor.

## Verification

- Run `pnpm build` and confirm the build succeeds with no compilation or type errors.
- Run `pnpm lint` and fix every reported error (especially unused-import errors from the
  removed `Link` usages).
- Start the app with `pnpm dev` and visually check `/`, `/projects`, and a project detail page
  at `/projects/{id}`: the header main nav is present exactly once and no duplicate menu row
  remains below it.
- Confirm `/tasks`, `/workitems`, `/console`, `/logs` and `/settings` render exactly as before.
