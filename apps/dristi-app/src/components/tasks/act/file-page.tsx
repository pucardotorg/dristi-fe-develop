"use client";

/**
 * File — the documents the court asked for, one slot each with a real file picker (PDF
 * or images, stored in the browser), as an act-modal body. A signatory files with the
 * court (confirmed first) and the task waits on scrutiny; anyone else on the case fills
 * the slots and marks it ready. On an awaiting-court task the action region carries the
 * registry sandbox: accept, or return with defects — which creates the `returned` task.
 * Draft complaints and applications (`draft` kind) use this body too: finishing one is
 * filing it.
 */

import * as React from "react";
import { SaveIcon, SendIcon } from "lucide-react";

import { ChromeAlertDialogContent } from "@/components/chrome/app-chrome";

import { dueCueOf } from "@/lib/tasks/format";
import { TERMINAL } from "@/lib/tasks/permissions";
import { file, saveDraft } from "@/lib/tasks/transitions";
import type { StoredFileRef } from "@/lib/tasks/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useTaskActions } from "@/components/tasks/use-task-actions";
import {
  type ActContext,
  closedTitle,
  CourtSandbox,
  FileChip,
  FileSlot,
  PrepareCard,
  PreparedNote,
  RailCard,
  RecordCard,
  signatoryLine,
} from "@/components/tasks/act/shared";
import { StatusLine } from "@/components/feedback";
import { useTranslations } from "next-intl";

/** The slots, editable while the task is open to this person. */
function Documents({
  ctx,
  files,
  editable,
  onChange,
}: {
  ctx: ActContext;
  files: StoredFileRef[];
  editable: boolean;
  onChange: (files: StoredFileRef[]) => void;
}) {
  const tr = useTranslations();
  const { task, online } = ctx;
  const slots = task.documentsNeeded?.length ? task.documentsNeeded : ["Document"];
  const loose = files.filter((f) => !f.slot || !slots.includes(f.slot));
  const filled = slots.filter((s) => files.some((f) => f.slot === s)).length;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <h3 className="text-body font-semibold">{tr("actFilePage_documentsNeeded")}</h3>
        <p className="text-body-compact text-muted-foreground tabular-nums">
          {tr("actFilePage_filledOfLengthAttachedValue", {
            filled: String(filled),
            length: String(slots.length),
            value: task.deadlineNote
              ? ` · ${task.deadlineNote}`
              : task.dueAt
                ? ` · ${dueCueOf(task).primary.toLowerCase()}`
                : "",
          })}
        </p>
      </div>
      <ul className="divide-y divide-hairline">
        {slots.map((slot) => {
          const f = files.find((x) => x.slot === slot);
          return editable ? (
            <FileSlot
              key={slot}
              name={slot}
              file={f}
              disabled={!online}
              onFile={(ref) => onChange([...files.filter((x) => x.slot !== slot), ref])}
              onRemove={() => onChange(files.filter((x) => x !== f))}
            />
          ) : (
            <li key={slot} className="flex flex-col gap-2 py-3">
              <p className="text-body-compact font-medium">{slot}</p>
              {f ? (
                <FileChip file={f} />
              ) : (
                <p className="text-caption text-muted-foreground">
                  {tr("actFilePage_notAttached")}
                </p>
              )}
            </li>
          );
        })}
        {loose.map((f) => (
          <li key={f.id} className="py-3">
            <FileChip file={f} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A signatory's rail: file with the court, or save what is attached for later. */
function FileCard({
  ctx,
  files,
  complete,
}: {
  ctx: ActContext;
  files: StoredFileRef[];
  complete: boolean;
}) {
  const tr = useTranslations();
  const { task, online, finish } = ctx;
  const { act, busy, error } = useTaskActions({ inDialog: true });
  const [confirm, setConfirm] = React.useState(false);
  const n = files.length;
  return (
    <RailCard title={tr("actFilePage_fileWithTheCourt")} description={signatoryLine(ctx, "Filing")}>
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}
      <PreparedNote ctx={ctx} />
      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          disabled={!online || !!busy || !complete}
          onClick={() => setConfirm(true)}
        >
          <SendIcon data-icon="inline-start" aria-hidden />
          {tr("actFilePage_fileWithTheCourt")}
        </Button>
        {!complete ? (
          <p className="text-caption text-muted-foreground">
            {tr("actFilePage_attachEveryDocumentBeforeFiling")}
          </p>
        ) : null}
        <Button
          variant="ghost"
          disabled={!online || !!busy}
          onClick={() =>
            void act(task.id, (t, c) => saveDraft(t, c, undefined, files), {
              title: tr("actFilePage_savedAsADraft"),
              icon: SaveIcon,
            })
          }
        >
          {tr("actFilePage_saveForLater")}
        </Button>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <ChromeAlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("actFilePage_fileWithTheCourtQuestion")}</AlertDialogTitle>
            <AlertDialogDescription>
              {n === 1 ? "1 document goes" : `${n} documents go`} to the registry for scrutiny. This
              cannot be recalled; defects come back as a new task.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr("common_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirm(false);
                const t = await act(task.id, (x, c) => file(x, c, files));
                if (t) finish(tr("actFilePage_filedAwaitingScrutiny"));
              }}
            >
              {tr("actFilePage_file")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </ChromeAlertDialogContent>
      </AlertDialog>
    </RailCard>
  );
}

/** The file flow inside the act modal: the document slots, then the action. */
export function FileBody({
  ctx,
  onEntered,
}: {
  ctx: ActContext;
  /** Told when files differ from the task's own, for a window that asks before closing. */
  onEntered?: (entered: boolean) => void;
}) {
  const tr = useTranslations();
  const { task, signatory } = ctx;
  const [files, setFilesState] = React.useState<StoredFileRef[]>(task.files ?? []);
  function setFiles(next: StoredFileRef[]) {
    setFilesState(next);
    onEntered?.(
      next.length !== (task.files ?? []).length || next.some((f, i) => f !== task.files?.[i]),
    );
  }
  const slots = task.documentsNeeded?.length ? task.documentsNeeded : ["Document"];
  const complete = slots.every((s) => files.some((f) => f.slot === s));
  const closed = TERMINAL.has(task.status);
  const editable = ["open", "draft", "ready"].includes(task.status);

  let rail: React.ReactNode;
  if (closed)
    rail = (
      <RecordCard ctx={ctx} title={closedTitle(task, tr("actFilePage_acceptedByTheRegistry"))} />
    );
  else if (task.status === "awaiting-court") rail = <CourtSandbox ctx={ctx} />;
  else if (signatory) rail = <FileCard ctx={ctx} files={files} complete={complete} />;
  else rail = <PrepareCard ctx={ctx} what="file" files={files} complete={complete} />;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Documents ctx={ctx} files={files} editable={editable} onChange={setFiles} />
      {rail}
    </div>
  );
}
