"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

import * as React from "react";
import { ChevronDownIcon, ExternalLinkIcon, HistoryIcon } from "lucide-react";

import {
  HistoryTypeFilter,
  type TypeOption,
} from "@/components/employee/order-case-history";
import { useCourtToday } from "@/components/employee/use-court-today";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Timeline, TimelineItem } from "@/components/ui/timeline";
import {
  groupedCaseHistory,
  threadUpdatedOn,
  type HistoryRow,
} from "@/lib/employee/grouped-case-history";
import {
  caseTimeline,
  formatTimelineDate,
  hearingCaseExtras,
  hearingSittings,
} from "@/lib/employee/hearing-overview";
import type { CourtHearing } from "@/lib/employee/hearings";
import { HISTORY_TYPES } from "@/lib/employee/order-case-history";
import { FEATURE_NAME as NOTICE_PROCESS_STATUS } from "@/lib/cases/service";
import { cn } from "@/lib/utils";

type OrderRow = Extract<HistoryRow, { kind: "order" }>;
type ThreadRow = Extract<HistoryRow, { kind: "thread" }>;

/**
 * The cause list overview's Case history tab, grouped (`groupedCaseHistory`): one line
 * per process and per application, sitting at the day it last changed — so it moves up
 * as it changes — with its current status and the day it began; it opens to the events it
 * collected. Orders read as their summary and name the process or application they
 * started or decided — a press goes to that line.
 *
 * **Nothing opens over the history** (owner, 2026-10-23). An order opens in the case's
 * Orders tab, an application in its Applications tab, a process in Notice/Process
 * status — each in a new browser tab, so the sheet or the order screen stays put.
 *
 * Newest first, at the top, and so are a thread's own events (owner, 2026-10-23). Used by
 * the cause list's sheet and the order screen's Case history tab alike. The filter is the
 * ungrouped history's (`OrderCaseHistory`).
 */
export function GroupedCaseHistory({
  hearing,
  throughLastOrder = false,
}: {
  hearing: CourtHearing;
  /** Only the lines from the newest down to the last order, and no filter — the case
   *  overview's Case updates (owner, 2026-10-23). */
  throughLastOrder?: boolean;
}) {
  const today = useCourtToday();
  const rows = React.useMemo(() => {
    const extras = hearingCaseExtras(hearing.id);
    const all = groupedCaseHistory(
      caseTimeline(hearing, extras, today).inCourt,
      hearingSittings(hearing.id),
      hearing.parties.accused,
      hearing.id,
    );
    if (!throughLastOrder) return all;
    const last = all.findIndex((row) => row.kind === "order" && row.last);
    return last >= 0 ? all.slice(0, last + 1) : all;
  }, [hearing, today, throughLastOrder]);
  return <CaseHistoryList rows={rows} filter={!throughLastOrder} />;
}

/**
 * The grouped history's list, for rows built elsewhere — a complaint at cognizance has no
 * listing to build them from (`cognizanceHistory`).
 */
