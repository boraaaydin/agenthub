# PROJECT_DOCUMENT.md

Project-wide context for AI agents. Read this first, before any other file.

## Purpose

**AgentHub** is a locally-run web application that acts as a single control panel for
terminal-based AI coding agents (Claude Code, Codex, Pi, and similar CLIs).

The user picks an agent from the web UI, sends it a prompt, and watches the agent's output
stream back into the browser live — exactly as it would appear in a terminal. Sessions stay
alive between prompts, so a conversation with an agent continues across multiple messages.

It runs only on the developer's own machine; it is not intended to be deployed publicly.

## Core Requirements

1. **Agent selection** — choose which CLI agent a session runs (Claude Code, Codex, Pi, …).
2. **Live streaming** — agent output appears in the browser token-by-token, with no buffering.
3. **Persistent sessions** — the agent process stays running; follow-up prompts go into the
   same session rather than starting a new one.
4. **Multiple sessions** — several agent sessions can exist side by side and be switched
   between.

## Architecture

The whole reason this needs more than a plain HTTP API route: these CLIs assume they are
attached to a real terminal (TTY). Run through plain `child_process`, they detect no TTY,
buffer their output, and may refuse interactive mode entirely.

```
Browser (Next.js + xterm.js)
      ↕  WebSocket  (prompts down, output up)
Node server  ──  node-pty  ──  claude / codex / pi CLI process
```

- **node-pty** — spawns each agent CLI inside a pseudo-terminal so the process believes it is
  in a real terminal and emits output unbuffered, in real time. One PTY process per session,
  kept alive across prompts.
- **WebSocket** (`ws` or Socket.IO) — bidirectional channel between browser and server.
  Input from the browser is written to the PTY's stdin; PTY output is pushed to the browser as
  it arrives. Plain HTTP request/response cannot hold an interactive session open, so a custom
  Node server process hosts both Next.js and the WebSocket endpoint.
- **xterm.js** — renders the raw stream in the browser. Agent output contains ANSI escape
  codes (colors, cursor movement, spinners); xterm.js interprets them instead of showing them
  as garbage characters.
- **Session registry** — server-side map of `sessionId → { pty, agent, cwd, buffer, completion }`.
  The optional client-safe session completion policy declares whether a session closes on exit and
  its success/failure notices; shared helpers apply it to the exit code on the server and in the
  console. The buffer holds recent output so a reconnecting or newly-opened browser tab can replay
  scrollback instead of seeing an empty screen. It is in-memory only; a server restart ends active
  sessions.

