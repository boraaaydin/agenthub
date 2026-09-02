"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { AGENTS, isAgentId, type AgentId } from "@/lib/agents";

type ApiError = { error?: string };

type SettingsFormProps = {
  settings: {
    taskAgent: AgentId;
    planAgent: AgentId;
  };
};

export default function SettingsForm({ settings }: SettingsFormProps) {
  const router = useRouter();
  const [taskAgent, setTaskAgent] = useState<AgentId>(settings.taskAgent);
  const [planAgent, setPlanAgent] = useState<AgentId>(settings.planAgent);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function selectAgent(value: string, setAgent: (agentId: AgentId) => void) {
    if (isAgentId(value)) {
      setAgent(value);
      setError("");
      setSuccess("");
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskAgent, planAgent }),
      });
      const body = (await response.json()) as ApiError;

      if (!response.ok) {
        setError(body.error ?? "Unable to save settings. Try again.");
        return;
      }

      setSuccess("Settings saved.");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-8 space-y-6" noValidate>
      <div>
        <label className="block text-sm font-medium text-slate-800" htmlFor="task-agent">
          Task agent
        </label>
        <select
          id="task-agent"
          value={taskAgent}
          onChange={(event) => selectAgent(event.target.value, setTaskAgent)}
          disabled={isSubmitting}
          className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {AGENTS.map((agent) => (
            <option key={agent.id} value={agent.id}>{agent.label}</option>
          ))}
        </select>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Stored for the task flow.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-800" htmlFor="plan-agent">
          Plan agent
        </label>
        <select
          id="plan-agent"
          value={planAgent}
          onChange={(event) => selectAgent(event.target.value, setPlanAgent)}
          disabled={isSubmitting}
          className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          {AGENTS.map((agent) => (
            <option key={agent.id} value={agent.id}>{agent.label}</option>
          ))}
        </select>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Stored now for a future planning flow.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="h-11 rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isSubmitting ? "Saving settings…" : "Save settings"}
      </button>
    </form>
  );
}
