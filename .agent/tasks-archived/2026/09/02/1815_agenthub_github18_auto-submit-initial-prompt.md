# Auto-submit the initial prompt by passing it as a CLI argument

---
**Execution Guidelines**: Before starting this task, ensure you've read `.agent/commands/tasks/do-task.md` (if not already read in this session). This file contains essential guidelines on how to properly execute tasks, including dependency checking, verification steps, and archival procedures.

**Application-specific documentation**: This repository has no `apps/` directory and therefore no `apps/{APP_NAME}/.agent/APP_DOCUMENT.md`. Read `.agent/PROJECT_DOCUMENT.md` instead before starting — it carries the tech stack, architecture, conventions, and verification commands for this single application.

When this task file is read standalone, the agent should:
1. Check if `do-task.md` has been read in the current session
2. If not, read it first to understand the execution workflow
3. Read `.agent/PROJECT_DOCUMENT.md` before starting the task
4. Then proceed with this specific task
---

## Description

When a plan is started from the task list, the console opens and the composed prompt appears in
the agent's input box, but it is not submitted — the user has to press Enter manually.

Root cause: the client queues the prompt and, on the `scrollback` message (which arrives
immediately after the PTY is spawned), writes the bracketed-paste text and a `"\r"` back-to-back
into the PTY. At that moment the agent CLI's TUI has not finished booting, so the trailing `"\r"`
is swallowed or coalesced into the paste block instead of being treated as a submit.

Fix: stop typing the first prompt into the terminal at all. Both supported CLIs accept the prompt
as a positional argument and still start an interactive session:

- `claude [options] [command] [prompt]`
- `codex [OPTIONS] [PROMPT]`

Pass the initial prompt through the WebSocket `start` message to the server and hand it to
`node-pty` as a spawn argument. The agent then boots with the prompt already submitted — no
terminal keystrokes, no timing dependency.

This applies to **both** flows that start a session with a first prompt:
1. The plan flow (`usePlanRun` → `startSession`) — the case reported in the issue.
2. The manual console flow (`submitPrompt` → `startSession` when `newSession || !activeSession`).

Follow-up prompts sent into an already-running session keep using the existing bracketed-paste +
`"\r"` path (`terminalSubmission`); they work correctly today because the TUI is already up.

## Application

agenthub (root application — single-app repository, no `apps/` directory)

## GitHub Issue

- Issue #18

## Dependencies

None - This task is independent

## Context

Relevant files:

- `src/lib/agent-protocol.ts` — `ClientMessage` union and the `isClientMessage` validator shared by
  client and server. The `start` message currently carries `agent`, `cwd`, `cols`, `rows`,
  `autoClose`.
- `server.ts` — `handleClientMessage` `case "start"` calls `sessions.create(...)` with the message
  fields.
- `server/session-registry.ts` — `SessionRegistry.create(agent, cwdInput, cols, rows, autoClose)`
  resolves the command via `getAgentCommand(agent)` and calls `spawn(definition.command, definition.args, {...})`.
- `server/agents.ts` — `AGENT_COMMANDS` maps `codex` → `{ command: "codex", args: [] }` and
  `claude` → `{ command: "claude", args: [] }`; `getAgentCommand(agentId)` returns the entry.
- `src/app/console/agent-console.tsx` — holds `queuedPromptRef`, `startSession`, `onScrollback`,
  `onStarted`, `onError`, and `submitPrompt`.
- `src/app/console/use-plan-run.ts` — fetches the composed plan prompt and calls
  `startSession(body.agent, project, body.prompt, true)`.
- `src/lib/terminal-input.ts` — `terminalSubmission(text)` returns the bracketed-paste string and
  the `"\r"` submit string. Stays in use for follow-up prompts only.

Architecture note: `node-pty`'s `spawn(command, args, options)` takes an argv array, so the prompt
is passed as a single argv entry. No shell is involved and no quoting or escaping is needed, and
multi-line prompts (the plan prompt is multi-line Markdown) are passed verbatim.

## Acceptance Criteria

- [ ] The WebSocket `start` message accepts an optional `initialPrompt` string, validated by
      `isClientMessage` (string, non-empty after trim when present, max length consistent with the
      existing `input` limit of 100,000 characters).
- [ ] `getAgentCommand` returns the agent's argv with the initial prompt appended as the final
      positional argument when one is supplied, and unchanged argv when it is not.
