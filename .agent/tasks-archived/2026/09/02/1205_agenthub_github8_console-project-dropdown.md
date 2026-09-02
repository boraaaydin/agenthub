# Replace the console's working-directory input with a project dropdown

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

On `/console`, a new session is started by typing a raw filesystem path into a free-text
**Working directory** input (`src/app/console/agent-console.tsx`, the `cwd` state). Projects
already persist a validated `path` in `data/projects.json`, so the free-text input duplicates
that data and lets the user start a session in a directory that is not a known project.

After this task:

- The free-text **Working directory** input is **gone** from the console. There is no way to
  type an arbitrary path any more.
- In its place, a **Project** `<select>` dropdown lists the saved projects by name. The
  selected project's `path` becomes the `cwd` sent in the `start` message.
- When no projects exist, the dropdown is replaced by a short explanatory line and a link to
  `/projects/new`; the start button stays disabled.
- `/console?projectId={id}` preselects that project, and the project detail page's
  "Open console" button links there.
- The header for an existing session shows the matching **project name** with its path
  underneath, falling back to the raw path when no project matches.

Decisions already made with the user (do not re-litigate them):

- **Data loading**: `AgentConsole` fetches `GET /api/projects` on mount from the client. Do
  **not** convert `src/app/console/page.tsx` into an async server component and do not pass
  projects in as a prop.
- **Empty state**: message plus a link to `/projects/new` — not a disabled empty dropdown.
- **Deep link**: add `?projectId=` support and repoint the project detail page's "Open
  console" link at `/console?projectId={project.id}`.
- **Session header**: show project name + path, with the raw path as the fallback.

## Application

Root application (`agenthub`) — single Next.js app in `src/`. No `apps/` subdirectory exists.

## GitHub Issue

- Issue #8 — "console sayfasında path input olmasın" (the console page should not have a path
  input; there should be a project selection dropdown instead)

## Dependencies

None - This task is independent.

## Context

### Files to change

| File | Change |
| --- | --- |
| `src/app/console/agent-console.tsx` | Remove the `cwd` free-text input and state; add project loading, the `Project` dropdown, the empty state, `?projectId=` preselection, and the project-name session header. |
| `src/app/projects/[id]/project-detail.tsx` (~line 125) | `href="/console"` → `href={`/console?projectId=${project.id}`}`. |
| `.agent/PROJECT_DOCUMENT.md` | Update the console description: sessions now pick a saved project rather than an arbitrary directory. |

### Current console behaviour (what you are editing)

`src/app/console/agent-console.tsx` is a `"use client"` component, ~347 lines:

- `const [cwd, setCwd] = useState("")` (line ~19) holds the typed path.
- `canStart` (line ~152) requires `cwd.trim().length > 0 && prompt.trim().length > 0`.
- `submitPrompt` (line ~184) guards with `if (!cwd.trim())` → error
  `"Enter a working directory before starting a session."`, then sends
  `{ type: "start", agent, cwd, cols, rows }`.
- The new-session `<section aria-label="New session controls">` renders a
  `grid sm:grid-cols-[minmax(0,1fr)_12rem]` with the **Working directory** `<input>` on the
  left and the **Agent** `<select>` on the right, plus the caption
  `"The directory is checked before {agent} starts."`.
- The existing-session `<section>` renders `<h2>{activeAgent?.label}</h2>` and
  `<p className="mt-1 font-mono text-sm text-slate-600">{activeSession.cwd}</p>`.

### Project data

`GET /api/projects` (`src/app/api/projects/route.ts`) returns `Project[]` as JSON, or
`{ error: string }` with status 500 when `data/projects.json` cannot be read. The `Project`
type lives in `src/lib/projects-store.ts`:

```ts
export type Project = { id: string; name: string; path: string; createdAt: string };
```

`src/lib/projects-store.ts` imports `server-only`, so the client component must **not** import
it for values. Importing the `Project` **type** is fine only via a type-only import
(`import type { Project } from "@/lib/projects-store"`), which is erased at compile time; if
that proves awkward, declare a local `type ConsoleProject = { id: string; name: string; path: string }`
instead.

Paths in the store are already absolute and directory-validated at create/update time
(`path.resolve` + `fs.stat`), so the console does not need to re-validate the selected path.
The server still validates `cwd` when starting a session — leave that as is.

### Session protocol

`src/lib/agent-protocol.ts` carries the `ClientMessage` / `SessionSummary` shapes. **Do not
change the protocol**: `start` keeps sending a `cwd` string, and `SessionSummary` keeps its
`cwd` field. Only the source of that string changes (project path instead of typed text). The
project-name session header is a pure client-side lookup of `activeSession.cwd` against the
loaded project list.

