"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

import * as React from "react";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
  ItemGroup,
} from "@/components/ui/item";
import { formatCourtDay, isoDay } from "@/lib/employee/hearings";
import {
  courtNavClubbed,
  courtNavClubbedTotal,
  type CourtNavItem,
} from "@/lib/employee/navigation";
import { useCourt } from "@/components/court/court-provider";
import { useCourtRole } from "@/components/employee/use-court-role";

const NEVER_CHANGES = () => () => {};
const readToday = () => isoDay(new Date());

/**
 * Today's actions — the "actions" combined layout's one row, opened.
 *
 * Every row `COURT_NAV_GROUPS` holds except Today's hearings, Bulk reschedule hearings
 * and Sign process (`courtNavClubbed("actions")`) — hearings keep a tab of their own
 * next to this one (`employee-nav.tsx`'s "actions" row order), so nothing here is a
 * hearing. Flattened into one plain list otherwise, no distinction between a scrutiny
 * filing and a signing queue, which is the point of this layout next to
 * `TodaysScheduleScreen`'s. Each row still opens the real queue behind it: this screen
 * is an index over `COURT_NAV_GROUPS`, not a second copy of what any of them holds.
 */
export function TodaysActionsScreen() {
  const __t = __useTranslations();
  const today = React.useSyncExternalStore(NEVER_CHANGES, readToday, readToday);
  const { court } = useCourt();
  const seat = useCourtRole();
  const items = courtNavClubbed("actions", court, seat);
  const total = courtNavClubbedTotal("actions", court, seat);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-title text-balance font-semibold">
          {<__LocalizedText id="todaysActionsScreen_todaySActions" />}{" "}</h1>
        <p className="text-body text-muted-foreground tabular-nums">
          {<__LocalizedText id="todaysActionsScreen_today" />}{" "}{formatCourtDay(today)} ·{" "}
          {total === 1 ? __t("todaysActionsScreen_1Waiting") : `${total} waiting`} {<__LocalizedText id="todaysActionsScreen_across" />}{" "}
          {items.length} {<__LocalizedText id="todaysActionsScreen_queues" />}{" "}</p>
      </header>

      <section
        aria-label={__t("todaysActionsScreen_todaySActions_cce26cdf")}
        className="flex min-w-0 flex-col gap-4 rounded-xl border border-hairline bg-card shadow-raised p-6"
      >
        <ItemGroup className="gap-3">
          {items
            .filter((item) => item.href)
            .map((item) => (
              <CourtActionRow key={item.id} item={item} />
            ))}
        </ItemGroup>
      </section>
    </div>
  );
}

/**
 * One queue, as a single row: its name and how much of it is waiting. Shared with
 * `TodaysScheduleScreen`, whose flat list below the hearings block is this same row.
 */
export function CourtActionRow({ item }: { item: CourtNavItem }) {
  const __t = __useTranslations();
  const count = item.count ?? 0;
  return (
    <Item asChild variant="muted" className="px-4 py-3">
      <Link href={item.href!}>
        <ItemContent>
          <ItemTitle className="text-body font-medium">
            {__t(item.label)}
          </ItemTitle>
        </ItemContent>
        <ItemActions className="gap-3">
          {count > 0 ? (
            <span className="flex items-baseline gap-1.5">
              <span className="text-title-s font-semibold tabular-nums">
                {count}
              </span>
              <span className="text-caption text-muted-foreground">
                {<__LocalizedText id="todaysActionsScreen_waiting" />}{" "}</span>
            </span>
          ) : (
            <span className="text-caption text-muted-foreground">
              {<__LocalizedText id="todaysActionsScreen_nothingWaiting" />}{" "}</span>
          )}
          <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground" />
        </ItemActions>
      </Link>
    </Item>
  );
}
