import type { Copy } from "@/lib/onboarding/content";

const t = (en: string): Copy => ({ en });

export const registrationUi = {
  backToSignIn: t("registration_backToSignIn"),
  /** Phone header: the arrow says "back", this names the destination. */
  backToSignInShort: t("registration_signIn"),
  back: t("registration_back"),
  continue: t("registration_continue"),
  stepOf: t("registration_stepCurrentOfTotal"),
  /* Backend failures any step can meet (integration, Oct 15). */
  unavailable: t("registration_couldnTReachTheServerCheckYour"),
  /** The verified number's session ended before the last step was sent. */
  sessionExpired: t("registration_yourVerificationHasExpiredVerifyYourMobile"),
} as const;

export const journeySteps = {
  role: { title: t("registration_role"), description: t("registration_howYouUseThePortal") },
  name: { title: t("registration_name"), description: t("registration_yourName") },
  contact: { title: t("registration_contact"), description: t("registration_mobileAndEmail") },
  password: { title: t("registration_password"), description: t("registration_secureYourAccount") },
  verification: { title: t("registration_verification"), description: t("registration_yourRegistrationDetails") },
  terms: { title: t("registration_terms"), description: t("registration_readAndAccept") },
} as const;

export const roleStep = {
  title: t("registration_howWillYouUseThisAccount"),
  body: t("registration_chooseTheOptionThatBestDescribesYou"),
  litigant: t("registration_litigant"),
  litigantHint: t("registration_aCaseIsAboutYouOrYou"),
  advocate: t("registration_advocate"),
  advocateHint: t("registration_youAreEnrolledWithAStateBar"),
  advocateClerk: t("registration_advocateClerk"),
  advocateClerkHint: t("registration_youAssistAnAdvocateWithCasesAnd"),
  poa: t("registration_powerOfAttorneyHolder"),
  poaHint: t("registration_youAreAuthorisedToActForA"),
  required: t("registration_chooseHowYouWillUseThisAccount"),
} as const;

/**
 * One field, not three.
 *
 * Splitting a name into first / middle / last is an assumption about how names are
 * built that a great many Indian names do not meet — a single given name, an initial
 * that expands to a father's name or a house name, a name that runs the other way
 * round. The court needs the name to match the ID that proves it, so that is what the
 * field asks for, in one line, exactly as it is printed.
 */
export const nameStep = {
  title: t("registration_yourName"),
  body: t("registration_enterYourNameExactlyAsItAppears"),
  fullName: t("registration_fullName"),
  fullNamePlaceholder: t("registration_asPrintedOnYourId"),
  fullNameHint: t("registration_theCourtMatchesThisAgainstTheId"),
  error: t("registration_enterYourNameAsItAppearsOn"),
} as const;

export const contactStep = {
  title: t("registration_yourContactDetails"),
  body: t("registration_useYourMobileNumberToRegisterEmail"),
  mobile: t("registration_mobileNumber"),
  mobilePlaceholder: t("registration_10DigitMobileNumber"),
  mobileError: t("registration_enterThe10DigitsOfYourMobile"),
  mobileHint: t("registration_weUseThisNumberForSignIn"),
  email: t("registration_emailAddressOptional"),
  emailPlaceholder: t("registration_nameExampleCom"),
  emailError: t("registration_enterAValidEmailAddress"),
  sendOtp: t("registration_sendOneTimeCode"),
  otpSent: t("registration_weSentA6DigitCodeTo"),
  otpLabel: t("registration_6DigitCode"),
  otpError: t("registration_enterAll6Digits"),
  otpVerify: t("registration_verify"),
  otpShow: t("registration_showTheCode"),
  otpHide: t("registration_hideTheCode"),
  otpResend: t("registration_sendTheCodeAgain"),
  /* Short on purpose: it sits in the slot the resend link takes over when the timer
     ends, so the two must be about one width — a sentence there wrapped under the
     reveal and then jumped to the right (owner, Sept 9). */
  otpResendIn: t("registration_sendAgainInSecondsS"),
  verified: t("registration_mobileNumberVerified"),
  changeNumber: t("registration_changeNumber"),
  verifyFirst: t("registration_verifyYourMobileNumberToContinue"),
  /* From the backend (integration, Oct 15). */
  mobileInvalid: t("registration_enterAValidIndianMobileNumber"),
  otpWrong: t("registration_thatCodeDidnTWorkCheckThe"),
  alreadyRegistered: t("registration_thisNumberAlreadyHasAnAccountGo"),
} as const;

