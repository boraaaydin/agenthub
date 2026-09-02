# Add a plans store, a plan-creation API, a /plans list, and a Plans menu in every header

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

Planning a task today starts a console session, the plan agent writes a task file under the
project's `.agent/tasks/`, and then nothing in AgentHub knows that plan exists. The only trace
is a Markdown file on disk.

After this task:

- AgentHub persists **plan records** in a new git-ignored `data/plans.json`.
- A new **`POST /api/plans`** endpoint creates a plan record; **`GET /api/plans`** lists them
  with pagination and an optional project filter.
- The composed planning prompt gains a **final step that tells the plan agent to POST the plan
  it just wrote** to that endpoint, so a plan record appears automatically at the end of every
  planning session.
- A new **`/plans`** page lists every registered plan across projects, paginated, with a project
  filter — mirroring `/tasks`.
- Every page header carries a shared nav that includes a **Plans** entry.

Decisions already made with the user (do not re-litigate them):

- **Plan record fields**: `projectId`, `taskId`, `title`, `filePath`, `summary`, plus an integer
  `id` and `createdAt`. The plan's Markdown body is *not* stored; it stays in the task file on
  disk.
- **The registration step is composed in code**, not in the editable prompt. It is appended by
  `composePlanPrompt` with the concrete endpoint URL, `projectId` and `taskId` filled in, so a
  user who overwrites the "After planning prompt" in Settings still gets plan registration.
  `src/lib/default-prompts/plan-post.md` is left unchanged.
- **The endpoint is global**: `/api/plans`, with `projectId` and `taskId` in the request body —
  not a nested route under `/api/projects/[id]/tasks/[taskId]/`.
- **The UI is a list only.** No `/plans/[id]` detail page; each row links to its task's detail
  page.

## Application

Root application (this repository is a single Next.js app; there is no `apps/` directory).

## GitHub Issue

- Issue #21

The issue is written in Turkish. Its requirements, translated: create an API endpoint for plan
creation; build a list of plans; add a menu named "Plans" to the header on every page; add an
extra step to the after-planning prompt so that when a plan is created a request is sent to the
application and a plan record is created.

## Dependencies

None - This task is independent

## Context

Files that matter here:

- `src/lib/tasks-store.ts` (319 lines) — the pattern the new plans store must follow:
  `readDocument` / `writeDocument` / `serializeWrite`, a `StoredX` validator, a
  `XValidationError` / `XStoreError` pair, sequential integer ids (`max(id) + 1`), and
  `paginate…` returning `{ items, page, pageSize, total, totalPages }`.
- `src/lib/projects-store.ts` — `getProject(id)`, `ProjectStoreError`.
- `src/lib/task-plan.ts` (18 lines) — `composePlanPrompt(planPrompt, taskId, taskTitle,
  taskDetail, planPostPrompt)` joins the plan prompt, a `## Task #id: title` block and the
  after-planning prompt with `---` separators. `planConsoleHref` builds the `/console?planProjectId=…&planTaskId=…` link.
- `src/app/api/projects/[id]/tasks/[taskId]/plan-prompt/route.ts` — the **only** caller of
  `composePlanPrompt`. Resolves project, task and settings, falls back to the built-in prompt
  Markdown through `effectivePrompt`, and returns `{ agent, projectId, projectName, projectPath,
  taskId, prompt }`.
- `src/app/console/use-plan-run.ts` — client hook that fetches that route and starts the session
  with the composed prompt. It validates the response shape (`isPlanPromptResponse`); it does not
  need to change.
- `src/app/api/projects/[id]/tasks/route.ts` — the closest existing Route Handler shape
  (`GET` + `POST`, `pageFromRequest`, 400/404/500 mapping). Copy its error handling.
- `src/app/tasks/page.tsx` (250 lines) — the list page to mirror: `export const dynamic =
  "force-dynamic"`, `searchParams` parsing, a preview/date helper, a rows section, an empty
  state, and a pagination `<nav>`.
