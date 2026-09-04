# Support Tailscale install, detection, and connect on Windows

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

Remote access currently only works on macOS and Linux. Three separate places assume a POSIX
machine:

1. `server/setup-commands.ts` — the `tailscale-install` action runs `brew install --cask
   tailscale-app` on `darwin` and `curl -fsSL https://tailscale.com/install.sh | sh` on
   **everything else**, always through `/bin/sh -lc`. On Windows there is no `/bin/sh`, so the
   setup session cannot even start.
2. `server/tailscale-cli.ts` — the candidate list contains only POSIX paths, so on Windows
   `readTailscaleStatus()` reports `not-installed` forever, even with Tailscale installed, and
   the **Connect** action always throws.
3. `src/app/settings/remote-access/remote-access-form.tsx` — the only way out of a
   `not-installed` state is a console setup session; there is no manual path when no automated
   installer exists.

This task makes Windows a first-class platform for the Tailscale remote-access method and adds a
download link to every platform's setup panel.

## Application

agenthub (repository root — this project has no `apps/` directory)

## GitHub Issue

- Issue #42

## Dependencies

None - This task is independent

## Context

### Clarified decisions (already agreed with the user — do not re-ask)

| Question | Decision |
| --- | --- |
| Windows install behaviour | **winget when available, otherwise manual.** If `winget` is present, the **Install Tailscale** button starts a normal PTY setup session running `winget install --id Tailscale.Tailscale -e …`. If `winget` is missing, the remote-access panel shows manual steps plus the download link instead of starting a session that would immediately fail. |
| Windows detection and connect | **In scope.** `resolveTailscaleCli()` must find `tailscale.exe` on Windows, so status reading and the **Connect** action work after installation. Install alone would leave Windows stuck reporting `not-installed`. |
| Download link on other platforms | **All platforms.** macOS and Linux keep their existing automated install commands unchanged, and additionally show the Tailscale download link next to the install button. |

### Relevant files

| File | Role |
| --- | --- |
| `server/setup-commands.ts` | Allowlisted setup commands; currently POSIX-only, holds `MACOS_INSTALL_COMMAND` and the `/bin/sh -lc` helper. |
| `server/tailscale-cli.ts` | Shared CLI resolver (`TAILSCALE_CANDIDATES`, `resolveTailscaleCli`, `canRun`). Pattern to copy: `server/git-cli.ts`. |
| `src/lib/tailscale.ts` | Server-only (`import "server-only"`) status probe returning `TailscaleStatus`. |
| `src/lib/remote-access.ts` | **Client-safe** method/action catalogs and session completion policies. Imported by the client form — must stay free of Node APIs. |
| `src/app/settings/remote-access/page.tsx` | Server component; reads settings + Tailscale status and passes props to the form. |
| `src/app/settings/remote-access/remote-access-form.tsx` | Client component; `TailscaleDetails` picks the panel, `SetupState` renders the console link. |
| `server/session-registry.ts` | `createSetup()` spawns the setup command through node-pty; needs no change. |

### Client/server boundary

`remote-access-form.tsx` is a `"use client"` component that imports from `src/lib/remote-access.ts`.
Anything reading `process.platform` or probing for `winget` is server-only and must live in
`server/` or in a `server-only` module under `src/lib/`; the result crosses to the client as a
plain serializable prop from `page.tsx`.

## Acceptance Criteria

### Install command

- [ ] `getSetupCommand("tailscale-install")` branches on `process.platform` with three explicit
      cases: `darwin`, `win32`, and everything else (Linux).
- [ ] `darwin` and Linux behaviour is byte-for-byte unchanged (`brew install --cask tailscale-app`
      and `curl -fsSL https://tailscale.com/install.sh | sh`, both via `/bin/sh -lc`).
- [ ] On `win32` the command runs the resolved `winget` executable with
      `install --id Tailscale.Tailscale -e --accept-package-agreements --accept-source-agreements`.
- [ ] On `win32` with no `winget` available, `getSetupCommand` throws a clear error (mirroring the
      existing `tailscale-connect` "not installed" throw) rather than returning `/bin/sh`.

### winget resolution

- [ ] A new `server/winget-cli.ts` exports `resolveWingetCli(): Promise<string | null>`, following
      the exact shape of `server/git-cli.ts` / `server/tailscale-cli.ts` (env override, candidate
      list, `canRun` probe with the 5s timeout, cached path).
- [ ] It returns `null` immediately on non-Windows platforms instead of spawning a probe.
- [ ] Candidates cover the `WINGET_CLI` env override and `winget` on `PATH`.

