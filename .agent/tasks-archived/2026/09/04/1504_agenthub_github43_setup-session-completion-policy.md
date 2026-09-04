# Declare a session completion policy and show a completion modal in the console

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

Today a remote-access setup session (`/console?setup=tailscale-install`) runs its command in the
console PTY and then simply sits there in the `exited` state. The user has to notice the exit line
in the terminal, work out whether it succeeded, dismiss the session by hand, and navigate back to
`/settings/remote-access` themselves.

GitHub issue #43 asks that after the Tailscale install finishes, the session closes itself and a
modal explains what happened.

**The implementation must be generic, not Tailscale-specific.** The user explicitly asked that what
happens when a session's process exits is *declared as data when the session is started*, and that
the console and server contain **no `if (action === "tailscale-install")`-style branching**. Adding a
future setup action, or attaching a completion notice to an agent session, must be a matter of
writing a data descriptor — no new conditional logic anywhere.

Concretely, introduce a **session completion policy** (`SessionCompletion`) that travels with a
session from start to exit:

- `closeOnExit`: `"never" | "always" | "on-success"` — replaces today's boolean `autoClose`.
- `success` / `failure`: optional notice descriptors (`title`, `message`, optional
  `action: { label, href }`) that the console renders in a modal when the process exits.

Both the server (deciding whether to drop the session) and the console (deciding which notice to
show) derive their behaviour from this one descriptor through shared pure helpers.

The Tailscale actions then become pure data in `src/lib/remote-access.ts`: both
`tailscale-install` and `tailscale-connect` declare `closeOnExit: "on-success"` plus a success
notice linking back to `/settings/remote-access` and a failure notice telling the user to review
the terminal output.

### Decisions confirmed with the user

1. **Scope** — the behaviour applies to **all** remote-access setup sessions (`tailscale-install`
   and `tailscale-connect`, and any action added later), not just the install.
2. **Failure** — when the command exits with a non-zero code the session **stays open** so its
   scrollback can be read; the modal reports the failure and the exit code.
3. **Success modal actions** — a primary button that navigates to `/settings/remote-access` and a
   secondary **Close** button that dismisses the modal and leaves the user in the console.

## Application

Root application (`agenthub`)

## GitHub Issue

- Issue #43 — "tailscale install olduktan sonra"

The issue body only mentions the install action; the wider scope (all setup sessions), the
failure behaviour, and the modal's buttons were confirmed with the user during planning, as was
the requirement that the mechanism be generic and parameter-driven rather than branching on the
action id.

## Dependencies

None - This task is independent

## Context

### Current flow

1. `src/app/settings/remote-access/remote-access-form.tsx` renders `SetupState`, which links to
   `/console?setup={actionId}`.
2. `src/app/console/agent-console.tsx` reads the `setup` search param into
   `initialSetupActionRef` and passes it to `useSetupRun` (`src/app/console/use-setup-run.ts`),
   which validates it with `isRemoteAccessActionId` and calls `startSetup`.
3. `startSetup` sends `{ type: "start-setup", action, cols, rows }` over the WebSocket.
4. `server.ts` → `SessionRegistry.createSetup` resolves the command through
   `server/setup-commands.ts` and spawns a PTY with `autoClose: false`, so the exited session is
   kept until the user dismisses it.
5. On exit, `SessionRegistry` broadcasts `{ type: "exit", sessionId, code }` and then a refreshed
   `sessions` list; `agent-console.tsx`'s `onExit` writes `Session exited with code N.` into the
   terminal.

### Why the exit message must carry the session

When a session auto-closes, the server deletes it from the registry before broadcasting the new
`sessions` list, so by the time the console reacts the session summary is gone. The console
therefore cannot look the completion descriptor up from its `sessions` state. The `exit` message
must carry the finished `SessionSummary` (which includes `completion`) so the console can render
the right notice generically, without consulting any catalog or branching on an action id.

### Existing `autoClose` usage

`autoClose` exists today on the `start` client message, in `SessionRegistry`, and is passed as
`true` by exactly one caller — `usePlanRun` (`src/app/console/use-plan-run.ts`), whose planning
session disappears when the agent exits. That call becomes
`completion: { closeOnExit: "always" }`. No other caller passes `true`
(`agent-console.tsx` and `use-task-run.ts` pass `false`, i.e. no completion policy at all).

### Relevant files

