# Default project directory setting, slug-based project creation, and git initialization

---
**Execution Guidelines**: Before starting this task, ensure you've read `.agent/commands/tasks/do-task.md` (if not already read in this session). This file contains essential guidelines on how to properly execute tasks, including dependency checking, verification steps, and archival procedures.

**Application-specific documentation**: This task targets the root application, so read `.agent/PROJECT_DOCUMENT.md` before starting. There is no `apps/` directory in this repository; the project document at `.agent/PROJECT_DOCUMENT.md` is the application document for this task.

When this task file is read standalone, the agent should:
1. Check if `do-task.md` has been read in the current session
2. If not, read it first to understand the execution workflow
3. Read `.agent/PROJECT_DOCUMENT.md` before starting the task
4. Then proceed with this specific task
---

## Description

GitHub issue #31 asks for a default project directory in global settings and a reworked
**New project** flow built on top of it.

The work has four parts:

1. **New settings section** — a `Projects` settings page holding a **default project directory**
   and an **Initialize git in new projects** toggle (on by default). The git toggle is only shown
   when a `git` executable is available on this machine.
2. **First-run prompting** — while the default project directory is unset, the app points the user
   to that settings page instead of silently proceeding.
3. **Reworked project creation** — the user types a project name, a slug is derived automatically,
   and the working directory is composed from the default directory. The form offers two modes:
   **Create new directory** and **Use an existing directory**.
4. **Existing-directory inspection** — an existing directory is probed for a git repository and for
   git submodules. A non-repository offers git initialization; discovered submodules are listed and
   the selected ones become the project's applications.

### Decisions already made with the user while planning

These were resolved during planning and must not be re-opened:

- **Settings location**: a **new** `/settings/projects` page with its own settings-nav entry. The
  existing `/settings` (Agents) page keeps only the agent selections.
- **First-run behavior**: **no forced full-app redirect**. While the default project directory is
  unset, show a persistent notice that links to `/settings/projects`, and disable the
  *Create new directory* mode in the new-project form until a default directory is saved.
  *Use an existing directory* stays usable without the setting.
- **Slug**: persisted on the project record as an optional `slug` field, used as the created folder
  name and as the `{{PROJECT_SLUG}}` prompt token value when present.
- **Submodules**: discovered submodules are **listed with checkboxes** for the user to confirm, not
  added silently. The user can also choose whether the repository root itself is registered as an
  application.

## Application

Root application (`agenthub`)

## GitHub Issue

- Issue #31

## Dependencies

None - This task is independent.

## Context

### Relevant existing code

- `src/lib/settings-store.ts` — persisted global settings (`data/settings.json`). Holds
  `taskAgent`, `planAgent`, the four prompt fields, and `remoteAccess.methods`. New settings fields
  go here, with matching `defaultSettings()`, `parseDocument()` and `settingsDetails()` handling.
- `src/app/api/settings/route.ts` — `GET`/`PUT` for settings; no change needed beyond what the store
  validates.
- `src/app/settings/settings-nav.tsx` — settings section list; a `Projects` entry is added here.
- `src/app/settings/remote-access/page.tsx` + `remote-access-form.tsx` — the existing pattern for a
  settings sub-page: a server page reads state and passes it into a `"use client"` form.
- `src/lib/tailscale.ts` + `server/tailscale-cli.ts` — the existing pattern for probing a CLI from
  the server (`execFile` with a timeout, a candidate-path resolver, a cached resolution). Git
  detection follows the same shape.
- `src/app/projects/new/page.tsx` — today a single `"use client"` page. It must become a server page
  that reads settings plus git availability and renders a client form component, following the
  `src/app/tasks/new/page.tsx` + `new-task-form.tsx` split.
- `src/app/api/projects/route.ts` — `POST` creates the project, then creates one application from
  the request's `application` field (falling back to the project name/path), rolling the project
  back if application creation fails. This must grow to support multiple applications and the new
  creation options.
- `src/lib/projects-store.ts` — `Project` type, `projectDetails()` validation, `validateDirectory()`
  (which today requires the directory to already exist), and `createProject()`.
- `src/lib/applications-store.ts` — `createApplication(projectId, input)` with `name` and `path`.
- `src/lib/prompt-tokens.ts` — `slugify()` and `projectSlug()`; the slug rules already implemented
  here (NFD normalization, Turkish `ı` handling, non-alphanumerics to `-`) must be reused, not
  duplicated.

### Architecture considerations

- Everything runs locally on the developer's machine, so creating directories and running `git` from
  the server is acceptable — but every path must be validated before use.
- `data/settings.json` is git-ignored and may be missing or partially written by older versions; the
  store must tolerate an absent `projects` settings block and fall back to defaults.