export function CaseHistoryList({
  rows,
  filter = true,
}: {
  rows: HistoryRow[];
  /** The type filter above the list. */
  filter?: boolean;
}) {
  const __t = __useTranslations();

  const typeOptions = React.useMemo<TypeOption[]>(() => {
    const present = new Set(rows.map((row) => row.type));
    return [
      ...HISTORY_TYPES.filter((type) => present.has(type.value)),
      ...(present.has("other")
        ? [{ value: "other", label: __t("groupedCaseHistory_otherEvents") }]
        : []),
    ];
  }, [rows, __t]);
  const [types, setTypes] = React.useState<string[]>([]);
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const jumpTo = React.useRef<string | null>(null);
  const [, setTick] = React.useState(0);
  const listRef = React.useRef<HTMLElement>(null);

  /* Bring a line into view in the tab's own scroll — not `scrollIntoView`, which would
     move the sheet too. A third of the way down, so what came after it shows above. */
  const reveal = React.useCallback((id: string, focus: boolean) => {
    const target = listRef.current?.querySelector<HTMLElement>(
      `[data-row="${CSS.escape(id)}"]`,
    );
    const scroller = target?.closest<HTMLElement>('[data-slot="tabs-content"]');
    if (!target || !scroller) return;
    const offset =
      target.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTop += offset - scroller.clientHeight / 3;
    if (focus)
      target.querySelector<HTMLElement>("[data-focus-target]")?.focus();
  }, []);

  /* A press on a link to another line: after the list has re-rendered with it shown
     (and its thread open). Every commit, so it runs whatever the press changed. */
  React.useLayoutEffect(() => {
    if (!jumpTo.current) return;
    reveal(jumpTo.current, true);
    jumpTo.current = null;
  });

  function go(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    /* The target may be filtered out; showing everything is the way to it. */
    if (types.length && !types.includes(row.type)) setTypes([]);
    if (row.kind === "thread")
      setExpanded((current) => new Set(current).add(id));
    jumpTo.current = id;
    /* A re-render to run the jump even when nothing else changed. */
    setTick((tick) => tick + 1);
  }

  function toggle(id: string, open: boolean) {
    setExpanded((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  if (rows.length === 0) {
    return (
      <Empty className="border-0 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HistoryIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-body-compact font-semibold tracking-normal">
            {<__LocalizedText id="groupedCaseHistory_noCaseHistoryYet" />}{" "}</EmptyTitle>
          <EmptyDescription className="text-body-compact">
            {<__LocalizedText id="groupedCaseHistory_eventsAndOrdersOnThisCaseWill" />}{" "}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const shown =
    types.length === 0 ? rows : rows.filter((row) => types.includes(row.type));

  return (
    <section
      ref={listRef}
      aria-labelledby="grouped-case-history"
      className="flex min-w-0 flex-col gap-4"
    >
      <h2 id="grouped-case-history" className="sr-only">
        {<__LocalizedText id="groupedCaseHistory_caseHistory" />}{" "}</h2>
      {filter ? (
        <HistoryTypeFilter
          options={typeOptions}
          value={types}
          onValueChange={setTypes}
        />
      ) : null}

      {shown.length === 0 ? (
        <p className="text-body-compact text-muted-foreground">
          {<__LocalizedText id="groupedCaseHistory_nothingOfTheseTypesOnThisCase" />}{" "}</p>
      ) : (
        <Timeline
          className="text-body-compact"
          aria-label={__t("groupedCaseHistory_caseHistoryNewestFirst")}
        >
          {shown.map((row) => (
            <TimelineItem
              key={row.id}
              data-row={row.id}
              status={
                row.kind === "order" && row.last
                  ? "current"
                  : row.kind === "thread" && row.open
                    ? "future"
                    : "past"
              }
              className="pb-0"
              aria-current={
                row.kind === "order" && row.last ? "true" : undefined
              }
            >
              {/* Spacing inside the item, so the rail runs on to the next dot. */}
              <div className="pb-4 group-last/timeline-item:pb-0">
                {row.kind === "thread" ? (
                  <ThreadLine
                    row={row}
                    open={expanded.has(row.id)}
                    onOpenChange={(open) => toggle(row.id, open)}
                    onGo={go}
                  />
                ) : row.kind === "order" ? (
                  <OrderLine row={row} onGo={go} />
                ) : (
                  <EventLine row={row} />
                )}
              </div>
            </TimelineItem>
          ))}
        </Timeline>
      )}
    </section>
  );
}

/** What happened, and its day on the right — the line every kind of row starts with. */
function Head({ on, children }: { on: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-4">
      <div className="min-w-0">{children}</div>
      <time
        dateTime={on}
        className="shrink-0 tabular-nums text-muted-foreground"
      >
        {formatTimelineDate(on)}
      </time>
    </div>
  );
}

function EventLine({ row }: { row: Extract<HistoryRow, { kind: "event" }> }) {
  const __t = __useTranslations();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Head on={row.on}>
        {row.href ? (
          <a
            href={row.href}
            target="_blank"
            rel="noopener"
            className="rounded-sm text-primary underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {__t(row.label)}
            <span className="sr-only"> {<__LocalizedText id="groupedCaseHistory_opensInANewTab" />}</span>
          </a>
        ) : (
          <span>{__t(row.label)}</span>
        )}
      </Head>
      {row.note ? <p className="text-muted-foreground">{__t(row.note)}</p> : null}
    </div>
  );
}

/**
 * An order: its title, its summary, Open the order — in the case's Orders tab, in a new
 * browser tab — and the process or application it started or decided. The last order sits
 * on a sunken well with its badge, as before.
 */
function OrderLine({
  row,
  onGo,
}: {
  row: OrderRow;
  onGo: (id: string) => void;
}) {
  const __t = __useTranslations();
  const summaryId = `${row.id}-summary`;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1",
        row.last &&
          "-my-2 rounded-lg border border-hairline bg-surface-sunken px-3 py-2",
      )}
    >
      <Head on={row.on}>
        <span className="font-medium">{__t(row.label)}</span>
      </Head>
      {row.last ? (
        <Badge variant="info" className="mb-1">
          {<__LocalizedText id="groupedCaseHistory_lastOrder" />}{" "}</Badge>
      ) : null}
      <p id={summaryId}>{__t(row.summary)}</p>
      <div className="flex min-w-0 flex-wrap items-center gap-x-4">
        <NewTabLink href={row.href} focusTarget describedBy={summaryId}>
          {<__LocalizedText id="groupedCaseHistory_openTheOrder" />}{" "}</NewTabLink>
        {row.affects.map((thread) => (
          <Button
            key={thread.id}
            type="button"
            variant="link"
            size="sm"
            className="h-10 w-fit px-0 text-muted-foreground"
            onClick={() => onGo(thread.id)}
          >
            {<__LocalizedText id="groupedCaseHistory_goTo" />}{" "}{__t(thread.label)}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** A link into the case view that leaves the history where it is: a new browser tab. */
function NewTabLink({
  href,
  focusTarget,
  describedBy,
  children,
}: {
  href: string;
  focusTarget?: boolean;
  describedBy?: string;
  children: React.ReactNode;
}) {
  return (
    <Button asChild variant="link" size="sm" className="h-10 w-fit px-0">
      <a
        href={href}
        target="_blank"
        rel="noopener"
        data-focus-target={focusTarget || undefined}
        aria-describedby={describedBy}
      >
        {children}
        <span className="sr-only"> {<__LocalizedText id="groupedCaseHistory_opensInANewTab" />}</span>
        <ExternalLinkIcon data-icon="inline-end" aria-hidden />
      </a>
    </Button>
  );
}

const STEPS_PLURAL = new Intl.PluralRules("en-IN");

/**
 * A process or application on one line: what it is and the day it last changed, where it
 * sits; its status, read off that latest event, and the day it began; and a link to
 * where the case view keeps it, in a new browser tab. It opens to the events themselves —
 * each with its day, and the order behind it where an order caused it.
 */
function ThreadLine({
  row,
  open,
  onOpenChange,
  onGo,
}: {
  row: ThreadRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGo: (id: string) => void;
}) {
  const __t = __useTranslations();
  const updatedOn = threadUpdatedOn(row);
  const count = row.steps.length;
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="flex min-w-0 flex-col gap-1">
        <Head on={updatedOn}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              data-focus-target
              className="group/thread -mx-1 inline-flex min-h-6 items-baseline gap-1 rounded-sm px-1 text-left font-medium hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="min-w-0">
                <span className="sr-only">{row.entity}: </span>
                {__t(row.label)}
              </span>
              <ChevronDownIcon
                aria-hidden
                className="size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform group-data-[state=open]/thread:rotate-180"
              />
            </button>
          </CollapsibleTrigger>
        </Head>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Badge variant={row.tone}>{row.status}</Badge>
          <span className="text-muted-foreground">
            {/* With one step, the day it began is the day on the right. */}
            {count > 1 ? (
              <>
                {<__LocalizedText id="groupedCaseHistory_started" />}{" "}
                <time dateTime={row.on} className="tabular-nums">
                  {formatTimelineDate(row.on)}
                </time>
                {" · "}
              </>
            ) : null}
            <span className="tabular-nums">{count}</span>{" "}
            {STEPS_PLURAL.select(count) === "one" ? __t("groupedCaseHistory_update") : __t("groupedCaseHistory_updates")}
          </span>
          <NewTabLink href={row.href}>
            {row.entity === "Process"
              ? __t("groupedCaseHistory_openInValue0", {value0: String(NOTICE_PROCESS_STATUS)})
              : __t("groupedCaseHistory_openTheApplication")}
          </NewTabLink>
        </div>
        <CollapsibleContent>
          <ol
            aria-label={`${__t(row.label)}, newest first`}
            className="mt-2 flex flex-col gap-2 rounded-lg border border-hairline bg-surface-sunken px-3 py-2"
          >
            {row.steps.toReversed().map((step, index) => (
              <li
                key={index}
                className="grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3"
              >
                <time
                  dateTime={step.on}
                  className="tabular-nums text-muted-foreground"
                >
                  {formatTimelineDate(step.on)}
                </time>
                <span className="min-w-0">
                  {__t(step.label)}
                  {step.orderId ? (
                    <>
                      {" · "}
                      <button
                        type="button"
                        className="rounded-sm text-primary underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        onClick={() => onGo(step.orderId!)}
                      >
                        {<__LocalizedText id="groupedCaseHistory_seeTheOrder" />}{" "}</button>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
