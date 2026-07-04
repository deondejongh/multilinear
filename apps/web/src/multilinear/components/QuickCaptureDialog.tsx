/**
 * Quick capture dialog (the `c` flow). Title (autofocus), optional description,
 * space select (defaults to the current space filter or the first space), and
 * a priority select. Cmd/Ctrl+Enter submits `issue.create` (status omitted →
 * Triage). A "Create more" checkbox keeps the dialog open for rapid entry.
 *
 * When no spaces exist yet, it renders the create-space form instead.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type { IssueId, Priority, SpaceId } from "@multilinear/core/model";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { newEntityId } from "../api";
import { useMultilinearStore } from "../store";
import { PrioritySelect } from "./PrioritySelect";
import { SpaceCreateDialog } from "./SpaceCreateDialog";

export function QuickCaptureDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const spaces = useMultilinearStore((state) => state.spaces);
  const filterSpaceId = useMultilinearStore((state) => state.filter.spaceId);
  const runCommand = useMultilinearStore((state) => state.runCommand);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [spaceId, setSpaceId] = useState<SpaceId | null>(null);
  const [priority, setPriority] = useState<Priority>(0);
  const [createMore, setCreateMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Default the space to the current filter or the first space each time the
  // dialog opens (or when spaces change while open).
  useEffect(() => {
    if (!open) return;
    const preferred = filterSpaceId ?? spaces[0]?.id ?? null;
    setSpaceId((current) => current ?? preferred);
  }, [open, filterSpaceId, spaces]);

  const resetFields = useCallback(() => {
    setTitle("");
    setDescription("");
    setPriority(0);
    setError(null);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        resetFields();
        setSpaceId(null);
        setCreateMore(false);
      }
      onOpenChange(next);
    },
    [onOpenChange, resetFields],
  );

  const trimmedTitle = title.trim();
  const canSubmit = trimmedTitle.length > 0 && spaceId !== null && !submitting;

  const submit = useCallback(async () => {
    if (!canSubmit || spaceId === null) return;
    setSubmitting(true);
    setError(null);
    const issueId = newEntityId<IssueId>();
    try {
      await runCommand({
        type: "issue.create",
        issueId,
        spaceId,
        title: trimmedTitle,
        description: description.trim(),
        priority,
        issueType: "work",
        labelIds: [],
      });
      setSubmitting(false);
      if (createMore) {
        resetFields();
        titleRef.current?.focus();
      } else {
        handleOpenChange(false);
      }
    } catch (cause) {
      setSubmitting(false);
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [
    canSubmit,
    createMore,
    description,
    handleOpenChange,
    priority,
    resetFields,
    runCommand,
    spaceId,
    trimmedTitle,
  ]);

  const onComposerKeyDown = (event: {
    key: string;
    metaKey: boolean;
    ctrlKey: boolean;
    preventDefault: () => void;
  }) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  };

  // No spaces yet: send the user straight to space creation.
  if (spaces.length === 0) {
    return <SpaceCreateDialog open={open} onOpenChange={handleOpenChange} />;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New issue</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 px-6 py-4">
          <Input
            ref={titleRef}
            autoFocus
            size="lg"
            placeholder="Issue title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={onComposerKeyDown}
          />
          <Textarea
            placeholder="Add a description… (markdown)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onKeyDown={onComposerKeyDown}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={spaceId ?? undefined}
              onValueChange={(next) => setSpaceId(next as SpaceId)}
            >
              <SelectTrigger size="sm" className="w-auto min-w-32" aria-label="Space">
                <SelectValue>
                  {spaces.find((space) => space.id === spaceId)?.name ?? "Space"}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {spaces.map((space) => (
                  <SelectItem key={space.id} value={space.id}>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {space.key}
                      </span>
                      {space.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <PrioritySelect value={priority} onChange={setPriority} className="w-auto min-w-32" />
          </div>
          {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="items-center">
          <label className="me-auto flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={createMore}
              onCheckedChange={(checked) => setCreateMore(checked === true)}
            />
            Create more
          </label>
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!canSubmit} onClick={() => void submit()}>
            <span className={cn(submitting && "opacity-70")}>Create issue</span>
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
