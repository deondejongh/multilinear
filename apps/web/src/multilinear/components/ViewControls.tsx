/**
 * Header view controls for the board/list (MLT-48): a Filter popover
 * (priority + status category, client-side) and a Display popover (ordering,
 * list grouping, shown properties). Configuration persists via the store's
 * view prefs; the trigger shows a count badge while filters are active.
 */
import { ListFilterIcon, Settings2Icon } from "lucide-react";

import { STATUS_CATEGORIES, type Priority, type StatusCategory } from "@multilinear/core/model";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { CATEGORY_LABELS, PRIORITY_OPTIONS } from "../presentation";
import { useMultilinearStore } from "../store";
import type { IssueOrdering, ListGrouping } from "../viewPrefs";

const ORDERING_LABELS: Readonly<Record<IssueOrdering, string>> = {
  updated: "Recently updated",
  created: "Recently created",
  priority: "Priority",
};

const LIST_GROUPING_LABELS: Readonly<Record<ListGrouping, string>> = {
  status: "Status",
  priority: "Priority",
  none: "No grouping",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
      {children}
    </p>
  );
}

function CheckboxRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-[13px] text-foreground hover:bg-accent/50">
      <Checkbox checked={checked} onCheckedChange={(next) => onCheckedChange(next === true)} />
      {label}
    </label>
  );
}

const toggle = <Value,>(values: ReadonlyArray<Value>, value: Value): ReadonlyArray<Value> =>
  values.includes(value) ? values.filter((existing) => existing !== value) : [...values, value];

export function FilterPopover() {
  const priorities = useMultilinearStore((state) => state.filter.priorities);
  const categories = useMultilinearStore((state) => state.filter.categories);
  const setPriorityFilter = useMultilinearStore((state) => state.setPriorityFilter);
  const setCategoryFilter = useMultilinearStore((state) => state.setCategoryFilter);

  const activeCount = priorities.length + categories.length;

  return (
    <Popover>
      <PopoverTrigger render={<Button variant={activeCount > 0 ? "outline" : "ghost"} size="sm" />}>
        <ListFilterIcon className="size-3.5" />
        Filter
        {activeCount > 0 ? (
          <Badge variant="secondary" size="sm" className="font-normal">
            {activeCount}
          </Badge>
        ) : null}
      </PopoverTrigger>
      <PopoverPopup align="end" className="w-64 space-y-3 p-2">
        <div className="space-y-1">
          <SectionLabel>Priority</SectionLabel>
          {PRIORITY_OPTIONS.map((option) => (
            <CheckboxRow
              key={option.value}
              label={option.label}
              checked={priorities.includes(option.value)}
              onCheckedChange={() => setPriorityFilter(toggle<Priority>(priorities, option.value))}
            />
          ))}
        </div>
        <div className="space-y-1">
          <SectionLabel>Status</SectionLabel>
          {STATUS_CATEGORIES.map((category) => (
            <CheckboxRow
              key={category}
              label={CATEGORY_LABELS[category]}
              checked={categories.includes(category)}
              onCheckedChange={() =>
                setCategoryFilter(toggle<StatusCategory>(categories, category))
              }
            />
          ))}
        </div>
        {activeCount > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              setPriorityFilter([]);
              setCategoryFilter([]);
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </PopoverPopup>
    </Popover>
  );
}

export function DisplayPopover() {
  const view = useMultilinearStore((state) => state.view);
  const display = useMultilinearStore((state) => state.display);
  const setDisplay = useMultilinearStore((state) => state.setDisplay);

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="sm" />}>
        <Settings2Icon className="size-3.5" />
        Display
      </PopoverTrigger>
      <PopoverPopup align="end" className="w-64 space-y-3 p-2">
        <div className="space-y-1.5">
          <SectionLabel>Ordering</SectionLabel>
          <Select
            value={display.ordering}
            onValueChange={(next) => setDisplay({ ordering: next as IssueOrdering })}
          >
            <SelectTrigger size="sm" className="w-full" aria-label="Ordering">
              <SelectValue>{ORDERING_LABELS[display.ordering]}</SelectValue>
            </SelectTrigger>
            <SelectPopup>
              {(Object.keys(ORDERING_LABELS) as IssueOrdering[]).map((ordering) => (
                <SelectItem key={ordering} value={ordering}>
                  {ORDERING_LABELS[ordering]}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
        {view === "list" ? (
          <div className="space-y-1.5">
            <SectionLabel>Group by</SectionLabel>
            <Select
              value={display.listGrouping}
              onValueChange={(next) => setDisplay({ listGrouping: next as ListGrouping })}
            >
              <SelectTrigger size="sm" className="w-full" aria-label="List grouping">
                <SelectValue>{LIST_GROUPING_LABELS[display.listGrouping]}</SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {(Object.keys(LIST_GROUPING_LABELS) as ListGrouping[]).map((grouping) => (
                  <SelectItem key={grouping} value={grouping}>
                    {LIST_GROUPING_LABELS[grouping]}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>
        ) : null}
        <div className="space-y-1">
          <SectionLabel>Properties</SectionLabel>
          <CheckboxRow
            label="Priority"
            checked={display.showPriority}
            onCheckedChange={(showPriority) => setDisplay({ showPriority })}
          />
          <CheckboxRow
            label="ID"
            checked={display.showShortId}
            onCheckedChange={(showShortId) => setDisplay({ showShortId })}
          />
          <CheckboxRow
            label="Labels"
            checked={display.showLabels}
            onCheckedChange={(showLabels) => setDisplay({ showLabels })}
          />
          <CheckboxRow
            label="Type"
            checked={display.showType}
            onCheckedChange={(showType) => setDisplay({ showType })}
          />
        </div>
      </PopoverPopup>
    </Popover>
  );
}
