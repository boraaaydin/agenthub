# Auto-Close Plan Sessions When the Plan Agent Exits

## Description

A console session started from a task's **Create plan** flow currently stays in the sidebar
forever: the agent CLI is interactive, so it never exits on its own, and even if it did the
session would linger in the `exited` state until the user dismissed it by hand.

Make plan runs close themselves end to end:

1. The built-in **After planning prompt** gains a final step telling the agent to terminate its
   own CLI process once it has reported the finished plan, so the PTY exits naturally.
2. The session layer marks plan-run sessions as *auto-closing*. When such a session's PTY exits
   on its own, the server removes it from the registry immediately instead of keeping it as an
   `exited` session, and the console returns to its new-session state.

Sessions started by hand from the console prompt form keep today's behaviour.

## Application

Root application (`agenthub`)

## Dependencies

None - This task is independent

## Context

Read `.agent/PROJECT_DOCUMENT.md` before implementing.

Current state:

- `src/lib/default-prompts/plan-post.md` — the built-in After planning prompt. It ends with
  "End by reporting the final task path, dependencies, and any assumptions recorded in the
  task." and never asks the agent to exit. It is read server-side by
  `readDefaultSettingsPrompt("planPostPrompt")` (`src/lib/default-settings-prompts.ts`) and used
  only when `settings.planPostPrompt` is empty.
- `src/app/api/projects/[id]/tasks/[taskId]/plan-prompt/route.ts` composes the plan prompt with
  `composePlanPrompt(planPrompt, task.id, task.title, task.detail, planPostPrompt)`
  (`src/lib/task-plan.ts`), so the After planning prompt is the last block of text the agent
  receives. No change is required in this route.
- `src/app/console/use-plan-run.ts:114` calls `startSession(body.agent, project, body.prompt)` —
  this is the only plan-run entry point.
- `src/app/console/agent-console.tsx:210` defines
  `startSession(nextAgent, project, nextPrompt)`, which sends
  `{ type: "start", agent, cwd, cols, rows }`. It is also called from `submitPrompt`
  (`agent-console.tsx:278`) for manually started sessions.
- `src/lib/agent-protocol.ts` — the `start` variant of `ClientMessage` currently carries only
  `agent`, `cwd`, `cols`, `rows`, validated in `isClientMessage`.
- `server/session-registry.ts` — `create()` builds the `TerminalSession` and registers
  `pty.onExit` (line 74), which sets `session.state = "exited"` and calls `options.onExit`. The
  session stays in the `sessions` map until `dismiss()` removes it, and `dismiss()` only works
  on sessions already in the `exited` state. `stop()` (line 88) sets `state = "exited"` and
  kills the PTY. `MAX_SESSIONS` is 12, so lingering exited sessions consume slots.
- `server.ts:29` — the registry's `onExit` broadcasts `{ type: "exit" }` and then
  `broadcastSessions()`, which re-lists the registry. A session deleted inside the registry
  before `options.onExit` runs therefore disappears from the broadcast list with no change in
  `server.ts`.
- `src/app/console/agent-console.tsx:60-77` (`onSessions`) already handles an active session
  vanishing from the list: it clears the terminal, resets `activeSessionRef` /
  `attachedSessionRef`, and switches the UI back to the new-session view. This is the removal
  path the auto-close relies on.

Decisions already made with the user:

- **Detection**: the agent exits itself; the instruction is added to the After planning prompt.
  No idle timeout and no headless (`codex exec` / `claude -p`) run mode.
- **Meaning of "close"**: stop *and remove* — the sidebar entry and its scrollback disappear
  without a manual dismiss. No "plan finished" banner.
- **Scope**: plan runs only. Manually started console sessions are untouched.

## Acceptance Criteria

- [ ] `src/lib/default-prompts/plan-post.md` ends with an explicit final step telling the agent
      that, as its very last action after the final report, it must end its own CLI process so
      the AgentHub session closes. The wording is agent-agnostic (it must work for both Codex
      and Claude Code) and names a concrete mechanism, e.g. running `kill -TERM $PPID` from the
      agent's shell tool, or the CLI's own exit command where that can be triggered from inside
      the session.
- [ ] The `start` client message carries an optional `autoClose` boolean; `isClientMessage`
      accepts it when absent or boolean and rejects any other type.
- [ ] `SessionRegistry.create` accepts the auto-close flag and stores it on the session. The
      flag stays server-side — `SessionSummary` and the `sessions` / `started` server messages
      are unchanged.
- [ ] When an auto-close session's PTY exits on its own, the registry removes it from the
      session map, and the broadcast session list no longer contains it. The freed slot counts
      against `MAX_SESSIONS` again.
- [ ] Plan runs started from `usePlanRun` request auto-close; sessions started from the console
      prompt form do not.
- [ ] A manually started session that exits still appears in the sidebar as `exited` with its
      scrollback until the user dismisses it.
- [ ] Pressing **Stop session** on a plan run keeps today's behaviour: the session stays in the
      sidebar as `exited` with its scrollback until dismissed.
- [ ] After a plan session is auto-removed, the console shows the new-session view with a
      cleared terminal and no error banner; no "This session is no longer available." error is
      raised by the removal itself.
- [ ] `.agent/PROJECT_DOCUMENT.md` — the "Delivered session capabilities" section states that a
      plan session closes and is removed automatically when its agent exits.

## Technical Notes

- Suggested shape for the registry: give `TerminalSession` two server-only fields, an
  `autoClose` flag from `create()` and a `stoppedByUser` flag set in `stop()`. In `pty.onExit`,
  after `session.state = "exited"`, delete the session from the map when
  `autoClose && !stoppedByUser`, then call `options.onExit`. Deleting before the callback makes
  `broadcastSessions()` in `server.ts` emit the list without the session, so `server.ts` needs
  no change.
- Keep `startSession`'s existing three positional parameters and add auto-close as a trailing
  optional argument (or an options object) so `submitPrompt` stays unchanged.
- The client needs no new removal logic: the existing `onSessions` branch that drops a vanished
  active session already clears the terminal and restores the new-session view. Verify the
  `pendingSessionIdRef` guard does not suppress it — `pendingSessionIdRef` is cleared by the
  first `sessions` broadcast after start, which always precedes the exit broadcast.
- The `exit` message still arrives before the new session list, so the yellow
  "Session exited with code N." line is written and then wiped by the terminal clear. That is
  expected for auto-closed sessions and needs no special handling.

Assumptions recorded with the user:

- Auto-close fires only when the CLI process actually exits. If an agent ignores the exit
  instruction, the session behaves exactly as it does today; nothing kills it on a timer.
- A user-saved After planning prompt in `data/settings.json` that omits the exit step will not
  auto-exit. Only the built-in default (shown in muted text when the setting is empty) is
  changed by this task.
- `kill -TERM $PPID` assumes the agent's shell tool runs as a direct child of the CLI process.
  If the manual check shows the agent's sandbox refuses it, record the working alternative in
  the prompt file rather than adding server-side idle detection.

## Verification

- [ ] `pnpm build`
- [ ] `pnpm lint`
- [ ] Manual: from a task detail page, click **Create plan**. When the plan agent finishes and
      exits, the session disappears from the sidebar on its own and the console returns to the
      new-session view.
- [ ] Manual: start a session from the console prompt form and stop it. It remains in the
      sidebar as `exited` with its scrollback until dismissed.
- [ ] Manual: start a plan run and press **Stop session** mid-run. The session stays as
      `exited` until dismissed.
