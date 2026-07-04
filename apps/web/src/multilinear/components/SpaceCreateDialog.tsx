/**
 * Create-space dialog: name + key. The key is auto-derived (uppercase, ≤4
 * chars) from the name until the user edits it, then validated against
 * `^[A-Z][A-Z0-9]{1,5}$`. Runs `space.create` with a caller-side ULID.
 */
import { useCallback, useMemo, useState } from "react";

import type { SpaceId } from "@multilinear/core/model";

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
import { newEntityId } from "../api";
import { useMultilinearStore } from "../store";

const KEY_PATTERN = /^[A-Z][A-Z0-9]{1,5}$/;

/** Derive a default uppercase key (≤4 chars) from a space name. */
export function deriveSpaceKey(name: string): string {
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.slice(0, 4);
}

export function SpaceCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (spaceId: SpaceId) => void;
}) {
  const runCommand = useMultilinearStore((state) => state.runCommand);
  const [name, setName] = useState("");
  const [keyOverride, setKeyOverride] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = keyOverride ?? deriveSpaceKey(name);
  const trimmedName = name.trim();
  const keyValid = useMemo(() => KEY_PATTERN.test(key), [key]);
  const canSubmit = trimmedName.length > 0 && keyValid && !submitting;

  const reset = useCallback(() => {
    setName("");
    setKeyOverride(null);
    setError(null);
    setSubmitting(false);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) reset();
      onOpenChange(next);
    },
    [onOpenChange, reset],
  );

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const spaceId = newEntityId<SpaceId>();
    try {
      await runCommand({ type: "space.create", spaceId, name: trimmedName, key });
      reset();
      onOpenChange(false);
      onCreated?.(spaceId);
    } catch (cause) {
      setSubmitting(false);
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [canSubmit, key, onCreated, onOpenChange, reset, runCommand, trimmedName]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup className="max-w-md">
        <DialogHeader>
          <DialogTitle>New space</DialogTitle>
          <DialogDescription>
            Spaces group issues under a short key, e.g. <span className="font-mono">MLT-42</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 py-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground">Name</span>
            <Input
              autoFocus
              placeholder="e.g. Multilinear"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canSubmit) {
                  event.preventDefault();
                  void submit();
                }
              }}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground">Key</span>
            <Input
              className="font-mono uppercase"
              placeholder="MLT"
              value={key}
              onChange={(event) => setKeyOverride(event.target.value.toUpperCase())}
              aria-invalid={key.length > 0 && !keyValid}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canSubmit) {
                  event.preventDefault();
                  void submit();
                }
              }}
            />
            <span className="text-[11px] text-muted-foreground">
              Start with a letter, 2–6 uppercase letters or digits.
            </span>
          </label>
          {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!canSubmit} onClick={() => void submit()}>
            Create space
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
