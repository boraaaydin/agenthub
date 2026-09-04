# Add an "Execute task" button to every plan in the plan list

## Description

Add an **Execute task** action to each row of the `/plans` list. Activating it opens the
console and immediately starts a session with the configured **Task agent** in the plan's
project directory, using the effective *Task execution prompt* and *After task prompt*
composed with the plan's task reference and repository-relative plan file path.

This is the first consumer of the `taskAgent`, `taskPrompt`, and `taskPostPrompt` settings;
they are persisted and editable in `/settings` today but nothing runs them yet. The new flow
mirrors the existing planning flow (`Create plan` on the task detail page →
`/console?planProjectId=…&planTaskId=…` → `usePlanRun`), with one deliberate difference:
the execution session is **not** auto-closed when the agent exits, so its scrollback stays
available for review.

## Application

Root application (`agenthub`)

## Dependencies

None - This task is independent

## Context

Relevant existing pieces:

- `src/app/plans/page.tsx` — server-rendered plan list; `PlanRows` renders each plan's project
  chip, id, title, date, summary, task link, and file path.
- `src/lib/plan-filters.ts` — client-safe href helpers for plan routes (`planDetailHref`,
  `newPlanHref`, `plansHref`).
- `src/lib/task-plan.ts` — `composePlanPrompt` joins prompt sections with `\n\n---\n\n`, and
  `planConsoleHref(projectId, taskId)` builds `/console?planProjectId=…&planTaskId=…`.
- `src/app/api/projects/[id]/tasks/[taskId]/plan-prompt/route.ts` — resolves project, task, and
  settings, falls back to the built-in Markdown prompt when the saved prompt is empty
  (`effectivePrompt`), and returns `{ agent, projectId, projectName, projectPath, taskId, prompt }`.
- `src/app/console/use-plan-run.ts` — client hook that waits for `connected`,
  `!isLoadingProjects`, and `terminalReady`, fetches the prompt endpoint once (guarded by a
  ref), validates the response, selects the project and agent, calls
  `startSession(agent, project, prompt, true)`, and then `router.replace("/console")`.
- `src/app/console/agent-console.tsx` — reads the startup query parameters into refs
  (`initialPlanProjectIdRef`, `initialPlanTaskIdRef`, lines ~48-50), exposes
  `startSession(nextAgent, project, nextPrompt, autoClose = false)` (line ~198), and calls
  `usePlanRun` (line ~278).
- `src/lib/plans-store.ts` — `getPlan(planId)` returns a `Plan`
  (`id`, `projectId`, `taskId`, `title`, `filePath`, `summary`, `createdAt`, `updatedAt`).
- `src/lib/settings-store.ts` — `readSettings()` returns `taskAgent`, `planAgent`, and the four
  prompt fields; `src/lib/default-settings-prompts.ts` reads the built-in Markdown defaults from
  `src/lib/default-prompts/` (`task.md`, `task-post.md`).
- `src/lib/plan-file.ts` — `resolvePlanFilePath(projectPath, filePath)` returns `null` for
  absolute paths or paths escaping the project directory.

The built-in task prompt (`src/lib/default-prompts/task.md`) already states: "If a task-file
path is supplied, execute that file", so the composed prompt only has to name the plan's
`filePath`; the file contents must not be inlined.

## Acceptance Criteria

- [ ] Every row in `/plans` shows an **Execute task** action alongside the existing task and
      file-path links, reachable by keyboard and with a visible focus ring, matching the
      list's existing control styling.
- [ ] The action links to `/console?taskPlanId={plan.id}` through a new client-safe helper
      (e.g. `taskConsoleHref(planId)`), not a hand-written URL string in the page.
- [ ] For a plan whose project no longer exists, the action is not offered as a working link
      (rendered disabled or omitted), consistent with how such a row already degrades the
      task link to plain text.
- [ ] A new `GET /api/plans/[planId]/task-prompt` route returns
      `{ agent, planId, projectId, projectName, projectPath, taskId, filePath, prompt }` where
      `agent` is `settings.taskAgent` and `prompt` is the composed execution prompt.
