"use client";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

import Link from "next/link";
import { ArrowLeftIcon, FileQuestionIcon } from "lucide-react";

import { draftTitle } from "@/lib/filing/selectors";
import { FILINGS_HOME } from "@/lib/filing/steps";
import { FilingProvider, useFiling } from "@/lib/filing/store";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { DraftBreadcrumbLabel } from "@/components/filing/chrome";

/** Names the loaded draft for the top bar's breadcrumb. */
function DraftTitle() {
  const { draft } = useFiling();
  return <DraftBreadcrumbLabel label={draftTitle(draft)} />;
}

/** Loads one draft into the store; shows the read state and the "no such draft" case. */
export function DraftFrame({
  draftId,
  children,
}: {
  draftId: string;
  children: React.ReactNode;
}) {
  return (
    <FilingProvider
      draftId={draftId}
      fallback={
        <div
          role="status"
          aria-live="polite"
          className="flex flex-1 items-center justify-center py-16 text-body-compact text-muted-foreground"
        >
          <Spinner className="mr-2 size-4" />
          {<__LocalizedText id="draftFrame_openingYourDraft" />}{" "}</div>
      }
      notFound={
        <div className="flex flex-1 items-center justify-center px-4 py-16">
          <Empty className="max-w-md">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileQuestionIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-body font-semibold">
                {<__LocalizedText id="draftFrame_thisDraftIsnTHereAnyMore" />}{" "}</EmptyTitle>
              <EmptyDescription className="text-body">
                {<__LocalizedText id="draftFrame_itMayHaveBeenDiscardedOrThe" />}{" "}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href={FILINGS_HOME}>
                  <ArrowLeftIcon data-icon="inline-start" aria-hidden />
                  {<__LocalizedText id="draftFrame_backToDashboard" />}{" "}</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      }
    >
      <DraftTitle />
      {children}
    </FilingProvider>
  );
}
