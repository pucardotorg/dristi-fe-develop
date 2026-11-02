import type { Copy } from "@/lib/onboarding/content";

const t = (en: string): Copy => ({ en });

export const registrationUi = {
  backToSignIn: t("Back to sign in"),
  /** Phone header: the arrow says "back", this names the destination. */
  backToSignInShort: t("Sign in"),
  back: t("Back"),
  continue: t("Continue"),
  stepOf: t("Step {current} of {total}"),
  /* Backend failures any step can meet (integration, Oct 15). */
  unavailable: t("Couldn't reach the server. Check your connection and try again"),
  /** The verified number's session ended before the last step was sent. */
  sessionExpired: t("Your verification has expired. Verify your mobile number again"),
} as const;

export const journeySteps = {
  role: { title: t("Role"), description: t("How you use the portal") },
  name: { title: t("Name"), description: t("Your name") },
  contact: { title: t("Contact"), description: t("Mobile and email") },
  password: { title: t("Password"), description: t("Secure your account") },
  verification: { title: t("Verification"), description: t("Your registration details") },
  terms: { title: t("Terms"), description: t("Read and accept") },
} as const;

export const roleStep = {
  title: t("How will you use this account?"),
  body: t("Choose the option that best describes you."),
  litigant: t("Litigant"),
  litigantHint: t("A case is about you, or you want to file a case."),
  advocate: t("Advocate"),
  advocateHint: t("You are enrolled with a State Bar Council."),
  advocateClerk: t("Advocate clerk"),
  advocateClerkHint: t("You assist an advocate with cases and paperwork."),
  poa: t("Power of attorney holder"),
  poaHint: t("You are authorised to act for a litigant."),
  required: t("Choose how you will use this account."),
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
  title: t("Your name"),
  body: t("Enter your name exactly as it appears on your government ID."),
  fullName: t("Full name"),
  fullNamePlaceholder: t("As printed on your ID"),
  fullNameHint: t("The court matches this against the ID you provide."),
  error: t("Enter your name as it appears on your ID"),
} as const;

export const contactStep = {
  title: t("Your contact details"),
  body: t("Use your mobile number to register. Email is optional."),
  mobile: t("Mobile number"),
  mobilePlaceholder: t("10-digit mobile number"),
  mobileError: t("Enter the 10 digits of your mobile number"),
  mobileHint: t("We use this number for sign-in and court updates."),
  email: t("Email address (optional)"),
  emailPlaceholder: t("name@example.com"),
  emailError: t("Enter a valid email address"),
  sendOtp: t("Send one-time code"),
  otpSent: t("We sent a 6-digit code to +91 {number}."),
  otpLabel: t("6-digit code"),
  otpError: t("Enter all 6 digits"),
  otpVerify: t("Verify"),
  otpShow: t("Show the code"),
  otpHide: t("Hide the code"),
  otpResend: t("Send the code again"),
  /* Short on purpose: it sits in the slot the resend link takes over when the timer
     ends, so the two must be about one width — a sentence there wrapped under the
     reveal and then jumped to the right (owner, Sept 9). */
  otpResendIn: t("Send again in {seconds}s"),
  verified: t("Mobile number verified"),
  changeNumber: t("Change number"),
  verifyFirst: t("Verify your mobile number to continue."),
  /* From the backend (integration, Oct 15). */
  mobileInvalid: t("Enter a valid Indian mobile number"),
  otpWrong: t("That code didn't work. Check the digits, or send a new code"),
  alreadyRegistered: t("This number already has an account. Go back to sign in."),
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
  title: t("Create a password"),
  /* Required again (owner, Oct 15): the backend needs a password to finish registration.
     It was optional from Oct 8. */
  body: t("You will sign in with this password, or with a one-time code sent to your mobile."),
  password: t("Password"),
  passwordPlaceholder: t("Enter a password"),
  confirm: t("Confirm password"),
  confirmPlaceholder: t("Enter it again"),
  show: t("Show password"),
  hide: t("Hide password"),
  /* Integration, Oct 23: the rules now match the backend's (password-policy.ts), so a
     password the backend would refuse is refused here. */
  /** At rest, before anything is typed. The whole policy in two short sentences. */
  rules: t("At least 8 characters, not only numbers. Not like your name, mobile number or email, and nothing too common."),
  /** Live, while typing — the first rule the password is failing. */
  problem: {
    length: t("Use at least 8 characters"),
    tooLong: t("Use 128 characters or fewer"),
    mobile: t("Too similar to your mobile number"),
    name: t("Too similar to your name"),
    email: t("Too similar to your email"),
    numeric: t("Add a letter or symbol. Numbers alone are not allowed"),
    common: t("Too easy to guess. Pick something less common"),
  },
  /** Live, once every rule passes. */
  ok: t("This password works."),
  /** Read out beside the tick in the confirm box; sighted people see the tick. */
  confirmMatch: t("Passwords match"),
  confirmError: t("Both passwords must match"),
} as const;

/**
 * One step, two roles. The advocate and clerk verifications are the same screen with
 * different words — same as the legacy product, where one component served both.
 */