/**
 * Creating the password the account signs in with.
 *
 * Sign-in offers a password as well as a one-time code, so registration has to produce
 * one — the flow used to reach the end without ever asking. The policy (the backend's,
 * mirrored in `lib/registration/password-policy.ts`) is stated once under the field at rest; while
 * the person types, that line becomes the one rule they are currently failing, or the
 * confirmation that the password works. One sentence at a time, never a checklist.
 */
export const passwordStep = {
  title: t("registration_createAPassword"),
  /* Required again (owner, Oct 15): the backend needs a password to finish registration.
     It was optional from Oct 8. */
  body: t("registration_youWillSignInWithThisPassword"),
  password: t("registration_password"),
  passwordPlaceholder: t("registration_enterAPassword"),
  confirm: t("registration_confirmPassword"),
  confirmPlaceholder: t("registration_enterItAgain"),
  show: t("registration_showPassword"),
  hide: t("registration_hidePassword"),
  /* Integration, Oct 23: the rules now match the backend's (password-policy.ts), so a
     password the backend would refuse is refused here. */
  /** At rest, before anything is typed. The whole policy in two short sentences. */
  rules: t("registration_atLeast8CharactersNotOnlyNumbers"),
  /** Live, while typing — the first rule the password is failing. */
  problem: {
    length: t("registration_useAtLeast8Characters"),
    tooLong: t("registration_use128CharactersOrFewer"),
    mobile: t("registration_tooSimilarToYourMobileNumber"),
    name: t("registration_tooSimilarToYourName"),
    email: t("registration_tooSimilarToYourEmail"),
    numeric: t("registration_addALetterOrSymbolNumbersAlone"),
    common: t("registration_tooEasyToGuessPickSomethingLess"),
  },
  /** Live, once every rule passes. */
  ok: t("registration_thisPasswordWorks"),
  /** Read out beside the tick in the confirm box; sighted people see the tick. */
  confirmMatch: t("registration_passwordsMatch"),
  confirmError: t("registration_bothPasswordsMustMatch"),
} as const;

/**
 * One step, two roles. The advocate and clerk verifications are the same screen with
 * different words — same as the legacy product, where one component served both.
 */
export const verificationSteps = {
  advocate: {
    title: t("registration_advocateVerification"),
    body: t("registration_toEnsureTheAuthenticityOfYourProfile"),
    numberLabel: t("registration_barRegistrationNumber"),
    numberPlaceholder: t("registration_forExampleK12342020"),
    numberError: t("registration_enterYourBarRegistrationNumber"),
    uploadLabel: t("registration_barCouncilId"),
    uploadHint: t("registration_ensureTheRegistrationNumberIsClearlyVisible"),
    uploadError: t("registration_uploadYourBarCouncilId"),
  },
  advocateClerk: {
    title: t("registration_advocateClerkVerification"),
    body: t("registration_toEnsureTheAuthenticityOfYourProfile"),
    numberLabel: t("registration_clerkRegistrationNumber"),
    numberPlaceholder: t("registration_yourClerkRegistrationNumber"),
    numberError: t("registration_enterYourClerkRegistrationNumber"),
    uploadLabel: t("registration_clerkId"),
    uploadHint: t("registration_ensureTheRegistrationNumberIsClearlyVisible"),
    uploadError: t("registration_uploadYourClerkId"),
  },
} as const;

export const verificationUi = {
  fileHelp: t("registration_jpgJpegPngOrPdfUpTo"),
  noFile: t("registration_noFileChosenYet"),
  chooseFile: t("registration_chooseFile"),
  changeFile: t("registration_changeFile"),
  removeFile: t("registration_remove"),
  /* Integration, Oct 19. A picked file
     the backend would refuse, said before anything is sent. */
  fileRejected: t("registration_chooseAJpgJpegPngOrPdf"),
  /** The server refused the upload as too large (413). */
  fileTooLargeForServer: t("registration_thisFileIsTooLargeToSend"),
} as const;

