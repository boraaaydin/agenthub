import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandBar } from "../../brand-bar";
import ProjectDetail from "./project-detail";
import { getProject, ProjectStoreError } from "@/lib/projects-store";
import { countProjectWorkitems, WorkitemStoreError } from "@/lib/workitems-store";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;

  let project;
  let taskCount = 0;
  try {
    project = await getProject(id);
    if (project) {
      taskCount = await countProjectWorkitems(project.id);
    }
  } catch (error) {
    console.error("Unable to render project", error);
    const message = error instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and reload this page."
      : error instanceof WorkitemStoreError
        ? "Task data could not be read. Check data/tasks.json and reload this page."
        : "Project details could not be loaded. Reload this page and try again.";

    return (
      <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
        <div className="mx-auto w-full max-w-2xl">
          <BrandBar />
          <div className="mt-3">
            <Link
              href="/projects"
              className="text-sm font-medium text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-3 focus:ring-sky-100"
            >
              Projects
            </Link>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">Project unavailable</h1>
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {message}
          </p>
        </div>
      </main>
    );
  }

  if (!project) {
    notFound();
  }

  return <ProjectDetail key={project.id} project={project} taskCount={taskCount} />;
}
