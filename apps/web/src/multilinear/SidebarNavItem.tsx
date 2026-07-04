/**
 * The tracker's entry in the app sidebar footer — the one nav mount point
 * (see MOUNTPOINTS.md). Kept in our tree so the upstream edit stays two lines.
 */
import { SquareKanbanIcon } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { SidebarMenuButton, SidebarMenuItem, useSidebar } from "../components/ui/sidebar";

export function MultilinearSidebarNavItem() {
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const handleClick = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
    void navigate({ to: "/multilinear" });
  }, [isMobile, navigate, setOpenMobile]);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        size="sm"
        className="gap-2 px-2 py-1.5 text-muted-foreground/70 hover:bg-accent hover:text-foreground"
        onClick={handleClick}
      >
        <SquareKanbanIcon className="size-3.5" />
        <span className="text-xs">Issues</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
