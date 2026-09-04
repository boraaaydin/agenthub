"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { BrandBar } from "../../brand-bar";
import { ProjectColorPicker } from "../project-color-picker";
import { type ProjectColorToken } from "@/lib/project-colors";

type ApiError = { error?: string };

const DEFAULT_PROJECT_COLOR: ProjectColorToken = "sky";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [applicationName, setApplicationName] = useState("");
  const [applicationPath, setApplicationPath] = useState("");
  const [isApplicationNameEdited, setIsApplicationNameEdited] = useState(false);
  const [isApplicationPathEdited, setIsApplicationPathEdited] = useState(false);
  const [color, setColor] = useState<ProjectColorToken>(DEFAULT_PROJECT_COLOR);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Enter a project name.");
      return;
    }
    if (!projectPath.trim()) {
      setError("Enter a working directory path.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          path: projectPath,
          color,
          application: { name: applicationName, path: applicationPath },
        }),
      });
      const body = (await response.json()) as ApiError;

      if (!response.ok) {
        setError(body.error ?? "Unable to create the project. Try again.");
        return;
      }

      router.replace("/projects");
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="border-b border-slate-200 pb-5">
          <BrandBar />
          <div className="mt-3">
            <Link
              href="/projects"
              className="text-sm font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
            >
              Projects
            </Link>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">New project</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Save a project name and its local working directory for later.
          </p>
        </header>

        <form onSubmit={createProject} className="mt-8 space-y-6" noValidate>
          <div>
            <label className="block text-sm font-medium text-slate-800" htmlFor="project-name">
              Project name
            </label>
            <input
              id="project-name"
              value={name}
              onChange={(event) => {
                const nextName = event.target.value;
                setName(nextName);
                if (!isApplicationNameEdited) {
                  setApplicationName(nextName);
                }
              }}
              autoComplete="off"
              disabled={isSubmitting}
              className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              placeholder="My project"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-800" htmlFor="project-path">
              Working directory
            </label>
            <input
              id="project-path"
              value={projectPath}
              onChange={(event) => {
                const nextPath = event.target.value;
                setProjectPath(nextPath);
                if (!isApplicationPathEdited) {
                  setApplicationPath(nextPath);
                }
              }}
              autoComplete="off"
              disabled={isSubmitting}
              className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              placeholder="/Users/you/Code/project"
            />
            <p className="mt-2 text-sm text-slate-600">The directory must already exist on this machine.</p>
          </div>

          <fieldset className="border-t border-slate-200 pt-6">
            <legend className="text-sm font-semibold text-slate-900">Default application</legend>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              This creates the first codebase entry for the project. You can change it later.
            </p>
            <div className="mt-4 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-800" htmlFor="application-name">
                  Application name
                </label>
                <input
                  id="application-name"
                  value={applicationName}
                  onChange={(event) => {
                    setApplicationName(event.target.value);
                    setIsApplicationNameEdited(true);
                  }}
                  autoComplete="off"
                  disabled={isSubmitting}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  placeholder="Web app"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800" htmlFor="application-path">
                  Application working directory
                </label>
                <input
                  id="application-path"
                  value={applicationPath}
                  onChange={(event) => {
                    setApplicationPath(event.target.value);
                    setIsApplicationPathEdited(true);
                  }}
                  autoComplete="off"
                  disabled={isSubmitting}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  placeholder="/Users/you/Code/project/apps/web"
                />
              </div>
            </div>
          </fieldset>

          <ProjectColorPicker
            projectId="new-project"
            name={name}
            color={color}
            onColorChange={setColor}
            disabled={isSubmitting}
          />

          {error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Creating project…" : "Create project"}
            </button>
            <Link
              href="/projects"
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