export const verificationSteps = {
  advocate: {
    title: t("Advocate verification"),
    body: t("To ensure the authenticity of your profile, share these details for the court to verify."),
    numberLabel: t("Bar registration number"),
    numberPlaceholder: t("For example K/1234/2020"),
    numberError: t("Enter your Bar registration number"),
    uploadLabel: t("Bar Council ID"),
    uploadHint: t("Ensure the registration number is clearly visible."),
    uploadError: t("Upload your Bar Council ID"),
  },
  advocateClerk: {
    title: t("Advocate clerk verification"),
    body: t("To ensure the authenticity of your profile, share these details for the court to verify."),
    numberLabel: t("Clerk registration number"),
    numberPlaceholder: t("Your clerk registration number"),
    numberError: t("Enter your clerk registration number"),
    uploadLabel: t("Clerk ID"),
    uploadHint: t("Ensure the registration number is clearly visible."),
    uploadError: t("Upload your clerk ID"),
  },
} as const;

export const verificationUi = {
  fileHelp: t("JPG, JPEG, PNG or PDF · up to 10 MB"),
  noFile: t("No file chosen yet"),
  chooseFile: t("Choose file"),
  changeFile: t("Change file"),
  removeFile: t("Remove"),
  /* Integration, Oct 19. A picked file
     the backend would refuse, said before anything is sent. */
  fileRejected: t("Choose a JPG, JPEG, PNG or PDF file of up to 10 MB"),
  /** The server refused the upload as too large (413). */
  fileTooLargeForServer: t("This file is too large to send. Choose a smaller scan or photo of the ID"),
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
  notApprovedTitle: t("Your registration was not approved"),
  notApprovedBody: t("Correct your details and resubmit for approval."),
  /** `{id}` is the application number the rejection belongs to. */
  messageMeta: t("Application {id} · message from the verifying officer"),
  /** A long message clamps to three lines; these toggle the rest. */
  readMore: t("Read more"),
  showLess: t("Show less"),
  /** sr-only suffix on a stepper step that needs correcting. */
  stepFlagged: t("has details to correct"),
  mobileVerified: t("Verified. This is the number you sign in with."),
  resubmit: t("Resubmit for approval"),
  resubmittedTitle: t("Your registration is awaiting approval"),
  resubmittedBody: t("Your corrected registration (ID: {id}) is in progress. You will get an SMS when it is done."),
  /* Integration, Oct 19.
     The application number is shown only when the backend sends a readable one
     (owner, Oct 19); until then these versions stand in for the {id} ones. */
  resubmittedBodyNoNumber: t("Your corrected registration is in progress. You will get an SMS when it is done."),
  messageMetaNoNumber: t("Message from the verifying officer"),
  /** Under the upload on the correction step: what was sent before. `{file}` is its name. */
  lastUploaded: t("You sent {file} last time."),
  /** The correction can no longer be sent: the session ended, or it is not rejected now. */
  signInAgain: t("This correction can't be sent right now. Go back and sign in again to see where your registration stands"),
} as const;

export const termsStep = {
  title: t("Terms and Conditions"),
  body: t("Read and agree to these terms before creating your account."),
  clauses: [
    t("By using this app, you agree to abide by our community guidelines, fostering a respectful and inclusive environment for all users."),
    t("Your privacy is paramount. Rest assured, your data is securely handled and never shared with third parties without your consent."),
    t("Please refrain from engaging in any unlawful activities while using our app, ensuring a safe and compliant platform for everyone."),
    t("We reserve the right to modify our services and terms at any time, keeping you informed of any updates through our communication channels."),
    t("By proceeding, I consent to the electronic processing of transactions on this website. I authorize the collection and use of my personal information, including Aadhaar details (if applicable), for the purpose of generating electronic signatures. I further consent to the sharing of my personal information with authorized third-party e-signature service providers to facilitate this process. I understand that I may withdraw my consent at any time, and that electronically signed documents will be retained as electronic records for future reference."),
  ],
  accept: t("I have read and accept the Terms and Conditions."),
  error: t("Accept the terms to create your account"),
  submit: t("Accept and create account"),
} as const;

export const successStep = {
  title: t("Your account is ready"),
  body: t("You can add your address and official ID from your profile after entering the portal."),
  summonedAction: t("Continue to your case"),
  generalAction: t("Go to your home page"),
} as const;

/** Advocates and clerks do not get access on submission — the court approves first. */
export const approvalStep = {
  title: t("Your registration is awaiting approval"),
  /** `{id}` is the application number, shown so it can be quoted at the court. */
  body: t("Your registration (ID: {id}) is in progress. You will get an SMS when it is done."),
  action: t("View my application"),
  /* Integration, Oct 19. Used until the backend sends a readable
     application number (owner, Oct 19); also what a pending account sees at sign-in. */
  bodyNoNumber: t("Your registration is in progress. You will get an SMS when it is done."),
} as const;

export const applicationView = {
  title: t("Application number {id}"),
  /** Until the backend sends a readable number (integration, Oct 19). */
  titleNoNumber: t("Your application"),
  name: t("Name"),
  mobile: t("Mobile number"),
  email: t("Email address"),
  role: t("Registering as"),
} as const;
