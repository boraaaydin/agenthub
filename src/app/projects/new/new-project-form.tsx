"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { BrandBar } from "../../brand-bar";
import { ProjectColorPicker } from "../project-color-picker";
import { slugify } from "@/lib/prompt-tokens";
import { type ProjectColorToken } from "@/lib/project-colors";

type ApiError = { error?: string };
type Mode = "create" | "existing";
type Submodule = { name: string; path: string };
type Inspection = {
  exists: boolean;
  isDirectory: boolean;
  gitAvailable: boolean;
  isRepository: boolean;
  repositoryRoot: string | null;
  submodules: Submodule[];
};

type NewProjectFormProps = {
  defaultProjectPath: string;
  initializeGitInNewProjects: boolean;
  gitAvailable: boolean;
  settingsError: string;
};

const DEFAULT_PROJECT_COLOR: ProjectColorToken = "sky";

export default function NewProjectForm({
  defaultProjectPath,
  initializeGitInNewProjects,
  gitAvailable,
  settingsError,
}: NewProjectFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(defaultProjectPath ? "create" : "existing");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugEdited, setIsSlugEdited] = useState(false);
  const [existingPath, setExistingPath] = useState("");
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [inspectionError, setInspectionError] = useState("");
  const [isInspecting, setIsInspecting] = useState(false);
  const [initializeGit, setInitializeGit] = useState(initializeGitInNewProjects);
  const [selectedSubmodules, setSelectedSubmodules] = useState<string[]>([]);
  const [includeRoot, setIncludeRoot] = useState(false);
  const [color, setColor] = useState<ProjectColorToken>(DEFAULT_PROJECT_COLOR);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const derivedPath = defaultProjectPath && slug
    ? `${defaultProjectPath.replace(/[\\/]+$/, "")}/${slug}`
    : "";

  useEffect(() => {
    if (mode !== "existing" || !existingPath.trim()) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void inspectDirectory(controller.signal);
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
    // The current path is intentionally the only inspection trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingPath, mode]);

  async function inspectDirectory(signal?: AbortSignal) {
    if (!existingPath.trim()) {
      return;
    }
    setIsInspecting(true);
    setInspectionError("");
    try {
      const response = await fetch("/api/projects/inspect-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: existingPath }),
        signal,
      });
      const body = (await response.json()) as Inspection & ApiError;
      if (!response.ok) {
        setInspection(null);
        setInspectionError(body.error ?? "The directory could not be inspected.");
        return;
      }
      setInspection(body);
      setSelectedSubmodules(body.submodules.map((submodule) => submodule.path));
      setIncludeRoot(body.submodules.length === 0);
      setInitializeGit(false);
    } catch (caughtError) {
      if ((caughtError as Error).name !== "AbortError") {
        setInspection(null);
        setInspectionError("The directory could not be inspected. Check the path and try again.");
      }
    } finally {
      if (!signal?.aborted) {
        setIsInspecting(false);
      }
    }
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setInspection(null);
    setInspectionError("");
  }

  function changeName(nextName: string) {
    setName(nextName);
    if (!isSlugEdited) {
      setSlug(slugify(nextName));
    }
  }

  function toggleSubmodule(submodulePath: string, checked: boolean) {
    setSelectedSubmodules((current) => (
      checked ? [...current, submodulePath] : current.filter((path) => path !== submodulePath)
    ));
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Enter a project name.");
      return;
    }
    if (!slug.trim()) {
      setError("Enter a project slug.");
      return;
    }
    const existingInspection = inspection;
    if (mode === "create" && !defaultProjectPath) {
      setError("Set a default project directory before creating a new directory.");
      return;
    }
    if (mode === "existing" && !existingPath.trim()) {
      setError("Enter an existing directory path.");
      return;
    }
    if (mode === "existing" && !existingInspection) {
      setError("Inspect the existing directory before creating the project.");
      return;
    }
    if (mode === "existing" && (!existingInspection?.exists || !existingInspection.isDirectory)) {
      setError("Choose an existing directory that can be accessed on this machine.");
      return;
    }

    const projectPath = mode === "create" ? derivedPath : existingPath;
    const applications = mode === "existing" && existingInspection?.isRepository
      ? [
        ...existingInspection.submodules
          .filter((submodule) => selectedSubmodules.includes(submodule.path))
          .map((submodule) => ({
            name: submodule.path.split(/[\\/]/).filter(Boolean).at(-1) ?? submodule.name,
            path: submodule.path,
          })),
        ...(includeRoot ? [{ name: name.trim(), path: projectPath }] : []),
      ]
      : [];

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          color,
          creationMode: mode,
          ...(mode === "existing" ? { path: existingPath } : {}),
          initializeGit: mode === "create" ? gitAvailable && initializeGit : initializeGit,
          applications,
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
            <Link href="/projects" className="text-sm font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100">
              Projects
            </Link>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">New project</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">Save a local project directory and the applications it contains.</p>
        </header>

        {!defaultProjectPath && (
          <p role="status" className="mt-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
            Set a <Link href="/settings/projects" className="font-semibold underline underline-offset-2">default project directory</Link> to create new folders here. You can still use an existing directory.
          </p>
        )}
        {settingsError && <p role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{settingsError}</p>}

        <form onSubmit={createProject} className="mt-8 space-y-6" noValidate>
          <fieldset>
            <legend className="text-sm font-semibold text-slate-900">Directory</legend>
            <div className="mt-3 space-y-3">
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                <input
                  type="radio"
                  name="project-directory-mode"
                  checked={mode === "create"}
                  onChange={() => changeMode("create")}
                  disabled={isSubmitting || !defaultProjectPath}
                  className="mt-1 h-4 w-4 border-slate-300 text-sky-700 focus:ring-sky-200"
                />
                <span><span className="block font-medium text-slate-900">Create new directory</span>Create a folder inside your default project directory.</span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                <input
                  type="radio"
                  name="project-directory-mode"
                  checked={mode === "existing"}
                  onChange={() => changeMode("existing")}
                  disabled={isSubmitting}
                  className="mt-1 h-4 w-4 border-slate-300 text-sky-700 focus:ring-sky-200"
                />
                <span><span className="block font-medium text-slate-900">Use an existing directory</span>Inspect a directory already on this machine.</span>
              </label>
            </div>
            {!defaultProjectPath && <p className="mt-2 text-sm text-slate-600">Create new directory is unavailable until a default directory is saved.</p>}
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="project-name">Project name</label>
              <input id="project-name" value={name} onChange={(event) => changeName(event.target.value)} autoComplete="off" disabled={isSubmitting} placeholder="My project" className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800" htmlFor="project-slug">Project slug</label>
              <input id="project-slug" value={slug} onChange={(event) => { setSlug(event.target.value); setIsSlugEdited(true); }} autoComplete="off" disabled={isSubmitting} placeholder="my-project" className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100" />
            </div>
          </div>

          {mode === "create" ? (
            <div>
              <p className="text-sm font-medium text-slate-800">New directory</p>
              <p className="mt-2 break-all font-mono text-sm text-slate-600">{derivedPath || "Enter a project slug to see the directory."}</p>
              {gitAvailable ? <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-slate-700"><input type="checkbox" checked={initializeGit} onChange={(event) => setInitializeGit(event.target.checked)} disabled={isSubmitting} className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-200" /><span>Initialize a git repository in this new directory.</span></label> : <p className="mt-3 text-sm text-slate-600">Git was not found, so this directory will not be initialized as a repository.</p>}
            </div>
          ) : (
            <ExistingDirectoryFields
              path={existingPath}
              onPathChange={(nextPath) => {
                setExistingPath(nextPath);
                setInspection(null);
                setInspectionError("");
              }}
              inspection={inspection}
              inspectionError={inspectionError}
              isInspecting={isInspecting}
              inspectDirectory={() => void inspectDirectory()}
              initializeGit={initializeGit}
              setInitializeGit={setInitializeGit}
              selectedSubmodules={selectedSubmodules}
              toggleSubmodule={toggleSubmodule}
              includeRoot={includeRoot}
              setIncludeRoot={setIncludeRoot}
              disabled={isSubmitting}
            />
          )}

          <ProjectColorPicker projectId="new-project" name={name} color={color} onColorChange={setColor} disabled={isSubmitting} />
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button type="submit" disabled={isSubmitting} className="h-11 rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300">{isSubmitting ? "Creating project…" : "Create project"}</button>
            <Link href="/projects" className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100">Cancel</Link>
          </div>
        </form>
      </div>
    </main>
  );
}