Project metadata is persisted separately in a git-ignored `data/projects.json` file. Each project has an optional persisted `slug`, used for `{{PROJECT_SLUG}}` when present. New projects either create `{defaultProjectPath}/{slug}` or use an inspected existing absolute directory. Newly created directories can be initialized as git repositories; existing repositories expose confirmed submodules as selectable application entries, with an optional root application. Each project
can own one or more applications, persisted separately in git-ignored `data/applications.json`; an
application has its own name and existing absolute working-directory path. Every registered Task carries a required `applicationId`; planning creates one Task per application while staying in the project directory, while task execution runs in the linked application's directory. Task creation is blocked for projects without applications, and a one-time migration deleted older application-less Task records without removing their Markdown files. Per-project workitems are persisted in git-ignored `data/workitems.json`, carry globally sequential integer ids
starting at `1`, include a lifecycle status (`open`, `task_creating`, `task_created`, `in_progress`, `completed`, or `cancelled`), optional completion timestamp, and same-project `dependencyIds`. A dependency is finished when it is `completed` or `cancelled`; otherwise it blocks the dependent workitem from starting a planning session. Workitems are listed in a semantic table with
server-side URL pagination and status filtering, and can be retained or removed when their
project is deleted. A planning session moves an `open` task to `plan_creating`; registering its
plan moves it to `plan_created`, while an unregistered planning session returning or exiting
moves it back to `open`. Plan registrations are stored in git-ignored `data/plans.json`, with an id,
projectId, taskId, title, filePath, summary, createdAt, and updatedAt; lifecycle events for newly created tasks and plans and actual status transitions are persisted independently in git-ignored `data/lifecycle-log.json`, with an event id, entity type/id, project id, previous and new status, and timestamp; they can be created,
edited (including project/task relinking), or deleted. The `/plans` list defaults to active plans and supports project and status filters. Registering a plan automatically moves its `open`, `plan_creating`, or `in_progress` task to `plan_created`; tasks already `plan_created`, `completed`, or `cancelled` are left unchanged. A plan's Markdown file is read from
`{project.path}/{plan.filePath}` for display only and is removed only when explicitly requested;
the composed planning prompt directs the agent to register the finished task file through `POST /api/plans`, then print a final plan and task summary line before exiting.
Session context records a project and task for planning sessions and additionally a plan for
execution sessions; it is retained with each in-memory session summary so the console can restore
contextual controls after a reload. Composed task-execution prompts instruct the agent to report
completion through `PATCH /api/tasks/{id}`, while the custom server marks an execution session's
task `executed` when that session exits. Global Task and Plan agent defaults plus the four global task-flow prompts are
persisted in git-ignored `data/settings.json`, alongside an extensible `remoteAccess.methods` list of enabled remote-access methods. Settings also keep `defaultProjectPath` (empty until configured) and `initializeGitInNewProjects` (true by default). The Projects settings screen controls these values; git initialization is offered only when a local git executable is available. When a prompt has no saved value, settings displays
the matching built-in prompt from `src/lib/default-prompts/` in muted text; these defaults are read
by the server-only `src/lib/default-settings-prompts.ts` module. Built-in and saved prompts may use
`{{PROJECT_NAME}}` and `{{PROJECT_SLUG}}`, which are resolved for the session's project during prompt
composition. The code-defined agent catalog lives in
`src/lib/agents.ts` and the prompt descriptors live in `src/lib/settings-prompts.ts`. The console selects a saved project, one of its applications, and its agent per new session (Codex
by default). Applicationless legacy projects fall back to their project path for ordinary console sessions, but planning and task creation are blocked until an application is added; task-execution sessions run in their task's linked application directory. The settings remain available for future task and plan flows. These files
survive server restarts; agent sessions remain in-memory only and end when the server restarts.
Project records can be edited or deleted from their detail page. Each project may carry an optional palette color token; projects without one derive a stable color from their id, and the project name is shown as a white-on-color chip wherever it appears in project, task, and plan screens. Creating a plan from a task composes the effective Task planning and After planning prompts (saved text when present, otherwise the built-in Markdown defaults) with that task's title and detail plus a code-defined language rule, then starts the configured Plan agent in the task's project directory through the console.

### Domain migration

The persisted work model uses **Workitems** for units of work and **Tasks** for registered Markdown task files. `data-migration.ts` performs an idempotent one-time migration of legacy `data/tasks.json` workitems into `data/workitems.json`, legacy `data/plans.json` task records into `data/tasks.json`, and lifecycle events to version 2. `/tasks` intentionally now means registered Tasks (it does not redirect); legacy `/plans` and project task URLs permanently redirect to their renamed routes.

## Open decisions

- Session persistence across a server restart (in-memory only vs. on disk).
- Console sessions run in the directory of a selected saved application, falling back to the project directory for applicationless legacy projects.
- Remote access ships with no authentication: the private tailnet is the boundary, while AgentHub continues to listen on every network interface.

## Tech Stack

Read from `package.json`; keep in sync when dependencies change.

- **Next.js** 16.3.4 (App Router — `src/app/`)
- **React** 19.2.8, with `babel-plugin-react-compiler` 1.0.0
- **TypeScript** ^5, **Tailwind CSS** ^4 (via `@tailwindcss/postcss`)
- **ESLint** ^9 with `eslint-config-next`
- **node-pty** 1.1.0, **ws** 8.21.3, and `@types/ws` 8.18.1
- **xterm.js** (`@xterm/xterm` 6.0.0, `@xterm/addon-fit` 0.11.0)
- **tsx** 4.23.13 runs the TypeScript custom server locally
- **pnpm** 10.6.5

### Commands

```bash
pnpm dev      # tsx watch server.ts (Next.js + WebSocket custom server)
pnpm build    # next build
pnpm start    # production custom server (NODE_ENV=production tsx server.ts)
pnpm lint     # eslint
```

### Next.js version caution

The installed Next.js is newer than most agents' training data and has breaking changes.
Before writing Next.js code, read the relevant guide under `node_modules/next/dist/docs/`.
The same rule is carried in the tool-managed `<!-- BEGIN:nextjs-agent-rules -->` block in
`AGENTS.md`, which `next dev` rewrites automatically — leave that block in place.

## Repository Structure

