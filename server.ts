import { createServer } from "node:http";
import { URL } from "node:url";
import next from "next";
import WebSocket, { WebSocketServer, type RawData } from "ws";
import {
  isClientMessage,
  type ClientMessage,
  type ServerMessage,
  type SessionSummary,
} from "./src/lib/agent-protocol";
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
  onOutput: (session, data) => broadcast({ type: "output", sessionId: session.id, data }),
  onExit: (session, code) => {
    broadcast({ type: "exit", sessionId: session.id, code });
    broadcastSessions();
  },
});

socketServer.on("connection", (socket) => {
  clients.add(socket);
  send(socket, { type: "sessions", sessions: sessions.list() });

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
      try {
        const session = await sessions.create(
          message.agent,
          message.cwd,
          message.cols,
          message.rows,
          message.autoClose,
          message.initialPrompt,
          message.execution,
        );
        send(socket, { type: "started", session: toSummary(session) });
        broadcastSessions();
      } catch (error) {
        send(socket, { type: "error", message: errorMessage(error) });
      }
      return;
    }
    case "attach": {
      const session = sessions.get(message.sessionId);
      if (!session) {
        sendUnknownSession(socket, message.sessionId);
        return;
      }

      if (session.state !== "exited") {
        session.pty.resize(message.cols, message.rows);
      }
      send(socket, { type: "scrollback", sessionId: session.id, data: session.buffer });
      return;
    }
    case "input": {
      const session = getLiveSession(socket, message.sessionId);
      if (session) {
        session.pty.write(message.data);
      }
      return;
    }
    case "resize": {
      const session = getLiveSession(socket, message.sessionId);
      if (session) {
        session.pty.resize(message.cols, message.rows);
      }
      return;
    }
    case "stop": {
      const session = getLiveSession(socket, message.sessionId);
      if (!session) {
        return;
      }

      if (sessions.stop(session.id)) {
        broadcastSessions();
      }
      return;
    }
    case "dismiss": {
      const session = sessions.get(message.sessionId);
      if (!session) {
        sendUnknownSession(socket, message.sessionId);
        return;
      }
      if (session.state !== "exited") {
        send(socket, {
          type: "error",
          sessionId: session.id,
          message: "Stop a session before dismissing it.",
        });
        return;
      }

      sessions.dismiss(session.id);
      broadcastSessions();
    }
  }
}

function getLiveSession(socket: WebSocket, sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) {
    sendUnknownSession(socket, sessionId);
    return null;
  }
  if (session.state === "exited") {
    send(socket, {
      type: "error",
      sessionId,
      message: "This session has exited. Its scrollback is still available until you dismiss it.",
    });
    return null;
  }
  return session;
}

function sendUnknownSession(socket: WebSocket, sessionId: string) {
  send(socket, {
    type: "error",
    sessionId,
    message: "This session is no longer available.",
  });
}

function toSummary({ id, agent, cwd, state, createdAt, execution }: SessionSummary): SessionSummary {
  return { id, agent, cwd, state, createdAt, ...(execution ? { execution } : {}) };
}

function broadcastSessions() {
  broadcast({ type: "sessions", sessions: sessions.list() });
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
  return error instanceof Error ? error.message : "Could not start the selected agent.";
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
