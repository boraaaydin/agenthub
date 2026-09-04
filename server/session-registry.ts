import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import os from "node:os";
import { resolve } from "node:path";
import { spawn, type IPty } from "node-pty";

import type { AgentId } from "../src/lib/agents";
import {
  type SessionContext,
  type SessionSummary,
} from "../src/lib/agent-protocol";
import {
  getRemoteAccessAction,
  type RemoteAccessActionId,
} from "../src/lib/remote-access";
import {
  shouldCloseOnExit,
  type SessionCompletion,
} from "../src/lib/session-completion";
import { getAgentCommand } from "./agents";
import { getSetupCommand } from "./setup-commands";

const MAX_BUFFER_SIZE = 200 * 1024;
const MAX_SESSIONS = 12;

type CommandDefinition = { command: string; args: string[] };

type SessionDetails =
  | {
      kind: "agent";
      agent: AgentId;
      cwd: string;
      completion?: SessionCompletion;
      execution?: SessionContext;
    }
  | {
      kind: "setup";
      action: RemoteAccessActionId;
      cwd: string;
      completion?: SessionCompletion;
    };

export type TerminalSession = SessionSummary & {
  pty: IPty;
  buffer: string;
  stoppedByUser: boolean;
};

type SessionRegistryOptions = {
  onOutput: (session: TerminalSession, data: string) => void;
  onExit: (
    session: TerminalSession,
    code: number,
    summary: SessionSummary,
  ) => void;
};

export class SessionRegistry {
  private readonly sessions = new Map<string, TerminalSession>();

  constructor(private readonly options: SessionRegistryOptions) {}

  get(id: string) {
    return this.sessions.get(id);
  }

  toSummary(session: TerminalSession): SessionSummary {
    const base = {
      id: session.id,
      cwd: session.cwd,
      state: session.state,
      createdAt: session.createdAt,
      ...(session.completion ? { completion: session.completion } : {}),
      ...(session.stoppedByUser ? { stoppedByUser: true } : {}),
    };

    return session.kind === "agent"
      ? {
          ...base,
          kind: "agent",
          agent: session.agent,
          ...(session.execution ? { execution: session.execution } : {}),
        }
      : {
          ...base,
          kind: "setup",
          action: session.action,
        };
  }

  list(): SessionSummary[] {
    return [...this.sessions.values()]
      .map((session) => this.toSummary(session))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async create(
    agent: AgentId,
    cwdInput: string,
    cols: number,
    rows: number,
    completion?: SessionCompletion,
    initialPrompt?: string,
    execution?: SessionContext,
  ) {
    const cwd = await validateDirectory(cwdInput);
    return this.createSession(
      getAgentCommand(agent, initialPrompt),
      { kind: "agent", agent, cwd, completion, execution },
      cols,
      rows,
    );
  }

  async createSetup(action: RemoteAccessActionId, cols: number, rows: number) {
    return this.createSession(
      await getSetupCommand(action),
      {
        kind: "setup",
        action,
        cwd: os.homedir(),
        completion: getRemoteAccessAction(action).completion,
      },
      cols,
      rows,
    );
  }

  stop(id: string) {
    const session = this.get(id);
    if (!session || session.state === "exited") {
      return false;
    }

    session.stoppedByUser = true;
    session.state = "exited";
    session.pty.kill();
    return true;
  }

  dismiss(id: string) {
    const session = this.get(id);
    if (!session || session.state !== "exited") {
      return false;
    }

    this.sessions.delete(id);
    return true;
  }

  stopAll() {
    for (const session of this.sessions.values()) {
      if (session.state !== "exited") {
        session.pty.kill();
      }
    }
    this.sessions.clear();
  }

  private createSession(
    definition: CommandDefinition,
    details: SessionDetails,
    cols: number,
    rows: number,
  ) {
    if (this.sessions.size >= MAX_SESSIONS) {
      throw new Error(
        `You can keep up to ${MAX_SESSIONS} sessions. Dismiss an exited session before starting another.`,
      );
    }

    const pty = spawn(definition.command, definition.args, {
      name: "xterm-color",
      cols,
      rows,
      cwd: details.cwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
      },
    });
    const session: TerminalSession = {
      id: randomUUID(),
      cwd: details.cwd,
      state: "running",
      createdAt: new Date().toISOString(),
      pty,
      buffer: "",
      stoppedByUser: false,
      ...(details.completion ? { completion: details.completion } : {}),
      ...(details.kind === "agent"
        ? {
            kind: "agent",
            agent: details.agent,
            ...(details.execution ? { execution: details.execution } : {}),
          }
        : { kind: "setup", action: details.action }),
    };

    pty.onData((data) => {
      session.buffer = keepRecentOutput(session.buffer, data);
      this.options.onOutput(session, data);
    });
    pty.onExit(({ exitCode }) => {
      if (this.sessions.get(session.id) !== session) {
        return;
      }

      session.state = "exited";
      const summary = this.toSummary(session);
      if (
        shouldCloseOnExit(session.completion, exitCode) &&
        !session.stoppedByUser
      ) {
        this.sessions.delete(session.id);
      }
      this.options.onExit(session, exitCode, summary);
    });

    this.sessions.set(session.id, session);
    return session;
  }
}

async function validateDirectory(cwdInput: string) {
  const suppliedPath = cwdInput.trim();
  if (!suppliedPath) {
    throw new Error("Enter a working directory before starting a session.");
  }

  const cwd = resolve(suppliedPath);
  let details;

  try {
    details = await stat(cwd);
  } catch {
    throw new Error(`The path does not exist: ${cwd}`);
  }

  if (!details.isDirectory()) {
    throw new Error(`The path is not a directory: ${cwd}`);
  }

  return cwd;
}

function keepRecentOutput(buffer: string, nextChunk: string) {
  const combined = buffer + nextChunk;
  return combined.length > MAX_BUFFER_SIZE
    ? combined.slice(combined.length - MAX_BUFFER_SIZE)
    : combined;
}
