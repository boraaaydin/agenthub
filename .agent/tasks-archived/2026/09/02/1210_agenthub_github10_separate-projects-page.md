# Move the project list to a dedicated /projects page and empty the home page

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

Today `/` (`src/app/page.tsx`) **is** the projects page: it loads projects from the store and
renders the list, the empty state and the "New project" button. There is no `/projects` route
at all — only `/projects/new` and `/projects/[id]`.

After this task:

- **`/` is empty.** It keeps its header (AgentHub wordmark, subtitle, top-right button row)
  and nothing else. No project data is read on this route.
- **`/projects` is the new projects page.** It carries the project list, the empty state, the
  load-error alert and the "New project" button.
- **Every page header carries a "Projects" link/button** pointing at `/projects`.
- **Every existing `href="/"` back-link labelled "Projects", every "Cancel" link and both
  post-mutation redirects point at `/projects` instead of `/`.**

Decisions already made with the user (do not re-litigate them):

- The home page shows **header only** — no placeholder card, no "nothing here yet" message,
  no project data. The body below the header is empty.
- The **"Projects" button appears in every page header**, not just on the home page.
- **All** existing "Projects" back-links, the New-project "Cancel" link, and the
  create/delete redirects are repointed to `/projects`.
- The home header **keeps** its Settings and "Open console" buttons; the Projects button joins
  them. "New project" **leaves** the home header and lives on `/projects`.

## Application

Root application (`agenthub`) — single Next.js app in `src/`. No `apps/` subdirectory exists.

## GitHub Issue

- Issue #10 — "projeler için ayrı sayfa oluştur" (create a separate page for projects: don't
  list projects on the home page, leave the home page empty for now, put a Projects button in
  the top right, and move the "new project" button onto the projects page)

## Dependencies

None - This task is independent.

## Context

### Current state of every affected surface

| File | Current state | Required change |
| --- | --- | --- |
| `src/app/page.tsx` | Server component. `export const dynamic = "force-dynamic"`, calls `listProjects()`, holds the local `ProjectList` component, the load-error alert, and a header with Settings / Open console / **New project** | Becomes header-only. Drop `listProjects`, `ProjectList`, the error branch and `dynamic`. Replace the "New project" button with a "Projects" button (`/projects`) |
| `src/app/projects/page.tsx` | **Does not exist** | New server component that owns everything removed from `page.tsx`: `dynamic = "force-dynamic"`, `listProjects()`, `ProjectList`, the error alert, plus a header with an `<h1>Projects</h1>` and the "New project" button |
| `src/app/settings/page.tsx` (line ~32) | `<Link href="/">Projects</Link>` | `href="/projects"` |
| `src/app/projects/new/page.tsx` (lines ~56 and ~114) | Header back-link `href="/"` labelled "Projects"; form "Cancel" link `href="/"` | Both become `href="/projects"` |
| `src/app/projects/new/page.tsx` (line ~43) | `router.replace("/")` after a successful create | `router.replace("/projects")` |
| `src/app/projects/[id]/project-detail.tsx` (line ~100) | Header back-link `href="/"` labelled "Projects" | `href="/projects"` |
| `src/app/projects/[id]/project-detail.tsx` (line ~86) | `router.replace("/")` after a successful delete | `router.replace("/projects")` |
| `src/app/projects/[id]/page.tsx` (line ~25) | Error-branch back-link `href="/"` labelled "Projects" | `href="/projects"` |
| `src/app/console/agent-console.tsx` (line ~233) | Header `<Link href="/">Projects</Link>` | `href="/projects"` |

### "Projects button in every header"

The user asked for the Projects button to appear in every page header. Four of the five page
surfaces **already** have a header link labelled "Projects" — repointing it to `/projects`
(see the table) is all that is needed there; do not add a second one:

- Settings, New project, Project detail, Project detail error branch, Console → existing
  back-link, repointed.
- Home → **add** a new "Projects" link to the existing top-right button row, styled like the
  Settings / Open console buttons that sit next to it (the row is a `flex flex-wrap
  items-center gap-3`).
- `/projects` itself → no self-link. Its header gets the "New project" button (primary sky
  button, moved verbatim from the home header) and should also keep Settings and "Open
  console" links so the console and settings stay reachable from the page that is now the
  app's real entry point.

### Moving the list

`ProjectList` in `src/app/page.tsx` (the whole function, including the empty-state `<section>`
with its own "New project" call to action) moves to `src/app/projects/page.tsx` unchanged.
`listProjects` / `ProjectStoreError` / `Project` keep coming from `@/lib/projects-store`; do
not change the store, the API routes under `src/app/api/projects/`, or any data shape.

Keep `export const dynamic = "force-dynamic"` on `/projects` — it reads `data/projects.json`
per request. Remove it from `/` since that route no longer reads anything.

### Related in-flight work