- `src/lib/task-filters.ts` — client-safe href builder (`tasksHref`) used by the page and the
  filter component; `src/app/tasks/project-filter.tsx` is the `<select>` client component.
- `src/app/brand-link.tsx` — the shared header brand link, rendered in **10** page headers:
  `src/app/page.tsx`, `src/app/settings/layout.tsx`, `src/app/tasks/page.tsx`,
  `src/app/tasks/new/new-task-form.tsx`, `src/app/projects/page.tsx`,
  `src/app/projects/new/page.tsx`, `src/app/projects/[id]/page.tsx`,
  `src/app/projects/[id]/project-detail.tsx`,
  `src/app/projects/[id]/tasks/[taskId]/page.tsx`,
  `src/app/projects/[id]/tasks/[taskId]/task-detail.tsx`, and `src/app/console/agent-console.tsx`.
  There is no shared header component today; each page builds its own `<header>` around
  `<BrandLink />`.
- `src/lib/default-prompts/plan-post.md` — the built-in after-planning prompt. Its **last step
  tells the agent to end its own CLI process** (`kill -TERM $PPID`) so the plan session
  auto-closes. This is why the appended registration step must state explicitly that it runs
  *before* that exit.

Next.js here is 16.3.4 — newer than most training data. Read the relevant guide under
`node_modules/next/dist/docs/` before touching routing, `searchParams`, or Route Handler
signatures. Keep the existing typed `PageProps<…>` / `RouteContext<…>` helpers.

## Acceptance Criteria

### Store (`src/lib/plans-store.ts`, new)

- [ ] Starts with `import "server-only";` like the other stores.
- [ ] Exports a `Plan` type: `id: number`, `projectId: string`, `taskId: number`,
      `title: string`, `filePath: string`, `summary: string`, `createdAt: string`.
- [ ] Persists to `data/plans.json` as `{ "plans": [...] }`; exports `PLANS_FILE_PATH` and
      `PLANS_PAGE_SIZE = 10`.
- [ ] A missing file reads as an empty list (`ENOENT` → `{ plans: [] }`); malformed JSON or a
      record failing validation throws `PlanStoreError` with a message naming the file path.
- [ ] Exports `PlanValidationError` and `PlanStoreError`.
- [ ] `createPlan(input: unknown): Promise<Plan>` validates the input, assigns
      `max(id) + 1` starting at `1`, stamps `createdAt`, and writes through the same
      `serializeWrite` queue pattern used by `tasks-store.ts`.
- [ ] Validation rules, each throwing `PlanValidationError` with a plain-English message:
      `projectId` a non-empty string; `taskId` a positive integer (accepted as a number, or as a
      numeric string that round-trips); `title` a non-empty string (trimmed); `filePath` a
      non-empty string (trimmed); `summary` optional — a string, defaulting to `""`.
- [ ] `listAllPlans({ page, pageSize, projectId? })` returns
      `{ plans, page, pageSize, total, totalPages }`, filtered by `projectId` when given and
      sorted newest-first by `createdAt` (same comparator as `paginateTasks`).
- [ ] Registering a plan for a task that already has one **creates another record** — plans are
      an append-only log, keyed by their own id, never de-duplicated by `taskId`.
- [ ] `data/plans.json` is covered by the existing `data/` git-ignore rule; verify `.gitignore`
      and extend it only if `data/plans.json` is not already ignored.

### API (`src/app/api/plans/route.ts`, new)

- [ ] `export const dynamic = "force-dynamic"`.
- [ ] `POST` accepts `{ projectId, taskId, title, filePath, summary? }` and returns the created
      plan with status **201**.
- [ ] `POST` returns **400** with `{ error }` for a non-JSON body or a `PlanValidationError`.
- [ ] `POST` returns **404** `{ error: "Project not found." }` when `getProject(projectId)` is
      null, and **404** `{ error: "Task not found." }` when `getTask(projectId, taskId)` is null
      — the plan must reference a real task.
