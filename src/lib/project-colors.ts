export const PROJECT_COLORS = [
  { token: "slate", label: "Slate", chipClass: "bg-slate-700 text-white", swatchClass: "bg-slate-700" },
  { token: "red", label: "Red", chipClass: "bg-red-700 text-white", swatchClass: "bg-red-700" },
  { token: "orange", label: "Orange", chipClass: "bg-orange-700 text-white", swatchClass: "bg-orange-700" },
  { token: "amber", label: "Amber", chipClass: "bg-amber-700 text-white", swatchClass: "bg-amber-700" },
  { token: "emerald", label: "Emerald", chipClass: "bg-emerald-700 text-white", swatchClass: "bg-emerald-700" },
  { token: "teal", label: "Teal", chipClass: "bg-teal-700 text-white", swatchClass: "bg-teal-700" },
  { token: "cyan", label: "Cyan", chipClass: "bg-cyan-700 text-white", swatchClass: "bg-cyan-700" },
  { token: "sky", label: "Sky", chipClass: "bg-sky-700 text-white", swatchClass: "bg-sky-700" },
  { token: "blue", label: "Blue", chipClass: "bg-blue-700 text-white", swatchClass: "bg-blue-700" },
  { token: "indigo", label: "Indigo", chipClass: "bg-indigo-700 text-white", swatchClass: "bg-indigo-700" },
  { token: "violet", label: "Violet", chipClass: "bg-violet-700 text-white", swatchClass: "bg-violet-700" },
  { token: "fuchsia", label: "Fuchsia", chipClass: "bg-fuchsia-700 text-white", swatchClass: "bg-fuchsia-700" },
  { token: "rose", label: "Rose", chipClass: "bg-rose-700 text-white", swatchClass: "bg-rose-700" },
] as const;

export type ProjectColorToken = (typeof PROJECT_COLORS)[number]["token"];

export function isProjectColorToken(value: unknown): value is ProjectColorToken {
  return typeof value === "string" && PROJECT_COLORS.some((color) => color.token === value);
}

export function fallbackProjectColor(projectId: string): ProjectColorToken {
  let hash = 0;
  for (let index = 0; index < projectId.length; index += 1) {
    hash = (hash * 31 + projectId.charCodeAt(index)) | 0;
  }
  return PROJECT_COLORS[(hash >>> 0) % PROJECT_COLORS.length].token;
}

export function projectColorToken(projectId: string, color?: string | null): ProjectColorToken {
  return isProjectColorToken(color) ? color : fallbackProjectColor(projectId);
}

export function projectChipClass(token: ProjectColorToken): string {
  return PROJECT_COLORS.find((color) => color.token === token)?.chipClass ?? PROJECT_COLORS[0].chipClass;
}
