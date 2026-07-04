/**
 * View-local keyboard handling for the tracker layout. Document-level keydown
 * listener that ignores events already handled, modifier combos, and events
 * originating from text inputs or an open dialog. Currently binds `c` to open
 * quick capture. Board/list selection keys live in the index route (same
 * guards). No `@t3tools/contracts` keybindings are registered.
 */
import { useEffect } from "react";

/** True when focus is inside a control that should own the keystroke. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  // Inside an open dialog / popover / menu: let it handle its own keys.
  if (target.closest("[role='dialog'], [data-slot='dialog-popup']")) return true;
  return false;
}

/** True when any modal dialog is currently mounted in the document. */
function hasOpenDialog(): boolean {
  return document.querySelector("[data-slot='dialog-popup'], [role='dialog']") !== null;
}

export function useTrackerKeys({
  enabled,
  onQuickCapture,
}: {
  enabled: boolean;
  onQuickCapture: () => void;
}): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (hasOpenDialog()) return;
      if (event.key === "c" || event.key === "C") {
        event.preventDefault();
        onQuickCapture();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled, onQuickCapture]);
}
