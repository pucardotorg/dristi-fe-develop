import type { Copy } from "@/lib/onboarding/content";
import { DEMO_JOIN_CASE, type CaseParty, type JoinCase } from "@/lib/join/content";

export { fill as fillCopy } from "@/lib/join/content";

/**
 * Advocate portal — content model.
 *
 * The advocate join flow (Aug 14 brief) mirrors the litigant one but answers a
 * different question: not "which party am I" but "which party do I act for". Role
 * is known from sign-in, so the legacy "are you an advocate or a litigant?" question
 * is gone. The flow is: find case → check details → prove possession of the summons
 * code → declare side, litigants and any replacement → confirm litigant details →
 * attach the vakalatnama → outcome.
 *
 * Outcomes follow the access rules: an accused's advocate (not replacing anyone)
 * joins immediately; a complainant's advocate, or any replacement, raises a request
 * that an approver must clear first.
 */

const t = (en: string, ml: string): Copy => ({ en, ml });

/* ------------------------------------------------------------------- demo data */

export const ADVOCATE_PROFILE_NAME = "Adv. Anjali Nair";

/** Same demo case as the litigant flow — the advocate joins the other side of it. */
export const ADVOCATE_JOIN_CASE: JoinCase = DEMO_JOIN_CASE;

/** The complainant side as joinable parties (JoinCase only carries a display string). */
/** Sandbox vakalatnama fee — the same figure the pending-tasks sandbox uses. The real
 *  amount comes from the payment service; this is not a fee schedule. */
export const VAKALATNAMA_FEE_PAISE = 25 * 100;

export const COMPLAINANT_PARTIES: CaseParty[] = DEMO_JOIN_CASE.complainants;

/** Advocates already on record per side — drives "has another advocate already
 *  uploaded and paid for this vakalatnama?", which is asked only once one is on the case. */
export const SIDE_ADVOCATES: Record<"complainant" | "accused", string[]> = {
  complainant: ["Adv. Meera Pillai"],
  accused: [],
};

export type LitigantPrefill = {
  first: string;
  middle: string;
  last: string;
  father: string;
};

/** Stand-in for the litigant-details endpoint, keyed by party id. */
export const LITIGANT_PREFILL: Record<string, LitigantPrefill> = {
  "comp-1": { first: "South Indian Bank Ltd.", middle: "", last: "", father: "" },
  "acc-1": { first: "Rajan", middle: "Krishnan", last: "Nair", father: "Krishnan Nair" },
  "acc-2": { first: "Suresh", middle: "", last: "Babu P", father: "Babu Pillai" },
};

export const LITIGANT_MOBILE = "+91 60000 00000";

export type Vakalatnama = {
  id: string;
  /** The advocate's own label for the generated vakalatnama. */
  name: string;
  /** The litigants the vakalatnama covers, as it was generated. */
  parties: string;
  caseRef: string;
  generatedOn: string;
  advocates: string[];
};

/** Stand-in for the advocate's generated-vakalatnama library. Generation itself lives
 *  elsewhere in the portal — the join flow only selects from here or uploads a file.
 *  `caseRef`/`generatedOn` are kept for the document preview but no longer surface in
 *  the picker list, where a vakalatnama is identified by its name and litigants. */
export const VAKALATNAMAS: Vakalatnama[] = [
  {
    id: "vk-1",
    name: "South Indian Bank cheque matter",
    parties: "Rajan Krishnan Nair and Suresh Babu P",
    caseRef: "CC 847/2026",
    generatedOn: "12-08-2026",
    advocates: ["Adv. Anjali Nair", "Adv. Anil George"],
  },
  {
    id: "vk-2",
    name: "Anitha Joseph — cheque bounce",
    parties: "Anitha Joseph",
    caseRef: "ST 112 / 2026",
    generatedOn: "08-08-2026",
    advocates: ["Adv. Anjali Nair"],
  },
  {
    id: "vk-3",
    name: "Fathima Beevi — cheque bounce",
    parties: "Fathima Beevi",
    caseRef: "CMP 210 / 2026",
    generatedOn: "01-08-2026",
    advocates: ["Adv. Anjali Nair"],
  },
  {
    id: "vk-4",
    name: "Vismaya Traders recovery",
    parties: "Vismaya Traders",
    caseRef: "CC 412 / 2025",
    generatedOn: "28-07-2026",
    advocates: ["Adv. Anjali Nair", "Adv. Joseph Mathew"],
  },
  {
    id: "vk-5",
    name: "Latheef M — cheque bounce",
    parties: "Latheef M.",
    caseRef: "ST 198 / 2026",
    generatedOn: "24-07-2026",
    advocates: ["Adv. Anjali Nair"],
  },
  {
    id: "vk-6",
    name: "Naveen Chandra — cheque bounce",
    parties: "Naveen Chandra",
    caseRef: "CMP 176 / 2026",
    generatedOn: "19-07-2026",
    advocates: ["Adv. Anjali Nair"],
  },
  {
    id: "vk-7",
    name: "Rahman brothers matter",
    parties: "Amina Rahman and Sameer Rahman",
    caseRef: "CC 365 / 2026",
    generatedOn: "14-07-2026",
    advocates: ["Adv. Anjali Nair", "Adv. Anil George"],
  },
];

export type BarAdvocate = { barId: string; name: string };

/** Stand-in for the Bar roll lookup — used when a new vakalatnama names co-advocates.
 *  The advocate searches by Bar registration ID (or name) and adds them. */
export const BAR_DIRECTORY: BarAdvocate[] = [
  { barId: "K/1123/2011", name: "Adv. Anil George" },
  { barId: "K/2048/2015", name: "Adv. Joseph Mathew" },
  { barId: "K/0876/2009", name: "Adv. Meera Pillai" },
  { barId: "K/3321/2018", name: "Adv. Reena Thomas" },
  { barId: "K/1590/2013", name: "Adv. Sunil Kumar" },
  { barId: "K/2765/2016", name: "Adv. Fathima Latheef" },
  { barId: "K/0442/2007", name: "Adv. Rajesh Menon" },
  { barId: "K/3104/2019", name: "Adv. Divya Nair" },
];

/** Sandbox: the advocates this office has been on vakalatnamas with — the only names the
 *  co-advocate field suggests. Anyone else is added by their full mobile number and never
 *  resolved to a name (owner, 2026-10-13, as the Share field). */
export const VAKALATNAMA_CO_ADVOCATES: { name: string; phone: string; barId: string }[] = [
  { ...BAR_DIRECTORY[1], phone: "94471 20486" },
  { ...BAR_DIRECTORY[2], phone: "98950 08762" },
  { ...BAR_DIRECTORY[0], phone: "94460 11230" },
  { ...BAR_DIRECTORY[5], phone: "97450 27651" },
];

/** Sandbox: the advocate who already named this one on a paid vakalatnama. */
export const VAKALATNAMA_INVITER = BAR_DIRECTORY[1].name;

/* ------------------------------------------------------------------- app shell */

export const advShell = {
  navHome: t("advocate_home", "ഹോം"),
  navCases: t("advocate_yourCases", "നിങ്ങളുടെ കേസുകൾ"),
  navFilings: t("advocate_makeFilings", "ഫയലിംഗുകൾ ചെയ്യുക"),
  navJoin: t("advocate_joinACase", "കേസിൽ ചേരുക"),
  /* "Take action" (owner, 2026-10-14): what is owed, said as the thing to do. */
  navTasks: t("advocate_takeAction", "ബാക്കിയുള്ള ജോലികൾ"),
  navCalendar: t("advocate_calendar", "കലണ്ടർ"),
  navTeam: t("advocate_teamCaseAccess", "ടീം കേസ് ആക്‌സസ്"),
  role: t("advocate_advocate", "അഭിഭാഷക"),
} as const;

/* ----------------------------------------------------------------------- home */

/**
 * The advocate hearings dashboard. Chrome copy only — everything derived from data
 * (parties, stages, due phrases) comes through `lib/tasks/format` and stays English,
 * exactly as it does on /tasks: bilingual rendering is the citizen screens' rule.
 */
