import { Suspense } from "react";

import { AgentConsole } from "./agent-console";

export default function ConsolePage() {
  return (
    <Suspense fallback={null}>
      <AgentConsole />
    </Suspense>
  );
}
