/**
 * Shared live-update poller for the tracker views (MLT-63).
 *
 * Polls the `events.head` change probe while at least one view is subscribed
 * and the tab is visible; when the head moves, every subscriber refetches.
 * The signal is derived from the database (not an in-process bus) so writes
 * from other processes — e.g. an agent working through the stdio MCP server —
 * are picked up too.
 */
import { mlEventsHead } from "./api";

const POLL_INTERVAL_MS = 2000;

type Listener = () => void;

const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | null = null;
let lastHead: number | null = null;
let probing = false;

const probe = async () => {
  if (probing || document.hidden || listeners.size === 0) return;
  probing = true;
  try {
    const { head } = await mlEventsHead();
    // The first probe after (re)subscribing only baselines — views load
    // their own data on mount, so notifying would double-fetch.
    const changed = lastHead !== null && head !== lastHead;
    lastHead = head;
    if (changed) {
      // Set iteration is safe against listeners unsubscribing mid-notify.
      for (const listener of listeners) listener();
    }
  } catch {
    // Transient failure (server restart, network): stay quiet and let the
    // next tick retry — the views keep their last-known data.
  } finally {
    probing = false;
  }
};

const handleVisibilityChange = () => {
  // Catch up immediately when the tab comes back; hidden tabs never poll.
  if (!document.hidden) void probe();
};

/**
 * Register a refetch callback. Starts the poller with the first subscriber,
 * stops it with the last. Returns the unsubscribe function.
 */
export const subscribeLiveUpdates = (listener: Listener): (() => void) => {
  listeners.add(listener);
  if (listeners.size === 1) {
    lastHead = null;
    timer = setInterval(() => void probe(), POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    void probe();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  };
};
