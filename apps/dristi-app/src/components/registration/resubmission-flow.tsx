"use client";

/**
 * The rejected registration's correction round (PM, Sept 3).
 *
 * A rejected registrant is told by SMS to sign in again; sign-in sees `next: "resubmit"`,
 * loads the registration (`GET /registrations/current`) and lands them here — the
 * registration steps minus the role question (that answer stands), everything pre-filled
 * with what they submitted, and the officer's ONE general message pinned on every step.
 * The message is the whole feedback: fields carry no marks of their own (owner, Sept 18);
 * the stepper tints the steps to correct when marks exist (the backend sends none yet —
 * only the sandbox demo has them). Resubmitting (`POST /registrations/current/resubmit`)
 * sends the same application back for approval and ends the session, so the flow ends on
 * the same awaiting-approval screen the first submission used.
 *
 * The mobile number is not editable: it was proven by OTP the first time and it is the
 * number they just signed in with — a registration cannot move to a number nobody has
 * verified. Role, password and terms stand too.
 */

import * as React from "react";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import { DocumentRowValue } from "@/components/document-preview";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { Stepper, StepperItem } from "@/components/ui/stepper";
import { UploadedDocField } from "@/components/cases/uploaded-doc-field";
import { getAuthService, isAuthError, type RejectedRegistration } from "@/lib/auth";
import { pick, type Locale } from "@/lib/onboarding/content";
import {
  applicationView,
  approvalStep,
  contactStep,
  journeySteps,
  nameStep,
  registrationUi,
  rejectionUi,
  verificationSteps,
  verificationUi,
} from "@/lib/registration/content";
import {
  EMAIL,
  idFileError,
  REGISTRATION_NUMBER_MAX,
  type FileProblem,
  type ServerFieldErrors,
} from "@/lib/registration/validation";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";

import { AwaitingApproval } from "./awaiting-approval";
import { SubmitErrorAlert } from "./submit-error-alert";

type Step = "name" | "contact" | "verification" | "success" | "application";
type StepKey = (typeof STEP_KEYS)[number];

const STEP_KEYS = ["name", "contact", "verification"] as const;

/** Which step each flaggable field lives on — it decides which stepper
    circles take the warning tint. */
const FIELD_STEP: Record<string, StepKey> = {
  name: "name",
  email: "contact",
  regNumber: "verification",
  idFile: "verification",
};

/** Past roughly three lines at this column's width the message starts to
    bury the form it explains — longer than this clamps behind Read more.
    A character threshold rather than a layout measurement: it needs no
    effect, and being a line off in either direction costs nothing. */
const CLAMP_THRESHOLD = 260;

/**
 * The officer's ONE message, in a quiet well on every step. A
 * short message shows whole; a long one clamps to three lines with the rest
 * behind Read more, so the correction work stays above the fold.
 */
function OfficerMessage({
  locale,
  applicationNumber,
  message,
}: {
  locale: Locale;
  applicationNumber: string | null;
  message: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const clamps = message.length > CLAMP_THRESHOLD;
  return (
    <div className="flex flex-col items-start gap-1.5 rounded-lg bg-surface-sunken p-4">
      <p className="text-caption font-semibold text-warning-ink">
        {applicationNumber
          ? pick(rejectionUi.messageMeta, locale).replace("{id}", applicationNumber)
          : pick(rejectionUi.messageMetaNoNumber, locale)}
      </p>
      <p
        className={cn(
          "text-body-compact text-pretty text-foreground",
          clamps && !expanded && "line-clamp-3"
        )}
      >
        &ldquo;{message}&rdquo;
      </p>
      {clamps ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => setExpanded((value) => !value)}
        >
          {pick(expanded ? rejectionUi.showLess : rejectionUi.readMore, locale)}
        </Button>
      ) : null}
    </div>
  );
}

