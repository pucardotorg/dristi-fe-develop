/**
 * Accused onboarding — content model.
 *
 * Three channels, three jobs (see "Onboarding — content allocation"):
 *   left column — the gist. What you must know to decide whether to act. ~70 words a step.
 *   video       — context and reassurance. Why this happened, what normally happens.
 *   help panel  — reference. The answer to a question you actually have. Opt-in.
 *
 * Placement rule: needed to act → left. Needed to feel less afraid → video. Needed only
 * if you wonder → help. One exception: anything carrying a deadline or a cost stays in
 * the left column even when the video covers it, because a person on a metered
 * connection must not be able to miss it.
 *
 * Universal content, case data injected into slots. Every slot has a fallback so the
 * flow survives a missing or expired token, a case not yet in CIS, and the login
 * screen's "Seek help" entry, which carries no case context at all.
 *
 * Copy: sentence case (DS Law). Reconciled against Summons_v14.
 */

import { translateMessage } from "@/i18n/messages";
import { LANGUAGE_NAME, SECOND_LANGUAGE } from "@/lib/locale-config";

export type Locale = "en" | "ml" | "hi" | "gu" | "pa";

/** English, and the deployment's second language (`lib/locale-config.ts`). */
export const LOCALES: { value: Locale; label: string }[] = [
  { value: "en", label: LANGUAGE_NAME.en },
  { value: SECOND_LANGUAGE, label: LANGUAGE_NAME[SECOND_LANGUAGE] },
];

export type CaseSummary = {
  accusedName?: string;
  caseNumber?: string;
  cnr?: string;
  court?: string;
  courtAddress?: string;
  hearingDate?: string;
  complainant?: string;
  chequeAmount?: string;
  chequeNumber?: string;
};

export type StepId = "papers" | "choices" | "date" | "help" | "join";

export const STEP_ORDER: StepId[] = [
  "papers",
  "choices",
  "date",
  "help",
  "join",
];

/** `en` is a catalog key; Malayalam remains inline until its own catalog is added. */
export type Copy = { en: string; ml?: string; hi?: string };
const t = (en: string, ml: string, hi?: string): Copy => (hi ? { en, ml, hi } : { en, ml });

export const stepTitles: Record<StepId, Copy> = {
  papers: t("onboarding_yourPapers", "നിങ്ങളുടെ രേഖകൾ"),
  choices: t("onboarding_yourChoices", "നിങ്ങളുടെ വഴികൾ"),
  date: t("onboarding_yourDate", "നിങ്ങളുടെ തീയതി"),
  help: t("onboarding_getHelp", "സഹായം"),
  join: t("onboarding_join", "ചേരുക"),
};

export const ui = {
  readLater: t("onboarding_readThisLater", "പിന്നീട് വായിക്കാം"),
  close: t("onboarding_close", "അടയ്ക്കുക"),
  proceed: t("onboarding_proceed", "തുടരുക"),
  back: t("onboarding_back", "പുറകോട്ട്"),
  language: t("onboarding_language", "ഭാഷ"),
  helpTitle: t("onboarding_commonQuestions", "പതിവ് ചോദ്യങ്ങൾ"),
  videoUnavailable: t(
    "onboarding_videoWillPlayHere",
    "വീഡിയോ ഇവിടെ വരും.",
  ),
  notMe: t("onboarding_thisIsNotAboutMe", "ഇത് എന്നെക്കുറിച്ചല്ല"),
  notMeBody: t(
    "onboarding_doNotJoinThisCaseCallThe",
    "ഈ കേസിൽ ചേരരുത്. 0000 000000 എന്ന നമ്പറിൽ കോടതിയെ വിളിച്ച് സമൻസ് തെറ്റായ ആൾക്ക് എത്തിയെന്ന് അറിയിക്കുക.",
  ),
  missingCase: t("onboarding_weCouldNotLoadYourCase", "കേസ് കാണാൻ കഴിഞ്ഞില്ല"),
  missingCaseBody: t(
    "onboarding_yourCaseNumberAndHearingDateAre",
    "കേസ് നമ്പറും ഹിയറിംഗ് തീയതിയും സമൻസിൽ ഉണ്ട്.",
  ),
} satisfies Record<string, Copy>;

