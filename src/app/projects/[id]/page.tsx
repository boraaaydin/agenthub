import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { BrandBar } from "../../brand-bar";
import ProjectDetail from "./project-detail";
import {
  listProjectApplications,
  ApplicationStoreError,
  type Application,
} from "@/lib/applications-store";
import { getProject, ProjectStoreError } from "@/lib/projects-store";
import { countProjectWorkitems, WorkitemStoreError } from "@/lib/workitems-store";
import { isLocalClient } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage(props: PageProps<"/projects/[id]">) {
  const canManage = isLocalClient(await headers());
  const { id } = await props.params;

  let project;
  let taskCount = 0;
  let applications: Application[] = [];
  try {
    project = await getProject(id);
    if (project) {
      [taskCount, applications] = await Promise.all([
        countProjectWorkitems(project.id),
        listProjectApplications(project.id),
      ]);
    }
  } catch (error) {
    console.error("Unable to render project", error);
    const message = error instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and reload this page."
      : error instanceof ApplicationStoreError
        ? "Application data could not be read. Check data/applications.json and reload this page."
        : error instanceof WorkitemStoreError
          ? "Task data could not be read. Check data/tasks.json and reload this page."
          : "Project details could not be loaded. Reload this page and try again.";

    return (
      <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
        <div className="mx-auto w-full max-w-2xl">
          <BrandBar />
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Project unavailable</h1>
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

  return <ProjectDetail
    key={project.id}
    project={project}
    taskCount={taskCount}
    applications={applications}
    canManage={canManage}
  />;
}
