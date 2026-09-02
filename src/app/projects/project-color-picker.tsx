"use client";

import { ProjectChip } from "../project-chip";
import { PROJECT_COLORS, type ProjectColorToken } from "@/lib/project-colors";

type ProjectColorPickerProps = {
  projectId: string;
  name: string;
  color: ProjectColorToken;
  onColorChange: (color: ProjectColorToken) => void;
  disabled?: boolean;
};

export function ProjectColorPicker({ projectId, name, color, onColorChange, disabled }: ProjectColorPickerProps) {
  return (
    <section aria-labelledby="project-color-label">
      <h2 id="project-color-label" className="text-sm font-medium text-slate-800">Project color</h2>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Project color palette">
        {PROJECT_COLORS.map((option) => {
          const isSelected = option.token === color;
          return (
            <button
              key={option.token}
              type="button"
              aria-label={option.label}
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onColorChange(option.token)}
              className={`h-8 w-8 rounded-full ${option.swatchClass} transition hover:scale-110 focus:outline-none focus:ring-3 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-50 ${isSelected ? "ring-2 ring-slate-900 ring-offset-2" : ""}`}
            />
          );
        })}
      </div>
      <div className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <p className="text-sm font-medium text-slate-800">Preview</p>
        <div className="mt-3 flex min-w-0 flex-wrap items-baseline gap-2">
          <ProjectChip projectId={projectId} name={name.trim() || "Project name"} color={color} />
          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Open</span>
          <span className="shrink-0 text-sm font-medium tabular-nums text-slate-500">#12</span>
          <span className="min-w-0 break-words font-medium text-slate-900">Task title</span>
        </div>
      </div>
    </section>
  );
}
