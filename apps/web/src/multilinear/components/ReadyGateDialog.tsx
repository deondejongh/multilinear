/**
 * Ready-gate soft warning (03-PHASE-2 §E). When a human moves an issue into a
 * `ready` status but its description fails `readyGateLint`, this dialog lists
 * the problems and asks for confirmation. Humans may override; agents cannot
 * (that's enforced server-side). Shared by the issue detail status select and
 * the board/list keyboard moves via `useReadyGateGuard`.
 */
import { useCallback, useState } from "react";

import { readyGateLint } from "@multilinear/core/ready-gate";

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";

interface PendingMove {
  problems: ReadonlyArray<string>;
  proceed: () => void;
}

/**
 * A guard for ready-category moves. `guard(description, proceed)` runs the lint;
 * if the description passes it calls `proceed()` immediately, otherwise it opens
 * a confirmation dialog. Render `dialog` somewhere in the tree.
 */
export function useReadyGateGuard() {
  const [pending, setPending] = useState<PendingMove | null>(null);

  const guard = useCallback((description: string, proceed: () => void) => {
    const result = readyGateLint(description);
    if (result.ok) {
      proceed();
      return;
    }
    setPending({ problems: result.problems, proceed });
  }, []);

  const dialog = (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) setPending(null);
      }}
    >
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Move to Ready anyway?</AlertDialogTitle>
          <AlertDialogDescription>
            This issue isn&apos;t fully specified for an agent to pick up:
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="px-6">
          <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
            {pending?.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
          <Button
            onClick={() => {
              pending?.proceed();
              setPending(null);
            }}
          >
            Move to Ready
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );

  return { guard, dialog };
}
