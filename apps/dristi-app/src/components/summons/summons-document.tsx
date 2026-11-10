import {useTranslations as __useTranslations} from "@/i18n/server-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";
/**
 * The summons, v16: one A4 sheet, both sides.
 *
 * **One version for paper and screen** (owner, 2026-10-12). Paper cannot be clicked, so
 * every address is printed in full; on screen the same address is also a link, which
 * costs the paper nothing. "Please turn over" reads the same in both.
 *
 * **Set as a court document, not a web page** (owner, 2026-10-14): a serif body, bold
 * kept for the few things the reader must not miss, no capitalised labels and no
 * italics, paragraphs told apart by indentation, ruled lines in a clerk's variety
 * (double, dotted, dashed), generous leading and margins so it reads calm, and hierarchy
 * carried by grey steps no lighter than a cheap printer holds on off-white paper. The words are v15's, bar the turn-over line and the bail
 * paragraph under Contest the case.
 *
 * Every string is written in Kerala's terms (`lib/summons/content.ts`) and voiced here
 * for `court`, which the page takes from the summons URL. The root is `data-court-raw`,
 * so the app's text layer does not voice it a second time for the court in Settings.
 *
 * Styles: `app/summons/summons.css`. The sheet is paper, not app UI: black on white in
 * both themes, sized in pt and mm.
 */

import * as React from "react";
import { ArrowRightIcon } from "lucide-react";

import { localizeCourtText } from "@/lib/court/localize";
import type { CourtId } from "@/lib/court/profiles";
import { SUMMONS_COURT, SUMMONS_FACTS } from "@/lib/summons/content";

type Props = { court: CourtId };