export const advHome = {
  greetingMorning: t("advocate_goodMorningName", "സുപ്രഭാതം, {name}"),
  greetingAfternoon: t("advocate_goodAfternoonName", "നമസ്കാരം, {name}"),
  greetingEvening: t("advocate_goodEveningName", "ശുഭ സന്ധ്യ, {name}"),
  mattersOne: t("advocate_1MatterListed", "1 വിഷയം പട്ടികയിൽ"),
  mattersMany: t("advocate_nMattersListed", "{n} വിഷയങ്ങൾ പട്ടികയിൽ"),
  mattersNone: t("advocate_nothingListed", "ഒന്നും പട്ടികയിലില്ല"),
  /** Appended to the subline when the selected day carries task consequences —
      the words behind the week strip's amber dot, so it never means by colour alone. */
  dueOne: t("advocate_1TaskDue", "1 ജോലി അവസാനിക്കുന്നു"),
  dueMany: t("advocate_nTasksDue", "{n} ജോലികൾ അവസാനിക്കുന്നു"),
  today: t("advocate_today", "ഇന്ന്"),

  /* Board */
  inSession: t("advocate_inSession", "സെഷനിൽ"),
  /** The state, and only the state: the item number is on the chip and the
      listed time is in the row's rest cell, so nothing is said twice. */
  nowLabel: t("advocate_now", "ഇപ്പോൾ"),
  /** A property of the matter, on its own metadata line — not a status chip.
      "View only" reads as a UI mode; this is the word an advocate says. */
  notOnVakalatnama: t("advocate_notOnTheVakalatnama", "വക്കാലത്തിൽ ഇല്ല"),
  /** Above the tasks well inside a hearing card — it is not self-evidently a task list. */
  blockersHeading: t(
    "advocate_pendingBeforeThisHearing",
    "ഈ ഹിയറിംഗിന് മുൻപ് ബാക്കി",
  ),
  itemN: t("advocate_itemN", "ഇനം {n}"),
  concludedStrip: t(
    "advocate_nConcludedEarlierItemsItems",
    "നേരത്തെ തീർന്നത് {n} — ഇനം {items}",
  ),
  viewCases: t("advocate_viewCases", "കേസുകൾ കാണുക"),
  layoutCards: t("advocate_cards", "കാർഡുകൾ"),
  layoutList: t("advocate_list", "പട്ടിക"),
  layoutLabel: t("advocate_causeListLayout", "കോസ് ലിസ്റ്റ് രൂപം"),
  /** The overflow chip past ~7 advocates — the rest of the day's roster in a menu. */
  moreAdvocates: t("advocate_moreAdvocates", "കൂടുതൽ അഭിഭാഷകർ"),
  /** Per-court: the court's full official day cause list, all matters. */
  viewCauseList: t("advocate_viewCauseList", "കോസ് ലിസ്റ്റ് കാണുക"),
  /** Signals it joins one of the advocate's OWN hearings, not a generic courtroom. */
  joinCourtroom: t("advocate_joinAHearing", "ഒരു വിചാരണയിൽ ചേരുക"),
  /** The "Join your hearing" picker: only the advocate's own hearings being called now. */
  joinDialogTitle: t("advocate_joinYourHearing", "നിങ്ങളുടെ വിചാരണയിൽ ചേരുക"),
  joinDialogBody: t(
    "advocate_yourHearingsBeingCalledRightNow",
    "നിങ്ങളുടെ വിചാരണകൾ ഇപ്പോൾ വിളിക്കുന്നു.",
  ),
  /** Footer note pointing to the cause list for any hearing that isn't the advocate's. */
  joinDialogOther: t(
    "advocate_toJoinAnyOtherHearingOpenThe",
    "മറ്റേതെങ്കിലും വിചാരണയിൽ ചേരാൻ കോസ് ലിസ്റ്റ് തുറക്കുക.",
  ),
  joinDialogEmpty: t(
    "advocate_noneOfYourHearingsAreBeingCalled",
    "നിങ്ങളുടെ വിചാരണകളൊന്നും ഇപ്പോൾ വിളിക്കുന്നില്ല.",
  ),
  joinDialogEmptyHint: t(
    "advocate_openTheCauseListToSeeEvery",
    "എല്ലാ കോടതികളിലും വിളിക്കുന്ന വിചാരണകൾ കാണാൻ കോസ് ലിസ്റ്റ് തുറക്കുക.",
  ),
  joinAction: t("advocate_join", "ചേരുക"),
  emptyDayTitle: t("advocate_nothingListedThisDay", "ഈ ദിവസം ഒന്നും പട്ടികയിലില്ല"),
  /** Board-level since the courts stack: the empty state is the whole day's,
      not one court's, and no court can be selected away from any more. */
  emptyDayBody: t(
    "advocate_noMattersAreListedInYourCourts",
    "തിരഞ്ഞെടുത്ത ദിവസം നിങ്ങളുടെ കോടതികളിൽ വിഷയങ്ങളൊന്നും പട്ടികയിലില്ല.",
  ),
  jumpNext: t("advocate_nextHearingDayDayNListed", "അടുത്ത ഹിയറിംഗ് ദിവസം: {day} — {n} ഇനം"),

  /* A load that failed, said apart from a load that is slow — the spinner used
     to stand for both, so a failure spun forever with no way out. */
  loadErrorTitle: t("advocate_couldNotLoadTheDay", "ഈ ദിവസത്തെ വിവരങ്ങൾ ലഭിച്ചില്ല"),
  loadErrorBody: t(
    "advocate_theCauseListAndYourActionsDid",
    "കോസ് ലിസ്റ്റും ബാക്കിയുള്ള ജോലികളും ലഭിച്ചില്ല. കണക്ഷൻ പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.",
  ),
  retry: t("advocate_tryAgain", "വീണ്ടും ശ്രമിക്കുക"),

  /* Week strip */
  prevWeek: t("advocate_previousWeek", "കഴിഞ്ഞ ആഴ്ച"),
  nextWeek: t("advocate_nextWeek", "അടുത്ത ആഴ്ച"),
  prevDay: t("advocate_previousDay", "മുൻ ദിവസം"),
  nextDay: t("advocate_nextDay", "അടുത്ത ദിവസം"),
  pickDate: t("advocate_pickADate", "തീയതി തിരഞ്ഞെടുക്കുക"),
  previewDates: t("advocate_previewNearbyDates", "അടുത്തുള്ള തീയതികൾ കാണുക"),
  previewDateHelp: t("advocate_moveAcrossTheDateToPreviewClick", "തീയതിക്ക് മുകളിലൂടെ നീങ്ങി നോക്കുക. തിരഞ്ഞെടുക്കാൻ ക്ലിക്ക് ചെയ്യുക. കീബോർഡിൽ ഇടത്, വലത് അമ്പുകൾ ഉപയോഗിച്ച ശേഷം Enter അല്ലെങ്കിൽ Space അമർത്തുക. Escape റദ്ദാക്കും."),

  /* Whose matters — the board's advocate switcher. Names, not a permission
     model: "view access" is the system's vocabulary, an advocate says a name. */
  whoseMatters: t("advocate_whoseMatters", "ആരുടെ വിഷയങ്ങൾ"),
  switcherYou: t("advocate_nameYou", "{name} (നിങ്ങൾ)"),
  showYourMatters: t("advocate_showYourMatters", "നിങ്ങളുടെ വിഷയങ്ങൾ കാണിക്കുക"),
  emptyAdvocateTitle: t(
    "advocate_nothingListedForName",
    "{name}-ന് ഒന്നും പട്ടികയിലില്ല",
  ),
  emptyAdvocateBody: t(
    "advocate_noMattersListedOnThisDayWhere",
    "ഈ ദിവസം {name} കേസിലുള്ള വിഷയങ്ങളൊന്നും പട്ടികയിലില്ല. മുഴുവൻ ബോർഡ് കാണാൻ നിങ്ങളുടെ വിഷയങ്ങളിലേക്ക് മടങ്ങുക.",
  ),
  // The filter is now multi-select, so an empty board is not one named
  // colleague's — it is the set the viewer picked.
  emptyFilterTitle: t(
    "advocate_noMattersForTheChosenAdvocates",
    "തിരഞ്ഞെടുത്ത അഭിഭാഷകർക്ക് വിഷയങ്ങളൊന്നുമില്ല",
  ),
  emptyFilterBody: t(
    "advocate_noListedMattersOnThisDayFor",
    "നിങ്ങൾ തിരഞ്ഞെടുത്ത അഭിഭാഷകർക്ക് ഈ ദിവസം പട്ടികയിലുള്ള വിഷയങ്ങളൊന്നുമില്ല. മുഴുവൻ ബോർഡ് കാണാൻ നിങ്ങളുടെ വിഷയങ്ങൾ കാണിക്കുക.",
  ),

  /* Companion rail */
  railTitle: t("advocate_takeAction", "ബാക്കിയുള്ള ജോലികൾ"),
  /** The panel lists today and the next three days; the strip's badge counts every
      open task. The two can never agree, so the header says which one this is. */
  railScope: t(
    "advocate_dueInTheNext3Days",
    "അടുത്ത 3 ദിവസത്തിനുള്ളിൽ അവസാനിക്കുന്നവ",
  ),
  prepTitle: t(
    "advocate_importantUpcomingHearings",
    "വരാനിരിക്കുന്ന പ്രധാന ഹിയറിംഗുകൾ",
  ),
  prepCaption: t(
    "advocate_evidenceCrossPleaAndArgumentsComingUp",
    "വരാനിരിക്കുന്ന തെളിവ്, വിസ്താരം, ബോധിപ്പിക്കൽ, വാദം",
  ),
  prepOpen: t(
    "advocate_openImportantUpcomingHearingsNAhead",
    "പ്രധാന ഹിയറിംഗുകൾ തുറക്കുക, {n} വരാനുണ്ട്",
  ),
  prepGroupWeek: t("advocate_next7Days", "അടുത്ത 7 ദിവസം"),
  prepGroupLater: t("advocate_theFortnightAfter", "അതിനു ശേഷമുള്ള രണ്ടാഴ്ച"),
  prepTomorrow: t("advocate_tomorrow", "നാളെ"),
  prepInDays: t("advocate_inNDays", "{n} ദിവസത്തിൽ"),
  prepEmptyTitle: t("advocate_nothingSubstantialAhead", "സുപ്രധാനമായി ഒന്നുമില്ല"),
  prepEmptyBody: t(
    "advocate_noEvidencePleaOrArgumentsPostingIn",
    "അടുത്ത മൂന്നാഴ്ചയിൽ തെളിവോ ബോധിപ്പിക്കലോ വാദമോ ഇല്ല.",
  ),
  prepPendingOne: t("advocate_1Pending", "1 ബാക്കി"),
  prepPendingMany: t("advocate_nPending", "{n} ബാക്കി"),
  viewCase: t("advocate_viewCase", "കേസ് കാണുക"),
  groupToday: t("advocate_dueToday", "ഇന്ന് അവസാനം"),
  groupSoon: t("advocate_next3Days", "അടുത്ത 3 ദിവസം"),
  railResize: t("advocate_resizeTheTakeActionRail", "പാനലിന്റെ വീതി ക്രമീകരിക്കുക"),
  railOpen: t("advocate_openTakeActionNNeedAction", "ബാക്കിയുള്ള ജോലികൾ തുറക്കുക, {n} എണ്ണം"),
  railCollapse: t("advocate_collapseTakeAction", "ജോലികളുടെ പാനൽ ചുരുക്കുക"),
  railViewAll: t("advocate_viewAllNActions", "എല്ലാ {n} ജോലികളും കാണുക"),
  railEmptyTitle: t("advocate_nothingNeedsYou", "ഒന്നും ബാക്കിയില്ല"),
  railEmptyBody: t(
    "advocate_everyTaskIsDoneOrWaitingOn",
    "എല്ലാം തീർന്നു, അല്ലെങ്കിൽ കോടതിയുടെ ഊഴം.",
  ),
  railClose: t("advocate_closeThisPanel", "ഈ പാനൽ അടയ്ക്കുക"),
  open: t("advocate_open", "തുറക്കുക"),
  blocksHearing: t("advocate_blocksTheHearing", "ഹിയറിംഗ് തടയുന്നു"),

  /* Who is on the matter — a case is rarely one advocate's */
  teamLabel: t("advocate_onThisMatter", "ഈ വിഷയത്തിൽ"),
  teamMore: t("advocate_nMoreOnThisMatter", "ഈ വിഷയത്തിൽ വേറെ {n} പേർ"),
  teamHoldsVakalatnama: t("advocate_nameVakalatnama", "{name} — വക്കാലത്ത്"),
  teamCaseAccess: t("advocate_nameCaseAccess", "{name} — കേസ് ആക്‌സസ്"),
  /* Case peek */
  peekLabel: t("advocate_casePeek", "കേസ് ഒറ്റനോട്ടം"),
  peekClose: t("advocate_close", "അടയ്ക്കുക"),
  peekStage: t("advocate_stage", "ഘട്ടം"),
  peekHearing: t("advocate_thisHearing", "ഈ ഹിയറിംഗ്"),
  peekAdvocates: t("advocate_onTheVakalatnama", "വക്കാലത്തിൽ"),
  peekTeam: t("advocate_alsoOnTheCase", "കേസിൽ ഒപ്പം"),
  peekTasks: t("advocate_pendingOnThisCase", "ഈ കേസിൽ ബാക്കി"),
  peekNoTasks: t("advocate_nothingPending", "ഒന്നും ബാക്കിയില്ല"),
  peekNoTasksBody: t(
    "advocate_thisMatterIsReadyForTheHearing",
    "ഈ വിഷയം ഹിയറിംഗിന് തയ്യാറാണ്.",
  ),

  /* Day timeline — the unified rail + accordion view across every court */
  courtFilterAll: t("advocate_allCourts", "എല്ലാ കോടതികളും"),
  courtFilterLabel: t("advocate_filterByCourt", "കോടതി പ്രകാരം അരിക്കുക"),
  courtFilterCount: t("advocate_nCourts", "{n} കോടതികൾ"),
  courtFilterMore: t("advocate_nMore", "+{n} കൂടി"),
  /* Summary strip — the number is set apart, these are its words */
  statHearingOne: t("advocate_hearing", "ഹിയറിംഗ്"),
  statHearingMany: t("advocate_hearings", "ഹിയറിംഗുകൾ"),
  statConflictOne: t("advocate_conflict", "കൂട്ടിയിടി"),
  statConflictMany: t("advocate_conflicts", "കൂട്ടിയിടികൾ"),
  statOverlap: t("advocate_nOverlap", "{n} ഓവർലാപ്പ്"),
  statConflictSub: t("advocate_nHearingsOverlap", "{n} ഹിയറിംഗുകൾ ഓവർലാപ്പ്"),
  statClearCard: t("advocate_clearSlots", "ഒഴിവുള്ള സ്ലോട്ടുകൾ"),
  blockingOne: t("advocate_nActionToTake", "{n} തീർപ്പാക്കാനുള്ള ജോലി"),
  blockingMany: t("advocate_nActionsToTake", "{n} തീർപ്പാക്കാനുള്ള ജോലികൾ"),
  pendingOpen: t("advocate_showTheActionsForThisMatter", "ഈ കേസിന്റെ തീർപ്പാക്കാനുള്ള ജോലികൾ കാണിക്കുക"),
  /** The quiet per-hearing icon that opens the cause list and traces this matter's row. */
  viewOnCauseList: t("advocate_viewThisHearingOnTheCauseList", "ഈ വിചാരണ കോസ് ലിസ്റ്റിൽ കാണുക"),
  refreshHearings: t("advocate_refreshHearings", "ഹിയറിംഗുകൾ പുതുക്കുക"),
  refreshedDone: t("advocate_refreshed", "പുതുക്കി"),
  lastRefreshed: t("advocate_lastRefreshedTime", "അവസാനം പുതുക്കിയത് {time}"),
  approxLabel: t("advocate_approx", "ഏകദേശം"),
  /* Cause list modal */
  causeListTitle: t("advocate_causeList", "കോസ് ലിസ്റ്റ്"),
  causeListScope: t("advocate_everyMatterListedAcrossAllTheCourts", "എല്ലാ കോടതികളിലുമായി ലിസ്റ്റ് ചെയ്ത എല്ലാ കേസുകളും"),
  causeListScopeCourt: t("advocate_everyMatterListedInCourt", "{court}-ൽ ലിസ്റ്റ് ചെയ്ത എല്ലാ കേസുകളും"),
  /* When many courts are picked, name the first two and count the rest, so the
     scope line stays short and never pushes the buttons below it. */
  causeListScopeOthers: t("advocate_courtsAndNOthers", "{courts} കൂടാതെ {n} എണ്ണം"),
  causeListAllCourts: t("advocate_allCourts", "എല്ലാ കോടതികളും"),
  causeListSearch: t("advocate_searchByCaseNameNumberOrAdvocate", "കേസ് പേര്, നമ്പർ അല്ലെങ്കിൽ വക്കീൽ ഉപയോഗിച്ച് തിരയുക"),
  causeListReset: t("advocate_reset", "പുനഃസജ്ജമാക്കുക"),
  causeListDownload: t("advocate_downloadCauseList", "കോസ് ലിസ്റ്റ് ഡൗൺലോഡ് ചെയ്യുക"),
  causeListJoin: t("advocate_joinHearingOnline", "ഹിയറിംഗ് ഓൺലൈനിൽ ചേരുക"),
  causeListRefreshed: t("advocate_lastRefreshedTime", "അവസാനം പുതുക്കിയത് {time}"),
  causeListEmpty: t("advocate_noMattersListedForThisSearch", "ഈ തിരയലിന് കേസുകളൊന്നുമില്ല"),
  causeListMine: t("advocate_youAppear", "നിങ്ങൾ ഹാജരാകുന്നു"),
  causeListMineCount: t("advocate_nOfTheseMattersAreYours", "ഇവയിൽ {n} കേസുകൾ നിങ്ങളുടേതാണ്"),
  colItem: t("advocate_item", "ഇനം"),
  colCase: t("advocate_case", "കേസ്"),
  colCourt: t("advocate_court", "കോടതി"),
  colAdvocates: t("advocate_advocates", "വക്കീലുമാർ"),
  colCaseNumber: t("advocate_caseNumber", "കേസ് നമ്പർ"),
  colHearingType: t("advocate_hearingType", "ഹിയറിംഗ് തരം"),
  colStatus: t("advocate_status", "സ്ഥിതി"),
  statusCompleted: t("advocate_completed", "പൂർത്തിയായി"),
  statusOngoing: t("advocate_liveNow", "ഇപ്പോൾ നടക്കുന്നു"),
  statusListed: t("advocate_listed", "ലിസ്റ്റ് ചെയ്തു"),
  /* A concluded hearing reached but not taken up. On the home board only the
     passed-over concluded matters carry this tag (completed ones need none, since
     concluded means completed); the cause list makes it a fourth status. */
  statusPassedOver: t("advocate_passedOver", "മാറ്റിവെച്ചു"),
  approxNote: t(
    "advocate_timesAreApproximateUnlessTheCourtHas",
    "കോടതി സമയം നിശ്ചയിച്ചിട്ടില്ലെങ്കിൽ സമയം ഏകദേശമാണ്.",
  ),
  ongoingTag: t("advocate_liveNow", "ഇപ്പോൾ നടക്കുന്നു"),
  conflictTag: t("advocate_conflictingHearings", "ഒരേസമയത്തെ വിചാരണകൾ"),
  /* The hearing and court nouns are filled already pluralised ({hw}/{cw}), so the
     line reads right at one or many ("1 hearing across 1 court"). */
  slotAcrossCourts: t("advocate_nHwAcrossCCw", "{c} {cw}, {n} {hw}"),
  pendingHeading: t("advocate_pendingBeforeThisHearing", "ഈ ഹിയറിംഗിന് മുൻപ് ബാക്കി"),
  statClear: t("advocate_clear", "ഒഴിവ്"),
  statClearSub: t("advocate_singleHearingSlots", "ഒറ്റ ഹിയറിംഗ് സ്ലോട്ടുകൾ"),
  statCourtOne: t("advocate_court_437fed73", "കോടതി"),
  statCourtMany: t("advocate_courts", "കോടതികൾ"),
  statDueOne: t("advocate_taskDue", "ജോലി അവസാനിക്കുന്നു"),
  statDueMany: t("advocate_tasksDue", "ജോലികൾ അവസാനിക്കുന്നു"),
  /* Slot stat — takes the conflict stat's place in the launch view. A single
     sitting shows its time range ("9:00 am – 5:00 pm"); several show a count. */
  /* Blocking-task stat — matters that owe work before their hearing today. The
     slot stat reuses slotOne/slotMany for its count; the exact time range shows in
     the slot tab, not the stat. */
  statBlockingOne: t("advocate_actionToTake", "തീർപ്പാക്കാനുള്ള ജോലി"),
  statBlockingMany: t("advocate_actionsToTake", "തീർപ്പാക്കാനുള്ള ജോലികൾ"),
  /* Slot tabs — the sitting's live tab throbs; this names the state for readers
     who cannot see the dot. */
  slotLive: t("advocate_inSession", "സെഷനിൽ"),
  /** The sittings tab row: its accessible name, and the overflow menu's label. */
  sittingsLabel: t("advocate_sittings", "സിറ്റിങ്ങുകൾ"),
  moreSittings: t("advocate_more", "കൂടുതൽ"),
  /** Tooltip on a slot tab's pulsing dot. */
  slotLiveTip: t("advocate_thisSittingIsInSessionNow", "ഈ സിറ്റിങ് ഇപ്പോൾ നടക്കുന്നു"),
  /* Zones */
  zoneUpcoming: t("advocate_scheduledNext", "അടുത്തതായി"),
  nextHintOne: t("advocate_nextTime1Hearing", "അടുത്തത്: {time} · 1 ഹിയറിംഗ്"),
  nextHintMany: t("advocate_nextTimeNHearings", "അടുത്തത്: {time} · {n} ഹിയറിംഗുകൾ"),
  concludedWord: t("advocate_concluded", "കഴിഞ്ഞു"),
  slotOne: t("advocate_slot", "സ്ലോട്ട്"),
  slotMany: t("advocate_slots", "സ്ലോട്ടുകൾ"),
  concludedShow: t("advocate_showConcludedHearings", "കഴിഞ്ഞ ഹിയറിംഗുകൾ കാണിക്കുക"),
  /* Conflict slots */
  conflictPill: t("advocate_nHearings", "{n} ഹിയറിംഗുകൾ"),
  nowConflictPill: t("advocate_nHearingsNow", "ഇപ്പോൾ {n} ഹിയറിംഗുകൾ"),
  slotExpand: t("advocate_showTheHearingsAtTime", "{time}-ലെ ഹിയറിംഗുകൾ കാണിക്കുക"),
  nowEmpty: t(
    "advocate_nothingIsBeingCalledRightNow",
    "ഇപ്പോൾ ഒന്നും വിളിക്കുന്നില്ല",
  ),
  noUpcoming: t("advocate_nothingScheduledNext", "അടുത്തതായി ഒന്നുമില്ല"),
  /* Day header (desktop): the big date and the board's title. */
  hearingsForDay: t("advocate_yourHearingsForTheDay", "ഈ ദിവസത്തെ നിങ്ങളുടെ ഹിയറിംഗുകൾ"),
  /* A deployment with one court names it here, once, instead of on every hearing. */
  hearingsInCourt: t("advocate_yourHearingsInCourt", "{court}-ലെ നിങ്ങളുടെ ഹിയറിംഗുകൾ"),
  /* Timeline rail: each phase names itself and its count; the sitting's two
     ends bracket it. "Live now" and "Scheduled next" replaced Ongoing and
     Upcoming, which readers took for each other. */
  zoneConcluded: t("advocate_concluded_455d83e6", "കഴിഞ്ഞവ"),
  zoneLive: t("advocate_liveNow", "ഇപ്പോൾ നടക്കുന്നു"),
  phaseCount: t("advocate_nHw", "{n} {hw}"),
  liveAcross: t("advocate_liveHearingsAcrossCCw", "{c} {cw}-ൽ ഇപ്പോൾ നടക്കുന്നു"),
  moreScheduledOne: t("advocate_1MoreScheduledHearing", "1 ഹിയറിംഗ് കൂടി"),
  moreScheduledMany: t("advocate_nMoreScheduledHearings", "{n} ഹിയറിംഗുകൾ കൂടി"),
  showFewer: t("advocate_showFewer", "കുറച്ച് കാണിക്കുക"),
  /* People filter, one per slot tab. */
  peopleFilter: t("advocate_people", "ആളുകൾ"),
  scopeMine: t("advocate_myHearings", "എന്റെ ഹിയറിംഗുകൾ"),
  scopeMineHint: t("advocate_casesWhereYouAreOnTheVakalatnama", "നിങ്ങൾ വക്കാലത്തിലുള്ള കേസുകൾ"),
  scopeAll: t("advocate_allICanAccess", "എനിക്ക് കാണാവുന്നവയെല്ലാം"),
  scopeAllHint: t("advocate_addsCasesYouSeeThroughOfficeAccess", "ഓഫീസ് ആക്സസ് വഴി കാണുന്ന കേസുകളും"),
  peopleHeading: t("advocate_onTheVakalatnama_42ca4846", "വക്കാലത്തിൽ ഉള്ളവർ"),
  peopleNone: t("advocate_noOneElseOnTheseVakalatnamas", "ഈ വക്കാലത്തുകളിൽ മറ്റാരുമില്ല"),
  clearFilters: t("advocate_clearFilters", "ഫിൽട്ടറുകൾ നീക്കുക"),
  /** Footer of the People menu: untick every name. */
  clearPeople: t("advocate_clearSelection", "തിരഞ്ഞെടുപ്പ് നീക്കുക"),
  /** The People button once names are ticked: "People · 2". */
  peopleCount: t("advocate_peopleN", "ആളുകൾ · {n}"),
  /** The single people menu (option C). */
  peopleMe: t("advocate_me", "ഞാൻ"),
  /** The access menu: three views of the sitting, one at a time. */
  accessMine: t("advocate_onMyVakalatnama", "എന്റെ വക്കാലത്തിലുള്ളവ"),
  accessMineTip: t("advocate_hearingsWhereYouAreOnTheVakalatnama", "നിങ്ങൾ വക്കാലത്തിലുള്ള വിചാരണകൾ"),
  accessOfficeOnly: t("advocate_officeAccess", "ഓഫീസ് ആക്സസ്"),
  accessOfficeTip: t("advocate_hearingsThroughOfficeAccessNotYourVakalatnama", "ഓഫീസ് ആക്സസ് വഴി, നിങ്ങളുടെ വക്കാലത്ത് വഴിയല്ല"),
  accessAll: t("advocate_allHearings", "എല്ലാ വിചാരണകളും"),
  accessAllTip: t("advocate_everythingYouCanSeeBothKinds", "നിങ്ങൾക്ക് കാണാവുന്നതെല്ലാം, രണ്ടു തരവും"),
  /** Advanced filters: the menu entry, the button when people are narrowed, and the sheet. */
  advancedFilters: t("advocate_customFilters", "ഇഷ്ടാനുസൃത ഫിൽട്ടറുകൾ"),
  /** Under the filters while any are hiding hearings in the sitting. */
  hiddenOne: t("advocate_1HearingHidden", "1 വിചാരണ മറച്ചു"),
  hiddenMany: t("advocate_nHearingsHidden", "{n} വിചാരണകൾ മറച്ചു"),
  showAllHearings: t("advocate_showAllHearings", "എല്ലാ വിചാരണകളും കാണിക്കുക"),
  /** The access button while people are left out: says how many, not just "custom". */
  excludedOne: t("advocate_1PersonExcluded", "1 വ്യക്തിയെ ഒഴിവാക്കി"),
  excludedMany: t("advocate_nPeopleExcluded", "{n} പേരെ ഒഴിവാക്കി"),
  /** The same on a phone, where the button is half the row. */
  excludedShort: t("advocate_nExcluded", "{n} ഒഴിവാക്കി"),
  customFilter: t("advocate_customFilters", "ഇഷ്ടാനുസൃത ഫിൽട്ടറുകൾ"),
  customBadge: t("advocate_on", "ഓൺ"),
  filtersTitle: t("advocate_filterHearings", "വിചാരണകൾ ഫിൽട്ടർ ചെയ്യുക"),
  filtersFor: t("advocate_forTheSittingSitting", "{sitting} സിറ്റിങ്ങിന്"),
  filtersAccess: t("advocate_byAccess", "ആക്സസ് അനുസരിച്ച്"),
  filtersPeopleHeading: t("advocate_byPeople", "ആളുകൾ അനുസരിച്ച്"),
  filtersPeople: t("advocate_colleagues", "സഹപ്രവർത്തകർ"),
  peopleMeAlwaysShort: t("advocate_alwaysIncluded", "എപ്പോഴും ഉൾപ്പെടും"),
  peopleClearAll: t("advocate_unselectEveryone", "എല്ലാവരെയും ഒഴിവാക്കുക"),
  filtersReset: t("advocate_reset", "പുനഃസജ്ജമാക്കുക"),
  findName: t("advocate_findAName", "പേര് തിരയുക"),
  noNames: t("advocate_noNamesMatch", "പൊരുത്തപ്പെടുന്ന പേരുകളില്ല."),
  filtersApply: t("advocate_showHearings", "വിചാരണകൾ കാണിക്കുക"),
  /** The access menu's people sub-menu, and the button's suffix when narrowed. */
  peopleSub: t("advocate_people", "ആളുകൾ"),
  peopleEveryoneShort: t("advocate_everyone", "എല്ലാവരും"),
  peopleOnlyMeShort: t("advocate_onlyMe", "ഞാൻ മാത്രം"),
  peopleMePlusShort: t("advocate_meN", "ഞാൻ + {n}"),
  /** The people menu's button. */
  peopleEveryone: t("advocate_everyoneSHearings", "എല്ലാവരുടെയും വിചാരണകൾ"),
  peopleOnlyMe: t("advocate_onlyMyHearings", "എന്റെ വിചാരണകൾ മാത്രം"),
  peopleMineOne: t("advocate_myHearings1Person", "എന്റെ വിചാരണകൾ + 1 ആൾ"),
  peopleMineMany: t("advocate_myHearingsNPeople", "എന്റെ വിചാരണകൾ + {n} പേർ"),
  /** The people menu's last row: tick every colleague. */
  peopleSelectAll: t("advocate_selectEveryone", "എല്ലാവരെയും തിരഞ്ഞെടുക്കുക"),
  peopleMeAlways: t("advocate_yourHearingsAlwaysShow", "നിങ്ങളുടെ വിചാരണകൾ എപ്പോഴും കാണിക്കും"),
  /** Accessible name of the whose-cases switch. */
  scopeSwitch: t("advocate_whoseHearings", "ആരുടെ വിചാരണകൾ"),
  emptyFilteredTitle: t("advocate_noHearingsMatchTheseFilters", "ഈ ഫിൽട്ടറുകൾക്ക് ചേരുന്ന ഹിയറിംഗുകളില്ല"),
  emptyFilteredBody: t(
    "advocate_changeThePeopleOrCourtsToSee",
    "കൂടുതൽ കാണാൻ ആളുകളെയോ കോടതികളെയോ മാറ്റുക.",
  ),
  /* Access button on each hearing and its popover. */
  accessVakalatnama: t("advocate_onVakalatnama", "വക്കാലത്തിൽ"),
  accessOffice: t("advocate_officeAccess", "ഓഫീസ് ആക്സസ്"),
  accessYou: t("advocate_you", "നിങ്ങൾ"),
  /** The queue tag on today's scheduled hearings: matters still before yours in court. */
  queueNext: t("advocate_upNext", "അടുത്തത്"),
  /* The tag says it in words (owner, 2026-10-14): "Up next", "1 before you". */
  queueTagAhead: t("advocate_nBeforeYou", "{n} മുമ്പ്"),
  queueAheadOne: t("advocate_1HearingBeforeYoursInThisCourt", "ഈ കോടതിയിൽ നിങ്ങളുടേതിന് മുമ്പ് 1 ഹിയറിങ്."),
  queueAheadMany: t("advocate_nHearingsBeforeYoursInThisCourt", "ഈ കോടതിയിൽ നിങ്ങളുടേതിന് മുമ്പ് {n} ഹിയറിങ്ങുകൾ."),
  queueIsNext: t("advocate_yoursIsNextInThisCourt", "ഈ കോടതിയിൽ അടുത്തത് നിങ്ങളുടേതാണ്."),
  accessMineLabel: t(
    "advocate_youReOnTheVakalatnamaSeeWho",
    "നിങ്ങൾ വക്കാലത്തിലുണ്ട്. മറ്റാരൊക്കെയെന്ന് കാണുക.",
  ),
  accessOfficeLabel: t(
    "advocate_youHaveOfficeAccessSeeWhoS",
    "നിങ്ങൾക്ക് ഓഫീസ് ആക്സസ് ഉണ്ട്. വക്കാലത്തിൽ ആരൊക്കെയെന്ന് കാണുക.",
  ),
  emptyCourtsTitle: t(
    "advocate_noHearingsInTheSelectedCourts",
    "തിരഞ്ഞെടുത്ത കോടതികളിൽ ഹിയറിംഗുകളില്ല",
  ),
  emptyCourtsBody: t(
    "advocate_nothingIsListedTodayInTheCourts",
    "നിങ്ങൾ തിരഞ്ഞെടുത്ത കോടതികളിൽ ഇന്ന് ഒന്നും പട്ടികയിലില്ല.",
  ),
} as const;

