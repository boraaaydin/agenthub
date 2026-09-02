export const AGENTS = [
  { id: "codex", label: "Codex" },
  { id: "claude", label: "Claude Code" },
] as const;

export type Agent = (typeof AGENTS)[number];
export type AgentId = Agent["id"];

export const DEFAULT_AGENT_ID: AgentId = "codex";

export function isAgentId(value: unknown): value is AgentId {
  return AGENTS.some((agent) => agent.id === value);
}

export function getAgent(agentId: AgentId): Agent {
  return AGENTS.find((agent) => agent.id === agentId)!;
}