export const summaryFields: {
  key: keyof CaseSummary;
  label: Copy;
  fallback: Copy;
}[] = [
  {
    key: "caseNumber",
    label: t("onboarding_caseNumber", "കേസ് നമ്പർ"),
    fallback: t("onboarding_onYourSummons", "സമൻസിൽ"),
  },
  {
    key: "complainant",
    label: t("onboarding_filedBy", "പരാതി നൽകിയത്"),
    fallback: t("onboarding_onYourSummons", "സമൻസിൽ"),
  },
  {
    key: "chequeAmount",
    label: t("onboarding_amountClaimed", "ആവശ്യപ്പെടുന്ന തുക"),
    fallback: t("onboarding_onYourSummons", "സമൻസിൽ"),
  },
  {
    key: "chequeNumber",
    label: t("onboarding_chequeNumber", "ചെക്ക് നമ്പർ"),
    fallback: t("onboarding_onYourSummons", "സമൻസിൽ"),
  },
];

/* -------------------------------------------------------- 1 · papers (55 w) */

export const papers = {
  heading: t(
    "onboarding_youHaveReceivedASummonsInA",
    "ചെക്ക് മടങ്ങിയ കേസിൽ നിങ്ങൾക്ക് സമൻസ് ലഭിച്ചു",
  ),
  body: t(
    "onboarding_theComplainantSaysYourChequeWasReturned",
    "നിങ്ങളുടെ ചെക്ക് പണമില്ലാതെ മടങ്ങിയെന്നും നോട്ടീസിന് ശേഷവും പണം നൽകിയില്ലെന്നും പരാതിക്കാരൻ പറയുന്നു. കോടതി കേസ് കേൾക്കും.",
  ),
  reassurance: t(
    "onboarding_thisSummonsDoesNotMeanYouAre",
    "ഈ സമൻസ് നിങ്ങൾ കുറ്റക്കാരനാണെന്ന് അർത്ഥമാക്കുന്നില്ല. നിങ്ങളുടെ ഭാഗം ഇനിയും കേട്ടിട്ടില്ല.",
  ),
  originalSummons: t("onboarding_viewTheOriginalSummons", "യഥാർത്ഥ സമൻസ് കാണുക"),
};

/* ------------------------------------------------------- 2 · choices (88 w) */

