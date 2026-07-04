/**
 * Header view controls for the board/list (MLT-48), modeled on Linear:
 * - Filter menu: search across all filter values (priority / status / label),
 *   multi-select per dimension; active filters render as removable chips.
 * - Display popover: view toggle, grouping, ordering + direction, empty
 *   column/group visibility, shown-property pills, and Reset.
 * Configuration persists via the store's view prefs.
 */
import { useState } from "react";
import {
  ArrowDownWideNarrowIcon,
  ArrowUpNarrowWideIcon,
  LayoutGridIcon,
  ListFilterIcon,
  ListIcon,
  Settings2Icon,
  XIcon,
} from "lucide-react";

import {
  STATUS_CATEGORIES,
  type LabelId,
  type Priority,
  type StatusCategory,
} from "@multilinear/core/model";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { cn } from "~/lib/utils";
import { CATEGORY_LABELS, PRIORITY_OPTIONS, priorityLabel } from "../presentation";
import { useMultilinearStore } from "../store";
import {
  DEFAULT_DISPLAY_OPTIONS,
  type IssueOrdering,
  type ListGrouping,
  type OrderingDirection,
} from "../viewPrefs";

const ORDERING_LABELS: Readonly<Record<IssueOrdering, string>> = {
  updated: "Last updated",
  created: "Created",
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

const matches = (query: string, text: string) =>
  query === "" || text.toLowerCase().includes(query.toLowerCase());

export function FilterMenu() {
  const labels = useMultilinearStore((state) => state.labels);
  const priorities = useMultilinearStore((state) => state.filter.priorities);
  const categories = useMultilinearStore((state) => state.filter.categories);
  const labelIds = useMultilinearStore((state) => state.filter.labelIds);
  const setPriorityFilter = useMultilinearStore((state) => state.setPriorityFilter);
  const setCategoryFilter = useMultilinearStore((state) => state.setCategoryFilter);
  const setLabelsFilter = useMultilinearStore((state) => state.setLabelsFilter);

  const [query, setQuery] = useState("");

  const activeCount = priorities.length + categories.length + labelIds.length;

  const priorityMatches = PRIORITY_OPTIONS.filter((option) => matches(query, option.label));
  const categoryMatches = STATUS_CATEGORIES.filter((category) =>
    matches(query, CATEGORY_LABELS[category]),
  );
  const labelMatches = labels.filter((label) => matches(query, label.name));
  const nothingMatches =
    priorityMatches.length === 0 && categoryMatches.length === 0 && labelMatches.length === 0;

  return (
    <Popover onOpenChange={(open) => open && setQuery("")}>
      <PopoverTrigger
        render={
          <Button
            variant={activeCount > 0 ? "outline" : "ghost"}
            size="sm"
            aria-label="Filter issues"
          />
        }
      >
        <ListFilterIcon className="size-3.5" />
        Filter
        {activeCount > 0 ? (
          <Badge variant="secondary" size="sm" className="font-normal">
            {activeCount}
          </Badge>
        ) : null}
      </PopoverTrigger>
      <PopoverPopup align="end" className="w-64 p-2">
        <Input
          autoFocus
          placeholder="Filter…"
          className="mb-2 h-7 text-[13px]"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="max-h-80 space-y-3 overflow-y-auto">
          {priorityMatches.length > 0 ? (
            <div className="space-y-0.5">
              <SectionLabel>Priority</SectionLabel>
              {priorityMatches.map((option) => (
                <CheckboxRow
                  key={option.value}
                  label={option.label}
                  checked={priorities.includes(option.value)}
                  onCheckedChange={() =>
                    setPriorityFilter(toggle<Priority>(priorities, option.value))
                  }
                />
              ))}
            </div>
          ) : null}
          {categoryMatches.length > 0 ? (
            <div className="space-y-0.5">
              <SectionLabel>Status</SectionLabel>
              {categoryMatches.map((category) => (
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
          ) : null}
          {labelMatches.length > 0 ? (
            <div className="space-y-0.5">
              <SectionLabel>Label</SectionLabel>
              {labelMatches.map((label) => (
                <CheckboxRow
                  key={label.id}
                  label={
                    <span className="flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      {label.name}
                    </span>
                  }
                  checked={labelIds.includes(label.id)}
                  onCheckedChange={() => setLabelsFilter(toggle<LabelId>(labelIds, label.id))}
                />
              ))}
            </div>
          ) : null}
          {nothingMatches ? (
            <p className="px-1 py-3 text-center text-xs text-muted-foreground">No filters match</p>
          ) : null}
        </div>
      </PopoverPopup>
    </Popover>
  );
}

function FilterChip({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-xs text-foreground">
      {children}
      <button
        type="button"
        aria-label="Remove filter"
        onClick={onClear}
        className="text-muted-foreground/70 hover:text-foreground"
      >
        <XIcon className="size-3" />
      </button>
    </span>
  );
}

const summarize = (names: ReadonlyArray<string>): string =>
  names.length <= 2 ? names.join(", ") : `${names[0]}, ${names[1]} +${names.length - 2}`;

/** Active-filter chips row; renders nothing while no filters are active. */
export function ActiveFilterChips() {
  const labels = useMultilinearStore((state) => state.labels);
  const priorities = useMultilinearStore((state) => state.filter.priorities);
  const categories = useMultilinearStore((state) => state.filter.categories);
  const labelIds = useMultilinearStore((state) => state.filter.labelIds);
  const setPriorityFilter = useMultilinearStore((state) => state.setPriorityFilter);
  const setCategoryFilter = useMultilinearStore((state) => state.setCategoryFilter);
  const setLabelsFilter = useMultilinearStore((state) => state.setLabelsFilter);

  if (priorities.length + categories.length + labelIds.length === 0) return null;

  const labelNames = labelIds.map(
    (labelId) => labels.find((label) => label.id === labelId)?.name ?? "?",
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-1.5">
      {priorities.length > 0 ? (
        <FilterChip onClear={() => setPriorityFilter([])}>
          Priority: {summarize(priorities.map(priorityLabel))}
        </FilterChip>
      ) : null}
      {categories.length > 0 ? (
        <FilterChip onClear={() => setCategoryFilter([])}>
          Status: {summarize(categories.map((category) => CATEGORY_LABELS[category]))}
        </FilterChip>
      ) : null}
      {labelIds.length > 0 ? (
        <FilterChip onClear={() => setLabelsFilter([])}>Label: {summarize(labelNames)}</FilterChip>
      ) : null}
      <button
        type="button"
        onClick={() => {
          setPriorityFilter([]);
          setCategoryFilter([]);
          setLabelsFilter([]);
        }}
        className="ms-1 text-xs text-muted-foreground hover:text-foreground"
      >
        Clear all
      </button>
    </div>
  );
}

function PropertyPill({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        "rounded-md border px-2 py-0.5 text-xs transition-colors",
        active
          ? "border-foreground/20 bg-accent text-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function SwitchRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 px-1 text-[13px] text-foreground">
      {label}
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

export function DisplayPopover() {
  const view = useMultilinearStore((state) => state.view);
  const setView = useMultilinearStore((state) => state.setView);
  const display = useMultilinearStore((state) => state.display);
  const setDisplay = useMultilinearStore((state) => state.setDisplay);

  const directionLabel =
    display.orderingDirection === "desc" ? "Descending (default)" : "Ascending";

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="sm" aria-label="Display options" />}>
        <Settings2Icon className="size-3.5" />
        Display
      </PopoverTrigger>
      <PopoverPopup align="end" className="w-72 space-y-3 p-3">
        <ToggleGroup
          variant="outline"
          size="sm"
          className="grid w-full grid-cols-2"
          value={[view]}
          onValueChange={(value) => {
            const next = value[0];
            if (next === "board" || next === "list") setView(next);
          }}
        >
          <ToggleGroupItem value="list" aria-label="List view">
            <ListIcon className="size-4" />
            List
          </ToggleGroupItem>
          <ToggleGroupItem value="board" aria-label="Board view">
            <LayoutGridIcon className="size-4" />
            Board
          </ToggleGroupItem>
        </ToggleGroup>

        {view === "list" ? (
          <div className="flex items-center justify-between gap-2">
            <span className="px-1 text-[13px] text-muted-foreground">Grouping</span>
            <Select
              value={display.listGrouping}
              onValueChange={(next) => setDisplay({ listGrouping: next as ListGrouping })}
            >
              <SelectTrigger size="sm" className="w-36" aria-label="List grouping">
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

        <div className="flex items-center justify-between gap-2">
          <span className="px-1 text-[13px] text-muted-foreground">Ordering</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={directionLabel}
              title={directionLabel}
              onClick={() =>
                setDisplay({
                  orderingDirection: (display.orderingDirection === "desc"
                    ? "asc"
                    : "desc") as OrderingDirection,
                })
              }
            >
              {display.orderingDirection === "desc" ? (
                <ArrowDownWideNarrowIcon className="size-3.5" />
              ) : (
                <ArrowUpNarrowWideIcon className="size-3.5" />
              )}
            </Button>
            <Select
              value={display.ordering}
              onValueChange={(next) => setDisplay({ ordering: next as IssueOrdering })}
            >
              <SelectTrigger size="sm" className="w-36" aria-label="Ordering">
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
        </div>

        {view === "board" ? (
          <SwitchRow
            label="Show empty columns"
            checked={display.showEmptyColumns}
            onCheckedChange={(showEmptyColumns) => setDisplay({ showEmptyColumns })}
          />
        ) : (
          <SwitchRow
            label="Show empty groups"
            checked={display.showEmptyGroups}
            onCheckedChange={(showEmptyGroups) => setDisplay({ showEmptyGroups })}
          />
        )}

        <div className="space-y-1.5">
          <SectionLabel>Display properties</SectionLabel>
          <div className="flex flex-wrap gap-1.5 px-1">
            <PropertyPill
              label="Priority"
              active={display.showPriority}
              onToggle={() => setDisplay({ showPriority: !display.showPriority })}
            />
            <PropertyPill
              label="ID"
              active={display.showShortId}
              onToggle={() => setDisplay({ showShortId: !display.showShortId })}
            />
            <PropertyPill
              label="Labels"
              active={display.showLabels}
              onToggle={() => setDisplay({ showLabels: !display.showLabels })}
            />
            <PropertyPill
              label="Type"
              active={display.showType}
              onToggle={() => setDisplay({ showType: !display.showType })}
            />
          </div>
        </div>

        <div className="border-t border-border pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setDisplay(DEFAULT_DISPLAY_OPTIONS)}
          >
            Reset to defaults
          </Button>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
