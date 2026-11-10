"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

import * as React from "react";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  WandSparklesIcon,
  CircleCheckIcon,
  TriangleAlertIcon,
  UploadIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

import { readability } from "@/lib/filing/readability";

import { demoBlurryScan, demoPdf } from "./demo-fill";
import { bulkApi, useBulkFileUrl, type CaseView } from "./api";
import type { BatchCtx } from "./batch-screen";
import { OriginalDoc } from "./original-doc";

type Doc = CaseView["documents"][number];
type Flag = CaseView["flags"][number];

const ACCEPT = ".pdf,.jpg,.jpeg,.png";

function sizeOf(bytes: number): string {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/**
 * One document of one case, in one compact line: click or drop a file onto an empty slot;
 * a filled slot shows the file, with View and Replace. Locked once the case is signed, as
 * a single filing is.
 */

export function Slot({
  doc,
  locked,
  busy,
  onFile,
  poor,
  onKeep,
}: {
  doc: Doc;
  locked: boolean;
  busy: boolean;
  onFile: (file: File) => void;
  /** The open "blurry or cropped" warning on this file, if any. */
  poor?: Flag;
  /** Keep the file as it is: skips the warning. */
  onKeep?: () => void;
}) {
  const __t = __useTranslations();
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const filled = !!doc.file;
  const href = useBulkFileUrl(doc.file?.id);
  const canUpload = !locked && !!doc.slotKey;
  const choose = () => {
    if (canUpload && !busy) input.current?.click();
  };
  const drop = {
    onDragOver: (e: React.DragEvent) => {
      if (!canUpload) return;
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file && canUpload && !busy) onFile(file);
    },
  };

  // Small text buttons, as the product's own "Replace file"; 32px tall with a 40px hit area.
  const SMALL_BTN = "relative after:absolute after:-inset-y-1 after:inset-x-0";
  const fileLine = doc.file
    ? `${doc.file.name} · ${sizeOf(doc.file.size)}`
    : "";

  const name = (
    <span className="flex min-w-0 flex-1 items-baseline gap-2">
      <span className="truncate text-body-compact font-medium">{doc.name}</span>
    </span>
  );

  return (
    <div {...drop} className={cn("rounded-lg", over && "ring-2 ring-ring")}>
      {filled ? (
        <div
          className="flex h-10 items-center gap-2 rounded-lg bg-surface-sunken pr-1 pl-3"
          title={fileLine}
        >
          {busy ? (
            <Spinner className="shrink-0" />
          ) : poor ? (
            <TriangleAlertIcon
              className="size-4 shrink-0 text-warning-ink"
              aria-label={__t("documentsTab_uploadedHardToRead")}
            />
          ) : (
            <CircleCheckIcon
              className="size-4 shrink-0 text-success-ink"
              aria-label={__t("documentsTab_uploaded")}
            />
          )}
          {name}
          <Button
            asChild
            variant="ghost"
            size="xs"
            className={SMALL_BTN}
            aria-label={__t("documentsTab_viewValue0Value1", {value0: String(doc.name), value1: String(fileLine)})}
            title={fileLine}
          >
            <a href={href ?? undefined} target="_blank" rel="noreferrer">
              {<__LocalizedText id="documentsTab_view" />}{" "}</a>
          </Button>
          {canUpload ? (
            <Button
              variant="ghost"
              size="xs"
              className={SMALL_BTN}
              disabled={busy}
              onClick={choose}
              aria-label={__t("documentsTab_replaceValue0", {value0: String(doc.name)})}
            >
              {<__LocalizedText id="documentsTab_replace" />}{" "}</Button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={choose}
          disabled={!canUpload || busy}
          title={canUpload ? __t("documentsTab_dropAFileHereOrClickTo") : undefined}
          aria-label={__t("documentsTab_uploadValue0Value1", {value0: String(doc.name), value1: String(doc.required ? __t("documentsTab_required_ec04d18d") : __t("documentsTab_optional"))})}
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-lg border border-dashed px-3 text-left transition-colors focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none",
            doc.required ? "border-input" : "border-hairline",
            canUpload && "hover:bg-accent",
            !canUpload && "cursor-not-allowed",
          )}
        >
          {busy ? (
            <Spinner className="shrink-0" />
          ) : (
            <UploadIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          )}
          {name}
          <span
            className={cn(
              "shrink-0 text-caption",
              doc.required ? "text-destructive-ink" : "text-muted-foreground",
            )}
          >
            {doc.required ? __t("documentsTab_required_45421591") : __t("documentsTab_optional_93cd4443")}
          </span>
        </button>
      )}
      {filled && poor ? (
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 px-3 text-caption text-warning-ink">
          <span>{__t(poor.message)}</span>
          {onKeep && canUpload ? (
            <button
              type="button"
              className="text-foreground underline disabled:opacity-50"
              disabled={busy}
              onClick={onKeep}
            >
              {<__LocalizedText id="documentsTab_keepThisFile" />}{" "}</button>
          ) : null}
        </p>
      ) : null}
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </div>
  );
}

