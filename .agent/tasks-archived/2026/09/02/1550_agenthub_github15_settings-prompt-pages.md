# Global settings: sidebar navigation and four task-prompt pages

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

Turn `/settings` from a single narrow form into a settings area with a **left-hand navigation
column** and **five destinations**: the existing agent defaults plus **four new full-width
prompt pages**, one per task prompt.

The four prompts are global (not per-project) and are stored as free-form text in
`data/settings.json` next to the existing `taskAgent` / `planAgent` values:

| Nav item | Route | Settings field |
| --- | --- | --- |
| Agents | `/settings` | `taskAgent`, `planAgent` (existing) |
| Task planning prompt | `/settings/prompts/plan` | `planPrompt` |
| After planning prompt | `/settings/prompts/plan-post` | `planPostPrompt` |
| Task execution prompt | `/settings/prompts/task` | `taskPrompt` |
| After task prompt | `/settings/prompts/task-post` | `taskPostPrompt` |

Each prompt page holds one large `<textarea>` that fills the available width and a good part of
the viewport height, plus its own save button. Nothing consumes these prompts yet — this task
only defines, persists and edits them, the way `taskAgent` / `planAgent` were introduced before
any flow used them.

## Application

Root application (`agenthub`) — single Next.js app in `src/`. No `apps/` subdirectory exists.

## GitHub Issue

- Issue #15 ("prompt ayarları")

Original request (Turkish): project task prompts should be definable in the global settings as
text areas; the settings screen should have buttons on the left side; prompts may take up the
whole page. The four prompts are: task planning prompt, prompt to run after task planning
finishes, task execution prompt, prompt to run after the task is finished.

## Dependencies

None - This task is independent

## Context

### Decisions confirmed with the user before planning

| Question | Decision |
| --- | --- |
| Page structure | **Four real routes**, one per prompt — not client-side tabs. The left column uses `<Link>` navigation and highlights the active route. |
| Where agent defaults live | The existing Task/Plan agent selects stay as their **own nav item** (the first one), at `/settings`. |
| Initial values / missing fields | Prompts **start empty and empty is valid**. A `data/settings.json` that predates this change (no prompt keys) must load as empty prompts — never an error. |

### Current state

- `src/lib/settings-store.ts` — `Settings = { taskAgent, planAgent }`, JSON file at
  `data/settings.json`, writes serialized through a `writeQueue` promise chain. `parseDocument`
  is strict: a non-string or unknown agent id throws `SettingsStoreError`.
- `src/app/api/settings/route.ts` — `GET` returns the settings, `PUT` replaces them wholesale
  via `saveSettings` (which validates **both** agents as required).
- `src/app/settings/page.tsx` — server component, `max-w-2xl`, renders header + `SettingsForm`.
- `src/app/settings/settings-form.tsx` — client component, holds both selects, `PUT`s the whole
  document, then `router.refresh()`.
- The only links into settings are the "Settings" buttons on `src/app/page.tsx` (line ~19) and
  `src/app/projects/page.tsx` (line ~80). Both point at `/settings` and stay correct.
- Existing local `data/settings.json` currently contains only `taskAgent` and `planAgent` — this
  is exactly the backward-compatibility case above.

### Why `saveSettings` has to change

Each prompt page saves **one field**. If a prompt page `PUT`s only `{ planPrompt }`, today's
`saveSettings` rejects it ("Task and Plan agents are required."), and if it instead sent the
whole document, two pages open in two tabs would clobber each other's edits. So the store must
accept a **partial** update and merge it onto the stored document — and the read-modify-write
must happen **inside** the serialized write, not before it, or concurrent saves race.

### Next.js version caution

The installed Next.js (16.3.4) is newer than most agents' training data. Before adding a nested
layout, a `usePathname()`-based nav, or new route segments, read the relevant guide under
`node_modules/next/dist/docs/`. Note that `layout.tsx` in this repo is typed with the generated
`LayoutProps<"/">` helper (see `src/app/layout.tsx`) — follow the same convention for the new
settings layout (`LayoutProps<"/settings">`).

## Acceptance Criteria

### Store and API

- [ ] `Settings` gains four `string` fields: `planPrompt`, `planPostPrompt`, `taskPrompt`,
      `taskPostPrompt`.
- [ ] `defaultSettings()` returns `""` for all four prompts.
- [ ] Reading a `data/settings.json` that has **no** prompt keys succeeds and yields empty
      prompts (verified against the existing file, which has only the two agent keys).
