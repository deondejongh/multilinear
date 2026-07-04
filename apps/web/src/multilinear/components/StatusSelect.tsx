/**
 * Status select over a space's statuses (ordered by category). Controlled by
 * the current status id; emits the picked status id.
 */
import { STATUS_CATEGORIES, type Status, type StatusId } from "@multilinear/core/model";

import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { categoryIcon } from "../presentation";

export function StatusSelect({
  statuses,
  value,
  onChange,
}: {
  statuses: ReadonlyArray<Status>;
  value: StatusId;
  onChange: (statusId: StatusId) => void;
}) {
  const ordered = [...statuses].sort(
    (a, b) => STATUS_CATEGORIES.indexOf(a.category) - STATUS_CATEGORIES.indexOf(b.category),
  );
  const current = statuses.find((status) => status.id === value);
  const CurrentIcon = current ? categoryIcon(current.category) : null;

  return (
    <Select value={value} onValueChange={(next) => onChange(next as StatusId)}>
      <SelectTrigger size="sm" className="w-full" aria-label="Status">
        <SelectValue>
          <span className="flex items-center gap-2">
            {CurrentIcon ? <CurrentIcon className="size-3.5 text-muted-foreground" /> : null}
            {current?.name ?? "Status"}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectPopup>
        {ordered.map((status) => {
          const Icon = categoryIcon(status.category);
          return (
            <SelectItem key={status.id} value={status.id}>
              <span className="flex items-center gap-2">
                <Icon className="size-3.5 text-muted-foreground" />
                {status.name}
              </span>
            </SelectItem>
          );
        })}
      </SelectPopup>
    </Select>
  );
}
