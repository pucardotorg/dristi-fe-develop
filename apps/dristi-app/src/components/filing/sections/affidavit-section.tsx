"use client";

/**
 * Affidavit — the sworn half of the complaint, composed from the case and left editable.
 *
 * Everything here is generated from what the draft already records: the return reason is
 * quoted from the memo, and the payment and service sentences follow what the demand
 * notice says happened (`affidavitHtml`). That is the starting point, not the answer —
 * this is sworn under BNSS s.225 and only the filer knows whether the standard recitals
 * fit their facts, so it is theirs to change.
 *
 * Until they touch it the text keeps tracking the case, so correcting a date three screens
 * back corrects the affidavit too. The moment they edit, it stops tracking and becomes
 * their words — with one control to put the standard text back. Clearing the box is a real
 * state, not a reset: it stays empty (the standard text does not flow back on its own),
 * the restore control stays available, and Continue reports the affidavit as required
 * rather than saving an empty one the backend would reject.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcwIcon } from "lucide-react";

import { neighbours } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import { useAffidavit } from "@/lib/filing/use-affidavit";
import { onBlurAutosave, useSerialSave } from "@/lib/filing/use-autosave";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/filing/confirm-dialog";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";
import { FormCard } from "@/components/filing/form-card";
import { SectionNotice } from "@/components/filing/notices";
import { RichTextEditor } from "@/components/filing/rich-text-editor";
import { richTextHasContent } from "@/lib/filing/details";
import { affidavitHtml } from "@/components/filing/sections/preview/derive";
import { useTranslations } from "next-intl";

export function AffidavitSection() {
  const t = useTranslations();
  const { draft, update, hrefFor } = useFiling();
  const { prev, next } = neighbours("affidavit");
  const router = useRouter();
  const { save, error } = useAffidavit(affidavitHtml);
  // Drives the Continue button only — not the hook's autosave state, or the blur that
  // clicking Continue causes would disable the button mid-click and swallow the click.
  const [continuing, setContinuing] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);

  // "Touched" tells an untouched affidavit (show the standard text, still tracking the
  // case) apart from one the filer has made their own — including one they have cleared,
  // which must stay empty rather than snap back to the standard text.
  // An affidavit read from the case after the step opened counts as the filer's own too.
  const [edited, setEdited] = React.useState(() => richTextHasContent(draft.affidavit));
  const touched = edited || richTextHasContent(draft.affidavit);

  const standard = affidavitHtml(draft);
  const value = touched ? draft.affidavit : standard;

  // Autosave when the filer leaves the editor, but only once the affidavit has real content:
  // the affidavit's own endpoint is an idempotent PUT (no id to race), and skipping an empty
  // one keeps a blank box from drawing a "couldn't save" while they are still at work. The
  // standard text is sent too, so an untouched affidavit is on the case before Continue.
  const autosave = useSerialSave(
    () => save(value),
    () => (richTextHasContent(value) ? value : null),
  );

  /* Continue saves whatever the box holds — a cleared affidavit included — then moves on. The
     backend is the gate on an empty affidavit: it refuses one and the reason is shown below,
     which keeps the filer here. */
  const continueHref = next ? hrefFor(next) : undefined;
  const handleContinue = async () => {
    setContinuing(true);
    try {
      const result = await save(value);
      if (result.ok && continueHref) router.push(continueHref);
    } finally {
      setContinuing(false);
    }
  };

  const restoreStandard = () => {
    update((d) => {
      d.affidavit = "";
    });
    setEdited(false);
    setResetOpen(false);
  };

  return (
    <>
      <FilingMain {...onBlurAutosave(() => void autosave())}>
        <FilingPageHeader
          title={t("affidavitSection_affidavit")}
          description={t("affidavitSection_theSwornStatementThatGoesOn")}
          actions={
            touched ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setResetOpen(true)}>
                <RotateCcwIcon data-icon="inline-start" aria-hidden />
                {t("affidavitSection_restoreStandardText")}
              </Button>
            ) : null
          }
        />

        {/* Sworn evidence, so what it is gets said before the box, not after. */}
        <SectionNotice variant="warning" title={t("affidavitSection_thisIsSwornEvidence")}>
          {t("affidavitSection_swornUnderSection225OfThe")}
        </SectionNotice>

        <FormCard
          title={t("affidavitSection_affidavitOfFact")}
          description={
            touched
              ? t("affidavitSection_yourWordingItNoLongerFollows")
              : t("affidavitSection_writtenFromTheCaseDetailsAnd")
          }
        >
          <RichTextEditor
            value={value}
            onChange={(html) => {
              setEdited(true);
              update((d) => {
                d.affidavit = html;
              });
            }}
            ariaLabel={t("affidavitSection_affidavitOfFact")}
            minHeightClassName="min-h-96"
          />
        </FormCard>

        {error ? (
          <SectionNotice
            variant="destructive"
            title={t("affidavitSection_couldntSaveToTheCourtsServer")}
          >
            {error}
          </SectionNotice>
        ) : null}
      </FilingMain>

      <FilingFooter
        backHref={prev ? hrefFor(prev) : undefined}
        onContinue={continueHref ? handleContinue : undefined}
        continueDisabled={continuing}
        continueLabel={continuing ? t("affidavitSection_saving") : t("affidavitSection_continue")}
      />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        icon={RotateCcwIcon}
        title={t("affidavitSection_restoreTheStandardAffidavit")}
        description={t("affidavitSection_yourEditsAreDiscardedAndThe")}
        confirmLabel={t("affidavitSection_restore")}
        onConfirm={restoreStandard}
      />
    </>
  );
}
