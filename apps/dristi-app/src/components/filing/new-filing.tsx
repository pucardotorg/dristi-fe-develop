"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { createBlankDraft } from "@/lib/filing/blank";
import { getRepository } from "@/lib/filing/data";
import { caseFilingApi, caseFilingErrorMessage } from "@/lib/filing/data/cases-api";
import { useProfile } from "@/lib/filing/profile";
import { FILINGS_HOME, stepHref } from "@/lib/filing/steps";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * "Start filing" lands here: open a draft on the backend, make a blank draft under its id
 * (advocate card prefilled from the profile), persist it, then replace the URL with the
 * draft's own documents step so Back never returns to a page that would create another.
 */
export function NewFiling() {
  const router = useRouter();
  const { profile, ready } = useProfile();
  const [error, setError] = React.useState<string | null>(null);
  const started = React.useRef(false);

  React.useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    void (async () => {
      let caseId: string;
      try {
        ({ caseId } = await caseFilingApi.startDraft());
      } catch (err) {
        setError(caseFilingErrorMessage(err));
        return;
      }
      const draft = createBlankDraft(caseId, profile);
      draft.caseId = caseId;
      try {
        await getRepository().putDraft(draft);
      } catch {
        setError("We couldn't create a draft in this browser's storage.");
        return;
      }
      router.replace(stepHref(draft.id, "upload"));
    })();
  }, [ready, profile, router]);

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <p className="text-body text-foreground">{error}</p>
        <Button asChild variant="outline">
          <Link href={FILINGS_HOME}>
            <ArrowLeftIcon data-icon="inline-start" aria-hidden />
            Back to dashboard
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 items-center justify-center py-16 text-body-compact text-muted-foreground"
    >
      <Spinner className="mr-2 size-4" />
      Starting a new filing…
    </div>
  );
}
