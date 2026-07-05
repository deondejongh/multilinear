import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { PauseCircleIcon, PlusIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertAction, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { SidebarInset, useSidebar } from "~/components/ui/sidebar";
import { cn } from "~/lib/utils";
import { subscribeLiveUpdates } from "../multilinear/liveUpdates";
import {
  ActiveFilterChips,
  DisplayPopover,
  FilterMenu,
} from "../multilinear/components/ViewControls";
import { QuickCaptureDialog } from "../multilinear/components/QuickCaptureDialog";
import { SpaceCreateDialog } from "../multilinear/components/SpaceCreateDialog";
import { TrackerHeaderNav } from "../multilinear/components/TrackerHeaderNav";
import { useMultilinearStore } from "../multilinear/store";
import { useTrackerKeys } from "../multilinear/useTrackerKeys";

function MultilinearLayout() {
  const location = useLocation();
  const { state: sidebarState, isMobile } = useSidebar();
  // With the app sidebar collapsed (or on mobile), upstream's sidebar toggle
  // floats fixed in the top-left — inset the header's leading cluster so the
  // space switcher doesn't sit underneath it (MLT-50 review feedback).
  const sidebarToggleFloats = isMobile || sidebarState === "collapsed";
  const agentBlocked = useMultilinearStore((state) => state.filter.agentBlocked);
  const setAgentBlockedFilter = useMultilinearStore((state) => state.setAgentBlockedFilter);
  const error = useMultilinearStore((state) => state.error);
  const clearError = useMultilinearStore((state) => state.clearError);
  const refresh = useMultilinearStore((state) => state.refresh);
  const loadProfiles = useMultilinearStore((state) => state.loadProfiles);

  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [spaceDialogOpen, setSpaceDialogOpen] = useState(false);

  useEffect(() => {
    void refresh();
    void loadProfiles();
  }, [refresh, loadProfiles]);

  // Live updates (MLT-63): refetch board data whenever the event log moves,
  // including writes from other processes (stdio MCP agents).
  useEffect(() => subscribeLiveUpdates(() => void refresh()), [refresh]);

  useTrackerKeys({
    enabled: true,
    onQuickCapture: () => setQuickCaptureOpen(true),
  });

  const isIndex = location.pathname === "/multilinear";

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground isolate">
      <div className="flex h-full min-h-0 flex-col">
        <header
          className={cn(
            // `.workspace-topbar` (upstream utility) fixes the height to the
            // same strip the floating sidebar toggle centers in — otherwise
            // the toggle and our controls sit on different centerlines.
            "workspace-topbar gap-2 border-b border-border px-3 transition-[padding] duration-200 ease-linear",
            sidebarToggleFloats && "ps-[var(--workspace-titlebar-content-left)]",
          )}
        >
          <TrackerHeaderNav onNewSpace={() => setSpaceDialogOpen(true)} />

          <div className="ms-auto flex items-center gap-2">
            <Button
              variant={agentBlocked ? "default" : "ghost"}
              size="sm"
              aria-pressed={agentBlocked}
              onClick={() => setAgentBlockedFilter(!agentBlocked)}
            >
              <PauseCircleIcon className="size-3.5" />
              Agent blocked
            </Button>

            {isIndex ? <FilterMenu /> : null}
            {isIndex ? <DisplayPopover /> : null}

            <Button size="sm" onClick={() => setQuickCaptureOpen(true)}>
              <PlusIcon className="size-3.5" />
              New issue
            </Button>
          </div>
        </header>
        {isIndex ? <ActiveFilterChips /> : null}

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

        <div className="min-h-0 min-w-0 flex-1">
          <Outlet />
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
