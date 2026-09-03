"use client";

import { useRouter } from "next/navigation";

import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  tasksHref,
  type TaskFilterStatus,
} from "@/lib/task-filters";

type StatusFilterProps = {
  projectId: string;
  selectedStatus: TaskFilterStatus;
};

export function StatusFilter({ projectId, selectedStatus }: StatusFilterProps) {
  const router = useRouter();

  function changeStatus(status: TaskFilterStatus) {
    router.push(tasksHref({ projectId, status }));
  }

  return (
    <div className="sm:max-w-xs">
      <label className="block text-sm font-medium text-slate-800" htmlFor="status-filter">
        Status
      </label>
      <select
        id="status-filter"
        value={selectedStatus}
        onChange={(event) => changeStatus(event.target.value as TaskFilterStatus)}
        className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100"
      >
        <option value="active">Active</option>
        <option value="all">All</option>
        {TASK_STATUSES.map((status) => (
          <option key={status} value={status}>{TASK_STATUS_LABELS[status]}</option>
        ))}
      </select>
    </div>
  );
}
