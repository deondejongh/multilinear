/**
 * Issue detail: two-column Linear-style layout. Main column holds the editable
 * title, description (ChatMarkdown, Edit → textarea), comments, and the activity
 * feed. The sidebar holds status, priority, type, labels, relations, and run
 * links. Detail + activity are loaded locally and refetched after each
 * mutation; the space's statuses are loaded once for name resolution and the
 * status select.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCopyIcon, FileCheckIcon, PauseCircleIcon, PlayIcon } from "lucide-react";

import type {
  CommentId,
  IssueId,
  IssueType,
  Priority,
  Status,
  StatusId,
} from "@multilinear/core/model";
import type { IssueDetail as IssueDetailView, ProofView } from "@multilinear/core/views";
import type { Comment } from "@multilinear/core/model";
import type { StoredTrackerEvent } from "@multilinear/core/events";
import { buildContextPack } from "@multilinear/core/context-pack";
import { renderProofMarkdown } from "@multilinear/core/proof";
import { ISSUE_TEMPLATE } from "@multilinear/core/ready-gate";

import ChatMarkdown from "~/components/ChatMarkdown";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { toastManager } from "~/components/ui/toast";
import { formatRelativeTimeLabel } from "~/timestampFormat";
import { mlGetIssue, mlIssueActivity, mlListStatuses, newEntityId } from "../api";
import { ISSUE_TYPE_OPTIONS, ISSUE_TYPE_LABELS } from "../presentation";
import { useMultilinearStore } from "../store";
import { useStartAgentFromIssue } from "../useStartAgentFromIssue";
import { ActivityFeed } from "./ActivityFeed";
import { LabelPicker } from "./LabelPicker";
import { ProfilePicker } from "./ProfilePicker";
import { PrioritySelect } from "./PrioritySelect";
import { useReadyGateGuard } from "./ReadyGateDialog";
import { RelationEditor } from "./RelationEditor";
import { RunLinksSection } from "./RunLinksSection";
import { StatusSelect } from "./StatusSelect";

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
        {title}
      </p>
      {children}
    </div>
  );
}

export function IssueDetail({ issueRef }: { issueRef: string }) {
  const runCommand = useMultilinearStore((state) => state.runCommand);
  const storeLabels = useMultilinearStore((state) => state.labels);
  const profiles = useMultilinearStore((state) => state.profiles);
  const profileErrors = useMultilinearStore((state) => state.profileErrors);
  const startAgent = useStartAgentFromIssue();
  const readyGate = useReadyGateGuard();

  const [detail, setDetail] = useState<IssueDetailView | null>(null);
  const [activity, setActivity] = useState<ReadonlyArray<StoredTrackerEvent>>([]);
  const [statuses, setStatuses] = useState<ReadonlyArray<Status>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [titleDraft, setTitleDraft] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [startingAgent, setStartingAgent] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);

  const loadedSpaceRef = useRef<string | null>(null);

  // The route param may be a short-id (MLT-55); commands need the canonical
  // ULID, which the loaded detail carries. Every mutation below can only fire
  // once the detail has rendered, so the fallback cast is never observed.
  const issueId = detail?.issue.id ?? (issueRef as IssueId);

  const load = useCallback(async () => {
    try {
      const [issueResult, activityResult] = await Promise.all([
        mlGetIssue(issueRef),
        mlIssueActivity(issueRef),
      ]);
      setDetail(issueResult.detail);
      setActivity(activityResult.entries);
      setTitleDraft(issueResult.detail.issue.title);
      if (loadedSpaceRef.current !== issueResult.detail.space.id) {
        loadedSpaceRef.current = issueResult.detail.space.id;
        const statusResult = await mlListStatuses(issueResult.detail.space.id);
        setStatuses(statusResult.statuses);
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [issueRef]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Run a command, then refetch this issue's detail + activity (and the board).
  const mutate = useCallback(
    async (command: Parameters<typeof runCommand>[0]) => {
      await runCommand(command);
      await load();
    },
    [load, runCommand],
  );

  const saveTitle = useCallback(async () => {
    if (!detail) return;
    const next = titleDraft.trim();
    if (next.length === 0 || next === detail.issue.title) {
      setTitleDraft(detail.issue.title);
      return;
    }
    await mutate({ type: "issue.update", issueId, title: next });
  }, [detail, issueId, mutate, titleDraft]);

  const saveDescription = useCallback(async () => {
    await mutate({ type: "issue.update", issueId, description: descriptionDraft });
    setEditingDescription(false);
  }, [descriptionDraft, issueId, mutate]);

  const submitComment = useCallback(async () => {
    const body = commentDraft.trim();
    if (body.length === 0) return;
    const commentId = newEntityId<CommentId>();
    await mutate({ type: "comment.add", commentId, issueId, body });
    setCommentDraft("");
  }, [commentDraft, issueId, mutate]);

  const resolvedProfile = useMemo(
    () =>
      selectedProfile !== null
        ? profiles.find((profile) => profile.name === selectedProfile)
        : undefined,
    [profiles, selectedProfile],
  );

  const copyContextPack = useCallback(async () => {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(
        buildContextPack(detail, resolvedProfile ? { profile: resolvedProfile } : undefined),
      );
      toastManager.add({ type: "success", title: "Context pack copied" });
    } catch {
      toastManager.add({
        type: "error",
        title: "Copy failed",
        description: "Clipboard unavailable.",
      });
    }
  }, [detail, resolvedProfile]);

  if (loading && !detail) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!detail) return null;

  const { issue, space } = detail;

  // The detail view carries only *applied* labels; merge the store's space
  // labels so the picker can offer every label without an extra query.
  const spaceLabelMap = new Map(
    storeLabels.filter((label) => label.spaceId === space.id).map((label) => [label.id, label]),
  );
  for (const label of detail.labels) spaceLabelMap.set(label.id, label);
  const spaceLabels = [...spaceLabelMap.values()];

  // Interleave comments and proofs by createdAt so proof-of-work reads inline
  // with the discussion (03-PHASE-2 §B).
  type ThreadItem =
    | { kind: "comment"; createdAt: string; comment: Comment }
    | { kind: "proof"; createdAt: string; proof: ProofView };
  const threadItems: ThreadItem[] = [
    ...detail.comments.map(
      (comment): ThreadItem => ({ kind: "comment", createdAt: comment.createdAt, comment }),
    ),
    ...detail.proofs.map(
      (proof): ThreadItem => ({ kind: "proof", createdAt: proof.createdAt, proof }),
    ),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // Ready-gate guard (§E): moving into a `ready` status warns when the
  // description isn't specified well enough for an agent to pick up.
  const changeStatus = (statusId: StatusId) => {
    const target = statuses.find((status) => status.id === statusId);
    const commit = () => void mutate({ type: "status.change", issueId, statusId });
    if (target?.category === "ready") {
      readyGate.guard(issue.description, commit);
    } else {
      commit();
    }
  };

  const resolveDuplicate = (accept: boolean) =>
    void mutate({ type: "duplicate.resolve", issueId, accept });

  return (
    <div className="flex h-full min-h-0">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{space.name}</span>
            <span>/</span>
            <span className="font-mono">{detail.shortId}</span>
            <div className="ms-auto flex items-center gap-1.5">
              <ProfilePicker
                profiles={profiles}
                errors={profileErrors}
                value={selectedProfile}
                onChange={setSelectedProfile}
              />
              <Button
                size="sm"
                disabled={startingAgent}
                onClick={async () => {
                  setStartingAgent(true);
                  try {
                    await startAgent(detail, resolvedProfile);
                  } finally {
                    setStartingAgent(false);
                  }
                }}
              >
                <PlayIcon className="size-3.5" />
                Start agent from issue
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Copy context pack"
                onClick={() => void copyContextPack()}
              >
                <ClipboardCopyIcon className="size-4" />
              </Button>
            </div>
          </div>

          {issue.pendingDuplicateStatusId !== null ? (
            <Alert variant="info">
              <AlertTitle>An agent proposed this is a duplicate</AlertTitle>
              <AlertDescription>
                Confirm to move this issue to the duplicate status, or reject to keep it as is.
              </AlertDescription>
              <AlertAction>
                <Button size="sm" onClick={() => resolveDuplicate(true)}>
                  Confirm duplicate
                </Button>
                <Button variant="outline" size="sm" onClick={() => resolveDuplicate(false)}>
                  Reject
                </Button>
              </AlertAction>
            </Alert>
          ) : null}

          <input
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={() => void saveTitle()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                setTitleDraft(issue.title);
                event.currentTarget.blur();
              }
            }}
            className="w-full rounded-md bg-transparent text-xl font-semibold text-foreground outline-none focus-visible:bg-accent/40 focus-visible:px-1"
            aria-label="Issue title"
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                Description
              </p>
              {!editingDescription ? (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setDescriptionDraft(issue.description);
                    setEditingDescription(true);
                  }}
                >
                  Edit
                </Button>
              ) : null}
            </div>
            {editingDescription ? (
              <div className="space-y-2">
                <Textarea
                  autoFocus
                  value={descriptionDraft}
                  onChange={(event) => setDescriptionDraft(event.target.value)}
                />
                <div className="flex items-center justify-end gap-1.5">
                  {descriptionDraft.trim().length === 0 ? (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="me-auto"
                      onClick={() => setDescriptionDraft(ISSUE_TEMPLATE)}
                    >
                      Insert template
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="xs" onClick={() => setEditingDescription(false)}>
                    Cancel
                  </Button>
                  <Button size="xs" onClick={() => void saveDescription()}>
                    Save
                  </Button>
                </div>
              </div>
            ) : issue.description.trim().length > 0 ? (
              <div className="text-sm text-foreground">
                <ChatMarkdown text={issue.description} cwd={undefined} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/70">No description.</p>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
              Comments
            </p>
            <div className="space-y-3">
              {threadItems.map((item) =>
                item.kind === "comment" ? (
                  <div key={item.comment.id} className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/90">
                        {item.comment.actor.id}
                      </span>
                      <span>· {formatRelativeTimeLabel(item.comment.createdAt)}</span>
                    </div>
                    <div className="text-sm text-foreground">
                      <ChatMarkdown text={item.comment.body} cwd={undefined} />
                    </div>
                  </div>
                ) : (
                  <div
                    key={item.proof.id}
                    className="space-y-1 rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileCheckIcon className="size-3.5 text-success" />
                      <span className="font-medium text-foreground/90">
                        Proof of work from {item.proof.actor.id}
                      </span>
                      <span>· {formatRelativeTimeLabel(item.proof.createdAt)}</span>
                    </div>
                    <div className="text-sm text-foreground">
                      <ChatMarkdown text={renderProofMarkdown(item.proof.proof)} cwd={undefined} />
                    </div>
                  </div>
                ),
              )}
              {threadItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">No comments yet.</p>
              ) : null}
            </div>
            {issue.agentBlocked ? (
              <Alert variant="warning">
                <PauseCircleIcon className="size-4" />
                <AlertTitle>An agent is waiting for input</AlertTitle>
                <AlertDescription>
                  Reply below to answer the agent&apos;s question; posting a comment clears the
                  block.
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Textarea
                placeholder="Leave a comment… (⌘↵ to submit)"
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    void submitComment();
                  }
                }}
              />
              <div className="flex justify-end">
                <Button
                  size="xs"
                  disabled={commentDraft.trim().length === 0}
                  onClick={() => void submitComment()}
                >
                  {issue.agentBlocked ? "Reply to agent" : "Comment"}
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
              Activity
            </p>
            <ActivityFeed entries={activity} statuses={statuses} labels={spaceLabels} />
          </div>
        </div>
      </div>

      <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-border p-4 lg:block">
        <div className="space-y-5">
          <SidebarSection title="Status">
            <StatusSelect
              statuses={statuses}
              value={issue.statusId}
              onChange={(statusId: StatusId) => changeStatus(statusId)}
            />
          </SidebarSection>

          <SidebarSection title="Priority">
            <PrioritySelect
              value={issue.priority}
              onChange={(priority: Priority) =>
                void mutate({ type: "issue.update", issueId, priority })
              }
              className="w-full"
            />
          </SidebarSection>

          <SidebarSection title="Type">
            <Select
              value={issue.type}
              onValueChange={(next) =>
                void mutate({ type: "issue.update", issueId, issueType: next as IssueType })
              }
            >
              <SelectTrigger size="sm" className="w-full" aria-label="Type">
                <SelectValue>{ISSUE_TYPE_LABELS[issue.type]}</SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {ISSUE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </SidebarSection>

          <SidebarSection title="Labels">
            <LabelPicker
              issueId={issueId}
              spaceId={space.id}
              spaceLabels={spaceLabels}
              appliedLabels={detail.labels}
              onMutated={load}
            />
          </SidebarSection>

          <SidebarSection title="Relations">
            <RelationEditor issueId={issueId} relations={detail.relations} onMutated={load} />
          </SidebarSection>

          <SidebarSection title="Run links">
            <RunLinksSection issueId={issueId} runLinks={detail.runLinks} onMutated={load} />
          </SidebarSection>
        </div>
      </aside>

      {readyGate.dialog}
    </div>
  );
}
