/**
 * "Start agent from issue": compile the issue's context pack and open a fresh
 * draft thread pre-filled with it.
 *
 * We reuse the upstream new-thread flow (`useHandleNewThread`) to create + route
 * to a draft with zero server round-trips, then look the created draft session
 * back up by project ref and set its composer prompt to the pack. If there is
 * no project to start a thread in, we fall back to copying the pack to the
 * clipboard and routing to the new-thread view.
 */
import { useCallback } from "react";

import { buildContextPack } from "@multilinear/core/context-pack";
import type { IssueDetail } from "@multilinear/core/views";

import { useComposerDraftStore } from "../composerDraftStore";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { toastManager } from "../components/ui/toast";

export type StartAgentOutcome = "draft" | "clipboard";

export function useStartAgentFromIssue() {
  const { handleNewThread, defaultProjectRef } = useHandleNewThread();

  return useCallback(
    async (detail: IssueDetail): Promise<StartAgentOutcome> => {
      const pack = buildContextPack(detail);

      if (defaultProjectRef) {
        await handleNewThread(defaultProjectRef);
        const session = useComposerDraftStore
          .getState()
          .getDraftSessionByProjectRef(defaultProjectRef);
        if (session) {
          useComposerDraftStore.getState().setPrompt(session.draftId, pack);
          return "draft";
        }
      }

      // Fallback: no project to route into, or the draft session couldn't be
      // resolved. Copy the pack so the operator can paste it wherever they run.
      try {
        await navigator.clipboard.writeText(pack);
        toastManager.add({
          type: "info",
          title: "Context pack copied",
          description: "No project available to open a draft; paste it into a new thread.",
        });
      } catch {
        toastManager.add({
          type: "error",
          title: "Could not start agent",
          description: "No project available and clipboard access was denied.",
        });
      }
      return "clipboard";
    },
    [defaultProjectRef, handleNewThread],
  );
}
