/** Navigation helpers for the tracker's own routes. */
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import type { IssueId } from "@multilinear/core/model";

export function useTrackerNav() {
  const navigate = useNavigate();

  const goToBoard = useCallback(() => {
    void navigate({ to: "/multilinear" });
  }, [navigate]);

  const goToTriage = useCallback(() => {
    void navigate({ to: "/multilinear/triage" });
  }, [navigate]);

  const goToIssue = useCallback(
    (issueId: IssueId) => {
      void navigate({ to: "/multilinear/issue/$issueId", params: { issueId } });
    },
    [navigate],
  );

  return { goToBoard, goToTriage, goToIssue };
}