export const choices = {
  heading: t("onboarding_youHaveThreeWaysForward", "നിങ്ങൾക്ക് മൂന്ന് വഴികളുണ്ട്"),
  intro: t(
    "onboarding_twoOfTheseEndTheCaseWithout",
    "ഇതിൽ രണ്ടെണ്ണം വിചാരണയില്ലാതെ കേസ് അവസാനിപ്പിക്കും.",
  ),
  cards: [
    {
      id: "pay",
      title: t("onboarding_payTheChequeAmount", "ചെക്ക് തുക അടയ്ക്കുക"),
      summary: t(
        "onboarding_theFastestWayToEndItAnd",
        "ഏറ്റവും വേഗമുള്ള വഴി. നേരത്തെ ചെയ്താൽ ഏറ്റവും ചെലവ് കുറഞ്ഞതും.",
      ),
      detail: t(
        "onboarding_payTheCourtDirectlyOrPayThe",
        "കോടതിയിൽ നേരിട്ട് അടയ്ക്കാം, അല്ലെങ്കിൽ പരാതിക്കാരന് നൽകി രസീത് അപ്‌ലോഡ് ചെയ്യാം. അവരുടെ സമ്മതത്തോടെ കേസ് കുറ്റവിമുക്തിയായി അവസാനിക്കും, ശിക്ഷയല്ല.",
      ),
      /* A cost warning, so it stays in the left column rather than the help panel. */
      note: t(
        "onboarding_theCourtWillNeverAskYouTo",
        "സന്ദേശത്തിലെ ലിങ്ക് വഴിയോ വ്യക്തിഗത അക്കൗണ്ടിലേക്കോ പണം അടയ്ക്കാൻ കോടതി ഒരിക്കലും ആവശ്യപ്പെടില്ല.",
      ),
      noteTone: "info" as const,
    },
    {
      id: "settle",
      title: t("onboarding_settle", "ഒത്തുതീർപ്പാക്കുക"),
      summary: t(
        "onboarding_payLessOrOverTimeOrAsk",
        "കുറഞ്ഞ തുക, അല്ലെങ്കിൽ ഗഡുക്കളായി. അല്ലെങ്കിൽ ലോക് അദാലത്തോ മധ്യസ്ഥതയോ ചോദിക്കാം. രണ്ടും സൗജന്യം.",
      ),
      detail: t(
        "onboarding_theComplainantSLawyerIsNamedOn",
        "പരാതിക്കാരന്റെ അഭിഭാഷകന്റെ പേര് സമൻസിൽ ഉണ്ട്. അവരോട് സംസാരിക്കാൻ സമയം വേണമെങ്കിൽ കോടതിയോട് ചോദിക്കാം.",
      ),
    },
    {
      id: "contest",
      title: t("onboarding_contestTheCase", "കേസ് എതിർക്കുക"),
      summary: t(
        "onboarding_withALawyerOrOnYourOwn",
        "അഭിഭാഷകൻ മുഖേനയോ സ്വയമോ. വിധിക്ക് മുൻപേ ഇതിന് ഒരു ചെലവുണ്ട്.",
      ),
      detail: t(
        "onboarding_atTheHearingYouCanReplyTo",
        "ഹിയറിംഗിൽ പരാതിക്ക് മറുപടി നൽകാം, പരാതിക്കാരനോട് ചോദ്യം ചോദിക്കാം.",
      ),
      note: t(
        "onboarding_ifYouPleadNotGuiltyTheCourt",
        "കുറ്റം സമ്മതിക്കുന്നില്ലെങ്കിൽ, കേസ് നടക്കുമ്പോൾ ചെക്ക് തുകയുടെ 20% വരെ കെട്ടിവയ്ക്കാൻ കോടതി ഉത്തരവിട്ടേക്കാം. കുറ്റവിമുക്തനായാൽ പലിശ സഹിതം തിരികെ ലഭിക്കും.",
      ),
      noteTone: "warning" as const,
    },
  ],
};

/* ---------------------------------------------------------- 3 · date (52 w) */

export const dateStep = {
  heading: t("onboarding_whenAndWhereYouMustAppear", "എപ്പോൾ, എവിടെ ഹാജരാകണം"),
  dateLabel: t("onboarding_yourHearingDate", "ഹിയറിംഗ് തീയതി"),
  noDate: t("onboarding_onYourSummons", "സമൻസിൽ ഉണ്ട്"),
  attendBody: t(
    "onboarding_comeInPersonSendYourLawyerOr",
    "നേരിട്ട് വരാം, അഭിഭാഷകനെ അയക്കാം, അല്ലെങ്കിൽ വീഡിയോ വഴി ചേരാം.",
  ),
  cantCome: t(
    "onboarding_cannotMakeItAskTheCourtFor",
    "വരാൻ കഴിയില്ലേ? അതിന് മുൻപ് കോടതിയോട് പുതിയ തീയതി ചോദിക്കുക. വെറുതെ വിട്ടുനിൽക്കരുത്.",
  ),
};

/* ---------------------------------------------------------- 4 · help (48 w) */

