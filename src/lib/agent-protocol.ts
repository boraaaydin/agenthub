export type SessionState = "idle" | "starting" | "running" | "stopped";

export type ClientMessage =
  | { type: "start"; cwd: string; cols: number; rows: number }
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "stop" };

export type ServerMessage =
  | { type: "output"; data: string }
  | { type: "status"; state: SessionState }
  | { type: "error"; message: string }
  | { type: "exit"; code: number };

const isDimension = (value: unknown, maximum: number) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 2 &&
  value <= maximum;

export function isClientMessage(value: unknown): value is ClientMessage {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return false;
  }

  const message = value as Record<string, unknown>;

  switch (message.type) {
    case "start":
      return (
        typeof message.cwd === "string" &&
        isDimension(message.cols, 500) &&
        isDimension(message.rows, 500)
      );
    case "input":
      return typeof message.data === "string" && message.data.length <= 100_000;
    case "resize":
      return isDimension(message.cols, 500) && isDimension(message.rows, 500);
    case "stop":
      return true;
    default:
      return false;
  }
}
