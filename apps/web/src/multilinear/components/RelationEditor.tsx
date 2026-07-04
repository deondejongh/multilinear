/**
 * Relations section for the detail sidebar. Existing relations are grouped by
 * kind heading; each item links to the related issue and reveals a hover ✕ that
 * runs `relation.remove`. "Add relation" opens a popover with a kind select and
 * a debounced issue search (`mlListIssues({ search })`) → `relation.add`.
 */
import { useCallback, useEffect, useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";

import type { IssueId, RelationId, RelationKindInput } from "@multilinear/core/model";
import type { IssueSummary, RelationView } from "@multilinear/core/views";

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
import { Spinner } from "~/components/ui/spinner";
import { cn } from "~/lib/utils";
import { mlListIssues, newEntityId } from "../api";
import {
  RELATION_KIND_HEADINGS,
  RELATION_KIND_OPTIONS,
  RELATION_KIND_ORDER,
} from "../presentation";
import { useMultilinearStore } from "../store";
import { useTrackerNav } from "../useTrackerNav";

function AddRelationPopover({
  issueId,
  onMutated,
}: {
  issueId: IssueId;
  onMutated?: (() => Promise<void> | void) | undefined;
}) {
  const runCommand = useMultilinearStore((state) => state.runCommand);
  const [kind, setKind] = useState<RelationKindInput>("relates_to");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ReadonlyArray<IssueSummary>>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const term = search.trim();
    if (term.length === 0) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const result = await mlListIssues({ search: term });
        setResults(result.issues.filter((issue) => issue.id !== issueId).slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [issueId, open, search]);

  const pick = useCallback(
    async (target: IssueSummary) => {
      const relationId = newEntityId<RelationId>();
      await runCommand({ type: "relation.add", relationId, issueId, kind, targetId: target.id });
      setSearch("");
      setResults([]);
      setOpen(false);
      await onMutated?.();
    },
    [issueId, kind, onMutated, runCommand],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="outline" size="sm" className="w-full justify-start" />}
      >
        <PlusIcon className="size-3.5" />
        Add relation
      </PopoverTrigger>
      <PopoverPopup align="start" className="w-72 space-y-2 p-2">
        <Select value={kind} onValueChange={(next) => setKind(next as RelationKindInput)}>
          <SelectTrigger size="sm" className="w-full" aria-label="Relation kind">
            <SelectValue>{RELATION_KIND_HEADINGS[kind]}</SelectValue>
          </SelectTrigger>
          <SelectPopup>
            {RELATION_KIND_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        <Input
          autoFocus
          size="sm"
          placeholder="Search issues…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="max-h-56 overflow-y-auto">
          {searching ? (
            <div className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
              <Spinner className="size-3.5" />
              Searching…
            </div>
          ) : results.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              {search.trim().length === 0 ? "Type to search." : "No matches."}
            </p>
          ) : (
            results.map((issue) => (
              <button
                key={issue.id}
                type="button"
                onClick={() => void pick(issue)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none hover:bg-accent"
              >
                <span className="font-mono text-[11px] text-muted-foreground">{issue.shortId}</span>
                <span className="min-w-0 flex-1 truncate">{issue.title}</span>
              </button>
            ))
          )}
        </div>
      </PopoverPopup>
    </Popover>
  );
}

function RelationItem({
  relation,
  onMutated,
}: {
  relation: RelationView;
  onMutated?: (() => Promise<void> | void) | undefined;
}) {
  const runCommand = useMultilinearStore((state) => state.runCommand);
  const { goToIssue } = useTrackerNav();
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    setRemoving(true);
    try {
      await runCommand({ type: "relation.remove", relationId: relation.id });
      await onMutated?.();
    } catch {
      setRemoving(false);
    }
  };

  return (
    <div className="group flex items-center gap-2 rounded-sm px-1 py-1 hover:bg-accent/50">
      <button
        type="button"
        onClick={() => goToIssue(relation.otherShortId)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none"
      >
        <span className="font-mono text-[11px] text-muted-foreground">{relation.otherShortId}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-foreground">
          {relation.otherTitle}
        </span>
      </button>
      <button
        type="button"
        aria-label="Remove relation"
        disabled={removing}
        onClick={() => void remove()}
        className={cn(
          "shrink-0 text-muted-foreground/60 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100",
        )}
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}

export function RelationEditor({
  issueId,
  relations,
  onMutated,
}: {
  issueId: IssueId;
  relations: ReadonlyArray<RelationView>;
  onMutated?: (() => Promise<void> | void) | undefined;
}) {
  const grouped = RELATION_KIND_ORDER.map((kind) => ({
    kind,
    items: relations.filter((relation) => relation.kind === kind),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-2">
      {grouped.map((group) => (
        <div key={group.kind}>
          <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
            {RELATION_KIND_HEADINGS[group.kind]}
          </p>
          <div className="mt-0.5">
            {group.items.map((relation) => (
              <RelationItem key={relation.id} relation={relation} onMutated={onMutated} />
            ))}
          </div>
        </div>
      ))}
      <AddRelationPopover issueId={issueId} onMutated={onMutated} />
    </div>
  );
}
