"use client";

import * as React from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CircleAlertIcon,
  EyeIcon,
  EyeOffIcon,
} from "lucide-react";

import { BrandLockup } from "@/components/brand-lockup";
import { MaskedOtp, OTP_LENGTH } from "@/components/registration/masked-otp";
import {
  RegistrationFlow,
  type RegistrationResult,
} from "@/components/registration/registration-flow";
import { ResubmissionFlow } from "@/components/registration/resubmission-flow";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { AwaitingApproval } from "@/components/registration/awaiting-approval";
import {
  getAuthService,
  isAuthError,
  isIndianMobile,
  type BackendRole,
  type RejectedRegistration,
} from "@/lib/auth";
import { LOCALES, pick, ui, type Locale } from "@/lib/onboarding/content";
import { approvalStep, registrationUi } from "@/lib/registration/content";
import { cn } from "@/lib/utils";
import {
  brand,
  footer,
  footerNavLabel,
  form,
  help,
  METHOD_ORDER,
  methods,
  otp,
  type Method,
  type Role,
} from "@/lib/sign-in/content";

/**
 * The page under the onboarding modal.
 *
 * Four structural decisions, all load-bearing:
 *
 * 1. **The number goes first, alone.** One field and Continue. The step checks the
 *    number's *format* only: the backend will not say whether a number has an account
 *    (that would let anyone probe who is registered), so an unknown number fails at the
 *    credential step with a message that names neither part (owner, Oct 15 — until then
 *    this step looked the number up). The second step slides in from the right (the
 *    Google pattern the owner attached), with a way back beside it.
 *
 * 2. **Method is chosen on the second step, next to the credential it governs.** A
 *    small labelled toggle, not a full-width strip — the number field above it is the
 *    only wide control, so there is nothing to confuse it with.
 *
 * 3. **The page is a grid, not two stacked flex columns.** The canvas has to run the
 *    full height of the viewport while the footer stays a slim bar under the form
 *    column only; a two-row grid with the canvas spanning both does that directly.
 *
 * 4. **The canvas is desktop-only.** On phones it collapsed into a second page bolted
 *    to the bottom of the first. Its one piece of real content, the explainer, is
 *    re-rendered inline in the form column instead — see `HelpEntry`.
 */

const DIGITS = /\D/g;
const RESEND_SECONDS = 30;

/* Each step mounts fresh and slides in the way the person is travelling: forward from
   the right, back from the left. Enter only — an exit animation would need both panels
   in the tree at once, and `motion-reduce` turns the whole thing off. */
const SLIDE_FORWARD =
  "animate-in fade-in-0 slide-in-from-right-8 duration-200 motion-reduce:animate-none";
const SLIDE_BACK =
  "animate-in fade-in-0 slide-in-from-left-8 duration-200 motion-reduce:animate-none";


/**
 * The §138 explainer entry. Rendered twice, and only ever one at a time: on the canvas
 * from `lg` up, and inline in the form column below that. `display:none` takes the
 * hidden one out of the accessibility tree, so there is no duplicate control.
 *
 * The phone version drops the canvas entirely. A gradient plate wrapped around a card
 * wrapped around a button is three container levels for one link, and at 375px it read
 * as a second page bolted to the bottom of the first. A rule and the page's own type
 * says the same thing and costs nothing.
 *
 * The action follows the explanation in a single vertical reading path. The one fact
 * that removes hesitation stays directly under the button.
 */
function HelpEntry({
  locale,
  entry,
  onSeekHelp,
  onCanvas,
}: {
  locale: Locale;
  entry: (typeof help)["summoned"];
  onSeekHelp: () => void;
  onCanvas?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        onCanvas ? "items-start" : "items-center",
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-2",
          onCanvas ? "items-start text-left" : "items-center text-center",
        )}
      >
        <h3 className="text-body font-semibold text-balance">
          {pick(entry.title, locale)}
        </h3>
        <p
          className={cn(
            "text-body-compact",
            onCanvas ? "text-brand-canvas-muted-foreground" : "text-muted-foreground",
          )}
        >
          {pick(entry.body, locale)}
        </p>
      </div>
      <div className={cn(onCanvas ? "items-start" : "items-center")}>
        <Button
          variant="outline"
          className={cn(
            onCanvas &&
              "border-brand-canvas-muted-foreground bg-transparent text-brand-canvas-foreground data-[variant=outline]:hover:bg-brand-canvas data-[variant=outline]:hover:text-brand-canvas-foreground dark:bg-transparent dark:data-[variant=outline]:hover:bg-brand-canvas dark:data-[variant=outline]:hover:text-brand-canvas-foreground",
          )}
          onClick={onSeekHelp}
        >
          {pick(entry.action, locale)}
          <ArrowRightIcon data-icon="inline-end" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/** Who signed in, as the caller needs it to route and to label the shell. */
