"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

import * as React from "react";

import { StagedOverlay } from "@/components/chrome/staged-overlay";
import { DocumentPreview } from "@/components/cases/document-preview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription } from "@/components/ui/dialog";
import { useCourtLocalized } from "@/components/court/court-provider";
import { cn } from "@/lib/utils";
import {
  buildADiaryDayDocument,
  downloadADiaryDayDocument,
  formatADiaryDate,
  type ADiaryDayDocument,
  type ADiaryEntry,
} from "@/lib/employee/sign-a-diary";

/**
 * Sign one day of the A-Diary — the whole day, as one document (`a-diary.md` `ADY-12`).
 *
 * The document is **built when this opens**, from the register as it stands
 * (`ADY-12a`): the diary is entries on a screen until it is signed, the way an order is
 * text until it is signed. An entry corrected a moment ago is already in it.
 *
 * One stage: the paper and the act that signs it. The screen only offers this for a day
 * that is over (`ADY-12b`), so the dialog does not argue about the date.
 *
 * **Nothing here signs, records or files anything.** Signing drops the day from the demo
 * register — see `lib/employee/sign-a-diary.ts`.
 */
export function SignADiaryDayDialog({
  day,
  register,
  onOpenChange,
  onSign,
  onReturnFocus,
}: {
  /** The day being signed, `YYYY-MM-DD`, or `null` when the dialog is closed. */
  day: string | null;
  register: ADiaryEntry[];
  onOpenChange: (open: boolean) => void;
  onSign: (day: string) => void;
  onReturnFocus: () => void;
}) {
  return (
    <Dialog open={day !== null} onOpenChange={onOpenChange}>
      {day ? (
        <SignADiaryDayBody
          key={day}
          day={day}
          register={register}
          onSign={onSign}
          onReturnFocus={onReturnFocus}
        />
      ) : null}
    </Dialog>
  );
}

function SignADiaryDayBody({
  day,
  register,
  onSign,
  onReturnFocus,
}: {
  day: string;
  register: ADiaryEntry[];
  onSign: (day: string) => void;
  onReturnFocus: () => void;
}) {
  const __t = __useTranslations();
  /* Built once, when the dialog opens: this is the document being signed, and it must
     not shift under the signer while they read it. */
  const [document] = React.useState(() => buildADiaryDayDocument(day, register));
  const titleRef = React.useRef<HTMLHeadingElement | null>(null);
  const count = document.entries.length;

  return (
    <StagedOverlay
      className="sm:max-w-5xl lg:h-[85dvh]"
      title={__t("signADiaryDayDialog_signTheADiary")}
      titleRef={titleRef}
      description={
        <DialogDescription className="text-body-compact text-muted-foreground">
          <span className="tabular-nums">{formatADiaryDate(day)}</span> ·{" "}
          {count === 1 ? __t("signADiaryDayDialog_1Entry") : `${count} entries`}
        </DialogDescription>
      }
      sceneKey="day"
      motion="forward"
      padded={false}
      footer={
        <>
          <p className="text-caption text-muted-foreground sm:mr-auto sm:text-left">
            {<__LocalizedText id="signADiaryDayDialog_youSignTheWholeDayAsOne" />}{" "}</p>
          <Button
            type="button"
            className="sm:self-center"
            onClick={() => onSign(day)}
          >
            {<__LocalizedText id="signADiaryDayDialog_signTheADiary" />}{" "}</Button>
        </>
      }
      /* The title takes focus rather than the first control in the document frame: it
         names what is being signed, which is what the signer reads first. */
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        titleRef.current?.focus();
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onReturnFocus();
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 lg:overflow-hidden">
        <DocumentPreview
          variant="quiet"
          surface="card"
          className="min-h-96 shadow-raised lg:min-h-0 lg:flex-1"
          height="fill"
          title={__t("signADiaryDayDialog_aDiaryValue0", {value0: String(formatADiaryDate(day))})}
          source={{
            kind: "composed",
            content: <ADiaryDayFacsimile document={document} />,
          }}
          download={{
            onDownload: () => downloadADiaryDayDocument(day, register),
            label: __t("signADiaryDayDialog_downloadTheADiaryForValue0", {value0: String(formatADiaryDate(day))}),
          }}
        />
      </div>
    </StagedOverlay>
  );
}

/**
 * The day's A-Diary as paper: the court and the day, then the register as a table with
 * the four columns of `a-diary.md` `ADY-03a` — the same table the screen shows — and the
 * block that signs the whole of it. Drawn with the paper palette, like the order beside
 * an entry, rather than the DS `Table`: this is a facsimile of a court paper.
 */
function ADiaryDayFacsimile({
  document: storedDocument,
}: {
  document: ADiaryDayDocument;
}) {
  const document = useCourtLocalized(storedDocument);
  const cell = "border border-paper-border px-3 py-2 align-top text-body-compact";
  return (
    <article className="flex flex-col gap-6 rounded-md bg-paper p-6 text-paper-foreground">
      <header className="flex flex-col gap-2 text-center">
        <p className="text-body font-semibold">{document.court}</p>
        <h3 className="text-body font-semibold">{<__LocalizedText id="signADiaryDayDialog_aDiary" />}</h3>
        <p className="text-body font-semibold">{<__LocalizedText id="signADiaryDayDialog_dated" />}{" "}{document.dated}</p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-xl border-collapse text-left">
          <caption className="sr-only">{<__LocalizedText id="signADiaryDayDialog_aDiaryDated" />}{" "}{document.dated}</caption>
          <thead>
            <tr>
              <th scope="col" className={cn(cell, "font-semibold")}>{<__LocalizedText id="signADiaryDayDialog_case" />}</th>
              <th scope="col" className={cn(cell, "font-semibold")}>{<__LocalizedText id="signADiaryDayDialog_hearing" />}</th>
              <th scope="col" className={cn(cell, "font-semibold")}>{<__LocalizedText id="signADiaryDayDialog_proceedings" />}</th>
              <th scope="col" className={cn(cell, "font-semibold")}>{<__LocalizedText id="signADiaryDayDialog_nextHearing" />}</th>
            </tr>
          </thead>
          <tbody>
            {document.entries.map((entry, index) => (
              <tr key={`${entry.caseNumber}-${index}`}>
                <td className={cn(cell, "w-1/5")}>
                  {entry.matter}
                  <br />
                  <span className="tabular-nums">{entry.caseNumber}</span>
                </td>
                <td className={cn(cell, "w-1/6")}>
                  {entry.hearing ?? (
                    <span className="sr-only">{<__LocalizedText id="signADiaryDayDialog_passedOutsideAHearing" />}</span>
                  )}
                </td>
                <td className={cell}>
                  <div className="flex flex-col gap-2">
                    {entry.paragraphs.map((paragraph, paragraphIndex) => (
                      <p key={paragraphIndex} className="whitespace-pre-line">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </td>
                <td className={cn(cell, "w-1/6")}>{entry.nextHearing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-body text-paper-muted-foreground">{document.signature}</p>
    </article>
  );
}
