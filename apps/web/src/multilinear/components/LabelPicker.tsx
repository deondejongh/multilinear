/**
 * Label picker for the detail sidebar. A menu of the space's labels with a
 * checkmark on applied ones (toggle → `label.add` / `label.remove`), plus an
 * inline "New label" form (name + preset color palette) that runs
 * `label.create` then `label.add`.
 */
import { useState } from "react";
import { CheckIcon, PlusIcon, TagIcon } from "lucide-react";

import type { IssueId, Label, LabelId, SpaceId } from "@multilinear/core/model";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "~/components/ui/menu";
import { cn } from "~/lib/utils";
import { newEntityId } from "../api";
import { LABEL_COLOR_PRESETS } from "../presentation";
import { useMultilinearStore } from "../store";
import { LabelChip } from "./LabelChip";

export function LabelPicker({
  issueId,
  spaceId,
  spaceLabels,
  appliedLabels,
  onMutated,
}: {
  issueId: IssueId;
  spaceId: SpaceId;
  spaceLabels: ReadonlyArray<Label>;
  appliedLabels: ReadonlyArray<Label>;
  onMutated?: (() => Promise<void> | void) | undefined;
}) {
  const runCommand = useMultilinearStore((state) => state.runCommand);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(LABEL_COLOR_PRESETS[0] ?? "#5e6ad2");
  const [busy, setBusy] = useState(false);

  const appliedIds = new Set(appliedLabels.map((label) => label.id));

  const toggle = async (labelId: LabelId) => {
    setBusy(true);
    try {
      await runCommand(
        appliedIds.has(labelId)
          ? { type: "label.remove", issueId, labelId }
          : { type: "label.add", issueId, labelId },
      );
      await onMutated?.();
    } finally {
      setBusy(false);
    }
  };

  const createAndApply = async () => {
    const name = newName.trim();
    if (name.length === 0) return;
    setBusy(true);
    const labelId = newEntityId<LabelId>();
    try {
      await runCommand({ type: "label.create", labelId, spaceId, name, color: newColor });
      await runCommand({ type: "label.add", issueId, labelId });
      setNewName("");
      setCreating(false);
      await onMutated?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {appliedLabels.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {appliedLabels.map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
        </div>
      ) : null}
      <Menu>
        <MenuTrigger
          render={
            <Button variant="outline" size="sm" className="w-full justify-start" disabled={busy} />
          }
        >
          <TagIcon className="size-3.5" />
          {appliedLabels.length > 0 ? "Edit labels" : "Add label"}
        </MenuTrigger>
        <MenuPopup align="start" className="w-56">
          {spaceLabels.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No labels yet.</p>
          ) : (
            spaceLabels.map((label) => (
              <MenuItem key={label.id} closeOnClick={false} onClick={() => void toggle(label.id)}>
                <span className="flex w-full items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{label.name}</span>
                  <CheckIcon
                    className={cn(
                      "size-3.5",
                      appliedIds.has(label.id) ? "opacity-100" : "opacity-0",
                    )}
                  />
                </span>
              </MenuItem>
            ))
          )}
          <MenuSeparator />
          {creating ? (
            <div className="space-y-2 p-2">
              <Input
                autoFocus
                size="sm"
                placeholder="Label name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void createAndApply();
                  }
                }}
              />
              <div className="flex flex-wrap gap-1.5">
                {LABEL_COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Use ${color}`}
                    onClick={() => setNewColor(color)}
                    className={cn(
                      "size-5 rounded-full border transition",
                      newColor === color
                        ? "scale-110 border-foreground ring-2 ring-ring"
                        : "border-black/10 hover:scale-105 dark:border-white/20",
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex justify-end gap-1.5">
                <Button variant="ghost" size="xs" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
                <Button
                  size="xs"
                  disabled={newName.trim().length === 0}
                  onClick={() => void createAndApply()}
                >
                  Create
                </Button>
              </div>
            </div>
          ) : (
            <MenuItem closeOnClick={false} onClick={() => setCreating(true)}>
              <PlusIcon className="size-3.5" />
              New label
            </MenuItem>
          )}
        </MenuPopup>
      </Menu>
    </div>
  );
}
