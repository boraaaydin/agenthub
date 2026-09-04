"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export type ProjectApplication = {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
};

type ApiError = { error?: string };

type Props = {
  projectId: string;
  applications: ProjectApplication[];
  canManage: boolean;
};

export function ProjectApplications({
  projectId,
  applications: initialApplications,
  canManage,
}: Props) {
  const router = useRouter();
  const [applications, setApplications] = useState(initialApplications);
  const [newName, setNewName] = useState("");
  const [newPath, setNewPath] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingPath, setEditingPath] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function beginEdit(application: ProjectApplication) {
    setEditingId(application.id);
    setEditingName(application.name);
    setEditingPath(application.path);
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
    setEditingPath("");
    setError("");
  }

  async function readResponse(response: Response): Promise<ApiError & Partial<ProjectApplication>> {
    return response.json() as Promise<ApiError & Partial<ProjectApplication>>;
  }

  async function addApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, path: newPath }),
      });
      const body = await readResponse(response);
      if (!response.ok || !body.id || !body.name || !body.path || !body.createdAt || !body.updatedAt) {
        setError(body.error ?? "Unable to add the application. Try again.");
        return;
      }

      setApplications((current) => [...current, body as ProjectApplication]);
      setNewName("");
      setNewPath("");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveApplication(event: FormEvent<HTMLFormElement>, applicationId: string) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName, path: editingPath }),
      });
      const body = await readResponse(response);
      if (!response.ok || !body.id || !body.name || !body.path || !body.createdAt || !body.updatedAt) {
        setError(body.error ?? "Unable to save the application. Try again.");
        return;
      }

      setApplications((current) => current.map((application) => (
        application.id === applicationId ? body as ProjectApplication : application
      )));
      cancelEdit();
      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteApplication(applicationId: string) {
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/applications/${applicationId}`, {
        method: "DELETE",
      });
      const body = await readResponse(response);
      if (!response.ok) {
        setError(body.error ?? "Unable to delete the application. Try again.");
        return;
      }

      setApplications((current) => current.filter((application) => application.id !== applicationId));
      router.refresh();
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="mt-10 border-t border-slate-200 pt-6" aria-labelledby="project-applications">
      <h2 id="project-applications" className="text-sm font-semibold text-slate-900">Applications</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        Add each codebase that belongs to this project. Console sessions can start in any application directory.
      </p>

      {applications.length === 0 ? (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
          No applications yet. Add one to choose a codebase when starting a console session.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {applications.map((application) => (
            <li key={application.id} className="p-4">
              {canManage && editingId === application.id ? (
                <form onSubmit={(event) => saveApplication(event, application.id)} className="space-y-4" noValidate>
                  <div>
                    <label className="block text-sm font-medium text-slate-800" htmlFor={`application-name-${application.id}`}>
                      Application name
                    </label>
                    <input
                      id={`application-name-${application.id}`}
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      disabled={isSaving}
                      className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-800" htmlFor={`application-path-${application.id}`}>
                      Working directory
                    </label>
                    <input
                      id={`application-path-${application.id}`}
                      value={editingPath}
                      onChange={(event) => setEditingPath(event.target.value)}
                      disabled={isSaving}
                      className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button type="submit" disabled={isSaving} className="h-10 rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300">
                      {isSaving ? "Saving…" : "Save application"}
                    </button>
                    <button type="button" onClick={cancelEdit} disabled={isSaving} className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-semibold text-slate-900">{application.name}</h3>
                    <p className="mt-1 break-all font-mono text-sm leading-6 text-slate-600">{application.path}</p>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button type="button" onClick={() => beginEdit(application)} disabled={isSaving} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100">
                        Edit
                      </button>
                      <button type="button" onClick={() => void deleteApplication(application.id)} disabled={isSaving} className="h-9 rounded-lg border border-red-300 bg-white px-3 text-sm font-medium text-red-800 transition hover:border-red-400 hover:bg-red-50 focus:outline-none focus:ring-3 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100">
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {canManage && (
        <form onSubmit={addApplication} className="mt-6 border-t border-slate-200 pt-6" noValidate>
        <h3 className="text-sm font-semibold text-slate-900">Add application</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-800" htmlFor="new-application-name">Application name</label>
            <input id="new-application-name" value={newName} onChange={(event) => setNewName(event.target.value)} disabled={isSaving} placeholder="API" className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800" htmlFor="new-application-path">Working directory</label>
            <input id="new-application-path" value={newPath} onChange={(event) => setNewPath(event.target.value)} disabled={isSaving} placeholder="/Users/you/Code/project/apps/api" className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100" />
          </div>
        </div>
        <button type="submit" disabled={isSaving} className="mt-4 h-10 rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300">
          {isSaving ? "Adding…" : "Add application"}
        </button>
        </form>
      )}
    </section>
  );
}
