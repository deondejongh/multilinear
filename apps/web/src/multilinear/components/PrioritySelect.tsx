/**
 * Priority select over the five priority values, with the priority icon shown
 * inline. Shared by quick capture and the detail sidebar.
 */
import type { Priority } from "@multilinear/core/model";

import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { PRIORITY_OPTIONS, priorityLabel } from "../presentation";
import { PriorityIcon } from "./PriorityIcon";

export function PrioritySelect({
  value,
  onChange,
  size = "sm",
  className,
}: {
  value: Priority;
  onChange: (priority: Priority) => void;
  size?: "sm" | "default";
  className?: string;
}) {
  return (
    <Select value={String(value)} onValueChange={(next) => onChange(Number(next) as Priority)}>
      <SelectTrigger size={size} className={className} aria-label="Priority">
        <SelectValue>
          <span className="flex items-center gap-2">
            <PriorityIcon priority={value} />
            {priorityLabel(value)}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectPopup>
        {PRIORITY_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={String(option.value)}>
            <span className="flex items-center gap-2">
              <PriorityIcon priority={option.value} />
              {option.label}
            </span>
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
