import { pick, type Copy, type Locale } from "@/lib/onboarding/content";

/**
 * Post-login join-a-case — content model.
 *
 * Implements the Join a Case handover V1 (dristi-be/PRDs/join-a-case-handover.md):
 * complainants never join (they are linked at e-filing), and in V1 no join needs
 * approval — an accused, a party in person (after uploading an affidavit) and a
 * power-of-attorney holder all get access as soon as they finish the flow.
 *
 * The legacy dialog asked five questions. Role (litigant/advocate) is known from
 * sign-in and complainants have no join flow, so this one asks at most three:
 * who you are joining as, which party you are, and how you will appear.
 */

const t = (en: string, ml: string): Copy => ({ en, ml });

/* ------------------------------------------------------------------ case model */

export type CaseParty = {
  id: string;
  /** The name exactly as it appears in the court record — often not the ID name. */
  name: string;
  /** The party themselves has an account on the case — blocks a duplicate self-join. */
  hasJoined?: boolean;
  /** Another power-of-attorney holder is already managing the case for this party —
   *  the only thing that blocks a further PoA join. The party having joined in person
   *  does not: the party and their PoA holder both legitimately hold access. */
  poaHolderJoined?: boolean;
  /** The number on record for a party who has joined — shown masked, never in full. */
  phoneOnRecord?: string;
};

export type JoinCase = {
  /** "Complainant vs accused", as the court titles it. */
  title: string;
  caseNumber: string;
  cnr: string;
  filingNumber: string;
  caseType: string;
  filingDate: string;
  court: string;
  /** The room inside the court the case is heard in — its own fact, not part of the court's name. */
  courtroom: string;
  hearingDate: string;
  chequeAmount: string;
  complainant: string;
  complainantAdvocate: string;
  complainantAdvocatePhone: string;
  accusedAdvocate: string;
  /** The accused parties a litigant can join as. */
  accused: CaseParty[];
  /** The complainant parties — a PoA holder or advocate can join for these. */
  complainants: CaseParty[];
};

/**
 * Stand-in for the case-lookup endpoint. The second accused has already joined, so
 * the duplicate-join guard is reviewable; the first differs from the demo account's
 * registered name ("Rajan K. Nair") so the name-mapping step is reviewable too.
 */
export const DEMO_JOIN_CASE: JoinCase = {
  title: "South Indian Bank Ltd. vs Rajan Krishnan Nair and 1 other",
  caseNumber: "CC 847/2026",
  /* Real formats (owner feedback, 12 Oct): a 16-character CNR and a registration
     number, each re-voiced per state by the court switch — in Gujarat GJAH010008472026
     and eCC/2405/2026. */
  cnr: "KLKM520008472026",
  filingNumber: "CMP/2405/2026",
  caseType: "NIA S138",
  filingDate: "31-07-2026",
  /* The product's own court, which the court switch names per state ("SARAS Court"). */
  court: "24×7 ON Court",
  courtroom: "Court No. 3",
  hearingDate: "Friday, 18 September 2026, 10:30 AM",
  chequeAmount: "₹1,85,000",
  complainant: "South Indian Bank Ltd.",
  complainantAdvocate: "Adv. Meera Pillai",
  complainantAdvocatePhone: "0000 000 000",
  accusedAdvocate: "Not available",
  accused: [
    { id: "acc-1", name: "Rajan Krishnan Nair" },
    { id: "acc-2", name: "Suresh Babu P", hasJoined: true, phoneOnRecord: "9846012734" },
  ],
  // Linked at e-filing (JOIN-01), so already on the case with a number on record.
  complainants: [
    { id: "comp-1", name: "South Indian Bank Ltd.", hasJoined: true, phoneOnRecord: "9447055188" },
  ],
};

/** The demo account's registered profile name — deliberately not an exact match for
 *  any party name, because that mismatch is the reason the mapping step exists. */
export const DEMO_PROFILE_NAME = "Rajan K. Nair";

/* ------------------------------------------------------------------ home screen */

