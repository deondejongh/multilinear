/**
 * Space repo mapping editor (MLT-47): the absolute repo roots a space maps
 * to (01-ARCHITECTURE §5, a space maps to ≥1 repos). Start-agent opens
 * drafts in the matching project, and workflow profiles load from each
 * mapped repo's `.multilinear/profiles/` (MLT-51). Saves via `space.update`.
 */
import { useCallback, useEffect, useState } from "react";
import { FolderIcon, XIcon } from "lucide-react";

import type { Space } from "@multilinear/core/model";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { useMultilinearStore } from "../store";

export function SpaceReposDialog({
  space,
  onOpenChange,
}: {
  /** The space being edited; null keeps the dialog closed. */
  space: Space | null;
  onOpenChange: (open: boolean) => void;
}) {
  const runCommand = useMultilinearStore((state) => state.runCommand);
  const [paths, setPaths] = useState<ReadonlyArray<string>>([]);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (space !== null) {
      setPaths(space.repoPaths);
      setDraft("");
      setError(null);
      setSubmitting(false);
    }
  }, [space]);

  const addDraft = useCallback(() => {
    const value = draft.trim();
    if (value === "" || paths.includes(value)) return;
    setPaths([...paths, value]);
    setDraft("");
  }, [draft, paths]);

  const submit = useCallback(async () => {
    if (space === null || submitting) return;
    setSubmitting(true);
    setError(null);
    // An unsubmitted draft path still counts — pressing Save right after
    // typing shouldn't silently drop it.
    const value = draft.trim();
    const repoPaths = value !== "" && !paths.includes(value) ? [...paths, value] : paths;
    try {
      await runCommand({ type: "space.update", spaceId: space.id, repoPaths });
      onOpenChange(false);
    } catch (cause) {
      setSubmitting(false);
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [draft, onOpenChange, paths, runCommand, space, submitting]);

  return (
    <Dialog open={space !== null} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Repositories{space ? ` — ${space.name}` : ""}</DialogTitle>
          <DialogDescription>
            Absolute repo roots this space maps to. Start agent opens drafts in the matching
            project; workflow profiles load from each repo&apos;s{" "}
            <span className="font-mono">.multilinear/profiles/</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-6 py-4">
          {paths.length > 0 ? (
            <ul className="space-y-1">
              {paths.map((path) => (
                <li
                  key={path}
                  className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5"
                >
                  <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{path}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${path}`}
                    onClick={() => setPaths(paths.filter((existing) => existing !== path))}
                    className="text-muted-foreground/70 hover:text-foreground"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No repositories mapped yet.</p>
          )}
          <Input
            placeholder="/absolute/path/to/repo"
            className="font-mono text-xs"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addDraft();
              }
            }}
          />
          {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={submitting} onClick={() => void submit()}>
            Save
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
