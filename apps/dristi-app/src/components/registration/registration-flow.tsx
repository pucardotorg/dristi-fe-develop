"use client";

import * as React from "react";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  CheckIcon,
  CircleAlertIcon,
  EyeIcon,
  EyeOffIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DescriptionDetails, DescriptionList, DescriptionRow, DescriptionTerm } from "@/components/ui/description-list";
import { DocumentRowValue } from "@/components/document-preview";
import { UploadedDocField } from "@/components/cases/uploaded-doc-field";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CENTRED_STEPPER } from "@/components/chrome/stepper-layout";
import { Stepper, StepperItem } from "@/components/ui/stepper";
import { getAuthService, isAuthError, isIndianMobile, type AuthError } from "@/lib/auth";
import { pick, type Copy, type Locale } from "@/lib/onboarding/content";
import {
  applicationView,
  approvalStep,
  contactStep,
  journeySteps,
  nameStep,
  passwordStep,
  registrationUi,
  roleStep,
  successStep,
  termsStep,
  verificationSteps,
  verificationUi,
} from "@/lib/registration/content";
import { loadCommonPasswords, passwordProblem } from "@/lib/registration/password-policy";
import { cn } from "@/lib/utils";

import { MaskedOtp, OTP_LENGTH } from "./masked-otp";
import { Identifier } from "@/components/chrome/identifier";
import { AwaitingApproval } from "./awaiting-approval";

type Step = "role" | "name" | "contact" | "password" | "verification" | "terms" | "success" | "application";
type AccountRole = "litigant" | "advocate" | "advocateClerk" | "poa" | "";
/** Which backend call is in flight, so only its button shows progress. */
type Pending = "send" | "verify" | "submit" | null;
/** The backend's own per-field messages from the last refused submission. */
type ServerFieldErrors = Partial<Record<"name" | "email" | "password" | "regNumber" | "idFile", string>>;

/** What the finished registration hands to the caller. */
export type RegistrationResult = {
  idSkipped: boolean;
  profileIncomplete: boolean;
  name: string;
  role: Exclude<AccountRole, "">;
  /** The number registered — the one verified on the contact step. */
  mobile: string;
};
const DIGITS = /\D/g;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 30;

/** Which roles the court must approve before the account works. */
const NEEDS_VERIFICATION = new Set<AccountRole>(["advocate", "advocateClerk"]);

/** Longest registration number the backend stores (bar ID / clerk number). */
const REGISTRATION_NUMBER_MAX = 64;

function Heading({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <h1 className="text-title text-balance font-semibold">{title}</h1>
      <p className="text-body text-pretty text-muted-foreground">{body}</p>
    </div>
  );
}

function Actions({ locale, onBack, submitLabel, pending = false }: {
  locale: Locale;
  onBack: () => void;
  submitLabel?: string;
  /** A submission is in flight: both buttons hold still and the primary shows progress. */
  pending?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Button type="button" variant="outline" onClick={onBack} disabled={pending}>
        <ArrowLeftIcon data-icon="inline-start" aria-hidden />
        {pick(registrationUi.back, locale)}
      </Button>
      {/* aria-disabled keeps focus on the button while the answer is awaited; the
          form's submit handler ignores repeat presses. */}
      <Button type="submit" className="sm:min-w-40" aria-disabled={pending || undefined}>
        {pending ? <Spinner data-icon="inline-start" aria-hidden /> : null}
        {submitLabel ?? pick(registrationUi.continue, locale)}
      </Button>
    </div>
  );
}

