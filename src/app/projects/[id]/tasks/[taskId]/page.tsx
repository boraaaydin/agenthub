import { notFound } from "next/navigation";

import { BrandLink } from "../../../../brand-link";
import TaskDetail from "./task-detail";
import { getProject, ProjectStoreError } from "@/lib/projects-store";
import { getTask, TaskStoreError } from "@/lib/tasks-store";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage(props: PageProps<"/projects/[id]/tasks/[taskId]">) {
  const { id, taskId } = await props.params;
  const parsedTaskId = Number.parseInt(taskId, 10);
  if (!Number.isInteger(parsedTaskId) || parsedTaskId <= 0 || String(parsedTaskId) !== taskId) {
    notFound();
  }

  let project;
  let task;
  let error = "";

  try {
    project = await getProject(id);
    if (project) {
      task = await getTask(id, parsedTaskId);
    }
  } catch (caughtError) {
    console.error("Unable to render project task", caughtError);
    error = caughtError instanceof ProjectStoreError
      ? "Project data could not be read. Check data/projects.json and reload this page."
      : caughtError instanceof TaskStoreError
        ? "Task data could not be read. Check data/tasks.json and reload this page."
        : "Task details could not be loaded. Reload this page and try again.";
  }

  if (!error && (!project || !task)) {
    notFound();
  }

  if (error || !project || !task) {
    return (
      <main className="min-h-screen bg-[#f4f6fa] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
        <div className="mx-auto w-full max-w-2xl">
          <BrandLink />
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">Task unavailable</h1>
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        </div>
      </main>
    );
  }

  return <TaskDetail key={task.id} projectName={project.name} task={task} />;
}