- [ ] `POST` returns **500** with a store-specific message (project / task / plan data could not
      be read or written) and logs the error, matching
      `src/app/api/projects/[id]/tasks/route.ts`.
- [ ] `GET` returns `listAllPlans` output, reading `page` (positive integer, default `1`) and
      `project` (optional project id filter) from the query string.

### Prompt composition (`src/lib/task-plan.ts`)

- [ ] `composePlanPrompt` takes a single options object instead of five positional arguments —
      e.g. `{ planPrompt, planPostPrompt, projectId, taskId, taskTitle, taskDetail, plansEndpoint }`
      — and the plan-prompt route is updated to the new call shape. It stays client-safe (no
      `server-only`, no Node imports).
- [ ] The composed prompt keeps its current order and `---` separators, and appends one final
      section after the after-planning prompt that instructs the agent to register the plan:
      - a heading such as `## Register the plan in AgentHub`;
      - the concrete request line `POST {plansEndpoint}` with `Content-Type: application/json`;
      - a ready-to-run `curl` example carrying the real `projectId` and `taskId`, with
        `title`, `filePath` and `summary` described as values the agent fills in — `filePath`
        repository-relative (e.g. `.agent/tasks/add-plans-api.md`), `summary` one or two
        sentences;
      - an explicit ordering sentence: this runs **after** the task file is final and
        **before** ending the CLI process / the exit step described above, because the
        after-planning prompt's last step terminates the session;
      - a failure instruction: a non-201 response is reported in the final summary, and the
        agent still finishes and exits rather than retrying in a loop.
- [ ] The section is appended unconditionally whenever a `plansEndpoint` is supplied, so it is
      present even when the user has replaced the after-planning prompt in Settings.

### Plan-prompt route (`src/app/api/projects/[id]/tasks/[taskId]/plan-prompt/route.ts`)

- [ ] Derives the endpoint origin from the incoming request (`new URL(request.url).origin`) and
      passes `${origin}/api/plans` as `plansEndpoint` — the first parameter is currently named
      `_request` and must start being used.
- [ ] The response shape (`agent`, `projectId`, `projectName`, `projectPath`, `taskId`,
      `prompt`) is unchanged, so `use-plan-run.ts` keeps working untouched.

### Plans list (`/plans`)

- [ ] `src/app/plans/page.tsx` is a server component with `export const dynamic = "force-dynamic"`,
      reading `page` and `project` from `searchParams`.
- [ ] Each row shows: the project name chip, `#id`, the plan title, a `Task #{taskId}` link to
      `/projects/{projectId}/tasks/{taskId}`, the summary (or "No summary provided."), the
      `filePath` in a monospace style, and the creation date.
- [ ] A plan whose project no longer exists still renders (with "Unknown project") and does not
      link out to a task page.
- [ ] A project `<select>` filter (client component under `src/app/plans/`) pushes
      `/plans?project=…` and drops `page`; "All projects" clears the param. An unknown project id
      falls back to no filter.
- [ ] Pagination links preserve the `project` param, exactly like `/tasks`.
- [ ] Empty states: "No plans yet" with a line explaining that plans appear after a planning
      session finishes, and a filtered variant when a project filter hides everything.
- [ ] A store read failure renders the same `role="alert"` red panel `/tasks` uses, naming
      `data/plans.json`.
- [ ] The href builder lives in one client-safe helper (e.g. `src/lib/plan-filters.ts` exporting
      `plansHref({ projectId, page })`), used by both the page and the filter component.

### Header navigation

- [ ] A shared nav component (e.g. `src/app/main-nav.tsx`) renders links to **Projects, Tasks,
      Plans, Console, Settings** and marks the current section with `aria-current="page"` plus a
      visual highlight, using `usePathname` (`"use client"`), so it can be dropped into both
      server and client page headers.
- [ ] Every one of the header sites listed in **Context** renders the nav next to `<BrandLink />`
      — the simplest route is a small `BrandBar` that renders `<BrandLink />` and the nav
      together and replaces each `<BrandLink />` usage, keeping `BrandLink` itself exported and
      unchanged.
