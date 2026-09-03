"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { ServerMessage } from "@/lib/agent-protocol";

const REFRESH_DEBOUNCE_MS = 100;

export function TaskLiveUpdates() {
  const router = useRouter();

  useEffect(() => {
    let disposed = false;
    let hasConnected = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let socket: WebSocket | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) {
        return;
      }
      refreshTimer = setTimeout(() => {
        refreshTimer = undefined;
        if (!disposed) {
          router.refresh();
        }
      }, REFRESH_DEBOUNCE_MS);
    };

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/api/agent-socket`);

      socket.onopen = () => {
        if (hasConnected) {
          scheduleRefresh();
        }
        hasConnected = true;
      };
      socket.onmessage = (event) => {
        let message: ServerMessage;
        try {
          message = JSON.parse(event.data) as ServerMessage;
        } catch {
          return;
        }

        if (message.type === "task-changed") {
          scheduleRefresh();
        }
      };
      socket.onclose = () => {
        if (!disposed) {
          retryTimer = setTimeout(connect, 1_000);
        }
      };
      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      socket?.close();
    };
  }, [router]);

  return null;
}