`.agent/tasks/github7_clickable-agenthub-brand-header.md` is an **unexecuted** task that adds a
shared clickable "AgentHub" wordmark component to every page and gives the home page an
`<h1>Projects</h1>`. These two tasks overlap on the same headers:

- If github7 has **not** been executed: this task leaves the home page's `<h1>AgentHub</h1>`
  as it is, and the new `/projects` page gets a plain `<h1 className="text-3xl font-semibold
  tracking-[-0.03em]">Projects</h1>` header matching the other pages.
- If github7 **has** been executed by the time this runs: reuse its shared brand component on
  the new `/projects` page instead of hand-writing a wordmark, and note that after this task
  "Projects" is the correct `<h1>` for `/projects` — the home page then needs a different
  `<h1>` of its own (e.g. "Home") since it no longer lists projects.

Do not execute github7 as part of this task.

## Acceptance Criteria

- [ ] `src/app/projects/page.tsx` exists and renders the project list, the empty state, the
      load-error alert and a "New project" button, with `export const dynamic = "force-dynamic"`.
- [ ] `/projects` renders correctly both with saved projects and with an empty
      `data/projects.json` (empty state shown, not a crash).
- [ ] `src/app/page.tsx` no longer imports from `@/lib/projects-store`, no longer contains
      `ProjectList`, no longer has an error branch, and no longer exports `dynamic`.
- [ ] `/` renders its header (AgentHub wordmark + subtitle + button row) and nothing below it.
- [ ] The home header's button row contains Settings, "Open console" and "Projects"; it no
      longer contains "New project".
- [ ] Every page header (home, `/projects` excluded as it is the current page, console,
      settings, new project, project detail, project detail error branch) exposes a link to
      `/projects`.
- [ ] `grep -rn 'href="/"' src/` returns no "Projects"-labelled link and no "Cancel" link —
      the only remaining `href="/"` occurrences (if any) are the brand wordmark.
- [ ] Creating a project redirects to `/projects` and the new project is visible in the list.
- [ ] Deleting a project from its detail page redirects to `/projects` and it is gone from the
      list.
- [ ] "Cancel" on `/projects/new` returns to `/projects`.
- [ ] Exactly one `<h1>` per page; `/projects` has `<h1>Projects</h1>`.
- [ ] `.agent/PROJECT_DOCUMENT.md` "Repository Structure" is updated: `page.tsx` is no longer
      "Projects home page", and the new `projects/page.tsx` route is listed.

## Technical Notes

- `src/app/projects/page.tsx` sits alongside the existing `projects/new/` and `projects/[id]/`
  segments — adding it does not affect those routes.
- Copy the page shell used by the other routes verbatim: `<main className="min-h-screen
  bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">` wrapping a centered container.
  The current home page uses `max-w-5xl` for the list — keep `max-w-5xl` on `/projects` so the
  list keeps its width. The now-empty home page can keep `max-w-5xl` too.
- Reuse the exact Tailwind classes already in the file being moved; this is a relocation, not
  a restyle. Secondary buttons: `h-11 rounded-xl border border-slate-300 bg-white px-4 py-3
  text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400
  hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100`. Primary button:
  `inline-flex h-11 items-center rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white
  shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200`.
- Use `next/link`'s `<Link>` for every internal navigation; a bare `<a>` to an internal route
  is flagged by `eslint-config-next` (`@next/next/no-html-link-for-pages`).
- `src/app/projects/new/page.tsx`, `src/app/projects/[id]/project-detail.tsx` and
  `src/app/console/agent-console.tsx` are `"use client"` components; only their link `href`s
  and `router.replace` targets change. Do not convert any component between server and client.
- Do not touch the WebSocket protocol, `server/`, `src/lib/`, or the API route handlers. This
  is a routing/presentation change only.
- Respect the project's 600-line-per-file guideline; all touched files stay small.
- The installed Next.js is newer than most training data — consult
  `node_modules/next/dist/docs/` before writing any Next.js-specific code (see AGENTS.md).

## Verification

- `pnpm build` completes with no compilation or type errors.
- `pnpm lint` passes; fix any errors it reports.
- Run `pnpm dev` and manually walk every route:
  - `/` — header only, no project list, no errors in the console; the Projects button opens
    `/projects`.
  - `/projects` — list renders (create a project first if `data/projects.json` is empty), the
    empty state renders when there are no projects, "New project" opens `/projects/new`.
  - `/projects/new` — "Projects" back-link and "Cancel" both land on `/projects`; creating a
    project lands on `/projects` with the project listed.
  - `/projects/{id}` — "Projects" back-link lands on `/projects`; deleting the project lands
    on `/projects` with the project gone.
  - `/settings` and `/console` — the "Projects" link lands on `/projects`.
- There are no automated tests in this project; the manual walkthrough above is the test.
