"use client";

/**
 * A stored document, opened large — the one preview the upload step and the list of
 * documents share. It shows the file as it actually looks (the image, or page 1 of the
 * PDF); a file type with nothing to show says so rather than pretending to be a preview.
 */

import * as React from "react";
import { FileTextIcon } from "lucide-react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";

import { useFilePreview } from "@/lib/filing/files";
import type { StoredFileRef } from "@/lib/filing/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

function FilePreview({ file }: { file: StoredFileRef }) {
  const preview = useFilePreview(file);
  if (preview.status === "loading") return <Skeleton className="h-64 w-full rounded-lg" />;
  if (preview.status === "ready" && preview.imageUrl) {
    return (
      <div className="overflow-hidden rounded-lg bg-surface-sunken">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview.imageUrl}
          alt={`Page 1 of ${file.name}`}
          className="max-h-[60vh] w-full object-contain"
        />
      </div>
    );
  }
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg bg-surface-sunken text-muted-foreground">
      <FileTextIcon className="size-8" aria-hidden />
      <p className="text-body-compact break-all">{file.name}</p>
      <p className="text-caption">
        {preview.status === "missing"
          ? "This file is no longer stored in this browser"
          : "No preview for this file type"}
      </p>
    </div>
  );
}

type FilePreviewDialogProps = {
  /** The file to show; `null` closes the dialog. */
  file: StoredFileRef | null;
  /** What the document is, for the dialog's description. */
  label: string;
  onClose: () => void;
  onReplace: () => void;
  /** Offered only where a document may be removed. */
  onDelete?: () => void;
  /** Said under the preview — a readability verdict, for one. */
  children?: React.ReactNode;
};

export function FilePreviewDialog({
  file,
  label,
  onClose,
  onReplace,
  onDelete,
  children,
}: FilePreviewDialogProps) {
  return (
    <Dialog
      open={!!file}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ChromeDialogContent mobileSheet className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-8">
            {file ? <Badge variant="secondary">{file.ext}</Badge> : null}
            <span className="min-w-0 break-all">{file?.name}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Preview of the file added for {label}.
          </DialogDescription>
        </DialogHeader>

        {file ? <FilePreview file={file} /> : null}
        {children}

        <DialogFooter className="sm:justify-between">
          {onDelete ? (
            <Button type="button" variant="destructive-ghost" onClick={onDelete}>
              Delete
            </Button>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
            <Button type="button" variant="outline" onClick={onReplace}>
              Replace file
            </Button>
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </DialogFooter>
      </ChromeDialogContent>
    </Dialog>
  );
}
