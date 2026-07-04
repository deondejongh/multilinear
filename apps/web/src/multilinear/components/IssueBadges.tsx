/**
 * Agent-state badges shared by the board card and list row: an "Agent blocked"
 * badge when the agent is waiting on a human (03-PHASE-2 §A), and a subtler
 * "Duplicate?" badge when an agent's duplicate proposal is pending human
 * confirmation (§C). One component so card and row stay in agreement.
 */
import { HelpCircleIcon, PauseCircleIcon } from "lucide-react";

import type { IssueSummary } from "@multilinear/core/views";

import { Badge } from "~/components/ui/badge";

export function AgentBlockedBadge() {
  return (
    <Badge variant="warning" size="sm" className="gap-1 font-normal">
      <PauseCircleIcon className="size-3" />
      Agent blocked
    </Badge>
  );
}

export function PendingDuplicateBadge() {
  return (
    <Badge variant="secondary" size="sm" className="gap-1 font-normal text-muted-foreground">
      <HelpCircleIcon className="size-3" />
      Duplicate?
    </Badge>
  );
}

/** True when the issue carries any agent-state badge worth rendering. */
export function hasAgentBadges(issue: IssueSummary): boolean {
  return issue.agentBlocked || issue.pendingDuplicate;
}

/** Renders whichever agent-state badges apply; nothing when none do. */
export function IssueBadges({ issue }: { issue: IssueSummary }) {
  if (!hasAgentBadges(issue)) return null;
  return (
    <>
      {issue.agentBlocked ? <AgentBlockedBadge /> : null}
      {issue.pendingDuplicate ? <PendingDuplicateBadge /> : null}
    </>
  );
}