function ExistingDirectoryFields({
  path,
  onPathChange,
  inspection,
  inspectionError,
  isInspecting,
  inspectDirectory,
  initializeGit,
  setInitializeGit,
  selectedSubmodules,
  toggleSubmodule,
  includeRoot,
  setIncludeRoot,
  disabled,
}: {
  path: string;
  onPathChange: (value: string) => void;
  inspection: Inspection | null;
  inspectionError: string;
  isInspecting: boolean;
  inspectDirectory: () => void;
  initializeGit: boolean;
  setInitializeGit: (value: boolean) => void;
  selectedSubmodules: string[];
  toggleSubmodule: (path: string, checked: boolean) => void;
  includeRoot: boolean;
  setIncludeRoot: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-800" htmlFor="existing-project-path">Existing directory</label>
      <div className="mt-2 flex gap-3">
        <input id="existing-project-path" value={path} onChange={(event) => onPathChange(event.target.value)} autoComplete="off" disabled={disabled} placeholder="/Users/you/Code/project" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100" />
        <button type="button" onClick={inspectDirectory} disabled={disabled || !path.trim() || isInspecting} className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100">{isInspecting ? "Inspecting…" : "Inspect"}</button>
      </div>
      <p className="mt-2 text-sm text-slate-600">Enter an absolute path. AgentHub checks its directory and git details before creating the project.</p>
      {inspectionError && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{inspectionError}</p>}
      {inspection && <InspectionDetails inspection={inspection} initializeGit={initializeGit} setInitializeGit={setInitializeGit} selectedSubmodules={selectedSubmodules} toggleSubmodule={toggleSubmodule} includeRoot={includeRoot} setIncludeRoot={setIncludeRoot} disabled={disabled} />}
    </div>
  );
}

