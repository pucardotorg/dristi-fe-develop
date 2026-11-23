"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { PAGE_GUTTER } from "@/components/shell/page-frame";

type CasesErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * A page under /cases failed to load. The list catches "not connected yet" itself
 * (`page.tsx`), so this is a real failure there; another page under /cases may still land
 * here for a method engineering hasn't connected. Production hides server error details,
 * so the message stays general, and it names no single page because it covers every page
 * under /cases (the list, folders, search and a case's own pages).
 */
export default function CasesError({ reset }: CasesErrorProps) {
  const t = useTranslations();
  return (
    <div className={PAGE_GUTTER}>
      <Empty role="alert">
        <EmptyHeader>
          <EmptyTitle>{t("casesError_pageCouldNotBeLoaded")}</EmptyTitle>
          <EmptyDescription>{t("casesError_somethingWentWrongFetchingCases")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={reset}>{t("casesError_tryAgain")}</Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
