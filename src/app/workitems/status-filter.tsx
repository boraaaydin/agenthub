"use client";

import { useRouter } from "next/navigation";

import {
  WORKITEM_STATUSES,
  WORKITEM_STATUS_LABELS,
  workitemsHref,
  type WorkitemFilterStatus,
} from "@/lib/workitem-filters";

type StatusFilterProps = {
  projectId: string;
  selectedStatus: WorkitemFilterStatus;
};

export function StatusFilter({ projectId, selectedStatus }: StatusFilterProps) {
  const router = useRouter();

  function changeStatus(status: WorkitemFilterStatus) {
    router.push(workitemsHref({ projectId, status }));
  }

  return (
    <div className="sm:max-w-xs">
      <label className="block text-sm font-medium text-slate-800" htmlFor="status-filter">
        Status
      </label>
      <select
        id="status-filter"
        value={selectedStatus}
        onChange={(event) => changeStatus(event.target.value as WorkitemFilterStatus)}
        className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-3 focus:ring-sky-100"
      >
        <option value="active">Active</option>
        <option value="all">All</option>
        {WORKITEM_STATUSES.map((status) => (
          <option key={status} value={status}>{WORKITEM_STATUS_LABELS[status]}</option>
        ))}
      </select>
    </div>
  );
}
