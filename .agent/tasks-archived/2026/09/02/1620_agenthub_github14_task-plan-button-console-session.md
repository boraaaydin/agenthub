# Task screens: "Create plan" button that starts a console session with the plan prompts

---
**Execution Guidelines**: Before starting this task, ensure you've read `.agent/commands/tasks/do-task.md` (if not already read in this session). This file contains essential guidelines on how to properly execute tasks, including dependency checking, verification steps, and archival procedures.

**Application-specific documentation**: This repository is a single application; there is no `apps/{APP_NAME}/` directory. Read `.agent/PROJECT_DOCUMENT.md` before starting — it carries the project's purpose, architecture, tech stack and verification commands.

When this task file is read standalone, the agent should:
1. Check if `do-task.md` has been read in the current session
2. If not, read it first to understand the execution workflow
3. Read `.agent/PROJECT_DOCUMENT.md` before starting the task
4. Then proceed with this specific task
---

## Description

Add a **Create plan** action to the task screens. Clicking it opens the console, starts a **new
session** with the globally configured **Plan agent** in the task's project directory, and
immediately sends one composed prompt built from:

1. the effective **Task planning prompt** (`planPrompt`),
2. the task's **title and detail**,
3. the effective **After planning prompt** (`planPostPrompt`).

"Effective" means: the value saved in `data/settings.json` when it is non-empty, otherwise the
built-in default Markdown from `src/lib/default-prompts/` — the same fallback the settings
pages already display in muted text.

The user must not have to type or paste anything: the session starts and the prompt is
submitted automatically.

## Application

Root application (`agenthub`) — single Next.js app in `src/`. No `apps/` subdirectory exists.

## GitHub Issue

- Issue #14 ("task ekranında plan oluştur butonu eklenmesi")

Original request (Turkish): when the "create plan" button of a task is clicked, a new session
should be created on the console screen; the plan and post-plan prompts together with the task
title and description should be given to the relevant default coding agent and run.

## Dependencies

None - This task is independent

## Context

### Decisions confirmed with the user before planning

| Question | Decision |
| --- | --- |
| How the prompts reach the agent | **One combined prompt**, sent as a single message: plan prompt → task title/detail → after-planning prompt. No completion/idle detection exists for a PTY session, so a second, sequenced message is out of scope. |
| What the button does | **Auto-start and auto-submit.** Navigate to the console, start a new session with the Plan agent in the project directory, and send the composed prompt without further user action. |
| Where the button appears | **Task detail page and both task lists** — `/projects/[id]/tasks/[taskId]`, the project task list `/projects/[id]/tasks`, and the global list `/tasks`. |

### Current state of the relevant code

- `src/app/projects/[id]/tasks/[taskId]/task-detail.tsx` — client component; header, edit form,
  delete section. Receives `projectName` and the full `task` from its server page.
- `src/app/projects/[id]/tasks/page.tsx` and `src/app/tasks/page.tsx` — server components whose
  `TaskRows` render each row as a **single full-row `<Link>`**. `/tasks` rows also render a
  non-link `<div>` variant when the task's project is missing.
- `src/app/console/agent-console.tsx` — client console. Already reads a `projectId` search param
  (`initialProjectIdRef`) to preselect a saved project, loads `/api/projects`, and owns the
  session lifecycle:
  - `submitPrompt` puts the text in `queuedPromptRef`, sends `{ type: "start", agent, cwd, cols, rows }`,
  - `onStarted` stamps the new session id onto the queued prompt,
  - `onScrollback` flushes the queued prompt as `{ type: "input", sessionId, data: `${prompt}\r` }`
    once the session is attached.
  This existing queue is the mechanism the auto-run should reuse — do not invent a second one.
- `src/lib/settings-store.ts` — `readSettings()` returns `{ taskAgent, planAgent, planPrompt, planPostPrompt, taskPrompt, taskPostPrompt }`; unset prompts are `""`.
- `src/lib/default-settings-prompts.ts` — **server-only** (`import "server-only"`), reads
  `src/lib/default-prompts/{plan,plan-post,task,task-post}.md`. A client component can never
  call it, and `GET /api/settings` returns the raw `""`, not the default text.
- `src/lib/tasks-store.ts` — `getTask(projectId, taskId)`; `src/lib/projects-store.ts` —
  `getProject(id)` with the project's absolute `path`.
- `src/app/api/projects/[id]/tasks/[taskId]/route.ts` — has `PATCH` and `DELETE` only; there is
  **no** `GET` for a single task.
- `src/lib/agent-protocol.ts` — `isClientMessage` caps `input` data at 100,000 characters;
  `settings-store` caps each prompt at 20,000 characters, so a composed prompt stays under the
  limit in practice but the server-side cap still applies.
- `server/session-registry.ts` — `MAX_SESSIONS = 12`; `create()` rejects beyond that, and the
  error arrives as a `{ type: "error" }` server message.

### Why the composition happens on the server

The default prompt Markdown lives behind a `server-only` module, and the button is rendered from
client components. A dedicated Route Handler keeps the fallback logic in one server place and
lets the console fetch one ready-to-send payload instead of stitching settings, defaults, task
and project together in the browser.

## Acceptance Criteria

- [ ] A new Route Handler `GET /api/projects/[id]/tasks/[taskId]/plan-prompt` returns
      `{ agent, projectId, projectName, projectPath, taskId, prompt }`, where `agent` is
      `settings.planAgent` and `prompt` is the composed text described below.
- [ ] The handler validates the task id the same way the existing `PATCH`/`DELETE` handlers do
      (positive integer, exact string match) and returns `404` with `{ error: "Task not found." }`
      for an unknown project or task; store/read failures return `500` with a message consistent
      with the existing handlers.