```
src/app/                         # Next.js application
├── api/projects/                 # Route Handlers for persisted project metadata and applications
│   ├── inspect-directory/         # Existing-directory git and submodule inspection
│   └── [id]/                     # Nested application and workitem Route Handlers
├── api/settings/                 # Route Handler for global agent defaults
├── api/plans/                    # Route Handlers for plan registrations and detail CRUD
│   └── [planId]/
│       └── task-prompt/route.ts  # Composes a registered plan's task-execution prompt
├── console/                      # Multi-session console route and colocated client components
│   ├── use-plan-execution.ts     # Tracks plan execution and task/plan close-out
│   ├── use-plan-run.ts           # Starts a plan session from task URL parameters
│   ├── session-completion-modal.tsx # Accessible exit-notice modal driven by a session completion policy
│   ├── use-setup-run.ts          # Starts an allowlisted remote-access setup session from a URL parameter
│   └── use-task-run.ts           # Starts a task-execution session from a plan URL parameter
├── projects/                     # Projects list, creation, and detail routes
│   ├── page.tsx                  # Projects list page
│   ├── project-color-picker.tsx  # Shared project color picker and chip preview
│   ├── new/new-project-form.tsx  # Interactive two-mode project creation form
│   └── [id]/                     # Editable project detail and task-detail routes
│       └── tasks/                # Detail routes; list and creation redirect to /tasks
├── settings/                     # Global agent defaults, project, remote-access, and task-flow prompt settings
│   ├── projects/                 # Default project directory and git initialization settings
│   └── remote-access/            # Tailscale status and remote-access controls
├── tasks/                        # Global task list, project filter, and unified task creation
├── plans/                        # Global plan list, creation, and detail routes
│   ├── [planId]/                 # Editable plan detail and read-only file preview
│   └── new/                      # Manual plan registration form
├── agent-console.tsx             # Client console UI
├── project-chip.tsx              # Shared colored and unknown project-name chips
└── page.tsx                      # Header-only home page
src/lib/
├── agents.ts                     # Client-safe selectable agent catalog
├── agent-protocol.ts             # WebSocket session protocol shared by client and server
├── default-prompts/              # Built-in task-flow prompt Markdown files
├── default-settings-prompts.ts   # Server-only built-in prompt reader
├── prompt-tokens.ts              # Client-safe project prompt token resolution
├── remote-access.ts              # Client-safe remote-access method and setup-action catalogs
├── session-completion.ts         # Shared session exit-policy types, validation, and outcome helpers
├── tailscale.ts                  # Server-only Tailscale CLI discovery and status probe
├── git.ts                        # Server-only git availability, repository, and submodule helpers
├── applications-store.ts         # Persisted per-project application records
├── plans-store.ts                # Persisted editable plan records
├── plan-file.ts                  # Server-only safe plan file reader/deleter
├── project-colors.ts             # Client-safe palette tokens and deterministic project colors
└── settings-store.ts             # Persisted global settings store
server/
├── agents.ts                     # Server-only CLI command definitions
├── setup-commands.ts             # Allowlisted remote-access setup command definitions
├── tailscale-cli.ts              # Shared server-side Tailscale CLI resolver
├── git-cli.ts                    # Shared server-side git CLI resolver
└── session-registry.ts           # In-memory concurrent PTY session registry
data/                             # Runtime JSON database (git-ignored: projects.json, applications.json, tasks.json, plans.json, lifecycle-log.json, settings.json)
.agent/
├── PROJECT_DOCUMENT.md          # this file
├── commands/tasks/              # plan, do-task, do-task-post, common-plan-doc
├── scripts/archive-task.sh      # moves a finished task into tasks-archived/
├── tasks/                       # active task files
└── tasks-archived/              # completed tasks, kept as a decision log
```

## Task Workflow

Work is planned into task files before it is implemented — spec first, then code.

1. **Plan** — `.agent/commands/tasks/plan.md` writes a self-contained task file under
   `.agent/tasks/`. Planning never changes source code.
2. **Execute** — `.agent/commands/tasks/do-task.md` runs a task file, a GitHub issue number,
   or a direct prompt, verifying against `pnpm build` / `pnpm lint`.
3. **Close out** — `.agent/commands/tasks/do-task-post.md` archives the task, comments on the
   related GitHub issue, audits touched files against the 600-line rule, and suggests commit
   messages.

Task-file prose, plan titles, and plan summaries are written in the language inferred from the task title and detail, unless the task explicitly requests another language. Markdown section headings, the `Root application` line, lowercase kebab-case English file names, file paths, commands, and code identifiers remain in English.

Note: `archive-task.sh` expects an `apps/{APP_NAME}/...` path and refuses anything else, so
tasks in `.agent/tasks/` are archived by hand into
`.agent/tasks-archived/{YYYY}/{MM}/{DD}/`.

## Delivered session capabilities