- `src/lib/agent-protocol.ts` — WebSocket message types and validators shared by client and server
- `src/lib/remote-access.ts` — client-safe remote-access method and action catalog
- `server/session-registry.ts` — in-memory PTY session registry, `autoClose` handling
- `server.ts` — WebSocket message handling and broadcasts
- `src/app/console/agent-console.tsx` — console UI, `startSession` / `startSetup`, `onExit`
- `src/app/console/use-agent-socket.ts` — socket hook, `onExit` handler signature
- `src/app/console/use-plan-run.ts`, `use-task-run.ts` — `startSession` option types
- `src/app/console/use-setup-run.ts` — starts the setup session from the `setup` URL parameter
- `src/app/settings/remote-access/remote-access-form.tsx` — where the success modal links back to

There is no modal/dialog component anywhere in the codebase yet; this task introduces the first
one. Follow the existing visual language (rounded `14px`/`xl` corners, `slate` text, `sky` primary
buttons, `focus:ring-3` focus rings) used in `agent-console.tsx` and `task-close-prompt.tsx`.

## Acceptance Criteria

- [ ] A shared, client-safe `SessionCompletion` descriptor exists with `closeOnExit`
      (`"never" | "always" | "on-success"`) and optional `success` / `failure` notice descriptors
      (`title`, `message`, optional `action: { label, href }`).
- [ ] Two shared pure helpers derive behaviour from that descriptor and an exit code — one that
      answers "should this session be removed?" (used by the server) and one that returns the
      notice to display, or `null` (used by the console). Neither takes an action id or session
      kind into account.
- [ ] The `start` client message carries an optional `completion` descriptor instead of the boolean
      `autoClose`; `isClientMessage` validates it and rejects malformed descriptors.
- [ ] `start-setup` sessions get their completion descriptor from the action catalog on the server;
      the client does not send it.
- [ ] `SessionSummary` carries the session's `completion` descriptor, and the `exit` server message
      carries the finished `SessionSummary` alongside `sessionId` and `code`.
- [ ] `SessionRegistry` stores the descriptor and, on exit, removes the session only when the shared
      helper says so (and the user did not stop it manually). The old boolean `autoClose` field is
      gone from the registry, the protocol, and every console call site.
- [ ] `REMOTE_ACCESS_ACTIONS` entries declare their completion descriptor as data:
      `closeOnExit: "on-success"`, a success notice whose action links to `/settings/remote-access`,
      and a failure notice that points the user at the terminal output. No code branches on a
      specific action id to decide this.
- [ ] `usePlanRun`'s planning session keeps its current behaviour through
      `completion: { closeOnExit: "always" }` — it still disappears when the agent exits, and it
      shows no modal.
- [ ] When a setup command exits with code `0`, the session is removed from the session list
      automatically and the console shows a modal built from the success notice, with a primary
      button navigating to the notice's `href` and a secondary **Close** button.
- [ ] When a setup command exits with a non-zero code, the session stays in the list with its
      scrollback intact, and the modal shows the failure notice together with the exit code.
- [ ] The modal is accessible: `role="dialog"`, `aria-modal="true"`, labelled by its title, closes
      on `Escape` and on backdrop click, and moves focus into the dialog when it opens.
- [ ] Sessions with no completion descriptor behave exactly as they do today: they stay in the list
      after exiting, and no modal appears.
- [ ] `.agent/PROJECT_DOCUMENT.md` is updated to describe the session completion policy and the
      console completion modal (Architecture / Delivered session capabilities, and the
      `src/lib` + `src/app/console` file listings if new files are added).
- [ ] `pnpm build` and `pnpm lint` both pass.

## Technical Notes

### Suggested shape

Put the descriptor, its validator, and the two helpers in a new client-safe module
`src/lib/session-completion.ts` (keeps `agent-protocol.ts` focused and short), then re-export or
import the types where the protocol needs them:

```ts
export type SessionCloseOnExit = "never" | "always" | "on-success";

export type SessionOutcomeNotice = {
  title: string;
  message: string;
  action?: { label: string; href: string };
};

export type SessionCompletion = {
  closeOnExit: SessionCloseOnExit;
  success?: SessionOutcomeNotice;
  failure?: SessionOutcomeNotice;
};
```

Both helpers key off the same derived outcome, so neither grows a per-action branch:

```ts
const outcome = (exitCode: number) => (exitCode === 0 ? "success" : "failure");

export function shouldCloseOnExit(completion: SessionCompletion | undefined, exitCode: number) { … }
export function completionNotice(completion: SessionCompletion | undefined, exitCode: number) { … }
```

`shouldCloseOnExit` returns `true` for `"always"`, and for `"on-success"` only when the exit code is
`0`. `completionNotice` returns `completion?.[outcome(exitCode)] ?? null`.

### Catalog data

`REMOTE_ACCESS_ACTIONS` stays a `const` catalog; each entry simply gains a `completion` field, e.g.

