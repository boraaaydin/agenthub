# Set a task to "Executed" when its execution run finishes

---
**Execution Guidelines**: Before starting this task, ensure you've read `.agent/commands/tasks/do-task.md` (if not already read in this session). This file contains essential guidelines on how to properly execute tasks, including dependency checking, verification steps, and archival procedures.

**Application-specific documentation**: This task targets the root application, so read `.agent/PROJECT_DOCUMENT.md` before starting. There is no `apps/` directory in this repository; the project document at `.agent/PROJECT_DOCUMENT.md` is the application document for this task.
---

## Description

Executing a task from the console moves it to `executing`, but it never reaches `executed`.
The task stays stuck in `Executing` even after the agent has visibly finished the work in the
console. `data/tasks.json` shows the symptom today: tasks #15, #18, #19, #21, and #25 are all
still `executing`.

There are two independent causes:

1. **The agent never ends its CLI process.** `src/lib/default-prompts/task-post.md` — unlike
   `src/lib/default-prompts/plan-post.md`, which ends with "print the final line, then end your
   own CLI process (`kill -TERM $PPID`)" — contains no such step. The execution agent finishes
   the implementation, prints its report and commit suggestions, and then sits at its interactive
   prompt. The PTY never exits, so no `exit` message is ever broadcast.
2. **The `executed` transition lives only in the browser tab that started the run.**
   `useTaskExecution` (`src/app/console/use-task-execution.ts`) holds the execution in a React
   ref and only reacts to an `exit` whose `sessionId` matches the one it claimed. A page reload,
   a second browser tab, or a closed console loses that state permanently — unlike planning
   sessions, which `usePlanCreation` rehydrates from every `sessions` broadcast.

Fix both, without requiring the agent to end its CLI session:

- **Primary path — the agent reports completion.** Compose a code-owned
  "Report execution completion to AgentHub" section into the execution prompt (mirroring
  `registerPlanPrompt` in `src/lib/plan-prompt.ts`) that tells the agent to
  `PATCH /api/tasks/{taskId}` with `{"status":"executed"}` once the work and its verification are
  finished. Because the section is composed in code rather than stored in a prompt file, it is
  present even when a user has saved a custom **After task prompt** in settings.
- **Fallback path — the server reacts to session exit.** When a session that carries an execution
  context (`execution.taskId`) exits, the custom server marks that task `executed` if — and only
  if — it is still `executing`. This works with no browser tab open and survives reloads.

The execution agent **must not** be told to end its own CLI process. The session stays interactive
after the report, so the user can keep talking to the agent in the same session.

Tasks already stuck in `executing` are left alone; this task changes forward behaviour only. They
can be corrected by hand from the task detail page.

## Application

Root application (`agenthub`)

## GitHub Issue

- Issue #35 — "console da task işlemi bittiğinde status değişmiyor"

## Dependencies

None - This task is independent

## Context

### Current flow

- `/tasks` and `/workitems` link to `taskConsoleHref(taskId)` = `/console?runTaskId={taskId}`
  (`src/lib/task-execution.ts`).
- `src/app/console/use-task-run.ts` fetches `GET /api/tasks/{taskId}/execution-prompt`, calls
  `startSession(agent, project, prompt, false, execution)` with
  `execution = { projectId, workitemId, taskId }`, then `beginExecution(execution)`.
- `src/app/console/use-task-execution.ts`:
  - `beginExecution` PATCHes the task to `executing`.
  - `claimSession(sessionId)` records the started session id (called from `onStarted`).
  - `handleSessionExit(sessionId)` PATCHes the task to `executed` **and** opens the
    `TaskClosePrompt` ("Mark task #N and workitem #M as completed?").
  - `completeTaskAndWorkitem` PATCHes the task to `completed`, the workitem to `completed`, and
    dismisses the session; it is used both by the close prompt and by the **Complete task**
    button (`TaskCompletionAction`), which is rendered from `activeSession.execution.taskId` and
    therefore already survives a reload.
- `server/session-registry.ts` stores `execution` on each `TerminalSession` and calls
  `options.onExit(session, exitCode)` from `pty.onExit`. `server.ts` currently only broadcasts
  `exit` + `sessions` from that callback.
