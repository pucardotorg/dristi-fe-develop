"use client";

/**
 * List of documents — the evidence checklist the court receives.
 *
 * Source: demo "Documents". One table per group: fixed rows come from the filing (and are
 * badged when the file arrived at intake), custom rows are typed in. Continue is blocked
 * while a required document is missing — the reason is stated in the footer and repeated
 * as a transient message so it is never a silent no-op.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  FileTextIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";

import { uid } from "@/lib/filing/blank";
import { targetForRow, unsavedRows } from "@/lib/filing/case-documents";
import { formatBytes } from "@/lib/filing/files";
import { documentsProgress, findDocumentRow } from "@/lib/filing/selectors";
import { useFiling } from "@/lib/filing/store";
import { useCaseDocuments } from "@/lib/filing/use-case-documents";
import { useFieldPolicy } from "@/components/filing/field-policy";
import type { CaseDocument, DocumentGroup } from "@/lib/filing/types";
import { REGISTER_CARDS_ONLY, REGISTER_TABLE_ONLY } from "@/components/cases/register-layout";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/filing/confirm-dialog";
import { FilingFooter } from "@/components/filing/filing-footer";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";
import { LabelTip, RequiredMark } from "@/components/filing/form-field";
import { SectionNotice, UnsavedNotice } from "@/components/filing/notices";
import { FilePreviewDialog } from "@/components/filing/upload/file-preview-dialog";
import { pickErrorMessage, useFilePicker } from "@/components/filing/use-file-picker";

export function DocumentsSection() {
  const { draft, update, hrefFor } = useFiling();
  const router = useRouter();
  const showGroup = useFieldPolicy()?.documentGroups;
  const groups = showGroup ? draft.documents.filter((g) => showGroup(g.id)) : draft.documents;
  const { remaining } = documentsProgress(groups);
  const { pick, input } = useFilePicker();
  const { attachFile, clearFile, discard, updateDetails, retry } = useCaseDocuments();
  const unsaved = unsavedRows(draft, groups);
  /** A custom row's name as it was when its field took focus, to save only a change. */
  const nameOnFocus = React.useRef("");

  const [previewId, setPreviewId] = React.useState<string | null>(null);
  // Kept apart from `deleteOpen` so the dialog keeps its wording while it fades out.
  const [deleteTarget, setDeleteTarget] = React.useState<{
    id: string;
    name: string;
    hasFile: boolean;
  } | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  /** Said where the pointer is: why Continue did nothing, or why a file was refused. */
  const [flash, setFlash] = React.useState<string | null>(null);
  const flashTimer = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    },
    []
  );

  const say = React.useCallback((message: string) => {
    setFlash(message);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 3500);
  }, []);

  const patchDoc = (docId: string, patch: (doc: CaseDocument) => void) =>
    update((d) => {
      const doc = findDocumentRow(d.documents, docId);
      if (doc) patch(doc);
    });

  /** Where a row's file is kept and saved from: the intake slot it mirrors, or itself. */
  const targetOf = (docId: string) => {
    const doc = findDocumentRow(groups, docId);
    return doc ? targetForRow(draft.intake, doc) : null;
  };

  /**
   * Attach a chosen file to a row. A row that mirrors an intake slot writes to that slot —
   * the store mirrors it back here — so a document is never stored twice.
   */
  const receiveFile = async (docId: string, file: File) => {
    const target = targetOf(docId);
    if (!target) return;
    const error = await attachFile(target, file);
    if (error) say(error);
  };

  /** The tick is kept with the saved document, so a change is sent to the case too. */
  const setDigital = (doc: CaseDocument, digital: boolean) => {
    patchDoc(doc.id, (d) => {
      d.digital = digital;
    });
    const target = targetOf(doc.id);
    if (doc.file && target) void updateDetails(target, { isDigital: digital });
  };

  const uploadDoc = (docId: string) =>
    pick((file, error) => {
      if (error) {
        say(pickErrorMessage(error));
        return;
      }
      if (file) void receiveFile(docId, file);
    });

  /**
   * A custom row goes, with its file; any other row keeps its place and loses its file —
   * on the intake slot it mirrors, which clears this row too.
   */
  const removeDoc = (docId: string) => {
    if (previewId === docId) setPreviewId(null);
    const doc = findDocumentRow(groups, docId);
    const target = targetOf(docId);
    if (!doc || !target) return;
    if (!doc.custom) {
      clearFile(target);
      return;
    }
    discard([target]);
    update((d) => {
      for (const group of d.documents) {
        const index = group.docs.findIndex((row) => row.id === docId);
        if (index !== -1) group.docs.splice(index, 1);
      }
    });
  };

  /**
   * Deleting destroys a stored file or a typed row, so it asks first — the one exception
   * being an empty custom row, where there is nothing to lose by dropping it.
   */
  const askRemoveDoc = (docId: string) => {
    const doc = findDocumentRow(groups, docId);
    if (!doc) return;
    if (!doc.file && !doc.name.trim()) {
      removeDoc(docId);
      return;
    }
    setPreviewId(null);
    setDeleteTarget({ id: docId, name: doc.name.trim(), hasFile: !!doc.file });
    setDeleteOpen(true);
  };

  const addOtherDoc = (groupId: string) =>
    update((d) => {
      const group = d.documents.find((g) => g.id === groupId);
      if (!group) return;
      group.docs.push({
        id: uid("doc"),
        name: "",
        required: false,
        file: null,
        quality: null,
        digital: false,
        custom: true,
      });
    });

  const allDone = remaining === 0;
  const statusText = allDone
    ? "All required documents added"
    : `${remaining} required document${remaining > 1 ? "s" : ""} still needed`;

  const onContinue = () => {
    if (!allDone) {
      say(statusText);
      return;
    }
    // The affidavit is the next step; it was once composed on the preview screen, so this
    // used to skip straight there.
    router.push(hrefFor("affidavit"));
  };

  /* One row's four cells, written once. The table lays them out as columns; on a phone
     or an upright tablet the same four stack as a list row (see below), so the two
     layouts cannot drift apart. */
  const docCells = (doc: CaseDocument, index: number, group: DocumentGroup) => ({
    name: (
      <>
      {doc.custom ? (
        <Input
          value={doc.name}
          onChange={(e) =>
            patchDoc(doc.id, (d) => {
              d.name = e.target.value;
            })
          }
          // The name is kept with the saved document, so a change is sent to the case too.
          onFocus={() => {
            nameOnFocus.current = doc.name;
          }}
          onBlur={() => {
            if (doc.file && doc.name.trim() !== nameOnFocus.current.trim()) {
              void updateDetails({ kind: "row", id: doc.id }, { displayName: doc.name });
            }
          }}
          placeholder="Document name"
          aria-label={`Document name, row ${index + 1} of ${group.title}`}
        />
      ) : (
        <div className="flex min-h-10 flex-col justify-center gap-0.5">
          <span className="text-body-compact font-medium">
            {doc.name}
            {doc.required ? (
              <>
                {" "}
                <RequiredMark />
              </>
            ) : null}
          </span>
          {doc.intakeKey && doc.file ? (
            <span className="text-caption text-muted-foreground">
              Provided at case intake
            </span>
          ) : null}
        </div>
      )}
      </>
    ),
    file: (
      <>
      {doc.file ? (
        <Button
          type="button"
          variant="link"
          className="h-auto min-h-10 max-w-full justify-start px-0 py-1"
          onClick={() => setPreviewId(doc.id)}
          aria-label={`Preview ${doc.file.name}`}
        >
          <FileTextIcon data-icon="inline-start" aria-hidden />
          <span className="flex min-w-0 flex-col items-start">
            <span className="max-w-full truncate">{doc.file.name}</span>
            <span className="text-caption font-normal text-muted-foreground tabular-nums">
              {formatBytes(doc.file.size)}
            </span>
          </span>
        </Button>
      ) : (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => uploadDoc(doc.id)}
            aria-label={`Upload ${doc.name || `row ${index + 1}`}`}
          >
            <UploadIcon data-icon="inline-start" aria-hidden />
            Upload
          </Button>
          <span className="text-caption text-muted-foreground">
            No file chosen
          </span>
        </div>
      )}
      </>
    ),
    digital: (
      <>
      <span className="inline-flex h-10 items-center">
        <Checkbox
          checked={doc.digital}
          onCheckedChange={(checked) => setDigital(doc, checked === true)}
          aria-label={`Natively digital: ${
            doc.name || `row ${index + 1}`
          }`}
        />
      </span>
      </>
    ),
    actions: (
      <>
      <div className="flex h-10 items-center justify-end gap-1">
        {doc.file ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => uploadDoc(doc.id)}
              aria-label={`Re-upload ${doc.name || `row ${index + 1}`}`}
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCwIcon aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => askRemoveDoc(doc.id)}
              aria-label={`Delete ${doc.name || `row ${index + 1}`}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2Icon aria-hidden />
            </Button>
          </>
        ) : doc.custom ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => askRemoveDoc(doc.id)}
            aria-label={`Remove row ${index + 1}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <XIcon aria-hidden />
          </Button>
        ) : null}
      </div>
      </>
    ),
  });

  const previewDoc = previewId ? findDocumentRow(groups, previewId) : undefined;
  const previewFile = previewDoc?.file ?? null;

  return (
    <>
      {input}
      <FilingMain width="wide">
        <FilingPageHeader
          title="List of documents"
          description="Check each one is the right way up and readable. The affidavit and delay-condonation application are not needed here."
        />

        <SectionNotice variant="neutral">
          Tick <strong className="font-semibold">Natively digital</strong> for an
          original digital file, such as an e-signed PDF, not a scan of a paper copy.
        </SectionNotice>

        {unsaved.length > 0 ? (
          <UnsavedNotice
            labels={unsaved.map((u) => u.label)}
            error={unsaved[0].error}
            noun="file"
            onRetry={() => retry(unsaved)}
          />
        ) : null}

        {groups.map((group) => (
          <section key={group.id} className="flex flex-col gap-3">
            <h2 className="text-title-s font-semibold">{group.title}</h2>

            <div className={cn(PANEL_CLASS, "rounded-xl border bg-card")}>
              {/* Phone and upright tablet: a list. The table's fixed columns need about
                  830px before the name gets any room; under that they overlapped. */}
              <ul className={cn(REGISTER_CARDS_ONLY, "divide-y divide-hairline")}>
                {group.docs.map((doc, index) => {
                  const cells = docCells(doc, index, group);
                  return (
                    /* Phone: the three parts stack. Upright tablet (from `sm`): one row per
                       document, the name on the left, then "Natively digital", then
                       the file or Upload in a fixed column on the right, so the list
                       reads across like the table it stands in for and a row is 64px,
                       not 140. */
                    <li
                      key={doc.id}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-6 sm:py-3"
                    >
                      {/* The name leads, numbered as the court's list numbers it. */}
                      <div className="flex min-w-0 items-start gap-2 sm:flex-1">
                        <span className="flex h-10 shrink-0 items-center text-body-compact tabular-nums text-muted-foreground">
                          {index + 1}.
                        </span>
                        <div className="min-w-0 flex-1">{cells.name}</div>
                        {!doc.file && doc.custom ? cells.actions : null}
                      </div>

                      {doc.file ? (
                        /* The upload step's filled pill: the file, then what can be done
                           to it, in one sunken row. */
                        <div className="flex items-center gap-1 rounded-lg bg-surface-sunken py-1 pr-1 pl-3 sm:order-last sm:w-64 sm:shrink-0">
                          <div className="min-w-0 flex-1">{cells.file}</div>
                          {cells.actions}
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          // Edge to edge on a phone; on a tablet it fills the row's
                          // right-hand column, the same width a filed document takes.
                          className="w-full sm:order-last sm:w-64 sm:shrink-0"
                          onClick={() => uploadDoc(doc.id)}
                          aria-label={`Upload ${doc.name || `row ${index + 1}`}`}
                        >
                          <UploadIcon data-icon="inline-start" aria-hidden />
                          Upload
                        </Button>
                      )}

                      <label className="flex shrink-0 items-center gap-2 text-body-compact text-muted-foreground">
                        {cells.digital}
                        Natively digital
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div className={cn(REGISTER_TABLE_ONLY, "overflow-x-auto")}>
                <Table className="min-w-3xl table-fixed">
                  {/* Fixed column widths so the three groups line up as one list. */}
                  <colgroup>
                    <col className="w-16" />
                    <col />
                    <col className="w-72" />
                    <col className="w-40" />
                    <col className="w-28" />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="border-hairline">
                      <TableHead className="px-4">Sl. no</TableHead>
                      <TableHead>Document name</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead className="text-center">
                        <span className="inline-flex items-center gap-1">
                          Natively digital
                          <LabelTip>
                            Tick only for original digital files, not scans of physical
                            documents.
                          </LabelTip>
                        </span>
                      </TableHead>
                      <TableHead className="px-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {group.docs.map((doc, index) => {
                      const cells = docCells(doc, index, group);
                      return (
                      <TableRow key={doc.id} className="border-hairline">
                        <TableCell className="px-4 py-2 align-middle text-muted-foreground tabular-nums">
                          {index + 1}
                        </TableCell>

                        <TableCell className="py-2 align-middle whitespace-normal">
                          {cells.name}
                        </TableCell>

                        <TableCell className="py-2 align-middle whitespace-normal">
                          {cells.file}
                        </TableCell>

                        <TableCell className="py-2 text-center align-middle">
                          {cells.digital}
                        </TableCell>

                        <TableCell className="px-4 py-2 align-middle">
                          {cells.actions}
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="border-t border-hairline p-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => addOtherDoc(group.id)}
                >
                  <PlusIcon data-icon="inline-start" aria-hidden />
                  Add other document
                </Button>
              </div>
            </div>
          </section>
        ))}
      </FilingMain>

      <FilingFooter
        backHref={hrefFor("witnesses")}
        onContinue={onContinue}
        continueBlocked={!allDone}
        // One footer statement, worded and styled as every other section's — completeness
        // is the tab dots' and the preview's job, not a second tinted badge here.
        leading={
          allDone ? (
            <span className="inline-flex items-center gap-2 text-body-compact text-success-ink">
              <CheckIcon className="size-4 shrink-0" aria-hidden />
              {statusText}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-body-compact text-muted-foreground">
              <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
              {statusText}
            </span>
          )
        }
      />

      {/* Blocked Continue and refused files — said where the pointer is. The live region
          stays mounted so its content is announced when it appears. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-16 z-40 w-72 max-w-full sm:right-6"
      >
        {flash ? (
          <Alert variant="warning" className="shadow-overlay">
            <TriangleAlertIcon aria-hidden />
            <AlertDescription>{flash}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <FilePreviewDialog
        file={previewFile}
        label={previewDoc?.name || "this document"}
        onClose={() => setPreviewId(null)}
        onReplace={() => {
          if (previewId) uploadDoc(previewId);
        }}
        onDelete={() => {
          if (previewId) askRemoveDoc(previewId);
        }}
      >
        {previewDoc?.quality === "bad" ? (
          <Alert variant="warning">
            <TriangleAlertIcon aria-hidden />
            <AlertDescription>
              This scan looks blurry or cropped. Please re-upload a clearer copy so the
              court can read it.
            </AlertDescription>
          </Alert>
        ) : null}
        {previewDoc?.quality === "good" ? (
          <Alert variant="success">
            <CheckIcon aria-hidden />
            <AlertDescription>This document is clear and readable.</AlertDescription>
          </Alert>
        ) : null}
      </FilePreviewDialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Remove ${deleteTarget?.name || "this document"}`}
        description={
          deleteTarget?.hasFile
            ? "Are you sure you want to remove this document and the file attached to it? This cannot be undone."
            : "Are you sure you want to remove this row and the details typed in it? This cannot be undone."
        }
        confirmLabel="Yes, remove"
        onConfirm={() => {
          setDeleteOpen(false);
          if (deleteTarget) removeDoc(deleteTarget.id);
        }}
      />
    </>
  );
}