- [ ] `SessionRegistry.create` accepts the initial prompt and passes it to `getAgentCommand` so the
      PTY is spawned with the prompt as an argument.
- [ ] `server.ts` forwards `message.initialPrompt` from the `start` message into `sessions.create`.
- [ ] `startSession` in `agent-console.tsx` sends the prompt via `initialPrompt` on the `start`
      message and no longer queues it for terminal paste.
- [ ] Starting a plan from a task list entry submits the composed prompt automatically — the agent
      begins working with no manual Enter press.
- [ ] Typing a prompt in the console and starting a new session likewise submits automatically.
- [ ] Follow-up prompts into a running session still work through the existing
      `terminalSubmission` paste + `"\r"` path.
- [ ] The now-dead client-side queued-paste path is removed (see Technical Notes).
- [ ] `pnpm build` and `pnpm lint` pass with no new errors or warnings.

## Technical Notes

### Removals (confirmed with the user — delete, do not keep as a fallback)

Once the first prompt travels as a CLI argument, the client-side queue is unreachable. Remove:

- `queuedPromptRef` declaration in `agent-console.tsx` (around line 45).
- The queued-prompt block inside `onScrollback` that calls `terminalSubmission` and sends the two
  `input` messages (around lines 93-99).
- The `if (queuedPromptRef.current) { queuedPromptRef.current.sessionId = session.id; }` assignment
  in `onStarted`.
- The `queuedPromptRef.current = null;` line in `onError`.
- The `queuedPromptRef.current = { sessionId: null, prompt: nextPrompt }` assignment and its
  `queuedPromptRef.current = null` reset on the send-failure path inside `startSession`.

Keep `src/lib/terminal-input.ts` and its `terminalSubmission` import — `submitPrompt` still uses it
for follow-up prompts into a running session.

### Implementation hints

- Prefer keeping `startSession`'s existing signature
  `(nextAgent, project, nextPrompt, autoClose = false)`; only its body changes, so `usePlanRun`
  needs no modification.
- `SessionRegistry.create` already takes five positional parameters. Adding a sixth is acceptable,
  but converting the call to a single options object is cleaner and is preferred if it does not
  ripple beyond `server.ts` and the registry.
- Treat an empty or whitespace-only `initialPrompt` as absent — do not append an empty argv entry,
  which some CLIs would read as an empty prompt. Note that the UI already gates on a non-empty
  prompt (`canStart`), so this is a defensive guard.
- Validate `initialPrompt` in `isClientMessage` the same way the `input` case validates `data`:
  `typeof === "string"` and a length ceiling. Follow the existing style of the `autoClose`
  optional-field check (`message.initialPrompt === undefined || ...`).
- Do not change the `autoClose` behaviour: the plan flow still passes `autoClose: true` so the
  session is removed when the agent exits.

### Pitfalls to avoid

- Do not add a timing hack (setTimeout before `"\r"`, output-idle detection). The user explicitly
  chose the CLI-argument approach over a readiness-wait approach.
- Do not build the command as a shell string — `node-pty` spawns the binary directly with an argv
  array, so the prompt must remain a single unquoted array element.
- Do not route the prompt through `--print`/`exec` or any non-interactive flag; the session must
  stay interactive so follow-up prompts continue to work.
- `agent-protocol.ts` is shared by the browser and the Node server. Keep it free of server-only
  imports.
- Next.js in this repo is newer than most training data. Consult
  `node_modules/next/dist/docs/` before writing any Next.js-specific code (this task should not
  need any).

### Documentation

Update `.agent/PROJECT_DOCUMENT.md`: the "Delivered session capabilities" section currently states
that the composed plan prompt is "pasted and submitted as one terminal input". Reword it to say the
first prompt of a session is passed to the agent CLI as a startup argument, while follow-up prompts
are pasted into the running session.

## Verification

- Run `pnpm build` — the project must compile with no TypeScript errors.
- Run `pnpm lint` — fix any reported errors.
- Manual check with `pnpm dev`:
  1. Open a task in `/tasks`, trigger "create plan", and confirm the console session starts with
     the plan prompt already submitted — no Enter press needed — for both the Codex and Claude Code
     plan agents.
  2. From `/console`, select a project, type a prompt, and start a session; confirm it is submitted
     automatically.
  3. Send a follow-up prompt into that running session and confirm it is still submitted correctly.
  4. Confirm a plan session still closes and disappears from the sidebar when its agent exits
     (`autoClose`).