- `src/lib/agent-protocol.ts` defines `SessionContext = { projectId; workitemId; taskId? }`; a
  planning session has no `taskId`, an execution session has one. `isSessionContext` already
  validates it.

### The pattern to mirror

`src/lib/plan-prompt.ts` composes a `## Register the plan in AgentHub` section from an absolute
`tasksEndpoint` supplied by the route
(`tasksEndpoint: \`${new URL(request.url).origin}/api/tasks\``, see
`src/app/api/projects/[id]/workitems/[workitemId]/plan-prompt/route.ts`). The section is appended
after the saved/default prompt sections, so it cannot be lost by a custom prompt. This is exactly
the shape the execution prompt needs.

### Constraint on the custom server

`server.ts` runs under `tsx`, outside the Next.js bundler. It **cannot** import
`src/lib/tasks-store.ts`: that module starts with `import "server-only"`, and `server-only` is a
Next.js-internal alias with no entry in `node_modules`, so the import fails to resolve. Two
separate module instances of the store would also each keep their own `writeQueue`, so direct
imports would break write serialization. The server therefore has to reach the store the same way
any other client does — over HTTP, against its own `port`.

### Relevant files

- `src/lib/task-execution.ts` — `composeTaskPrompt`, `taskConsoleHref`
- `src/lib/plan-prompt.ts` — reference implementation of a code-composed endpoint section
- `src/app/api/tasks/[taskId]/execution-prompt/route.ts` — builds the execution prompt
- `src/app/api/tasks/[taskId]/route.ts` — `GET` and `PATCH` for a single task; `PATCH` accepts a
  bare `{ "status": "executed" }` body and resolves project/workitem from the stored task
- `src/app/console/use-task-execution.ts` — client execution tracking
- `server.ts` — `SessionRegistry` construction and the `onExit` callback
- `server/session-registry.ts` — `TerminalSession`, `execution`, `stoppedByUser`
- `src/lib/task-filters.ts` — `TASK_STATUSES`, `isTaskStatus`

## Acceptance Criteria

- [ ] `composeTaskPrompt` accepts an optional absolute `taskEndpoint` and, when it is present,
      appends a final `## Report execution completion to AgentHub` section joined with the other
      sections by `\n\n---\n\n`. When `taskEndpoint` is absent the composed prompt is unchanged
      from today.
- [ ] That section names the endpoint, gives a copy-pastable
      `curl -X PATCH "<endpoint>" -H "Content-Type: application/json" -d '{"status":"executed"}'`,
      states that it must be run once the implementation and its required verification are
      finished (including the after-task close-out), states that a blocked or failed run must
      **not** be reported as executed but explained instead, and states that a non-2xx response is
      reported in the final summary rather than retried in a loop.
- [ ] The section explicitly tells the agent **not** to end its own CLI process; the session stays
      interactive after the report.
- [ ] `GET /api/tasks/[taskId]/execution-prompt` passes
      `taskEndpoint: \`${new URL(request.url).origin}/api/tasks/${task.id}\`` into
      `composeTaskPrompt`, matching how the plan-prompt route supplies `tasksEndpoint`.
- [ ] The section is present even when `data/settings.json` holds a non-empty custom
      `taskPrompt` and `taskPostPrompt`, because it is composed in code and not read from
      `src/lib/default-prompts/`.
- [ ] `src/lib/default-prompts/task-post.md` is **not** given a `kill -TERM $PPID`-style exit step.
- [ ] When a session carrying `execution.taskId` exits, `server.ts` reads that task over HTTP from
      its own port and, only if its status is still `executing`, PATCHes it to `executed`. Any
      other status (`created`, `executed`, `completed`, `cancelled`) is left untouched, so a task
      the user already completed is never downgraded when its session is stopped and dismissed.
- [ ] The fallback runs for a user-stopped session too (the **Stop session** button and the
      session teardown inside `completeTaskAndWorkitem` both reach `pty.onExit`), and its failures
      are logged with `console.error` only — they never throw out of the `onExit` callback, never
      block the `exit` / `sessions` broadcasts, and never crash the server.
- [ ] Sessions with no execution context, and planning sessions (an `execution` without `taskId`),
      trigger no HTTP call at all.
- [ ] `useTaskExecution.handleSessionExit` no longer PATCHes the task to `executed` — the server
      now owns that transition — while it still marks the execution `exitHandled` and opens the
      `TaskClosePrompt`, so the console's "Complete task and workitem" flow is unchanged.
