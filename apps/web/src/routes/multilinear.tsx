import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { LayoutGridIcon, ListIcon, PlusIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import type { LabelId } from "@multilinear/core/model";

import { Alert, AlertAction, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { SidebarInset } from "~/components/ui/sidebar";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { cn } from "~/lib/utils";
import { QuickCaptureDialog } from "../multilinear/components/QuickCaptureDialog";
import { SpaceCreateDialog } from "../multilinear/components/SpaceCreateDialog";
import { TrackerNav } from "../multilinear/components/TrackerNav";
import { useMultilinearStore } from "../multilinear/store";
import { useTrackerKeys } from "../multilinear/useTrackerKeys";

const ALL_LABELS = "__all__";

function MultilinearLayout() {
  const location = useLocation();
  const labels = useMultilinearStore((state) => state.labels);
  const labelId = useMultilinearStore((state) => state.filter.labelId);
  const setLabelFilter = useMultilinearStore((state) => state.setLabelFilter);
  const view = useMultilinearStore((state) => state.view);
  const setView = useMultilinearStore((state) => state.setView);
  const error = useMultilinearStore((state) => state.error);
  const clearError = useMultilinearStore((state) => state.clearError);
  const refresh = useMultilinearStore((state) => state.refresh);

  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [spaceDialogOpen, setSpaceDialogOpen] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useTrackerKeys({
    enabled: true,
    onQuickCapture: () => setQuickCaptureOpen(true),
  });

  const isIndex = location.pathname === "/multilinear";
  const selectedLabel = labels.find((label) => label.id === labelId);

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground isolate">
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex min-h-11 shrink-0 items-center gap-2 border-b border-border px-3 py-2">
          <span className="text-sm font-medium text-foreground">Issues</span>

          <div className="ms-auto flex items-center gap-2">
            <Select
              value={labelId ?? ALL_LABELS}
              onValueChange={(next) =>
                setLabelFilter(next === ALL_LABELS ? null : (next as LabelId))
              }
            >
              <SelectTrigger
                size="sm"
                variant="ghost"
                className="w-auto min-w-28"
                aria-label="Label filter"
              >
                <SelectValue>
                  {selectedLabel ? (
                    <span className="flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: selectedLabel.color }}
                      />
                      {selectedLabel.name}
                    </span>
                  ) : (
                    "All labels"
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value={ALL_LABELS}>All labels</SelectItem>
                {labels.map((label) => (
                  <SelectItem key={label.id} value={label.id}>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      {label.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>

            {isIndex ? (
              <ToggleGroup
                variant="outline"
                size="sm"
                value={[view]}
                onValueChange={(value) => {
                  const next = value[0];
                  if (next === "board" || next === "list") setView(next);
                }}
              >
                <ToggleGroupItem value="board" aria-label="Board view">
                  <LayoutGridIcon className="size-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="List view">
                  <ListIcon className="size-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            ) : null}

            <Button size="sm" onClick={() => setQuickCaptureOpen(true)}>
              <PlusIcon className="size-3.5" />
              New issue
            </Button>
          </div>
        </header>

        {error ? (
          <div className="px-3 pt-3">
            <Alert variant="error">
              <AlertDescription>{error}</AlertDescription>
              <AlertAction>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Dismiss error"
                  onClick={clearError}
                >
                  <XIcon className="size-3.5" />
                </Button>
              </AlertAction>
            </Alert>
          </div>
        ) : null}

        <div className={cn("flex min-h-0 flex-1")}>
          <TrackerNav onNewSpace={() => setSpaceDialogOpen(true)} />
          <div className="min-h-0 min-w-0 flex-1">
            <Outlet />
          </div>
        </div>
      </div>

      <QuickCaptureDialog open={quickCaptureOpen} onOpenChange={setQuickCaptureOpen} />
      <SpaceCreateDialog open={spaceDialogOpen} onOpenChange={setSpaceDialogOpen} />
    </SidebarInset>
  );
}

export const Route = createFileRoute("/multilinear")({
  beforeLoad: async ({ context }) => {
    if (
      context.authGateState.status !== "authenticated" &&
      context.authGateState.status !== "hosted-static"
    ) {
      throw redirect({ to: "/pair", replace: true });
    }
  },
  component: MultilinearLayout,
});
