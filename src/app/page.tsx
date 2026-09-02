import Link from "next/link";

import { BrandLink } from "./brand-link";
import { listProjects, ProjectStoreError, type Project } from "@/lib/projects-store";

export const dynamic = "force-dynamic";

function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
        <h2 className="text-lg font-semibold text-slate-900">No projects yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
          Create a project to save a name and local working directory here.
        </p>
        <Link
          href="/projects/new"
          className="mt-5 inline-flex h-11 items-center rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200"
        >
          New project
        </Link>
      </section>
    );
  }

  return (
    <section aria-label="Saved projects" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <ul className="divide-y divide-slate-200">
        {projects.map((project) => (
          <li key={project.id} className="group flex items-center transition hover:bg-slate-50">
            <Link
              href={`/projects/${project.id}`}
              className="min-w-0 flex-1 px-4 py-4 focus:outline-none focus:ring-3 focus:ring-inset focus:ring-sky-100 sm:px-5"
            >
              <h2 className="font-medium text-slate-900">{project.name}</h2>
              <p className="mt-1 break-all font-mono text-sm leading-6 text-slate-600">{project.path}</p>
            </Link>
            <Link
              href={`/projects/${project.id}/tasks`}
              aria-label={`Tasks for ${project.name}`}
              className="mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-100 sm:mr-4"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m5 7 1.5 1.5L9 6m3 1h7M5 12l1.5 1.5L9 11m3 1h7M5 17l1.5 1.5L9 16m3 1h7" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function Home() {
  let projects: Project[] = [];
  let error = "";

  try {
    projects = await listProjects();
  } catch (caughtError) {
    console.error("Unable to render projects", caughtError);
    error = caughtError instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and reload this page."
      : "Projects could not be loaded. Reload this page and try again.";
  }

  return (
    <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
          <div>
            <BrandLink />
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Projects</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Keep your local coding projects ready for an agent session.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/settings"
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
            >
              Settings
            </Link>
            <Link
              href="/console"
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium leading-none text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-3 focus:ring-sky-100"
            >
              Open console
            </Link>
            <Link
              href="/projects/new"
              className="inline-flex h-11 items-center rounded-xl bg-sky-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 focus:outline-none focus:ring-3 focus:ring-sky-200"
            >
              New project
            </Link>
          </div>
        </header>

        {error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : (
          <ProjectList projects={projects} />
        )}
      </div>
    </main>
  );
}
