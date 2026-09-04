import { projectChipClass, projectColorToken } from "@/lib/project-colors";

type ProjectChipProps = {
  projectId: string;
  name: string;
  color?: string | null;
  className?: string;
};

const chipGeometry = "shrink-0 rounded-md px-2 py-0.5 text-xs font-medium";

export function ProjectChip({ projectId, name, color, className }: ProjectChipProps) {
  return (
    <span className={`${chipGeometry} ${projectChipClass(projectColorToken(projectId, color))}${className ? ` ${className}` : ""}`}>
      {name}
    </span>
  );
}

export function UnknownProjectChip({ className }: { className?: string }) {
  return <span className={`${chipGeometry} bg-slate-100 text-slate-600${className ? ` ${className}` : ""}`}>Unknown project</span>;
}

export function ApplicationChip({ name, className }: { name: string; className?: string }) {
  return <span className={`${chipGeometry} bg-violet-50 text-violet-800${className ? ` ${className}` : ""}`}>{name}</span>;
}

export function UnknownApplicationChip({ className }: { className?: string }) {
  return <span className={`${chipGeometry} bg-slate-100 text-slate-600${className ? ` ${className}` : ""}`}>Unknown application</span>;
}