- [ ] The composed prompt joins, with `\n\n---\n\n` separators: the effective task execution
      prompt, a task-file section naming the plan (`plan id`, `Task #{taskId}`, the plan title,
      the repository-relative `filePath`, and the plan summary when present), and the effective
      after-task prompt. Saved settings text wins; when a saved prompt is empty the built-in
      Markdown default is used. The plan file's contents are not inlined.
- [ ] The route returns 404 with `{ error: "Plan not found." }` for an unknown or malformed
      plan id, and 404 when the plan's project no longer exists; store failures return 500 with
      a message naming the file to check, following the existing `plan-prompt` route's wording.
- [ ] The route returns 500 with an actionable message when the effective task execution prompt
      resolves to empty, mirroring the plan-prompt route's guard.
- [ ] The console reads a `taskPlanId` startup parameter and, once connected, projects are
      loaded, and the terminal is ready, starts exactly one session with the returned agent,
      the plan's project, and the composed prompt, then replaces the URL with `/console`.
- [ ] The started execution session uses `autoClose = false`, so it remains listed in the
      session sidebar with its scrollback after the agent exits.
- [ ] Failures (fetch error, non-OK response, unknown project, project path mismatch,
      terminal not ready) surface in the console's existing error banner with an actionable
      message and do not start a session; the run is attempted only once per navigation.
- [ ] The existing plan-run flow (`planProjectId` / `planTaskId`) keeps working unchanged,
      including its `autoClose = true` behavior.
- [ ] `.agent/PROJECT_DOCUMENT.md` is updated: the new API route and console hook in the
      repository structure, and a "Delivered session capabilities" entry describing that plans
      can be executed from the plan list with the configured Task agent and task prompts.

## Technical Notes

- Read `.agent/PROJECT_DOCUMENT.md` before implementing.
- Suggested files:
  - `src/lib/task-run.ts` (new, client-safe): `composeTaskPrompt(...)` and
    `taskConsoleHref(planId)`. Keep `src/lib/task-plan.ts` focused on the planning flow, or
    extend it instead if that keeps both files small — either is acceptable as long as no file
    exceeds 600 lines and client components import nothing server-only.
  - `src/app/api/plans/[planId]/task-prompt/route.ts` (new): `export const dynamic = "force-dynamic";`
    parse the `planId` param the way the plan-prompt route parses `taskId`
    (`Number.parseInt`, positive integer, `String(parsed) === param`), then `getPlan`,
    `getProject`, `readSettings`, and the `effectivePrompt` fallback for `taskPrompt` /
    `taskPostPrompt`.
  - `src/app/console/use-task-run.ts` (new): copy the structure of `use-plan-run.ts` — a
    `planIdRef`, a `startedRef` guard, an `AbortController`, a response type guard, and
    `startSession(agent, project, prompt, false)`.
  - `src/app/console/agent-console.tsx`: add `initialTaskPlanIdRef = useRef(searchParams.get("taskPlanId"))`
    and call the new hook next to `usePlanRun`.
  - `src/app/plans/page.tsx`: render the action in the existing per-row link row.
- Next.js 16 route handlers use `RouteContext<"/api/plans/[planId]/task-prompt">` with awaited
  `params`; check `node_modules/next/dist/docs/` before writing new Next.js APIs.
- The plan list is a server component; the action is a plain `next/link`, so no `"use client"`
  boundary is needed there.
- Validate `filePath` with `resolvePlanFilePath(project.path, plan.filePath)` in the route and
  return 400 with a clear message when it is absolute or escapes the project directory, so a
  malformed record cannot compose a prompt pointing outside the project.
- Do not change the planning flow's prompts, the settings screens, or the plan CRUD endpoints.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Manual: with at least one registered plan, open `http://localhost:3000/plans`, click
      **Execute task**, and confirm the console starts a session with the configured Task agent
      in the plan's project directory, the first prompt contains the task execution prompt, the
      plan's file path, and the after-task prompt, and the URL settles on `/console`.
- [ ] Manual: let the executing agent exit and confirm the session stays in the sidebar with its
      output until dismissed.
- [ ] Manual: `curl -s http://localhost:3000/api/plans/999999/task-prompt` returns 404 with
      `{"error":"Plan not found."}`.
- [ ] Manual: the task detail page's **Create plan** button still starts a planning session that
      closes itself when the agent exits.
