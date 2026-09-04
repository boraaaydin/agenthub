"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type ApiError = { error?: string };

type ProjectsSettingsFormProps = {
  defaultProjectPath: string;
  initializeGitInNewProjects: boolean;
  gitAvailable: boolean;
};

export default function ProjectsSettingsForm({
  defaultProjectPath: savedPath,
  initializeGitInNewProjects: savedInitializeGit,
  gitAvailable,
}: ProjectsSettingsFormProps) {
  const router = useRouter();
  const [defaultProjectPath, setDefaultProjectPath] = useState(savedPath);
  const [initializeGitInNewProjects, setInitializeGitInNewProjects] = useState(savedInitializeGit);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultProjectPath,
          initializeGitInNewProjects,
        }),
      });
      const body = (await response.json()) as ApiError;
      if (!response.ok) {
        setError(body.error ?? "Unable to save settings. Try again.");
        return;
      }

      setSuccess("Project settings saved.");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      <div>
        <label className="block text-sm font-medium text-slate-800" htmlFor="default-project-path">
          Default project directory
        </label>
        <input
          id="default-project-path"
          value={defaultProjectPath}
          onChange={(event) => {
            setDefaultProjectPath(event.target.value);
            setError("");
            setSuccess("");
          }}
          autoComplete="off"
          disabled={isSubmitting}
          placeholder="/Users/you/Code"
          className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
        <p className="mt-2 text-sm leading-6 text-slate-600">
          New project folders are created inside this existing directory. Leave it empty to only use existing directories.
        </p>
      </div>

      {gitAvailable ? (
        <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
          <input
            type="checkbox"
            checked={initializeGitInNewProjects}
            onChange={(event) => setInitializeGitInNewProjects(event.target.checked)}
            disabled={isSubmitting}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-200"
          />
          <span>
            <span className="block font-medium text-slate-800">Initialize git in new projects</span>
            Create a new local git repository whenever AgentHub creates a project directory.
          </span>
        </label>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Git was not found on this machine, so new projects cannot be initialized as repositories.
        </p>
      )}

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p>}

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
