"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Terminal } from "@xterm/xterm";

import { BrandBar } from "../brand-bar";
import { DEFAULT_AGENT_ID, getAgent, type AgentId } from "@/lib/agents";
import { getRemoteAccessAction, type RemoteAccessActionId } from "@/lib/remote-access";
import type { ClientMessage, SessionContext, SessionSummary } from "@/lib/agent-protocol";
import {
  completionNotice,
  type SessionCompletion,
  type SessionOutcomeNotice,
} from "@/lib/session-completion";
import { terminalSubmission } from "@/lib/terminal-input";
import { TaskClosePrompt } from "./task-close-prompt";
import { TaskCompletionAction } from "./task-completion-action";
import { SessionInfo } from "./session-info";
import { SessionSidebar } from "./session-sidebar";
import { SessionTerminal } from "./session-terminal";
import { SessionCompletionModal } from "./session-completion-modal";
import { SessionLauncherFields } from "./session-launcher-fields";
import { resolveSessionProject, type SessionProject } from "./session-project";
import { useAgentSocket } from "./use-agent-socket";
import { usePlanCreation } from "./use-plan-creation";
import { useTaskExecution } from "./use-task-execution";
import { usePlanRun } from "./use-plan-run";
import { useTaskRun } from "./use-task-run";
import { useSetupRun } from "./use-setup-run";

type ConsoleProject = SessionProject;

type ApiError = { error?: string };

function sendPlaceholder() {
  return false;
}

