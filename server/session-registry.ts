import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn, type IPty } from "node-pty";

import { getAgent, type Agent, type AgentId } from "../src/lib/agents";

const MAX_BUFFER_SIZE = 200 * 1024;

export type TerminalSession = {
  id: string;
  agent: AgentId;
  cwd: string;
  pty: IPty;
  buffer: string;
};

type SessionRegistryOptions = {
  onOutput: (session: TerminalSession, data: string) => void;
  onExit: (session: TerminalSession, code: number) => void;
};

export class SessionRegistry {
  private readonly sessions = new Map<string, TerminalSession>();
  private starting = false;

  constructor(private readonly options: SessionRegistryOptions) {}

  getActiveSession() {
    return this.sessions.get("default");
  }

  isStarting() {
    return this.starting;
  }

  async start(cwdInput: string, cols: number, rows: number, agent: Agent) {
    const activeSession = this.getActiveSession();
    if (activeSession || this.starting) {
      const activeAgent = activeSession ? getAgent(activeSession.agent) : agent;
      throw new Error(`A ${activeAgent.label} session is already running. Stop it before starting another.`);
    }

    this.starting = true;

    try {
      const cwd = await validateDirectory(cwdInput, agent.label);
      const pty = spawn(agent.command, [...agent.args], {
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
        id: "default",
        agent: agent.id,
        cwd,
        pty,
        buffer: "",
      };

      pty.onData((data) => {
        session.buffer = keepRecentOutput(session.buffer, data);
        this.options.onOutput(session, data);
      });
      pty.onExit(({ exitCode }) => {
        if (this.sessions.get(session.id) !== session) {
          return;
        }

        this.sessions.delete(session.id);
        this.options.onExit(session, exitCode);
      });

      this.sessions.set(session.id, session);
      return session;
    } finally {
      this.starting = false;
    }
  }

  stop() {
    const session = this.getActiveSession();
    if (!session) {
      return false;
    }

    this.sessions.delete(session.id);
    session.pty.kill();
    return true;
  }

  stopAll() {
    for (const session of this.sessions.values()) {
      session.pty.kill();
    }
    this.sessions.clear();
  }
}

async function validateDirectory(cwdInput: string, agentLabel: string) {
  const suppliedPath = cwdInput.trim();
  if (!suppliedPath) {
    throw new Error(`Enter a working directory before starting ${agentLabel}.`);
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
