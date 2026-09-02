import { notFound } from "next/navigation";

import { BrandBar } from "../../brand-bar";
import PlanDetail from "./plan-detail";
import { readPlanFile } from "@/lib/plan-file";
import { getPlan, PlanStoreError } from "@/lib/plans-store";
import { getProject, listProjects, ProjectStoreError } from "@/lib/projects-store";
import { getTask, listAllTasks, TaskStoreError } from "@/lib/tasks-store";

export const dynamic = "force-dynamic";

function parsePlanId(raw: string): number | null {
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 && String(parsed) === raw ? parsed : null;
}

export default async function PlanDetailPage(props: PageProps<"/plans/[planId]">) {
  const { planId: rawPlanId } = await props.params;
  const planId = parsePlanId(rawPlanId);
  if (!planId) {
    notFound();
  }

  let plan: Awaited<ReturnType<typeof getPlan>> = null;
  let projects: { id: string; name: string; color?: string }[] = [];
  let tasksByProject: Record<string, { id: number; title: string }[]> = {};
  let projectPath: string | null = null;
  let taskExists = false;
  let filePreview: Parameters<typeof PlanDetail>[0]["filePreview"] = { status: "missing-project" };
  let error = "";

  try {
    plan = await getPlan(planId);
    if (!plan) {
      notFound();
    }

    const [project, savedProjects, taskPage] = await Promise.all([
      getProject(plan.projectId),
      listProjects(),
      listAllTasks({ page: 1, pageSize: 500 }),
    ]);
    taskExists = Boolean(project && await getTask(plan.projectId, plan.taskId));
    projects = savedProjects.map(({ id, name, color }) => ({ id, name, color }));
    tasksByProject = taskPage.tasks.reduce<Record<string, { id: number; title: string }[]>>((groups, task) => {
      (groups[task.projectId] ??= []).push({ id: task.id, title: task.title });
      return groups;
    }, {});
    if (project) {
      projectPath = project.path;
      filePreview = await readPlanFile(project.path, plan.filePath);
    }
  } catch (caughtError) {
    console.error("Unable to render plan", caughtError);
    error = caughtError instanceof PlanStoreError
      ? "Plan data could not be read. Check data/plans.json and reload this page."
      : caughtError instanceof ProjectStoreError
        ? "Project data could not be read. Check data/projects.json and reload this page."
        : caughtError instanceof TaskStoreError
          ? "Task data could not be read. Check data/tasks.json and reload this page."
          : "Plan details could not be loaded. Reload this page and try again.";
  }

  if (!error && !plan) {
    notFound();
  }

  if (error || !plan) {
    return (
      <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
        <div className="mx-auto w-full max-w-3xl">
          <BrandBar />
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">Plan unavailable</h1>
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        </div>
      </main>
    );
  }

  return <PlanDetail key={plan.id} plan={plan} projects={projects} tasksByProject={tasksByProject} taskExists={taskExists} filePreview={filePreview} projectPath={projectPath} />;
}
