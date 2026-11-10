/**
 * Sign-in — content model.
 *
 * Kept out of the component for the same reason the onboarding content is: the copy is
 * the design here, and it has to be reviewable by someone who does not read TSX.
 *
 * Two audiences share one screen and they arrive in opposite states:
 *   litigant — signs in perhaps twice a year, often frightened, often on a borrowed
 *              phone, sometimes with someone reading the screen aloud to them.
 *   advocate / clerk — signs in daily, wants the fewest possible keystrokes, and
 *              already knows the vocabulary.
 * So the litigant path explains and the advocate path instructs. Neither is condescended
 * to, and no sentence exists that only one of them can parse.
 *
 * Copy rules inherited from the onboarding spec: sentence case (DS Law), around eight
 * words a sentence, one idea a sentence, no legal term on the surface, and never open
 * with the accusation. Strings are English only; other languages come from the app-wide
 * locale handling, and `pick` falls back to English until they do.
 */

import type { Copy } from "@/lib/onboarding/content";

const t = (en: string): Copy => ({ en });

/** Who is signing in. Sent with every attempt — the same person can hold both roles
 *  across their life, so it is never inferred from the number alone. */
export type Role = "litigant" | "advocate";
export const ROLE_ORDER: Role[] = ["litigant", "advocate"];

/** How they prove it. Both roles get both, per the Aug 2026 decision. */
export type Method = "password" | "otp";
export const METHOD_ORDER: Method[] = ["password", "otp"];

/* ------------------------------------------------------------------ brand panel */

/**
 * The panel is not decoration — it is where the person who does not yet have an account
 * finds out that the thing they are afraid of has an explanation. Everything in it is
 * readable without signing in.
 *
 * TODO(pucar): confirm the exact wordmark and the attribution line with the Kerala
 * judiciary before this ships. `attribution` deliberately claims nothing specific.
 */
export const brand = {
  wordmark: t("signIn_onCourts"),
  headline: t("signIn_fileAndFollowYourCaseFromAnywhere"),
} satisfies Record<string, Copy>;

/* -------------------------------------------------------------------- help entry */

/**
 * Replaces the old "Seek help" link, which named a feeling instead of a subject and so
 * told nobody what was behind it. This names the trigger event, the payoff, and the
 * price in minutes — the three things that decide whether a frightened person clicks.
 *
 * The section number stays out of the headline on purpose. "§138" is how the court
 * files this case; "a cheque that bounced" is how the person lived it.
 *
 * **Two variants, branched on the summons token — not on role.** Role is unknown until
 * someone taps a tab, and the tab is on the far side of the screen; swapping the panel
 * from there would be a jump with no cause. The token is a fact we hold on arrival.
 *
 *   `summoned`  — they scanned the QR on a paper summons. We know they were served, so
 *                 the copy can name it directly and the modal auto-opens.
 *   `general`   — everyone else: an advocate at their desk, a clerk, someone who found
 *                 the site through search. Neutral, still one tap from the same content.
 *
 * The modal itself is NOT gated either way. Of its 129 strings, seven are case-specific
 * and every one has an "On your summons" fallback; the rest is universal law that is
 * just as true with no token as with one.
 */
export const help = {
  summoned: {
    title: t("signIn_gotASummonsAboutAChequeThat"),
    body: t("signIn_findOutWhatYourSummonsMeansWhat"),
    /* Names the object being explained. "Seek help" is too broad, while "See what
       happens next" hides that the destination explains the summons itself. */
    action: t("signIn_understandYourSummons"),
  },
  /* Reads as an offer, not a diagnosis — so an advocate scanning the page skips it
     without being told what they already know, and a worried litigant still finds it. */
  general: {
    title: t("signIn_newToChequeBounceCases"),
    body: t("signIn_howAChequeBounceCaseRunsWhat"),
    action: t("signIn_seeHowACaseWorks"),
  },
  /** Sits under the button, so it stays to the one fact that removes the hesitation. */
  meta: t("signIn_noSignInNeeded"),
};

/* -------------------------------------------------------------------------- form */