/* -------------------------------------------------------------- join stub page */

export const advJoinPage = {
  title: t("advocate_joinACase", "കേസിൽ ചേരുക"),
  body: t(
    "advocate_findACaseByItsNumberAnd",
    "കേസ് നമ്പർ ഉപയോഗിച്ച് കേസ് കണ്ടെത്തി അതിൽ പ്രവർത്തിക്കാൻ ആക്‌സസ് അഭ്യർത്ഥിക്കുക. സമൻസിലെ — അല്ലെങ്കിൽ കേസിൽ ഇതിനകം ചേർന്ന കക്ഷിയുടെ പക്കലുള്ള — ആറക്ക കോഡ് കൈയിൽ കരുതുക.",
  ),
  cta: t("advocate_joinACase", "കേസിൽ ചേരുക"),
  recentHeading: t("advocate_recentJoinRequests", "സമീപകാല അപേക്ഷകൾ"),
  statusJoined: t("advocate_joined", "ചേർന്നു"),
  statusPending: t("advocate_approvalPending", "അനുമതി ബാക്കി"),
} as const;

/* ----------------------------------------------------------------- join dialog */

export const advDialog = {
  title: t("advocate_joinACase", "കേസിൽ ചേരുക"),

  /* summons auto-modal (unique URL, advocate account) */
  summonsHeading: t(
    "advocate_reviewThisChequeBounceCase",
    "ഈ ചെക്ക് മടക്ക കേസ് പരിശോധിക്കുക",
  ),
  summonsBody: t(
    "advocate_thisSummonsWasSentToAParty",
    "ഈ കേസിലെ ഒരു കക്ഷിക്കാണ് ഈ സമൻസ് അയച്ചത്. വിവരങ്ങൾ പരിശോധിച്ച്, അവർക്ക് വേണ്ടി ഓൺലൈനായി പ്രവർത്തിക്കാൻ കേസിൽ ചേരുക.",
  ),

  /* lookup */
  lookupBody: t(
    "advocate_enterTheCaseNumberOrFilingNumber",
    "കേസ് നമ്പർ അല്ലെങ്കിൽ ഫയലിംഗ് നമ്പർ നൽകുക.",
  ),
  findAndJoin: t("advocate_findCaseAndJoin", "കേസ് കണ്ടെത്തി ചേരുക"),
  /* Closing partway through asks first (owner, 2026-10-13). Malayalam drafted. */
  leaveTitle: t("advocate_leaveWithoutJoining", "ചേരാതെ പുറത്തുകടക്കണോ?"),
  leaveBody: t(
    "advocate_whatYouHaveEnteredSoFarWill",
    "ഇതുവരെ നൽകിയ വിവരങ്ങൾ സൂക്ഷിക്കില്ല.",
  ),
  leaveStay: t("advocate_keepGoing", "തുടരുക"),
  leaveGo: t("advocate_leave", "പുറത്തുകടക്കുക"),
  lookupSandboxTip: t("advocate_sandboxWhoYouAreOnThisCase", "സാൻഡ്‌ബോക്സ്: ഈ കേസിൽ നിങ്ങൾ ആര്"),
  lookupSandboxLabel: t("advocate_forTheCaseYouLookUp", "നിങ്ങൾ തിരയുന്ന കേസിന്"),
  lookupSandboxNew: t("advocate_youAreNotOnItYet", "നിങ്ങൾ ഇതുവരെ ഇതിലില്ല"),
  lookupSandboxAdded: t(
    "advocate_anotherAdvocateAlreadyAddedYou",
    "മറ്റൊരു അഭിഭാഷകൻ നിങ്ങളെ ഇതിനകം ചേർത്തു",
  ),

  /* Already added: another advocate named this one on the vakalatnama and paid for
     everyone on it (owner, 2026-10-13). Malayalam drafted — needs review. */
  invitedTitle: t("advocate_youReAlreadyOnThisCase", "നിങ്ങൾ ഇതിനകം ഈ കേസിലുണ്ട്"),
  invitedBody: t(
    "advocate_nameNamedYouOnTheVakalatnamaAnd",
    "{name} വക്കാലത്തിൽ നിങ്ങളുടെ പേര് ചേർത്ത് ഫീസ് അടച്ചു; നിങ്ങൾക്ക് ക്ഷണം അയച്ചിട്ടുണ്ട്. ഒന്നും അപ്‌ലോഡ് ചെയ്യുകയോ അടയ്ക്കുകയോ വേണ്ട.",
  ),

  /* details */
  detailsBody: t(
    "advocate_checkThatThisIsTheCaseYou",
    "തുടരുന്നതിന് മുൻപ് നിങ്ങൾ ചേരുന്ന കേസ് ഇതാണെന്ന് ഉറപ്പാക്കുക.",
  ),

  /* profile used for this case */
  accountTitle: t("advocate_howAreYouJoiningThisCase", "ഈ കേസിൽ നിങ്ങൾ എങ്ങനെയാണ് ചേരുന്നത്?"),
  accountBody: t(
    "advocate_chooseTheProfileThatMatchesYourRole",
    "ഈ കേസിലെ നിങ്ങളുടെ പങ്കിന് അനുയോജ്യമായ പ്രൊഫൈൽ തിരഞ്ഞെടുക്കുക.",
  ),
  accountLabel: t("advocate_joinThisCaseAs", "ഈ കേസിൽ ചേരുന്നത്"),
  accountAdvocate: t("advocate_advocate", "അഭിഭാഷകൻ"),
  accountLitigant: t("advocate_litigant", "കക്ഷി"),
  accountPoa: t("advocate_poaHolder", "പവർ ഓഫ് അറ്റോർണി ഉടമ"),
  accountNote: t(
    "advocate_ifYouChooseLitigantOrPoaHolder",
    "കക്ഷി അല്ലെങ്കിൽ പവർ ഓഫ് അറ്റോർണി ഉടമ തിരഞ്ഞെടുക്കുകയാണെങ്കിൽ, തുടരുന്നതിന് മുൻപ് നിങ്ങളുടെ കക്ഷി പ്രൊഫൈലിലേക്ക് മാറും. പ്രൊഫൈൽ മെനുവിൽ നിന്ന് എപ്പോൾ വേണമെങ്കിലും പ്രൊഫൈൽ മാറ്റാം.",
  ),
  accountSwitchTitle: t("advocate_switchingToYourLitigantProfile", "നിങ്ങളുടെ കക്ഷി പ്രൊഫൈലിലേക്ക് മാറുന്നു"),
  accountSwitchBody: t(
    "advocate_weLlContinueThisCaseFromYour",
    "നിങ്ങളുടെ കക്ഷി ഹോമിൽ നിന്ന് ഈ കേസ് തുടരും.",
  ),
  accountSwitchStatus: t("advocate_switchingProfile", "പ്രൊഫൈൽ മാറ്റുന്നു…"),

  /* who you represent */
  roleBody: t(
    "advocate_tellUsWhoYouRepresentInThis",
    "ഈ കേസിൽ നിങ്ങൾ ആർക്ക് വേണ്ടിയാണ് ഹാജരാകുന്നതെന്ന് പറയുക.",
  ),
  sideLegend: t(
    "advocate_areYouRepresentingAComplainantOrAn",
    "പരാതിക്കാരനെയാണോ പ്രതിയെയാണോ നിങ്ങൾ പ്രതിനിധീകരിക്കുന്നത്?",
  ),
  sideComplainant: t("advocate_complainant", "പരാതിക്കാരൻ"),
  sideAccused: t("advocate_accused", "പ്രതി"),
  sideError: t("advocate_chooseWhichSideYouRepresent", "ഏത് ഭാഗത്തിന് വേണ്ടിയാണെന്ന് തിരഞ്ഞെടുക്കുക."),
  accusedAckNote: t(
    "advocate_byJoiningForTheAccusedYouConfirm",
    "പ്രതിക്ക് വേണ്ടി ചേരുന്നതിലൂടെ, സമൻസ് അവർക്ക് ലഭിച്ചു എന്ന് നിങ്ങൾ സ്ഥിരീകരിക്കുന്നു.",
  ),
  whichLegend: t(
    "advocate_whichLitigantSAreYouRepresenting",
    "ഏത് കക്ഷിക്ക് (കക്ഷികൾക്ക്) വേണ്ടിയാണ് നിങ്ങൾ ഹാജരാകുന്നത്?",
  ),
  whichPlaceholder: t("advocate_chooseLitigantS", "കക്ഷികളെ തിരഞ്ഞെടുക്കുക"),
  whichEmpty: t("advocate_noLitigantsFound", "കക്ഷികളെ കണ്ടെത്തിയില്ല."),
  whichError: t("advocate_chooseAtLeastOneLitigant", "കുറഞ്ഞത് ഒരു കക്ഷിയെ തിരഞ്ഞെടുക്കുക."),
  yes: t("advocate_yes", "അതെ"),
  no: t("advocate_no", "അല്ല"),

  /* enter litigant contact details (only for litigants not yet on the case) */
  verifyTitle: t("advocate_enterLitigantContactDetails", "കക്ഷിയുടെ ബന്ധപ്പെടാനുള്ള വിവരങ്ങൾ നൽകുക"),
  verifyBody: t(
    "advocate_weDonTHaveAMobileNumber",
    "ഈ കക്ഷികളുടെ മൊബൈൽ നമ്പർ ഞങ്ങളുടെ പക്കൽ ഇപ്പോൾ ഇല്ല. കേസ് അപ്‌ഡേറ്റുകൾ ലഭിക്കാനും കേസ് ഫയൽ തുറക്കാനും അത് നൽകുക.",
  ),
  contactAlreadyNote: t(
    "advocate_namesAlreadyJoinedThisCaseSoWe",
    "{names} ഇതിനകം ഈ കേസിൽ ചേർന്നു, അതിനാൽ അവരുടെ നമ്പർ ഞങ്ങളുടെ പക്കലുണ്ട്.",
  ),
  contactConfirmNote: t(
    "advocate_weLlTextEachNumberTheCase",
    "ഓരോ നമ്പറിലേക്കും SMS അയക്കും. കക്ഷി സൈൻ ഇൻ ചെയ്ത് അത് അവരാണെന്ന് സ്ഥിരീകരിച്ചാൽ കേസ് അവരുടെ അക്കൗണ്ടുമായി ബന്ധിപ്പിക്കും.",
  ),
  /* Per litigant: whose number this is, said on the field itself (owner, 2026-10-12). */
  contactMobileLabel: t("advocate_nameSMobileNumber", "{name}-ന്റെ മൊബൈൽ നമ്പർ"),
  contactMobileError: t(
    "advocate_enterAValid10DigitMobileNumber",
    "സാധുവായ 10 അക്ക മൊബൈൽ നമ്പർ നൽകുക.",
  ),

  /* vakalatnama */
  vkTitle: t("advocate_vakalatnama", "വക്കാലത്ത്"),
  vkBody: t(
    "advocate_attachTheVakalatnamaThatAuthorisesYouTo",
    "ഈ കക്ഷികൾക്ക് വേണ്ടി പ്രവർത്തിക്കാൻ അധികാരം നൽകുന്ന വക്കാലത്ത് ചേർക്കുക.",
  ),
  /* One question (team decision, owner 2026-10-13): is anyone else named on it? The
     first advocate adds the others and pays for everyone; the count comes from the
     advocates added. Malayalam drafted — needs review. */
  vkOthersLegend: t(
    "advocate_apartFromYouIsAnyoneElseNamed",
    "നിങ്ങളെ കൂടാതെ, ഈ വക്കാലത്തിൽ മറ്റാരുടെയെങ്കിലും പേരുണ്ടോ?",
  ),
  vkOthersNo: t("advocate_noOnlyMe", "ഇല്ല, ഞാൻ മാത്രം"),
  vkOthersYes: t("advocate_yesOtherAdvocatesToo", "ഉണ്ട്, മറ്റ് അഭിഭാഷകരും"),
  vkOthersError: t("advocate_chooseOne", "ഒന്ന് തിരഞ്ഞെടുക്കുക."),
  vkFeeNote: t(
    "advocate_youPayTheVakalatnamaFeeInThe",
    "അടുത്ത ഘട്ടത്തിൽ വക്കാലത്ത് ഫീസ് അടയ്ക്കണം ({amount}). ഫീസ് അടച്ചാൽ കേസിലേക്ക് ആക്‌സസ് ലഭിക്കും.",
  ),
  vkGroupFeeNote: t(
    "advocate_youPayForNAdvocatesInThe",
    "അടുത്ത ഘട്ടത്തിൽ {n} അഭിഭാഷകർക്കുള്ള ഫീസ് അടയ്ക്കണം ({amount}). മറ്റുള്ളവർക്ക് കേസിൽ ചേരാൻ ക്ഷണം ലഭിക്കും; അവർ വീണ്ടും അടയ്ക്കേണ്ടതില്ല.",
  ),
  /* How many are named, counting the person filling this in (owner, 2026-10-13). The
     others added must match it exactly before they can continue. Malayalam drafted —
     needs review. */
  /* Counts the others only (owner, 2026-10-14): "including you" read as "2 more than me"
     and the wrong number of names went in. */
  vkCountLabel: t(
    "advocate_howManyMoreAdvocatesAreNamedOn",
    "ഇതിൽ മറ്റ് എത്ര അഭിഭാഷകരുടെ പേര് കൂടിയുണ്ട്?",
  ),
  vkCountDecrease: t("advocate_oneFewerAdvocate", "ഒരു അഭിഭാഷകൻ കുറവ്"),
  vkCountIncrease: t("advocate_oneMoreAdvocate", "ഒരു അഭിഭാഷകൻ കൂടി"),
  vkCountError: t("advocate_enter1OrMore", "1 അല്ലെങ്കിൽ കൂടുതൽ നൽകുക."),
  vkAddProgress: t("advocate_addedOfNeededAdded", "{needed}-ൽ {added} ചേർത്തു"),
  /* Gujarat: the fee, plainly — its parts are on the payment step, and "the same however
     many" over-explained it (owner, 2026-10-14). */
  vkGujaratFeeNote: t(
    "advocate_youPayTheVakalatnamaFeeAmountIn",
    "അടുത്ത ഘട്ടത്തിൽ വക്കാലത്ത് ഫീസ് ({amount}) അടയ്ക്കണം. മറ്റുള്ളവർക്ക് കേസിൽ ചേരാൻ ക്ഷണം ലഭിക്കും.",
  ),
  vkGujaratSoloFeeNote: t(
    "advocate_youPayTheVakalatnamaFeeAmountIn_6e90e9ab",
    "അടുത്ത ഘട്ടത്തിൽ വക്കാലത്ത് ഫീസ് ({amount}) അടയ്ക്കണം.",
  ),
  payWelfare: t("advocate_advocateWelfareFund", "അഭിഭാഷക ക്ഷേമനിധി"),
  payStamp: t("advocate_courtFeeStamp", "കോടതി ഫീസ് സ്റ്റാമ്പ്"),
  vkTemplate: t("advocate_downloadVakalatnamaTemplate", "വക്കാലത്ത് മാതൃക ഡൗൺലോഡ് ചെയ്യുക"),
  vkFlatFeeNote: t(
    "advocate_youPayTheVakalatnamaFeeInThe_65188785",
    "അടുത്ത ഘട്ടത്തിൽ വക്കാലത്ത് ഫീസ് അടയ്ക്കണം ({amount}). എത്ര അഭിഭാഷകരുടെ പേരുണ്ടെങ്കിലും ഫീസ് ഇതുതന്നെ. മറ്റുള്ളവർക്ക് കേസിൽ ചേരാൻ ക്ഷണം ലഭിക്കും; അവർ അടയ്ക്കേണ്ടതില്ല.",
  ),
  vkAddLegend: t(
    "advocate_addTheOtherAdvocatesOnThisVakalatnama",
    "ഈ വക്കാലത്തിലെ മറ്റ് അഭിഭാഷകരെ ചേർക്കുക",
  ),
  vkInviteToast: t(
    "advocate_inviteToJoinTheCaseSentTo",
    "കേസിൽ ചേരാൻ {names} എന്നവർക്ക് ക്ഷണം അയച്ചു",
  ),
  vkAddFieldLabel: t("advocate_otherAdvocatesOnTheVakalatnama", "വക്കാലത്തിലെ മറ്റ് അഭിഭാഷകർ"),
  vkAddSuggested: t("advocate_advocatesYouOftenAdd", "നിങ്ങൾ പതിവായി ചേർക്കുന്ന അഭിഭാഷകർ"),
  vkAddNewNumber: t(
    "advocate_theyLlGetAnInviteToJoin",
    "കേസിൽ ചേരാൻ അവർക്ക് ക്ഷണം ലഭിക്കും.",
  ),
  vkAddKeepTyping: t(
    "advocate_noAdvocateYouVeAddedMatchesEnter",
    "നിങ്ങൾ ചേർത്ത അഭിഭാഷകരിൽ ആരും പൊരുത്തപ്പെടുന്നില്ല. അവരുടെ മൊബൈൽ നമ്പർ അല്ലെങ്കിൽ ബാർ ഐഡി മുഴുവൻ നൽകുക.",
  ),
  vkAddHelp: t(
    "advocate_onlyAdvocatesRegisteredOnThePlatformCan",
    "പ്ലാറ്റ്‌ഫോമിൽ രജിസ്റ്റർ ചെയ്ത അഭിഭാഷകരെ മാത്രമേ ചേർക്കാനാകൂ.",
  ),
  vkAddErrorOne: t(
    "advocate_addExactly1OtherAdvocateToMatch",
    "മുകളിലെ എണ്ണവുമായി യോജിക്കാൻ കൃത്യം 1 അഭിഭാഷകനെ കൂടി ചേർക്കുക.",
  ),
  vkAddErrorMany: t(
    "advocate_addExactlyNOtherAdvocatesToMatch",
    "മുകളിലെ എണ്ണവുമായി യോജിക്കാൻ കൃത്യം {n} അഭിഭാഷകരെ കൂടി ചേർക്കുക.",
  ),
  vkSearchLabel: t(
    "advocate_searchYourGeneratedVakalatnamas",
    "തയ്യാറാക്കിയ വക്കാലത്തുകൾ തിരയുക",
  ),
  vkSearchPlaceholder: t(
    "advocate_searchByNameOrLitigant",
    "പേര് അല്ലെങ്കിൽ കക്ഷി ഉപയോഗിച്ച് തിരയുക",
  ),
  vkSearchEmpty: t(
    "advocate_noVakalatnamasMatchYourSearch",
    "നിങ്ങളുടെ തിരയലുമായി പൊരുത്തപ്പെടുന്ന വക്കാലത്തുകളില്ല.",
  ),
  vkDocLabel: t("advocate_vakalatnama", "വക്കാലത്ത്"),
  vkDocHelp: t(
    "advocate_uploadAJpgJpegPngOrPdf",
    "10 MB വരെ വലുപ്പമുള്ള JPG, JPEG, PNG അല്ലെങ്കിൽ PDF അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  vkAttachError: t(
    "advocate_uploadTheVakalatnamaBeforeContinuing",
    "തുടരുന്നതിന് മുൻപ് വക്കാലത്ത് അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  preview: t("advocate_preview", "പ്രിവ്യൂ"),
  changeFile: t("advocate_changeFile", "ഫയൽ മാറ്റുക"),
  removeFile: t("advocate_remove", "നീക്കം ചെയ്യുക"),
  docPreviewTitle: t("advocate_documentPreview", "രേഖയുടെ പ്രിവ്യൂ"),
  docPreviewBody: t(
    "advocate_checkTheUploadedDocumentBeforeContinuing",
    "തുടരുന്നതിന് മുൻപ് അപ്‌ലോഡ് ചെയ്ത രേഖ പരിശോധിക്കുക.",
  ),
  docPreviewAlt: t(
    "advocate_previewOfTheUploadedDocument",
    "അപ്‌ലോഡ് ചെയ്ത രേഖയുടെ പ്രിവ്യൂ",
  ),
  previewTitle: t("advocate_vakalatnamaPreview", "വക്കാലത്ത് പ്രിവ്യൂ"),
  previewBody: t(
    "advocate_checkThatThisIsTheRightVakalatnama",
    "തിരഞ്ഞെടുക്കുന്നതിന് മുൻപ് ഇത് ശരിയായ വക്കാലത്താണെന്ന് ഉറപ്പാക്കുക.",
  ),
  generatedOn: t("advocate_generatedOn", "തയ്യാറാക്കിയ തീയതി"),
  advocatesLabel: t("advocate_advocates", "അഭിഭാഷകർ"),
  partiesLabel: t("advocate_litigants", "കക്ഷികൾ"),
  advocatesCount: t("advocate_countAdvocates", "{count} അഭിഭാഷകർ"),

  /* payment — inside the flow; access waits for it (JOIN-54) */
  payTitle: t("advocate_payTheVakalatnamaFee", "വക്കാലത്ത് ഫീസ് അടയ്ക്കുക"),
  payBody: t(
    "advocate_youGetAccessToTheCaseOnce",
    "ഫീസ് അടച്ചാൽ കേസിലേക്ക് ആക്‌സസ് ലഭിക്കും.",
  ),
  payFeeHead: t("advocate_fee", "ഫീസ്"),
  payFeeName: t("advocate_vakalatnamaFee", "വക്കാലത്ത് ഫീസ്"),
  payCase: t("advocate_case", "കേസ്"),
  payAmount: t("advocate_amount", "തുക"),
  payOutcomeLabel: t("advocate_sandboxGatewayResult", "സാൻഡ്‌ബോക്സ് ഗേറ്റ്‌വേ ഫലം"),
  paySandboxTip: t("advocate_sandboxChooseTheGatewayResult", "സാൻഡ്‌ബോക്സ്: ഗേറ്റ്‌വേ ഫലം തിരഞ്ഞെടുക്കുക"),
  payOutcomeSuccess: t("advocate_success", "വിജയം"),
  payOutcomeFailed: t("advocate_failed", "പരാജയപ്പെട്ടു"),
  paySandboxNote: t("advocate_sandboxPaymentNoMoneyMoves", "സാൻഡ്‌ബോക്സ് പേയ്‌മെന്റ് — പണം കൈമാറുന്നില്ല."),
  payFailed: t(
    "advocate_thePaymentDidNotGoThroughNothing",
    "പേയ്‌മെന്റ് നടന്നില്ല. ഒന്നും അടച്ചിട്ടില്ല; വീണ്ടും ശ്രമിക്കുക.",
  ),
  payNow: t("advocate_payAmount", "{amount} അടയ്ക്കുക"),
  payLater: t("advocate_payLater", "പിന്നീട് അടയ്ക്കാം"),
  /* The gateway round trip, as e-filing shows it. Malayalam drafted — needs review. */
  payProcessingTitle: t("advocate_processingPayment", "പേയ്‌മെന്റ് പ്രോസസ്സ് ചെയ്യുന്നു…"),
  payProcessingBody: t(
    "advocate_pleaseDonTCloseOrRefreshThis",
    "പേയ്‌മെന്റ് സ്ഥിരീകരിക്കുന്നതുവരെ ഈ വിൻഡോ അടയ്ക്കുകയോ റിഫ്രഷ് ചെയ്യുകയോ ചെയ്യരുത്.",
  ),
  paidTitle: t("advocate_paymentSuccessful", "പേയ്‌മെന്റ് വിജയകരം"),
  paidBody: t(
    "advocate_theVakalatnamaFeeIsPaidYouNow",
    "വക്കാലത്ത് ഫീസ് അടച്ചു. ഇപ്പോൾ കേസിലേക്ക് ആക്‌സസ് ഉണ്ട്.",
  ),
  paidAmount: t("advocate_amountPaid", "അടച്ച തുക"),
  paidRef: t("advocate_paymentReference", "പേയ്‌മെന്റ് റഫറൻസ്"),

  /* outcomes */
  unpaidTitle: t("advocate_payTheFeeToGetAccess", "ആക്‌സസ് ലഭിക്കാൻ ഫീസ് അടയ്ക്കുക"),
  unpaidBody: t(
    "advocate_yourVakalatnamaIsUploadedPayingTheVakalatnama",
    "നിങ്ങളുടെ വക്കാലത്ത് അപ്‌ലോഡ് ചെയ്തു. വക്കാലത്ത് ഫീസ് അടയ്ക്കൽ ഇപ്പോൾ നിങ്ങളുടെ ബാക്കിയുള്ള ജോലികളിലുണ്ട് — ഫീസ് അടച്ചാൽ കേസിലേക്ക് ആക്‌സസ് ലഭിക്കും.",
  ),
  joinedTitle: t("advocate_youHaveJoinedThisCase", "നിങ്ങൾ ഈ കേസിൽ ചേർന്നു"),
  joinedBody: t(
    "advocate_youCanNowActForTheLitigant",
    "ഇനി ഈ കേസിൽ കക്ഷിക്ക് (കക്ഷികൾക്ക്) വേണ്ടി പ്രവർത്തിക്കാം.",
  ),
  /* The settled band on the joined case (Oct 6). Malayalam drafted — needs review. */
  joinedBand: t("advocate_joinedRepresentingNames", "ചേർന്നു · {names}-നെ പ്രതിനിധീകരിക്കുന്നു"),
  viewCaseFile: t("advocate_viewCaseFile", "കേസ് ഫയൽ കാണുക"),
  prototypeCaseFile: t(
    "advocate_thisActionWillOpenTheCaseFile",
    "ഈ പ്രവർത്തനം കേസ് ഫയൽ തുറക്കും.",
  ),

  bailOpening: t("advocate_openingTheBailApplication", "ജാമ്യാപേക്ഷ തുറക്കുന്നു…"),

  /* add subordinates on the success screen */
  teamTitle: t("advocate_addYourTeam", "നിങ്ങളുടെ ടീമിനെ ചേർക്കുക"),
  teamOptional: t("advocate_optional", "നിർബന്ധമല്ല"),
  teamBody: t(
    "advocate_givePeopleInYourOfficeOrAny",
    "നിങ്ങളുടെ ഓഫീസിലുള്ളവർക്കോ രജിസ്റ്റർ ചെയ്ത ഏതൊരു അഭിഭാഷകനോ ക്ലർക്കിനോ ഈ കേസിലേക്ക് ആക്‌സസ് നൽകുക. അവർക്ക് ഓഫീസ് ആക്‌സസ് ലഭിക്കും: കേസിൽ പ്രവർത്തിക്കാം, പക്ഷേ വക്കാലത്ത്നാമയിൽ ഉണ്ടാകില്ല, ഇ-സൈൻ ചെയ്യാനാകില്ല.",
  ),
  teamPlaceholder: t("advocate_mobileNumber", "മൊബൈൽ നമ്പർ"),
  teamAdd: t("advocate_addNumber", "നമ്പർ ചേർക്കുക"),
  teamSendInvite: t("advocate_giveAccess", "ആക്‌സസ് നൽകുക"),
  teamRemove: t("advocate_remove", "നീക്കം ചെയ്യുക"),
  teamError: t("advocate_enterAValid10DigitMobileNumber", "സാധുവായ 10 അക്ക മൊബൈൽ നമ്പർ നൽകുക."),
  teamAddedNote: t(
    "advocate_theyGetAccessAtOnceAndAre",
    "അവർക്ക് ഉടൻ ആക്‌സസ് ലഭിക്കും, SMS വഴിയും DRISTI-യിലും അറിയിപ്പ് ലഭിക്കും.",
  ),
  teamInviteSentNote: t("advocate_accessGivenTo", "ഇവർക്ക് ആക്‌സസ് നൽകി"),
  viewCaseFileWithTeam: t("advocate_addMembersAndViewCaseFile", "അംഗങ്ങളെ ചേർത്ത് കേസ് ഫയൽ കാണുക"),

  /* notifications */
  notifJoinedTitle: t("advocate_youJoinedCasenumber", "{caseNumber} കേസിൽ ചേർന്നു"),
  notifJoinedBody: t(
    "advocate_youCanNowActForNamesIn",
    "ഇനി ഈ കേസിൽ {names}-ന് വേണ്ടി പ്രവർത്തിക്കാം.",
  ),
  notifRequestTitle: t(
    "advocate_joinRequestSentForCasenumber",
    "{caseNumber} കേസിൽ ചേരാനുള്ള അപേക്ഷ അയച്ചു",
  ),
  notifRequestBody: t(
    "advocate_youWillBeToldBySmsWhen",
    "തീരുമാനമാകുമ്പോൾ SMS വഴി അറിയിക്കും.",
  ),
} as const;

/* ------------------------------------------------------- new advocate: shell home */

/**
 * A just-registered advocate's home (owner, 2026-10-14): the litigant shell's shape,
 * in an advocate's words. Malayalam drafted — needs review.
 */
export const advShellHome = {
  welcome: t("advocate_welcomeAdvName", "സ്വാഗതം, അഡ്വ. {name}"),
  casesHeading: t("advocate_yourCases", "നിങ്ങളുടെ കേസുകൾ"),
  casesEmpty: t(
    "advocate_casesYouJoinOrFileWillAppear",
    "നിങ്ങൾ ചേരുന്നതോ ഫയൽ ചെയ്യുന്നതോ ആയ കേസുകൾ അവയുടെ വാദം സഹിതം ഇവിടെ കാണാം.",
  ),
  joinTitle: t("advocate_joinACase", "കേസിൽ ചേരുക"),
  joinBody: t(
    "advocate_appearingInACaseAlreadyInCourt",
    "ഇതിനകം കോടതിയിലുള്ള കേസിൽ ഹാജരാകുന്നുണ്ടോ? കേസ് നമ്പറും സമൻസിലെ ആക്‌സസ് കോഡും ഉപയോഗിച്ച് കണ്ടെത്തുക.",
  ),
  joinAction: t("advocate_joinACase", "കേസിൽ ചേരുക"),
  fileTitle: t("advocate_fileANewCase", "പുതിയ കേസ് ഫയൽ ചെയ്യുക"),
  fileBody: t(
    "advocate_startAChequeBounceComplaintForYour",
    "നിങ്ങളുടെ കക്ഷിക്കായി ചെക്ക് മടക്ക പരാതി ആരംഭിച്ച് ഫയലിംഗ് മുതൽ വിധി വരെ പിന്തുടരുക.",
  ),
  fileAction: t("advocate_fileACase", "കേസ് ഫയൽ ചെയ്യുക"),
  statusJoined: t("advocate_joined", "ചേർന്നു"),
  statusUnpaid: t("advocate_feeToPay", "ഫീസ് അടയ്ക്കാനുണ്ട്"),
  caseNumberLabel: t("advocate_caseNumber", "കേസ് നമ്പർ"),
  hearingLabel: t("advocate_nextHearing", "അടുത്ത വാദം"),
  viewCase: t("advocate_viewCase", "കേസ് കാണുക"),
};
