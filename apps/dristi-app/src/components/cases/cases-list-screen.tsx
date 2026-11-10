"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  FileSearchIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  allBucketsLabel,
  buildCasesHref,
  selectCases,
  type CasesQuery,
} from "@/lib/cases/query";
import { bucketLabel, type CaseRecord } from "@/lib/cases/types";
import { Breadcrumbs } from "@/components/shell/chrome";

import { CasePeekSurface } from "./case-peek";
import { CasesListResults } from "./cases-list-results";
import { CasesTableColumnsMenu } from "./cases-table-columns-menu";
import { useCasesNavigation } from "./use-cases-navigation";
import { CasePeekProvider } from "./use-case-peek";

export function CasesListScreen({
  query,
  cases,
  initialBookmarks,
  now,
}: {
  query: CasesQuery;
  cases: CaseRecord[];
  initialBookmarks: string[];
  now: number;
}) {
  const __t = __useTranslations();
  const router = useRouter();
  const { search, effective, go, onSearchChange } = useCasesNavigation(query);
  const [bookmarks, setBookmarks] = React.useState<ReadonlySet<string>>(
    () => new Set(initialBookmarks)
  );

  const selection = selectCases({
    query: effective,
    bookmarks,
    now,
    source: cases,
  });
  const title = query.bucket ? bucketLabel(query.bucket) : "Search results";
  const backLabel = allBucketsLabel(query);
  const backHref = buildCasesHref(query, {
    bucket: null,
    search: "",
    stage: [],
  });
  const onlyLongPending =
    query.status.length === 1 && query.status[0] === "long-pending";

  function pageLink(page: number) {
    const href = buildCasesHref(effective, { page });
    return {
      href,
      onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        router.push(href);
      },
    };
  }

  function toggleBookmark(id: string) {
    setBookmarks((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-8 p-6 md:p-8">
      {/* Cases › the folder. Publishing the crumb is what links the root back. */}
      <Breadcrumbs crumbs={[{ label: __t(title) }]} />
      <div>
        <Button variant="ghost" className="w-fit" asChild>
          <Link href={backHref}>
            <ArrowLeftIcon data-icon="inline-start" aria-hidden />
            {__t(backLabel)}
          </Link>
        </Button>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-title-l font-semibold">{__t(title)}</h1>
      </header>

      <CasePeekProvider now={now}>
        <CasePeekSurface className="flex flex-col gap-6 rounded-xl border border-hairline bg-card shadow-raised p-6">
        {/* Same header grammar as the landing panel: what narrows the list on the
            right, no visible "Search cases" heading over the box. */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-end">
          <div className="w-full min-w-0 sm:w-72">
            <Label htmlFor="cases-search" className="sr-only">
              {<__LocalizedText id="casesListScreen_searchCases" />}{" "}</Label>
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                id="cases-search"
                type="search"
                autoComplete="off"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={__t("casesListScreen_searchByCaseNameOrNumber")}
              />
            </InputGroup>
          </div>
          <CasesTableColumnsMenu hideStage />
        </div>

        {search ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onSearchChange("")}
              aria-label={__t("casesListScreen_removeSearchValue0", {value0: String(search)})}
            >
              {<__LocalizedText id="casesListScreen_search" />}{" "}{search}
              <XIcon data-icon="inline-end" aria-hidden />
            </Button>
          </div>
        ) : null}

        {selection.total === 0 ? (
          <Empty className="border-0 p-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileSearchIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-title-s font-semibold">
                {<__LocalizedText id="casesListScreen_noCasesMatchTheseFilters" />}{" "}</EmptyTitle>
              <EmptyDescription className="text-body">
                {search
                  ? __t("casesListScreen_nothingHereMatchesThisSearchTryAnother", {value0: String(backLabel.toLowerCase())})
                  : __t("casesListScreen_nothingHereMatchesGoBackAndTry")}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {search ? (
                <Button variant="outline" onClick={() => onSearchChange("")}>
                  {<__LocalizedText id="casesListScreen_clearSearch" />}{" "}</Button>
              ) : (
                <Button variant="outline" asChild>
                  <Link href={backHref}>{__t(backLabel)}</Link>
                </Button>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <CasesListResults
            selection={selection}
            pageSize={effective.pageSize}
            onPageSizeChange={(pageSize) => go({ pageSize })}
            bookmarks={bookmarks}
            onToggleBookmark={toggleBookmark}
            pageLink={pageLink}
            framed={false}
            hideStage
            hideLongPendingFlag={onlyLongPending}
          />
        )}
        </CasePeekSurface>
      </CasePeekProvider>
    </div>
  );
}