function InspectionDetails({ inspection, initializeGit, setInitializeGit, selectedSubmodules, toggleSubmodule, includeRoot, setIncludeRoot, disabled }: {
  inspection: Inspection;
  initializeGit: boolean;
  setInitializeGit: (value: boolean) => void;
  selectedSubmodules: string[];
  toggleSubmodule: (path: string, checked: boolean) => void;
  includeRoot: boolean;
  setIncludeRoot: (value: boolean) => void;
  disabled: boolean;
}) {
  if (!inspection.exists) return <p className="mt-3 text-sm text-red-700">This directory does not exist.</p>;
  if (!inspection.isDirectory) return <p className="mt-3 text-sm text-red-700">This path is not a directory.</p>;
  if (!inspection.gitAvailable) return <p className="mt-3 text-sm text-slate-600">Git was not found on this machine.</p>;
  if (!inspection.isRepository) return <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-slate-700"><input type="checkbox" checked={initializeGit} onChange={(event) => setInitializeGit(event.target.checked)} disabled={disabled} className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-200" /><span>Initialize a git repository here, inside this chosen directory.</span></label>;

  return (
    <fieldset className="mt-4 space-y-3">
      <legend className="text-sm font-medium text-slate-800">Git repository found{inspection.repositoryRoot ? ` at ${inspection.repositoryRoot}` : ""}</legend>
      {inspection.submodules.length > 0 && <><p className="text-sm text-slate-600">Choose the submodules to register as applications.</p>{inspection.submodules.map((submodule) => <label key={submodule.path} className="flex items-start gap-3 text-sm leading-6 text-slate-700"><input type="checkbox" checked={selectedSubmodules.includes(submodule.path)} onChange={(event) => toggleSubmodule(submodule.path, event.target.checked)} disabled={disabled} className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-200" /><span><span className="block font-medium text-slate-800">{submodule.name}</span><span className="font-mono text-slate-600">{submodule.path}</span></span></label>)}</>}
      <label className="flex items-start gap-3 text-sm leading-6 text-slate-700"><input type="checkbox" checked={includeRoot} onChange={(event) => setIncludeRoot(event.target.checked)} disabled={disabled} className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-200" /><span>Also add the repository root as an application.</span></label>
    </fieldset>
  );
}
