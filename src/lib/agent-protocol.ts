import { isAgentId, type AgentId } from "./agents";
import { isRemoteAccessActionId, type RemoteAccessActionId } from "./remote-access";
import type { WorkitemStatus } from "./workitem-filters";

export type SessionState = "starting" | "running" | "exited";

export type SessionContext = {
  projectId: string;
  workitemId: number;
  taskId?: number;
};

type SessionBase = {
  id: string;
  cwd: string;
  state: SessionState;
  createdAt: string;
};

export type AgentSessionSummary = SessionBase & {
  kind: "agent";
  agent: AgentId;
  execution?: SessionContext;
};

export type SetupSessionSummary = SessionBase & {
  kind: "setup";
  action: RemoteAccessActionId;
};

export type SessionSummary = AgentSessionSummary | SetupSessionSummary;

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
  | { type: "start-setup"; action: RemoteAccessActionId; cols: number; rows: number }
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
  | { type: "workitem-changed"; projectId: string; workitemId: number; status: WorkitemStatus }
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
    (context.taskId === undefined ||
      (typeof context.taskId === "number" &&
        Number.isInteger(context.taskId) &&
        context.taskId > 0)) &&
    typeof context.projectId === "string" &&
    context.projectId.trim().length > 0 &&
    context.projectId.length <= 200 &&
    typeof context.workitemId === "number" &&
    Number.isInteger(context.workitemId) &&
    context.workitemId > 0
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
    case "start-setup":
      return (
        isRemoteAccessActionId(message.action) &&
        isDimension(message.cols, 500) &&
        isDimension(message.rows, 500)
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
