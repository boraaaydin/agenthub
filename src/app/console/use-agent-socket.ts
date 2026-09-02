"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ClientMessage,
  ServerMessage,
  SessionSummary,
} from "@/lib/agent-protocol";

type AgentSocketHandlers = {
  onStarted: (session: SessionSummary) => void;
  onSessions: (sessions: SessionSummary[]) => void;
  onOutput: (sessionId: string, data: string) => void;
  onScrollback: (sessionId: string, data: string) => void;
  onExit: (sessionId: string, code: number) => void;
  onError: (message: string, sessionId?: string) => void;
};

export function useAgentSocket(handlers: AgentSocketHandlers) {
  const [connected, setConnected] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) {
      return false;
    }

    socket.send(JSON.stringify(message));
    return true;
  }, []);

  useEffect(() => {
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}/api/agent-socket`);
      socketRef.current = socket;

      socket.onopen = () => setConnected(true);
      socket.onmessage = (event) => {
        let message: ServerMessage;
        try {
          message = JSON.parse(event.data) as ServerMessage;
        } catch {
          return;
        }

        switch (message.type) {
          case "sessions":
            setSessions(message.sessions);
            setSessionsLoaded(true);
            handlersRef.current.onSessions(message.sessions);
            break;
          case "started":
            handlersRef.current.onStarted(message.session);
            break;
          case "output":
            handlersRef.current.onOutput(message.sessionId, message.data);
            break;
          case "scrollback":
            handlersRef.current.onScrollback(message.sessionId, message.data);
            break;
          case "exit":
            handlersRef.current.onExit(message.sessionId, message.code);
            break;
          case "error":
            handlersRef.current.onError(message.message, message.sessionId);
            break;
        }
      };
      socket.onclose = () => {
        setConnected(false);
        if (!disposed) {
          retryTimer = setTimeout(connect, 1_000);
        }
      };
      socket.onerror = () => socket.close();
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, []);

  return { connected, send, sessions, sessionsLoaded };
}