- [ ] A prompt key present but not a string is treated as invalid and raises
      `SettingsStoreError`, matching how the agent fields already behave.
- [ ] `saveSettings` accepts a **partial** object: any subset of the six fields. Absent keys keep
      their stored value; the merge happens inside the serialized write so concurrent saves do
      not lose each other's changes.
- [ ] A present agent field must still be a valid agent id (`SettingsValidationError` otherwise);
      a present prompt field must be a string — **empty string is accepted** — and is rejected
      with a `SettingsValidationError` if it exceeds 20 000 characters.
- [ ] `PUT /api/settings` accepts a partial body and returns the complete merged settings.
      Unknown keys in the body are ignored. `GET` returns all six fields.

### Settings shell

- [ ] `src/app/settings/layout.tsx` renders the shared chrome once: `BrandLink`, the "Projects"
      link, the `Settings` heading and its description, then a two-column body — nav on the left,
      page content on the right. The container widens (e.g. `max-w-6xl`) so prompts get room.
- [ ] The nav lists the five destinations from the table above, in that order, and marks the
      current one as active (distinct background/text plus `aria-current="page"`). It is a client
      component using `usePathname()`; `/settings` must be matched exactly so it does not stay
      highlighted on the prompt routes.
- [ ] On narrow screens the nav stacks above the content instead of squeezing it.
- [ ] `/settings` still shows the Task/Plan agent selects and keeps working exactly as before.

### Prompt pages

- [ ] Four route segments exist: `src/app/settings/prompts/{plan,plan-post,task,task-post}/page.tsx`.
      Each is a thin server component that reads the settings and delegates to one shared
      component, so the four pages do not duplicate form logic.
- [ ] Each page shows its own title and a one-line description of when that prompt runs, a
      `<textarea>` that spans the full content width and is tall (roughly 55–65vh, vertically
      resizable, monospace via the existing `--font-geist-mono` / `font-mono`), and a save button.
- [ ] Saving `PUT`s only that page's field, shows "Settings saved." on success and the API's
      error message on failure, mirroring the states already in `settings-form.tsx`
      (`role="alert"` / `role="status"`, disabled-while-submitting), then `router.refresh()`.
- [ ] Reloading the page shows the saved text; saving an empty textarea is allowed and clears the
      stored value.
- [ ] Read failures degrade like the existing page does: the error banner renders and the form
      still shows (with empty content) rather than the route crashing.

## Technical Notes

- Put the prompt descriptors in one **client-safe** module (e.g. `src/lib/settings-prompts.ts`)
  as an `as const` array of `{ slug, field, navLabel, title, description }`, the way
  `src/lib/agents.ts` models the agent catalog. Both the nav and the four pages read from it, so
  labels and routes are declared once. Derive the field union from that array rather than
  re-typing the four keys.
- Keep the shared prompt form in `src/app/settings/prompts/prompt-form.tsx` (client component)
  taking `{ field, value }`; each page passes its descriptor plus the stored value.
- Do **not** trim prompt text. Leading/trailing newlines and indentation are meaningful in a
  prompt; store what the user typed verbatim.
- `data/settings.json` is git-ignored; do not commit it, and do not hand-edit it as part of this
  task — the app writes it.
- File-size rule from `do-task.md`: keep every touched file under 600 lines. Splitting the shell
  into `layout.tsx` + `settings-nav.tsx` + `prompt-form.tsx` already satisfies this; don't fold
  them back together.
- Reuse the existing visual language (`bg-[#f4f6fa]`, `rounded-xl`, `border-slate-200`,
  `focus:ring-3 focus:ring-sky-100`, sky-700 primary button). No new dependencies.
- After the change, update `.agent/PROJECT_DOCUMENT.md`: the settings paragraph under
  "Architecture" (which currently says only agent defaults are persisted) and the
  `src/app/settings/` entry in "Repository Structure".

## Verification

- `pnpm build` completes with no compilation or type errors.
- `pnpm lint` passes; fix anything it reports.
- `pnpm dev`, then manually confirm:
  - `/settings` shows the left nav with five items, "Agents" active, and the agent selects still
    save.
  - Each of the four prompt routes loads, marks its own nav item active, saves text, and shows
    that text again after a reload.
  - Saving a prompt does **not** reset `taskAgent` / `planAgent` in `data/settings.json`, and
    saving the agents does not wipe the prompts.
  - Starting from a `data/settings.json` containing only the two agent keys, every settings page
    loads without an error banner.