/**
 * The rejected-and-resubmit round. The officer types ONE general message on
 * rejection (PM, Sept 3); it shows on every step and is the whole feedback
 * (owner, Sept 18: no per-field flags), and the person corrects their details
 * and resubmits the same application.
 */
export const rejectionUi = {
  /** The first step's headline — the rejection is page structure, not an
      alarm box (owner, Sept 3). */
  notApprovedTitle: t("registration_yourRegistrationWasNotApproved"),
  notApprovedBody: t("registration_correctYourDetailsAndResubmitForApproval"),
  /** `{id}` is the application number the rejection belongs to. */
  messageMeta: t("registration_applicationIdMessageFromTheVerifyingOfficer"),
  /** A long message clamps to three lines; these toggle the rest. */
  readMore: t("registration_readMore"),
  showLess: t("registration_showLess"),
  /** sr-only suffix on a stepper step that needs correcting. */
  stepFlagged: t("registration_hasDetailsToCorrect"),
  mobileVerified: t("registration_verifiedThisIsTheNumberYouSign"),
  resubmit: t("registration_resubmitForApproval"),
  resubmittedTitle: t("registration_yourRegistrationIsAwaitingApproval"),
  resubmittedBody: t("registration_yourCorrectedRegistrationIdIdIsIn"),
  /* Integration, Oct 19.
     The application number is shown only when the backend sends a readable one
     (owner, Oct 19); until then these versions stand in for the {id} ones. */
  resubmittedBodyNoNumber: t("registration_yourCorrectedRegistrationIsInProgressYou"),
  messageMetaNoNumber: t("registration_messageFromTheVerifyingOfficer"),
  /** Under the upload on the correction step: what was sent before. `{file}` is its name. */
  lastUploaded: t("registration_youSentFileLastTime"),
  /** The correction can no longer be sent: the session ended, or it is not rejected now. */
  signInAgain: t("registration_thisCorrectionCanTBeSentRight"),
} as const;

export const termsStep = {
  title: t("registration_termsAndConditions"),
  body: t("registration_readAndAgreeToTheseTermsBefore"),
  clauses: [
    t("registration_byUsingThisAppYouAgreeTo"),
    t("registration_yourPrivacyIsParamountRestAssuredYour"),
    t("registration_pleaseRefrainFromEngagingInAnyUnlawful"),
    t("registration_weReserveTheRightToModifyOur"),
    t("registration_byProceedingIConsentToTheElectronic"),
  ],
  accept: t("registration_iHaveReadAndAcceptTheTerms"),
  error: t("registration_acceptTheTermsToCreateYourAccount"),
  submit: t("registration_acceptAndCreateAccount"),
} as const;

export const successStep = {
  title: t("registration_yourAccountIsReady"),
  body: t("registration_youCanAddYourAddressAndOfficial"),
  summonedAction: t("registration_continueToYourCase"),
  generalAction: t("registration_goToYourHomePage"),
} as const;

/** Advocates and clerks do not get access on submission — the court approves first. */
export const approvalStep = {
  title: t("registration_yourRegistrationIsAwaitingApproval"),
  /** `{id}` is the application number, shown so it can be quoted at the court. */
  body: t("registration_yourRegistrationIdIdIsInProgress"),
  action: t("registration_viewMyApplication"),
  /* Integration, Oct 19. Used until the backend sends a readable
     application number (owner, Oct 19); also what a pending account sees at sign-in. */
  bodyNoNumber: t("registration_yourRegistrationIsInProgressYouWill"),
} as const;

export const applicationView = {
  title: t("registration_applicationNumberId"),
  /** Until the backend sends a readable number (integration, Oct 19). */
  titleNoNumber: t("registration_yourApplication"),
  name: t("registration_name"),
  mobile: t("registration_mobileNumber"),
  email: t("registration_emailAddress"),
  role: t("registration_registeringAs"),
} as const;