export function ResubmissionFlow({
  locale,
  rejection,
}: {
  locale: Locale;
  rejection: RejectedRegistration;
}) {
  const [step, setStep] = React.useState<Step>("name");
  const [fullName, setFullName] = React.useState(rejection.name);
  const [email, setEmail] = React.useState(rejection.email);
  const [regNumber, setRegNumber] = React.useState(rejection.registrationNumber);
  const [idFile, setIdFile] = React.useState<File | null>(null);
  const [touched, setTouched] = React.useState(false);

  // The resubmission round trip. Errors are copy keys or the backend's field messages.
  const [pending, setPending] = React.useState(false);
  const [serverErrors, setServerErrors] = React.useState<ServerFieldErrors>({});
  /* What is wrong with the document, as a copy key (a language switch re-renders it):
     a picked file the field refused, or one the server refused as too large. */
  const [fileProblem, setFileProblem] = React.useState<FileProblem | null>(null);
  const [submitError, setSubmitError] = React.useState<"unavailable" | "signInAgain" | null>(
    null
  );
  /* The number to quote, once resubmitted — only a readable one the backend sends
     (owner, Oct 19). */
  const [applicationNumber, setApplicationNumber] = React.useState(
    rejection.applicationNumber
  );

  /** The steps the officer's marks land on — they wear the stepper tint. */
  const flaggedSteps = new Set(
    rejection.flagged.map((field) => FIELD_STEP[field])
  );
  const verification = verificationSteps[rejection.role];
  const stepIndex = Math.max(0, STEP_KEYS.indexOf(step as StepKey));

  /** The officer's ONE message, on every step — it is the universal
      feedback (owner, Sept 18), still a quiet well rather than a destructive
      banner (owner, Sept 3: too alarming). An empty message shows nothing. */
  const officerMessage = rejection.officerMessage.trim() ? (
    <OfficerMessage
      locale={locale}
      applicationNumber={applicationNumber}
      message={rejection.officerMessage}
    />
  ) : null;

  async function resubmit() {
    // The form refuses to submit without a file; the backend requires a fresh one.
    if (pending || !idFile) return;
    setPending(true);
    setSubmitError(null);
    try {
      const result = await getAuthService().resubmitRegistration({
        name: fullName,
        email,
        registrationNumber: regNumber,
        document: idFile,
      });
      if (result.applicationNumber) setApplicationNumber(result.applicationNumber);
      setStep("success");
    } catch (error) {
      if (!isAuthError(error)) {
        setSubmitError("unavailable");
        return;
      }
      switch (error.code) {
        case "invalid-details": {
          const first = (key: string) => error.fieldErrors[key]?.[0];
          setServerErrors({
            name: first("name"),
            email: first("email"),
            regNumber: first("registration_number"),
            idFile: first("bar_id_document"),
          });
          if (first("name")) setStep("name");
          else if (first("email")) setStep("contact");
          else if (!first("registration_number") && !first("bar_id_document")) {
            setSubmitError("unavailable");
          }
          return;
        }
        case "document-too-large":
          setIdFile(null);
          setFileProblem("tooLarge");
          return;
        // The session ended, or the registration is no longer the rejected one (it
        // was resubmitted elsewhere, or decided): only signing in again can say.
        case "session-expired":
        case "nothing-to-resubmit":
          setSubmitError("signInAgain");
          return;
        default:
          setSubmitError("unavailable");
      }
    } finally {
      setPending(false);
    }
  }

  if (step === "success") {
    return (
      <AwaitingApproval
        title={pick(rejectionUi.resubmittedTitle, locale)}
        body={
          applicationNumber
            ? pick(rejectionUi.resubmittedBody, locale).replace("{id}", applicationNumber)
            : pick(rejectionUi.resubmittedBodyNoNumber, locale)
        }
        action={{
          label: pick(approvalStep.action, locale),
          onClick: () => setStep("application"),
        }}
      />
    );
  }

  if (step === "application") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <h1 className="text-title text-balance text-center font-semibold">
          {applicationNumber
            ? pick(applicationView.title, locale).replace("{id}", applicationNumber)
            : pick(applicationView.titleNoNumber, locale)}
        </h1>
        <DescriptionList className="rounded-lg bg-muted px-4">
          <DescriptionRow>
            <DescriptionTerm>{pick(applicationView.name, locale)}</DescriptionTerm>
            <DescriptionDetails>{fullName}</DescriptionDetails>
          </DescriptionRow>
          <DescriptionRow>
            <DescriptionTerm>{pick(applicationView.mobile, locale)}</DescriptionTerm>
            <DescriptionDetails>+91 {rejection.mobile}</DescriptionDetails>
          </DescriptionRow>
          {email ? (
            <DescriptionRow>
              <DescriptionTerm>{pick(applicationView.email, locale)}</DescriptionTerm>
              <DescriptionDetails>{email}</DescriptionDetails>
            </DescriptionRow>
          ) : null}
          <DescriptionRow>
            <DescriptionTerm>{pick(verification.numberLabel, locale)}</DescriptionTerm>
            <DescriptionDetails>
              <Identifier value={regNumber} label="registration number" />
            </DescriptionDetails>
          </DescriptionRow>
          {idFile ? (
            <DescriptionRow className="items-center">
              <DescriptionTerm>{pick(verification.uploadLabel, locale)}</DescriptionTerm>
              <DescriptionDetails>
                <DocumentRowValue file={idFile} locale={locale} />
              </DescriptionDetails>
            </DescriptionRow>
          ) : null}
        </DescriptionList>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 md:gap-10">
      <div className="mx-auto w-full max-w-2xl">
        <Stepper
          className={cn(
            "w-full",
            "[&_[data-slot=stepper-item]]:items-center",
            "[&_[data-slot=stepper-item]>div:first-child]:relative [&_[data-slot=stepper-item]>div:first-child]:justify-center",
            "[&_[data-slot=stepper-connector]]:absolute [&_[data-slot=stepper-connector]]:top-4 [&_[data-slot=stepper-connector]]:left-[calc(50%+1rem)] [&_[data-slot=stepper-connector]]:mx-0 [&_[data-slot=stepper-connector]]:h-px [&_[data-slot=stepper-connector]]:w-[calc(100%-2rem)]",
            /* Three short labels fit a phone, so they stay at every width —
               the full registration hides its six below md, this does not. */
            "[&_[data-slot=stepper-item]>div:last-child]:w-full [&_[data-slot=stepper-item]>div:last-child]:pr-0 [&_[data-slot=stepper-item]>div:last-child]:text-center"
          )}
          aria-label={pick(registrationUi.stepOf, locale)
            .replace("{current}", String(stepIndex + 1))
            .replace("{total}", String(STEP_KEYS.length))}
        >
          {STEP_KEYS.map((key, index) => (
            <StepperItem
              key={key}
              step={index + 1}
              /* A flagged step AHEAD of you wears the current step's own
                 fill recipe in warning tones — light yellow fill, warning
                 border and number — because the eye scans the circles, not
                 the labels (owner, Sept 3; the ring tried first looked
                 bolted on). The step you are ON stays the teal current
                 look, and a step you pass completes to the normal tick;
                 unflagged upcoming steps stay grey. The sr-only text
                 stays, so the mark is never colour alone for a screen reader.
                 The cast: StepperItem declares `title?: ReactNode`, but the
                 li's own `title: string` attribute intersects it down to
                 string — a DS-level type conflict, not a rendering one
                 (candidate for ds-requests). */
              className={
                flaggedSteps.has(key) && index > stepIndex
                  ? "[&_[data-slot=stepper-indicator]]:border-warning-ink [&_[data-slot=stepper-indicator]]:bg-warning-muted [&_[data-slot=stepper-indicator]]:text-warning-muted-foreground"
                  : undefined
              }
              title={
                (flaggedSteps.has(key) ? (
                  <span>
                    {pick(journeySteps[key].title, locale)}{" "}
                    <span className="sr-only">
                      {pick(rejectionUi.stepFlagged, locale)}
                    </span>
                  </span>
                ) : (
                  pick(journeySteps[key].title, locale)
                )) as unknown as string
              }
              status={
                index < stepIndex
                  ? "complete"
                  : index === stepIndex
                    ? "current"
                    : "upcoming"
              }
            />
          ))}
        </Stepper>
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        {step === "name" ? (
          <form
            className="flex flex-col gap-6"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              setTouched(true);
              if (!fullName.trim()) return;
              setTouched(false);
              setStep("contact");
            }}
          >
            {/* The rejection is the page's own structure — headline and one
                quiet line — never an alarm banner. */}
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-title text-balance font-semibold">
                {pick(rejectionUi.notApprovedTitle, locale)}
              </h1>
              <p className="text-body text-pretty text-muted-foreground">
                {pick(rejectionUi.notApprovedBody, locale)}
              </p>
            </div>
            {officerMessage}
            <Field data-invalid={(touched && !fullName.trim()) || Boolean(serverErrors.name)}>
              <FieldLabel>
                {pick(nameStep.fullName, locale)}{" "}
                <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                value={fullName}
                autoComplete="name"
                placeholder={pick(nameStep.fullNamePlaceholder, locale)}
                onChange={(event) => {
                  setFullName(event.target.value);
                  setTouched(false);
                  setServerErrors((e) => ({ ...e, name: undefined }));
                }}
              />
              <FieldDescription>
                {pick(nameStep.fullNameHint, locale)}
              </FieldDescription>
              <FieldError>
                {touched && !fullName.trim()
                  ? pick(nameStep.error, locale)
                  : serverErrors.name ?? null}
              </FieldError>
            </Field>
            <div className="flex justify-end">
              <Button type="submit" className="sm:min-w-40">
                {pick(registrationUi.continue, locale)}
              </Button>
            </div>
          </form>
        ) : null}

        {step === "contact" ? (
          <form
            className="flex flex-col gap-6"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              setTouched(true);
              if (email && !EMAIL.test(email)) return;
              setTouched(false);
              setStep("verification");
            }}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-title text-balance font-semibold">
                {pick(contactStep.title, locale)}
              </h1>
              <p className="text-body text-pretty text-muted-foreground">
                {pick(contactStep.body, locale)}
              </p>
            </div>
            {officerMessage}
            <Field>
              <FieldLabel>{pick(contactStep.mobile, locale)}</FieldLabel>
              <InputGroup className="has-disabled:opacity-100 has-disabled:bg-surface-sunken dark:has-disabled:bg-surface-sunken">
                <InputGroupAddon variant="field">
                  <InputGroupText>+91</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  value={rejection.mobile}
                  disabled
                  readOnly
                  className="disabled:text-foreground disabled:opacity-100 disabled:[-webkit-text-fill-color:currentcolor]"
                />
              </InputGroup>
              <FieldDescription>
                {pick(rejectionUi.mobileVerified, locale)}
              </FieldDescription>
            </Field>
            <Field
              data-invalid={
                (touched && Boolean(email) && !EMAIL.test(email)) || Boolean(serverErrors.email)
              }
            >
              <FieldLabel>{pick(contactStep.email, locale)}</FieldLabel>
              <Input
                type="email"
                value={email}
                placeholder={pick(contactStep.emailPlaceholder, locale)}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setTouched(false);
                  setServerErrors((e) => ({ ...e, email: undefined }));
                }}
              />
              <FieldError>
                {touched && email && !EMAIL.test(email)
                  ? pick(contactStep.emailError, locale)
                  : serverErrors.email ?? null}
              </FieldError>
            </Field>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTouched(false);
                  setStep("name");
                }}
              >
                <ArrowLeftIcon data-icon="inline-start" aria-hidden />
                {pick(registrationUi.back, locale)}
              </Button>
              <Button type="submit" className="sm:min-w-40">
                {pick(registrationUi.continue, locale)}
              </Button>
            </div>
          </form>
        ) : null}

        {step === "verification" ? (
          <form
            className="flex flex-col gap-6"
            noValidate
            aria-busy={pending}
            onSubmit={(event) => {
              event.preventDefault();
              if (pending) return;
              setTouched(true);
              if (!regNumber.trim() || !idFile || fileProblem) return;
              setTouched(false);
              void resubmit();
            }}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-title text-balance font-semibold">
                {pick(verification.title, locale)}
              </h1>
              <p className="text-body text-pretty text-muted-foreground">
                {pick(verification.body, locale)}
              </p>
            </div>
            {officerMessage}
            <Field
              data-invalid={(touched && !regNumber.trim()) || Boolean(serverErrors.regNumber)}
            >
              <FieldLabel>
                {pick(verification.numberLabel, locale)}{" "}
                <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                value={regNumber}
                maxLength={REGISTRATION_NUMBER_MAX}
                placeholder={pick(verification.numberPlaceholder, locale)}
                onChange={(event) => {
                  setRegNumber(event.target.value);
                  setTouched(false);
                  setServerErrors((e) => ({ ...e, regNumber: undefined }));
                }}
              />
              <FieldError>
                {touched && !regNumber.trim()
                  ? pick(verification.numberError, locale)
                  : serverErrors.regNumber ?? null}
              </FieldError>
            </Field>
            <Field
              data-invalid={(touched && !idFile) || fileProblem !== null || Boolean(serverErrors.idFile)}
            >
              <FieldLabel>
                {pick(verification.uploadLabel, locale)}{" "}
                <span className="text-destructive">*</span>
              </FieldLabel>
              <UploadedDocField
                label={pick(verification.uploadLabel, locale)}
                required
                file={idFile}
                onFileChange={(file) => {
                  setIdFile(file);
                  setTouched(false);
                  setFileProblem(null);
                  setServerErrors((e) => ({ ...e, idFile: undefined }));
                }}
                onRejectFile={() => {
                  // A refused pick must not leave the old file to be sent.
                  setIdFile(null);
                  setFileProblem("rejected");
                }}
                copy={{
                  changeFile: pick(verificationUi.changeFile, locale),
                  remove: pick(verificationUi.removeFile, locale),
                  noFile: pick(verificationUi.noFile, locale),
                  chooseFile: pick(verificationUi.chooseFile, locale),
                }}
              />
              <FieldDescription>
                {/* What went last time — they must send a fresh scan now. */}
                {rejection.documentName
                  ? `${pick(rejectionUi.lastUploaded, locale).replace("{file}", rejection.documentName)} `
                  : null}
                {pick(verification.uploadHint, locale)}{" "}
                {pick(verificationUi.fileHelp, locale)}
              </FieldDescription>
              <FieldError>
                {idFileError({
                  serverError: serverErrors.idFile,
                  fileProblem,
                  missingMessage: touched && !idFile ? pick(verification.uploadError, locale) : null,
                  locale,
                })}
              </FieldError>
            </Field>
            {submitError ? (
              <SubmitErrorAlert
                message={pick(
                  submitError === "signInAgain"
                    ? rejectionUi.signInAgain
                    : registrationUi.unavailable,
                  locale
                )}
              />
            ) : null}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setTouched(false);
                  setSubmitError(null);
                  setStep("contact");
                }}
              >
                <ArrowLeftIcon data-icon="inline-start" aria-hidden />
                {pick(registrationUi.back, locale)}
              </Button>
              {/* aria-disabled keeps focus here while the answer is awaited; the
                  submit handler ignores repeat presses. */}
              <Button
                type="submit"
                className="sm:min-w-40"
                aria-disabled={pending || undefined}
              >
                {pending ? <Spinner data-icon="inline-start" aria-hidden /> : null}
                {pick(rejectionUi.resubmit, locale)}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
