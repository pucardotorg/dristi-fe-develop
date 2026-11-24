"use client";

/**
 * The Complaint PDF tab: the complaint exactly as the backend renders it from the saved
 * case. Each time the tab opens it asks the backend whether the filing is complete; when
 * something is missing it says so and hands the list to the screen's own dialog, and
 * otherwise it fetches a fresh PDF (the backend renders it on every request, so it always
 * shows the latest saved details).
 */

import * as React from "react";
import { useTranslations } from "next-intl";

import { isNotIntegratedError } from "@/lib/data/source";
import { getCaseFilingRepository } from "@/lib/filing/data";
import type { ValidationError } from "@/lib/filing/validation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusLine } from "@/components/ui/status-line";
import { PdfViewer } from "@/components/cases/pdf-viewer";

type ComplaintPdfProps = {
  caseId: string;
  /** What the backend reported missing: the screen lists it in its own dialog. */
  onProblems: (problems: ValidationError[]) => void;
};

type LoadState =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "incomplete"; problems: ValidationError[] }
  | { status: "not-connected" }
  | { status: "failed" };

export function ComplaintPdf({ caseId, onProblems }: ComplaintPdfProps) {
  const t = useTranslations();
  const [state, setState] = React.useState<LoadState>({ status: "loading" });
  // Bumped by "Try again" so the effect runs the load once more.
  const [attempt, setAttempt] = React.useState(0);
  // The latest callback, without re-running the load when the screen re-renders.
  const reportProblems = React.useRef(onProblems);
  React.useEffect(() => {
    reportProblems.current = onProblems;
  }, [onProblems]);

  React.useEffect(() => {
    const controller = new AbortController();
    let url: string | null = null;
    const repo = getCaseFilingRepository();
    (async () => {
      const { isValid, errors } = await repo.validateCase(caseId, controller.signal);
      if (controller.signal.aborted) return;
      if (!isValid) {
        setState({ status: "incomplete", problems: errors });
        reportProblems.current(errors);
        return;
      }
      const pdf = await repo.getComplaintPdf(caseId, controller.signal);
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(pdf);
      setState({ status: "ready", url });
    })().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setState(isNotIntegratedError(error) ? { status: "not-connected" } : { status: "failed" });
    });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [caseId, attempt]);

  const retry = () => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  };

  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-body-compact text-muted-foreground">
        <Spinner className="size-5" />
        {t("complaintPdf_building")}
      </div>
    );
  }
  if (state.status === "incomplete") {
    return (
      <StatusLine
        tone="warning"
        title={t("complaintPdf_opensOnceComplete")}
        action={
          <Button variant="outline" onClick={() => onProblems(state.problems)}>
            {t("complaintPdf_seeWhatsMissing")}
          </Button>
        }
      >
        {t("complaintPdf_someDetailsAreMissing")}
      </StatusLine>
    );
  }
  if (state.status === "not-connected") {
    return <StatusLine tone="neutral">{t("complaintPdf_notConnected")}</StatusLine>;
  }
  if (state.status === "failed") {
    return (
      <StatusLine
        tone="error"
        action={
          <Button variant="outline" onClick={retry}>
            {t("complaintPdf_tryAgain")}
          </Button>
        }
      >
        {t("complaintPdf_couldNotLoad")}
      </StatusLine>
    );
  }
  return (
    <PdfViewer
      src={state.url}
      title={t("complaintPdf_title")}
      className="h-[calc(100vh-18rem)] min-h-96"
    />
  );
}
