import { permanentRedirect } from "next/navigation";
export default async function LegacyPlanPage(props: PageProps<"/plans/[planId]">) { const { planId } = await props.params; permanentRedirect(`/tasks/${planId}`); }