export function AgentConsole() {
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<ConsoleProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const [agent, setAgent] = useState<AgentId>(DEFAULT_AGENT_ID);
  const [prompt, setPrompt] = useState("");
  const [isPromptVisible, setIsPromptVisible] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [newSession, setNewSession] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [completion, setCompletion] = useState<{
    notice: SessionOutcomeNotice;
    exitCode: number;
  } | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);
  const terminalHostRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const focusPromptOnRevealRef = useRef(false);
  const activeSessionRef = useRef<string | null>(null);
  const attachedSessionRef = useRef<string | null>(null);
  const pendingSessionIdRef = useRef<string | null>(null);
  const selectionInitializedRef = useRef(false);
  const projectSelectionInitializedRef = useRef(false);
  const initialProjectIdRef = useRef(searchParams.get("projectId"));
  const initialPlanProjectIdRef = useRef(searchParams.get("planProjectId"));
  const initialPlanWorkitemIdRef = useRef(searchParams.get("planWorkitemId"));
  const initialRunTaskIdRef = useRef(searchParams.get("runTaskId"));
  const initialSetupActionRef = useRef(searchParams.get("setup"));
  const sendRef = useRef<(message: ClientMessage) => boolean>(sendPlaceholder);
  const {
    beginExecution,
    claimSession,
    confirmClose,
    dismissPrompt,
    execution,
    handleSessionExit,
    completeTaskAndWorkitem,
    isCompleting,
  } = useTaskExecution({ setError });
  const { handlePlanningSessionExit, trackPlanningSession, trackPlanningSessions } = usePlanCreation({ setError });

  const onSessions = useCallback((nextSessions: SessionSummary[]) => {
    trackPlanningSessions(nextSessions);
    if (!selectionInitializedRef.current) {
      selectionInitializedRef.current = true;
      if (nextSessions[0]) {
        activeSessionRef.current = nextSessions[0].id;
        setSelectedSessionId(nextSessions[0].id);
        setNewSession(false);
        setIsPromptVisible(false);
      } else {
        setIsPromptVisible(true);
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
      setIsPromptVisible(true);
    }
  }, [trackPlanningSessions]);

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
  }, []);

  const onStarted = useCallback((session: SessionSummary) => {
    trackPlanningSession(session);
    claimSession(session.id);
    pendingSessionIdRef.current = session.id;
    activeSessionRef.current = session.id;
    setIsCreating(false);
    setNewSession(false);
    setSelectedSessionId(session.id);
    setIsPromptVisible(false);
  }, [claimSession, trackPlanningSession]);

  const onExit = useCallback((
    sessionId: string,
    code: number,
    session: SessionSummary,
  ) => {
    handlePlanningSessionExit(sessionId);
    handleSessionExit(sessionId);

    const notice = completionNotice(
      session.stoppedByUser ? undefined : session.completion,
      code,
    );
    if (notice) {
      setCompletion({ notice, exitCode: code });
    }

    if (
      activeSessionRef.current === sessionId &&
      attachedSessionRef.current === sessionId
    ) {
      terminalRef.current?.write(
        `\r\n\x1b[33mSession exited with code ${code}.\x1b[0m\r\n`,
      );
    }
  }, [handlePlanningSessionExit, handleSessionExit]);

  const onError = useCallback((message: string) => {
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
    const controller = new AbortController();

    async function loadProjects() {
      try {
        const response = await fetch("/api/projects", { signal: controller.signal });
        const body = (await response.json()) as ConsoleProject[] | ApiError;
        if (!response.ok) {
          throw new Error((body as ApiError).error ?? "Unable to load saved projects. Try again.");
        }

        const nextProjects = (body as ConsoleProject[]).map((project) => ({
          ...project,
          applications: Array.isArray(project.applications) ? project.applications : [],
        }));
        setProjects(nextProjects);
        if (!projectSelectionInitializedRef.current) {
          projectSelectionInitializedRef.current = true;
          const initialProject = nextProjects.find((project) => project.id === initialProjectIdRef.current)
            ?? nextProjects[0];
          setSelectedProjectId(initialProject?.id ?? "");
          setSelectedApplicationId(initialProject?.applications[0]?.id ?? "");
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load saved projects. Try again.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingProjects(false);
        }
      }
    }

    void loadProjects();
    return () => controller.abort();
  }, []);

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
  const isNewSessionMode = newSession || !activeSession;

  const activeAgent = activeSession?.kind === "agent" ? getAgent(activeSession.agent) : null;
  const activeSessionLabel = activeSession
    ? activeSession.kind === "agent"
      ? activeAgent!.label
      : getRemoteAccessAction(activeSession.action).label
    : null;
  const activeSessionProject = activeSession
    ? resolveSessionProject(activeSession.cwd, projects)
    : { project: null, application: null };
  const activeProject = activeSessionProject.project;
  const activeApplication = activeSessionProject.application;
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const selectedApplication = selectedProject?.applications.find(
    (application) => application.id === selectedApplicationId,
  ) ?? null;
  const selectedWorkingDirectory = selectedApplication?.path ?? selectedProject?.path ?? "";
  const selectedAgent = getAgent(agent);
  const canStart = connected && !isCreating && !isLoadingProjects && Boolean(selectedProject) && prompt.trim().length > 0;
  const canSend = connected && activeSession?.state === "running" && prompt.trim().length > 0;

  useEffect(() => {
    if (isPromptVisible && focusPromptOnRevealRef.current) {
      promptTextareaRef.current?.focus();
      focusPromptOnRevealRef.current = false;
    }
  }, [isPromptVisible]);

  const startSetup = useCallback((action: RemoteAccessActionId) => {
    activeSessionRef.current = null;
    attachedSessionRef.current = null;
    terminalRef.current?.clear();
    setError("");
    setNewSession(true);
    setSelectedSessionId(null);
    setIsPromptVisible(false);
    if (!send({
      type: "start-setup",
      action,
      cols: terminalRef.current?.cols ?? 80,
      rows: terminalRef.current?.rows ?? 24,
    })) {
      return false;
    }
    setIsCreating(true);
    setPrompt("");
    return true;
  }, [send]);

  const startSession = useCallback((
    nextAgent: AgentId,
    project: Pick<ConsoleProject, "path">,
    nextPrompt: string,
    completion?: SessionCompletion,
    context?: SessionContext,
    cwd = project.path,
  ) => {
    activeSessionRef.current = null;
    attachedSessionRef.current = null;
    terminalRef.current?.clear();
    setError("");
    setNewSession(true);
    setSelectedSessionId(null);
    setIsPromptVisible(true);
    if (!send({
      type: "start",
      agent: nextAgent,
      cwd,
      cols: terminalRef.current?.cols ?? 80,
      rows: terminalRef.current?.rows ?? 24,
      ...(completion ? { completion } : {}),
      initialPrompt: nextPrompt,
      ...(context ? { execution: context } : {}),
    })) {
      setError("The terminal connection is not ready. Try again in a moment.");
      return false;
    }

    setIsCreating(true);
    setPrompt("");
    return true;
  }, [send]);

  function changeProject(projectId: string) {
    const project = projects.find((candidate) => candidate.id === projectId);
    setSelectedProjectId(projectId);
    setSelectedApplicationId(project?.applications[0]?.id ?? "");
  }

  function selectSession(sessionId: string) {
    activeSessionRef.current = sessionId;
    setError("");
    setNewSession(false);
    setSelectedSessionId(sessionId);
    setIsPromptVisible(false);
  }

  function startNewSession() {
    activeSessionRef.current = null;
    setError("");
    setPrompt("");
    setNewSession(true);
    setSelectedSessionId(null);
    setIsPromptVisible(true);
    attachedSessionRef.current = null;
    terminalRef.current?.clear();
  }

  function dismissSession(sessionId: string) {
    setError("");
    return send({ type: "dismiss", sessionId });
  }

  const closeCompletedSession = useCallback((sessionId: string, isRunning: boolean) => {
    if (isRunning && !send({ type: "stop", sessionId })) {
      return false;
    }
    return send({ type: "dismiss", sessionId });
  }, [send]);

  function stopSession() {
    if (!activeSession) {
      return;
    }
    setError("");
    send({ type: "stop", sessionId: activeSession.id });
  }

  const completeActiveTask = useCallback(() => {
    const context = activeSession?.kind === "agent" ? activeSession.execution : undefined;
    if (!activeSession || !context?.taskId) return;
    setError("");
    void completeTaskAndWorkitem({ taskId: context.taskId, projectId: context.projectId, workitemId: context.workitemId, sessionId: activeSession.id, isRunning: activeSession.state === "running" }, closeCompletedSession);
  }, [activeSession, closeCompletedSession, completeTaskAndWorkitem]);

  function togglePromptVisibility() {
    if (!isPromptVisible) {
      focusPromptOnRevealRef.current = true;
    }
    setIsPromptVisible((visible) => !visible);
  }

  function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = prompt.trim();
    if (!value) {
      return;
    }

    setError("");
    if (newSession || !activeSession) {
      if (!selectedProject) {
        setError(isLoadingProjects ? "Saved projects are still loading." : "Select a saved project before starting a session.");
        return;
      }
      startSession(
        agent,
        selectedProject,
        value,
        undefined,
        undefined,
        selectedWorkingDirectory,
      );
      return;
    }

    if (activeSession.state === "running") {
      const [paste, submit] = terminalSubmission(value);
      send({ type: "input", sessionId: activeSession.id, data: paste });
      send({ type: "input", sessionId: activeSession.id, data: submit });
      setPrompt("");
    }
  }

  usePlanRun({
    planProjectIdRef: initialPlanProjectIdRef,
    planWorkitemIdRef: initialPlanWorkitemIdRef,
    connected,
    isLoadingProjects,
    terminalReady,
    projects,
    setAgent,
    setSelectedProjectId,
    setError,
    startSession,
  });

  useSetupRun({
    setupActionRef: initialSetupActionRef,
    connected,
    terminalReady,
    setError,
    startSetup,
  });

  useTaskRun({
    taskIdRef: initialRunTaskIdRef,
    connected,
    isLoadingProjects,
    terminalReady,
    projects,
    setAgent,
    setSelectedProjectId,
    setError,
    startSession,
    beginExecution,
  });

  return (
    <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
          <div>
            <BrandBar />
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Console</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Run and switch between persistent agent sessions in your saved project directories.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600" aria-live="polite">
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-400"}`} />
              {connected ? "Terminal connected" : "Connecting to terminal"}
            </div>
          </div>
        </header>

        <div className="grid min-h-0 gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <SessionSidebar
            sessions={sessions}
            projects={projects}
            selectedSessionId={selectedSessionId}
            onSelect={selectSession}
            onNewSession={startNewSession}
            onDismiss={dismissSession}
          />

          <div className="min-w-0 space-y-6">
            {newSession || !activeSession ? (
              <section aria-label="New session controls" className="space-y-4">
                <SessionLauncherFields
                  projects={projects}
                  isLoadingProjects={isLoadingProjects}
                  selectedProjectId={selectedProjectId}
                  selectedApplicationId={selectedApplicationId}
                  agent={agent}
                  onProjectChange={changeProject}
                  onApplicationChange={setSelectedApplicationId}
                  onAgentChange={setAgent}
                />
                {selectedProject && (
                  <p className="text-sm text-slate-600">
                    {selectedAgent.label} will start in {selectedApplication?.name ?? `${selectedProject.name} project directory`}.
                  </p>
                )}
              </section>
            ) : (
              <section className="flex flex-wrap items-center justify-between gap-3" aria-label={`${activeSessionLabel} session controls`}>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {activeProject?.name ?? activeSessionLabel}
                    {activeApplication && <span className="font-normal text-slate-600"> · {activeApplication.name}</span>}
                  </h2>
                  {activeSession.kind === "agent" && <SessionInfo session={activeSession} />}
                </div>
                {activeSession.state === "running" && (
                  <button type="button" onClick={stopSession} className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100">
                    Stop session
                  </button>
                )}
              </section>
            )}

            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

            {execution && execution.prompt !== "hidden" && (
              <TaskClosePrompt
                taskId={execution.taskId}
                workitemId={execution.workitemId}
                isClosing={execution.isClosing || isCompleting}
                isCompleted={execution.prompt === "success"}
                onConfirm={() => { void confirmClose(closeCompletedSession); }}
                onDismiss={dismissPrompt}
              />
            )}

            <div className="space-y-3">
              <div className="overflow-hidden rounded-[14px] border border-slate-800 bg-[#0b1220] shadow-[0_16px_36px_rgba(15,23,42,0.16)]">
                <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2.5 text-xs text-slate-300">
                  <span>{activeSessionLabel ? `${activeSessionLabel} terminal` : "Agent terminal"}</span>
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

              {activeSession?.kind !== "setup" && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    aria-expanded={isPromptVisible}
                    aria-controls="prompt-form"
                    onClick={togglePromptVisibility}
                    className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
                  >
                    {isPromptVisible ? "Hide prompt" : "Show prompt"}
                  </button>
                  {activeSession?.kind === "agent" && activeSession.execution?.taskId && (
                    <TaskCompletionAction
                      isCompleting={isCompleting}
                      isSessionRunning={activeSession.state !== "exited"}
                      onComplete={completeActiveTask}
                    />
                  )}
                </div>
              )}

              {activeSession?.kind !== "setup" && (
                <div id="prompt-form">
                  {isPromptVisible && (
                  <form onSubmit={submitPrompt} className="flex flex-col gap-3">
                    <label className="text-sm font-medium text-slate-800" htmlFor="prompt">Prompt</label>
                    <textarea
                      ref={promptTextareaRef}
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
                        disabled={isNewSessionMode ? !canStart : !canSend}
                        className="h-11 rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {isCreating ? `Starting ${selectedAgent.label}…` : activeSession?.state === "running" ? "Send prompt" : `Start ${selectedAgent.label}`}
                      </button>
                    </div>
                  </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {completion && (
        <SessionCompletionModal
          notice={completion.notice}
          exitCode={completion.exitCode}
          onClose={() => setCompletion(null)}
        />
      )}
    </main>
  );
}
