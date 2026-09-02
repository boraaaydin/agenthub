import { createServer } from "node:http";
import { URL } from "node:url";
import next from "next";
import WebSocket, { WebSocketServer, type RawData } from "ws";
import {
  isClientMessage,
  type ClientMessage,
  type ServerMessage,
} from "./src/lib/agent-protocol";
import { getAgent } from "./src/lib/agents";
import { readSettings } from "./src/lib/settings-store";
import { SessionRegistry } from "./server/session-registry";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const httpServer = createServer((request, response) => {
  void handle(request, response).catch((error) => {
    console.error("Next.js request handling failed", error);
    response.statusCode = 500;
    response.end("Internal Server Error");
  });
});
const socketServer = new WebSocketServer({ noServer: true });
const clients = new Set<WebSocket>();

const sessions = new SessionRegistry({
  onOutput: (_session, data) => broadcast({ type: "output", data }),
  onExit: (_session, code) => {
    broadcast({ type: "exit", code });
    broadcast({ type: "status", state: "stopped" });
  },
});

socketServer.on("connection", (socket) => {
  clients.add(socket);

  const session = sessions.getActiveSession();
  if (session) {
    if (session.buffer) {
      send(socket, { type: "output", data: session.buffer });
    }
    send(socket, { type: "status", state: "running" });
  } else if (sessions.isStarting()) {
    send(socket, { type: "status", state: "starting" });
  } else {
    send(socket, { type: "status", state: "idle" });
  }

  socket.on("message", (raw) => {
    const message = parseMessage(raw);
    if (!message) {
      send(socket, { type: "error", message: "Received an invalid terminal message." });
      return;
    }

    void handleClientMessage(socket, message);
  });
  socket.on("close", () => clients.delete(socket));
  socket.on("error", () => clients.delete(socket));
});

httpServer.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname !== "/api/agent-socket") {
    // Next.js registers its own upgrade listener for dev-mode HMR. Do not close
    // unrelated upgrades before that listener has a chance to handle them.
    return;
  }

  socketServer.handleUpgrade(request, socket, head, (webSocket) => {
    socketServer.emit("connection", webSocket, request);
  });
});

httpServer.on("close", () => sessions.stopAll());

app.prepare().then(() => {
  httpServer.listen(port, () => {
    console.log(`> AgentHub listening at http://localhost:${port} (${dev ? "development" : "production"})`);
  });
});

async function handleClientMessage(socket: WebSocket, message: ClientMessage) {
  switch (message.type) {
    case "start": {
      const activeSession = sessions.getActiveSession();
      if (activeSession || sessions.isStarting()) {
        const activeAgent = activeSession ? getAgent(activeSession.agent) : null;
        send(socket, {
          type: "error",
          message: activeAgent
            ? `A ${activeAgent.label} session is already running. Stop it before starting another.`
            : "An agent session is already starting. Try again in a moment.",
        });
        return;
      }

      broadcast({ type: "status", state: "starting" });
      try {
        const settings = await readSettings();
        const agent = getAgent(settings.taskAgent);
        await sessions.start(message.cwd, message.cols, message.rows, agent);
        broadcast({ type: "status", state: "running" });
      } catch (error) {
        broadcast({ type: "status", state: "idle" });
        send(socket, { type: "error", message: errorMessage(error) });
      }
      return;
    }
    case "input": {
      const session = sessions.getActiveSession();
      if (!session) {
        send(socket, { type: "error", message: "Start a session before sending input." });
        return;
      }
      session.pty.write(message.data);
      return;
    }
    case "resize": {
      const session = sessions.getActiveSession();
      if (session) {
        session.pty.resize(message.cols, message.rows);
      }
      return;
    }
    case "stop": {
      if (sessions.stop()) {
        broadcast({ type: "status", state: "stopped" });
      }
    }
  }
}

function parseMessage(raw: RawData): ClientMessage | null {
  try {
    const text = rawToString(raw);
    const value: unknown = JSON.parse(text);
    return isClientMessage(value) ? value : null;
  } catch {
    return null;
  }
}

function rawToString(raw: RawData) {
  if (typeof raw === "string") {
    return raw;
  }
  if (Array.isArray(raw)) {
    return Buffer.concat(raw).toString();
  }
  if (raw instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(raw)).toString();
  }
  return raw.toString();
}

function broadcast(message: ServerMessage) {
  for (const client of clients) {
    send(client, message);
  }
}

function send(socket: WebSocket, message: ServerMessage) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not start the agent.";
}

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  sessions.stopAll();
  socketServer.clients.forEach((client) => client.close());
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5_000).unref();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
