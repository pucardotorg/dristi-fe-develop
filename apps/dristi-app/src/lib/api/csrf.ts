/**
 * Django's CSRF token, as the browser holds it.
 *
 * The backend authenticates with a session cookie, so a write request (POST, PUT, PATCH,
 * DELETE) must also prove it came from this app: Django compares the `X-CSRFToken`
 * header with the `csrftoken` cookie it set at sign-in. The cookie is deliberately not
 * HttpOnly (Django's default) so this code can read it.
 *
 * Further reading: https://docs.djangoproject.com/en/5.0/howto/csrf/
 */

/** Django's default `CSRF_COOKIE_NAME`. Change both sides together if it ever moves. */
export const CSRF_COOKIE_NAME = "csrftoken";
export const CSRF_HEADER_NAME = "X-CSRFToken";

/** A cookie's value from a `document.cookie`-style string, or null. */
export function readCookie(name: string, cookieString: string): string | null {
  for (const pair of cookieString.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() !== name) continue;
    const value = pair.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

/** The current CSRF token in the browser; null on the server or before sign-in. */
export function readCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  return readCookie(CSRF_COOKIE_NAME, document.cookie);
}
