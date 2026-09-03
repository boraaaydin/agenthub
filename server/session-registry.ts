import { stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { spawn, type IPty } from "node-pty";

import type { AgentId } from "../src/lib/agents";
import type { SessionExecution, SessionSummary } from "../src/lib/agent-protocol";
import { getAgentCommand } from "./agents";

const MAX_BUFFER_SIZE = 200 * 1024;
const MAX_SESSIONS = 12;

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
      .map(({ id, agent, cwd, state, createdAt, execution }) => ({
        id,
        agent,
        cwd,
        state,
        createdAt,
        ...(execution ? { execution } : {}),
      }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async create(
    agent: AgentId,
    cwdInput: string,
    cols: number,
    rows: number,
    autoClose = false,
    initialPrompt?: string,
    execution?: SessionExecution,
  ) {
    if (this.sessions.size >= MAX_SESSIONS) {
      throw new Error(`You can keep up to ${MAX_SESSIONS} sessions. Dismiss an exited session before starting another.`);
    }

    const cwd = await validateDirectory(cwdInput);
    if (this.sessions.size >= MAX_SESSIONS) {
      throw new Error(`You can keep up to ${MAX_SESSIONS} sessions. Dismiss an exited session before starting another.`);
    }

    const definition = getAgentCommand(agent, initialPrompt);
    const pty = spawn(definition.command, definition.args, {
      name: "xterm-color",
      cols,
      rows,
      cwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
      },
    });
    const session: TerminalSession = {
      id: randomUUID(),
      agent,
      cwd,
      state: "running",
      createdAt: new Date().toISOString(),
      pty,
      buffer: "",
      autoClose,
      stoppedByUser: false,
      ...(execution ? { execution } : {}),
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