export const help = {
  heading: t(
    "onboarding_youMayBeAbleToGetA",
    "സൗജന്യമായി അഭിഭാഷകനെ ലഭിച്ചേക്കാം",
  ),
  body: t(
    "onboarding_womenAndChildrenQualifyWhateverTheyEarn",
    "സ്ത്രീകൾക്കും കുട്ടികൾക്കും വരുമാനം എത്രയായാലും ലഭിക്കും. വർഷം ₹3,00,000-ൽ താഴെ വരുമാനമുള്ള ആർക്കും ലഭിക്കും.",
  ),
  proofNote: t(
    "onboarding_yourOwnSignedStatementOfIncomeIs",
    "നിങ്ങളുടെ സ്വന്തം വരുമാന സത്യവാങ്മൂലം മതി. സർട്ടിഫിക്കറ്റ് വേണ്ട.",
  ),
  primary: {
    name: t(
      "onboarding_districtLegalServicesAuthority",
      "ജില്ലാ ലീഗൽ സർവീസസ് അതോറിറ്റി",
    ),
    detail: t(
      "onboarding_askAboutFreeLegalAdviceOrRepresentation",
      "സൗജന്യ നിയമോപദേശമോ കോടതിയിലെ പ്രതിനിധാനമോ ചോദിക്കാം. നിങ്ങൾക്ക് അർഹതയുണ്ടെങ്കിൽ അപേക്ഷിക്കാൻ DLSA സഹായിക്കുകയും ഒരു അഭിഭാഷകനെ നിയോഗിക്കുകയും ചെയ്തേക്കാം.",
    ),
    href: "tel:0000000000",
    linkLabel: t("0000 000 000", "0000 000 000"),
  },
};

/* ---------------------------------------------------------- 5 · join (34 w) */

export const join = {
  heading: t(
    "onboarding_joinYourCaseByLoggingInOr",
    "ലോഗിൻ ചെയ്തോ രജിസ്റ്റർ ചെയ്തോ കേസിൽ ചേരുക",
  ),
  body: t(
    "onboarding_signInToReadTheFullComplaint",
    "പൂർണ്ണ പരാതി വായിക്കാനും, പണം അടയ്ക്കാനും, പുതിയ തീയതി ചോദിക്കാനും, ജാമ്യത്തിന് അപേക്ഷിക്കാനും, അഭിഭാഷകനെ ചേർക്കാനും സൈൻ ഇൻ ചെയ്യുക.",
  ),
  safety: t(
    "onboarding_yourAccessCodeIsOnYourSummons",
    "നിങ്ങളുടെ ആക്‌സസ് കോഡ് സമൻസിൽ ഉണ്ട്. അഭിഭാഷകനുമായി മാത്രം പങ്കിടുക.",
  ),
  cta: t("onboarding_continueToSignIn", "സൈൻ ഇൻ ചെയ്യാൻ തുടരുക"),
};

/* ------------------------------------------------- right column: help panel */

export type HelpEntry = {
  q: Copy;
  a: Copy;
  links?: { label: Copy; href: string }[];
};

