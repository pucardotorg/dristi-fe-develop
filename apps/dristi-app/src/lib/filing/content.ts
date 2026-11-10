import type { Copy } from "@/lib/onboarding/content";

export { fill as fillCopy } from "@/lib/join/content";

/**
 * Filings: content model for the bail application flow (Aug 24 brief).
 *
 * The flow starts on a case file (Appearance stage) from the "Make filings"
 * control: raise an application → type = bail → petitioner + grounds → optional
 * surety details for the bail bond → generated application → signature →
 * court fee → submitted. Legacy reference: the "Bail and Bail Bond Workflow"
 * walkthrough (Make a Submission page in the current DRISTI).
 *
 * Departures from legacy, all deliberate:
 * · Staged dialog instead of one long page: the app's flow surface.
 * · Legacy's locked "Submission Type: Application" field is dropped; the menu
 *   entry already said what this is.
 * · The unpaid court fee never blocks the submission; it becomes a pending
 *   task (the Aug 14 vakalatnama-fee decision, applied consistently).
 * · One consolidated note about surety phone/email use instead of legacy's
 *   per-field warning block.
 *
 * In this court's practice bail is ordinarily granted on sureties and the magistrate
 * usually asks for two, so the "yes" branch starts with two surety forms.
 */

const t = (en: string, ml: string): Copy => ({ en, ml });

/* ------------------------------------------------------------------- demo data */

/** Application fee for a bail application, in rupees (this court's schedule). */
export const BAIL_FEE = "₹50";

/** Demo submission identity shown on the success stage. */
export const BAIL_SUBMISSION_ID = "KL-000847-2026-AP1";
export const BAIL_SUBMISSION_DATE = "24-08-2026";

export type BailPetitioner = {
  id: string;
  name: string;
  /** Father's name from the case record, machine-prefilled and human-unverified. */
  father: string;
};

/** The accused this advocate represents on the demo case (same world as the
 *  join-flow fixtures); bail is applied for on their behalf. */
export const BAIL_PETITIONERS: BailPetitioner[] = [
  { id: "acc-1", name: "Rajan Krishnan Nair", father: "Krishnan Nair" },
  { id: "acc-2", name: "Suresh Babu P.", father: "Babu Pillai" },
];

export type ApplicationTypeOption = {
  id: string;
  label: Copy;
  /** Only the bail application is designed; the rest are separate flows. */
  available: boolean;
};

/** The legacy application-type list, unchanged in order. */
export const APPLICATION_TYPES: ApplicationTypeOption[] = [
  { id: "advancement", label: t("filing_advancementReschedule", "വാദം നേരത്തേയാക്കൽ / മാറ്റിവയ്ക്കൽ"), available: false },
  { id: "bail", label: t("filing_bail", "ജാമ്യം"), available: true },
  { id: "condonation", label: t("filing_condonationOfDelay", "കാലതാമസം മാപ്പാക്കൽ"), available: false },
  { id: "others", label: t("filing_others", "മറ്റുള്ളവ"), available: false },
  { id: "production", label: t("filing_productionOfDocuments", "രേഖകൾ ഹാജരാക്കൽ"), available: false },
  { id: "settlement", label: t("filing_settlement", "ഒത്തുതീർപ്പ്"), available: false },
  { id: "transfer", label: t("filing_transfer", "ട്രാൻസ്ഫർ"), available: false },
  { id: "withdrawal", label: t("filing_withdrawal", "പിൻവലിക്കൽ"), available: false },
];

/* ------------------------------------------------------------ bail bond fixtures */

/** Demo bond identity and the terms the magistrate set on the bail application. */
export const BOND_ID = "KL-000847-2026-BA1";
export const BOND_AMOUNT = "₹50,000";
/** The magistrate asked for one surety more than the application carried. */
export const BOND_REQUIRED_SURETIES = 3;
export const BOND_TASK_DUE = "28 Aug 2026";
/** The same deadline as an ISO date, for the ranked due-status line. */
export const BOND_TASK_DUE_ON = "2026-08-28";
/** The link the litigant and sureties receive by SMS/email. The demo route serves it. */
export const BOND_SIGN_LINK = "https://dristi-kerala.pucar.org/bond?code=na5An";
export const BOND_SIGN_PATH = "/bond";

export type BondSurety = {
  name: string;
  father: string;
  phone: string;
  email: string;
  /** One-line display address — the full split lives on the application record. */
  address: string;
};

/** Sureties carried over from the approved bail application. */
export const BOND_SURETIES: BondSurety[] = [
  {
    name: "Sunil Kumar V.",
    father: "Velayudhan",
    phone: "9148498792",
    email: "sunil.kumar@example.in",
    address: "Kadappakada · 691 008, Kerala",
  },
  {
    name: "Latha Devi R.",
    father: "Raghavan",
    phone: "9847654321",
    email: "",
    address: "Asramam · 691 002, Kerala",
  },
];

/** Stands in for the surety added while raising the bond (the magistrate asked
 *  for a third) — the status and edit surfaces show it as approved. */
export const BOND_THIRD_SURETY: BondSurety = {
  name: "Peethambaran K.",
  father: "Kesavan",
  phone: "9645011223",
  email: "",
  address: "Chinnakada · 691 001, Kerala",
};

