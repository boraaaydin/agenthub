import { isAgentId, type AgentId } from "./agents";
import type { TaskStatus } from "./task-filters";

export type SessionState = "starting" | "running" | "exited";

export type SessionContext = {
  projectId: string;
  taskId: number;
  planId?: number;
};

export type SessionSummary = {
  id: string;
  agent: AgentId;
  cwd: string;
  state: SessionState;
  createdAt: string;
  execution?: SessionContext;
};

export type ClientMessage =
  | {
      type: "start";
      agent: AgentId;
      cwd: string;
      cols: number;
      rows: number;
      autoClose?: boolean;
      initialPrompt?: string;
      execution?: SessionContext;
    }
  | { type: "attach"; sessionId: string; cols: number; rows: number }
  | { type: "input"; sessionId: string; data: string }
  | { type: "resize"; sessionId: string; cols: number; rows: number }
  | { type: "stop"; sessionId: string }
  | { type: "dismiss"; sessionId: string };

export type ServerMessage =
  | { type: "sessions"; sessions: SessionSummary[] }
  | { type: "started"; session: SessionSummary }
  | { type: "scrollback"; sessionId: string; data: string }
  | { type: "output"; sessionId: string; data: string }
  | { type: "exit"; sessionId: string; code: number }
  | { type: "task-changed"; projectId: string; taskId: number; status: TaskStatus }
  | { type: "error"; message: string; sessionId?: string };

const isDimension = (value: unknown, maximum: number) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 2 &&
  value <= maximum;

const isSessionId = (value: unknown) =>
  typeof value === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(value);

export function isSessionContext(value: unknown): value is SessionContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const context = value as Record<string, unknown>;
  return (
    (context.planId === undefined ||
      (typeof context.planId === "number" &&
        Number.isInteger(context.planId) &&
        context.planId > 0)) &&
    typeof context.projectId === "string" &&
    context.projectId.trim().length > 0 &&
    context.projectId.length <= 200 &&
    typeof context.taskId === "number" &&
    Number.isInteger(context.taskId) &&
    context.taskId > 0
  );
}

export function isClientMessage(value: unknown): value is ClientMessage {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return false;
  }

  const message = value as Record<string, unknown>;

  switch (message.type) {
    case "start":
      return (
        isAgentId(message.agent) &&
        typeof message.cwd === "string" &&
        isDimension(message.cols, 500) &&
        isDimension(message.rows, 500) &&
        (message.autoClose === undefined || typeof message.autoClose === "boolean") &&
        (message.initialPrompt === undefined ||
          (typeof message.initialPrompt === "string" &&
            message.initialPrompt.trim().length > 0 &&
            message.initialPrompt.length <= 100_000)) &&
        (message.execution === undefined || isSessionContext(message.execution))
      );
    case "attach":
      return (
        isSessionId(message.sessionId) &&
        isDimension(message.cols, 500) &&
        isDimension(message.rows, 500)
      );
    case "input":
      return (
        isSessionId(message.sessionId) &&
        typeof message.data === "string" &&
        message.data.length <= 100_000
      );
    case "resize":
      return (
        isSessionId(message.sessionId) &&
        isDimension(message.cols, 500) &&
        isDimension(message.rows, 500)
      );
    case "stop":
    case "dismiss":
      return isSessionId(message.sessionId);
    default:
      return false;
  }
}
