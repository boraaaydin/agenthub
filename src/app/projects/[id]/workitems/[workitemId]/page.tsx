import { notFound } from "next/navigation";

import { BrandBar } from "../../../../brand-bar";
import { listProjectApplications, ApplicationStoreError } from "@/lib/applications-store";
import WorkitemDetail from "./workitem-detail";
import { getProject, ProjectStoreError } from "@/lib/projects-store";
import { getWorkitem, getWorkitemsByIds, WorkitemStoreError } from "@/lib/workitems-store";
import { blockingDependencies, type WorkitemDependency } from "@/lib/workitem-filters";
import { listLatestTasksByWorkitem, taskWorkitemKey } from "@/lib/tasks-store";

export const dynamic = "force-dynamic";

export default async function WorkitemDetailPage(props: PageProps<"/projects/[id]/workitems/[workitemId]">) {
  const { id, workitemId } = await props.params;
  const parsedWorkitemId = Number.parseInt(workitemId, 10);
  if (!Number.isInteger(parsedWorkitemId) || parsedWorkitemId <= 0 || String(parsedWorkitemId) !== workitemId) {
    notFound();
  }

  let project;
  let workitem;
  let executableTaskId: number | null = null;
  let taskCount = 0;
  let hasApplications = false;
  let dependencies: WorkitemDependency[] = [];
  let blockingWorkitems: WorkitemDependency[] = [];
  let error = "";

  try {
    project = await getProject(id);
    if (project) {
      const applications = await listProjectApplications(id);
      hasApplications = applications.length > 0;
      workitem = await getWorkitem(id, parsedWorkitemId);
      if (workitem) {
        dependencies = await getWorkitemsByIds(id, workitem.dependencyIds);
        const dependenciesById = new Map(dependencies.map((dependency) => [dependency.id, dependency]));
        blockingWorkitems = blockingDependencies(workitem.dependencyIds, dependenciesById);
      }
    }
  } catch (caughtError) {
    console.error("Unable to render project workitem", caughtError);
    error = caughtError instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and reload this page."
      : caughtError instanceof ApplicationStoreError
        ? "Application data could not be read. Check data/applications.json and reload this page."
        : caughtError instanceof WorkitemStoreError
          ? "Workitem data could not be read. Check data/workitems.json and reload this page."
          : "Workitem details could not be loaded. Reload this page and try again.";
  }

  if (project && workitem) {
    try {
      const latestTasksByWorkitem = await listLatestTasksByWorkitem();
      const taskInfo = latestTasksByWorkitem.get(taskWorkitemKey(id, parsedWorkitemId));
      executableTaskId = taskInfo?.task.id ?? null;
      taskCount = taskInfo?.taskCount ?? 0;
    } catch (caughtError) {
      console.error("Unable to load workitem task", caughtError);
    }
  }

  if (!error && (!project || !workitem)) {
    notFound();
  }

  if (error || !project || !workitem) {
    return (
      <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
        <div className="mx-auto w-full max-w-2xl">
          <BrandBar />
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">Workitem unavailable</h1>
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <WorkitemDetail
      key={workitem.id}
      projectName={project.name}
      projectColor={project.color}
      workitem={workitem}
      executableTaskId={executableTaskId}
      taskCount={taskCount}
      hasApplications={hasApplications}
      dependencies={dependencies}
      blockingDependencies={blockingWorkitems}
    />
  );
}
