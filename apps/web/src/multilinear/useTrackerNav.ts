/** Navigation helpers for the tracker's own routes. */
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

export function useTrackerNav() {
  const navigate = useNavigate();

  const goToBoard = useCallback(() => {
    void navigate({ to: "/multilinear" });
  }, [navigate]);

  const goToTriage = useCallback(() => {
    void navigate({ to: "/multilinear/triage" });
  }, [navigate]);

  // Accepts a ULID or a short-id like `MLT-7`; prefer short-ids so shared
  // URLs stay readable (the detail route resolves both, MLT-55).
  const goToIssue = useCallback(
    (issueRef: string) => {
      void navigate({ to: "/multilinear/issue/$issueId", params: { issueId: issueRef } });
    },
    [navigate],
  );

  return { goToBoard, goToTriage, goToIssue };
}