- `data/projects.json` may already contain projects without a `slug`; parsing must keep working for
  them.

## Acceptance Criteria

### Settings

- [ ] `Settings` type carries a default project directory (`defaultProjectPath: string`, empty when
      unset) and an initialize-git flag (`initializeGitInNewProjects: boolean`, default `true`).
- [ ] `defaultSettings()` returns `defaultProjectPath: ""` and `initializeGitInNewProjects: true`.
- [ ] `parseDocument()` accepts settings files that lack both fields and returns the defaults for
      them; invalid types raise `SettingsStoreError`.
- [ ] `settingsDetails()` validates both fields: the path must be a string, and when non-empty it is
      trimmed and resolved to an absolute path; the flag must be a boolean. Invalid input raises
      `SettingsValidationError` with a user-facing message.
- [ ] Saving a non-empty default project directory that does not exist, or that is not a directory,
      is rejected with a clear message.
- [ ] A `/settings/projects` page exists, is listed in `settings-nav.tsx` as `Projects` (placed
      after `Agents`), and saves through the existing `PUT /api/settings`.
- [ ] The page shows the default project directory field, and shows the
      **Initialize git in new projects** checkbox **only when git is available** on this machine.
      When git is unavailable the page explains that git was not found and the option is hidden.

### First-run prompting

- [ ] While `defaultProjectPath` is empty, the new-project screen shows a notice linking to
      `/settings/projects`, and the **Create new directory** mode is unavailable (disabled with an
      explanation) while **Use an existing directory** remains usable.
- [ ] Once a default project directory is saved, the notice disappears and both modes are available.

### Project creation form

- [ ] The new-project form offers two mutually exclusive modes: **Create new directory** and
      **Use an existing directory**.
- [ ] In both modes the user types a project name and a slug is derived from it automatically and
      shown; the user can override the slug, and manual edits are preserved when the name changes
      afterwards (same "edited" flag pattern already used for the application fields).
- [ ] In **Create new directory** mode the target directory is displayed as
      `{defaultProjectPath}/{slug}` and is not typed by hand.
- [ ] In **Use an existing directory** mode the user enters an absolute path, which is inspected
      (see below) before the project is created.
- [ ] Client-side validation blocks submission with an empty name, an empty slug, or (in existing
      mode) an empty path.

### Existing-directory inspection

- [ ] A server route inspects a candidate directory and reports: whether it exists and is a
      directory, whether git is available, whether the directory is a git repository, and the list
      of git submodules it declares (name plus repository-relative path).
- [ ] When the inspected directory is not a git repository and git is available, the form offers an
      **Initialize a git repository here** option, default off, whose label makes clear the
      repository will be created inside the chosen directory.
- [ ] When submodules are found, they are listed with checkboxes (all selected by default) plus a
      separate **Also add the repository root as an application** checkbox (default on only when no
      submodule is selected).
- [ ] Inspection failures (missing directory, permission error, malformed `.gitmodules`) are shown
      as a form-level message and do not crash the page.

### Project creation API and stores

- [ ] `Project` gains an optional `slug` field; existing project records without it keep loading,
      and `updateProject()` leaves an existing slug intact when the request omits it.
- [ ] `POST /api/projects` accepts the creation mode, the slug, the git-initialization choice, and a
      list of applications (`[{ name, path }]`), while remaining compatible with the current single
      `application` payload.
- [ ] In create mode, the server composes `{defaultProjectPath}/{slug}` itself from the saved
      settings — it does not trust a client-supplied absolute path for that mode — creates the
      directory, and fails with a clear message if it already exists or cannot be created.
- [ ] Git is initialized in the new or existing directory when requested and git is available; a
      failed `git init` is reported as an error and does not leave a half-registered project.
- [ ] Each selected submodule is created as its own application with the submodule name and its
      absolute path; the repository root becomes an application when the user asked for it.
- [ ] When no applications are selected, the current fallback (one application named after the
      project, at the project path) still applies, so the project always has at least one
      application.
- [ ] All existing rollback behavior is preserved: if application creation fails, the project record
      is removed. A directory that this request created is also removed on rollback; a directory
      that already existed is never deleted.
- [ ] `{{PROJECT_SLUG}}` resolves to the persisted slug when the project has one, and otherwise
      falls back to today's derivation from the name/path.

### Documentation

- [ ] `.agent/PROJECT_DOCUMENT.md` is updated to describe the new settings fields, the project
      `slug` field, the two-mode project creation flow, git initialization, and submodule-based
      application registration, and lists any new files in the repository-structure section.

## Technical Notes

### Git availability and probing

- Add a server-only git helper mirroring `server/tailscale-cli.ts` /`src/lib/tailscale.ts`:
  a resolver that finds a runnable `git` (honoring a `GIT_CLI` environment override, then `git`,
  then common absolute paths) and caches the result, plus probe functions used by the pages and API
  routes.