## Acceptance Criteria

- [ ] The free-text working-directory `<input>` no longer exists anywhere in
      `src/app/console/agent-console.tsx`; the `cwd` text state is removed.
- [ ] A **Project** `<select>` renders in the new-session controls, with an associated
      `<label htmlFor>`, listing every saved project by `name` (`value` = project `id`),
      keeping the existing input styling (`h-11 w-full rounded-xl border border-slate-300 …`).
- [ ] The **Agent** dropdown stays where it is; the two controls remain side by side on `sm`
      and above.
- [ ] Starting a session sends the **selected project's `path`** as `cwd` in the `start`
      message.
- [ ] While projects are loading, the start button is disabled (no flash of a wrong or empty
      selection); a failed `GET /api/projects` surfaces a readable message in the existing
      `role="alert"` error area or next to the dropdown, and does not crash the console.
- [ ] With zero projects, the dropdown is replaced by an explanatory line and a link to
      `/projects/new`, and the start button is disabled. Nothing sends a `start` message.
- [ ] `/console?projectId={id}` preselects the matching project. An unknown or missing
      `projectId` falls back to the first project in the list without an error.
- [ ] The project detail page's "Open console" button links to `/console?projectId={id}`.
- [ ] For an existing session, the header shows the project name matching
      `activeSession.cwd`, with the path beneath it in mono text; when no project matches, the
      path alone renders exactly as it does today.
- [ ] Existing behaviour is untouched: session sidebar, scrollback replay, follow-up prompts,
      stop/dismiss, agent selection, and the terminal.
- [ ] `pnpm build` and `pnpm lint` both pass.
- [ ] `.agent/PROJECT_DOCUMENT.md` reflects that console sessions run in a selected project's
      directory.

## Technical Notes

- **Next.js version caution**: the installed Next.js (16.3.4) is newer than most training
  data. Read the relevant guide under `node_modules/next/dist/docs/` before writing Next.js
  code — in particular for `useSearchParams` in a client component.
- **Reading `?projectId=`**: `useSearchParams()` from `next/navigation` requires the component
  to sit under a `<Suspense>` boundary at build time or the static prerender of `/console`
  fails. The cheapest fix is to wrap `<AgentConsole />` in `<Suspense>` inside
  `src/app/console/page.tsx`; alternatively read the param once on mount from
  `window.location.search`. Whichever you choose, confirm `pnpm build` stays clean — this is
  the most likely place for this task to break the build.
- Preselection should run **once**, when the project list first arrives, and must not fight
  the user's later manual selection. Follow the existing `selectionInitializedRef` /
  `useRef` guard idiom already used in this file for one-shot initialization rather than
  adding a `useEffect` that re-syncs state on every render.
- Keep state minimal: store the selected **project id** and derive the project object (and its
  `path`) from the loaded list, rather than duplicating the path into another state variable.
- Path matching for the session header is an exact string comparison against `project.path`.
  Store paths are already `path.resolve`d and sessions are started from them, so no
  normalization is needed. Do not over-engineer this with trailing-slash or case handling.
- Sessions started before a project was renamed/deleted must still render; always fall back to
  `activeSession.cwd`.
- Fetch projects with an `AbortController` cleanup in the `useEffect` so a fast unmount does
  not set state on an unmounted component, matching the async patterns used elsewhere in the
  app's client components.
- Update the caption under the controls: `"The directory is checked before {agent} starts."`
  no longer describes anything the user typed — replace it with wording about the selected
  project (or drop it) rather than leaving a stale sentence.
- Keep `src/app/console/agent-console.tsx` within the project's 600-line file guideline. It is
  ~347 lines today; if the additions push it near the limit, extract the new-session controls
  into a colocated component (e.g. `src/app/console/new-session-controls.tsx`) alongside the
  existing `session-sidebar.tsx` / `session-terminal.tsx`.
- Do **not** add a project field to the session registry, the WebSocket protocol, or
  `data/projects.json`. This is a UI-layer change.

## Verification

- `pnpm build` — must complete with no type errors and no prerender failure on `/console`.
- `pnpm lint` — must pass with no errors; fix anything reported.
- Manual check with `pnpm dev`:
  1. `/console` with at least one saved project — the Project dropdown lists them, no path
     input is present, and a prompt starts a session in the selected project's directory
     (verify with a prompt like `pwd`).
  2. `/console?projectId={id}` — that project is preselected.
  3. Project detail → "Open console" — lands on the console with that project preselected.
  4. Temporarily move/rename `data/projects.json` (restore it afterwards) — the empty state
     shows the `/projects/new` link and the start button is disabled.
  5. A running session's header shows the project name with its path underneath.
- No automated test suite exists in this repository; do not add one for this task.
