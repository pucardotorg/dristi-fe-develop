/**
 * The password policy — the backend's, checked here first so the password step refuses
 * what the backend would refuse, instead of the person learning it at the last step.
 *
 * The backend (dristi-be `AUTH_PASSWORD_VALIDATORS`, Django 5.0) runs, on the password
 * after DRF trims surrounding whitespace:
 *
 *   length    at least 8 characters                  MinimumLengthValidator
 *   tooLong   at most 128 characters                 the serializer's max_length
 *   mobile    not too similar to the mobile number   UserAttributeSimilarityValidator
 *   name      not too similar to the name              (attributes name, email,
 *   email     not too similar to the email              mobile_number; 0.7)
 *   numeric   not entirely digits                    NumericPasswordValidator
 *   common    not on the common-password list        CommonPasswordValidator
 *
 * Nothing else: no mandatory uppercase, digit or symbol. Each rule is its own test so
 * the sentence the screen shows and the check the form runs cannot drift apart, and
 * `passwordProblem` reports the *first* failing rule in this order — one message at a
 * time is the whole point of the live hint under the field. (These replace the earlier
 * REG-40 to REG-44 rules, which only refused an exact match of name, mobile or email
 * and had a short local blacklist, so the backend refused passwords this file passed.)
 *
 * The common-password list is ~90 KB, so it is loaded on demand: pass the loaded set to
 * `passwordProblem`; without it the `common` rule is skipped (the backend still checks).
 */

export type PasswordRule =
  | "length"
  | "tooLong"
  | "mobile"
  | "name"
  | "email"
  | "numeric"
  | "common";

export type PasswordContext = {
  /** The 10 national digits; compared as the backend stores it, `+91…`. */
  mobile?: string;
  name?: string;
  email?: string;
};

export const MIN_PASSWORD_LENGTH = 8;
/** The registration serializer's `max_length` for the password. */
export const MAX_PASSWORD_LENGTH = 128;
/** Django's default `max_similarity` for `UserAttributeSimilarityValidator`. */
const MAX_SIMILARITY = 0.7;

/** Python's `len`: code points, not UTF-16 units. */
const chars = (value: string) => Array.from(value);

/**
 * Python's `difflib.SequenceMatcher(a, b).quick_ratio()`: 2 × (characters the two share,
 * counted with multiplicity, ignoring order) ÷ (total length). Django 5.0 compares with
 * this alone.
 */
function quickRatio(a: string[], b: string[]): number {
  const total = a.length + b.length;
  if (total === 0) return 1;
  const available = new Map<string, number>();
  for (const c of b) available.set(c, (available.get(c) ?? 0) + 1);
  let matches = 0;
  for (const c of a) {
    const left = available.get(c) ?? 0;
    if (left > 0) {
      available.set(c, left - 1);
      matches += 1;
    }
  }
  return (2 * matches) / total;
}

/** Django's `exceeds_maximum_length_ratio`: a part far shorter than the password is skipped. */
function exceedsLengthRatio(passwordLength: number, part: string[]): boolean {
  return (
    passwordLength >= 10 * part.length &&
    part.length < (MAX_SIMILARITY / 2) * passwordLength
  );
}

/**
 * Django's `UserAttributeSimilarityValidator` for one attribute: the password against the
 * whole value and each of its parts split on non-word characters (`re.split(r"\W+")`).
 */
function tooSimilar(password: string, value: string | undefined): boolean {
  if (!value) return false;
  const pwd = chars(password.toLowerCase());
  const whole = value.toLowerCase();
  const parts = [...whole.split(/[^\p{L}\p{N}_]+/u), whole];
  return parts.some((part) => {
    const partChars = chars(part);
    if (exceedsLengthRatio(pwd.length, partChars)) return false;
    return quickRatio(pwd, partChars) >= MAX_SIMILARITY;
  });
}

/** `9876543210` → `+919876543210`, the form the backend stores and compares. */
function backendMobile(mobile: string | undefined): string | undefined {
  const digits = mobile?.replace(/\D/g, "") ?? "";
  return digits.length === 10 ? `+91${digits}` : undefined;
}

export function passwordProblem(
  value: string,
  context: PasswordContext = {},
  commonPasswords?: ReadonlySet<string>,
): PasswordRule | null {
  // DRF trims the password before any validator sees it (and before storing it).
  const password = value.trim();
  const length = chars(password).length;
  if (length < MIN_PASSWORD_LENGTH) return "length";
  if (length > MAX_PASSWORD_LENGTH) return "tooLong";
  if (tooSimilar(password, backendMobile(context.mobile))) return "mobile";
  if (tooSimilar(password, context.name?.trim())) return "name";
  if (tooSimilar(password, context.email?.trim())) return "email";
  if (/^\p{Nd}+$/u.test(password)) return "numeric";
  if (commonPasswords?.has(password.toLowerCase())) return "common";
  return null;
}

export const passwordOk = (
  value: string,
  context?: PasswordContext,
  commonPasswords?: ReadonlySet<string>,
) => passwordProblem(value, context, commonPasswords) === null;

let commonPasswordsLoad: Promise<ReadonlySet<string>> | null = null;

/** The backend's common-password list, fetched once and shared. Retries after a failure. */
export function loadCommonPasswords(): Promise<ReadonlySet<string>> {
  commonPasswordsLoad ??= import("./common-passwords")
    .then(({ COMMON_PASSWORDS_TEXT }) => new Set(COMMON_PASSWORDS_TEXT.split("\n")))
    .catch((error: unknown) => {
      commonPasswordsLoad = null;
      throw error;
    });
  return commonPasswordsLoad;
}