export function RegistrationFlow({ locale, summoned, initialMobile = "", verifiedMobile, onFinish }: {
  locale: Locale;
  summoned: boolean;
  initialMobile?: string;
  /** Set when a signed-in account has not finished registering: the number is already
   *  proven by that sign-in, so the contact step opens verified. */
  verifiedMobile?: string;
  onFinish?: (result: RegistrationResult) => void;
}) {
  const [step, setStep] = React.useState<Step>("role");
  const [role, setRole] = React.useState<AccountRole>("");
  const [fullName, setFullName] = React.useState("");
  const [mobile, setMobile] = React.useState(verifiedMobile ?? initialMobile);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordRevealed, setPasswordRevealed] = React.useState(false);
  const [termsAccepted, setTermsAccepted] = React.useState(false);
  const [touched, setTouched] = React.useState(false);
  const [destinationNotice, setDestinationNotice] = React.useState(false);

  // Contact-step OTP. Anyone can type anyone's number, so the number is proven here —
  // code requested, verified on the same screen — before Continue means anything.
  const [otpRequested, setOtpRequested] = React.useState(Boolean(verifiedMobile));
  const [otpCode, setOtpCode] = React.useState("");
  const [otpVerified, setOtpVerified] = React.useState(Boolean(verifiedMobile));
  const [otpTouched, setOtpTouched] = React.useState(false);
  // The code is masked at rest. It arrives on the lock screen of the phone in the
  // person's hand, in a room they do not control — the same reason a password is dotted.
  const [otpRevealed, setOtpRevealed] = React.useState(false);
  const [resendIn, setResendIn] = React.useState(0);

  // Backend round trips. Errors are stored as copy keys, not sentences, so a language
  // switch re-renders them; only the backend's own field messages arrive as text.
  const [pending, setPending] = React.useState<Pending>(null);
  const [contactError, setContactError] = React.useState<Copy | null>(null);
  const [otpError, setOtpError] = React.useState<Copy | null>(null);
  const [serverErrors, setServerErrors] = React.useState<ServerFieldErrors>({});
  const [submitError, setSubmitError] = React.useState<"unavailable" | "notSupported" | null>(null);

  // Advocate / clerk verification.
  const [regNumber, setRegNumber] = React.useState("");
  const [idFile, setIdFile] = React.useState<File | null>(null);
  /* What is wrong with the document, as a copy key so a language switch re-renders it:
     a picked file the field refused (wrong type, over 10 MB), or one the server refused
     as too large to accept. */
  const [fileProblem, setFileProblem] = React.useState<"rejected" | "tooLarge" | null>(null);
  /* A number the person can quote at the court. Only a readable one the backend sends;
     never invented here (owner, Oct 19). Null until the backend provides it. */
  const [applicationNumber, setApplicationNumber] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const needsVerification = NEEDS_VERIFICATION.has(role);
  const verification = role === "advocateClerk" ? verificationSteps.advocateClerk : verificationSteps.advocate;
  /* The backend's common-password list, loaded when the password step opens (it is too
     large for the sign-in page). Until it arrives only that one rule is skipped. */
  const [commonPasswords, setCommonPasswords] = React.useState<ReadonlySet<string> | undefined>();
  React.useEffect(() => {
    if (step !== "password" || commonPasswords) return;
    let live = true;
    loadCommonPasswords()
      .then((list) => { if (live) setCommonPasswords(list); })
      .catch(() => { /* The backend still checks; its message shows if it refuses. */ });
    return () => { live = false; };
  }, [step, commonPasswords]);

  // The first policy rule the password fails, against what this person has told us so
  // far — name from step two, number and email from step three.
  const problem = passwordProblem(password, { mobile, name: fullName, email }, commonPasswords);

  /** Continue from the password step once it passes every rule, the list included. */
  async function submitPassword() {
    setTouched(true);
    const list = commonPasswords ?? (await loadCommonPasswords().catch(() => undefined));
    if (list && !commonPasswords) setCommonPasswords(list);
    if (passwordProblem(password, { mobile, name: fullName, email }, list) || password !== confirmPassword) return;
    setTouched(false);
    setStep(needsVerification ? "verification" : "terms");
  }

  const journeyKeys: readonly (keyof typeof journeySteps)[] = needsVerification
    ? ["role", "name", "contact", "password", "verification", "terms"]
    : ["role", "name", "contact", "password", "terms"];
  const journeyIndex = Math.max(0, journeyKeys.indexOf(step as keyof typeof journeySteps));

  function resetOtp() {
    setOtpRequested(false);
    setOtpCode("");
    setOtpVerified(false);
    setOtpTouched(false);
    setOtpRevealed(false);
    setResendIn(0);
    setContactError(null);
    setOtpError(null);
  }

  const auth = getAuthService();
  const mobileValid = isIndianMobile(mobile);

  /** Send (or resend) the code. A cooldown still opens the panel: a code is already out. */
  async function sendCode() {
    if (pending) return;
    if (!mobileValid) {
      setContactError(contactStep.mobileInvalid);
      return;
    }
    setPending("send");
    setContactError(null);
    setOtpError(null);
    try {
      await auth.requestOtp(mobile, "register");
      setOtpRequested(true);
      setResendIn(RESEND_SECONDS);
    } catch (error) {
      if (isAuthError(error) && error.code === "resend-too-soon") {
        setOtpRequested(true);
        setResendIn(error.retryAfterSeconds ?? RESEND_SECONDS);
      } else {
        setContactError(isAuthError(error) && error.code === "invalid-mobile" ? contactStep.mobileInvalid : registrationUi.unavailable);
      }
    } finally {
      setPending(null);
    }
  }

  /** Prove the number. On the backend this creates the account and starts its session. */
  async function verifyCode() {
    if (pending) return;
    setOtpTouched(true);
    if (otpCode.length !== OTP_LENGTH) return;
    setPending("verify");
    setOtpError(null);
    try {
      await auth.verifyRegistrationOtp(mobile, otpCode);
      setOtpVerified(true);
      setOtpTouched(false);
      setTouched(false);
    } catch (error) {
      const code = isAuthError(error) ? error.code : "unavailable";
      if (code === "already-registered") setContactError(contactStep.alreadyRegistered);
      else setOtpError(code === "invalid-code" ? contactStep.otpWrong : registrationUi.unavailable);
    } finally {
      setPending(null);
    }
  }

  /** Send the profile — the last step. Refused fields send the person back to their step. */
  async function submitRegistration() {
    if (!role) return;
    setPending("submit");
    setSubmitError(null);
    try {
      const outcome = await auth.completeRegistration(role, {
        name: fullName,
        email,
        password,
        ...(needsVerification ? { registrationNumber: regNumber, document: idFile ?? undefined } : {}),
      });
      // Advocates and clerks are now signed out by the backend, awaiting approval.
      setApplicationNumber(outcome.applicationNumber);
      finishLocally();
    } catch (error) {
      handleSubmitError(error);
    } finally {
      setPending(null);
    }
  }

  function finishLocally() {
    setStep("success");
  }

  function handleSubmitError(error: unknown) {
    const authError: AuthError | null = isAuthError(error) ? error : null;
    switch (authError?.code) {
      case "invalid-details": {
        const fields = authError.fieldErrors;
        const first = (key: string) => fields[key]?.[0];
        const regNumberError =
          first("profile.bar_registration_id") ?? first("profile.clerk_registration_number");
        setServerErrors({
          name: first("name"),
          email: first("email"),
          password: first("password"),
          regNumber: regNumberError,
          idFile: first("bar_id_document"),
        });
        if (first("name")) setStep("name");
        else if (first("email")) setStep("contact");
        else if (first("password")) setStep("password");
        else if (regNumberError || first("bar_id_document")) setStep("verification");
        else setSubmitError("unavailable");
        return;
      }
      case "document-too-large":
        setIdFile(null);
        setFileProblem("tooLarge");
        setStep("verification");
        return;
      case "session-expired":
        resetOtp();
        setContactError(registrationUi.sessionExpired);
        setStep("contact");
        return;
      case "already-registered":
        // The account behind this session is already complete — a repeated submit.
        finishLocally();
        return;
      case "not-supported":
        setSubmitError("notSupported");
        return;
      default:
        setSubmitError("unavailable");
    }
  }

  if (step === "success") {
    if (needsVerification) {
      return (
        <AwaitingApproval
          title={pick(approvalStep.title, locale)}
          body={
            applicationNumber
              ? pick(approvalStep.body, locale).replace("{id}", applicationNumber)
              : pick(approvalStep.bodyNoNumber, locale)
          }
          action={{ label: pick(approvalStep.action, locale), onClick: () => setStep("application") }}
        />
      );
    }
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center gap-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-success-muted text-success-muted-foreground">
          <CheckCircle2Icon className="size-7" aria-hidden />
        </span>
        <Heading title={pick(successStep.title, locale)} body={pick(successStep.body, locale)} />
        <Button size="lg" onClick={() => onFinish && role ? onFinish({ idSkipped: true, profileIncomplete: true, name: fullName.trim(), role, mobile }) : setDestinationNotice(true)}>
          {pick(summoned ? successStep.summonedAction : successStep.generalAction, locale)}
        </Button>
        {destinationNotice ? <Alert variant="info" className="text-left"><AlertTitle>Prototype: destination not connected</AlertTitle><AlertDescription>This action will open your portal home.</AlertDescription></Alert> : null}
      </div>
    );
  }

  if (step === "application") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <h1 className="text-title text-balance text-center font-semibold">{applicationNumber ? pick(applicationView.title, locale).replace("{id}", applicationNumber) : pick(applicationView.titleNoNumber, locale)}</h1>
        <DescriptionList className="rounded-lg bg-muted px-4">
          <DescriptionRow><DescriptionTerm>{pick(applicationView.name, locale)}</DescriptionTerm><DescriptionDetails>{fullName}</DescriptionDetails></DescriptionRow>
          <DescriptionRow><DescriptionTerm>{pick(applicationView.mobile, locale)}</DescriptionTerm><DescriptionDetails>+91 {mobile}</DescriptionDetails></DescriptionRow>
          {email ? <DescriptionRow><DescriptionTerm>{pick(applicationView.email, locale)}</DescriptionTerm><DescriptionDetails>{email}</DescriptionDetails></DescriptionRow> : null}
          <DescriptionRow><DescriptionTerm>{pick(applicationView.role, locale)}</DescriptionTerm><DescriptionDetails>{pick(role === "advocateClerk" ? roleStep.advocateClerk : roleStep.advocate, locale)}</DescriptionDetails></DescriptionRow>
          <DescriptionRow><DescriptionTerm>{pick(verification.numberLabel, locale)}</DescriptionTerm><DescriptionDetails><Identifier value={regNumber} label="registration number" /></DescriptionDetails></DescriptionRow>
          {idFile ? <DescriptionRow className="items-center"><DescriptionTerm>{pick(verification.uploadLabel, locale)}</DescriptionTerm><DescriptionDetails><DocumentRowValue file={idFile} locale={locale} /></DescriptionDetails></DescriptionRow> : null}
        </DescriptionList>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 md:gap-10">
      <div className="mx-auto w-full max-w-2xl">
        <Stepper
          className={CENTRED_STEPPER}
          aria-label={pick(registrationUi.stepOf, locale).replace("{current}", String(journeyIndex + 1)).replace("{total}", String(journeyKeys.length))}
        >
          {journeyKeys.map((key, index) => <StepperItem key={key} step={index + 1} title={pick(journeySteps[key].title, locale)} status={index < journeyIndex ? "complete" : index === journeyIndex ? "current" : "upcoming"} />)}
        </Stepper>
        {/* Six names do not fit under six circles on a phone (Malayalam collides
            even at caption size), so below md one line names the step you are on. */}
        <p className="mt-3 text-center text-caption text-muted-foreground md:hidden">
          {pick(registrationUi.stepOf, locale).replace("{current}", String(journeyIndex + 1)).replace("{total}", String(journeyKeys.length))}
          {" · "}
          <span className="font-medium text-foreground">{pick(journeySteps[journeyKeys[journeyIndex]].title, locale)}</span>
        </p>
      </div>

      <div className="mx-auto w-full max-w-xl">
        {step === "role" ? (
          <form className="flex flex-col gap-6" onSubmit={(event) => { event.preventDefault(); setTouched(true); if (!role) return; setTouched(false); setStep("name"); }}>
            <Heading title={pick(roleStep.title, locale)} body={pick(roleStep.body, locale)} />
            <Field data-invalid={touched && !role}>
              <RadioGroup value={role} onValueChange={(value) => { setRole(value as AccountRole); setTouched(false); }} className="flex flex-col gap-3">
                {(["litigant", "poa", "advocate", "advocateClerk"] as const).map((value) => (
                  <Label key={value} htmlFor={`registration-role-${value}`} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-brand-muted">
                    <RadioGroupItem id={`registration-role-${value}`} value={value} className="mt-0.5" />
                    <span className="flex flex-col gap-1"><span className="font-medium">{pick(roleStep[value], locale)}</span><span className="text-caption font-normal text-muted-foreground">{pick(roleStep[`${value}Hint`], locale)}</span></span>
                  </Label>
                ))}
              </RadioGroup>
              <FieldError>{touched && !role ? pick(roleStep.required, locale) : null}</FieldError>
            </Field>
            <Button type="submit">{pick(registrationUi.continue, locale)}</Button>
          </form>
        ) : null}

        {step === "name" ? (
          <form className="flex flex-col gap-6" noValidate onSubmit={(event) => { event.preventDefault(); setTouched(true); if (!fullName.trim()) return; setTouched(false); setStep("contact"); }}>
            <Heading title={pick(nameStep.title, locale)} body={pick(nameStep.body, locale)} />
            {/* One line, `autoComplete="name"`. The three-box version asked every person
                whose name does not split that way to decide which box their name is. */}
            <Field data-invalid={(touched && !fullName.trim()) || Boolean(serverErrors.name)}>
              <FieldLabel>{pick(nameStep.fullName, locale)} <span className="text-destructive">*</span></FieldLabel>
              <Input value={fullName} autoComplete="name" placeholder={pick(nameStep.fullNamePlaceholder, locale)} onChange={(event) => { setFullName(event.target.value); setTouched(false); setServerErrors((e) => ({ ...e, name: undefined })); }} />
              <FieldDescription>{pick(nameStep.fullNameHint, locale)}</FieldDescription>
              <FieldError>{touched && !fullName.trim() ? pick(nameStep.error, locale) : serverErrors.name ?? null}</FieldError>
            </Field>
            <Actions locale={locale} onBack={() => { setTouched(false); setStep("role"); }} />
          </form>
        ) : null}

        {step === "contact" ? (
          <form className="flex flex-col gap-6" noValidate onSubmit={(event) => { event.preventDefault(); setTouched(true); if (!mobileValid || !otpVerified || (email && !EMAIL.test(email))) return; setTouched(false); setStep("password"); }}>
            <Heading title={pick(contactStep.title, locale)} body={pick(contactStep.body, locale)} />
            <Field data-invalid={(touched && (!mobileValid || !otpVerified)) || Boolean(contactError)}>
              <FieldLabel>{pick(contactStep.mobile, locale)} <span className="text-destructive">*</span></FieldLabel>
              <div className="flex gap-2">
                {/* The DS disabled look, minus the 50% dim on the value itself: the number
                    is the one thing being verified against the code, so it stays at full
                    contrast while the frame and addon still read as locked. */}
                <InputGroup className={cn("flex-1", otpRequested && "has-disabled:opacity-100 has-disabled:bg-surface-sunken dark:has-disabled:bg-surface-sunken")}><InputGroupAddon variant="field"><InputGroupText>+91</InputGroupText></InputGroupAddon><InputGroupInput type="tel" inputMode="numeric" maxLength={10} value={mobile} disabled={otpRequested} className={otpRequested ? "disabled:text-foreground disabled:opacity-100 disabled:[-webkit-text-fill-color:currentcolor]" : undefined} placeholder={pick(contactStep.mobilePlaceholder, locale)} onChange={(event) => { setMobile(event.target.value.replace(DIGITS, "").slice(0, 10)); setTouched(false); setContactError(null); }} /></InputGroup>
                {!otpRequested ? (
                  <Button type="button" variant="outline" className="shrink-0" disabled={mobile.length !== 10} aria-disabled={pending !== null || undefined} onClick={() => { setTouched(false); void sendCode(); }}>
                    {pending === "send" ? <Spinner data-icon="inline-start" aria-hidden /> : null}
                    {pick(contactStep.sendOtp, locale)}
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" className="shrink-0" onClick={resetOtp}>{pick(contactStep.changeNumber, locale)}</Button>
                )}
              </div>
              {otpVerified ? (
                <p className="flex items-center gap-1.5 text-body-compact text-success"><CheckCircle2Icon className="size-4" aria-hidden />{pick(contactStep.verified, locale)}</p>
              ) : (
                <FieldDescription>{pick(contactStep.mobileHint, locale)}</FieldDescription>
              )}
              <FieldError>{contactError ? pick(contactError, locale) : touched && mobile.length !== 10 ? pick(contactStep.mobileError, locale) : touched && !mobileValid ? pick(contactStep.mobileInvalid, locale) : touched && !otpVerified ? pick(contactStep.verifyFirst, locale) : null}</FieldError>
            </Field>

            {otpRequested && !otpVerified ? (
              <Field data-invalid={(otpTouched && otpCode.length !== OTP_LENGTH) || Boolean(otpError)} className="rounded-lg bg-surface-sunken p-4">
                {/* Label repeated the description's "6-digit code"; kept for screen
                    readers, dropped from view (owner, Sept 11). */}
                <FieldLabel className="sr-only">{pick(contactStep.otpLabel, locale)}</FieldLabel>
                <FieldDescription>{pick(contactStep.otpSent, locale).replace("{number}", mobile)}</FieldDescription>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <MaskedOtp value={otpCode} revealed={otpRevealed} onChange={(value) => { setOtpCode(value); setOtpTouched(false); setOtpError(null); }} />
                  <Button type="button" className="sm:h-12" aria-disabled={pending !== null || undefined} onClick={() => { void verifyCode(); }}>
                    {pending === "verify" ? <Spinner data-icon="inline-start" aria-hidden /> : null}
                    {pick(contactStep.otpVerify, locale)}
                  </Button>
                </div>
                <FieldError>{otpTouched && otpCode.length !== OTP_LENGTH ? pick(contactStep.otpError, locale) : otpError ? pick(otpError, locale) : null}</FieldError>
                {/* One row under the boxes: reveal on the left, under the code it reveals;
                    countdown / resend on the right, under the Verify it follows. The
                    countdown and the resend link share the right-hand slot at a fixed
                    height, so nothing hops when the timer runs out. */}
                <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    aria-pressed={otpRevealed}
                    onClick={() => setOtpRevealed((value) => !value)}
                  >
                    {otpRevealed ? <EyeOffIcon data-icon="inline-start" aria-hidden /> : <EyeIcon data-icon="inline-start" aria-hidden />}
                    {pick(otpRevealed ? contactStep.otpHide : contactStep.otpShow, locale)}
                  </Button>
                  {resendIn > 0 ? (
                    <p className="text-body-compact whitespace-nowrap text-muted-foreground tabular-nums">{pick(contactStep.otpResendIn, locale).replace("{seconds}", String(resendIn))}</p>
                  ) : (
                    <Button type="button" variant="link" size="sm" className="h-auto p-0" disabled={pending !== null} onClick={() => { setOtpCode(""); void sendCode(); }}>{pick(contactStep.otpResend, locale)}</Button>
                  )}
                </div>
              </Field>
            ) : null}

            <Field data-invalid={(touched && Boolean(email) && !EMAIL.test(email)) || Boolean(serverErrors.email)}><FieldLabel>{pick(contactStep.email, locale)}</FieldLabel><Input type="email" value={email} placeholder={pick(contactStep.emailPlaceholder, locale)} onChange={(event) => { setEmail(event.target.value); setTouched(false); setServerErrors((e) => ({ ...e, email: undefined })); }} /><FieldError>{touched && email && !EMAIL.test(email) ? pick(contactStep.emailError, locale) : serverErrors.email ?? null}</FieldError></Field>
            <Actions locale={locale} onBack={() => { setTouched(false); setStep("name"); }} />
          </form>
        ) : null}

        {step === "password" ? (
          <form className="flex flex-col gap-6" noValidate onSubmit={(event) => { event.preventDefault(); void submitPassword(); }}>
            <Heading title={pick(passwordStep.title, locale)} body={pick(passwordStep.body, locale)} />

            <Field data-invalid={(touched && Boolean(problem)) || Boolean(serverErrors.password)}>
              <FieldLabel>{pick(passwordStep.password, locale)}</FieldLabel>
              <Input
                type={passwordRevealed ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                placeholder={pick(passwordStep.passwordPlaceholder, locale)}
                onChange={(event) => { setPassword(event.target.value); setTouched(false); setServerErrors((e) => ({ ...e, password: undefined })); }}
              />
              {/* Under the box, one line that changes as they type: the whole policy at
                  rest, the one rule currently failing once typing starts, the all-clear
                  when nothing fails. Polite live region — a checklist ticking on every
                  keystroke is what this replaced. The reveal sits on the same line's
                  right edge, under the box it reveals; one reveal governs both boxes,
                  since two eyes would let someone show the first and check the second
                  against a field they cannot read. */}
              <div className="flex items-start justify-between gap-4">
                {touched && problem ? (
                  <FieldError>{pick(passwordStep.problem[problem], locale)}</FieldError>
                ) : serverErrors.password ? (
                  // The local check mirrors the server's rules, but if they ever drift
                  // (or the common list failed to load) its own sentence is shown as sent.
                  <FieldError>{serverErrors.password}</FieldError>
                ) : (
                  <FieldDescription
                    aria-live="polite"
                    className={cn(
                      "flex items-start gap-1.5",
                      password && problem && "text-destructive-ink",
                      password && !problem && "text-success-ink",
                    )}
                  >
                    {password && problem ? <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> : null}
                    {password && !problem ? <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> : null}
                    <span>{pick(!password ? passwordStep.rules : problem ? passwordStep.problem[problem] : passwordStep.ok, locale)}</span>
                  </FieldDescription>
                )}
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto shrink-0 p-0"
                  aria-pressed={passwordRevealed}
                  onClick={() => setPasswordRevealed((value) => !value)}
                >
                  {passwordRevealed ? <EyeOffIcon data-icon="inline-start" aria-hidden /> : <EyeIcon data-icon="inline-start" aria-hidden />}
                  {pick(passwordRevealed ? passwordStep.hide : passwordStep.show, locale)}
                </Button>
              </div>
            </Field>

            <Field data-invalid={touched && password !== confirmPassword}>
              <FieldLabel>{pick(passwordStep.confirm, locale)}</FieldLabel>
              {/* The tick inside the box is the match signal; its absence is the
                  mismatch signal. Continue stays live either way — pressing it with a
                  mismatch says so in words below, rather than a button that will not
                  press and does not say why. */}
              <InputGroup>
                <InputGroupInput
                  type={passwordRevealed ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  placeholder={pick(passwordStep.confirmPlaceholder, locale)}
                  onChange={(event) => { setConfirmPassword(event.target.value); setTouched(false); }}
                />
                {confirmPassword && confirmPassword === password ? (
                  <InputGroupAddon align="inline-end" className="text-success-ink">
                    <CheckIcon aria-hidden />
                    <span className="sr-only">{pick(passwordStep.confirmMatch, locale)}</span>
                  </InputGroupAddon>
                ) : null}
              </InputGroup>
              <FieldError>{touched && password !== confirmPassword ? pick(passwordStep.confirmError, locale) : null}</FieldError>
            </Field>

            {/* No skip: the backend needs a password to finish registration (owner, Oct 15). */}
            <Actions locale={locale} onBack={() => { setTouched(false); setStep("contact"); }} />
          </form>
        ) : null}

        {step === "verification" ? (
          <form className="flex flex-col gap-6" noValidate onSubmit={(event) => { event.preventDefault(); setTouched(true); if (!regNumber.trim() || !idFile || fileProblem) return; setTouched(false); setStep("terms"); }}>
            <Heading title={pick(verification.title, locale)} body={pick(verification.body, locale)} />
            <Field data-invalid={(touched && !regNumber.trim()) || Boolean(serverErrors.regNumber)}>
              <FieldLabel>{pick(verification.numberLabel, locale)} <span className="text-destructive">*</span></FieldLabel>
              <Input value={regNumber} maxLength={REGISTRATION_NUMBER_MAX} placeholder={pick(verification.numberPlaceholder, locale)} onChange={(event) => { setRegNumber(event.target.value); setTouched(false); setServerErrors((e) => ({ ...e, regNumber: undefined })); }} />
              <FieldError>{touched && !regNumber.trim() ? pick(verification.numberError, locale) : serverErrors.regNumber ?? null}</FieldError>
            </Field>
            <Field data-invalid={(touched && !idFile) || fileProblem !== null || Boolean(serverErrors.idFile)}>
              <FieldLabel>{pick(verification.uploadLabel, locale)} <span className="text-destructive">*</span></FieldLabel>
              {/* The app's one upload row (Sept 3): the filled state is the
                  Attachment row with Change file / Remove on its right edge —
                  not a Change link stranded under the box. */}
              <UploadedDocField
                label={pick(verification.uploadLabel, locale)}
                required
                file={idFile}
                onFileChange={(file) => { setIdFile(file); setTouched(false); setFileProblem(null); setServerErrors((e) => ({ ...e, idFile: undefined })); }}
                onRejectFile={() => { setIdFile(null); setFileProblem("rejected"); }}
                copy={{
                  changeFile: pick(verificationUi.changeFile, locale),
                  remove: pick(verificationUi.removeFile, locale),
                  noFile: pick(verificationUi.noFile, locale),
                  chooseFile: pick(verificationUi.chooseFile, locale),
                }}
              />
              <FieldDescription>{pick(verification.uploadHint, locale)} {pick(verificationUi.fileHelp, locale)}</FieldDescription>
              {/* The server's own reason wins (it reads the file's contents); then a
                  refused pick; then the missing-file prompt. */}
              <FieldError>{serverErrors.idFile ?? (fileProblem ? pick(fileProblem === "tooLarge" ? verificationUi.fileTooLargeForServer : verificationUi.fileRejected, locale) : touched && !idFile ? pick(verification.uploadError, locale) : null)}</FieldError>
            </Field>
            <Actions locale={locale} onBack={() => { setTouched(false); setStep("password"); }} />
          </form>
        ) : null}

        {step === "terms" ? (
          <form className="flex flex-col gap-6" aria-busy={pending === "submit"} onSubmit={(event) => { event.preventDefault(); setTouched(true); if (!termsAccepted || pending) return; void submitRegistration(); }}>
            <Heading title={pick(termsStep.title, locale)} body={pick(termsStep.body, locale)} />
            <div className="divide-y divide-border border-y border-border">{termsStep.clauses.map((clause, index) => <div key={index} className="flex gap-3 py-4"><span className="text-body-compact font-semibold text-muted-foreground">{index + 1}.</span><p className="text-body-compact text-muted-foreground">{pick(clause, locale)}</p></div>)}</div>
            <Field data-invalid={touched && !termsAccepted}><div className="flex items-start gap-3 rounded-lg bg-surface-sunken p-4"><Checkbox id="registration-terms" checked={termsAccepted} onCheckedChange={(checked) => { setTermsAccepted(checked === true); setTouched(false); }} /><Label htmlFor="registration-terms" className="cursor-pointer text-body-compact leading-5">{pick(termsStep.accept, locale)}</Label></div><FieldError>{touched && !termsAccepted ? pick(termsStep.error, locale) : null}</FieldError></Field>
            {submitError === "unavailable" ? (
              <Alert variant="destructive">
                <CircleAlertIcon aria-hidden />
                <AlertDescription>{pick(registrationUi.unavailable, locale)}</AlertDescription>
              </Alert>
            ) : null}
            {/* Scaffolding, English-only like the other prototype notices: only the
                litigant registration is connected to the backend so far. */}
            {submitError === "notSupported" ? (
              <Alert variant="info">
                <AlertTitle>Not connected yet</AlertTitle>
                <AlertDescription>Registration for this account type is not connected to the server yet. Only litigant registration works for now.</AlertDescription>
              </Alert>
            ) : null}
            <Actions locale={locale} onBack={() => { setTouched(false); setSubmitError(null); setStep(needsVerification ? "verification" : "password"); }} submitLabel={pick(termsStep.submit, locale)} pending={pending === "submit"} />
          </form>
        ) : null}
      </div>
    </div>
  );
}
