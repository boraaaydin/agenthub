import { isAgentId, type AgentId } from "./agents";

export type SessionState = "starting" | "running" | "exited";

export type SessionSummary = {
  id: string;
  agent: AgentId;
  cwd: string;
  state: SessionState;
  createdAt: string;
};

export type ClientMessage =
  | { type: "start"; agent: AgentId; cwd: string; cols: number; rows: number; autoClose?: boolean }
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
  | { type: "error"; message: string; sessionId?: string };

const isDimension = (value: unknown, maximum: number) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 2 &&
  value <= maximum;

const isSessionId = (value: unknown) =>
  typeof value === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(value);

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
        (message.autoClose === undefined || typeof message.autoClose === "boolean")
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
