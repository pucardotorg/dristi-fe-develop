"use client";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { PAGE_GUTTER } from "@/components/shell/page-frame";
import { CASES_LOAD_ERROR } from "@/lib/cases/content";

type CasesErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * A page under /cases failed to load: a backend error, or (with the data source set to
 * `api`) a cases method engineering has not connected yet. Production hides server
 * error details, so the message stays general.
 */
export default function CasesError({ reset }: CasesErrorProps) {
  return (
    <div className={PAGE_GUTTER}>
      <Empty role="alert">
        <EmptyHeader>
          <EmptyTitle>{CASES_LOAD_ERROR.title}</EmptyTitle>
          <EmptyDescription>{CASES_LOAD_ERROR.body}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={reset}>{CASES_LOAD_ERROR.retry}</Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