### Tailscale CLI detection on Windows

- [ ] `TAILSCALE_CANDIDATES` in `server/tailscale-cli.ts` is built per platform: the existing POSIX
      entries stay on macOS/Linux, and Windows contributes `tailscale.exe` on `PATH` plus the
      standard install locations derived from `process.env.ProgramFiles` and
      `process.env["ProgramFiles(x86)"]` (`…\Tailscale\tailscale.exe`).
- [ ] The `TAILSCALE_CLI` env override still takes precedence on every platform.
- [ ] The macOS-only `/Applications/Tailscale.app/...` candidate is no longer probed on Windows.
- [ ] With a resolved `tailscale.exe`, `readTailscaleStatus()` and the `tailscale-connect` action
      work unchanged — no Windows-specific branch is needed in `src/lib/tailscale.ts` or in the
      `tailscale-connect` case.

### Install support signalling

- [ ] A server-side helper reports whether an automated install is available for the current
      platform, returning something client-safe such as
      `{ kind: "automated" } | { kind: "manual" }`.
- [ ] `page.tsx` calls that helper and passes the result — plus the download URL / platform label
      needed for the manual panel — to `RemoteAccessForm` as serializable props.
- [ ] The shared, client-safe pieces (download URLs, manual step text, the support type) live in
      `src/lib/remote-access.ts`; the platform probe lives outside it.

### UI

- [ ] When status is `not-installed` **and** install support is `manual`, the panel shows numbered
      manual steps and a link to the platform's Tailscale download page instead of the
      **Install Tailscale** console button.
- [ ] When status is `not-installed` and install support is `automated`, the existing
      **Install Tailscale** console button still appears.
- [ ] Every Tailscale setup panel (`not-installed`, `needs-login`, `stopped`) additionally shows a
      link to the Tailscale download page, opening in a new tab with `rel="noreferrer"`.
- [ ] The `connected` panel is unchanged.

### Documentation

- [ ] `.agent/PROJECT_DOCUMENT.md` is updated: the remote-access bullet under **Delivered session
      capabilities** mentions Windows support, and `server/winget-cli.ts` is added to the
      repository-structure listing.

## Technical Notes

- **Do not build the Windows command as a shell string.** `winget` is resolved to an absolute
  path (or plain `winget`) and its flags are passed as an `args` array, exactly like the
  `tailscale-connect` case. This avoids `cmd.exe` / PowerShell quoting entirely; no
  `powershell -Command "…"` wrapper is needed.
- `winget install` raises a UAC prompt. The PTY session shows the elevation flow the same way the
  Linux `curl | sh` install shows `sudo` — this is expected and already handled by the setup
  console.
- `--accept-package-agreements --accept-source-agreements` keeps winget from blocking on an
  interactive agreement prompt that cannot be answered meaningfully in the session.
- `canRun()` probes with `version` (Tailscale) or `--version` (git). winget uses `--version`;
  don't copy the bare `version` form from `tailscale-cli.ts`.
- Building the candidate list per platform matters for latency: each miss costs a spawn with a 5s
  timeout, so never probe Windows paths on macOS or POSIX paths on Windows.
- `process.env["ProgramFiles(x86)"]` must use bracket access — the key is not a valid identifier.
  Both env vars can be undefined; filter empties out of the candidate list.
- `src/lib/remote-access.ts` is imported by a client component. Adding `node:` imports or
  `process.platform` reads to it will break the build — keep it declarative data only.
- The download URL should be platform-specific where Tailscale has one
  (`https://tailscale.com/download/windows`, `/mac`, `/linux`), falling back to
  `https://tailscale.com/download`.
- Keep the existing panel markup style: same Tailwind classes, same `mt-6 border-t border-slate-200
  pt-5` wrapper, no new dependencies.
- Follow the **Code Readability** rule in `PROJECT_DOCUMENT.md` — multi-line, no compressed
  one-liners.
- The Windows branches cannot be exercised on the macOS development machine. Keep the platform
  decision in one small, pure, readable place so it can be reviewed by reading it; do not add
  runtime hacks to make it testable.

## Verification

- [ ] `pnpm build` succeeds (this also type-checks the project).
- [ ] `pnpm lint` passes with no new errors or warnings.
- [ ] On the development machine (macOS), `/settings/remote-access` still renders correctly and the
      existing macOS install / connect / connected panels behave exactly as before, now with the
      added download link.
- [ ] No file touched by this task exceeds the 600-line rule; if one does, report it per the
      post-task routine.
