import { createFileRoute, useParams } from "@tanstack/react-router";

import type { IssueId } from "@multilinear/core/model";

import { IssueDetail } from "../multilinear/components/IssueDetail";

function MultilinearIssueDetailRoute() {
  // `strict: false` reads params without a typed route path — the generated
  // route tree does not yet include this route (see spec §Routes).
  const params = useParams({ strict: false });
  const issueId = (params as { issueId?: string }).issueId ?? "";
  return <IssueDetail issueId={issueId as IssueId} />;
}

export const Route = createFileRoute("/multilinear/issue/$issueId")({
  component: MultilinearIssueDetailRoute,
});