/**
 * Documents, case by case: every open case is a panel, and every document it needs is a
 * slot shown at once, to click or drop onto. Cases missing something come first. Signed
 * and filed cases are locked, so they are not listed here.
 */
export function DocumentsTab({ batch, setBatch, go }: BatchCtx) {
  const __t = __useTranslations();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const closed = !!batch.clubbedInto;

  // Cases missing something first, in the order they had when the tab opened, so a case
  // does not jump away the moment its last document goes in.
  const poorOf = (c: CaseView) => c.flags.filter((f) => f.rule === "dcm-poor");
  const needsWork = (c: CaseView) =>
    c.docs.have < c.docs.need || poorOf(c).length > 0;
  const [order] = React.useState(() =>
    [...batch.cases]
      .sort((a, b) => Number(!needsWork(a)) - Number(!needsWork(b)))
      .map((c) => c.id),
  );
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i < 0 ? order.length : i;
  };
  const open = batch.cases
    .filter((c) => c.stage === "held" || c.stage === "ready")
    .sort((a, b) => rank(a.id) - rank(b.id));
  const locked = batch.cases.length - open.length;
  const incomplete = open.filter((c) => c.docs.have < c.docs.need);
  const missing = incomplete.reduce(
    (n, c) => n + (c.docs.need - c.docs.have),
    0,
  );
  const scans = open.reduce((n, c) => n + poorOf(c).length, 0);

  const upload = async (c: CaseView, d: Doc, file: File) => {
    if (!d.slotKey) return;
    setBusy(`${c.id}:${d.slotKey}`);
    setError(null);
    try {
      const poor = (await readability(file)) === "bad";
      setBatch(await bulkApi.attach(batch.id, c.id, d.slotKey, file, poor));
    } catch (e) {
      setError(`${file.name}: ${__t((e as Error).message)}`);
    } finally {
      setBusy(null);
    }
  };

  const keep = async (c: CaseView, f: Flag) => {
    setBusy(`${c.id}:${f.fix?.kind === "upload" ? f.fix.slotKey : ""}`);
    setError(null);
    try {
      setBatch(await bulkApi.act(batch.id, { action: "skip", caseId: c.id, flagId: f.id }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // Demo: a small PDF into every empty slot, one case or the whole batch. The first
  // case's first slot gets a scan too small to read, so the blurry-scan warning shows.
  const blurryAt = batch.cases[0]?.id;
  const fillDemo = async (cases: CaseView[]) => {
    setError(null);
    for (const c of cases)
      for (const [i, d] of c.documents.filter((x) => !x.file && x.slotKey).entries()) {
        setBusy(`${c.id}:${d.slotKey}`);
        try {
          const blurry = c.id === blurryAt && i === 0;
          const file = blurry ? await demoBlurryScan(d.name) : demoPdf(d.name);
          setBatch(
            await bulkApi.attach(batch.id, c.id, d.slotKey!, file, blurry),
          );
        } catch (e) {
          setError((e as Error).message);
          setBusy(null);
          return;
        }
      }
    setBusy(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-body-compact">
        {incomplete.length && !closed ? (
          <Button
            variant="outline"
            size="sm"
            disabled={!!busy}
            onClick={() => void fillDemo(incomplete)}
          >
            <WandSparklesIcon data-icon="inline-start" aria-hidden />
            {<__LocalizedText id="documentsTab_fillAllWithDemoFiles" />}{" "}</Button>
        ) : null}
        {missing ? (
          <span className="flex items-center gap-2">
            <CircleAlertIcon className="size-4 text-warning-ink" aria-hidden />
            <span className="tabular-nums">
              {missing} {<__LocalizedText id="documentsTab_requiredDocument" />}{missing === 1 ? "" : "s"} {<__LocalizedText id="documentsTab_missingAcross" />}{" "}{incomplete.length} {<__LocalizedText id="documentsTab_case" />}{" "}{incomplete.length === 1 ? "" : "s"}
            </span>
          </span>
        ) : open.length ? (
          <span className="flex items-center gap-2">
            <CheckCircle2Icon className="size-4 text-success-ink" aria-hidden />
            {<__LocalizedText id="documentsTab_everyRequiredDocumentIsIn" />}{" "}</span>
        ) : null}
        {scans ? (
          <span className="flex items-center gap-2">
            <TriangleAlertIcon className="size-4 text-warning-ink" aria-hidden />
            <span className="tabular-nums">
              {scans} {<__LocalizedText id="documentsTab_scan" />}{scans === 1 ? "" : "s"} {<__LocalizedText id="documentsTab_hardToRead" />}{" "}</span>
          </span>
        ) : null}
        {locked ? (
          <span className="text-muted-foreground tabular-nums">
            {locked} {<__LocalizedText id="documentsTab_case" />}{locked === 1 ? __t("documentsTab_is") : __t("documentsTab_sAre")} {<__LocalizedText id="documentsTab_signedOrFiledSo" />}{" "}
            {locked === 1 ? __t("documentsTab_its") : __t("documentsTab_their")} {<__LocalizedText id="documentsTab_documentsCannotChange" />}{" "}
            <button
              type="button"
              className="underline"
              onClick={() => go(batch.counts.filed ? "filed" : "pay")}
            >
              {batch.counts.filed ? __t("documentsTab_seeFiledCases") : __t("documentsTab_goToPayment")}
            </button>
          </span>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{__t(error)}</AlertDescription>
        </Alert>
      ) : null}

      {open.length === 0 ? (
        <Card className={PANEL_CLASS}>
          <CardContent className="text-body-compact text-muted-foreground">
            {<__LocalizedText id="documentsTab_allDocumentsAreIn" />}{" "}</CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {open.map((c) => {
            const complete = c.docs.have >= c.docs.need;
            return (
              <li key={c.id}>
                <Card className={cn(PANEL_CLASS, "gap-0 py-4")}>
                  {/* The case in brief beside its slots: what each paper should show. */}
                  <CardContent className="grid grid-cols-1 gap-4 px-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-6">
                    <div className="flex min-w-0 flex-col gap-3">
                      <div className="flex min-w-0 flex-col">
                        <CardTitle className="truncate text-body font-semibold">
                          {c.accused || __t(c.title)}
                        </CardTitle>
                        <span className="truncate text-body-compact text-muted-foreground tabular-nums">
                          {c.reference}
                        </span>
                      </div>
                      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-caption">
                        {c.facts.map((f, k) => (
                          <React.Fragment key={k}>
                            <dt className="text-muted-foreground">{__t(f.label)}</dt>
                            <dd className="min-w-0 break-words tabular-nums">
                              {f.value}
                            </dd>
                          </React.Fragment>
                        ))}
                      </dl>
                      {c.original ? (
                        <div className="border-t border-hairline pt-3">
                          <OriginalDoc original={c.original} />
                        </div>
                      ) : null}
                      {!complete && !closed ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-fit"
                          disabled={!!busy}
                          onClick={() => void fillDemo([c])}
                        >
                          <WandSparklesIcon
                            data-icon="inline-start"
                            aria-hidden
                          />
                          {<__LocalizedText id="documentsTab_fillWithDemoFiles" />}{" "}</Button>
                      ) : null}
                      <Badge
                        variant={complete ? "success" : "warning"}
                        className="w-fit tabular-nums"
                      >
                        {c.docs.have} {<__LocalizedText id="documentsTab_of" />}{" "}{c.docs.need} {<__LocalizedText id="documentsTab_required" />}{" "}</Badge>
                    </div>
                    <ul className="grid grid-cols-1 content-start gap-2 lg:grid-cols-2">
                      {c.documents.map((d) => {
                        const poor = poorOf(c).find(
                          (f) => f.fix?.kind === "upload" && f.fix.slotKey === d.slotKey,
                        );
                        return (
                          <li key={`${d.group}-${d.slotKey ?? d.name}`}>
                            <Slot
                              doc={d}
                              locked={closed}
                              busy={busy === `${c.id}:${d.slotKey}`}
                              onFile={(file) => void upload(c, d, file)}
                              poor={poor}
                              onKeep={poor ? () => void keep(c, poor) : undefined}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
