# Auth — sign-in and registration, and where the backend plugs in

The citizen sign-in (`components/sign-in-block.tsx`) and registration
(`components/registration/registration-flow.tsx`) talk to one interface, `AuthService`.
`getAuthService()` (`index.ts`) is the single place that picks who answers:

| `NEXT_PUBLIC_AUTH_SOURCE` | Implementation | Use |
| --- | --- | --- |
| `api` (default) | `http.ts` — the DRISTI backend through the `/api/v1` proxy | Development against a backend, and production |
| `sandbox` | `sandbox.ts` — in the browser, nothing persists | Demos and design review without a backend (`netlify.toml`) |

Both answer the same way — the sandbox refuses unknown numbers at sign-in and taken
numbers at registration — so the screens behave identically in either mode.

## Flows (dristi-be spec 0005)

```
Registration — every role
  role, name ............................ kept in the browser, no call
  contact: Send code ..................... POST /auth/otp/request {purpose: "register"}
  contact: Verify ........................ POST /users       → creates/resumes the account, session cookie
  password, (verification), terms ........ kept in the browser
  terms: Create account
    litigant ............................. POST /litigants   JSON {name, email?, password, terms_accepted}
    advocate ............................. POST /advocates   multipart: + profile.bar_registration_id, bar_id_document
    clerk ................................ POST /clerks      JSON {…, profile: {clerk_registration_number}},
                                                             or multipart with bar_id_document
  advocate / clerk ....................... backend ends the session → awaiting approval

Sign-in
  number ................................. format check only (the backend never reveals
                                           whether a number has an account)
  credential ............................. POST /sessions {mobile_number, password | otp}
                                           (OTP: POST /auth/otp/request {purpose: "login"} first)
  403 / E01013 ........................... awaiting approval (no session)
  next = "profile" ....................... registration resumes with the number verified
  next = "resubmit" ...................... GET /registrations/current → correction round →
                                           POST /registrations/current/resubmit → session ends →
                                           awaiting approval
  next = "terms" ......................... re-accept screen, to be built; until then signs
                                           in as normal
  next = null ............................ GET /users/me → role and name → that role's home
                                           (if it fails, sign-in shows "try again" — never a
                                           guessed home)
```

Codes are purpose-bound: a registration code cannot sign in, and the other way round.

Application numbers are shown only when the backend sends a readable `application_number`
(owner, Oct 19). The UUID `application_id` it sends today is never displayed.

## Errors

Screens see `AuthError.code`, never an HTTP status (`errors.ts`). `http.ts` translates
per endpoint — a 401 is a wrong code on `/users` and wrong credentials on `/sessions`.
Every network failure, timeout and unexpected status is `unavailable`. A 403 that is a
failed CSRF check (this app's origin missing from the backend's `CSRF_TRUSTED_ORIGINS`)
is reported as `unavailable` with a console hint, not as an expired session.

## Not integrated yet

| Gap | Today | Needs |
| --- | --- | --- |
| Power of attorney registration | `not-supported` in `api` mode; sandbox completes it | Backend: a way to record the POA role (`/litigants` stores LITIGANT) |
| Re-accepting updated terms (`next: "terms"`) | Signs in as normal | A re-accept screen (`POST /users/me/terms/` is on backend `main`) |
| Forgot password | The link does nothing | Screens for `auth/password-reset/verify/` and `auth/password-reset/` (on backend `main`) |
| Readable application number | Not shown | Backend: `application_number` in `/advocates`, `/clerks`, `/registrations/current` and resubmit responses |
| Restoring a session after reload | The shell trusts what sign-in stored in `localStorage` | Call `getCurrentAccount()` (`GET /users/me`) on load; then route guards |
| Sign-out | `signOut()` exists; no screen offers it yet | A sign-out control in the shell |
| Court-staff approval | Not integrated (owner, Oct 19: later) | Court-staff sign-in; `/dristi-requests/approvals/` |