- [ ] The composed prompt uses the saved `planPrompt` / `planPostPrompt` when non-empty and the
      built-in default from `src/lib/default-prompts/` when empty, in this order: planning
      prompt, then the task title and detail, then the after-planning prompt.
- [ ] The task detail page shows a **Create plan** button in its header area (separate from the
      save/delete form controls) that navigates to `/console?planProjectId={projectId}&planTaskId={taskId}`.
- [ ] Every row of the project task list (`/projects/[id]/tasks`) and of the global task list
      (`/tasks`) shows the same **Create plan** action pointing at the same URL; rows on `/tasks`
      whose project is missing do **not** show it.
- [ ] The task-row markup stays valid: the row's navigation link and the plan action are
      **sibling** interactive elements — no `<button>` or `<a>` nested inside the row `<Link>` —
      and both remain keyboard reachable with visible focus rings.
- [ ] With `planTaskId` (and `planProjectId`) in the console URL, the console — once its socket
      is connected, its projects are loaded and its terminal is ready — automatically: selects
      that project, selects the Plan agent returned by the handler, starts a **new** session in
      the project's directory, and submits the composed prompt into it, all without user input.
- [ ] The auto-run happens **exactly once** per navigation: a guard ref prevents re-running on
      re-render/reconnect, and the console replaces the URL with `/console` after the start is
      issued so a page refresh does not launch a second session.
- [ ] The multi-line prompt reaches the agent as **one** submission — intermediate newlines must
      not be interpreted as separate submits by the CLI (see Technical Notes).
- [ ] Failures surface in the console's existing error area and leave the console usable: the
      handler returning an error, the project no longer existing, and the session limit being
      reached each show a readable message and start nothing.
- [ ] Existing console behaviour is unchanged when the new search params are absent, including
      the current `projectId` preselection.
- [ ] `.agent/PROJECT_DOCUMENT.md` is updated: the plan flow now consumes the plan/after-plan
      prompts and the Plan agent, and the new Route Handler is reflected in the repository
      structure and the delivered-capabilities list.

## Technical Notes

### Composed prompt shape

Compose server-side, trimming each part and joining with blank lines, e.g.:

```
{effective planPrompt}

---

## Task #{id}: {title}

{detail or "No detail provided."}

---

{effective planPostPrompt}
```

Keep the exact separators in one helper function so the format is easy to change later. Read the
defaults through `readDefaultSettingsPrompt(field)`; if that read throws, log it and fall back to
an empty section rather than failing the whole request — but if **both** the saved value and the
default are unavailable for the planning prompt, return a `500` with an explanatory message.

### Sending a multi-line prompt through the PTY

The console currently sends `${value}\r`. That is fine for the single-line prompts typed in the
textarea, but a composed Markdown prompt contains newlines, and Claude Code / Codex treat a bare
`\r` (or `\n`) as "submit". Wrap the text in **bracketed paste** so the CLI receives it as one
pasted block, then submit once:

```
\x1b[200~ + text with \n line endings (normalize \r\n and \r to \n) + \x1b[201~
```

followed by a separate `\r`. Put this in a small shared helper (for example
`src/lib/terminal-input.ts`) and use it for the queued-prompt flush so both the manual and the
automatic path behave identically. Some CLIs need a brief gap between the paste block and the
submit key; if the agent's input box swallows the trailing `\r`, send the `\r` in a follow-up
`input` message rather than concatenating it.

### Console wiring

- Read `planTaskId` / `planProjectId` from `useSearchParams()` into refs at mount, the way
  `initialProjectIdRef` already does — the console is wrapped in `<Suspense>` by
  `src/app/console/page.tsx`.
- Gate the auto-run on `connected && !isLoadingProjects && terminalReady` and on a
  `planRunStartedRef` guard.
- Reuse `queuedPromptRef` + `{ type: "start", … }`; do not add a new protocol message. No change
  to `src/lib/agent-protocol.ts` or `server/` should be needed.
- Set the console's `agent` state to the returned Plan agent so the visible controls and button
  labels match what actually starts.
- Use `router.replace("/console")` after issuing the start.
- `src/app/console/agent-console.tsx` is already 408 lines; the 600-line rule applies, so put the
  fetch/compose/auto-start logic in a colocated hook (for example
  `src/app/console/use-plan-run.ts`) instead of growing the component further.

### Task rows

To keep one clickable row plus a separate button, make the `<li>` `relative`, keep the row
`<Link>` as a stretched link (`after:absolute after:inset-0`), and render the plan action in a
`relative z-10` cell so it sits above the stretched area. Match the existing visual language
(`rounded-xl`, `focus:ring-3 focus:ring-sky-100`, sky/slate palette). The action is a `<Link>`,
not a form control, so the list pages can stay server components.

### Wording and scope

- All UI copy is English: **Create plan**.
- Do not change the settings pages, the prompt storage format, or the task execution
  (`taskPrompt` / `taskPostPrompt`) flow — those stay for a later task.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Manual: with `data/settings.json` holding **no** prompt values, click **Create plan** from
      the task detail page and confirm the console starts a session with the Plan agent in the
      project directory and the built-in `src/lib/default-prompts/plan.md` + task + `plan-post.md`
      text arrives as a single submission.
- [ ] Manual: save custom plan/after-plan prompts in settings and confirm the saved text is used
      instead of the defaults.
- [ ] Manual: trigger the button from a row of `/projects/[id]/tasks` and of `/tasks`, and confirm
      plain row clicks still navigate to the task detail page.
- [ ] Manual: refresh the console after an auto-run and confirm no second session is started.
