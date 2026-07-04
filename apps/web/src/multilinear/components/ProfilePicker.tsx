/**
 * Context-pack v2 profile picker (03-PHASE-2 §D/§F). When profiles are loaded
 * from the active repo, this small select lets the user choose which workflow
 * profile wraps the context pack (or none) for the copy / start-agent paths.
 * Profile load failures are surfaced unobtrusively via a warning-tinted tooltip
 * so bad frontmatter never fails silently.
 */
import { AlertTriangleIcon } from "lucide-react";

import type { WorkflowProfile } from "@multilinear/core/profile";

import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";

export const NO_PROFILE = "__none__";

export function ProfilePicker({
  profiles,
  errors,
  value,
  onChange,
}: {
  profiles: ReadonlyArray<WorkflowProfile>;
  errors: ReadonlyArray<string>;
  /** Selected profile name, or null for "No profile". */
  value: string | null;
  onChange: (name: string | null) => void;
}) {
  if (profiles.length === 0 && errors.length === 0) return null;

  const selected = value !== null ? profiles.find((profile) => profile.name === value) : undefined;

  return (
    <div className="flex items-center gap-1.5">
      {profiles.length > 0 ? (
        <Select
          value={value ?? NO_PROFILE}
          onValueChange={(next) => onChange(next === NO_PROFILE ? null : next)}
        >
          <SelectTrigger size="sm" variant="ghost" className="w-auto min-w-32" aria-label="Profile">
            <SelectValue>{selected ? selected.name : "No profile"}</SelectValue>
          </SelectTrigger>
          <SelectPopup>
            <SelectItem value={NO_PROFILE}>No profile</SelectItem>
            {profiles.map((profile) => (
              <SelectItem key={profile.name} value={profile.name}>
                <span className="flex items-center gap-2">
                  <span>{profile.name}</span>
                  <span className="text-[11px] text-muted-foreground">{profile.intent}</span>
                </span>
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      ) : null}
      {errors.length > 0 ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              className="flex size-6 items-center justify-center rounded-md text-warning-foreground outline-none hover:bg-accent/50"
              aria-label={`${errors.length} profile${errors.length === 1 ? "" : "s"} failed to load`}
            >
              <AlertTriangleIcon className="size-3.5" />
            </TooltipTrigger>
            <TooltipPopup className="max-w-xs p-2 text-left">
              <p className="mb-1 font-medium">Some profiles failed to load</p>
              <ul className="space-y-0.5 text-muted-foreground">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </TooltipPopup>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}
