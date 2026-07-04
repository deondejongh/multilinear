/**
 * Run links section for the detail sidebar. Lists run links (icon per kind);
 * every kind is actionable (MLT-46): `pr` refs open in a new tab, `thread`
 * refs navigate to the t3code thread view (the environment is resolved from
 * the loaded thread shells — thread ids are environment-scoped upstream),
 * and `worktree` paths copy to the clipboard. "Add run link" opens a popover
 * with a kind select + ref input → `run-link.add`.
 */
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { PlusIcon } from "lucide-react";

import type { IssueId, RunLink, RunLinkId, RunLinkKind } from "@multilinear/core/model";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toastManager } from "~/components/ui/toast";
import { useThreadShells } from "~/state/entities";
import { newEntityId } from "../api";
import { RUN_LINK_KIND_LABELS, RUN_LINK_KIND_OPTIONS, runLinkIcon } from "../presentation";
import { useMultilinearStore } from "../store";

function isUrl(ref: string): boolean {
  return /^https?:\/\//i.test(ref);
}

function AddRunLinkPopover({
  issueId,
  onMutated,
}: {
  issueId: IssueId;
  onMutated?: (() => Promise<void> | void) | undefined;
}) {
  const runCommand = useMultilinearStore((state) => state.runCommand);
  const [kind, setKind] = useState<RunLinkKind>("thread");
  const [ref, setRef] = useState("");
  const [open, setOpen] = useState(false);

  const submit = useCallback(async () => {
    const trimmed = ref.trim();
    if (trimmed.length === 0) return;
    const runLinkId = newEntityId<RunLinkId>();
    await runCommand({ type: "run-link.add", runLinkId, issueId, kind, ref: trimmed });
    setRef("");
    setOpen(false);
    await onMutated?.();
  }, [issueId, kind, onMutated, ref, runCommand]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="outline" size="sm" className="w-full justify-start" />}
      >
        <PlusIcon className="size-3.5" />
        Add run link
      </PopoverTrigger>
      <PopoverPopup align="start" className="w-72 space-y-2 p-2">
        <Select value={kind} onValueChange={(next) => setKind(next as RunLinkKind)}>
          <SelectTrigger size="sm" className="w-full" aria-label="Run link kind">
            <SelectValue>{RUN_LINK_KIND_LABELS[kind]}</SelectValue>
          </SelectTrigger>
          <SelectPopup>
            {RUN_LINK_KIND_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        <Input
          autoFocus
          size="sm"
          placeholder={kind === "pr" ? "https://github.com/…" : "Reference"}
          value={ref}
          onChange={(event) => setRef(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <div className="flex justify-end">
          <Button size="xs" disabled={ref.trim().length === 0} onClick={() => void submit()}>
            Add
          </Button>
        </div>
      </PopoverPopup>
    </Popover>
  );
}

function RunLinkItem({ link }: { link: RunLink }) {
  const navigate = useNavigate();
  const shells = useThreadShells();
  const Icon = runLinkIcon(link.kind);
  const className =
    "flex w-full items-center gap-2 rounded-sm px-1 py-1 text-left text-xs text-foreground outline-none hover:bg-accent/50";

  if (link.kind === "pr" && isUrl(link.ref)) {
    return (
      <a href={link.ref} target="_blank" rel="noreferrer" className={className}>
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{link.ref}</span>
      </a>
    );
  }

  if (link.kind === "thread") {
    // Refs are a bare thread id or `environmentId/threadId`; bare ids find
    // their environment in the loaded shells. Unresolvable refs (archived,
    // disconnected environment) stay visible but explain themselves.
    const [refEnvironmentId, refThreadId] = link.ref.includes("/")
      ? (link.ref.split("/", 2) as [string, string])
      : [undefined, link.ref];
    const shell = shells.find(
      (candidate) =>
        candidate.id === refThreadId &&
        (refEnvironmentId === undefined || candidate.environmentId === refEnvironmentId),
    );
    return (
      <button
        type="button"
        className={className}
        onClick={() => {
          if (shell) {
            void navigate({
              to: "/$environmentId/$threadId",
              params: { environmentId: shell.environmentId, threadId: shell.id },
            });
          } else {
            toastManager.add({
              type: "info",
              title: "Thread not found",
              description: "It may be archived or in a disconnected environment.",
            });
          }
        }}
      >
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{shell ? shell.title : link.ref}</span>
      </button>
    );
  }

  // Worktree paths (and unknown-shaped refs): click copies the ref.
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link.ref);
          toastManager.add({ type: "success", title: "Path copied" });
        } catch {
          toastManager.add({ type: "error", title: "Copy failed" });
        }
      }}
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{link.ref}</span>
    </button>
  );
}

export function RunLinksSection({
  issueId,
  runLinks,
  onMutated,
}: {
  issueId: IssueId;
  runLinks: ReadonlyArray<RunLink>;
  onMutated?: (() => Promise<void> | void) | undefined;
}) {
  return (
    <div className="space-y-1">
      {runLinks.map((link) => (
        <RunLinkItem key={link.id} link={link} />
      ))}
      <AddRunLinkPopover issueId={issueId} onMutated={onMutated} />
    </div>
  );
}
