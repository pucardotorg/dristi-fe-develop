"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

/**
 * The route body for a scrutiny return: find the task, open the filing it corrects, and
 * hand both to the correction screen.
 *
 * It refuses to render a half-loaded correction round. A partially loaded form can show a
 * field as clean when scrutiny flagged it, which is the one failure this screen must not
 * have — so a missing task, a missing filing or a return with no defects each get their
 * own honest end state with a route back (brief §10).
 */

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FileTextIcon, InboxIcon } from "lucide-react";

import {
  ensureScrutinyDraft,
  isScrutinyDemoDraft,
  reseedScrutinyDraft,
} from "@/lib/filing/scrutiny-demo";
import { FilingProvider } from "@/lib/filing/store";
import { ProfileProvider } from "@/lib/filing/profile";
import { canView } from "@/lib/tasks/permissions";
import { useTasks } from "@/lib/tasks/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { PANEL_CLASS } from "@/components/shell/panel";
import { CorrectionScreen } from "@/components/scrutiny/correction-screen";
import { Breadcrumbs, type Crumb } from "@/components/shell/chrome";
import { useOrigin } from "@/components/shell/origin";

/**
 * Every state of this route, dead ends included, sits under the same trail — rooted at
 * the door it was reached through when the link recorded one.
 */
function Frame({ children, root }: { children: React.ReactNode; root?: Crumb | null }) {
  const __t = __useTranslations();
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <Breadcrumbs root={root} crumbs={[{ label: __t("scrutinyPage_scrutinyReturn") }]} />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        {children}
      </div>
    </main>
  );
}

function Dead({
  title,
  description,
  taskId,
  origin,
}: {
  title: string;
  description: string;
  taskId?: string;
  origin?: Crumb | null;
}) {
  const __t = __useTranslations();
  // The way out is the door, when one was recorded — a dead end is the worst place to
  // put someone down in an area they did not come from.
  const back = origin?.href ?? (taskId ? `/tasks?task=${encodeURIComponent(taskId)}` : "/tasks");
  return (
    <Frame root={origin}>
      <Card className={cn(PANEL_CLASS, "py-0")}>
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileTextIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{__t(title)}</EmptyTitle>
            <EmptyDescription>{__t(description)}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="outline">
              <Link href={back}>{origin ? __t("scrutinyPage_backToValue0", {value0: String(__t(origin.label))}) : __t("scrutinyPage_backToTasks")}</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </Card>
    </Frame>
  );
}

function Loading({ root }: { root?: Crumb | null }) {
  return (
    <Frame root={root}>
      <Skeleton className="h-8 w-96" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </Frame>
  );
}

export function ScrutinyReturnPage() {
  const __t = __useTranslations();
  const params = useParams<{ taskId: string }>();
  const origin = useOrigin();
  const { state, tasks, cases, user, dispatch } = useTasks();
  const id = decodeURIComponent(params.taskId);
  const task = tasks.find((t) => t.id === id) ?? null;
  const kase = task ? (cases.find((c) => c.id === task.caseId) ?? null) : null;
  const draftId = task?.draftId;

  /*
   * The returned filing is seeded into this browser on first arrival. A sandbox return
   * starts fresh on every opening instead — its filing reseeded and its corrections
   * cleared from the task — so a demo always opens at "0 of N done" (owner, 2026-10-12).
   */
  const [seeded, setSeeded] = React.useState(false);
  const freshened = React.useRef(false);
  const ready = state === "ready" && !!task;
  React.useEffect(() => {
    if (!draftId) return;
    if (isScrutinyDemoDraft(draftId) && !ready) return;
    let live = true;
    const open = async () => {
      if (isScrutinyDemoDraft(draftId) && !freshened.current) {
        freshened.current = true;
        await reseedScrutinyDraft(draftId);
        /* Sent back in an earlier run of the demo: open again, so it can be sent again. */
        if (task && (task.status !== "open" || task.returned?.defects.some((d) => d.resolution))) {
          await dispatch(task.id, (t) =>
            t.returned
              ? {
                  ...t,
                  status: "open",
                  statusNote: undefined,
                  returned: {
                    ...t.returned,
                    defects: t.returned.defects.map((d) => ({ ...d, resolution: undefined })),
                  },
                }
              : t,
          ).catch(() => undefined);
        }
      } else {
        await ensureScrutinyDraft(draftId);
      }
      if (live) setSeeded(true);
    };
    void open();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, ready]);

  if (state !== "ready") return <Loading root={origin} />;

  if (!task || !kase) {
    return (
      <Dead
        title={__t("scrutinyPage_thisTaskIsNotHere")}
        description={__t("scrutinyPage_itMayHaveBeenResetWithThe")}
        origin={origin}
      />
    );
  }
  if (!canView(user, kase)) {
    return (
      <Dead
        title={__t("scrutinyPage_notOnYourAccess")}
        description={__t("scrutinyPage_youAreNotOnThisCaseS")}
        taskId={task.id}
        origin={origin}
      />
    );
  }
  if (task.kind !== "returned" || !task.returned?.defects.length) {
    return (
      <Dead
        title={__t("scrutinyPage_nothingWasReturnedForCorrection")}
        description={__t("scrutinyPage_thisTaskCarriesNoScrutinyDefectsSo")}
        taskId={task.id}
        origin={origin}
      />
    );
  }

  /*
   * A return on a filing that was not made in DRISTI: the remarks are real, but there is
   * no draft to open, so the screen says so rather than showing an empty form. The
   * officer's remarks stay readable on the task itself.
   */
  if (!draftId) {
    return (
      <Frame root={origin}>
        <Card className={cn(PANEL_CLASS, "py-0")}>
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <InboxIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{<__LocalizedText id="scrutinyPage_thisFilingWasNotMadeInDristi" />}</EmptyTitle>
              <EmptyDescription>
                {<__LocalizedText id="scrutinyPage_scrutinySRemarksAreOnTheTask" />}{" "}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild variant="outline">
                <Link href={`/tasks?task=${encodeURIComponent(task.id)}`}>
                  {<__LocalizedText id="scrutinyPage_readTheRemarks" />}{" "}</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </Card>
      </Frame>
    );
  }

  if (!seeded) return <Loading root={origin} />;

  return (
    <FilingProvider
      draftId={draftId}
      fallback={<Loading />}
      notFound={
        <Dead
          title={__t("scrutinyPage_weCouldnTOpenTheFiling")}
          description={__t("scrutinyPage_theReturnedFilingIsNotInThis")}
          taskId={task.id}
          origin={origin}
        />
      }
    >
      {/* The filer's profile, as the filings area mounts it: the signing window that
          now opens over this screen reads who is signing from it. */}
      <ProfileProvider>
        <CorrectionScreen task={task} kase={kase} />
      </ProfileProvider>
    </FilingProvider>
  );
}
