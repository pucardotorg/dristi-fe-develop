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
import { useTranslations } from "next-intl";

type Props = { court: CourtId };

export function SummonsDocument({ court }: Props) {
  const tr = useTranslations();
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
      <section className="sheet" aria-label={tr("summonsDocument_summonsPage1")}>
        {/* Centred masthead (owner, 2026-10-12), the way court forms set it: the court,
            then the document, then its form reference, all on the page's centre line. */}
        <div className="masthead">
          <div className="courtname">
            <div className="emblem" aria-hidden>
              {tr("summonsDocument_emblem")}
            </div>
            <div className="t5">{tr("summonsDocument_inTheT", { t: t(f.court) })}</div>
          </div>
          <div className="title">{tr("summonsDocument_summonsToAnAccusedPerson")}</div>
          <div className="t2 muted">{tr("summonsDocument_formNo1SeeSection63")}</div>
        </div>

        <div className="rule-heavy" />

        <table>
          <tbody>
            <tr>
              <td style={{ width: "98mm", verticalAlign: "middle" }}>
                <div className="label">{tr("summonsDocument_caseNumber")}</div>
                <div className="pt1 big">{caseNumber}</div>
                <div className="s4" />
                <div className="label">{tr("summonsDocument_inTheMatterOf")}</div>
                <div className="pt1 big" style={{ lineHeight: 1.3 }}>
                  {t(f.complainant)}
                  <br />
                  {tr("summonsDocument_versusT", { t: t(f.accused) })}
                </div>
              </td>
              <td style={{ paddingBottom: "2mm" }}>
                <div className="hearingbox">
                  <div className="label">{tr("summonsDocument_youMustAppearOn")}</div>
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
                <div className="label">{tr("summonsDocument_to")}</div>
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
                <div className="t2 muted">
                  {tr("summonsDocument_datedThisDated", { dated: f.dated })}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="s2" />

        <p className="last">
          {tr.rich("summonsDocument_tHasFiledAComplaintAgainst", {
            t: t(f.complainant),
            chequeNumber: f.chequeNumber,
            amount: f.amount,
            hearingDate: f.hearingDate,
            b: (chunks) => <b>{chunks}</b>,
          })}
        </p>

        <div className="s2" />

        {/* Signed digitally, so no seal (owner's review): the signature stands alone. */}
        <table>
          <tbody>
            <tr>
              <td />
              <td style={{ width: "62mm" }}>
                <div style={{ height: "7mm" }} />
                <div className="sigline">
                  {tr("summonsDocument_digitallySignedByTheMagistrate")}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="s2" />

        <p className="t2 last">
          {tr.rich("summonsDocument_thisProcessIsSystemGeneratedAnd", {
            b: (chunks) => <b>{chunks}</b>,
          })}
        </p>

        <div className="rule-mid" style={{ marginBottom: "3mm" }} />

        <table>
          <tbody>
            <tr>
              <td className="ragged" style={{ paddingRight: "8mm" }}>
                <div className="t4">{tr("summonsDocument_joinYourCaseOnline")}</div>
                <div className="s2" />
                <p>{tr("summonsDocument_joiningYourCaseLetsYouSee")}</p>
                <p className="last">
                  {tr("summonsDocument_goTo")} {portal()}{" "}
                  {tr("summonsDocument_andRegisterSearchUsingCaseNo", { caseNumber })}
                </p>
              </td>
              <td className="joincol">
                <div
                  className="vern"
                  lang={local.language.lang}
                  style={{ fontFamily: local.language.font }}
                >
                  {local.language.line}
                </div>
                <div className="s4" />
                {local.portalIsReal ? (
                  <a href={`https://${local.portal}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- print facsimile */}
                    <img
                      className="qr"
                      src="/summons/qr_portal.png"
                      alt={tr("summonsDocument_qrCodeJoinYourCase")}
                      style={{ width: "30mm", height: "30mm" }}
                    />
                  </a>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- print facsimile
                  <img
                    className="qr"
                    src="/summons/qr_portal.png"
                    alt={tr("summonsDocument_qrCodeJoinYourCase")}
                    style={{ width: "30mm", height: "30mm" }}
                  />
                )}
                <div className="s2" />
                <div className="qrcap">
                  {tr("summonsDocument_scanToJoinYourCase")}
                  <br />
                  <span className="muted">
                    {tr("summonsDocument_helpIsAvailableInYourLanguage")}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Full width under both columns (owner, 2026-10-14): the join instructions on
            the left speak of the code, so it cannot sit only on the right. */}
        <div className="s2" />
        <div className="codebox">
          <div className="codelabel">{tr("summonsDocument_yourAccessCode")}</div>
          <div className="code">{f.accessCode}</div>
        </div>

        <div className="s4" />
        <div className="turnband">
          <table>
            <tbody>
              <tr>
                <td style={{ width: "56mm" }}>
                  <div className="turncap">{tr("summonsDocument_pleaseTurnOver")}</div>
                </td>
                <td className="right">
                  <div>
                    {tr("summonsDocument_theStepsOpenToYouAre")}
                    <ArrowRightIcon className="turnarrow" aria-hidden />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="folio">{tr("summonsDocument_page1Of2")}</div>
      </section>

      {/* ============================ BACK :: PAGE 2 ============================ */}
      <section className="sheet back" aria-label={tr("summonsDocument_summonsPage2")}>
        <div className="label">{tr("summonsDocument_caseNoCaseNumber", { caseNumber })}</div>
        <div className="rule-heavy" style={{ marginTop: "2mm" }} />

        <div className="t5">{tr("summonsDocument_whatYouCanDoNow")}</div>
        <div className="s2" />
        <p>
          {tr.rich("summonsDocument_beforeHearingDateChooseOneOf", {
            hearingDate: f.hearingDate,
            b: (chunks) => <b>{chunks}</b>,
          })}
        </p>

        <div className="bar">
          <p className="last keep12">
            {tr.rich("summonsDocument_ifTodayIsAlreadyOnOr", {
              hearingDate: f.hearingDate,
              b: (chunks) => <b>{chunks}</b>,
            })}{" "}
            {portal()} {tr("summonsDocument_forYourNewDateOrCall")} {phone(local.helpline)}{" "}
            {tr("summonsDocument_first")}
          </p>
        </div>

        <div className="rule-mid" />

        <table>
          <tbody>
            <tr>
              <td className="rail">
                <div className="railnum">1</div>
              </td>
              <td style={{ paddingRight: "4mm" }}>
                <div className="label">{tr("summonsDocument_thisEndsTheCase")}</div>
                <div className="t4 pt1">{tr("summonsDocument_payTheChequeAmount")}</div>
                <div className="s1" />
                <p className="last">
                  {tr.rich("summonsDocument_payAmountAndTheCaseAgainst", {
                    amount: f.amount,
                    b: (chunks) => <b>{chunks}</b>,
                  })}
                </p>
              </td>
              <td style={{ width: "30mm", verticalAlign: "middle" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- print facsimile */}
                <img
                  className="qr"
                  src="/summons/qr_pay.png"
                  alt={tr("summonsDocument_qrCodePayTheCourt")}
                  style={{ width: "26mm", height: "26mm" }}
                />
                <div className="s2" />
                <div className="qrcap">{tr("summonsDocument_payTheCourt")}</div>
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
                <div className="label">{tr("summonsDocument_thisEndsTheCase")}</div>
                <div className="t4 pt1">{tr("summonsDocument_settleWithTheComplainant")}</div>
                <div className="s1" />
                <p>
                  {tr("summonsDocument_youCanAgreeAPaymentPlan", {
                    t: t(f.complainantAdvocate),
                    t2: t(f.complainant),
                  })}
                  {phone(local.complainantAdvocate)}.
                </p>
                <p className="last">
                  {tr("summonsDocument_youCanAlsoAskTheCourt")}
                  {portal("/lokadalat")}
                  {tr("summonsDocument_applyOnThePortalWhereYou")}
                </p>
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
                <div className="label">{tr("summonsDocument_ifYouDisputeTheClaim")}</div>
                <div className="t4 pt1">{tr("summonsDocument_contestTheCase")}</div>
                <div className="s1" />
                <p>{tr("summonsDocument_defendTheCaseWithALawyer")}</p>
                {/* Bail sits with contesting, the choice that needs it (owner, 2026-10-14). */}
                <p>
                  {tr.rich("summonsDocument_ifYouContestTheCaseYour", {
                    suretyAmount: f.suretyAmount,
                    b: (chunks) => <b>{chunks}</b>,
                  })}{" "}
                  {portal()}.
                </p>
                <p className="last aid">
                  <span className="aidlabel">{tr("summonsDocument_freeLegalAid")}</span>
                  {t(f.legalAid)} &nbsp;·&nbsp; {phone(local.legalAid)}
                  <br />
                  <span className="aidlabel">{tr("summonsDocument_findALawyer")}</span>
                  {t(f.barCouncil)} &nbsp;·&nbsp; {site(local.barCouncilSite)}
                </p>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="rule-mid" />

        <p>
          {tr("summonsDocument_atTheHearingYouCanRespond")} {portal()}{" "}
          {tr("summonsDocument_andOpenYourCaseTheVideo")}
        </p>
        <p>{tr("summonsDocument_cannotAttendThatDayApplyOn", { hearingDate: f.hearingDate })}</p>
        <p className="last">
          {tr.rich("summonsDocument_ifYouDoNotAppearAnd", { b: (chunks) => <b>{chunks}</b> })}
        </p>

        <div className="rule-mid" />

        <div className="keep12 strong">{tr("summonsDocument_needHelp")}</div>
        <div className="s1" />
        <table className="t2 helptable">
          <tbody>
            <tr>
              <td style={{ width: "56mm" }}>{tr("summonsDocument_yourRightsAndObligations")}</td>
              <td>{portal("/s138")}</td>
            </tr>
            <tr>
              <td>{tr("summonsDocument_guidanceInOtherLanguages")}</td>
              <td>{portal("/help")}</td>
            </tr>
            <tr>
              <td>{tr("summonsDocument_helpInPerson")}</td>
              <td>
                {tr("summonsDocument_tHelpline", { t: t(f.helpInPerson) })} {phone(local.helpline)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="s2" />
        <p className="t1 last muted">
          {tr("summonsDocument_privacyNoticeTheCourtIsNotified")} {portal("/privacy")}
        </p>

        <div className="folio">{tr("summonsDocument_page2Of2")}</div>
      </section>
    </div>
  );
}
