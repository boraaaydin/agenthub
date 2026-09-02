import type { AgentId } from "@/lib/agents";

type AgentLogoProps = {
  agent: AgentId;
  className?: string;
};

export function AgentLogo({ agent, className }: AgentLogoProps) {
  switch (agent) {
    case "codex":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className={className}>
          <ellipse cx="8" cy="8" rx="5.5" ry="2.75" />
          <ellipse cx="8" cy="8" rx="5.5" ry="2.75" transform="rotate(60 8 8)" />
          <ellipse cx="8" cy="8" rx="5.5" ry="2.75" transform="rotate(120 8 8)" />
        </svg>
      );
    case "claude":
      return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
          <path fill="currentColor" d="M7.25 1.6c.2-.92 1.3-.92 1.5 0l-.3 3.2c-.04.47-.86.47-.9 0Z" />
          <path fill="currentColor" d="M7.25 1.6c.2-.92 1.3-.92 1.5 0l-.3 3.2c-.04.47-.86.47-.9 0Z" transform="rotate(45 8 8)" />
          <path fill="currentColor" d="M7.25 1.6c.2-.92 1.3-.92 1.5 0l-.3 3.2c-.04.47-.86.47-.9 0Z" transform="rotate(90 8 8)" />
          <path fill="currentColor" d="M7.25 1.6c.2-.92 1.3-.92 1.5 0l-.3 3.2c-.04.47-.86.47-.9 0Z" transform="rotate(135 8 8)" />
          <path fill="currentColor" d="M7.25 1.6c.2-.92 1.3-.92 1.5 0l-.3 3.2c-.04.47-.86.47-.9 0Z" transform="rotate(180 8 8)" />
          <path fill="currentColor" d="M7.25 1.6c.2-.92 1.3-.92 1.5 0l-.3 3.2c-.04.47-.86.47-.9 0Z" transform="rotate(225 8 8)" />
          <path fill="currentColor" d="M7.25 1.6c.2-.92 1.3-.92 1.5 0l-.3 3.2c-.04.47-.86.47-.9 0Z" transform="rotate(270 8 8)" />
          <path fill="currentColor" d="M7.25 1.6c.2-.92 1.3-.92 1.5 0l-.3 3.2c-.04.47-.86.47-.9 0Z" transform="rotate(315 8 8)" />
          <circle cx="8" cy="8" r="2.1" fill="currentColor" />
        </svg>
      );
  }

  const unsupportedAgent: never = agent;
  throw new Error(`Unsupported agent logo: ${unsupportedAgent}`);
}