export const form = {
  title: t("signIn_signInToYourAccount"),
  subtitle: t("signIn_useTheMobileNumberYouGaveThe"),

  /** Legend for the role tabs. Screen readers hear this before the two choices. */
  roleLegend: t("signIn_iAmSigningInAs"),

  mobileLabel: t("signIn_mobileNumber"),
  mobilePlaceholder: t("signIn_10DigitMobileNumber"),
  mobileError: t("signIn_enterThe10DigitsOfYourMobile"),
  /** The number step's one action. It checks the number's format only — the backend
   *  does not reveal which numbers have accounts (owner, Oct 15). */
  continue: t("signIn_continue"),
  /* "Couldn't find an account for this number" lived here until Oct 15: the backend will
     not say whether a number is registered (so nobody can probe which ones are), and the
     owner chose a format-only number step. A wrong number now fails at the credential
     step with `noMatch`, which names neither part. */
  mobileInvalid: t("signIn_enterAValidIndianMobileNumber"),

  /* The second step keeps the same headline as the first. A "Welcome back" to someone
     with a case on them reads as odd, not warm (owner, Sept 9). */
  changeNumber: t("signIn_changeNumber"),

  methodLegend: t("signIn_signInWith"),

  passwordLabel: t("signIn_password"),
  passwordPlaceholder: t("signIn_enterYourPassword"),
  passwordError: t("signIn_enterYourPassword"),
  passwordShow: t("signIn_showPassword"),
  passwordHide: t("signIn_hidePassword"),
  forgot: t("signIn_forgotPassword"),

  otpHint: t("signIn_weWillSendAOneTimeCode"),

  /* Backend answers (integration, Oct 15). */
  noMatch: t("signIn_thoseDetailsDidnTMatchCheckThe"),
  unavailable: t("signIn_couldnTReachTheServerCheckYour"),

  /* After a code was accepted but sign-in still failed: the code is spent. */
  codeUsed: t("signIn_signInDidnTFinishAndThat"),

  submitPassword: t("signIn_signIn"),
  submitOtp: t("signIn_sendOneTimeCode"),

  registerPrompt: t("signIn_newHere"),
  registerAction: t("signIn_createAnAccount"),

  /* Kept in the file but no longer rendered — the footer collapsed to one line and the
     consent hook moved onto the Terms link. If legal wants an explicit "by continuing"
     statement back, this is the string. */
  terms: t("signIn_byContinuingYouAgreeToTheTerms"),
} satisfies Record<string, Copy>;

/** Tab labels stay short — five characters of Malayalam more and they wrap at 320px. */
export const roles: Record<
  Role,
  { tab: Copy; helper: Copy; describes: Copy }
> = {
  litigant: {
    tab: t("signIn_litigant"),
    /* Names the two ways a person ends up here without using "accused", which is the
       word that makes someone close the tab. */
    helper: t("signIn_theCaseIsAboutYouYouFiled"),
    describes: t("signIn_signInAsALitigant"),
  },
  advocate: {
    tab: t("signIn_advocateOrClerk"),
    /* Answers the clerk's real question — "is there a place for me here, or do I use my
       advocate's login?" — which is the whole reason the third option existed. */
    helper: t("signIn_advocatesAndTheirClerksBothSignIn"),
    describes: t("signIn_signInAsAnAdvocateOrClerk"),
  },
};

export const methods: Record<Method, Copy> = {
  password: t("signIn_password"),
  otp: t("signIn_otp"),
};

/* ------------------------------------------------------------------- otp step */

/**
 * The second step of the OTP path. Three things carry it, and all three exist because
 * of how people actually fail here: they cannot remember which number the code went to,
 * they hit "resend" four times in ten seconds, and they mistyped a digit of the number
 * two screens ago and have no way back.
 */
export const otp = {
  title: t("signIn_enterTheCodeWeSentYou"),
  /** `{number}` is replaced with the number the code went to — shown, never assumed. */
  subtitle: t("signIn_weSentA6DigitCodeTo"),
  label: t("signIn_6DigitCode"),
  error: t("signIn_enterAll6Digits"),
  show: t("signIn_showTheCode"),
  hide: t("signIn_hideTheCode"),
  verify: t("signIn_verifyAndSignIn"),
  resend: t("signIn_sendTheCodeAgain"),
  /** `{seconds}` counts down. Saying when beats greying a button out silently. Short
   *  on purpose: it shares a slot with the resend link that replaces it, so the two
   *  must be about one width or the line hops when the timer ends. */
  resendIn: t("signIn_sendAgainInSecondsS"),
  changeNumber: t("signIn_useADifferentNumber"),
} satisfies Record<string, Copy>;

/* ---------------------------------------------------------------- role mismatch */

/**
 * The one dead end this screen can create. A number can be registered under both roles,
 * or under only the other one, so "wrong password" would be a lie and "no such account"
 * would send someone to register a second time. Name what is true and offer the fix in
 * one tap — never leave the correction as something the person has to work out.
 */
export const mismatch: Record<Role, { title: Copy; body: Copy; action: Copy }> = {
  /* Shown on the litigant tab when the number is only registered as an advocate. */
  litigant: {
    title: t("signIn_thisNumberIsRegisteredAsAnAdvocate"),
    body: t("signIn_signInAsAnAdvocateOrUse"),
    action: t("signIn_signInAsAnAdvocate"),
  },
  /* Shown on the advocate tab when the number is only registered as a litigant. */
  advocate: {
    title: t("signIn_thisNumberIsRegisteredAsALitigant"),
    body: t("signIn_signInAsALitigantOrRegister"),
    action: t("signIn_signInAsALitigant"),
  },
};

/* ------------------------------------------------------------------------ footer */

export const footerNavLabel = t("signIn_aboutThisSite");

export const footer: { label: Copy; href: string }[] = [
  { label: t("signIn_termsOfUse"), href: "/terms" },
  { label: t("signIn_privacy"), href: "/privacy" },
  { label: t("signIn_support"), href: "/support" },
];
