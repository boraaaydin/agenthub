import { permanentRedirect } from "next/navigation";
export default async function LegacyProjectTaskPage(props: PageProps<"/projects/[id]/tasks/[taskId]">) { const { id, taskId } = await props.params; permanentRedirect(`/projects/${id}/workitems/${taskId}`); }