- [ ] `beginExecution` still PATCHes the task to `executing` when a run starts, and
      `completeTaskAndWorkitem` still PATCHes to `completed`; neither is affected.
- [ ] Executing a task and letting the agent finish without exiting leaves the task at `executed`
      in `data/tasks.json`, with a matching `executing → executed` entry in
      `data/lifecycle-log.json` (written once, not twice, when both the agent report and a later
      session exit occur).
- [ ] Existing tasks already stuck in `executing` are not migrated or rewritten by this change.
- [ ] `.agent/PROJECT_DOCUMENT.md` is updated: the composed execution prompt now instructs the
      agent to report completion through `PATCH /api/tasks/{id}`, and the custom server marks an
      execution session's task `executed` when the session exits.

## Technical Notes

- Read `.agent/PROJECT_DOCUMENT.md` before implementing.
- Suggested shape for `src/lib/task-execution.ts`, mirroring `registerPlanPrompt`:

  ```ts
  type ComposeTaskPromptOptions = ProjectPromptTokens & { /* … */ taskEndpoint?: string };

  function reportExecutionPrompt({ taskEndpoint }: Pick<ComposeTaskPromptOptions, "taskEndpoint">) {
    if (!taskEndpoint) return "";
    return ["## Report execution completion to AgentHub", /* … */].join("\n\n");
  }
  ```

  Append the section only when non-empty, exactly as `composePlanPrompt` does.
- For the server fallback, keep the HTTP work in a small named helper in `server.ts` (or a new
  `server/` module that imports nothing from `src/lib` other than types) and call it
  fire-and-forget from `onExit` with `void helper(...).catch(…)`. Node's global `fetch` is
  available; target `http://127.0.0.1:${port}/api/tasks/${taskId}` using the `port` constant
  already defined at the top of `server.ts`.
- Guard the fallback by reading the task first (`GET`) and comparing `status === "executing"`
  before the `PATCH`. Do not add a new conditional-update endpoint; the existing `GET` + `PATCH`
  pair is enough and keeps `src/app/api/tasks/[taskId]/route.ts` untouched.
- In development the first request after a change may be slow while Next.js compiles the route;
  do not add a short timeout that would abort a legitimate call. If a timeout is added at all,
  keep it generous (≥ 30s) and treat expiry as a logged failure.
- `updateTask` only appends a lifecycle event when the status actually changes, so a redundant
  PATCH is harmless — but the `status === "executing"` guard is still required to prevent a
  `completed → executed` downgrade.
- Do not broadcast a new WebSocket message type for task changes; live refresh of the `/tasks`
  list is out of scope for this task. The list picks the new status up on its next load.
- Do not change the planning flow, the plan prompts, the settings screens, `TaskClosePrompt`, or
  `TaskCompletionAction`.
- Next.js 16 route handlers use `RouteContext<"/api/tasks/[taskId]/execution-prompt">` with awaited
  `params`; check `node_modules/next/dist/docs/` before writing new Next.js APIs.
- Keep every touched file under 600 lines.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Manual: `curl -s http://localhost:3000/api/tasks/{id}/execution-prompt | jq -r .prompt` and
      confirm the prompt ends with the `## Report execution completion to AgentHub` section
      naming `http://localhost:3000/api/tasks/{id}`.
- [ ] Manual: save a custom **After task prompt** in `/settings`, re-run the request above, and
      confirm the completion section is still present.
- [ ] Manual: from `/workitems`, run **Execute task** on a `Task created` workitem; confirm the
      task becomes `Executing`, and that after the agent finishes and reports — with its CLI still
      running — the task shows `Executed` on `/tasks` and a single `executing → executed` entry
      appears in `/logs`.
- [ ] Manual: start an execution, reload `/console`, then **Stop session**; confirm the task still
      becomes `Executed` even though the tab that started it is gone.
- [ ] Manual: complete a task through **Complete task and workitem**, and confirm the resulting
      session teardown leaves the task at `Completed`, never reverting it to `Executed`.
- [ ] Manual: start a planning session (**Create task** on a workitem) and confirm no task status
      is touched when it exits, and that the workitem still returns to `Open` when no plan was
      registered.
