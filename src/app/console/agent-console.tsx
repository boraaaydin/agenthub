"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Terminal } from "@xterm/xterm";

import { AGENTS, DEFAULT_AGENT_ID, getAgent, type AgentId } from "@/lib/agents";
import type { ClientMessage, SessionSummary } from "@/lib/agent-protocol";
import { SessionSidebar } from "./session-sidebar";
import { SessionTerminal } from "./session-terminal";
import { useAgentSocket } from "./use-agent-socket";

function sendPlaceholder() {
  return false;
}

export function AgentConsole() {
  const [cwd, setCwd] = useState("");
  const [agent, setAgent] = useState<AgentId>(DEFAULT_AGENT_ID);
  const [prompt, setPrompt] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [newSession, setNewSession] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [terminalReady, setTerminalReady] = useState(false);
  const terminalHostRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const activeSessionRef = useRef<string | null>(null);
  const attachedSessionRef = useRef<string | null>(null);
  const queuedPromptRef = useRef<{ sessionId: string | null; prompt: string } | null>(null);
  const pendingSessionIdRef = useRef<string | null>(null);
  const selectionInitializedRef = useRef(false);
  const sendRef = useRef<(message: ClientMessage) => boolean>(sendPlaceholder);

  const onSessions = useCallback((nextSessions: SessionSummary[]) => {
    if (!selectionInitializedRef.current) {
      selectionInitializedRef.current = true;
      if (nextSessions[0]) {
        activeSessionRef.current = nextSessions[0].id;
        setSelectedSessionId(nextSessions[0].id);
        setNewSession(false);
      }
      return;
    }

    const pendingSessionId = pendingSessionIdRef.current;
    if (pendingSessionId && nextSessions.some((session) => session.id === pendingSessionId)) {
      pendingSessionIdRef.current = null;
    }

    const activeSessionId = activeSessionRef.current;
    if (activeSessionId && !nextSessions.some((session) => session.id === activeSessionId) && pendingSessionId !== activeSessionId) {
      activeSessionRef.current = null;
      attachedSessionRef.current = null;
      terminalRef.current?.clear();
      setSelectedSessionId(null);
      setNewSession(true);
    }
  }, []);

  const onOutput = useCallback((sessionId: string, data: string) => {
    if (activeSessionRef.current === sessionId && attachedSessionRef.current === sessionId) {
      terminalRef.current?.write(data);
    }
  }, []);

  const onScrollback = useCallback((sessionId: string, data: string) => {
    if (activeSessionRef.current !== sessionId) {
      return;
    }

    terminalRef.current?.write(data);
    attachedSessionRef.current = sessionId;
    const queuedPrompt = queuedPromptRef.current;
    if (queuedPrompt?.sessionId === sessionId) {
      sendRef.current({ type: "input", sessionId, data: `${queuedPrompt.prompt}\r` });
      queuedPromptRef.current = null;
    }
  }, []);

  const onStarted = useCallback((session: SessionSummary) => {
    pendingSessionIdRef.current = session.id;
    activeSessionRef.current = session.id;
    if (queuedPromptRef.current) {
      queuedPromptRef.current.sessionId = session.id;
    }
    setIsCreating(false);
    setNewSession(false);
    setSelectedSessionId(session.id);
  }, []);

  const onExit = useCallback((sessionId: string, code: number) => {
    if (activeSessionRef.current === sessionId && attachedSessionRef.current === sessionId) {
      terminalRef.current?.write(`\r\n\x1b[33mSession exited with code ${code}.\x1b[0m\r\n`);
    }
  }, []);

  const onError = useCallback((message: string) => {
    queuedPromptRef.current = null;
    setIsCreating(false);
    setError(message);
  }, []);

  const { connected, send, sessions } = useAgentSocket({
    onStarted,
    onSessions,
    onOutput,
    onScrollback,
    onExit,
    onError,
  });

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  useEffect(() => {
    if (!selectedSessionId || !terminalReady || !connected) {
      return;
    }

    attachedSessionRef.current = null;
    terminalRef.current?.clear();
    send({
      type: "attach",
      sessionId: selectedSessionId,
      cols: terminalRef.current?.cols ?? 80,
      rows: terminalRef.current?.rows ?? 24,
    });
  }, [connected, selectedSessionId, send, terminalReady]);

  const onTerminalInput = useCallback((data: string) => {
    const sessionId = activeSessionRef.current;
    if (sessionId) {
      send({ type: "input", sessionId, data });
    }
  }, [send]);

  const onTerminalResize = useCallback((cols: number, rows: number) => {
    const sessionId = activeSessionRef.current;
    if (sessionId) {
      send({ type: "resize", sessionId, cols, rows });
    }
  }, [send]);

  const onTerminalReady = useCallback(() => setTerminalReady(true), []);

  const activeSession = sessions.find((session) => session.id === selectedSessionId) ?? null;
  const activeAgent = activeSession ? getAgent(activeSession.agent) : null;
  const selectedAgent = getAgent(agent);
  const canStart = connected && !isCreating && cwd.trim().length > 0 && prompt.trim().length > 0;
  const canSend = connected && activeSession?.state === "running" && prompt.trim().length > 0;

  function selectSession(sessionId: string) {
    activeSessionRef.current = sessionId;
    setError("");
    setNewSession(false);
    setSelectedSessionId(sessionId);
  }

  function startNewSession() {
    activeSessionRef.current = null;
    setError("");
    setPrompt("");
    setNewSession(true);
    setSelectedSessionId(null);
    attachedSessionRef.current = null;
    terminalRef.current?.clear();
  }

  function dismissSession(sessionId: string) {
    setError("");
    send({ type: "dismiss", sessionId });
  }

  function stopSession() {
    if (!activeSession) {
      return;
    }
    setError("");
    send({ type: "stop", sessionId: activeSession.id });
  }

  function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = prompt.trim();
    if (!value) {
      return;
    }

    setError("");
    if (newSession || !activeSession) {
      if (!cwd.trim()) {
        setError("Enter a working directory before starting a session.");
        return;
      }
      queuedPromptRef.current = { sessionId: null, prompt: value };
      if (!send({
        type: "start",
        agent,
        cwd,
        cols: terminalRef.current?.cols ?? 80,
        rows: terminalRef.current?.rows ?? 24,
      })) {
        queuedPromptRef.current = null;
        setError("The terminal connection is not ready. Try again in a moment.");
        return;
      }
      setIsCreating(true);
      setPrompt("");
      return;
    }

    if (activeSession.state === "running") {
      send({ type: "input", sessionId: activeSession.id, data: `${value}\r` });
      setPrompt("");
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.03em]">AgentHub</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Run and switch between persistent agent sessions in any local directory.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/" className="text-sm font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100">
              Projects
            </Link>
            <div className="flex items-center gap-2 text-sm text-slate-600" aria-live="polite">
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-400"}`} />
              {connected ? "Terminal connected" : "Connecting to terminal"}
            </div>
          </div>
        </header>

        <div className="grid min-h-0 gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <SessionSidebar
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            onSelect={selectSession}
            onNewSession={startNewSession}
            onDismiss={dismissSession}
          />

          <div className="min-w-0 space-y-6">
            {newSession || !activeSession ? (
              <section aria-label="New session controls" className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  <div>
                    <label className="block text-sm font-medium text-slate-800" htmlFor="working-directory">
                      Working directory
                    </label>
                    <input
                      id="working-directory"
                      value={cwd}
                      onChange={(event) => setCwd(event.target.value)}
                      placeholder="/Users/you/Code/project"
                      className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-800" htmlFor="agent">
                      Agent
                    </label>
                    <select
                      id="agent"
                      value={agent}
                      onChange={(event) => setAgent(event.target.value as AgentId)}
                      className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100"
                    >
                      {AGENTS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                  </div>
                </div>
                <p className="text-sm text-slate-600">The directory is checked before {selectedAgent.label} starts.</p>
              </section>
            ) : (
              <section className="flex flex-wrap items-center justify-between gap-3" aria-label={`${activeAgent?.label} session controls`}>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{activeAgent?.label}</h2>
                  <p className="mt-1 font-mono text-sm text-slate-600">{activeSession.cwd}</p>
                </div>
                {activeSession.state === "running" && (
                  <button type="button" onClick={stopSession} className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100">
                    Stop session
                  </button>
                )}
              </section>
            )}

            <form onSubmit={submitPrompt} className="flex flex-col gap-3">
              <label className="text-sm font-medium text-slate-800" htmlFor="prompt">Prompt</label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={4}
                disabled={Boolean(activeSession && activeSession.state === "exited")}
                placeholder={activeAgent ? `Describe what you want ${activeAgent.label} to do…` : `Describe what you want ${selectedAgent.label} to do…`}
                className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  {activeSession?.state === "running"
                    ? "Follow-up prompts continue this session."
                    : activeSession?.state === "exited"
                      ? "This session has exited. Its scrollback remains available until you dismiss it."
                      : `Your first prompt starts ${selectedAgent.label}.`}
                </p>
                <button
                  type="submit"
                  disabled={newSession || !activeSession ? !canStart : !canSend}
                  className="h-11 rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isCreating ? `Starting ${selectedAgent.label}…` : activeSession?.state === "running" ? "Send prompt" : `Start ${selectedAgent.label}`}
                </button>
              </div>
            </form>

            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

            <div className="overflow-hidden rounded-[14px] border border-slate-800 bg-[#0b1220] shadow-[0_16px_36px_rgba(15,23,42,0.16)]">
              <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2.5 text-xs text-slate-300">
                <span>{activeAgent ? `${activeAgent.label} terminal` : "Agent terminal"}</span>
                <span>{activeSession?.state ?? "Ready for a new session"}</span>
              </div>
              <SessionTerminal
                hostRef={terminalHostRef}
                terminalRef={terminalRef}
                onInput={onTerminalInput}
                onResize={onTerminalResize}
                onReady={onTerminalReady}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
