import { createFileRoute } from "@tanstack/react-router";

import { TriageList } from "../multilinear/components/TriageList";
import { useMultilinearStore } from "../multilinear/store";

function MultilinearTriage() {
  const triageIssues = useMultilinearStore((state) => state.triageIssues);
  return <TriageList issues={triageIssues} />;
}

export const Route = createFileRoute("/multilinear/triage")({
  component: MultilinearTriage,
});
