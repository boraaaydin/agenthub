import type { AgentId } from "../src/lib/agents";

const AGENT_COMMANDS: Record<AgentId, { command: string; args: string[] }> = {
  codex: { command: "codex", args: [] },
  claude: { command: "claude", args: [] },
};

export function getAgentCommand(agentId: AgentId, initialPrompt?: string) {
  const definition = AGENT_COMMANDS[agentId];
  return {
    ...definition,
    args: initialPrompt?.trim() ? [...definition.args, initialPrompt] : definition.args,
  };
}