export const home = {
  welcome: t("join_welcomeName", "സ്വാഗതം, {name}"),
  fileTitle: t("join_fileANewCase", "പുതിയ കേസ് ഫയൽ ചെയ്യുക"),
  fileBody: t(
    "join_startANewChequeBounceCaseAnd",
    "പുതിയ ചെക്ക് മടക്ക കേസ് തുടങ്ങി ഫയലിംഗ് മുതൽ തീരുമാനം വരെ പിന്തുടരുക.",
  ),
  fileAction: t("join_fileACase", "കേസ് ഫയൽ ചെയ്യുക"),
  joinTitle: t("join_joinAnOngoingCase", "നിലവിലുള്ള കേസിൽ ചേരുക"),
  joinBody: t(
    "join_receivedASummonsOrPartOfA",
    "സമൻസ് ലഭിച്ചോ, അല്ലെങ്കിൽ കോടതിയിലുള്ള കേസിന്റെ ഭാഗമാണോ? കേസ് കണ്ടെത്തി ചേരുക.",
  ),
  joinAction: t("join_joinACase", "കേസിൽ ചേരുക"),
  casesHeading: t("join_yourCases", "നിങ്ങളുടെ കേസുകൾ"),
  caseNumberLabel: t("join_caseNumber", "കേസ് നമ്പർ"),
  hearingLabel: t("join_nextHearing", "അടുത്ത ഹിയറിംഗ്"),
  statusJoined: t("join_joined", "ചേർന്നു"),
  statusSummons: t("join_actionRequired", "നടപടി ആവശ്യമാണ്"),
  linkTitle: t("join_isThisYou", "ഇത് നിങ്ങളാണോ?"),
  linkBody: t(
    "join_someoneJoiningCaseCasenumberGaveThisMobile",
    "{caseNumber} കേസിൽ ചേർന്ന ഒരാൾ {name}-ന്റെ നമ്പറായി ഈ മൊബൈൽ നമ്പർ നൽകി. ഈ കേസിലെ {name} നിങ്ങളാണോ?",
  ),
  linkYes: t("join_yesThisIsMe", "അതെ, ഇത് ഞാനാണ്"),
  linkNo: t("join_noThisIsnTMe", "ഇല്ല, ഇത് ഞാനല്ല"),
  linkDeclinedTitle: t("join_thisCaseWasNotAdded", "ഈ കേസ് ചേർത്തിട്ടില്ല"),
  linkDeclinedBody: t(
    "join_thankYouTheCaseHasNotBeen",
    "നന്ദി. ഈ കേസ് നിങ്ങളുടെ അക്കൗണ്ടുമായി ബന്ധിപ്പിച്ചിട്ടില്ല.",
  ),
  reviewSummons: t("join_reviewAndJoin", "പരിശോധിച്ച് ചേരുക"),
  viewCase: t("join_viewCase", "കേസ് കാണുക"),
  prototypeTitle: t(
    "join_prototypeDestinationNotConnected",
    "പ്രോട്ടോടൈപ്പ്: ലക്ഷ്യസ്ഥാനം ബന്ധിപ്പിച്ചിട്ടില്ല",
  ),
  prototypeFile: t(
    "join_thisActionWillOpenTheEFiling",
    "ഈ പ്രവർത്തനം ഇ-ഫയലിംഗ് ഫ്ലോ തുറക്കും.",
  ),
  prototypeCase: t(
    "join_thisActionWillOpenTheCaseFile",
    "ഈ പ്രവർത്തനം കേസ് ഫയൽ തുറക്കും.",
  ),
  prototypeId: t(
    "join_thisActionWillOpenTheIdUpload",
    "ഈ പ്രവർത്തനം പ്രൊഫൈലിലെ ID അപ്‌ലോഡ് തുറക്കും.",
  ),
  prototypeProfile: t(
    "join_profileEditingWillOpenHereCompleteYour",
    "പ്രൊഫൈൽ തിരുത്തൽ ഇവിടെ തുറക്കും. ഈ ഓർമ്മപ്പെടുത്തൽ നീക്കാൻ വിലാസം പൂർത്തിയാക്കുക.",
  ),
} as const;

/* ------------------------------------------------------------ summons auto-modal */

export const summonsModal = {
  heading: t(
    "join_reviewThisChequeBounceCase",
    "ഈ ചെക്ക് മടക്ക കേസ് പരിശോധിക്കുക",
  ),
  body: t(
    "join_yourNameAppearsInThisCaseCheck",
    "ഈ കേസിൽ നിങ്ങളുടെ പേര് ഉണ്ട്. വിവരങ്ങൾ പരിശോധിച്ച്, പരാതി വായിക്കാനും ഓൺലൈനായി മറുപടി നൽകാനും കേസിൽ ചേരുക.",
  ),
  cta: t("join_joinThisCase", "ഈ കേസിൽ ചേരുക"),
  dismiss: t("join_notNow", "ഇപ്പോൾ വേണ്ട"),
} as const;

/* -------------------------------------------------------------------- join dialog */