- Use `execFile` from `node:child_process` with `promisify` and an explicit timeout, never a shell
  string, so paths with spaces cannot be misinterpreted.
- Repository detection: `git -C <path> rev-parse --is-inside-work-tree` (treat a non-zero exit as
  "not a repository"). Note this reports `true` for a directory *inside* an outer repository — the
  form copy should therefore describe the result rather than promise the directory is a repository
  root. `git -C <path> rev-parse --show-toplevel` gives the actual root and is useful for that copy.
- Submodule discovery: prefer
  `git -C <path> config --file .gitmodules --get-regexp "^submodule\\..*\\.path$"`, which yields
  `submodule.<name>.path <relative path>` lines. A missing `.gitmodules` exits non-zero — treat that
  as "no submodules", not an error. Resolve each relative path against the repository directory and
  drop entries that escape it or do not exist on disk.
- Initialization: `git -C <path> init`. Do not create commits, add remotes, or touch git config.

### Directory creation

- Create the new project directory with `fs.mkdir(target, { recursive: false })` so an existing
  directory produces `EEXIST` rather than silently reusing someone else's folder; surface that as
  "A directory with this name already exists." Ensure the parent (`defaultProjectPath`) exists and
  is a directory first.
- `projectDetails()` in `projects-store.ts` currently resolves and requires an existing directory
  via `validateDirectory()`. Keep that guarantee for the stored record: create the directory in the
  API route *before* `createProject()` runs, so the store's existing validation still holds and does
  not need to be weakened.
- Guard against path traversal in the slug: the slug must match `^[a-z0-9]+(?:-[a-z0-9]+)*$` before
  it is joined onto the default directory, and the resolved target must stay inside the default
  directory (`path.resolve(target).startsWith(path.resolve(defaultProjectPath) + path.sep)`).

### Slug derivation

- Export the existing `slugify()` from `src/lib/prompt-tokens.ts` (it is already client-safe) and
  reuse it in the form and in server-side validation. Do not write a second slug implementation.
- `projectSlug()` should prefer a project's persisted slug when one is passed in; keep its current
  name/path fallback for projects that predate the field.

### Inspection route

- Add a route (for example `POST /api/projects/inspect-directory`) that takes a path and returns the
  inspection result described in the acceptance criteria. Return HTTP 200 with a structured result
  for "directory does not exist" — that is a normal answer for the form, not a server error.
- Because this route runs local commands on an arbitrary path, resolve the path first and reject
  anything that is not an absolute path or not a string.

### UI conventions

- Match the existing Tailwind styling used in `projects/new/page.tsx` and `settings-form.tsx`
  (`h-11 rounded-xl border border-slate-300 …`, sky accent, `role="alert"` / `role="status"`
  messages). Do not introduce a new visual language.
- Mode selection should be a radio group with real labels, not a styled div, so it stays keyboard
  and screen-reader accessible.
- Keep the derived path, submodule list, and git notice as plain text below their controls, in the
  same muted `text-sm text-slate-600` style used elsewhere.

### File size and readability

- `.agent/PROJECT_DOCUMENT.md` requires readable, multi-line code; do not compress logic onto single
  lines. Keep each file under 600 lines — the reworked new-project form should be split into a
  server `page.tsx` plus one or more client components rather than growing into a single large file.

### Pitfalls to avoid

- Do not delete a user's existing directory under any failure path; only remove a directory this
  request created.
- Do not run `git init` when git is unavailable — the option must be absent, and the API must
  reject the request with a clear message if it arrives anyway.
- Do not make `/settings/projects` block the rest of the app; the first-run behavior is a notice and
  a disabled mode, not a global redirect.
- Do not break the existing `POST /api/projects` payload shape used elsewhere; extend it additively.
- Settings pages are `export const dynamic = "force-dynamic"`; keep that on any new server page that
  reads settings or probes git.

## Verification

- `pnpm build` completes with no compilation or type errors.
- `pnpm lint` passes with no new errors.
- Manual check with `pnpm dev`:
  - `/settings/projects` saves a default project directory and the git toggle; reloading shows the
    saved values, and `data/settings.json` contains them.
  - With the setting cleared, `/projects/new` shows the notice and disables *Create new directory*.
  - *Create new directory* creates `{defaultProjectPath}/{slug}` on disk, initializes git when the
    option is on, and the new project opens with at least one application.
  - *Use an existing directory* on a non-repository offers git initialization; on this repository's
    own parent workspace (or any repository with `.gitmodules`) it lists the submodules, and the
    selected ones appear as applications on the project detail page.
- `.agent/PROJECT_DOCUMENT.md` reflects the delivered behavior.
