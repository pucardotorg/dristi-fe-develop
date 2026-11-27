"use client";

/**
 * Where the browser lands after Aadhaar e-sign: the backend redirects here from C-DAC's
 * result with `?transaction_id=…&status=…`. The query is only a hint; the screen asks the
 * backend for the outcome, records the signature on the case, and takes the person back
 * to the complaint's Sign step, where the signing window opens on "Signature added".
 * When it cannot, it says what happened and offers the way back.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { isNotIntegratedError } from "@/lib/data/source";
import { parseEsignReturn } from "@/lib/esign/esign-flow";
import { finishCaseEsign, type EsignFinish } from "@/lib/filing/case-esign";
import { useProfile } from "@/lib/filing/profile";
import { signingFailure } from "@/lib/filing/signing-package";
import { FILINGS_HOME, stepHref } from "@/lib/filing/steps";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusLine } from "@/components/ui/status-line";
import { esignProblemMessage, type EsignProblem } from "./esign-messages";

type ScreenState =
  | { status: "checking" }
  | { status: "done"; result: Exclude<EsignFinish, { kind: "signed" }> }
  | { status: "error"; problem: EsignProblem };

export function EsignCompleteScreen() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, ready } = useProfile();
  const back = React.useMemo(
    () => parseEsignReturn(new URLSearchParams(searchParams)),
    [searchParams],
  );
  const [state, setState] = React.useState<ScreenState>({ status: "checking" });

  React.useEffect(() => {
    // The profile says which of the case's signatories this person is.
    if (!back || !ready) return;
    const controller = new AbortController();
    finishCaseEsign(back.transactionId, profile, controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        if (result.kind === "signed") {
          router.replace(
            result.draftId ? `${stepHref(result.draftId, "sign")}?esign=signed` : FILINGS_HOME,
          );
          return;
        }
        setState({ status: "done", result });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          problem: isNotIntegratedError(error) ? "not-connected" : signingFailure(error),
        });
      },
    );
    return () => controller.abort();
  }, [back, ready, profile, router]);

  const draftId = state.status === "done" ? state.result.draftId : null;
  const backHref = draftId ? stepHref(draftId, "sign") : FILINGS_HOME;
  const backLabel = draftId
    ? t("esignComplete_backToTheComplaint")
    : t("esignComplete_backToFilings");

  let body: React.ReactNode;
  if (!back) {
    body = <StatusLine tone="error">{t("esignComplete_noTransaction")}</StatusLine>;
  } else if (state.status === "checking") {
    body = (
      <p role="status" className="flex items-center gap-3 text-body text-muted-foreground">
        <Spinner className="size-5" />
        {t("esignComplete_checking")}
      </p>
    );
  } else if (state.status === "error") {
    body = <StatusLine tone="error">{esignProblemMessage(t, state.problem)}</StatusLine>;
  } else {
    const { result } = state;
    body =
      result.kind === "pending" ? (
        <StatusLine tone="warning">{t("esignComplete_stillWaiting")}</StatusLine>
      ) : result.reason === "declined" ? (
        <StatusLine tone="error">{t("esignComplete_notSigned")}</StatusLine>
      ) : result.reason === "expired" ? (
        <StatusLine tone="error">{t("esignComplete_expired")}</StatusLine>
      ) : (
        <StatusLine tone="error" title={t("esignComplete_notRecorded")}>
          {esignProblemMessage(t, result.failure ?? "other")}
        </StatusLine>
      );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 md:py-12">
      <h1 className="text-title-l font-semibold">{t("esignComplete_title")}</h1>
      {body}
      {state.status !== "checking" || !back ? (
        <div>
          <Button asChild variant="outline">
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        </div>
      ) : null}
    </main>
  );
}
