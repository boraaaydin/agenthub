import type { AgentId } from "../src/lib/agents";

const AGENT_COMMANDS: Record<AgentId, { command: string; args: string[] }> = {
  codex: { command: "codex", args: [] },
  claude: { command: "claude", args: [] },
};

export function getAgentCommand(agentId: AgentId) {
  return AGENT_COMMANDS[agentId];
}
