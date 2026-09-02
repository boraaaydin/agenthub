import { AgentConsole } from "../agent-console";
import { DEFAULT_AGENT_ID, getAgent } from "@/lib/agents";
import { readSettings } from "@/lib/settings-store";

export const dynamic = "force-dynamic";

export default async function ConsolePage() {
  let taskAgentLabel = getAgent(DEFAULT_AGENT_ID).label;

  try {
    const settings = await readSettings();
    taskAgentLabel = getAgent(settings.taskAgent).label;
  } catch (error) {
    console.error("Unable to read settings for console", error);
  }

  return <AgentConsole taskAgentLabel={taskAgentLabel} />;
}