export function SummonsDocument({ court }: Props) {
  const __t = __useTranslations();
  const t = (text: string) => localizeCourtText(text, court);
  const f = SUMMONS_FACTS;
  const local = SUMMONS_COURT[court];

  /** An address on the portal, written in full. A placeholder is not a link. */
  const portal = (path = "") => {
    const address = `${local.portal}${path}`;
    if (!local.portalIsReal) return <span className="addr">{address}</span>;
    return (
      <a className="addr" href={`https://${address}`} target="_blank" rel="noreferrer">
        {address}
      </a>
    );
  };

  const phone = ({ display, tel }: { display: string; tel: string | null }) =>
    tel ? <a href={`tel:${tel}`}>{display}</a> : display;

  const site = (address: string) =>
    !address.startsWith("[") ? (
      <a href={`https://${address}`} target="_blank" rel="noreferrer">
        {address}
      </a>
    ) : (
      address
    );

  const caseNumber = t(f.caseNumber);

  return (
    <div className="summons" data-court-raw="">
      {/* ============================ FRONT :: PAGE 1 ============================ */}
      <section className="sheet" aria-label={__t("summonsDocument_summonsPage1")}>
        {/* Centred masthead (owner, 2026-10-12), the way court forms set it: the court,
            then the document, then its form reference, all on the page's centre line. */}
        <div className="masthead">
          <div className="courtname">
            <div className="emblem" aria-hidden>
              {<__LocalizedText id="summonsDocument_emblem" />}{" "}</div>
            <div className="t5">{<__LocalizedText id="summonsDocument_inThe" />}{" "}{t(f.court)}</div>
          </div>
          <div className="title">{<__LocalizedText id="summonsDocument_summonsToAnAccusedPerson" />}</div>
          <div className="t2 muted">
            {<__LocalizedText id="summonsDocument_formNo1SeeSection63Bharatiya" />}{" "}</div>
        </div>

        <div className="rule-heavy" />

        <table>
          <tbody>
            <tr>
              <td style={{ width: "98mm", verticalAlign: "middle" }}>
                <div className="label">{<__LocalizedText id="summonsDocument_caseNumber" />}</div>
                <div className="pt1 big">{caseNumber}</div>
                <div className="s4" />
                <div className="label">{<__LocalizedText id="summonsDocument_inTheMatterOf" />}</div>
                <div className="pt1 big" style={{ lineHeight: 1.3 }}>
                  {t(f.complainant)}
                  <br />
                  {<__LocalizedText id="summonsDocument_versus" />}{" "}{t(f.accused)}
                </div>
              </td>
              <td style={{ paddingBottom: "2mm" }}>
                <div className="hearingbox">
                  <div className="label">{<__LocalizedText id="summonsDocument_youMustAppearOn" />}</div>
                  <div className="t5 pt1">{f.hearingDate}</div>
                  <div className="t2 pt1">
                    {f.hearingDay} &nbsp;·&nbsp; {t(f.bench)}
                  </div>
                  <div className="t2 pt1 muted">{t(f.courtAddress)}</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="rule-thin" />

        <table>
          <tbody>
            <tr>
              <td>
                <div className="label">{<__LocalizedText id="summonsDocument_to" />}</div>
                <p className="last pt1">
                  {t(f.accused)}
                  {f.accusedAddress.map((line) => (
                    <React.Fragment key={line}>
                      <br />
                      {t(line)}
                    </React.Fragment>
                  ))}
                </p>
              </td>
              <td style={{ width: "62mm" }} className="right">
                <div className="t2 muted">{<__LocalizedText id="summonsDocument_datedThis" />}{" "}{f.dated}</div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="s2" />

        <p className="last">
          {t(f.complainant)} {<__LocalizedText id="summonsDocument_hasFiledAComplaintAgainstYouUnder" />}{" "}{f.chequeNumber} {<__LocalizedText id="summonsDocument_for" />}{" "}{f.amount}{<__LocalizedText id="summonsDocument_youAreRequiredToAppearBeforeThis" />}{" "}
          <b>{f.hearingDate}</b>.
        </p>

        <div className="s2" />

        {/* Signed digitally, so no seal (owner's review): the signature stands alone. */}
        <table>
          <tbody>
            <tr>
              <td />
              <td style={{ width: "62mm" }}>
                <div style={{ height: "7mm" }} />
                <div className="sigline">{<__LocalizedText id="summonsDocument_digitallySignedByTheMagistrate" />}</div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="s2" />

        <p className="t2 last">
          {<__LocalizedText id="summonsDocument_thisProcessIsSystemGeneratedAndTransmitted" />}{" "}
          <b>
            {<__LocalizedText id="summonsDocument_theCourtWillNeverAskYouTo" />}{" "}</b>
        </p>

        <div className="rule-mid" style={{ marginBottom: "3mm" }} />

        <table>
          <tbody>
            <tr>
              <td className="ragged" style={{ paddingRight: "8mm" }}>
                <div className="t4">{<__LocalizedText id="summonsDocument_joinYourCaseOnline" />}</div>
                <div className="s2" />
                <p>
                  {<__LocalizedText id="summonsDocument_joiningYourCaseLetsYouSeeThe" />}{" "}</p>
                <p className="last">
                  {<__LocalizedText id="summonsDocument_goTo" />}{" "}{portal()} {<__LocalizedText id="summonsDocument_andRegisterSearchUsingCaseNo" />}{" "}{caseNumber}{<__LocalizedText id="summonsDocument_thenEnterYourAccessCodeYourPapers" />}{" "}</p>
              </td>
              <td className="joincol">
                <div className="vern" lang={local.language.lang} style={{ fontFamily: local.language.font }}>
                  {local.language.line}
                </div>
                <div className="s4" />
                {local.portalIsReal ? (
                  <a href={`https://${local.portal}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- print facsimile */}
                    <img className="qr" src="/summons/qr_portal.png" alt={__t("summonsDocument_qrCodeJoinYourCase")} style={{ width: "30mm", height: "30mm" }} />
                  </a>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- print facsimile
                  <img className="qr" src="/summons/qr_portal.png" alt={__t("summonsDocument_qrCodeJoinYourCase")} style={{ width: "30mm", height: "30mm" }} />
                )}
                <div className="s2" />
                <div className="qrcap">
                  {<__LocalizedText id="summonsDocument_scanToJoinYourCase" />}{" "}<br />
                  <span className="muted">{<__LocalizedText id="summonsDocument_helpIsAvailableInYourLanguage" />}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Full width under both columns (owner, 2026-10-14): the join instructions on
            the left speak of the code, so it cannot sit only on the right. */}
        <div className="s2" />
        <div className="codebox">
          <div className="codelabel">{<__LocalizedText id="summonsDocument_yourAccessCode" />}</div>
          <div className="code">{f.accessCode}</div>
        </div>

        <div className="s4" />
        <div className="turnband">
          <table>
            <tbody>
              <tr>
                <td style={{ width: "56mm" }}>
                  <div className="turncap">{<__LocalizedText id="summonsDocument_pleaseTurnOver" />}</div>
                </td>
                <td className="right">
                  <div>
                    {<__LocalizedText id="summonsDocument_theStepsOpenToYouAreSet" />}{" "}<ArrowRightIcon className="turnarrow" aria-hidden />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="folio">{<__LocalizedText id="summonsDocument_page1Of2" />}</div>
      </section>

      {/* ============================ BACK :: PAGE 2 ============================ */}
      <section className="sheet back" aria-label={__t("summonsDocument_summonsPage2")}>
        <div className="label">{<__LocalizedText id="summonsDocument_caseNo" />}{" "}{caseNumber}</div>
        <div className="rule-heavy" style={{ marginTop: "2mm" }} />

        <div className="t5">{<__LocalizedText id="summonsDocument_whatYouCanDoNow" />}</div>
        <div className="s2" />
        <p>
          <b>{<__LocalizedText id="summonsDocument_before" />}{" "}{f.hearingDate}{<__LocalizedText id="summonsDocument_chooseOneOfTheThreeOptionsBelow" />}</b> {<__LocalizedText id="summonsDocument_options1And2EndThisCase" />}{" "}</p>

        <div className="bar">
          <p className="last keep12">
            <b>{<__LocalizedText id="summonsDocument_ifTodayIsAlreadyOnOrAfter" />}{" "}{f.hearingDate},</b> {<__LocalizedText id="summonsDocument_doNotIgnoreThisCheck" />}{" "}{portal()} {<__LocalizedText id="summonsDocument_forYourNewDateOrCall" />}{" "}{phone(local.helpline)} {<__LocalizedText id="summonsDocument_first" />}{" "}</p>
        </div>

        <div className="rule-mid" />

        <table>
          <tbody>
            <tr>
              <td className="rail">
                <div className="railnum">1</div>
              </td>
              <td style={{ paddingRight: "4mm" }}>
                <div className="label">{<__LocalizedText id="summonsDocument_thisEndsTheCase" />}</div>
                <div className="t4 pt1">{<__LocalizedText id="summonsDocument_payTheChequeAmount" />}</div>
                <div className="s1" />
                <p className="last">
                  {<__LocalizedText id="summonsDocument_pay" />}{" "}<b>{f.amount}</b> {<__LocalizedText id="summonsDocument_andTheCaseAgainstYouIsClosed" />}{" "}</p>
              </td>
              <td style={{ width: "30mm", verticalAlign: "middle" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- print facsimile */}
                <img className="qr" src="/summons/qr_pay.png" alt={__t("summonsDocument_qrCodePayTheCourt")} style={{ width: "26mm", height: "26mm" }} />
                <div className="s2" />
                <div className="qrcap">{<__LocalizedText id="summonsDocument_payTheCourt" />}</div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="rule-thin" />

        <table>
          <tbody>
            <tr>
              <td className="rail">
                <div className="railnum">2</div>
              </td>
              <td>
                <div className="label">{<__LocalizedText id="summonsDocument_thisEndsTheCase" />}</div>
                <div className="t4 pt1">{<__LocalizedText id="summonsDocument_settleWithTheComplainant" />}</div>
                <div className="s1" />
                <p>
                  {<__LocalizedText id="summonsDocument_youCanAgreeAPaymentPlanOr" />}{" "}{t(f.complainantAdvocate)}{<__LocalizedText id="summonsDocument_for_c933df9b" />}{" "}{t(f.complainant)}{<__LocalizedText id="summonsDocument_on" />}{" "}
                  {phone(local.complainantAdvocate)}.
                </p>
                <p className="last">
                  {<__LocalizedText id="summonsDocument_youCanAlsoAskTheCourtTo" />}{" "}
                  {portal("/lokadalat")}{<__LocalizedText id="summonsDocument_applyOnThePortalWhereYouCan" />}{" "}</p>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="rule-thin" />

        <table>
          <tbody>
            <tr>
              <td className="rail">
                <div className="railnum">3</div>
              </td>
              <td>
                <div className="label">{<__LocalizedText id="summonsDocument_ifYouDisputeTheClaim" />}</div>
                <div className="t4 pt1">{<__LocalizedText id="summonsDocument_contestTheCase" />}</div>
                <div className="s1" />
                <p>
                  {<__LocalizedText id="summonsDocument_defendTheCaseWithALawyerOr" />}{" "}</p>
                {/* Bail sits with contesting, the choice that needs it (owner, 2026-10-14). */}
                <p>
                  {<__LocalizedText id="summonsDocument_ifYouContestTheCaseYourNext" />}{" "}<b>{<__LocalizedText id="summonsDocument_twoSuretiesFor" />}{" "}{f.suretyAmount}</b>{<__LocalizedText id="summonsDocument_andBringTheSuretiesDocumentsAndThe" />}{" "}{portal()}.
                </p>
                <p className="last aid">
                  <span className="aidlabel">{<__LocalizedText id="summonsDocument_freeLegalAid" />}</span>
                  {t(f.legalAid)} &nbsp;·&nbsp; {phone(local.legalAid)}
                  <br />
                  <span className="aidlabel">{<__LocalizedText id="summonsDocument_findALawyer" />}</span>
                  {t(f.barCouncil)} &nbsp;·&nbsp;{" "}
                  {site(local.barCouncilSite)}
                </p>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="rule-mid" />

        <p>
          {<__LocalizedText id="summonsDocument_atTheHearingYouCanRespondTo" />}{" "}{portal()} {<__LocalizedText id="summonsDocument_andOpenYourCaseTheVideoLink" />}{" "}</p>
        <p>
          {<__LocalizedText id="summonsDocument_cannotAttendThatDayApplyOnThe" />}{" "}
          {f.hearingDate}{<__LocalizedText id="summonsDocument_andGiveYourReasons" />}{" "}</p>
        <p className="last">
          <b>{<__LocalizedText id="summonsDocument_ifYouDoNotAppearAndDo" />}</b> {<__LocalizedText id="summonsDocument_theCourtCanIssueAWarrantFor" />}{" "}</p>

        <div className="rule-mid" />

        <div className="keep12 strong">{<__LocalizedText id="summonsDocument_needHelp" />}</div>
        <div className="s1" />
        <table className="t2 helptable">
          <tbody>
            <tr>
              <td style={{ width: "56mm" }}>{<__LocalizedText id="summonsDocument_yourRightsAndObligations" />}</td>
              <td>{portal("/s138")}</td>
            </tr>
            <tr>
              <td>{<__LocalizedText id="summonsDocument_guidanceInOtherLanguages" />}</td>
              <td>{portal("/help")}</td>
            </tr>
            <tr>
              <td>{<__LocalizedText id="summonsDocument_helpInPerson" />}</td>
              <td>
                {t(f.helpInPerson)} {<__LocalizedText id="summonsDocument_helpline" />}{" "}{phone(local.helpline)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="s2" />
        <p className="t1 last muted">
          {<__LocalizedText id="summonsDocument_privacyNoticeTheCourtIsNotifiedWhen" />}{" "}{portal("/privacy")}
        </p>

        <div className="folio">{<__LocalizedText id="summonsDocument_page2Of2" />}</div>
      </section>
    </div>
  );
}