- [ ] The nav does not break the existing header layouts (`sm:flex-row sm:items-end`,
      `sm:items-start`) — it sits under or beside the brand link without pushing page titles or
      header actions out of place at narrow widths.
- [ ] The home page keeps its existing action buttons and gains a **Plans** button alongside
      Tasks and Projects.
- [ ] The redundant one-off "Projects" links in `src/app/settings/layout.tsx` and
      `src/app/console/agent-console.tsx` headers are removed once the nav covers them.

### Documentation

- [ ] `.agent/PROJECT_DOCUMENT.md` is updated:
      - the Architecture persistence paragraph mentions `data/plans.json`, its fields, and that
        the composed planning prompt ends with a step registering the plan through `POST /api/plans`;
      - Repository Structure gains `src/app/api/plans/`, `src/app/plans/`, `src/lib/plans-store.ts`,
        and lists `plans.json` among the git-ignored runtime data files;
      - "Delivered session capabilities" records the `/plans` list and the automatic plan
        registration at the end of a planning session.

## Technical Notes

- Copy `tasks-store.ts` structurally rather than inventing a new persistence style: same
  `serializeWrite` queue (the whole document is rewritten per mutation), same `PlanStoreError`
  message wording, same `fs.mkdir(dirname, { recursive: true })` before the first write. Never
  write `data/plans.json` outside the store.
- Keep the store server-only and the href/label helpers client-safe. `src/lib/plan-filters.ts`
  must not import the store, mirroring how `task-filters.ts` is imported by both sides.
- Accept `taskId` as a numeric string in the POST body as well as a number: the plan agent
  builds the JSON by hand from a prompt, and a quoted id is the likeliest slip. Normalize to a
  number before storing.
- The composed prompt is pasted into the terminal as a single bracketed-paste submission
  (`src/lib/terminal-input.ts`). Keep the appended section free of characters that would break
  that — no trailing backslash line-continuations; a single-line `curl … -d '{"…"}'` example is
  safest, and single-quote the JSON payload so the shell keeps it intact.
- Because the after-planning prompt's final step kills the agent process, the ordering sentence
  in the registration section is load-bearing. Do not instead reorder the composed prompt to put
  registration before the after-planning prompt — the user chose the appended form.
- Follow the existing visual language: `h-11 rounded-xl` controls, `border-slate-300`,
  `focus:ring-3 focus:ring-sky-100`, sky-700 primaries, `rounded-md bg-slate-100 px-2 py-0.5
  text-xs` chips, `divide-y divide-slate-200` rows inside a
  `rounded-xl border border-slate-200 bg-white shadow-sm` section.
- Server components on these routes are `export const dynamic = "force-dynamic"` — keep that.
- Keep files under the project's 600-line rule; extract row/filter pieces into their own
  components rather than growing `plans/page.tsx`.
- Do not change `src/lib/default-prompts/plan-post.md`, the settings store, or the settings
  prompt pages — the registration step is code-composed and deliberately not user-editable.

## Verification

- `pnpm build` completes with no compilation or type errors.
- `pnpm lint` passes with no new errors or warnings.
- Manual checks with `pnpm dev` at `http://localhost:3000`:
  - `POST /api/plans` with a valid body creates `data/plans.json` and returns 201 with the
    stored record; a bad `taskId` returns 404; a missing `title` returns 400;
  - `/plans` lists the record, the project filter narrows it, and pagination appears past ten
    records;
  - the Plans entry is present in the header on `/`, `/projects`, a project detail page,
    `/tasks`, `/tasks/new`, a task detail page, `/console` and `/settings`, and highlights the
    active section;
  - clicking "Create plan" on a task opens the console and the pasted prompt ends with the
    registration section carrying the real project id, task id and
    `http://localhost:3000/api/plans`;
  - running a full planning session end to end leaves a new row on `/plans` pointing at the
    task file the agent wrote.
