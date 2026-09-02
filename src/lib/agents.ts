export const AGENT_CATALOG = [
  {
    id: "codex",
    label: "Codex",
    command: "codex",
    args: [],
  },
] as const;

export type Agent = (typeof AGENT_CATALOG)[number];
export type AgentId = Agent["id"];

export const DEFAULT_AGENT_ID: AgentId = AGENT_CATALOG[0].id;

export function isAgentId(value: unknown): value is AgentId {
  return AGENT_CATALOG.some((agent) => agent.id === value);
}

export function getAgent(agentId: AgentId): Agent {
  return AGENT_CATALOG.find((agent) => agent.id === agentId)!;
}
