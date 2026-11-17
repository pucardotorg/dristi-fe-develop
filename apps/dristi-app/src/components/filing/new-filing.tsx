"use client";

import * as React from "react";

import { PageOutcome } from "@/components/feedback";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, UnplugIcon } from "lucide-react";

import { createBlankDraft } from "@/lib/filing/blank";
import { isNotIntegratedError } from "@/lib/data/source";
import { getCaseFilingRepository, getRepository } from "@/lib/filing/data";
import { caseFilingErrorMessage } from "@/lib/filing/data/cases-api";
import { useProfile } from "@/lib/filing/profile";
import { FILINGS_HOME, stepHref } from "@/lib/filing/steps";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useTranslations } from "next-intl";

/**
 * "Start filing" lands here: open a draft on the backend, make a blank draft under its id
 * (advocate card prefilled from the profile), persist it, then replace the URL with the
 * draft's own documents step so Back never returns to a page that would create another.
 */
export function NewFiling() {
  const t = useTranslations();
  const router = useRouter();
  const { profile, ready } = useProfile();
  const [error, setError] = React.useState<string | null>(null);
  const [notConnected, setNotConnected] = React.useState(false);
  const started = React.useRef(false);

  React.useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    void (async () => {
      let caseId: string;
      try {
        ({ caseId } = await getCaseFilingRepository().startDraft());
      } catch (err) {
        setError(caseFilingErrorMessage(err));
        return;
      }
      const draft = createBlankDraft(caseId, profile);
      draft.caseId = caseId;
      try {
        await getRepository().putDraft(draft);
      } catch (err) {
        // Not connected is a known state, not a failure (AGENTS.md, Data).
        const unplugged = isNotIntegratedError(err);
        if (unplugged) console.warn(String(err));
        setNotConnected(unplugged);
        setError(
          unplugged
            ? t("newFiling_draftsArentConnectedYet")
            : t("newFiling_weCouldntCreateADraftIn"),
        );
        return;
      }
      router.replace(stepHref(draft.id, "upload"));
    })();
  }, [ready, profile, router, t]);

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <PageOutcome
          tone={notConnected ? "neutral" : "error"}
          icon={notConnected ? UnplugIcon : undefined}
          as="p"
          title={error}
          action={
            <Button asChild variant="outline">
              <Link href={FILINGS_HOME}>
                <ArrowLeftIcon data-icon="inline-start" aria-hidden />
                {t("newFiling_backToDashboard")}
              </Link>
            </Button>
          }
        />
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
      {t("newFiling_startingANewFiling")}
    </div>
  );
}
