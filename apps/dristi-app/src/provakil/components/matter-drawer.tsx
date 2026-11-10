"use client";
import {useTranslations as __useTranslations} from "@/i18n/use-translations";
import {LocalizedText as __LocalizedText} from "@/components/localized-text";

import * as React from "react";
import { FileTextIcon, XIcon } from "lucide-react";

import { causeOfAction, formatDate, formatINR, limitationEnds, isoDaysAgo } from "@/provakil/lib/matters";

import type { Row } from "./cases-screen";
import { Chip, STAGE_TONE } from "./ui";

const TABS = ["Overview", "Instrument & notice", "Documents", "Activity"] as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const __t = __useTranslations();
  return (
    <div>
      <dt className="text-[11px] text-(--pv-muted) uppercase">{__t(label)}</dt>
      <dd className="mt-0.5">{children || "—"}</dd>
    </div>
  );
}

/** One matter, as the case workspace shows it. */
export function MatterDrawer({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const __t = __useTranslations();
  const [tab, setTab] = React.useState<(typeof TABS)[number]>("Overview");
  if (!row) return null;
  const m = row;
  const b = m.borrower;

  const activity = [
    { at: m.npaDate, text: __t("matterDrawer_accountClassifiedNpa") },
    { at: m.instruments[0].returnDate, text: __t("matterDrawer_chequeValue0ReturnedValue1", {value0: String(m.instruments[0].chequeNo), value1: String(m.instruments[0].returnReason.slice(5))}) },
    { at: m.notice.dispatchDate, text: __t("matterDrawer_demandNoticeDispatchedByValue0", {value0: String(m.notice.mode)}) },
    ...(m.notice.statusDate ? [{ at: m.notice.statusDate, text: __t("matterDrawer_noticeValue0", {value0: String(m.notice.status.toLowerCase())}) }] : []),
    { at: isoDaysAgo(3), text: __t("matterDrawer_caseAssignedToLegalManagerValue0", {value0: String(m.legalManager)}) },
    ...m.notes.map((n) => ({ at: n.at, text: __t("matterDrawer_noteAddedByValue0", {value0: String(n.by)}) })),
    ...(m.push ? [{ at: m.push.at.slice(0, 10), text: __t("matterDrawer_filedOnSaras20InValue0", {value0: String(m.push.batchNumber)}) }] : []),
    ...(m.stage === "Filed" && m.cnr ? [{ at: isoDaysAgo(1), text: __t("matterDrawer_filedCnrValue0", {value0: String(m.cnr)}) }] : []),
  ].sort((a, c) => (a.at < c.at ? 1 : -1));

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-(--pv-navy)/30" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        aria-label={__t("matterDrawer_caseValue0", {value0: String(m.lan)})}
      >
        <div className="border-b border-(--pv-line) px-5 pt-4">
          <div className="flex items-start gap-3">
            <div>
              <div className="num text-[12px] text-(--pv-muted)">{m.lan} · {m.product}</div>
              <h2 className="text-[18px] font-medium">{<__LocalizedText id="matterDrawer_tataCapitalLtdVs" />}{" "}{b.name}</h2>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Chip tone={STAGE_TONE[m.stage]}>{m.stage}</Chip>
                <Chip>{<__LocalizedText id="matterDrawer_section138NiAct" />}</Chip>
                {m.labels.map((l) => (
                  <Chip key={l} tone="plum">
                    {l}
                  </Chip>
                ))}
              </div>
            </div>
            <button onClick={onClose} className="ml-auto rounded-full p-1.5 text-(--pv-muted) hover:bg-(--pv-ground)" aria-label={__t("matterDrawer_close")}>
              <XIcon className="size-5" />
            </button>
          </div>
          <div className="mt-3 flex gap-5">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 pb-2 text-[13px] font-medium ${tab === t ? "border-(--pv-blue) text-(--pv-blue)" : "border-transparent text-(--pv-muted)"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 text-[13px]">
          {tab === "Overview" ? (
            <dl className="grid grid-cols-2 gap-4">
              <Field label={__t("matterDrawer_borrower")}>{b.name}</Field>
              <Field label={__t("matterDrawer_constitution")}>{b.constitution}</Field>
              <Field label={__t("matterDrawer_mobile")}>{b.mobile}</Field>
              <Field label={__t("matterDrawer_email")}>{b.email}</Field>
              <div className="col-span-2">
                <Field label={__t("matterDrawer_addresses")}>
                  {b.addresses.map((a) => (
                    <div key={a.line}>
                      <span className="text-(--pv-muted)">{a.type}:</span> {a.line}, {a.city} {a.pincode}
                    </div>
                  ))}
                </Field>
              </div>
              {b.persons.length ? (
                <div className="col-span-2">
                  <Field label={__t("matterDrawer_directorsPartners")}>
                    {b.persons.map((p) => (
                      <div key={p.name}>
                        {p.name}, {p.designation}
                      </div>
                    ))}
                  </Field>
                </div>
              ) : null}
              <Field label={__t("matterDrawer_branch")}>{m.branch} · {m.region}</Field>
              <Field label={__t("matterDrawer_legalManager")}>{m.legalManager}</Field>
              <Field label={__t("matterDrawer_advocate")}>
                {m.advocate ? (
                  <>
                    {m.advocate.name} <span className="num text-(--pv-muted)">{m.advocate.enrolment}</span>
                  </>
                ) : (
                  <span className="font-medium text-(--pv-amber)">{<__LocalizedText id="matterDrawer_unassigned" />}</span>
                )}
              </Field>
              <Field label={__t("matterDrawer_dpd")}>
                <span className="num">{m.dpd}</span>
              </Field>
              <Field label={__t("matterDrawer_npaSince")}>{formatDate(m.npaDate)}</Field>
              <Field label={__t("matterDrawer_outstanding")}>
                <span className="num">{formatINR(m.outstanding)}</span>
              </Field>
              <Field label={__t("matterDrawer_causeOfAction")}>{formatDate(causeOfAction(m))}</Field>
              <Field label={__t("matterDrawer_fileBy")}>{formatDate(limitationEnds(m))}</Field>
              {m.push ? (
                <Field label={__t("matterDrawer_saras20Batch")}>
                  <a href={m.push.url} target="_blank" rel="noreferrer" className="num text-(--pv-blue) underline">
                    {m.push.batchNumber}
                  </a>
                </Field>
              ) : null}
              {m.cnr ? <Field label={__t("matterDrawer_cnr")}>{m.cnr}</Field> : null}
            </dl>
          ) : null}

          {tab === "Instrument & notice" ? (
            <div className="flex flex-col gap-5">
              {m.instruments.map((q, i) => (
                <section key={q.chequeNo}>
                  <h3 className="mb-2 font-medium">{<__LocalizedText id="matterDrawer_cheque" />}{" "}{m.instruments.length > 1 ? i + 1 : ""}</h3>
                  <dl className="grid grid-cols-2 gap-4">
                    <Field label={__t("matterDrawer_chequeNo")}><span className="num">{q.chequeNo}</span></Field>
                    <Field label={__t("matterDrawer_amount")}><span className="num">{formatINR(q.amount)}</span></Field>
                    <Field label={__t("matterDrawer_chequeDate")}>{formatDate(q.chequeDate)}</Field>
                    <Field label={__t("matterDrawer_draweeIfsc")}><span className="num">{q.draweeIfsc}</span></Field>
                    <Field label={__t("matterDrawer_drawerAccount")}><span className="num">{q.drawerAccount}</span></Field>
                    <Field label={__t("matterDrawer_deposited")}>{formatDate(q.depositDate)} {<__LocalizedText id="matterDrawer_at" />}{" "}<span className="num">{q.collectingIfsc}</span></Field>
                    <Field label={__t("matterDrawer_returned")}>{formatDate(q.returnDate)}</Field>
                    <Field label={__t("matterDrawer_returnReason")}>{q.returnReason}</Field>
                  </dl>
                </section>
              ))}
              <section>
                <h3 className="mb-2 font-medium">{<__LocalizedText id="matterDrawer_demandNotice" />}</h3>
                <dl className="grid grid-cols-2 gap-4">
                  <Field label={__t("matterDrawer_dispatched")}>{formatDate(m.notice.dispatchDate)}</Field>
                  <Field label={__t("matterDrawer_mode")}>{m.notice.mode}</Field>
                  <Field label={__t("matterDrawer_consignmentNo")}><span className="num">{m.notice.consignmentNo}</span></Field>
                  <Field label={__t("matterDrawer_status")}>{m.notice.status}{m.notice.statusDate ? `, ${formatDate(m.notice.statusDate)}` : ""}</Field>
                  <Field label={__t("matterDrawer_replyReceived")}>{m.notice.replyReceived ? __t("matterDrawer_yes") : __t("matterDrawer_no")}</Field>
                  <Field label={__t("matterDrawer_receivedAfterNotice")}><span className="num">{formatINR(m.receivedAfterNotice)}</span></Field>
                </dl>
              </section>
              {m.notes.length ? (
                <section>
                  <h3 className="mb-2 font-medium">{<__LocalizedText id="matterDrawer_notes" />}</h3>
                  {m.notes.map((n) => (
                    <div key={n.at} className="rounded-md bg-(--pv-ground) p-3">
                      <div className="text-[11px] text-(--pv-muted)">
                        {n.by} · {formatDate(n.at)} {n.tag ? <Chip tone="plum">{n.tag}</Chip> : null}
                      </div>
                      <p className="mt-1">{__t(n.text)}</p>
                    </div>
                  ))}
                </section>
              ) : null}
            </div>
          ) : null}

          {tab === "Documents" ? (
            <ul className="flex flex-col divide-y divide-(--pv-line) rounded-md border border-(--pv-line)">
              {m.documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                  <FileTextIcon className="size-4 text-(--pv-red)" aria-hidden />
                  <a href={`/provakil/api/documents/${encodeURIComponent(d.id)}`} target="_blank" rel="noreferrer" className="flex-1 hover:underline">
                    {d.name}
                  </a>
                  <Chip>{d.tag}</Chip>
                  <span className="num text-[11px] text-(--pv-muted)">{formatDate(d.uploadedOn)}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {tab === "Activity" ? (
            <ol className="relative ml-2 border-l border-(--pv-line)">
              {activity.map((a, i) => (
                <li key={`${a.at}-${i}`} className="mb-4 ml-4">
                  <span className={`absolute -left-1.5 mt-1 size-3 rounded-full border-2 border-white ${i === 0 ? "bg-(--pv-blue)" : "bg-(--pv-muted)/50"}`} />
                  <div className="num text-[11px] text-(--pv-muted)">{formatDate(a.at)}</div>
                  <div>{__t(a.text)}</div>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
