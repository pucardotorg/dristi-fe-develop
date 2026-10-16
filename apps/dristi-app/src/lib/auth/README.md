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
Registration (litigant)
  role, name ............................ kept in the browser, no call
  contact: Send code ..................... POST /auth/otp/request {purpose: "register"}
  contact: Verify ........................ POST /users       → creates/resumes the account, session cookie
  password, terms ........................ kept in the browser
  terms: Create account .................. POST /litigants   {name, email?, password, terms_accepted}

Sign-in
  number ................................. format check only (the backend never reveals
                                           whether a number has an account)
  credential: password ................... POST /sessions {mobile_number, password}
  credential: OTP ........................ POST /auth/otp/request {purpose: "login"},
                                           then POST /sessions {mobile_number, otp}
  next = "profile" ....................... registration resumes with the number verified
```

Codes are purpose-bound: a registration code cannot sign in, and the other way round.

## Errors

Screens see `AuthError.code`, never an HTTP status (`errors.ts`). `http.ts` translates
per endpoint — a 401 is a wrong code on `/users` and wrong credentials on `/sessions`.
Every network failure, timeout and unexpected status is `unavailable`. A 403 that is a
failed CSRF check (this app's origin missing from the backend's `CSRF_TRUSTED_ORIGINS`)
is reported as `unavailable` with a console hint, not as an expired session.

## Not integrated yet

| Gap | Today | Needs |
| --- | --- | --- |
| Power of attorney, advocate, clerk registration | `not-supported` in `api` mode; sandbox completes them | Backend: a POA role on `/litigants` (or its own endpoint); bar-ID document upload + approval flow for advocates/clerks |
| Role and name after sign-in | `POST /sessions` returns neither, so every backend sign-in opens the litigant home and the shell shows the number | Backend: `role` and `name` in the sessions response, or `GET` of the current account |
| Restoring a session after reload | The shell trusts what sign-in stored in `localStorage` | Same `GET` of the current account; then route guards |
| Sign-out | `signOut()` exists; no screen offers it yet | A sign-out control in the shell |
| Rejected advocate registration | Demo numbers in the sandbox only (`lib/registration/rejection.ts`) | Backend `registrations/current` (on a feature branch) |