/** Reference. Absorbs everything the left column no longer carries. */
export const helpPanel: Record<StepId, HelpEntry[]> = {
  papers: [
    {
      q: t("onboarding_isThisAPoliceCase", "ഇത് പോലീസ് കേസാണോ?"),
      a: t(
        "onboarding_noAPrivatePersonOrCompanyFiled",
        "അല്ല. ഒരു സ്വകാര്യ വ്യക്തിയോ സ്ഥാപനമോ ആണ് പരാതി നൽകിയത്. പോലീസ് രേഖകൾ എത്തിച്ചു എന്ന് മാത്രം; അവർ ഇടപെടുന്ന ഒരേയൊരു ഘട്ടം ഇതാണ്.",
      ),
    },
    {
      q: t("onboarding_whatLawIsThisUnder", "ഇത് ഏത് നിയമപ്രകാരമാണ്?"),
      a: t(
        "onboarding_section138OfTheNegotiableInstrumentsAct",
        "നെഗോഷ്യബിൾ ഇൻസ്ട്രുമെന്റ്സ് ആക്ട് 1881-ലെ 138-ാം വകുപ്പ്. വിവരങ്ങൾ തിരയാനോ അഭിഭാഷകനോട് സംസാരിക്കാനോ ഇത് അറിയുന്നത് നല്ലതാണ്.",
      ),
    },
    {
      q: t("onboarding_whatHappensAtTheFirstHearing", "ആദ്യ ഹിയറിംഗിൽ എന്ത് നടക്കും?"),
      a: t(
        "onboarding_theJudgeAsksWhetherTheChequeIs",
        "ചെക്ക് നിങ്ങളുടെ അക്കൗണ്ടിലേതാണോ, ഒപ്പ് നിങ്ങളുടേതാണോ, പരാതിക്കാരന് നിങ്ങൾ അത് നൽകിയോ, അവർക്ക് കടപ്പെട്ടിരുന്നോ, നിഷേധിക്കുന്നെങ്കിൽ വാദം എന്ത്, ഇപ്പോൾ ഒത്തുതീർപ്പ് വേണോ എന്നിവ ജഡ്ജി ചോദിക്കും.",
      ),
    },
    {
      q: t("onboarding_doesThisMeanIAmGuilty", "ഇതിനർത്ഥം ഞാൻ കുറ്റക്കാരനാണോ?"),
      a: t(
        "onboarding_noTheMagistrateHasOnlyDecidedThere",
        "അല്ല. കേസ് കേൾക്കാൻ മതിയായ കാരണമുണ്ടെന്ന് മാത്രമാണ് മജിസ്‌ട്രേറ്റ് തീരുമാനിച്ചത്.",
      ),
    },
  ],
  choices: [
    {
      q: t("onboarding_doesSettlingEarlyCostLess", "നേരത്തെ ഒത്തുതീർത്താൽ ചെലവ് കുറയുമോ?"),
      a: t(
        "onboarding_yesPayingTheChequeAmountBeforeThe",
        "അതെ. പ്രതിഭാഗം തെളിവ് ഘട്ടത്തിന് മുൻപ് ചെക്ക് തുക അടച്ചാൽ ഒട്ടും അധിക ചെലവില്ല. അതിനുശേഷം 5%, അപ്പീലിൽ 7.5%, സുപ്രീം കോടതിയിൽ 10%.",
      ),
    },
    {
      q: t("onboarding_whatIsALokAdalat", "ലോക് അദാലത്ത് എന്നാൽ എന്ത്?"),
      a: t(
        "onboarding_aSettlementSittingRunByTheLegal",
        "ലീഗൽ സർവീസസ് അതോറിറ്റി നടത്തുന്ന ഒത്തുതീർപ്പ് സഭ. ഇരുകക്ഷികളും സമ്മതിച്ചാൽ കേസ് അവിടെ അവസാനിക്കും. തീരുമാനം അന്തിമമാണ്, അപ്പീൽ ഇല്ല, കോടതി ഫീസ് തിരികെ കിട്ടും.",
      ),
    },
    {
      q: t("onboarding_whatIsMediation", "മധ്യസ്ഥത എന്നാൽ എന്ത്?"),
      a: t(
        "onboarding_aTrainedNeutralPersonHelpsYouAnd",
        "പരിശീലനം ലഭിച്ച നിഷ്പക്ഷ വ്യക്തി നിങ്ങളെയും പരാതിക്കാരനെയും ധാരണയിലെത്താൻ സഹായിക്കുന്നു. സൗജന്യം, കോടതി നടത്തുന്നത്. ഒന്നും അടിച്ചേൽപ്പിക്കില്ല. ഇരുവരും സമ്മതിക്കണം.",
      ),
    },
    {
      q: t("onboarding_whatCountsAsADefence", "എന്തൊക്കെ വാദമായി കണക്കാക്കും?"),
      a: t(
        "onboarding_thatTheChequeWasGivenOnlyAs",
        "ചെക്ക് സെക്യൂരിറ്റിയായി മാത്രം നൽകിയതാണ്, കടം നേരത്തെ വീട്ടി, അല്ലെങ്കിൽ ചെക്കിൽ മാറ്റം വരുത്തി ദുരുപയോഗം ചെയ്തു എന്നിവ. ഒപ്പിട്ട് നൽകിയ ഒഴിഞ്ഞ ചെക്കും നിങ്ങൾക്ക് എതിരായി കണക്കാക്കും.",
      ),
    },
    {
      q: t("onboarding_whoHasToProveWhat", "ആരാണ് എന്ത് തെളിയിക്കേണ്ടത്?"),
      a: t(
        "onboarding_theLawBeginsByAssumingTheCheque",
        "കടം വീട്ടാനാണ് ചെക്ക് നൽകിയത് എന്ന് നിയമം ആദ്യം അനുമാനിക്കുന്നു. അല്ലെന്ന് കാണിക്കേണ്ടത് നിങ്ങളാണ്; വെറും നിഷേധം പോരാ.",
      ),
    },
    {
      q: t("onboarding_whatIsTheWorstOutcome", "ഏറ്റവും മോശം ഫലം എന്താണ്?"),
      a: t(
        "onboarding_ifTheCaseRunsToTheEnd",
        "കേസ് അവസാനം വരെ പോയി എതിരായാൽ: രണ്ട് വർഷം വരെ തടവ്, അല്ലെങ്കിൽ ചെക്ക് തുകയുടെ ഇരട്ടി വരെ പിഴ, അല്ലെങ്കിൽ രണ്ടും. പകരം പ്രൊബേഷനും അനുവദിക്കാം. മിക്ക കേസുകളും തടവിലല്ല, പണം അടച്ചാണ് അവസാനിക്കുന്നത്.",
      ),
    },
    {
      q: t("onboarding_whatDoesRepresentingMyselfMean", "സ്വയം ഹാജരാകുക എന്നാൽ എന്ത്?"),
      a: t(
        "onboarding_youSpeakForYourselfInCourtAnd",
        "കോടതിയിൽ നിങ്ങൾ തന്നെ സംസാരിക്കുകയും അപേക്ഷകൾ നൽകുകയും ചെയ്യുന്നു. ഇതിനെ പാർട്ടി ഇൻ പേഴ്‌സൺ എന്ന് പറയും. മിക്കവരും അഭിഭാഷകനെ വയ്ക്കുന്നു.",
      ),
    },
  ],
  date: [
    {
      q: t("onboarding_canIAttendFromHome", "വീട്ടിൽ നിന്ന് ഹാജരാകാമോ?"),
      a: t(
        "onboarding_yesByVideoYouCanAlsoAsk",
        "അതെ, വീഡിയോ വഴി. നേരിട്ട് ഹാജരാകുന്നതിൽ നിന്ന് ഒഴിവാക്കി അഭിഭാഷകൻ ഹാജരായാൽ മതിയെന്നും ചോദിക്കാം. ചെക്ക് കേസുകളിൽ ഇത് സാധാരണമാണ്.",
      ),
    },
    {
      q: t("onboarding_whatIfMyDateHasPassed", "തീയതി കഴിഞ്ഞുപോയെങ്കിൽ?"),
      a: t(
        "onboarding_doNotIgnoreItSignInTo",
        "അവഗണിക്കരുത്. പുതിയ തീയതി അറിയാൻ സൈൻ ഇൻ ചെയ്യുക, അല്ലെങ്കിൽ 0000 000000 വിളിക്കുക.",
      ),
    },
    {
      q: t(
        "onboarding_whatIfINeitherComeNorApply",
        "ഹാജരാകാതെയും അപേക്ഷിക്കാതെയും ഇരുന്നാൽ?",
      ),
      a: t(
        "onboarding_theCourtCanIssueAWarrantFor",
        "കോടതിക്ക് അറസ്റ്റ് വാറന്റ് പുറപ്പെടുവിക്കാം, പരാതിക്കാരനോട് ചോദ്യം ചോദിക്കാനുള്ള അവകാശവും നഷ്ടപ്പെടും. തുടർന്നും വിട്ടുനിന്നാൽ ഒളിവിലാണെന്ന് പ്രഖ്യാപിച്ച് സ്വത്ത് കണ്ടുകെട്ടാം.",
      ),
    },
    {
      q: t("onboarding_whatIfAWarrantIsIssued", "വാറന്റ് വന്നാൽ?"),
      a: t(
        "onboarding_thisOffenceIsBailableIfYouCannot",
        "ഈ കുറ്റം ജാമ്യം ലഭിക്കുന്നതാണ്. ജാമ്യക്കാരെ ഏർപ്പാടാക്കാൻ കഴിയില്ലെന്നും ശേഷിയില്ലെന്നും കോടതി കണ്ടാൽ സ്വന്തം ബോണ്ടിൽ വിട്ടയക്കണം.",
      ),
    },
    {
      q: t("onboarding_howLongWillThisTake", "ഇത് എത്ര കാലം നീളും?"),
      a: t(
        "onboarding_chequeCasesAreTriedInAShort",
        "ചെക്ക് കേസുകൾ ചുരുക്ക രീതിയിലാണ് വിചാരണ. ഫയൽ ചെയ്ത് ആറ് മാസത്തിനകം തീർക്കാനാണ് നിയമം ആവശ്യപ്പെടുന്നത്.",
      ),
    },
  ],
  help: [
    {
      q: t("onboarding_whoElseQualifies", "മറ്റാർക്കൊക്കെ ലഭിക്കും?"),
      a: t(
        "onboarding_membersOfAScheduledCasteOrScheduled",
        "പട്ടികജാതി / പട്ടികവർഗക്കാർ, ഭിന്നശേഷിക്കാർ, വ്യവസായ തൊഴിലാളികൾ, കസ്റ്റഡിയിലുള്ളവർ, മനുഷ്യക്കടത്തിനോ ദുരന്തത്തിനോ ഇരയായവർ.",
      ),
    },
    {
      q: t(
        "onboarding_freeAdviceWithNoEligibilityTest",
        "യോഗ്യതാ പരിശോധനയില്ലാത്ത സൗജന്യ ഉപദേശം",
      ),
      a: t(
        "onboarding_teleLawIsFreeForEveryCitizen",
        "ടെലി-ലോ എല്ലാ പൗരന്മാർക്കും സൗജന്യമാണ്. കോമൺ സർവീസ് സെന്ററിൽ നിന്നോ tele-law.in ആപ്പ് വഴിയോ പാനൽ അഭിഭാഷകനോട് സംസാരിക്കാം. ഉപദേശം മാത്രം. അവർ കോടതിയിൽ ഹാജരാകില്ല.",
      ),
      links: [
        {
          label: t("onboarding_teleLawIn", "tele-law.in"),
          href: "https://www.tele-law.in/",
        },
      ],
    },
    {
      q: t("onboarding_aVolunteerLawyerThroughAnApp", "ആപ്പ് വഴി സന്നദ്ധ അഭിഭാഷകൻ"),
      a: t(
        "onboarding_nyayaBandhuMatchesYouWithAnAdvocate",
        "ന്യായ ബന്ധു സന്നദ്ധ സേവനം ചെയ്യുന്ന അഭിഭാഷകനെ കണ്ടെത്തിത്തരും. probono-doj.in-ൽ രജിസ്റ്റർ ചെയ്യുക. ലീഗൽ സർവീസസ് അതോറിറ്റിയേക്കാൾ സമയമെടുക്കും.",
      ),
      links: [
        {
          label: t("onboarding_probonoDojIn", "probono-doj.in"),
          href: "https://www.probono-doj.in/",
        },
      ],
    },
    {
      q: t("onboarding_hiringYourOwnLawyer", "സ്വന്തം അഭിഭാഷകനെ വയ്ക്കാൻ"),
      a: t(
        "onboarding_theBarCouncilOfKeralaKeepsA",
        "കേരള ബാർ കൗൺസിലിന്റെ പൊതു പട്ടിക barcouncilkerala.org-ൽ ഉണ്ട്. നിങ്ങളുടെ അഭിഭാഷകൻ ഈ പോർട്ടൽ വഴി കേസിൽ ചേരും.",
      ),
      links: [
        {
          label: t("onboarding_barcouncilkeralaOrg", "barcouncilkerala.org"),
          href: "https://www.barcouncilkerala.org/",
        },
      ],
    },
    {
      q: t("onboarding_helpUsingThisWebsite", "ഈ വെബ്സൈറ്റ് ഉപയോഗിക്കാൻ സഹായം"),
      a: t(
        "onboarding_call0000000000OrVisitTheE",
        "0000 000000 വിളിക്കുക, അല്ലെങ്കിൽ ജില്ലാ കോടതി വളപ്പിലെ ഇ-സേവാ കേന്ദ്രം സന്ദർശിക്കുക. ദേശീയ നിയമസഹായ ഹെൽപ്‌ലൈൻ 15100, 10 ഭാഷകളിൽ ടോൾ ഫ്രീ.",
      ),
      links: [
        {
          label: t("0000 000000", "0000 000000"),
          href: "tel:+910000000000",
        },
        {
          label: t("15100", "15100"),
          href: "tel:15100",
        },
      ],
    },
    {
      q: t("onboarding_ifYouHaveADisability", "ഭിന്നശേഷിക്കാരാണെങ്കിൽ"),
      a: t(
        "onboarding_youCanGiveYourEvidenceInThe",
        "നിങ്ങൾക്ക് സൗകര്യപ്രദമായ ഭാഷയിലും രീതിയിലും തെളിവ് നൽകാം, കോടതി രേഖകൾ ഉപയോഗിക്കാവുന്ന രൂപത്തിൽ ആവശ്യപ്പെടാം.",
      ),
    },
  ],
  join: [
    {
      q: t("onboarding_whyDoINeedAMobileNumber", "മൊബൈൽ നമ്പർ എന്തിനാണ്?"),
      a: t(
        "onboarding_theCourtSendsAOneTimeCode",
        "കോടതി അതിലേക്ക് ഒറ്റത്തവണ കോഡ് അയക്കും, ഹിയറിംഗ് തീയതികളും ഉത്തരവുകളും അറിയിക്കാൻ ഉപയോഗിക്കും. ഇമെയിൽ നിർബന്ധമല്ല.",
      ),
    },
    {
      q: t("onboarding_canIJoinLaterInstead", "പിന്നീട് ചേരാമോ?"),
      a: t(
        "onboarding_yesAtAnyStageButTheSooner",
        "അതെ, ഏത് ഘട്ടത്തിലും. പക്ഷേ എത്ര നേരത്തെയോ അത്രയും കൂടുതൽ വഴികൾ തുറന്നിരിക്കും.",
      ),
    },
    {
      q: t("onboarding_isMyInformationPrivate", "എന്റെ വിവരങ്ങൾ രഹസ്യമാണോ?"),
      a: t(
        "onboarding_theCourtIsToldWhenYouOpen",
        "നിങ്ങൾ സമൻസും ഈ പേജുകളും തുറക്കുമ്പോൾ കോടതി അറിയും. ജുഡീഷ്യറി മാത്രമേ ഇത് കാണൂ; രേഖകൾ ലഭിച്ചു എന്ന് ഉറപ്പാക്കാൻ മാത്രം.",
      ),
    },
    {
      q: t("onboarding_isThisLegalAdvice", "ഇത് നിയമോപദേശമാണോ?"),
      a: t(
        "onboarding_noThisExplainsTheLawALawyer",
        "അല്ല. ഇത് നിയമം വിശദീകരിക്കുന്നു. നിങ്ങളുടെ സാഹചര്യത്തിൽ എന്ത് ചെയ്യണമെന്ന് അഭിഭാഷകനാണ് പറയുക.",
      ),
    },
  ],
};

