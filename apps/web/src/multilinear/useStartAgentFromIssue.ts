/**
 * "Start agent from issue": compile the issue's context pack and open a draft
 * thread pre-filled with it.
 *
 * The composer editor seeds itself from the draft store when it mounts, so the
 * pack must be in the store BEFORE we navigate (MLT-44: setting it after
 * upstream `handleNewThread` navigated left the composer empty). We therefore
 * create/reuse the draft session ourselves — mirroring the reuse/create logic
 * of `useHandleNewThread` (watch that file for upstream drift) — then
 * `setPrompt`, then navigate. If there is no project to start a thread in, we
 * fall back to copying the pack to the clipboard.
 */
import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

import { scopedProjectKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { DEFAULT_RUNTIME_MODE, DEFAULT_SERVER_SETTINGS } from "@t3tools/contracts";

import { buildContextPack } from "@multilinear/core/context-pack";
import type { WorkflowProfile } from "@multilinear/core/profile";
import type { IssueDetail } from "@multilinear/core/views";

import { useComposerDraftStore } from "../composerDraftStore";
import { toastManager } from "../components/ui/toast";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { useClientSettings } from "../hooks/useSettings";
import { resolveNewDraftStartFromOrigin } from "../lib/chatThreadActions";
import { newDraftId, newThreadId } from "../lib/utils";
import {
  deriveLogicalProjectKeyFromSettings,
  selectProjectGroupingSettings,
} from "../logicalProject";
import { readThreadShell, useProjects, useServerConfigs } from "../state/entities";

export type StartAgentOutcome = "draft" | "clipboard";

export function useStartAgentFromIssue() {
  const { defaultProjectRef } = useHandleNewThread();
  const projects = useProjects();
  const serverConfigs = useServerConfigs();
  const projectGroupingSettings = useClientSettings(selectProjectGroupingSettings);
  const router = useRouter();

  return useCallback(
    async (detail: IssueDetail, profile?: WorkflowProfile): Promise<StartAgentOutcome> => {
      const pack = buildContextPack(detail, profile ? { profile } : undefined);

      if (defaultProjectRef) {
        const store = useComposerDraftStore.getState();
        const project = projects.find(
          (candidate) =>
            candidate.id === defaultProjectRef.projectId &&
            candidate.environmentId === defaultProjectRef.environmentId,
        );
        const logicalProjectKey = project
          ? deriveLogicalProjectKeyFromSettings(project, projectGroupingSettings)
          : scopedProjectKey(defaultProjectRef);

        // Reuse the project's unpromoted draft if one exists (same rule as
        // useHandleNewThread), else mint a fresh draft session.
        const stored = store.getDraftSessionByLogicalProjectKey(logicalProjectKey);
        const reusable =
          stored && readThreadShell(scopeThreadRef(stored.environmentId, stored.threadId)) === null
            ? stored
            : null;

        let draftId;
        if (reusable) {
          draftId = reusable.draftId;
          store.setLogicalProjectDraftThreadId(logicalProjectKey, defaultProjectRef, draftId, {
            threadId: reusable.threadId,
          });
        } else {
          draftId = newDraftId();
          const environmentSettings =
            serverConfigs.get(defaultProjectRef.environmentId)?.settings ?? DEFAULT_SERVER_SETTINGS;
          const initialEnvMode = environmentSettings.defaultThreadEnvMode;
          store.setLogicalProjectDraftThreadId(logicalProjectKey, defaultProjectRef, draftId, {
            threadId: newThreadId(),
            createdAt: new Date().toISOString(),
            branch: null,
            worktreePath: null,
            envMode: initialEnvMode,
            startFromOrigin: resolveNewDraftStartFromOrigin({
              envMode: initialEnvMode,
              newWorktreesStartFromOrigin: environmentSettings.newWorktreesStartFromOrigin,
            }),
            runtimeMode: DEFAULT_RUNTIME_MODE,
          });
          store.applyStickyState(draftId);
        }

        // The fix for MLT-44: prompt goes in before the composer mounts.
        useComposerDraftStore.getState().setPrompt(draftId, pack);
        await router.navigate({ to: "/draft/$draftId", params: { draftId } });
        return "draft";
      }

      // Fallback: no project to route into. Copy the pack so the operator can
      // paste it wherever they run.
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
    [defaultProjectRef, projectGroupingSettings, projects, router, serverConfigs],
  );
}
