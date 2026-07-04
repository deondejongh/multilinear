/**
 * A label chip: colored dot + name, rendered as a compact outline badge. Used
 * on cards, rows, and the detail view.
 */
import type { Label } from "@multilinear/core/model";

import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export function LabelChip({ label, className }: { label: Label; className?: string }) {
  return (
    <Badge variant="outline" size="sm" className={cn("gap-1 font-normal", className)}>
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: label.color }}
        aria-hidden="true"
      />
      <span className="truncate">{label.name}</span>
    </Badge>
  );
}
