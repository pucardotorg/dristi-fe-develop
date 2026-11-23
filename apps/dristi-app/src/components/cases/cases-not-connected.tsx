"use client";

import { UnplugIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { PageOutcome } from "@/components/feedback";
import { PAGE_GUTTER } from "@/components/shell/page-frame";

/**
 * The cases list when the backend doesn't answer it yet (data source `api`): a known
 * state, not a failure, so there is no Try again. A client component because the icon is
 * a component, which a server component can't pass to `PageOutcome`.
 */
export function CasesNotConnected() {
  const t = useTranslations();
  return (
    <div className={PAGE_GUTTER}>
      <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col justify-center">
        <PageOutcome
          tone="neutral"
          icon={UnplugIcon}
          title={t("casesPage_casesArentConnectedYet")}
          body={t("casesPage_thisPartOfDristiIsntConnected")}
        />
      </div>
    </div>
  );
}
