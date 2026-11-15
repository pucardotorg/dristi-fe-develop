"use client";

import Link from "next/link";
import { ArrowRightIcon, DownloadIcon, UploadIcon } from "lucide-react";

import { FILINGS_HOME } from "@/lib/filing/steps";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { StageBar } from "@/components/bulk/stage";
import type { CaseStage } from "@/lib/bulk/types";
import { useTranslations } from "next-intl";

/**
 * The latest batch — pushed in from a client's litigation system or uploaded from Excel —
 * and where its cases have reached (docs/design/features/bulk-filing.md).
 */
export type BulkBatch = {
  id: string;
  client: string;
  /** "50 × cheque bounce (S-138, NI Act)". */
  what: string;
  receivedOn: string;
  via: string;
  counts: Record<CaseStage, number>;
};

/** Cases a client's system pushed across for filing, as one batch. */
export function BulkImportCard({ batch, needAction = 0 }: { batch: BulkBatch | null; needAction?: number }) {
  const t = useTranslations();
  return (
    <Card variant="raised" className="gap-0">
      <CardHeader className="flex flex-row items-start gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-info-muted text-info-muted-foreground"
        >
          <DownloadIcon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <CardTitle className="text-body font-semibold">{t("bulkImportCard_bulkFiling")}</CardTitle>
          <CardDescription className="text-body-compact">
            {t("bulkImportCard_bringInManyCasesFromYour")}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-4">
        {batch === null ? (
          <Empty className="items-start gap-0 border-0 p-0 text-left text-wrap">
            <EmptyHeader className="max-w-none items-start">
              <EmptyTitle className="text-body font-semibold">{t("bulkImportCard_noImportsYet")}</EmptyTitle>
              <EmptyDescription className="text-body-compact text-wrap">
                {t("bulkImportCard_casesAClientsSystemSendsOr")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg bg-surface-sunken p-4">
            <p className="text-caption font-semibold text-muted-foreground uppercase">
              {t("bulkImportCard_mostRecentImport")}
            </p>
            <div>
              <p className="text-body font-semibold">{batch.client}</p>
              <p className="text-caption text-muted-foreground">
                {t("bulkImportCard_whatReceivedReceivedOnViaVia", { what: batch.what, receivedOn: batch.receivedOn, via: batch.via })}
              </p>
            </div>
            <StageBar counts={batch.counts} />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {/* Starting one is here too: an API push starts in the client's system, an upload here. */}
          <Button asChild>
            <Link href={`${FILINGS_HOME}/bulk/upload`}>
              <UploadIcon data-icon="inline-start" aria-hidden />
              {t("bulkImportCard_uploadExcel")}
            </Link>
          </Button>
          {batch ? (
            <Button asChild variant="outline">
              <Link href={`${FILINGS_HOME}/bulk/${batch.id}`}>
                {t("bulkImportCard_reviewBatch")}
                <ArrowRightIcon data-icon="inline-end" aria-hidden />
              </Link>
            </Button>
          ) : null}
          <Button asChild variant={batch ? "ghost" : "outline"}>
            <Link href={`${FILINGS_HOME}/bulk`}>
              {batch ? t("bulkImportCard_allBatches") : t("bulkImportCard_openBulkFiling")}
              {needAction ? (
                <Badge variant="warning" className="tabular-nums">
                  {needAction} need{needAction === 1 ? "s" : ""} action
                </Badge>
              ) : null}
              {batch ? null : <ArrowRightIcon data-icon="inline-end" aria-hidden />}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