- Agent selection (Codex, Claude Code, or Pi) is available per new console session. The prompt form appears below the terminal card and is hidden by default when a session is selected; it opens by default when starting a new session. Contextual sessions show their task or plan title beneath the project name, and the project path is available through an accessible session-information control.
- Multiple concurrent sessions can run, be selected from the console sidebar, and retain their
  individual in-memory scrollback until dismissed after exit. Sessions may declare a completion
  policy that closes them on a successful or any exit and shows its parameterized success or
  failure notice in an accessible console modal. Allowlisted remote-access setup sessions run in
  the same PTY terminal, accept interactive input such as `sudo`, and close after successful setup
  with a modal that links back to remote-access settings; failed setup sessions remain available
  with their output and report the exit code.
- Settings includes a **Remote access** screen with an extensible method catalog. Its Tailscale method detects installation and tailnet connection status, shows tailnet URLs when connected, and starts visible install or connect setup sessions when needed. AgentHub adds no authentication for tailnet access.
- Every project has a persisted task list with server-side URL pagination; project deletion can
  explicitly remove its tasks or leave them in place.
- Tasks can start a new console session for planning; the session uses the configured Plan agent
  and effective planning/after-planning prompts, with the composed multi-line first prompt passed
  to the agent CLI as a startup argument. Follow-up prompts are pasted into the running session.
  When its agent exits, the plan session closes and is removed automatically.
- Plans carry a persisted execution status (`registered`, `executing`, `executed`, `completed`,
  or `cancelled`); the `/plans` list defaults to active plans and supports project and status filters. Their status can also be changed manually from the plan detail page. The
  **Execute plan** action starts the configured Task agent with effective task
  execution/after-task prompts and advances the plan to `executing`. Execution sessions remain
  available with their scrollback after the agent exits; the console marks the plan `executed`
  and offers to complete the plan and its task. The console also provides a **Complete task**
  action during a selected execution session after its agent has exited, which completes both
  records and removes the session from the session list. Planning sessions carry project/task
  context and execution sessions additionally carry their plan identifier in the in-memory server
  session registry, so contextual information and execution controls survive reloads and other
  browser tabs; a server restart removes this information together with the sessions.
- A single `/tasks` screen provides a server-rendered, cross-project task table with pagination and optional project and status filters; it defaults to open tasks, which can be completed and reopened from the list or detail page. A workitem in `Task created` offers an **Execute task** action on both the `/workitems` list and workitem detail page, which runs its latest registered task in the console. The **Create task** action opens the planning console for the workitem; it is hidden once the workitem is in `Task creating` or `Task created`, or once it has at least one registered task. A workitem with registered tasks instead offers **Delete tasks**, which confirms inline and then removes every task record for that workitem together with its Markdown file on disk, returning a `Task creating` or `Task created` workitem to `Open` (other statuses are left alone) so **Create task** becomes available again. Planning moves an open task to Plan creating, plan registration moves open, plan-creating, and in-progress tasks to Plan created, and an unregistered planning session returns its task to Open; already planned, completed, and cancelled tasks remain unchanged. Task changes are broadcast over the agent WebSocket so open `/tasks` lists refresh live. `/tasks/new` creates tasks for any saved project. Per-project list and creation URLs redirect to these unified screens.
- The `/plans` screen lists active plans across projects by default, with pagination plus project and status filters. Plans can be registered by hand, viewed and edited on a detail page, and deleted with optional removal of the plan file from disk. Every completed planning session automatically registers its final task file through `POST /api/plans` before its agent exits.
- Projects are color-coded across project, task, plan, and lifecycle-log screens, with a palette color chosen on project create and detail forms.
- The main navigation includes **Logs**, which opens `/logs` to show persisted task and plan lifecycle events newest first. The screen paginates events, resolves project chips and extant record links when possible, and safely reports unavailable or malformed lifecycle-log data.

## Code Readability

Keep code easy to scan and review. Do not compress multi-step logic, callbacks, or method
bodies into a single long line merely to make the file shorter. Use conventional line breaks,
indentation, and intermediate statements where they make control flow and side effects clear.
When modifying or encountering existing densely packed one-line code, reformat it into readable
multi-line code when doing so does not change behavior.

## Agent Harness Configuration

Commands are defined **once** in `.agent/commands/tasks/`. Each harness directory holds only a
thin pointer to them — never a second copy of a command.

| Harness | Pointer files |
| --- | --- |
| Claude Code | `.claude/commands/tasks/plan.md`, `.claude/commands/tasks/do-task.md` |
| Codex | `.agents/skills/plan/SKILL.md`, `.agents/skills/do-task/SKILL.md` |

Root pointer files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`) do one thing: send the agent here.
Project knowledge belongs in this file, not in them.