export type SignedInAccount = {
  role: Role;
  /** Null when the backend did not say (sign-in does not return the name yet). */
  name: string | null;
  /** The 10 national digits signed in with. */
  mobile: string;
};

/**
 * The portal a backend role opens. Advocates and their clerks share one; everyone else
 * — and a sign-in whose response carries no role, which is every backend sign-in today —
 * opens the litigant home.
 */
function portalRole(role: BackendRole | null): Role {
  return role === "ADVOCATE" || role === "CLERK" ? "advocate" : "litigant";
}

export function SignInBlock({
  locale,
  onLocaleChange,
  onSeekHelp,
  onRegister,
  onSignedIn,
  onRegistered,
  summoned = false,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  onSeekHelp: () => void;
  onRegister?: () => void;
  /** Called when credentials are accepted — the caller routes litigants and advocates
   *  to different portals. Without it, the prototype notice shows. */
  onSignedIn?: (account: SignedInAccount) => void;
  /** Called from the registration success action. Without it, registration shows its
   *  own prototype notice. */
  onRegistered?: (result: RegistrationResult) => void;
  /** True when a summons token brought them here, so the explainer can name the summons
   *  outright. Everyone else gets the neutral headline — same destination either way. */
  summoned?: boolean;
}) {
  const [registrationOpen, setRegistrationOpen] = React.useState(false);
  /* Set when a sign-in succeeds for an account that never finished registering: the
     backend answers `next: "profile"`, and registration resumes with this number
     already proven. */
  const [resumeMobile, setResumeMobile] = React.useState<string | null>(null);
  /* A rejected registration on the signed-in number routes into its
     correction round instead of the portal — the SMS told them to sign in
     again, and this is where signing in lands them. */
  const [resubmission, setResubmission] =
    React.useState<RejectedRegistration | null>(null);
  /* An advocate or clerk the court has not approved yet: the backend refuses them a
     session, and they see the same awaiting-approval screen registration ended on. */
  const [awaitingApproval, setAwaitingApproval] = React.useState(false);
  /** Any screen that replaces the sign-in form — they share the "Back to sign in" header. */
  const awayFromSignIn = registrationOpen || resubmission !== null || awaitingApproval;
  /* number → credential. The number is settled before a credential is asked for. On
     the OTP path the code is asked for on the credential step itself, in a panel that
     opens under the method toggle once the code is sent — the same shape as the
     registration contact step, so there is no third screen to come back from. */
  const [step, setStep] = React.useState<"number" | "credential">("number");
  // Which way the last step change went, so the incoming panel slides from that side.
  const [direction, setDirection] = React.useState<"forward" | "back">("forward");
  const [method, setMethod] = React.useState<Method>("password");
  const [mobile, setMobile] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  // Whether the one-time code has been sent for this number; opens the code panel.
  const [codeSent, setCodeSent] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);
  // The code is masked at rest for the same reason the password is.
  const [codeRevealed, setCodeRevealed] = React.useState(false);
  const [accepted, setAccepted] = React.useState(false);
  const [resendIn, setResendIn] = React.useState(0);
  // Which fields failed, not what the failure reads as. Storing the resolved sentence
  // would freeze it in whichever language was selected when the person pressed submit,
  // and this screen is switched between languages mid-form all the time.
  const [touched, setTouched] = React.useState(false);
  // A backend round trip is in flight; the submit button shows it and holds still.
  const [pending, setPending] = React.useState(false);
  /* What the backend said, as a copy key: `noMatch` sits on the credential field,
     `unavailable` above the button. Cleared by any change to what is being submitted. */
  const [serverError, setServerError] = React.useState<"noMatch" | "unavailable" | null>(
    null,
  );

  const auth = getAuthService();
  const badMobile = touched && !isIndianMobile(mobile);
  const noMatch = serverError === "noMatch";
  const badPassword = (touched && method === "password" && !password) || noMatch;
  const badCode =
    (touched && method === "otp" && codeSent && code.length !== OTP_LENGTH) || noMatch;

  // Any change to what is being submitted invalidates the last answer. A stale "no
  // account for this number" sitting above a number someone has already started
  // correcting is how people conclude the site is broken.
  const invalidate = React.useCallback(() => {
    setTouched(false);
    setAccepted(false);
    setServerError(null);
  }, []);

  React.useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  function goTo(next: "number" | "credential", dir: "forward" | "back") {
    setDirection(dir);
    setStep(next);
    setTouched(false);
  }

  /** The code panel closes and forgets its code — on a method switch or a new number. */
  function resetCode() {
    setCodeSent(false);
    setCode("");
    setCodeRevealed(false);
    setResendIn(0);
  }

  function submitNumber(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!isIndianMobile(mobile)) return;
    goTo("credential", "forward");
  }

  /**
   * Send (or resend) a sign-in code and open the code panel. A cooldown opens it too —
   * a code is already on its way — with the countdown the backend gave.
   */
  async function sendCode() {
    if (pending) return;
    setPending(true);
    setServerError(null);
    try {
      await auth.requestOtp(mobile, "login");
      openCodePanel(RESEND_SECONDS);
    } catch (error) {
      if (isAuthError(error) && error.code === "resend-too-soon") {
        openCodePanel(error.retryAfterSeconds ?? RESEND_SECONDS);
      } else {
        setServerError("unavailable");
      }
    } finally {
      setPending(false);
    }
  }

  function openCodePanel(wait: number) {
    setTouched(false);
    setCode("");
    setCodeSent(true);
    setResendIn(wait);
  }

  /**
   * One submit for the credential step, whichever method and whichever state:
   * password → sign in; OTP before a code is out → send it and open the code panel;
   * OTP with a code out → verify it and sign in.
   */
  async function submitCredential(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setTouched(true);

    if (method === "otp" && !codeSent) {
      await sendCode();
      return;
    }
    if (method === "password" && !password) return;
    if (method === "otp" && code.length !== OTP_LENGTH) return;

    setPending(true);
    setServerError(null);
    try {
      const account = await auth.signIn(
        method === "password" ? { mobile, password } : { mobile, otp: code },
      );
      /* A rejected advocate or clerk registration: the SMS told them to sign in again,
         and this is where that lands them — the correction round, pre-filled. If it
         is no longer rejected by now, they simply carry on signed in. */
      if (account.next === "resubmit") {
        try {
          setResubmission(await auth.getRejectedRegistration());
          return;
        } catch (error) {
          if (!isAuthError(error) || error.code !== "nothing-to-resubmit") throw error;
        }
      } else if (account.next === "profile") {
        // The account was created but never finished: registration resumes.
        setResumeMobile(mobile);
        setRegistrationOpen(true);
        return;
      } else if (account.next !== null) {
        /* "terms" (re-accept updated terms, backend PR #135) gets its own screen when
           that PR is deployed (owner, Oct 19). Until then this and any value not known
           here carry on as a normal sign-in — never into the registration wizard,
           which would refuse an account that is already complete. */
        console.warn(`[auth] Sign-in returned next: "${account.next}", which has no screen yet.`);
      }
      if (onSignedIn) {
        /* Sign-in does not say who the account is; /users/me does (backend PR #135).
           Until that is deployed it answers nothing, and the sign-in's own answer stands. */
        const current = await auth.getCurrentAccount();
        onSignedIn({
          role: portalRole(current?.role ?? account.role),
          name: current?.name ?? account.name,
          mobile,
        });
        return;
      }
      setAccepted(true);
    } catch (error) {
      if (isAuthError(error) && error.code === "approval-pending") {
        setAwaitingApproval(true);
        return;
      }
      setServerError(
        isAuthError(error) && error.code === "invalid-credentials" ? "noMatch" : "unavailable",
      );
    } finally {
      setPending(false);
    }
  }

  /** Back to the number. Clears what the credential step collected. */
  function changeNumber() {
    resetCode();
    setPassword("");
    invalidate();
    goTo("number", "back");
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 grid-rows-[1fr_auto] lg:h-dvh lg:min-h-0 lg:grid-cols-[4fr_5fr] lg:overflow-hidden">
      {/* Brand canvas — desktop only. The gradient is mode-invariant by design; see the
          CHANGELOG note on the brand-canvas tokens. */}
      <aside className="hidden bg-linear-160 from-brand-canvas to-brand-canvas-deep px-12 pt-10 pb-12 text-brand-canvas-foreground lg:flex lg:flex-col lg:row-span-2">
        <BrandLockup onDark className="h-14" />

        {/* Rule, not card. The explainer is a second thought under the promise, not a
            competing offer beside it. The 40px rhythm on either side makes that
            separation unambiguous without splitting the panel into boxes.
            `flex-1` + centred keeps the promise vertically centred in the panel with
            the mark pinned at the top. */}
        <div className="flex flex-1 flex-col justify-center gap-10">
          <h2 className="text-display-s text-balance font-semibold">
            {pick(brand.headline, locale)}
          </h2>

          {/* This panel stays dark in both modes, so the global `hairline` token is not
              suitable: it becomes a black tint in light mode. The canvas's own muted
              foreground is the correct on-canvas token; reducing its opacity makes the
              rule quieter than body copy while keeping it visibly lighter than the
              background. */}
          {summoned ? (
            <>
              <Separator className="bg-brand-canvas-muted-foreground/40" />
              <HelpEntry
                locale={locale}
                entry={help.summoned}
                onSeekHelp={onSeekHelp}
                onCanvas
              />
            </>
          ) : null}
        </div>
      </aside>

      {/* Form column. */}
      <div className="relative flex flex-col lg:col-start-2 lg:min-h-0">
        {/* The compact secondary toggle lets the phone header stay on one row without
            sacrificing the 40px touch-target floor. The court subline already drops
            below `sm`, leaving the full lockup in the desktop canvas. */}
        <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-4 border-b border-hairline bg-background px-6 py-5 lg:absolute lg:inset-x-0 lg:top-0 lg:border-b-0 lg:px-12 lg:pt-10 lg:pb-0">
          {awayFromSignIn ? (
            <Button
              type="button"
              variant="ghost"
              className="-ml-2 lg:ml-0"
              aria-label={pick(registrationUi.backToSignIn, locale)}
              onClick={() => {
                setRegistrationOpen(false);
                setResumeMobile(null);
                setResubmission(null);
                setAwaitingApproval(false);
              }}
            >
              <ArrowLeftIcon data-icon="inline-start" aria-hidden />
              {/* The full Malayalam line pushed the language toggle off a phone's
                  edge, so below sm the arrow carries "back" and the label names
                  only the destination. */}
              <span className="sm:hidden">
                {pick(registrationUi.backToSignInShort, locale)}
              </span>
              <span className="max-sm:hidden">
                {pick(registrationUi.backToSignIn, locale)}
              </span>
            </Button>
          ) : (
            <BrandLockup className="h-8 lg:hidden" />
          )}

          {/* Two locales, so a segmented toggle beats a dropdown: it costs one tap
              instead of two, and — the reason it matters here — it shows മലയാളം in its
              own script, findable by someone who cannot read the word "Language". */}
          <SegmentedControl size="compact"
            className="shrink-0 lg:ml-auto"
            type="single"
            value={locale}
            onValueChange={(value) => value && onLocaleChange(value as Locale)}
            aria-label={pick(ui.language, locale)}
          >
            {LOCALES.map((l) => (
              <SegmentedControlItem
                key={l.value}
                value={l.value}
              >
                {l.label}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </header>

        <main
          className={cn(
            "flex flex-1 items-start justify-center overflow-y-auto px-6 pb-10 lg:min-h-0 lg:px-12",
            awayFromSignIn
              ? "pt-4 md:pt-8 lg:pt-32 lg:pb-12"
              : "pt-8 lg:items-center lg:py-12",
          )}
        >
          {awaitingApproval ? (
            <AwaitingApproval
              title={pick(approvalStep.title, locale)}
              body={pick(approvalStep.bodyNoNumber, locale)}
            />
          ) : resubmission ? (
            <ResubmissionFlow locale={locale} rejection={resubmission} />
          ) : registrationOpen ? (
            <RegistrationFlow
              locale={locale}
              summoned={summoned}
              initialMobile={mobile}
              verifiedMobile={resumeMobile ?? undefined}
              onFinish={onRegistered}
            />
          ) : (
          /* Centred in the column at every width (owner, Sept 18). On phones the
             centre is OPTICAL: the space splits 2:3 above:below, because a block at
             the true middle reads as sitting low. Growing spacers rather than
             `items-center` or a translate: they fall to zero when a step outgrows
             the column, so the top stays reachable by scroll instead of clipped. */
          <div className="mx-auto flex w-full max-w-100 flex-col self-stretch before:grow-2 after:grow-3 lg:before:grow lg:after:grow">
          <div className="flex w-full flex-col gap-6 lg:-translate-y-2">
            {step === "number" ? (
              <div
                className={cn(
                  "flex flex-col gap-6",
                  direction === "back" && SLIDE_BACK,
                )}
              >
                {/* One token down the scale on phones — `title-s` and `body-compact`.
                    Type steps; controls do not, because 40px is the touch-target floor
                    and shrinking a field to buy air is how a form becomes unusable in
                    exactly the hands that need it most. */}
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-title-s text-balance font-semibold sm:text-title">
                    {pick(form.title, locale)}
                  </h1>
                  <p className="text-body-compact text-muted-foreground sm:text-body">
                    {pick(form.subtitle, locale)}
                  </p>
                </div>

                <div className="flex flex-col gap-4">
                  <form
                    onSubmit={submitNumber}
                    noValidate
                    aria-label={pick(form.title, locale)}
                    className="flex flex-col gap-4"
                  >
                    <Field data-invalid={badMobile}>
                      <FieldLabel>{pick(form.mobileLabel, locale)}</FieldLabel>
                      <InputGroup>
                        <InputGroupAddon variant="field">
                          <InputGroupText>+91</InputGroupText>
                        </InputGroupAddon>
                        <InputGroupInput
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          maxLength={10}
                          placeholder={pick(form.mobilePlaceholder, locale)}
                          value={mobile}
                          onChange={(event) => {
                            setMobile(
                              event.target.value.replace(DIGITS, "").slice(0, 10),
                            );
                            invalidate();
                          }}
                        />
                      </InputGroup>
                      <FieldError>
                        {badMobile
                          ? pick(
                              mobile.length !== 10 ? form.mobileError : form.mobileInvalid,
                              locale,
                            )
                          : null}
                      </FieldError>
                    </Field>

                    <Button type="submit" size="lg" className="w-full">
                      {pick(form.continue, locale)}
                    </Button>
                  </form>

                  <div className="flex flex-wrap items-center justify-center gap-2 text-body-compact text-muted-foreground">
                    {pick(form.registerPrompt, locale)}
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0"
                      onClick={() => {
                        setRegistrationOpen(true);
                        onRegister?.();
                      }}
                    >
                      {pick(form.registerAction, locale)}
                    </Button>
                  </div>
                </div>

                {/* The phone half of the explainer. Same content, page type, a rule
                    instead of a gradient plate. Only one of the two is ever in the
                    accessibility tree — the other is `display:none`. */}
                {summoned ? (
                  <div className="mt-2 flex flex-col gap-10 lg:hidden">
                    <Separator />
                    <HelpEntry
                      locale={locale}
                      entry={help.summoned}
                      onSeekHelp={onSeekHelp}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <div
                className={cn(
                  "flex flex-col gap-6",
                  direction === "forward" ? SLIDE_FORWARD : SLIDE_BACK,
                )}
              >
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-title-s text-balance font-semibold sm:text-title">
                    {pick(form.title, locale)}
                  </h1>
                </div>

                <form
                  onSubmit={submitCredential}
                  noValidate
                  aria-label={pick(form.title, locale)}
                  aria-busy={pending}
                  className="flex flex-col gap-4"
                >
                    {/* The way back, then the method — one plane under the heading.
                        The locked number has left the step (owner, Sept 11): the OTP
                        well still prints the number it sent to, and the password path
                        never needed it on screen. The method strip fills the whole block,
                        the way the field and button below it do; the back arrow sits
                        outside that block on its left rather than eating into it — inline
                        on a phone where there is no gutter, hung in the gutter from `sm`
                        up where there is (owner, Sept 11). */}
                    <div className="relative flex items-center gap-2 sm:block">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 sm:absolute sm:top-1/2 sm:right-full sm:mr-1 sm:-translate-y-1/2"
                        onClick={changeNumber}
                        aria-label={pick(form.changeNumber, locale)}
                      >
                        <ArrowLeftIcon aria-hidden />
                      </Button>
                      <SegmentedControl
                        className="w-full flex-1 sm:flex-none"
                        type="single"
                        value={method}
                        onValueChange={(value) => {
                          if (!value) return;
                          setMethod(value as Method);
                          resetCode();
                          invalidate();
                        }}
                        aria-label={pick(form.methodLegend, locale)}
                      >
                        {METHOD_ORDER.map((m) => (
                          <SegmentedControlItem
                            key={m}
                            value={m}
                            className="flex-1"
                          >
                            {pick(methods[m], locale)}
                          </SegmentedControlItem>
                        ))}
                      </SegmentedControl>
                    </div>

                    {method === "password" ? (
                      <Field data-invalid={badPassword}>
                        <div className="flex items-center justify-between gap-4">
                          <FieldLabel>
                            {pick(form.passwordLabel, locale)}
                          </FieldLabel>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0"
                          >
                            {pick(form.forgot, locale)}
                          </Button>
                        </div>
                        <InputGroup>
                          <InputGroupInput
                            type={revealed ? "text" : "password"}
                            autoComplete="current-password"
                            autoFocus
                            placeholder={pick(form.passwordPlaceholder, locale)}
                            value={password}
                            onChange={(event) => {
                              setPassword(event.target.value);
                              invalidate();
                            }}
                          />
                          <InputGroupAddon align="inline-end">
                            <InputGroupButton
                              size="icon-sm"
                              aria-label={pick(
                                revealed
                                  ? form.passwordHide
                                  : form.passwordShow,
                                locale,
                              )}
                              aria-pressed={revealed}
                              onClick={() => setRevealed((value) => !value)}
                            >
                              {revealed ? (
                                <EyeOffIcon aria-hidden />
                              ) : (
                                <EyeIcon aria-hidden />
                              )}
                            </InputGroupButton>
                          </InputGroupAddon>
                        </InputGroup>
                        <FieldError>
                          {noMatch
                            ? pick(form.noMatch, locale)
                            : badPassword
                              ? pick(form.passwordError, locale)
                              : null}
                        </FieldError>
                      </Field>
                    ) : null}

                    {/* OTP, once the code is out: the same panel the registration contact
                        step shows — a sunken well with the code field, masked at rest,
                        the reveal under the boxes on the left and the countdown / resend
                        on the right. It opens in place, so the number, the method toggle
                        and Change number all stay where they were. */}
                    {method === "otp" && codeSent ? (
                      <Field
                        data-invalid={badCode}
                        className={cn("rounded-lg bg-surface-sunken p-4", SLIDE_FORWARD)}
                      >
                        {/* The description already says "a 6-digit code" — the label
                            above it only repeated the phrase (owner, Sept 11). Kept for
                            screen readers, dropped from view. */}
                        <FieldLabel className="sr-only">
                          {pick(otp.label, locale)}
                        </FieldLabel>
                        <FieldDescription>
                          {pick(otp.subtitle, locale).replace("{number}", mobile)}
                        </FieldDescription>
                        <MaskedOtp
                          value={code}
                          revealed={codeRevealed}
                          onChange={(value) => {
                            setCode(value);
                            setTouched(false);
                            setAccepted(false);
                            setServerError(null);
                          }}
                        />
                        <FieldError>
                          {noMatch
                            ? pick(form.noMatch, locale)
                            : badCode
                              ? pick(otp.error, locale)
                              : null}
                        </FieldError>
                        <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        aria-pressed={codeRevealed}
                        onClick={() => setCodeRevealed((value) => !value)}
                      >
                        {codeRevealed ? (
                          <EyeOffIcon data-icon="inline-start" aria-hidden />
                        ) : (
                          <EyeIcon data-icon="inline-start" aria-hidden />
                        )}
                        {pick(codeRevealed ? otp.hide : otp.show, locale)}
                      </Button>
                      {resendIn > 0 ? (
                        <p className="text-body-compact whitespace-nowrap text-muted-foreground tabular-nums">
                          {pick(otp.resendIn, locale).replace(
                            "{seconds}",
                            String(resendIn),
                          )}
                        </p>
                      ) : (
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0"
                          disabled={pending}
                          onClick={() => {
                            void sendCode();
                          }}
                        >
                          {pick(otp.resend, locale)}
                        </Button>
                      )}
                    </div>
                      </Field>
                    ) : null}

                    {/* The hint belongs to the button, not to the field above it. Left
                        in the form's own rhythm it sat equidistant between the two and
                        read as a caption on the wrong element. Once the code is out the
                        hint is gone and the button verifies. */}
                    {serverError === "unavailable" ? (
                      <Alert variant="destructive">
                        <CircleAlertIcon aria-hidden />
                        <AlertDescription>{pick(form.unavailable, locale)}</AlertDescription>
                      </Alert>
                    ) : null}

                    <div className="flex flex-col gap-2">
                      {method === "otp" && !codeSent ? (
                        <FieldDescription>
                          {pick(form.otpHint, locale)}
                        </FieldDescription>
                      ) : null}
                      {/* aria-disabled, not disabled: a disabled button drops keyboard
                          focus, and the person would land back at the top of the page
                          when the answer came. The handler ignores repeat presses. */}
                      <Button
                        type="submit"
                        size="lg"
                        className="w-full"
                        aria-disabled={pending || undefined}
                      >
                        {pending ? <Spinner data-icon="inline-start" aria-hidden /> : null}
                        {pick(
                          method === "password"
                            ? form.submitPassword
                            : codeSent
                              ? otp.verify
                              : form.submitOtp,
                          locale,
                        )}
                      </Button>
                    </div>

                    <PrototypeNotice
                      show={accepted}
                      mobile={mobile}
                      method={method}
                    />
                </form>
              </div>
            )}
           </div>
          </div>
          )}
        </main>
      </div>

      {/* One line: who runs it, then the policies, dot-separated. The separators are
          decorative, so they stay out of the accessibility tree. */}
      <footer
        aria-label={pick(footerNavLabel, locale)}
        className="flex flex-wrap items-center justify-center gap-x-2 border-t border-border px-6 py-2 text-caption text-muted-foreground lg:col-start-2 lg:px-12"
      >
        {footer.map((item, index) => (
          // Separator and link stay in one flex item so a wrap never strands a dot at
          // the end of a line — which is exactly what happens at 375px.
          <span key={item.href} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden>·</span> : null}
            <Button
              variant="link"
              asChild
              className="h-10 px-0 text-caption text-muted-foreground"
            >
              <a href={item.href}>{pick(item.label, locale)}</a>
            </Button>
          </span>
        ))}
      </footer>
    </div>
  );
}

/**
 * Scaffolding, not product copy — deliberately English-only and labelled, so it cannot
 * be mistaken for a real screen. Shown only when a caller wires no `onSignedIn`; every
 * route wires one today, so it can go once nothing renders the block bare.
 */
function PrototypeNotice({
  show,
  mobile,
  method,
}: {
  show: boolean;
  mobile: string;
  method: Method;
}) {
  if (!show) return null;
  return (
    <Alert variant="info">
      <AlertTitle>Prototype: no next screen yet</AlertTitle>
      <AlertDescription>
        {`Would sign in +91 ${mobile}, verified by ${method === "password" ? "password" : "one-time code"}.`}
      </AlertDescription>
    </Alert>
  );
}
