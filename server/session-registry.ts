import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import os from "node:os";
import { resolve } from "node:path";
import { spawn, type IPty } from "node-pty";

import type { AgentId } from "../src/lib/agents";
import type { RemoteAccessActionId } from "../src/lib/remote-access";
import type { SessionContext, SessionSummary } from "../src/lib/agent-protocol";
import { getAgentCommand } from "./agents";
import { getSetupCommand } from "./setup-commands";

const MAX_BUFFER_SIZE = 200 * 1024;
const MAX_SESSIONS = 12;

type CommandDefinition = { command: string; args: string[] };

export type TerminalSession = SessionSummary & {
  pty: IPty;
  buffer: string;
  autoClose: boolean;
  stoppedByUser: boolean;
};

type SessionRegistryOptions = {
  onOutput: (session: TerminalSession, data: string) => void;
  onExit: (session: TerminalSession, code: number) => void;
};

export class SessionRegistry {
  private readonly sessions = new Map<string, TerminalSession>();

  constructor(private readonly options: SessionRegistryOptions) {}

  get(id: string) {
    return this.sessions.get(id);
  }

  list(): SessionSummary[] {
    return [...this.sessions.values()]
      .map((session) => session.kind === "agent"
        ? {
            id: session.id,
            kind: "agent" as const,
            agent: session.agent,
            cwd: session.cwd,
            state: session.state,
            createdAt: session.createdAt,
            ...(session.execution ? { execution: session.execution } : {}),
          }
        : {
            id: session.id,
            kind: "setup" as const,
            action: session.action,
            cwd: session.cwd,
            state: session.state,
            createdAt: session.createdAt,
          })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async create(
    agent: AgentId,
    cwdInput: string,
    cols: number,
    rows: number,
    autoClose = false,
    initialPrompt?: string,
    execution?: SessionContext,
  ) {
    const cwd = await validateDirectory(cwdInput);
    return this.createSession(
      getAgentCommand(agent, initialPrompt),
      { kind: "agent", agent, cwd, autoClose, execution },
      cols,
      rows,
    );
  }

  async createSetup(action: RemoteAccessActionId, cols: number, rows: number) {
    return this.createSession(
      await getSetupCommand(action),
      { kind: "setup", action, cwd: os.homedir(), autoClose: false },
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
    details: { kind: "agent"; agent: AgentId; cwd: string; autoClose: boolean; execution?: SessionContext }
      | { kind: "setup"; action: RemoteAccessActionId; cwd: string; autoClose: boolean },
    cols: number,
    rows: number,
  ) {
    if (this.sessions.size >= MAX_SESSIONS) {
      throw new Error(`You can keep up to ${MAX_SESSIONS} sessions. Dismiss an exited session before starting another.`);
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
      autoClose: details.autoClose,
      stoppedByUser: false,
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
      if (session.autoClose && !session.stoppedByUser) {
        this.sessions.delete(session.id);
      }
      this.options.onExit(session, exitCode);
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
