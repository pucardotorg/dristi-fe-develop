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

export function AffidavitSection() {
  const { draft, update, hrefFor } = useFiling();
  const { prev, next } = neighbours("affidavit");
  const router = useRouter();
  const { save, saving, error } = useAffidavit(affidavitHtml);
  const [resetOpen, setResetOpen] = React.useState(false);

  // "Touched" tells an untouched affidavit (show the standard text, still tracking the
  // case) apart from one the filer has made their own — including one they have cleared,
  // which must stay empty rather than snap back to the standard text.
  // An affidavit read from the case after the step opened counts as the filer's own too.
  const [edited, setEdited] = React.useState(() => richTextHasContent(draft.affidavit));
  const touched = edited || richTextHasContent(draft.affidavit);

  const standard = affidavitHtml(draft);
  const value = touched ? draft.affidavit : standard;

  /* Save whatever the box holds — a cleared affidavit included — then move on. The backend
     is the gate on an empty affidavit: it refuses one and the reason is shown below, which
     keeps the filer here. */
  const continueHref = next ? hrefFor(next) : undefined;
  const handleContinue = async () => {
    const result = await save(value);
    if (result.ok && continueHref) router.push(continueHref);
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
      <FilingMain>
        <FilingPageHeader
          title="Affidavit"
          description="The sworn statement that goes on the record with the complaint."
          actions={
            touched ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResetOpen(true)}
              >
                <RotateCcwIcon data-icon="inline-start" aria-hidden />
                Restore standard text
              </Button>
            ) : null
          }
        />

        {/* Sworn evidence, so what it is gets said before the box, not after. */}
        <SectionNotice variant="warning" title="This is sworn evidence">
          Sworn under Section 225 of the Bharatiya Nagarik Suraksha Sanhita, 2023. Read
          it through and change anything that does not match the case.
        </SectionNotice>

        <FormCard
          title="Affidavit of fact"
          description={
            touched
              ? "Your wording. It no longer follows the rest of the filing."
              : "Written from the case details, and follows them until you edit it."
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
            ariaLabel="Affidavit of fact"
            minHeightClassName="min-h-96"
          />
        </FormCard>

        {error ? (
          <SectionNotice variant="destructive" title="Couldn't save to the court's server">
            {error}
          </SectionNotice>
        ) : null}
      </FilingMain>

      <FilingFooter
        backHref={prev ? hrefFor(prev) : undefined}
        onContinue={continueHref ? handleContinue : undefined}
        continueDisabled={saving}
        continueLabel={saving ? "Saving…" : "Continue"}
      />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Restore the standard affidavit?"
        description="Your edits are discarded and the text goes back to the standard wording."
        confirmLabel="Restore"
        onConfirm={restoreStandard}
      />
    </>
  );
}