```ts
{
  id: "tailscale-install",
  methodId: "tailscale",
  label: "Install Tailscale",
  completion: {
    closeOnExit: "on-success",
    success: {
      title: "Tailscale installed",
      message: "The installer finished and this setup session was closed.",
      action: { label: "Back to remote access", href: "/settings/remote-access" },
    },
    failure: {
      title: "Installation did not finish",
      message: "The installer did not complete. Review the terminal output for the reason, then try again.",
    },
  },
}
```

Keep the notice text static: the modal appends the exit code itself for failures, so no descriptor
needs interpolation.

### Server

- `SessionRegistry.create(...)` takes `completion?: SessionCompletion` where it currently takes
  `autoClose = false`; `createSetup(action, cols, rows)` reads
  `getRemoteAccessAction(action).completion` and passes it through. `server/setup-commands.ts` keeps
  resolving only the command to run — do not spread completion data across both modules.
- `TerminalSession` stores `completion` instead of `autoClose`; `list()` includes it in the summary.
- In `pty.onExit`, replace `session.autoClose && !session.stoppedByUser` with
  `shouldCloseOnExit(session.completion, exitCode) && !session.stoppedByUser`.
- Build the summary **before** deleting the session and include it in the broadcast:
  `broadcast({ type: "exit", sessionId, code, session })`. `server.ts`'s `onExit` callback already
  receives the `TerminalSession`; give the registry a small helper that maps a session to its
  `SessionSummary` so `list()` and the exit broadcast share one mapping instead of duplicating it.
- A session stopped by the user (`stoppedByUser`) must never be auto-removed and must not raise a
  completion modal — keep that guard.

### Client

- `useAgentSocket`'s `onExit` becomes `(sessionId: string, code: number, session: SessionSummary)`.
- `agent-console.tsx`'s `onExit` computes `completionNotice(session.completion, code)` and stores
  `{ notice, exitCode }` in state; a new `SessionCompletionModal` renders it. Keep writing the
  existing `Session exited with code N.` line to the terminal for the still-attached case.
- The modal component (`src/app/console/session-completion-modal.tsx`) is driven entirely by the
  notice object: title, message, an optional primary link (`next/link` to `notice.action.href`), and
  a **Close** button. When the notice has no `action`, only **Close** renders. Show the exit code in
  the modal body when it is non-zero.
- `startSession`'s `autoClose = false` parameter becomes `completion?: SessionCompletion`; update the
  option types in `use-plan-run.ts` and `use-task-run.ts` to match, and update
  `agent-console.tsx`'s own `submitPrompt` call. `use-task-run.ts` passes no completion at all.
- Auto-closing already reaches the console through the refreshed `sessions` list, and
  `onSessions` already resets the console to new-session mode when the active session vanishes —
  do not add a second removal path.
- The modal must survive that reset: store it in state that `onSessions` does not clear.

### Pitfalls

- `use-plan-run.ts`, `use-task-run.ts`, and `task-close-prompt.tsx` are written as very long single
  lines. Per the **Code Readability** section of `.agent/PROJECT_DOCUMENT.md`, reformat any such
  line you touch into readable multi-line code — do not add to the density.
- `isClientMessage` is the trust boundary for the WebSocket; validate the `completion` object
  properly (known `closeOnExit` values, string `title`/`message` with sane length limits, optional
  `action` with `label` and a relative `href`) rather than casting.
- `href` values coming from a client message end up in a `next/link`. Restrict them to
  same-origin relative paths (must start with `/` and not `//`) in the validator.
- Do not reintroduce `autoClose` anywhere; a single leftover reference will silently disable
  the planning session's auto-removal.
- The success modal appears when the setup session is gone, so its message must not tell the user
  to look at the terminal — the scrollback is cleared at that point.

## Verification

- `pnpm build` completes with no TypeScript or compilation errors.
- `pnpm lint` passes with no errors (fix anything it reports).
- Manual check with `pnpm dev`:
  - `/settings/remote-access` → **Install Tailscale** (or **Connect**) opens the console setup
    session; on a successful exit the session disappears from the sidebar and the success modal
    appears with a working **Back to remote access** link and a **Close** button.
  - Force a failure (e.g. run the connect action while signed out, or temporarily point the setup
    command at a command that exits non-zero) and confirm the session stays listed with its output
    and the failure modal reports the exit code.
  - Start a plan session from a workitem and confirm it still disappears on exit with no modal.
  - Start an ordinary console session, let it exit, and confirm it stays listed with no modal.
- No migration is required; sessions are in-memory only.
