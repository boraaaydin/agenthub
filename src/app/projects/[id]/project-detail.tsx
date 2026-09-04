"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { BrandBar } from "../../brand-bar";
import { LocalOnlyNotice } from "../../local-only-notice";
import { ProjectColorPicker } from "../project-color-picker";
import { ProjectApplications, type ProjectApplication } from "./project-applications";
import { projectColorToken, type ProjectColorToken } from "@/lib/project-colors";

type Project = {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  color?: ProjectColorToken;
};

type ApiError = { error?: string };

export default function ProjectDetail({
  project,
  taskCount,
  applications,
  canManage,
}: {
  project: Project;
  taskCount: number;
  applications: ProjectApplication[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [projectPath, setProjectPath] = useState(project.path);
  const [color, setColor] = useState(() => projectColorToken(project.id, project.color));
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [deleteTasks, setDeleteTasks] = useState(false);

  function resetForm() {
    setName(project.name);
    setProjectPath(project.path);
    setColor(projectColorToken(project.id, project.color));
    setError("");
    setStatus("");
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");

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
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, path: projectPath, color }),
      });
      const body = (await response.json()) as Project | ApiError;

      if (!response.ok) {
        setError((body as ApiError).error ?? "Unable to save changes. Try again.");
        return;
      }

      const updatedProject = body as Project;
      setName(updatedProject.name);
      setProjectPath(updatedProject.path);
      setColor(projectColorToken(updatedProject.id, updatedProject.color));
      setStatus("Changes saved.");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteProject() {
    setError("");
    setStatus("");
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/projects/${project.id}${deleteTasks ? "?deleteTasks=true" : ""}`,
        { method: "DELETE" },
      );
      const body = (await response.json()) as ApiError;

      if (!response.ok) {
        setError(body.error ?? "Unable to delete the project. Try again.");
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
          <h1 className="mt-3 break-words text-3xl font-semibold tracking-[-0.03em]">{project.name}</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">Update this project&apos;s local settings.</p>
        </header>

        {canManage ? (
          <form onSubmit={saveProject} className="mt-8 space-y-6" noValidate>
          <div>
            <label className="block text-sm font-medium text-slate-800" htmlFor="project-name">
              Project name
            </label>
            <input
              id="project-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setStatus("");
              }}
              autoComplete="off"
              disabled={isSubmitting}
              className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
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
                setProjectPath(event.target.value);
                setStatus("");
              }}
              autoComplete="off"
              disabled={isSubmitting}
              className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            <p className="mt-2 text-sm text-slate-600">The directory must already exist on this machine.</p>
          </div>

          <ProjectColorPicker
            projectId={project.id}
            name={name}
            color={color}
            onColorChange={(nextColor) => {
              setColor(nextColor);
              setStatus("");
            }}
            disabled={isSubmitting}
          />

          {error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </p>
          )}
          {status && <p role="status" className="text-sm text-emerald-700">{status}</p>}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Saving changes…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={isSubmitting}
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              Cancel
            </button>
          </div>
          </form>
        ) : (
          <section className="mt-8 space-y-5" aria-labelledby="project-details">
            <LocalOnlyNotice />
            <div>
              <h2 id="project-details" className="text-sm font-semibold text-slate-900">Project details</h2>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="font-medium text-slate-700">Working directory</dt>
                  <dd className="mt-1 break-all font-mono text-slate-600">{project.path}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-700">Color</dt>
                  <dd className="mt-1 text-slate-600">{projectColorToken(project.id, project.color)}</dd>
                </div>
              </dl>
            </div>
          </section>
        )}

        <ProjectApplications projectId={project.id} applications={applications} canManage={canManage} />

        <section className="mt-10 border-t border-slate-200 pt-6" aria-labelledby="project-metadata">
          <h2 id="project-metadata" className="text-sm font-semibold text-slate-900">Project metadata</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="font-medium text-slate-700">ID</dt>
              <dd className="mt-1 break-all font-mono text-slate-600">{project.id}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Created</dt>
              <dd className="mt-1 text-slate-600">
                <time dateTime={project.createdAt}>{project.createdAt}</time>
              </dd>
            </div>
          </dl>
        </section>

        {canManage && (
          <section className="mt-10 border-t border-slate-200 pt-6" aria-labelledby="delete-project">
          <h2 id="delete-project" className="text-sm font-semibold text-slate-900">Delete project</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">This only removes the saved project record. Your local files stay untouched.</p>
          {isDeleteConfirming ? (
            <div className="mt-4">
              {taskCount > 0 && (
                <fieldset className="mb-4 space-y-3">
                  <legend className="text-sm font-medium text-slate-800">This project has {taskCount} {taskCount === 1 ? "task" : "tasks"}.</legend>
                  <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <input
                      type="radio"
                      name="delete-tasks"
                      checked={deleteTasks}
                      onChange={() => setDeleteTasks(true)}
                      disabled={isSubmitting}
                      className="mt-1 h-4 w-4 border-slate-300 text-red-700 focus:ring-red-200"
                    />
                    Delete the project and its {taskCount} {taskCount === 1 ? "task" : "tasks"}.
                  </label>
                  <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <input
                      type="radio"
                      name="delete-tasks"
                      checked={!deleteTasks}
                      onChange={() => setDeleteTasks(false)}
                      disabled={isSubmitting}
                      className="mt-1 h-4 w-4 border-slate-300 text-red-700 focus:ring-red-200"
                    />
                    Delete the project only and keep its tasks.
                  </label>
                </fieldset>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={deleteProject}
                  disabled={isSubmitting}
                  className="h-11 rounded-xl bg-red-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 focus:outline-none focus:ring-3 focus:ring-red-200 disabled:cursor-not-allowed disabled:bg-red-300"
                >
                  {isSubmitting ? "Deleting project…" : "Confirm delete"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteConfirming(false);
                    setDeleteTasks(false);
                  }}
                  disabled={isSubmitting}
                  className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsDeleteConfirming(true)}
              disabled={isSubmitting}
              className="mt-4 h-11 rounded-xl border border-red-300 bg-white px-4 text-sm font-medium text-red-800 shadow-sm transition hover:border-red-400 hover:bg-red-50 focus:outline-none focus:ring-3 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              Delete project
            </button>
          )}
          </section>
        )}
      </div>
    </main>
  );
}
