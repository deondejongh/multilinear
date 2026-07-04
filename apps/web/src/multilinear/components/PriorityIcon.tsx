/**
 * Priority indicator. `No priority` renders a muted dash; `Urgent` renders an
 * orange alert; High/Medium/Low render Linear-style signal bars with an
 * increasing number of filled bars. One shared component used by cards, rows,
 * the detail sidebar, and selects.
 */
import { MinusIcon, TriangleAlertIcon } from "lucide-react";

import type { Priority } from "@multilinear/core/model";

import { cn } from "~/lib/utils";
import { priorityLabel } from "../presentation";

/** Signal-bar glyph: three bars, `filled` of them lit. */
function SignalBars({ filled, className }: { filled: number; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("size-3.5", className)} fill="none" aria-hidden="true">
      {[0, 1, 2].map((index) => {
        const height = 4 + index * 3.5;
        const y = 12 - height;
        const lit = index < filled;
        return (
          <rect
            key={index}
            x={2 + index * 4.5}
            y={y}
            width={3}
            height={height}
            rx={1}
            className={lit ? "fill-current" : "fill-current opacity-25"}
          />
        );
      })}
    </svg>
  );
}

export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  const label = priorityLabel(priority);
  const shared = { "aria-label": label, title: label };
  switch (priority) {
    case 1:
      return (
        <TriangleAlertIcon className={cn("size-3.5 text-orange-500", className)} {...shared} />
      );
    case 2:
      return <SignalBars filled={3} className={cn("text-foreground", className)} {...shared} />;
    case 3:
      return <SignalBars filled={2} className={cn("text-foreground", className)} {...shared} />;
    case 4:
      return (
        <SignalBars filled={1} className={cn("text-muted-foreground", className)} {...shared} />
      );
    default:
      return (
        <MinusIcon className={cn("size-3.5 text-muted-foreground/60", className)} {...shared} />
      );
  }
}
