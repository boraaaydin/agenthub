export type ProjectPromptTokens = {
  projectName: string;
  projectPath: string;
  projectSlug?: string;
};

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll("ı", "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function finalPathSegment(projectPath: string): string {
  return projectPath.trim().replace(/[\\/]+$/, "").split(/[\\/]/).at(-1) ?? "";
}

export function projectSlug({ projectName, projectPath, projectSlug: savedSlug }: ProjectPromptTokens): string {
  return savedSlug || slugify(projectName) || slugify(finalPathSegment(projectPath)) || "project";
}

export function applyPromptTokens(text: string, project: ProjectPromptTokens): string {
  const slug = projectSlug(project);
  return text.replace(/\{\{(PROJECT_NAME|PROJECT_SLUG)\}\}/g, (_match, token: string) => (
    token === "PROJECT_NAME" ? project.projectName : slug
  ));
}