/* ----------------------------------------------------------------- videos */

/**
 * Context and reassurance — not a re-reading of the left column. Contents are
 * specified in "Onboarding — content allocation".
 *
 * `youtubeId` is empty until production videos exist, so the slot renders its
 * fallback. No decision-critical fact lives only here.
 */
export const videos: Record<StepId, { title: Copy; youtubeId?: string }> = {
  papers: { title: t("onboarding_whatIsThisCase", "ഇത് എന്ത് കേസാണ്?") },
  choices: { title: t("onboarding_canISettleThis", "ഇത് ഒത്തുതീർപ്പാക്കാമോ?") },
  date: { title: t("onboarding_whatIfICannotCome", "വരാൻ കഴിഞ്ഞില്ലെങ്കിൽ?") },
  help: { title: t("onboarding_canIGetAFreeLawyer", "സൗജന്യ അഭിഭാഷകനെ കിട്ടുമോ?") },
  join: { title: t("onboarding_howDoIJoinMyCase", "കേസിൽ എങ്ങനെ ചേരും?") },
};

/** Resolve catalog-backed English/Hindi and retain existing regional-language copy. */
export function pick(copy: Copy, locale: Locale): string {
  if (locale === "ml" && copy.ml) return copy.ml;
  return translateMessage(locale, copy.en);
}