export const joinDialog = {
  /* Closing partway through asks first (owner, 2026-10-13). Malayalam drafted. */
  leaveTitle: t("join_leaveWithoutJoining", "ചേരാതെ പുറത്തുകടക്കണോ?"),
  leaveBody: t(
    "join_whatYouHaveEnteredSoFarWill",
    "ഇതുവരെ നൽകിയ വിവരങ്ങൾ സൂക്ഷിക്കില്ല.",
  ),
  leaveStay: t("join_keepGoing", "തുടരുക"),
  leaveGo: t("join_leave", "പുറത്തുകടക്കുക"),
  title: t("join_joinYourCase", "നിങ്ങളുടെ കേസിൽ ചേരുക"),

  /* lookup — manual entry only */
  lookupBody: t(
    "join_enterTheCaseNumberOrFilingNumber",
    "സമൻസിലോ കോടതി രേഖകളിലോ ഉള്ള കേസ് നമ്പർ അല്ലെങ്കിൽ ഫയലിംഗ് നമ്പർ നൽകുക.",
  ),
  lookupLabel: t("join_caseNumberOrFilingNumber", "കേസ് നമ്പർ അല്ലെങ്കിൽ ഫയലിംഗ് നമ്പർ"),
  lookupPlaceholder: t("join_forExampleCc8472026", "ഉദാഹരണം: CC 847/2026"),
  lookupError: t(
    "join_enterTheNumberAsItAppearsOn",
    "രേഖകളിൽ കാണുന്നതുപോലെ നമ്പർ നൽകുക.",
  ),
  lookupMiss: t(
    "join_noCaseMatchesThisNumberCheckYour",
    "ഈ നമ്പറിന് ചേരുന്ന കേസ് കണ്ടെത്തിയില്ല. സമൻസ് പരിശോധിക്കുക; കേസ് ഇനിയും സിസ്റ്റത്തിൽ എത്തിയിട്ടില്ലായിരിക്കാം.",
  ),
  search: t("join_findCase", "കേസ് കണ്ടെത്തുക"),

  /* access code — manual entry only; everyone joining needs it (JOIN-13) */
  codeBody: t(
    "join_enterTheSixDigitCodeForThis",
    "ഈ കേസിന്റെ ആറക്ക കോഡ് നൽകുക.",
  ),
  codeLabel: t("join_accessCode", "ആക്‌സസ് കോഡ്"),
  codeCaseLead: t("join_youAreJoining", "നിങ്ങൾ ചേരുന്ന കേസ്"),
  /* Arriving from the summons QR or link (owner, 2026-10-14): the case is known, the
     code is still asked. Malayalam drafted — needs review. */
  codeSummonsBody: t(
    "join_enterTheSixDigitAccessCodePrinted",
    "നിങ്ങളുടെ സമൻസിൽ അച്ചടിച്ചിട്ടുള്ള ആറക്ക ആക്‌സസ് കോഡ് നൽകുക.",
  ),
  codeSummonsNote: t(
    "join_theCodeIsPrintedOnYourSummons",
    "കോഡ് നിങ്ങളുടെ സമൻസിൽ, QR കോഡിന് അടുത്തായി അച്ചടിച്ചിട്ടുണ്ട്.",
  ),
  /* The advocate holds a client's summons, not their own. */
  codeSummonsBodyAdvocate: t(
    "join_enterTheSixDigitAccessCodePrinted_502eef99",
    "സമൻസിൽ അച്ചടിച്ചിട്ടുള്ള ആറക്ക ആക്‌സസ് കോഡ് നൽകുക.",
  ),
  codeSummonsNoteAdvocate: t(
    "join_theCodeIsPrintedOnTheSummons",
    "കോഡ് സമൻസിൽ, QR കോഡിന് അടുത്തായി അച്ചടിച്ചിട്ടുണ്ട്.",
  ),
  notMyCase: t("join_notMyCase", "എന്റെ കേസ് അല്ലേ?"),
  backToSummonsCase: t("join_backToTheSummonsCase", "സമൻസിലെ കേസിലേക്ക് മടങ്ങുക"),
  codeNote: t(
    "join_theCodeIsPrintedOnTheSummons_2c437760",
    "കോഡ് സമൻസിൽ അച്ചടിച്ചിട്ടുണ്ട്. കേസിൽ ഇതിനകം ചേർന്ന കക്ഷികൾക്കും ഇത് നിങ്ങളുമായി പങ്കിടാം.",
  ),
  codeError: t("join_enterTheSixDigitAccessCode", "ആറക്ക ആക്‌സസ് കോഡ് നൽകുക."),
  codeVerify: t("join_verifyAccessCode", "ആക്‌സസ് കോഡ് പരിശോധിക്കുക"),

  /* details */
  detailsBody: t(
    "join_checkThatThisIsYourCaseBefore",
    "തുടരുന്നതിന് മുൻപ് ഇത് നിങ്ങളുടെ കേസാണെന്ന് ഉറപ്പാക്കുക.",
  ),
  acknowledgeNote: t(
    "join_byJoiningThisCaseYouConfirmThat",
    "ഈ കേസിൽ ചേരുന്നതിലൂടെ സമൻസ് നിങ്ങൾക്ക് ലഭിച്ചു എന്ന് സ്ഥിരീകരിക്കുന്നു.",
  ),
  downloadCaseFile: t("join_downloadCaseFile", "കേസ് ഫയൽ ഡൗൺലോഡ് ചെയ്യുക"),
  downloadCaseFilePrototype: t(
    "join_theCaseFileWillDownloadHere",
    "കേസ് ഫയൽ ഇവിടെ ഡൗൺലോഡ് ചെയ്യും.",
  ),

  /* identity */
  identityBody: t(
    "join_tellUsWhoYouAreAndHow",
    "നിങ്ങൾ ആരാണെന്നും കേസിൽ എങ്ങനെ ചേരുമെന്നും ഞങ്ങളോട് പറയുക.",
  ),
  whoLegend: t("join_whoAreYouJoiningAs", "നിങ്ങൾ ആരായാണ് ചേരുന്നത്?"),
  whoSelf: t("join_iAmTheAccused", "ഞാൻ തന്നെയാണ് പ്രതി"),
  accusedExplainTitle: t("join_whatDoesAccusedMean", "പ്രതി എന്നാൽ എന്ത്?"),
  accusedExplainBody: t(
    "join_theAccusedIsThePersonOrOrganisation",
    "കേസിന് മറുപടി നൽകേണ്ട വ്യക്തിയോ സ്ഥാപനമോ ആയി പരാതിയിൽ പേരുള്ള ആളാണ് പ്രതി. കോടതി കുറ്റക്കാരനായി കണ്ടെത്തി എന്നല്ല ഇതിന്റെ അർത്ഥം.",
  ),
  whoPoa: t(
    "join_iAmAPowerOfAttorneyPoa",
    "ഞാൻ ഒരു പവർ ഓഫ് അറ്റോർണി ഉടമയാണ്",
  ),
  poaExplainTitle: t(
    "join_whatIsAPowerOfAttorneyPoa",
    "പവർ ഓഫ് അറ്റോർണി എന്നാൽ എന്ത്?",
  ),
  poaExplainBody: t(
    "join_aWrittenAuthorisationThatLetsYouAct",
    "പരാതിക്കാരന് വേണ്ടിയോ പ്രതിക്ക് വേണ്ടിയോ ഈ കേസിൽ പ്രവർത്തിക്കാൻ അനുവദിക്കുന്ന രേഖാമൂലമുള്ള അധികാരപത്രം. ഉദാഹരണത്തിന് വിദേശത്തുള്ള മാതാപിതാവിനോ അസുഖമുള്ള ബന്ധുവിനോ വേണ്ടി. ആ വ്യക്തിക്ക് എപ്പോൾ വേണമെങ്കിലും ഇത് റദ്ദാക്കാം.",
  ),
  whichSelfLabel: t("join_whoAmongThesePeopleAreYou", "ഇവരിൽ നിങ്ങൾ ആരാണ്?"),
  poaSideLegend: t(
    "join_areYouAPoaHolderForA",
    "പരാതിക്കാരന്റെയോ പ്രതിയുടെയോ പവർ ഓഫ് അറ്റോർണി ഉടമയാണോ നിങ്ങൾ?",
  ),
  poaSideComplainant: t("join_complainant", "പരാതിക്കാരൻ"),
  poaSideAccused: t("join_accused", "പ്രതി"),
  poaSideError: t("join_chooseASide", "ഒരു ഭാഗം തിരഞ്ഞെടുക്കുക."),
  whichPoaLabel: t(
    "join_whoDoYouHoldPowerOfAttorney",
    "ആർക്ക് വേണ്ടിയാണ് നിങ്ങൾക്ക് പവർ ഓഫ് അറ്റോർണി ഉള്ളത്?",
  ),
  whichPoaHint: t(
    "join_chooseEveryoneYouHoldPowerOfAttorney",
    "ഈ കേസിൽ നിങ്ങൾക്ക് പവർ ഓഫ് അറ്റോർണി ഉള്ള എല്ലാവരെയും തിരഞ്ഞെടുക്കുക.",
  ),
  whichPoaPlaceholder: t("join_chooseNameS", "പേരുകൾ തിരഞ്ഞെടുക്കുക"),
  whichPoaEmpty: t("join_noNamesFound", "പേരുകൾ കണ്ടെത്തിയില്ല."),
  whichPoaError: t("join_chooseAtLeastOneName", "കുറഞ്ഞത് ഒരു പേര് തിരഞ്ഞെടുക്കുക."),
  whichPlaceholder: t("join_chooseAName", "ഒരു പേര് തിരഞ്ഞെടുക്കുക"),
  whichError: t("join_chooseANameFromTheList", "പട്ടികയിൽ നിന്ന് ഒരു പേര് തിരഞ്ഞെടുക്കുക."),
  mappingNote: t(
    "join_youAreJoiningAsNameYourAccount",
    "{name} ആയാണ് നിങ്ങൾ ചേരുന്നത്. കേസ് രേഖയിൽ ആ പേരുമായി നിങ്ങളുടെ അക്കൗണ്ട് ബന്ധിപ്പിക്കും.",
  ),
  alreadyJoined: t(
    "join_nameHasAlreadyJoinedThisCaseIf",
    "{name} ഇതിനകം ഈ കേസിൽ ചേർന്നിട്ടുണ്ട്. ഇത് നിങ്ങളാണെങ്കിൽ, നേരത്തെ ഉപയോഗിച്ച അക്കൗണ്ടിൽ സൈൻ ഇൻ ചെയ്യുക, അല്ലെങ്കിൽ 0000 000000 എന്ന നമ്പറിൽ കോടതിയെ വിളിക്കുക.",
  ),
  poaAlreadyTaken: t(
    "join_anotherPowerOfAttorneyHolderIsAlready",
    "{name}-ന് വേണ്ടി മറ്റൊരു പവർ ഓഫ് അറ്റോർണി ഉടമ ഇതിനകം ഈ കേസ് കൈകാര്യം ചെയ്യുന്നു. ഒരു സമയം ഒരു പവർ ഓഫ് അറ്റോർണി ഉടമയ്ക്ക് മാത്രമേ പ്രവർത്തിക്കാനാകൂ — ഇത് മാറ്റണമെങ്കിൽ 0000 000000 എന്ന നമ്പറിൽ കോടതിയെ വിളിക്കുക.",
  ),
  appearLegend: t(
    "join_howWillYouAppearInCourt",
    "കോടതിയിൽ എങ്ങനെ ഹാജരാകും?",
  ),
  /* "Find a lawyer", pointing to free legal aid at the District Legal Services
     Authority (owner, 2026-10-14). Malayalam drafted — needs review. */
  appearHire: t("join_findALawyer", "അഭിഭാഷകനെ കണ്ടെത്തുക"),
  appearHireHint: t(
    "join_youCanJoinNowAndAddAn",
    "ഇപ്പോൾ ചേരുകയും പിന്നീട് അഭിഭാഷകനെ ചേർക്കുകയും ചെയ്യാം.",
  ),
  findAdvocate: t("join_aboutFreeLegalAid", "സൗജന്യ നിയമസഹായത്തെക്കുറിച്ച്"),
  findAdvocateHelp: t(
    "join_theDistrictLegalServicesAuthorityGivesFree",
    "ജില്ലാ നിയമ സേവന അതോറിറ്റി സൗജന്യ നിയമസഹായം നൽകുകയും നിങ്ങൾക്ക് ഒരു അഭിഭാഷകനെ നിയോഗിക്കുകയും ചെയ്യും.",
  ),
  openBarCouncil: t("join_openTheLegalAidPortal", "നിയമസഹായ പോർട്ടൽ തുറക്കുക"),
  findAdvocateHref: "https://nalsa.gov.in/",
  /* Next step on the joined screen (owner, 2026-10-14). Malayalam drafted. */
  nextShareCode: t(
    "join_nextGiveYourAdvocateYourAccessCode",
    "അടുത്തതായി, നിങ്ങളുടെ ആക്‌സസ് കോഡ് ({code}) അല്ലെങ്കിൽ സമൻസ് അഭിഭാഷകന് നൽകുക. നിങ്ങൾക്കായി കേസിൽ ചേരാൻ അവർക്ക് അത് ആവശ്യമാണ്.",
  ),
  nextFindLawyer: t(
    "join_nextOnceYouHaveALawyerGive",
    "അടുത്തതായി, അഭിഭാഷകനെ ലഭിച്ചാൽ നിങ്ങളുടെ ആക്‌സസ് കോഡ് ({code}) അല്ലെങ്കിൽ സമൻസ് അവർക്ക് നൽകുക. നിങ്ങൾക്കായി കേസിൽ ചേരാൻ അവർക്ക് അത് ആവശ്യമാണ്.",
  ),
  appearAdvocate: t("join_iAlreadyHaveAnAdvocate", "എനിക്ക് ഇതിനകം ഒരു അഭിഭാഷകനുണ്ട്"),
  appearAdvocateHint: t(
    "join_yourAdvocateCanJoinTheCaseSeparately",
    "നിങ്ങളുടെ അഭിഭാഷകന് പ്രത്യേകം കേസിൽ ചേരാം. നിങ്ങൾക്ക് ഇപ്പോൾ ആക്‌സസ് ലഭിക്കും.",
  ),
  appearSelf: t(
    "join_iWillRepresentMyselfPartyInPerson",
    "ഞാൻ സ്വയം ഹാജരാകും (പാർട്ടി ഇൻ പേഴ്‌സൺ)",
  ),
  appearSelfHint: t(
    "join_calledAppearingAsAPartyInPerson",
    "പാർട്ടി ഇൻ പേഴ്‌സൺ എന്നാണ് ഇതിന് പേര്. ഒരു സത്യവാങ്മൂലം അപ്‌ലോഡ് ചെയ്താൽ ഉടൻ ആക്‌സസ് ലഭിക്കും.",
  ),
  appearSelfUnavailable: t(
    "join_representingYourselfIsNotOfferedHereBecause",
    "പ്രതിക്കായി ഒരു അഭിഭാഷകൻ ഇതിനകം രേഖയിലുള്ളതിനാൽ സ്വയം ഹാജരാകാനുള്ള ഓപ്ഷൻ ഇവിടെ ലഭ്യമല്ല.",
  ),
  pipDocLabel: t("join_affidavit", "സത്യവാങ്മൂലം"),
  pipDocHelp: t(
    "join_uploadYourSignedAffidavitAsAJpg",
    "ഒപ്പിട്ട സത്യവാങ്മൂലം JPG, JPEG, PNG അല്ലെങ്കിൽ PDF ആയി അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  pipDocError: t(
    "join_uploadTheAffidavitBeforeContinuing",
    "തുടരുന്നതിന് മുമ്പ് സത്യവാങ്മൂലം അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  appearError: t(
    "join_chooseHowYouWillAppearInCourt",
    "കോടതിയിൽ എങ്ങനെ ഹാജരാകുമെന്ന് തിരഞ്ഞെടുക്കുക.",
  ),
  poaDocLabel: t("join_authorizationDocument", "അധികാര രേഖ"),
  /* Each party's fields carry its name, in place of a heading over them that read past
     (owner, 2026-10-14). Malayalam drafted — needs review. */
  poaDocLabelFor: t("join_authorizationDocumentForName", "{name}-ന്റെ അധികാര രേഖ"),
  /* Name first, so with several parties the field is found by its person
     (owner, 2026-10-14). */
  poaPhoneLabelFor: t("join_nameSMobileNumber", "{name}-ന്റെ മൊബൈൽ നമ്പർ"),
  poaDocSlot: t("join_signedCopy", "ഒപ്പിട്ട പകർപ്പ്"),
  poaJoinedChip: t("join_joined", "ചേർന്നു"),
  poaPhoneJoinedNote: t(
    "join_alreadyOnTheCaseThisIsThe",
    "ഇതിനകം കേസിലുണ്ട്. ഇത് അവരുടെ അക്കൗണ്ടിലെ നമ്പറാണ്.",
  ),
  poaPartyHeading: t(
    "join_forName",
    "{name}-ന് വേണ്ടി",
  ),
  poaDocHelp: t(
    "join_uploadAJpgJpegPngOrPdf",
    "JPG, JPEG, PNG അല്ലെങ്കിൽ PDF അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  poaDocTooltipLabel: t(
    "join_aboutTheAuthorizationDocument",
    "അധികാര രേഖയെക്കുറിച്ച്",
  ),
  poaDocTooltip: t(
    "join_uploadAnAffidavitSignedByThePerson",
    "നിങ്ങളെ അവർക്ക് വേണ്ടി പ്രവർത്തിക്കാൻ അധികാരപ്പെടുത്തുന്ന വ്യക്തി ഒപ്പിട്ട സത്യവാങ്മൂലം അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  poaDocSample: t("join_downloadASample", "ഒരു മാതൃക ഡൗൺലോഡ് ചെയ്യുക"),
  poaDocSamplePrototype: t(
    "join_aSampleAuthorizationDocumentWillDownloadHere",
    "ഒരു മാതൃകാ അധികാര രേഖ ഇവിടെ ഡൗൺലോഡ് ചെയ്യും.",
  ),
  poaDocError: t(
    "join_uploadTheAuthorizationDocumentBeforeContinuing",
    "തുടരുന്നതിന് മുമ്പ് അധികാര രേഖ അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  poaPhoneLabel: t("join_theirMobileNumber", "അവരുടെ മൊബൈൽ നമ്പർ"),
  poaPhoneHelp: t(
    "join_weLlTextThisNumberTheCase",
    "ഈ നമ്പറിലേക്ക് SMS അയക്കും. അവർ സൈൻ ഇൻ ചെയ്ത് അത് അവരാണെന്ന് സ്ഥിരീകരിച്ചാൽ കേസ് അവരുടെ അക്കൗണ്ടുമായി ബന്ധിപ്പിക്കും.",
  ),
  poaPhoneOnRecord: t(
    "join_alreadyOnTheCaseNoNumberNeeded",
    "ഇതിനകം കേസിലുണ്ട് — നമ്പർ ആവശ്യമില്ല.",
  ),
  poaAccusedPhoneError: t(
    "join_enterA10DigitMobileNumber",
    "10 അക്ക മൊബൈൽ നമ്പർ നൽകുക.",
  ),
  joinSubmit: t("join_joinThisCase", "ഈ കേസിൽ ചേരുക"),

  /* outcomes */
  joinedTitle: t("join_youHaveJoinedThisCase", "നിങ്ങൾ ഈ കേസിൽ ചേർന്നു"),
  joinedBody: t(
    "join_youCanNowReadTheComplaintAnd",
    "ഇനി {name} ആയി പരാതി വായിക്കാനും കേസിൽ നടപടിയെടുക്കാനും കഴിയും.",
  ),
  poaJoinedBody: t(
    "join_youCanNowActInThisCase",
    "ഇനി {name}-ന്റെ പവർ ഓഫ് അറ്റോർണി ഉടമയായി ഈ കേസിൽ പ്രവർത്തിക്കാം.",
  ),
  /* The settled band on the joined case (Oct 6). Malayalam drafted — needs review. */
  joinedBand: t("join_joinedAsName", "{name} ആയി ചേർന്നു"),
  poaJoinedBand: t(
    "join_joinedAsPowerOfAttorneyHolderFor",
    "{name}-ന്റെ പവർ ഓഫ് അറ്റോർണി ഉടമയായി ചേർന്നു",
  ),
  smsSentNote: t(
    "join_weVeTextedNumbersTheCaseIs",
    "{numbers} എന്ന നമ്പറുകളിലേക്ക് SMS അയച്ചു. ഓരോരുത്തരും സൈൻ ഇൻ ചെയ്ത് സ്ഥിരീകരിച്ചാൽ കേസ് അവരുടെ അക്കൗണ്ടുമായി ബന്ധിപ്പിക്കും.",
  ),
  viewCase: t("join_viewCase", "കേസ് കാണുക"),
  fileBail: t("join_fileBailApplication", "ജാമ്യാപേക്ഷ നൽകുക"),
  addAdvocate: t("join_addAdvocate", "അഭിഭാഷകനെ ചേർക്കുക"),
  addAdvocatePrototype: t(
    "join_theAddAdvocateFlowWillOpenHere",
    "അഭിഭാഷകനെ ചേർക്കാനുള്ള ഫ്ലോ ഇവിടെ തുറക്കും.",
  ),
  backHome: t("join_backToHome", "ഹോമിലേക്ക് മടങ്ങുക"),

  /* shared chrome */
  back: t("join_back", "പുറകോട്ട്"),
  close: t("join_close", "അടയ്ക്കുക"),
  continue: t("join_continue", "തുടരുക"),
} as const;

/* ------------------------------------------------------------------ app shell */

export const shell = {
  navHome: t("join_home", "ഹോം"),
  navCases: t("join_yourCases", "നിങ്ങളുടെ കേസുകൾ"),
  navHearings: t("join_hearings", "ഹിയറിംഗുകൾ"),
  navHelp: t("join_getHelp", "സഹായം"),
  navGroup: t("join_portal", "പോർട്ടൽ"),
  breadcrumbHome: t("join_home", "ഹോം"),
  breadcrumbAllCases: t("join_allCases", "എല്ലാ കേസുകളും"),
  collapse: t("join_collapse", "ചുരുക്കുക"),
  expand: t("join_expand", "വികസിപ്പിക്കുക"),
  role: t("join_litigant", "കക്ഷി"),
  profileIncomplete: t("join_completeYourProfile", "പ്രൊഫൈൽ പൂർത്തിയാക്കുക"),
  profileIncompleteLabel: t(
    "join_profileIncomplete",
    "പ്രൊഫൈൽ പൂർത്തിയായിട്ടില്ല",
  ),
  notifications: t("join_notifications", "അറിയിപ്പുകൾ"),
  noNotifications: t(
    "join_nothingYetUpdatesAboutYourCaseAnd",
    "ഇതുവരെ ഒന്നുമില്ല. കേസും അക്കൗണ്ടും സംബന്ധിച്ച അറിയിപ്പുകൾ ഇവിടെ വരും.",
  ),
  justNow: t("join_justNow", "ഇപ്പോൾ"),
  clearAllNotifications: t("join_clearAll", "എല്ലാം മായ്ക്കുക"),
  prototypeNav: t(
    "join_thisSectionWillOpenHere",
    "ഈ ഭാഗം ഇവിടെ തുറക്കും.",
  ),
} as const;

export const profileCompletion = {
  notificationTitle: t(
    "join_completeYourProfile",
    "പ്രൊഫൈൽ പൂർത്തിയാക്കുക",
  ),
  notificationBody: t(
    "join_addYourAddressAndOfficialIdFrom",
    "പ്രൊഫൈലിൽ നിന്ന് വിലാസവും ഔദ്യോഗിക IDയും ചേർക്കുക.",
  ),
  action: t("join_completeProfile", "പ്രൊഫൈൽ പൂർത്തിയാക്കുക"),
} as const;

/* ------------------------------------------------------------- ID submission */

export const idUpload = {
  title: t("join_addYourId", "നിങ്ങളുടെ ID ചേർക്കുക"),
  expandPreview: t("join_openALargerIdPreview", "IDയുടെ വലിയ പ്രിവ്യൂ തുറക്കുക"),
  previewTitle: t("join_officialIdPreview", "ഔദ്യോഗിക ID പ്രിവ്യൂ"),
  previewDescription: t(
    "join_checkTheUploadedIdBeforeSubmittingIt",
    "സമർപ്പിക്കുന്നതിന് മുമ്പ് അപ്‌ലോഡ് ചെയ്ത ID പരിശോധിക്കുക.",
  ),
  previewAlt: t(
    "join_previewOfTheUploadedOfficialId",
    "അപ്‌ലോഡ് ചെയ്ത ഔദ്യോഗിക IDയുടെ പ്രിവ്യൂ",
  ),
  body: t(
    "join_uploadOneClearCopyOfAnOfficial",
    "നിങ്ങളുടെ പ്രൊഫൈലിൽ ചേർക്കാൻ ഒരു ഔദ്യോഗിക IDയുടെ വ്യക്തമായ പകർപ്പ് അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  typeLabel: t("join_typeOfId", "ID തരം"),
  typePlaceholder: t("join_chooseAnId", "ഒരു ID തിരഞ്ഞെടുക്കുക"),
  idTypes: {
    aadhaar: t("join_aadhaar", "ആധാർ"),
    licence: t("join_drivingLicence", "ഡ്രൈവിംഗ് ലൈസൻസ്"),
    pan: t("join_panCard", "പാൻ കാർഡ്"),
    passport: t("join_passport", "പാസ്‌പോർട്ട്"),
    voter: t("join_voterId", "വോട്ടർ ID"),
    other: t("join_other", "മറ്റുള്ളവ"),
  },
  uploadLabel: t("join_officialId", "ഔദ്യോഗിക ID"),
  fileHelp: t(
    "join_jpgJpegPngOrPdfUpTo",
    "JPG, JPEG, PNG അല്ലെങ്കിൽ PDF · പരമാവധി 10 MB",
  ),
  chooseTypeFirst: t(
    "join_chooseTheTypeOfIdBeforeUploading",
    "ഫയൽ അപ്‌ലോഡ് ചെയ്യുന്നതിന് മുമ്പ് ID തരം തിരഞ്ഞെടുക്കുക.",
  ),
  choose: t("join_chooseFile", "ഫയൽ തിരഞ്ഞെടുക്കുക"),
  change: t("join_changeFile", "ഫയൽ മാറ്റുക"),
  processing: t("join_checkingTheScan", "സ്കാൻ പരിശോധിക്കുന്നു…"),
  goodScan: t("join_goodScan", "വ്യക്തമായ സ്കാൻ"),
  poorScan: t("join_needsAClearerScan", "കൂടുതൽ വ്യക്തമായ സ്കാൻ വേണം"),
  poorScanHelp: t(
    "join_thisImageMayBeTooSmallOr",
    "ഈ ചിത്രം വിശ്വസനീയമായി വായിക്കാൻ ചെറുതോ അവ്യക്തമോ ആയിരിക്കാം. കൂടുതൽ വ്യക്തമായ ഫോട്ടോ അല്ലെങ്കിൽ സ്കാൻ അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  badFile: t(
    "join_chooseAJpgJpegPngOrPdf",
    "10 MB-ൽ കുറഞ്ഞ JPG, JPEG, PNG അല്ലെങ്കിൽ PDF ഫയൽ തിരഞ്ഞെടുക്കുക.",
  ),
  missing: t(
    "join_chooseTheTypeOfIdAndUpload",
    "ID തരം തിരഞ്ഞെടുത്ത് വ്യക്തമായ ഫയൽ അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  submit: t("join_submitId", "ID സമർപ്പിക്കുക"),
  submittedTitle: t("join_idSubmitted", "ID സമർപ്പിച്ചു"),
  submittedBody: t(
    "join_yourOfficialIdHasBeenAddedTo",
    "നിങ്ങളുടെ ഔദ്യോഗിക ID പ്രൊഫൈലിൽ ചേർത്തു.",
  ),
  done: t("join_done", "ശരി"),
  notifSubmittedTitle: t("join_idSubmitted", "ID സമർപ്പിച്ചു"),
  notifSubmittedBody: t(
    "join_yourOfficialIdHasBeenAddedTo",
    "നിങ്ങളുടെ ഔദ്യോഗിക ID പ്രൊഫൈലിൽ ചേർത്തു.",
  ),
} as const;

/* ------------------------------------------------------------------ case details */

export const caseDetails = {
  caseTypeBadge: t("join_chequeBounceNiaS138", "ചെക്ക് മടക്കം · NIA S138"),
  court: t("join_court", "കോടതി"),
  /* Malayalam drafted (Oct 6) — needs review. */
  courtroom: t("join_courtroom", "കോടതി മുറി"),
  hearing: t("join_nextHearing", "അടുത്ത ഹിയറിംഗ്"),
  caseNumber: t("join_caseNumber", "കേസ് നമ്പർ"),
  cnr: t("join_cnrNumber", "CNR നമ്പർ"),
  /* The number the case was registered under, not the e-filing number (owner, 12 Oct). */
  filingNumber: t("join_registrationNumber", "രജിസ്ട്രേഷൻ നമ്പർ"),
  filingDate: t("join_filingDate", "ഫയലിംഗ് തീയതി"),
  chequeAmount: t("join_amountClaimed", "ആവശ്യപ്പെടുന്ന തുക"),
  complainant: t("join_complainant", "പരാതിക്കാരൻ"),
  complainantAdvocate: t("join_complainantSAdvocate", "പരാതിക്കാരന്റെ അഭിഭാഷകൻ"),
  complainantAdvocateContact: t("join_contactTheComplainantSAdvocate", "പരാതിക്കാരന്റെ അഭിഭാഷകനെ ബന്ധപ്പെടുക"),
  complainantAdvocateContactBody: t("join_youCanContactTheComplainantSAdvocate", "പണമടയ്ക്കലോ ഒത്തുതീർപ്പോ ചർച്ച ചെയ്യാൻ പരാതിക്കാരന്റെ അഭിഭാഷകനെ ബന്ധപ്പെടാം."),
  callAdvocate: t("join_callAdvocate", "അഭിഭാഷകനെ വിളിക്കുക"),
  accusedAdvocate: t("join_accusedSAdvocate", "പ്രതിയുടെ അഭിഭാഷകൻ"),
  accusedParties: t("join_accused", "പ്രതികൾ"),
  otherAccused: t("join_otherAccused", "മറ്റ് പ്രതി"),
} as const;

export function fill(copy: Copy, locale: Locale, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    pick(copy, locale),
  );
}
