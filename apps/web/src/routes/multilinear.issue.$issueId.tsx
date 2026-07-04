import { createFileRoute, useParams } from "@tanstack/react-router";

import { IssueDetail } from "../multilinear/components/IssueDetail";

function MultilinearIssueDetailRoute() {
  // `strict: false` reads params without a typed route path — the generated
  // route tree does not yet include this route (see spec §Routes).
  const params = useParams({ strict: false });
  // ULID or short-id like `MLT-7` — resolved server-side (MLT-55).
  const issueRef = (params as { issueId?: string }).issueId ?? "";
  return <IssueDetail issueRef={issueRef} />;
}

export const Route = createFileRoute("/multilinear/issue/$issueId")({
  component: MultilinearIssueDetailRoute,
});