/** The litigant the bond is for (petitioner on the approved application). */
export const BOND_LITIGANT = {
  name: "Rajan Krishnan Nair",
  father: "Krishnan Nair",
  phone: "9846012345",
};

/* -------------------------------------------------------------- case file menu */

export const filingsMenu = {
  makeFilings: t("filing_makeFilings", "ഫയലിംഗുകൾ ചെയ്യുക"),
  raiseApplication: t("filing_raiseAnApplication", "അപേക്ഷ സമർപ്പിക്കുക"),
  submitDocuments: t("filing_submitDocuments", "രേഖകൾ സമർപ്പിക്കുക"),
  generateBailBond: t("filing_generateBailBond", "ജാമ്യ ബോണ്ട് തയ്യാറാക്കുക"),
  stubNotice: t(
    "filing_thisFilingIsDesignedSeparatelyAndWill",
    "ഈ ഫയലിംഗ് പ്രത്യേകം രൂപകൽപ്പന ചെയ്യുന്നു; പിന്നീട് ചേർക്കും.",
  ),
} as const;

/* ------------------------------------------------------------------ the dialog */

export const bailDialog = {
  /* Under the heading (owner, 2026-10-14): the summons already sets the terms out.
     Malayalam drafted — needs review. */
  fromSummons: t(
    "filing_theBailConditionsArePrintedOnThe",
    "ജാമ്യ വ്യവസ്ഥകൾ സമൻസിൽ “കേസ് എതിർക്കുക” എന്നതിന് കീഴിൽ അച്ചടിച്ചിട്ടുണ്ട്. അവിടെ നിന്ന് പകർത്താം.",
  ),
  /* closing midway: the same question every filing dialog asks */
  discardTitle: t("filing_discardThisApplication", "ഈ അപേക്ഷ ഉപേക്ഷിക്കണോ?"),
  discardBody: t(
    "filing_anythingYouEnteredWillBeLost",
    "നിങ്ങൾ നൽകിയതെല്ലാം നഷ്ടപ്പെടും.",
  ),
  discardKeep: t("filing_keepEditing", "തിരുത്തൽ തുടരുക"),
  discardConfirm: t("filing_discard", "ഉപേക്ഷിക്കുക"),
  title: t("filing_bailApplication", "ജാമ്യാപേക്ഷ"),

  /* application details */
  detailsBody: t(
    "filing_setOutTheGroundsTheApplicationIs",
    "കാരണങ്ങൾ വ്യക്തമാക്കുക. ഈ വിവരങ്ങളിൽ നിന്ന് അപേക്ഷ നിങ്ങൾക്കായി തയ്യാറാക്കും.",
  ),
  typeLabel: t("filing_applicationType", "അപേക്ഷയുടെ തരം"),
  typePlaceholder: t("filing_selectAType", "തരം തിരഞ്ഞെടുക്കുക"),
  typeError: t("filing_chooseTheApplicationType", "അപേക്ഷയുടെ തരം തിരഞ്ഞെടുക്കുക."),
  typeOnlyBailNote: t(
    "filing_onlyTheBailApplicationIsBuiltIn",
    "ഈ പ്രോട്ടോടൈപ്പിൽ ജാമ്യാപേക്ഷ മാത്രമാണ് തയ്യാറായിട്ടുള്ളത്. മറ്റ് തരങ്ങൾ പ്രത്യേക പ്രവാഹങ്ങളാണ്; പിന്നീട് ഇവിടെ തുറക്കും.",
  ),
  petitionerLabel: t("filing_petitioner", "ഹർജിക്കാരൻ"),
  petitionerPlaceholder: t("filing_chooseTheLitigant", "കക്ഷിയെ തിരഞ്ഞെടുക്കുക"),
  petitionerError: t("filing_chooseThePetitioner", "ഹർജിക്കാരനെ തിരഞ്ഞെടുക്കുക."),
  fatherLabel: t("filing_petitionerSFatherSName", "ഹർജിക്കാരന്റെ പിതാവിന്റെ പേര്"),
  fatherError: t("filing_enterTheFatherSName", "പിതാവിന്റെ പേര് നൽകുക."),
  groundsLabel: t("filing_groundsAndReasonsForBail", "ജാമ്യത്തിനുള്ള കാരണങ്ങളും ന്യായങ്ങളും"),
  groundsHint: t(
    "filing_thisTextGoesIntoTheGeneratedApplication",
    "നിങ്ങൾ എഴുതുന്നതുപോലെ ഈ വാചകം തയ്യാറാക്കുന്ന അപേക്ഷയിൽ ചേരും.",
  ),
  groundsError: t("filing_setOutTheGroundsForBail", "ജാമ്യത്തിനുള്ള കാരണങ്ങൾ നൽകുക."),
  commentsLabel: t("filing_comments", "അഭിപ്രായങ്ങൾ"),
  optional: t("filing_optional", "നിർബന്ധമല്ല"),
  /* prayer and supporting documents (Application Lifecycle PRD, Bail) */
  prayerLabel: t("filing_prayer", "പ്രാർത്ഥന"),
  prayerDefault: t(
    "filing_thatThePetitionerBeReleasedOnBail",
    "ഈ കോടതിക്ക് ഉചിതമെന്ന് തോന്നുന്ന വ്യവസ്ഥകളിൽ ഹർജിക്കാരനെ ജാമ്യത്തിൽ വിട്ടയക്കണമെന്ന്.",
  ),
  prayerHint: t(
    "filing_whatYouAskTheCourtToOrder",
    "കോടതി ഉത്തരവിടണമെന്ന് നിങ്ങൾ ആവശ്യപ്പെടുന്നത്. ആവശ്യമെങ്കിൽ മാറ്റുക.",
  ),
  prayerError: t("filing_enterThePrayer", "പ്രാർത്ഥന നൽകുക."),
  documentsHeading: t("filing_supportingDocuments", "അനുബന്ധ രേഖകൾ"),
  documentsAdd: t("filing_addADocument", "രേഖ ചേർക്കുക"),
  documentsAddAnother: t("filing_addAnotherDocument", "മറ്റൊരു രേഖ ചേർക്കുക"),
  documentTitleN: t("filing_documentN", "രേഖ {n}"),
  removeDocument: t("filing_removeDocumentN", "രേഖ {n} നീക്കം ചെയ്യുക"),
  documentType: t("filing_documentType", "രേഖയുടെ തരം"),
  documentTitle: t("filing_documentTitle", "രേഖയുടെ പേര്"),
  documentFile: t("filing_file", "ഫയൽ"),
  documentTypeError: t("filing_enterTheDocumentType", "രേഖയുടെ തരം നൽകുക."),
  documentTitleError: t("filing_enterTheDocumentTitle", "രേഖയുടെ പേര് നൽകുക."),
  documentFileError: t("filing_uploadTheDocument", "രേഖ അപ്‌ലോഡ് ചെയ്യുക."),
  changeFile: t("filing_changeFile", "ഫയൽ മാറ്റുക"),
  removeFile: t("filing_remove", "നീക്കം ചെയ്യുക"),

  /* sureties */
  suretiesTitle: t("filing_suretyDetails", "ജാമ്യക്കാരുടെ വിവരങ്ങൾ"),
  suretiesBody: t(
    "filing_bailHereIsOrdinarilyGrantedOnSureties",
    "ഇവിടെ സാധാരണയായി ജാമ്യക്കാരുടെ ഉറപ്പിന്മേലാണ് ജാമ്യം അനുവദിക്കുന്നത്, ഹർജിക്കാരന് വേണ്ടി ഉറപ്പുനൽകുന്നവർ. മജിസ്‌ട്രേറ്റ് സാധാരണ രണ്ട് പേരെ ആവശ്യപ്പെടും.",
  ),
  suretyQuestion: t(
    "filing_doYouWantToAddSuretyDetails",
    "ജാമ്യാപേക്ഷയിൽ ജാമ്യക്കാരുടെ വിവരങ്ങൾ ചേർക്കണോ?",
  ),
  yes: t("filing_yes", "അതെ"),
  no: t("filing_no", "ഇല്ല"),
  suretyChoiceError: t("filing_chooseYesOrNo", "അതെ അല്ലെങ്കിൽ ഇല്ല തിരഞ്ഞെടുക്കുക."),
  contactNote: t(
    "filing_eachSuretyGetsALinkBySms",
    "ജാമ്യ ബോണ്ടിൽ ഒപ്പിടാനുള്ള ലിങ്ക് ഓരോ ജാമ്യക്കാരനും SMS വഴി, ഇമെയിൽ നൽകിയാൽ അതുവഴിയും, ലഭിക്കും. നമ്പർ അവരുടേത് തന്നെയെന്ന് ഉറപ്പാക്കുക; തെറ്റായ വിവരം നൽകിയാൽ നിങ്ങൾക്കെതിരെ നടപടിയുണ്ടാകാം.",
  ),
  suretyTitle: t("filing_suretyN", "ജാമ്യക്കാരൻ {n}"),
  removeSurety: t("filing_removeSuretyN", "ജാമ്യക്കാരൻ {n}-നെ നീക്കം ചെയ്യുക"),
  addSurety: t("filing_addAnotherSurety", "മറ്റൊരു ജാമ്യക്കാരനെ ചേർക്കുക"),
  fullNameLabel: t("filing_fullName", "മുഴുവൻ പേര്"),
  suretyFatherLabel: t("filing_fatherSName", "പിതാവിന്റെ പേര്"),
  phoneLabel: t("filing_mobileNumber", "മൊബൈൽ നമ്പർ"),
  emailLabel: t("filing_emailAddress", "ഇമെയിൽ വിലാസം"),
  addressHeading: t("filing_address", "വിലാസം"),
  address1Label: t("filing_addressLine1", "വിലാസം വരി 1"),
  cityLabel: t("filing_cityOrTown", "നഗരം / പട്ടണം"),
  pincodeLabel: t("filing_pinCode", "പിൻ കോഡ്"),
  districtLabel: t("filing_district", "ജില്ല"),
  stateLabel: t("filing_state", "സംസ്ഥാനം"),
  idProofLabel: t("filing_identityProof", "തിരിച്ചറിയൽ രേഖ"),
  solvencyLabel: t("filing_proofOfSolvency", "സാമ്പത്തിക ശേഷിയുടെ തെളിവ്"),
  solvencyHint: t(
    "filing_forExampleALandTaxReceiptOr",
    "ഉദാഹരണത്തിന്, ഭൂനികുതി രസീത് അല്ലെങ്കിൽ വസ്തുവിന്റെ രേഖ.",
  ),
  otherDocsLabel: t("filing_otherDocuments", "മറ്റ് രേഖകൾ"),
  docHelp: t(
    "filing_uploadAJpgJpegPngOrPdf",
    "10 MB വരെ വലുപ്പമുള്ള JPG, JPEG, PNG അല്ലെങ്കിൽ PDF അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  requiredError: t("filing_thisFieldIsRequired", "ഈ വിവരം നിർബന്ധമാണ്."),
  phoneError: t("filing_enterAValid10DigitMobileNumber", "സാധുവായ 10 അക്ക മൊബൈൽ നമ്പർ നൽകുക."),
  pincodeError: t("filing_enterThe6DigitPinCode", "6 അക്ക പിൻ കോഡ് നൽകുക."),
  idProofError: t("filing_uploadTheIdentityProof", "തിരിച്ചറിയൽ രേഖ അപ്‌ലോഡ് ചെയ്യുക."),
  solvencyError: t("filing_uploadTheProofOfSolvency", "സാമ്പത്തിക ശേഷിയുടെ തെളിവ് അപ്‌ലോഡ് ചെയ്യുക."),
  generateApplication: t("filing_generateApplication", "അപേക്ഷ തയ്യാറാക്കുക"),
  generating: t("filing_preparingYourApplication", "നിങ്ങളുടെ അപേക്ഷ തയ്യാറാക്കുന്നു…"),

  /* review */
  reviewTitle: t("filing_reviewTheApplication", "അപേക്ഷ പരിശോധിക്കുക"),
  reviewBody: t(
    "filing_checkTheGeneratedApplicationBeforeYouSign",
    "ഒപ്പിടുന്നതിന് മുൻപ് തയ്യാറാക്കിയ അപേക്ഷ പരിശോധിക്കുക.",
  ),
  summaryType: t("filing_applicationType", "അപേക്ഷയുടെ തരം"),
  summaryDate: t("filing_submissionDate", "സമർപ്പണ തീയതി"),
  summaryPetitioner: t("filing_petitioner", "ഹർജിക്കാരൻ"),
  summarySureties: t("filing_sureties", "ജാമ്യക്കാർ"),
  suretiesNone: t("filing_noneAdded", "ചേർത്തിട്ടില്ല"),
  suretiesCount: t("filing_countAdded", "{count} പേരെ ചേർത്തു"),
  draftCourtLine: t(
    "filing_beforeTheSpecialCourtOfJudicialMagistrate",
    "NI ആക്ട് 1881 വകുപ്പ് 138 പ്രകാരമുള്ള കേസുകളുടെ വിചാരണയ്ക്കായുള്ള ഒന്നാം ക്ലാസ് ജുഡീഷ്യൽ മജിസ്‌ട്രേറ്റിന്റെ പ്രത്യേക കോടതി മുൻപാകെ (“24×7 ON കോടതി”)",
  ),
  draftCaseLine: t("filing_caseNoCasenumber", "കേസ് നമ്പർ: {caseNumber}"),
  draftMatterLine: t("filing_inTheMatterOfTitle", "വിഷയം: {title}"),
  draftPageLabel: t("filing_page1Of2Draft", "പേജ് 1 / 2 · കരട്"),

  /* signature */
  signTitle: t("filing_addYourSignature", "നിങ്ങളുടെ ഒപ്പ് ചേർക്കുക"),
  signBody: t(
    "filing_signTheApplicationToSubmitItTo",
    "കോടതിയിൽ സമർപ്പിക്കാൻ അപേക്ഷയിൽ ഒപ്പിടുക.",
  ),
  tabEsign: t("filing_eSignWithAadhaar", "ആധാർ ഇ-സൈൻ"),
  tabUploadSigned: t("filing_uploadASignedCopy", "ഒപ്പിട്ട പകർപ്പ് അപ്‌ലോഡ് ചെയ്യുക"),
  esignNote: t(
    "filing_youWillBeTakenToTheAadhaar",
    "ആധാർ ഇ-സൈൻ സേവനത്തിലേക്ക് നിങ്ങളെ കൊണ്ടുപോകും; ആധാറുമായി ബന്ധിപ്പിച്ച മൊബൈൽ നമ്പറിലേക്ക് അയയ്ക്കുന്ന OTP ഉപയോഗിച്ച് പരിശോധിക്കും.",
  ),
  esignAction: t("filing_eSignWithAadhaar", "ആധാർ ഉപയോഗിച്ച് ഇ-സൈൻ ചെയ്യുക"),
  downloadDraft: t("filing_downloadTheApplication", "അപേക്ഷ ഡൗൺലോഡ് ചെയ്യുക"),
  downloadDraftPrototype: t(
    "filing_theApplicationPdfWillDownloadHere",
    "അപേക്ഷയുടെ PDF ഇവിടെ ഡൗൺലോഡ് ആകും.",
  ),
  uploadSignedHint: t(
    "filing_downloadTheApplicationSignItAndUpload",
    "അപേക്ഷ ഡൗൺലോഡ് ചെയ്ത് ഒപ്പിട്ട ശേഷം ഒപ്പിട്ട പകർപ്പ് അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  signedDocLabel: t("filing_signedApplication", "ഒപ്പിട്ട അപേക്ഷ"),
  signedNote: t("filing_signedByName", "{name} ഒപ്പിട്ടു"),
  signError: t(
    "filing_signTheApplicationBeforeContinuing",
    "തുടരുന്നതിന് മുൻപ് അപേക്ഷയിൽ ഒപ്പിടുക.",
  ),

  /* court fee */
  payTitle: t("filing_courtFee", "കോടതി ഫീസ്"),
  payBody: t(
    "filing_payTheApplicationFeeToCompleteThe",
    "സമർപ്പണം പൂർത്തിയാക്കാൻ അപേക്ഷാ ഫീസ് അടയ്ക്കുക.",
  ),
  feeLine: t("filing_applicationFee", "അപേക്ഷാ ഫീസ്"),
  totalLine: t("filing_total", "ആകെ"),
  // Legacy copy, kept verbatim per the Aug 24 review.
  offlineNote: t(
    "filing_pleaseVisitTheNyayMitraToMake",
    "ഈ ഫീസ് നേരിട്ട് അടയ്ക്കാൻ ദയവായി ന്യായ മിത്രയെ സമീപിക്കുക.",
  ),
  payNow: t("filing_payFeeNow", "{fee} ഇപ്പോൾ അടയ്ക്കുക"),
  payLater: t("filing_payLater", "പിന്നീട് അടയ്ക്കാം"),
  /* Malayalam drafted — needs review. */
  paidBody: t(
    "filing_theApplicationFeeIsPaidContinueTo",
    "അപേക്ഷാ ഫീസ് അടച്ചു. അപേക്ഷ ഫയൽ ചെയ്യാൻ തുടരുക.",
  ),

  /* submitted */
  doneTitle: t("filing_bailApplicationSubmitted", "ജാമ്യാപേക്ഷ സമർപ്പിച്ചു"),
  doneBody: t(
    "filing_theCourtHasReceivedYourApplicationYou",
    "നിങ്ങളുടെ അപേക്ഷ കോടതിക്ക് ലഭിച്ചു. തീരുമാനമാകുമ്പോൾ SMS വഴി അറിയിക്കും.",
  ),
  submittedOn: t("filing_submittedOn", "സമർപ്പിച്ച തീയതി"),
  submissionIdLabel: t("filing_submissionId", "സമർപ്പണ ഐഡി"),
  copyId: t("filing_copySubmissionId", "സമർപ്പണ ഐഡി പകർത്തുക"),
  copiedId: t("filing_copied", "പകർത്തി"),
  paymentLabel: t("filing_courtFee", "കോടതി ഫീസ്"),
  paymentPaid: t("filing_feePaid", "{fee} അടച്ചു"),
  paymentDeferred: t("filing_underTakeAction", "നിങ്ങളുടെ ബാക്കിയുള്ള ജോലികളിൽ"),
  feeTaskNote: t(
    "filing_theFeeCourtFeeHasBeenAdded",
    "{fee} കോടതി ഫീസ് നിങ്ങളുടെ ബാക്കിയുള്ള ജോലികളിൽ ചേർത്തു. അപേക്ഷ ഇതിനകം കോടതിയിലാണ്.",
  ),
  suretySentNote: t(
    "filing_eachSuretyHasBeenSentALink",
    "ജാമ്യ ബോണ്ടിൽ ഒപ്പിടാനുള്ള ലിങ്ക് ഓരോ ജാമ്യക്കാരനും അയച്ചിട്ടുണ്ട്.",
  ),
  downloadApplication: t("filing_downloadApplication", "അപേക്ഷ ഡൗൺലോഡ് ചെയ്യുക"),
  downloadApplicationPrototype: t(
    "filing_theSubmittedApplicationPdfWillDownloadHere",
    "സമർപ്പിച്ച അപേക്ഷയുടെ PDF ഇവിടെ ഡൗൺലോഡ് ആകും.",
  ),
  doneClose: t("filing_done", "പൂർത്തിയായി"),

  /* document preview copy (shared preview dialog needs its own words) */
  docPreviewTitle: t("filing_documentPreview", "രേഖയുടെ പ്രിവ്യൂ"),
  docPreviewBody: t(
    "filing_checkTheUploadedDocumentBeforeContinuing",
    "തുടരുന്നതിന് മുൻപ് അപ്‌ലോഡ് ചെയ്ത രേഖ പരിശോധിക്കുക.",
  ),
  docPreviewAlt: t(
    "filing_previewOfTheUploadedDocument",
    "അപ്‌ലോഡ് ചെയ്ത രേഖയുടെ പ്രിവ്യൂ",
  ),

  /* notifications */
  notifTitle: t(
    "filing_bailApplicationSubmittedForCasenumber",
    "{caseNumber} കേസിൽ ജാമ്യാപേക്ഷ സമർപ്പിച്ചു",
  ),
  notifBody: t(
    "filing_submissionIdIdYouWillBeTold",
    "സമർപ്പണ ഐഡി {id}. തീരുമാനമാകുമ്പോൾ SMS വഴി അറിയിക്കും.",
  ),
} as const;

/* ------------------------------------------------------------------- bail bond */

export const bondCopy = {
  /* pending task on the case file */
  pendingTitle: t("filing_takeAction", "ബാക്കിയുള്ള ജോലികൾ"),
  taskRaiseBond: t("filing_raiseBailBond", "ജാമ്യ ബോണ്ട് സമർപ്പിക്കുക"),
  taskDue: t("filing_dueDate", "{date}-നകം"),
  taskNote: t(
    "filing_theMagistrateHasApprovedTheBailApplication",
    "മജിസ്‌ട്രേറ്റ് ജാമ്യാപേക്ഷ അംഗീകരിച്ച് ജാമ്യ ബോണ്ട് ആവശ്യപ്പെട്ടിരിക്കുന്നു.",
  ),

  /* bail bonds list on the case file */
  bondsTitle: t("filing_bailBonds", "ജാമ്യ ബോണ്ടുകൾ"),
  bondTypeSurety: t("filing_suretyBond", "ജാമ്യക്കാരുള്ള ബോണ്ട്"),
  bondTypePersonal: t("filing_personalBond", "വ്യക്തിഗത ബോണ്ട്"),
  statusPendingSign: t("filing_pendingSignatures", "ഒപ്പുകൾ ബാക്കി"),
  statusPendingReview: t("filing_pendingCourtReview", "കോടതി പരിശോധന ബാക്കി"),

  /* details stage */
  title: t("filing_bailBondDetails", "ജാമ്യ ബോണ്ട് വിവരങ്ങൾ"),
  taskBody: t(
    "filing_theMagistrateHasSetTheBailTerms",
    "മജിസ്‌ട്രേറ്റ് ജാമ്യ വ്യവസ്ഥകൾ നിശ്ചയിച്ചു. ബോണ്ട് തയ്യാറാക്കാൻ ജാമ്യക്കാരുടെ വിവരങ്ങൾ പൂർത്തിയാക്കുക.",
  ),
  directBody: t(
    "filing_generateABailBondDirectlyIfThe",
    "ജാമ്യ ബോണ്ട് നേരിട്ട് തയ്യാറാക്കുക. മജിസ്‌ട്രേറ്റ് ജാമ്യാപേക്ഷയിൽ വ്യവസ്ഥകൾ നിശ്ചയിച്ചിട്ടുണ്ടെങ്കിൽ ആ ബാക്കിയുള്ള ജോലിയിൽ നിന്ന് ബോണ്ട് സമർപ്പിക്കുക.",
  ),
  editBody: t(
    "filing_onlyContactDetailsCanBeEditedThe",
    "ബന്ധപ്പെടാനുള്ള വിവരങ്ങൾ മാത്രമേ മാറ്റാനാകൂ. ജാമ്യ വ്യവസ്ഥകളും ജാമ്യക്കാരും മജിസ്‌ട്രേറ്റ് അംഗീകരിച്ചതുപോലെ തുടരും.",
  ),
  termsHeading: t("filing_setByTheMagistrate", "മജിസ്‌ട്രേറ്റ് നിശ്ചയിച്ചത്"),
  termsNote: t(
    "filing_toChangeTheBailAmountTypeOr",
    "ജാമ്യ തുക, തരം, ജാമ്യക്കാരുടെ എണ്ണം എന്നിവ മാറ്റാൻ പുതിയ ജാമ്യാപേക്ഷ സമർപ്പിക്കുക.",
  ),
  amountLabel: t("filing_bailAmount", "ജാമ്യ തുക"),
  amountError: t("filing_enterTheBailAmount", "ജാമ്യ തുക നൽകുക."),
  typeLabel: t("filing_bailType", "ജാമ്യ തരം"),
  typeSurety: t("filing_bailSurety", "ജാമ്യക്കാരുള്ള ജാമ്യം"),
  typePersonal: t("filing_personalBond", "വ്യക്തിഗത ബോണ്ട്"),
  typePersonalNote: t(
    "filing_aPersonalBondIsTheLitigantS",
    "വ്യക്തിഗത ബോണ്ട് കക്ഷിയുടെ സ്വന്തം ഉറപ്പാണ്; ജാമ്യക്കാർ ആവശ്യമില്ല.",
  ),
  suretiesRequiredLabel: t("filing_suretiesRequired", "ആവശ്യമായ ജാമ്യക്കാർ"),
  suretiesRequiredError: t(
    "filing_enterHowManySuretiesTheBondCarries",
    "ബോണ്ടിൽ എത്ര ജാമ്യക്കാർ വേണമെന്ന് നൽകുക.",
  ),
  fromApplication: t("filing_fromTheBailApplication", "ജാമ്യാപേക്ഷയിൽ നിന്ന്"),
  lockedSuretyNote: t(
    "filing_approvedByTheMagistrateOnlyTheMobile",
    "മജിസ്‌ട്രേറ്റ് അംഗീകരിച്ചത്. മൊബൈൽ നമ്പറും ഇമെയിലും മാത്രമേ മാറ്റാനാകൂ.",
  ),
  addMoreNote: t(
    "filing_theMagistrateAskedForNSuretiesAdd",
    "മജിസ്‌ട്രേറ്റ് {n} ജാമ്യക്കാരെ ആവശ്യപ്പെട്ടു. താഴെ {k} പേരെ കൂടി ചേർക്കുക.",
  ),
  showDetails: t("filing_showDetails", "വിവരങ്ങൾ കാണിക്കുക"),
  hideDetails: t("filing_hideDetails", "വിവരങ്ങൾ മറയ്ക്കുക"),
  addressLabel: t("filing_address", "വിലാസം"),
  reviewBond: t("filing_reviewBailBond", "ജാമ്യ ബോണ്ട് പരിശോധിക്കുക"),
  generatingBond: t("filing_preparingTheBailBond", "ജാമ്യ ബോണ്ട് തയ്യാറാക്കുന്നു…"),

  /* review stage */
  reviewTitle: t("filing_reviewTheBailBond", "ജാമ്യ ബോണ്ട് പരിശോധിക്കുക"),
  reviewBody: t(
    "filing_checkTheGeneratedBondBeforeYouSign",
    "ഒപ്പിടുന്നതിന് മുൻപ് തയ്യാറാക്കിയ ബോണ്ട് പരിശോധിക്കുക.",
  ),
  expandBond: t("filing_viewFullScreen", "മുഴുവൻ സ്ക്രീനിൽ കാണുക"),
  downloadBond: t("filing_downloadTheBailBond", "ജാമ്യ ബോണ്ട് ഡൗൺലോഡ് ചെയ്യുക"),
  downloadBondPrototype: t(
    "filing_theBailBondPdfWillDownloadHere",
    "ജാമ്യ ബോണ്ടിന്റെ PDF ഇവിടെ ഡൗൺലോഡ് ആകും.",
  ),
  formLine: t("filing_formNo37", "ഫോം നമ്പർ 37"),
  bondDocTitle: t("filing_bailBond", "ജാമ്യ ബോണ്ട്"),
  sectionLine: t(
    "filing_section426Or499CriminalProcedureCode",
    "(ക്രിമിനൽ നടപടി നിയമം, വകുപ്പ് 426 അല്ലെങ്കിൽ 499)",
  ),
  bondBody1: t(
    "filing_iNameSonOfFatherHavingBeen",
    "ഈ കോടതി മുൻപാകെ ഹാജരാക്കപ്പെട്ട്, ഹാജരിന് ഉറപ്പ് നൽകാൻ ആവശ്യപ്പെട്ട ഞാൻ, {father}-ന്റെ മകൻ {name}, കേസ് തീർപ്പാകുംവരെ എല്ലാ വാദദിവസവും ഹാജരാകാമെന്ന് ഉറപ്പുനൽകുന്നു.",
  ),
  bondBody2: t(
    "filing_inDefaultIBindMyselfToForfeit",
    "വീഴ്ച വരുത്തിയാൽ {amount} തുക സർക്കാരിലേക്ക് കണ്ടുകെട്ടാമെന്ന് ഞാൻ സമ്മതിക്കുന്നു.",
  ),
  bondSuretyClause: t(
    "filing_weSuretiesDeclareOurselvesSuretiesForThe",
    "മുകളിൽ പറഞ്ഞ {name}-ന് വേണ്ടി ഓരോരുത്തർക്കും {amount} വീതം ഉറപ്പുനൽകുന്ന ജാമ്യക്കാരായി ഞങ്ങൾ, {sureties}, സ്വയം പ്രഖ്യാപിക്കുന്നു.",
  ),
  proceedToSign: t("filing_proceedToSign", "ഒപ്പിടാൻ തുടരുക"),

  /* sign stage */
  signBody: t(
    "filing_signTheBailBondToSubmitIt",
    "കോടതിയിൽ സമർപ്പിക്കാൻ ജാമ്യ ബോണ്ടിൽ ഒപ്പിടുക.",
  ),
  uploadBondHint: t(
    "filing_downloadTheBailBondCollectTheSignatures",
    "ജാമ്യ ബോണ്ട് ഡൗൺലോഡ് ചെയ്ത്, കക്ഷിയുടെയും എല്ലാ ജാമ്യക്കാരുടെയും ഒപ്പുകൾ ശേഖരിച്ച്, ഒപ്പിട്ട പകർപ്പ് അപ്‌ലോഡ് ചെയ്യുക.",
  ),
  signedBondLabel: t("filing_signedBailBond", "ഒപ്പിട്ട ജാമ്യ ബോണ്ട്"),
  submitBond: t("filing_submitBailBond", "ജാമ്യ ബോണ്ട് സമർപ്പിക്കുക"),

  /* done stage */
  doneTitle: t("filing_bailBondSubmitted", "ജാമ്യ ബോണ്ട് സമർപ്പിച്ചു"),
  doneBodyEsign: t(
    "filing_theLitigantAndEachSuretyHaveBeen",
    "ഒപ്പുകൾ ചേർക്കാനുള്ള ലിങ്ക് കക്ഷിക്കും ഓരോ ജാമ്യക്കാരനും SMS വഴി, ഇമെയിൽ നൽകിയാൽ അതുവഴിയും, അയച്ചിട്ടുണ്ട്.",
  ),
  doneBodyUpload: t(
    "filing_theSignedBondIsWithTheCourt",
    "ഒപ്പിട്ട ബോണ്ട് കോടതിയുടെ പരിശോധനയ്ക്കായി സമർപ്പിച്ചു.",
  ),
  doneTitleEdited: t("filing_bailBondUpdated", "ജാമ്യ ബോണ്ട് പുതുക്കി"),
  doneBodyEdited: t(
    "filing_earlierSignaturesStandInvalidatedTheLitigantAnd",
    "മുൻ ഒപ്പുകൾ അസാധുവായി. കക്ഷിയോടും ഓരോ ജാമ്യക്കാരനോടും വീണ്ടും ഒപ്പിടാൻ ആവശ്യപ്പെട്ടിട്ടുണ്ട്.",
  ),
  bondIdLabel: t("filing_bondId", "ബോണ്ട് ഐഡി"),
  signLinkLabel: t("filing_signingLink", "ഒപ്പിടാനുള്ള ലിങ്ക്"),
  copyLink: t("filing_copySigningLink", "ഒപ്പിടാനുള്ള ലിങ്ക് പകർത്തുക"),
  copiedLink: t("filing_copied", "പകർത്തി"),
  openLinkDemo: t("filing_openTheSigningLink", "ഒപ്പിടാനുള്ള ലിങ്ക് തുറക്കുക"),
  openLinkDemoHint: t(
    "filing_opensWhatTheLitigantAndSuretiesReceive",
    "കക്ഷിക്കും ജാമ്യക്കാർക്കും ലഭിക്കുന്നത് തുറക്കും.",
  ),

  /* status dialog (advocate) */
  esignStatusHeading: t("filing_eSignStatus", "ഇ-സൈൻ നില"),
  roleLitigant: t("filing_litigant", "കക്ഷി"),
  roleSurety: t("filing_suretyN", "ജാമ്യക്കാരൻ {n}"),
  roleAdvocate: t("filing_advocate", "അഭിഭാഷക"),
  signedStatus: t("filing_signed", "ഒപ്പിട്ടു"),
  pendingStatus: t("filing_pending", "ബാക്കി"),
  editDetails: t("filing_editDetails", "വിവരങ്ങൾ മാറ്റുക"),
  invalidateTitle: t("filing_editTheBailBond", "ജാമ്യ ബോണ്ട് മാറ്റണോ?"),
  invalidateBody: t(
    "filing_editingInvalidatesEverySignatureAlreadyMadeYours",
    "മാറ്റം വരുത്തിയാൽ ഇതിനകം ചെയ്ത എല്ലാ ഒപ്പുകളും (നിങ്ങളുടേതും കക്ഷിയുടേതും ഓരോ ജാമ്യക്കാരന്റേതും) അസാധുവാകും. എല്ലാവരും വീണ്ടും ഒപ്പിടേണ്ടിവരും.",
  ),
  invalidateConfirm: t("filing_editAndInvalidate", "മാറ്റി ഒപ്പുകൾ അസാധുവാക്കുക"),
  cancel: t("filing_cancel", "റദ്ദാക്കുക"),

  /* party signing page (/bond) */
  partyTitle: t("filing_signTheBailBond", "ജാമ്യ ബോണ്ടിൽ ഒപ്പിടുക"),
  partyIntro: t(
    "filing_aBailBondInCasenumberTitleNeeds",
    "{caseNumber} · {title} കേസിലെ ജാമ്യ ബോണ്ടിൽ കക്ഷിയായോ ജാമ്യക്കാരനായോ നിങ്ങളുടെ ഒപ്പ് ആവശ്യമാണ്.",
  ),
  partyPhoneHelp: t(
    "filing_enterTheMobileNumberGivenToThe",
    "കോടതിക്ക് നൽകിയിട്ടുള്ള നിങ്ങളുടെ മൊബൈൽ നമ്പർ നൽകുക.",
  ),
  partyPhoneDemo: t(
    "filing_try9846012345Litigant9148498792Or",
    "പരീക്ഷിക്കുക: 98460 12345 (കക്ഷി) · 91484 98792 അല്ലെങ്കിൽ 98476 54321 (ജാമ്യക്കാർ)",
  ),
  partyPhoneUnknown: t(
    "filing_thisNumberIsNotOnTheBail",
    "ഈ നമ്പർ ജാമ്യ ബോണ്ടിലില്ല. ഇത് സമർപ്പിച്ച അഭിഭാഷകനോട് പരിശോധിക്കുക.",
  ),
  partyYou: t("filing_you", "(നിങ്ങൾ)"),
  proceedEsign: t("filing_proceedToESign", "ഇ-സൈൻ ചെയ്യാൻ തുടരുക"),
  partySignedTitle: t("filing_youHaveSignedTheBailBond", "നിങ്ങൾ ജാമ്യ ബോണ്ടിൽ ഒപ്പിട്ടു"),
  partySignedBody: t(
    "filing_theCourtWillBeToldWhenEveryone",
    "എല്ലാവരും ഒപ്പിട്ടുകഴിയുമ്പോൾ കോടതിയെ അറിയിക്കും. നിങ്ങളിൽ നിന്ന് ഇനിയൊന്നും ആവശ്യമില്ല.",
  ),

  /* notification */
  notifBondTitle: t(
    "filing_bailBondSubmittedForCasenumber",
    "{caseNumber} കേസിൽ ജാമ്യ ബോണ്ട് സമർപ്പിച്ചു",
  ),
  notifBondBody: t(
    "filing_bondIdIdTheLitigantAndSureties",
    "ബോണ്ട് ഐഡി {id}. കക്ഷിയോടും ജാമ്യക്കാരോടും ഒപ്പിടാൻ ആവശ്യപ്പെട്ടിട്ടുണ്ട്.",
  ),
} as const;
