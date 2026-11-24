"use client";

/**
 * Sandbox only: the stand-in for C-DAC's Aadhaar OTP page. The sandbox's `startSigning`
 * sends the browser here instead of to C-DAC; the person picks the result, it is reported
 * as C-DAC's callback would report it, and the browser goes to the same landing route the
 * backend redirects to. Nothing is signed. In any other build the page does not exist.
 */

import * as React from "react";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { IS_SANDBOX } from "@/lib/data/source";
import { getRepository } from "@/lib/esign/data";
import { ESIGN_RETURN_PATH } from "@/lib/esign/esign-flow";
import type { SandboxSigningOutcome } from "@/lib/esign/types";
import { Button } from "@/components/ui/button";
import { StatusLine } from "@/components/ui/status-line";

export function SandboxProviderScreen() {
  if (!IS_SANDBOX) notFound();
  return <SandboxProvider />;
}

function SandboxProvider() {
  const t = useTranslations();
  const router = useRouter();
  const transactionId = useSearchParams().get("transaction_id") ?? "";
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const choose = async (outcome: SandboxSigningOutcome) => {
    setBusy(true);
    setFailed(false);
    try {
      await getRepository().settleSandboxTransaction(transactionId, outcome);
      const query = new URLSearchParams({
        transaction_id: transactionId,
        status: outcome === "success" ? "SUCCESS" : "FAILURE",
      });
      router.replace(`${ESIGN_RETURN_PATH}?${query}`);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-title-l font-semibold">{t("esignSandbox_title")}</h1>
        <p className="text-body text-muted-foreground">{t("esignSandbox_description")}</p>
      </div>
      {failed ? <StatusLine tone="error">{t("esignSandbox_couldNotReport")}</StatusLine> : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          className="sm:flex-1"
          disabled={busy || !transactionId}
          onClick={() => void choose("success")}
        >
          {t("esignSandbox_signSuccessfully")}
        </Button>
        <Button
          variant="outline"
          className="sm:flex-1"
          disabled={busy || !transactionId}
          onClick={() => void choose("failure")}
        >
          {t("esignSandbox_failTheSignature")}
        </Button>
      </div>
    </main>
  );
}
