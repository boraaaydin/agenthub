"use client";

import "@xterm/xterm/css/xterm.css";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { Terminal } from "@xterm/xterm";
import type {
  ClientMessage,
  ServerMessage,
  SessionState,
} from "@/lib/agent-protocol";

type TerminalInstance = Terminal;

export function AgentConsole({ taskAgentLabel }: { taskAgentLabel: string }) {
  const [cwd, setCwd] = useState("");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<SessionState>("idle");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const terminalHostRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<TerminalInstance | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const queuedOutputRef = useRef<string[]>([]);
  const queuedPromptRef = useRef<string | null>(null);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  const sendSize = useCallback(() => {
    const terminal = terminalRef.current;
    if (terminal) {
      send({ type: "resize", cols: terminal.cols, rows: terminal.rows });
    }
  }, [send]);

  const writeToTerminal = useCallback((data: string) => {
    const terminal = terminalRef.current;
    if (terminal) {
      terminal.write(data);
    } else {
      queuedOutputRef.current.push(data);
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let terminal: TerminalInstance | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let inputSubscription: { dispose: () => void } | null = null;

    async function createTerminal() {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (disposed || !terminalHostRef.current) {
        return;
      }

      const newTerminal = new Terminal({
        allowProposedApi: false,
        cursorBlink: true,
        cursorStyle: "bar",
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        fontSize: 13,
        lineHeight: 1.35,
        scrollback: 10_000,
        theme: {
          background: "#0b1220",
          foreground: "#dce7f5",
          cursor: "#8ac5ff",
          selectionBackground: "#29486b",
        },
      });
      const fitAddon = new FitAddon();
      newTerminal.loadAddon(fitAddon);
      newTerminal.open(terminalHostRef.current);
      terminal = newTerminal;
      terminalRef.current = newTerminal;

      for (const chunk of queuedOutputRef.current) {
        newTerminal.write(chunk);
      }
      queuedOutputRef.current = [];

      const fit = () => {
        fitAddon.fit();
        sendSize();
      };
      fit();
      resizeObserver = new ResizeObserver(fit);
      resizeObserver.observe(terminalHostRef.current);
      inputSubscription = newTerminal.onData((data) => {
        send({ type: "input", data });
      });
    }

    void createTerminal();
    return () => {
      disposed = true;
      inputSubscription?.dispose();
      resizeObserver?.disconnect();
      terminal?.dispose();
      terminalRef.current = null;
    };
  }, [send, sendSize]);

  useEffect(() => {
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}/api/agent-socket`);
      socketRef.current = socket;

      socket.onopen = () => {
        setConnected(true);
        sendSize();
      };
      socket.onmessage = (event) => {
        let message: ServerMessage;
        try {
          message = JSON.parse(event.data) as ServerMessage;
        } catch {
          return;
        }

        switch (message.type) {
          case "output":
            writeToTerminal(message.data);
            break;
          case "status":
            setStatus(message.state);
            if (message.state === "running" && queuedPromptRef.current) {
              send({ type: "input", data: `${queuedPromptRef.current}\r` });
              queuedPromptRef.current = null;
            }
            break;
          case "error":
            queuedPromptRef.current = null;
            setError(message.message);
            break;
          case "exit":
            writeToTerminal(`\r\n\x1b[33m${taskAgentLabel} exited with code ${message.code}.\x1b[0m\r\n`);
            break;
        }
      };
      socket.onclose = () => {
        setConnected(false);
        if (!disposed) {
          retryTimer = setTimeout(connect, 1_000);
        }
      };
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
  }, [send, sendSize, taskAgentLabel, writeToTerminal]);

  const sessionActive = status === "starting" || status === "running";
  const canSubmit = connected && prompt.trim().length > 0 && !sessionActive ? cwd.trim().length > 0 : connected && prompt.trim().length > 0;

  function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = prompt.trim();
    if (!value) {
      return;
    }

    setError("");
    if (status === "idle" || status === "stopped") {
      if (!cwd.trim()) {
        setError(`Enter a working directory before starting ${taskAgentLabel}.`);
        return;
      }
      queuedPromptRef.current = value;
      terminalRef.current?.clear();
      if (!send({
        type: "start",
        cwd,
        cols: terminalRef.current?.cols ?? 80,
        rows: terminalRef.current?.rows ?? 24,
      })) {
        queuedPromptRef.current = null;
        setError("The terminal connection is not ready. Try again in a moment.");
        return;
      }
    } else if (status === "running") {
      send({ type: "input", data: `${value}\r` });
    }

    setPrompt("");
  }

  function stopSession() {
    setError("");
    queuedPromptRef.current = null;
    send({ type: "stop" });
  }

  return (
    <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.03em]">AgentHub</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Keep one {taskAgentLabel} conversation open in the directory you choose.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="text-sm font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
            >
              Projects
            </Link>
            <div className="flex items-center gap-2 text-sm text-slate-600" aria-live="polite">
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-400"}`} />
              {connected ? "Terminal connected" : "Connecting to terminal"}
            </div>
          </div>
        </header>

        <section aria-label={`${taskAgentLabel} session controls`}>
          <label className="block text-sm font-medium text-slate-800" htmlFor="working-directory">
            Working directory
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="working-directory"
              value={cwd}
              onChange={(event) => setCwd(event.target.value)}
              disabled={sessionActive}
              placeholder="/Users/you/Code/project"
              className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
            />
            {sessionActive && (
              <button
                type="button"
                onClick={stopSession}
                className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
              >
                Stop & reset
              </button>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {sessionActive
              ? `This path is locked until you stop the current ${taskAgentLabel} session.`
              : `The path is checked on the server before ${taskAgentLabel} starts.`}
          </p>
        </section>

        <form onSubmit={submitPrompt} className="flex flex-col gap-3">
          <label className="text-sm font-medium text-slate-800" htmlFor="prompt">
            Prompt
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={4}
            placeholder={`Describe what you want ${taskAgentLabel} to do…`}
            className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:ring-3 focus:ring-sky-100"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {status === "running" ? "Follow-up prompts continue this session." : `Your first prompt starts ${taskAgentLabel}.`}
            </p>
            <button
              type="submit"
              disabled={!canSubmit || status === "starting"}
              className="h-11 rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {status === "starting" ? `Starting ${taskAgentLabel}…` : status === "running" ? "Send prompt" : `Start ${taskAgentLabel}`}
            </button>
          </div>
        </form>

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-[14px] border border-slate-800 bg-[#0b1220] shadow-[0_16px_36px_rgba(15,23,42,0.16)]">
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2.5 text-xs text-slate-300">
            <span>{taskAgentLabel} terminal</span>
            <span className="capitalize">{status}</span>
          </div>
          <div
            ref={terminalHostRef}
            onClick={() => terminalRef.current?.focus()}
            className="h-[420px] cursor-text p-2 sm:h-[500px]"
            aria-label={`Live ${taskAgentLabel} terminal output`}
            role="log"
          />
        </div>
      </div>
    </main>
  );
}
