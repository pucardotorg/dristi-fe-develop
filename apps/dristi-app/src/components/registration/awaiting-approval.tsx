import { ClockIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * "Your registration is awaiting approval" — where an advocate or clerk lands after
 * registering, after resubmitting a correction, and when they try to sign in before the
 * court has approved them. One screen for all three so they cannot drift apart; the
 * caller supplies the words (they differ slightly) and an optional next action.
 *
 * The clock is decorative (`aria-hidden`): the heading says the status in words.
 */
export function AwaitingApproval({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center gap-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-warning-muted text-warning-muted-foreground">
        <ClockIcon className="size-7" aria-hidden />
      </span>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-title text-balance font-semibold">{title}</h1>
        <p className="text-body text-pretty text-muted-foreground">{body}</p>
      </div>
      {action ? (
        <Button size="lg" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
